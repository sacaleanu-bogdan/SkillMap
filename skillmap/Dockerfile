# Stage 1: install production dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: build the Next.js application
FROM node:20-alpine AS builder
WORKDIR /app
# Copy all deps (including devDeps) for the build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: minimal production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Neo4j connection — must be supplied at runtime via docker-compose or -e flags
ENV NEO4J_URI=""
ENV NEO4J_USER=""
ENV NEO4J_PASSWORD=""

# Run as a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy only the standalone output and static assets from the builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# next.config.ts output: 'standalone' produces server.js at the root of the standalone dir
CMD ["node", "server.js"]
