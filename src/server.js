require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'changeme';

// Data storage file
const dataDir = path.join(__dirname, '../data');
const dbFile = path.join(dataDir, 'requests.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database file if it doesn't exist
if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, JSON.stringify({ requests: [] }, null, 2));
}

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.text({ limit: '10mb' }));
app.use(express.raw({ limit: '10mb' }));

// Load requests from file
function loadRequests() {
  try {
    const data = fs.readFileSync(dbFile, 'utf8');
    return JSON.parse(data).requests || [];
  } catch (err) {
    console.error('Error loading requests:', err);
    return [];
  }
}

// Save requests to file
function saveRequests(requests) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify({ requests }, null, 2));
  } catch (err) {
    console.error('Error saving requests:', err);
  }
}

// Verify auth token
function verifyToken(req) {
  const token = req.query.token || req.headers['x-auth-token'] || req.headers['authorization']?.replace('Bearer ', '');
  return token === AUTH_TOKEN;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!verifyToken(req)) {
    return res.status(401).send('Unauthorized. Use ?token=YOUR_TOKEN');
  }

  const requests = loadRequests();
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSRF Listener Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 2.5em; margin-bottom: 5px; }
    .header p { font-size: 0.9em; opacity: 0.9; }
    .controls {
      padding: 20px 30px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .controls button {
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      background: #667eea;
      color: white;
      cursor: pointer;
      font-size: 0.9em;
      transition: background 0.3s;
    }
    .controls button:hover { background: #764ba2; }
    .controls button.danger {
      background: #e74c3c;
    }
    .controls button.danger:hover {
      background: #c0392b;
    }
    .stats {
      display: flex;
      gap: 15px;
      font-size: 0.9em;
    }
    .stat {
      padding: 10px 15px;
      background: #f5f5f5;
      border-radius: 5px;
    }
    .stat strong { color: #667eea; }
    .content {
      padding: 30px;
      max-height: 70vh;
      overflow-y: auto;
    }
    .empty {
      text-align: center;
      color: #999;
      padding: 60px 20px;
    }
    .empty svg {
      width: 100px;
      height: 100px;
      margin-bottom: 20px;
      opacity: 0.3;
    }
    .request-item {
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      background: #f9f9f9;
      transition: all 0.2s;
    }
    .request-item:hover {
      background: #f0f0f0;
      border-color: #667eea;
    }
    .request-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 10px;
    }
    .method {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 0.85em;
      color: white;
    }
    .method.GET { background: #3498db; }
    .method.POST { background: #2ecc71; }
    .method.PUT { background: #f39c12; }
    .method.DELETE { background: #e74c3c; }
    .method.HEAD { background: #95a5a6; }
    .method.OPTIONS { background: #9b59b6; }
    .path {
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      margin: 8px 0;
      word-break: break-all;
      color: #333;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      font-size: 0.85em;
      color: #666;
      margin: 10px 0;
    }
    .meta-item { display: flex; gap: 5px; }
    .meta-label { font-weight: bold; color: #333; }
    .body {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.85em;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
      margin-top: 10px;
    }
    .timestamp { font-size: 0.8em; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 SSRF Listener</h1>
      <p>Penetration Testing Callback Server</p>
    </div>

    <div class="controls">
      <div class="stats">
        <div class="stat">Total Hits: <strong>${requests.length}</strong></div>
      </div>
      <div>
        <button onclick="refreshPage()">🔄 Refresh</button>
        <button class="danger" onclick="clearAll()">🗑️ Clear All</button>
      </div>
    </div>

    <div class="content">
      ${requests.length === 0 ? `
        <div class="empty">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
          </svg>
          <h3>No SSRF hits yet</h3>
          <p>Waiting for callbacks...</p>
        </div>
      ` : `
        ${requests.reverse().map(req => `
          <div class="request-item">
            <div class="request-header">
              <div>
                <span class="method ${req.method}">${req.method}</span>
              </div>
              <span class="timestamp">${new Date(req.timestamp).toLocaleString()}</span>
            </div>
            <div class="path">${req.path}${req.query ? '?' + req.query : ''}</div>
            <div class="meta">
              <div class="meta-item"><span class="meta-label">IP:</span> ${req.ip}</div>
              <div class="meta-item"><span class="meta-label">ID:</span> ${req.id}</div>
            </div>
            ${req.userAgent ? `<div class="meta"><div class="meta-label">User-Agent:</div> ${req.userAgent}</div>` : ''}
            ${req.body ? `<div class="body">${escapeHtml(req.body.substring(0, 500))}${req.body.length > 500 ? '...' : ''}</div>` : ''}
          </div>
        `).join('')}
      `}
    </div>
  </div>

  <script>
    function refreshPage() {
      location.reload();
    }
    
    function clearAll() {
      if (confirm('Are you sure? This will delete all logged requests.')) {
        fetch('/api/requests?token=${req.query.token || AUTH_TOKEN}', {
          method: 'DELETE',
          headers: { 'x-auth-token': '${req.query.token || AUTH_TOKEN}' }
        }).then(() => refreshPage());
      }
    }

    function escapeHtml(text) {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Auto-refresh every 5 seconds
    setInterval(refreshPage, 5000);
  </script>
</body>
</html>
  `;

  res.send(html);
});

// API: Get all requests
app.get('/api/requests', (req, res) => {
  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let requests = loadRequests();
  const search = req.query.search?.toLowerCase();

  if (search) {
    requests = requests.filter(r =>
      r.path.toLowerCase().includes(search) ||
      r.ip.includes(search) ||
      r.userAgent?.toLowerCase().includes(search) ||
      r.body?.toLowerCase().includes(search)
    );
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const start = (page - 1) * limit;
  const paginated = requests.slice(start, start + limit);

  res.json({
    total: requests.length,
    page,
    limit,
    data: paginated
  });
});

// API: Get single request
app.get('/api/requests/:id', (req, res) => {
  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const requests = loadRequests();
  const request = requests.find(r => r.id === req.params.id);

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.json(request);
});

// API: Clear all requests
app.delete('/api/requests', (req, res) => {
  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  saveRequests([]);
  res.json({ message: 'All requests cleared', count: 0 });
});

// API: Export requests as JSON
app.get('/api/export', (req, res) => {
  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const requests = loadRequests();
  res.setHeader('Content-Disposition', 'attachment; filename="ssrf_hits.json"');
  res.json(requests);
});

// Catch-all endpoint - log all SSRF callbacks
app.all('*', (req, res) => {
  // Extract IP address (with X-Forwarded-For support for proxies)
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
             req.headers['x-real-ip'] ||
             req.socket.remoteAddress ||
             'unknown';

  // Build body from different content types
  let body = '';
  if (req.body) {
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      body = req.body.toString();
    } else {
      body = JSON.stringify(req.body);
    }
  }

  // Log the request
  const newRequest = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? new URLSearchParams(req.query).toString() : '',
    ip,
    userAgent: req.get('user-agent') || '',
    headers: req.headers,
    body: body.substring(0, 2000),
    bodySize: body.length,
  };

  const requests = loadRequests();
  requests.push(newRequest);
  saveRequests(requests);

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${ip}`);

  // Respond with JSON
  res.json({
    received: true,
    id: newRequest.id,
    timestamp: newRequest.timestamp
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ SSRF Listener running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard?token=${AUTH_TOKEN}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
