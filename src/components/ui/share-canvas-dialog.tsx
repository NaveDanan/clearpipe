"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { usePipelineStore } from "@/stores/pipeline-store";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  invitedAt: string;
}

interface ShareSettings {
  id: string;
  name: string;
  isPublic: boolean;
  shareToken?: string;
  shareUrl: string;
  sharedWith: string[];
}

interface ShareCanvasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareCanvasDialog({ open, onOpenChange }: ShareCanvasDialogProps) {
  const [email, setEmail] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareSettings, setShareSettings] = useState<ShareSettings | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const { currentPipeline, savePipeline } = usePipelineStore();

  // Get current share URL from settings or fallback
  const shareUrl = shareSettings?.shareUrl || (typeof window !== 'undefined' ? window.location.href : '');

  // Fetch share settings
  const fetchShareSettings = useCallback(async () => {
    if (!currentPipeline?.id) return;
    
    try {
      const res = await fetch(`/api/pipelines/${currentPipeline.id}/share`);
      if (res.ok) {
        const data = await res.json();
        setShareSettings(data);
        setIsPublic(data.isPublic);
      }
    } catch (err) {
      console.error('Failed to fetch share settings:', err);
    }
  }, [currentPipeline?.id]);

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/team-members');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch team members:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchTeamMembers();
      fetchShareSettings();
    }
  }, [open, fetchTeamMembers, fetchShareSettings]);

  // Toggle public access
  const handleTogglePublic = async () => {
    if (!currentPipeline?.id) {
      // Need to save pipeline first
      setError("Please save the pipeline first before sharing");
      return;
    }

    try {
      const res = await fetch(`/api/pipelines/${currentPipeline.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !isPublic }),
      });

      if (res.ok) {
        const data = await res.json();
        setShareSettings(data);
        setIsPublic(data.isPublic);
      }
    } catch (err) {
      console.error('Failed to toggle public access:', err);
      setError("Failed to update sharing settings");
    }
  };

  // Regenerate share token
  const handleRegenerateToken = async () => {
    if (!currentPipeline?.id) return;

    setRegenerating(true);
    try {
      const res = await fetch(`/api/pipelines/${currentPipeline.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateToken: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setShareSettings(data);
      }
    } catch (err) {
      console.error('Failed to regenerate token:', err);
      setError("Failed to regenerate share link");
    } finally {
      setRegenerating(false);
    }
  };

  // Validate email
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Handle invite
  const handleInvite = async () => {
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Check if already invited
    if (teamMembers.some(m => m.email.toLowerCase() === email.toLowerCase())) {
      setError("This email has already been invited");
      return;
    }

    setInviting(true);
    setError(null);

    try {
      const res = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const newMember = await res.json();
        setTeamMembers(prev => [newMember, ...prev]);
        setEmail("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send invitation");
      }
    } catch (err) {
      console.error('Failed to invite:', err);
      setError("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  // Handle remove member
  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/team-members/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setTeamMembers(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  // Handle copy link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get initials from name or email
  const getInitials = (name: string, email: string) => {
    if (name && name !== email.split('@')[0]) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  // Generate QR code URL using a public API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;

  // Check if pipeline needs to be saved first
  const needsSave = !currentPipeline?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Share Canvas</DialogTitle>
          <DialogDescription>
            Share your pipeline canvas with team members securely.
          </DialogDescription>
        </DialogHeader>

        {/* Warning if pipeline not saved */}
        {needsSave && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Icon icon="solar:danger-triangle-bold-duotone" className="size-5 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Save your pipeline first to enable sharing features.
            </p>
          </div>
        )}

        {/* Public Access Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isPublic ? "bg-green-500/10" : "bg-muted"
            )}>
              <Icon 
                icon={isPublic ? "solar:lock-unlocked-bold-duotone" : "solar:lock-bold-duotone"} 
                className={cn("size-5", isPublic ? "text-green-500" : "text-muted-foreground")} 
              />
            </div>
            <div>
              <p className="text-sm font-medium">
                {isPublic ? "Public Link Enabled" : "Private Pipeline"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPublic 
                  ? "Anyone with the link can view this pipeline" 
                  : "Only invited members can access"
                }
              </p>
            </div>
          </div>
          <Button
            variant={isPublic ? "default" : "outline"}
            size="sm"
            onClick={handleTogglePublic}
            disabled={needsSave}
            className={isPublic ? "bg-green-500 hover:bg-green-600" : ""}
          >
            {isPublic ? "Enabled" : "Enable"}
          </Button>
        </div>

        {/* Secure Share Link */}
        {isPublic && shareSettings && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 text-xs font-mono bg-muted/50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                <Icon 
                  icon={copied ? "solar:check-circle-bold" : "solar:copy-line-duotone"} 
                  className={cn("size-4", copied && "text-green-500")} 
                />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon icon="solar:shield-check-bold-duotone" className="size-3 text-green-500" />
                Secure token-based access
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerateToken}
                disabled={regenerating}
                className="h-6 text-xs"
              >
                {regenerating ? (
                  <Icon icon="solar:spinner-line-duotone" className="size-3 animate-spin mr-1" />
                ) : (
                  <Icon icon="solar:refresh-line-duotone" className="size-3 mr-1" />
                )}
                Regenerate Link
              </Button>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Invite Team Members</p>
          
          {/* Invite Input */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInvite();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleInvite}
              disabled={inviting || !email}
              className="shrink-0"
            >
              {inviting ? (
                <Icon icon="solar:spinner-line-duotone" className="size-4 animate-spin" />
              ) : (
                "Invite"
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </div>

        {/* Team Members List */}
        <ScrollArea className="h-[200px] -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Icon icon="solar:spinner-line-duotone" className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Icon icon="solar:users-group-rounded-line-duotone" className="size-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No team members yet</p>
              <p className="text-xs text-muted-foreground/70">Invite someone to collaborate!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <Avatar className="size-9">
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                    <AvatarFallback className="text-xs">
                      {getInitials(member.name, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-primary">
                      {member.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemove(member.id)}
                  >
                    <Icon icon="solar:menu-dots-bold" className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Share Options */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleCopyLink}
            disabled={!isPublic || needsSave}
          >
            <Icon 
              icon={copied ? "solar:check-circle-bold" : "solar:copy-line-duotone"} 
              className={cn("size-4 mr-2", copied && "text-green-500")} 
            />
            {copied ? "Copied!" : "Copy Link"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShowQR(!showQR)}
            disabled={!isPublic || needsSave}
          >
            <Icon icon="solar:qr-code-line-duotone" className="size-4 mr-2" />
            {showQR ? "Hide QR" : "Show QR"}
          </Button>
        </div>

        {/* QR Code */}
        {showQR && isPublic && (
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <img
              src={qrCodeUrl}
              alt="QR Code"
              width={200}
              height={200}
              className="rounded"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ShareCanvasDialog;
