FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.html server.js db.js schema.sql ./
COPY css/ ./css/
COPY js/ ./js/
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]

