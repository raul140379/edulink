# Build v4 - Skip migrate deploy
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
RUN npm cache clean --force && npm install
COPY src ./src/
RUN ./node_modules/.bin/prisma generate
EXPOSE 4000
CMD ["./node_modules/.bin/ts-node", "--transpile-only", "src/index.ts"]