# Stage 1: Build
FROM node:24-slim AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace configuration
COPY package.json package-lock.json ./
COPY projects/cli/package.json ./projects/cli/
COPY projects/ui/package.json ./projects/ui/
COPY projects/shared/package.json ./projects/shared/

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune development dependencies
RUN npm prune --omit=dev

# Stage 2: Runtime
FROM node:24-slim

WORKDIR /app

# Create the data directory and set permissions for the non-root node user
RUN mkdir -p /home/node/.tressi && chown -R node:node /home/node/.tressi /app

# Copy built artifacts and pruned node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/LICENSE ./LICENSE
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Switch to the non-root user
USER node

# Expose the default Tressi port
EXPOSE 3108

# Set environment variables
ENV NODE_ENV=production

# Set the entrypoint to the Tressi CLI
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["serve"]
