/**
 * Placeholder dev server for `vercel dev`.
 * Vite runs separately on :5173; this process only keeps Vercel's dev harness alive
 * so /api serverless routes are served on :3001 without a second Vite instance.
 */
const http = require('http');

const port = Number(process.env.PORT) || 3001;

const server = http.createServer((_req, res) => {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('PhillyGrind API dev server — open http://localhost:5173 for the app.\n');
});

server.listen(port, () => {
  console.log(`[vercel-api-only] API routes on http://localhost:${port}/api/*`);
  console.log('[vercel-api-only] Frontend: http://localhost:5173');
});
