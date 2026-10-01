# ==========================================
# Stage 1: Build the backend application
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and backend package files
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies across workspaces
RUN npm install

# Copy backend source and Prisma schema
COPY backend/tsconfig.json ./backend/
COPY backend/prisma ./backend/prisma
COPY backend/src ./backend/src

# Generate Prisma client for backend
WORKDIR /app/backend
RUN npx prisma generate

# Compile TypeScript to JavaScript
RUN npm run build

# ==========================================
# Stage 2: Production runner container
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install curl for container health check
RUN apk add --no-cache curl

# Copy root package files and install only production dependencies
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
RUN npm install --omit=dev --workspace=backend

# Copy Prisma schema and generate production Prisma engine
COPY backend/prisma ./backend/prisma
WORKDIR /app/backend
RUN npx prisma generate

# Copy compiled code from builder
COPY --from=builder /app/backend/dist ./dist

# Expose backend port (4000)
EXPOSE 4000

# Docker Healthcheck testing the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start the compiled backend microservice
CMD ["node", "dist/src/index.js"]
