const TRTC_SDK_APP_ID = "";
const TRTC_SDK_SECRET_KEY = "";
const EXPIRE_SECONDS = 60 * 60;
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const toBase64 = (bytes) => {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

const hmacSha256Base64 = async (key, data) => {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(data),
  );
  return toBase64(new Uint8Array(signature));
};

const deflate = async (text) => {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const genUserSig = async (env, userId) => {
  const sdkAppId = Number(TRTC_SDK_APP_ID);
  const time = Math.floor(Date.now() / 1000);
  const toSign =
    `TLS.identifier:${userId}\n` +
    `TLS.sdkappid:${sdkAppId}\n` +
    `TLS.time:${time}\n` +
    `TLS.expire:${EXPIRE_SECONDS}\n`;
  const sig = await hmacSha256Base64(TRTC_SDK_SECRET_KEY, toSign);
  const payload = JSON.stringify({
    "TLS.ver": "2.0",
    "TLS.identifier": userId,
    "TLS.sdkappid": sdkAppId,
    "TLS.expire": EXPIRE_SECONDS,
    "TLS.time": time,
    "TLS.sig": sig,
  });
  return toBase64(await deflate(payload))
    .replace(/\+/g, "*")
    .replace(/\//g, "-")
    .replace(/=/g, "_");
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    const body = await request.json().catch(() => null);
    const userId = body?.userId;
    if (!userId || !USER_ID_PATTERN.test(userId)) {
      return json({ error: "Invalid userId" }, 400);
    }
    const userSig = await genUserSig(env, userId);
    return json({
      sdkAppId: Number(TRTC_SDK_APP_ID),
      userId,
      userSig,
      expireSeconds: EXPIRE_SECONDS,
    });
  },
};