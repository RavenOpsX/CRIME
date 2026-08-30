import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dataset, AISettings } from '@/types';
import { generateDataset } from '@/data/generateDataset';
import { analyze } from '@/analytics/detection';
import { datasetApi, settingsApi } from '@/services/api';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'mock',
  endpoint: '',
  model: '',
  apiKey: '',
};

// Generate a unique ID for datasets
function generateDatasetId(): string {
  return `dataset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useDataset() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const initialized = useRef(false);
  const currentDatasetId = useRef<string | null>(null);

  // Check if API is available on mount
  useEffect(() => {
    const checkApi = async () => {
      try {
        await datasetApi.getAll();
        setApiAvailable(true);
      } catch (error) {
        console.warn('API not available, falling back to localStorage:', error);
        setApiAvailable(false);
      }
    };
    checkApi();
  }, []);

  // Load data from API or localStorage
  useEffect(() => {
    if (apiAvailable === null) return; // Still checking
    
    const loadData = async () => {
      try {
        if (apiAvailable) {
          // Load from API
          const datasets = await datasetApi.getAll();
          if (datasets.length > 0) {
            // Get the most recently updated dataset
            const latest = datasets[0];
            const datasetData = await datasetApi.getById(latest.id);
            setDataset(datasetData.data);
            currentDatasetId.current = latest.id;
          }
          
          const storedSettings = await settingsApi.get();
          setSettings(storedSettings);
        } else {
          // Fallback to localStorage
          const DATASET_KEY = 'sih-criminal-network-dataset';
          const SETTINGS_KEY = 'sih-ai-settings';
          
          const stored = localStorage.getItem(DATASET_KEY);
          if (stored) {
            setDataset(JSON.parse(stored));
          }
          const storedSettings = localStorage.getItem(SETTINGS_KEY);
          if (storedSettings) {
            setSettings(JSON.parse(storedSettings));
          }
        }
      } catch (e) {
        console.error('Failed to load stored data', e);
      }
      setLoading(false);
      initialized.current = true;
    };
    
    loadData();
  }, [apiAvailable]);

  const persistDataset = useCallback(async (ds: Dataset) => {
    try {
      if (apiAvailable) {
        // Use API
        if (!currentDatasetId.current) {
          currentDatasetId.current = generateDatasetId();
        }
        await datasetApi.upsert(currentDatasetId.current, 'Investigation Dataset', ds);
      } else {
        // Fallback to localStorage
        const DATASET_KEY = 'sih-criminal-network-dataset';
        localStorage.setItem(DATASET_KEY, JSON.stringify(ds));
      }
    } catch (e) {
      console.error('Failed to persist dataset', e);
    }
  }, [apiAvailable]);

  const persistSettings = useCallback(async (s: AISettings) => {
    try {
      if (apiAvailable) {
        await settingsApi.update(s);
      } else {
        const SETTINGS_KEY = 'sih-ai-settings';
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      }
    } catch (e) {
      console.error('Failed to persist settings', e);
    }
  }, [apiAvailable]);

  const loadDemoData = useCallback(() => {
    setAnalyzing(true);
    setTimeout(async () => {
      const ds = generateDataset();
      ds.metadata.lastAnalyzed = new Date().toISOString();
      setDataset(ds);
      await persistDataset(ds);
      setAnalyzing(false);
    }, 800);
  }, [persistDataset]);

  const analyzeNetwork = useCallback(() => {
    if (!dataset) return;
    setAnalyzing(true);
    setTimeout(async () => {
      const updated = { ...dataset, metadata: { ...dataset.metadata, lastAnalyzed: new Date().toISOString() } };
      setDataset(updated);
      await persistDataset(updated);
      setAnalyzing(false);
    }, 800);
  }, [dataset, persistDataset]);

  const resetDataset = useCallback(async () => {
    if (apiAvailable && currentDatasetId.current) {
      try {
        await datasetApi.delete(currentDatasetId.current);
      } catch (e) {
        console.error('Failed to delete dataset from API', e);
      }
    } else {
      const DATASET_KEY = 'sih-criminal-network-dataset';
      localStorage.removeItem(DATASET_KEY);
    }
    currentDatasetId.current = null;
    setDataset(null);
  }, [apiAvailable]);

  const updateSettings = useCallback(async (s: AISettings) => {
    setSettings(s);
    await persistSettings(s);
  }, [persistSettings]);

  const mergeCSVData = useCallback((newData: Partial<Dataset>) => {
    setAnalyzing(true);
    setTimeout(async () => {
      let merged: Dataset;
      if (!dataset) {
        const ds = generateDataset();
        Object.assign(ds, newData);
        ds.metadata.source = 'csv';
        merged = ds;
      } else {
        merged = {
          ...dataset,
          ...newData,
          metadata: { ...dataset.metadata, source: 'csv' as const, lastAnalyzed: null },
        };
      }

      // Re-run the real detection engine on merged data
      try {
        const result = analyze(merged);
        merged.clusters = result.clusters;
        merged.anomalies = result.anomalies;
        merged.analysisResult = {
          attentionScores: result.scores,
          topInfluencers: result.topInfluencers,
          modularityScore: result.signals.modularityScore,
        };
        // Apply real scores back to entities
        for (const entity of merged.entities) {
          const scoreData = result.scores.get(entity.id);
          if (scoreData) entity.attentionScore = scoreData.score;
        }
        // Assign cluster IDs
        result.clusters.forEach(cluster => {
          cluster.entities.forEach(eid => {
            const entity = merged.entities.find(e => e.id === eid);
            if (entity) entity.clusterId = cluster.id;
          });
        });
        merged.metadata.lastAnalyzed = new Date().toISOString();
      } catch (e) {
        console.error('Detection analysis failed after merge:', e);
        merged.metadata.lastAnalyzed = new Date().toISOString();
      }

      setDataset(merged);
      await persistDataset(merged);
      setAnalyzing(false);
    }, 100);
  }, [dataset, persistDataset]);

  // Return apiAvailable as well for debugging/UI purposes
  return {
    dataset,
    settings,
    loading,
    analyzing,
    apiAvailable,
    loadDemoData,
    analyzeNetwork,
    resetDataset,
    updateSettings,
    mergeCSVData,
  };
}
