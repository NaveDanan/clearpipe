import { NodeTypeDefinition } from '@/types/pipeline';

export const nodeTypeDefinitions: NodeTypeDefinition[] = [
  {
    type: 'dataset',
    label: 'Dataset',
    description: 'Load and configure your data source',
    icon: 'Database',
    category: 'data',
    defaultConfig: {
      source: 'local',
      path: '',
      format: 'csv',
    },
  },
  {
    type: 'versioning',
    label: 'Data Versioning',
    description: 'Version control for data and models',
    icon: 'GitBranch',
    category: 'data',
    defaultConfig: {
      tool: 'dvc',
      version: '1.0.0',
    },
  },
  {
    type: 'execute',
    label: 'Execute',
    description: 'Transform and prepare your data',
    icon: 'Wand2',
    category: 'processing',
    defaultConfig: {
      steps: [],
    },
  },
  {
    type: 'training',
    label: 'Model Training',
    description: 'Train ML models on cloud or local',
    icon: 'Cpu',
    category: 'training',
    defaultConfig: {
      framework: 'pytorch',
      cloudProvider: 'local',
      instanceType: 'local',
    },
  },
  {
    type: 'experiment',
    label: 'Experiment Tracking',
    description: 'Track experiments with ClearML, MLflow, W&B',
    icon: 'FlaskConical',
    category: 'tracking',
    defaultConfig: {
      tracker: 'clearml',
      projectName: '',
      experimentName: '',
      logMetrics: true,
      logArtifacts: true,
    },
  },
  {
    type: 'report',
    label: 'Model Report',
    description: 'Generate model documentation and reports',
    icon: 'FileText',
    category: 'output',
    defaultConfig: {
      title: 'Model Report',
      includeMetrics: true,
      includeVisualizations: true,
      outputFormat: 'html',
    },
  },
];

export const categoryColors: Record<string, string> = {
  data: 'bg-blue-500',
  processing: 'bg-purple-500',
  training: 'bg-orange-500',
  tracking: 'bg-green-500',
  output: 'bg-pink-500',
};

export const categoryLabels: Record<string, string> = {
  data: 'Data',
  processing: 'Processing',
  training: 'Training',
  tracking: 'Tracking',
  output: 'Output',
};

export const statusColors: Record<string, string> = {
  idle: 'bg-gray-400',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
};

export const cloudProviderOptions = [
  { value: 'local', label: 'Local Machine' },
  { value: 'gcp', label: 'Google Cloud Platform' },
  { value: 'aws', label: 'Amazon Web Services' },
  { value: 'azure', label: 'Microsoft Azure' },
];

export const experimentTrackerOptions = [
  { value: 'clearml', label: 'ClearML' },
  { value: 'mlflow', label: 'MLflow' },
  { value: 'wandb', label: 'Weights & Biases' },
  { value: 'comet', label: 'Comet ML' },
  { value: 'none', label: 'None' },
];

export const frameworkOptions = [
  { value: 'pytorch', label: 'PyTorch' },
  { value: 'tensorflow', label: 'TensorFlow' },
  { value: 'sklearn', label: 'Scikit-learn' },
  { value: 'xgboost', label: 'XGBoost' },
  { value: 'lightgbm', label: 'LightGBM' },
  { value: 'custom', label: 'Custom' },
];

