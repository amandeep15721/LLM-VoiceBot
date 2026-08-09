import { useRef, useState, useEffect, useCallback } from 'react'
import { sendVoiceQuery, resetSession, VoiceQueryResponse } from './lib/api'

type AppState = 'idle' | 'recording' | 'processing' | 'speaking' | 'error'

interface Message {
  role: 'user' | 'assistant'
  text: string
  latency?: {
    sttMs: number
    llmMs: number
    ttsMs: number
    totalMs: number
  }
}

const STATUS_LABEL: Record<AppState, string> = {
  idle: 'Tap the mic to speak',
  recording: 'Listening…',
  processing: 'Thinking…',
  speaking: 'Speaking…',
  error: 'Something went wrong',
}

const SESSION_ID = 'demo-session'

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll transcript to the latest message
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startRecording = useCallback(async () => {
    setErrorMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        void handleSubmitAudio(audioBlob)
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setAppState('recording')
    } catch (err) {
      console.error(err)
      setErrorMessage('Microphone access was denied or is unavailable. Check your browser permissions.')
      setAppState('error')
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setAppState('processing')
  }, [])

  const handleSubmitAudio = async (audioBlob: Blob) => {
    try {
      const result: VoiceQueryResponse = await sendVoiceQuery(audioBlob, SESSION_ID)

      setMessages((prev) => [
        ...prev,
        { role: 'user', text: result.transcript },
        {
          role: 'assistant',
          text: result.answer_text,
          latency: {
            sttMs: result.stt_ms,
            llmMs: result.llm_ms,
            ttsMs: result.tts_ms,
            totalMs: result.total_ms,
          },
        },
      ])

      playAudioResponse(result.audio_base64)
    } catch (err) {
      console.error(err)
      const detail =
        (err as any)?.response?.data?.detail ||
        'Failed to reach the backend. Is the FastAPI server running on port 8000?'
      setErrorMessage(String(detail))
      setAppState('error')
    }
  }

  const playAudioResponse = (audioBase64: string) => {
    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`)
    audioPlayerRef.current = audio
    setAppState('speaking')

    audio.onended = () => setAppState('idle')
    audio.onerror = () => {
      setErrorMessage('Could not play the audio response.')
      setAppState('error')
    }

    void audio.play()
  }

  const handleMicClick = () => {
    if (appState === 'idle' || appState === 'error') {
      void startRecording()
    } else if (appState === 'recording') {
      stopRecording()
    }
  }

  const handleReset = async () => {
    try {
      await resetSession(SESSION_ID)
      setMessages([])
      setErrorMessage(null)
      setAppState('idle')
    } catch (err) {
      console.error(err)
      setErrorMessage('Could not reset the session.')
    }
  }

  const orbStateClass =
    appState === 'recording' ? 'orb-listening' : appState === 'speaking' ? 'orb-speaking' : 'orb-idle'

  const orbColorClass =
    appState === 'recording'
      ? 'bg-cyan'
      : appState === 'speaking'
      ? 'bg-amber'
      : appState === 'error'
      ? 'bg-red-400'
      : 'bg-mist/40'

  const ringColorClass = appState === 'recording' ? 'border-cyan/50' : 'border-mist/20'

  const isBusy = appState === 'processing' || appState === 'speaking'

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 md:py-12">
      {/* Header */}
      <header className="w-full max-w-xl flex items-center justify-between mb-8">
        <div>
          <p className="font-mono text-xs tracking-widest text-muted uppercase">Voice Assistant</p>
          <h1 className="font-display text-xl font-semibold text-mist">Ask me anything</h1>
        </div>
        <button
          onClick={handleReset}
          className="font-mono text-xs uppercase tracking-wide text-muted hover:text-mist border border-surfaceLight rounded-full px-3 py-1.5 transition-colors"
        >
          Reset
        </button>
      </header>

      {/* Orb */}
      <div className={`relative flex items-center justify-center h-48 w-48 mb-6 ${orbStateClass}`}>
        {appState === 'recording' && (
          <>
            <span className={`orb-ring absolute inset-0 rounded-full border ${ringColorClass}`} />
            <span className={`orb-ring absolute inset-0 rounded-full border ${ringColorClass}`} />
            <span className={`orb-ring absolute inset-0 rounded-full border ${ringColorClass}`} />
          </>
        )}
        <div
          className={`orb-core relative h-28 w-28 rounded-full ${orbColorClass} shadow-[0_0_60px_-10px_rgba(94,234,212,0.4)]`}
        />
      </div>

      <p className="font-mono text-sm text-muted mb-8 h-5">{STATUS_LABEL[appState]}</p>

      {errorMessage && (
        <div className="w-full max-w-xl mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 font-body">
          {errorMessage}
        </div>
      )}

      {/* Transcript */}
      <div className="w-full max-w-xl flex-1 flex flex-col bg-surface rounded-2xl border border-surfaceLight overflow-hidden mb-8">
        <div className="transcript-scroll flex-1 min-h-[260px] max-h-[420px] overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 ? (
            <p className="font-body text-sm text-muted text-center mt-16">
              Your conversation will appear here once you start speaking.
            </p>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-body leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-cyan/15 text-mist rounded-br-sm'
                      : 'bg-surfaceLight text-mist rounded-bl-sm'
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted mb-1">
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </p>
                  {msg.text}
                  {msg.latency && (
                    <p className="font-mono text-[10px] text-muted mt-2 pt-2 border-t border-mist/10">
                      STT {msg.latency.sttMs}ms · LLM {msg.latency.llmMs}ms · TTS {msg.latency.ttsMs}ms · Total{' '}
                      {msg.latency.totalMs}ms
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Mic button */}
      <button
        onClick={handleMicClick}
        disabled={isBusy}
        className={`font-display font-semibold text-sm rounded-full px-8 py-3.5 transition-all
          ${
            appState === 'recording'
              ? 'bg-cyan text-ink hover:bg-cyan/90'
              : isBusy
              ? 'bg-surfaceLight text-muted cursor-not-allowed'
              : 'bg-mist text-ink hover:bg-mist/90'
          }`}
      >
        {appState === 'recording' ? 'Stop recording' : isBusy ? 'Please wait…' : 'Start speaking'}
      </button>
    </div>
  )
}
