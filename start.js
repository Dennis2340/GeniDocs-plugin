/**
 * Custom starter script for the GeniDocs plugin
 * This script sets up a persistent connection for webhooks
 */

import { run } from "probot";
import app from "./index.js";
import dotenv from "dotenv";
import SmeeClient from "smee-client";

// Load environment variables
dotenv.config();

// Set the PORT environment variable to 3002 (or any other available port)
process.env.PORT = process.env.PORT || "3002";

// Get webhook proxy URL from environment
const webhookProxyUrl = process.env.WEBHOOK_PROXY_URL;

// Set up Smee client for webhook forwarding if URL is provided
let smeeClient;
if (webhookProxyUrl) {
  console.log(`Setting up webhook forwarding: ${webhookProxyUrl} -> http://localhost:${process.env.PORT}/api/github/webhooks`);
  
  smeeClient = new SmeeClient({
    source: webhookProxyUrl,
    target: `http://localhost:${process.env.PORT}/api/github/webhooks`,
    logger: console
  });
  
  // Start forwarding webhooks
  const events = smeeClient.start();
  
  // Handle disconnection
  events.on('error', (err) => {
    console.error('Smee client error:', err);
    // Attempt to reconnect
    setTimeout(() => {
      console.log('Attempting to reconnect Smee client...');
      smeeClient.start();
    }, 5000);
  });
}

// Run the app with persistent connection
run(app).then(server => {
  console.log(`GeniDocs plugin server running on port ${process.env.PORT}`);
  console.log(`Webhook path: /api/github/webhooks`);
  console.log(`Webhook forwarding: ${webhookProxyUrl ? 'Enabled' : 'Disabled'}`);
  console.log(`\nServer is ready to process GitHub events!`);
  console.log(`Press Ctrl+C to stop the server.`);
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    if (smeeClient) {
      console.log('Stopping webhook forwarding...');
    }
    process.exit(0);
  });
}).catch(error => {
  console.error("Failed to start GeniDocs plugin:", error);
  process.exit(1);
});
