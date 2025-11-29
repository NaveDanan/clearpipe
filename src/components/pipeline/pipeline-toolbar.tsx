'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Save,
  FolderOpen,
  FileDown,
  FileUp,
  Play,
  RotateCcw,
  MoreHorizontal,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { usePipelineStore } from '@/stores/pipeline-store';
import type { PipelineNodeData, PipelineNode, PipelineEdge, DatasetNodeData, ExecuteNodeData } from '@/types/pipeline';
import { checkDatasetConnection, runExecute } from '@/components/nodes';
import { SettingsDialog } from '@/components/ui/settings-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NodeExecutionResult {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  success: boolean;
  message?: string;
  outputPath?: string;
  fileCount?: number;
  error?: string;
}

// Helper function to get execution order based on graph topology
function getExecutionOrder(nodes: PipelineNode[], edges: PipelineEdge[]): PipelineNode[] {
  // Build adjacency list and in-degree count
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();
  
  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  });
  
  edges.forEach(edge => {
    const targets = adjacencyList.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyList.set(edge.source, targets);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });
  
  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const result: PipelineNode[] = [];
  
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodes.find(n => n.id === currentId);
    if (currentNode) {
      result.push(currentNode);
    }
    
    const neighbors = adjacencyList.get(currentId) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }
  
  return result;
}

// Helper function to get the source node for a given node
function getSourceNode(nodeId: string, edges: PipelineEdge[], nodes: PipelineNode[]): PipelineNode | null {
  const incomingEdge = edges.find(e => e.target === nodeId);
  if (!incomingEdge) return null;
  return nodes.find(n => n.id === incomingEdge.source) || null;
}

