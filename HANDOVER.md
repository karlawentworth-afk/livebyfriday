# Paste this into the build session

Copy everything below the line into a fresh Claude Code session opened in
this folder. It reads CLAUDE.md first, so it will already know the rules.

---

This is Live by Friday: £99 one page websites for UK sole traders. The
architecture, the invariants and the backlog are all in CLAUDE.md. Read
that first and treat the ten invariants as fixed. If something you want to
do needs one of them broken, stop and tell me rather than doing it.

The system works end to end already: form, Supabase, Claude brief, renderer,
Stripe, webhook, preview. It has been tested across every design
combination. What it does not have is anything that makes it survive a
busy week.

Start with backlog item 1, the admin page, because right now building a
site means running a curl command and that will not last.

**What I want:**

An `/admin` page, protected, that lists the leads newest first. For each
one: business name, trade, area, which package, which route they took,
whether they have paid, and whether a site has been built yet. Then three
buttons: **Build**, **Preview**, and **Mark published** with a field for
the live URL.

Make it look like the rest of the site. Same signage yellow, same Archivo
and Public Sans, same square edges and heavy rules. It is a working tool
so keep it plain, but it should not look like a different product.

**How to protect it:** simplest thing that is genuinely secure. A password
checked in a Netlify function, or Netlify Identity. Not a client side check.

**Before you write anything:** tell me your plan and what you are going to
touch, in plain words. Then build it. When it is done, tell me what to test
and what you were unsure about.

Three things to keep in mind throughout: no em dashes anywhere, no npm
dependencies in the functions, and the service role key stays in Netlify
environment variables and never reaches a browser.
