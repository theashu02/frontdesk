# Front Desk AI Receptionist

This repo demonstrates a human-in-the-loop voice receptionist for a hair salon. A LiveKit-powered agent greets callers, answers common questions from a knowledge base, and escalates unknown questions to a supervisor dashboard. Human supervisors respond from a Next.js admin UI, and their answers are saved so the agent learns over time.

## Project layout

- `apps/frontend` – Next.js 15 app that serves the supervisor dashboard and REST APIs.
- `apps/voice-agent` – Python LiveKit agent that handles live calls and escalations.
- `apps/frontend/data/frontdesk-db.json` – JSON store for help requests and knowledge entries (auto-seeded on first run).

## Prerequisites

- Node.js 18+ (Bun is the package manager configured in `package.json`).
- Python 3.10+ for the LiveKit worker.
- LiveKit Cloud project and API credentials.
- API keys for speech/LLM providers: OpenAI, Deepgram, Cartesia (defaults used in the Python script).

---

## Run the supervisor dashboard

```bash
# from repo root
bun install          # installs workspace dependencies
bun run dev --filter frontend
```

Open http://localhost:3000 to see the supervisor UI. All REST endpoints are exposed from the same app under `/api`.

### Seed data

On first launch, `apps/frontend/data/frontdesk-db.json` is created with example salon FAQs. You can edit this file directly or manage entries from the **Knowledge Base** tab in the dashboard.

### REST API cheatsheet

| Method & path | Description |
| --- | --- |
| `GET /api/help-requests?status=pending|resolved|timeout|all` | List help requests. |
| `POST /api/help-requests` | Create a new escalation (`{ question, customerPhone, customerName?, channel? }`). |
| `GET /api/help-requests/:id` | Fetch a single request. |
| `PATCH /api/help-requests/:id` | Resolve (`{ answer, supervisorName?, supervisorNotes?, shouldAddToKnowledgeBase? }`) or mark timeout (`{ action: "timeout" }`). |
| `GET /api/knowledge-base?q=<query>&limit=<n>` | Search the knowledge base. |
| `POST /api/knowledge-base` | Upsert an entry (`{ question, answer, tags?, source? }`). |
| `POST /api/livekit/token` | Issue a LiveKit access token (used by LiveKit PSTN bridge). |

`apps/frontend/app/api/livekit/token/route.ts` expects:

```jsonc
{
  "identity": "caller-identifier",
  "roomName": "room-to-join",
  "metadata": "...",    // optional
  "ttl": 3600           // optional JWT TTL in seconds
}
```

Include the header `x-livekit-shared-secret` when you configure the webhook (set `LIVEKIT_PSTN_SHARED_SECRET` to enforce it).

---

## Run the LiveKit voice agent (local testing)

```bash
cd apps/voice-agent
cp .env.example .env     # populate LIVEKIT_*, BACKEND_BASE_URL, provider keys
python -m venv .venv
.venv\Scripts\activate   # Windows
# or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python salon_agent.py download-files   # pulls turn detector model
python salon_agent.py dev              # starts the dev worker (auto-reloads)
```

The agent joins the LiveKit room defined in `.env`. Every caller question is matched against the built-in Aurora Glow Salon FAQ before responding. If no answer is found, the agent escalates to the supervisor dashboard. While running in `dev` mode, the CLI watches for file changes and reloads automatically.

### Escalation workflow

1. Caller asks a question.
2. Agent invokes the `lookup_salon_info` tool to score the question against salon FAQs bundled in `salon_agent.py`.
3. If a confident match is found, the answer is delivered immediately. Otherwise, the agent triggers `request_human_help`, which `POST`s to `/api/help-requests`.
4. Supervisors can reply from the dashboard. The agent notifies the caller that a human will follow up (and the payload includes the caller's name/phone when collected).

---

## Bridge real phone calls with LiveKit Cloud PSTN

The Python worker only listens in a LiveKit room; to reach it from a real phone call, use LiveKit Cloud’s PSTN feature to bridge PSTN callers into that room.

1. **Expose LiveKit credentials to the Next.js app**  
   Create `apps/frontend/.env.local` (or set environment vars in your hosting platform):
   ```bash
   LIVEKIT_URL=wss://<your-livekit-host>
   LIVEKIT_API_KEY=<cloud-api-key>
   LIVEKIT_API_SECRET=<cloud-api-secret>
   LIVEKIT_PSTN_SHARED_SECRET=<random-long-string>   # optional but recommended
   ```
   Restart the Next.js dev server so the API route picks up the values.

2. **Deploy or tunnel the Next.js API**  
   LiveKit Cloud must reach your `/api/livekit/token` endpoint. In development use a tunneling tool (ngrok, Cloudflare Tunnel) or deploy the frontend to a public URL. Note the full HTTPS endpoint, e.g. `https://your-domain/api/livekit/token`.

3. **Configure LiveKit Cloud PSTN**  
   - In the LiveKit Cloud dashboard, enable PSTN and claim a phone number (or configure SIP).
   - Set the “Token Request URL” (or equivalent webhook) to `POST https://your-domain/api/livekit/token`.
   - Supply any headers LiveKit requires; if you set `LIVEKIT_PSTN_SHARED_SECRET`, add `x-livekit-shared-secret: <same secret>`.
   - Choose the room name LiveKit should create/bridge into (e.g. `frontdesk-salon`). Configure your Python worker to join the same room (`LIVEKIT_ROOM_NAME` in `.env`).

4. **Start the worker**  
   Make sure `python salon_agent.py dev` (or `start`) is running with the same LiveKit credentials.

5. **Test the phone call**  
   Dial the LiveKit PSTN number. LiveKit will:
   - Create (or reuse) the configured room.
   - Call your `/api/livekit/token` endpoint to mint an access token for the caller.
   - Bridge audio between the PSTN caller and the LiveKit room where your agent is connected.

If you need to differentiate caller identities, include metadata in the PSTN configuration (LiveKit sends it as part of the token payload), then store that metadata with the help request.

---

## Frontend experience

The supervisor dashboard offers three tabs:

- **Pending Requests** – triage queue with suggested answers and a reply form.
- **History** – record of resolved/time-out requests with answers and supervisors.
- **Knowledge Base** – browse and add canonical answers; saving here teaches the agent permanently.

The dashboard refreshes automatically every 15 seconds and includes a manual **Refresh** button.

---

## Development notes

- Persistence is a JSON file for simplicity. Swap `apps/frontend/lib/store.ts` for your preferred database in production.
- Console logs in API routes simulate “texting” the customer. Replace with Twilio or another SMS/webhook integration to notify customers for real.
- The Python agent uses LiveKit plugin defaults (Deepgram STT, Cartesia TTS, OpenAI LLM). Switch providers by updating `.env` and, if needed, the requirements file.
- Remember to run `bun install` after pulling repo changes that modify JavaScript dependencies (e.g. the LiveKit server SDK).

---

## Next steps

- Add authentication/role-based access to the dashboard.
- Replace file storage with hosted data (Supabase, DynamoDB, etc.).
- Connect the “text the customer” path to SMS/CRM tooling.
- Add monitoring or alerts for stale pending requests.
