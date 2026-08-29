/**
 * NLP-lite entity extraction from free-text inputs.
 * Uses regex patterns and heuristics — no ML dependency required.
 * Designed for police reports, surveillance notes, and intelligence memos.
 */

import type { Entity, Relationship, EntityType, RelationshipType } from '@/types';

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  context: string; // surrounding text snippet
}

export interface ExtractedRelationship {
  source: string;
  sourceType: EntityType;
  target: string;
  targetType: EntityType;
  type: RelationshipType;
  context: string;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  summary: string;
}

// ── Pattern Definitions ──────────────────────────────────────────────

const PHONE_PATTERN = /\b(\+?91[\s-]?\d{10}|\b\d{10}\b|\b\d{5}\s?\d{5}\b)\b/g;
const VEHICLE_PATTERN = /\b([A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,2}[\s-]?\d{4})\b/g;
const AMOUNT_PATTERN = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/g;
const DATE_PATTERN = /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;
const SECTION_PATTERN = /\b(?:Sec(?:tion)?\.?\s*)(\d+[A-Z]?)\b/gi;
const LOCATION_KEYWORDS = [
  'at', 'near', 'from', 'to', 'in', 'around', 'outside', 'inside',
  'approaching', 'departing', 'stationed at', 'seen at', 'located at',
];

const PERSON_KEYWORDS = [
  'suspect', 'accused', 'witness', 'informant', 'handler', 'associate',
  'contact', 'person', 'individual', 'male', 'female', 'subject',
];

const ORG_KEYWORDS = [
  'company', 'firm', 'corporation', 'ltd', 'pvt', 'enterprise',
  'trading', 'logistics', 'bank', 'cooperative', 'society',
];

// ── Extraction Functions ─────────────────────────────────────────────

function extractPhoneNumbers(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  let match;
  while ((match = PHONE_PATTERN.exec(text)) !== null) {
    const start = Math.max(0, match.index - 40);
    const end = Math.min(text.length, match.index + match[0].length + 40);
    results.push({
      type: 'phone',
      value: match[1].replace(/\s/g, ''),
      context: text.slice(start, end).trim(),
    });
  }
  return results;
}

function extractVehicleNumbers(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  let match;
  while ((match = VEHICLE_PATTERN.exec(text)) !== null) {
    const start = Math.max(0, match.index - 40);
    const end = Math.min(text.length, match.index + match[0].length + 40);
    results.push({
      type: 'vehicle',
      value: match[1],
      context: text.slice(start, end).trim(),
    });
  }
  return results;
}

function extractSections(text: string): string[] {
  const results: string[] = [];
  let match;
  while ((match = SECTION_PATTERN.exec(text)) !== null) {
    results.push(`Sec ${match[1]}`);
  }
  return results;
}

/**
 * Extract locations by looking for preposition phrases.
 * This is heuristic — a production system would use NER.
 */
function extractLocations(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of LOCATION_KEYWORDS) {
    const regex = new RegExp(
      `\\b${keyword}\\s+([A-Z][a-zA-Z\\s]{2,30}?)(?:\\s*(?:,|\\.|;|\\b(?:on|at|in|for|with|during|while|after|before|the|was|were|has|had|is|are)\\b))`,
      'gi'
    );
    let match;
    while ((match = regex.exec(text)) !== null) {
      const location = match[1].trim();
      if (location.length > 2 && !/^\d/.test(location)) {
        results.push({
          type: 'location',
          value: location,
          context: text.slice(
            Math.max(0, match.index - 20),
            Math.min(text.length, match.index + match[0].length + 20)
          ).trim(),
        });
      }
    }
  }
  return results;
}

/**
 * Extract person mentions by looking for capitalized names after keywords
 * or standalone capitalized two-word names (Indian name pattern).
 */
function extractPersons(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  const lowerText = text.toLowerCase();

  // Pattern 1: "suspect John Smith" type mentions
  for (const keyword of PERSON_KEYWORDS) {
    const regex = new RegExp(
      `\\b${keyword}\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){1,2})\\b`,
      'gi'
    );
    let match;
    while ((match = regex.exec(text)) !== null) {
      results.push({
        type: 'person',
        value: match[1].trim(),
        context: text.slice(
          Math.max(0, match.index - 20),
          Math.min(text.length, match.index + match[0].length + 20)
        ).trim(),
      });
    }
  }

  // Pattern 2: Indian-style names (e.g., "Arjun Mehta", "Vikram Singh")
  const indianNamePattern = /\b((?:Arjun|Vikram|Neha|Rohan|Priya|Karan|Aisha|Dev|Meera|Sanjay|Riya|Aditya|Kavya|Rahul|Ananya|Vivek|Pooja|Manish|Sneha|Rajesh|Divya|Amit|Shreya|Nikhil|Tara|Kabir|Isha|Arnav|Nisha|Dhruv|Ritu|Sahil|Anjali|Yash|Maya|Gaurav|Imran|Suresh|Kiran|Prakash)\s+[A-Z][a-z]+)\b/g;
  let match;
  while ((match = indianNamePattern.exec(text)) !== null) {
    // Avoid duplicates
    if (!results.some(r => r.value === match![1])) {
      results.push({
        type: 'person',
        value: match[1],
        context: text.slice(
          Math.max(0, match.index - 30),
          Math.min(text.length, match.index + match[0].length + 30)
        ).trim(),
      });
    }
  }

  return results;
}

