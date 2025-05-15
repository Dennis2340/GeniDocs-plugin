import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Send file changes to the documentation server
 * @param {Object} data - The data containing file changes
 * @param {string} data.owner - Repository owner
 * @param {string} data.repo - Repository name
 * @param {string} data.branch - Branch name
 * @param {Array} data.files - Array of file objects with path, content, and changeType
 * @returns {Promise<Object>} - Response from the documentation server
 */
export async function sendToDocumentationServer(data) {
  const docsServerUrl = process.env.DOCS_SERVER_URL;
  const apiKey = process.env.DOCS_API_KEY;

  if (!docsServerUrl) {
    throw new Error('DOCS_SERVER_URL not configured');
  }

  try {
    // Filter files to only include those that should be documented
    const documentableFiles = data.files.filter(file => shouldDocumentFile(file.path));
    
    // Create the payload in the format expected by the documentation API
    const payload = {
      owner: data.owner,
      repo: data.repo,
      // Include branch information if available
      ...(data.branch && { branch: data.branch }),
      // Include PR number if available
      ...(data.prNumber && { prNumber: data.prNumber }),
      // Include additional data needed by the API
      files: documentableFiles.map(file => ({
        path: file.path,
        content: file.content || '',
        changeType: file.changeType,
        ...(file.additions && { additions: file.additions }),
        ...(file.deletions && { deletions: file.deletions }),
        ...(file.changes && { changes: file.changes })
      }))
    };

    const response = await axios.post(
      `${docsServerUrl}/api/generate`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error sending to documentation server:', error.message);
    throw error;
  }
}

/**
 * Determine if a file is worth documenting
 * @param {string} filename - The file path/name to check
 * @returns {boolean} - Whether the file should be documented
 */
export function shouldDocumentFile(filename) {
  // Skip common files that don't need documentation
  const skipPatterns = [
    /node_modules/,
    /\.git/,
    /\.DS_Store/,
    /package-lock\.json/,
    /yarn\.lock/,
    /\.env/,
    /\.log$/,
    /\.map$/,
    /\.min\.(js|css)$/,
    /^dist\//,
    /^build\//,
    /\.next\//,
    /\.cache\//,
    /\.vscode\//,
    /\.idea\//,
    /\.github\//,
    /^coverage\//,
    /^__tests__\//,
    /^test\//,
    /^tests\//,
    /\.test\./,
    /\.spec\./,
    /\.d\.ts$/,
    /\.config\./,
    /\.eslintrc/,
    /\.prettierrc/,
    /\.babelrc/,
    /tsconfig/,
    /webpack/,
    /rollup/,
    /jest/,
    /karma/,
    /cypress/,
    /\.svg$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.ico$/,
    /\.woff/,
    /\.ttf/,
    /\.eot/,
    /\.otf/,
  ];

  if (skipPatterns.some(pattern => pattern.test(filename))) {
    return false;
  }

  // File extensions that are worth documenting
  const documentableExtensions = [
    ".js", ".jsx", ".ts", ".tsx", 
    ".py", ".java", ".go", ".rb", ".php", ".cs", ".c", ".cpp", ".h", ".swift", ".kt", ".rs",
    ".html", ".css", ".scss", ".less", ".json", ".yml", ".yaml", ".sh", ".bash", ".zsh", ".ps1"
  ];

  const extension = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return documentableExtensions.includes(extension);
}
