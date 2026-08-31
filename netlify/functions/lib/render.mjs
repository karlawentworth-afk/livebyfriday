/* ==================================================================
   THE RENDERER.

   Turns a validated brief into a finished page. Pure function: no
   network, no model, no randomness, no dates. Same brief in, same
   HTML out, forever.

   Every client site is only ever as good as this file, because the
   model does not design anything. It picks from lists and writes
   sentences. So the craft lives here.
================================================================== */

import { TYPE, PALETTES } from "./design.mjs";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

const tel = (s) => String(s || "").replace(/[^0-9+]/g, "");

/* JSON inside a script tag is not HTML escaped, so a business called
   "</script><script>..." would break straight out of it. */
const jsonld = (o) => JSON.stringify(o)
  .replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

const MOTIF = {
  paw:'<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="6.4" cy="9.2" rx="2.3" ry="3"/><ellipse cx="12" cy="6.8" rx="2.4" ry="3.2"/><ellipse cx="17.6" cy="9.2" rx="2.3" ry="3"/><path d="M12 12.2c3 0 5.6 2.4 5.6 4.9 0 1.7-1.4 2.7-3.2 2.7-1 0-1.7-.4-2.4-.4s-1.4.4-2.4.4c-1.8 0-3.2-1-3.2-2.7 0-2.5 2.6-4.9 5.6-4.9z"/></svg>',
  leaf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 20c0-8 5-14 16-16 1 10-4 15-11 15.5"/><path d="M4 20c4-5 8-8 12-9.5"/></svg>',
  spanner:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3.6a5.4 5.4 0 0 0-6.6 6.9L3 16.1 7.9 21l5.6-5.6a5.4 5.4 0 0 0 6.9-6.6L17.1 12l-3.1-.9-.9-3.1z"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21V3"/><path d="M7 4.2h11.5L15.4 8l3.1 3.8H7"/><path d="M3.5 21h7"/></svg>',
  brush:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14c-2 1-2.5 3.5-5 5 3 .8 6.5.3 7.5-2.5"/><path d="M11.5 16.5 20 8a2.1 2.1 0 0 0-3-3l-8.5 8.5"/></svg>',
  cup:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 3.5v2M11 3.5v2"/></svg>',
  scissors:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6.5" r="2.6"/><circle cx="6" cy="17.5" r="2.6"/><path d="M8.3 8 20 19M20 5 8.3 16"/></svg>',
  house:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-5h4v5"/></svg>',
  none:''
};

const DENS = {
  tight:    { y:"52px",  x:"26px", gap:"26px", hero:"64px"  },
  normal:   { y:"78px",  x:"34px", gap:"40px", hero:"96px"  },
  generous: { y:"108px", x:"44px", gap:"56px", hero:"130px" }
};

/* Section labels belong to the renderer, not the model. They are the
   same on every site, which is what makes them read as structure
   rather than as something someone wrote. */
const LABEL = {
  gallery:  "A look at the work",
  services: "What I do",
  coverage: "Where I cover",
  proof:    "What people say"
};

/* Nav wants one word. Section headings can be conversational, a nav
   full of sentences just looks like someone forgot to edit it. */
const NAV = {
  gallery:  "Work",
  services: "Prices",
  coverage: "Areas",
  proof:    "Reviews",
  contact:  "Contact"
};

