#!/usr/bin/env node
/* seed.mjs -- insert four fake leads, upload test photos, build each one,
   then check the output for invented claims.

   Usage:
     node test/seed.mjs                          # insert + build
     node test/seed.mjs --rebuild                 # rebuild existing seed leads
     node test/seed.mjs --host https://your.site  # hit a deployed instance

   Photos: drop images into test/photos/. The script uploads them to the
   intake bucket and assigns them to leads by prefix:
     florist-1.jpg ... florist-6.jpg  -> Bramble & Bloom
     barber-1.jpg                     -> Trim
   Anything without a matching prefix is ignored.

   Reads .env from the project root. No dependencies beyond Node 18+.
*/

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const PHOTO_DIR = resolve(HERE, "photos");

// ---- load .env by hand, no dotenv dependency ----
function loadEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* no .env, rely on the environment */ }
}
loadEnv();

// ---- preflight: fail on line one, not halfway through an upload ----
const REQUIRED = {
  SUPABASE_URL:              process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  BUILD_KEY:                 process.env.BUILD_KEY,
  ANTHROPIC_API_KEY:         process.env.ANTHROPIC_API_KEY
};

const PLACEHOLDER = /^(sk-ant-x|your-|xxxx|https:\/\/xxxx|whsec_xxxx)/i;
let bad = false;
for (const [name, val] of Object.entries(REQUIRED)) {
  if (!val || !val.trim()) {
    console.error("  MISSING: " + name);
    bad = true;
  } else if (PLACEHOLDER.test(val.trim())) {
    console.error("  PLACEHOLDER: " + name + " still says \"" + val.trim().slice(0, 20) + "...\"");
    bad = true;
  }
}
if (bad) {
  console.error("\nSet the real values in .env at the project root, or export them.");
  process.exit(1);
}

const SUPABASE_URL = REQUIRED.SUPABASE_URL;
const SERVICE_KEY  = REQUIRED.SUPABASE_SERVICE_ROLE_KEY;
const BUILD_KEY    = REQUIRED.BUILD_KEY;

// ---- flags ----
const args    = process.argv.slice(2);
const rebuild = args.includes("--rebuild");
const hostIdx = args.indexOf("--host");
const host    = hostIdx > -1 && args[hostIdx + 1]
  ? args[hostIdx + 1].replace(/\/+$/, "")
  : "http://localhost:8888";

// ---- banned phrases: things no seed lead ever said ----
const BANNED = [
  "gas safe", "fully insured", "dbs check", "dbs checked",
  "award winning", "award-winning", "years of experience",
  "years experience", "family run", "family-run",
  "established since", "established in", "fully qualified",
  "certified", "accredited", "guaranteed", "trusted by",
  "five star", "5 star", "five-star", "5-star",
  "rated", "recommended by", "professionally trained",
  "industry leading", "industry-leading", "registered with",
  "member of", "qualified", "insured"
];

function checkBannedPhrases(name, html) {
  if (!html) return;
  // strip tags to get just the visible text
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
  const hits = [];
  for (const phrase of BANNED) {
    const idx = text.indexOf(phrase);
    if (idx < 0) continue;
    // grab surrounding context
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + phrase.length + 40);
    const snippet = text.slice(start, end).trim();
    hits.push({ phrase, snippet });
  }
  if (hits.length) {
    console.log("  *** INVENTED CLAIMS DETECTED ***");
    for (const h of hits) {
      console.log("  !! \"" + h.phrase + "\" found in: ..." + h.snippet + "...");
    }
    console.log("  The lead never said any of this. Check the prompt.");
  } else {
    console.log("  Banned phrase check: clean.");
  }
  console.log("  (This catches the obvious ones. It is not a substitute for reading it.)");
}

// ---- photo upload ----
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
               ".webp": "image/webp", ".heic": "image/heic" };

// which lead gets which photos, by filename prefix
const PHOTO_MAP = {
  florist: 1,   // index into LEADS
  barber: 2
};

