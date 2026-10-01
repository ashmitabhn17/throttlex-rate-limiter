# ==========================================
# Stage 1: Build the frontend Next.js application
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm install

# Copy frontend source files
COPY frontend/ ./frontend/
RUN mkdir -p /app/frontend/public

# Build Next.js
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ==========================================
# Stage 2: Production runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app/frontend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy workspace package manifests and install production dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/
RUN npm install --omit=dev --workspace=frontend

# Copy Next.js build artifacts and config
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/frontend/package.json ./frontend/package.json
COPY --from=builder /app/frontend/next.config.js ./frontend/next.config.js

WORKDIR /app/frontend

EXPOSE 3000

CMD ["npm", "start"]
