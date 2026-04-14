/**
 * API Keys Service - Manage API keys for external integrations
 */

import api from './api';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: {
    rooms?: {
      create?: boolean;
      read?: boolean;
      update?: boolean;
      delete?: boolean;
    };
  };
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string; // Only available on creation/regeneration
}

export interface CreateApiKeyRequest {
  name: string;
  permissions?: {
    rooms?: {
      create?: boolean;
      read?: boolean;
      update?: boolean;
      delete?: boolean;
    };
  };
  expires_in_days?: number;
}

export interface UpdateApiKeyRequest {
  name?: string;
  permissions?: {
    rooms?: {
      create?: boolean;
      read?: boolean;
      update?: boolean;
      delete?: boolean;
    };
  };
  is_active?: boolean;
}

export const apiKeysApi = {
  /**
   * List all API keys for current user
   */
  list: () => {
    return api.get<{ keys: ApiKey[] }>('/api-keys');
  },

  /**
   * Get a single API key by ID
   */
  get: (id: string) => {
    return api.get<{ key: ApiKey }>(`/api-keys/${id}`);
  },

  /**
   * Create a new API key
   * Returns the full key (only time it's visible)
   */
  create: (data: CreateApiKeyRequest) => {
    return api.post<ApiKeyWithSecret>('/api-keys', data);
  },

  /**
   * Update an API key
   */
  update: (id: string, data: UpdateApiKeyRequest) => {
    return api.patch<{ success: boolean; message: string }>(`/api-keys/${id}`, data);
  },

  /**
   * Delete an API key
   */
  delete: (id: string) => {
    return api.delete<{ success: boolean; message: string }>(`/api-keys/${id}`);
  },

  /**
   * Regenerate an API key (invalidates old one)
   * Returns the new full key (only time it's visible)
   */
  regenerate: (id: string) => {
    return api.post<ApiKeyWithSecret>(`/api-keys/${id}/regenerate`);
  },
};
