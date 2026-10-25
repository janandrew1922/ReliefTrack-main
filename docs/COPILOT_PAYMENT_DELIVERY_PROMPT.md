# GitHub Copilot prompt — GCash payments, fund transparency, and proof of delivery

Paste this into GitHub Copilot Agent Mode (or an issue Copilot can act on).
Scope: money-in (GCash), donor transparency for allocated funds, an admin
payment module, and goods proof-of-delivery with driver location capture.

Companion doc: `docs/COPILOT_IMPROVEMENT_PROMPT.md` (hardening work). Re-verify
the "Verified state" section against the running stack before changing anything.

---

## 1. Context

ReliefTrack is a disaster-response coordination system for Caloocan, Metro Manila.

| Layer | Path | Notes |
| --- | --- | --- |
| Frontend | `src/` | React 18 + Vite 5 + TypeScript 5 + Tailwind 3 |
| Typed service layer | `src/services/reliefService.ts` | `API_ENDPOINTS` is the single endpoint-name registry |
| Transport | `src/services/http.ts` | picks the backend, unwraps `{success,data,message}`, sends `X-CSRF-Token` |
| Local mock API | `src/services/localApi.ts` | `localStorage` backend that must mirror the PHP contract |
| PHP API | `php-api/index.php` | single-file PDO router; runtime schema migration on every request |
| Contract | `src/database/API_CONTRACT.md` + `src/services/__tests__/contract.test.ts` | the drift test must stay **MATCH** |
| Donation UI | `src/pages/public/Donate.tsx`, `src/pages/public/TrackDonation.tsx` | cash (GCash/bank) and goods flow |
| Driver UI | `src/pages/public/DriverPortal.tsx` | shipment list, live GPS while `in_transit`, "Confirm delivery" |
| Admin console | `src/components/Sidebar.tsx`, `src/pages/PanelPage.tsx` | panels: volunteers, donations, inventory, logistics, distribution, reports, settings, verification |
| Static content | `src/data/staticContent.ts` | `paymentAccounts`, `donationAmounts`, `PaymentChannel = 'gcash' \| 'bank'` |

### 2. Verified state (do not regress)

- **There is no payment gateway today.** A cash/GCash donation is *manual*:
  the donor transfers via the GCash app to a static number
  (`staticContent.ts` → `paymentAccounts`), types the transaction reference,
  and uploads a receipt photo (`Donate.tsx` → `preparePaymentProof`, stored as
  `paymentProof`). Staff advance the stages by hand.
- Donation stages, in order: `pledged → received → verified → allocated →
  in_transit (goods) → distributed`. Defined by `stageOrder` /
  `donationStageLabel` in `staticContent.ts` and enforced by
  `donation_update_stage.php`.
- Cash donations can complete after `allocated` → `distributed` with **no
  shipment** (`PanelPage.tsx` `nextDonationStage`). Goods donations go through
  Logistics → `shipment_create.php` → driver → `shipment_update_status.php`.
- Driver "Confirm delivery" (`DriverPortal.tsx` line ~130) calls
  `updateShipmentStatus(id, 'delivered')`. It captures **no** photo and **no**
  coordinates. Live GPS is only sent while `in_transit` via
  `shipment_update_location.php`.
- The only outbound email in the codebase is the volunteer OTP
  (`auth_request_code.php`, `RELIEF_MAIL_FROM` / PHP `mail()`). **No donation
  tracking number is ever emailed.**
- `donation_track.php` → `TrackedDonation` powers the donor tracking page.
- Backend selection: project-root `.env`, `VITE_DATA_MODE=api|local`,
  `VITE_API_BASE_URL`.
- Demo (development only): `admin@relieftrack.com` / `admin123`.

---

## 3. Work items

### 3.1 GCash payment gateway (hosted checkout, webhook-confirmed)

**Problem.** GCash is a static account number plus a screenshot. Nothing
confirms the money actually arrived, so staff verify by eye.

**Do this.**

1. Integrate a hosted-checkout provider that supports GCash (PayMongo or
   Xendit — pick one and state the choice). **Never** collect GCash/card
   credentials in this app and never store them. The flow is: create a
   checkout session server-side → redirect the donor to the provider's page →
   confirm via signed webhook.
2. Add `payment_transactions`:
   `payment_id, donation_id, provider, provider_intent_id, amount_cents,
   currency, channel ('gcash'), status ('pending'|'paid'|'failed'|'expired'),
   checkout_url, provider_reference, paid_at, raw_payload, created_at`.
