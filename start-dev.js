/**
 * Development starter script for GeniDocs plugin
 * This script starts both the Smee client and the Probot app
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3002;
const WEBHOOK_PROXY_URL = process.env.WEBHOOK_PROXY_URL;

if (!WEBHOOK_PROXY_URL) {
  console.error('ERROR: WEBHOOK_PROXY_URL is not set in .env file');
  process.exit(1);
}

console.log('Starting GeniDocs plugin development environment...');
console.log(`Webhook Proxy URL: ${WEBHOOK_PROXY_URL}`);
console.log(`App will run on port: ${PORT}`);

// Start Smee client
console.log('\n📡 Starting Smee client to forward webhooks...');
const smeeArgs = [
  'smee-client',
  '-u', WEBHOOK_PROXY_URL,
  '-t', `http://localhost:${PORT}/api/github/webhooks`,
  '-p', '8080'
];
const smeeProcess = spawn('npx', smeeArgs, { 
  stdio: 'inherit',
  shell: true
});

// Start Probot app
console.log('\n🤖 Starting Probot app...');
const probotArgs = ['probot', 'run', './index.js'];
const probotProcess = spawn('npx', probotArgs, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: PORT.toString()
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development environment...');
  smeeProcess.kill();
  probotProcess.kill();
  process.exit(0);
});

// Log errors
smeeProcess.on('error', (error) => {
  console.error(`Smee client error: ${error.message}`);
});

probotProcess.on('error', (error) => {
  console.error(`Probot app error: ${error.message}`);
});

console.log('\n✅ Development environment is running!');
console.log('Make changes to your repository to test the plugin.');
console.log('Press Ctrl+C to stop the development environment.');
