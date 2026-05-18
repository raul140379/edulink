FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
RUN npm cache clean --force && npm install
COPY src ./src/
RUN ./node_modules/.bin/prisma generate
EXPOSE 4000
CMD ["node", "-e", "console.log('Starting server...'); require('./node_modules/ts-node').register({transpileOnly: true}); require('./src/index.ts');"]