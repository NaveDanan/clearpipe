import { create } from 'zustand';
import {
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
} from '@xyflow/react';
import {
  Pipeline,
  PipelineNode,
  PipelineEdge,
  PipelineNodeData,
  NodeStatus,
} from '@/types/pipeline';

interface PipelineState {
  // Current pipeline data
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  
  // Selected node for configuration panel
  selectedNodeId: string | null;
  
  // Pipeline metadata
  currentPipeline: Pipeline | null;
  savedPipelines: Pipeline[];
  
  // UI State
  isConfigPanelOpen: boolean;
  isDirty: boolean;
  isLoading: boolean;
  
  // Node actions
  onNodesChange: OnNodesChange<PipelineNode>;
  onEdgesChange: OnEdgesChange<PipelineEdge>;
  onConnect: OnConnect;
  
  // CRUD operations
  addNode: (type: PipelineNodeData['type'], position: { x: number; y: number }) => string;
  updateNodeData: (nodeId: string, data: Partial<PipelineNodeData>) => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus, message?: string) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  
  // Selection
  selectNode: (nodeId: string | null) => void;
  
  // Pipeline operations
  fetchPipelines: () => Promise<void>;
  savePipeline: (name: string, description?: string) => Promise<void>;
  loadPipeline: (pipelineId: string) => Promise<void>;
  createNewPipeline: () => void;
  deletePipeline: (pipelineId: string) => Promise<void>;
  exportPipeline: () => string;
  importPipeline: (jsonString: string) => boolean;
  
  // UI actions
  setConfigPanelOpen: (open: boolean) => void;
  
  // Reset
  reset: () => void;
}

