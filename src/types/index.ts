export type EntityType =
  | 'person'
  | 'phone'
  | 'bank'
  | 'location'
  | 'vehicle'
  | 'fir'
  | 'organization'
  | 'social_media_post'
  | 'intelligence_report';

export type RelationshipType =
  | 'called'
  | 'transacted'
  | 'located_at'
  | 'associated'
  | 'shared_vehicle'
  | 'mentioned_in'
  | 'connected_to'
  | 'posted_by'
  | 'authored_by'
  | 'cites';

export interface Entity {
  id: string;
  type: EntityType;
  label: string;
  name?: string;
  attributes: Record<string, string | number>;
  clusterId?: number;
  attentionScore?: number;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  strength: 'low' | 'medium' | 'high';
  weight: number;
  timestamp?: string;
  attributes: Record<string, string | number>;
}

export interface CDR {
  id: string;
  caller: string;
  receiver: string;
  timestamp: string;
  duration: number;
  location: string;
  callType: 'incoming' | 'outgoing' | 'missed';
}

export interface Transaction {
  id: string;
  sender: string;
  receiver: string;
  amount: number;
  timestamp: string;
  location: string;
  transactionType: 'transfer' | 'cash' | 'cheque' | 'upi';
}

export interface LocationEvent {
  id: string;
  entity: string;
  location: string;
  timestamp: string;
  eventType: 'visit' | 'meeting' | 'sighting';
}

export interface FIR {
  id: string;
  title: string;
  date: string;
  section: string;
  status: 'open' | 'closed' | 'under_investigation';
  entities: string[];
}

export interface Vehicle {
  id: string;
  type: string;
  owner: string;
  registration: string;
}

export interface Person {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  occupation: string;
  address: string;
}

export interface Phone {
  id: string;
  owner: string;
  carrier: string;
}

export interface BankAccount {
  id: string;
  owner: string;
  bank: string;
  balance: number;
}

export interface Location {
  id: string;
  name: string;
  type: string;
  coordinates?: { lat: number; lng: number };
}

export interface Organization {
  id: string;
  name: string;
  type: string;
}

export interface Anomaly {
  id: string;
  type: 'transaction' | 'communication' | 'location' | 'network';
  severity: 'high' | 'medium' | 'low';
  entity: string;
  title: string;
  description: string;
  timestamp: string;
  relatedEntities: string[];
  value?: number;
  expectedRange?: string;
}

export interface Cluster {
  id: number;
  name: string;
  entities: string[];
  description: string;
  dominantType: EntityType;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'call' | 'transaction' | 'location' | 'case' | 'meeting';
  entity: string;
  description: string;
  relatedEntities: string[];
  location?: string;
}

export interface SocialMediaPost {
  id: string;
  author: string;
  platform: string;
  content: string;
  timestamp: string;
  mentions: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface IntelligenceReport {
  id: string;
  title: string;
  source: string;
  date: string;
  content: string;
  entities: string[];
  reliability: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  classification: 'verified' | 'probably_true' | 'possibly_true' | 'doubtful' | 'impossible_to_judge' | 'checked_but_unable_to_be_judged';
}

export interface AnalysisResultData {
  attentionScores: Map<string, { score: number; breakdown: AttentionFactor[] }> | null;
  topInfluencers: { entityId: string; betweenness: number; pagerank: number; degree: number }[];
  modularityScore: number;
}

export interface AttentionFactor {
  factor: string;
  points: number;
}

export interface Dataset {
  persons: Person[];
  phones: Phone[];
  banks: BankAccount[];
  locations: Location[];
  vehicles: Vehicle[];
  firs: FIR[];
  organizations: Organization[];
  socialMediaPosts: SocialMediaPost[];
  intelligenceReports: IntelligenceReport[];
  cdrs: CDR[];
  transactions: Transaction[];
  locationEvents: LocationEvent[];
  entities: Entity[];
  relationships: Relationship[];
  clusters: Cluster[];
  anomalies: Anomaly[];
  timeline: TimelineEvent[];
  analysisResult: AnalysisResultData;
  metadata: {
    createdAt: string;
    lastAnalyzed: string | null;
    source: 'demo' | 'csv' | 'import';
  };
}

export interface NetworkMetrics {
  totalEntities: number;
  totalRelationships: number;
  detectedClusters: number;
  anomaliesDetected: number;
  highConnectivityEntities: number;
  topConnected: { entityId: string; degree: number }[];
  relationshipTypeDistribution: { type: RelationshipType; count: number }[];
  entityTypeDistribution: { type: EntityType; count: number }[];
  activityTimeline: { date: string; calls: number; transactions: number; locations: number }[];
}

export interface AISettings {
  provider: 'mock' | 'openai' | 'ollama' | 'custom';
  endpoint: string;
  model: string;
  apiKey: string;
}
