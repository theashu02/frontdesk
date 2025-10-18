import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("LiveKit credentials are not configured");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const sharedSecret = process.env.LIVEKIT_PSTN_SHARED_SECRET;
  if (sharedSecret) {
    const provided = request.headers.get("x-livekit-shared-secret");
    if (provided !== sharedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const identity = body?.identity;
    const roomName = body?.roomName;
    const metadata = body?.metadata;
    const ttl = body?.ttl ? Number(body.ttl) : undefined;

    if (!identity || !roomName) {
      return NextResponse.json(
        { error: "identity and roomName are required" },
        { status: 400 },
      );
    }

    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity,
      metadata,
      ttl,
    });

    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await accessToken.toJwt();
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Failed to mint LiveKit token", error);
    return NextResponse.json(
      { error: "Failed to mint LiveKit token" },
      { status: 500 },
    );
  }
}