3. Add server endpoints (staff/public as noted):
   - `payment_create.php` (public) — takes a `donationReference` and amount,
     creates the provider checkout session, inserts a `pending` row, returns
     `{checkoutUrl, paymentId}`. Idempotent per donation reference.
   - `payment_webhook.php` (public, **signature-verified**) — verifies the
     provider signature, and on a paid event marks the row `paid`, links the
     provider reference, and advances the donation stage to at least
     `received`. Must be idempotent (a replay must not double-apply) and must
     run in a transaction.
   - `payment_status.php` (public) — poll a payment by `paymentId`; returns the
     same envelope as the other public endpoints.
4. Config lives in the **PHP server environment only** (`RELIEF_PAYMENT_SECRET_KEY`,
   `RELIEF_PAYMENT_WEBHOOK_SECRET`, `RELIEF_PAYMENT_PROVIDER`). Never put these
   in the frontend `.env`. `payment_create.php`/`payment_webhook.php` return a
   generic `503` when unconfigured, and the UI falls back to the existing
   manual proof flow.
5. Keep the **manual receipt flow as a fallback** for bank transfers and for
   when the gateway is unavailable. Do not delete `paymentProof`.
6. `Donate.tsx`: when the channel is `gcash` and the gateway is configured,
   offer "Pay with GCash" (redirect/iframe to `checkoutUrl`) alongside the
   current manual option. Show a clear pending → paid state on return.
7. Mirror all three endpoints in `src/services/localApi.ts` (a fake checkout
   that immediately settles as `paid`) so `VITE_DATA_MODE=local` still runs.
8. Add the new endpoints to `reliefService.ts` / `API_ENDPOINTS` and to
   `src/database/API_CONTRACT.md`; keep the drift test green.

### 3.2 Email the tracking number to the donor (and keep a donor copy)

**Problem.** The donor only sees the `RT-######` reference on the success
screen. If they close the tab, they lose it.

**Do this.**

1. Add a mailer helper in `php-api/index.php` reusing the OTP approach
   (`RELIEF_MAIL_FROM` / `mail()`), configurable per environment. Route every
   log line through the redaction helper from the companion doc.
2. On successful `donation_create.php`, send the donor an email containing the
   reference number, amount/channel (or item summary), the chosen location, and
   a link to the tracking page. On the first `paid` webhook, send a short
   confirmation email as well.
3. **Do not block the HTTP response on mail delivery.** Send after the row is
   committed; on failure, log and record `receipt_email_status` on the
   donation row so staff can resend.
4. Keep the on-screen "Save this number" copy block in the `Donate.tsx`
   success step; add the wording that a copy was emailed.
5. Add `donation_resend_receipt.php` (staff session + CSRF) and a "Resend
   receipt" action in the admin Donations panel.
6. Never log the donor email together with secrets; never attach anything but
   the receipt text/link.

### 3.3 Track allocated funds for GCash donations (donor transparency)

**Problem.** A cash donor sees "Allocated" but not *how much went where*.

**Do this.**

1. Add `donation_allocations`:
   `allocation_id, donation_id, operation_id, location_id, amount_cents,
   purpose, allocated_by, allocated_at`.
2. Add `donation_allocate.php` (staff session + CSRF): records one or more
   allocation rows for a cash donation and, when the sum covered reaches the
   donation amount, advances the stage to `allocated`. Validate that the
   allocations do not exceed the donation amount and that every referenced
   operation/location exists (return `422` with a specific message).
3. Extend `donation_track.php` **additively** with an `allocations` array
   (operation name, location name, amount, purpose, date). Do not change or
   remove existing fields.
4. `TrackDonation.tsx`: render an "How your donation was used" timeline for
   `cash` donations — each allocation with operation, location, amount, and
   date — plus a running total against the donated amount.
5. In the admin Donations panel, let staff add/remove allocation rows for a
   cash donation before completing it.

### 3.4 Admin payment transaction module

**Problem.** There is no place to see payment status, provider references, or
webhook outcomes.

**Do this.**

1. Add a `payments` panel: a new entry in `src/components/Sidebar.tsx`
   (icon `ReceiptIcon` or `CreditCardIcon`), a `PanelId`, and a
   `PaymentsPanel` in `PanelPage.tsx`, wired through `App.tsx`.
2. Add `admin_payments.php` (staff session + CSRF) returning a list joined to
   donations: provider, provider reference, amount, currency, status, paid-at,
   donor name/email, linked `RT-######`, webhook last-received-at.
3. UI: filter by status/provider/date, search by reference, and a detail
   drawer showing the raw webhook payload (secrets redacted) and the linked
   allocation. Actions: mark reconciled, resend donor receipt, open the
   donation.
4. Keep it read-only except for the reconciliation flag and the resend action;
   the source of truth for `paid` is the webhook, never a manual toggle.
5. Mirror `admin_payments.php` in `localApi.ts`.

