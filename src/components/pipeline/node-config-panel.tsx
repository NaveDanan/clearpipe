'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { X, Settings, Database, GitBranch, Wand2, Cpu, BarChart3, FileText, ChevronDown, ChevronRight, Plus, Pencil, Trash2, ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertCircle, Download, Upload, List, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ToggleSwitch from '@/components/ui/toggle-switch';
import { TerminalMonitor } from '@/components/ui/terminal-monitor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tree, Folder, File, type TreeViewElement } from '@/components/ui/file-tree';
import { usePipelineStore } from '@/stores/pipeline-store';
import { useSettingsStore } from '@/stores/settings-store';
import { ControlledSettingsDialog } from '@/components/ui/settings-dialog';
import { dataFormatOptions } from '@/config/node-definitions';
import type { DataFormatOption } from '@/config/node-definitions';
import { getConnectedSourceNode, getAvailableOutputVariables } from '@/components/nodes/shared/utils';
import type {
  PipelineNodeData,
  DatasetNodeData,
  VersioningNodeData,
  ExecuteNodeData,
  TrainingNodeData,
  ExperimentNodeData,
  ReportNodeData,
  DatasetConfig,
  VersioningConfig,
  ExecuteConfig,
  ExecuteStep,
  TrainingConfig,
  ExperimentConfig as ExperimentConfigType,
  ReportConfig as ReportConfigType,
  DataSourceVariableMapping,
  ClearMLDatasetInfo,
} from '@/types/pipeline';

const nodeIcons: Record<string, React.ReactNode> = {
  dataset: <Database className="h-5 w-5" />,
  versioning: <GitBranch className="h-5 w-5" />,
  execute: <Wand2 className="h-5 w-5" />,
  training: <Cpu className="h-5 w-5" />,
  experiment: <BarChart3 className="h-5 w-5" />,
  report: <FileText className="h-5 w-5" />,
};

// Collapsible Format Selector Component
interface CollapsibleFormatSelectorProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
}

