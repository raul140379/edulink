# Build v2 - Prisma 6.7.0
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
RUN npm install
COPY src ./src/
RUN ./node_modules/.bin/prisma generate
EXPOSE 4000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/ts-node --transpile-only src/index.ts"]