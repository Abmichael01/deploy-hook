import { createServer } from 'http';
import { json } from 'micro';
import { exec } from 'child_process';
import fs from 'fs';
import { REPO_CONFIG } from './repos.config.js';

const logFile = '/var/www/deploy-hook/logs/deploy.log';

// Create logs dir if not exist
if (!fs.existsSync('/var/www/deploy-hook/logs')) {
  fs.mkdirSync('/var/www/deploy-hook/logs', { recursive: true });
  fs.writeFileSync(logFile, '');
}

const log = (msg) => {
  const now = new Date().toISOString();
  const full = `[${now}] ${msg}`;
  console.log(full);
  fs.appendFileSync(logFile, full + '\n');
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

const server = createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Only POST requests allowed' }));
    return;
  }

  let payload;
  try {
    payload = await json(req);
  } catch (error) {
    log(`Error parsing JSON: ${error.message}`);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON payload' }));
    return;
  }

  // Extract repository name from GitHub webhook payload
  const repoName = payload.repository?.name;
  const ref = payload.ref;

  if (!repoName) {
    log('No repository name found in payload');
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'No repository name found' }));
    return;
  }

  // Map GitHub repo names to our config keys
  const repoMapping = {
    'votingSystemFrontend': 'votingSystemFrontend',
    'votingBackend': 'votingBackend'
  };

  const configKey = repoMapping[repoName];
  if (!configKey || !REPO_CONFIG[configKey]) {
    log(`No configuration found for repository: ${repoName}`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: `No configuration found for repository: ${repoName}` }));
    return;
  }

  const config = REPO_CONFIG[configKey];

  // Check if the push is to the correct branch
  if (ref !== `refs/heads/${config.branch}`) {
    log(`Push to ${ref}, expected refs/heads/${config.branch}. Skipping deployment.`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ignored', message: `Push to ${ref}, expected ${config.branch} branch` }));
    return;
  }

  log(`Received webhook for ${repoName} on branch ${config.branch}`);

  try {
    const result = await deployRepo(configKey, config);

    if (result.success) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', message: result.message }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: result.message }));
    }
  } catch (error) {
    log(`Unexpected error during deployment: ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Internal server error' }));
  }
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, '0.0.0.0', () => {
  log(`Deploy hook server listening on port ${PORT}`);
});

export default server;
