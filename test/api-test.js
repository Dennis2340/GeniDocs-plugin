import axios from 'axios';
import dotenv from 'dotenv';
import { sendToDocumentationServer, shouldDocumentFile } from '../utils/api.js';

dotenv.config();

/**
 * Test function to simulate a code change and send it to the documentation API
 */
async function testDocumentationUpdate() {
  console.log('Starting API test...');
  
  // Get repository information from command line arguments
  const args = process.argv.slice(2);
  const owner = args[0] || 'Dennis2340';
  const repo = args[1] || 'GeniDocs';
  const branch = args[2] || 'main';
  
  console.log(`Using repository: ${owner}/${repo} (branch: ${branch})`);
  
  // Sample data representing a code change
  const testData = {
    owner,
    repo,
    branch,
    files: [
      {
        path: 'src/index.js',
        content: `
/**
 * Main application entry point
 */
function main() {
  console.log('Hello, world!');
}

main();
`,
        changeType: 'modified'
      },
      {
        path: 'src/utils/helper.js',
        content: `
/**
 * Helper function to format data
 * @param {Object} data - The data to format
 * @returns {string} - Formatted data
 */
export function formatData(data) {
  return JSON.stringify(data, null, 2);
}
`,
        changeType: 'added'
      },
      {
        path: 'package-lock.json',
        content: '{ "name": "test" }',
        changeType: 'modified'
      }
    ]
  };

  try {
    // First, test the shouldDocumentFile function
    console.log('Testing file filtering:');
    testData.files.forEach(file => {
      const shouldDocument = shouldDocumentFile(file.path);
      console.log(`- ${file.path}: ${shouldDocument ? 'Will document' : 'Will skip'}`);
    });

    // Check if DOCS_SERVER_URL is configured
    if (!process.env.DOCS_SERVER_URL) {
      console.error('Error: DOCS_SERVER_URL is not configured in .env file');
      console.log('Please set DOCS_SERVER_URL in your .env file and try again');
      return;
    }

    // Send test data to documentation server
    console.log(`\nSending test data to documentation server: ${process.env.DOCS_SERVER_URL}`);
    const response = await sendToDocumentationServer(testData);
    
    console.log('\nResponse from documentation server:');
    console.log(JSON.stringify(response, null, 2));
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.status, error.response.data);
    }
  }
}

// Run the test
testDocumentationUpdate();
