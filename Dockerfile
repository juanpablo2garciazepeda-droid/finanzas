# syntax=docker/dockerfile:1.7
# ---- Build stage: Node 22, pnpm install, run `vite build` ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Corepack ships with Node 22 and lets us pin the pnpm version declared in
# package.json#packageManager without installing it globally.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Cache deps separately so source changes don't bust the install layer.
# Use *.yaml glob so we still match a future pnpm-lock rename.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# Source.
COPY tsconfig*.json vite.config.ts index.html .oxlintrc.json ./
COPY public ./public
COPY src ./src

# Production bundle.
RUN pnpm run build

# ---- Runtime stage: nginx serving /usr/share/nginx/html ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# SPA-friendly default vhost: try the file, then fall back to /index.html so
# React Router URLs (e.g. /presupuestos) don't 404 on direct nav/refresh.
# gzip + immutable caching for the hashed asset bundle.
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:js|css|woff2?|svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri =404;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml application/manifest+json;
    gzip_min_length 1024;
}
NGINX

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
