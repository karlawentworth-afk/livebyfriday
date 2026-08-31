/* ==================================================================
   BUILD A SITE.

   POST /api/build-site  { "id": "<lead uuid>" }   header: x-build-key

   1. reads the lead from Supabase with the service role key
   2. asks Claude for a BRIEF: a design composition, the section order
      and the words. It is forced through a tool schema, then forced
      again through the menu in lib/design.mjs
   3. renders the HTML deterministically from that brief
   4. saves brief and HTML back onto the lead

   The model never sees a line of CSS and never writes one. It picks
   from lists and writes sentences. That is the whole safety story.

   Netlify environment variables:
     ANTHROPIC_API_KEY           sk-ant-...   (console.anthropic.com)
     ANTHROPIC_MODEL             optional, defaults below. Check the
                                 console for the current model id.
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
     BUILD_KEY                   any long random string of your own
================================================================== */

import { TYPE, PALETTES, LAYOUT, DEVICE, DENSITY, ACCENT, MOTIFS, BLOCKS,
         PRESETS, coerceDesign, coerceBlocks } from "./lib/design.mjs";
import { renderSite } from "./lib/render.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

const SYSTEM = `You design one page websites for small British businesses. You are given what the owner typed into a form. You return a brief: a design composition, which sections the page has and in what order, and the words.

HOW TO THINK ABOUT THE DESIGN
First picture the business's actual physical world. What does their van, shopfront, kit or workspace look like? What do their customers see and touch? Then choose a composition that belongs to that world. A roofer and a wedding florist should not end up with the same page in different colours.
Then think about how the customer decides. Someone with a burst pipe decides in thirty seconds on a phone: the number goes first, no gallery. Someone booking a wedding florist decides over months by looking: photographs come before words, prices go last.

THE RULES ABOUT WORDS, WHICH MATTER MORE THAN THE DESIGN
- You may only use facts the owner supplied. Never invent years of experience, qualifications, accreditations, awards, review scores, guarantees, staff numbers or prices. If they did not say it, it does not go on their website.
- Never write "Gas Safe registered", "fully insured", "DBS checked", "award winning", "family run since" or anything like it unless it is in their answers word for word.
- Plain warm British English. Short sentences. Write how a person actually talks. No marketing language: no "bespoke", "passionate", "solutions", "elevate", "unlock", "seamless", "premier", "cutting edge".
- Never use em dashes.
- If their answers are thin, write less. A short honest page beats a padded one.
- British spelling and £ for money.

Return the brief through the tool. Nothing else.`;

const TOOL = {
  name: "brief",
  description: "The design and copy brief for this one page website.",
  input_schema: {
    type: "object",
    properties: {
      read:   { type:"string", description:"How this business gets chosen, one line. Not marketing, a judgement." },
      world:  { type:"string", description:"What their physical world looks like, one line. Materials, kit, what a customer sees." },
      why:    { type:"string", description:"Two sentences to the owner explaining the design choices in plain words." },
      design: {
        type:"object",
        properties:{
          type:    { type:"string", enum:Object.keys(TYPE) },
          layout:  { type:"string", enum:LAYOUT },
          device:  { type:"string", enum:DEVICE },
          density: { type:"string", enum:DENSITY },
          accent:  { type:"string", enum:ACCENT },
          palette: { type:"string", enum:Object.keys(PALETTES) },
          motif:   { type:"string", enum:MOTIFS }
        },
        required:["type","layout","device","density","accent","palette","motif"]
      },
      blocks: { type:"array", items:{ type:"string", enum:BLOCKS },
                description:"Sections in the order they appear. hero and facts are compulsory. callbar only for urgent trades." },
      copy: {
        type:"object",
        properties:{
          title:      { type:"string", description:"Browser tab title. Business name, then what they do, then the town." },
          meta:       { type:"string", description:"Search result description, under 155 characters." },
          eyebrow:    { type:"string", description:"The small line above the headline. Usually the town or area." },
          headline:   { type:"string", description:"Under 60 characters. What they do and where, in their own register." },
          intro:      { type:"string", description:"Two or three short sentences under the headline." },
          cta:        { type:"string", description:"Button label, two or three words, specific to this trade." },
          navlinks:   { type:"array", items:{ type:"string" }, maxItems:3 },
          callbar:    { type:"string", description:"The urgent line across the top, if there is a callbar." },
          services:   { type:"array", maxItems:3, items:{ type:"object", properties:{
                          name:{type:"string"}, desc:{type:"string"}, price:{type:"string"} },
                          required:["name","desc"] } },
          coverage:   { type:"array", items:{ type:"string" }, maxItems:10 },
          facts:      { type:"array", maxItems:4, items:{ type:"object", properties:{
                          strong:{type:"string"}, rest:{type:"string"} }, required:["strong","rest"] } },
          photo_alt:  { type:"array", items:{ type:"string" }, description:"Alt text, one per photo, describing what a visitor would see." }
        },
        required:["title","meta","eyebrow","headline","intro","cta","navlinks","services","facts"]
      }
    },
    required:["read","world","why","design","blocks","copy"]
  }
};

