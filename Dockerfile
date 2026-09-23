# Tsukimori multiplayer server: serves the game and multiplayer on one port.
#   docker build -t tsukimori . && docker run -p 8787:8787 -v tsukimori-data:/data tsukimori
FROM node:22-alpine
WORKDIR /app
COPY index.html servers.json ./
COPY server/server.js server/
ENV PORT=8787 DATA_FILE=/data/tsukimori.json
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "server/server.js"]
