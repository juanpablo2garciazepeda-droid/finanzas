# syntax=docker/dockerfile:1.7
# ---- Build + runtime stage: Node 22, npm install, nest build, run ----
# Single stage porque bcrypt compila nativo en postinstall y necesita el
# mismo libc entre build y runtime. Antes fallaba: build en bookworm-slim
# (glibc), runtime en alpine (musl). Mantener un solo stage evita eso.
FROM node:22-bookworm-slim
WORKDIR /app

# bcrypt compila nativo en postinstall; necesitamos python + make + g++.
# También curl para el healthcheck.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ curl \
  && rm -rf /var/lib/apt/lists/*

# Cache de dependencias: si solo cambia el código fuente, este layer se reusa.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev

# Creamos un usuario no root por buenas prácticas.
RUN addgroup --system app && adduser --system --ingroup app app

USER app
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/main.js"]
