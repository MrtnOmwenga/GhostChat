# Builds the frontend, then serves it from the API server so page, API and WebSocket share one origin.
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production STATIC_DIR=/app/public
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY --from=frontend /build/dist ./public
USER node
EXPOSE 5000
HEALTHCHECK CMD wget -qO- http://localhost:5000/health || exit 1
CMD ["node", "src/index.js"]
