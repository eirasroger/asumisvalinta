const encoder = new TextEncoder();

function authorized(request, secret) {
  const given = encoder.encode(request.headers.get("x-store-secret") ?? "");
  const expected = encoder.encode(secret);
  return given.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(given, expected);
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST" || !authorized(request, env.STORE_SECRET)) {
      return new Response(null, { status: 403 });
    }
    const { statements } = await request.json();
    try {
      const results = await env.DB.batch(
        statements.map(({ sql, params }) => env.DB.prepare(sql).bind(...params)),
      );
      return Response.json({ results: results.map((result) => result.results) });
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 500 });
    }
  },
};
