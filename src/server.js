#!/usr/bin/env node

console.log('🚀 Starting SSRF Listener...');

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

console.log('📋 Configuration:');
console.log('   PORT:', PORT);
console.log('   AUTH_TOKEN:', AUTH_TOKEN === 'changeme' ? '(default)' : '(custom)');

// Data storage
const dataDir = path.join(__dirname, '../data');
const dbFile = path.join(dataDir, 'requests.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ requests: [] }, null, 2));
  }
  console.log('✓ Data directory ready:', dataDir);
} catch (err) {
  console.error('❌ Error setting up data directory:', err.message);
  process.exit(1);
}

// Middleware
app.use(helmet());
app.use(morgan('combined'));

// Parse incoming data
app.use((req, res, next) => {
  let data = '';
  
  req.on('data', chunk => {
    data += chunk;
    if (data.length > 10485760) {
      req.destroy();
    }
  });

  req.on('end', () => {
    req.rawBody = data;
    next();
  });

  req.on('error', (err) => {
    console.error('Request error:', err.message);
    res.status(400).json({ error: 'Bad request' });
  });
});

// Load/save data
function loadRequests() {
  try {
    const data = fs.readFileSync(dbFile, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed.requests) ? parsed.requests : [];
  } catch (err) {
    console.error('Error loading requests:', err.message);
    return [];
  }
}

function saveRequests(requests) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify({ requests }, null, 2));
  } catch (err) {
    console.error('Error saving requests:', err.message);
  }
}

function verifyToken(req) {
  const token = req.query.token || req.headers['x-auth-token'];
  return token === AUTH_TOKEN;
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!verifyToken(req)) {
    return res.status(401).send('Unauthorized. Use ?token=' + AUTH_TOKEN);
  }

  const requests = loadRequests();
  
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSRF Listener</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-top: 0; }
    .stats { display: flex; gap: 20px; margin: 20px 0; }
    .stat { background: #f0f0f0; padding: 15px; border-radius: 5px; }
    button { padding: 10px 15px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
    button:hover { background: #764ba2; }
    button.danger { background: #e74c3c; }
    button.danger:hover { background: #c0392b; }
    .request { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .method { display: inline-block; padding: 3px 8px; background: #3498db; color: white; border-radius: 3px; margin-right: 10px; font-weight: bold; }
    .path { font-family: monospace; margin: 5px 0; }
    .meta { font-size: 0.9em; color: #666; margin-top: 10px; }
    .empty { text-align: center; color: #999; padding: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 SSRF Listener</h1>
    <div class="stats">
      <div class="stat">Total Hits: <strong>${requests.length}</strong></div>
    </div>
    <div>
      <button onclick="location.reload()">🔄 Refresh</button>
      <button class="danger" onclick="clearAll()">🗑️ Clear All</button>
    </div>
    
    <div id="requests">
      ${requests.length === 0 ? '<div class="empty">No SSRF hits yet. Waiting for callbacks...</div>' : requests.reverse().map(r => `
        <div class="request">
          <div><span class="method">${r.method}</span><span class="path">${r.path}${r.query ? '?' + r.query : ''}</span></div>
          <div class="meta">
            <div>IP: ${r.ip}</div>
            <div>ID: ${r.id}</div>
            <div>Time: ${new Date(r.timestamp).toLocaleString()}</div>
            ${r.userAgent ? '<div>User-Agent: ' + r.userAgent + '</div>' : ''}
            ${r.body ? '<div style="margin-top: 10px; background: #f9f9f9; padding: 10px; border-radius: 3px; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 0.85em;">' + r.body.substring(0, 500) + (r.body.length > 500 ? '...' : '') + '</div>' : ''}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    function clearAll() {
      if (confirm('Delete all requests?')) {
        fetch('/api/requests?token=${AUTH_TOKEN}', { method: 'DELETE', headers: { 'x-auth-token': '${AUTH_TOKEN}' } })
          .then(() => location.reload());
      }
    }
    setInterval(() => location.reload(), 5000);
  </script>
</body>
</html>`);
});

// API endpoints
app.get('/api/requests', (req, res) => {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ data: loadRequests() });
});

app.delete('/api/requests', (req, res) => {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });
  saveRequests([]);
  res.json({ success: true });
});

app.get('/api/export', (req, res) => {
  if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });
  res.download(dbFile, 'ssrf_hits.json');
});

// Catch-all for SSRF callbacks
app.all('*', (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 
               req.headers['x-real-ip'] || 
               req.socket.remoteAddress || 
               'unknown';

    let body = req.rawBody || '';

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
    };

    const requests = loadRequests();
    requests.push(newRequest);
    saveRequests(requests);

    console.log(`✓ ${req.method} ${req.path} from ${ip}`);

    res.json({ received: true, id: newRequest.id });
  } catch (err) {
    console.error('Error in catch-all:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ SSRF Listener started on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard?token=${AUTH_TOKEN}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🎯 Listening for callbacks...\n`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
});
