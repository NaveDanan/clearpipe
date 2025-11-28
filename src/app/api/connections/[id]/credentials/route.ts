import { NextRequest, NextResponse } from 'next/server';
import { connectionsRepository, secretsRepository } from '@/lib/db/repositories';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/connections/[id]/credentials - Get resolved credentials for a connection
// This resolves secret references to their actual values (for backend use)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const connection = await connectionsRepository.getById(id);
    
    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }
    
    const config = JSON.parse(connection.config);
    const credentials: Record<string, string> = {};
    
    // Resolve all secret references in the config
    const resolveSecret = async (secretId: string | undefined): Promise<string> => {
      if (!secretId) return '';
      const secret = await secretsRepository.getById(secretId);
      return secret?.value || '';
    };
    
    switch (connection.provider) {
      case 'aws':
        if (config.accessKeySecretId) {
          credentials.accessKey = await resolveSecret(config.accessKeySecretId);
        }
        if (config.secretKeySecretId) {
          credentials.secretKey = await resolveSecret(config.secretKeySecretId);
        }
        if (config.region) credentials.region = config.region;
        if (config.bucket) credentials.bucket = config.bucket;
        break;
        
      case 'gcp':
        if (config.projectId) credentials.projectId = config.projectId;
        if (config.bucket) credentials.bucket = config.bucket;
        if (config.serviceAccountKeySecretId) {
          credentials.serviceAccountKey = await resolveSecret(config.serviceAccountKeySecretId);
        }
        break;
        
      case 'azure':
        if (config.subscriptionId) credentials.subscriptionId = config.subscriptionId;
        if (config.tenantId) credentials.tenantId = config.tenantId;
        if (config.clientId) credentials.clientId = config.clientId;
        if (config.accountName) credentials.accountName = config.accountName;
        if (config.container) credentials.container = config.container;
        if (config.clientSecretSecretId) {
          credentials.clientSecret = await resolveSecret(config.clientSecretSecretId);
        }
        if (config.connectionStringSecretId) {
          credentials.connectionString = await resolveSecret(config.connectionStringSecretId);
        }
        if (config.accountKeySecretId) {
          credentials.accountKey = await resolveSecret(config.accountKeySecretId);
        }
        if (config.sasTokenSecretId) {
          credentials.sasToken = await resolveSecret(config.sasTokenSecretId);
        }
        break;
        
      case 'minio':
        if (config.endpoint) credentials.endpoint = config.endpoint;
        if (config.bucket) credentials.bucket = config.bucket;
        if (config.accessKeySecretId) {
          credentials.accessKey = await resolveSecret(config.accessKeySecretId);
        }
        if (config.secretKeySecretId) {
          credentials.secretKey = await resolveSecret(config.secretKeySecretId);
        }
        break;
        
      case 'clearml':
        if (config.apiHost) credentials.apiHost = config.apiHost;
        if (config.webHost) credentials.webHost = config.webHost;
        if (config.filesHost) credentials.filesHost = config.filesHost;
        if (config.accessKeySecretId) {
          credentials.accessKey = await resolveSecret(config.accessKeySecretId);
        }
        if (config.secretKeySecretId) {
          credentials.secretKey = await resolveSecret(config.secretKeySecretId);
        }
        break;
    }
    
    return NextResponse.json(credentials);
  } catch (error) {
    console.error('Error fetching connection credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connection credentials' },
      { status: 500 }
    );
  }
}
