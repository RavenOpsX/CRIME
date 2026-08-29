import type { Anomaly, Cluster, Dataset, Entity, Relationship, RelationshipType } from '@/types';

/*
  Real detection layer.

  Everything in this file is computed from the data at runtime - nothing is
  authored in advance. It is deliberately dependency-free and deterministic:
  the same dataset always produces the same communities, the same centrality
  ranking and the same anomalies, which matters both for demoing and for being
  able to say honestly how the numbers were produced.

  Design note on why this is rule-based / graph-theoretic rather than a trained
  model: every output here has to be explainable to an investigator, because the
  system is only ever allowed to suggest analytical leads, never to assert that
  a person is guilty. A score you cannot decompose is unusable for that purpose.
*/

/* ------------------------------------------------------------------ *
 * Graph construction
 * ------------------------------------------------------------------ */

export interface Graph {
  /** Entity ids, in index order. */
  nodes: string[];
  /** entity id -> node index */
  index: Map<string, number>;
  /** Undirected weighted adjacency. Parallel edges are merged. */
  adj: { to: number; w: number }[][];
  /** Sum of incident edge weights per node. */
  strength: Float64Array;
  /** Unweighted neighbour count per node. */
  degree: Int32Array;
}

/**
 * Edge types that carry a genuine, evidenced link between two parties.
 *
 * `connected_to` is excluded by default: it is generated from mere co-presence
 * at a location within the same hour, which produces a complete graph over
 * everyone who happened to be in the same place. Those edges are numerous,
 * weak, and they smear otherwise distinct groups together, so they are treated
 * as context rather than as evidence when detecting community structure.
 */
export const EVIDENTIAL_EDGE_TYPES: ReadonlySet<RelationshipType> = new Set<RelationshipType>([
  'called',
  'transacted',
  'located_at',
  'associated',
  'shared_vehicle',
  'mentioned_in',
]);

export function buildGraph(
  entities: Entity[],
  relationships: Relationship[],
  edgeTypes?: ReadonlySet<RelationshipType>,
): Graph {
  const nodes = entities.map(e => e.id);
  const index = new Map<string, number>();
  nodes.forEach((id, i) => index.set(id, i));

  // Merge parallel/reciprocal edges into a single undirected weight.
  const merged = new Map<string, number>();
  for (const r of relationships) {
    if (edgeTypes && !edgeTypes.has(r.type)) continue;
    const a = index.get(r.source);
    const b = index.get(r.target);
    if (a === undefined || b === undefined || a === b) continue;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    merged.set(key, (merged.get(key) ?? 0) + Math.max(1, r.weight));
  }

  const adj: { to: number; w: number }[][] = nodes.map(() => []);
  const strength = new Float64Array(nodes.length);
  const degree = new Int32Array(nodes.length);
  for (const [key, w] of merged) {
    const [a, b] = key.split(':').map(Number);
    adj[a].push({ to: b, w });
    adj[b].push({ to: a, w });
    strength[a] += w;
    strength[b] += w;
    degree[a] += 1;
    degree[b] += 1;
  }

  return { nodes, index, adj, strength, degree };
}

/* ------------------------------------------------------------------ *
 * Community detection - weighted label propagation
 * ------------------------------------------------------------------ */

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Weighted label propagation (Raghavan et al.).
 *
 * Each node repeatedly adopts whichever community label carries the greatest
 * total edge weight among its neighbours. Using weight rather than a plain
 * neighbour count is what makes this work here: a pair who exchanged forty
 * calls outvotes forty people who merely stood in the same market once.
 *
 * Visit order is shuffled from a fixed seed each round, so the result is
 * stable across runs but not biased by entity id order. Ties break toward the
 * lower label so the outcome is fully determined.
 */
