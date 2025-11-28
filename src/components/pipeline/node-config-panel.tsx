'use client';

import { useCallback, useState, useEffect } from 'react';
import { X, Settings, Database, GitBranch, Wand2, Cpu, BarChart3, FileText, ChevronDown, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { usePipelineStore } from '@/stores/pipeline-store';
import { useSettingsStore } from '@/stores/settings-store';
import { ControlledSettingsDialog } from '@/components/ui/settings-dialog';
import { dataFormatOptions } from '@/config/node-definitions';
import type { DataFormatOption } from '@/config/node-definitions';
import type {
  PipelineNodeData,
  DatasetNodeData,
  VersioningNodeData,
  PreprocessingNodeData,
  TrainingNodeData,
  ExperimentNodeData,
  ReportNodeData,
  DatasetConfig,
  VersioningConfig,
  PreprocessingConfig,
  PreprocessingStep,
  TrainingConfig,
  ExperimentConfig as ExperimentConfigType,
  ReportConfig as ReportConfigType,
} from '@/types/pipeline';

const nodeIcons: Record<string, React.ReactNode> = {
  dataset: <Database className="h-5 w-5" />,
  versioning: <GitBranch className="h-5 w-5" />,
  preprocessing: <Wand2 className="h-5 w-5" />,
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
        <div className="bg-muted/50 px-3 py-2.5">
          <div className="font-medium text-sm">{getDisplayText()}</div>
          {selectedFormats.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedFormats.map((format) => {
                const option = dataFormatOptions.find((opt) => opt.value === format);
                return (
                  <Badge key={format} variant="default" className="text-xs">
                    {option?.label || format}
                    <button
                      onClick={() => handleFormatChange(format)}
                      className="ml-1 hover:opacity-75"
                    >
                      ✕
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
        
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
          />
        );
      case 'versioning':
        return (
          <VersioningConfigPanel
            config={(nodeData as VersioningNodeData).config}
            onUpdate={handleUpdateConfig}
          />
        );
      case 'preprocessing':
        return (
          <PreprocessingConfigPanel
            config={(nodeData as PreprocessingNodeData).config}
            onUpdate={handleUpdateConfig}
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
                <Label>Status</Label>
                <Badge variant={nodeData.status === 'completed' ? 'default' : 'secondary'}>
                  {nodeData.status}
                </Badge>
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
}

// Provider display info for connections
const providerInfo: Record<string, { label: string; icon: string }> = {
  aws: { label: 'AWS S3', icon: '🟠' },
  gcp: { label: 'Google Cloud Storage', icon: '🔵' },
  azure: { label: 'Azure Blob', icon: '🔷' },
  minio: { label: 'MinIO', icon: '🟣' },
  clearml: { label: 'ClearML', icon: '🟢' },
};

function DatasetConfigPanel({ config, onUpdate }: DatasetConfigPanelProps) {
  const { connections, fetchConnections } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Fetch connections on mount
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);
  
  // Get configured connections (those marked as configured)
  const configuredConnections = connections.filter(conn => conn.isConfigured);
  
  // Handle source selection
  const handleSourceChange = (value: string) => {
    if (value === '__add_source__') {
      setSettingsOpen(true);
      return;
    }
    
    // Check if it's a connection ID (starts with 'conn:')
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
    } else {
      onUpdate({ source: value as DatasetConfig['source'], connectionId: undefined });
    }
  };
  
  // Determine current value for the select
  const getCurrentValue = () => {
    if (config.connectionId) {
      return `conn:${config.connectionId}`;
    }
    return config.source;
  };
  
  // Get display name for current selection
  const getSourceDisplayName = () => {
    if (config.connectionId) {
      const connection = connections.find(c => c.id === config.connectionId);
      if (connection) {
        return `${providerInfo[connection.provider]?.icon || ''} ${connection.name}`;
      }
    }
    switch (config.source) {
      case 'local': return 'Local File';
      case 'url': return 'URL';
      case 's3': return 'Amazon S3';
      case 'gcs': return 'Google Cloud Storage';
      case 'azure-blob': return 'Azure Blob Storage';
      case 'minio': return 'MinIO';
      case 'clearml': return 'ClearML';
      default: return 'Select source';
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Data Source</Label>
        <Select value={getCurrentValue()} onValueChange={handleSourceChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select source">
              {getSourceDisplayName()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local File</SelectItem>
            <SelectItem value="url">URL</SelectItem>
            
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
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="path">
          {config.source === 'url' ? 'URL' : 'Path'}
        </Label>
        <Input
          id="path"
          value={config.path}
          onChange={(e) => onUpdate({ path: e.target.value })}
          placeholder={
            config.source === 'url' 
              ? 'e.g., https://example.com/data.csv'
              : config.source === 'local'
                ? 'e.g., /data/train.csv'
                : 'e.g., bucket/path/to/data'
          }
        />
      </div>
      
      <div className="space-y-2">
        <Label>File Format(s)</Label>
        <CollapsibleFormatSelector 
          value={config.format} 
          onChange={(value) => onUpdate({ format: value })}
        />
      </div>
      
      {/* Show additional fields for cloud sources that are NOT using a saved connection */}
      {!(config.connectionId) && (config.source === 's3' || config.source === 'gcs' || config.source === 'azure-blob' || config.source === 'minio') && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Cloud Credentials</Label>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs"
                onClick={() => setSettingsOpen(true)}
              >
                Or use a saved connection
              </Button>
            </div>
            
            {(config.source === 's3' || config.source === 'minio') && (
              <>
                {config.source === 'minio' && (
                  <div className="space-y-2">
                    <Label htmlFor="endpoint">Endpoint</Label>
                    <Input
                      id="endpoint"
                      value={config.endpoint || ''}
                      onChange={(e) => onUpdate({ endpoint: e.target.value })}
                      placeholder="e.g., http://localhost:9000"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="bucket">Bucket</Label>
                  <Input
                    id="bucket"
                    value={config.bucket || ''}
                    onChange={(e) => onUpdate({ bucket: e.target.value })}
                    placeholder="e.g., my-bucket"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessKey">Access Key ID</Label>
                  <Input
                    id="accessKey"
                    type="password"
                    value={config.credentials?.accessKey || ''}
                    onChange={(e) => onUpdate({ 
                      credentials: { ...config.credentials, accessKey: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretKey">Secret Access Key</Label>
                  <Input
                    id="secretKey"
                    type="password"
                    value={config.credentials?.secretKey || ''}
                    onChange={(e) => onUpdate({ 
                      credentials: { ...config.credentials, secretKey: e.target.value }
                    })}
                  />
                </div>
              </>
            )}
            
            {config.source === 'gcs' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bucket">Bucket</Label>
                  <Input
                    id="bucket"
                    value={config.bucket || ''}
                    onChange={(e) => onUpdate({ bucket: e.target.value })}
                    placeholder="e.g., my-gcs-bucket"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectId">Project ID</Label>
                  <Input
                    id="projectId"
                    value={config.credentials?.projectId || ''}
                    onChange={(e) => onUpdate({ 
                      credentials: { ...config.credentials, projectId: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceAccountKey">Service Account Key (JSON)</Label>
                  <Textarea
                    id="serviceAccountKey"
                    value={config.credentials?.serviceAccountKey || ''}
                    onChange={(e) => onUpdate({ 
                      credentials: { ...config.credentials, serviceAccountKey: e.target.value }
                    })}
                    className="font-mono text-xs"
                    rows={4}
                    placeholder="Paste your service account key JSON here"
                  />
                </div>
              </>
            )}
            
            {config.source === 'azure-blob' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="container">Container</Label>
                  <Input
                    id="container"
                    value={config.container || ''}
                    onChange={(e) => onUpdate({ container: e.target.value })}
                    placeholder="e.g., my-container"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="connectionString">Connection String</Label>
                  <Input
                    id="connectionString"
                    type="password"
                    value={config.credentials?.connectionString || ''}
                    onChange={(e) => onUpdate({ 
                      credentials: { ...config.credentials, connectionString: e.target.value }
                    })}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
      
      {/* Show connection info when using a saved connection */}
      {config.connectionId && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Using Saved Connection</Label>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs"
                onClick={() => setSettingsOpen(true)}
              >
                Manage connections
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Credentials are managed in Settings → Connections
            </p>
          </div>
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
}

function VersioningConfigPanel({ config, onUpdate }: VersioningConfigPanelProps) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}

// Preprocessing Configuration Panel
interface PreprocessingConfigPanelProps {
  config: PreprocessingConfig;
  onUpdate: (updates: Partial<PreprocessingConfig>) => void;
}

function PreprocessingConfigPanel({ config, onUpdate }: PreprocessingConfigPanelProps) {
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  
  const editingStep = editingStepId ? config.steps.find(s => s.id === editingStepId) : null;
  
  const handleDeleteStep = (stepId: string) => {
    onUpdate({ steps: config.steps.filter(s => s.id !== stepId) });
    if (editingStepId === stepId) {
      setEditingStepId(null);
    }
  };
  
  const handleUpdateStep = (stepId: string, updates: Partial<PreprocessingStep>) => {
    onUpdate({
      steps: config.steps.map(s => 
        s.id === stepId ? { ...s, ...updates } : s
      )
    });
  };
  
  const handleAddStep = () => {
    const newStep: PreprocessingStep = {
      id: `step-${Date.now()}`,
      name: 'New Step',
      type: 'custom' as const,
      params: {},
      enabled: true,
      scriptSource: 'local',
      scriptPath: '',
      dataSourceVariable: 'DATA_SOURCE',
      outputVariables: ['OUTPUT_PATH'],
    };
    onUpdate({ steps: [...config.steps, newStep] });
  };
  
  // Helper functions for managing output variables
  const getOutputVariables = (step: PreprocessingStep): string[] => {
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
            <Label>Step Type</Label>
            <Select 
              value={editingStep.type} 
              onValueChange={(value) => handleUpdateStep(editingStep.id, { type: value as PreprocessingStep['type'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normalize">Normalize</SelectItem>
                <SelectItem value="standardize">Standardize</SelectItem>
                <SelectItem value="encode">Encode</SelectItem>
                <SelectItem value="impute">Impute</SelectItem>
                <SelectItem value="feature_engineering">Feature Engineering</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
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
            <div className="space-y-2">
              <Label htmlFor="scriptPath">Script Path</Label>
              <Input
                id="scriptPath"
                value={editingStep.scriptPath || ''}
                onChange={(e) => handleUpdateStep(editingStep.id, { scriptPath: e.target.value })}
                placeholder="e.g., /path/to/preprocess.py"
              />
              <p className="text-xs text-muted-foreground">
                Path to the Python script (.py file) that will be executed
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="inlineScript">Inline Script</Label>
              <Textarea
                id="inlineScript"
                value={editingStep.inlineScript || ''}
                onChange={(e) => handleUpdateStep(editingStep.id, { inlineScript: e.target.value })}
                placeholder="# Python preprocessing code..."
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
          
          <div className="space-y-2">
            <Label htmlFor="dataSourceVariable">Data Source Variable</Label>
            <Input
              id="dataSourceVariable"
              value={editingStep.dataSourceVariable || 'DATA_SOURCE'}
              onChange={(e) => handleUpdateStep(editingStep.id, { dataSourceVariable: e.target.value })}
              placeholder="DATA_SOURCE"
            />
            <p className="text-xs text-muted-foreground">
              This variable in your script will be replaced with the input data path
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Output Variables</Label>
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
      </div>
    );
  }
  
  // Default view: list of steps
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Preprocessing Steps</Label>
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
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{index + 1}. {step.name}</span>
                    {step.scriptPath && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {step.scriptPath}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
                    <Badge variant={step.enabled ? 'default' : 'secondary'}>
                      {step.type}
                    </Badge>
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
        <Label htmlFor="customCode">Custom Preprocessing Code</Label>
        <Textarea
          id="customCode"
          value={config.customCode || ''}
          onChange={(e) => onUpdate({ customCode: e.target.value })}
          placeholder="# Python preprocessing code..."
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