// Default node configurations
const getDefaultNodeData = (type: PipelineNodeData['type']): PipelineNodeData => {
  const baseData = {
    status: 'idle' as NodeStatus,
    lastUpdated: new Date().toISOString(),
  };

  switch (type) {
    case 'dataset':
      return {
        ...baseData,
        type: 'dataset',
        label: 'Dataset',
        description: 'Load and configure your data source',
        config: {
          source: 'local',
          path: '',
          format: 'csv',
        },
      };
    case 'versioning':
      return {
        ...baseData,
        type: 'versioning',
        label: 'Data Versioning',
        description: 'Version your data and models',
        config: {
          tool: 'dvc',
          version: '1.0.0',
        },
      };
    case 'execute':
      return {
        ...baseData,
        type: 'execute',
        label: 'Execute',
        description: 'Transform and prepare your data',
        config: {
          steps: [],
        },
      };
    case 'training':
      return {
        ...baseData,
        type: 'training',
        label: 'Model Training',
        description: 'Train your ML model',
        config: {
          framework: 'pytorch',
          cloudProvider: 'local',
          instanceType: 'local',
          instanceConfig: {},
          credentials: {},
          hyperparameters: {},
        },
      };
    case 'experiment':
      return {
        ...baseData,
        type: 'experiment',
        label: 'Experiment Tracking',
        description: 'Track experiments and metrics',
        config: {
          tracker: 'clearml',
          projectName: '',
          experimentName: '',
          credentials: {},
          logMetrics: true,
          logArtifacts: true,
          logHyperparameters: true,
        },
      };
    case 'report':
      return {
        ...baseData,
        type: 'report',
        label: 'Model Report',
        description: 'Generate model report and documentation',
        config: {
          title: 'Model Report',
          includeMetrics: true,
          includeVisualizations: true,
          includeModelCard: true,
          outputFormat: 'html',
        },
      };
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
};

// Nanoid polyfill for browser
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const usePipelineStore = create<PipelineState>()((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  currentPipeline: null,
  savedPipelines: [],
  isConfigPanelOpen: false,
  isDirty: false,
  isLoading: false,

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as PipelineNode[],
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges) as PipelineEdge[],
      isDirty: true,
    });
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: true,
        },
        get().edges
      ) as PipelineEdge[],
      isDirty: true,
    });
  },

  addNode: (type, position) => {
    const id = generateId();
    const newNode: PipelineNode = {
      id,
      type,
      position,
      data: getDefaultNodeData(type),
    };

    set({
      nodes: [...get().nodes, newNode],
      isDirty: true,
    });

    return id;
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...data,
                lastUpdated: new Date().toISOString(),
              } as PipelineNodeData,
            }
          : node
      ),
      isDirty: true,
    });
  },

  updateNodeStatus: (nodeId, status, message) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                status,
                statusMessage: message,
                lastUpdated: new Date().toISOString(),
              } as PipelineNodeData,
            }
          : node
      ),
    });
  },

  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      isDirty: true,
    });
  },

  duplicateNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const newId = generateId();
    const newNode: PipelineNode = {
      ...node,
      id: newId,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
      data: {
        ...node.data,
        label: `${node.data.label} (copy)`,
      } as PipelineNodeData,
    };

    set({
      nodes: [...get().nodes, newNode],
      isDirty: true,
    });
  },

  selectNode: (nodeId) => {
    set({
      selectedNodeId: nodeId,
      isConfigPanelOpen: nodeId !== null,
    });
  },

  fetchPipelines: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/pipelines');
      if (!response.ok) throw new Error('Failed to fetch pipelines');
      const pipelines = await response.json();
      set({ savedPipelines: pipelines });
    } catch (error) {
      console.error('Error fetching pipelines:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  savePipeline: async (name, description) => {
    const { nodes, edges, currentPipeline } = get();
    const now = new Date().toISOString();

    const pipelineData = {
      id: currentPipeline?.id,
      name,
      description,
      nodes,
      edges,
      version: '1.0.0',
    };

    try {
      const response = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipelineData),
      });

      if (!response.ok) throw new Error('Failed to save pipeline');

      const savedPipeline = await response.json();
      
      // Update local state
      const { savedPipelines } = get();
      const existingIndex = savedPipelines.findIndex((p) => p.id === savedPipeline.id);
      const updatedPipelines =
        existingIndex >= 0
          ? savedPipelines.map((p, i) => (i === existingIndex ? savedPipeline : p))
          : [...savedPipelines, savedPipeline];

      set({
        currentPipeline: savedPipeline,
        savedPipelines: updatedPipelines,
        isDirty: false,
      });
    } catch (error) {
      console.error('Error saving pipeline:', error);
      throw error;
    }
  },

  loadPipeline: async (pipelineId) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}`);
      if (!response.ok) throw new Error('Failed to load pipeline');
      
      const pipeline = await response.json();
      
      set({
        nodes: pipeline.nodes,
        edges: pipeline.edges,
        currentPipeline: pipeline,
        selectedNodeId: null,
        isConfigPanelOpen: false,
        isDirty: false,
      });
    } catch (error) {
      console.error('Error loading pipeline:', error);
      // Fallback to local state
      const pipeline = get().savedPipelines.find((p) => p.id === pipelineId);
      if (pipeline) {
        set({
          nodes: pipeline.nodes,
          edges: pipeline.edges,
          currentPipeline: pipeline,
          selectedNodeId: null,
          isConfigPanelOpen: false,
          isDirty: false,
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  createNewPipeline: () => {
    set({
      nodes: [],
      edges: [],
      currentPipeline: null,
      selectedNodeId: null,
      isConfigPanelOpen: false,
      isDirty: false,
    });
  },

  deletePipeline: async (pipelineId) => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete pipeline');

      set({
        savedPipelines: get().savedPipelines.filter((p) => p.id !== pipelineId),
        currentPipeline:
          get().currentPipeline?.id === pipelineId ? null : get().currentPipeline,
      });
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      throw error;
    }
  },

  exportPipeline: () => {
    const { nodes, edges, currentPipeline } = get();
    const exportData = {
      ...currentPipeline,
      nodes,
      edges,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(exportData, null, 2);
  },

  importPipeline: (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.nodes && data.edges) {
        set({
          nodes: data.nodes,
          edges: data.edges,
          currentPipeline: data.id ? data : null,
          isDirty: true,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  setConfigPanelOpen: (open) => {
    set({ isConfigPanelOpen: open });
  },

  reset: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      currentPipeline: null,
      isConfigPanelOpen: false,
      isDirty: false,
    });
  },
}));
