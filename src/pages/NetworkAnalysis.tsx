import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import cytoscape, { type Core, type EventObject } from 'cytoscape';
import {
  Users, Phone, Landmark, MapPin, Car, FileText, Building2,
  ZoomIn, ZoomOut, Maximize, RotateCcw, Crosshair, Route,
  X, Info, ChevronRight, ShieldAlert,
} from 'lucide-react';
import { useDatasetContext } from '@/hooks/useDatasetContext';
import { getNeighbors, getConnections, shortestPath, getAttentionBreakdown } from '@/analytics/networkAnalytics';
import type { EntityType, RelationshipType } from '@/types';

const entityIcons: Record<EntityType, typeof Users> = {
  person: Users,
  phone: Phone,
  bank: Landmark,
  location: MapPin,
  vehicle: Car,
  fir: FileText,
  organization: Building2,
};

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

const clusterColors = [
  '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899',
];

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

const entityTypes: EntityType[] = ['person', 'phone', 'bank', 'location', 'vehicle', 'fir', 'organization', 'social_media_post', 'intelligence_report'];
const relTypes: RelationshipType[] = ['called', 'transacted', 'located_at', 'associated', 'shared_vehicle', 'mentioned_in', 'connected_to', 'posted_by', 'authored_by', 'cites'];

