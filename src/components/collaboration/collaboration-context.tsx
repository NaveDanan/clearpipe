'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePipelineStore } from '@/stores/pipeline-store';
import { 
  PipelineRealtimeManager, 
  realtimeService, 
  getUserColor,
  type UserPresence,
  type PipelineChangeBroadcast,
  type PipelineChangePayload,
} from '@/lib/supabase/realtime';

interface CollaboratorCursor {
  x: number;
  y: number;
  lastUpdate: number;
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  color: string;
  cursor?: CollaboratorCursor;
  isOnline: boolean;
  joinedAt: string;
}

interface CollaborationContextType {
  collaborators: Collaborator[];
  currentUserId: string | null;
  isConnected: boolean;
  isShareCanvasEnabled: boolean;
  updateCursorPosition: (x: number, y: number) => void;
  broadcastPipelineChange: (type: PipelineChangeBroadcast['type'], payload: PipelineChangePayload) => void;
  setShareCanvasEnabled: (enabled: boolean) => void;
}

const CollaborationContext = createContext<CollaborationContextType | null>(null);

export function useCollaboration() {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
}

interface CollaborationProviderProps {
  children: React.ReactNode;
  pipelineId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
  isShareCanvasEnabled?: boolean;
  onShareCanvasEnabledChange?: (enabled: boolean) => void;
}

