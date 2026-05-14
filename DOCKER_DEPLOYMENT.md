# ATLAS Docker Deployment Guide

This setup containerizes the ATLAS app as two services:

- `backend`: Express API on port `4000`
- `frontend`: Vite React app built as static files and served with Nginx on port `80`

For local Docker Compose, the frontend is exposed at `http://localhost:5173` and proxies `/api` and `/health` requests to the backend container.

## 1. Required files added

```text
backend/Dockerfile
backend/.dockerignore
frontend/Dockerfile
frontend/.dockerignore
frontend/nginx.conf
docker-compose.yml
DOCKER_DEPLOYMENT.md
```

## 2. Environment variables

Keep secrets only in `backend/.env`. Do not commit real API keys.

Your backend code currently reads `process.env.CORS_ORIGIN`, while your example file contains `CLIENT_URL`. For Docker, set `CORS_ORIGIN` as well.

Example backend `.env`:

```env
NODE_ENV=production
PORT=4000

GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-70b-versatile

GOOGLE_MAPS_API_KEY=your_google_maps_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
NEWS_API_KEY=your_news_api_key

PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=your_index_name

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

## 3. Run locally with Docker Compose

From the project root:

```bash
docker compose up --build
```

Open:

```text
http://localhost:5173
```

Backend health check:

```text
http://localhost:4000/health
```

Through frontend Nginx proxy:

```text
http://localhost:5173/health
```

## 4. Build images manually

Backend:

```bash
docker build -t atlas-backend ./backend
docker run --env-file ./backend/.env -p 4000:4000 atlas-backend
```

Frontend for local same-domain proxy:

```bash
docker build -t atlas-frontend ./frontend --build-arg VITE_API_BASE_URL=/api
docker run -p 5173:80 atlas-frontend
```

Frontend for separate cloud backend URL:

```bash
docker build -t atlas-frontend ./frontend \
  --build-arg VITE_API_BASE_URL=https://your-backend-domain.com/api
```

## 5. AWS or GCP deployment notes

### Option A: Deploy as two services

Use this when frontend and backend have separate public URLs.

Backend service:

- Container port: `4000`
- Health check path: `/health`
- Add all API keys as secret environment variables
- Set `CORS_ORIGIN` to the public frontend URL

Frontend service:

- Container port: `80`
- Build with `VITE_API_BASE_URL=https://your-backend-domain.com/api`

This option is common for AWS ECS, AWS App Runner, Google Cloud Run, and GCP Artifact Registry based deployments.

### Option B: Deploy both with Docker Compose on one VM

Use this on an AWS EC2 or GCP Compute Engine VM.

```bash
docker compose up -d --build
```

Then put Nginx, Caddy, Traefik, or a cloud load balancer in front of the frontend container.

## 6. Important production notes

- Do not copy `.env` into the Docker image.
- Rotate API keys if they were ever committed to Git.
- For cloud deployment, store secrets in AWS Secrets Manager, AWS Parameter Store, GCP Secret Manager, or the platform environment variable manager.
- Vite frontend environment variables are build-time variables. If the backend URL changes, rebuild the frontend image.
- The current backend stores conversation context in memory. This is acceptable for local testing, but cloud autoscaling or container restarts will lose chat context unless you move context storage to Redis, a database, or another persistent service.
