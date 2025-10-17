from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass

import httpx
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    ToolError,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import cartesia, deepgram, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv()

logger = logging.getLogger("salon-agent")


@dataclass
class SalonContext:
    http: httpx.AsyncClient
    customer_contact: str


class SalonReceptionAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are the friendly AI receptionist for Luna Salon, a boutique hair studio. "
                "Answer questions about our hours, services, pricing, and policies using the provided tools. "
                "Always double-check the company knowledge base before replying. "
                "If the lookup tool reports that the answer is unknown, escalate immediately using "
                "`escalate_to_supervisor` and reassure the caller that a human will follow up. "
                "Keep responses short (2 sentences max) and natural for voice calls. "
                "Never invent offers, prices, or availability that you cannot confirm."
            )
        )

    @function_tool
    async def lookup_knowledge_base(
        self,
        ctx: RunContext[SalonContext],
        question: str,
        *,
        limit: int = 1,
    ) -> str:
        """
        Search the salon knowledge base for the best matching answer.

        Returns the answer text if found. Raises a ToolError if no match exists.
        """
        logger.info("Searching knowledge base for question=%s", question)
        client = ctx.userdata.http
        response = await client.get(
            "/api/knowledge-base",
            params={"q": question, "limit": limit},
        )
        response.raise_for_status()
        payload = response.json()
        matches = payload.get("data") or []
        if not matches:
            raise ToolError("knowledge_not_found")
        answer = matches[0]["answer"]
        logger.info("Found KB answer: %s", answer)
        return answer

    @function_tool
    async def escalate_to_supervisor(
        self,
        ctx: RunContext[SalonContext],
        question: str,
    ) -> str:
        """
        Ask a human supervisor for help when the answer is not in the knowledge base.

        Creates a help request, waits briefly for a response, and forwards the human's answer
        back to the caller. If no answer arrives in time, promise a follow-up message instead.
        """
        logger.warning("Escalating to supervisor for question=%s", question)
        client = ctx.userdata.http
        contact = ctx.userdata.customer_contact or "unknown"
        response = await client.post(
            "/api/help-requests",
            json={
                "question": question,
                "customerPhone": contact,
                "channel": "voice",
            },
        )
        response.raise_for_status()
        payload = response.json()
        request_id = payload["data"]["id"]
        logger.info("Created help request id=%s", request_id)

        ctx.disallow_interruptions()
        try:
            answer = await wait_for_resolution(client, request_id=request_id)
        finally:
            ctx.allow_interruptions()

        if answer:
            logger.info("Supervisor responded for request=%s", request_id)
            return f"My supervisor just confirmed: {answer}"

        logger.info("Supervisor response pending for request=%s", request_id)
        return (
            "I just checked with my supervisor. They'll text you the details as soon as they see this."
        )


async def wait_for_resolution(
    client: httpx.AsyncClient,
    *,
    request_id: str,
    poll_interval: float = 5.0,
    timeout_seconds: float = 120.0,
) -> str | None:
    """Poll the backend for a resolved answer."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout_seconds
    while loop.time() < deadline:
        response = await client.get(f"/api/help-requests/{request_id}")
        response.raise_for_status()
        payload = response.json()
        data = payload.get("data") or {}
        status = data.get("status")
        if status == "resolved" and data.get("answer"):
            return data["answer"]
        if status == "timeout":
            return None
        await asyncio.sleep(poll_interval)
    return None


async def entrypoint(ctx: JobContext):
    logging.basicConfig(level=logging.INFO)
    await ctx.connect()

    backend_base_url = os.getenv("BACKEND_BASE_URL", "http://localhost:3000")
    default_contact = os.getenv("DEFAULT_CUSTOMER_CONTACT", "unknown")

    http_client = httpx.AsyncClient(base_url=backend_base_url, timeout=10.0)
    userdata = SalonContext(http=http_client, customer_contact=default_contact)

    voice_id = os.getenv(
        "CARTESIA_VOICE_ID",
        "39b376fc-488e-4d0c-8b37-e00b72059fdd",
    )
    voice_speed = os.getenv("CARTESIA_VOICE_SPEED", "medium")

    session = AgentSession[SalonContext](
        userdata=userdata,
        stt=deepgram.STT(),
        llm=openai.LLM(model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"), temperature=0.2),
        tts=cartesia.TTS(voice=voice_id, speed=voice_speed),
        turn_detection=MultilingualModel(),
        vad=silero.VAD.load(),
        max_tool_steps=2,
    )

    try:
        await session.start(agent=SalonReceptionAgent(), room=ctx.room)
    finally:
        await http_client.aclose()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
