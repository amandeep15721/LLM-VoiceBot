# Voice LLM Assistant — Backend

Pipeline: **Audio in → Groq Whisper (STT) → Groq Llama 3.3 (LLM) → ElevenLabs (TTS) → Audio out**

## Setup

```bash
cd voice-llm-backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env and paste in your real GROQ_API_KEY and ELEVENLABS_API_KEY
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

Server runs at `http://localhost:8000`. Interactive API docs (Swagger) at `http://localhost:8000/docs`.

## Quick test (no frontend needed)

Record a short question as `test.webm` / `test.wav` (e.g. using your phone's voice memo app, or the browser), then:

```bash
curl -X POST http://localhost:8000/api/voice-query \
  -F "audio=@test.wav" \
  -F "session_id=demo"
```

You'll get back JSON like:

```json
{
  "session_id": "demo",
  "transcript": "What's the capital of France?",
  "answer_text": "The capital of France is Paris.",
  "audio_base64": "//uQx..."
}
```

To actually hear the response, decode and play the audio:

```bash
python3 -c "
import json, base64
data = json.load(open('response.json'))
with open('reply.mp3', 'wb') as f:
    f.write(base64.b64decode(data['audio_base64']))
"
# then open reply.mp3 in any audio player
```

(Redirect the curl output to `response.json` first: add `-o response.json` to the curl command above.)

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Health check |
| POST | `/api/voice-query` | Main pipeline — send audio, get transcript + answer + spoken reply |
| POST | `/api/reset-session` | Clear conversation memory for a `session_id` |

## Notes

- Conversation memory is a simple in-memory Python dict keyed by `session_id` — resets when the server restarts. Fine for a demo; swap for Redis/a DB for anything persistent.
- `MAX_HISTORY_TURNS` in `main.py` caps how much prior conversation gets sent to the LLM each turn (keeps latency and token usage down).
- CORS is wide open (`allow_origins=["*"]`) for local development. Lock this down if you ever deploy publicly.
- Any audio format the browser's MediaRecorder produces (typically `.webm`) works fine — Whisper handles it directly, no conversion needed.
