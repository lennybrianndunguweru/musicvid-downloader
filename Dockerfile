FROM node:20-slim

# Install base deps
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl unzip git && rm -rf /var/lib/apt/lists/*

# Install Deno properly - v1.40+ required for yt-dlp EJS
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Verify deno works
RUN /root/.deno/bin/deno --version

# Link deno to /usr/local/bin so yt-dlp finds it
RUN ln -sf /root/.deno/bin/deno /usr/local/bin/deno

# Install yt-dlp nightly (has new challenge solver + PO token support)
RUN pip3 install --no-cache-dir --break-system-packages -U "yt-dlp[default]" --pre
# Also install latest from master to be safe
RUN pip3 install --no-cache-dir --break-system-packages -U https://github.com/yt-dlp/yt-dlp/archive/master.tar.gz

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
