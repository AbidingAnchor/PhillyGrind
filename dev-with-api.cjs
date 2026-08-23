const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const API_PORT = 3001;
const VITE_PORT = 5173;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => resolve(err.code === 'EADDRINUSE'))
      .once('listening', () => tester.close(() => resolve(false)))
      .listen(port, '127.0.0.1');
  });
}

console.log('Starting development servers...');

// Load .env and .env.local (Groq key lives in .env.local locally)
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  console.log(`Loading environment variables from ${path.basename(filePath)}`);
  const envContent = fs.readFileSync(filePath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
    }
  });
}

loadEnvFile(path.resolve(__dirname, '.env'));
loadEnvFile(path.resolve(__dirname, '.env.local'));

// Ensure VITE_ variables are also available without VITE_ prefix for server-side
if (process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
}
if (process.env.VITE_SUPABASE_ANON_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
}

console.log('Environment loaded:', {
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
  hasGroqKey: !!process.env.GROQ_API_KEY,
});

async function main() {
  if (await isPortInUse(API_PORT)) {
    console.error(`\nERROR: Port ${API_PORT} is already in use (stale API server).`);
    console.error('Vite proxies /api to that port, so code changes will NOT apply until it is free.');
    console.error('Stop the old process, then restart dev:full:\n');
    console.error(`  Get-NetTCPConnection -LocalPort ${API_PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
    console.error('  npm run dev:full\n');
    process.exit(1);
  }

  if (await isPortInUse(VITE_PORT)) {
    console.error(`\nERROR: Port ${VITE_PORT} is already in use (stale Vite server).`);
    console.error('Stop the old process, then restart dev:full:\n');
    console.error(`  Get-NetTCPConnection -LocalPort ${VITE_PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
    console.error('  npm run dev:full\n');
    process.exit(1);
  }

  console.log(`\nOpen the app at http://localhost:${VITE_PORT} (API only on :${API_PORT})\n`);
  startServers();
}

function startServers() {
const vite = spawn('npm', ['run', 'dev'], {
  shell: true,
  stdio: 'inherit',
  cwd: path.resolve(__dirname),
  env: { ...process.env }
});

// Start Vercel dev server for API routes (must stay on 3001 — vite.config.js proxy target)
const vercel = spawn('vercel', ['dev', '--listen', String(API_PORT), '--yes'], {
  shell: true,
  stdio: 'inherit',
  cwd: path.resolve(__dirname),
  env: { ...process.env }
});

vite.on('close', (code) => {
  console.log(`Vite process exited with code ${code}`);
  vercel.kill();
  process.exit(code || 0);
});

vercel.on('close', (code) => {
  console.log(`Vercel process exited with code ${code}`);
  vite.kill();
  process.exit(code || 0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\nShutting down development servers...');
  vite.kill();
  vercel.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down development servers...');
  vite.kill();
  vercel.kill();
  process.exit(0);
});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
