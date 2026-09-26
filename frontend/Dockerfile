# Multi-stage production build for React frontend

# Stage 1: Build static assets with Vite
FROM node:20-alpine AS build

WORKDIR /app

# Build arguments for Vite compilation
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve static assets with Nginx
FROM nginx:alpine

# Remove default Nginx site configuration
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration with SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
