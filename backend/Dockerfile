FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
EXPOSE 4000
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npx ts-node src/index.ts"]