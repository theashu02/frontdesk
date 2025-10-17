# Aurora Glow Voice Agent

This Python worker hosts the simulated Aurora Glow Salon receptionist built with the LiveKit Agents framework.
The agent can join a LiveKit room, answer salon FAQs, and escalate to the supervisor dashboard when it cannot
find an answer.

## Prerequisites

- Python 3.10 or newer
- LiveKit Cloud (or self-hosted server) credentials
- API keys for OpenAI, Deepgram, and Cartesia
- Optional: running the Next.js frontend (`apps/frontend`) so escalations can be recorded via `/api/help-requests`

## Quick start

```powershell
cd apps\voice-agent
python -m venv .venv
.\\.venv\Scripts\activate   # use source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
copy .env.example .env      # fill in LiveKit + provider credentials
python salon_agent.py dev   # hot-reloading worker connected to LiveKit
```

Available commands:

- `python salon_agent.py console` &mdash; run the receptionist in a local terminal without LiveKit.
- `python salon_agent.py dev` &mdash; start a reloadable worker that waits for LiveKit jobs/calls.
- `python salon_agent.py start` &mdash; production mode worker.
- `python salon_agent.py download-files` &mdash; (optional) pre-download the turn detector/VAD assets if your version of `livekit-agents` supports it; otherwise they are fetched on demand the first time the agent runs.

## Environment variables

Key settings expected in `.env`:

| Variable | Purpose |
| --- | --- |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Connect the worker to your LiveKit project. |
| `LIVEKIT_ROOM_NAME` | (Optional) Default room name when running in console mode. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | LLM used for the receptionist's reasoning. |
| `DEEPGRAM_API_KEY` / `DEEPGRAM_MODEL` | Speech-to-text transcription. |
| `CARTESIA_API_KEY` / `CARTESIA_VOICE_ID` | Voice for spoken responses. |
| `BACKEND_BASE_URL` | Base URL of the Next.js API (needed for help-request escalations). |
| `AUTO_GREETING` | When `true`, send an initial greeting even if the call is already underway. |

## How the agent works

- The receptionist is prompted with Aurora Glow Salon's business profile and FAQs.
- Every caller question is sent through the `lookup_salon_info` tool. If a confident match is found, the answer is read back to the caller.
- When no answer is available, the agent triggers `request_human_help`, which POSTs to `/api/help-requests` on the frontend. The supervisor dashboard will then show the pending request.
- Optional tools let the agent remember the caller's name and callback number, which are passed along in the help-request payload.

You can expand the FAQ list in `salon_agent.py` or replace the lookup logic with API calls or vector search as needed.
