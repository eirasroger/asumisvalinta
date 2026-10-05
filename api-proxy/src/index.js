export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-proxy-secret", env.PROXY_SECRET);
    headers.set("x-client-ip", request.headers.get("cf-connecting-ip") ?? "");

    return fetch(new URL(url.pathname + url.search, env.ORIGIN), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });
  },
};
