import axios from 'axios';
import dotenv from 'dotenv';
import { sendToDocumentationServer, shouldDocumentFile } from './utils/api.js';

dotenv.config();

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  app.log.info("Code Change Tracker loaded!");

  // Keep the original issues.opened handler
  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    return context.octokit.issues.createComment(issueComment);
  });

  // Handle push events (direct commits to branches)
  app.on("push", async (context) => {
    const payload = context.payload;
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const branch = payload.ref.replace('refs/heads/', '');
    const commits = payload.commits;

    app.log.info(`Push detected in ${owner}/${repo} on branch ${branch}`);
    app.log.info(`Number of commits: ${commits.length}`);
    
    // Extract changed files from all commits
    const changedFiles = new Set();
    commits.forEach(commit => {
      app.log.info(`Processing commit: ${commit.id} - ${commit.message}`);
      // Add all types of file changes (added, modified, removed)
      app.log.info(`Files added: ${commit.added.length}, modified: ${commit.modified.length}, removed: ${commit.removed.length}`);
      
      commit.added.forEach(file => {
        app.log.info(`Added file: ${file}`);
        changedFiles.add({ path: file, changeType: 'added' });
      });
      
      commit.modified.forEach(file => {
        app.log.info(`Modified file: ${file}`);
        changedFiles.add({ path: file, changeType: 'modified' });
      });
      
      commit.removed.forEach(file => {
        app.log.info(`Removed file: ${file}`);
        changedFiles.add({ path: file, changeType: 'removed' });
      });
    });

    app.log.info(`Total unique changed files: ${changedFiles.size}`);
    
    if (changedFiles.size > 0) {
      await processChangedFiles(context, owner, repo, branch, Array.from(changedFiles));
    } else {
      app.log.warn('No changed files detected in this push. This might be a merge commit or a push without file changes.');
    }
  });

  // Handle pull request events
  app.on(["pull_request.opened", "pull_request.synchronize", "pull_request.reopened"], async (context) => {
    const payload = context.payload;
    const repo = payload.repository.name;
    const owner = payload.repository.owner.login;
    const prNumber = payload.pull_request.number;
    const branch = payload.pull_request.head.ref;

    app.log.info(`Pull request #${prNumber} activity detected in ${owner}/${repo}`);

    // Get the list of files changed in the PR
    const { data: changedFiles } = await context.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Format the changed files
    const formattedChanges = changedFiles.map(file => ({
      path: file.filename,
      changeType: getChangeType(file.status),
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes
    }));

    if (formattedChanges.length > 0) {
      await processChangedFiles(context, owner, repo, branch, formattedChanges, prNumber);
    }
  });

  /**
   * Process changed files and send updates to documentation server
   * @param {Object} context - Probot context
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @param {Array} changedFiles - List of changed files
   * @param {number} [prNumber] - Pull request number (if applicable)
   */
  async function processChangedFiles(context, owner, repo, branch, changedFiles, prNumber = null) {
    app.log.info(`Processing ${changedFiles.length} changed files`);

    try {
      // For each changed file, get its content if it wasn't deleted
      const filesWithContent = await Promise.all(
        changedFiles.map(async (fileChange) => {
          // Skip deleted files as we can't get their content
          if (fileChange.changeType === 'removed') {
            return fileChange;
          }

          try {
            // Get the file content
            const { data } = await context.octokit.repos.getContent({
              owner,
              repo,
              path: fileChange.path,
              ref: branch
            });

            // GitHub API returns content as base64 encoded
            const content = Buffer.from(data.content, 'base64').toString();
            return { ...fileChange, content };
          } catch (error) {
            app.log.error(`Error getting content for ${fileChange.path}: ${error.message}`);
            return fileChange;
          }
        })
      );

      // Send the data to your documentation server
      await updateDocumentation(context, {
        owner,
        repo,
        branch,
        prNumber,
        files: filesWithContent
      });

    } catch (error) {
      app.log.error(`Error processing changed files: ${error.message}`);
    }
  }

  /**
   * Send updates to the documentation server
   * @param {Object} context - Probot context
   * @param {Object} data - Data to send to the documentation server
   */
  async function updateDocumentation(context, data) {
    try {
      app.log.info(`Sending update to documentation server for ${data.owner}/${data.repo}`);
      
      // Log all files before filtering
      app.log.info(`Processing ${data.files.length} files for documentation updates:`);
      data.files.forEach(file => {
        app.log.info(`- ${file.path} (${file.changeType})`);
      });
      
      // Filter files to only include those that should be documented
      const documentableFiles = data.files.filter(file => {
        const shouldDocument = shouldDocumentFile(file.path);
        app.log.info(`File ${file.path}: ${shouldDocument ? 'Will document' : 'Skipping'} (${file.changeType})`);
        return shouldDocument;
      });
      
      if (documentableFiles.length === 0) {
        app.log.warn('No documentable files found in this change. Skipping update.');
        app.log.info('This could be because:');
        app.log.info('1. All changed files are non-code files (e.g., .gitignore, package-lock.json)');
        app.log.info('2. All changed files are in directories that are excluded (e.g., node_modules)');
        app.log.info('3. All changed files have extensions that are not in the documentable list');
        return;
      }
      
      app.log.info(`Will document ${documentableFiles.length} files:`);
      documentableFiles.forEach(file => {
        app.log.info(`- ${file.path}`);
      });
      
      // Update data with filtered files
      const filteredData = {
        ...data,
        files: documentableFiles
      };
      
      // Send to documentation server using our utility function
      const response = await sendToDocumentationServer(filteredData);
      
      app.log.info(`Documentation server response received. Documentation generation started.`);
      
      // If this is a PR, add a comment to inform that docs will be updated
      if (data.prNumber) {
        await context.octokit.issues.createComment({
          owner: data.owner,
          repo: data.repo,
          issue_number: data.prNumber,
          body: `📚 Documentation update has been triggered for the changes in this pull request.\n\nThe documentation is being generated and will be available soon at your GeniDocs platform.`
        });
      }

    } catch (error) {
      app.log.error(`Error updating documentation: ${error.message}`);
      
      // If this is a PR, add a comment about the error
      if (data.prNumber) {
        await context.octokit.issues.createComment({
          owner: data.owner,
          repo: data.repo,
          issue_number: data.prNumber,
          body: `⚠️ There was an error updating the documentation: ${error.message}. Please check the logs for more details.`
        });
      }
    }
  }

  /**
   * Convert GitHub file status to a standardized change type
   * @param {string} status - GitHub file status
   * @returns {string} Standardized change type
   */
  function getChangeType(status) {
    switch (status) {
      case 'added':
        return 'added';
      case 'removed':
        return 'removed';
      case 'modified':
      case 'changed':
        return 'modified';
      case 'renamed':
        return 'renamed';
      default:
        return status;
    }
  }
};
