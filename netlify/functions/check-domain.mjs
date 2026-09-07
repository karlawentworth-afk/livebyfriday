/* ------------------------------------------------------------------
   Domain availability check. No npm dependencies, no API keys.

   GET /api/check-domain?name=marshlanedoggrooming

   Takes a plain name (no dots) or a full domain. Checks .co.uk, .uk
   and .com variants using RDAP, which is the public replacement for
   WHOIS. Nominet runs the .uk RDAP server, and the IANA bootstrap
   handles .com.

   Returns { results: [ { domain, available, checked } ] }

   Rate limited per IP to stop abuse (simple in-memory counter).
-------------------------------------------------------------------*/

/* RDAP servers by TLD */
const RDAP = {
  "co.uk": "https://rdap.nominet.uk/uk/domain/",
  "uk":    "https://rdap.nominet.uk/uk/domain/",
  "com":   "https://rdap.org/domain/"
};

const SUFFIXES = ["co.uk", "uk", "com"];

function clean(input) {
  let s = String(input || "").trim().toLowerCase();
  // strip protocol
  s = s.replace(/^https?:\/\//, "");
  // strip www.
  s = s.replace(/^www\./, "");
  // strip trailing slashes
  s = s.replace(/\/+$/, "");
  // strip any known suffix to get the bare name
  for (const suf of SUFFIXES) {
    if (s.endsWith("." + suf)) {
      s = s.slice(0, -(suf.length + 1));
      break;
    }
  }
  // only allow valid domain characters
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s)) return null;
  if (s.length < 2 || s.length > 63) return null;
  return s;
}

async function checkOne(domain, rdapUrl) {
  try {
    const r = await fetch(rdapUrl + encodeURIComponent(domain), {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(5000)
    });
    if (r.status === 404) return { domain, available: true, checked: true };
    if (r.ok) return { domain, available: false, checked: true };
    // any other status, we cannot be sure
    return { domain, available: null, checked: false };
  } catch {
    return { domain, available: null, checked: false };
  }
}

/* Simple per-IP rate limiter. 10 checks per minute. Resets every 60s.
   In-memory, so it resets on cold start, which is fine. */
const hits = new Map();
const WINDOW = 60_000;
const LIMIT = 10;

function rateOk(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > WINDOW) {
    hits.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= LIMIT;
}

export default async (req) => {
  if (req.method !== "GET") return json({ error: "GET only" }, 405);

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateOk(ip)) return json({ error: "Too many checks, try again in a minute" }, 429);

  const url = new URL(req.url);
  const raw = url.searchParams.get("name");
  const name = clean(raw);
  if (!name) return json({ error: "Enter a valid domain name" }, 400);

  const checks = SUFFIXES.map(suf => {
    const domain = name + "." + suf;
    return checkOne(domain, RDAP[suf]);
  });

  const results = await Promise.all(checks);
  return json({ name, results });
};

const json = (o, s) => new Response(JSON.stringify(o), {
  status: s || 200,
  headers: { "content-type": "application/json", "cache-control": "no-store" }
});

export const config = { path: "/api/check-domain" };
