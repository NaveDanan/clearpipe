// Node components and their execution functions
export { DatasetNode, checkDatasetConnection } from './dataset';
export { VersioningNode, executeVersioning } from './versioning';
export { PreprocessingNode, executePreprocessing } from './preprocessing';
export type { PreprocessingExecutionResult } from './preprocessing';
export { TrainingNode, executeTraining } from './training';
export { ExperimentNode, executeExperiment } from './experiment';
export { ReportNode, executeReport } from './report';

// Base component
export { BaseNodeComponent } from './base-node-component';

// Shared utilities and types
export * from './shared';

// Node types mapping for React Flow
import { DatasetNode } from './dataset';
import { VersioningNode } from './versioning';
import { PreprocessingNode } from './preprocessing';
import { TrainingNode } from './training';
import { ExperimentNode } from './experiment';
import { ReportNode } from './report';

export const nodeTypes = {
  dataset: DatasetNode,
  versioning: VersioningNode,
  preprocessing: PreprocessingNode,
  training: TrainingNode,
  experiment: ExperimentNode,
  report: ReportNode,
};
