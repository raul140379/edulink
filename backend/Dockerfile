FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
RUN npm install
COPY src ./src/
RUN npx prisma generate
EXPOSE 4000
CMD ["npx", "ts-node", "--transpile-only", "src/index.ts"]