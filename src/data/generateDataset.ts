import type {
  Person, Phone, BankAccount, Location, Vehicle, FIR, Organization,
  CDR, Transaction, LocationEvent, Entity, Relationship, EntityType,
  RelationshipType, Anomaly, Cluster, TimelineEvent, Dataset,
  SocialMediaPost, IntelligenceReport,
} from '@/types';
import { analyze } from '@/analytics/detection';

const FIRST_NAMES = ['Arjun', 'Vikram', 'Neha', 'Rohan', 'Priya', 'Karan', 'Aisha', 'Dev', 'Meera', 'Sanjay', 'Riya', 'Aditya', 'Kavya', 'Rahul', 'Ananya', 'Vivek', 'Pooja', 'Manish', 'Sneha', 'Rajesh', 'Divya', 'Amit', 'Shreya', 'Nikhil', 'Tara', 'Kabir', 'Isha', 'Arnav', 'Nisha', 'Dhruv', 'Ritu', 'Sahil', 'Anjali', 'Yash', 'Maya', 'Gaurav', 'Lena', 'Faisal', 'Zara', 'Imran', 'Rohan', 'Sara', 'Veer', 'Mira', 'Akash', 'Nadia', 'Suresh', 'Bhavna', 'Tarun', 'Ramesh', 'Geeta', 'Anil', 'Sunita', 'Kiran', 'Mahesh', 'Lata', 'Prakash'];
const LAST_NAMES = ['Mehta', 'Shah', 'Verma', 'Kapoor', 'Nair', 'Reddy', 'Singh', 'Iyer', 'Gupta', 'Joshi', 'Rao', 'Malhotra', 'Chopra', 'Bose', 'Das', 'Khan', 'Pillai', 'Banerjee', 'Mishra', 'Agarwal', 'Saxena', 'Bhat', 'Menon', 'Trivedi'];
const OCCUPATIONS = ['Trader', 'Contractor', 'Businessman', 'Accountant', 'Driver', 'Shopkeeper', 'Consultant', 'Teacher', 'Engineer', 'Agent', 'Supplier', 'Dealer', 'Freelancer', 'Manager', 'Retired', 'Unknown'];
const LOCATIONS_LIST = ['Sector 12 Market', 'Warehouse North', 'Transit Hub 3', 'Riverside Dock', 'Central Bus Stand', 'Industrial Estate', 'Old City Quarter', 'Highway Motel', 'Border Checkpost', 'Cargo Terminal', 'Downtown Plaza', 'Suburban Station', 'Port Gate 7', 'Cold Storage Unit', 'Private Garage', 'Railway Yard', 'Airport Cargo', 'Market Square', 'Container Depot', 'Fuel Station', 'Abandoned Mill', 'Crossing Junction', 'Loading Bay', 'Customs Office', 'Parking Complex'];
const BANKS = ['HDFC', 'SBI', 'ICICI', 'Axis', 'PNB', 'Canara', 'BoB', 'Kotak'];
const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Motorcycle', 'Pickup'];
const CARRIERS = ['Airtel', 'Jio', 'Vi', 'BSNL'];
const PLATFORMS = ['Twitter', 'WhatsApp', 'Telegram', 'Instagram', 'Facebook'];
const INTEL_SOURCES = ['RAW Field Report', 'State Intelligence Bureau', 'NIA Technical Division', 'Cyber Cell Analysis', 'Financial Intelligence Unit', 'Border Security Input'];
const SENTIMENTS: Array<'positive' | 'negative' | 'neutral'> = ['positive', 'negative', 'neutral'];

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rng = seeded(20260826);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const pickN = <T,>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
};
const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

function pad(n: number, len: number) {
  return String(n).padStart(len, '0');
}

function ts(daysAgo: number, hour?: number): string {
  const d = new Date('2026-08-26T00:00:00');
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour ?? randInt(0, 23), randInt(0, 59), randInt(0, 59));
  return d.toISOString();
}

