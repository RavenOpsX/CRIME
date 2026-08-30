const Database = require('better-sqlite3');
const path = require('path');

// Create database in server directory
const DB_PATH = path.join(__dirname, 'crime_network.db');

let db;

function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Better performance
    db.pragma('foreign_keys = ON');
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  // Main dataset table - stores the entire dataset as JSON for simplicity
  // This is pragmatic for an MVP; can normalize later if needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // AI settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      provider TEXT DEFAULT 'mock',
      endpoint TEXT DEFAULT '',
      model TEXT DEFAULT '',
      api_key TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Insert default settings if not exists
  const settingsExist = db.prepare('SELECT COUNT(*) as count FROM ai_settings').get();
  if (settingsExist.count === 0) {
    db.prepare('INSERT INTO ai_settings (provider) VALUES (?)').run('mock');
  }

  console.log('Database initialized successfully');
}

// Dataset operations
const datasetOperations = {
  // Get all datasets
  getAll: () => {
    const db = getDatabase();
    return db.prepare('SELECT id, name, created_at, updated_at FROM datasets ORDER BY updated_at DESC').all();
  },

  // Get dataset by ID
  getById: (id) => {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM datasets WHERE id = ?').get(id);
    if (row) {
      row.data = JSON.parse(row.data);
    }
    return row;
  },

  // Create or update dataset
  upsert: (id, name, data) => {
    const db = getDatabase();
    const jsonData = JSON.stringify(data);
    
    const stmt = db.prepare(`
      INSERT INTO datasets (id, name, data, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        data = excluded.data,
        updated_at = datetime('now')
    `);
    
    stmt.run(id, name, jsonData);
    return { id, name, updated_at: new Date().toISOString() };
  },

  // Delete dataset
  delete: (id) => {
    const db = getDatabase();
    return db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
  },

  // Delete all datasets
  deleteAll: () => {
    const db = getDatabase();
    return db.prepare('DELETE FROM datasets').run();
  }
};

// Settings operations
const settingsOperations = {
  get: () => {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM ai_settings WHERE id = 1').get();
    if (row) {
      return {
        provider: row.provider,
        endpoint: row.endpoint,
        model: row.model,
        apiKey: row.api_key
      };
    }
    return { provider: 'mock', endpoint: '', model: '', apiKey: '' };
  },

  update: (settings) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE ai_settings 
      SET provider = ?, endpoint = ?, model = ?, api_key = ?, updated_at = datetime('now')
      WHERE id = 1
    `);
    stmt.run(settings.provider, settings.endpoint, settings.model, settings.apiKey);
    return settings;
  }
};

// Close database connection
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase,
  datasetOperations,
  settingsOperations
};
