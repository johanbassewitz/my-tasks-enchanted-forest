# Feedback email service — deployment pending

The desktop button sends only message text and an optional reply address to a fixed
HTTPS endpoint. The Worker sends plain-text email to the privately configured `FEEDBACK_TO` inbox with
subject `My Tasks — Enchanted Forest` (shared/feedback.ts). Neither recipient nor
subject is displayed in the app. The server directory is excluded from desktop packaging.

## Activate before release

1. Use an owner-controlled Cloudflare account and Resend account; verify a sender
   domain in Resend. No Gmail password is required.
2. From this directory use Wrangler to configure the secrets `RESEND_API_KEY`, `FEEDBACK_TO` (the owner-selected inbox) and
   `FEEDBACK_FROM` (a verified sender address). Never commit keys or put them in the app.
3. Deploy the Worker with the included configuration and its required RATE_LIMITER
   binding. It allows three attempts per minute per IP at the edge; this is basic
   abuse mitigation, not a guarantee against distributed spam. Set provider spending
   limits and monitor abuse before opening public submissions.
4. Set package.json `feedbackEndpoint` to the deployed HTTPS URL and rebuild.
5. Obtain owner approval to send a live test message; confirm inbox receipt, failure
   handling, and rate limits. No live message was sent during implementation.
6. Update the public privacy notice with the actual providers and retention policies.

Until configured, sending is disabled and the UI says so. An accepted response means
the email provider accepted the request, not proof of inbox delivery. Network failures
retain the draft in the open form; a timed-out request may still have been accepted.
Drafts are not persisted after closing the form. Tasks and files are never attached.

The endpoint has no client secret (desktop clients cannot keep one). Requests cannot
choose recipient, subject, or HTML content. Stream size and schema limits are enforced.
No request-body logging is implemented. Cloudflare and email-provider logs/retention
must be reviewed during deployment.

References:
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://resend.com/docs/api-reference/emails/send-email
