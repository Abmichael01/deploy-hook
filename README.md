# Deploy Hook

A webhook server for automated deployments that listens for GitHub webhooks or manual triggers and executes deployment commands for configured repositories.

## Overview

This deploy hook server provides a simple HTTP interface to trigger deployments for multiple repositories. It supports both GitHub webhooks and manual deployment triggers via API calls.

## Quick Start

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Start the server:
```bash
pnpm start
```

The server runs on port `3005` by default (configurable via `PORT` environment variable).

## Configuration

### Main Configuration File: `repos.config.js`

**This is the primary file you need to edit to add new repositories for auto-deployment.**

The `repos.config.js` file contains the repository configuration object. Each repository entry requires:

- **`path`**: The absolute path to the repository directory on the server
- **`branch`**: The Git branch to monitor for deployments (e.g., `"main"`, `"master"`, `"production"`)
- **`deploy_cmd`**: The shell command(s) to execute during deployment

### Adding a New Repository

To add a new repository for auto-deployment, edit `repos.config.js` and add a new entry to the `REPO_CONFIG` object:

```javascript
export const REPO_CONFIG = {
  // Existing repositories...
  
  yourNewRepo: {
    path: "/var/www/your-new-repo",
    branch: "main",
    deploy_cmd: "git pull origin main && npm install && npm run build"
  }
};
```

**Important Notes:**
- The **key name** (e.g., `yourNewRepo`) should match your GitHub repository name exactly
- The **`path`** must be an absolute path to where the repository is cloned on the server
- The **`branch`** should match the branch you want to deploy from
- The **`deploy_cmd`** can contain multiple commands chained with `&&` or use a bash script

### Example Configurations

**Node.js/Express Application:**
```javascript
myApp: {
  path: "/var/www/my-app",
  branch: "main",
  deploy_cmd: "git pull origin main && npm install && npm run build && pm2 restart my-app"
}
```

**Python/Django Application:**
```javascript
djangoApp: {
  path: "/var/www/django-app",
  branch: "main",
  deploy_cmd: "bash -c 'source venv/bin/activate && git pull origin main && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput && systemctl restart django-app'"
}
```

**Frontend Build (Vite/Next.js/etc):**
```javascript
frontend: {
  path: "/var/www/frontend",
  branch: "main",
  deploy_cmd: "git pull origin main && pnpm install && pnpm build"
}
```

## Usage

### API Endpoints

#### GET `/deploy-hook`
Lists all configured repositories and available endpoints.

#### GET `/deploy-hook/logs`
Retrieves deployment logs (last 5000 lines).

#### POST `/deploy-hook?repo=<repository-name>`
Manually trigger a deployment for a specific repository.

Example:
```bash
curl -X POST http://localhost:3005/deploy-hook?repo=backend
```

#### POST `/deploy-hook`
Accepts GitHub webhooks or manual deployments with JSON body:
```json
{
  "repo": "repository-name"
}
```

### GitHub Webhook Setup

1. Go to your GitHub repository settings
2. Navigate to **Webhooks** → **Add webhook**
3. Set the **Payload URL** to: `http://your-server:3005/deploy-hook`
4. Set **Content type** to: `application/json`
5. Select **Just the push event**
6. Click **Add webhook**

The webhook will automatically trigger deployments when code is pushed to the configured branch.

### Manual Deployment

You can trigger deployments manually using curl or any HTTP client:

```bash
# Using query parameter
curl -X POST http://localhost:3005/deploy-hook?repo=backend

# Using JSON body
curl -X POST http://localhost:3005/deploy-hook \
  -H "Content-Type: application/json" \
  -d '{"repo": "backend"}'
```

## Logs

Deployment logs are automatically written to `/srv/deploy-hook/logs/deploy.log`. The log file is automatically rotated when it exceeds 5000 lines, keeping only the most recent entries.

View logs via:
- API: `GET /deploy-hook/logs`
- Direct file access: `/srv/deploy-hook/logs/deploy.log`

## Environment Variables

- `PORT`: Server port (default: `3005`)
- `DEPLOY_SECRET`: Secret key for authorizing deployments.

## Setup Instructions for AI Agents

If you are an AI assistant setting this up on a new server, follow these steps:

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/Abmichael01/deploy-hook.git
    ```
2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```
3.  **Configure Repositories**:
    Create or edit `repos.config.js` (see [Configuration](#configuration)). **Note**: This file is ignored by Git.
4.  **Set Deployment Secret**:
    Generate a secure secret and set it as an environment variable `DEPLOY_SECRET`.
5.  **Start with PM2**:
    ```bash
    pm2 start index.js --name deploy-hook --env DEPLOY_SECRET=YOUR_SECRET
    pm2 save
    ```
6.  **GitHub Webhook URL**:
    Configure the webhook in GitHub using this format:
    `https://your-domain.com/deploy-hook?secret=YOUR_SECRET&repo=YOUR_REPO_NAME`

All incoming POST requests **must** include the secret either as a query parameter `?secret=...` or in the JSON body `{"secret": "..."}`.

## File Structure

```
deploy-hook/
├── index.js           # Main server file (usually no edits needed)
├── repos.config.js    # ⭐ EDIT THIS FILE to add new repositories
├── package.json       # Dependencies and scripts
├── logs/              # Deployment logs (auto-generated)
│   └── deploy.log
└── README.md          # This file
```

## Troubleshooting

### Repository Not Found
- Ensure the repository key in `repos.config.js` matches your GitHub repository name exactly
- Check that the repository path exists on the server

### Deployment Fails
- Check the logs: `GET /deploy-hook/logs` or view `/var/www/deploy-hook/logs/deploy.log`
- Verify the deployment command has proper permissions
- Ensure all dependencies in the deploy command are available (node, npm, python, etc.)

### Webhook Not Triggering
- Verify the webhook URL is correct in GitHub settings
- Check that the branch name in the config matches the branch being pushed to
- Review server logs for incoming webhook requests

## Security Considerations

- The server currently allows CORS from all origins (`*`). Consider restricting this in production.
- Ensure proper firewall rules are in place to limit access to the deploy hook port.
- Use authentication/authorization if exposing the webhook publicly.
- Review and sanitize deployment commands to prevent command injection.

