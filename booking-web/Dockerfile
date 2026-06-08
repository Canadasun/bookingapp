FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# These must be present at BUILD time:
#  - NEXT_PUBLIC_* are inlined into the client bundle.
#  - API_INTERNAL_URL is baked into the /proxy rewrite destination (Next.js
#    evaluates next.config rewrites at build time), so without it the proxy
#    would point at localhost. Railway passes matching service vars as args.
# Default to the Railway auto-domain so builds succeed even when Railway doesn't
# pass the ARG (e.g. if the service variable hasn't been set yet).
ARG NEXT_PUBLIC_BUSINESS_SLUG
ARG NEXT_PUBLIC_BUSINESS_ID
ARG API_INTERNAL_URL=https://bookingapp-production-32f8.up.railway.app
ARG NEXT_PUBLIC_API_URL=https://bookingapp-production-32f8.up.railway.app
ENV NEXT_PUBLIC_BUSINESS_SLUG=$NEXT_PUBLIC_BUSINESS_SLUG
ENV NEXT_PUBLIC_BUSINESS_ID=$NEXT_PUBLIC_BUSINESS_ID
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NODE_ENV=production
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
