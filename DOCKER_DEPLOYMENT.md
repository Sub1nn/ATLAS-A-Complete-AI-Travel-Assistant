# ATLAS Docker Deployment Guide

This setup containerizes ATLAS as six local services:

- `mongo`: MongoDB 7 single-node replica set for transactional persistence.
- `redis`: Redis 7 for optional distributed rate limiting and API caching.
- `backend`: Express API on port `4000`.
- `document-worker`: MongoDB-leased document extraction/vector-indexing worker plus coordinated account-deletion worker.
- `retention-worker`: scheduled privacy-retention cleanup worker.
- `frontend`: Vite React app built as static files and served with unprivileged Nginx on container port `8080`.

For local Docker Compose, the frontend is exposed at `http://localhost:5173` and proxies `/api` and `/health` requests to the backend container.

## 1. Prepare environment files

Real `.env` files must not be committed. Create them locally from the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp .env.example .env
```

Docker Compose loads backend secrets from `backend/.env`. Values under the Compose `environment` block are limited to container-local service addresses so they do not overwrite secrets from that file.

Replace all placeholder values. At minimum, production requires:

```env
NODE_ENV=production
APP_BASE_URL=https://your-frontend-domain.com
CORS_ORIGIN=https://your-frontend-domain.com
MONGODB_URI=your_mongodb_atlas_uri
JWT_SECRET=strong_random_secret_from_openssl_rand_hex_64
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
GROQ_API_KEY=your_groq_api_key
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=ATLAS <no-reply@yourdomain.com>
PRIVACY_POLICY_VERSION=2026-06-22
TERMS_VERSION=2026-06-22
METRICS_TOKEN=another_strong_random_secret
ERROR_REPORTING_WEBHOOK_URL=https://your-monitoring-webhook.example
LEGAL_OPERATOR_NAME=your_registered_operator_name
PRIVACY_CONTACT_EMAIL=privacy@yourdomain.com
LEGAL_JURISDICTION=your_governing_jurisdiction
PRIVACY_LAWFUL_BASIS=your_legally_reviewed_basis
PRIVACY_TRANSFER_SAFEGUARDS=your_legally_reviewed_transfer_safeguards
PRIVACY_SUPERVISORY_AUTHORITY=your_competent_data_protection_authority
```

For production deployment, also configure:

```env
REDIS_URL=your_managed_redis_url
REDIS_REQUIRED=true
```

For managed production MongoDB, keep `MONGODB_AUTO_INDEX=false`, set `MONGODB_TRANSACTIONS=true`, and run `npm run db:indexes` once during deployment. Compose also keeps automatic indexing disabled; run the index command after the replica set is healthy.

Set `TRUST_PROXY` to the exact proxy topology used by the hosting platform. Compose sets it to `1` because Nginx is the single public proxy; direct local backend development should use `false`.

Keep the frontend and API on the same site when possible. For genuinely cross-site deployments, set `REFRESH_COOKIE_SAME_SITE=none`; HTTPS is mandatory and the frontend must retain credentials and the CSRF token returned by `/api/auth/csrf`. Keep `CORS_ORIGIN` as an explicit allowlist.

Enable both **Places API (New)** and **Routes API** for the backend Google key. ATLAS uses the Routes API v2 `computeRoutes` method and sends a restrictive response field mask.

Optional Pinecone document-vector setup:

```env
PINECONE_ENABLED=true
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_HOST=https://your-index-name.svc.your-region.pinecone.io
PINECONE_NAMESPACE_PREFIX=atlas-user
PINECONE_INDEX_MODE=inference
```

## 2. Run locally with Docker Compose

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

Readiness and liveness checks:

```text
http://localhost:4000/health/ready
http://localhost:4000/health/live
```

Through frontend Nginx proxy:

```text
http://localhost:5173/health
```

## 3. Build images manually

Backend:

```bash
docker build -t atlas-backend ./backend
docker run --env-file ./backend/.env -p 4000:4000 atlas-backend
```

Frontend for local same-domain proxy:

```bash
docker build -t atlas-frontend ./frontend --build-arg VITE_API_BASE_URL=/api
docker run -p 5173:8080 atlas-frontend
```

Frontend for separate cloud backend URL (this value is also compiled into the privacy/terms metadata loader):

```bash
docker build -t atlas-frontend ./frontend \
  --build-arg VITE_API_BASE_URL=https://your-backend-domain.com/api
```

## 4. Recommended deployment paths

### Simple demo deployment

- Backend: Render, Railway, Fly.io or Google Cloud Run.
- Frontend: Vercel or Netlify.
- Database: MongoDB Atlas.
- Email: Resend.
- Redis: optional for a demo, recommended for beta.

### Stronger production deployment

- Frontend: Vercel, S3 + CloudFront, or Cloudflare Pages.
- Backend: AWS ECS Fargate, AWS App Runner, Google Cloud Run, or Kubernetes.
- Database: MongoDB Atlas.
- Cache/rate limit store: AWS ElastiCache Redis, GCP Memorystore or managed Redis.
- File storage: S3/GCS for uploaded source files.
- Workers: the included MongoDB lease-based document/account-deletion worker and retention worker, or managed equivalents.
- Secrets: AWS Secrets Manager, SSM Parameter Store, GCP Secret Manager or platform secrets.
- Logs and monitoring: CloudWatch, OpenTelemetry, Sentry or similar.

## 5. Important notes

- Do not copy `.env` files into Docker images.
- Rotate any keys that were ever shared or committed.
- Vite frontend environment variables are build-time variables. Rebuild the frontend if the backend URL changes.
- Email verification is enforced for chat and document features. Configure Resend before onboarding users.
- Run `npm run worker:documents` and `npm run worker:retention` continuously. Account deletion is queued, blocks new user work, waits for active document leases, removes remote vectors/uploads, then deletes local records.
- Set `DAILY_PROVIDER_CALL_LIMIT` from measured provider pricing. It counts actual uncached travel/geocoding/Pinecone calls, including retries, rather than one count per tool group.
- Restrict `/internal/metrics` using the configured bearer token and connect the error-reporting webhook to an alerting service.
- Redis metrics provide a small operational view, not full tracing. Connect production deployments to OpenTelemetry, Prometheus or a managed APM platform.
- Have qualified counsel review the policy text, operator identity, lawful bases, retention, transfer safeguards and supervisory-authority values before accepting public users.
- The Compose backend port is bound to localhost. Public traffic should enter through the frontend proxy; do not expose port 4000 directly on an internet-facing host.
- Docker Compose is useful for local testing and a single-host deployment. Multi-instance deployments require managed MongoDB, managed Redis and shared observability. MongoDB document leases allow multiple document workers without destructive queue reads.
