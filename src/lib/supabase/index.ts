// Supabase client utilities
export { createClient } from './client';

// Server-side client
export { createClient as createServerClient } from './server';

// Auth utilities
export { getUser, requireAuth, signOut } from './auth';
export type { AuthUser } from './auth';

// Client-side auth hook
export { useAuth } from './use-auth';

// Storage utilities
export {
  uploadFile,
  downloadFile,
  getPublicUrl,
  getSignedUrl,
  listFiles,
  deleteFile,
  deleteFiles,
  moveFile,
  copyFile,
} from './storage';
export type { StorageBucket } from './storage';
