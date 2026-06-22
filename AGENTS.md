# AGENTS.md

## Project Overview
- **Project:** ATLAS — an AI travel assistant with live travel context, saved conversations, and document-aware chat
- **Target user:** Travelers planning destinations, activities, stays, routes, and safety checks
- **My skill level:** Intermediate
- **Stack:** React, Vite, Tailwind CSS, Node.js, Express, MongoDB, Redis, Pinecone, Docker, and Nginx
- **Architecture:** React frontend, Express API, MongoDB replica set, Redis, and separate document, privacy/deletion, and retention workers
- **Runtime:** Node.js 20.19+; CI and Docker use Node.js 22

## Commands
- **Install:** `cd backend && npm ci`, then `cd frontend && npm ci`
- **Dev:** `npm run dev` inside both `backend/` and `frontend/`
- **Build:** `cd frontend && npm run build`
- **Test:** `cd backend && npm test`
- **Lint:** `cd frontend && npm run lint`
- **Integration:** `cd backend && npm run test:integration`
- **Authenticated load:** `cd backend && npm run test:load:authenticated`
- **Soak:** `cd backend && npm run test:soak`
- **Database indexes:** `cd backend && npm run db:indexes`
- **Docker validation:** `docker compose config -q`
- **Docker build:** `docker compose build`

## Production Processes
- **API:** `cd backend && npm start`
- **Document worker:** `cd backend && npm run worker:documents`
- **Privacy/deletion worker:** `cd backend && npm run worker:privacy`
- **Retention worker:** `cd backend && npm run worker:retention`
- Run all three workers in production; API readiness depends on their heartbeats
- Production MongoDB must support transactions and use `MONGODB_TRANSACTIONS=true`

## Do
- Read existing code before modifying anything
- Match existing patterns, naming, and style
- Handle errors gracefully — no silent failures
- Keep changes small and scoped to what was asked
- Run dev/build after changes to verify nothing broke
- Ask clarifying questions before guessing
- Preserve operation leases, ownership filters, and fencing checks in concurrent workflows
- Keep account and document deletion asynchronous, durable, retryable, and observable
- Keep document extraction inside the constrained child process
- Update `.env.example`, Docker Compose, tests, and documentation when adding configuration

## Don't
- Install new dependencies without asking
- Delete or overwrite files without confirming
- Hardcode secrets, API keys, or credentials
- Rewrite working code unless explicitly asked
- Push, deploy, or force-push without permission
- Make changes outside the scope of the request
- Reintroduce in-memory or non-expiring counters for crash-sensitive operations
- Save conversation state without confirming lease ownership
- Delete documents directly from controllers or retention scripts
- Run document parsing and privacy deletion in the same worker process
- Bypass global or per-user provider usage limits

## When Stuck
- If a task is large, break it into steps and confirm the plan first
- If you can't fix an error in 2 attempts, stop and explain the issue
- For stuck deletion jobs, inspect protected worker metrics and dead-letter endpoints before changing data manually

## Testing
- Run existing tests after any change
- Add at least one test for new features
- Never skip or delete tests to make things pass
- Run replica-set integration tests for transaction, lease, deletion, or concurrency changes
- Run frontend lint, tests, and build for frontend changes
- Run `npm audit --omit=dev` in both projects for dependency changes
- Run Docker Compose validation for infrastructure or environment changes

## Git
- Small, focused commits with descriptive messages
- Never force push
- Do not commit or push unless the user explicitly asks

## Response Style
- always respond with clear & concise messages
- use plain English when explaining to the User
- avoid long sentences, complex words, or long paragraphs
