# Daywhisper cloud service

The checked-in Worker configuration is a disabled preview. It contains a placeholder database ID, no provider credentials, no public Worker route, an empty Paddle catalog, and an AI daily request limit of zero. The desktop build uses its own disabled configuration in `config/cloud.json`.

## Verify locally

From the repository root with Node 24 and the repository dependencies installed:

```sh
npx tsc -p services/cloud/tsconfig.json
npm test -- tests/cloud-worker.test.ts
```

The tests apply the migration to SQLite and replace every provider call with an in-process fixture.

## Prepare an authorized staging deployment

Use a separate Worker, D1 database, checkout origin, Paddle sandbox account, notification secret, signing key pair, and restricted provider credentials. Provision the database and use a copy of `wrangler.jsonc` with the correct database and Worker names, ID, and an HTTPS custom domain. Apply the migration with Wrangler from the service directory. Enable its every-minute Cron Trigger for durable webhook retries and periodic cleanup. The cron retries up to three pending webhook jobs per invocation. Check execution and backlog metrics against the limits of the selected Workers plan. Keep D1 access and deployment permissions restricted. [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) · [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

Set public settings in Worker variables. Provision secret values with Wrangler secrets or the Cloudflare dashboard. Keep private keys out of desktop files, environment examples, Git and logs.

| Name | Kind | Value |
| --- | --- | --- |
| `EMAIL_FROM` | Variable | Sender at a verified Resend domain |
| `AUTH_SECRET` | Secret | At least 32 characters of cryptographic randomness for OTP and rate-limit HMACs |
| `RESEND_API_KEY` | Secret | Resend send-only key scoped to the sender domain where possible |
| `OPENROUTER_MODEL` | Variable | Explicit model ID with JSON-object mode and a provider that honors the configured routing policy |
| `MAX_DAILY_AI_REQUESTS` | Variable | Positive UTC daily limit for provider attempts, including failed requests |
| `MONTHLY_FREE_LIMIT` | Variable | Successful free actions per verified account per UTC month, default 5 |
| `OPENROUTER_API_KEY` | Secret | Dedicated key with a provider-side monetary spending limit |
| `PADDLE_MODE` | Variable | `sandbox` or `live`, matched to the server key, client token and data |
| `PADDLE_CHECKOUT_ORIGIN` | Variable | Exact HTTPS origin of the approved default payment page, with no path or trailing slash |
| `PADDLE_PRICES` | Variable | JSON map from existing product keys to distinct Paddle `pri_…` price IDs |
| `PADDLE_API_KEY` | Secret | Paddle key with `customer.read`, `customer.write`, `transaction.read`, `transaction.write`, `subscription.read`, `adjustment.read` and `customer_portal_session.write` |
| `PADDLE_WEBHOOK_SECRET` | Secret | Paddle notification destination endpoint secret |
| `LICENSE_PRIVATE_KEY` | Optional secret | Base64 of Ed25519 PKCS#8 DER private key |

Use real, nonzero prices for provisioned products. Set the AI credit pack to a one-time price and the supporter subscriptions to monthly or annual recurring prices matching their product keys. Omit unmapped keys. Free trials, zero-total transactions, subscriptions changed to an unrelated price and price swaps on existing subscriptions are outside the supported catalog flows. Create separate approved sandbox and live payment links. [Paddle sandbox](https://developer.paddle.com/sdks/sandbox/) · [Paddle API permissions](https://developer.paddle.com/api-reference/about/permissions/)

## Paddle browser checkout

Host a static page on the approved origin and select its full HTTPS URL as Paddle's default payment link. Add Paddle.js and initialize it with the **public client-side token** for that mode. Paddle.js automatically opens the transaction from the `_ptxn` query parameter. Keep the page free of unrelated scripts and analytics, and set `Referrer-Policy: no-referrer`. The browser page never handles Daywhisper credentials. [Default payment link](https://developer.paddle.com/build/transactions/default-payment-link/) · [Initialize Paddle.js](https://developer.paddle.com/paddle-js/methods/paddle-initialize/)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Daywhisper checkout</title>
</head>
<body>
  <h1>Daywhisper checkout</h1>
  <p>After payment, return to Daywhisper and refresh your account.</p>
  <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
  <script>
    Paddle.Environment.set('sandbox');
    Paddle.Initialize({ token: 'REPLACE_WITH_PUBLIC_SANDBOX_CLIENT_TOKEN' });
  </script>
</body>
</html>
```

For a separately authorized live rollout, remove the sandbox environment call and use the live public client-side token. Configure the matching origin in the Worker and desktop allowlist. Subscribe `POST /webhooks/paddle` to `transaction.completed`, `transaction.canceled`, `adjustment.created`, and `adjustment.updated`. The endpoint checks Paddle's signed raw message and durably records the transaction before acknowledging delivery. It reconciles in the background against Paddle and retries pending jobs with backoff. Track the age and count of pending `paddle_events` rows. [Webhook signing](https://developer.paddle.com/webhooks/about/signature-verification/) · [Webhook delivery](https://developer.paddle.com/webhooks/about/respond-to-webhooks/)

Each account can create up to six checkout links and twelve portal sessions per UTC hour. The Worker stores the expected customer, price and local account before releasing the checkout link. Only a matching completed paid transaction can grant access. Supporter plans share one checkout reservation per account. A matching pending link can be reused for 30 minutes. After that, the Worker confirms cancellation with Paddle before issuing a replacement. Completed checkouts are checked against Paddle before opening another subscription, even when webhook reconciliation is pending. An existing paid interval or uncanceled subscription blocks both plans. After cancellation, the Worker may keep the block through a conservative estimate of the last billed interval while settling late webhooks. Each subscription renewal must cover its own paid interval. Approved partial or full refunds, credits and chargebacks revoke the whole grant for the affected single-item purchase. Used AI credits stay debited, so refunds can reduce the next credit pack's available balance. Credits and grants remain scoped to the billing mode. Existing purchase records retain their original price IDs when the catalog changes.

## Desktop and offline licensing

Only after validating the staging service, configure a staging desktop build with `enabled: true`, `preview: false`, the HTTPS Worker base as `apiBase`, the exact approved checkout origin in `checkoutOrigins` and, if signing is enabled, the base64 Ed25519 SPKI DER public key as `licensePublicKey`. Store the corresponding PKCS#8 key exclusively as the Worker secret.

The signed envelope covers the account ID, email, product keys, and expiry. Its lifetime is at most seven days and no later than the expiry of any included subscription grant. Recent offline snapshots can continue to display their signed grants until they expire or the client refreshes. The account balance and AI features require the server.

## Operational behavior

- Sign-in uses six-digit codes with ten-minute expiry and up to five guesses. Email, IP and overall send quotas constrain email issuance. Session tokens expire in 30 days and logout deletes the hashed token.
- AI sends the explicitly provided planning text, date, and time zone to OpenRouter. It sets a 45-second request limit, 2,000 output tokens and `data_collection: deny`. Set a conservative daily attempt limit alongside the provider-side spend cap. One atomic reservation controls both account quota and the global daily attempt count. Only validated completions charge an action. [OpenRouter provider routing](https://openrouter.ai/docs/features/provider-routing)
- D1 retains successful results for retry for up to 24 hours, followed by periodic removal. Successful request IDs and payload hashes remain as replay tombstones. The Worker stores no raw prompt, OTP, session bearer token, or portal URL.
- Verify sign-in with designated staging addresses, purchase and refund an allowed sandbox SKU, confirm renewal and expiration behavior, and check OpenRouter routing and usage caps with a staging-only key before any live rollout.

A ready-to-host static checkout template is included in `checkout/`. Set only the public Paddle client token and sandbox/live mode in `settings.js`, host these three files on the approved checkout origin, and configure Paddle's default payment link to that page. The template remains visibly disabled while its token is blank. Do not put server API keys in this directory.
