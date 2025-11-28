import { Node, Edge } from '@xyflow/react';

// Node status types
export type NodeStatus = 'idle' | 'running' | 'completed' | 'error' | 'warning';

// Cloud providers
export type CloudProvider = 'gcp' | 'aws' | 'azure' | 'local';

// Experiment trackers
export type ExperimentTracker = 'clearml' | 'mlflow' | 'wandb' | 'comet' | 'none';

// ML Frameworks
export type MLFramework = 'pytorch' | 'tensorflow' | 'sklearn' | 'xgboost' | 'lightgbm' | 'custom';

// Base node data interface
export interface BaseNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  status: NodeStatus;
  statusMessage?: string;
  lastUpdated?: string;
}

// Dataset node configuration
export interface DatasetNodeData extends BaseNodeData {
  type: 'dataset';
  config: DatasetConfig;
}

export interface DatasetConfig {
  [key: string]: unknown;
  source: 'local' | 's3' | 'gcs' | 'azure-blob' | 'minio' | 'clearml' | 'url';
  path: string;
  format: string | string[];
  // Reference to a saved connection from settings
  connectionId?: string;
  // S3/MinIO specific
  bucket?: string;
  region?: string;
  endpoint?: string; // For MinIO custom endpoint
  // Azure specific
  container?: string;
  // ClearML specific
  datasetId?: string;
  datasetProject?: string;
  // Credentials for all cloud providers
  credentials?: {
    // AWS S3 / MinIO
    accessKey?: string;
    secretKey?: string;
    // Azure Blob Storage
    connectionString?: string;
    accountName?: string;
    accountKey?: string;
    sasToken?: string;
    // Google Cloud Storage
    projectId?: string;
    serviceAccountKey?: string; // JSON key file content
    // ClearML
    clearmlApiHost?: string;
    clearmlWebHost?: string;
    clearmlFilesHost?: string;
    clearmlAccessKey?: string;
    clearmlSecretKey?: string;
  };
  preview?: {
    columns: string[];
    rows: number;
    sampleData?: Record<string, unknown>[];
  };
}

// Versioning node configuration
export interface VersioningNodeData extends BaseNodeData {
  type: 'versioning';
  config: VersioningConfig;
}

export interface VersioningConfig {
  [key: string]: unknown;
  tool: 'dvc' | 'git-lfs' | 'clearml-data' | 'mlflow-artifacts' | 'custom';
  version: string;
  commitHash?: string;
  remoteUrl?: string;
  credentials?: {
    token?: string;
    username?: string;
    password?: string;
  };
  metadata?: Record<string, unknown>;
}

// Preprocessing node configuration
export interface PreprocessingNodeData extends BaseNodeData {
  type: 'preprocessing';
  config: PreprocessingConfig;
}

export interface PreprocessingConfig {
  [key: string]: unknown;
  steps: PreprocessingStep[];
  inputColumns?: string[];
  outputColumns?: string[];
  customCode?: string;
}

export interface PreprocessingStep {
  id: string;
  name: string;
  type: 'normalize' | 'standardize' | 'encode' | 'impute' | 'feature_engineering' | 'custom';
  params: Record<string, unknown>;
  enabled: boolean;
  // Script execution configuration
  scriptSource?: 'local' | 'inline';
  scriptPath?: string; // Path to the .py file when scriptSource is 'local'
  inlineScript?: string; // Python code when scriptSource is 'inline'
  dataSourceVariable?: string; // Variable name to replace with the input data path (default: 'DATA_SOURCE')
  outputVariables?: string[]; // Variable names that contain output paths (default: ['OUTPUT_PATH'])
}

// Training node configuration
export interface TrainingNodeData extends BaseNodeData {
  type: 'training';
  config: TrainingConfig;
}

export interface TrainingConfig {
  [key: string]: unknown;
  framework: MLFramework;
  cloudProvider: CloudProvider;
  instanceType: string;
  instanceConfig: {
    gpu?: string;
    memory?: string;
    cpuCores?: number;
  };
  credentials: {
    // GCP
    gcpProjectId?: string;
    gcpServiceAccountKey?: string;
    // AWS
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    // Azure
    azureSubscriptionId?: string;
    azureTenantId?: string;
    azureClientId?: string;
    azureClientSecret?: string;
  };
  trainingScript?: string;
  hyperparameters: Record<string, unknown>;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
}

// Experiment tracking node configuration
export interface ExperimentNodeData extends BaseNodeData {
  type: 'experiment';
  config: ExperimentConfig;
}

export interface ExperimentConfig {
  [key: string]: unknown;
  tracker: ExperimentTracker;
  projectName: string;
  experimentName: string;
  credentials: {
    // ClearML
    clearmlApiHost?: string;
    clearmlWebHost?: string;
    clearmlFilesHost?: string;
    clearmlAccessKey?: string;
    clearmlSecretKey?: string;
    // MLflow
    mlflowTrackingUri?: string;
    mlflowUsername?: string;
    mlflowPassword?: string;
    // W&B
    wandbApiKey?: string;
    wandbEntity?: string;
    // Comet
    cometApiKey?: string;
    cometWorkspace?: string;
  };
  logMetrics: boolean;
  logArtifacts: boolean;
  logHyperparameters: boolean;
  tags?: string[];
}

// Report node configuration
export interface ReportNodeData extends BaseNodeData {
  type: 'report';
  config: ReportConfig;
}

export interface ReportConfig {
  [key: string]: unknown;
  title: string;
  includeMetrics: boolean;
  includeVisualizations: boolean;
  includeModelCard: boolean;
  outputFormat: 'html' | 'pdf' | 'markdown' | 'json';
  customSections?: ReportSection[];
  exportPath?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'chart' | 'table' | 'code';
}

// Union type for all node data
export type PipelineNodeData =
  | DatasetNodeData
  | VersioningNodeData
  | PreprocessingNodeData
  | TrainingNodeData
  | ExperimentNodeData
  | ReportNodeData;

// Pipeline node type (React Flow node with our data)
export type PipelineNode = Node<PipelineNodeData>;

// Pipeline edge with custom data
export interface PipelineEdgeData extends Record<string, unknown> {
  animated?: boolean;
  dataFlow?: 'success' | 'error' | 'conditional';
}

export type PipelineEdge = Edge<PipelineEdgeData>;

// Pipeline definition
export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  createdAt: string;
  updatedAt: string;
  version: string;
  metadata?: Record<string, unknown>;
}

// Node type definitions for the palette
export interface NodeTypeDefinition {
  type: PipelineNodeData['type'];
  label: string;
  description: string;
  icon: string;
  category: 'data' | 'processing' | 'training' | 'tracking' | 'output';
  defaultConfig: Partial<PipelineNodeData['config']>;
}

// Execution status
export interface ExecutionStatus {
  nodeId: string;
  status: NodeStatus;
  progress?: number;
  message?: string;
  startTime?: string;
  endTime?: string;
  logs?: string[];
  metrics?: Record<string, number>;
}

// Real-time update types
export type UpdateType = 'websocket' | 'sse' | 'polling';

export interface RealTimeConfig {
  nodeType: PipelineNodeData['type'];
  updateType: UpdateType;
  interval?: number; // For polling
  endpoint?: string;
}
