import { NodeCategory } from './types';

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
