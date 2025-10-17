import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Annotated, Optional

import httpx
from dotenv import load_dotenv
from pydantic import Field

from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.llm import function_tool
from livekit.agents.voice import Agent, AgentSession, RunContext
from livekit.plugins import cartesia, deepgram, openai, silero


logger = logging.getLogger("salon-agent")
logging.basicConfig(level=logging.INFO)

load_dotenv()


SALON_PROFILE = {
    "name": "Aurora Glow Salon",
    "tagline": "a boutique hair and spa studio in downtown Denver",
    "address": "123 Market Street, Denver, CO 80202",
    "parking": "Validated parking in the Market Street Garage across the street.",
    "contact": "+1 (303) 555-0188",
    "hours": {
        "monday": "9am-6pm",
        "tuesday": "9am-6pm",
        "wednesday": "9am-6pm",
        "thursday": "9am-7pm",
        "friday": "9am-7pm",
        "saturday": "9am-4pm",
        "sunday": "closed",
    },
}

SALON_FAQ = [
    {
        "id": "hours",
        "question": "What are your business hours?",
        "answer": (
            "We are open Monday through Friday from 9am to 7pm, Saturdays from 9am to 4pm, "
            "and we are closed on Sundays. Our busiest times are late afternoons, so book ahead "
            "if you prefer those slots."
        ),
        "keywords": {"hours", "open", "time", "closing", "schedule"},
        "phrases": {"when are you open", "business hours"},
    },
    {
        "id": "location",
        "question": "Where are you located?",
        "answer": (
            "Aurora Glow Salon is at 123 Market Street in downtown Denver. "
            "We validate parking for the Market Street Garage right across from our entrance."
        ),
        "keywords": {"where", "location", "address", "parking", "directions"},
        "phrases": {"where are you located", "what is your address"},
    },
    {
        "id": "services",
        "question": "What services do you offer?",
        "answer": (
            "We specialize in modern cuts, balayage color, blowouts, and restorative hair treatments. "
            "We also have a spa lounge for express facials and brow shaping. "
            "New guests love our 'Glow & Go' package, which bundles a cut, gloss, and blowout."
        ),
        "keywords": {"services", "offer", "haircut", "color", "facial", "brow"},
        "phrases": {"what services", "do you offer", "service list"},
    },
    {
        "id": "pricing",
        "question": "What is your pricing like?",
        "answer": (
            "Signature haircuts start at $85, specialty color starts at $185, "
            "and the Glow & Go package is $230. Prices vary slightly by artist level. "
            "We always confirm the quote before we begin."
        ),
        "keywords": {"price", "cost", "pricing", "rate"},
        "phrases": {"how much", "what do you charge"},
    },
    {
        "id": "policies",
        "question": "What is your cancellation policy?",
        "answer": (
            "We kindly ask for 24 hours notice to cancel or reschedule. "
            "Late cancellations or no-shows are subject to a $50 fee so that we can compensate our artists."
        ),
        "keywords": {"cancel", "policy", "reschedule", "no show"},
        "phrases": {"cancellation policy", "late fee"},
    },
    {
        "id": "stylists",
        "question": "Do you accept new clients?",
        "answer": (
            "Yes, we are accepting new guests. Tell me your styling goals and I can match you with "
            "an artist who specializes in that look."
        ),
        "keywords": {"new client", "accepting", "available", "book"},
        "phrases": {"accepting new", "take new clients"},
    },
]


class SalonKnowledgeBase:
    def __init__(self, entries: list[dict], minimum_confidence: float = 1.5) -> None:
        self._entries = entries
        self._minimum_confidence = minimum_confidence

    def match(self, text: str) -> tuple[Optional[dict], float]:
        """Return best matching FAQ entry along with a confidence score."""
        normalized = text.lower()
        tokens = set(re.findall(r"[a-z0-9]+", normalized))

        best_entry: Optional[dict] = None
        best_score = 0.0

        for entry in self._entries:
            score = 0.0

            for keyword in entry.get("keywords", []):
                if keyword in tokens:
                    score += 1.0

            for phrase in entry.get("phrases", []):
                if phrase in normalized:
                    score += 1.5

            if score > best_score:
                best_entry = entry
                best_score = score

        return best_entry, best_score

    def instructions_fragment(self) -> str:
        formatted = []
        for entry in self._entries:
            formatted.append(f"- {entry['question']}: {entry['answer']}")
        return "\n".join(formatted)

    @property
    def threshold(self) -> float:
        return self._minimum_confidence


knowledge_base = SalonKnowledgeBase(SALON_FAQ)


@dataclass
class SalonUserData:
    caller_name: Optional[str] = None
    caller_phone: Optional[str] = None
    pending_help_request_id: Optional[str] = None
    last_escalation_payload: Optional[dict] = None


RunContext_T = RunContext[SalonUserData]


def _normalize_topic(entry: Optional[dict]) -> Optional[str]:
    if not entry:
        return None
    return entry.get("id")


@function_tool()
async def update_caller_name(
    name: Annotated[str, Field(description="The caller's name if they have provided it.")],
    context: RunContext_T,
) -> str:
    userdata = context.userdata
    userdata.caller_name = name
    return f"Remembered the caller's name as {name}."


