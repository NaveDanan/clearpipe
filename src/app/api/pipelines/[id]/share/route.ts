import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { pipelinesRepository } from '@/lib/db/supabase-repositories';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Helper to get current user
async function getCurrentUser(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/pipelines/[id]/share - Get share settings for a pipeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(request);

    const pipeline = await pipelinesRepository.getById(id);
    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      );
    }

    // Check if user has access to view share settings (must be owner)
    const canManageSharing = user && pipeline.user_id === user.id;
    if (!canManageSharing) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Build the share URL
    const baseUrl = request.nextUrl.origin;
    const shareUrl = pipeline.is_public && pipeline.share_token
      ? `${baseUrl}/canvas/${pipeline.id}?token=${pipeline.share_token}`
      : `${baseUrl}/canvas/${pipeline.id}`;

    return NextResponse.json({
      id: pipeline.id,
      name: pipeline.name,
      isPublic: pipeline.is_public || false,
      shareToken: pipeline.share_token,
      shareUrl,
      sharedWith: pipeline.shared_with || [],
    });
  } catch (error) {
    console.error('Error getting share settings:', error);
    return NextResponse.json(
      { error: 'Failed to get share settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/pipelines/[id]/share - Update share settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(request);
    const body = await request.json();

    const pipeline = await pipelinesRepository.getById(id);
    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      );
    }

    // Check if user has access to update share settings (must be owner)
    const canManageSharing = user && pipeline.user_id === user.id;
    if (!canManageSharing) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update share settings
    if (typeof body.isPublic === 'boolean') {
      await pipelinesRepository.setPublicAccess(id, body.isPublic);
    }

    // Regenerate share token if requested
    if (body.regenerateToken) {
      await pipelinesRepository.regenerateShareToken(id);
    }

    // Get updated pipeline
    const updatedPipeline = await pipelinesRepository.getById(id);
    
    // Build the share URL
    const baseUrl = request.nextUrl.origin;
    const shareUrl = updatedPipeline?.is_public && updatedPipeline?.share_token
      ? `${baseUrl}/canvas/${updatedPipeline.id}?token=${updatedPipeline.share_token}`
      : `${baseUrl}/canvas/${updatedPipeline?.id}`;

    return NextResponse.json({
      id: updatedPipeline?.id,
      name: updatedPipeline?.name,
      isPublic: updatedPipeline?.is_public || false,
      shareToken: updatedPipeline?.share_token,
      shareUrl,
      sharedWith: updatedPipeline?.shared_with || [],
    });
  } catch (error) {
    console.error('Error updating share settings:', error);
    return NextResponse.json(
      { error: 'Failed to update share settings' },
      { status: 500 }
    );
  }
}
