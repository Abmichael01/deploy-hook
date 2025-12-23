import { createServer } from 'http';
import { json } from 'micro';
import { exec } from 'child_process';
import fs from 'fs';
import { parse } from 'url';
import { REPO_CONFIG } from './repos.config.js';

const logFile = '/var/www/deploy-hook/logs/deploy.log';
const MAX_LOG_LINES = 5000;
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || 'super_secret_deploy_key_123'; // Default for fallback, should be set in env

// Create logs dir if not exist
if (!fs.existsSync('/var/www/deploy-hook/logs')) {
  fs.mkdirSync('/var/www/deploy-hook/logs', { recursive: true });
  fs.writeFileSync(logFile, '');
}

// Rotate logs if they exceed MAX_LOG_LINES
const rotateLogs = () => {
  try {
    if (!fs.existsSync(logFile)) return;

    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length > MAX_LOG_LINES) {
      // Keep only the last MAX_LOG_LINES
      const keepLines = lines.slice(-MAX_LOG_LINES);
      fs.writeFileSync(logFile, keepLines.join('\n') + '\n');
      console.log(`[${new Date().toISOString()}] Log rotated: kept last ${MAX_LOG_LINES} lines`);
    }
  } catch (error) {
    console.error(`Error rotating logs: ${error.message}`);
  }
};

const log = (msg) => {
  const now = new Date().toISOString();
  const full = `[${now}] ${msg}`;
  console.log(full);

  // Rotate before appending if needed
  rotateLogs();

  fs.appendFileSync(logFile, full + '\n');
};

