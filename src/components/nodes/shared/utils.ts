import { NodeCategory } from './types';
import { PipelineNode, PipelineEdge, PipelineNodeData } from '@/types/pipeline';

// Map node type to category
export function getCategoryFromType(type: string): NodeCategory {
  switch (type) {
    case 'dataset':
    case 'versioning':
      return 'data';
    case 'execute':
      return 'processing';
    case 'training':
      return 'training';
    case 'experiment':
      return 'tracking';
    case 'report':
      return 'output';
    default:
      return 'data';
  }
}

// Category color mapping for node borders/backgrounds
export const categoryColorMap: Record<string, string> = {
  data: 'border-blue-500/50 bg-blue-500/5',
  processing: 'border-purple-500/50 bg-purple-500/5',
  training: 'border-orange-500/50 bg-orange-500/5',
  tracking: 'border-green-500/50 bg-green-500/5',
  output: 'border-pink-500/50 bg-pink-500/5',
};

// Category background colors for icons
export const categoryIconBgMap: Record<string, string> = {
  data: 'bg-blue-500/20',
  processing: 'bg-purple-500/20',
  training: 'bg-orange-500/20',
  tracking: 'bg-green-500/20',
  output: 'bg-pink-500/20',
};

// Status color mapping
export const statusColorMap: Record<string, string> = {
  idle: 'text-gray-400',
  running: 'text-blue-500 animate-spin',
  completed: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
};

// Extension mapping for file formats
export const extensionMap: Record<string, string> = {
  csv: 'csv',
  tsv: 'tsv',
  xlsx: 'xlsx',
  xls: 'xls',
  parquet: 'parquet',
  json: 'json',
  jsonl: 'jsonl',
  arrow: 'arrow',
  avro: 'avro',
  orc: 'orc',
  hdf5: 'hdf5|h5',
  netcdf: 'nc|netcdf',
  sqlite: 'sqlite|db',
  xml: 'xml',
  yaml: 'yaml|yml',
  pickle: 'pkl|pickle',
  feather: 'feather',
  jpg: 'jpg|jpeg',
  png: 'png',
  gif: 'gif',
  bmp: 'bmp',
  tiff: 'tiff|tif',
  webp: 'webp',
  svg: 'svg',
  mp4: 'mp4',
  avi: 'avi',
  mkv: 'mkv',
  mov: 'mov',
  flv: 'flv',
  wmv: 'wmv',
  webm: 'webm',
  mp3: 'mp3',
  wav: 'wav',
  flac: 'flac',
  aac: 'aac',
  ogg: 'ogg',
  m4a: 'm4a',
  wma: 'wma',
};

// Convert format selections to regex pattern
export function formatToRegexPattern(format: string | string[]): string {
  if (!format) return '';
  
  const formats = Array.isArray(format) ? format : [format];
  
  const extensionsToMatch = formats
    .filter(f => f !== 'custom')
    .map(f => extensionMap[f] || f);
  
  if (extensionsToMatch.length === 0) return '';
  
  return `.*\\.(${extensionsToMatch.join('|')})$`;
}

/**
 * Get the connected source node (node that connects TO this node)
 * Returns the node that is connected via an incoming edge
 */
export function getConnectedSourceNode(
  nodeId: string,
  nodes: PipelineNode[],
  edges: PipelineEdge[]
): { node: PipelineNode; data: PipelineNodeData } | null {
  // Find edge where this node is the target
  const incomingEdge = edges.find((edge) => edge.target === nodeId);
  
  if (!incomingEdge) return null;
  
  // Find the source node
  const sourceNode = nodes.find((node) => node.id === incomingEdge.source);
  
  if (!sourceNode) return null;
  
  return {
    node: sourceNode,
    data: sourceNode.data as PipelineNodeData,
  };
}

/**
 * Get available output variables from the connected source node
 * Different node types produce different output variables
 */
export function getAvailableOutputVariables(
  sourceNodeData: PipelineNodeData
): { variable: string; label: string }[] {
  const outputs: { variable: string; label: string }[] = [];
  
  switch (sourceNodeData.type) {
    case 'dataset':
      outputs.push({
        variable: '{{sourceNode.outputPath}}',
        label: 'Dataset Output Path',
      });
      break;
      
    case 'execute':
      outputs.push({
        variable: '{{sourceNode.outputPath}}',
        label: 'Primary Output Path',
      });
      const config = sourceNodeData.config as any;
      if (config.steps && Array.isArray(config.steps)) {
        config.steps.forEach((step: any, index: number) => {
          if (step.outputVariables && Array.isArray(step.outputVariables)) {
            step.outputVariables.forEach((varName: string) => {
              outputs.push({
                variable: `{{sourceNode.${varName}}}`,
                label: `Step ${index + 1} - ${step.name} (${varName})`,
              });
            });
          }
        });
      }
      break;
      
    case 'preprocessing':
      outputs.push({
        variable: '{{sourceNode.outputPath}}',
        label: 'Primary Output Path',
      });
      const preprocessConfig = sourceNodeData.config as any;
      if (preprocessConfig.steps && Array.isArray(preprocessConfig.steps)) {
        preprocessConfig.steps.forEach((step: any, index: number) => {
          outputs.push({
            variable: `{{sourceNode.outputPaths[${index}]}}`,
            label: `Step ${index + 1} - ${step.name}`,
          });
        });
      }
      break;
      
    case 'training':
      outputs.push({
        variable: '{{sourceNode.modelPath}}',
        label: 'Trained Model Path',
      });
      outputs.push({
        variable: '{{sourceNode.metricsPath}}',
        label: 'Metrics File Path',
      });
      break;
      
    default:
      // Generic fallback
      outputs.push({
        variable: '{{sourceNode.outputPath}}',
        label: 'Output Path',
      });
  }
  
  return outputs;
}

/**
 * Resolve a variable reference like {{sourceNode.outputPath}} using actual node data
 * Returns the resolved value or null if variable is not found
 */
export function resolveOutputVariable(
  variableReference: string,
  sourceNodeData: any
): string | null {
  // Match pattern like {{sourceNode.outputPath}} or {{sourceNode.outputPaths[0]}}
  const match = variableReference.match(/\{\{sourceNode\.(\w+(?:\[\d+\])?)\}\}/);
  
  if (!match) return null;
  
  const path = match[1];
  
  // Handle array access like outputPaths[0]
  const arrayMatch = path.match(/(\w+)\[(\d+)\]/);
  if (arrayMatch) {
    const [, arrayName, indexStr] = arrayMatch;
    const index = parseInt(indexStr, 10);
    const array = sourceNodeData[arrayName];
    
    if (Array.isArray(array) && array[index]) {
      return array[index];
    }
    return null;
  }
  
  // Simple property access
  return sourceNodeData[path] || null;
}
