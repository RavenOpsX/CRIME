import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import {
  Upload, FileText, Users, Phone, CreditCard, MapPin, Car,
  Building2, AlertTriangle, CheckCircle, ArrowRight, Trash2, Download,
} from 'lucide-react';
import { useDatasetContext } from '@/hooks/useDatasetContext';
import type {
  Person, Phone as PhoneType, BankAccount, Location, Vehicle, FIR, Organization,
  CDR, Transaction, LocationEvent, EntityType,
} from '@/types';
import { extractEntities, toDatasetFormat } from '@/analytics/nlpExtract';

type ImportTab = 'persons' | 'cdrs' | 'transactions' | 'locations' | 'vehicles' | 'firs' | 'json' | 'text';

const TABS: { key: ImportTab; label: string; icon: typeof Users }[] = [
  { key: 'persons', label: 'Persons', icon: Users },
  { key: 'cdrs', label: 'CDRs', icon: Phone },
  { key: 'transactions', label: 'Transactions', icon: CreditCard },
  { key: 'locations', label: 'Locations', icon: MapPin },
  { key: 'vehicles', label: 'Vehicles', icon: Car },
  { key: 'firs', label: 'FIRs', icon: FileText },
  { key: 'json', label: 'Full Dataset (JSON)', icon: Upload },
  { key: 'text', label: 'Analyze Text', icon: FileText },
];

const SAMPLE_CSV: Record<string, string> = {
  persons: `id,name,age,gender,occupation,address
P101,John Doe,35,male,Trader,Addr-101
P102,Jane Smith,28,female,Accountant,Addr-102`,
  cdrs: `id,caller,receiver,timestamp,duration,location,callType
CDR1001,P101,P102,2026-08-20T10:30:00.000Z,120,LOC-01,outgoing
CDR1002,P102,P101,2026-08-20T11:00:00.000Z,45,LOC-01,incoming`,
  transactions: `id,sender,receiver,amount,timestamp,location,transactionType
TXN1001,P101,P102,25000,2026-08-20T14:00:00.000Z,LOC-02,transfer
TXN1002,P103,P101,80000,2026-08-21T09:15:00.000Z,LOC-03,cash`,
  locations: `id,name,type
LOC-10,New Location,commercial
LOC-11,Remote Site,industrial`,
  vehicles: `id,type,owner,registration
VEH101,Sedan,P101,DL-10-AB-1234
VEH102,SUV,P102,DL-20-CD-5678`,
  firs: `id,title,date,section,status,entities
FIR-2026-100,Suspicious Activity,2026-08-15,Sec 302,open,P101;P102
FIR-2026-101,Financial Fraud,2026-08-10,Sec 420,under_investigation,P103;P104`,
};

interface ImportResult {
  success: boolean;
  message: string;
  count: number;
}

