/* ------------------------------------------------------------------
   Stripe webhook. No npm dependencies on purpose, so there is no
   build step to go wrong at eleven o'clock on a Sunday.

   It does four things:
     1. checks the request really came from Stripe
     2. finds the lead by the client_reference_id on the session
     3. marks it paid, using the service role key (only if not already paid)
     4. sends two emails via Resend: one to the buyer, one to Karla

   Netlify environment variables required:
     STRIPE_WEBHOOK_SECRET       whsec_...  (from the Stripe webhook page)
     SUPABASE_URL                https://xxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY   the service_role key, never in the browser
     RESEND_API_KEY              re_...     (from resend.com)
     OWNER_EMAIL                 where job notifications go
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

  if(Math.abs(Math.floor(Date.now()/1000) - Number(t)) > TOLERANCE_SECONDS) return false;

  const expected = crypto.createHmac("sha256", secret)
    .update(t + "." + rawBody, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const sb = (path, init) => fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, {
  ...init,
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
    ...(init && init.headers)
  }
});

async function getLead(id){
  const r = await sb("leads?id=eq." + encodeURIComponent(id) + "&select=*");
  if(!r.ok) return null;
  const rows = await r.json();
  return rows.length ? rows[0] : null;
}

async function patchLead(id, body){
  const r = await sb("leads?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  if(!r.ok) throw new Error("Supabase " + r.status + ": " + text);
  return text;
}

async function sendEmail(to, subject, text){
  const key = process.env.RESEND_API_KEY;
  if(!key){ console.warn("RESEND_API_KEY not set, skipping email to", to); return; }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Live by Friday <hello@livebyfriday.co.uk>",
      reply_to: process.env.OWNER_EMAIL || "hello@livebyfriday.co.uk",
      to: [to],
      subject,
      text
    })
  });
  if(!r.ok){
    const err = await r.text();
    throw new Error("Resend " + r.status + ": " + err);
  }
}

function buyerEmail(lead){
  const name = lead.contact_name ? lead.contact_name.split(" ")[0] : "there";
  return `Hi ${name},

Thanks for that. Your payment has gone through and everything you sent us is safely in.

Here is what happens next.

We build your site today or tomorrow, then send you a link to look at on your phone. Have a proper look in your own time. If something is wrong, or you have thought of something you forgot, just reply to this email and tell us. Nothing is set in stone.

When you are happy, say go, and it is live on your own web address within the hour.

That is it. Nothing else for you to do for now.

Karla
Live by Friday
livebyfriday.co.uk`;
}

function ownerEmail(lead, amount){
  const pounds = amount ? "\u00a3" + (amount / 100).toFixed(0) : "unknown";
  const photos = (lead.photo_paths || []).length;
  const preview = "https://livebyfriday.netlify.app/preview/" + lead.id;
  return [
    "Business: " + (lead.business_name || "not given"),
    "Trade: " + (lead.trade || "not given"),
    "Area: " + (lead.area || "not given"),
    "Contact: " + (lead.contact_name || "not given"),
    "Email: " + (lead.email || "not given"),
    "Phone: " + (lead.phone || "not given"),
    "Plan: " + (lead.plan || "not given"),
    "Promo code: " + (lead.promo_code || "none"),
    "Photos: " + photos,
    "Lead ID: " + lead.id,
    "Preview: " + preview
  ].join("\n");
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

  // Read the lead first so we can check whether it is already paid
  // (Stripe retries webhooks, and we must not send duplicate emails)
  const lead = await getLead(leadId);
  if(!lead){
    console.warn("No lead matched id", leadId, "for session", s.id);
    return new Response(JSON.stringify({ ok: true, note: "no lead found" }), { status: 200 });
  }

  const alreadyPaid = lead.status === "paid";

  if(!alreadyPaid){
    try {
      await patchLead(leadId, {
        status: "paid",
        stripe_session_id: s.id,
        amount_paid: s.amount_total,
        paid_at: new Date().toISOString()
      });
      console.log("Marked lead", leadId, "paid,", s.amount_total, s.currency);
    } catch(err){
      console.error("Could not update lead", leadId, err.message);
      return new Response("Update failed", { status: 500 });
    }
  } else {
    console.log("Lead", leadId, "already paid, skipping update (retry)");
  }

  // Send emails only on the first successful webhook, never on retries
  if(!alreadyPaid){
    try {
      await sendEmail(
        lead.email,
        "Got it. We have started on your site.",
        buyerEmail(lead)
      );
      console.log("Sent buyer email to", lead.email);
    } catch(err){
      console.error("Buyer email failed:", err.message);
    }

    try {
      const ownerAddr = process.env.OWNER_EMAIL;
      if(ownerAddr){
        const pounds = s.amount_total ? "\u00a3" + (s.amount_total / 100).toFixed(0) : "";
        await sendEmail(
          ownerAddr,
          "Paid: " + (lead.business_name || "unknown") + ", " + pounds,
          ownerEmail(lead, s.amount_total)
        );
        console.log("Sent owner email to", ownerAddr);
      } else {
        console.warn("OWNER_EMAIL not set, skipping notification");
      }
    } catch(err){
      console.error("Owner email failed:", err.message);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

export const config = { path: "/api/stripe-webhook" };
