# ReliefTrack API contract

The PHP router is `php-api/index.php`. Apache rewrites endpoint-like paths to that router. Every successful response is wrapped as `{ "success": true, "data": ... }`; every failure is `{ "success": false, "message": "..." }` with an appropriate HTTP status. IDs are JSON strings unless documented as counts/quantities. Times are display strings except `checkedInAt`, which is an ISO-8601 timestamp.

For API-mode browser requests, Apache allows credentialed CORS from `http://localhost:5173` and `http://127.0.0.1:5173`. Staff mutation POSTs require the `X-CSRF-Token` returned by staff login/session. Staff and volunteer sessions use HttpOnly PHP session cookies.

## Endpoint inventory

| Method | Endpoint | Auth | Data |
| --- | --- | --- | --- |
| POST | `admin_login.php` | Public | `{ admin: AdminProfile }`; profile includes `csrfToken`. |
| GET | `admin_session.php` | Staff session | `{ admin: AdminProfile }`; also renews/returns the session CSRF token. |
| POST | `admin_logout.php` | Staff session + CSRF | `{ signedOut: true }`; expires the PHP session cookie. |
| POST | `admin_driver_create.php` | Staff session + CSRF | Creates a driver login and assigns it to an unassigned vehicle. |
| POST | `driver_login.php` | Public | `{ driver }`; establishes a driver session and returns a CSRF token. |
| GET | `driver_session.php` | Driver session | Current driver profile and assigned vehicle. |
| POST | `driver_logout.php` | Driver session + CSRF | Clears the driver identity from the session. |
| GET | `driver_shipments.php` | Driver session | Active routes for vehicles assigned to the signed-in driver. |
| GET | `dashboard.php` | Staff session | `DashboardSummary` with KPIs, alerts, activity, 7-day trend, and donation category totals. |
| GET | `operations.php` | Public | `Operation[]`, including target `volunteersNeeded` and computed `volunteerShortfall`. |
| POST | `operation_create.php` | Staff session + CSRF | Creates an operation, map checkpoint, first open volunteer shift, and optional shift skill requirements in one transaction. |
| GET | `locations.php` | Public | `ReliefLocation[]`; includes coordinates, hub metadata, needed volunteer shortfall, and operation IDs. |
| GET | `alerts.php` | Staff session | `Alert[]`. |
| GET | `activity_log.php` | Staff session | `ActivityItem[]`, newest first, maximum 100. |
| GET | `inventory.php` | Staff session | `InventoryItem[]`. |
| GET | `shipments.php` | Public | `Shipment[]`. |
| GET | `vehicles.php` | Staff session | `Vehicle[]` for shipment assignment. |
| POST | `shipment_create.php` | Staff session + CSRF | Creates one shipment for an allocated goods donation using its selected drop-off and destination. |
| POST | `shipment_update_status.php` | Staff session + CSRF, or assigned driver session + CSRF | Staff manages packing/cancellation; assigned drivers start packed trips and confirm delivery. Updates inventory, vehicle availability, and linked donor progress transactionally. |
| POST | `shipment_update_location.php` | Staff session + CSRF, or assigned driver session + CSRF | `{ updated: true }`; records GPS only for an in-transit shipment owned by the signed-in driver. |
| GET | `needed_items.php` | Public | `NeededItem[]`, including fulfilled items for clients to filter. |
| GET | `skills.php` | Public | `Skill[]`. |
| GET | `shifts.php` | Public | `Shift[]`; `filled` includes pending and approved signups, `approved` is separate. Includes `requiredSkills`. |
| GET | `volunteers.php` | Staff session | `VolunteerRosterEntry[]`, including contact, credentials, skills, and completed-shift count. Restrict this endpoint before public internet deployment. |
| GET | `donations.php` | Staff session | `DonorEntry[]`; each `id` is the stable donation reference. Restrict donor PII before public internet deployment. |
| POST | `donation_create.php` | Public | `{ reference, donationId }`; creates the pledge, item list, drop-off site, and first update. Inventory is unchanged until staff verify receipt. |
| GET | `donation_track.php?reference=RT-000001&email=...` | Public, rate-limited | `TrackedDonation`; requires both the reference and matching donor email. |
| GET | `donation_list.php?reference=...&email=...` | Public, rate-limited | `TrackedDonation[]` with at most one result; requires both the reference and matching donor email. |
| POST | `admin_donations_delete.php` | Staff session + CSRF | `{ deleted: true }`; refuses deletion if a shipment references the donation. |
| POST | `donation_update_stage.php` | Staff session + CSRF | Updated `TrackedDonation`; advances intake and verification one step at a time. Verification adds goods to the drop-off inventory; allocation precedes shipment creation. Cash donations can complete after allocation. |
| POST | `volunteer_register.php` | Public | `{ volunteer, shifts }`; profile starts pending. |
| POST | `auth_request_code.php` | Public, rate-limited | `{ sent: true }`; debug code is included only when server environment `RELIEF_ALLOW_DEBUG_CODES=1`. Production mail delivery must be configured. |
| POST | `auth_verify_code.php` | Public, rate-limited | `{ volunteer, shifts }`; hashed one-time code expires after 10 minutes and locks after five failed attempts. Establishes volunteer session. |
| GET | `volunteer_session.php` | Volunteer session | `{ volunteer, shifts }`. |
| POST | `volunteer_logout.php` | Public | `{ signedOut: true }`; clears the volunteer session identity. |
| GET | `volunteer_shifts.php?volunteer_id=...` | Volunteer session | `JoinedShift[]`; caller can only read their own shifts. |
| POST | `shift_join.php` | Volunteer session | Updated `JoinedShift[]`; caller can only join for their own volunteer ID. |
| POST | `shift_cancel.php` | Volunteer session | Updated `JoinedShift[]`; caller can only cancel their own signup. |
| POST | `volunteer_upload_skill_verification.php` | Volunteer session | `{ uploaded, verification }`; accepts a base64-encoded image for a specific skill. |
| POST | `admin_skill_verify.php` | Staff session + CSRF | `{ decision, verification }`; approves or rejects a skill verification. |
| GET | `volunteer_skill_verifications.php` | Volunteer session | `VolunteerSkillVerification[]` for the authenticated volunteer. |
| GET | `admin_skill_verifications.php` | Staff session | `VolunteerSkillVerification[]`; optional `?status=pending|approved|rejected` filter. |

