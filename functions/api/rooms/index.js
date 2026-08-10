// /api/rooms  (POST) — create a new room, backed by Cloudflare KV.
// The room code itself is the KV key, so there's no separate directory
// lookup needed the way jsonblob required.

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function randInt(n) {
  return Math.floor(Math.random() * n);
}
function genCode() {
  let s = "";
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[randInt(CODE_ALPHABET.length)];
  return s;
}
function blankBoard() {
  return { games: 0, p1Wins: 0, p2Wins: 0, p1Pts: 0, p2Pts: 0, history: [] };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    /* no/invalid body is fine — default name below */
  }
  const name = (body && typeof body.name === "string" && body.name.trim()) || "Player 1";

  // 5-char codes from a 32-symbol alphabet is ~33M combinations, so
  // collisions are practically impossible for two casual players; a
  // few collision-check retries are just cheap insurance.
  let code = null;
  for (let attempt = 0; attempt < 8 && !code; attempt++) {
    const candidate = genCode();
    const existing = await env.ROOM_KV.get(candidate);
    if (existing) continue;
    code = candidate;
  }
  if (!code) {
    return new Response(JSON.stringify({ error: "code-failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const room = {
    code,
    rev: 1,
    phase: "waiting",
    seats: { p1: { name, present: true }, p2: { name: null, present: false } },
    game: null,
    board: blankBoard(),
    createdAt: Date.now(),
  };

  await env.ROOM_KV.put(code, JSON.stringify(room));

  return new Response(JSON.stringify(room), {
    status: 201,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Anything other than POST on this route is not supported.
export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response(JSON.stringify({ error: "method-not-allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
