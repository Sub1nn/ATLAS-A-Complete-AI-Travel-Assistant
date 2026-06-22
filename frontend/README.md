# ATLAS Frontend

React and Vite client for the ATLAS travel assistant.

```bash
npm ci
npm run dev
npm run lint
npm run build
```

Use Node.js 20.19+ or 22.12+. Copy `.env.example` to `.env` for local development. Production Docker builds normally use `VITE_API_BASE_URL=/api` so Nginx proxies API requests to the backend. Separate-domain builds must set the full backend `/api` URL; Vite compiles it into both the app and legal-policy pages.
