import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { pipelinesRepository } from '@/lib/db/supabase-repositories';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// POST /api/pipelines/verify-access - Verify access to a pipeline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pipelineId, shareToken } = body;

    console.log('verify-access called with:', { pipelineId, shareToken: shareToken ? '***' : undefined });

    if (!pipelineId) {
      return NextResponse.json(
        { error: 'Pipeline ID is required' },
        { status: 400 }
      );
    }

    // Get current user if Supabase is configured
    let userId: string | undefined;
    
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              // Not needed for this read-only operation
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }

    console.log('verify-access userId:', userId || 'none');

    // Check access permissions first (this handles share token verification)
    const hasAccess = await pipelinesRepository.hasAccess(pipelineId, userId, shareToken);

    console.log('verify-access hasAccess:', hasAccess);

    if (!hasAccess) {
      // If a share token was provided but access denied, it's invalid
      if (shareToken) {
        console.log('verify-access: Invalid share token');
        return NextResponse.json(
          { error: 'Invalid or expired share link' },
          { status: 403 }
        );
      }
      // If no userId and no valid share token, user needs to login
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      // User is authenticated but doesn't have access
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Access granted - now get the pipeline details
    // Use getByIdPublic since we've already verified access
    const pipeline = await pipelinesRepository.getByIdPublic(pipelineId);
    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      );
    }

    // Return pipeline metadata (not the full pipeline for security)
    return NextResponse.json({
      id: pipeline.id,
      name: pipeline.name,
      isPublic: pipeline.is_public,
      canEdit: userId && pipeline.user_id === userId,
    });
  } catch (error) {
    console.error('Error verifying pipeline access:', error);
    return NextResponse.json(
      { error: 'Failed to verify access' },
      { status: 500 }
    );
  }
}
