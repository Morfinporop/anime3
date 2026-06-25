FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .
RUN npm run build

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["npx", "tsx", "server/index.ts"]
