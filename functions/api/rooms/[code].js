// /api/rooms/:code  (GET, PUT) — fetch or overwrite a room's state in
// Cloudflare KV. Last-write-wins; the client owns the `rev` counter and
// increments it on every write (unchanged from the old jsonblob scheme).

export async function onRequestGet(context) {
  const { params, env } = context;
  const code = String(params.code || "").toUpperCase();

  const raw = await env.ROOM_KV.get(code);
  if (!raw) {
    return new Response(JSON.stringify({ error: "not-found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  return new Response(raw, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function onRequestPut(context) {
  const { request, params, env } = context;
  const code = String(params.code || "").toUpperCase();

  let text;
  try {
    text = await request.text();
    JSON.parse(text); // validate it's real JSON before persisting
  } catch (e) {
    return new Response(JSON.stringify({ error: "invalid-body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  await env.ROOM_KV.put(code, text);

  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Anything other than GET/PUT on this route is not supported.
export async function onRequest(context) {
  const method = context.request.method;
  if (method === "GET") return onRequestGet(context);
  if (method === "PUT") return onRequestPut(context);
  return new Response(JSON.stringify({ error: "method-not-allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