export function NetworkAnalysis() {
  const { dataset, analyzing, loadDemoData } = useDatasetContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const cyRef = useRef<Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(searchParams.get('entity'));
  const [highlightNeighbors, setHighlightNeighbors] = useState(true);
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [pathResult, setPathResult] = useState<string[] | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [visibleTypes, setVisibleTypes] = useState<Set<EntityType>>(new Set(entityTypes));
  const [visibleRelTypes, setVisibleRelTypes] = useState<Set<RelationshipType>>(new Set(relTypes));
  const [minAttention, setMinAttention] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  // Bumped every time a new cytoscape instance is built, so the selection effects
  // below re-apply their classes to the fresh instance.
  const [graphInstance, setGraphInstance] = useState(0);
  // Bumped once the initial cose run has settled. Centering the viewport before
  // that point is pointless - the layout's own fit would override it.
  const [layoutSettled, setLayoutSettled] = useState(0);

  /*
    react-router rebuilds `setSearchParams` whenever the query string changes, so
    it cannot be used as a dependency of the cytoscape init effect - every node
    click would change its identity, tear the graph down and re-run the layout.
    Keeping the latest copy in a ref lets the tap handlers call it while the init
    effect depends only on the graph data itself.
  */
  const setSearchParamsRef = useRef(setSearchParams);
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams;
  }, [setSearchParams]);

  /*
    The URL is the single source of truth for the current selection. Without this
    sync, picking a result in global search or an alert while already on this page
    would update the query string but leave the detail panel on the old entity,
    because `selectedEntity` was only ever seeded from the initial render. It also
    makes browser back/forward work.
  */
  const entityParam = searchParams.get('entity');
  useEffect(() => {
    setSelectedEntity(entityParam);
  }, [entityParam]);

  // Build graph data
  const elements = useMemo(() => {
    if (!dataset) return [];
    const nodes = dataset.entities
      .filter(e => visibleTypes.has(e.type) && (e.attentionScore ?? 0) >= minAttention)
      .map(e => {
        const clusterColor = e.clusterId !== undefined ? clusterColors[e.clusterId % clusterColors.length] : '#6b7280';
        return {
          data: {
            id: e.id,
            label: e.label,
            type: e.type,
            attentionScore: e.attentionScore ?? 0,
            clusterId: e.clusterId,
            color: entityColors[e.type],
            clusterColor,
          },
        };
      });
    const nodeIds = new Set(nodes.map(n => n.data.id));
    const edges = dataset.relationships
      .filter(r => visibleRelTypes.has(r.type) && nodeIds.has(r.source) && nodeIds.has(r.target))
      .map(r => ({
        data: {
          id: r.id,
          source: r.source,
          target: r.target,
          type: r.type,
          strength: r.strength,
          weight: r.weight,
          color: relColors[r.type],
        },
      }));
    return [...nodes, ...edges];
  }, [dataset, visibleTypes, visibleRelTypes, minAttention]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#9ca3af',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'background-color': 'data(color)',
            'width': 'mapData(attentionScore, 0, 100, 25, 50)',
            'height': 'mapData(attentionScore, 0, 100, 25, 50)',
            'border-width': 2,
            'border-color': 'data(clusterColor)',
            'border-opacity': 0.6,
          },
        },
        {
          selector: 'node[type="person"]',
          style: { 'shape': 'circle' },
        },
        {
          selector: 'node[type="phone"]',
          style: { 'shape': 'diamond' },
        },
        {
          selector: 'node[type="bank"]',
          style: { 'shape': 'round-rectangle' },
        },
        {
          selector: 'node[type="location"]',
          style: { 'shape': 'triangle' },
        },
        {
          selector: 'node[type="vehicle"]',
          style: { 'shape': 'pentagon' },
        },
        {
          selector: 'node[type="fir"]',
          style: { 'shape': 'rectangle' },
        },
        {
          selector: 'node[type="organization"]',
          style: { 'shape': 'star' },
        },
        {
          selector: 'node[type="social_media_post"]',
          style: { 'shape': 'hexagon' },
        },
        {
          selector: 'node[type="intelligence_report"]',
          style: { 'shape': 'tag' },
        },
        {
          selector: 'edge',
          style: {
            'width': 'mapData(weight, 1, 10, 1, 4)',
            'line-color': 'data(color)',
            'line-opacity': 0.3,
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'vee',
            'arrow-scale': 0.7,
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#ffffff',
            'border-opacity': 1,
            'background-opacity': 1,
          },
        },
        {
          selector: '.highlighted',
          style: {
            'border-color': '#fbbf24',
            'border-width': 3,
            'border-opacity': 1,
            'background-opacity': 1,
            'line-opacity': 0.8,
          },
        },
        {
          // Edge thickness in cytoscape is `width`, not `line-width`. It has to be
          // scoped to edges, otherwise it would also override the attention-score
          // node sizing defined in the `node` block above.
          selector: 'edge.highlighted',
          style: {
            'width': 3,
          },
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.15,
          },
        },
        {
          selector: '.path-highlight',
          style: {
            'background-color': '#fbbf24',
            'border-color': '#fbbf24',
            'border-width': 3,
            'line-color': '#fbbf24',
            'line-opacity': 1,
            'target-arrow-color': '#fbbf24',
          },
        },
        {
          selector: 'edge.path-highlight',
          style: {
            'width': 4,
          },
        },
      ],
      layout: { name: 'cose', animate: true, animationDuration: 500, idealEdgeLength: 80, nodeRepulsion: 8000, padding: 40 },
      wheelSensitivity: 0.3,
    });

    cyRef.current = cy;
    setGraphInstance(n => n + 1);

    // Highlighting and centering are handled by the selection effects below, so
    // the tap handlers only have to record what was picked. `cose` is animated and
    // fits the viewport when it ends, so defer centering until it has stopped.
    cy.one('layoutstop', () => setLayoutSettled(n => n + 1));

    cy.on('tap', 'node', (evt: EventObject) => {
      const id = evt.target.id() as string;
      setSelectedEntity(id);
      setSearchParamsRef.current({ entity: id });
    });

    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        setSelectedEntity(null);
        setSearchParamsRef.current({});
        cy.elements().removeClass('highlighted faded path-highlight');
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // Rebuild only when the graph data actually changes. Anything else belongs in
    // a separate effect - recreating the instance re-runs the whole cose layout.
  }, [elements]);

  // Apply highlight / fade classes for the current selection. Gated on the
  // instance counter rather than on the layout, so highlighting keeps working
  // even if the layout never reports that it stopped.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || graphInstance === 0) return;

    cy.elements().removeClass('highlighted faded');
    if (!selectedEntity || !highlightNeighbors) return;

    const node = cy.getElementById(selectedEntity);
    if (node.length === 0) return;

    cy.elements().addClass('faded');
    node.removeClass('faded').addClass('highlighted');
    node.neighborhood().removeClass('faded').addClass('highlighted');
  }, [selectedEntity, highlightNeighbors, graphInstance]);

  // Bring the selected entity into view. Deliberately separate from the effect
  // above so toggling "highlight neighbours" does not yank the viewport around.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || layoutSettled === 0 || !selectedEntity) return;

    const node = cy.getElementById(selectedEntity);
    if (node.length === 0) return;

    cy.animate({ center: { eles: node }, zoom: 1.5 }, { duration: 300 });
  }, [selectedEntity, layoutSettled]);

  // Apply search filter
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (!searchQuery.trim()) {
      cy.elements().removeClass('faded');
      return;
    }
    const q = searchQuery.toLowerCase();
    cy.elements().addClass('faded');
    cy.nodes().filter(n => {
      const label = (n.data('label') as string)?.toLowerCase() ?? '';
      const id = (n.data('id') as string)?.toLowerCase() ?? '';
      return label.includes(q) || id.includes(q);
    }).removeClass('faded');
  }, [searchQuery]);

  const handleZoomIn = () => cyRef.current?.zoom({ level: cyRef.current.zoom() * 1.3 });
  const handleZoomOut = () => cyRef.current?.zoom({ level: cyRef.current.zoom() / 1.3 });
  const handleFit = () => cyRef.current?.animate({ fit: { eles: cyRef.current.elements(), padding: 40 } }, { duration: 300 });
  const handleReset = () => {
    cyRef.current?.elements().removeClass('highlighted faded path-highlight');
    setSelectedEntity(null);
    setPathResult(null);
    setSearchParams({});
    handleFit();
  };
  const handleFocus = () => {
    if (!cyRef.current || !selectedEntity) return;
    const node = cyRef.current.getElementById(selectedEntity);
    cyRef.current.animate({ center: { eles: node }, zoom: 2 }, { duration: 300 });
  };

  const handleFindPath = () => {
    if (!dataset || !pathSource || !pathTarget) return;
    const path = shortestPath(pathSource, pathTarget, dataset);
    setPathResult(path);
    if (path && cyRef.current) {
      cyRef.current.elements().removeClass('path-highlight');
      path.forEach(id => {
        cyRef.current!.getElementById(id).addClass('path-highlight');
      });
      for (let i = 0; i < path.length - 1; i++) {
        const edges = cyRef.current!.getElementById(path[i]).edgesTo(cyRef.current!.getElementById(path[i + 1]));
        edges.addClass('path-highlight');
      }
    }
  };

  const toggleType = (type: EntityType) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const toggleRelType = (type: RelationshipType) => {
    setVisibleRelTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  if (!dataset) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No dataset loaded. Load the demo dataset to view the network graph.</p>
          <button onClick={loadDemoData} disabled={analyzing} className="btn-primary">
            {analyzing ? 'Processing...' : 'Load Demo Investigation'}
          </button>
        </div>
      </div>
    );
  }

  const selectedEntityData = selectedEntity ? dataset.entities.find(e => e.id === selectedEntity) : null;
  const selectedConnections = selectedEntity ? getConnections(selectedEntity, dataset) : [];
  const selectedNeighbors = selectedEntity ? getNeighbors(selectedEntity, dataset) : null;
  const attentionBreakdown = selectedEntity ? getAttentionBreakdown(selectedEntity, dataset) : [];

  return (
    <div className="flex h-full">
      {/* Filter sidebar */}
      {showFilters && (
        <div className="w-64 shrink-0 border-r border-ink-700 bg-ink-900 overflow-y-auto p-4 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by name or ID..."
              className="input-field text-sm"
            />
          </div>

          {/* Entity types */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Entity Types</label>
            <div className="space-y-1.5">
              {entityTypes.map(type => {
                const Icon = entityIcons[type];
                const visible = visibleTypes.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      visible ? 'bg-ink-700 text-gray-200' : 'bg-ink-850 text-gray-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: visible ? entityColors[type] : '#4b5563' }} />
                    <span className="capitalize">{type}</span>
                    <span className="ml-auto text-xs font-mono">
                      {dataset.entities.filter(e => e.type === type).length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Relationship types */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Relationship Types</label>
            <div className="space-y-1.5">
              {relTypes.map(type => {
                const visible = visibleRelTypes.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleRelType(type)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      visible ? 'bg-ink-700 text-gray-200' : 'bg-ink-850 text-gray-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: visible ? relColors[type] : '#4b5563' }} />
                    <span className="capitalize">{type.replace('_', ' ')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Attention score slider */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">
              Min Attention Score: <span className="text-gray-300 font-mono">{minAttention}</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={minAttention}
              onChange={e => setMinAttention(Number(e.target.value))}
              className="w-full accent-accent-500"
            />
          </div>

          {/* Shortest path */}
          <div className="pt-2 border-t border-ink-700">
            <label className="text-xs text-gray-500 mb-2 block flex items-center gap-1.5">
              <Route className="w-3.5 h-3.5" /> Shortest Path
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={pathSource}
                onChange={e => setPathSource(e.target.value)}
                placeholder="Source ID (e.g. P001)"
                className="input-field text-xs font-mono"
              />
              <input
                type="text"
                value={pathTarget}
                onChange={e => setPathTarget(e.target.value)}
                placeholder="Target ID (e.g. P021)"
                className="input-field text-xs font-mono"
              />
              <button onClick={handleFindPath} className="btn-secondary w-full text-xs">
                Find Shortest Path
              </button>
              {pathResult && (
                <div className="text-xs p-2 rounded-lg bg-ink-850 border border-ink-700">
                  {pathResult.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1 font-mono text-gray-300">
                      {pathResult.map((id, i) => (
                        <span key={id} className="flex items-center gap-1">
                          <span className="text-accent-400">{id}</span>
                          {i < pathResult.length - 1 && <ChevronRight className="w-3 h-3 text-gray-600" />}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-signal-red">No path found</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Graph area */}
      <div className="flex-1 relative min-w-0">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
          {!showFilters && (
            <button onClick={() => setShowFilters(true)} className="btn-secondary text-xs px-2.5 py-1.5">
              Filters
            </button>
          )}
        </div>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 glass-panel p-1">
          <button onClick={handleZoomIn} title="Zoom In" className="btn-ghost p-1.5"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={handleZoomOut} title="Zoom Out" className="btn-ghost p-1.5"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={handleFit} title="Fit to Screen" className="btn-ghost p-1.5"><Maximize className="w-4 h-4" /></button>
          <button onClick={handleFocus} title="Focus Selected" className="btn-ghost p-1.5"><Crosshair className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-ink-600" />
          <button onClick={handleReset} title="Reset" className="btn-ghost p-1.5"><RotateCcw className="w-4 h-4" /></button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 glass-panel p-3 max-w-xs">
          <div className="text-xs text-gray-500 mb-2">Entity Types</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {entityTypes.map(type => {
              const Icon = entityIcons[type];
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3" style={{ color: entityColors[type] }} />
                  <span className="text-xs text-gray-400 capitalize">{type}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={containerRef} className="w-full h-full bg-ink-950" />
      </div>

      {/* Detail panel */}
      {selectedEntityData && (
        <div className="w-80 shrink-0 border-l border-ink-700 bg-ink-900 overflow-y-auto animate-slide-in">
          <div className="p-4 border-b border-ink-700 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {(() => {
                  const Icon = entityIcons[selectedEntityData.type];
                  return <Icon className="w-4 h-4" style={{ color: entityColors[selectedEntityData.type] }} />;
                })()}
                <span className="text-xs text-gray-500 uppercase">{selectedEntityData.type}</span>
              </div>
              <h3 className="text-base font-semibold text-white">{selectedEntityData.label}</h3>
              <p className="text-xs text-gray-500 font-mono">{selectedEntityData.id}</p>
            </div>
            <button onClick={() => { setSelectedEntity(null); setSearchParams({}); cyRef.current?.elements().removeClass('highlighted faded path-highlight'); }} className="btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Attention score */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Analytical Attention Score</span>
                <span className="text-lg font-bold text-white font-mono">{selectedEntityData.attentionScore ?? 0}<span className="text-xs text-gray-500">/100</span></span>
              </div>
              <div className="h-2 bg-ink-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (selectedEntityData.attentionScore ?? 0) >= 70 ? 'bg-signal-red' :
                    (selectedEntityData.attentionScore ?? 0) >= 40 ? 'bg-signal-amber' : 'bg-signal-green'
                  }`}
                  style={{ width: `${selectedEntityData.attentionScore ?? 0}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-600 mt-1">Not a criminal or guilt score. Analytical lead only.</p>
            </div>

            {/* Score breakdown */}
            {attentionBreakdown.length > 0 && (
              <details className="group">
                <summary className="text-xs text-accent-400 cursor-pointer flex items-center gap-1 list-none">
                  <Info className="w-3 h-3" /> Why this score?
                </summary>
                <div className="mt-2 space-y-1 p-2 rounded-lg bg-ink-850 border border-ink-700">
                  {attentionBreakdown.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{b.factor}</span>
                      <span className="text-gray-300 font-mono">+{b.points}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-ink-850 border border-ink-700">
                <div className="text-xs text-gray-500">Connections</div>
                <div className="text-lg font-bold text-white font-mono">{selectedConnections.length}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-ink-850 border border-ink-700">
                <div className="text-xs text-gray-500">Comm Links</div>
                <div className="text-lg font-bold text-white font-mono">{selectedConnections.filter(c => c.relationship === 'called').length}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-ink-850 border border-ink-700">
                <div className="text-xs text-gray-500">Financial Links</div>
                <div className="text-lg font-bold text-white font-mono">{selectedConnections.filter(c => c.relationship === 'transacted').length}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-ink-850 border border-ink-700">
                <div className="text-xs text-gray-500">Case Links</div>
                <div className="text-lg font-bold text-white font-mono">{selectedConnections.filter(c => c.relationship === 'mentioned_in').length}</div>
              </div>
            </div>

            {/* Cluster */}
            {selectedEntityData.clusterId !== undefined && (
              <div className="p-2.5 rounded-lg bg-ink-850 border border-ink-700">
                <div className="text-xs text-gray-500">Cluster Membership</div>
                <div className="text-sm text-gray-200 mt-0.5">
                  {dataset.clusters[selectedEntityData.clusterId]?.name ?? `Cluster ${selectedEntityData.clusterId + 1}`}
                </div>
              </div>
            )}

            {/* Anomalies */}
            {dataset.anomalies.filter(a => a.entity === selectedEntityData.id).length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1.5">Anomalies</div>
                {dataset.anomalies.filter(a => a.entity === selectedEntityData.id).map(a => (
                  <div key={a.id} className="p-2.5 rounded-lg bg-signal-red/10 border border-signal-red/20 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-signal-red" />
                      <span className="text-xs text-gray-200">{a.title}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{a.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Connections table */}
            <div>
              <div className="text-xs text-gray-500 mb-1.5">Connections ({selectedConnections.length})</div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {selectedConnections.slice(0, 30).map((c, i) => {
                  const target = dataset.entities.find(e => e.id === c.entity);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedEntity(c.entity);
                        setSearchParams({ entity: c.entity });
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg bg-ink-850 border border-ink-700 hover:border-ink-600 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-200 truncate">{target?.label ?? c.entity}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{c.entity}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-gray-400 capitalize">{c.relationship.replace('_', ' ')}</div>
                        <div className={`text-[10px] font-mono ${
                          c.strength === 'high' ? 'text-signal-red' : c.strength === 'medium' ? 'text-signal-amber' : 'text-signal-green'
                        }`}>{c.strength}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
