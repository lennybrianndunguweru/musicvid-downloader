
FROM node:20-slim

# Install deps + Deno (fixes JS runtime warning)
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl unzip && rm -rf /var/lib/apt/lists/*

# Install Deno - required for yt-dlp to bypass bot detection
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# Install yt-dlp latest nightly (has bot fixes)
RUN pip3 install --no-cache-dir --break-system-packages -U yt-dlp --pre

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