export function detectCommunities(graph: Graph, seed = 20260829, maxIterations = 100): number[] {
  const n = graph.nodes.length;
  const labels = new Int32Array(n);
  for (let i = 0; i < n; i++) labels[i] = i;

  const order = Array.from({ length: n }, (_, i) => i);
  const rand = seeded(seed);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Fisher-Yates with the seeded generator.
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    let changed = 0;
    for (const v of order) {
      const neighbours = graph.adj[v];
      if (neighbours.length === 0) continue;

      const weightByLabel = new Map<number, number>();
      for (const { to, w } of neighbours) {
        const label = labels[to];
        weightByLabel.set(label, (weightByLabel.get(label) ?? 0) + w);
      }

      let bestLabel = labels[v];
      let bestWeight = -1;
      for (const [label, w] of weightByLabel) {
        if (w > bestWeight || (w === bestWeight && label < bestLabel)) {
          bestLabel = label;
          bestWeight = w;
        }
      }
      if (bestLabel !== labels[v]) {
        labels[v] = bestLabel;
        changed++;
      }
    }
    if (changed === 0) break;
  }

  // Compact raw labels into 0..k-1, ordered by descending community size so
  // that community 0 is always the largest - handy for stable colouring.
  const members = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const arr = members.get(labels[i]);
    if (arr) arr.push(i);
    else members.set(labels[i], [i]);
  }
  const ordered = [...members.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0] - b[0],
  );
  const out = new Array<number>(n).fill(-1);
  ordered.forEach(([, group], newId) => {
    for (const v of group) out[v] = newId;
  });
  return out;
}

/**
 * Modularity of a partition. Reported alongside the communities so the quality
 * of the split is a number on screen rather than a claim.
 * Values above ~0.3 indicate genuine community structure.
 */
export function modularity(graph: Graph, communities: number[]): number {
  let totalWeight = 0;
  for (let i = 0; i < graph.nodes.length; i++) totalWeight += graph.strength[i];
  if (totalWeight === 0) return 0;
  const m2 = totalWeight; // == 2m

  const inWeight = new Map<number, number>();
  const totWeight = new Map<number, number>();
  for (let v = 0; v < graph.nodes.length; v++) {
    const c = communities[v];
    totWeight.set(c, (totWeight.get(c) ?? 0) + graph.strength[v]);
    for (const { to, w } of graph.adj[v]) {
      if (communities[to] === c) inWeight.set(c, (inWeight.get(c) ?? 0) + w);
    }
  }

  let q = 0;
  for (const [c, tot] of totWeight) {
    const inW = inWeight.get(c) ?? 0; // already counted from both endpoints
    q += inW / m2 - (tot / m2) ** 2;
  }
  return q;
}

/* ------------------------------------------------------------------ *
 * Centrality
 * ------------------------------------------------------------------ */

/**
 * Brandes betweenness centrality on the unweighted graph.
 *
 * This is the measure that actually answers "who are the key individuals" -
 * it scores a person by how often they sit on the shortest path between two
 * other parties, which is what makes a broker or courier structurally
 * important even when their own contact count is unremarkable. Raw degree
 * cannot distinguish a hub from a bridge; this can.
 */
export function betweenness(graph: Graph): Float64Array {
  const n = graph.nodes.length;
  const cb = new Float64Array(n);

  for (let s = 0; s < n; s++) {
    const stack: number[] = [];
    const preds: number[][] = Array.from({ length: n }, () => []);
    const sigma = new Float64Array(n);
    const dist = new Int32Array(n).fill(-1);
    sigma[s] = 1;
    dist[s] = 0;

    const queue: number[] = [s];
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi];
      stack.push(v);
      for (const { to: w } of graph.adj[v]) {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1;
          queue.push(w);
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          preds[w].push(v);
        }
      }
    }

    const delta = new Float64Array(n);
    for (let i = stack.length - 1; i >= 0; i--) {
      const w = stack[i];
      for (const v of preds[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) cb[w] += delta[w];
    }
  }

  // Each unordered pair is counted from both endpoints.
  for (let i = 0; i < n; i++) cb[i] /= 2;
  return cb;
}

/**
 * Weighted PageRank. Answers a different question from betweenness: not "who
 * connects groups" but "who is well connected to other well connected people".
 */
export function pagerank(graph: Graph, damping = 0.85, iterations = 60): Float64Array {
  const n = graph.nodes.length;
  let rank = new Float64Array(n).fill(1 / Math.max(1, n));
  const next = new Float64Array(n);

  for (let it = 0; it < iterations; it++) {
    next.fill((1 - damping) / Math.max(1, n));
    let dangling = 0;
    for (let v = 0; v < n; v++) {
      if (graph.strength[v] === 0) {
        dangling += rank[v];
        continue;
      }
      for (const { to, w } of graph.adj[v]) {
        next[to] += damping * rank[v] * (w / graph.strength[v]);
      }
    }
    if (dangling > 0) {
      const share = (damping * dangling) / Math.max(1, n);
      for (let v = 0; v < n; v++) next[v] += share;
    }
    rank = Float64Array.from(next);
  }
  return rank;
}

/* ------------------------------------------------------------------ *
 * Statistics helpers
 * ------------------------------------------------------------------ */

