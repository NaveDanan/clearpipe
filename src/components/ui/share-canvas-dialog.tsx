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
import { Badge } from "@/components/ui/badge";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { usePipelineStore } from "@/stores/pipeline-store";
import UniqueLoading from "@/components/ui/morph-loading";

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
  shareMode?: 'private' | 'public' | 'verified';
  shareToken?: string;
  shareUrl: string;
  sharedWith: string[];
}

interface ShareCanvasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShareCanvasEnabledChange?: (enabled: boolean) => void;
}

export function ShareCanvasDialog({ open, onOpenChange, onShareCanvasEnabledChange }: ShareCanvasDialogProps) {
  const [email, setEmail] = useState("");
  const [emailsToInvite, setEmailsToInvite] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteProgress, setInviteProgress] = useState({ current: 0, total: 0 });
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shareSettings, setShareSettings] = useState<ShareSettings | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [shareMode, setShareMode] = useState<'public' | 'verified'>('public');
  const [isChangingMode, setIsChangingMode] = useState(false);
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
        setShareMode(data.shareMode || 'public');
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
      setIsLoadingInitial(true);
      Promise.all([
        fetchTeamMembers(),
        fetchShareSettings()
      ]).finally(() => {
        setIsLoadingInitial(false);
      });
    }
  }, [open, fetchTeamMembers, fetchShareSettings]);

  // Toggle public access and share mode
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
        body: JSON.stringify({ 
          isPublic: !isPublic,
          shareMode: shareMode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShareSettings(data);
        setIsPublic(data.isPublic);
        setShareMode(data.shareMode || 'public');
        // Notify parent component of the share state change
        onShareCanvasEnabledChange?.(data.isPublic);
      }
    } catch (err) {
      console.error('Failed to toggle public access:', err);
      setError("Failed to update sharing settings");
    }
  };

  // Handle share mode change
  const handleShareModeChange = async (newMode: 'public' | 'verified') => {
    if (!currentPipeline?.id) {
      setError("Please save the pipeline first before sharing");
      return;
    }

    setIsChangingMode(true);
    try {
      const res = await fetch(`/api/pipelines/${currentPipeline.id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shareMode: newMode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShareSettings(data);
        setShareMode(data.shareMode || 'public');
        setSuccess(`Sharing mode changed to ${newMode === 'public' ? 'public link' : 'verified users only'}`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Failed to change share mode:', err);
      setError("Failed to update sharing mode");
    } finally {
      setIsChangingMode(false);
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

  // Handle adding email to the list
  const handleAddEmail = () => {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    // Check if already in the list to invite
    if (emailsToInvite.some(e => e.toLowerCase() === trimmedEmail)) {
      setError("This email is already in the list");
      return;
    }

    // Check if already invited
    if (teamMembers.some(m => m.email.toLowerCase() === trimmedEmail)) {
      setError("This email has already been invited");
      return;
    }

    setEmailsToInvite(prev => [...prev, trimmedEmail]);
    setEmail("");
    setError(null);
  };

  // Handle removing email from the list
  const handleRemoveEmail = (emailToRemove: string) => {
    setEmailsToInvite(prev => prev.filter(e => e !== emailToRemove));
  };

  // Handle invite all emails
  const handleInviteAll = async () => {
    if (emailsToInvite.length === 0) {
      setError("Please add at least one email address");
      return;
    }

    setInviting(true);
    setError(null);
    setSuccess(null);
    setInviteProgress({ current: 0, total: emailsToInvite.length });

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (let i = 0; i < emailsToInvite.length; i++) {
      const emailToInvite = emailsToInvite[i];
      setInviteProgress({ current: i + 1, total: emailsToInvite.length });

      try {
        const res = await fetch('/api/team-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: emailToInvite,
            pipelineId: currentPipeline?.id,
            shareUrl: shareUrl,
          }),
        });

        if (res.ok) {
          const newMember = await res.json();
          setTeamMembers(prev => [newMember, ...prev]);
          results.success++;
        } else {
          const data = await res.json();
          results.failed++;
          results.errors.push(`${emailToInvite}: ${data.error || 'Failed'}`);
        }
      } catch (err) {
        console.error('Failed to invite:', emailToInvite, err);
        results.failed++;
        results.errors.push(`${emailToInvite}: Network error`);
      }
    }

    // Clear the emails list
    setEmailsToInvite([]);
    setInviting(false);
    setInviteProgress({ current: 0, total: 0 });

    // Show results
    if (results.success > 0 && results.failed === 0) {
      setSuccess(`Successfully invited ${results.success} member${results.success > 1 ? 's' : ''}`);
    } else if (results.success > 0 && results.failed > 0) {
      setSuccess(`Invited ${results.success} member${results.success > 1 ? 's' : ''}, ${results.failed} failed`);
    } else if (results.failed > 0) {
      setError(`Failed to invite ${results.failed} member${results.failed > 1 ? 's' : ''}`);
    }

    // Clear success message after 5 seconds
    setTimeout(() => setSuccess(null), 5000);
  };

  // Handle remove member
  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/team-members/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Refresh team members list from server to ensure sync
        await fetchTeamMembers();
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

        {/* Initial Loading State */}
        {isLoadingInitial && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <UniqueLoading variant="morph" size="lg" />
              <p className="text-sm text-muted-foreground">Loading share settings...</p>
            </div>
          </div>
        )}

        {!isLoadingInitial && (
          <>
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

            {/* Loading Overlay for mode change */}
            {isChangingMode && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                <div className="flex flex-col items-center gap-3">
                  <UniqueLoading variant="morph" size="md" />
                  <p className="text-sm text-muted-foreground">Updating sharing mode...</p>
                </div>
              </div>
            )}

            {/* Loading Overlay for sending invitations */}
            {inviting && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                <div className="flex flex-col items-center gap-4">
                  <UniqueLoading variant="morph" size="lg" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Sending Invitations</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {inviteProgress.current} of {inviteProgress.total} sent
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Share Mode Selection */}
            {isPublic && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-left">Sharing Mode</p>
                <div className="grid grid-cols-2 gap-2">
                  {/* Public Mode */}
                  <button
                    onClick={() => handleShareModeChange('public')}
                    disabled={isChangingMode}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-left",
                      isChangingMode && "opacity-50 cursor-not-allowed",
                      shareMode === 'public'
                        ? "border-green-500 bg-green-500/10"
                        : "border-muted bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon 
                        icon="solar:link-bold-duotone" 
                        className={cn(
                          "size-4 mt-0.5 shrink-0",
                          shareMode === 'public' ? "text-green-500" : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className={cn(
                          "text-xs font-semibold",
                          shareMode === 'public' ? "text-green-600" : "text-foreground"
                        )}>
                          Public Link
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Anyone with link
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Verified Mode */}
                  <button
                    onClick={() => handleShareModeChange('verified')}
                    disabled={isChangingMode}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-left",
                      isChangingMode && "opacity-50 cursor-not-allowed",
                      shareMode === 'verified'
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-muted bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon 
                        icon="solar:shield-check-bold-duotone" 
                        className={cn(
                          "size-4 mt-0.5 shrink-0",
                          shareMode === 'verified' ? "text-blue-500" : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className={cn(
                          "text-xs font-semibold",
                          shareMode === 'verified' ? "text-blue-600" : "text-foreground"
                        )}>
                          Verified Users
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Invited members only
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

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
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                  className="flex-1"
                  disabled={inviting}
                />
                <Button
                  variant="outline"
                  onClick={handleAddEmail}
                  disabled={inviting || !email}
                  className="shrink-0"
                >
                  <Icon icon="solar:add-circle-line-duotone" className="size-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* Email Badges */}
              {emailsToInvite.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {emailsToInvite.map((emailItem) => (
                      <Badge
                        key={emailItem}
                        variant="secondary"
                        className="pl-2 pr-1 py-1 flex items-center gap-1 text-xs"
                      >
                        <span className="max-w-[150px] truncate">{emailItem}</span>
                        <button
                          onClick={() => handleRemoveEmail(emailItem)}
                          className="ml-1 hover:bg-muted rounded-full p-0.5 transition-colors"
                          disabled={inviting}
                        >
                          <Icon icon="solar:close-circle-bold" className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Button
                    onClick={handleInviteAll}
                    disabled={inviting}
                    className="w-full"
                    size="sm"
                  >
                    <Icon icon="solar:letter-line-duotone" className="size-4 mr-2" />
                    Invite {emailsToInvite.length} Member{emailsToInvite.length > 1 ? 's' : ''}
                  </Button>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                  <Icon icon="solar:danger-circle-bold" className="size-4 shrink-0" />
                  {error}
                </p>
              )}

              {success && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                  <Icon icon="solar:check-circle-bold" className="size-4 shrink-0" />
                  {success}
                </p>
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
                        className="size-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                        onClick={() => handleRemove(member.id)}
                      >
                        <Icon icon="solar:trash-bin-trash-bold-duotone" className="size-4 text-red-500" />
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ShareCanvasDialog;