function CollapsibleFormatSelector({ value, onChange }: CollapsibleFormatSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Tabular': true,
    'Columnar': false,
    'Scientific': false,
    'Serialization': false,
    'Images': false,
    'Videos': false,
    'Audio': false,
    'Other': false,
  });

  // Normalize value to array for easier handling
  const selectedFormats = Array.isArray(value) ? value : (value ? [value] : []);

  // Group formats by category
  const formatsByCategory = dataFormatOptions.reduce((acc, option) => {
    const category = (option as any).category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(option);
    return acc;
  }, {} as Record<string, DataFormatOption[]>);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleFormatChange = (formatValue: string) => {
    if (selectedFormats.includes(formatValue)) {
      // Remove format if already selected
      const updated = selectedFormats.filter((f) => f !== formatValue);
      onChange(updated.length === 0 ? '' : updated.length === 1 ? updated[0] : updated);
    } else {
      // Add format
      onChange([...selectedFormats, formatValue]);
    }
  };

  const getDisplayText = () => {
    if (selectedFormats.length === 0) return 'Select formats';
    if (selectedFormats.length === 1) {
      const option = dataFormatOptions.find((opt) => opt.value === selectedFormats[0]);
      return option?.label || selectedFormats[0];
    }
    return `${selectedFormats.length} format${selectedFormats.length > 1 ? 's' : ''} selected`;
  };

  return (
    <div className="space-y-2">
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full bg-muted/50 px-3 py-2.5 flex items-center justify-between hover:bg-muted/70 transition-colors"
        >
          <div className="flex-1 text-left">
            <div className="font-medium text-sm">{getDisplayText()}</div>
            {selectedFormats.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedFormats.map((format) => {
                  const option = dataFormatOptions.find((opt) => opt.value === format);
                  return (
                    <Badge key={format} variant="default" className="text-xs">
                      {option?.label || format}
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFormatChange(format);
                        }}
                        className="ml-1 hover:opacity-75 cursor-pointer"
                      >
                        ✕
                      </span>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 ml-2 transition-transform flex-shrink-0 ${
              isExpanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>
        
        {isExpanded && (
          <ScrollArea className="h-64 border-t">
            <div className="p-2 space-y-1">
              {Object.entries(formatsByCategory).map(([category, formats]) => (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md text-sm font-medium transition-colors"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        expandedCategories[category] ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                    <span className="text-muted-foreground text-xs uppercase tracking-wider flex-1 text-left">
                      {category}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {formats.length}
                    </Badge>
                  </button>
                  
                  {expandedCategories[category] && (
                    <div className="pl-6 space-y-0.5">
                      {formats.map((format) => (
                        <button
                          key={format.value}
                          onClick={() => handleFormatChange(format.value)}
                          className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
                            selectedFormats.includes(format.value)
                              ? 'bg-primary text-primary-foreground font-medium'
                              : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFormats.includes(format.value)}
                            onChange={() => handleFormatChange(format.value)}
                            className="h-4 w-4 cursor-pointer"
                          />
                          {format.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// Intelligent Path Input Component with Output Variable Suggestions
interface PathInputWithSuggestionsProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  nodeId?: string;
}

function PathInputWithSuggestions({ 
  value, 
  onChange, 
  placeholder, 
  nodeId 
}: PathInputWithSuggestionsProps) {
  const { nodes, edges } = usePipelineStore();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [availableVars, setAvailableVars] = useState<Array<{ variable: string; label: string }>>([]);
  
  // Get available output variables from connected nodes
  useEffect(() => {
    if (nodeId) {
      const connectedNode = getConnectedSourceNode(nodeId, nodes, edges);
      if (connectedNode) {
        const vars = getAvailableOutputVariables(connectedNode.data);
        setAvailableVars(vars);
      } else {
        setAvailableVars([]);
      }
    }
  }, [nodeId, nodes, edges]);
  
  const handleSelectVariable = (variable: string) => {
    onChange(variable);
    setShowSuggestions(false);
  };
  
  return (
    <div className="relative space-y-2">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        
        {/* Show suggestions dropdown if there are available variables */}
        {showSuggestions && availableVars.length > 0 && (
          <div className="absolute z-10 w-full mt-1 border rounded-md bg-background shadow-lg">
            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                Available from connected node:
              </div>
              {availableVars.map((varInfo, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectVariable(varInfo.variable)}
                  className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors flex items-center justify-between group"
                >
                  <div>
                    <div className="font-mono text-xs text-primary">{varInfo.variable}</div>
                    <div className="text-xs text-muted-foreground">{varInfo.label}</div>
                  </div>
                  <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to insert
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {availableVars.length > 0 && (
        <p className="text-xs text-muted-foreground">
          💡 Tip: Click the field above to see available outputs from the connected node
        </p>
      )}
    </div>
  );
}

// Multi-Select Path Input Component with Output Variable Suggestions
interface MultiPathInputWithSuggestionsProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  nodeId?: string;
}

function MultiPathInputWithSuggestions({ 
  values, 
  onChange, 
  placeholder, 
  nodeId 
}: MultiPathInputWithSuggestionsProps) {
  const { nodes, edges } = usePipelineStore();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualPath, setManualPath] = useState('');
  const [availableVars, setAvailableVars] = useState<Array<{ variable: string; label: string }>>([]);
  
  // Get available output variables from connected nodes
  useEffect(() => {
    if (nodeId) {
      const connectedNode = getConnectedSourceNode(nodeId, nodes, edges);
      if (connectedNode) {
        const vars = getAvailableOutputVariables(connectedNode.data);
        setAvailableVars(vars);
      } else {
        setAvailableVars([]);
      }
    }
  }, [nodeId, nodes, edges]);
  
  const handleToggleVariable = (variable: string) => {
    if (values.includes(variable)) {
      onChange(values.filter(v => v !== variable));
    } else {
      onChange([...values, variable]);
    }
  };
  
  const handleAddManualPath = () => {
    if (manualPath.trim() && !values.includes(manualPath.trim())) {
      onChange([...values, manualPath.trim()]);
      setManualPath('');
    }
  };
  
  const handleRemovePath = (path: string) => {
    onChange(values.filter(v => v !== path));
  };
  
  const isSourceNodeVariable = (path: string) => path.includes('{{sourceNode.');
  
  return (
    <div className="space-y-3">
      {/* Selected paths */}
      {values.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Selected paths:</Label>
          <div className="flex flex-wrap gap-2">
            {values.map((path, index) => (
              <Badge 
                key={index} 
                variant={isSourceNodeVariable(path) ? "default" : "secondary"}
                className="text-xs gap-1 py-1 px-2"
              >
                <span className="truncate max-w-[180px]" title={path}>
                  {isSourceNodeVariable(path) 
                    ? path.replace('{{sourceNode.', '').replace('}}', '')
                    : path}
                </span>
                <button
                  onClick={() => handleRemovePath(path)}
                  className="ml-1 hover:opacity-75"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {/* Source node outputs selection */}
      {availableVars.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="w-full bg-muted/50 px-3 py-2 flex items-center justify-between hover:bg-muted/70 transition-colors"
          >
            <span className="text-sm font-medium">Source Node Outputs</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showSuggestions ? 'rotate-0' : '-rotate-90'}`}
            />
          </button>
          
          {showSuggestions && (
            <div className="p-2 space-y-1 border-t">
              {availableVars.map((varInfo, index) => {
                const isSelected = values.includes(varInfo.variable);
                return (
                  <button
                    key={index}
                    onClick={() => handleToggleVariable(varInfo.variable)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleVariable(varInfo.variable)}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-mono text-xs">{varInfo.variable.replace('{{sourceNode.', '').replace('}}', '')}</div>
                      <div className={`text-xs ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {varInfo.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Manual path input */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Or add a custom path:</Label>
        <div className="flex gap-2">
          <Input
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            placeholder={placeholder || "e.g., /path/to/data"}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddManualPath();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddManualPath}
            disabled={!manualPath.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NodeConfigPanel() {
  const { nodes, selectedNodeId, selectNode, updateNodeData } = usePipelineStore();
  
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeData = selectedNode?.data as PipelineNodeData | undefined;
  const nodeType = nodeData?.type;
  
  const handleClose = useCallback(() => {
    selectNode(null);
  }, [selectNode]);
  
  const handleUpdateConfig = useCallback(
    (updates: Record<string, unknown>) => {
      if (!selectedNodeId || !nodeData) return;
      const currentConfig = nodeData.config as Record<string, unknown>;
      updateNodeData(selectedNodeId, {
        config: { ...currentConfig, ...updates },
      } as unknown as Partial<PipelineNodeData>);
    },
    [nodeData, selectedNodeId, updateNodeData]
  );
  
  const handleUpdateBase = useCallback(
    (updates: Partial<PipelineNodeData>) => {
      if (!selectedNodeId) return;
      updateNodeData(selectedNodeId, updates);
    },
    [selectedNodeId, updateNodeData]
  );
  
  if (!selectedNode || !selectedNodeId || !nodeData) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b pl-10">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h2 className="font-semibold text-lg">Configuration</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Select a node to configure
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            Click on a node in the canvas to view and edit its configuration
          </p>
        </div>
      </div>
    );
  }
  
  // After the guard, nodeData is guaranteed to exist, so nodeType is defined
  const safeNodeType = nodeData.type;
  
  const renderConfigPanel = () => {
    switch (safeNodeType) {
      case 'dataset':
        return (
          <DatasetConfigPanel
            config={(nodeData as DatasetNodeData).config}
            onUpdate={handleUpdateConfig}
            nodeId={selectedNodeId}
          />
        );
      case 'versioning':
        return (
          <VersioningConfigPanel
            config={(nodeData as VersioningNodeData).config}
            onUpdate={handleUpdateConfig}
            nodeId={selectedNodeId}
          />
        );
      case 'execute':
        return (
          <ExecuteConfigPanel
            config={(nodeData as ExecuteNodeData).config}
            onUpdate={handleUpdateConfig}
            nodeId={selectedNodeId}
          />
        );
      case 'training':
        return (
          <TrainingConfigPanel
            config={(nodeData as TrainingNodeData).config}
            onUpdate={handleUpdateConfig}
          />
        );
      case 'experiment':
        return (
          <ExperimentConfigPanel
            config={(nodeData as ExperimentNodeData).config}
            onUpdate={handleUpdateConfig}
          />
        );
      case 'report':
        return (
          <ReportConfigPanel
            config={(nodeData as ReportNodeData).config}
            onUpdate={handleUpdateConfig}
          />
        );
      default:
        return <div>Unknown node type</div>;
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b pl-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {nodeIcons[safeNodeType]}
            <h2 className="font-semibold text-lg">
              {safeNodeType.charAt(0).toUpperCase() + safeNodeType.slice(1)} Node
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Badge variant="outline" className="w-fit mt-1">
          ID: {selectedNodeId}
        </Badge>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="general">General</TabsTrigger>
            </TabsList>
            
            <TabsContent value="config" className="mt-4 space-y-4">
              {renderConfigPanel()}
            </TabsContent>
            
            <TabsContent value="general" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={nodeData.label}
                  onChange={(e) => handleUpdateBase({ label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={nodeData.description}
                  onChange={(e) => handleUpdateBase({ description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Status</Label>
                  <Badge variant={nodeData.status === 'completed' ? 'default' : 'secondary'}>
                    {nodeData.status}
                  </Badge>
                </div>
              </div>
              
              {/* Terminal Output Monitor Section */}
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Execution Output</Label>
                {nodeData.executionLogs ? (
                  <TerminalMonitor 
                    logs={nodeData.executionLogs}
                    isExecuting={nodeData.status === 'running'}
                    maxHeight="h-80"
                  />
                ) : (
                  <div className="border rounded-lg bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      {nodeData.status === 'running' 
                        ? 'Waiting for execution output...' 
                        : 'No execution output available. Execute this node to see logs here.'}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}

// Dataset Configuration Panel
interface DatasetConfigPanelProps {
  config: DatasetConfig;
  onUpdate: (updates: Partial<DatasetConfig>) => void;
  nodeId?: string;
}

// Provider display info for connections
const providerInfo: Record<string, { label: string; icon: string }> = {
  aws: { label: 'AWS S3', icon: '🟠' },
  gcp: { label: 'Google Cloud Storage', icon: '🔵' },
  azure: { label: 'Azure Blob', icon: '🔷' },
  minio: { label: 'MinIO', icon: '🟣' },
  clearml: { label: 'ClearML', icon: '🟢' },
};

// Pagination constants for datasets
const DATASETS_PAGE_SIZE = 5;

// Helper function to recursively render tree elements
function renderTreeElement(element: TreeViewElement, selectedPath?: string): React.ReactNode {
  if (element.children && element.children.length > 0) {
    // Folder with children
    return (
      <Folder 
        key={element.id} 
        element={element.name} 
        value={element.id}
        isSelectable={element.isSelectable}
        isSelect={element.id === selectedPath}
      >
        {element.children.map(child => renderTreeElement(child, selectedPath))}
      </Folder>
    );
  } else if (element.children) {
    // Empty folder
    return (
      <Folder 
        key={element.id} 
        element={element.name} 
        value={element.id}
        isSelectable={element.isSelectable}
        isSelect={element.id === selectedPath}
      />
    );
  } else {
    // File
    return (
      <File 
        key={element.id} 
        value={element.id}
        isSelectable={element.isSelectable}
        isSelect={element.id === selectedPath}
      >
        <span>{element.name}</span>
      </File>
    );
  }
}

function DatasetConfigPanel({ config, onUpdate, nodeId }: DatasetConfigPanelProps) {
  const { connections, fetchConnections } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // ClearML dataset browsing state
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [allDatasets, setAllDatasets] = useState<ClearMLDatasetInfo[]>([]);
  const [displayedDatasetsCount, setDisplayedDatasetsCount] = useState(DATASETS_PAGE_SIZE);
  const [datasetsError, setDatasetsError] = useState<string | null>(null);
  const [hasFetchedDatasets, setHasFetchedDatasets] = useState(false);
  const previousConnectionIdRef = useRef<string | undefined>(undefined);
  
  // Dataset files state (for file tree)
  const [datasetFiles, setDatasetFiles] = useState<{ path: string; type: 'file' | 'folder'; size?: number }[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const previousDatasetIdRef = useRef<string | undefined>(undefined);
  
  // Fetch connections on mount
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);
  
  // Fetch ClearML datasets when connection is established
  const fetchDatasets = async () => {
    if (!config.connectionId || config.source !== 'clearml') {
      return;
    }
    
    setLoadingDatasets(true);
    setDatasetsError(null);
    
    try {
      const response = await fetch('/api/versioning/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          connectionId: config.connectionId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch datasets');
      }
      
      const result = await response.json();
      setAllDatasets(result.datasets || []);
      setDisplayedDatasetsCount(DATASETS_PAGE_SIZE);
      setHasFetchedDatasets(true);
    } catch (error) {
      setDatasetsError((error as Error).message);
      setAllDatasets([]);
    } finally {
      setLoadingDatasets(false);
    }
  };
  
  // Auto-fetch datasets when ClearML connection is established
  useEffect(() => {
    if (
      config.source === 'clearml' && 
      config.connectionId && 
      config.connectionId !== previousConnectionIdRef.current
    ) {
      previousConnectionIdRef.current = config.connectionId;
      fetchDatasets();
    }
  }, [config.source, config.connectionId]);
  
  // Fetch files for the selected dataset
  const fetchDatasetFiles = async () => {
    if (!config.connectionId || !config.selectedDatasetId) {
      return;
    }
    
    setLoadingFiles(true);
    setFilesError(null);
    
    try {
      const response = await fetch('/api/versioning/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_files',
          connectionId: config.connectionId,
          datasetId: config.selectedDatasetId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch dataset files');
      }
      
      const result = await response.json();
      setDatasetFiles(result.files || []);
    } catch (error) {
      setFilesError((error as Error).message);
      setDatasetFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };
  
  // Auto-fetch files when dataset is selected
  useEffect(() => {
    if (
      config.selectedDatasetId && 
      config.selectedDatasetId !== previousDatasetIdRef.current
    ) {
      previousDatasetIdRef.current = config.selectedDatasetId;
      fetchDatasetFiles();
    }
  }, [config.selectedDatasetId, config.connectionId]);
  
  // Convert flat file list to TreeViewElement hierarchy
  const buildFileTree = (): TreeViewElement[] => {
    if (datasetFiles.length === 0) return [];
    
    const root: TreeViewElement[] = [];
    const folderMap = new Map<string, TreeViewElement>();
    
    // First pass: create all folders
    datasetFiles
      .filter(f => f.type === 'folder')
      .sort((a, b) => a.path.localeCompare(b.path))
      .forEach(folder => {
        const element: TreeViewElement = {
          id: folder.path,
          name: folder.path.split('/').pop() || folder.path,
          isSelectable: true,
          children: [],
        };
        folderMap.set(folder.path, element);
        
        // Find parent folder
        const parts = folder.path.split('/');
        if (parts.length === 1) {
          root.push(element);
        } else {
          const parentPath = parts.slice(0, -1).join('/');
          const parent = folderMap.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(element);
          } else {
            root.push(element);
          }
        }
      });
    
    // Second pass: add files
    datasetFiles
      .filter(f => f.type === 'file')
      .sort((a, b) => a.path.localeCompare(b.path))
      .forEach(file => {
        const element: TreeViewElement = {
          id: file.path,
          name: file.path.split('/').pop() || file.path,
          isSelectable: true,
        };
        
        const parts = file.path.split('/');
        if (parts.length === 1) {
          root.push(element);
        } else {
          const parentPath = parts.slice(0, -1).join('/');
          const parent = folderMap.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(element);
          } else {
            root.push(element);
          }
        }
      });
    
    return root;
  };
  
  const fileTreeElements = buildFileTree();
  
  // Get datasets to display (with pagination)
  const displayedDatasets = allDatasets.slice(0, displayedDatasetsCount);
  const hasMoreDatasets = allDatasets.length > displayedDatasetsCount;
  
  // Handle dataset selection
  const handleDatasetSelect = (dataset: ClearMLDatasetInfo) => {
    // Get the full project name for the output format
    const projectName = (dataset as any).projectName || dataset.project;
    onUpdate({
      selectedDatasetId: dataset.id,
      selectedDataset: dataset,
      datasetId: dataset.id,
      datasetProject: projectName,
      clearmlAction: 'download', // Default to download action
    });
  };
  
  // Get configured connections (those marked as configured)
  const configuredConnections = connections.filter(conn => conn.isConfigured);
  
  // Handle connection selection (for cloud mode)
  const handleConnectionChange = (value: string) => {
    if (value === '__add_source__') {
      setSettingsOpen(true);
      return;
    }
    if (value === '__none__') {
      onUpdate({ connectionId: undefined, source: 'local' });
      setAllDatasets([]);
      setHasFetchedDatasets(false);
      return;
    }
    if (value.startsWith('conn:')) {
      const connectionId = value.replace('conn:', '');
      const connection = connections.find(c => c.id === connectionId);
      if (connection) {
        // Map connection provider to source type
        const sourceMap: Record<string, DatasetConfig['source']> = {
          aws: 's3',
          gcp: 'gcs',
          azure: 'azure-blob',
          minio: 'minio',
          clearml: 'clearml',
        };
        const source = sourceMap[connection.provider] || 'local';
        onUpdate({ 
          source, 
          connectionId,
          // Reset dataset selection when connection changes
          selectedDatasetId: undefined,
          selectedDataset: undefined,
          // Pre-fill some fields from the connection
          ...(connection.provider === 'aws' && { 
            region: (connection as any).region,
            bucket: (connection as any).bucket 
          }),
          ...(connection.provider === 'gcp' && { 
            bucket: (connection as any).bucket 
          }),
          ...(connection.provider === 'azure' && { 
            container: (connection as any).container 
          }),
          ...(connection.provider === 'minio' && { 
            endpoint: (connection as any).endpoint,
            bucket: (connection as any).bucket 
          }),
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Execution Mode - FIRST */}
      <div className="space-y-2">
        <Label>Execution Mode</Label>
        <Select 
          value={config.executionMode || 'local'} 
          onValueChange={(value) => {
            const updates: Partial<DatasetConfig> = { executionMode: value as 'local' | 'cloud' };
            // Reset relevant fields when switching modes
            if (value === 'local') {
              updates.connectionId = undefined;
              updates.source = 'local';
              updates.selectedDatasetId = undefined;
              updates.selectedDataset = undefined;
              setAllDatasets([]);
              setHasFetchedDatasets(false);
            } else {
              // Switching to cloud
              updates.source = 'local'; // Will be updated when connection is selected
            }
            onUpdate(updates);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">💻 Local</SelectItem>
            <SelectItem value="cloud">☁️ Cloud</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {config.executionMode === 'cloud' 
            ? 'Load dataset from a cloud connection'
            : 'Load dataset from local file system'}
        </p>
      </div>
      
      {/* LOCAL MODE: File Path Section */}
      {(config.executionMode === 'local' || !config.executionMode) && (
        <>
          <Separator />
          
          {/* Path Mode Selector */}
          <div className="space-y-2">
            <Label>Path Type</Label>
            <Select 
              value={config.pathMode || 'direct'} 
              onValueChange={(value) => onUpdate({ pathMode: value as 'direct' | 'folder-regex' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select path type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct File Path</SelectItem>
                <SelectItem value="folder-regex">Folder + Regex Pattern</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.pathMode === 'folder-regex' 
                ? 'Specify a folder and regex pattern to match multiple files'
                : 'Specify a direct path to a single file'}
            </p>
          </div>

          {/* File Path Input */}
          <div className="space-y-2">
            <Label htmlFor="path">
              {config.pathMode === 'folder-regex' ? 'Folder Path' : 'File Path'}
            </Label>
            <PathInputWithSuggestions
              value={config.path}
              onChange={(value) => onUpdate({ path: value })}
              placeholder={
                config.pathMode === 'folder-regex'
                  ? 'e.g., /home/naved/Documents/pythonprojects/test-ml'
                  : 'e.g., /home/naved/Documents/pythonprojects/test-ml/synthetic_regression.csv or {{sourceNode.outputPath}}'
              }
              nodeId={nodeId}
            />
            {config.pathMode === 'direct' && (
              <p className="text-xs text-muted-foreground">
                Direct path to a specific file (e.g., /path/to/file.csv)
              </p>
            )}
            {config.pathMode === 'folder-regex' && (
              <p className="text-xs text-muted-foreground">
                Path to a folder containing data files. Files will be filtered by the format(s) selected below.
              </p>
            )}
          </div>
        </>
      )}
      
      {/* CLOUD MODE: Data Source / Connection Selection */}
      {config.executionMode === 'cloud' && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label>Data Source</Label>
            <Select 
              value={config.connectionId ? `conn:${config.connectionId}` : '__none__'} 
              onValueChange={handleConnectionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select connection">
                  {config.connectionId ? (() => {
                    const conn = connections.find(c => c.id === config.connectionId);
                    return conn ? `${providerInfo[conn.provider]?.icon || ''} ${conn.name}` : 'Select connection';
                  })() : 'Select connection'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">No connection selected</span>
                </SelectItem>
                
                {configuredConnections.length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Configured Connections
                    </div>
                    {configuredConnections.map((conn) => (
                      <SelectItem key={conn.id} value={`conn:${conn.id}`}>
                        <span className="flex items-center gap-2">
                          <span>{providerInfo[conn.provider]?.icon}</span>
                          <span>{conn.name}</span>
                          <Badge variant="secondary" className="ml-auto text-[10px] px-1">
                            {providerInfo[conn.provider]?.label}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </>
                )}
                
                <SelectSeparator />
                <SelectItem value="__add_source__">
                  <span className="flex items-center gap-2 text-primary">
                    <Plus className="h-4 w-4" />
                    <span>Add source...</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {!config.connectionId && configuredConnections.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No connections configured. Add one to continue.
              </p>
            )}
          </div>
          
          {/* Non-ClearML cloud sources - show path input */}
          {config.connectionId && config.source !== 'clearml' && (
            <div className="space-y-2">
              <Label htmlFor="path">Path</Label>
              <PathInputWithSuggestions
                value={config.path}
                onChange={(value) => onUpdate({ path: value })}
                placeholder="e.g., bucket/path/to/data"
                nodeId={nodeId}
              />
              <p className="text-xs text-muted-foreground">
                Path within the cloud storage
              </p>
            </div>
          )}
        </>
      )}
      
      {/* File Format Section - shown for all modes except ClearML with selected dataset */}
      {!(config.source === 'clearml' && config.selectedDataset) && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label>File Format(s)</Label>
            <CollapsibleFormatSelector 
              value={config.format} 
              onChange={(value) => onUpdate({ format: value })}
            />
            <p className="text-xs text-muted-foreground">
              {config.pathMode === 'folder-regex' 
                ? 'Only files matching these formats will be included from the folder'
                : 'Validate that the file matches one of these formats'}
            </p>
          </div>
        </>
      )}
      
      {/* ClearML Dataset Selection - show when ClearML connection is established */}
      {config.source === 'clearml' && config.connectionId && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">ClearML Datasets</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => fetchDatasets()}
                disabled={loadingDatasets}
              >
                <RefreshCw className={`h-3 w-3 ${loadingDatasets ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {/* Error display */}
            {datasetsError && (
              <div className="text-xs text-destructive flex items-center gap-1 p-2 bg-destructive/10 rounded">
                <XCircle className="h-3 w-3 flex-shrink-0" />
                <span>{datasetsError}</span>
              </div>
            )}
            
            {/* Loading state */}
            {loadingDatasets && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Loading datasets...</span>
              </div>
            )}
            
            {/* Dataset list */}
            {!loadingDatasets && hasFetchedDatasets && (
              <div className="space-y-2">
                {displayedDatasets.length === 0 && !datasetsError && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No datasets found in this connection.
                  </div>
                )}
                
                {displayedDatasets.map((dataset) => {
                  const fullProjectName = (dataset as any).projectName || dataset.project;
                  const shortProjectName = fullProjectName.split('/').pop() || fullProjectName;
                  const isSelected = config.selectedDatasetId === dataset.id;
                  
                  return (
                    <Card 
                      key={dataset.id} 
                      className={`p-3 transition-colors cursor-pointer ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleDatasetSelect(dataset)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" title={`${fullProjectName} → ${dataset.name}`}>
                            {shortProjectName} → {dataset.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {dataset.version ? `v${dataset.version}` : 'No version'}
                            {dataset.fileCount !== undefined && ` • ${dataset.fileCount} files`}
                          </div>
                          {dataset.tags && dataset.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {dataset.tags.slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0">
                                  {tag}
                                </Badge>
                              ))}
                              {dataset.tags.length > 3 && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  +{dataset.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Selection indicator */}
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </Card>
                  );
                })}
                
                {/* Load more button */}
                {hasMoreDatasets && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setDisplayedDatasetsCount(prev => prev + DATASETS_PAGE_SIZE)}
                  >
                    <ChevronDown className="h-3 w-3" />
                    Load more ({allDatasets.length - displayedDatasetsCount} remaining)
                  </Button>
                )}
              </div>
            )}
          </div>
          
          {/* Selected dataset details */}
          {config.selectedDataset && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Selected Dataset</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => fetchDatasetFiles()}
                    disabled={loadingFiles}
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingFiles ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                
                {/* Dataset info header */}
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{config.selectedDataset.name}</span>
                  {' • '}
                  <span title={(config.selectedDataset as any).projectName || config.selectedDataset.project}>
                    {(() => {
                      const fullPath = (config.selectedDataset as any).projectName || config.selectedDataset.project;
                      return fullPath.split('/').pop() || fullPath;
                    })()}
                  </span>
                  {config.selectedDataset.version && (
                    <span> • v{config.selectedDataset.version}</span>
                  )}
                </div>
                
                {/* File tree */}
                <Card className="overflow-hidden">
                  {/* Files error */}
                  {filesError && (
                    <div className="text-xs text-destructive flex items-center gap-1 p-2 bg-destructive/10">
                      <XCircle className="h-3 w-3 flex-shrink-0" />
                      <span>{filesError}</span>
                    </div>
                  )}
                  
                  {/* Loading files */}
                  {loadingFiles && (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm">Loading files...</span>
                    </div>
                  )}
                  
                  {/* File tree display */}
                  {!loadingFiles && !filesError && fileTreeElements.length > 0 && (
                    <div className="h-[200px] overflow-hidden">
                      <Tree
                        className="p-2 text-sm"
                        initialSelectedId={config.selectedFilePath}
                        initialExpandedItems={[]}
                        elements={fileTreeElements}
                        onSelectChange={(id) => {
                          if (id) {
                            onUpdate({ selectedFilePath: id });
                          }
                        }}
                      >
                        {fileTreeElements.map((element) => 
                          renderTreeElement(element, config.selectedFilePath)
                        )}
                      </Tree>
                    </div>
                  )}
                  
                  {/* No files found */}
                  {!loadingFiles && !filesError && fileTreeElements.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No files found in this dataset.
                    </div>
                  )}
                </Card>
                
                {/* Selected file indicator */}
                {config.selectedFilePath && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    <span className="text-muted-foreground">Selected:</span>
                    <span className="font-mono truncate">{config.selectedFilePath}</span>
                  </div>
                )}
                
                {/* Output format preview */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Output Format:</Label>
                  <div className="p-2 bg-muted/50 rounded text-xs font-mono break-all">
                    os.path.join(Dataset.get(dataset_project="{(config.selectedDataset as any).projectName || config.selectedDataset.project}", dataset_name="{config.selectedDataset.name}").get_local_copy(){config.selectedFilePath ? `, "${config.selectedFilePath}"` : ''})
                  </div>
                </div>
                
                {/* Clear selection */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    onUpdate({ 
                      selectedDatasetId: undefined, 
                      selectedDataset: undefined,
                      selectedFilePath: undefined,
                      datasetId: undefined,
                      datasetProject: undefined,
                      clearmlAction: undefined,
                      outputPath: undefined,
                    });
                    setDatasetFiles([]);
                    previousDatasetIdRef.current = undefined;
                  }}
                >
                  Clear Selection
                </Button>
              </div>
            </>
          )}
        </>
      )}
      
      {/* Settings Dialog */}
      <ControlledSettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        defaultTab="connections" 
      />
    </div>
  );
}

// Versioning Configuration Panel
interface VersioningConfigPanelProps {
  config: VersioningConfig;
  onUpdate: (updates: Partial<VersioningConfig>) => void;
  nodeId?: string;
}

// Map connection providers to versioning tools
const providerToToolMap: Record<string, VersioningConfig['tool']> = {
  clearml: 'clearml-data',
  // Add more mappings as needed
};

// Map versioning tools to connection providers
const toolToProviderMap: Record<VersioningConfig['tool'], string | undefined> = {
  'clearml-data': 'clearml',
  'dvc': undefined,
  'git-lfs': undefined,
  'mlflow-artifacts': undefined,
  'custom': undefined,
};

// Helper function to increment a version string by 0.0.1
// e.g., "1.0.0" -> "1.0.1", "v1.2.3" -> "1.2.4", "2.5" -> "2.5.1"
function incrementVersion(version: string | undefined): string {
  if (!version) {
    return '1.0.1';
  }
  
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/i, '').trim();
  
  // Split by dots
  const parts = cleanVersion.split('.');
  
  if (parts.length === 0 || !parts.every(p => /^\d+$/.test(p))) {
    // If version doesn't match expected format, return next logical version
    return '1.0.1';
  }
  
  // Ensure we have at least 3 parts (major.minor.patch)
  while (parts.length < 3) {
    parts.push('0');
  }
  
  // Increment the patch version (last part)
  const patchIndex = parts.length - 1;
  parts[patchIndex] = String(parseInt(parts[patchIndex], 10) + 1);
  
  return parts.join('.');
}

function VersioningConfigPanel({ config, onUpdate, nodeId }: VersioningConfigPanelProps) {
  const { nodes, edges } = usePipelineStore();
  const { connections, fetchConnections } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingMoreDatasets, setLoadingMoreDatasets] = useState(false);
  const [allDatasets, setAllDatasets] = useState<ClearMLDatasetInfo[]>([]);
  const [displayedDatasetsCount, setDisplayedDatasetsCount] = useState(DATASETS_PAGE_SIZE);
  const [datasetsError, setDatasetsError] = useState<string | null>(null);
  const [hasFetchedDatasets, setHasFetchedDatasets] = useState(false);
  const previousConnectionIdRef = useRef<string | undefined>(undefined);
  
  // Fetch connections on mount
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);
  
  // Get configured connections based on current execution mode and tool
  const getRelevantConnections = () => {
    if (config.executionMode !== 'cloud') return [];
    
    // If a tool is selected, show only matching connections
    const toolProvider = toolToProviderMap[config.tool];
    if (toolProvider) {
      return connections.filter(conn => conn.provider === toolProvider && conn.isConfigured);
    }
    
    // Show all configured connections
    return connections.filter(conn => conn.isConfigured);
  };
  
  const relevantConnections = getRelevantConnections();
  
  // Get datasets to display (with pagination)
  const displayedDatasets = allDatasets.slice(0, displayedDatasetsCount);
  const hasMoreDatasets = allDatasets.length > displayedDatasetsCount;
  
  // Fetch ClearML datasets
  const fetchDatasets = async (isLoadingMore = false) => {
    if (!config.connectionId) {
      return;
    }
    
    if (isLoadingMore) {
      setLoadingMoreDatasets(true);
    } else {
      setLoadingDatasets(true);
      setDatasetsError(null);
    }
    
    try {
      const response = await fetch('/api/versioning/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          connectionId: config.connectionId,
          credentials: config.credentials,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch datasets');
      }
      
      const result = await response.json();
      setAllDatasets(result.datasets || []);
      setDisplayedDatasetsCount(DATASETS_PAGE_SIZE);
      setHasFetchedDatasets(true);
    } catch (error) {
      setDatasetsError((error as Error).message);
      setAllDatasets([]);
    } finally {
      setLoadingDatasets(false);
      setLoadingMoreDatasets(false);
    }
  };
  
  // Load more datasets
  const handleLoadMoreDatasets = () => {
    setDisplayedDatasetsCount(prev => prev + DATASETS_PAGE_SIZE);
  };
  
  // Auto-fetch datasets when cloud connection is established
  useEffect(() => {
    if (
      config.executionMode === 'cloud' && 
      config.connectionId && 
      config.connectionId !== previousConnectionIdRef.current
    ) {
      previousConnectionIdRef.current = config.connectionId;
      fetchDatasets();
    }
  }, [config.executionMode, config.connectionId]);
  
  // Handle connection change - auto-set tool based on connection provider
  const handleConnectionChange = (value: string) => {
    if (value === '__add_source__') {
      setSettingsOpen(true);
      return;
    }
    if (value === '__none__') {
      onUpdate({ connectionId: undefined });
      setAllDatasets([]);
      setHasFetchedDatasets(false);
      return;
    }
    if (value.startsWith('conn:')) {
      const connectionId = value.replace('conn:', '');
      const connection = connections.find(c => c.id === connectionId);
      
      // Auto-set the versioning tool based on connection provider
      const updates: Partial<VersioningConfig> = { connectionId };
      if (connection) {
        const mappedTool = providerToToolMap[connection.provider];
        if (mappedTool) {
          updates.tool = mappedTool;
        }
      }
      
      onUpdate(updates);
    }
  };
  
  // Handle dataset selection with action
  const handleDatasetAction = (dataset: ClearMLDatasetInfo, action: VersioningConfig['clearmlAction']) => {
    const updates: Partial<VersioningConfig> = { 
      selectedDatasetId: dataset.id,
      selectedDataset: dataset,
      clearmlAction: action,
    };
    
    // Auto-increment version when "New Version" is selected
    if (action === 'version') {
      updates.version = incrementVersion(dataset.version);
    }
    
    onUpdate(updates);
  };
  
  // Handle create new dataset
  const handleCreateNewDataset = () => {
    onUpdate({ 
      clearmlAction: 'create',
      selectedDatasetId: undefined,
      selectedDataset: undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Execution Mode - FIRST */}
      <div className="space-y-2">
        <Label>Execution Mode</Label>
        <Select 
          value={config.executionMode || 'local'} 
          onValueChange={(value) => {
            const updates: Partial<VersioningConfig> = { executionMode: value as 'local' | 'cloud' };
            // Reset connection when switching modes
            if (value === 'local') {
              updates.connectionId = undefined;
              setAllDatasets([]);
              setHasFetchedDatasets(false);
            }
            onUpdate(updates);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">💻 Local</SelectItem>
            <SelectItem value="cloud">☁️ Cloud</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {config.executionMode === 'cloud' 
            ? 'Use a configured cloud connection for versioning'
            : 'Run versioning operations locally'}
        </p>
      </div>
      
      {/* 2. Cloud Connection Section - Only shown in cloud mode */}
      {config.executionMode === 'cloud' && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label>Cloud Connection</Label>
            <Select 
              value={config.connectionId ? `conn:${config.connectionId}` : '__none__'} 
              onValueChange={handleConnectionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select connection">
                  {config.connectionId ? (() => {
                    const conn = connections.find(c => c.id === config.connectionId);
                    return conn ? `${providerInfo[conn.provider]?.icon || ''} ${conn.name}` : 'Select connection';
                  })() : 'Select connection'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">No connection selected</span>
                </SelectItem>
                
                {relevantConnections.length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Available Connections
                    </div>
                    {relevantConnections.map((conn) => (
                      <SelectItem key={conn.id} value={`conn:${conn.id}`}>
                        <span className="flex items-center gap-2">
                          <span>{providerInfo[conn.provider]?.icon}</span>
                          <span>{conn.name}</span>
                          <Badge variant="secondary" className="ml-auto text-[10px] px-1">
                            {providerInfo[conn.provider]?.label}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </>
                )}
                
                <SelectSeparator />
                <SelectItem value="__add_source__">
                  <span className="flex items-center gap-2 text-primary">
                    <Plus className="h-4 w-4" />
                    <span>Add connection...</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {config.connectionId && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Credentials managed in Settings → Connections
                </p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 text-xs"
                  onClick={() => setSettingsOpen(true)}
                >
                  Manage
                </Button>
              </div>
            )}
            
            {!config.connectionId && relevantConnections.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No connections configured. Add one to continue.
              </p>
            )}
          </div>
        </>
      )}
      
      {/* 3. Datasets Section - Auto-fetched when connection is established (Cloud mode with ClearML-like connection) */}
      {config.executionMode === 'cloud' && config.connectionId && config.tool === 'clearml-data' && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Datasets</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => fetchDatasets()}
                disabled={loadingDatasets}
              >
                <RefreshCw className={`h-3 w-3 ${loadingDatasets ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {/* Error display */}
            {datasetsError && (
              <div className="text-xs text-destructive flex items-center gap-1 p-2 bg-destructive/10 rounded">
                <XCircle className="h-3 w-3 flex-shrink-0" />
                <span>{datasetsError}</span>
              </div>
            )}
            
            {/* Loading state */}
            {loadingDatasets && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Loading datasets...</span>
              </div>
            )}
            
            {/* Dataset list with action icons */}
            {!loadingDatasets && hasFetchedDatasets && (
              <div className="space-y-2">
                {displayedDatasets.length === 0 && !datasetsError && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No datasets found in this connection.
                  </div>
                )}
                
                {displayedDatasets.map((dataset) => {
                  // Get project name and extract only the last folder from the path
                  const fullProjectName = (dataset as any).projectName || dataset.project;
                  const shortProjectName = fullProjectName.split('/').pop() || fullProjectName;
                  
                  return (
                  <Card 
                    key={dataset.id} 
                    className={`p-3 transition-colors ${
                      config.selectedDatasetId === dataset.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" title={`${fullProjectName} → ${dataset.name}`}>
                          {shortProjectName} → {dataset.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {dataset.version ? `v${dataset.version}` : 'No version'}
                          {dataset.fileCount !== undefined && ` • ${dataset.fileCount} files`}
                        </div>
                        {dataset.tags && dataset.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {dataset.tags.slice(0, 3).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0">
                                {tag}
                              </Badge>
                            ))}
                            {dataset.tags.length > 3 && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                +{dataset.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Action icons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDatasetAction(dataset, 'list')}
                          title="List / View Details"
                        >
                          <List className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDatasetAction(dataset, 'download')}
                          title="Download Dataset"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDatasetAction(dataset, 'version')}
                          title="Add New Version"
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                  );
                })}
                
                {/* Load more button */}
                {hasMoreDatasets && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={handleLoadMoreDatasets}
                    disabled={loadingMoreDatasets}
                  >
                    <ChevronDown className="h-3 w-3" />
                    Load more ({allDatasets.length - displayedDatasetsCount} remaining)
                  </Button>
                )}
                
                {/* Create new dataset - at the end */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-xs gap-2 mt-2"
                  onClick={handleCreateNewDataset}
                >
                  <FolderPlus className="h-4 w-4" />
                  Create New Dataset
                </Button>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Selected dataset details and action-specific fields */}
      {config.executionMode === 'cloud' && config.connectionId && config.tool === 'clearml-data' && config.selectedDataset && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Selected Dataset</Label>
              <Badge variant="outline" className="text-xs">
                {config.clearmlAction === 'list' && 'View'}
                {config.clearmlAction === 'download' && 'Download'}
                {config.clearmlAction === 'version' && 'New Version'}
              </Badge>
            </div>
            
            <Card className="p-3 bg-muted/30">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{config.selectedDataset.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-medium" title={(config.selectedDataset as any).projectName || config.selectedDataset.project}>
                    {(() => {
                      const fullPath = (config.selectedDataset as any).projectName || config.selectedDataset.project;
                      return fullPath.split('/').pop() || fullPath;
                    })()}
                  </span>
                </div>
                {config.selectedDataset.version && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Version:</span>
                    <span className="font-medium">v{config.selectedDataset.version}</span>
                  </div>
                )}
                {config.selectedDataset.fileCount !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Files:</span>
                    <span className="font-medium">{config.selectedDataset.fileCount}</span>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Action-specific fields */}
            {config.clearmlAction === 'download' && (
              <div className="space-y-2">
                <Label htmlFor="outputPath">Download Path</Label>
                <Input
                  id="outputPath"
                  value={config.outputPath || ''}
                  onChange={(e) => onUpdate({ outputPath: e.target.value })}
                  placeholder="e.g., /path/to/download"
                />
                <p className="text-xs text-muted-foreground">
                  Local path where the dataset will be downloaded
                </p>
              </div>
            )}
            
            {config.clearmlAction === 'version' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="inputPath">Data Path</Label>
                  <PathInputWithSuggestions
                    value={config.inputPath || ''}
                    onChange={(value) => onUpdate({ inputPath: value })}
                    placeholder="e.g., /path/to/data or {{sourceNode.outputPath}}"
                    nodeId={nodeId}
                  />
                  <p className="text-xs text-muted-foreground">
                    Path to the data to add to the dataset
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="version">New Version Tag</Label>
                  <Input
                    id="version"
                    value={config.version}
                    onChange={(e) => onUpdate({ version: e.target.value })}
                    placeholder="e.g., 1.0.1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: specify a version tag for the new dataset version
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="datasetTags">Tags (comma-separated)</Label>
                  <Input
                    id="datasetTags"
                    value={config.datasetTags?.join(', ') || ''}
                    onChange={(e) => onUpdate({ 
                      datasetTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                    })}
                    placeholder="e.g., train, v1, processed"
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
      
      {/* Create new dataset fields */}
      {config.executionMode === 'cloud' && config.connectionId && config.tool === 'clearml-data' && config.clearmlAction === 'create' && !config.selectedDataset && (
        <>
          <Separator />
          <div className="space-y-4">
            <Label className="text-sm font-semibold">Create New Dataset</Label>
            
            <div className="space-y-2">
              <Label htmlFor="newDatasetName">Dataset Name</Label>
              <Input
                id="newDatasetName"
                value={config.newDatasetName || ''}
                onChange={(e) => onUpdate({ newDatasetName: e.target.value })}
                placeholder="e.g., my-dataset"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDatasetProject">Project</Label>
              <Input
                id="newDatasetProject"
                value={config.newDatasetProject || ''}
                onChange={(e) => onUpdate({ newDatasetProject: e.target.value })}
                placeholder="e.g., MyProject/Datasets"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Data Paths</Label>
              <MultiPathInputWithSuggestions
                values={config.inputPaths || (config.inputPath ? [config.inputPath] : [])}
                onChange={(values) => onUpdate({ 
                  inputPaths: values,
                  inputPath: values[0] || '' // Keep first path for backward compatibility
                })}
                placeholder="e.g., /path/to/data"
                nodeId={nodeId}
              />
              <p className="text-xs text-muted-foreground">
                Select one or more data paths to add to the dataset
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="datasetTags">Tags (comma-separated)</Label>
              <Input
                id="datasetTags"
                value={config.datasetTags?.join(', ') || ''}
                onChange={(e) => onUpdate({ 
                  datasetTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                })}
                placeholder="e.g., train, v1, processed"
              />
            </div>
            
            {/* Auto-version toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoVersionAfterCreate">Update this version after first run</Label>
                  <p className="text-xs text-muted-foreground">
                    After initial creation, subsequent runs will add new versions instead of recreating
                  </p>
                </div>
                <ToggleSwitch
                  id="autoVersionAfterCreate"
                  checked={config.autoVersionAfterCreate !== false}
                  onChange={(checked) => onUpdate({ autoVersionAfterCreate: checked })}
                />
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Local mode - Versioning Tool selection (only shown in local mode) */}
      {config.executionMode === 'local' && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label>Versioning Tool</Label>
            <Select value={config.tool} onValueChange={(value) => onUpdate({ tool: value as VersioningConfig['tool'] })}>
              <SelectTrigger>
                <SelectValue placeholder="Select tool" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dvc">DVC</SelectItem>
                <SelectItem value="git-lfs">Git LFS</SelectItem>
                <SelectItem value="clearml-data">ClearML Data</SelectItem>
                <SelectItem value="mlflow-artifacts">MLflow Artifacts</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Non-ClearML tools configuration */}
          {config.tool !== 'clearml-data' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="version">Version Tag</Label>
                <Input
                  id="version"
                  value={config.version}
                  onChange={(e) => onUpdate({ version: e.target.value })}
                  placeholder="e.g., v1.0.0"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="remoteUrl">Remote URL</Label>
                <Input
                  id="remoteUrl"
                  value={config.remoteUrl || ''}
                  onChange={(e) => onUpdate({ remoteUrl: e.target.value })}
                  placeholder="e.g., s3://bucket/dvc-cache"
                />
              </div>
              
              <Separator />
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Credentials</Label>
                <div className="space-y-2">
                  <Label htmlFor="token">Access Token</Label>
                  <Input
                    id="token"
                    type="password"
                    value={config.credentials?.token || ''}
                    onChange={(e) => onUpdate({ 
                      credentials: { ...config.credentials, token: e.target.value }
                    })}
                  />
                </div>
              </div>
            </>
          )}
          
          {/* ClearML Data in local mode - need to configure credentials manually */}
          {config.tool === 'clearml-data' && (
            <>
              <Separator />
              <div className="space-y-4">
                <Label className="text-sm font-semibold">ClearML Credentials</Label>
                <p className="text-xs text-muted-foreground">
                  Configure ClearML credentials for local execution, or switch to Cloud mode to use a saved connection.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="clearmlApiHost">API Host</Label>
                  <Input
                    id="clearmlApiHost"
                    value={config.credentials?.clearmlApiHost || ''}
                    onChange={(e) => onUpdate({ 
                      credentials: { ...config.credentials, clearmlApiHost: e.target.value }
                    })}
                    placeholder="e.g., https://api.clear.ml"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clearmlAccessKey">Access Key</Label>
                  <Input
                    id="clearmlAccessKey"
                    type="password"
                    value={config.credentials?.clearmlAccessKey || ''}
                    onChange={(e) => onUpdate({ 
                      credentials: { ...config.credentials, clearmlAccessKey: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clearmlSecretKey">Secret Key</Label>
                  <Input
                    id="clearmlSecretKey"
                    type="password"
                    value={config.credentials?.clearmlSecretKey || ''}
                    onChange={(e) => onUpdate({ 
                      credentials: { ...config.credentials, clearmlSecretKey: e.target.value }
                    })}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
      
      {/* Settings Dialog */}
      <ControlledSettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
        defaultTab="connections" 
      />
    </div>
  );
}

// Execute Configuration Panel
interface ExecuteConfigPanelProps {
  config: ExecuteConfig;
  onUpdate: (updates: Partial<ExecuteConfig>) => void;
  nodeId?: string;
}

function ExecuteConfigPanel({ config, onUpdate, nodeId }: ExecuteConfigPanelProps) {
  const { nodes, edges } = usePipelineStore();
  const { connections, fetchConnections } = useSettingsStore();
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [venvStatus, setVenvStatus] = useState<{
    checking: boolean;
    detected: boolean;
    venvPath?: string;
    pythonPath?: string;
    error?: string;
  }>({ checking: false, detected: false });
  const [availableSourceOutputs, setAvailableSourceOutputs] = useState<Array<{ variable: string; label: string }>>([]);
  
  // Get available output variables from connected source node
  useEffect(() => {
    if (nodeId) {
      const connectedNode = getConnectedSourceNode(nodeId, nodes, edges);
      if (connectedNode) {
        const vars = getAvailableOutputVariables(connectedNode.data);
        setAvailableSourceOutputs(vars);
      } else {
        setAvailableSourceOutputs([]);
      }
    }
  }, [nodeId, nodes, edges]);
  
  // Fetch connections on mount
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);
  
  // Get configured connections (those marked as configured)
  const configuredConnections = connections.filter(conn => conn.isConfigured);
  
  const editingStep = editingStepId ? config.steps.find(s => s.id === editingStepId) : null;
  
  const handleDeleteStep = (stepId: string) => {
    onUpdate({ steps: config.steps.filter(s => s.id !== stepId) });
    if (editingStepId === stepId) {
      setEditingStepId(null);
    }
  };
  
  const handleUpdateStep = useCallback((stepId: string, updates: Partial<ExecuteStep>) => {
    onUpdate({
      steps: config.steps.map(s => 
        s.id === stepId ? { ...s, ...updates } : s
      )
    });
  }, [config.steps, onUpdate]);
  
  // Check venv when script path changes or when editing a step with local source
  const checkVenv = useCallback(async (scriptPath: string, customVenvPath?: string, autoUpdateStepId?: string) => {
    if (!scriptPath && !customVenvPath) {
      setVenvStatus({ checking: false, detected: false, error: 'No script path provided' });
      return;
    }
    
    setVenvStatus({ checking: true, detected: false });
    
    try {
      const response = await fetch('/api/execute/check-venv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptPath, customVenvPath }),
      });
      
      const data = await response.json();
      
      setVenvStatus({
        checking: false,
        detected: data.detected,
        venvPath: data.venvPath,
        pythonPath: data.pythonPath,
        error: data.error,
      });
      
      // If auto-detected and we have a step to update, update only venv fields
      if (data.detected && autoUpdateStepId && !customVenvPath) {
        handleUpdateStep(autoUpdateStepId, { 
          venvPath: data.venvPath,
          venvMode: 'auto'
        });
      }
    } catch (error) {
      setVenvStatus({
        checking: false,
        detected: false,
        error: (error as Error).message,
      });
    }
  }, [handleUpdateStep]);
  
  // Auto-check venv when editing step changes or script path is set
  // Use a ref to track previous script path to avoid unnecessary re-checks
  const prevScriptPathRef = useRef<string | undefined>(undefined);
  
  useEffect(() => {
    if (editingStep && (editingStep.scriptSource === 'local' || !editingStep.scriptSource)) {
      const currentScriptPath = editingStep.scriptPath;
      
      // Only auto-check if script path actually changed
      if (currentScriptPath !== prevScriptPathRef.current) {
        prevScriptPathRef.current = currentScriptPath;
        
        if (editingStep.venvMode === 'custom' && editingStep.venvPath) {
          checkVenv(currentScriptPath || '', editingStep.venvPath);
        } else if (currentScriptPath) {
          // Pass the step ID for auto-update, but only update venv fields
          checkVenv(currentScriptPath, undefined, editingStep.id);
        } else {
          setVenvStatus({ checking: false, detected: false });
        }
      }
    } else {
      prevScriptPathRef.current = undefined;
    }
  }, [editingStep?.id, editingStep?.scriptPath, editingStep?.venvPath, editingStep?.venvMode, editingStep?.scriptSource, checkVenv]);
  
  const handleAddStep = () => {
    const newStep: ExecuteStep = {
      id: `step-${Date.now()}`,
      name: 'New Step',
      type: 'custom' as const,
      params: {},
      enabled: true,
      scriptSource: 'local',
      scriptPath: '',
      dataSourceMappings: [{ variableName: 'DATA_SOURCE', sourceOutput: 'inputPath' }],
      outputVariables: ['OUTPUT_PATH'],
    };
    onUpdate({ steps: [...config.steps, newStep] });
  };
  
  // Helper functions for managing data source mappings
  const getDataSourceMappings = (step: ExecuteStep): DataSourceVariableMapping[] => {
    // Support both old dataSourceVariable and new dataSourceMappings
    if (step.dataSourceMappings && step.dataSourceMappings.length > 0) {
      return step.dataSourceMappings;
    }
    // Migrate from old single variable to new mappings format
    if (step.dataSourceVariable) {
      return [{ variableName: step.dataSourceVariable, sourceOutput: 'inputPath' }];
    }
    return [{ variableName: 'DATA_SOURCE', sourceOutput: 'inputPath' }];
  };
  
  const handleAddDataSourceMapping = (stepId: string) => {
    const step = config.steps.find(s => s.id === stepId);
    if (!step) return;
    const currentMappings = getDataSourceMappings(step);
    const newVarName = `DATA_SOURCE_${currentMappings.length + 1}`;
    handleUpdateStep(stepId, { 
      dataSourceMappings: [...currentMappings, { variableName: newVarName, sourceOutput: 'inputPath' }],
      dataSourceVariable: undefined // Clear legacy field
    });
  };
  
  const handleRemoveDataSourceMapping = (stepId: string, index: number) => {
    const step = config.steps.find(s => s.id === stepId);
    if (!step) return;
    const currentMappings = getDataSourceMappings(step);
    if (currentMappings.length <= 1) return; // Keep at least one
    handleUpdateStep(stepId, { 
      dataSourceMappings: currentMappings.filter((_, i) => i !== index),
      dataSourceVariable: undefined // Clear legacy field
    });
  };
  
  const handleUpdateDataSourceMapping = (stepId: string, index: number, updates: Partial<DataSourceVariableMapping>) => {
    const step = config.steps.find(s => s.id === stepId);
    if (!step) return;
    const currentMappings = [...getDataSourceMappings(step)];
    currentMappings[index] = { ...currentMappings[index], ...updates };
    handleUpdateStep(stepId, { 
      dataSourceMappings: currentMappings,
      dataSourceVariable: undefined // Clear legacy field
    });
  };
  
  // Helper functions for managing output variables
  const getOutputVariables = (step: ExecuteStep): string[] => {
    return step.outputVariables && step.outputVariables.length > 0 
      ? step.outputVariables 
      : ['OUTPUT_PATH'];
  };
  
  const handleAddOutputVariable = (stepId: string) => {
    const step = config.steps.find(s => s.id === stepId);
    if (!step) return;
    const currentVars = getOutputVariables(step);
    const newVarName = `OUTPUT_PATH_${currentVars.length + 1}`;
    handleUpdateStep(stepId, { outputVariables: [...currentVars, newVarName] });
  };
  
  const handleRemoveOutputVariable = (stepId: string, index: number) => {
    const step = config.steps.find(s => s.id === stepId);
    if (!step) return;
    const currentVars = getOutputVariables(step);
    if (currentVars.length <= 1) return; // Keep at least one
    handleUpdateStep(stepId, { 
      outputVariables: currentVars.filter((_, i) => i !== index) 
    });
  };
  
  const handleUpdateOutputVariable = (stepId: string, index: number, value: string) => {
    const step = config.steps.find(s => s.id === stepId);
    if (!step) return;
    const currentVars = [...getOutputVariables(step)];
    currentVars[index] = value;
    handleUpdateStep(stepId, { outputVariables: currentVars });
  };
  
  // If editing a step, show the edit panel
  if (editingStep) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingStepId(null)}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <span className="font-medium">Edit Step</span>
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stepName">Step Name</Label>
            <Input
              id="stepName"
              value={editingStep.name}
              onChange={(e) => handleUpdateStep(editingStep.id, { name: e.target.value })}
              placeholder="e.g., Data Cleaning"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Execution Mode</Label>
            <Select 
              value={editingStep.executionMode || 'local'} 
              onValueChange={(value) => handleUpdateStep(editingStep.id, { executionMode: value as 'local' | 'cloud' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="cloud">Cloud</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Cloud Connection Section */}
          {editingStep.executionMode === 'cloud' && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Cloud Connection</Label>
                <Select 
                  value={editingStep.connectionId ? `conn:${editingStep.connectionId}` : '__none__'} 
                  onValueChange={(value) => {
                    if (value === '__add_source__') {
                      setSettingsOpen(true);
                      return;
                    }
                    if (value === '__none__') {
                      handleUpdateStep(editingStep.id, { connectionId: undefined });
                      return;
                    }
                    if (value.startsWith('conn:')) {
                      const connectionId = value.replace('conn:', '');
                      handleUpdateStep(editingStep.id, { connectionId });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select connection">
                      {editingStep.connectionId ? (() => {
                        const conn = connections.find(c => c.id === editingStep.connectionId);
                        return conn ? `${providerInfo[conn.provider]?.icon || ''} ${conn.name}` : 'Select connection';
                      })() : 'Select connection'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">No connection selected</span>
                    </SelectItem>
                    
                    {configuredConnections.length > 0 && (
                      <>
                        <SelectSeparator />
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Configured Connections
                        </div>
                        {configuredConnections.map((conn) => (
                          <SelectItem key={conn.id} value={`conn:${conn.id}`}>
                            <span className="flex items-center gap-2">
                              <span>{providerInfo[conn.provider]?.icon}</span>
                              <span>{conn.name}</span>
                              <Badge variant="secondary" className="ml-auto text-[10px] px-1">
                                {providerInfo[conn.provider]?.label}
                              </Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    
                    <SelectSeparator />
                    <SelectItem value="__add_source__">
                      <span className="flex items-center gap-2 text-primary">
                        <Plus className="h-4 w-4" />
                        <span>Add source...</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Show connection info when using a saved connection */}
                {editingStep.connectionId && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Credentials are managed in Settings → Connections
                      </p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0 text-xs"
                        onClick={() => setSettingsOpen(true)}
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                )}
                
                {!editingStep.connectionId && configuredConnections.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    No connections configured. Add a connection to use cloud execution.
                  </p>
                )}
              </div>
            </>
          )}
          
          <Separator />
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Script Configuration</Label>
          </div>
          
          <div className="space-y-2">
            <Label>Script Source</Label>
            <Select 
              value={editingStep.scriptSource || 'local'} 
              onValueChange={(value) => handleUpdateStep(editingStep.id, { scriptSource: value as 'local' | 'inline' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local File</SelectItem>
                <SelectItem value="inline">Inline Script</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {editingStep.scriptSource === 'local' || !editingStep.scriptSource ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="scriptPath">Script Path</Label>
                <PathInputWithSuggestions
                  value={editingStep.scriptPath || ''}
                  onChange={(value) => handleUpdateStep(editingStep.id, { scriptPath: value })}
                  placeholder="e.g., /path/to/preprocess.py or {{sourceNode.outputPath}}"
                  nodeId={nodeId}
                />
                <p className="text-xs text-muted-foreground">
                  Path to the Python script (.py file) that will be executed
                </p>
              </div>
              
              {/* Environment (Virtual Environment) Configuration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Environment</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      if (editingStep.venvMode === 'custom' && editingStep.venvPath) {
                        checkVenv(editingStep.scriptPath || '', editingStep.venvPath);
                      } else {
                        checkVenv(editingStep.scriptPath || '');
                      }
                    }}
                    disabled={venvStatus.checking}
                  >
                    <RefreshCw className={`h-3 w-3 ${venvStatus.checking ? 'animate-spin' : ''}`} />
                    Detect
                  </Button>
                </div>
                
                <Select 
                  value={editingStep.venvMode || 'auto'} 
                  onValueChange={(value) => {
                    handleUpdateStep(editingStep.id, { 
                      venvMode: value as 'auto' | 'custom' | 'none',
                      venvPath: value === 'none' ? undefined : editingStep.venvPath
                    });
                    if (value === 'auto' && editingStep.scriptPath) {
                      checkVenv(editingStep.scriptPath);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect (.venv)</SelectItem>
                    <SelectItem value="custom">Custom path</SelectItem>
                    <SelectItem value="none">System Python</SelectItem>
                  </SelectContent>
                </Select>
                
                {editingStep.venvMode === 'custom' && (
                  <Input
                    value={editingStep.venvPath || ''}
                    onChange={(e) => handleUpdateStep(editingStep.id, { venvPath: e.target.value })}
                    onBlur={(e) => {
                      if (e.target.value) {
                        checkVenv(editingStep.scriptPath || '', e.target.value);
                      }
                    }}
                    placeholder="e.g., /path/to/.venv or ~/myproject/venv"
                  />
                )}
                
                {/* Venv Status Badge */}
                {(editingStep.venvMode !== 'none') && (
                  <div className="flex items-center gap-2 mt-2">
                    {venvStatus.checking ? (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Checking...
                      </Badge>
                    ) : venvStatus.detected ? (
                      <Badge variant="default" className="text-xs gap-1 bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="h-3 w-3" />
                        venv detected
                      </Badge>
                    ) : editingStep.scriptPath ? (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <XCircle className="h-3 w-3" />
                        venv not detected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Enter script path first
                      </Badge>
                    )}
                  </div>
                )}
                
                {venvStatus.detected && venvStatus.venvPath && (
                  <p className="text-xs text-muted-foreground truncate" title={venvStatus.venvPath}>
                    Using: {venvStatus.venvPath}
                  </p>
                )}
                
                {!venvStatus.detected && venvStatus.error && editingStep.scriptPath && editingStep.venvMode !== 'none' && (
                  <p className="text-xs text-destructive">
                    {venvStatus.error}
                  </p>
                )}
                
                {editingStep.venvMode === 'none' && (
                  <p className="text-xs text-muted-foreground">
                    Will use system Python (python3). Make sure required packages are installed globally.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="inlineScript">Inline Script</Label>
              <Textarea
                id="inlineScript"
                value={editingStep.inlineScript || ''}
                onChange={(e) => handleUpdateStep(editingStep.id, { inlineScript: e.target.value })}
                placeholder="# Python code..."
                className="font-mono text-sm"
                rows={8}
              />
            </div>
          )}
          
          <Separator />
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Variable Configuration</Label>
            <p className="text-xs text-muted-foreground">
              Configure the variable names in your script that will be replaced with actual paths
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="useDataSourceVariable">Data Source Variables</Label>
              <ToggleSwitch
                id="useDataSourceVariable"
                checked={editingStep.useDataSourceVariable !== false}
                onChange={(checked) => handleUpdateStep(editingStep.id, { useDataSourceVariable: checked })}
              />
            </div>
            {editingStep.useDataSourceVariable !== false && (
              <>
                <div className="flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddDataSourceMapping(editingStep.id)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Variable
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Map variables in your script to outputs from the connected node
                </p>
                <div className="space-y-3">
                  {getDataSourceMappings(editingStep).map((mapping, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">Variable {index + 1}</Label>
                        {getDataSourceMappings(editingStep).length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveDataSourceMapping(editingStep.id, index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Variable Name</Label>
                        <Input
                          value={mapping.variableName}
                          onChange={(e) => handleUpdateDataSourceMapping(editingStep.id, index, { variableName: e.target.value })}
                          placeholder="DATA_SOURCE"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Replace With</Label>
                        <Select
                          value={mapping.sourceOutput}
                          onValueChange={(value) => handleUpdateDataSourceMapping(editingStep.id, index, { sourceOutput: value })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select source output" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inputPath">
                              <span className="flex items-center gap-2">
                                <span className="text-primary">Input Path</span>
                                <span className="text-xs text-muted-foreground">(default)</span>
                              </span>
                            </SelectItem>
                            {availableSourceOutputs.length > 0 && (
                              <>
                                <SelectSeparator />
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                  From Connected Node
                                </div>
                                {availableSourceOutputs.map((output, idx) => (
                                  <SelectItem key={idx} value={output.variable}>
                                    <span className="flex flex-col">
                                      <span className="font-mono text-xs">{output.variable}</span>
                                      <span className="text-xs text-muted-foreground">{output.label}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {mapping.sourceOutput === 'inputPath' 
                            ? 'Uses the input path passed to this step'
                            : `Uses ${mapping.sourceOutput} from the connected node`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {editingStep.useDataSourceVariable === false && (
              <p className="text-xs text-muted-foreground">
                Data source variable replacement is disabled
              </p>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="useOutputVariables">Output Variables</Label>
              <ToggleSwitch
                id="useOutputVariables"
                checked={editingStep.useOutputVariables !== false}
                onChange={(checked) => handleUpdateStep(editingStep.id, { useOutputVariables: checked })}
              />
            </div>
            {editingStep.useOutputVariables !== false && (
              <>
                <div className="flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddOutputVariable(editingStep.id)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Output
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Variable names that will contain output paths from your script
                </p>
                <div className="space-y-2">
                  {getOutputVariables(editingStep).map((varName, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={varName}
                        onChange={(e) => handleUpdateOutputVariable(editingStep.id, index, e.target.value)}
                        placeholder={`OUTPUT_PATH_${index + 1}`}
                        className="flex-1"
                      />
                      {getOutputVariables(editingStep).length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveOutputVariable(editingStep.id, index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {editingStep.useOutputVariables === false && (
              <p className="text-xs text-muted-foreground">
                Output variable replacement is disabled
              </p>
            )}
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enabled</Label>
            <input
              type="checkbox"
              id="enabled"
              checked={editingStep.enabled}
              onChange={(e) => handleUpdateStep(editingStep.id, { enabled: e.target.checked })}
              className="h-4 w-4"
            />
          </div>
        </div>
        
        {/* Settings Dialog for adding connections */}
        <ControlledSettingsDialog 
          open={settingsOpen} 
          onOpenChange={setSettingsOpen} 
          defaultTab="connections" 
        />
      </div>
    );
  }
  
  // Default view: list of steps
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Execute Steps</Label>
        <div className="space-y-2">
          {config.steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps configured</p>
          ) : (
            config.steps.map((step, index) => (
              <Card 
                key={step.id} 
                className="p-3 relative group"
                onMouseEnter={() => setHoveredStepId(step.id)}
                onMouseLeave={() => setHoveredStepId(null)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{index + 1}. {step.name}</span>
                    {step.scriptPath && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {step.scriptPath}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={step.executionMode === 'cloud' ? 'secondary' : 'outline'}>
                      {step.executionMode === 'cloud' ? '☁️ Cloud' : '💻 Local'}
                    </Badge>
                    {hoveredStepId === step.id && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingStepId(step.id)}
                          title="Edit step"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteStep(step.id)}
                          title="Delete step"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleAddStep}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Step
        </Button>
      </div>
      
      <Separator />
      
      <div className="space-y-2">
        <Label htmlFor="customCode">Custom Execute Code</Label>
        <Textarea
          id="customCode"
          value={config.customCode || ''}
          onChange={(e) => onUpdate({ customCode: e.target.value })}
          placeholder="# Python code..."
          className="font-mono text-sm"
          rows={6}
        />
      </div>
    </div>
  );
}

// Training Configuration Panel
interface TrainingConfigPanelProps {
  config: TrainingConfig;
  onUpdate: (updates: Partial<TrainingConfig>) => void;
}

function TrainingConfigPanel({ config, onUpdate }: TrainingConfigPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>ML Framework</Label>
        <Select value={config.framework} onValueChange={(value) => onUpdate({ framework: value as TrainingConfig['framework'] })}>
          <SelectTrigger>
            <SelectValue placeholder="Select framework" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pytorch">PyTorch</SelectItem>
            <SelectItem value="tensorflow">TensorFlow</SelectItem>
            <SelectItem value="sklearn">Scikit-Learn</SelectItem>
            <SelectItem value="xgboost">XGBoost</SelectItem>
            <SelectItem value="lightgbm">LightGBM</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>Cloud Provider</Label>
        <Select value={config.cloudProvider} onValueChange={(value) => onUpdate({ cloudProvider: value as TrainingConfig['cloudProvider'] })}>
          <SelectTrigger>
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local</SelectItem>
            <SelectItem value="gcp">Google Cloud Platform</SelectItem>
            <SelectItem value="aws">Amazon Web Services</SelectItem>
            <SelectItem value="azure">Microsoft Azure</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="instanceType">Instance Type</Label>
        <Input
          id="instanceType"
          value={config.instanceType}
          onChange={(e) => onUpdate({ instanceType: e.target.value })}
          placeholder="e.g., n1-standard-8"
        />
      </div>
      
      <Separator />
      <Label className="text-sm font-semibold">Training Parameters</Label>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="epochs">Epochs</Label>
          <Input
            id="epochs"
            type="number"
            value={config.epochs || ''}
            onChange={(e) => onUpdate({ epochs: parseInt(e.target.value) || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="batchSize">Batch Size</Label>
          <Input
            id="batchSize"
            type="number"
            value={config.batchSize || ''}
            onChange={(e) => onUpdate({ batchSize: parseInt(e.target.value) || undefined })}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="learningRate">Learning Rate</Label>
        <Input
          id="learningRate"
          type="number"
          step="0.0001"
          value={config.learningRate || ''}
          onChange={(e) => onUpdate({ learningRate: parseFloat(e.target.value) || undefined })}
        />
      </div>
      
      {config.cloudProvider !== 'local' && (
        <>
          <Separator />
          <Label className="text-sm font-semibold">Cloud Credentials</Label>
          
          {config.cloudProvider === 'gcp' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="gcpProjectId">GCP Project ID</Label>
                <Input
                  id="gcpProjectId"
                  value={config.credentials.gcpProjectId || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, gcpProjectId: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gcpServiceAccountKey">Service Account Key (JSON)</Label>
                <Textarea
                  id="gcpServiceAccountKey"
                  value={config.credentials.gcpServiceAccountKey || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, gcpServiceAccountKey: e.target.value }
                  })}
                  className="font-mono text-xs"
                  rows={4}
                />
              </div>
            </>
          )}
          
          {config.cloudProvider === 'aws' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="awsAccessKeyId">AWS Access Key ID</Label>
                <Input
                  id="awsAccessKeyId"
                  type="password"
                  value={config.credentials.awsAccessKeyId || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, awsAccessKeyId: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="awsSecretAccessKey">AWS Secret Access Key</Label>
                <Input
                  id="awsSecretAccessKey"
                  type="password"
                  value={config.credentials.awsSecretAccessKey || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, awsSecretAccessKey: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="awsRegion">AWS Region</Label>
                <Input
                  id="awsRegion"
                  value={config.credentials.awsRegion || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, awsRegion: e.target.value }
                  })}
                  placeholder="e.g., us-east-1"
                />
              </div>
            </>
          )}
          
          {config.cloudProvider === 'azure' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="azureSubscriptionId">Subscription ID</Label>
                <Input
                  id="azureSubscriptionId"
                  value={config.credentials.azureSubscriptionId || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, azureSubscriptionId: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="azureTenantId">Tenant ID</Label>
                <Input
                  id="azureTenantId"
                  value={config.credentials.azureTenantId || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, azureTenantId: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="azureClientId">Client ID</Label>
                <Input
                  id="azureClientId"
                  value={config.credentials.azureClientId || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, azureClientId: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="azureClientSecret">Client Secret</Label>
                <Input
                  id="azureClientSecret"
                  type="password"
                  value={config.credentials.azureClientSecret || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, azureClientSecret: e.target.value }
                  })}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Experiment Configuration Panel
interface ExperimentConfigPanelProps {
  config: ExperimentConfigType;
  onUpdate: (updates: Partial<ExperimentConfigType>) => void;
}

function ExperimentConfigPanel({ config, onUpdate }: ExperimentConfigPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Experiment Tracker</Label>
        <Select value={config.tracker} onValueChange={(value) => onUpdate({ tracker: value as ExperimentConfigType['tracker'] })}>
          <SelectTrigger>
            <SelectValue placeholder="Select tracker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="clearml">ClearML</SelectItem>
            <SelectItem value="mlflow">MLflow</SelectItem>
            <SelectItem value="wandb">Weights & Biases</SelectItem>
            <SelectItem value="comet">Comet ML</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="projectName">Project Name</Label>
        <Input
          id="projectName"
          value={config.projectName}
          onChange={(e) => onUpdate({ projectName: e.target.value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="experimentName">Experiment Name</Label>
        <Input
          id="experimentName"
          value={config.experimentName}
          onChange={(e) => onUpdate({ experimentName: e.target.value })}
        />
      </div>
      
      {config.tracker !== 'none' && (
        <>
          <Separator />
          <Label className="text-sm font-semibold">Tracker Credentials</Label>
          
          {config.tracker === 'clearml' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="clearmlApiHost">API Host</Label>
                <Input
                  id="clearmlApiHost"
                  value={config.credentials.clearmlApiHost || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, clearmlApiHost: e.target.value }
                  })}
                  placeholder="https://api.clear.ml"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clearmlWebHost">Web Host</Label>
                <Input
                  id="clearmlWebHost"
                  value={config.credentials.clearmlWebHost || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, clearmlWebHost: e.target.value }
                  })}
                  placeholder="https://app.clear.ml"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clearmlFilesHost">Files Host</Label>
                <Input
                  id="clearmlFilesHost"
                  value={config.credentials.clearmlFilesHost || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, clearmlFilesHost: e.target.value }
                  })}
                  placeholder="https://files.clear.ml"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clearmlAccessKey">Access Key</Label>
                <Input
                  id="clearmlAccessKey"
                  type="password"
                  value={config.credentials.clearmlAccessKey || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, clearmlAccessKey: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clearmlSecretKey">Secret Key</Label>
                <Input
                  id="clearmlSecretKey"
                  type="password"
                  value={config.credentials.clearmlSecretKey || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, clearmlSecretKey: e.target.value }
                  })}
                />
              </div>
            </>
          )}
          
          {config.tracker === 'mlflow' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="mlflowTrackingUri">Tracking URI</Label>
                <Input
                  id="mlflowTrackingUri"
                  value={config.credentials.mlflowTrackingUri || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, mlflowTrackingUri: e.target.value }
                  })}
                  placeholder="http://localhost:5000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mlflowUsername">Username</Label>
                <Input
                  id="mlflowUsername"
                  value={config.credentials.mlflowUsername || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, mlflowUsername: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mlflowPassword">Password</Label>
                <Input
                  id="mlflowPassword"
                  type="password"
                  value={config.credentials.mlflowPassword || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, mlflowPassword: e.target.value }
                  })}
                />
              </div>
            </>
          )}
          
          {config.tracker === 'wandb' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="wandbApiKey">API Key</Label>
                <Input
                  id="wandbApiKey"
                  type="password"
                  value={config.credentials.wandbApiKey || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, wandbApiKey: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wandbEntity">Entity / Team</Label>
                <Input
                  id="wandbEntity"
                  value={config.credentials.wandbEntity || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, wandbEntity: e.target.value }
                  })}
                />
              </div>
            </>
          )}
          
          {config.tracker === 'comet' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cometApiKey">API Key</Label>
                <Input
                  id="cometApiKey"
                  type="password"
                  value={config.credentials.cometApiKey || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, cometApiKey: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cometWorkspace">Workspace</Label>
                <Input
                  id="cometWorkspace"
                  value={config.credentials.cometWorkspace || ''}
                  onChange={(e) => onUpdate({ 
                    credentials: { ...config.credentials, cometWorkspace: e.target.value }
                  })}
                />
              </div>
            </>
          )}
        </>
      )}
      
      <Separator />
      <Label className="text-sm font-semibold">Logging Options</Label>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="logMetrics">Log Metrics</Label>
          <input
            type="checkbox"
            id="logMetrics"
            checked={config.logMetrics}
            onChange={(e) => onUpdate({ logMetrics: e.target.checked })}
            className="h-4 w-4"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="logArtifacts">Log Artifacts</Label>
          <input
            type="checkbox"
            id="logArtifacts"
            checked={config.logArtifacts}
            onChange={(e) => onUpdate({ logArtifacts: e.target.checked })}
            className="h-4 w-4"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="logHyperparameters">Log Hyperparameters</Label>
          <input
            type="checkbox"
            id="logHyperparameters"
            checked={config.logHyperparameters}
            onChange={(e) => onUpdate({ logHyperparameters: e.target.checked })}
            className="h-4 w-4"
          />
        </div>
      </div>
    </div>
  );
}

// Report Configuration Panel
interface ReportConfigPanelProps {
  config: ReportConfigType;
  onUpdate: (updates: Partial<ReportConfigType>) => void;
}

function ReportConfigPanel({ config, onUpdate }: ReportConfigPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reportTitle">Report Title</Label>
        <Input
          id="reportTitle"
          value={config.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label>Output Format</Label>
        <Select value={config.outputFormat} onValueChange={(value) => onUpdate({ outputFormat: value as ReportConfigType['outputFormat'] })}>
          <SelectTrigger>
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="html">HTML</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="markdown">Markdown</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="exportPath">Export Path</Label>
        <Input
          id="exportPath"
          value={config.exportPath || ''}
          onChange={(e) => onUpdate({ exportPath: e.target.value })}
          placeholder="e.g., ./reports/model_report"
        />
      </div>
      
      <Separator />
      <Label className="text-sm font-semibold">Report Sections</Label>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="includeMetrics">Include Metrics</Label>
          <input
            type="checkbox"
            id="includeMetrics"
            checked={config.includeMetrics}
            onChange={(e) => onUpdate({ includeMetrics: e.target.checked })}
            className="h-4 w-4"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="includeVisualizations">Include Visualizations</Label>
          <input
            type="checkbox"
            id="includeVisualizations"
            checked={config.includeVisualizations}
            onChange={(e) => onUpdate({ includeVisualizations: e.target.checked })}
            className="h-4 w-4"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="includeModelCard">Include Model Card</Label>
          <input
            type="checkbox"
            id="includeModelCard"
            checked={config.includeModelCard}
            onChange={(e) => onUpdate({ includeModelCard: e.target.checked })}
            className="h-4 w-4"
          />
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-2">
        <Label>Custom Sections</Label>
        <div className="space-y-2">
          {(!config.customSections || config.customSections.length === 0) ? (
            <p className="text-sm text-muted-foreground">No custom sections</p>
          ) : (
            config.customSections.map((section) => (
              <Card key={section.id} className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{section.title}</span>
                  <Badge variant="outline">{section.type}</Badge>
                </div>
              </Card>
            ))
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            const newSection = {
              id: `section-${Date.now()}`,
              title: 'New Section',
              content: '',
              type: 'text' as const,
            };
            onUpdate({ customSections: [...(config.customSections || []), newSection] });
          }}
        >
          Add Section
        </Button>
      </div>
    </div>
  );
}
