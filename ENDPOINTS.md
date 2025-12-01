# Deploy Hook API Endpoints

Simple guide to the deploy hook endpoints for triggering deployments and viewing logs.

## Base URL
```
https://tajma.net/deploy
```

## Available Endpoints

### 1. List Available Repositories
**GET** `/deploy`

Returns list of available repositories and endpoint information.

**Response:**
```json
{
  "status": "success",
  "message": "Deploy hook is running",
  "availableRepos": [
    {
      "name": "tajma",
      "path": "/var/www/Tajma",
      "branch": "main"
    },
    {
      "name": "nigercanton",
      "path": "/var/www/NigerCanton",
      "branch": "master"
    }
  ],
  "endpoints": {
    "GET /deploy": "List available repositories",
    "GET /deploy/logs": "Get deployment logs",
    "POST /deploy?repo=<name>": "Trigger manual deployment",
    "POST /deploy": "GitHub webhook or manual deployment with repo in body"
  }
}
```

**Example:**
```bash
curl https://tajma.net/deploy
```

---

### 2. Get Deployment Logs
**GET** `/deploy/logs`

Returns all deployment logs with total line count.

**Response:**
```json
{
  "status": "success",
  "logs": [
    "[2025-11-28T04:24:08.852Z] Deploy hook server listening on port 3005",
    "[2025-11-28T04:24:08.853Z] Available endpoints:",
    ...
  ],
  "totalLines": 700
}
```

**Example:**
```bash
curl https://tajma.net/deploy/logs
```

**Note:** Logs automatically rotate when they exceed 5000 lines (keeps most recent 5000).

---

### 3. Trigger Manual Deployment
**POST** `/deploy`

Triggers a deployment for a specific repository.

#### Method 1: Query Parameter
```
POST /deploy?repo=<repo_name>
```

**Example:**
```bash
curl -X POST "https://tajma.net/deploy?repo=tajma"
```

#### Method 2: JSON Body
```
POST /deploy
Content-Type: application/json

{
  "repo": "tajma"
}
```

**Example:**
```bash
curl -X POST https://tajma.net/deploy \
  -H "Content-Type: application/json" \
  -d '{"repo": "tajma"}'
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Deployment completed for tajma",
  "repo": "tajma",
  "branch": "main"
}
```

**Error Response (404):**
```json
{
  "status": "error",
  "message": "No configuration found for repository: invalid-repo",
  "availableRepos": ["tajma", "nigercanton"]
}
```

**Error Response (500):**
```json
{
  "status": "error",
  "message": "Deployment failed for tajma: <error details>",
  "repo": "tajma"
}
```

---

### 4. GitHub Webhook (Backward Compatible)
**POST** `/deploy`

Accepts GitHub webhook payload format. Automatically detects repository from `payload.repository.name`.

**GitHub Payload Format:**
```json
{
  "repository": {
    "name": "Tajma"
  },
  "ref": "refs/heads/main"
}
```

**Repository Mapping:**
- `"Tajma"` → `tajma`
- `"NigerCanton"` → `nigercanton`

**Note:** Only deploys if the push is to the configured branch (main for tajma, master for nigercanton).

---

## Available Repositories

| Name | Config Key | Branch | Path |
|------|-----------|--------|------|
| Tajma | `tajma` | `main` | `/var/www/Tajma` |
| NigerCanton | `nigercanton` | `master` | `/var/www/NigerCanton` |

---

## CORS

All endpoints support CORS and can be accessed from web interfaces:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

---

## Quick Reference

```bash
# List repos
curl https://tajma.net/deploy

# View logs
curl https://tajma.net/deploy/logs

# Deploy tajma (query param)
curl -X POST "https://tajma.net/deploy?repo=tajma"

# Deploy tajma (JSON body)
curl -X POST https://tajma.net/deploy \
  -H "Content-Type: application/json" \
  -d '{"repo": "tajma"}'

# Deploy nigercanton
curl -X POST "https://tajma.net/deploy?repo=nigercanton"
```

---

## Error Codes

- `200` - Success
- `400` - Bad Request (invalid JSON or missing repo parameter)
- `404` - Repository not found
- `405` - Method not allowed (only GET/POST supported)
- `500` - Internal server error (deployment failed)




