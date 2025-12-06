import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { pipelinesRepository } from '@/lib/db/supabase-repositories';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// POST /api/pipelines/verify-access - Verify access to a pipeline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pipelineId, shareToken, userEmail } = body;

    console.log('verify-access called with:', { pipelineId, shareToken: shareToken ? '***' : undefined });

    if (!pipelineId) {
      return NextResponse.json(
        { error: 'Pipeline ID is required' },
        { status: 400 }
      );
    }

    // Get current user if Supabase is configured
    let userId: string | undefined;
    let userEmailFromAuth: string | undefined;
    
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
      userEmailFromAuth = user?.email;
    }

    console.log('verify-access userId:', userId || 'none');

    // Get the pipeline details
    // Use getByIdPublic to fetch the pipeline
    const pipeline = await pipelinesRepository.getByIdPublic(pipelineId);
    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      );
    }

    // Check share mode restrictions
    const shareMode = pipeline.share_mode || 'private';
    const currentUserEmail = userEmailFromAuth || userEmail;

    // If share mode is 'verified', check if user is in the invited team members list
    if (shareMode === 'verified') {
      if (!currentUserEmail) {
        return NextResponse.json(
          { error: 'Authentication required for verified sharing' },
          { status: 401 }
        );
      }

      // Check if user email is in the shared_with list
      const isUserInvited = pipeline.shared_with?.includes(currentUserEmail) || false;
      if (!isUserInvited) {
        return NextResponse.json(
          { error: 'Access denied - not in invited members' },
          { status: 403 }
        );
      }
    }

    // Return pipeline metadata (not the full pipeline for security)
    return NextResponse.json({
      id: pipeline.id,
      name: pipeline.name,
      isPublic: pipeline.is_public,
      shareMode: shareMode,
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