async function uploadPhotos() {
  if (!existsSync(PHOTO_DIR)) return {};
  const files = readdirSync(PHOTO_DIR).filter(f => {
    const ext = extname(f).toLowerCase();
    return MIME[ext];
  }).sort();

  if (!files.length) return {};
  console.log("Uploading " + files.length + " photos from test/photos/...");

  // group by prefix
  const groups = {};
  for (const f of files) {
    const prefix = f.replace(/[-_]?\d+\.\w+$/, "").toLowerCase();
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(f);
  }

  // upload and build path arrays keyed by lead index
  const pathsByLead = {};
  for (const [prefix, filenames] of Object.entries(groups)) {
    const leadIdx = PHOTO_MAP[prefix];
    if (leadIdx === undefined) {
      console.log("  skipping " + filenames.length + " " + prefix + "* photos (no matching lead)");
      continue;
    }
    const paths = [];
    for (const f of filenames) {
      const ext = extname(f).toLowerCase();
      const storagePath = "seed/" + f;
      const body = readFileSync(resolve(PHOTO_DIR, f));
      const r = await fetch(
        SUPABASE_URL + "/storage/v1/object/intake/" + storagePath,
        { method: "POST",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: "Bearer " + SERVICE_KEY,
            "Content-Type": MIME[ext] || "application/octet-stream",
            "x-upsert": "true"
          },
          body }
      );
      if (!r.ok) {
        const t = await r.text();
        console.log("  FAILED to upload " + f + ": " + t);
        continue;
      }
      paths.push(storagePath);
      process.stdout.write("  " + f + " -> " + storagePath + "\n");
    }
    pathsByLead[leadIdx] = paths;
  }
  console.log();
  return pathsByLead;
}

// ---- the four leads ----
const SEED_TAG = "lbf-seed";

const LEADS = [
  {
    business_name: "Dave Openshaw Emergency Plumbing",
    trade: "Plumbing, heating, electrical",
    one_liner: "Emergency plumber, any time day or night, burst pipes and boiler breakdowns",
    area: "Wigan and 15 miles round",
    phone: "07700 900123",
    email: "dave@example.com",
    contact_name: "Dave Openshaw",
    hours: "24 hours, 7 days",
    services: [
      { name: "Emergency callout", desc: "Burst pipes, no heating, leaks", price: "from £90" },
      { name: "Boiler repair", desc: "Any make, same day if you ring before noon", price: "from £65" }
    ],
    domain_wanted: "daveopenshaw.co.uk",
    plan: "site",
    route: "preview_first",
    photo_paths: [],
    notes: SEED_TAG,
    style: null,
    palette: null
  },
  {
    business_name: "Bramble & Bloom",
    trade: "Photography and creative",
    one_liner: "Wedding flowers grown and arranged in south Devon",
    area: "Totnes, south Devon. Will travel to Exeter, Plymouth, north Cornwall",
    phone: "01803 000000",
    email: "lucy@example.com",
    contact_name: "Lucy Taverner",
    hours: "Consultations by appointment",
    address: "Unit 4, Shinners Bridge, Dartington TQ9 6JE",
    services: [
      { name: "Full wedding flowers", desc: "Bridal, bridesmaids, buttonholes, ceremony and tables", price: "from £1,200" },
      { name: "Ceremony only", desc: "Arch or aisle, bridal bouquet, buttonholes", price: "from £600" },
      { name: "Bouquet subscription", desc: "Seasonal bunch every fortnight, local delivery", price: "£25 a fortnight" }
    ],
    domain_wanted: "brambleandbloom.co.uk",
    plan: "sorted",
    route: "preview_first",
    photo_paths: [],
    notes: SEED_TAG,
    style: null,
    palette: null
  },
  {
    business_name: "Trim",
    trade: "Hair, beauty and nails",
    one_liner: "Mobile barber, I come to you",
    area: "Peckham, Camberwell, Brixton, Dulwich",
    phone: "07700 900456",
    email: "kel@example.com",
    contact_name: "Kel",
    services: [
      { name: "Skin fade", desc: "Fade, lineup, hot towel", price: "£20" },
      { name: "Beard trim", desc: "Shape and tidy", price: "£10" },
      { name: "Both", desc: "The lot", price: "£25" }
    ],
    domain_wanted: "trimbypeckham.co.uk",
    plan: "site",
    route: "pay_now",
    photo_paths: [],
    notes: SEED_TAG,
    style: null,
    palette: null
  },
  {
    business_name: "Sarah Moss Bookkeeping",
    trade: "Professional services",
    one_liner: "Bookkeeping for small businesses",
    area: "Norwich",
    email: "sarah@example.com",
    contact_name: null,
    phone: null,
    hours: null,
    address: null,
    services: [],
    domain_wanted: "sarahmossbookkeeping.co.uk",
    plan: "site",
    route: "preview_first",
    photo_paths: [],
    notes: SEED_TAG,
    style: null,
    palette: null
  }
];

// ---- Supabase helpers ----
async function sb(path, init) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init && init.headers)
    }
  });
  const text = await r.text();
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + text);
  return JSON.parse(text);
}

