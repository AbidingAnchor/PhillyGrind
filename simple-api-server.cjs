const { createServer } = require('http');
const { createReadStream } = require('fs');
const path = require('path');

// Simple API server that proxies to the api/ directory
const apiServer = createServer((req, res) => {
  console.log(`[API Server] ${req.method} ${req.url}`);
  
  // Only handle API requests
  if (!req.url.startsWith('/api/')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Load and execute the API route
  const apiPath = path.resolve(__dirname, 'api', req.url.replace('/api/', ''));
  const handlerPath = path.resolve(__dirname, 'api', req.url.replace('/api/', '').split('?')[0] + '.js');

  if (!handlerPath.startsWith(path.resolve(__dirname, 'api'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    // This is a simplified approach - for full functionality, use the actual Vercel runtime
    // For now, just return a 501 to indicate this needs proper serverless runtime
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'API routes require Vercel dev or production environment',
      message: 'Use `vercel dev` for full API functionality locally'
    }));
  } catch (error) {
    console.error('[API Server] Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

apiServer.listen(3001, () => {
  console.log('Simple API server running on http://localhost:3001');
  console.log('Note: This is a simplified server. For full API functionality, use Vercel dev.');
});