const getLogs = () => {
  try {
    if (!fs.existsSync(logFile)) {
      return { logs: [], totalLines: 0 };
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    return {
      logs: lines,
      totalLines: lines.length
    };
  } catch (error) {
    log(`Error reading logs: ${error.message}`);
    return { logs: [], totalLines: 0, error: error.message };
  }
};

const executeCommand = (command, cwd) => {
  return new Promise((resolve, reject) => {
    log(`Executing: ${command} in ${cwd}`);
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        log(`Error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        log(`Stderr: ${stderr}`);
      }
      if (stdout) {
        log(`Stdout: ${stdout}`);
      }
      resolve(stdout);
    });
  });
};

const deployRepo = async (repoName, config) => {
  try {
    log(`Starting deployment for ${repoName}`);

    // Check if directory exists
    if (!fs.existsSync(config.path)) {
      throw new Error(`Directory ${config.path} does not exist`);
    }

    // Execute deployment command
    await executeCommand(config.deploy_cmd, config.path);

    log(`Deployment completed successfully for ${repoName}`);
    return { success: true, message: `Deployment completed for ${repoName}` };
  } catch (error) {
    log(`Deployment failed for ${repoName}: ${error.message}`);
    return { success: false, message: `Deployment failed for ${repoName}: ${error.message}` };
  }
};

const sendJSON = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
};

const server = createServer(async (req, res) => {
  // Parse URL to get path and query parameters
  const parsedUrl = parse(req.url || '', true);
  const path = parsedUrl.pathname;
  const query = parsedUrl.query || {};

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400' // 24 hours
    });
    res.end();
    return;
  }

  // Handle GET requests
  if (req.method === 'GET') {
    // GET /deploy-hook - List available repositories
    if (path === '/deploy-hook' || path === '/deploy') {
      const availableRepos = Object.keys(REPO_CONFIG).map(key => ({
        name: key,
        path: REPO_CONFIG[key].path,
        branch: REPO_CONFIG[key].branch
      }));

      sendJSON(res, 200, {
        status: 'success',
        message: 'Deploy hook is running',
        availableRepos,
        endpoints: {
          'GET /deploy-hook': 'List available repositories',
          'GET /deploy-hook/logs': 'Get deployment logs',
          'POST /deploy-hook?repo=<name>': 'Trigger manual deployment',
          'POST /deploy-hook': 'GitHub webhook or manual deployment with repo in body'
        }
      });
      return;
    }

    // GET /deploy-hook/logs - Get deployment logs
    if (path === '/deploy-hook/logs' || path === '/deploy/logs') {
      const logsData = getLogs();
      sendJSON(res, 200, {
        status: 'success',
        ...logsData
      });
      return;
    }

    // 404 for unknown GET routes
    sendJSON(res, 404, {
      status: 'error',
      message: 'Not found',
      availableEndpoints: [
        'GET /deploy-hook',
        'GET /deploy-hook/logs',
        'POST /deploy-hook?repo=<name>',
        'POST /deploy-hook'
      ]
    });
    return;
  }

  // Handle POST requests
  if (req.method !== 'POST') {
    sendJSON(res, 405, { status: 'error', message: 'Method not allowed' });
    return;
  }

  // POST /deploy-hook - Handle deployment
  if (req.method === 'POST' && (path === '/deploy-hook' || path === '/deploy')) {
    let payload = {};

    // Try to parse JSON body
    try {
      payload = await json(req);
    } catch (error) {
      // If no JSON body, that's okay - we'll use query params
      log(`No JSON payload (using query params): ${error.message}`);
    }

    // Determine repo name from:
    // 1. Query parameter: ?repo=backend
    // 2. Body parameter: { "repo": "backend" }
    // 3. GitHub webhook: { "repository": { "name": "backend" } }
    let repoName = query.repo || payload.repo;
    let ref = query.branch || payload.branch || payload.ref;
    let secret = query.secret || payload.secret;

    // Verify secret
    const incomingSecret = secret || req.headers['x-hub-signature-256'] || req.headers['x-deployment-token']; // Allow partial flexibility or just simple token
    // For this simple implementation, we'll check a simple token usage or query param
    // If using GitHub webhook secret, signature verification is more complex. 
    // User asked to "accept secret as a param", so we stick to query/body param 'secret'.

    if (secret !== DEPLOY_SECRET) {
      log(`Invalid secret provided for ${repoName}`);
      sendJSON(res, 403, {
        status: 'error',
        message: 'Forbidden: Invalid secret'
      });
      return;
    }

    let isManual = false;

    // If repo is provided in query or body, it's a manual deployment
    if (query.repo || payload.repo) {
      isManual = true;
      repoName = query.repo || payload.repo;

      // Use repo name directly as config key (GitHub repo names match config keys)
      const configKey = repoName;

      if (!REPO_CONFIG[configKey]) {
        log(`Manual deployment requested for unknown repo: ${repoName}`);
        sendJSON(res, 404, {
          status: 'error',
          message: `No configuration found for repository: ${repoName}`,
          availableRepos: Object.keys(REPO_CONFIG)
        });
        return;
      }

      const config = REPO_CONFIG[configKey];

      // Use branch from query/body or default to config branch
      const branch = ref || config.branch;

      log(`Manual deployment triggered for ${configKey} (branch: ${branch})`);

      try {
        const result = await deployRepo(configKey, config);

        if (result.success) {
          sendJSON(res, 200, {
            status: 'success',
            message: result.message,
            repo: configKey,
            branch: branch
          });
        } else {
          sendJSON(res, 500, {
            status: 'error',
            message: result.message,
            repo: configKey
          });
        }
      } catch (error) {
        log(`Unexpected error during manual deployment: ${error.message}`);
        sendJSON(res, 500, {
          status: 'error',
          message: 'Internal server error',
          error: error.message
        });
      }
      return;
    }

    // GitHub webhook handling (backward compatibility)
    const githubRepoName = payload.repository?.name;
    const githubRef = payload.ref;

    if (!githubRepoName) {
      log('No repository name found in payload and no repo parameter provided');
      sendJSON(res, 400, {
        status: 'error',
        message: 'No repository name found. Provide ?repo=<name> or { "repo": "<name>" } in body',
        availableRepos: Object.keys(REPO_CONFIG)
      });
      return;
    }

    // Use GitHub repo name directly as config key (names match exactly)
    const configKey = githubRepoName;
    if (!configKey || !REPO_CONFIG[configKey]) {
      log(`No configuration found for repository: ${githubRepoName}`);
      sendJSON(res, 404, {
        status: 'error',
        message: `No configuration found for repository: ${githubRepoName}`
      });
      return;
    }

    const config = REPO_CONFIG[configKey];

    // Check if the push is to the correct branch
    if (githubRef !== `refs/heads/${config.branch}`) {
      log(`Push to ${githubRef}, expected refs/heads/${config.branch}. Skipping deployment.`);
      sendJSON(res, 200, {
        status: 'ignored',
        message: `Push to ${githubRef}, expected ${config.branch} branch`
      });
      return;
    }

    log(`Received GitHub webhook for ${githubRepoName} on branch ${config.branch}`);

    try {
      const result = await deployRepo(configKey, config);

      if (result.success) {
        sendJSON(res, 200, {
          status: 'success',
          message: result.message
        });
      } else {
        sendJSON(res, 500, {
          status: 'error',
          message: result.message
        });
      }
    } catch (error) {
      log(`Unexpected error during deployment: ${error.message}`);
      sendJSON(res, 500, {
        status: 'error',
        message: 'Internal server error'
      });
    }
    return;
  }

  // 404 for unknown routes
  sendJSON(res, 404, {
    status: 'error',
    message: 'Not found',
    availableEndpoints: [
      'GET /deploy-hook',
      'GET /deploy-hook/logs',
      'POST /deploy-hook?repo=<name>',
      'POST /deploy-hook'
    ]
  });
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, '0.0.0.0', () => {
  log(`Deploy hook server listening on port ${PORT}`);
  log(`Available endpoints:`);
  log(`  GET  /deploy-hook - List available repositories`);
  log(`  GET  /deploy-hook/logs - Get deployment logs`);
  log(`  POST /deploy-hook?repo=<name> - Trigger manual deployment`);
  log(`  POST /deploy-hook - GitHub webhook or manual deployment`);
});

export default server;