export function PipelineToolbar() {
  const {
    nodes,
    edges,
    currentPipeline,
    savedPipelines,
    isDirty,
    savePipeline,
    loadPipeline,
    createNewPipeline,
    deletePipeline,
    exportPipeline,
    importPipeline,
    reset,
    updateNodeStatus,
  } = usePipelineStore();

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<NodeExecutionResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [pipelineName, setPipelineName] = useState(currentPipeline?.name || '');
  const [pipelineDescription, setPipelineDescription] = useState(
    currentPipeline?.description || ''
  );
  
  // Store for passing data between nodes during execution
  const [nodeOutputs, setNodeOutputs] = useState<Map<string, { path: string; fileCount?: number }>>(new Map());

  const handleSave = () => {
    if (pipelineName.trim()) {
      savePipeline(pipelineName.trim(), pipelineDescription.trim());
      setSaveDialogOpen(false);
    }
  };

  const handleExport = () => {
    const json = exportPipeline();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPipeline?.name || 'pipeline'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const success = importPipeline(text);
        if (!success) {
          alert('Failed to import pipeline. Please check the file format.');
        }
      }
    };
    input.click();
  };

  const handleRun = async () => {
    setIsRunning(true);
    const results: NodeExecutionResult[] = [];
    const outputs = new Map<string, { path: string; fileCount?: number }>();

    if (nodes.length === 0) {
      alert('No nodes in the pipeline. Please add at least one node.');
      setIsRunning(false);
      return;
    }

    // Get the execution order based on graph topology
    const executionOrder = getExecutionOrder(nodes, edges);

    // Execute nodes in order
    for (const node of executionOrder) {
      const nodeData = node.data as PipelineNodeData;
      const nodeType = nodeData.type;

      try {
        updateNodeStatus(node.id, 'running', 'Executing...');

        let result: NodeExecutionResult;

        switch (nodeType) {
          case 'dataset': {
            const datasetData = nodeData as DatasetNodeData;
            const checkResult = await checkDatasetConnection(datasetData.config);
            
            result = {
              nodeId: node.id,
              nodeLabel: nodeData.label,
              nodeType: nodeType,
              success: checkResult.success,
              fileCount: checkResult.fileCount,
              error: checkResult.error,
              message: checkResult.success 
                ? `Found ${checkResult.fileCount} files` 
                : checkResult.error,
              outputPath: datasetData.config.path,
            };

            if (checkResult.success) {
              outputs.set(node.id, { 
                path: datasetData.config.path, 
                fileCount: checkResult.fileCount 
              });
              updateNodeStatus(node.id, 'completed', `Found ${checkResult.fileCount} files`);
            } else {
              updateNodeStatus(node.id, 'error', checkResult.error || 'Connection failed');
            }
            break;
          }

          case 'execute': {
            const executeData = nodeData as ExecuteNodeData;
            
            // Get input path from the source node
            const sourceNode = getSourceNode(node.id, edges, nodes);
            let inputPath = '';
            
            if (sourceNode) {
              const sourceOutput = outputs.get(sourceNode.id);
              if (sourceOutput) {
                inputPath = sourceOutput.path;
              }
            }

            // Check if any enabled step requires data source variable
            const enabledSteps = executeData.config.steps?.filter(s => s.enabled) || [];
            const requiresInputPath = enabledSteps.some(step => step.useDataSourceVariable !== false);

            if (!inputPath && requiresInputPath) {
              result = {
                nodeId: node.id,
                nodeLabel: nodeData.label,
                nodeType: nodeType,
                success: false,
                error: 'No input data path available. Please connect a Dataset node.',
                message: 'No input data path available',
              };
              updateNodeStatus(node.id, 'error', 'No input data path');
              break;
            }

            const executeResult = await runExecute(executeData.config, inputPath);
            
            result = {
              nodeId: node.id,
              nodeLabel: nodeData.label,
              nodeType: nodeType,
              success: executeResult.success,
              message: executeResult.message,
              outputPath: executeResult.outputPath,
              error: executeResult.success ? undefined : executeResult.message,
            };

            if (executeResult.success) {
              outputs.set(node.id, { path: executeResult.outputPath || inputPath });
              updateNodeStatus(node.id, 'completed', executeResult.message);
            } else {
              updateNodeStatus(node.id, 'error', executeResult.message);
            }
            break;
          }

          default: {
            // For other node types, just pass through the input
            const sourceNode = getSourceNode(node.id, edges, nodes);
            if (sourceNode) {
              const sourceOutput = outputs.get(sourceNode.id);
              if (sourceOutput) {
                outputs.set(node.id, sourceOutput);
              }
            }
            
            result = {
              nodeId: node.id,
              nodeLabel: nodeData.label,
              nodeType: nodeType,
              success: true,
              message: 'Node type not yet implemented for execution',
            };
            updateNodeStatus(node.id, 'completed', 'Skipped (not implemented)');
            break;
          }
        }

        results.push(result);

        // Stop execution if a node fails
        if (!result.success) {
          break;
        }
      } catch (error) {
        const errorMsg = (error as Error).message;
        results.push({
          nodeId: node.id,
          nodeLabel: nodeData.label,
          nodeType: nodeType,
          success: false,
          error: errorMsg,
          message: errorMsg,
        });
        updateNodeStatus(node.id, 'error', errorMsg);
        break;
      }
    }

    setNodeOutputs(outputs);
    setRunResults(results);
    setShowResults(true);
    setIsRunning(false);
  };

  return (
    <div className="flex items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg p-2 shadow-lg">
      {/* Pipeline Name */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-sm font-medium">
          {currentPipeline?.name || 'Untitled Pipeline'}
        </span>
        {isDirty && (
          <Badge variant="secondary" className="text-xs">
            Unsaved
          </Badge>
        )}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* New Pipeline */}
      <Button variant="ghost" size="sm" onClick={createNewPipeline}>
        <Plus className="w-4 h-4 mr-1" />
        New
      </Button>

      {/* Save */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Pipeline</DialogTitle>
            <DialogDescription>
              Give your pipeline a name and optional description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="My ML Pipeline"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={pipelineDescription}
                onChange={(e) => setPipelineDescription(e.target.value)}
                placeholder="A brief description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Pipeline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <FolderOpen className="w-4 h-4 mr-1" />
            Open
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Pipeline</DialogTitle>
            <DialogDescription>
              Select a saved pipeline to open.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[300px] overflow-y-auto">
            {savedPipelines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No saved pipelines yet.
              </p>
            ) : (
              <div className="space-y-2">
                {savedPipelines.map((pipeline) => (
                  <div
                    key={pipeline.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      loadPipeline(pipeline.id);
                      setLoadDialogOpen(false);
                    }}
                  >
                    <div>
                      <p className="font-medium">{pipeline.name}</p>
                      {pipeline.description && (
                        <p className="text-xs text-muted-foreground">
                          {pipeline.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {pipeline.nodes.length} nodes •{' '}
                        {new Date(pipeline.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePipeline(pipeline.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="h-6 w-px bg-border" />

      {/* Export/Import */}
      <Button variant="ghost" size="sm" onClick={handleExport}>
        <FileDown className="w-4 h-4 mr-1" />
        Export
      </Button>
      <Button variant="ghost" size="sm" onClick={handleImport}>
        <FileUp className="w-4 h-4 mr-1" />
        Import
      </Button>

      <div className="h-6 w-px bg-border" />

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pipeline Execution Results</DialogTitle>
            <DialogDescription>
              Execution results for all nodes in the pipeline
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3 py-4 pr-4">
              {runResults.map((result, index) => (
                <div key={result.nodeId} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="pt-0.5">
                    {result.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{index + 1}.</span>
                      <p className="font-medium text-sm">{result.nodeLabel}</p>
                      <Badge variant="outline" className="text-xs">
                        {result.nodeType}
                      </Badge>
                    </div>
                    {result.success ? (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-sm text-green-600 font-medium">
                          ✓ {result.message || 'Completed successfully'}
                        </p>
                        {result.fileCount !== undefined && (
                          <p className="text-xs text-muted-foreground">
                            Files: {result.fileCount}
                          </p>
                        )}
                        {result.outputPath && (
                          <p className="text-xs text-muted-foreground truncate" title={result.outputPath}>
                            Output: {result.outputPath}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-red-600 mt-1">
                        ✗ {result.error || result.message || 'Execution failed'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setShowResults(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Controls */}
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleRun}
        disabled={isRunning}
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-1" />
            Run Pipeline
          </>
        )}
      </Button>

      <div className="h-6 w-px bg-border" />

      {/* Settings */}
      <SettingsDialog />

      {/* More Options */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Canvas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Pipeline
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