function extractAmounts(text: string): { value: number; context: string }[] {
  const results: { value: number; context: string }[] = [];
  let match;
  while ((match = AMOUNT_PATTERN.exec(text)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 40);
      results.push({ value: amount, context: text.slice(start, end).trim() });
    }
  }
  return results;
}

function extractOrganizations(text: string): ExtractedEntity[] {
  const results: ExtractedEntity[] = [];
  for (const keyword of ORG_KEYWORDS) {
    const regex = new RegExp(
      `\\b([A-Z][a-zA-Z\\s]{2,25}\\s+${keyword})\\b`,
      'gi'
    );
    let match;
    while ((match = regex.exec(text)) !== null) {
      results.push({
        type: 'organization',
        value: match[1].trim(),
        context: text.slice(
          Math.max(0, match.index - 20),
          Math.min(text.length, match.index + match[0].length + 20)
        ).trim(),
      });
    }
  }
  return results;
}

// ── Main Extraction Pipeline ─────────────────────────────────────────

export function extractEntities(text: string): ExtractionResult {
  if (!text.trim()) {
    return { entities: [], relationships: [], summary: 'No text provided.' };
  }

  // Run all extractors
  const phones = extractPhoneNumbers(text);
  const vehicles = extractVehicleNumbers(text);
  const locations = extractLocations(text);
  const persons = extractPersons(text);
  const amounts = extractAmounts(text);
  const orgs = extractOrganizations(text);
  const sections = extractSections(text);

  // Deduplicate by value
  const dedup = <T extends ExtractedEntity>(items: T[]): T[] => {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = `${item.type}:${item.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const allEntities = dedup([...persons, ...phones, ...vehicles, ...locations, ...orgs]);

  // Build relationships: person↔phone, person↔vehicle, person↔location, person↔organization
  const relationships: ExtractedRelationship[] = [];

  persons.forEach(person => {
    phones.forEach(phone => {
      if (text.toLowerCase().includes('phone') || text.toLowerCase().includes('called')) {
        relationships.push({
          source: person.value,
          sourceType: 'person',
          target: phone.value,
          targetType: 'phone',
          type: 'connected_to',
          context: `Phone association found in text`,
        });
      }
    });

    vehicles.forEach(vehicle => {
      relationships.push({
        source: person.value,
        sourceType: 'person',
        target: vehicle.value,
        targetType: 'vehicle',
        type: 'shared_vehicle',
        context: `Vehicle association found in text`,
      });
    });

    locations.forEach(location => {
      relationships.push({
        source: person.value,
        sourceType: 'person',
        target: location.value,
        targetType: 'location',
        type: 'located_at',
        context: location.context,
      });
    });

    orgs.forEach(org => {
      relationships.push({
        source: person.value,
        sourceType: 'person',
        target: org.value,
        targetType: 'organization',
        type: 'associated',
        context: org.context,
      });
    });
  });

  // Build summary
  const parts: string[] = [];
  if (persons.length) parts.push(`${persons.length} person(s) identified`);
  if (phones.length) parts.push(`${phones.length} phone number(s) found`);
  if (vehicles.length) parts.push(`${vehicles.length} vehicle(s) detected`);
  if (locations.length) parts.push(`${locations.length} location(s) mentioned`);
  if (orgs.length) parts.push(`${orgs.length} organization(s) referenced`);
  if (amounts.length) parts.push(`${amounts.length} financial amount(s) noted (total: ₹${amounts.reduce((s, a) => s + a.value, 0).toLocaleString('en-IN')})`);
  if (sections.length) parts.push(`Legal sections: ${sections.join(', ')}`);

  return {
    entities: allEntities,
    relationships,
    summary: parts.length > 0
      ? `Extracted: ${parts.join('. ')}.`
      : 'No structured entities found in the provided text.',
  };
}

/**
 * Convert extracted entities/relationships into dataset-compatible objects
 * that can be merged into the existing dataset.
 */
export function toDatasetFormat(
  extraction: ExtractionResult,
  existingPersonIds: Set<string>,
  existingLocationIds: Set<string>,
): { entities: Entity[]; relationships: Relationship[] } {
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];
  let relCounter = 0;

  for (const ext of extraction.entities) {
    // Only add if not already in dataset
    if (ext.type === 'person' && existingPersonIds.has(ext.value)) continue;
    if (ext.type === 'location' && existingLocationIds.has(ext.value)) continue;

    entities.push({
      id: `NLP-${ext.type.toUpperCase().slice(0, 3)}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: ext.type,
      label: ext.value,
      name: ext.value,
      attributes: { extractedFrom: 'nlp', context: ext.context },
    });
  }

  for (const rel of extraction.relationships) {
    relationships.push({
      id: `NLP-REL-${++relCounter}`,
      source: rel.source,
      target: rel.target,
      type: rel.type,
      strength: 'medium',
      weight: 1,
      attributes: { extractedFrom: 'nlp', context: rel.context },
    });
  }

  return { entities, relationships };
}