export function renderSite(brief, lead, photoUrls){
  const d   = brief.design;
  const c   = brief.copy || {};
  const ty  = TYPE[d.type].css;
  const pal = PALETTES[d.palette];
  const den = DENS[d.density];
  const pics = photoUrls || [];
  const alts = c.photo_alt || [];
  const phone = lead.phone || "";
  const motif = MOTIF[d.motif] || "";
  const blocks = brief.blocks;

  const photo = (i, ratio, cls) => {
    const url = pics[i];
    const alt = esc(alts[i] || (lead.business_name + ", " + (c.eyebrow || "")));
    return url
      ? `<img class="ph ${cls||""}" style="aspect-ratio:${ratio}" src="${esc(url)}" alt="${alt}" loading="lazy" decoding="async">`
      : `<div class="ph ph-empty ${cls||""}" style="aspect-ratio:${ratio}"><span>Photo</span></div>`;
  };

  const shead = (k) => `<div class="shead">${motif ? `<span class="sh-mark">${motif}</span>` : `<span class="sh-rule"></span>`}<span>${esc(LABEL[k])}</span></div>`;

  /* The nav only ever links to sections that actually exist on the
     page. A thin form used to produce links pointing at nothing. */
  const ANCHOR = { gallery:"gallery", services:"services", coverage:"areas", proof:"proof" };
  const navItems = blocks.filter(b => ANCHOR[b]).map(b => ({ id: ANCHOR[b], label: NAV[b] }));
  navItems.push({ id:"contact", label: NAV.contact });

  const nav = `<header class="nav"><a class="brand" href="#top">${
      motif ? `<span class="motif">${motif}</span>` : ""
    }<span class="logo">${esc(lead.business_name)}</span></a>` +
    `<nav class="links">${navItems.slice(0,4).map(n =>
      `<a href="#${n.id}">${esc(n.label)}</a>`).join("")}</nav>` +
    (phone ? `<a class="call" href="tel:${esc(tel(phone))}">${esc(phone)}</a>` : "") +
    `</header>`;

  const block = (k) => {
    if(k === "callbar" && phone)
      return `<a class="callbar" href="tel:${esc(tel(phone))}">${esc(c.callbar || ("Call now on " + phone))}</a>`;

    if(k === "hero")
      return `<section class="hero" id="top">${motif ? `<span class="watermark">${motif}</span>` : ""}<div class="hero-copy">` +
        (c.eyebrow ? `<p class="eyebrow">${esc(c.eyebrow)}</p>` : "") +
        `<h1>${esc(c.headline)}</h1>` +
        (c.intro ? `<p class="intro">${esc(c.intro)}</p>` : "") +
        `<div class="hero-act">` +
          (phone
            ? `<a class="cta" href="tel:${esc(tel(phone))}">${esc(c.cta)}</a><a class="cta-num" href="tel:${esc(tel(phone))}">${esc(phone)}</a>`
            : `<a class="cta" href="#contact">${esc(c.cta)}</a>`) +
        `</div></div>` +
        photo(0, d.layout === "stack" ? "2/1" : d.layout === "overlay" ? "16/9" : "4/5", "hero-ph") +
        `</section>`;

    if(k === "gallery"){
      /* Only ever lay out a grid the photo count fills completely.
         A 3 by 2 with a tall first cell needs exactly 5, and with 4
         it leaves a hole in the corner. */
      const n = Math.min(Math.max(pics.length - 1, 3), 5);
      const ratio = (i) => n === 5 ? (i === 1 ? "4/5" : "1/1") : n === 4 ? "4/3" : "1/1";
      let out = `<section class="wide" id="gallery">${shead("gallery")}<div class="gallery g-${n}">`;
      for(let i = 1; i <= n; i++) out += photo(i, ratio(i));
      return out + `</div></section>`;
    }

    if(k === "coverage" && (c.coverage || []).length)
      return `<section class="wide cover" id="areas">${shead("coverage")}<div class="cs">` +
        c.coverage.map(x => `<span>${esc(x)}</span>`).join("") + `</div></section>`;

    if(k === "proof" && c.proof)
      return `<section class="proof" id="proof"><div class="proof-in">` +
        `<blockquote><p>${esc(c.proof.quote || c.proof)}</p>` +
        (c.proof.who ? `<cite>${esc(c.proof.who)}</cite>` : "") +
        `</blockquote></div></section>`;

    if(k === "services" && (c.services || []).length)
      return `<section class="wide" id="services">${shead("services")}<div class="svcs">` +
        c.services.map(s =>
          `<article class="svc"><h2>${esc(s.name)}</h2><p>${esc(s.desc)}</p>` +
          (s.price ? `<p class="price">${esc(s.price)}</p>` : "") + `</article>`).join("") +
        `</div></section>`;

    return "";
  };

  /* The sign off. Always present, always the same shape: the name,
     the way to reach them, and the practical details underneath.
     Every fact in it was supplied by the owner. */
  /* "24 hours" + ", 7 days" must not come out as "24 hours , 7 days",
     so only put a space in when the rest does not start with punctuation. */
  const facts = (c.facts || []).map(f => {
    const rest = String(f.rest || "");
    const sep = (!rest || /^[\s,.;:!?)\u2019']/.test(rest)) ? "" : " ";
    return `<span><b>${esc(f.strong)}</b>${sep}${esc(rest)}</span>`;
  }).join("");
  const closer =
    `<section class="closer" id="contact">${motif ? `<span class="closer-mark">${motif}</span>` : ""}` +
      `<h2>${esc(lead.business_name)}</h2>` +
      `<div class="closer-act">` +
        (phone ? `<a class="cta" href="tel:${esc(tel(phone))}">${esc(phone)}</a>` : "") +
        (lead.email ? `<a class="cta ghost" href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>` : "") +
      `</div>` +
      (facts ? `<div class="closer-facts">${facts}</div>` : "") +
    `</section>`;

  let navDone = false;
  const body = blocks.map(k => {
    let out = "";
    if(k !== "callbar" && !navDone){ out += nav; navDone = true; }
    return out + block(k);
  }).join("") + (navDone ? "" : nav) + closer;

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.meta)}">
<meta property="og:title" content="${esc(c.title)}">
<meta property="og:description" content="${esc(c.meta)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="${pal.bg}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Fraunces:opsz,wght@9..144,400..700&family=Nunito:wght@400..900&family=Public+Sans:wght@400;500;600;700&display=swap">
<script type="application/ld+json">${jsonld({
  "@context":"https://schema.org","@type":"LocalBusiness",
  name: lead.business_name, description: c.meta,
  telephone: phone || undefined, email: lead.email || undefined,
  address: lead.address ? { "@type":"PostalAddress", streetAddress: lead.address } : undefined,
  areaServed: lead.area || undefined, openingHours: lead.hours || undefined
})}</script>
<style>
:root{
  --bg:${pal.bg};--ink:${pal.ink};--accent:${pal.accent};--soft:${pal.soft};--muted:${pal.muted};
  --display:${ty.display};--body:${ty.body};
  --wdth:${ty.wdth};--weight:${ty.weight};--track:${ty.track};--caps:${ty.caps};--lh:${ty.lh};
  --y:${den.y};--x:${den.x};--gap:${den.gap};--hy:${den.hero};
  --radius:0px;--pill:2px;--rule:1px;--bcol:var(--soft);--sh:none;--max:1180px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;display:block}
