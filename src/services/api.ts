import type { Dataset, AISettings } from '@/types';

const API_BASE_URL = 'http://localhost:3001/api';

// Generic fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

// ==================== Dataset API ====================

export const datasetApi = {
  // Get all datasets (list only)
  getAll: async (): Promise<{ id: string; name: string; created_at: string; updated_at: string }[]> => {
    return apiFetch('/datasets');
  },

  // Get dataset by ID
  getById: async (id: string): Promise<{ id: string; name: string; data: Dataset; created_at: string; updated_at: string }> => {
    return apiFetch(`/datasets/${id}`);
  },

  // Create or update dataset
  upsert: async (id: string, name: string, data: Dataset): Promise<{ id: string; name: string; updated_at: string }> => {
    return apiFetch('/datasets', {
      method: 'POST',
      body: JSON.stringify({ id, name, data }),
    });
  },

  // Delete dataset
  delete: async (id: string): Promise<{ success: boolean }> => {
    return apiFetch(`/datasets/${id}`, {
      method: 'DELETE',
    });
  },

  // Delete all datasets
  deleteAll: async (): Promise<{ success: boolean }> => {
    return apiFetch('/datasets', {
      method: 'DELETE',
    });
  },
};

// ==================== Settings API ====================

export const settingsApi = {
  // Get AI settings
  get: async (): Promise<AISettings> => {
    return apiFetch('/settings');
  },

  // Update AI settings
  update: async (settings: AISettings): Promise<AISettings> => {
    return apiFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

// ==================== Upload API ====================

export const uploadApi = {
  // Upload CSV file
  csv: async (file: File): Promise<{ fileName: string; content: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload/csv`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type - browser will set it with boundary for FormData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  },
};

// ==================== Health Check ====================

export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string }> => {
    return apiFetch('/health');
  },
};

export default {
  dataset: datasetApi,
  settings: settingsApi,
  upload: uploadApi,
  health: healthApi,
};
