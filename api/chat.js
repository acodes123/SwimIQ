import { buildChatSystemPrompt, callGroq } from './_lib/groq.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { message, history, context } = req.body || {}
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'No message provided' })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server' })
    }

    const messages = [{ role: 'system', content: buildChatSystemPrompt(context) }]
    if (Array.isArray(history)) {
      for (const m of history.slice(-20)) {
        if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
          messages.push({ role: m.role, content: m.content.slice(0, 2000) })
        }
      }
    }
    messages.push({ role: 'user', content: message.trim().slice(0, 2000) })

    const { ok, status, data } = await callGroq({
      apiKey,
      messages,
      maxTokens: 400,
      temperature: 0.6,
      timeoutMs: 15000,
    })

    if (!ok || !data || data.error) {
      console.error('Groq chat error:', data?.error || status)
      return res.status(502).json({ error: data?.error?.message || `Groq API error (HTTP ${status})` })
    }

    const reply = data.choices?.[0]?.message?.content?.trim()
    if (!reply) {
      return res.status(502).json({ error: 'Groq API returned an empty reply' })
    }

    return res.json({ reply })
  } catch (err) {
    console.error('chat error:', err)
    const message = err.name === 'AbortError' ? 'Coach is taking too long to respond — try again.' : err.message
    return res.status(500).json({ error: message })
  }
}
