ALTER TABLE outbox ADD COLUMN auth_expires_at timestamptz;
--> statement-breakpoint
-- Legacy auth messages have no reliable token association. Fail closed rather
-- than retrying possibly expired credentials. Delivery metadata is retained.
UPDATE outbox SET auth_expires_at = created_at,
  body_text = NULL, body_html = NULL, attachments = NULL, error = NULL,
  status = CASE WHEN status IN ('queued', 'failed') THEN 'failed'::outbox_status ELSE status END,
  attempts = CASE WHEN status IN ('queued', 'failed') THEN greatest(attempts, 3) ELSE attempts END
WHERE channel = 'email' AND (
  subject = 'Your Grace In Design sign-in link'
  OR body_text ~* '/auth/verify[?#]'
  OR body_html ~* '/auth/verify[?#]'
);
