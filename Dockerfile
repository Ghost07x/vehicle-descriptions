FROM mcr.microsoft.com/playwright:v1.54.2-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
ENV NODE_ENV=production
# Playwright is preinstalled in this base image

# Unprivileged user
USER pwuser

# Default run
CMD ["node","index.js"]