function meanStdev(values: number[]): { mean: number; stdev: number } {
  if (values.length === 0) return { mean: 0, stdev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, stdev: Math.sqrt(variance) };
}

/**
 * Leave-one-out outlier test.
 *
 * The baseline is built from every observation EXCEPT the one being tested.
 * This matters more than it sounds. A single extreme value inflates the very
 * standard deviation it is being measured against, so it can hide inside its
 * own variance: 47 calls in a day against a baseline that includes those 47
 * calls sits just under mean + 3sd and escapes detection entirely. Excluding
 * the candidate removes that blind spot.
 */
function leaveOneOutZ(
  values: number[],
  candidate: number,
): { mean: number; stdev: number; z: number; outlier: boolean } {
  const rest = values.slice();
  const at = rest.indexOf(candidate);
  if (at >= 0) rest.splice(at, 1);
  if (rest.length === 0) return { mean: 0, stdev: 0, z: 0, outlier: false };

  const { mean, stdev } = meanStdev(rest);
  if (stdev === 0) {
    // A perfectly flat baseline gives no scale to measure against, so fall back
    // to a multiple of the baseline level.
    const ratio = mean > 0 ? candidate / mean : 0;
    return { mean, stdev, z: ratio, outlier: mean > 0 && candidate > mean * 3 };
  }
  const z = (candidate - mean) / stdev;
  return { mean, stdev, z, outlier: z > 3 };
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/* ------------------------------------------------------------------ *
 * Anomaly detection
 * ------------------------------------------------------------------ */

export interface DetectionSignals {
  graph: Graph;
  communities: number[];
  betweennessScores: Float64Array;
  pagerankScores: Float64Array;
  modularityScore: number;
}

export function computeSignals(dataset: Dataset): DetectionSignals {
  const graph = buildGraph(dataset.entities, dataset.relationships, EVIDENTIAL_EDGE_TYPES);
  const communities = detectCommunities(graph);
  return {
    graph,
    communities,
    betweennessScores: betweenness(graph),
    pagerankScores: pagerank(graph),
    modularityScore: modularity(graph, communities),
  };
}

/**
 * Every anomaly below is produced by measuring the data against a stated
 * threshold, and each one carries the value it fired on plus the baseline it
 * was compared against, so the UI can always answer "why is this flagged".
 */
export function detectAnomalies(dataset: Dataset, signals: DetectionSignals): Anomaly[] {
  const found: Anomaly[] = [];
  const label = (id: string) => dataset.entities.find(e => e.id === id)?.label ?? id;

  /* --- 1. Communication bursts: per-entity daily call volume ------------- */
  const callsByEntityDay = new Map<string, Map<string, number>>();
  for (const c of dataset.cdrs) {
    const day = c.timestamp.slice(0, 10);
    if (!callsByEntityDay.has(c.caller)) callsByEntityDay.set(c.caller, new Map());
    const days = callsByEntityDay.get(c.caller)!;
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  for (const [entity, days] of callsByEntityDay) {
    const counts = [...days.values()];
    if (counts.length < 3) continue;
    const { mean, stdev } = meanStdev(counts);
    // A floor of 8 keeps very quiet entities from being flagged on a single
    // busy afternoon, which would swamp the list with meaningless leads.
    const threshold = Math.max(8, mean + 3 * stdev);
    for (const [day, count] of days) {
      if (count <= threshold) continue;
      found.push({
        id: `ANOM-COMM-${entity}-${day}`,
        type: 'communication',
        severity: count > mean + 5 * stdev ? 'high' : 'medium',
        entity,
        title: 'Unusual Communication Frequency',
        description:
          `${label(entity)} placed ${count} calls on ${day}, against a daily baseline of ` +
          `${mean.toFixed(1)} (sd ${stdev.toFixed(1)}) across ${counts.length} active days. ` +
          `That is ${((count - mean) / (stdev || 1)).toFixed(1)} standard deviations above their own norm.`,
        timestamp: `${day}T12:00:00.000Z`,
        relatedEntities: dataset.cdrs
          .filter(c => c.caller === entity && c.timestamp.slice(0, 10) === day)
          .map(c => c.receiver)
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 6),
        value: count,
        expectedRange: `${Math.max(0, mean - stdev).toFixed(1)} - ${(mean + stdev).toFixed(1)} calls/day`,
      });
    }
  }

  /* --- 2. Transaction amount outliers ----------------------------------- */
  const txBySender = new Map<string, typeof dataset.transactions>();
  for (const t of dataset.transactions) {
    if (!txBySender.has(t.sender)) txBySender.set(t.sender, []);
    txBySender.get(t.sender)!.push(t);
  }
  const allAmounts = dataset.transactions.map(t => t.amount);
  const globalStats = meanStdev(allAmounts);
  for (const [entity, txs] of txBySender) {
    if (txs.length < 3) continue;
    const amounts = txs.map(t => t.amount);
    const { mean, stdev } = meanStdev(amounts);
    const threshold = Math.max(mean + 3 * stdev, globalStats.mean + 2 * globalStats.stdev);
    const outliers = txs.filter(t => t.amount > threshold);
    if (outliers.length === 0) continue;
    const biggest = outliers.reduce((a, b) => (a.amount > b.amount ? a : b));
    found.push({
      id: `ANOM-TXN-${entity}`,
      type: 'transaction',
      severity: outliers.length > 1 || biggest.amount > threshold * 2 ? 'high' : 'medium',
      entity,
      title: 'Unusual Transaction Amount',
      description:
        `${label(entity)} sent ${outliers.length} transaction(s) above ${inr(threshold)}, the largest ` +
        `being ${inr(biggest.amount)}. Their own ${txs.length} transactions average ${inr(mean)} ` +
        `(sd ${inr(stdev)}), so this sits ${((biggest.amount - mean) / (stdev || 1)).toFixed(1)} ` +
        `standard deviations above their normal activity.`,
      timestamp: biggest.timestamp,
      relatedEntities: outliers.map(t => t.receiver).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
      value: biggest.amount,
      expectedRange: `${inr(Math.max(0, mean - stdev))} - ${inr(mean + stdev)}`,
    });
  }

  /* --- 3. Co-location clusters ------------------------------------------ */
  const byLocationHour = new Map<string, Set<string>>();
  for (const le of dataset.locationEvents) {
    const key = `${le.location}|${le.timestamp.slice(0, 13)}`;
    if (!byLocationHour.has(key)) byLocationHour.set(key, new Set());
    byLocationHour.get(key)!.add(le.entity);
  }
  for (const [key, group] of byLocationHour) {
    if (group.size < 4) continue;
    const [locationId, hour] = key.split('|');
    const locationName =
      dataset.locations.find(l => l.id === locationId)?.name ?? locationId;
    const members = [...group];
    found.push({
      id: `ANOM-LOC-${locationId}-${hour}`,
      type: 'location',
      severity: group.size >= 6 ? 'high' : 'medium',
      entity: members[0],
      title: 'Potential Shared-Location Pattern',
      description:
        `${group.size} entities were recorded at ${locationName} within the same hour ` +
        `(${hour}:00). Co-location of four or more parties is uncommon in this dataset and ` +
        `may indicate a meeting rather than incidental presence.`,
      timestamp: `${hour}:00:00.000Z`,
      relatedEntities: members.slice(1, 8),
      value: group.size,
      expectedRange: 'fewer than 4 entities per location-hour',
    });
  }

  /* --- 4. Structural bridges, from betweenness -------------------------- */
  const { graph, communities, betweennessScores } = signals;
  const personIds = new Set(dataset.persons.map(p => p.id));
  const bcValues = graph.nodes
    .map((id, i) => ({ id, i, bc: betweennessScores[i] }))
    .filter(x => personIds.has(x.id));
  const { mean: bcMean, stdev: bcStdev } = meanStdev(bcValues.map(x => x.bc));
  for (const { id, i, bc } of bcValues) {
    if (bcStdev === 0 || bc < bcMean + 2 * bcStdev) continue;
    const spanned = new Set(graph.adj[i].map(({ to }) => communities[to]));
    if (spanned.size < 3) continue;
    found.push({
      id: `ANOM-BRIDGE-${id}`,
      type: 'network',
      severity: bc > bcMean + 3 * bcStdev ? 'high' : 'medium',
      entity: id,
      title: 'Cross-Cluster Bridge Entity',
      description:
        `${label(id)} lies on a disproportionate share of the shortest paths through the network ` +
        `(betweenness ${bc.toFixed(0)} against a mean of ${bcMean.toFixed(0)}), and their direct ` +
        `contacts span ${spanned.size} separate detected groups. Removing this entity would ` +
        `measurably fragment the network.`,
      timestamp: dataset.metadata.createdAt,
      relatedEntities: graph.adj[i]
        .slice()
        .sort((a, b) => b.w - a.w)
        .slice(0, 6)
        .map(({ to }) => graph.nodes[to]),
      value: Math.round(bc),
      expectedRange: `below ${(bcMean + 2 * bcStdev).toFixed(0)} betweenness`,
    });
  }

  // Highest severity first, then by magnitude, so the list reads as a priority
  // queue for an investigator rather than an arbitrary dump.
  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  return found.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || (b.value ?? 0) - (a.value ?? 0),
  );
}