export function ImportData() {
  const { dataset, mergeCSVData, loadDemoData, analyzing } = useDatasetContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ImportTab>('persons');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [nlpResult, setNlpResult] = useState<ReturnType<typeof extractEntities> | null>(null);

  const handleFileUpload = useCallback((file: File) => {
    if (activeTab === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.entities && data.relationships) {
            mergeCSVData(data);
            setImportResult({ success: true, message: `Imported full dataset: ${data.entities.length} entities, ${data.relationships.length} relationships.`, count: data.entities.length });
          } else {
            setImportResult({ success: false, message: 'Invalid dataset format. Expected { entities: [], relationships: [] }', count: 0 });
          }
        } catch {
          setImportResult({ success: false, message: 'Invalid JSON file.', count: 0 });
        }
      };
      reader.readAsText(file);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as Record<string, string>[];
          const imported = processImport(activeTab, rows);
          mergeCSVData(imported);
          setImportResult({ success: true, message: `Imported ${rows.length} ${activeTab} records.`, count: rows.length });
        } catch (err) {
          setImportResult({ success: false, message: `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`, count: 0 });
        }
      },
      error: () => {
        setImportResult({ success: false, message: 'Failed to parse CSV file.', count: 0 });
      },
    });
  }, [activeTab, mergeCSVData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const downloadSample = () => {
    const csv = SAMPLE_CSV[activeTab];
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDataset = () => {
    if (!dataset) return;
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investigation-dataset-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white mb-1">Import Data</h1>
          <p className="text-sm text-gray-500">Upload CSV files or a full JSON dataset to add to the investigation</p>
        </div>
        <div className="flex items-center gap-2">
          {dataset && (
            <button onClick={exportDataset} className="btn-secondary inline-flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export Current
            </button>
          )}
          {!dataset && (
            <button onClick={loadDemoData} disabled={analyzing} className="btn-primary inline-flex items-center gap-2 text-sm">
              {analyzing ? 'Processing...' : 'Load Demo Data First'}
            </button>
          )}
        </div>
      </div>

      {/* Current dataset status */}
      {dataset && (
        <div className="solid-panel p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-signal-green" />
            <span className="text-sm text-gray-200 font-medium">Dataset Active</span>
            <span className="badge bg-signal-green/15 text-signal-green">Source: {dataset.metadata.source}</span>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3 text-center">
            {[
              { label: 'Persons', count: dataset.persons.length },
              { label: 'CDRs', count: dataset.cdrs.length },
              { label: 'Transactions', count: dataset.transactions.length },
              { label: 'Locations', count: dataset.locations.length },
              { label: 'Vehicles', count: dataset.vehicles.length },
              { label: 'FIRs', count: dataset.firs.length },
              { label: 'Social Posts', count: dataset.socialMediaPosts.length },
              { label: 'Intel Reports', count: dataset.intelligenceReports.length },
            ].map(s => (
              <div key={s.label} className="p-2 rounded-lg bg-ink-900 border border-ink-700">
                <div className="text-lg font-bold text-white font-mono">{s.count}</div>
                <div className="text-[10px] text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab selector */}
      <div className="flex items-center gap-1 border-b border-ink-700 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setImportResult(null); }}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-accent-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`solid-panel p-8 text-center border-2 border-dashed transition-colors cursor-pointer ${
          dragOver ? 'border-accent-500 bg-accent-600/10' : 'border-ink-700 hover:border-ink-600'
        }`}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = activeTab === 'json' ? '.json' : '.csv';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFileUpload(file);
          };
          input.click();
        }}
      >
        <Upload className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-300 mb-1">
          Drag & drop a <span className="font-mono text-accent-400">{activeTab === 'json' ? '.json' : '.csv'}</span> file here
        </p>
        <p className="text-xs text-gray-500">or click to browse</p>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`solid-panel p-4 ${importResult.success ? 'border-signal-green/30 bg-signal-green/5' : 'border-signal-red/30 bg-signal-red/5'}`}>
          <div className="flex items-center gap-2">
            {importResult.success ? (
              <CheckCircle className="w-4 h-4 text-signal-green" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-signal-red" />
            )}
            <span className={`text-sm ${importResult.success ? 'text-signal-green' : 'text-signal-red'}`}>
              {importResult.message}
            </span>
          </div>
        </div>
      )}

      {/* Sample download + instructions */}
      {activeTab !== 'json' && (
        <div className="solid-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">Expected CSV Format</h3>
            <button onClick={downloadSample} className="text-xs text-accent-400 hover:text-accent-300 inline-flex items-center gap-1">
              <Download className="w-3 h-3" /> Download Sample
            </button>
          </div>
          <pre className="text-xs text-gray-400 bg-ink-950 rounded-lg p-3 overflow-x-auto font-mono border border-ink-700">
            {SAMPLE_CSV[activeTab]}
          </pre>
          <p className="text-xs text-gray-500 mt-2">
            {activeTab === 'persons' && 'Columns: id, name, age, gender, occupation, address. Persons will be added as entities and can be linked via relationships.'}
            {activeTab === 'cdrs' && 'Columns: id, caller, receiver, timestamp (ISO), duration (seconds), location (LOC-xx), callType (incoming/outgoing/missed). Caller and receiver must be existing person IDs.'}
            {activeTab === 'transactions' && 'Columns: id, sender, receiver, amount, timestamp (ISO), location (LOC-xx), transactionType (transfer/cash/cheque/upi). Sender and receiver must be existing person IDs.'}
            {activeTab === 'locations' && 'Columns: id (LOC-xx), name, type (commercial/residential/industrial/transit/remote).'}
            {activeTab === 'vehicles' && 'Columns: id (VEH-xxx), type, owner (person ID), registration.'}
            {activeTab === 'firs' && 'Columns: id, title, date (ISO), section, status (open/under_investigation/closed), entities (semicolon-separated person IDs).'}
          </p>
        </div>
      )}

      {/* JSON import instructions */}
      {activeTab === 'json' && (
        <div className="solid-panel p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Full Dataset JSON Format</h3>
          <p className="text-xs text-gray-400 mb-3">
            Upload a complete dataset JSON file exported from this system. The file should contain all entity types,
            relationships, CDRs, transactions, and other data fields. You can export the current dataset using the
            "Export Current" button above.
          </p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>• <strong className="text-gray-300">persons</strong>: Array of person objects with id, name, age, gender, occupation, address</p>
            <p>• <strong className="text-gray-300">entities</strong>: Array of entity objects with id, type, label, attributes</p>
            <p>• <strong className="text-gray-300">relationships</strong>: Array with source, target, type, weight</p>
            <p>• <strong className="text-gray-300">cdrs</strong>, <strong className="text-gray-300">transactions</strong>, <strong className="text-gray-300">locationEvents</strong>: Supporting data arrays</p>
          </div>
          <div className="mt-3">
            <textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder='Paste JSON dataset here, or drag a .json file above...'
              className="input-field w-full h-32 text-xs font-mono resize-y"
            />
            <button
              onClick={() => {
                try {
                  const data = JSON.parse(jsonText);
                  if (data.entities && data.relationships) {
                    mergeCSVData(data);
                    setImportResult({ success: true, message: `Imported: ${data.entities.length} entities.`, count: data.entities.length });
                    setJsonText('');
                  } else {
                    setImportResult({ success: false, message: 'Invalid format. Need { entities, relationships }.', count: 0 });
                  }
                } catch {
                  setImportResult({ success: false, message: 'Invalid JSON.', count: 0 });
                }
              }}
              disabled={!jsonText.trim()}
              className="btn-primary mt-2 inline-flex items-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4" /> Import from Pasted JSON
            </button>
          </div>
        </div>
      )}

      {/* Free text analysis */}
      {activeTab === 'text' && (
        <div className="solid-panel p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-2">Analyze Free Text (Police Reports, Notes, Intel Memos)</h3>
          <p className="text-xs text-gray-500 mb-3">
            Paste any free-form text — the NLP engine will extract persons, phone numbers, vehicles, locations, and organizations,
            then show potential relationships. Extracted entities can be merged into the dataset.
          </p>
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="e.g., On 15/08/2026, suspect Arjun Mehta was seen near Warehouse North with vehicle DL-12-AB-3456. He called +919876543210 and transferred ₹8,50,000 to Blue Ocean Trading Co. Informant reported meeting at Transit Hub 3..."
            className="input-field w-full h-40 text-sm font-mono resize-y"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => {
                const result = extractEntities(freeText);
                setNlpResult(result);
              }}
              disabled={!freeText.trim()}
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" /> Extract Entities
            </button>
            {nlpResult && dataset && (
              <button
                onClick={() => {
                  const personIds = new Set(dataset.persons.map(p => p.id));
                  const locIds = new Set(dataset.locations.map(l => l.id));
                  const converted = toDatasetFormat(nlpResult, personIds, locIds);
                  mergeCSVData({
                    entities: [...dataset.entities, ...converted.entities],
                    relationships: [...dataset.relationships, ...converted.relationships],
                  });
                  setImportResult({
                    success: true,
                    message: `Merged ${converted.entities.length} new entities and ${converted.relationships.length} relationships into dataset.`,
                    count: converted.entities.length,
                  });
                  setFreeText('');
                  setNlpResult(null);
                }}
                className="btn-secondary inline-flex items-center gap-2 text-sm"
              >
                <ArrowRight className="w-4 h-4" /> Merge into Dataset
              </button>
            )}
          </div>

          {/* NLP extraction results */}
          {nlpResult && (
            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg bg-ink-900 border border-ink-700">
                <p className="text-sm text-gray-300">{nlpResult.summary}</p>
              </div>

              {nlpResult.entities.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Extracted Entities ({nlpResult.entities.length})</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {nlpResult.entities.map((e, i) => (
                      <div key={i} className="p-2 rounded-lg bg-ink-900 border border-ink-700">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge text-[10px] bg-accent-600/20 text-accent-400 border border-accent-500/30">{e.type}</span>
                        </div>
                        <p className="text-xs text-white font-medium truncate" title={e.value}>{e.value}</p>
                        <p className="text-[10px] text-gray-500 truncate" title={e.context}>{e.context}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nlpResult.relationships.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Inferred Relationships ({nlpResult.relationships.length})</h4>
                  <div className="space-y-1">
                    {nlpResult.relationships.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-ink-900 border border-ink-700">
                        <span className="text-accent-400 font-medium truncate max-w-[120px]" title={r.source}>{r.source}</span>
                        <span className="text-gray-600">→</span>
                        <span className="text-gray-400 text-[10px] uppercase">{r.type.replace('_', ' ')}</span>
                        <span className="text-gray-600">→</span>
                        <span className="text-signal-green font-medium truncate max-w-[120px]" title={r.target}>{r.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* After import, navigate to analysis */}
      {dataset && (
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/network')} className="btn-primary inline-flex items-center gap-2 text-sm">
            <ArrowRight className="w-4 h-4" /> View Network Analysis
          </button>
          <button onClick={() => navigate('/ai-analysis')} className="btn-secondary inline-flex items-center gap-2 text-sm">
            AI Analysis <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function processImport(
  type: ImportTab,
  rows: Record<string, string>[],
): Partial<import('@/types').Dataset> {
  switch (type) {
    case 'persons': {
      const persons: Person[] = rows.map(r => ({
        id: r.id || `P-${Math.random().toString(36).slice(2, 6)}`,
        name: r.name || 'Unknown',
        age: parseInt(r.age) || 0,
        gender: (r.gender as 'male' | 'female') || 'male',
        occupation: r.occupation || 'Unknown',
        address: r.address || '',
      }));
      const entities = persons.map(p => ({
        id: p.id, type: 'person' as EntityType, label: p.name, name: p.name,
        attributes: { age: p.age, gender: p.gender, occupation: p.occupation, address: p.address },
      }));
      return { persons, entities };
    }
    case 'cdrs': {
      const cdrs: CDR[] = rows.map(r => ({
        id: r.id || `CDR-${Math.random().toString(36).slice(2, 6)}`,
        caller: r.caller || '',
        receiver: r.receiver || '',
        timestamp: r.timestamp || new Date().toISOString(),
        duration: parseInt(r.duration) || 0,
        location: r.location || '',
        callType: (r.callType as CDR['callType']) || 'outgoing',
      }));
      return { cdrs };
    }
    case 'transactions': {
      const transactions: Transaction[] = rows.map(r => ({
        id: r.id || `TXN-${Math.random().toString(36).slice(2, 6)}`,
        sender: r.sender || '',
        receiver: r.receiver || '',
        amount: parseFloat(r.amount) || 0,
        timestamp: r.timestamp || new Date().toISOString(),
        location: r.location || '',
        transactionType: (r.transactionType as Transaction['transactionType']) || 'transfer',
      }));
      return { transactions };
    }
    case 'locations': {
      const locations: Location[] = rows.map(r => ({
        id: r.id || `LOC-${Math.random().toString(36).slice(2, 4)}`,
        name: r.name || 'Unknown',
        type: r.type || 'commercial',
      }));
      return { locations };
    }
    case 'vehicles': {
      const vehicles: Vehicle[] = rows.map(r => ({
        id: r.id || `VEH-${Math.random().toString(36).slice(2, 5)}`,
        type: r.type || 'Sedan',
        owner: r.owner || '',
        registration: r.registration || '',
      }));
      return { vehicles };
    }
    case 'firs': {
      const firs: FIR[] = rows.map(r => ({
        id: r.id || `FIR-${Math.random().toString(36).slice(2, 6)}`,
        title: r.title || 'Untitled',
        date: r.date || new Date().toISOString(),
        section: r.section || '',
        status: (r.status as FIR['status']) || 'open',
        entities: r.entities ? r.entities.split(';').map(e => e.trim()) : [],
      }));
      return { firs };
    }
    default:
      return {};
  }
}
