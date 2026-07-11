import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import { renameSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

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

const COACH_PROMPT = `You are an elite-level competitive swim coach analyzing underwater and above-water footage of a swimmer. These are SEQUENTIAL frames in chronological order.

ASSUME THIS IS A COMPETITIVE SWIMMER. Do not give beginner advice like "keep your head down" or "stay horizontal" unless you see a clear problem. Focus on what a real coach would correct at a meet.

STEP 1 — IDENTIFY THE STROKE:

- Arms ALTERNATE across frames + face DOWN → FREESTYLE
- Arms ALTERNATE + face UP → BACKSTROKE
- Arms move TOGETHER + over-water recovery + body undulates → BUTTERFLY
- Arms move TOGETHER + underwater recovery + frog kick + glide → BREASTSTROKE

UNDERWATER VIEW NOTES:
- Freestyle HAS brief moments both arms forward during entry/glide — this is NOT butterfly. Check if arms separate in adjacent frames.
- Streamlined pushoffs/turns with both arms forward are NOT butterfly.
- Look for shoulder tilt differences between frames to detect rotation.

STEP 2 — GIVE PRO-LEVEL FEEDBACK (pick the #1 most impactful thing only):

FOR FREESTYLE — prioritize in this order:
1. CATCH MECHANICS (EVF): Is the elbow higher than the hand during the catch? Dropped elbow = lost propulsion. This is the #1 thing coaches fix. If the pulling arm goes deep below the body line with a straight elbow, say so.
2. PULL PATH: Is the hand tracking along the body line or going too deep/wide? Deep pull wastes energy. Modern coaching favors a straighter pull path under the body, not a wide sweep.
3. BODY ROTATION: Angle, timing relative to catch. Is rotation driving the pull or trailing it?
4. DISTANCE PER STROKE: Too many strokes per length = wasted efficiency.
5. ENTRY: Fingertip entry, not flat hand. Entry point at shoulder width, not crossing centerline.

FOR BUTTERFLY:
1. DOLPHIN UNDULATION: Is the body wave driving from the chest or just the legs?
2. KICK-ARM SYNC: Two kicks per arm cycle — timing of each kick.
3. RECOVERY: Are both arms clearing the water simultaneously?
4. BREATHING: Is the head leading the body wave or lagging behind?

FOR BREASTSTROKE:
1. PULL-BREATHE-KICK-GLIDE TIMING: Is the glide phase held long enough?
2. KEYHOLE PULL: Arms sweeping out then in under the chin.
3. KICK: Frog kick with heels together, toes turned out.

FOR BACKSTROKE:
1. ROTATION: Shoulder-driven or hip-driven?
2. ENTRY: Pinky-first entry, arm straight.
3. CATCH: Bent elbow catch deep under the body.
4. KICK: Steady flutter, hips at surface.

RULES FOR FEEDBACK:
- Give ONE sharp insight, not five mediocre observations.
- If body position/head/kick are already good, SKIP THEM entirely.
- Reference specific frames or timestamps if possible (e.g., "around the 8-second mark").
- Use coaching terminology: EVF, catch phase, pull-through, recovery, distance per stroke, stroke rate.
- Be direct and blunt — coach talk, not encouragement.
- If you see a dropped elbow, say "dropped elbow" not "arm position could improve."

Respond with ONLY a JSON object in this exact format:
{"stroke": "Freestyle|Backstroke|Breaststroke|Butterfly", "confidence": 0-100, "feedback": "Your single most important coaching observation — specific, technical, and actionable.", "metrics": {"symmetry": 0-100, "extension": 0-100, "rotation": 0-100, "catchQuality": 0-100}}

METRICS GUIDE (estimate from the frames):
- symmetry: How equal are the left and right arm strokes? 100 = perfectly matched, 50 = one side明显 weaker, 0 = one side barely working.
- extension: How fully does the swimmer reach forward at entry? 100 = full extension past the head, 50 = moderate reach, 0 = short choppy entry.
- rotation: How well does the body rotate along the long axis? 100 = strong 45-60 degree shoulder roll, 50 = moderate rotation, 0 = flat/no rotation.
- catchQuality: Is the elbow high during the catch (EVF)? 100 = textbook high elbow, 50 = moderate, 0 = severe dropped elbow.`.trim()

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
