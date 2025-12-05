'use client';

import { useEffect, useState } from 'react';
import {
  Cursor,
  CursorBody,
  CursorName,
  CursorPointer,
} from '@/components/kibo-ui/cursor';
import { useOtherCollaborators, type Collaborator } from './collaboration-context';
import { cn } from '@/lib/utils';

interface CollaboratorCursorsProps {
  containerRef?: React.RefObject<HTMLElement>;
}

export function CollaboratorCursors({ containerRef }: CollaboratorCursorsProps) {
  const otherCollaborators = useOtherCollaborators();
  const [visibleCursors, setVisibleCursors] = useState<Map<string, boolean>>(new Map());

  // Hide cursors that haven't been updated recently
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newVisibleCursors = new Map<string, boolean>();
      
      otherCollaborators.forEach(collaborator => {
        if (collaborator.cursor) {
          // Hide cursor if it hasn't been updated in 5 seconds
          const isVisible = now - collaborator.cursor.lastUpdate < 5000;
          newVisibleCursors.set(collaborator.id, isVisible);
        }
      });
      
      setVisibleCursors(newVisibleCursors);
    }, 1000);

    return () => clearInterval(interval);
  }, [otherCollaborators]);

  // Only show cursors for collaborators who have cursor positions
  const collaboratorsWithCursors = otherCollaborators.filter(
    c => c.cursor && (visibleCursors.get(c.id) ?? true)
  );

  if (collaboratorsWithCursors.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {collaboratorsWithCursors.map((collaborator) => (
        <CollaboratorCursor 
          key={collaborator.id} 
          collaborator={collaborator}
        />
      ))}
    </div>
  );
}

interface CollaboratorCursorProps {
  collaborator: Collaborator;
}

function CollaboratorCursor({ collaborator }: CollaboratorCursorProps) {
  const { cursor, name, color } = collaborator;
  
  if (!cursor) return null;

  // Get first name or username
  const displayName = name.split(' ')[0] || name;

  return (
    <div
      className="absolute transition-all duration-75 ease-out"
      style={{
        left: cursor.x,
        top: cursor.y,
        transform: 'translate(-2px, -2px)',
      }}
    >
      <Cursor>
        <CursorPointer style={{ color }} />
        <CursorBody 
          className="shadow-sm"
          style={{ 
            backgroundColor: `${color}15`,
            color: color,
            borderColor: `${color}30`,
          }}
        >
          <CursorName className="font-medium">{displayName}</CursorName>
        </CursorBody>
      </Cursor>
    </div>
  );
}

export default CollaboratorCursors;
