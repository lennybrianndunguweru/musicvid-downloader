
import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to build yt-dlp command that bypasses bot detection
function buildYtDlpArgs() {
  let args = '';
  // Use android client + ios client - bypasses bot check, no cookies needed 90% of time
  args += ' --extractor-args "youtube:player_client=android,web"';
  args += ' --no-playlist';
  // Add user agent
  args += ' --user-agent "Mozilla/5.0 (Linux; Android 12; SM-S906N Build/QP1A.190711.020) AppleWebKit/537.36"';
  // If cookies.txt exists in root, use it
  const cookiePath = path.join(__dirname, 'cookies.txt');
  if (fs.existsSync(cookiePath)) {
    args += ` --cookies "${cookiePath}"`;
    console.log('Using cookies.txt');
  }
  return args;
}

app.get('/api/info', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'No URL' });
  
  const extra = buildYtDlpArgs();
  const cmd = `yt-dlp ${extra} --dump-json "${url}"`;
  console.log('CMD:', cmd);
  
  exec(cmd, { maxBuffer: 1024*1024*20 }, (err, stdout, stderr) => {
    if (err) {
      console.error(stderr);
      // Fallback to Piped API if yt-dlp fails
      return res.status(500).json({ error: stderr.slice(-500) });
    }
    try {
      const data = JSON.parse(stdout);
      res.json({
        title: data.title,
        thumbnail: data.thumbnail || `https://img.youtube.com/vi/${data.id}/maxresdefault.jpg`,
        duration: data.duration,
        uploader: data.uploader
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse' });
    }
  });
});

app.get('/api/download', (req, res) => {
  const url = req.query.url;
  const quality = req.query.quality || '1080';
  if (!url) return res.status(400).json({ error: 'No URL' });
  
  const id = Date.now();
  const outputTemplate = `/tmp/video_${id}.%(ext)s`;
  
  const extra = buildYtDlpArgs();
  const cmd = `yt-dlp ${extra} -f "bestvideo[height<=${quality}]+bestaudio/best" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;
  console.log('DOWNLOAD CMD:', cmd);
  
  exec(cmd, { maxBuffer: 1024*1024*100 }, (err, stdout, stderr) => {
    if (err) {
      console.error(stderr);
      return res.status(500).json({ error: 'Download failed. Try adding cookies.txt. Details: ' + stderr.slice(-600) });
    }
    const files = fs.readdirSync('/tmp').filter(f => f.startsWith(`video_${id}`));
    if (files.length === 0) return res.status(500).json({ error: 'File not found after download' });
    const filePath = path.join('/tmp', files[0]);
    res.download(filePath, `music_video_${quality}p.mp4`, () => {
      try { fs.unlinkSync(filePath); } catch {}
    });
  });
});

// New endpoint: Cobalt fallback (works when yt-dlp blocked)
app.get('/api/download-cobalt', async (req, res) => {
  const url = req.query.url;
  try {
    const r = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url, vQuality: '1080', vCodec: 'h264', filenamePattern: 'basic' })
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Fixed server running on ${PORT}`));
