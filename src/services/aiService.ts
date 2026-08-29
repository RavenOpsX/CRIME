import type { Dataset, AISettings } from '@/types';
import { getConnections, getDegree, getAttentionBreakdown } from '@/analytics/networkAnalytics';

const DISCLAIMER = 'This is an analytical lead based on synthetic data and does not establish criminal activity, guilt, wrongdoing, or criminal intent. Any real-world action would require authorized investigation and human review.';

const OLLAMA_DEFAULT = 'http://localhost:11434';

function getEndpoint(settings: AISettings): string {
  if (settings.provider === 'ollama') return settings.endpoint || OLLAMA_DEFAULT;
  if (settings.provider === 'openai') return settings.endpoint || 'https://api.openai.com/v1';
  if (settings.provider === 'custom') return settings.endpoint;
  return '';
}

async function callOllama(prompt: string, settings: AISettings): Promise<string | null> {
  const endpoint = getEndpoint(settings);
  if (!endpoint) return null;

  try {
    const resp = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model || 'llama3.2',
        prompt,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.response || null;
  } catch {
    return null;
  }
}

async function callOpenAI(prompt: string, settings: AISettings): Promise<string | null> {
  const endpoint = getEndpoint(settings);
  if (!endpoint || !settings.apiKey) return null;

  try {
    const resp = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are an AI investigative analyst assistant. You analyze criminal network data and provide factual, analytical summaries. Always include a disclaimer that findings are analytical leads, not evidence of guilt.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

async function callAI(prompt: string, settings: AISettings): Promise<string | null> {
  if (settings.provider === 'mock') return null;
  if (settings.provider === 'ollama') return callOllama(prompt, settings);
  if (settings.provider === 'openai') return callOpenAI(prompt, settings);
  if (settings.provider === 'custom') return callOllama(prompt, settings);
  return null;
}

function buildInvestigationContext(dataset: Dataset): string {
  const { entities, relationships, clusters, anomalies, persons, cdrs, transactions } = dataset;
  const topAnomalies = anomalies.slice(0, 5).map(a =>
    `- ${a.title} (${a.severity}): ${a.description}`
  ).join('\n');

  const clusterSummary = clusters.map(c =>
    `- ${c.name}: ${c.entities.length} entities (${c.description})`
  ).join('\n');

  const topConnected = relationships
    .reduce((acc, r) => {
      acc.set(r.source, (acc.get(r.source) ?? 0) + 1);
      acc.set(r.target, (acc.get(r.target) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  const topTen = [...topConnected.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return `DATASET SUMMARY:
- ${persons.length} persons, ${entities.length} total entities, ${relationships.length} relationships
- ${cdrs.length} call records, ${transactions.length} transactions
- ${clusters.length} detected clusters, ${anomalies.length} anomalies

DETECTED CLUSTERS:
${clusterSummary || 'None detected.'}

TOP CONNECTED ENTITIES:
${topTen.map(([id, deg]) => `- ${id}: ${deg} connections`).join('\n') || 'None.'}

DETECTED ANOMALIES:
${topAnomalies || 'None detected.'}

Note: All data is synthetic for demonstration purposes.`;
}

export async function generateInvestigationSummary(dataset: Dataset, settings: AISettings): Promise<string> {
  const context = buildInvestigationContext(dataset);
  const prompt = `Based on the following criminal network analysis dataset, provide a concise investigative summary (2-3 paragraphs). Focus on: key findings, the most important entities, cluster structure, and any concerning patterns. Be specific with entity IDs and numbers.

${context}

Remember: These are analytical leads, not evidence of criminal activity. End with the standard disclaimer.`;

  const aiResult = await callAI(prompt, settings);
  if (aiResult) return aiResult + '\n\n' + DISCLAIMER;

  // Fallback: template-based summary
  const { entities, relationships, clusters, anomalies } = dataset;
  const topEntity = entities.find(e => e.id === dataset.anomalies[0]?.entity) ?? entities[0];
  const summary = `Network analysis identified ${entities.length} entities and ${relationships.length} relationships across ${clusters.length} clusters. ${anomalies.length} anomalies were detected requiring investigator attention. The most analytically significant entity is ${topEntity.id} (${topEntity.label}) with an attention score of ${topEntity.attentionScore ?? 0}. Key clusters include ${clusters.map(c => `${c.name} (${c.entities.length} entities)`).join(', ')}. Several high-severity anomalies were flagged, including ${anomalies.filter(a => a.severity === 'high').map(a => a.title.toLowerCase()).join(' and ')}. These findings represent potential analytical leads that warrant further investigation. ${DISCLAIMER}`;
  return summary;
}

export async function analyzeEntity(entityId: string, dataset: Dataset, settings: AISettings): Promise<string> {
  const entity = dataset.entities.find(e => e.id === entityId);
  if (!entity) return 'Entity not found in the dataset.';

  const context = buildInvestigationContext(dataset);
  const conns = getConnections(entityId, dataset);
  const breakdown = getAttentionBreakdown(entityId, dataset);
  const entityContext = `
ENTITY DETAILS:
- ID: ${entity.id}, Label: ${entity.label}, Type: ${entity.type}
- Connections: ${conns.length}
- Attention Score: ${entity.attentionScore ?? 0}/100
- Score Breakdown: ${breakdown.map(b => `${b.factor} (+${b.points})`).join(', ')}
- Connected to: ${conns.slice(0, 10).map(c => `${c.entity} (${c.relationship}, weight: ${c.weight})`).join(', ')}`;

  const prompt = `Analyze this specific entity within the criminal network context. What is their role? Are they a hub, bridge, or peripheral figure? What patterns surround them?

${context}

${entityContext}

Provide a focused 1-2 paragraph analysis. End with disclaimer.`;

  const aiResult = await callAI(prompt, settings);
  if (aiResult) return aiResult + '\n\n' + DISCLAIMER;

  // Fallback
  const commLinks = conns.filter(c => c.relationship === 'called').length;
  const finLinks = conns.filter(c => c.relationship === 'transacted').length;
  const caseLinks = conns.filter(c => c.relationship === 'mentioned_in').length;
  const cluster = dataset.clusters.find(c => c.entities.includes(entityId));
  const entityAnomalies = dataset.anomalies.filter(a => a.entity === entityId);

  const parts: string[] = [];
  parts.push(`Entity ${entity.id} (${entity.label}) has ${conns.length} total connections, including ${commLinks} communication links, ${finLinks} transaction links, and ${caseLinks} case associations.`);
  if (cluster) parts.push(`It participates in ${cluster.name}, described as "${cluster.description}".`);
  if (entityAnomalies.length > 0) parts.push(`${entityAnomalies.length} unusual pattern(s) were identified: ${entityAnomalies.map(a => a.title).join(', ')}.`);
  parts.push(`The analytical attention score of ${entity.attentionScore ?? 0}/100 is driven by: ${breakdown.map(b => `${b.factor} (+${b.points})`).join(', ')}.`);
  parts.push('These findings represent potential associations and unusual patterns that may warrant further review by an authorized investigator.');
  parts.push(DISCLAIMER);
  return parts.join(' ');
}

export async function explainRelationship(sourceId: string, targetId: string, dataset: Dataset, settings: AISettings): Promise<string> {
  const source = dataset.entities.find(e => e.id === sourceId);
  const target = dataset.entities.find(e => e.id === targetId);
  if (!source || !target) return 'One or both entities not found.';

  const rels = dataset.relationships.filter(r =>
    (r.source === sourceId && r.target === targetId) || (r.source === targetId && r.target === sourceId)
  );

  if (rels.length === 0) return `No direct relationship found between ${sourceId} and ${targetId}. They may be connected through indirect paths — try the shortest path finder in Network Analysis.`;

  const prompt = `Explain the relationship between two entities in this criminal network:

Source: ${source.id} (${source.label}, type: ${source.type})
Target: ${target.id} (${target.label}, type: ${target.type})

Direct relationships: ${rels.map(r => `${r.type} (strength: ${r.strength}, weight: ${r.weight})`).join('; ')}

What does this relationship pattern suggest? Are there indirect connections? Provide 1-2 paragraphs of analytical commentary. End with disclaimer.`;

  const aiResult = await callAI(prompt, settings);
  if (aiResult) return aiResult + '\n\n' + DISCLAIMER;

  const relSummary = rels.map(r => `${r.type} (strength: ${r.strength}, weight: ${r.weight})`).join('; ');
  return `The relationship between ${source.label} and ${target.label} involves: ${relSummary}. This represents a potential association that requires verification. ${DISCLAIMER}`;
}

export async function summarizeNetwork(dataset: Dataset, settings: AISettings): Promise<string> {
  const context = buildInvestigationContext(dataset);
  const prompt = `Provide a comprehensive network-level analysis of this criminal network. Cover: overall structure, community detection results, key influencers, data quality observations, and recommended next steps for investigation.

${context}

Provide 3-4 paragraphs of analytical insight. End with disclaimer.`;

  const aiResult = await callAI(prompt, settings);
  if (aiResult) return aiResult + '\n\n' + DISCLAIMER;

  const { entities, relationships, clusters, anomalies } = dataset;
  const clusterSummary = clusters.map(c => `${c.name}: ${c.entities.length} entities (${c.description})`).join('; ');
  return `The network contains ${entities.length} entities connected by ${relationships.length} relationships, organized into ${clusters.length} clusters. ${clusterSummary}. ${anomalies.length} anomalies were detected. These findings represent analytical leads, not factual accusations. ${DISCLAIMER}`;
}

export async function testConnection(settings: AISettings): Promise<{ success: boolean; message: string }> {
  if (settings.provider === 'mock') {
    return { success: true, message: 'Mock AI provider is always available. Responses are template-based.' };
  }

  const endpoint = getEndpoint(settings);
  if (!endpoint) {
    return { success: false, message: 'No endpoint configured.' };
  }

  try {
    if (settings.provider === 'ollama') {
      const resp = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json();
        const models = data.models?.map((m: { name: string }) => m.name).join(', ') || 'none';
        return { success: true, message: `Connected to Ollama. Available models: ${models}` };
      }
      return { success: false, message: `Ollama connection failed (HTTP ${resp.status}). Is Ollama running?` };
    }

    if (settings.provider === 'openai') {
      if (!settings.apiKey) return { success: false, message: 'API key required for OpenAI.' };
      const resp = await fetch(`${endpoint}/models`, {
        headers: { 'Authorization': `Bearer ${settings.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) return { success: true, message: 'Connected to OpenAI API.' };
      return { success: false, message: `OpenAI connection failed (HTTP ${resp.status}). Check API key.` };
    }

    // Custom endpoint — try a simple ping
    const resp = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) return { success: true, message: `Connected to custom endpoint at ${endpoint}.` };
    return { success: false, message: `Custom endpoint returned HTTP ${resp.status}.` };
  } catch (err) {
    return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}. Is the service running?` };
  }
}