/* ------------------------------------------------------------------ *
 * Attention scoring - single source of truth
 * ------------------------------------------------------------------ */

export interface AttentionFactor {
  factor: string;
  points: number;
}

/**
 * Builds the score and the explanation together, from the same numbers, so the
 * factors shown in the UI always sum to the score displayed above them.
 *
 * This is explicitly not a measure of guilt or criminality. It ranks how much
 * of an analytical case there is for a human to look at an entity next.
 */
export function scoreEntities(
  dataset: Dataset,
  signals: DetectionSignals,
  anomalies: Anomaly[],
): Map<string, { score: number; breakdown: AttentionFactor[] }> {
  const { graph, betweennessScores, pagerankScores } = signals;
  const out = new Map<string, { score: number; breakdown: AttentionFactor[] }>();

  const bcMax = Math.max(...betweennessScores, 1);
  const prMax = Math.max(...pagerankScores, Number.EPSILON);

  const anomaliesByEntity = new Map<string, Anomaly[]>();
  for (const a of anomalies) {
    if (!anomaliesByEntity.has(a.entity)) anomaliesByEntity.set(a.entity, []);
    anomaliesByEntity.get(a.entity)!.push(a);
  }

  const connectionCounts = new Map<string, Map<RelationshipType, number>>();
  for (const r of dataset.relationships) {
    for (const side of [r.source, r.target]) {
      if (!connectionCounts.has(side)) connectionCounts.set(side, new Map());
      const m = connectionCounts.get(side)!;
      m.set(r.type, (m.get(r.type) ?? 0) + 1);
    }
  }

  for (const entity of dataset.entities) {
    const i = graph.index.get(entity.id);
    const breakdown: AttentionFactor[] = [];

    // Connectivity, capped so that a merely busy phone line cannot dominate.
    const degree = i === undefined ? 0 : graph.degree[i];
    if (degree > 0) {
      breakdown.push({ factor: `Connected to ${degree} other entities`, points: Math.min(degree * 2, 20) });
    }

    // Structural position.
    if (i !== undefined && betweennessScores[i] > 0) {
      const pts = Math.round((betweennessScores[i] / bcMax) * 20);
      if (pts > 0) breakdown.push({ factor: 'Bridging position between groups', points: pts });
    }
    if (i !== undefined && pagerankScores[i] > 0) {
      const pts = Math.round((pagerankScores[i] / prMax) * 10);
      if (pts > 0) breakdown.push({ factor: 'Influence within the network', points: pts });
    }

    // Evidence mix - breadth across independent data sources is more
    // interesting than volume within a single one.
    const byType = connectionCounts.get(entity.id) ?? new Map<RelationshipType, number>();
    const financial = byType.get('transacted') ?? 0;
    const cases = byType.get('mentioned_in') ?? 0;
    const comms = byType.get('called') ?? 0;
    if (financial >= 3) breakdown.push({ factor: `${financial} financial links`, points: 10 });
    if (cases >= 1) breakdown.push({ factor: `${cases} case association(s)`, points: 10 });
    if (comms >= 6) breakdown.push({ factor: `${comms} communication links`, points: 8 });

    const distinctSources = [financial, cases, comms].filter(v => v > 0).length;
    if (distinctSources >= 3) {
      breakdown.push({ factor: 'Corroborated across 3 data sources', points: 7 });
    }

    // Detected anomalies.
    for (const a of anomaliesByEntity.get(entity.id) ?? []) {
      breakdown.push({
        factor: a.title,
        points: a.severity === 'high' ? 20 : a.severity === 'medium' ? 12 : 6,
      });
    }

    const raw = breakdown.reduce((sum, f) => sum + f.points, 0);
    const score = Math.min(100, raw);

    // If the cap bit, scale the factors so they still sum to what is displayed.
    if (raw > 100 && raw > 0) {
      let running = 0;
      breakdown.forEach((f, idx) => {
        if (idx === breakdown.length - 1) {
          f.points = 100 - running;
        } else {
          f.points = Math.round((f.points / raw) * 100);
          running += f.points;
        }
      });
    }

    breakdown.sort((a, b) => b.points - a.points);
    out.set(entity.id, { score, breakdown });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Cluster assembly + validation against ground truth
 * ------------------------------------------------------------------ */

const GROUP_WORDS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];

export function buildClusters(dataset: Dataset, signals: DetectionSignals): Cluster[] {
  const { graph, communities } = signals;
  const groups = new Map<number, string[]>();
  communities.forEach((c, i) => {
    if (c < 0) return;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(graph.nodes[i]);
  });

  const typeOf = new Map(dataset.entities.map(e => [e.id, e.type] as const));

  return [...groups.entries()]
    // A pair is not a network. Anything smaller than three entities is noise.
    .filter(([, members]) => members.length >= 3)
    .map(([id, members]) => {
      const counts = new Map<string, number>();
      for (const m of members) {
        const t = typeOf.get(m);
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'person';
      const persons = members.filter(m => typeOf.get(m) === 'person').length;
      return {
        id,
        name: `Group ${GROUP_WORDS[id] ?? id + 1}`,
        entities: members,
        description:
          `${members.length} entities detected as a community by weighted label propagation ` +
          `(${persons} ${persons === 1 ? 'person' : 'persons'}, dominant type ${dominant}).`,
        dominantType: dominant as Cluster['dominantType'],
      };
    })
    .sort((a, b) => b.entities.length - a.entities.length);
}

export interface RecoveryReport {
  /** Planted groups that were substantially recovered by the detector. */
  recovered: number;
  /** Total planted groups in the labelled dataset. */
  total: number;
  /** Fraction of labelled entities placed with the plurality of their true group. */
  purity: number;
  perGroup: { name: string; size: number; largestShare: number; recovered: boolean }[];
}

/**
 * Compares detected communities against the labelled groups that the synthetic
 * dataset was built with.
 *
 * This is the honest way to make a claim about the detector: the labels are
 * ground truth the algorithm never sees, so recovering them is evidence the
 * detection works rather than an assertion that it does.
 */
export function evaluateRecovery(
  groundTruth: { name: string; entities: string[] }[],
  signals: DetectionSignals,
  threshold = 0.5,
): RecoveryReport {
  const { graph, communities } = signals;
  const communityOf = (id: string) => {
    const i = graph.index.get(id);
    return i === undefined ? -1 : communities[i];
  };

  let labelled = 0;
  let placedWithPlurality = 0;
  const perGroup: RecoveryReport['perGroup'] = [];

  for (const group of groundTruth) {
    const counts = new Map<number, number>();
    let known = 0;
    for (const id of group.entities) {
      const c = communityOf(id);
      if (c < 0) continue;
      known++;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const largest = [...counts.values()].sort((a, b) => b - a)[0] ?? 0;
    const share = known === 0 ? 0 : largest / known;
    labelled += known;
    placedWithPlurality += largest;
    perGroup.push({
      name: group.name,
      size: known,
      largestShare: share,
      recovered: share >= threshold,
    });
  }

  return {
    recovered: perGroup.filter(g => g.recovered).length,
    total: groundTruth.length,
    purity: labelled === 0 ? 0 : placedWithPlurality / labelled,
    perGroup,
  };
}

/* ------------------------------------------------------------------ *
 * Top-level entry point
 * ------------------------------------------------------------------ */

export interface AnalysisResult {
  clusters: Cluster[];
  anomalies: Anomaly[];
  scores: Map<string, { score: number; breakdown: AttentionFactor[] }>;
  signals: DetectionSignals;
  topInfluencers: { entityId: string; betweenness: number; pagerank: number; degree: number }[];
}

/**
 * Runs the whole detection pipeline over a dataset and returns everything the
 * UI needs. Does not mutate the dataset.
 */
export function analyze(dataset: Dataset): AnalysisResult {
  const signals = computeSignals(dataset);
  const anomalies = detectAnomalies(dataset, signals);
  const scores = scoreEntities(dataset, signals, anomalies);
  const clusters = buildClusters(dataset, signals);

  const personIds = new Set(dataset.persons.map(p => p.id));
  const topInfluencers = signals.graph.nodes
    .map((entityId, i) => ({
      entityId,
      betweenness: signals.betweennessScores[i],
      pagerank: signals.pagerankScores[i],
      degree: signals.graph.degree[i],
    }))
    .filter(x => personIds.has(x.entityId))
    .sort((a, b) => b.betweenness - a.betweenness)
    .slice(0, 10);

  return { clusters, anomalies, scores, signals, topInfluencers };
}