a{color:inherit}
h1,h2,.logo,.price{font-family:var(--display);font-variation-settings:"wdth" var(--wdth);font-weight:var(--weight);letter-spacing:var(--track);text-transform:var(--caps);line-height:var(--lh);margin:0;text-wrap:balance}
p{margin:0}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
section{position:relative}

/* edge language */
.dev-rules{--rule:1px;--radius:0px;--pill:2px;--bcol:var(--soft)}
.dev-slab{--rule:3px;--radius:0px;--pill:0px;--bcol:var(--ink)}
.dev-offset{--rule:2px;--radius:4px;--pill:4px;--bcol:var(--ink);--sh:14px 14px 0 var(--accent)}
.dev-cards{--rule:0px;--radius:20px;--pill:999px;--bcol:transparent}
.dev-bands{--rule:1px;--radius:3px;--pill:3px;--bcol:var(--soft)}

.accentbar{display:none;height:9px;background:var(--accent)}
.acc-band .accentbar{display:block}

.callbar{display:block;background:var(--accent);color:#fff;text-align:center;padding:14px 18px;font-size:.95rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;text-decoration:none}

/* ---------- nav ---------- */
.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
  padding:20px var(--x);max-width:var(--max);margin:0 auto;border-bottom:var(--rule) solid var(--bcol)}
