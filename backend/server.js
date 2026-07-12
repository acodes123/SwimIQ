import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import { renameSync, mkdirSync, existsSync, unlinkSync, createReadStream } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import analyzeStrokeHandler from '../api/analyze-stroke.js'
import chatHandler from '../api/chat.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: join(__dirname, '.env') })

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '50mb' }))

// Anchored to this file so the server works regardless of the cwd it was
// started from (e.g. `node backend/server.js` from the repo root).
const UPLOAD_DIR = join(__dirname, '..', 'uploads')
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 200 * 1024 * 1024 } })

app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const ext = req.file.originalname.split('.').pop() || 'mp4'
  const dest = join(UPLOAD_DIR, `upload.${ext}`)
  renameSync(req.file.path, dest)
  res.json({ path: dest, originalName: req.file.originalname, size: req.file.size })
})

app.get('/api/video-file', (req, res) => {
  const files = ['upload.mp4', 'upload.webm', 'upload.mov', 'youtube_upload.mp4']
  for (const f of files) {
    const p = join(UPLOAD_DIR, f)
    if (existsSync(p)) {
      const ext = extname(p).slice(1)
      const mime = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }[ext] || 'video/mp4'
      res.setHeader('Content-Type', mime)
      createReadStream(p).pipe(res)
      return
    }
  }
  res.status(404).json({ error: 'No video found' })
})

app.post('/api/youtube', async (req, res) => {
  try {
    const { url } = req.body
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'No URL provided' })

    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch {
      return res.status(400).json({ error: 'Invalid URL' })
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Invalid URL' })
    }

    const dest = join(UPLOAD_DIR, 'youtube_upload.mp4')
    if (existsSync(dest)) unlinkSync(dest)

    execFileSync(
      'yt-dlp',
      [
        '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '-o', dest,
        parsedUrl.href,
      ],
      { timeout: 120000, stdio: 'pipe' }
    )

    if (!existsSync(dest)) {
      return res.status(500).json({ error: 'Failed to download video' })
    }

    res.json({ path: dest, originalName: 'YouTube video', source: url })
  } catch (err) {
    console.error('YouTube download error:', err.message)
    res.status(500).json({ error: 'Failed to download: ' + err.message.slice(0, 200) })
  }
})

// The Groq-backed endpoints live in api/ as Vercel serverless functions.
// Their handlers are (req, res) compatible with Express, so the local dev
// server mounts the exact same implementations — no logic duplication.
app.post('/api/analyze-stroke', (req, res) => analyzeStrokeHandler(req, res))
app.post('/api/chat', (req, res) => chatHandler(req, res))

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`SwimIQ backend running on port ${PORT}`)
})