@function_tool()
async def update_caller_phone(
    phone: Annotated[str, Field(description="The best callback number for the caller.")],
    context: RunContext_T,
) -> str:
    userdata = context.userdata
    userdata.caller_phone = phone
    return f"Saved the caller's phone number as {phone}."


@function_tool()
async def lookup_salon_info(
    question: Annotated[str, Field(description="The caller's latest question or request.")],
    context: RunContext_T,
) -> dict:
    """Look up the salon knowledge base for the caller's request."""
    entry, score = knowledge_base.match(question)
    response = {
        "match": False,
        "confidence": score,
        "faqId": _normalize_topic(entry),
        "answer": None,
    }

    if entry and score >= knowledge_base.threshold:
        response["match"] = True
        response["answer"] = entry["answer"]

    logger.info("lookup_salon_info | question=%s | match=%s | score=%.2f", question, response["match"], score)
    return response


async def _post_help_request(question: str, context: RunContext_T) -> dict:
    backend_base_url = os.getenv("BACKEND_BASE_URL")
    if not backend_base_url:
        logger.warning("BACKEND_BASE_URL not configured, skipping help request POST.")
        return {
            "escalated": False,
            "reason": "BACKEND_BASE_URL is not set; logging only.",
        }

    payload = {
        "question": question,
        "customerPhone": context.userdata.caller_phone,
        "customerName": context.userdata.caller_name,
        "channel": "livekit",
    }

    url = backend_base_url.rstrip("/") + "/api/help-requests"
    logger.info("posting help request to %s | payload=%s", url, json.dumps(payload))

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        logger.exception("Failed to create help request: %s", exc)
        return {
            "escalated": False,
            "reason": f"Failed to create help request: {exc}",
        }

    return {
        "escalated": True,
        "requestId": data.get("id"),
        "status": data.get("status", "pending"),
        "backendResponse": data,
    }


@function_tool()
async def request_human_help(
    question: Annotated[str, Field(description="The question that could not be answered from the knowledge base.")],
    context: RunContext_T,
) -> dict:
    """Escalate the conversation to a human supervisor."""
    if context.userdata.pending_help_request_id:
        logger.info(
            "Help already requested | request_id=%s", context.userdata.pending_help_request_id
        )
        return {
            "escalated": True,
            "requestId": context.userdata.pending_help_request_id,
            "status": "pending",
            "duplicate": True,
        }

    result = await _post_help_request(question, context)

    if result.get("escalated"):
        context.userdata.pending_help_request_id = result.get("requestId")
        context.userdata.last_escalation_payload = result

    return result


def build_agent_instructions() -> str:
    return (
        f"You are the voice receptionist for {SALON_PROFILE['name']}, {SALON_PROFILE['tagline']}.\n"
        f"Address: {SALON_PROFILE['address']}. Contact number: {SALON_PROFILE['contact']}.\n"
        "You speak with warmth, keep answers under 3 sentences, and always sound confident.\n"
        "Workflow:\n"
        "1. Always call the `lookup_salon_info` tool with the caller's exact question before you answer.\n"
        "2. If the lookup result returns `match: true`, respond using `answer` and add any helpful detail from the profile.\n"
        "3. If the lookup result returns `match: false`, apologize briefly, call `request_human_help`, "
        "and tell the caller a supervisor will follow up soon.\n"
        "4. Offer to capture the caller's name or callback number when it helps using the `update_caller_name` "
        "and `update_caller_phone` tools.\n"
        "5. Never guess. Escalate whenever you are unsure or the caller requests a human.\n"
        "\n"
        "Salon knowledge for quick reference:\n"
        f"{knowledge_base.instructions_fragment()}\n"
        "\n"
        "Always confirm if the caller has additional questions before ending the conversation."
    )


class SalonReceptionistAgent(Agent):
    async def on_enter(self) -> None:
        await super().on_enter()
        greeting = (
            f"Thank you for calling {SALON_PROFILE['name']}. "
            "This is the virtual front desk. How can I make your day easier?"
        )
        await self.say(greeting)


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    userdata = SalonUserData()

    voice_id = os.getenv("CARTESIA_VOICE_ID")
    tts_kwargs: dict[str, str] = {}
    if voice_id:
        tts_kwargs["voice"] = voice_id

    session = AgentSession[SalonUserData](
        userdata=userdata,
        stt=deepgram.STT(model=os.getenv("DEEPGRAM_MODEL", "nova-2")),
        llm=openai.LLM(model=os.getenv("OPENAI_MODEL", "gpt-4o-mini")),
        tts=cartesia.TTS(**tts_kwargs),
        vad=silero.VAD.load(),
        max_tool_steps=4,
    )

    agent = SalonReceptionistAgent(
        instructions=build_agent_instructions(),
        tools=[lookup_salon_info, request_human_help, update_caller_name, update_caller_phone],
    )

    await session.start(agent=agent, room=ctx.room)

    if os.getenv("AUTO_GREETING", "false").lower() in {"true", "1", "yes"}:
        await session.generate_reply(
            instructions="Welcome the caller, mention the salon name, and ask how you can help."
        )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
