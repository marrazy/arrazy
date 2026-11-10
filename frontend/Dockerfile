# 1. Build the site with Node
FROM node:22-alpine AS build
WORKDIR /app

# Install packages first, so this step is reused until package-lock.json changes
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=https://api.arrazy.com
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# 2. Serve the finished files with Nginx.
# On the server, docker-compose mounts nginx.conf and the certificates into this image.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
