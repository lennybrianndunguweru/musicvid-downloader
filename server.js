
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

// Get video info
app.get('/api/info', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'No URL' });
  
  exec(`yt-dlp --dump-json --no-playlist "${url}"`, { maxBuffer: 1024*1024*10 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    try {
      const data = JSON.parse(stdout);
      res.json({
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        uploader: data.uploader,
        formats: data.formats
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse' });
    }
  });
});

// Download 1080p
app.get('/api/download', (req, res) => {
  const url = req.query.url;
  const quality = req.query.quality || '1080';
  
  if (!url) return res.status(400).json({ error: 'No URL' });
  
  const id = Date.now();
  const outputTemplate = `/tmp/video_${id}.%(ext)s`;
  const finalPath = `/tmp/video_${id}.mp4`;
  
  console.log(`Downloading ${url} at ${quality}p`);
  
  // yt-dlp format: bestvideo height <= quality + bestaudio merged to mp4
  const cmd = `yt-dlp -f "bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${quality}]+bestaudio/best" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;
  
  exec(cmd, { maxBuffer: 1024*1024*50 }, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Download failed: ' + err.message });
    }
    // Find the file
    const files = fs.readdirSync('/tmp').filter(f => f.startsWith(`video_${id}`));
    if (files.length === 0) return res.status(500).json({ error: 'File not found' });
    
    const filePath = path.join('/tmp', files[0]);
    res.download(filePath, `music_video_${quality}p.mp4`, () => {
      // cleanup
      try { fs.unlinkSync(filePath); } catch {}
    });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
