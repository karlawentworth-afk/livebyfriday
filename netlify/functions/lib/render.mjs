/* ==================================================================
   THE RENDERER.

   Turns a validated brief into a finished page. Pure function, no
   network, no model. Same brief in, same HTML out, every time.
   This is the half that must never surprise you.
================================================================== */

import { TYPE, PALETTES } from "./design.mjs";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

const tel = (s) => String(s || "").replace(/[^0-9+]/g, "");

/* JSON inside a script tag is not HTML escaped, so a business called
   "</script><script>..." would otherwise break straight out of it.
   Escaping the angle brackets and separators closes that door. */
const jsonld = (o) => JSON.stringify(o)
  .replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

const MOTIF = {
  paw:'<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="6.4" cy="9.2" rx="2.3" ry="3"/><ellipse cx="12" cy="6.8" rx="2.4" ry="3.2"/><ellipse cx="17.6" cy="9.2" rx="2.3" ry="3"/><path d="M12 12.2c3 0 5.6 2.4 5.6 4.9 0 1.7-1.4 2.7-3.2 2.7-1 0-1.7-.4-2.4-.4s-1.4.4-2.4.4c-1.8 0-3.2-1-3.2-2.7 0-2.5 2.6-4.9 5.6-4.9z"/></svg>',
  leaf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 20c0-8 5-14 16-16 1 10-4 15-11 15.5"/><path d="M4 20c4-5 8-8 12-9.5"/></svg>',
  spanner:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3.6a5.4 5.4 0 0 0-6.6 6.9L3 16.1 7.9 21l5.6-5.6a5.4 5.4 0 0 0 6.9-6.6L17.1 12l-3.1-.9-.9-3.1z"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21V3"/><path d="M7 4.2h11.5L15.4 8l3.1 3.8H7"/><path d="M3.5 21h7"/></svg>',
  brush:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14c-2 1-2.5 3.5-5 5 3 .8 6.5.3 7.5-2.5"/><path d="M11.5 16.5 20 8a2.1 2.1 0 0 0-3-3l-8.5 8.5"/></svg>',
  cup:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 3.5v2M11 3.5v2"/></svg>',
  scissors:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6.5" r="2.6"/><circle cx="6" cy="17.5" r="2.6"/><path d="M8.3 8 20 19M20 5 8.3 16"/></svg>',
  house:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 12v8h13v-8"/><path d="M10 20v-5h4v5"/></svg>',
  none:''
};