## Shared shapes

```ts
interface AdminProfile {
  staffId: string;
  fullName: string;
  email: string;
  role: 'admin' | 'staff' | 'coordinator';
  csrfToken: string;
}

interface Operation {
  id: string;
  name: string;
  description: string;
  type: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  locationCount: number;
  volunteersNeeded: number;
  volunteerShortfall: number;
}

interface ReliefLocation {
  id: string;
  kind: 'warehouse' | 'evacuation_center' | 'distribution_center' | 'donation_center' | 'affected_area' | 'other' | 'vehicle';
  name: string;
  address: string;
  city: string;
  province: string;
  coordinates: [number, number];
  status: 'active' | 'inactive';
  detail: string;
  contactPhone: string | null;
  operatedBy: string | null;
  imageUrl: string | null;
  feedbackRating: number | null;
  feedbackCount: number | null;
  volunteersNeeded: number;
  operationIds: string[];
}

interface Shift {
  id: string;
  name: string;
  location: string;
  city: string;
  date: string;
  window: string;
  filled: number;
  approved: number;
  needed: number;
  status: 'open' | 'full' | 'ongoing' | 'completed' | 'cancelled';
  coordinates: [number, number] | null;
  requiredSkills: string[];
}

interface TrackedDonation {
  reference: string;
  donor: string;
  donorEmail: string;
  type: 'cash' | 'goods' | 'mixed';
  amount: string;
  operation: string;
  destination: string;
  dropOffLocation?: string;
  date: string;
  stage: 'pledged' | 'received' | 'verified' | 'allocated' | 'in_transit' | 'distributed';
  items: { name: string; category: string; quantity: number; unit: string }[];
  updates: { stage: string; message: string; time: string; location: string | null }[];
  shipmentTracking?: { reference: string; status: string; coordinates: [number, number] | null; locationUpdatedAt: string | null } | null;
}

interface DonorEntry {
  id: string; // RT-###### reference
  donor: string;
  donorEmail: string;
  type: 'cash' | 'goods' | 'mixed';
  amount: string;
  destination: string;
  status: string;
  time: string;
}

interface VolunteerCheckInResult {
  volunteerId: string;
  fullName: string;
  status: 'active';
  shiftId: string;
  shiftName: string;
  checkedInAt: string;
  alreadyCheckedIn: boolean;
}
```

`DashboardSummary` fields are `kpis: Kpi[]`, `alerts: Alert[]`, `activity: ActivityItem[]`, `donationTrend: {day: string; cash: number; goods: number}[]` (cash in thousands of pesos), and `categoryMix: {category: string; quantity: number}[]` (donated item quantities).

`VolunteerProfile` includes `volunteerId`, `fullName`, `email`, `phone`, `status`, `skills`, plus optional `drivingLicenseNumber`, `drivingLicenseType`, `firstAidQualification`, `emergencyContact`, and `emergencyPhone`. Also includes `verificationStatus` (`unverified` | `pending` | `approved` | `rejected`), `verificationPhoto` (filename or null), `verificationSubmittedAt`, and `verificationNotes`.

`NeededItem` fields: `id`, `itemName`, `category`, `location`, `quantityNeeded`, `quantityReceived`, `priority`, and `status`. `InventoryItem` fields: `id`, `itemName`, `category`, `location`, `quantity`, `unit`, `minimumStock`, and `status`. `Shipment` includes optional `donationReference`, nullable `coordinates`, and `locationUpdatedAt`; coordinates use the current GPS position after the driver shares it, and otherwise fall back to the destination. `DonationRequest` includes `dropOffLocationId` for goods donations.

## Authentication and deployment notes

- Staff reads are session-gated. `dashboard.php`, `alerts.php`, `activity_log.php`, `inventory.php`, `volunteers.php`, and `donations.php` return `401 Staff authentication required.` without a staff session, because the React staff console (`Topbar`, `Dashboard`, `PanelPage`) is the only caller and it signs in first. `src/services/localApi.ts` mirrors the same split.
- Staff passwords use `password_hash()`/`password_verify()` only. Legacy plaintext staff seed values are automatically hashed on API startup.
- OTPs are stored as password hashes, expire after 10 minutes, are single-use, limited to five requests per email per 15 minutes, and lock after five failed attempts. There is also a per-IP request cap.
- The API uses PHP `mail()` when configured. If mail delivery is unavailable, the endpoint returns 503 unless `RELIEF_ALLOW_DEBUG_CODES=1` is explicitly set for non-production testing.
- The API uses exact allowlisted origins; do not use `Access-Control-Allow-Origin: *` with session cookies.
- Staff login calls `session_regenerate_id(true)`, so the server sends two `PHPSESSID` cookies. Clients must keep the last value for a duplicated cookie name, otherwise they send the pre-regeneration session and receive `401`.
- For fresh installations import `src/database/schema.sql`. For existing installations run `scripts/migrate.ps1`; do not run the destructive fresh-install schema over live data.
