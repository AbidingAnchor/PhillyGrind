const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Starting development servers...');

// Load .env file
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('Loading environment variables from .env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
    }
  });
}

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
  hasStripeKey: !!process.env.STRIPE_SECRET_KEY
});

// Start Vite dev server
const vite = spawn('npm', ['run', 'dev'], {
  shell: true,
  stdio: 'inherit',
  cwd: path.resolve(__dirname),
  env: { ...process.env, PORT: '5173' }
});

// Start Vercel dev server for API routes
const vercel = spawn('vercel', ['dev', '--listen', '3001', '--yes'], {
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
