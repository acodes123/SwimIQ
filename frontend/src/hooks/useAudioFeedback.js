import { useState, useCallback, useRef, useEffect } from 'react'

const COOLDOWN_MS = 5000

export function useAudioFeedback() {
  const [isEnabled, setIsEnabled] = useState(true)
  const isEnabledRef = useRef(true)
  const lastTipRef = useRef('')
  const cooldownRef = useRef(false)
  const cooldownTimerRef = useRef(null)

  useEffect(() => {
    isEnabledRef.current = isEnabled
  }, [isEnabled])

  const speak = useCallback((text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    if (!isEnabledRef.current || cooldownRef.current) return
    if (!text || typeof text !== 'string' || text === lastTipRef.current) return

    try {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1.0
      utterance.volume = 0.8

      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
        || voices.find(v => v.lang.startsWith('en'))
      if (preferred) utterance.voice = preferred

      window.speechSynthesis.speak(utterance)
      lastTipRef.current = text

      cooldownRef.current = true
      clearTimeout(cooldownTimerRef.current)
      cooldownTimerRef.current = setTimeout(() => {
        cooldownRef.current = false
      }, COOLDOWN_MS)
    } catch (err) {
      console.warn('Speech synthesis failed:', err)
    }
  }, [])

  // Speaks the most important tip from an array of {type, text} objects.
  // Warnings take priority over info/success.
  const speakTips = useCallback((tips) => {
    if (!Array.isArray(tips) || tips.length === 0) return
    const tip = tips.find(t => t && t.type === 'warning' && t.text) || tips.find(t => t && t.text)
    if (tip) speak(tip.text)
  }, [speak])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    clearTimeout(cooldownTimerRef.current)
    cooldownRef.current = false
    lastTipRef.current = ''
  }, [])

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
      clearTimeout(cooldownTimerRef.current)
    }
  }, [])

  return {
    isEnabled,
    setIsEnabled,
    speakTips,
    stop,
  }
}
