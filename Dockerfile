# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY tsconfig*.json ./

# Install development dependencies
RUN npm ci

# Copy source files
COPY src/ ./src/
COPY tests/ ./tests/
COPY frontend/ ./frontend/

# Build frontend and backend
RUN npm run build

# Remove development dependencies
RUN npm prune --production


# Stage 2: Serve the application
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy only the compiled outputs and production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 8080

# Run the server
CMD ["node", "dist/server.js"]
