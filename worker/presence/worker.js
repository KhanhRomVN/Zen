const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

export class PresenceRoom {
  constructor(state) {
    this.state = state;
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  count(exclude) {
    const ids = new Set();
    for (const ws of this.state.getWebSockets()) {
      if (ws === exclude) continue;
      ids.add(ws.deserializeAttachment()?.uid ?? crypto.randomUUID());
    }
    return ids.size;
  }

  broadcast(exclude) {
    const message = JSON.stringify({ online: this.count(exclude) });
    for (const ws of this.state.getWebSockets()) {
      if (ws === exclude) continue;
      try {
        ws.send(message);
      } catch {}
    }
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ online: this.count() });
    }
    const uid =
      new URL(request.url).searchParams.get("uid") || crypto.randomUUID();
    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ uid });
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code);
    } catch {}
    this.broadcast(ws);
  }

  webSocketError(ws) {
    this.broadcast(ws);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }
    const room = env.PRESENCE.get(env.PRESENCE.idFromName("global"));
    return room.fetch(request);
  },
};