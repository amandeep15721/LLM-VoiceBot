# Voice LLM Assistant — Frontend

React + TypeScript + Tailwind UI: mic button, animated voice orb, live transcript, and audio playback.
Talks to the FastAPI backend you already have running.

## Setup

```bash
cd voice-llm-frontend
npm install
```

If your backend runs somewhere other than `http://localhost:8000`, copy `.env.example` to `.env` and edit the URL. Otherwise you can skip this — it defaults to `localhost:8000` automatically.

## Run

Make sure your backend is running first (`uvicorn main:app --reload --port 8000` in the backend folder), then in a **separate terminal**:

```bash
npm run dev
```

This starts the frontend at `http://localhost:5173`. Open that in your browser.

## Using it

1. Click **"Start speaking"** — your browser will ask for microphone permission the first time. Allow it.
2. Ask your question out loud.
3. Click **"Stop recording"**.
4. The orb turns amber and the AI's spoken answer plays automatically, with the text conversation appearing below.
5. Click **Reset** any time to clear the conversation and start fresh.

## Notes

- The orb's color/animation directly reflects pipeline state: cyan pulsing rings = listening, amber flicker = AI speaking, calm neutral = idle. Useful to point out in your interview — it's showing pipeline state visually, not just decoration.
- If the mic button doesn't do anything, check your browser's address bar for a blocked microphone-permission icon.
- Browsers only allow microphone access on `localhost` or `https://` — this is why local dev works fine on `http://localhost:5173` but won't work if you try to access it via your machine's IP address from another device without HTTPS.
