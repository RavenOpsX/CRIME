import { useMemo } from 'react';
import {
  Users, Link2, Group, AlertTriangle, Zap, Activity, TrendingUp,
  ShieldAlert, Play, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useDatasetContext } from '@/hooks/useDatasetContext';
import { useCountUp } from '@/hooks/useCountUp';
import { computeMetrics } from '@/analytics/networkAnalytics';
import type { EntityType, RelationshipType } from '@/types';
import { useNavigate } from 'react-router-dom';

const entityColors: Record<EntityType, string> = {
  person: '#3b82f6',
  phone: '#22c55e',
  bank: '#f59e0b',
  location: '#06b6d4',
  vehicle: '#a855f7',
  fir: '#ef4444',
  organization: '#ec4899',
  social_media_post: '#14b8a6',
  intelligence_report: '#f97316',
};

const relColors: Record<RelationshipType, string> = {
  called: '#3b82f6',
  transacted: '#f59e0b',
  located_at: '#06b6d4',
  associated: '#a855f7',
  shared_vehicle: '#22c55e',
  mentioned_in: '#ef4444',
  connected_to: '#6b7280',
  posted_by: '#14b8a6',
  authored_by: '#f97316',
  cites: '#14b8a6',
};

function KPICard({ icon: Icon, label, value, color, delay }: { icon: typeof Users; label: string; value: number; color: string; delay: number }) {
  const animated = useCountUp(value);
  return (
    <div className="solid-panel p-4 animate-fade-in relative overflow-hidden" style={{ animationDelay: `${delay}ms` }}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 blur-2xl" style={{ background: color }} />
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
          <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white font-mono">{animated.toLocaleString('en-IN')}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export function Dashboard() {
  const { dataset, loadDemoData, analyzing } = useDatasetContext();
  const navigate = useNavigate();

  const metrics = useMemo(() => dataset ? computeMetrics(dataset) : null, [dataset]);

  if (!dataset) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-600/20 flex items-center justify-center mx-auto mb-5 border border-accent-500/30">
            <ShieldAlert className="w-8 h-8 text-accent-400" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">AI-Powered Criminal Network Analysis</h2>
          <p className="text-gray-400 mb-1">Synthetic Intelligence Analysis Prototype</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium border border-amber-500/30 mb-6">
            <ShieldAlert className="w-3 h-3" /> SIH Prototype
          </div>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            Load the built-in synthetic dataset to begin exploring relationships, detect patterns, and surface anomalies across a fictional criminal network.
          </p>
          <button
            onClick={loadDemoData}
            disabled={analyzing}
            className="btn-primary inline-flex items-center gap-2 mx-auto"
          >
            {analyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Load Demo Investigation
              </>
            )}
          </button>
          <p className="text-xs text-gray-600 mt-4 max-w-sm mx-auto">
            Uses 100% synthetic data. No real databases, phone records, or financial systems are connected.
          </p>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold text-white">Dashboard</h1>
            <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/30">SIH Prototype</span>
          </div>
          <p className="text-sm text-gray-500">AI-Powered Criminal Network Analysis — Synthetic Intelligence Analysis Prototype</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/network')} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4" />
            View Network
          </button>
          <button onClick={() => navigate('/ai-analysis')} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4" />
            AI Analysis
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard icon={Users} label="Total Entities" value={metrics.totalEntities} color="#3b82f6" delay={0} />
        <KPICard icon={Link2} label="Total Relationships" value={metrics.totalRelationships} color="#22c55e" delay={80} />
        <KPICard icon={Group} label="Detected Clusters" value={metrics.detectedClusters} color="#a855f7" delay={160} />
        <KPICard icon={AlertTriangle} label="Anomalies Detected" value={metrics.anomaliesDetected} color="#ef4444" delay={240} />
        <KPICard icon={Zap} label="High-Connectivity Entities" value={metrics.highConnectivityEntities} color="#f59e0b" delay={320} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity timeline */}
        <div className="solid-panel p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-400" />
              Activity Timeline
            </h3>
            <span className="text-xs text-gray-500">Last 30 days</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={metrics.activityTimeline}>
              <defs>
                <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="txnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="locGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2435" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickFormatter={d => d.slice(5)} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#0f1421', border: '1px solid #273042', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="calls" stroke="#3b82f6" fill="url(#callsGrad)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="transactions" stroke="#f59e0b" fill="url(#txnGrad)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="locations" stroke="#06b6d4" fill="url(#locGrad)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Relationship type distribution */}
        <div className="solid-panel p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Relationship Types</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={metrics.relationshipTypeDistribution}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={70}
                innerRadius={40}
                paddingAngle={2}
              >
                {metrics.relationshipTypeDistribution.map(entry => (
                  <Cell key={entry.type} fill={relColors[entry.type] ?? '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f1421', border: '1px solid #273042', borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>        {/* Top Influencers from real detection.ts */}
      {dataset.analysisResult.topInfluencers.length > 0 && (
        <div className="solid-panel p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Top Influencers (Detection Engine)</h3>
          <div className="space-y-2">
            {dataset.analysisResult.topInfluencers.slice(0, 6).map(inf => {
              const ent = dataset.entities.find(e => e.id === inf.entityId);
              return (
                <button
                  key={inf.entityId}
                  onClick={() => navigate(`/network?entity=${inf.entityId}`)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-ink-900 border border-ink-700 hover:border-accent-500/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-600/20 flex items-center justify-center text-accent-400 text-xs font-mono font-bold">
                    {inf.entityId.slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">{ent?.label ?? inf.entityId}</div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      Betweenness: {inf.betweenness.toFixed(3)} | PageRank: {inf.pagerank.toFixed(4)} | Degree: {inf.degree}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-accent-400">Score: {ent?.attentionScore ?? 0}</span>
                </button>
              );
            })}
          </div>
          {dataset.analysisResult.modularityScore > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <span>Modularity Score:</span>
              <span className="font-mono text-gray-300">{dataset.analysisResult.modularityScore.toFixed(4)}</span>
              <span className="text-gray-600">(higher = stronger community structure)</span>
            </div>
          )}
        </div>
      )}

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top connected entities */}
        <div className="solid-panel p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Top Connected Entities</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.topConnected.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2435" horizontal={false} />
              <XAxis type="number" stroke="#6b7280" fontSize={11} />
              <YAxis type="category" dataKey="entityId" stroke="#6b7280" fontSize={11} width={60} />
              <Tooltip
                contentStyle={{ background: '#0f1421', border: '1px solid #273042', borderRadius: '8px', fontSize: '12px' }}
                cursor={{ fill: '#1c243580' }}
              />
              <Bar dataKey="degree" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Anomaly summary */}
        <div className="solid-panel p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Anomaly Summary</h3>
          <div className="space-y-2.5">
            {dataset.anomalies.map(a => (
              <button
                key={a.id}
                onClick={() => navigate('/alerts')}
                className="w-full text-left p-3 rounded-lg bg-ink-900 border border-ink-700 hover:border-ink-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-200 font-medium">{a.title}</span>
                  <span className={`badge ${
                    a.severity === 'high' ? 'bg-signal-red/15 text-signal-red' :
                    a.severity === 'medium' ? 'bg-signal-amber/15 text-signal-amber' :
                    'bg-signal-blue/15 text-signal-blue'
                  }`}>
                    {a.severity}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-mono">{a.entity}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Network overview + clusters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="solid-panel p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200">Detected Clusters</h3>
            <button onClick={() => navigate('/network')} className="text-xs text-accent-400 hover:text-accent-300 inline-flex items-center gap-1">
              View graph <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {dataset.clusters.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-ink-900 border border-ink-700">
                <div className="w-8 h-8 rounded-lg bg-accent-600/20 flex items-center justify-center text-accent-400 text-xs font-mono font-bold">
                  {c.id + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200">{c.name}</div>
                  <div className="text-xs text-gray-500 truncate">{c.description}</div>
                </div>
                <span className="text-xs text-gray-400 font-mono">{c.entities.length} entities</span>
              </div>
            ))}
          </div>
        </div>

        <div className="solid-panel p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Entity Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.entityTypeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2435" />
              <XAxis dataKey="type" stroke="#6b7280" fontSize={10} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip
                contentStyle={{ background: '#0f1421', border: '1px solid #273042', borderRadius: '8px', fontSize: '12px' }}
                cursor={{ fill: '#1c243580' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {metrics.entityTypeDistribution.map(entry => (
                  <Cell key={entry.type} fill={entityColors[entry.type] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="solid-panel p-4 border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            This prototype uses synthetic data for demonstration purposes. Analytical outputs represent potential patterns or associations and do not establish criminal activity, guilt, or wrongdoing. Any real-world deployment would require appropriate legal authorization, privacy protections, security controls, and human investigator review.
          </p>
        </div>
      </div>
    </div>
  );
}
