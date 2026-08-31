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
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6em9pbGV1dmJ2dmZscmN1aGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxOTUwMzEsImV4cCI6MjEwMzc3MTAzMX0.0XdORO1Q5K94lc_nsl8deenARl8lN0WN_LkGfBTBmY4",
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
