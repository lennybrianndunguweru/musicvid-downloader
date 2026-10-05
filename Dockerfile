FROM node:20-slim
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"
# Use nightly with latest bot fixes
RUN pip3 install --no-cache-dir --break-system-packages -U https://github.com/yt-dlp/yt-dlp/archive/master.tar.gz
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
