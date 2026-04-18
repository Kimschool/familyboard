FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js db.js auth.js ./
COPY public ./public

ENV NODE_ENV=production
EXPOSE 3010

CMD ["node", "server.js"]
