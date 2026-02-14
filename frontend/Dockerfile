# Stage 1: Install dependencies (shared by dev and prod)
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Dev target: used by docker-compose.yml with hot-reload
FROM deps AS dev

WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# Prod build: compile static assets
FROM deps AS build

WORKDIR /app
COPY . .
RUN npm run build

# Prod target: serve with nginx (reverse-proxies /api/* to backend)
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