const sb = (path, init) => fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, Object.assign({
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json"
  }
}, init));

function leadToPrompt(l){
  const line = (k, v) => v ? k + ": " + v + "\n" : "";
  return "Here is what the owner typed into the form. Anything not listed here, they did not tell you.\n\n"
    + line("Business name", l.business_name)
    + line("Sort of business", l.trade)
    + line("What they do, their words", l.one_liner)
    + line("Where they are or cover", l.area)
    + line("Opening hours", l.hours)
    + line("Address", l.address)
    + line("Phone", l.phone)
    + line("Anything else they added", l.notes)
    + line("Number of photos supplied", (l.photo_paths || []).length)
    + line("Style they asked for", l.style ? l.style + " (use the preset composition for this, but you may still choose the palette and motif)" : "")
    + line("Colour they asked for", l.palette)
    + "\nWhat they do and charge:\n"
    + ((l.services || []).length
        ? (l.services || []).map(s => "- " + [s.name, s.desc, s.price].filter(Boolean).join(" | ")).join("\n")
        : "- they left this blank, so keep the services section very short or leave it out")
    + "\n";
}

export default async (req) => {
  if(req.method !== "POST") return json({ error:"POST only" }, 405);
  if(req.headers.get("x-build-key") !== process.env.BUILD_KEY) return json({ error:"Not allowed" }, 401);

  let body; try { body = await req.json(); } catch(e){ return json({ error:"Bad JSON" }, 400); }
  if(!body.id) return json({ error:"Need an id" }, 400);

  // 1. the lead
  const r = await sb("leads?id=eq." + encodeURIComponent(body.id) + "&select=*");
  if(!r.ok) return json({ error:"Supabase read failed: " + await r.text() }, 500);
  const rows = await r.json();
  if(!rows.length) return json({ error:"No lead with that id" }, 404);
  const lead = rows[0];

  // 2. the brief
  let brief;
  try {
    const a = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{ "content-type":"application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 3000, system: SYSTEM,
        tools:[TOOL], tool_choice:{ type:"tool", name:"brief" },
        messages:[{ role:"user", content: leadToPrompt(lead) }]
      })
    });
    const out = await a.json();
    if(!a.ok) return json({ error:"Claude API: " + (out.error && out.error.message || a.status) }, 502);
    const use = (out.content || []).find(c => c.type === "tool_use");
    if(!use) return json({ error:"No brief came back" }, 502);
    brief = use.input;
  } catch(err){
    return json({ error:"Claude API unreachable: " + err.message }, 502);
  }

  // 3. force it onto the menu. Nothing unrecognised gets through.
  brief.blocks = coerceBlocks(brief.blocks);
  if(lead.style && PRESETS[lead.style]){
    brief.design = Object.assign({}, brief.design, PRESETS[lead.style]);  // customer asked, customer gets
  }
  if(lead.palette){
    const key = Object.keys(PALETTES).find(k => PALETTES[k].name.toLowerCase() === String(lead.palette).toLowerCase());
    if(key) brief.design.palette = key;
  }
  brief.design = coerceDesign(brief.design, brief.blocks);

  // 3b. signed links to their photos, good for 7 days
  let photoUrls = [];
  const paths = lead.photo_paths || [];
  if(paths.length){
    try{
      const su = await fetch(process.env.SUPABASE_URL + "/storage/v1/object/sign/intake", {
        method:"POST",
        headers:{ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                  Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
                  "Content-Type":"application/json" },
        body: JSON.stringify({ expiresIn: 60*60*24*7, paths })
      });
      if(su.ok){
        const signed = await su.json();
        photoUrls = paths.map(pth => {
          const hit = signed.find(x => x.path === pth || ("intake/" + x.path) === pth || x.path === pth.replace(/^intake\//,""));
          return hit && hit.signedURL ? process.env.SUPABASE_URL + "/storage/v1" + hit.signedURL : null;
        }).filter(Boolean);
      } else {
        console.warn("Could not sign photo urls:", await su.text());
      }
    }catch(err){ console.warn("Photo signing failed, building with placeholders:", err.message); }
  }

  // 4. render, deterministically
  let html;
  try { html = renderSite(brief, lead, photoUrls); }
  catch(err){ return json({ error:"Render failed: " + err.message }, 500); }

  // 5. save
  const w = await sb("leads?id=eq." + encodeURIComponent(body.id), {
    method:"PATCH",
    headers:{ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
              "Content-Type":"application/json", Prefer:"return=minimal" },
    body: JSON.stringify({ brief, site_html: html, built_at: new Date().toISOString(),
                           status: lead.status === "paid" ? "paid" : "built" })
  });
  if(!w.ok) return json({ error:"Supabase write failed: " + await w.text() }, 500);

  return json({
    ok: true,
    preview: "/preview/" + body.id,
    design: brief.design,
    blocks: brief.blocks,
    read: brief.read,
    world: brief.world,
    why: brief.why,
    headline: brief.copy.headline,
    photos: photoUrls.length
  });
};

const json = (o, s) => new Response(JSON.stringify(o, null, 2), {
  status: s || 200, headers:{ "content-type":"application/json" } });

export const config = { path: "/api/build-site" };
