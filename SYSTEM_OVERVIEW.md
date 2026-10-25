# ReliefTrack - System Overview

ReliefTrack is a disaster response monitoring system with volunteer management, donation tracking, logistics, and operations coordination.

## Stack
- Frontend: React 18 + Vite 7 + TypeScript, Tailwind CSS 4
- Backend: PHP 8 PDO/MySQL (XAMPP Apache + MariaDB)
- Auth: Session-based (PHPSESSID cookies), CSRF tokens for staff mutations
- Data modes: `mock` (local) or `api` (live MySQL via `VITE_DATA_MODE`)

## Core Modules
1. **Operations & Locations** - Disaster response operations with checkpoints (Caloocan only)
2. **Volunteers** - Registration, skill assignment, verification (photo + skill-specific), check-in
3. **Donations** - Cash/goods/mixed donations with tracking stages
4. **Inventory & Shipments** - Stock management and delivery tracking
5. **Alerts & Activity Log** - Operational alerts and audit trail
6. **Admin Dashboard** - KPIs, charts, volunteer roster, verification panel

## Volunteer Lifecycle
- Statuses: `pending` → `active` (on approval) → `inactive` (deactivation) → `active` (reactivation)
- Verification: `unverified` → `pending` (photo uploaded) → `approved`/`rejected`
- Skill verification: separate table `volunteer_skill_verifications` per skill

## Key API Endpoints (staff-authenticated unless noted)
- `volunteers.php` (staff) - roster
- `volunteer_register.php` (public) - registration
- `auth_request_code.php` / `auth_verify_code.php` (public) - volunteer login via email code
- `volunteer_upload_verification.php` (volunteer) - general photo
- `admin_volunteer_verify.php` (staff) - approve/reject general
- `volunteer_upload_skill_verification.php` (volunteer) - skill photo
- `admin_skill_verify.php` (staff) - approve/reject skill
- `admin_skill_verifications.php` (staff) - list skill verifications
- `admin_volunteer_status.php` (staff) - activate/deactivate
- `admin_volunteer_delete.php` (staff) - remove volunteer
- `serve_file.php` (staff) - secure file serving
- `volunteer_checkin.php` (staff) - check-in via QR code

## Database Tables
- `volunteers` (volunteer_id, full_name, email, phone, status, verification_status, verification_photo, last_check_in, ...)
- `volunteer_skills` (volunteer_id, skill_id, skill_level)
- `volunteer_skill_verifications` (verification_id, volunteer_id, skill_id, photo_filename, status, ...)
- `skills` (skill_id, skill_name, description)
- `signups` (volunteer_id, shift_id, signup_status, check_in)
- `shifts`, `locations`, `operations`, `operation_locations`
- `donations`, `donation_items`, `donation_updates`
- `inventory`, `shipments`, `vehicles`
- `staff_users` (staff_id, full_name, email, role, status)
- `login_codes` (volunteer email verification)
- `activity_log`, `alerts`

## Processes

### Volunteer Registration
1. Volunteer fills form (name, email, phone, address, emergency contact, skills, qualifications)
2. Selecting Driving → license number, type, photo upload
3. Selecting First Aid → qualification text, certificate photo upload
4. Selecting Medical Assistance → credential, proof upload
5. Submit → `volunteer_register.php` creates volunteer + skills + signup
6. Skill photos uploaded via `volunteer_upload_skill_verification.php` (while authenticated)
7. Email verification code sent; volunteer verifies via `auth_verify_code.php`

### Admin Verification
1. Admin opens Verification panel (sidebar)
2. Views pending skill verifications with photo (served via `serve_file.php`)
3. Approve/Reject → `admin_skill_verify.php`
4. Approved → volunteer can be activated

### Volunteer Activation
1. Admin views roster, filters by status
2. Deactivate: `admin_volunteer_status.php` (active→inactive), blocks login/check-in
3. Reactivate: requires `verification_status = approved`
4. Remove: `admin_volunteer_delete.php` (soft delete preferred)

### Attendance (preserved, unchanged)
1. Staff scans volunteer QR code + selects shift
2. `volunteer_checkin.php` records check-in, sets volunteer active, last_check_in
3. Auto-deactivation after 24h of no check-in (cleanup on each request)

### Donations
1. Donor submits → `donation_create.php` (pledged)
2. Staff advances stages: pledged → received → verified → allocated → in_transit → distributed

## Security
- Staff mutations require `X-CSRF-Token` header
- File serving via authenticated `serve_file.php` (no public URLs for documents)
- Path traversal prevention in file serving
- Prepared statements throughout
- Session-based auth with HttpOnly cookies
EOF