.brand{display:flex;align-items:center;gap:11px;text-decoration:none;min-width:0}
.motif{display:block;width:30px;height:30px;color:var(--accent);flex:0 0 auto}
.motif svg{width:100%;height:100%}
.logo{font-size:1.2rem}
.links{display:flex;gap:22px;font-size:.86rem;color:var(--muted)}
.links a{text-decoration:none}
.links a:hover{color:var(--accent)}
@media (max-width:820px){.links{display:none}}
.call{background:var(--accent);color:#fff;font-weight:700;font-size:.9rem;padding:11px 18px;border-radius:var(--pill);text-decoration:none;white-space:nowrap}
.dev-offset .call{box-shadow:4px 4px 0 var(--ink)}

/* ---------- hero ---------- */
.hero{padding:var(--hy) var(--x);display:grid;grid-template-columns:1.05fr .95fr;gap:var(--gap);
  align-items:center;max-width:var(--max);margin:0 auto}
.hero-copy{position:relative;z-index:2}
.watermark{position:absolute;right:-4%;bottom:-14%;width:min(46vw,540px);aspect-ratio:1;
  color:var(--accent);opacity:.07;pointer-events:none;z-index:0}
.watermark svg{width:100%;height:100%}
.eyebrow{display:flex;align-items:center;gap:12px;font-size:.8rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--accent);margin-bottom:20px;font-weight:700}
.eyebrow::before{content:"";width:32px;height:2px;background:var(--accent);flex:0 0 auto}
.acc-mark .eyebrow{display:inline-flex;background:var(--accent);color:#fff;padding:7px 14px;border-radius:var(--pill)}
.acc-mark .eyebrow::before{display:none}
h1{font-size:clamp(2.5rem,6.4vw,4.5rem);margin-bottom:22px}
.intro{font-size:clamp(1.05rem,1.5vw,1.22rem);color:var(--muted);line-height:1.55;margin-bottom:34px;max-width:40ch}
.hero-act{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:700;padding:17px 32px;
  border-radius:var(--pill);text-decoration:none;font-size:1.04rem}
.dev-offset .cta{box-shadow:5px 5px 0 var(--ink)}
.cta-num{font-family:var(--display);font-variation-settings:"wdth" var(--wdth);font-weight:var(--weight);
  font-size:1.25rem;letter-spacing:var(--track);text-decoration:none;font-variant-numeric:tabular-nums}
.ph{width:100%;object-fit:cover;border:var(--rule) solid var(--bcol);border-radius:var(--radius);
  box-shadow:var(--sh);background:var(--soft)}
.acc-rules .ph{border-color:var(--accent)}
.ph-empty{display:grid;place-items:center}
.ph-empty span{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
@media (max-width:860px){.hero{grid-template-columns:1fr;padding-top:calc(var(--hy) * .6)}}

.lay-splitleft .hero .hero-ph{order:-1}
.lay-stack .hero{grid-template-columns:1fr}
.lay-poster .hero{grid-template-columns:1fr;text-align:center;justify-items:center;max-width:900px}
.lay-poster .hero .hero-ph{display:none}
.lay-poster .eyebrow{justify-content:center}
.lay-poster .intro{max-width:54ch}
.lay-poster .hero-act{justify-content:center}
.lay-poster .watermark{right:auto;left:50%;transform:translateX(-50%);bottom:-20%}
.lay-poster .shead{justify-content:center}
.lay-poster .svc{text-align:center}
.lay-overlay .hero{grid-template-columns:1fr;padding:0;gap:0;max-width:none}
.lay-overlay .hero-copy{grid-area:1/1;z-index:2;padding:calc(var(--hy) * 1.15) var(--x);align-self:end;
  width:100%;max-width:var(--max);margin:0 auto;
  background:linear-gradient(to top, var(--bg) 8%, color-mix(in srgb, var(--bg) 78%, transparent) 55%, transparent)}
.lay-overlay .hero .hero-ph{grid-area:1/1;border:0;border-radius:0;box-shadow:none;min-height:66vh}
.lay-overlay .watermark{display:none}

/* ---------- shared section furniture ---------- */
.wide{max-width:var(--max);margin:0 auto;padding:var(--y) var(--x)}
.shead{display:flex;align-items:center;gap:12px;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);font-weight:700;margin-bottom:calc(var(--gap) * .7)}
.sh-mark{display:block;width:19px;height:19px;color:var(--accent);flex:0 0 auto}
.sh-mark svg{width:100%;height:100%}
.sh-rule{width:30px;height:2px;background:var(--accent);flex:0 0 auto}

/* ---------- gallery ---------- */
.gallery{display:grid;gap:calc(var(--gap) * .4)}
.gallery.g-3{grid-template-columns:repeat(3,1fr)}
.gallery.g-4{grid-template-columns:repeat(2,1fr)}
.gallery.g-5{grid-template-columns:1.5fr 1fr 1fr}
.gallery.g-5 .ph:first-child{grid-row:span 2}
.dev-offset .gallery .ph:nth-child(2){transform:rotate(1.4deg)}
@media (max-width:760px){
  .gallery.g-3,.gallery.g-4,.gallery.g-5{grid-template-columns:repeat(2,1fr)}
  .gallery.g-5 .ph:first-child{grid-row:auto}
}

/* ---------- services ---------- */
.svcs{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:var(--rule);background:var(--bcol)}
.svc{background:var(--bg);padding:calc(var(--gap) * .8) calc(var(--gap) * .7)}
.svc h2{font-size:1.4rem;margin-bottom:10px}
.svc p{color:var(--muted);font-size:.97rem}
.svc .price{margin-top:18px;color:var(--accent);font-size:1.15rem;font-variant-numeric:tabular-nums;
  text-transform:none;letter-spacing:-0.01em}
.dev-slab .svcs{gap:3px;background:var(--ink)}
.dev-cards .svcs{background:transparent;gap:var(--gap)}
.dev-cards .svc{background:var(--soft);border-radius:var(--radius)}
.dev-offset .svcs{background:transparent;gap:0}
.dev-offset .svc{border:2px solid var(--ink);border-radius:var(--radius);margin-right:-2px;background:var(--bg)}
.dev-bands .svcs{background:var(--soft);gap:1px}
.dev-bands .svc{background:var(--bg)}
.dev-rules .svcs{gap:0}
.dev-rules .svc{border-left:1px solid var(--soft);padding-left:calc(var(--gap) * .7)}
.dev-rules .svc:first-child{border-left:0;padding-left:0}

/* ---------- coverage ---------- */
.dev-bands .cover{background:var(--soft);max-width:none}
.dev-bands .cover .cs,.dev-bands .cover .shead{max-width:var(--max);margin-left:auto;margin-right:auto}
.cs{display:flex;flex-wrap:wrap;gap:11px}
.cs span{font-size:.98rem;font-weight:600;padding:10px 18px;border:max(1px,var(--rule)) solid var(--accent);border-radius:var(--pill)}
.dev-cards .cs span{background:var(--soft);border-color:transparent}

/* ---------- proof ---------- */
.proof{background:var(--soft);padding:var(--y) var(--x)}
.proof-in{max-width:760px;margin:0 auto;text-align:center}
.proof blockquote{margin:0}
.proof blockquote p{font-family:var(--display);font-variation-settings:"wdth" var(--wdth);
  font-weight:var(--weight);text-transform:none;
  font-size:clamp(1.35rem,2.6vw,1.95rem);line-height:1.32;letter-spacing:-0.015em}
.proof blockquote p::before{content:"\\201C";color:var(--accent)}
.proof blockquote p::after{content:"\\201D";color:var(--accent)}
.proof cite{display:block;font-family:var(--body);font-style:normal;font-size:.9rem;font-weight:400;
  color:var(--muted);margin-top:22px;letter-spacing:0}

/* ---------- the sign off ---------- */
.closer{background:var(--ink);color:var(--bg);padding:calc(var(--y) * 1.15) var(--x);text-align:center;overflow:hidden}
.closer-mark{display:block;width:44px;height:44px;margin:0 auto 26px;color:var(--accent)}
.closer-mark svg{width:100%;height:100%}
.closer h2{font-size:clamp(1.9rem,4.4vw,3rem);margin-bottom:32px}
.closer-act{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-bottom:34px}
.closer .cta{background:var(--bg);color:var(--ink);box-shadow:none}
.closer .cta.ghost{background:transparent;color:var(--bg);border:2px solid var(--bg);padding:15px 30px}
.closer-facts{display:flex;flex-wrap:wrap;gap:12px 34px;justify-content:center;
  font-size:.92rem;opacity:.72;max-width:760px;margin:0 auto}
.closer-facts b{font-weight:700;opacity:1}
.credit{background:var(--ink);color:color-mix(in srgb, var(--bg) 48%, var(--ink));
  margin:0;padding:0 var(--x) 34px;font-size:.76rem;text-align:center}
.credit a{text-decoration:underline;color:inherit}

@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
</style>
</head>
<body class="lay-${d.layout} dev-${d.device} acc-${d.accent}">
<div class="accentbar"></div>
${body}
<p class="credit">Site by <a href="https://livebyfriday.co.uk">Live by Friday</a></p>
</body>
</html>`;
}
