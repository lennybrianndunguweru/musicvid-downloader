
import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: '/tmp/' });

function getCookiePath() {
  const p1 = path.join(__dirname, 'cookies.txt');
  const p2 = '/tmp/cookies.txt';
  if (fs.existsSync(p1)) return p1;
  if (fs.existsSync(p2)) return p2;
  return null;
}

function buildArgs() {
  const cookiePath = getCookiePath();
  // 2026 bypass: use multiple clients, tv_embedded bypasses bot check best
  let args = ' --no-playlist --extractor-args "youtube:player_client=android,web,tv_embedded,ios" --extractor-args "youtube:player_skip=webpage,configs"';
  args += ' --user-agent "Mozilla/5.0 (Linux; Android 12; SM-S906N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"';
  if (cookiePath) {
    args += ` --cookies "${cookiePath}"`;
  }
  // Add sleep to avoid 429
  args += ' --sleep-requests 1';
  return args;
}

app.post('/api/upload-cookies', upload.single('cookies'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const dest = path.join(__dirname, 'cookies.txt');
    fs.copyFileSync(req.file.path, dest);
    fs.copyFileSync(req.file.path, '/tmp/cookies.txt');
    res.json({ success: true, message: 'cookies.txt saved, try download again' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/status', (req, res) => {
  const hasCookies = !!getCookiePath();
  res.json({ hasCookies, cookiePath: getCookiePath() });
});

app.get('/api/info', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'No URL' });
  const extra = buildArgs();
  const cmd = `yt-dlp ${extra} --dump-json "${url}"`;
  exec(cmd, { maxBuffer: 1024*1024*20 }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr.slice(-800), hasCookies: !!getCookiePath() });
    }
    try {
      const data = JSON.parse(stdout);
      res.json({
        title: data.title,
        thumbnail: data.thumbnail || `https://img.youtube.com/vi/${data.id}/maxresdefault.jpg`,
        duration: data.duration,
        uploader: data.uploader,
        hasCookies: !!getCookiePath()
      });
    } catch (e) {
      res.status(500).json({ error: 'Parse failed' });
    }
  });
});

app.get('/api/download', (req, res) => {
  const url = req.query.url;
  const quality = req.query.quality || '1080';
  if (!url) return res.status(400).json({ error: 'No URL' });
  const id = Date.now();
  const outputTemplate = `/tmp/video_${id}.%(ext)s`;
  const extra = buildArgs();
  const cmd = `yt-dlp ${extra} -f "bestvideo[height<=${quality}]+bestaudio/best" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;
  console.log(cmd);
  exec(cmd, { maxBuffer: 1024*1024*100 }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: stderr.slice(-1000), hasCookies: !!getCookiePath() });
    }
    const files = fs.readdirSync('/tmp').filter(f => f.startsWith(`video_${id}`));
    if (files.length === 0) return res.status(500).json({ error: 'File not found' });
    const filePath = path.join('/tmp', files[0]);
    res.download(filePath, `music_video_${quality}p.mp4`, () => {
      try { fs.unlinkSync(filePath); } catch {}
    });
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`v3 running on ${PORT}`));
