import { createContext, useContext } from 'react';
import type { Dataset, AISettings } from '@/types';

export interface DatasetContextValue {
  dataset: Dataset | null;
  settings: AISettings;
  loading: boolean;
  analyzing: boolean;
  apiAvailable: boolean | null;
  loadDemoData: () => void;
  analyzeNetwork: () => void;
  resetDataset: () => void;
  updateSettings: (s: AISettings) => void;
  mergeCSVData: (newData: Partial<Dataset>) => void;
}

export const DatasetContext = createContext<DatasetContextValue | null>(null);

export function useDatasetContext(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error('useDatasetContext must be used within DatasetProvider');
  return ctx;
}
