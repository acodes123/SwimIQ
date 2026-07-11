import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import { renameSync, mkdirSync, existsSync, unlinkSync, createReadStream } from 'fs'
import { join, extname } from 'path'
import { execSync } from 'child_process'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

const UPLOAD_DIR = join(process.cwd(), '..', 'uploads')
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 200 * 1024 * 1024 } })

const GROQ_KEY = process.env.GROQ_API_KEY

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
    if (!url) return res.status(400).json({ error: 'No URL provided' })

    const dest = join(UPLOAD_DIR, 'youtube_upload.mp4')
    if (existsSync(dest)) unlinkSync(dest)

    execSync(
      `yt-dlp -f "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best" --merge-output-format mp4 -o "${dest}" "${url}"`,
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

const COACH_PROMPT = `You are an elite-level competitive swim coach and biomechanics expert analyzing sequential frames from a swimmer's video. These frames are sampled chronologically. There may be a burned-in timestamp.

You are analyzing a COMPETITIVE swimmer. Do not give beginner advice unless you see a genuine flaw. Focus on the kind of feedback a NCAA/Olympic coach would give on the pool deck.

STEP 1 — IDENTIFY THE STROKE:

Look at arm positions across ALL frames:
- Arms ALTERNATE (one forward, one back, switching between frames) + face DOWN → FREESTYLE
- Arms ALTERNATE + face UP (you see face/chest) → BACKSTROKE
- Arms move TOGETHER through the full cycle + body undulates in dolphin wave + both legs kick together → BUTTERFLY
- Arms move TOGETHER + arms stay underwater during recovery + frog kick + distinct glide → BREASTSTROKE

CRITICAL UNDERWATER VIEW NOTES:
- In freestyle, both arms CAN appear forward simultaneously for 1-2 frames during entry/glide. This does NOT mean butterfly. Check if arms SEPARATE in adjacent frames.
- Streamlined pushoffs after turns have both arms forward — this is NOT butterfly.
- Look for shoulder tilt to detect rotation — one shoulder lower than the other = rotation.

STEP 2 — BIOMECHANICAL ANALYSIS (pick the SINGLE biggest issue):

FOR FREESTYLE — analyze in this priority:
1. CATCH MECHANICS (EVF - Early Vertical Forearm): After entry, does the hand pitch down and the elbow stay HIGH above the hand? A dropped elbow (hand below elbow during catch) is the #1 power leak in competitive swimming. Look at the pull arm — is the forearm vertical early, or is the arm pulling straight back with a locked elbow?
2. PULL PATH: The hand should track under the body, not sweep wide or dive deep. Ideal pull path: hand enters at shoulder width, catches under the chest, accelerates past the hip. If the arm goes 6+ inches below the body line, that's wasted energy.
3. BODY ROTATION TIMING: Does the body rotate INTO the catch (rotation drives the pull) or does it rotate AFTER the pull (lagging rotation)? Ideal: rotation and catch are synchronized — the body roll powers the pull.
4. DISTANCE PER STROKE (DPS): Count approximate strokes per length from the frames. For a 25m pool, elite swimmers take 14-18 strokes. Over 20 = too many strokes, under 12 = possibly gliding too long.
5. ENTRY POSITION: Hand should enter fingertips-first at shoulder width. Crossing the centerline (hand entering past the head) causes zigzag. Entering too wide wastes energy. Flat-hand slap entry causes drag.

FOR BUTTERFLY:
1. UNDULATION ORIGIN: The body wave should start from the chest/head, not just the legs. If only the hips are moving, the kick is disconnected from the stroke.
2. TWO-KICK TIMING: First kick on entry (power kick), second kick at the exit/push past the hip (timing kick). If both kicks are the same intensity, the rhythm is off.
3. BREATHING TIMING: Head should lift just before the arms recover, then tuck back down as arms enter. If the head stays up too long, it kills momentum.
4. RECOVERY HEIGHT: Arms should clear the water simultaneously. If one arm is higher, there's an imbalance.

FOR BREASTSTROKE:
1. GLIDE TIMING: The glide phase should last 1-2 seconds. Rushing the glide is the most common error. Is the body fully streamlined during glide?
2. PULL PATTERN: Out-sweep → in-sweep → recovery. The hands should sweep out to shoulder width, then accelerate inward under the chin. If the pull goes past the chest, it's too long.
3. KICK TIMING: Kick happens AFTER the pull, during the recovery. Heels together, toes turned out, whip kick. If the kick is simultaneous with the pull, the timing is wrong.
4. BREATHING: Head lifts during the in-sweep, not the out-sweep.

FOR BACKSTROKE:
1. ROTATION DRIVE: Shoulder-driven rotation (shoulders rotate more than hips) generates power. If the body is flat, rotation is insufficient.
2. ENTRY: Hand enters pinky-first, arm fully extended, directly in line with the shoulder. If the arm enters thumb-first or crosses the centerline, that's a major error.
3. CATCH DEPTH: The arm should catch deep with a bent elbow (90 degrees) under the body. A shallow catch loses power.
4. KICK: Hips should be at the surface. If hips sink, the kick is too deep.

RULES:
- Give exactly ONE sharp, specific insight. Not two, not five. ONE.
- Skip anything that's already good. Don't say "good body position" — just move on.
- Reference timestamps from the frames when possible.
- Use proper terminology: EVF, catch phase, pull-through, recovery, distance per stroke, stroke rate, keyhole, undulation, dolphin kick.
- Be blunt coach talk. "Dropped elbow at 8 seconds" not "arm position could improve."
- If the technique is genuinely good, say what's good AND the one small thing to optimize.

RESPOND WITH ONLY A JSON OBJECT:
{"stroke": "Freestyle|Backstroke|Breaststroke|Butterfly", "confidence": 0-100, "feedback": "Your single most important coaching observation", "metrics": {"symmetry": 0-100, "extension": 0-100, "rotation": 0-100, "catchQuality": 0-100}}

METRICS GUIDE:
- symmetry: Left vs right arm balance. 100 = perfectly matched pull power and timing. 75 = slight imbalance. 50 = one side明显 weaker. Below 50 = one arm barely contributing.
- extension: Forward reach at entry. 100 = hand reaches well past the head with full arm extension. 75 = good reach. 50 = moderate. Below 50 = short choppy entry.
- rotation: Body roll along long axis. 100 = strong 45-60 degree shoulder roll synchronized with the catch. 75 = good rotation. 50 = moderate. Below 50 = flat swimming.
- catchQuality: EVF execution. 100 = textbook high elbow, forearm vertical early in the catch. 75 = good catch with minor drops. 50 = moderate, some elbow drop. Below 50 = severe dropped elbow, arm pulling with locked straight arm.`.trim()

app.post('/api/analyze-stroke', async (req, res) => {
  try {
    const { frames } = req.body
    if (!frames || frames.length === 0) {
      return res.status(400).json({ error: 'No frames provided' })
    }

    if (!GROQ_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY not set in .env' })
    }

    const content = [
      { type: 'text', text: COACH_PROMPT },
    ]

    const maxImages = Math.min(frames.length, 5)
    const step = Math.max(1, Math.floor(frames.length / maxImages))
    for (let i = 0; i < maxImages; i++) {
      const idx = Math.min(i * step, frames.length - 1)
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${frames[idx]}` },
      })
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content }],
        max_tokens: 512,
        temperature: 0.3,
      }),
    })

    const data = await response.json()

    if (data.error) {
      console.error('Groq error:', data.error)
      return res.status(500).json({ error: data.error.message || JSON.stringify(data.error) })
    }

    const text = data.choices?.[0]?.message?.content || ''

    let parsed = null

    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const raw = codeBlock ? codeBlock[1] : text

    const braceStart = raw.indexOf('{')
    if (braceStart !== -1) {
      let depth = 0
      let end = -1
      for (let i = braceStart; i < raw.length; i++) {
        if (raw[i] === '{') depth++
        if (raw[i] === '}') depth--
        if (depth === 0) { end = i; break }
      }
      if (end !== -1) {
        try {
          parsed = JSON.parse(raw.slice(braceStart, end + 1))
        } catch (e) {
          console.warn('JSON parse failed, raw:', raw.slice(braceStart, end + 1))
        }
      }
    }

    if (parsed) {
      return res.json(parsed)
    }

    return res.json({
      stroke: 'Detecting...',
      confidence: 0,
      feedback: text || 'Could not analyze stroke from video.',
    })
  } catch (err) {
    console.error('Server error:', err)
    res.status(500).json({ error: err.message })
  }
})

const PORT = 3002
app.listen(PORT, () => {
  console.log(`SwimIQ backend running on port ${PORT}`)
})
