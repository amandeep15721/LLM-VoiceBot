"""
Voice LLM Assistant - Backend
Pipeline: Audio in -> Groq Whisper (STT) -> Groq Llama 3.3 (LLM) -> ElevenLabs (TTS) -> Audio out
"""

import os
import time
import base64
import tempfile
from typing import List, Dict

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
import requests

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # default "Rachel" voice

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not set. Add it to your .env file.")
if not ELEVENLABS_API_KEY:
    raise RuntimeError("ELEVENLABS_API_KEY not set. Add it to your .env file.")

groq_client = Groq(api_key=GROQ_API_KEY)

app = FastAPI(title="Voice LLM Assistant API")

# CORS - open for local dev; tighten allow_origins before any real deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- In-memory conversation store (per session_id) ---
# Simple dict is enough for a demo. Resets when the server restarts.
conversation_store: Dict[str, List[Dict[str, str]]] = {}

SYSTEM_PROMPT = (
    "You are a helpful, concise voice assistant. "
    "Keep answers short and conversational (1-3 sentences) since they will be spoken aloud. "
    "Avoid markdown, bullet points, or special formatting."
)

MAX_HISTORY_TURNS = 6  # keep last N exchanges to control token usage/latency


class ChatResponse(BaseModel):
    session_id: str
    transcript: str
    answer_text: str
    audio_base64: str  # MP3 audio, base64-encoded
    stt_ms: int  # time spent transcribing audio
    llm_ms: int  # time spent generating the answer
    tts_ms: int  # time spent synthesizing speech
    total_ms: int  # total pipeline time


def transcribe_audio(file_path: str) -> str:
    """Send audio file to Groq's hosted Whisper endpoint and return the transcript."""
    with open(file_path, "rb") as f:
        transcription = groq_client.audio.transcriptions.create(
            file=(os.path.basename(file_path), f.read()),
            model="whisper-large-v3",
            response_format="text",
        )
    return str(transcription).strip()


def get_llm_response(session_id: str, user_text: str) -> str:
    """Send the transcript + conversation history to Groq's LLM and return the reply text."""
    history = conversation_store.setdefault(session_id, [])

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history[-MAX_HISTORY_TURNS * 2:])  # each turn = 1 user msg + 1 assistant msg
    messages.append({"role": "user", "content": user_text})

    completion = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.6,
        max_tokens=200,
    )
    answer = completion.choices[0].message.content.strip()

    history.append({"role": "user", "content": user_text})
    history.append({"role": "assistant", "content": answer})

    return answer


def synthesize_speech(text: str) -> bytes:
    """Call ElevenLabs TTS API and return raw MP3 audio bytes."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",  # low-latency model, good for conversational demos
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs TTS failed: {resp.status_code} {resp.text}",
        )
    return resp.content


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Voice LLM Assistant API is running"}


@app.post("/api/voice-query", response_model=ChatResponse)
async def voice_query(
    audio: UploadFile = File(...),
    session_id: str = Form(default="default"),
):
    """
    Main pipeline endpoint:
    1. Receive recorded audio from the frontend
    2. Transcribe it (Groq Whisper)
    3. Get an LLM answer (Groq Llama 3.3, with conversation memory)
    4. Synthesize the answer to speech (ElevenLabs)
    5. Return transcript + answer text + base64 audio
    """
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        pipeline_start = time.perf_counter()

        stt_start = time.perf_counter()
        transcript = transcribe_audio(tmp_path)
        stt_ms = int((time.perf_counter() - stt_start) * 1000)

        if not transcript:
            raise HTTPException(status_code=400, detail="Could not transcribe audio (empty result).")

        llm_start = time.perf_counter()
        answer_text = get_llm_response(session_id, transcript)
        llm_ms = int((time.perf_counter() - llm_start) * 1000)

        tts_start = time.perf_counter()
        audio_bytes = synthesize_speech(answer_text)
        tts_ms = int((time.perf_counter() - tts_start) * 1000)

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        total_ms = int((time.perf_counter() - pipeline_start) * 1000)

        return ChatResponse(
            session_id=session_id,
            transcript=transcript,
            answer_text=answer_text,
            audio_base64=audio_b64,
            stt_ms=stt_ms,
            llm_ms=llm_ms,
            tts_ms=tts_ms,
            total_ms=total_ms,
        )
    finally:
        os.remove(tmp_path)


@app.post("/api/reset-session")
def reset_session(session_id: str = Form(default="default")):
    """Clear conversation memory for a session (e.g. a 'New conversation' button)."""
    conversation_store.pop(session_id, None)
    return {"status": "reset", "session_id": session_id}