### 3.5 Goods donation proof of delivery

**Problem.** A goods shipment can be marked `delivered` with no evidence it
reached the destination.

**Do this.**

1. Add shipment columns: `delivery_proof VARCHAR(255) NULL`,
   `delivered_at DATETIME NULL`, `delivery_latitude DECIMAL(10,7) NULL`,
   `delivery_longitude DECIMAL(10,7) NULL`, `delivery_accuracy_m DECIMAL(8,2) NULL`.
   Add idempotent runtime-migration guards, matching the existing pattern.
2. Add `shipment_delivery_proof.php` (driver session + CSRF, or extend
   `shipment_update_status.php` with an optional `proofImage`) that stores a
   size-limited image (reuse the client-side `preparePaymentProof` style
   resize), then marks the shipment `delivered` and stamps `delivered_at`.
3. Serve the proof image through `serve_file.php` with a new `type=delivery`,
   staff-gated — do not expose raw paths.
4. `DriverPortal.tsx`: require a delivery photo before "Confirm delivery"
   succeeds; show an upload/preview control with the same validation as the
   GCash receipt.
5. Admin: show the delivery proof (thumbnail → full image) and `delivered_at`
   in the Logistics panel and on the donation's tracking detail. Only allow
   the donation to reach `distributed` once the shipment is `delivered`.
6. Mirror in `localApi.ts` (store the data URL).

### 3.6 Capture driver location on "Confirm delivery"

**Problem.** "Confirm delivery" records no coordinates, so the map cannot show
where the drop actually happened.

**Do this.**

1. When the driver taps "Confirm delivery" in `DriverPortal.tsx`, call
   `navigator.geolocation.getCurrentPosition` and send `latitude`, `longitude`,
   and `accuracy` with the delivery update (same request as the proof image).
2. Store them on the shipment (`delivery_latitude/longitude/accuracy_m`).
3. If the driver denies or the read times out, **still allow the delivery** —
   record the coordinates as `NULL`, show "Location unavailable — delivery
   recorded without GPS", and continue. Never block a delivery on GPS.
4. Show the delivery coordinates on `ReliefMap` and in the admin Logistics
   panel, distinct from the in-transit GPS trail.

---

## 4. Constraints and guardrails

- Do not change the response envelope, endpoint names, or existing response
  field names. Add fields/additively only. The drift test must keep reporting
  **MATCH**.
- Never send GCash/card credentials through this app; use the provider hosted
  checkout. Verify every webhook signature and make webhook handling
  idempotent.
- Payment/mail secrets live in the PHP server environment only — never in the
  frontend `.env`, never logged.
- Keep `src/services/http.ts` as the only network layer and
  `src/services/localApi.ts` as the only local mock entry point; every new
  endpoint has a mock.
- Do not add a new runtime dependency without saying so explicitly and
  updating `package.json` + lockfile. Prefer the provider's HTTP API over an
  SDK unless the SDK is clearly smaller/safer.
- Keep staff/volunteer/driver authorisation checks on every new endpoint,
  matching the existing `requireStaff()` / `requireVolunteer()` /
  `requireDriverMutation()` patterns; keep CSRF on all mutations.
- A delivery must never be lost because GPS or an upload failed — degrade with
  a clear message, not a hard failure.
- Keep the manual GCash/bank proof flow working when the gateway is
  unconfigured.

---

## 5. Acceptance criteria

Run and paste the output of all of the following. Each must pass.

```powershell
npm.cmd install
npx tsc --noEmit                 # 0 errors
npm.cmd run lint                 # 0 errors, warnings <= the 7-warning baseline
npm.cmd test                     # drift report: MATCH for every endpoint
npm.cmd run build                # builds; no new errors
scripts\verify-api.ps1           # every endpoint success=true; MySQL rows verified
```

Manual acceptance:

1. Donate cash via GCash with the gateway configured: redirected to checkout,
   returned to a paid/pending state, and `payment_transactions` shows a `paid`
   row with a provider reference.
2. The donor receives an email with the `RT-######` reference and tracking
   link; the on-screen copy still works; staff can resend the receipt.
3. A cash donation shows an "How your donation was used" allocation breakdown
   on the tracking page after staff allocate it.
4. The admin `payments` panel lists the transaction, its status, and the linked
   donation, with a working reconciliation flag and resend action.
5. A goods delivery requires a photo: "Confirm delivery" fails with a clear
   message until one is attached, and the admin sees the proof image.
6. Driver delivers with location denied: the delivery still completes and the
   shipment records no coordinates with the "GPS unavailable" note; with
   location allowed, the delivery coordinates appear on the map.
7. With `VITE_DATA_MODE=local`, the whole flow runs end to end and the drift
   test still reports **MATCH**.
