'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePipelineStore } from '@/stores/pipeline-store';
import { 
  PipelineRealtimeManager, 
  realtimeService, 
  getUserColor,
  type UserPresence,
  type PipelineChangeBroadcast 
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
  updateCursorPosition: (x: number, y: number) => void;
  broadcastPipelineChange: (type: PipelineChangeBroadcast['type'], payload: any) => void;
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
}

export function CollaborationProvider({
  children,
  pipelineId,
  userId,
  userName,
  userEmail,
  userAvatar,
}: CollaborationProviderProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const managerRef = useRef<PipelineRealtimeManager | null>(null);
  const lastCursorBroadcastRef = useRef(0);

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
          onNodesChange(payload);
        }
        break;

      case 'edges':
        // Apply edge changes
        if (Array.isArray(payload)) {
          onEdgesChange(payload);
        }
        break;

      case 'node_data':
        // Update specific node data
        if (payload.nodeId && payload.data) {
          usePipelineStore.getState().updateNodeData(payload.nodeId, payload.data);
        }
        break;

      case 'node_add':
        // Add a new node
        if (payload.type && payload.position) {
          // Use store directly to avoid triggering broadcasts
          const { nodes: currentNodes } = usePipelineStore.getState();
          if (!currentNodes.find(n => n.id === payload.id)) {
            usePipelineStore.setState({
              nodes: [...currentNodes, payload],
              isDirty: true,
            });
          }
        }
        break;

      case 'node_delete':
        // Delete a node
        if (payload.nodeId) {
          const { nodes: currentNodes, edges: currentEdges } = usePipelineStore.getState();
          usePipelineStore.setState({
            nodes: currentNodes.filter(n => n.id !== payload.nodeId),
            edges: currentEdges.filter(e => e.source !== payload.nodeId && e.target !== payload.nodeId),
            isDirty: true,
          });
        }
        break;

      case 'full_sync':
        // Full state sync (used for initial sync or recovery)
        if (payload.nodes && payload.edges) {
          usePipelineStore.setState({
            nodes: payload.nodes,
            edges: payload.edges,
            isDirty: true,
          });
        }
        break;
    }
  }, [onNodesChange, onEdgesChange]);

  // Connect to realtime channel
  useEffect(() => {
    if (!pipelineId || !userId) {
      setCollaborators([]);
      setIsConnected(false);
      return;
    }

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
        setCollaborators(prev => {
          // Check if user already exists
          if (prev.find(c => c.id === user.id)) {
            return prev.map(c => c.id === user.id ? userPresenceToCollaborator(user) : c);
          }
          return [...prev, userPresenceToCollaborator(user)];
        });
      },

      onUserLeave: (leftUserId) => {
        setCollaborators(prev => prev.map(c =>
          c.id === leftUserId ? { ...c, isOnline: false } : c
        ).filter(c => c.isOnline)); // Remove offline users after a moment
      },
    });

    managerRef.current = manager;

    // Connect to the channel
    manager.connect().then((connected) => {
      setIsConnected(connected);
      if (!connected) {
        console.warn('Failed to connect to collaboration channel');
      }
    });

    // Cleanup on unmount or when deps change
    return () => {
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
    payload: any
  ) => {
    managerRef.current?.broadcastPipelineChange(type, payload);
  }, []);

  return (
    <CollaborationContext.Provider
      value={{
        collaborators,
        currentUserId: userId || null,
        isConnected,
        updateCursorPosition,
        broadcastPipelineChange,
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
