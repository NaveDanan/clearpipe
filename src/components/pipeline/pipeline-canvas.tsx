'use client';

import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
  Panel,
  Connection,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '@/components/nodes';
import { NodePalette } from '@/components/pipeline/node-palette';
import { NodeConfigPanel } from '@/components/pipeline/node-config-panel';
import { PipelineToolbar } from '@/components/pipeline/pipeline-toolbar';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { usePipelineStore } from '@/stores/pipeline-store';
import { PipelineNodeData } from '@/types/pipeline';

function PipelineCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectNode,
  } = usePipelineStore();

  // Validate connection: source must have output (right), target must have input (left)
  const isValidConnection = useCallback((connection: Connection) => {
    // Prevent connections from source to source or target to target
    if (connection.sourceHandle === connection.targetHandle) {
      return false;
    }
    
    // Ensure source is connecting FROM right (output) and target is connecting TO left (input)
    if (connection.sourceHandle !== 'source' || connection.targetHandle !== 'target') {
      return false;
    }
    
    // Prevent self-connections
    if (connection.source === connection.target) {
      return false;
    }
    
    return true;
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as PipelineNodeData['type'];

      if (!type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [screenToFlowPosition, addNode]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Handle edge reconnection for established connections
  const onReconnect = useCallback((oldEdge: any, newConnection: Connection) => {
    // Validate the new connection
    if (!isValidConnection(newConnection)) {
      return;
    }

    // Remove old edge and add new one through store
    const { nodes: currentNodes, edges: currentEdges, deleteNode: _, ...storeActions } = usePipelineStore.getState();
    const newEdges = currentEdges
      .filter(edge => edge.id !== oldEdge.id)
      .concat({
        ...newConnection,
        id: oldEdge.id, // Keep the same edge ID
        type: 'smoothstep',
        animated: true,
        animationDuration: 1000,
      });

    // Update edges in store
    usePipelineStore.setState({ edges: newEdges, isDirty: true });
  }, [isValidConnection]);

  return (
    <div className="flex h-screen w-full">
      {/* Left Sidebar - Node Palette */}
      <ResizablePanel
        side="left"
        defaultWidth={380}
        minWidth={100}
        maxWidth={450}
        title="Node Palette"
      >
        <NodePalette onDragStart={onDragStart} />
      </ResizablePanel>

      {/* Main Canvas */}
      <div className="flex-1 h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Strict}
          isValidConnection={isValidConnection}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            animationDuration: 1000,
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={15} size={1} />
          <Controls className="!bg-neutral-100 !border-neutral-200 !shadow-md !text-neutral-700 [&>button]:!bg-neutral-100 [&>button]:!border-neutral-200 [&>button]:!fill-neutral-700 [&>button:hover]:!bg-neutral-200" />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-background border rounded-lg"
          />
          <Panel position="top-center">
            <PipelineToolbar />
          </Panel>
        </ReactFlow>
      </div>

      {/* Right Sidebar - Node Configuration */}
      <ResizablePanel
        side="right"
        defaultWidth={380}
        minWidth={280}
        maxWidth={550}
        title="Configuration"
      >
        <NodeConfigPanel />
      </ResizablePanel>
    </div>
  );
}

export function PipelineCanvas() {
  return (
    <ReactFlowProvider>
      <PipelineCanvasInner />
    </ReactFlowProvider>
  );
}
