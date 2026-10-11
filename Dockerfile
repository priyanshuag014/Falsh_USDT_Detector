# Multi-stage Docker build for Flash USDT Detector
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY src ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S flashusdt -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy Prisma schema and generated client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy config files
COPY .env.example .env.example

# Create logs directory
RUN mkdir -p logs && chown -R flashusdt:nodejs logs

# Switch to non-root user
USER flashusdt

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]