// ---- main ----
async function run() {
  let ids;

  if (rebuild) {
    const existing = await sb(
      "leads?notes=eq." + encodeURIComponent(SEED_TAG) +
      "&select=id,business_name&order=created_at.asc"
    );
    if (!existing.length) {
      console.error("No seed leads found. Run without --rebuild first.");
      process.exit(1);
    }
    ids = existing.map(r => ({ id: r.id, name: r.business_name }));
    console.log("Rebuilding " + ids.length + " existing seed leads.\n");
  } else {
    // upload photos first so we can set the paths on insert
    const photoPaths = await uploadPhotos();

    // wire photos to the right leads
    for (const [idx, paths] of Object.entries(photoPaths)) {
      LEADS[idx].photo_paths = paths;
    }

    console.log("Inserting four seed leads...\n");
    ids = [];
    for (const lead of LEADS) {
      const rows = await sb("leads", {
        method: "POST",
        body: JSON.stringify(lead)
      });
      const row = rows[0];
      ids.push({ id: row.id, name: lead.business_name });
      const photoNote = lead.photo_paths.length
        ? " (" + lead.photo_paths.length + " photos)"
        : " (no photos)";
      console.log("  " + lead.business_name + photoNote + "  ->  " + row.id);
    }
    console.log();
  }

  // build each one, then check for invented claims
  const results = [];
  for (const { id, name } of ids) {
    process.stdout.write("Building " + name + "... ");
    const start = Date.now();
    const r = await fetch(host + "/api/build-site", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-build-key": BUILD_KEY
      },
      body: JSON.stringify({ id })
    });
    const body = await r.json();
    const secs = ((Date.now() - start) / 1000).toFixed(1);

    if (!r.ok) {
      console.log("FAILED (" + secs + "s)");
      console.log("  " + (body.error || r.status) + "\n");
      results.push({ id, name, ok: false });
      continue;
    }

    const d = body.design;
    console.log("done (" + secs + "s)");
    console.log("  " + d.type + " | " + d.palette + " | " + d.layout +
                " | " + d.device + " | " + d.density + " | " + d.accent +
                " | " + d.motif);
    console.log("  blocks: " + body.blocks.join(", "));
    console.log("  headline: " + body.headline);

    // fetch the built HTML to scan for banned phrases
    const htmlR = await fetch(host + "/preview/" + id);
    const html = htmlR.ok ? await htmlR.text() : null;
    checkBannedPhrases(name, html);
    console.log();
    results.push({ id, name, ok: true, design: d, blocks: body.blocks, headline: body.headline });
  }

  // cost estimate
  // The build function uses the Anthropic Messages API. We estimate from
  // the known prompt shape: ~900 input tokens (system + lead), ~1000 output
  // tokens (the brief via tool use). These are rough but in the right ballpark.
  // Pricing as of Aug 2025:
  //   Sonnet 4.5:  $3/MTok in,  $15/MTok out
  //   Opus 4:      $15/MTok in, $75/MTok out
  //   Haiku 3.5:   $0.80/MTok in, $4/MTok out
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  const built = results.filter(r => r.ok).length;
  const EST_INPUT = 900;
  const EST_OUTPUT = 1000;
  const PRICES = {
    "claude-sonnet-4-5":   { in: 3,    out: 15 },
    "claude-sonnet-4-20250514": { in: 3, out: 15 },
    "claude-opus-4-0":     { in: 15,   out: 75 },
    "claude-haiku-3-5":    { in: 0.80, out: 4 }
  };
  const p = PRICES[model] || PRICES["claude-sonnet-4-5"];
  const costPerBrief = (EST_INPUT * p.in + EST_OUTPUT * p.out) / 1_000_000;
  const totalCost = costPerBrief * built;
  console.log("=== COST ESTIMATE ===");
  console.log("  Model: " + model);
  console.log("  Briefs built: " + built);
  console.log("  ~" + costPerBrief.toFixed(4) + " per brief, ~" + totalCost.toFixed(4) + " this run");
  console.log("  (Estimate only. Check console.anthropic.com for the real number.)");
  console.log();

  // summary: one line per lead for easy diffing
  console.log("=== DESIGN SUMMARY (copy this block to diff across runs) ===");
  for (const r of results) {
    if (!r.ok) { console.log(r.name + ": FAILED"); continue; }
    const d = r.design;
    console.log(r.name + ": " +
      d.type + " | " + d.palette + " | " + d.layout + " | " +
      d.device + " | " + d.density + " | " + d.accent + " | " + d.motif +
      "  [" + r.blocks.join(", ") + "]");
  }

  // preview URLs
  console.log("\nPreview URLs:");
  for (const { id, name } of ids) {
    console.log("  " + name.padEnd(36) + host + "/preview/" + id);
  }
  console.log();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
