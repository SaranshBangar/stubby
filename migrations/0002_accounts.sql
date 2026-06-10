-- Pro accounts: links an anonymous owner_token to a paid Stripe subscription.
--
-- THE OWNER_TOKEN MODEL + STRIPE FLOW (summary; full detail in the webhook):
--   1. Anonymous user has a random tok_<...> in localStorage. It IS their
--      identity — no password, no email required for free use.
--   2. On "Upgrade", we create a Stripe Checkout session and stash the
--      owner_token in the session metadata (client_reference_id).
--   3. The Stripe webhook (checkout.session.completed) reads that token and
--      INSERTs a row here -> the token is now "Pro".
--   4. tier.ts checks this table to grant Pro limits. The same localStorage
--      token keeps working; nothing else changes for the user.
CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,
  owner_token     TEXT NOT NULL UNIQUE,     -- the anon token that paid
  stripe_customer TEXT,                     -- cus_...
  stripe_sub      TEXT,                     -- sub_...
  status          TEXT NOT NULL,            -- 'active' | 'canceled' | 'past_due'
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_accounts_token ON accounts (owner_token);
CREATE INDEX idx_accounts_customer ON accounts (stripe_customer);
