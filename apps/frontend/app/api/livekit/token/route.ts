import { NextResponse } from "next/server"
import { AccessToken } from "livekit-server-sdk"

const API_KEY = process.env.LIVEKIT_API_KEY
const API_SECRET = process.env.LIVEKIT_API_SECRET
const SHARED_SECRET = process.env.LIVEKIT_PSTN_SHARED_SECRET

type TokenRequest = {
  identity?: string
  roomName?: string
  metadata?: string
  ttl?: number
}

export async function POST(request: Request) {
  if (!API_KEY || !API_SECRET) {
    return NextResponse.json(
      { error: "LiveKit credentials are not configured" },
      { status: 500 },
    )
  }

  if (SHARED_SECRET) {
    const provided = request.headers.get("x-livekit-shared-secret")
    if (provided !== SHARED_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const payload = (await request.json().catch(() => ({}))) as TokenRequest
  const identity = payload.identity?.trim()
  const roomName = payload.roomName?.trim()

  if (!identity || !roomName) {
    return NextResponse.json(
      { error: "identity and roomName are required" },
      { status: 400 },
    )
  }

  const token = new AccessToken(API_KEY, API_SECRET, {
    identity,
    metadata: payload.metadata,
  })

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  const ttlSeconds = typeof payload.ttl === "number" ? payload.ttl : undefined
  const jwt = token.toJwt(ttlSeconds ? { expiresIn: ttlSeconds } : undefined)

  return NextResponse.json({ token: jwt })
}
