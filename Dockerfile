
FROM node:20-slim

# Install python, pip and ffmpeg (required for 1080p merge)
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && rm -rf /var/lib/apt/lists/*

# Install yt-dlp (latest)
RUN pip3 install --no-cache-dir --break-system-packages -U yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
