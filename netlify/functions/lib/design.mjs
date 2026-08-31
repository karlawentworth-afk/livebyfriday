/* ==================================================================
   THE MENU.

   This file is the only place design decisions can come from. The
   model returns names from these lists and nothing else. Anything it
   invents is thrown away and replaced with the fallback, which is why
   a bad answer from the API can never produce a bad website.

   Add to these lists to widen the range. Never let the model write
   CSS, hex codes or class names.
================================================================== */

export const TYPE = {
  editorial: { name:"Fraunces / Public Sans",
    css:{ display:'"Fraunces",Georgia,serif', body:'"Public Sans",system-ui,sans-serif',
          wdth:100, weight:600, track:"-0.005em", caps:"none", lh:"1.12" } },
  bookish: { name:"Fraunces Bold / Public Sans",
    css:{ display:'"Fraunces",Georgia,serif', body:'"Public Sans",system-ui,sans-serif',
          wdth:100, weight:700, track:"-0.022em", caps:"none", lh:"1.05" } },
  expanded: { name:"Archivo Expanded / Public Sans",
    css:{ display:'"Archivo",system-ui,sans-serif', body:'"Public Sans",system-ui,sans-serif',
          wdth:118, weight:800, track:"-0.028em", caps:"none", lh:"1.02" } },
  condensed: { name:"Archivo Condensed Caps / Public Sans",
    css:{ display:'"Archivo",system-ui,sans-serif', body:'"Public Sans",system-ui,sans-serif',
          wdth:80, weight:900, track:"0.005em", caps:"uppercase", lh:"0.98" } },
  plain: { name:"Archivo / Public Sans",
    css:{ display:'"Archivo",system-ui,sans-serif', body:'"Public Sans",system-ui,sans-serif',
          wdth:100, weight:700, track:"-0.018em", caps:"none", lh:"1.06" } },
  rounded: { name:"Nunito / Nunito",
    css:{ display:'"Nunito",system-ui,sans-serif', body:'"Nunito",system-ui,sans-serif',
          wdth:100, weight:800, track:"-0.015em", caps:"none", lh:"1.12" } },
  wonky: { name:"Bricolage Grotesque / Public Sans",
    css:{ display:'"Bricolage Grotesque",system-ui,sans-serif', body:'"Public Sans",system-ui,sans-serif',
          wdth:88, weight:800, track:"-0.02em", caps:"none", lh:"1.0" } },
  quiet: { name:"Bricolage Light / Public Sans",
    css:{ display:'"Bricolage Grotesque",system-ui,sans-serif', body:'"Public Sans",system-ui,sans-serif',
          wdth:100, weight:500, track:"-0.014em", caps:"none", lh:"1.08" } }
};

export const LAYOUT   = ["split","splitleft","stack","poster","overlay"];
export const DEVICE   = ["rules","slab","offset","cards","bands"];
export const DENSITY  = ["tight","normal","generous"];
export const ACCENT   = ["minimal","rules","band","mark"];
export const MOTIFS   = ["paw","leaf","spanner","flag","brush","cup","scissors","house","none"];

export const PALETTES = {
  slate:  { name:"Slate",  bg:"#F4F6F8", ink:"#1E2733", accent:"#33628F", soft:"#DCE4EC", muted:"#5A6674" },
  clay:   { name:"Clay",   bg:"#FBF6F1", ink:"#2E211B", accent:"#A9482F", soft:"#EFDCD0", muted:"#6E5A4E" },
  forest: { name:"Forest", bg:"#F2F6F2", ink:"#16241B", accent:"#2C6742", soft:"#D6E5DA", muted:"#51655A" },
  navy:   { name:"Navy",   bg:"#F6F5F1", ink:"#131C2E", accent:"#7C590F", soft:"#E1DFD5", muted:"#565F6E" },
  berry:  { name:"Berry",  bg:"#FBF5F7", ink:"#2A1922", accent:"#8C3A5E", soft:"#F0DDE5", muted:"#6B5460" },
  mono:   { name:"Mono",   bg:"#FFFFFF", ink:"#141414", accent:"#141414", soft:"#E6E6E6", muted:"#6A6A6A" }
};

export const BLOCKS = ["callbar","hero","gallery","coverage","services","proof","facts"];

/* The customer facing shortcuts, so "Classic" on the form maps to a
   real composition rather than being ignored. */
export const PRESETS = {
  Classic:   { type:"editorial", layout:"poster",    device:"rules",  density:"generous", accent:"mark"  },
  Modern:    { type:"expanded",  layout:"overlay",   device:"bands",  density:"normal",   accent:"rules" },
  Friendly:  { type:"rounded",   layout:"splitleft", device:"cards",  density:"normal",   accent:"minimal" },
  Workhorse: { type:"condensed", layout:"stack",     device:"slab",   density:"tight",    accent:"band"  },
  Quirky:    { type:"wonky",     layout:"split",     device:"offset", density:"normal",   accent:"mark"  }
};

/* Combinations we do not ship. Same table as the demo page. */
export function allowed(d, blocks){
  if(d.layout === "poster"  && blocks.indexOf("gallery") === -1) return false;
  if(d.layout === "overlay" && (d.device === "offset" || d.device === "cards")) return false;
  if(d.device === "slab"    && d.density === "generous") return false;
  if(d.device === "cards"   && d.type === "condensed") return false;
  return true;
}

const FALLBACK = { type:"plain", layout:"split", device:"rules", density:"normal", accent:"minimal", palette:"slate" };

/* Take whatever the model said and force it onto the menu. Every
   value is checked. Nothing unrecognised survives this function. */
export function coerceDesign(raw, blocks){
  raw = raw || {};
  const one = (v, list, fb) => (list.indexOf(v) > -1 ? v : fb);
  let d = {
    type:    one(raw.type,    Object.keys(TYPE),     FALLBACK.type),
    layout:  one(raw.layout,  LAYOUT,                FALLBACK.layout),
    device:  one(raw.device,  DEVICE,                FALLBACK.device),
    density: one(raw.density, DENSITY,               FALLBACK.density),
    accent:  one(raw.accent,  ACCENT,                FALLBACK.accent),
    palette: one(raw.palette, Object.keys(PALETTES), FALLBACK.palette),
    motif:   one(raw.motif,   MOTIFS,                "none")
  };
  // walk it back to something shippable if the pairing is on the no list
  if(!allowed(d, blocks)){
    for(const layout of LAYOUT){
      const test = Object.assign({}, d, { layout });
      if(allowed(test, blocks)){ d = test; break; }
    }
  }
  if(!allowed(d, blocks)) d = Object.assign({}, FALLBACK, { motif:d.motif, palette:d.palette });
  return d;
}

/* Blocks: known names only, hero and facts always present, no repeats. */
export function coerceBlocks(raw){
  const seen = new Set();
  let out = (Array.isArray(raw) ? raw : [])
    .filter(b => BLOCKS.indexOf(b) > -1 && !seen.has(b) && seen.add(b));
  if(out.indexOf("hero")  === -1) out.unshift("hero");
  if(out.indexOf("facts") === -1) out.push("facts");
  // callbar only ever goes first
  out = out.filter(b => b !== "callbar");
  if((raw || []).indexOf("callbar") > -1) out.unshift("callbar");
  return out;
}
