# SSRF Listener

A simple, self-hosted SSRF callback listener for API penetration testing. Logs every inbound request and provides a lightweight dashboard to review hits.

---

## Quick Start

```bash
git clone https://github.com/YOUR_USER/SSRF_listener
cd SSRF_listener
cp .env.example .env        # edit AUTH_TOKEN
npm install
npm start
```

Open the dashboard:
```
http://localhost:3000/dashboard?token=YOUR_TOKEN
```

---

## Environment Variables

| Variable     | Default    | Description                        |
|--------------|------------|------------------------------------|
| `PORT`       | `3000`     | Port to listen on                  |
| `AUTH_TOKEN` | `changeme` | Token for dashboard & API access   |

---

## Endpoints

| Route                  | Auth | Description                          |
|------------------------|------|--------------------------------------|
| `/*`                   | No   | Catch-all — logs every SSRF callback |
| `GET /health`          | No   | Health check                         |
| `GET /dashboard`       | No*  | Web dashboard (`?token=`)            |
| `GET /api/requests`    | Yes  | List requests (JSON)                 |
| `GET /api/requests/:id`| Yes  | Single request detail                |
| `DELETE /api/requests` | Yes  | Clear all requests                   |
| `GET /api/export`      | Yes  | Download all requests as JSON        |

Auth = pass `x-auth-token: TOKEN` header or `?token=TOKEN` query param.

---

## SSRF Payload Examples

Point your target application at your listener URL:

```
# Basic HTTP callback
http://YOUR_HOST:3000/ssrf-test

# With correlation token in path
http://YOUR_HOST:3000/callback/target-app-123

# Redirect test
http://YOUR_HOST:3000/redirect?to=http://internal-host

# Any path works — all are logged
http://YOUR_HOST:3000/any/path/you/want?param=value
```

Each hit returns a JSON response with a unique ID:
```json
{ "received": true, "id": "550e8400-e29b-41d4-a716-446655440000" }
```

---

## Docker

```bash
# Build and run
docker compose up -d

# View logs
docker compose logs -f
```

---

## API Usage

```bash
# List recent requests
curl -H "x-auth-token: YOUR_TOKEN" http://localhost:3000/api/requests

# Search
curl -H "x-auth-token: YOUR_TOKEN" "http://localhost:3000/api/requests?search=aws"

# Export
curl -H "x-auth-token: YOUR_TOKEN" http://localhost:3000/api/export -o hits.json

# Clear
curl -X DELETE -H "x-auth-token: YOUR_TOKEN" http://localhost:3000/api/requests
```

---

## Deploy to Railway / Render

1. Push repo to GitHub
2. Connect on [Railway](https://railway.app) or [Render](https://render.com)
3. Set `AUTH_TOKEN` environment variable
4. Deploy — your listener URL is the public domain they assign

---

## What Gets Logged

For every inbound request:
- Timestamp
- Method & path
- Source IP (with `X-Forwarded-For` support)
- User-Agent
- All headers
- Query parameters
- Request body (first 2000 chars)
- Unique UUID correlation ID

Data is persisted in SQLite at `data/requests.db`.