export const dataFormatOptions = [
  // Tabular Formats
  { value: 'csv', label: 'CSV', category: 'Tabular' },
  { value: 'tsv', label: 'TSV', category: 'Tabular' },
  { value: 'xlsx', label: 'Excel (.xlsx)', category: 'Tabular' },
  { value: 'xls', label: 'Excel (.xls)', category: 'Tabular' },
  
  // Columnar Formats
  { value: 'parquet', label: 'Parquet', category: 'Columnar' },
  { value: 'arrow', label: 'Apache Arrow', category: 'Columnar' },
  { value: 'avro', label: 'Avro', category: 'Columnar' },
  { value: 'orc', label: 'ORC', category: 'Columnar' },
  { value: 'feather', label: 'Apache Feather', category: 'Columnar' },
  
  // Scientific Formats
  { value: 'hdf5', label: 'HDF5', category: 'Scientific' },
  { value: 'netcdf', label: 'NetCDF', category: 'Scientific' },
  { value: 'sqlite', label: 'SQLite', category: 'Scientific' },
  
  // Serialization Formats
  { value: 'json', label: 'JSON', category: 'Serialization' },
  { value: 'jsonl', label: 'JSON Lines', category: 'Serialization' },
  { value: 'pickle', label: 'Python Pickle', category: 'Serialization' },
  { value: 'xml', label: 'XML', category: 'Serialization' },
  { value: 'yaml', label: 'YAML', category: 'Serialization' },
  
  // Image Formats
  { value: 'jpg', label: 'JPEG', category: 'Images' },
  { value: 'png', label: 'PNG', category: 'Images' },
  { value: 'gif', label: 'GIF', category: 'Images' },
  { value: 'bmp', label: 'BMP', category: 'Images' },
  { value: 'tiff', label: 'TIFF', category: 'Images' },
  { value: 'webp', label: 'WebP', category: 'Images' },
  { value: 'svg', label: 'SVG', category: 'Images' },
  
  // Video Formats
  { value: 'mp4', label: 'MP4', category: 'Videos' },
  { value: 'avi', label: 'AVI', category: 'Videos' },
  { value: 'mkv', label: 'Matroska (MKV)', category: 'Videos' },
  { value: 'mov', label: 'QuickTime (MOV)', category: 'Videos' },
  { value: 'flv', label: 'Flash Video (FLV)', category: 'Videos' },
  { value: 'wmv', label: 'Windows Media Video', category: 'Videos' },
  { value: 'webm', label: 'WebM', category: 'Videos' },
  
  // Audio Formats
  { value: 'mp3', label: 'MP3', category: 'Audio' },
  { value: 'wav', label: 'WAV', category: 'Audio' },
  { value: 'flac', label: 'FLAC', category: 'Audio' },
  { value: 'aac', label: 'AAC', category: 'Audio' },
  { value: 'ogg', label: 'OGG Vorbis', category: 'Audio' },
  { value: 'm4a', label: 'M4A', category: 'Audio' },
  { value: 'wma', label: 'Windows Media Audio', category: 'Audio' },
  
  { value: 'custom', label: 'Custom', category: 'Other' },
];

export type DataFormatOption = typeof dataFormatOptions[number];

export const dataSourceOptions = [
  { value: 'local', label: 'Local File System', category: 'Local' },
  { value: 's3', label: 'Amazon S3', category: 'Cloud' },
  { value: 'gcs', label: 'Google Cloud Storage', category: 'Cloud' },
  { value: 'azure-blob', label: 'Azure Blob Storage', category: 'Cloud' },
  { value: 'minio', label: 'MinIO', category: 'Cloud' },
  { value: 'clearml', label: 'ClearML Dataset', category: 'ML Platform' },
  { value: 'url', label: 'URL', category: 'Other' },
];

export const versioningToolOptions = [
  { value: 'dvc', label: 'DVC' },
  { value: 'git-lfs', label: 'Git LFS' },
  { value: 'clearml-data', label: 'ClearML Data' },
  { value: 'mlflow-artifacts', label: 'MLflow Artifacts' },
  { value: 'custom', label: 'Custom' },
];

export const executeStepTypes = [
  { value: 'normalize', label: 'Normalize' },
  { value: 'standardize', label: 'Standardize' },
  { value: 'encode', label: 'Encode Categorical' },
  { value: 'impute', label: 'Impute Missing Values' },
  { value: 'feature_engineering', label: 'Feature Engineering' },
  { value: 'custom', label: 'Custom Code' },
];
