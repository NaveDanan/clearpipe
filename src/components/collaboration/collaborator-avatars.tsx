'use client';

import { AvatarStack } from '@/components/kibo-ui/avatar-stack';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOnlineCollaborators, type Collaborator } from './collaboration-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CollaboratorAvatarsProps {
  className?: string;
  maxVisible?: number;
  size?: number;
}

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return 'U';
}

export function CollaboratorAvatars({ 
  className, 
  maxVisible = 5,
  size = 32,
}: CollaboratorAvatarsProps) {
  const collaborators = useOnlineCollaborators();

  if (collaborators.length === 0) {
    return null;
  }

  const visibleCollaborators = collaborators.slice(0, maxVisible);
  const hiddenCount = collaborators.length - maxVisible;

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-2', className)}>
        <AvatarStack animate size={size}>
          {visibleCollaborators.map((collaborator) => (
            <Tooltip key={collaborator.id}>
              <TooltipTrigger asChild>
                <Avatar
                  className="border-2 cursor-pointer"
                  style={{ borderColor: collaborator.color }}
                >
                  <AvatarImage 
                    src={collaborator.avatarUrl} 
                    alt={collaborator.name} 
                  />
                  <AvatarFallback 
                    className="text-xs font-medium"
                    style={{ backgroundColor: `${collaborator.color}20`, color: collaborator.color }}
                  >
                    {getInitials(collaborator.name, collaborator.email)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex flex-col gap-0.5">
                <span className="font-medium">{collaborator.name}</span>
                <span className="text-xs text-muted-foreground">{collaborator.email}</span>
                <span className="text-xs flex items-center gap-1">
                  <span 
                    className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                  />
                  Online
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
          
          {hiddenCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="border-2 border-muted-foreground cursor-pointer">
                  <AvatarFallback className="text-xs font-medium bg-muted">
                    +{hiddenCount}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>{hiddenCount} more collaborator{hiddenCount > 1 ? 's' : ''}</span>
              </TooltipContent>
            </Tooltip>
          )}
        </AvatarStack>

        {collaborators.length > 1 && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {collaborators.length} online
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}

export default CollaboratorAvatars;
