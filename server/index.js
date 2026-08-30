const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { datasetOperations, settingsOperations, closeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Large limit for dataset JSON
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for CSV uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// ==================== Dataset Routes ====================

// GET /api/datasets - List all datasets
app.get('/api/datasets', (req, res) => {
  try {
    const datasets = datasetOperations.getAll();
    res.json(datasets);
  } catch (error) {
    console.error('Error fetching datasets:', error);
    res.status(500).json({ error: 'Failed to fetch datasets' });
  }
});

// GET /api/datasets/:id - Get dataset by ID
app.get('/api/datasets/:id', (req, res) => {
  try {
    const dataset = datasetOperations.getById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    res.json(dataset);
  } catch (error) {
    console.error('Error fetching dataset:', error);
    res.status(500).json({ error: 'Failed to fetch dataset' });
  }
});

// POST /api/datasets - Create or update dataset
app.post('/api/datasets', (req, res) => {
  try {
    const { id, name, data } = req.body;
    
    if (!id || !name || !data) {
      return res.status(400).json({ error: 'id, name, and data are required' });
    }
    
    const result = datasetOperations.upsert(id, name, data);
    res.json(result);
  } catch (error) {
    console.error('Error saving dataset:', error);
    res.status(500).json({ error: 'Failed to save dataset' });
  }
});

// DELETE /api/datasets/:id - Delete dataset
app.delete('/api/datasets/:id', (req, res) => {
  try {
    const result = datasetOperations.delete(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting dataset:', error);
    res.status(500).json({ error: 'Failed to delete dataset' });
  }
});

// DELETE /api/datasets - Delete all datasets
app.delete('/api/datasets', (req, res) => {
  try {
    datasetOperations.deleteAll();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all datasets:', error);
    res.status(500).json({ error: 'Failed to delete datasets' });
  }
});

// ==================== Settings Routes ====================

// GET /api/settings - Get AI settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = settingsOperations.get();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update AI settings
app.put('/api/settings', (req, res) => {
  try {
    const settings = settingsOperations.update(req.body);
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ==================== CSV Upload Routes ====================

// POST /api/upload/csv - Upload CSV file
app.post('/api/upload/csv', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const csvContent = req.file.buffer.toString('utf-8');
    const fileName = req.file.originalname;
    
    // Parse CSV client-side or return raw content
    // For now, return the CSV content for client-side parsing
    res.json({
      fileName,
      content: csvContent,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading CSV:', error);
    res.status(500).json({ error: 'Failed to upload CSV' });
  }
});

// ==================== Health Check ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== Error Handling ====================

// Handle multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message === 'Only CSV files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// General error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== Server Start ====================

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  GET    /api/datasets`);
  console.log(`  GET    /api/datasets/:id`);
  console.log(`  POST   /api/datasets`);
  console.log(`  DELETE /api/datasets/:id`);
  console.log(`  DELETE /api/datasets`);
  console.log(`  GET    /api/settings`);
  console.log(`  PUT    /api/settings`);
  console.log(`  POST   /api/upload/csv`);
  console.log(`  GET    /api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  closeDatabase();
  server.close(() => {
    process.exit(0);
  });
});
