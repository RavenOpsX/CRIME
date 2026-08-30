# Crime Network Analysis - Backend Server

Express + SQLite backend for persistent storage of investigation datasets.

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start
# or
node index.js
```

Server runs on `http://localhost:3001`

## API Endpoints

### Datasets
- `GET /api/datasets` - List all datasets
- `GET /api/datasets/:id` - Get dataset by ID
- `POST /api/datasets` - Create or update dataset
- `DELETE /api/datasets/:id` - Delete dataset
- `DELETE /api/datasets` - Delete all datasets

### Settings
- `GET /api/settings` - Get AI settings
- `PUT /api/settings` - Update AI settings

### Upload
- `POST /api/upload/csv` - Upload CSV file (multipart/form-data)

### Health
- `GET /api/health` - Server health check

## Database

SQLite database stored at `./crime_network.db`

- **datasets** - Stores investigation datasets as JSON
- **ai_settings** - Stores AI provider configuration

## Running with Frontend

From project root:
```bash
# Start both frontend and backend
npm run dev:all

# Or start separately
npm run dev:server  # Backend
npm run dev         # Frontend (Vite)
```

## Environment Variables

- `PORT` - Server port (default: 3001)
