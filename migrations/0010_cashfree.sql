-- Migrate Stripe payment columns to Cashfree.
-- Stubby now uses Cashfree PG for one-time lifetime Pro payments instead of
-- Stripe subscriptions. Rename columns to reflect the new provider.
ALTER TABLE accounts RENAME COLUMN stripe_customer TO cf_customer;
ALTER TABLE accounts RENAME COLUMN stripe_sub TO cf_order_id;