const DENS = {
  tight:    { y:"36px", x:"24px", gap:"20px" },
  normal:   { y:"56px", x:"32px", gap:"32px" },
  generous: { y:"78px", x:"40px", gap:"44px" }
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

  const photo = (i, ratio) => {
    const url = pics[i];
    const alt = esc(alts[i] || (lead.business_name + ", " + (c.eyebrow || "")));
    return url
      ? '<img class="ph" style="aspect-ratio:' + ratio + '" src="' + esc(url) + '" alt="' + alt + '" loading="lazy" decoding="async">'
      : '<div class="ph ph-empty" style="aspect-ratio:' + ratio + '"><span>Photo</span></div>';
  };

  const nav = '<header class="nav"><a class="brand" href="#top">' +
    (d.motif !== "none" ? '<span class="motif">' + MOTIF[d.motif] + '</span>' : '') +
    '<span class="logo">' + esc(lead.business_name) + '</span></a>' +
    '<nav class="links">' + (c.navlinks || []).map(n => '<a href="#' +
      esc(String(n).toLowerCase().replace(/[^a-z0-9]+/g,"")) + '">' + esc(n) + '</a>').join("") + '</nav>' +
    (phone ? '<a class="call" href="tel:' + esc(tel(phone)) + '">' + esc(phone) + '</a>' : '') +
    '</header>';

  const block = (k) => {
    if(k === "callbar" && phone)
      return '<a class="callbar" href="tel:' + esc(tel(phone)) + '">' +
             esc(c.callbar || ("Call now on " + phone)) + '</a>';

    if(k === "hero")
      return '<section class="hero" id="top"><div class="hero-copy">' +
        (c.eyebrow ? '<p class="eyebrow">' + esc(c.eyebrow) + '</p>' : '') +
        '<h1>' + esc(c.headline) + '</h1>' +
        (c.intro ? '<p class="intro">' + esc(c.intro) + '</p>' : '') +
        (phone ? '<a class="cta" href="tel:' + esc(tel(phone)) + '">' + esc(c.cta) + '</a>'
               : '<a class="cta" href="#contact">' + esc(c.cta) + '</a>') +
        '</div>' + photo(0, d.layout === "stack" ? "21/7" : d.layout === "overlay" ? "16/9" : "4/3") + '</section>';

    if(k === "gallery"){
      const n = Math.min(Math.max(pics.length - 1, 3), 5);
      let out = '<section class="gallery" id="gallery">';
      for(let i = 1; i <= n; i++) out += photo(i, i === 1 ? "1/1" : "3/4");
      return out + '</section>';
    }

    if(k === "coverage" && (c.coverage || []).length)
      return '<section class="cover" id="areas"><p class="ct">Areas covered</p><div class="cs">' +
        c.coverage.map(x => '<span>' + esc(x) + '</span>').join("") + '</div></section>';

    if(k === "proof" && brief.copy.proof)
      return '<section class="proof"><blockquote>' + esc(brief.copy.proof.quote || brief.copy.proof) +
        (brief.copy.proof.who ? '<cite>' + esc(brief.copy.proof.who) + '</cite>' : '') + '</blockquote></section>';

    if(k === "services" && (c.services || []).length)
      return '<section class="svcs" id="services">' + c.services.map(s =>
        '<div class="svc"><h2>' + esc(s.name) + '</h2><p>' + esc(s.desc) + '</p>' +
        (s.price ? '<p class="price">' + esc(s.price) + '</p>' : '') + '</div>').join("") + '</section>';

    if(k === "facts")
      return '<section class="facts" id="contact">' +
        (c.facts || []).map(f => '<p><b>' + esc(f.strong) + '</b>' + esc(f.rest) + '</p>').join("") +
        (lead.email ? '<p><b>Email</b> <a href="mailto:' + esc(lead.email) + '">' + esc(lead.email) + '</a></p>' : '') +
        '</section>';

    return "";
  };

  const body = brief.blocks.map((k, i) =>
    (k !== "callbar" && !brief.blocks.slice(0, i).some(x => x !== "callbar") ? nav : "") + block(k)
  ).join("");

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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Fraunces:opsz,wght@9..144,400..700&family=Nunito:wght@400..900&family=Public+Sans:wght@400;500;600;700&display=swap">
<script type="application/ld+json">${jsonld({
  "@context":"https://schema.org","@type":"LocalBusiness",
  name: lead.business_name,
  description: c.meta,
  telephone: phone || undefined,
  email: lead.email || undefined,
  address: lead.address ? { "@type":"PostalAddress", streetAddress: lead.address } : undefined,
  areaServed: lead.area || undefined,
  openingHours: lead.hours || undefined
})}</script>
<style>
:root{
  --bg:${pal.bg};--ink:${pal.ink};--accent:${pal.accent};--soft:${pal.soft};--muted:${pal.muted};
  --display:${ty.display};--body:${ty.body};
  --wdth:${ty.wdth};--weight:${ty.weight};--track:${ty.track};--caps:${ty.caps};--lh:${ty.lh};
  --y:${den.y};--x:${den.x};--gap:${den.gap};
  --radius:0px;--pill:2px;--rule:1px;--bcol:var(--soft);--sh:none;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit}
h1,h2,.logo{font-family:var(--display);font-variation-settings:"wdth" var(--wdth);font-weight:var(--weight);letter-spacing:var(--track);text-transform:var(--caps);line-height:var(--lh);margin:0;text-wrap:balance}
p{margin:0}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}

/* device: the edge language */
.dev-rules{--rule:1px;--radius:0px;--pill:2px;--bcol:var(--soft)}
.dev-slab{--rule:3px;--radius:0px;--pill:0px;--bcol:var(--ink)}
.dev-offset{--rule:2px;--radius:3px;--pill:3px;--bcol:var(--ink);--sh:10px 10px 0 var(--accent)}
.dev-cards{--rule:0px;--radius:18px;--pill:999px;--bcol:transparent}
.dev-bands{--rule:1px;--radius:2px;--pill:2px;--bcol:var(--soft)}

