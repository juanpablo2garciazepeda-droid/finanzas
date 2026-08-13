# syntax=docker/dockerfile:1.7
# ---- Build stage: Node 22, npm install, nest build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# bcrypt compila nativo en postinstall; necesitamos python + make + g++.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Cache de dependencias: si solo cambia el código fuente, este layer se reusa.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev

# ---- Runtime stage: solo prod deps + dist ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Creamos un usuario no root por buenas prácticas.
RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/main.js"]
