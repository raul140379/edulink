FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
RUN npm cache clean --force && npm install
COPY src ./src/
COPY start.sh ./
RUN chmod +x start.sh
RUN ./node_modules/.bin/prisma generate
EXPOSE 4000
CMD ["/bin/sh", "start.sh"]