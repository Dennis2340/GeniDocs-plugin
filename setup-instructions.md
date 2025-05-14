# GeniDocs Plugin Setup Instructions

## Environment Variables

To properly run the GeniDocs plugin, you need to set up the following environment variables in your `.env` file:

```
# The ID of your GitHub App (from GitHub App settings)
APP_ID=1275456

# The webhook secret you configured when creating the GitHub App
# This MUST match the secret you set in GitHub
WEBHOOK_SECRET=your_webhook_secret_here

# Use `trace` to get verbose logging or `info` to show less
LOG_LEVEL=debug

# For local development, you can use a webhook proxy like Smee
# Go to https://smee.io/new and set this to the URL you are redirected to
WEBHOOK_PROXY_URL=your_smee_url_here

# Documentation server URL
DOCS_SERVER_URL=http://localhost:3000

# API key for authentication with the documentation server (if required)
DOCS_API_KEY=your_api_key_here

# Port for the Probot app (to avoid conflicts with your documentation server)
PORT=3002
```

## Setting Up Webhook Forwarding for Local Development

For local development, you need to set up webhook forwarding to receive GitHub events on your local machine:

1. Go to https://smee.io/new
2. Copy the URL you are redirected to
3. Add this URL as the `WEBHOOK_PROXY_URL` in your `.env` file
4. Install the smee client: `npm install -g smee-client`
5. Start the smee client: `smee -u https://smee.io/your-smee-url -t http://localhost:3002/api/github/webhooks`
6. In another terminal, start your Probot app: `npm start`

## GitHub App Configuration

Make sure your GitHub App is configured with:

1. The correct webhook URL (your Smee URL for development)
2. The same webhook secret as in your `.env` file
3. The necessary permissions:
   - Repository contents: Read
   - Pull requests: Read
   - Issues: Write
   - Metadata: Read
4. Subscribe to events:
   - Push
   - Pull request
   - Issues

## Testing the Plugin

After setting up the environment variables and starting the app, you can:

1. Make changes to your repository
2. Create a pull request
3. Check the logs to see if the plugin is detecting the changes
4. Verify that documentation is being generated on your documentation server