export function generateDataset(): Dataset {
  const persons: Person[] = [];
  const phones: Phone[] = [];
  const banks: BankAccount[] = [];
  const locations: Location[] = [];
  const vehicles: Vehicle[] = [];
  const firs: FIR[] = [];
  const organizations: Organization[] = [];
  const cdrs: CDR[] = [];
  const transactions: Transaction[] = [];
  const locationEvents: LocationEvent[] = [];

  // 60 persons in 6 clusters of 10
  for (let i = 1; i <= 60; i++) {
    persons.push({
      id: `P${pad(i, 3)}`,
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      age: randInt(24, 62),
      gender: rng() > 0.5 ? 'male' : 'female',
      occupation: pick(OCCUPATIONS),
      address: `Addr-${pad(i, 3)}`,
    });
  }

  // 30 phones
  for (let i = 1; i <= 30; i++) {
    phones.push({
      id: `PHONE-${pad(i, 3)}`,
      owner: `P${pad(randInt(1, 60), 3)}`,
      carrier: pick(CARRIERS),
    });
  }

  // 20 bank accounts
  for (let i = 1; i <= 20; i++) {
    banks.push({
      id: `BANK-${pad(i, 3)}`,
      owner: `P${pad(randInt(1, 60), 3)}`,
      bank: pick(BANKS),
      balance: randInt(5000, 500000),
    });
  }

  // 25 locations
  for (let i = 0; i < 25; i++) {
    locations.push({
      id: `LOC-${pad(i + 1, 2)}`,
      name: LOCATIONS_LIST[i],
      type: pick(['commercial', 'residential', 'industrial', 'transit', 'remote']),
    });
  }

  // 15 vehicles
  for (let i = 1; i <= 15; i++) {
    vehicles.push({
      id: `VEH-${pad(i, 3)}`,
      type: pick(VEHICLE_TYPES),
      owner: `P${pad(randInt(1, 60), 3)}`,
      registration: `DL-${randInt(1, 99)}-${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))}-${randInt(1000, 9999)}`,
    });
  }

  // 30 FIRs
  const firTitles = ['Financial Fraud Suspected', 'Unauthorized Movement of Goods', 'Suspicious Assembly', 'Cyber Transaction Irregularity', 'Cross-Border Movement Flag', 'Smuggling Intelligence Report', 'Hawala Channel Suspected', 'Fake Identity Investigation', 'Vehicle Misuse Report', 'Communication Pattern Alert'];
  for (let i = 1; i <= 30; i++) {
    const involved = pickN(persons.map(p => p.id), randInt(2, 5));
    firs.push({
      id: `FIR-2026-${pad(i, 3)}`,
      title: pick(firTitles),
      date: ts(randInt(1, 180)),
      section: `Sec ${randInt(120, 420)}`,
      status: pick(['open', 'under_investigation', 'closed']),
      entities: involved,
    });
  }

  // 5 organizations
  const orgNames = ['Blue Ocean Trading Co', 'Northwind Logistics', 'Summit Holdings', 'Crystal Imports', 'Apex Enterprises'];
  for (let i = 0; i < 5; i++) {
    organizations.push({
      id: `ORG-${pad(i + 1, 2)}`,
      name: orgNames[i],
      type: pick(['trading', 'logistics', 'holding', 'import-export', 'services']),
    });
  }

  // 25 social media posts
  const socialMediaPosts: SocialMediaPost[] = [];
  const postTemplates = [
    'Met at {location} today. Business looks promising.',
    'Package dispatched from {location}. Tracking in progress.',
    'Need to discuss the {location} matter urgently.',
    'Transfer completed. Check with contact at {location}.',
    'Meeting confirmed for next week near {location}.',
    'Shipment arrived at {location}. Quality check pending.',
    'Avoid {location} area — too much surveillance lately.',
    'New contact established through {location} connection.',
    'Payment received. Will visit {location} tomorrow.',
    'Status update: {location} operation on track.',
  ];
  for (let i = 1; i <= 25; i++) {
    const author = pick(persons).id;
    socialMediaPosts.push({
      id: `SMP-${pad(i, 3)}`,
      author,
      platform: pick(PLATFORMS),
      content: pick(postTemplates).replace('{location}', pick(LOCATIONS_LIST).toLowerCase()),
      timestamp: ts(randInt(0, 60)),
      mentions: pickN(persons.map(p => p.id), randInt(0, 3)),
      sentiment: pick(SENTIMENTS),
    });
  }

  // 10 intelligence reports
  const intelligenceReports: IntelligenceReport[] = [];
  const reportTitles = [
    'Surveillance Summary — Cross-District Activity',
    'Financial Flow Analysis — Suspicious Transfers',
    'Communication Intercept Summary',
    'Location Pattern Analysis — Meeting Points',
    'Vehicle Movement Tracking Report',
    'Network Infiltration Assessment',
    'Hawala Transaction Pattern Detected',
    'Cross-Border Movement Intelligence',
    'Digital Footprint Analysis — Key Suspects',
    'Operational Security Assessment',
  ];
  for (let i = 1; i <= 10; i++) {
    const involved = pickN(persons.map(p => p.id), randInt(3, 6));
    intelligenceReports.push({
      id: `INT-${pad(i, 3)}`,
      title: reportTitles[i - 1],
      source: pick(INTEL_SOURCES),
      date: ts(randInt(1, 90)),
      content: `Intelligence report regarding activity of entities: ${involved.join(', ')}. Analysis indicates coordinated pattern across multiple locations and communication channels. Recommend continued monitoring and cross-referencing with financial records.`,
      entities: involved,
      reliability: pick(['A', 'B', 'C', 'D'] as const),
      classification: pick(['verified', 'probably_true', 'possibly_true'] as const),
    });
  }

  // Define clusters: 6 groups of 10 persons
  const clusterDefs: { personIds: string[]; name: string; description: string; dominantType: EntityType }[] = [
    { personIds: persons.slice(0, 10).map(p => p.id), name: 'Cluster Alpha', description: 'High-frequency communication group', dominantType: 'person' },
    { personIds: persons.slice(10, 20).map(p => p.id), name: 'Cluster Beta', description: 'Shared location pattern group', dominantType: 'person' },
    { personIds: persons.slice(20, 30).map(p => p.id), name: 'Cluster Gamma', description: 'Financial transaction network', dominantType: 'person' },
    { personIds: persons.slice(30, 40).map(p => p.id), name: 'Cluster Delta', description: 'Cross-cluster bridge group', dominantType: 'person' },
    { personIds: persons.slice(40, 50).map(p => p.id), name: 'Cluster Epsilon', description: 'Vehicle sharing network', dominantType: 'person' },
    { personIds: persons.slice(50, 60).map(p => p.id), name: 'Cluster Zeta', description: 'Case association group', dominantType: 'person' },
  ];

  // Generate CDRs - heavy within clusters, sparse across
  for (let i = 0; i < 550; i++) {
    let caller: string, receiver: string;
    if (rng() < 0.7) {
      const c = clusterDefs[Math.floor(rng() * clusterDefs.length)];
      caller = pick(c.personIds);
      receiver = pick(c.personIds);
      while (receiver === caller) receiver = pick(c.personIds);
    } else {
      caller = `P${pad(randInt(1, 60), 3)}`;
      receiver = `P${pad(randInt(1, 60), 3)}`;
      while (receiver === caller) receiver = `P${pad(randInt(1, 60), 3)}`;
    }
    cdrs.push({
      id: `CDR-${pad(i + 1, 4)}`,
      caller, receiver,
      timestamp: ts(randInt(0, 90)),
      duration: randInt(10, 900),
      location: pick(locations).id,
      callType: pick(['incoming', 'outgoing', 'missed']) as CDR['callType'],
    });
  }

  // Plant communication anomaly: P001 makes 47 calls in 24h
  const anomalyDay = randInt(1, 30);
  for (let i = 0; i < 47; i++) {
    cdrs.push({
      id: `CDR-ANOM-${pad(i, 3)}`,
      caller: 'P001',
      receiver: pick(['P002', 'P003', 'P004', 'P005']),
      timestamp: ts(anomalyDay, randInt(0, 23)),
      duration: randInt(30, 300),
      location: 'LOC-01',
      callType: 'outgoing',
    });
  }

  // Generate transactions
  for (let i = 0; i < 320; i++) {
    let sender: string, receiver: string;
    if (rng() < 0.65) {
      const c = clusterDefs[Math.floor(rng() * clusterDefs.length)];
      sender = pick(c.personIds);
      receiver = pick(c.personIds);
      while (receiver === sender) receiver = pick(c.personIds);
    } else {
      sender = `P${pad(randInt(1, 60), 3)}`;
      receiver = `P${pad(randInt(1, 60), 3)}`;
      while (receiver === sender) receiver = `P${pad(randInt(1, 60), 3)}`;
    }
    transactions.push({
      id: `TXN-${pad(i + 1, 4)}`,
      sender, receiver,
      amount: randInt(1000, 50000),
      timestamp: ts(randInt(0, 90)),
      location: pick(locations).id,
      transactionType: pick(['transfer', 'cash', 'upi', 'cheque']) as Transaction['transactionType'],
    });
  }

  // Plant transaction anomaly
  transactions.push({ id: 'TXN-ANOM-001', sender: 'P011', receiver: 'P012', amount: 850000, timestamp: ts(randInt(0, 30)), location: 'LOC-02', transactionType: 'transfer' });
  transactions.push({ id: 'TXN-ANOM-002', sender: 'P011', receiver: 'P013', amount: 1200000, timestamp: ts(randInt(0, 30)), location: 'LOC-02', transactionType: 'transfer' });

  // Location events
  for (let i = 0; i < 220; i++) {
    let entity: string;
    if (rng() < 0.6) {
      const c = clusterDefs[Math.floor(rng() * clusterDefs.length)];
      entity = pick(c.personIds);
    } else {
      entity = `P${pad(randInt(1, 60), 3)}`;
    }
    locationEvents.push({
      id: `LOC-EVT-${pad(i + 1, 4)}`,
      entity,
      location: pick(locations).id,
      timestamp: ts(randInt(0, 90)),
      eventType: pick(['visit', 'meeting', 'sighting']) as LocationEvent['eventType'],
    });
  }

  // Plant location anomaly
  ['P021', 'P022', 'P023', 'P024'].forEach((pid, idx) => {
    locationEvents.push({ id: `LOC-ANOM-${pad(idx, 2)}`, entity: pid, location: 'LOC-05', timestamp: ts(randInt(0, 20), 14 + idx), eventType: 'meeting' });
  });

  // Build entities array
  const entities: Entity[] = [];
  persons.forEach(p => entities.push({ id: p.id, type: 'person', label: p.name, name: p.name, attributes: { age: p.age, gender: p.gender, occupation: p.occupation, address: p.address } }));
  phones.forEach(p => entities.push({ id: p.id, type: 'phone', label: p.id, attributes: { owner: p.owner, carrier: p.carrier } }));
  banks.forEach(b => entities.push({ id: b.id, type: 'bank', label: b.id, attributes: { owner: b.owner, bank: b.bank, balance: b.balance } }));
  locations.forEach(l => entities.push({ id: l.id, type: 'location', label: l.name, name: l.name, attributes: { type: l.type } }));
  vehicles.forEach(v => entities.push({ id: v.id, type: 'vehicle', label: v.id, attributes: { type: v.type, owner: v.owner, registration: v.registration } }));
  firs.forEach(f => entities.push({ id: f.id, type: 'fir', label: f.id, attributes: { title: f.title, date: f.date, section: f.section, status: f.status } }));
  organizations.forEach(o => entities.push({ id: o.id, type: 'organization', label: o.name, name: o.name, attributes: { type: o.type } }));
  socialMediaPosts.forEach(s => entities.push({ id: s.id, type: 'social_media_post', label: s.content.slice(0, 40) + '...', attributes: { platform: s.platform, author: s.author, sentiment: s.sentiment ?? 'neutral' } }));
  intelligenceReports.forEach(r => entities.push({ id: r.id, type: 'intelligence_report', label: r.title, attributes: { source: r.source, reliability: r.reliability, classification: r.classification } }));

  // Build relationships
  const relationships: Relationship[] = [];
  const relMap = new Map<string, Relationship>();

  const addRel = (source: string, target: string, type: RelationshipType, strength: 'low' | 'medium' | 'high', timestamp?: string, attrs?: Record<string, string | number>) => {
    const key = `${source}-${target}-${type}`;
    const existing = relMap.get(key);
    if (existing) {
      existing.weight += 1;
      const order = { low: 1, medium: 2, high: 3 };
      if (order[strength] > order[existing.strength]) existing.strength = strength;
      if (attrs) Object.assign(existing.attributes, attrs);
    } else {
      const r: Relationship = {
        id: `REL-${pad(relationships.length + 1, 4)}`,
        source, target, type, strength,
        weight: 1,
        timestamp,
        attributes: attrs ?? {},
      };
      relMap.set(key, r);
      relationships.push(r);
    }
  };

  // CDR relationships
  cdrs.forEach(c => {
    addRel(c.caller, c.receiver, 'called', c.duration > 300 ? 'high' : c.duration > 120 ? 'medium' : 'low', c.timestamp, { duration: c.duration, location: c.location });
  });

  // Transaction relationships
  transactions.forEach(t => {
    addRel(t.sender, t.receiver, 'transacted', t.amount > 30000 ? 'high' : t.amount > 10000 ? 'medium' : 'low', t.timestamp, { amount: t.amount, type: t.transactionType, location: t.location });
  });

  // Location events
  locationEvents.forEach(le => {
    addRel(le.entity, le.location, 'located_at', 'medium', le.timestamp, { eventType: le.eventType });
  });

  // Co-location connected_to
  const locByTimeLoc = new Map<string, string[]>();
  locationEvents.forEach(le => {
    const key = `${le.location}-${le.timestamp.slice(0, 13)}`;
    if (!locByTimeLoc.has(key)) locByTimeLoc.set(key, []);
    locByTimeLoc.get(key)!.push(le.entity);
  });
  locByTimeLoc.forEach(ents => {
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        if (ents[i] !== ents[j]) addRel(ents[i], ents[j], 'connected_to', 'low');
      }
    }
  });

  // FIR associations
  firs.forEach(f => {
    f.entities.forEach(eid => addRel(eid, f.id, 'mentioned_in', 'high', f.date, { title: f.title, section: f.section }));
    for (let i = 0; i < f.entities.length; i++) {
      for (let j = i + 1; j < f.entities.length; j++) {
        addRel(f.entities[i], f.entities[j], 'associated', 'medium');
      }
    }
  });

  // Vehicle sharing
  vehicles.forEach(v => addRel(v.owner, v.id, 'shared_vehicle', 'medium', undefined, { type: v.type, registration: v.registration }));
  for (let i = 0; i < 8; i++) {
    const c = clusterDefs[Math.floor(rng() * clusterDefs.length)];
    const v = vehicles[randInt(0, vehicles.length - 1)];
    const p = pick(c.personIds);
    if (p !== v.owner) addRel(p, v.id, 'shared_vehicle', 'medium');
  }

  // Phone & bank ownership
  phones.forEach(p => addRel(p.owner, p.id, 'connected_to', 'high', undefined, { carrier: p.carrier }));
  banks.forEach(b => addRel(b.owner, b.id, 'connected_to', 'high', undefined, { bank: b.bank, balance: b.balance }));

  // Organization associations
  organizations.forEach(o => {
    pickN(persons.map(p => p.id), randInt(2, 4)).forEach(m => addRel(m, o.id, 'associated', 'medium'));
  });

  // Social media relationships
  socialMediaPosts.forEach(s => {
    addRel(s.author, s.id, 'posted_by', 'medium', s.timestamp, { platform: s.platform });
    s.mentions.forEach(m => addRel(s.id, m, 'cites', 'low', s.timestamp));
  });

  // Intelligence report relationships
  intelligenceReports.forEach(r => {
    r.entities.forEach(eid => addRel(eid, r.id, 'authored_by', 'high', r.date, { source: r.source, reliability: r.reliability }));
  });

  // Cross-cluster bridges
  for (let i = 0; i < clusterDefs.length; i++) {
    const next = (i + 1) % clusterDefs.length;
    const a = pick(clusterDefs[i].personIds);
    const b = pick(clusterDefs[next].personIds);
    addRel(a, b, 'connected_to', 'high');
    for (let k = 0; k < 3; k++) {
      cdrs.push({ id: `CDR-BRIDGE-${i}-${k}`, caller: a, receiver: b, timestamp: ts(randInt(0, 60)), duration: randInt(60, 400), location: 'LOC-01', callType: 'outgoing' });
      addRel(a, b, 'called', 'high', ts(randInt(0, 60)), { duration: randInt(60, 400) });
    }
  }

  // Build preliminary dataset (without real analysis yet)
  const timeline: TimelineEvent[] = [];
  cdrs.slice(0, 100).forEach(c => {
    timeline.push({ id: `TL-${c.id}`, timestamp: c.timestamp, type: 'call', entity: c.caller, description: `${c.caller} called ${c.receiver} (${c.duration}s)`, relatedEntities: [c.receiver], location: c.location });
  });
  transactions.slice(0, 80).forEach(t => {
    timeline.push({ id: `TL-${t.id}`, timestamp: t.timestamp, type: 'transaction', entity: t.sender, description: `${t.sender} transacted ₹${t.amount.toLocaleString('en-IN')} with ${t.receiver}`, relatedEntities: [t.receiver], location: t.location });
  });
  locationEvents.slice(0, 60).forEach(le => {
    timeline.push({ id: `TL-${le.id}`, timestamp: le.timestamp, type: 'location', entity: le.entity, description: `${le.entity} appeared at ${le.location} (${le.eventType})`, relatedEntities: [], location: le.location });
  });
  firs.forEach(f => {
    timeline.push({ id: `TL-${f.id}`, timestamp: f.date, type: 'case', entity: f.entities[0] ?? '', description: `FIR ${f.id} filed: ${f.title}`, relatedEntities: f.entities.slice(1) });
  });
  socialMediaPosts.slice(0, 20).forEach(s => {
    timeline.push({ id: `TL-${s.id}`, timestamp: s.timestamp, type: 'meeting', entity: s.author, description: `Social post on ${s.platform}: "${s.content.slice(0, 60)}..."`, relatedEntities: s.mentions });
  });
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Build preliminary dataset, then run real detection
  const preliminary: Dataset = {
    persons, phones, banks, locations, vehicles, firs, organizations,
    socialMediaPosts, intelligenceReports,
    cdrs, transactions, locationEvents,
    entities, relationships,
    clusters: [],
    anomalies: [],
    timeline,
    analysisResult: { attentionScores: null, topInfluencers: [], modularityScore: 0 },
    metadata: {
      createdAt: new Date().toISOString(),
      lastAnalyzed: null,
      source: 'demo',
    },
  };

  // Run the REAL detection engine from detection.ts
  const result = analyze(preliminary);

  // Apply real analysis results back to the dataset
  const finalDataset: Dataset = {
    ...preliminary,
    clusters: result.clusters,
    anomalies: result.anomalies,
    analysisResult: {
      attentionScores: result.scores,
      topInfluencers: result.topInfluencers,
      modularityScore: result.signals.modularityScore,
    },
    metadata: {
      ...preliminary.metadata,
      lastAnalyzed: new Date().toISOString(),
    },
  };

  // Update entity scores and cluster assignments from real analysis
  for (const entity of finalDataset.entities) {
    const scoreData = result.scores.get(entity.id);
    if (scoreData) {
      entity.attentionScore = scoreData.score;
    }
  }

  // Assign cluster IDs from real community detection
  result.clusters.forEach(cluster => {
    cluster.entities.forEach(eid => {
      const entity = finalDataset.entities.find(e => e.id === eid);
      if (entity) entity.clusterId = cluster.id;
    });
  });

  return finalDataset;
}
