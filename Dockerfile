# Official Playwright image with all OS dependencies and browsers pre-installed
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TZ=Europe/Istanbul

WORKDIR /app

# Copy package configuration
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build TypeScript to production JavaScript
RUN npm run build

# Expose web & API port for Traefik / Dokploy
EXPOSE 3000

# Mountable volume for SQLite database & JSON outputs to persist across deployments
VOLUME ["/app/output"]

# Healthcheck for Dokploy / Traefik load balancer
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Default command: run REST API & Web Dashboard
CMD ["npm", "run", "api"]
