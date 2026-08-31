/* Serves a built site at /preview/<lead id>. Noindex, so a preview can
   never outrank the real thing once it goes live on its own domain. */
export default async (req) => {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  if(!/^[0-9a-f-]{36}$/i.test(id || "")) return new Response("Not found", { status:404 });

  const r = await fetch(process.env.SUPABASE_URL +
    "/rest/v1/leads?id=eq." + encodeURIComponent(id) + "&select=site_html", {
    headers:{ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY }});
  if(!r.ok) return new Response("Upstream error", { status:502 });

  const rows = await r.json();
  if(!rows.length || !rows[0].site_html)
    return new Response("<!doctype html><meta charset=utf-8><title>Not built yet</title><body style=\"font:16px system-ui;padding:40px\">Nothing built for that reference yet.", 
      { status:404, headers:{ "content-type":"text/html; charset=utf-8" }});

  return new Response(rows[0].site_html, { status:200, headers:{
    "content-type":"text/html; charset=utf-8",
    "x-robots-tag":"noindex, nofollow",
    "cache-control":"no-store"
  }});
};
export const config = { path: "/preview/*" };
