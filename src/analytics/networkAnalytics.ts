import type { Dataset, NetworkMetrics, RelationshipType, EntityType } from '@/types';

export function computeMetrics(dataset: Dataset): NetworkMetrics {
  const { entities, relationships, clusters, anomalies } = dataset;

  const degreeMap = new Map<string, number>();
  relationships.forEach(r => {
    degreeMap.set(r.source, (degreeMap.get(r.source) ?? 0) + 1);
    degreeMap.set(r.target, (degreeMap.get(r.target) ?? 0) + 1);
  });

  const topConnected = Array.from(degreeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([entityId, degree]) => ({ entityId, degree }));

  const highConnectivityEntities = Array.from(degreeMap.values()).filter(d => d >= 10).length;

  const relTypeMap = new Map<RelationshipType, number>();
  relationships.forEach(r => relTypeMap.set(r.type, (relTypeMap.get(r.type) ?? 0) + 1));
  const relationshipTypeDistribution = Array.from(relTypeMap.entries()).map(([type, count]) => ({ type, count }));

  const entTypeMap = new Map<EntityType, number>();
  entities.forEach(e => entTypeMap.set(e.type, (entTypeMap.get(e.type) ?? 0) + 1));
  const entityTypeDistribution = Array.from(entTypeMap.entries()).map(([type, count]) => ({ type, count }));

  // Activity timeline (last 30 days)
  const dayMap = new Map<string, { calls: number; transactions: number; locations: number }>();
  dataset.cdrs.forEach(c => {
    const day = c.timestamp.slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, { calls: 0, transactions: 0, locations: 0 });
    dayMap.get(day)!.calls++;
  });
  dataset.transactions.forEach(t => {
    const day = t.timestamp.slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, { calls: 0, transactions: 0, locations: 0 });
    dayMap.get(day)!.transactions++;
  });
  dataset.locationEvents.forEach(le => {
    const day = le.timestamp.slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, { calls: 0, transactions: 0, locations: 0 });
    dayMap.get(day)!.locations++;
  });
  const activityTimeline = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, v]) => ({ date, ...v }));

  return {
    totalEntities: entities.length,
    totalRelationships: relationships.length,
    detectedClusters: clusters.length,
    anomaliesDetected: anomalies.length,
    highConnectivityEntities,
    topConnected,
    relationshipTypeDistribution,
    entityTypeDistribution,
    activityTimeline,
  };
}

export function getNeighbors(entityId: string, dataset: Dataset): Set<string> {
  const neighbors = new Set<string>();
  dataset.relationships.forEach(r => {
    if (r.source === entityId) neighbors.add(r.target);
    if (r.target === entityId) neighbors.add(r.source);
  });
  return neighbors;
}

export function getDegree(entityId: string, dataset: Dataset): number {
  let deg = 0;
  dataset.relationships.forEach(r => {
    if (r.source === entityId || r.target === entityId) deg++;
  });
  return deg;
}

export function getConnections(entityId: string, dataset: Dataset) {
  const conns: { entity: string; relationship: RelationshipType; strength: string; weight: number }[] = [];
  dataset.relationships.forEach(r => {
    if (r.source === entityId) {
      conns.push({ entity: r.target, relationship: r.type, strength: r.strength, weight: r.weight });
    } else if (r.target === entityId) {
      conns.push({ entity: r.source, relationship: r.type, strength: r.strength, weight: r.weight });
    }
  });
  return conns.sort((a, b) => b.weight - a.weight);
}

// BFS shortest path
export function shortestPath(source: string, target: string, dataset: Dataset): string[] | null {
  if (source === target) return [source];
  const adj = new Map<string, Set<string>>();
  dataset.relationships.forEach(r => {
    if (!adj.has(r.source)) adj.set(r.source, new Set());
    if (!adj.has(r.target)) adj.set(r.target, new Set());
    adj.get(r.source)!.add(r.target);
    adj.get(r.target)!.add(r.source);
  });
  const visited = new Set<string>([source]);
  const queue: { node: string; path: string[] }[] = [{ node: source, path: [source] }];
  while (queue.length) {
    const { node, path } = queue.shift()!;
    const neighbors = adj.get(node);
    if (!neighbors) continue;
    for (const n of neighbors) {
      if (visited.has(n)) continue;
      visited.add(n);
      const newPath = [...path, n];
      if (n === target) return newPath;
      queue.push({ node: n, path: newPath });
    }
  }
  return null;
}

export function getEntityTimeline(entityId: string, dataset: Dataset) {
  return dataset.timeline
    .filter(t => t.entity === entityId || t.relatedEntities.includes(entityId))
    .slice(0, 20);
}

export function getAttentionBreakdown(entityId: string, dataset: Dataset) {
  // Prefer real detection.ts breakdown if available
  const realScores = dataset.analysisResult.attentionScores;
  if (realScores instanceof Map) {
    const real = realScores.get(entityId);
    if (real?.breakdown) return real.breakdown.map(b => ({ factor: b.factor, points: b.points }));
  }

  // Fallback: simplified heuristic breakdown
  const breakdown: { factor: string; points: number }[] = [];
  const conns = getConnections(entityId, dataset);
  const degree = getDegree(entityId, dataset);
  breakdown.push({ factor: 'High number of relationships', points: Math.min(degree * 2, 25) });

  let commLinks = 0, finLinks = 0, caseLinks = 0, locLinks = 0;
  conns.forEach(c => {
    if (c.relationship === 'called') commLinks++;
    else if (c.relationship === 'transacted') finLinks++;
    else if (c.relationship === 'mentioned_in') caseLinks++;
    else if (c.relationship === 'located_at') locLinks++;
  });
  if (commLinks > 5) breakdown.push({ factor: 'High communication frequency', points: 12 });
  if (finLinks > 3) breakdown.push({ factor: 'Multiple financial links', points: 15 });
  if (caseLinks > 0) breakdown.push({ factor: 'Multiple case associations', points: 10 });
  if (locLinks > 3) breakdown.push({ factor: 'Multiple shared locations', points: 8 });

  const anomalies = dataset.anomalies.filter(a => a.entity === entityId);
  anomalies.forEach(a => {
    breakdown.push({ factor: a.title, points: a.severity === 'high' ? 25 : 15 });
  });

  const cluster = dataset.clusters.find(c => c.entities.includes(entityId));
  if (cluster) breakdown.push({ factor: `Membership in ${cluster.name}`, points: 5 });

  return breakdown;
}

export function searchEntities(query: string, dataset: Dataset) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return dataset.entities
    .filter(e =>
      e.id.toLowerCase().includes(q) ||
      (e.name?.toLowerCase().includes(q)) ||
      e.label.toLowerCase().includes(q) ||
      e.type.includes(q)
    )
    .slice(0, 20);
}