export function CollaborationProvider({
  children,
  pipelineId,
  userId,
  userName,
  userEmail,
  userAvatar,
  isShareCanvasEnabled = false,
  onShareCanvasEnabledChange,
}: CollaborationProviderProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [shareCanvasEnabled, setShareCanvasEnabledState] = useState(isShareCanvasEnabled);
  const managerRef = useRef<PipelineRealtimeManager | null>(null);
  const lastCursorBroadcastRef = useRef(0);

  // Handle Share Canvas enabled changes
  const setShareCanvasEnabled = useCallback((enabled: boolean) => {
    setShareCanvasEnabledState(enabled);
    onShareCanvasEnabledChange?.(enabled);
  }, [onShareCanvasEnabledChange]);

  // Get pipeline store functions for syncing changes
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange 
  } = usePipelineStore();
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  // Keep refs updated
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Convert UserPresence to Collaborator
  const userPresenceToCollaborator = useCallback((presence: UserPresence): Collaborator => ({
    id: presence.id,
    name: presence.name,
    email: presence.email,
    avatarUrl: presence.avatarUrl,
    color: presence.color,
    cursor: presence.cursor ? {
      x: presence.cursor.x,
      y: presence.cursor.y,
      lastUpdate: Date.now(),
    } : undefined,
    isOnline: true,
    joinedAt: presence.lastSeen,
  }), []);

  // Handle incoming pipeline changes from other users
  const handlePipelineChange = useCallback((change: PipelineChangeBroadcast) => {
    const { type, payload } = change;

    switch (type) {
      case 'nodes':
        // Apply node position/dimension changes
        if (Array.isArray(payload)) {
          onNodesChange(payload as Parameters<typeof onNodesChange>[0]);
        }
        break;

      case 'edges':
        // Apply edge changes
        if (Array.isArray(payload)) {
          onEdgesChange(payload as Parameters<typeof onEdgesChange>[0]);
        }
        break;

      case 'node_data': {
        // Update specific node data
        const nodeDataPayload = payload as any;
        if (nodeDataPayload.nodeId && nodeDataPayload.data) {
          usePipelineStore.getState().updateNodeData(nodeDataPayload.nodeId, nodeDataPayload.data);
        }
        break;
      }

      case 'node_add': {
        // Add a new node
        const nodeAddPayload = payload as any;
        if (nodeAddPayload.type && nodeAddPayload.position) {
          // Use store directly to avoid triggering broadcasts
          const { nodes: currentNodes } = usePipelineStore.getState();
          if (!currentNodes.find(n => n.id === nodeAddPayload.id)) {
            usePipelineStore.setState({
              nodes: [...currentNodes, nodeAddPayload],
              isDirty: true,
            });
          }
        }
        break;
      }

      case 'node_delete': {
        // Delete a node
        const nodeDeletePayload = payload as any;
        if (nodeDeletePayload.nodeId) {
          const { nodes: currentNodes, edges: currentEdges } = usePipelineStore.getState();
          usePipelineStore.setState({
            nodes: currentNodes.filter(n => n.id !== nodeDeletePayload.nodeId),
            edges: currentEdges.filter(e => e.source !== nodeDeletePayload.nodeId && e.target !== nodeDeletePayload.nodeId),
            isDirty: true,
          });
        }
        break;
      }

      case 'full_sync': {
        // Full state sync (used for initial sync or recovery)
        const fullSyncPayload = payload as any;
        if (fullSyncPayload.nodes && fullSyncPayload.edges) {
          usePipelineStore.setState({
            nodes: fullSyncPayload.nodes,
            edges: fullSyncPayload.edges,
            isDirty: true,
          });
        }
        break;
      }
    }
  }, [onNodesChange, onEdgesChange]);

  // Connect to realtime channel
  useEffect(() => {
    // Log connection attempt details
    console.log('[Collaboration] Connection check:', {
      pipelineId,
      userId,
      userName,
      hasManager: !!managerRef.current,
    });

    if (!pipelineId) {
      console.log('[Collaboration] No pipeline ID, skipping connection');
      setCollaborators([]);
      setIsConnected(false);
      return;
    }

    if (!userId) {
      console.log('[Collaboration] No user ID, skipping connection');
      setCollaborators([]);
      setIsConnected(false);
      return;
    }

    console.log('[Collaboration] Connecting to channel for pipeline:', pipelineId);

    // Create and configure the realtime manager
    const manager = realtimeService.createManager({
      pipelineId,
      userId,
      userName: userName || 'Anonymous',
      userEmail: userEmail || '',
      userAvatar,
    });

    manager.setHandlers({
      onPresenceSync: (users) => {
        console.log('[Collaboration] Presence sync, users:', users.length);
        setCollaborators(users.map(userPresenceToCollaborator));
      },

      onCursorMove: (cursorUserId, x, y) => {
        setCollaborators(prev => prev.map(c =>
          c.id === cursorUserId
            ? { ...c, cursor: { x, y, lastUpdate: Date.now() } }
            : c
        ));
      },

      onPipelineChange: handlePipelineChange,

      onUserJoin: (user) => {
        console.log('[Collaboration] User joined:', user.name);
        setCollaborators(prev => {
          // Check if user already exists
          if (prev.find(c => c.id === user.id)) {
            return prev.map(c => c.id === user.id ? userPresenceToCollaborator(user) : c);
          }
          return [...prev, userPresenceToCollaborator(user)];
        });
      },

      onUserLeave: (leftUserId) => {
        console.log('[Collaboration] User left:', leftUserId);
        setCollaborators(prev => prev.map(c =>
          c.id === leftUserId ? { ...c, isOnline: false } : c
        ).filter(c => c.isOnline)); // Remove offline users after a moment
      },
    });

    managerRef.current = manager;

    // Connect to the channel
    manager.connect().then((connected) => {
      console.log('[Collaboration] Connection result:', connected);
      setIsConnected(connected);
      if (!connected) {
        console.warn('[Collaboration] Failed to connect to collaboration channel');
      } else {
        console.log('[Collaboration] Successfully connected to channel');
      }
    }).catch((err) => {
      console.error('[Collaboration] Connection error:', err);
      setIsConnected(false);
    });

    // Cleanup on unmount or when deps change
    return () => {
      console.log('[Collaboration] Disconnecting from pipeline:', pipelineId);
      realtimeService.disconnectPipeline(pipelineId);
      managerRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
    };
  }, [pipelineId, userId, userName, userEmail, userAvatar, userPresenceToCollaborator, handlePipelineChange]);

  // Throttled cursor position update
  const updateCursorPosition = useCallback((x: number, y: number) => {
    const now = Date.now();
    
    // Throttle to max 20 updates per second (50ms)
    if (now - lastCursorBroadcastRef.current < 50) return;
    lastCursorBroadcastRef.current = now;

    // Broadcast cursor position via realtime
    managerRef.current?.broadcastCursor(x, y);

    // Update local collaborator state for current user
    if (userId) {
      setCollaborators(prev => prev.map(c =>
        c.id === userId
          ? { ...c, cursor: { x, y, lastUpdate: now } }
          : c
      ));
    }
  }, [userId]);

  // Broadcast pipeline changes
  const broadcastPipelineChange = useCallback((
    type: PipelineChangeBroadcast['type'],
    payload: PipelineChangePayload
  ) => {
    managerRef.current?.broadcastPipelineChange(type, payload);
  }, []);

  return (
    <CollaborationContext.Provider
      value={{
        collaborators,
        currentUserId: userId || null,
        isConnected,
        isShareCanvasEnabled: shareCanvasEnabled,
        updateCursorPosition,
        broadcastPipelineChange,
        setShareCanvasEnabled,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
}

// Hook to get only other collaborators (not current user)
export function useOtherCollaborators() {
  const { collaborators, currentUserId } = useCollaboration();
  return collaborators.filter(c => c.id !== currentUserId && c.isOnline);
}

// Hook to get all online collaborators including current user
export function useOnlineCollaborators() {
  const { collaborators } = useCollaboration();
  return collaborators.filter(c => c.isOnline);
}

// Hook to broadcast pipeline changes - use this when modifying the pipeline
export function useBroadcastChange() {
  const { broadcastPipelineChange } = useCollaboration();
  return broadcastPipelineChange;
}

// Safe version of useBroadcastChange that can be used outside CollaborationProvider
// Returns a no-op function if not in a collaboration context
export function useSafeBroadcastChange() {
  const context = useContext(CollaborationContext);
  if (!context) {
    // Return a no-op function when not in collaboration context
    return (() => {}) as (type: PipelineChangeBroadcast['type'], payload: PipelineChangePayload) => void;
  }
  return context.broadcastPipelineChange;
}
