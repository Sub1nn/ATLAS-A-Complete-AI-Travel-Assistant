# ATLAS Frontend Dockerfile
# Builds the Vite React app and serves it with Nginx
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# For same-domain Docker deployments, use /api so Nginx can proxy to backend.
# For separate cloud frontend/backend deployments, override this build arg with
# your public backend URL, for example: https://api.example.com/api
ARG VITE_API_BASE_URL=/api
ARG VITE_APP_NAME="ATLAS Travel Assistant"
ARG VITE_APP_VERSION=1.0.0
ARG VITE_PUBLIC_URL=http://localhost:5173/

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL

RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
