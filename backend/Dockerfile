FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
RUN npm install
COPY src ./src/
ENV PRISMA_CONFIG_PATH=""
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate
EXPOSE 4000
CMD ["npx", "ts-node", "--transpile-only", "src/index.ts"]