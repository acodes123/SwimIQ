import { useState, useCallback, useRef, useEffect } from 'react'

export function useAudioFeedback() {
  const [isEnabled, setIsEnabled] = useState(true)
  const [lastTip, setLastTip] = useState('')
  const cooldownRef = useRef(false)

  const speak = useCallback((text) => {
    if (!isEnabled || cooldownRef.current || text === lastTip) return

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 0.8

    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred

    window.speechSynthesis.speak(utterance)
    setLastTip(text)

    cooldownRef.current = true
    setTimeout(() => {
      cooldownRef.current = false
    }, 5000)
  }, [isEnabled, lastTip])

  const speakTips = useCallback((tips) => {
    if (!tips || tips.length === 0) return
    const tip = tips[0]
    if (tip && tip.text) {
      speak(tip.text)
    }
  }, [speak])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    cooldownRef.current = false
  }, [])

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  return {
    isEnabled,
    setIsEnabled,
    speakTips,
    stop,
  }
}
