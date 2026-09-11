// 끝말잇기 Web Audio API 신디사이저 사운드 & Web Speech TTS 엔진

let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Ignore audio errors
  }
}

// 키 타이핑 효과음
export function playKeySound(soundEnabled = true) {
  if (!soundEnabled) return
  playTone(560, 0.04, 'square', 0.04)
}

// 정답 성공 차임벨
export function playOkSound(soundEnabled = true) {
  if (!soundEnabled) return
  playTone(660, 0.09, 'sine', 0.16)
  setTimeout(() => playTone(990, 0.14, 'sine', 0.16), 80)
}

// 오답/규칙 위반 부저
export function playErrSound(soundEnabled = true) {
  if (!soundEnabled) return
  playTone(180, 0.22, 'sawtooth', 0.18)
}

// 타이머 카운트다운 째깍소리
export function playTickSound(soundEnabled = true) {
  if (!soundEnabled) return
  playTone(880, 0.05, 'sine', 0.1)
}

// 시작 카운트다운 비프음
export function playCountdownSound(isGo = false, soundEnabled = true) {
  if (!soundEnabled) return
  if (isGo) {
    playTone(520, 0.35, 'sawtooth', 0.2)
  } else {
    playTone(440, 0.12, 'sine', 0.15)
  }
}

// 승리 팡파레
export function playWinSound(soundEnabled = true) {
  if (!soundEnabled) return
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone(freq, 0.22, 'triangle', 0.22)
    }, idx * 110)
  })
}

// 박수 / 리액션 응원 사운드
export function playCheerSound(soundEnabled = true) {
  if (!soundEnabled) return
  const freqs = [400, 600, 800, 1000]
  freqs.forEach((f, i) => {
    setTimeout(() => playTone(f + Math.random() * 80, 0.06, 'triangle', 0.1), i * 40)
  })
}

// 한국어 텍스트 음성 변환(TTS)
export function speakKorean(text, { pitch = 1.0, rate = 1.05, voiceEnabled = true } = {}) {
  if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.pitch = pitch
    utterance.rate = rate
    window.speechSynthesis.speak(utterance)
  } catch {
    // Ignore speech errors
  }
}
