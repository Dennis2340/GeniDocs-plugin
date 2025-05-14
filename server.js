/**
 * Custom server for GeniDocs plugin
 * This ensures the app stays running and processes all GitHub events
 */

import { Server, Probot } from 'probot';
import app from './index.js';
import dotenv from 'dotenv';
import SmeeClient from 'smee-client';

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3002;
const WEBHOOK_PROXY_URL = process.env.WEBHOOK_PROXY_URL;
const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Create a new Probot instance
const probot = new Probot({
  appId: APP_ID,
  privateKey: PRIVATE_KEY,
  secret: WEBHOOK_SECRET,
  logLevel: process.env.LOG_LEVEL || 'info',
});

// Load the app
probot.load(app);

// Create a server
const server = new Server({
  Probot: probot,
  port: PORT,
  webhookPath: '/api/github/webhooks',
  webhookProxy: WEBHOOK_PROXY_URL
});

// Set up Smee client for webhook forwarding if URL is provided
let smee;
if (WEBHOOK_PROXY_URL) {
  smee = new SmeeClient({
    source: WEBHOOK_PROXY_URL,
    target: `http://localhost:${PORT}/api/github/webhooks`,
    logger: console
  });
  
  // Start forwarding webhooks
  const events = smee.start();
  
  // Handle disconnection
  events.on('error', (err) => {
    console.error('Smee client error:', err);
    // Attempt to reconnect
    setTimeout(() => {
      console.log('Attempting to reconnect Smee client...');
      smee.start();
    }, 5000);
  });
  
  console.log(`Webhook forwarding enabled: ${WEBHOOK_PROXY_URL} -> http://localhost:${PORT}/api/github/webhooks`);
}

// Start the server
server.start()
  .then(() => {
    console.log(`GeniDocs plugin server is running on port ${PORT}`);
    console.log('GitHub App ID:', APP_ID);
    console.log('Webhook path:', '/api/github/webhooks');
    console.log('Log level:', process.env.LOG_LEVEL || 'info');
    console.log('\nServer is ready to process GitHub events!');
    console.log('Press Ctrl+C to stop the server.');
  })
  .catch((err) => {
    console.error('Error starting server:', err);
    process.exit(1);
  });

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  if (smee) {
    smee.close();
    console.log('Webhook forwarding stopped.');
  }
  server.stop()
    .then(() => {
      console.log('Server stopped.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error stopping server:', err);
      process.exit(1);
    });
});
