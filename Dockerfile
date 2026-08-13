# syntax=docker/dockerfile:1.7
# ---- Build stage: Node 22, install deps, run `vite build` ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Cache deps separately so source changes don't bust the install layer.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Source.
COPY tsconfig*.json vite.config.ts index.html .oxlintrc.json ./
COPY public ./public
COPY src ./src

# Production bundle.
RUN npm run build

# ---- Runtime stage: nginx serving /usr/share/nginx/html ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback so React Router URLs don't 404 on direct nav/refresh.
# We use a tiny nginx.conf instead of the stock one because the default
# only tries files, not the SPA shell.
RUN sed -i 's|^http {|http {\n    include /etc/nginx/spa.conf;|' /etc/nginx/nginx.conf \
 && printf '%s\n' \
      'server {' \
      '    listen 80;' \
      '    server_name _;' \
      '    root /usr/share/nginx/html;' \
      '    index index.html;' \
      '    location / {' \
      '        try_files $uri $uri/ /index.html;' \
      '    }' \
      '    location ~* \.(?:js|css|woff2?|svg|png|jpg|jpeg|gif|webp|ico|json)$ {' \
      '        expires 30d;' \
      '        add_header Cache-Control "public, max-age=2592000, immutable";' \
      '        try_files $uri =404;' \
      '    }' \
      '    gzip on;' \
      '    gzip_types text/css application/javascript application/json image/svg+xml;' \
      '    gzip_min_length 1024;' \
      '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
