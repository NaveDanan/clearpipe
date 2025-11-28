import { readDatabase, writeDatabase } from './index';
import type { SecretRow, ConnectionRow, PipelineRow } from './index';

// Re-export types
export type { SecretRow, ConnectionRow, PipelineRow };

// Generate unique ID
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// ============================================================================
// Secrets Repository
// ============================================================================
export const secretsRepository = {
  async getAll(): Promise<SecretRow[]> {
    const db = readDatabase();
    return [...db.secrets].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getById(id: string): Promise<SecretRow | undefined> {
    const db = readDatabase();
    return db.secrets.find(s => s.id === id);
  },

  async getByProvider(provider: string): Promise<SecretRow[]> {
    const db = readDatabase();
    return db.secrets
      .filter(s => s.provider === provider)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async create(data: { name: string; provider: string; value: string }): Promise<SecretRow> {
    const db = readDatabase();
    const now = new Date().toISOString();
    
    const secret: SecretRow = {
      id: generateId(),
      name: data.name,
      provider: data.provider,
      value: data.value,
      created_at: now,
      updated_at: now,
    };
    
    db.secrets.push(secret);
    writeDatabase(db);
    
    return secret;
  },

  async update(id: string, data: Partial<{ name: string; provider: string; value: string }>): Promise<SecretRow | undefined> {
    const db = readDatabase();
    const index = db.secrets.findIndex(s => s.id === id);
    
    if (index === -1) return undefined;
    
    const now = new Date().toISOString();
    const secret = db.secrets[index];
    
    if (data.name !== undefined) secret.name = data.name;
    if (data.provider !== undefined) secret.provider = data.provider;
    if (data.value !== undefined) secret.value = data.value;
    secret.updated_at = now;
    
    writeDatabase(db);
    
    return secret;
  },

  async delete(id: string): Promise<boolean> {
    const db = readDatabase();
    const index = db.secrets.findIndex(s => s.id === id);
    
    if (index === -1) return false;
    
    db.secrets.splice(index, 1);
    writeDatabase(db);
    
    return true;
  },
};

// ============================================================================
// Connections Repository
// ============================================================================
export const connectionsRepository = {
  async getAll(): Promise<ConnectionRow[]> {
    const db = readDatabase();
    return [...db.connections].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getById(id: string): Promise<ConnectionRow | undefined> {
    const db = readDatabase();
    return db.connections.find(c => c.id === id);
  },

  async getByProvider(provider: string): Promise<ConnectionRow[]> {
    const db = readDatabase();
    return db.connections
      .filter(c => c.provider === provider)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async create(data: { name: string; provider: string; config: Record<string, unknown>; isConfigured: boolean }): Promise<ConnectionRow> {
    const db = readDatabase();
    const now = new Date().toISOString();
    
    const connection: ConnectionRow = {
      id: generateId(),
      name: data.name,
      provider: data.provider,
      config: JSON.stringify(data.config),
      is_configured: data.isConfigured ? 1 : 0,
      created_at: now,
      updated_at: now,
    };
    
    db.connections.push(connection);
    writeDatabase(db);
    
    return connection;
  },

  async update(id: string, data: Partial<{ name: string; provider: string; config: Record<string, unknown>; isConfigured: boolean }>): Promise<ConnectionRow | undefined> {
    const db = readDatabase();
    const index = db.connections.findIndex(c => c.id === id);
    
    if (index === -1) return undefined;
    
    const now = new Date().toISOString();
    const connection = db.connections[index];
    
    if (data.name !== undefined) connection.name = data.name;
    if (data.provider !== undefined) connection.provider = data.provider;
    if (data.config !== undefined) connection.config = JSON.stringify(data.config);
    if (data.isConfigured !== undefined) connection.is_configured = data.isConfigured ? 1 : 0;
    connection.updated_at = now;
    
    writeDatabase(db);
    
    return connection;
  },

  async delete(id: string): Promise<boolean> {
    const db = readDatabase();
    const index = db.connections.findIndex(c => c.id === id);
    
    if (index === -1) return false;
    
    db.connections.splice(index, 1);
    writeDatabase(db);
    
    return true;
  },
};

// ============================================================================
// Pipelines Repository
// ============================================================================
export const pipelinesRepository = {
  async getAll(): Promise<PipelineRow[]> {
    const db = readDatabase();
    return [...db.pipelines].sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  },

  async getById(id: string): Promise<PipelineRow | undefined> {
    const db = readDatabase();
    return db.pipelines.find(p => p.id === id);
  },

  async create(data: { 
    name: string; 
    description?: string; 
    nodes: unknown[]; 
    edges: unknown[]; 
    version?: string;
  }): Promise<PipelineRow> {
    const db = readDatabase();
    const now = new Date().toISOString();
    
    const pipeline: PipelineRow = {
      id: generateId(),
      name: data.name,
      description: data.description || null,
      nodes: JSON.stringify(data.nodes),
      edges: JSON.stringify(data.edges),
      version: data.version || '1.0.0',
      created_at: now,
      updated_at: now,
    };
    
    db.pipelines.push(pipeline);
    writeDatabase(db);
    
    return pipeline;
  },

  async update(id: string, data: Partial<{ 
    name: string; 
    description: string; 
    nodes: unknown[]; 
    edges: unknown[]; 
    version: string;
  }>): Promise<PipelineRow | undefined> {
    const db = readDatabase();
    const index = db.pipelines.findIndex(p => p.id === id);
    
    if (index === -1) return undefined;
    
    const now = new Date().toISOString();
    const pipeline = db.pipelines[index];
    
    if (data.name !== undefined) pipeline.name = data.name;
    if (data.description !== undefined) pipeline.description = data.description;
    if (data.nodes !== undefined) pipeline.nodes = JSON.stringify(data.nodes);
    if (data.edges !== undefined) pipeline.edges = JSON.stringify(data.edges);
    if (data.version !== undefined) pipeline.version = data.version;
    pipeline.updated_at = now;
    
    writeDatabase(db);
    
    return pipeline;
  },

  async upsert(data: { 
    id?: string;
    name: string; 
    description?: string; 
    nodes: unknown[]; 
    edges: unknown[]; 
    version?: string;
  }): Promise<PipelineRow> {
    if (data.id) {
      const existing = await this.getById(data.id);
      if (existing) {
        return (await this.update(data.id, data)) as PipelineRow;
      }
    }
    return this.create(data);
  },

  async delete(id: string): Promise<boolean> {
    const db = readDatabase();
    const index = db.pipelines.findIndex(p => p.id === id);
    
    if (index === -1) return false;
    
    db.pipelines.splice(index, 1);
    writeDatabase(db);
    
    return true;
  },
};
