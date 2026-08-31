/* ------------------------------------------------------------------
   THE ONLY FILE YOU EDIT TO GO LIVE.
   Every page reads from here. Test values first, real ones later.
-------------------------------------------------------------------*/
window.LBF = {

  // Supabase. Project settings > API.
  // The anon key is MEANT to be public. The leads table has row level
  // security that allows insert and nothing else, so nobody can read
  // anything back out with it.
  SUPABASE_URL: "https://tzzoileuvbvvflrcuhgu.supabase.co",
  SUPABASE_ANON_KEY: "PASTE_ANON_KEY_HERE",
  BUCKET: "intake",

  // Stripe payment links, one per package.
  // Test mode links look like  https://buy.stripe.com/test_xxxx
  // Live mode links look like  https://buy.stripe.com/xxxx
  // Swapping these three lines is the entire go live step.
  STRIPE: {
    site:   "https://buy.stripe.com/test_REPLACE_99",
    sorted: "https://buy.stripe.com/test_REPLACE_199",
    lot:    "https://buy.stripe.com/test_REPLACE_349"
  },

  // The launch offer. Set SHOW to false and the banner disappears.
  PROMO: {
    SHOW: true,
    CODE: "SEPTEMBER",
    TEXT: "Launch offer: &pound;30 off the first ten sites. Code",
    ENDS: "30 September"
  },

  PRICES: { site: 99, sorted: 199, lot: 349 },
  PLAN_NAMES: { site: "Just the site", sorted: "Sorted", lot: "The lot" }
};
