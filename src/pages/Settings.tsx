import { useState, useRef } from 'react';
import { Settings as SettingsIcon, Database, Sparkles, Upload, Trash2, Play, Check, X, Loader2, FileWarning } from 'lucide-react';
import { useDatasetContext } from '@/hooks/useDatasetContext';
import type { AISettings, Dataset, Person, CDR, Transaction, FIR, Location as LocType, Vehicle } from '@/types';
import Papa from 'papaparse';

export function SettingsPage() {
  const { dataset, settings, updateSettings, loadDemoData, resetDataset, mergeCSVData, analyzing } = useDatasetContext();
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvUploaded, setCsvUploaded] = useState<Record<string, any[]>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const saveSettings = () => {
    updateSettings(localSettings);
  };

  const testConnection = async () => {
    setTesting(true);
    // Save first so context is up to date
    updateSettings(localSettings);
    const { testConnection: test } = await import('@/services/aiService');
    const result = await test(localSettings);
    setTestResult(result);
    setTesting(false);
  };

  const handleCSVUpload = (files: FileList | null) => {
    if (!files) return;
    setCsvErrors([]);
    const uploaded: Record<string, any[]> = {};

    Array.from(files).forEach(file => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const fileName = file.name.replace('.csv', '');
          const errors: string[] = [];

          if (results.errors.length > 0) {
            errors.push(`${file.name}: ${results.errors.map(e => e.message).join(', ')}`);
          }

          const data = results.data as any[];
          if (data.length === 0) {
            errors.push(`${file.name}: No data rows found`);
          }

          // Validate required columns based on file name
          const requiredCols: Record<string, string[]> = {
            persons: ['id', 'name'],
            cdr: ['caller', 'receiver', 'timestamp'],
            transactions: ['sender', 'receiver', 'amount', 'timestamp'],
            locations: ['id', 'name'],
            firs: ['id', 'title'],
            vehicles: ['id', 'type'],
          };

          const matchKey = Object.keys(requiredCols).find(k => fileName.toLowerCase().includes(k));
          if (matchKey && data.length > 0) {
            const cols = Object.keys(data[0]);
            const missing = requiredCols[matchKey].filter(c => !cols.includes(c));
            if (missing.length > 0) {
              errors.push(`${file.name}: Missing required columns: ${missing.join(', ')}`);
            }
          }

          if (errors.length > 0) {
            setCsvErrors(prev => [...prev, ...errors]);
          } else {
            uploaded[matchKey ?? fileName] = data;
            setCsvUploaded(prev => ({ ...prev, ...uploaded }));
          }
        },
        error: (err) => {
          setCsvErrors(prev => [...prev, `${file.name}: ${err.message}`]);
        },
      });
    });
  };

  const processCSV = () => {
    const partial: Partial<Dataset> = {};
    if (csvUploaded.persons) {
      partial.persons = csvUploaded.persons.map((p: any) => ({
        id: p.id, name: p.name, age: Number(p.age) || 0,
        gender: (p.gender === 'male' ? 'male' : 'female') as Person['gender'],
        occupation: p.occupation ?? '', address: p.address ?? '',
      }));
    }
    if (csvUploaded.cdr) {
      partial.cdrs = csvUploaded.cdr.map((c: any) => ({
        id: c.id ?? `CDR-${Math.random()}`, caller: c.caller, receiver: c.receiver,
        timestamp: c.timestamp, duration: Number(c.duration) || 0,
        location: c.location ?? '', callType: (c.callType ?? 'outgoing') as CDR['callType'],
      }));
    }
    if (csvUploaded.transactions) {
      partial.transactions = csvUploaded.transactions.map((t: any) => ({
        id: t.id ?? `TXN-${Math.random()}`, sender: t.sender, receiver: t.receiver,
        amount: Number(t.amount) || 0, timestamp: t.timestamp,
        location: t.location ?? '', transactionType: (t.transactionType ?? 'transfer') as Transaction['transactionType'],
      }));
    }
    if (csvUploaded.locations) {
      partial.locations = csvUploaded.locations.map((l: any) => ({
        id: l.id, name: l.name, type: l.type ?? 'unknown',
      }));
    }
    if (csvUploaded.firs) {
      partial.firs = csvUploaded.firs.map((f: any) => ({
        id: f.id, title: f.title, date: f.date ?? new Date().toISOString(),
        section: f.section ?? '', status: (f.status ?? 'open') as FIR['status'],
        entities: f.entities ? f.entities.split(',').map((s: string) => s.trim()) : [],
      }));
    }
    if (csvUploaded.vehicles) {
      partial.vehicles = csvUploaded.vehicles.map((v: any) => ({
        id: v.id, type: v.type, owner: v.owner ?? '', registration: v.registration ?? '',
      }));
    }
    mergeCSVData(partial);
    setCsvUploaded({});
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon className="w-5 h-5 text-gray-400" />
          <h1 className="text-xl font-semibold text-white">Settings</h1>
        </div>
        <p className="text-sm text-gray-500">Configure dataset and AI provider settings</p>
      </div>

      {/* Dataset section */}
      <div className="solid-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-accent-400" />
          <h2 className="text-sm font-semibold text-gray-200">Dataset</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-900 border border-ink-700">
            <div>
              <div className="text-sm text-gray-200">Load Demo Data</div>
              <div className="text-xs text-gray-500">Load the built-in synthetic investigation dataset</div>
            </div>
            <button onClick={loadDemoData} disabled={analyzing} className="btn-primary text-sm inline-flex items-center gap-2">
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {analyzing ? 'Processing...' : 'Load'}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-ink-900 border border-ink-700">
            <div>
              <div className="text-sm text-gray-200">Reset Dataset</div>
              <div className="text-xs text-gray-500">Clear all loaded data from local storage</div>
            </div>
            <button onClick={resetDataset} className="btn-secondary text-sm inline-flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" /> Reset
            </button>
          </div>

          <div className="p-3 rounded-lg bg-ink-900 border border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm text-gray-200">Upload CSV</div>
                <div className="text-xs text-gray-500">Upload synthetic CSV datasets (persons, cdr, transactions, locations, firs, vehicles)</div>
              </div>
              <Upload className="w-4 h-4 text-gray-500" />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              multiple
              onChange={e => handleCSVUpload(e.target.files)}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="btn-secondary text-sm inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Select Files
            </label>

            {csvErrors.length > 0 && (
              <div className="mt-3 space-y-1">
                {csvErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-signal-red">
                    <FileWarning className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {err}
                  </div>
                ))}
              </div>
            )}

            {Object.keys(csvUploaded).length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-signal-green flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  {Object.keys(csvUploaded).length} file(s) ready to process:
                </div>
                {Object.entries(csvUploaded).map(([key, rows]) => (
                  <div key={key} className="text-xs text-gray-400 pl-5">
                    {key}: {rows.length} rows
                  </div>
                ))}
                <button onClick={processCSV} className="btn-primary text-sm inline-flex items-center gap-2 mt-1">
                  <Play className="w-3.5 h-3.5" /> Process Dataset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI section */}
      <div className="solid-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-accent-400" />
          <h2 className="text-sm font-semibold text-gray-200">AI Configuration</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Provider</label>
            <select
              value={localSettings.provider}
              onChange={e => setLocalSettings({ ...localSettings, provider: e.target.value as AISettings['provider'] })}
              className="input-field text-sm"
            >
              <option value="mock">Mock (Default — no API needed)</option>
              <option value="openai">OpenAI-compatible</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="custom">Custom Endpoint</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Model Name</label>
            <input
              type="text"
              value={localSettings.model}
              onChange={e => setLocalSettings({ ...localSettings, model: e.target.value })}
              placeholder="e.g. gpt-4, llama3, mistral"
              className="input-field text-sm font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">API Endpoint</label>
            <input
              type="text"
              value={localSettings.endpoint}
              onChange={e => setLocalSettings({ ...localSettings, endpoint: e.target.value })}
              placeholder="https://api.openai.com/v1 or http://localhost:11434"
              className="input-field text-sm font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">API Key</label>
            <input
              type="password"
              value={localSettings.apiKey}
              onChange={e => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
              placeholder="sk-... (stored locally, never exposed)"
              className="input-field text-sm font-mono"
            />
            <p className="text-[10px] text-gray-600 mt-1">API keys are stored in browser local storage only and are not sent anywhere in this prototype.</p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button onClick={saveSettings} className="btn-primary text-sm inline-flex items-center gap-2">
              <Check className="w-3.5 h-3.5" /> Save Settings
            </button>
            <button onClick={testConnection} disabled={testing} className="btn-secondary text-sm inline-flex items-center gap-2">
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Test Connection
            </button>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
              testResult.success ? 'bg-signal-green/10 text-signal-green border border-signal-green/20' : 'bg-signal-red/10 text-signal-red border border-signal-red/20'
            }`}>
              {testResult.success ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Current dataset info */}
      {dataset && (
        <div className="solid-panel p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Current Dataset</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-gray-500">Source:</span> <span className="text-gray-200 capitalize">{dataset.metadata.source}</span></div>
            <div><span className="text-gray-500">Entities:</span> <span className="text-gray-200 font-mono">{dataset.entities.length}</span></div>
            <div><span className="text-gray-500">Relationships:</span> <span className="text-gray-200 font-mono">{dataset.relationships.length}</span></div>
            <div><span className="text-gray-500">Clusters:</span> <span className="text-gray-200 font-mono">{dataset.clusters.length}</span></div>
            <div><span className="text-gray-500">Anomalies:</span> <span className="text-gray-200 font-mono">{dataset.anomalies.length}</span></div>
            <div><span className="text-gray-500">CDRs:</span> <span className="text-gray-200 font-mono">{dataset.cdrs.length}</span></div>
            <div><span className="text-gray-500">Transactions:</span> <span className="text-gray-200 font-mono">{dataset.transactions.length}</span></div>
            <div><span className="text-gray-500">FIRs:</span> <span className="text-gray-200 font-mono">{dataset.firs.length}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
