# Live by Friday

Static site on Netlify, data in Supabase, money through Stripe, sites built
by the Claude API. No build step and no npm dependencies, so there is
nothing that can fail to compile at eleven o'clock on a Sunday.

## What is here

    index.html                     the sales page
    start.html                     the intake form, writes to Supabase
    thanks.html                    after the form or after payment
    config.js                      THE ONLY FILE YOU EDIT to go live
    logo.png / favicon.png         the logo, cut out of the checkerboard
    supabase/schema.sql            paste into the Supabase SQL editor
    netlify/functions/
      build-site.mjs               asks Claude for a brief, renders the site
      preview.mjs                  serves a built site at /preview/<id>
      stripe-webhook.mjs           marks a lead paid
      lib/design.mjs               THE MENU. The only source of design values
      lib/render.mjs               brief in, HTML out. Pure, no model, no network

## The shape of it

    form  ->  Supabase lead
              |
              +-> build-site: Claude returns a BRIEF (design + words)
              |                the brief is forced onto the menu in design.mjs
              |                render.mjs turns it into HTML, deterministically
              |
              +-> Stripe payment link -> webhook -> lead marked paid

The model chooses from lists and writes sentences. It never writes CSS,
hex codes or class names. That is why a bad answer from the API cannot
produce a bad website: coerceDesign() throws away anything it does not
recognise and substitutes a known good value.

## Environment variables (Netlify > Site configuration > Environment)

    ANTHROPIC_API_KEY           console.anthropic.com
    ANTHROPIC_MODEL             optional. Check the console for the current id
    SUPABASE_URL                https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY   Supabase > Settings > API. NEVER in config.js
    STRIPE_WEBHOOK_SECRET       whsec_... from the Stripe webhook page
    BUILD_KEY                   any long random string you invent

config.js holds only the two values that are safe in a browser: the
Supabase URL and the anon key. The anon key can insert a lead and do
nothing else, because of the row level security policy in schema.sql.

## Building a site by hand

    curl -X POST https://livebyfriday.co.uk/api/build-site \
      -H "content-type: application/json" \
      -H "x-build-key: YOUR_BUILD_KEY" \
      -d '{"id":"THE-LEAD-UUID"}'

Then look at https://livebyfriday.co.uk/preview/THE-LEAD-UUID

## Deploying from git

Connect the repo in Netlify (Add new site, import an existing project)
rather than dragging the folder. Then every push to `main` deploys, and a
pull request gets its own preview URL you can look at before merging.

Netlify needs nothing configured beyond the repo: `netlify.toml` already
sets the publish directory and the functions directory. Add the six
environment variables from `.env.example` under Site configuration, and
redeploy, because functions only pick up new variables on a deploy.

Safe to commit: everything in this repo, including `config.js`. The
Supabase anon key in it is public by design and the row level security
policy limits it to inserting a lead. Never commit: the service role key,
the Anthropic key, the Stripe webhook secret, or a `.env` file.

## Going live

Everything runs in Stripe test mode until you swap the three links in
config.js from `buy.stripe.com/test_...` to `buy.stripe.com/...`.
That is the entire go live step. Nothing else changes.
