FROM mcr.microsoft.com/playwright/node:v22

WORKDIR /app
COPY . .

RUN npm install

CMD ["node", "index.js"]
