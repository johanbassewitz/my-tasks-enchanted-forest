# Daywhisper privacy notice

Last updated: 11 November 2026 — operational draft; finalize before service activation

Daywhisper keeps planning data—tasks, events, chapters, habits, journal entries,
client/project records, focus history and preferences—in a local SQLite database
on your computer. The app does not encrypt the planner database or its JSON backups.
Anyone with sufficient access to your Windows account or backup files may read them.
Use Windows device protection and store exported backups carefully.

Automatic backups are local recovery copies, not a cloud backup. They are created
at approximately six-hour intervals while the app runs; 14 automatic copies are kept.
Protected pre-restore copies are not automatically rotated. You may delete backup
files yourself. Uninstalling the direct desktop edition preserves planning data;
packaged Windows app removal and Windows storage management may behave differently.
Export to a separate location before uninstalling or switching editions.

The app has no Google Calendar integration and does not automatically upload planner records.
It does not include analytics or an advertising tracking SDK.

## Optional feedback
When you submit feedback, only the message and optional reply email are sent through
the configured feedback service. Planner records, attachments and diagnostic logs
are not attached. The service design uses Cloudflare Workers for delivery/rate limiting
and Resend for email transport. These services process network information such as
IP address and the submitted message as necessary to deliver it. The destination
mailbox holds the resulting email. Sending is unavailable until the service is deployed.
Do not include sensitive information. Requests regarding feedback may be made through
the app's feedback form when available or the project's support page; never post private
planner records or personal information in a public issue.

Before service activation, the operator must set and publish actual feedback retention
and deletion practices, a private contact method, and verify provider account settings.
This section is a release-blocking draft until those operational details are supplied.

## Optional account, Paddle purchases and AI
Paddle is the sole payment processor in both editions. Checkout opens in your browser.
The app does not receive payment-card details. Our backend records your verified email,
purchase identifiers, entitlements and AI usage/credits so you can restore access.
Email sign-in codes are sent through the configured email delivery provider. Account
sessions are stored separately from planner data, using Windows-protected encryption;
sessions are excluded from planner exports. Core planning does not require sign-in.

AI is optional. Only text you enter in the AI planning form, the date and time zone are
sent through the configured Cloudflare service to OpenRouter and its selected model
provider. Other tasks, journal entries and attachments are not automatically included.
Review all suggestions before adding them. The backend temporarily retains generated
results to safely retry requests without charging twice. Prompts are not intentionally
logged by application code. Provider network logging and retention depend on deployed
settings and provider policies. Request routing excludes providers allowing data
collection. AI credits are tracked by account, not installation; reinstalling does not
reset usage. Your core planner continues working offline.

Before activation, publish the operator's identity, private contact/deletion process,
actual retention periods (including account, billing, IP/rate-limit records and generated
results), provider notices, and final terms. Do not claim zero cloud storage or no
third-party processing for these optional services. Current preview has no active
checkout, sign-in delivery or AI endpoint.

## Sponsored placements
When configured, a small labeled sponsor placement can appear on Home. It is not
shown during Focus. The app does not attach planner data or tracking identifiers.
Clicking opens the advertiser's website in your browser, where its privacy policy
applies. No advertiser is configured in the current preview build.
