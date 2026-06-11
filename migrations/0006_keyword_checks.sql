-- Keyword / content checks: assert that a monitor's response body contains
-- (or does not contain) a given string. A failed assertion counts as DOWN
-- even when the HTTP status was 2xx; failure_reason explains why.

ALTER TABLE monitors ADD COLUMN keyword_check_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE monitors ADD COLUMN keyword_check_string TEXT;
ALTER TABLE monitors ADD COLUMN keyword_check_mode TEXT;       -- 'must_contain' | 'must_not_contain'
ALTER TABLE monitors ADD COLUMN keyword_check_failed_at INTEGER; -- epoch ms; NULL = currently passing

-- Why a check failed (timeouts stay NULL; keyword failures get a message).
ALTER TABLE checks ADD COLUMN failure_reason TEXT;
