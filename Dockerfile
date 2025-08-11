

FROM mcr.microsoft.com/playwright:v1.54.2-jammy

WORKDIR /app
COPY . .

RUN npm install

CMD ["node", "index.js"]
