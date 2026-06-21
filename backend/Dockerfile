
FROM node:22-alpine AS base

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY --chown=node:node . .

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

USER node

# Lightweight health check for Docker/Kubernetes/ECS/Cloud Run style platforms
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "index.js"]
