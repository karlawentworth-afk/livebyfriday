/* ------------------------------------------------------------------
   Stripe webhook. No npm dependencies on purpose, so there is no
   build step to go wrong at eleven o'clock on a Sunday.

   It does three things:
     1. checks the request really came from Stripe
     2. finds the lead by the client_reference_id on the session
     3. marks it paid, using the service role key

   Netlify environment variables required:
     STRIPE_WEBHOOK_SECRET       whsec_...  (from the Stripe webhook page)
     SUPABASE_URL                https://xxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY   the service_role key, never in the browser
-------------------------------------------------------------------*/

import crypto from "node:crypto";

const TOLERANCE_SECONDS = 300;

function verify(rawBody, header, secret){
  if(!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map(function(kv){ const i = kv.indexOf("="); return [kv.slice(0,i), kv.slice(i+1)]; })
  );
  const t = parts.t;
  const sig = parts.v1;
  if(!t || !sig) return false;

  // reject anything older than five minutes, so a captured request
  // cannot be replayed at you later
  if(Math.abs(Math.floor(Date.now()/1000) - Number(t)) > TOLERANCE_SECONDS) return false;

  const expected = crypto.createHmac("sha256", secret)
    .update(t + "." + rawBody, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function patchLead(id, body){
  const url = process.env.SUPABASE_URL + "/rest/v1/leads?id=eq." + encodeURIComponent(id);
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if(!res.ok) throw new Error("Supabase " + res.status + ": " + text);
  return text;
}

export default async (req) => {
  if(req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if(!secret){
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Not configured", { status: 500 });
  }
  if(!verify(raw, req.headers.get("stripe-signature"), secret)){
    console.warn("Rejected a webhook with a bad signature");
    return new Response("Bad signature", { status: 400 });
  }

  let event;
  try { event = JSON.parse(raw); }
  catch(e){ return new Response("Bad JSON", { status: 400 }); }

  // Always answer 200 to events we do not care about, or Stripe keeps
  // retrying and eventually disables the endpoint.
  if(event.type !== "checkout.session.completed"){
    return new Response(JSON.stringify({ ignored: event.type }), { status: 200 });
  }

  const s = event.data.object;
  const leadId = s.client_reference_id;

  if(!leadId){
    console.warn("Paid session with no client_reference_id:", s.id, s.customer_details && s.customer_details.email);
    return new Response(JSON.stringify({ ok: true, note: "no lead id on session" }), { status: 200 });
  }

  try {
    const row = await patchLead(leadId, {
      status: "paid",
      stripe_session_id: s.id,
      amount_paid: s.amount_total,
      paid_at: new Date().toISOString()
    });
    if(row === "[]") console.warn("No lead matched id", leadId, "for session", s.id);
    else console.log("Marked lead", leadId, "paid,", s.amount_total, s.currency);
  } catch(err){
    console.error("Could not update lead", leadId, err.message);
    // 500 makes Stripe retry, which is what we want for a transient failure
    return new Response("Update failed", { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

export const config = { path: "/api/stripe-webhook" };
