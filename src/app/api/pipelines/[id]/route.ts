import { NextRequest, NextResponse } from 'next/server';
import { pipelinesRepository } from '@/lib/db/repositories';
import type { PipelineRow } from '@/lib/db/repositories';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to parse pipeline row
function parsePipeline(row: PipelineRow | undefined | null) {
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    nodes: JSON.parse(row.nodes),
    edges: JSON.parse(row.edges),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/pipelines/[id] - Get a pipeline by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const pipeline = await pipelinesRepository.getById(id);
    
    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(parsePipeline(pipeline));
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipeline' },
      { status: 500 }
    );
  }
}

// PUT /api/pipelines/[id] - Update a pipeline
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const pipeline = await pipelinesRepository.update(id, body);
    
    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(parsePipeline(pipeline));
  } catch (error) {
    console.error('Error updating pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to update pipeline' },
      { status: 500 }
    );
  }
}

// DELETE /api/pipelines/[id] - Delete a pipeline
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await pipelinesRepository.delete(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    return NextResponse.json(
      { error: 'Failed to delete pipeline' },
      { status: 500 }
    );
  }
}
