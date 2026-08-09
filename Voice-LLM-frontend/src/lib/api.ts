import axios from 'axios'

// Set VITE_API_BASE_URL in a .env file if your backend runs somewhere other than localhost:8000
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface VoiceQueryResponse {
  session_id: string
  transcript: string
  answer_text: string
  audio_base64: string
  stt_ms: number
  llm_ms: number
  tts_ms: number
  total_ms: number
}

/** Send a recorded audio blob to the backend and get back transcript + answer + spoken reply. */
export async function sendVoiceQuery(audioBlob: Blob, sessionId: string): Promise<VoiceQueryResponse> {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')
  formData.append('session_id', sessionId)

  const { data } = await axios.post<VoiceQueryResponse>(`${API_BASE}/api/voice-query`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/** Clear conversation memory for a session (used by the Reset button). */
export async function resetSession(sessionId: string): Promise<void> {
  const formData = new FormData()
  formData.append('session_id', sessionId)
  await axios.post(`${API_BASE}/api/reset-session`, formData)
}
