'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
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
  IsValidConnection,
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
  const { screenToFlowPosition, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState<number>(0.8);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update zoom level and show indicator
  const handleZoom = useCallback(() => {
    const currentZoom = getZoom();
    setZoom(currentZoom);
    setShowZoomIndicator(true);

    // Clear existing timeout
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }

    // Hide indicator after 2 seconds
    zoomTimeoutRef.current = setTimeout(() => {
      setShowZoomIndicator(false);
    }, 2000);
  }, [getZoom]);

  // Listen to wheel events for zoom
  useEffect(() => {
    const canvas = reactFlowWrapper.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      // Only track zoom if ctrl/cmd is pressed (standard zoom modifier)
      if (e.ctrlKey || e.metaKey) {
        // Small delay to let ReactFlow process the zoom
        setTimeout(handleZoom, 50);
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleZoom]);

  // Also listen for zoom button clicks via mutation observer
  useEffect(() => {
    const canvas = reactFlowWrapper.current;
    if (!canvas) return;

    const observer = new MutationObserver(() => {
      handleZoom();
    });

    observer.observe(canvas, { 
      attributes: true, 
      subtree: true, 
      attributeFilter: ['transform', 'style'] 
    });

    return () => observer.disconnect();
  }, [handleZoom]);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    selectNode,
    isConfigPanelOpen,
  } = usePipelineStore();

  // Validate connection: source must have output (right), target must have input (left)
  const isValidConnection = useCallback((connection: Connection | any) => {
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

  const handleConfigPanelCollapse = useCallback(() => {
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
      .concat([{
        id: oldEdge.id, // Keep the same edge ID
        source: newConnection.source || '',
        target: newConnection.target || '',
        sourceHandle: newConnection.sourceHandle,
        targetHandle: newConnection.targetHandle,
        type: 'smoothstep',
        animated: true,
      } as any]);

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
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
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

        {/* Zoom Indicator - Positioned outside ReactFlow for better visibility */}
        {showZoomIndicator && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-neutral-500 text-white px-3 py-1 rounded-md text-sm font-medium shadow-lg pointer-events-none z-10">
            {(zoom * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Right Sidebar - Node Configuration */}
      <ResizablePanel
        side="right"
        defaultWidth={480}
        minWidth={480}
        maxWidth={550}
        title="Configuration"
        isOpen={isConfigPanelOpen}
        onCollapse={handleConfigPanelCollapse}
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
