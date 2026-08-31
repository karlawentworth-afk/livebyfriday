# Live by Friday

£99 one page websites for UK sole traders and small businesses. Domain and
hosting included for the first year, £49/year after. The owner is Karla.

Static site on Netlify. Data in Supabase (Frankfurt). Money through Stripe
payment links. Sites designed and written by the Anthropic Messages API.

## How it works

    intake form  ->  Supabase lead row
                     |
                     +-> /api/build-site
                     |     Claude returns a BRIEF (design choices + words)
                     |     the brief is forced onto the menu in lib/design.mjs
                     |     lib/render.mjs turns it into HTML, deterministically
                     |     result saved to leads.site_html
                     |
                     +-> Stripe payment link -> /api/stripe-webhook -> lead paid

Preview at `/preview/<lead uuid>`.

## THE INVARIANTS

These are not preferences. The whole design rests on them. If a change
requires breaking one, stop and ask Karla first.

1. **The model never writes CSS, HTML, hex codes or class names.** It
   chooses names from lists and writes sentences. That is all.

2. **Everything the model returns goes through `coerceDesign()` and
   `coerceBlocks()` before it reaches the renderer.** Anything unrecognised
   is discarded and replaced with a known good value. Never pass a raw API
   response into `renderSite()`.

3. **`lib/render.mjs` stays pure.** No network calls, no model, no
   randomness, no dates. Same brief in, same HTML out, forever. It is the
   half that must never surprise anyone.

4. **Styles and palettes never touch each other.** Type, layout, device,
   density and accent control shape and lettering. Palettes control colour.
   That separation is why every combination works without testing every
   combination. Do not add a palette that sets a font, or a type that sets
   a colour.

5. **Widen by adding to the lists, never by loosening the rules.** More
   range means more entries in `TYPE`, `LAYOUT`, `DEVICE`, `MOTIFS`,
   `PALETTES`. It never means letting the model improvise.

6. **Nothing goes on a client's website that the client did not say.** No
   invented experience, qualifications, Gas Safe, insurance, awards, review
   scores or guarantees. This rule is in the system prompt and must stay
   at the top of it. It is the only failure mode that can cause real harm.

7. **Publishing stays human.** Build automatically, publish manually. Never
   ship a change that puts a generated site in front of the public without
   Karla looking at it.

8. **Escape everything from the lead.** `esc()` on every interpolation,
   `jsonld()` for the structured data block. Business names are attacker
   controlled input.

9. **No new runtime dependencies without a good reason.** No npm packages
   in the functions, no build step. It deploys by dragging a folder.

10. **The service role key never leaves Netlify environment variables.**
    `config.js` holds only the Supabase URL and the anon key, which are
    safe in a browser because the RLS policy allows insert and nothing else.

## Files

    index.html                sales page
    start.html                intake form, writes to Supabase
    thanks.html               after form or payment
    config.js                 the only file edited to go live
    supabase/schema.sql       table, RLS policies, storage bucket
    netlify/functions/
      build-site.mjs          brief + render + save. Needs x-build-key header
      preview.mjs             serves /preview/<id>
      stripe-webhook.mjs      signature check, marks lead paid. No deps
      lib/design.mjs          THE MENU. Only source of valid design values
      lib/render.mjs          brief -> HTML. Pure

## Running it locally

    netlify dev

Environment variables needed: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`BUILD_KEY`.

Test the renderer without spending any API credit by importing
`renderSite` and passing a handwritten brief. It has no network calls, so
it runs anywhere.

## Writing conventions

Karla's rules, and they apply to code comments, UI copy and anything the
model generates for a client site:

- Plain warm British English. Short sentences. Write how a person talks.
- **Never use em dashes.** She reads them as a tell. Commas, full stops or
  brackets instead.
- No marketing language. No "bespoke", "passionate", "solutions",
  "seamless", "elevate", "unlock", "premier".
- No corporate waffle. Say the thing.
- British spelling, £ for money.

## Backlog, roughly in order

1. **Admin page** at `/admin`, behind Netlify Identity or a passworded
   function. List leads, one button to build, one to preview, one to
   publish. Right now building is a curl command, which will not survive
   contact with a busy week.
2. **Publishing.** Push the built HTML to the client's own domain. Simplest
   version: a second Netlify site per client via the Netlify API, then the
   domain pointed at it. Store the result in `leads.live_url`.
3. **Email.** Lead notification to Karla, preview link to the client. Resend
   or Postmark. Nothing arrives by email at the moment, which means she has
   to keep checking the dashboard.
4. **Photo handling.** Auto orient from EXIF, resize, convert to webp on the
   way in. People will upload 9MB sideways photos of a van.
5. **Renewals.** £49/year from month 13. A Stripe subscription with a
   twelve month trial is the neat way. Without this the whole model leaks.
6. **A QA pass.** Screenshot the built page with Playwright and have a model
   check it against a rubric before Karla sees it. Catches the odd bad
   composition without her having to catch it.

## What has already been checked

- All 40,152 valid design compositions render without broken markup,
  `undefined`, unbalanced sections or a missing nav.
- Injection: a business name containing script tags comes out inert, in
  both the body and the JSON-LD block.
- The compatibility table in `allowed()` excludes 17,448 combinations that
  do not look good. Those can never be selected, including by a redesign.