.callbar{display:block;background:var(--accent);color:#fff;text-align:center;padding:13px 18px;font-size:.9rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-decoration:none}
.acc-band .callbar{border-bottom:4px solid var(--ink)}
.acc-band body>.nav{border-top:7px solid var(--accent)}

.nav{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:18px var(--x);border-bottom:var(--rule) solid var(--bcol)}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;min-width:0}
.motif{display:block;width:26px;height:26px;color:var(--accent);flex:0 0 auto}
.motif svg{width:100%;height:100%}
.logo{font-size:1.15rem}
.links{display:flex;gap:20px;font-size:.9rem;color:var(--muted)}
.links a{text-decoration:none}
.links a:hover{color:var(--accent)}
@media (max-width:720px){.links{display:none}}
.call{background:var(--accent);color:#fff;font-weight:700;font-size:.9rem;padding:9px 16px;border-radius:var(--pill);text-decoration:none;white-space:nowrap}

.hero{padding:var(--y) var(--x);display:grid;grid-template-columns:1.1fr .9fr;gap:var(--gap);align-items:center;max-width:1180px;margin:0 auto}
.eyebrow{font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:14px;font-weight:600}
.acc-mark .eyebrow{display:inline-block;background:var(--accent);color:#fff;padding:5px 11px;border-radius:var(--pill)}
h1{font-size:clamp(2.1rem,5.4vw,3.7rem);margin-bottom:18px}
.intro{font-size:1.08rem;color:var(--muted);line-height:1.6;margin-bottom:26px;max-width:38ch}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:700;padding:15px 28px;border-radius:var(--pill);text-decoration:none;font-size:1.02rem}
.dev-offset .cta{box-shadow:4px 4px 0 var(--ink)}
.ph{width:100%;object-fit:cover;border:var(--rule) solid var(--bcol);border-radius:var(--radius);box-shadow:var(--sh);background:var(--soft)}
.acc-rules .ph{border-color:var(--accent)}
.ph-empty{display:grid;place-items:center}
.ph-empty span{font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
@media (max-width:800px){.hero{grid-template-columns:1fr}}

.lay-splitleft .hero .ph{order:-1}
.lay-stack .hero{grid-template-columns:1fr}
.lay-poster .hero{grid-template-columns:1fr;text-align:center;justify-items:center;max-width:860px}
.lay-poster .hero .ph{display:none}
.lay-poster .intro{max-width:52ch}
.lay-poster .facts{justify-content:center}
.lay-poster .svc{text-align:center}
.lay-overlay .hero{grid-template-columns:1fr;padding:0;gap:0;max-width:none}
.lay-overlay .hero-copy{grid-area:1/1;z-index:2;padding:calc(var(--y) * 1.4) var(--x);align-self:end;max-width:1180px;margin:0 auto;width:100%;
  background:linear-gradient(to top, color-mix(in srgb, var(--bg) 92%, transparent), transparent)}
.lay-overlay .hero .ph{grid-area:1/1;border:0;border-radius:0;box-shadow:none;min-height:52vh}

.gallery{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:calc(var(--gap) * .45);padding:0 var(--x) var(--y);max-width:1180px;margin:0 auto}
.gallery .ph{aspect-ratio:3/4}
.gallery .ph:first-child{aspect-ratio:1/1}
.dev-offset .gallery .ph:nth-child(2){transform:rotate(1.5deg)}
@media (max-width:720px){.gallery{grid-template-columns:repeat(2,1fr)}}

.svcs{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--rule);background:var(--bcol);border-block:var(--rule) solid var(--bcol)}
.svc{background:var(--bg);padding:calc(var(--y) * .6) calc(var(--x) * .9)}
.svc h2{font-size:1.25rem;margin-bottom:8px}
.svc p{color:var(--muted);font-size:.96rem}
.svc .price{color:var(--accent);font-weight:700;margin-top:12px;font-variant-numeric:tabular-nums}
.dev-slab .svcs{gap:3px;background:var(--ink);border-color:var(--ink)}
.dev-cards .svcs{background:transparent;border:0;gap:var(--gap);padding:calc(var(--y) * .7) var(--x)}
.dev-cards .svc{background:var(--soft);border-radius:var(--radius)}
.dev-offset .svcs{background:transparent;border:0;gap:0;padding:0 var(--x) var(--y)}
.dev-offset .svc{border:2px solid var(--ink);border-radius:var(--radius);margin-right:-2px}
.dev-bands .svcs{background:var(--soft);border:0;gap:1px}

.cover{padding:calc(var(--y) * .7) var(--x);border-bottom:var(--rule) solid var(--bcol)}
.dev-bands .cover{background:var(--soft)}
.ct{font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:14px;font-weight:600}
.cs{display:flex;flex-wrap:wrap;gap:9px}
.cs span{font-size:.92rem;font-weight:600;padding:7px 14px;border:max(1px,var(--rule)) solid var(--accent);border-radius:var(--pill)}
.dev-cards .cs span{background:var(--soft);border-color:transparent}

.proof{padding:calc(var(--y) * .85) var(--x);border-bottom:var(--rule) solid var(--bcol)}
.dev-bands .proof{background:var(--soft);border:0}
.proof blockquote{margin:0 auto;max-width:56ch;font-size:1.2rem;line-height:1.55;position:relative}
.proof blockquote::before{content:"\\201C";font-family:var(--display);font-size:2.6rem;color:var(--accent);line-height:0;vertical-align:-.35em;margin-right:.1em}
.proof cite{display:block;font-style:normal;font-size:.9rem;color:var(--muted);margin-top:14px}

.facts{display:flex;flex-wrap:wrap;gap:14px calc(var(--gap) * 1.1);padding:calc(var(--y) * .7) var(--x);font-size:.96rem;color:var(--muted)}
.facts b{color:var(--ink);font-weight:700;margin-right:.4em}
.facts a{color:var(--accent)}
.strip{height:6px;background:var(--accent)}
.dev-slab .strip{height:12px}
.acc-minimal .strip{background:var(--soft)}
.credit{padding:18px var(--x) 26px;font-size:.76rem;color:var(--muted);text-align:center}
.credit a{color:var(--muted)}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
</style>
</head>
<body class="lay-${d.layout} dev-${d.device} acc-${d.accent}">
${body}
<div class="strip"></div>
<p class="credit">${esc(lead.business_name)} &middot; Site by <a href="https://livebyfriday.co.uk">Live by Friday</a></p>
</body>
</html>`;
}
