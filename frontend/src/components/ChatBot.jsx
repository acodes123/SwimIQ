import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-[#1a1f2e] px-4 py-3">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-typing-dot"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function MessageBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-md bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
            : 'rounded-bl-md bg-[#1a1f2e] text-slate-200'
        }`}
      >
        {content}
      </div>
    </div>
  )
}

// Floating coach chat. `context` is the analysis result:
// { strokeType, strokeConfidence, symmetry, extension, rotation, catchQuality, feedback }
export default function ChatBot({ context }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const hasGreetedRef = useRef(false)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading, isOpen])

  const openChat = useCallback(() => {
    setIsOpen(true)
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true
      const stroke = context?.strokeType && context.strokeType !== 'Detecting...'
        ? context.strokeType
        : 'swimming'
      setMessages([{
        role: 'assistant',
        content: `Hey! I just analyzed your ${stroke} stroke. Ask me anything about your form — I can explain the feedback in more detail or suggest specific drills.`,
      }])
    }
    setTimeout(() => inputRef.current?.focus(), 250)
  }, [context])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)
      let res
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: messages,
            context: context || {},
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      let reply
      if (res.ok) {
        const data = await res.json()
        reply = data.reply
      } else {
        let errMessage = 'Something went wrong.'
        try {
          const err = await res.json()
          if (err.error) errMessage = err.error
        } catch { /* non-JSON body */ }
        reply = `Sorry, I couldn't respond right now (${errMessage}). Try again in a moment.`
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply || 'Sorry, I got an empty response — try again.' }])
    } catch (err) {
      const reason = err.name === 'AbortError' ? 'the coach took too long to respond' : 'a connection problem'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, ${reason}. Ask me again in a moment.`,
      }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, context])

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex h-[min(480px,calc(100dvh-7rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f1a] shadow-2xl shadow-black/50 animate-chat-in">

          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Coach SwimIQ</div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Ready to help
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              title="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <TypingIndicator />
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.06] p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about your form…"
                disabled={isLoading}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500/50 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-white transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                title="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-slate-700">
              Powered by SwimIQ AI
            </p>
          </div>
        </div>
      )}

      {!isOpen && (
        <button
          onClick={openChat}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-xl shadow-cyan-500/30 transition-all hover:scale-105 hover:shadow-cyan-400/40"
          title="Ask your AI coach"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}
