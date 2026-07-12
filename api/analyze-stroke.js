import { buildAnalyzeContent, extractJson, normalizeAnalysis, callGroq } from './_lib/groq.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { frames } = req.body || {}
    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: 'No frames provided' })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server' })
    }

    const { ok, status, data } = await callGroq({
      apiKey,
      messages: [{ role: 'user', content: buildAnalyzeContent(frames) }],
      maxTokens: 512,
      temperature: 0.2,
    })

    if (!ok || !data || data.error) {
      console.error('Groq error:', data?.error || status)
      return res.status(502).json({ error: data?.error?.message || `Groq API error (HTTP ${status})` })
    }

    const text = data.choices?.[0]?.message?.content || ''
    const normalized = normalizeAnalysis(extractJson(text))

    if (normalized) {
      return res.json(normalized)
    }

    return res.json({
      stroke: 'Detecting...',
      confidence: 0,
      feedback: text.slice(0, 300) || 'Could not analyze stroke from video.',
    })
  } catch (err) {
    console.error('analyze-stroke error:', err)
    const message = err.name === 'AbortError' ? 'Groq API request timed out' : err.message
    return res.status(500).json({ error: message })
  }
}
