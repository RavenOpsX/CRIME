import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dataset, AISettings } from '@/types';
import { generateDataset } from '@/data/generateDataset';
import { analyze } from '@/analytics/detection';

const DATASET_KEY = 'sih-criminal-network-dataset';
const SETTINGS_KEY = 'sih-ai-settings';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'mock',
  endpoint: '',
  model: '',
  apiKey: '',
};

export function useDataset() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DATASET_KEY);
      if (stored) {
        setDataset(JSON.parse(stored));
      }
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }
    } catch (e) {
      console.error('Failed to load stored data', e);
    }
    setLoading(false);
    initialized.current = true;
  }, []);

  const persistDataset = useCallback((ds: Dataset) => {
    try {
      localStorage.setItem(DATASET_KEY, JSON.stringify(ds));
    } catch (e) {
      console.error('Failed to persist dataset', e);
    }
  }, []);

  const persistSettings = useCallback((s: AISettings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) {
      console.error('Failed to persist settings', e);
    }
  }, []);

  const loadDemoData = useCallback(() => {
    setAnalyzing(true);
    setTimeout(() => {
      const ds = generateDataset();
      ds.metadata.lastAnalyzed = new Date().toISOString();
      setDataset(ds);
      persistDataset(ds);
      setAnalyzing(false);
    }, 800);
  }, [persistDataset]);

  const analyzeNetwork = useCallback(() => {
    if (!dataset) return;
    setAnalyzing(true);
    setTimeout(() => {
      const updated = { ...dataset, metadata: { ...dataset.metadata, lastAnalyzed: new Date().toISOString() } };
      setDataset(updated);
      persistDataset(updated);
      setAnalyzing(false);
    }, 800);
  }, [dataset, persistDataset]);

  const resetDataset = useCallback(() => {
    localStorage.removeItem(DATASET_KEY);
    setDataset(null);
  }, []);

  const updateSettings = useCallback((s: AISettings) => {
    setSettings(s);
    persistSettings(s);
  }, [persistSettings]);

  const mergeCSVData = useCallback((newData: Partial<Dataset>) => {
    setAnalyzing(true);
    setTimeout(() => {
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
      persistDataset(merged);
      setAnalyzing(false);
    }, 100);
  }, [dataset, persistDataset]);

  return {
    dataset,
    settings,
    loading,
    analyzing,
    loadDemoData,
    analyzeNetwork,
    resetDataset,
    updateSettings,
    mergeCSVData,
  };
}
