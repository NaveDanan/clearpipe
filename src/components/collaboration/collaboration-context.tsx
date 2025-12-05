'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePipelineStore } from '@/stores/pipeline-store';

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
  sendMessage: (message: string) => void;
}

const COLLABORATOR_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

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
  const cursorPositionRef = useRef({ x: 0, y: 0 });
  const lastBroadcastRef = useRef(0);

  // Simulate current user as a collaborator for demo purposes
  useEffect(() => {
    if (!pipelineId || !userId) {
      setCollaborators([]);
      setIsConnected(false);
      return;
    }

    // In a real implementation, this would connect to a WebSocket server
    // For now, we'll simulate the current user being connected
    setIsConnected(true);

    // Add current user as a collaborator
    const currentUser: Collaborator = {
      id: userId,
      name: userName || 'You',
      email: userEmail || '',
      avatarUrl: userAvatar,
      color: COLLABORATOR_COLORS[0],
      isOnline: true,
      joinedAt: new Date().toISOString(),
    };

    setCollaborators([currentUser]);

    // Simulate other collaborators joining (for demo)
    // In production, this would come from the WebSocket server
    const demoCollaborators: Collaborator[] = [];
    
    // Check if pipeline is shared and add mock collaborators for demo
    const checkSharing = async () => {
      try {
        const res = await fetch(`/api/pipelines/${pipelineId}/share`);
        if (res.ok) {
          const data = await res.json();
          if (data.isPublic || (data.sharedWith && data.sharedWith.length > 0)) {
            // Pipeline is shared, we could show other users here
            // For demo, we won't add fake users
          }
        }
      } catch (err) {
        // Ignore errors
      }
    };
    
    checkSharing();

    return () => {
      setIsConnected(false);
      setCollaborators([]);
    };
  }, [pipelineId, userId, userName, userEmail, userAvatar]);

  const updateCursorPosition = useCallback((x: number, y: number) => {
    cursorPositionRef.current = { x, y };
    
    // Throttle broadcasts to avoid overwhelming the server
    const now = Date.now();
    if (now - lastBroadcastRef.current < 50) return;
    lastBroadcastRef.current = now;

    // Update local state for current user's cursor
    setCollaborators(prev => prev.map(c => 
      c.id === userId 
        ? { ...c, cursor: { x, y, lastUpdate: now } }
        : c
    ));

    // In a real implementation, broadcast to WebSocket server
    // ws.send(JSON.stringify({ type: 'cursor', x, y }));
  }, [userId]);

  const sendMessage = useCallback((message: string) => {
    // In a real implementation, this would send a message through WebSocket
    console.log('Sending message:', message);
  }, []);

  return (
    <CollaborationContext.Provider
      value={{
        collaborators,
        currentUserId: userId || null,
        isConnected,
        updateCursorPosition,
        sendMessage,
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
