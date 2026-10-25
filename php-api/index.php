<?php
// ReliefTrack PDO API. Copy this folder to C:\xampp\htdocs\relieftrack-api.
declare(strict_types=1);

error_reporting(E_ALL);
set_error_handler(function (int $severity, string $message, string $file, int $line): never {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

session_set_cookie_params(['httponly' => true, 'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'), 'samesite' => 'Lax', 'path' => '/']);
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$host = getenv('RELIEF_DB_HOST') ?: '127.0.0.1';
$db = getenv('RELIEF_DB_NAME') ?: 'relieftrack';
$user = getenv('RELIEF_DB_USER') ?: 'root';
$pass = getenv('RELIEF_DB_PASSWORD') ?: '';

function respond(array $payload, int $status = 200): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}
function ok(mixed $data): never { respond(['success' => true, 'data' => $data]); }
function fail(string $message, int $status = 400): never { respond(['success' => false, 'message' => $message], $status); }
function requireStaff(): int { if (empty($_SESSION['staff_id'])) fail('Staff authentication required.', 401); return (int) $_SESSION['staff_id']; }
function requireStaffMutation(): int {
    $staffId = requireStaff();
    $expected = (string)($_SESSION['csrf_token'] ?? '');
    $provided = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) fail('Staff session token is missing or expired.', 403);
    return $staffId;
}
function requireVolunteer(): int {
    global $pdo;
    if (empty($_SESSION['volunteer_id'])) fail('Volunteer authentication required.', 401);
    $id=(int)$_SESSION['volunteer_id'];
    $stmt=$pdo->prepare("SELECT 1 FROM volunteers WHERE volunteer_id=? AND status NOT IN ('inactive','suspended')"); $stmt->execute([$id]);
    if (!$stmt->fetch()) { unset($_SESSION['volunteer_id'],$_SESSION['volunteer_reauthenticated_at']); fail('Volunteer account is no longer active.',401); }
    return $id;
}
function requireDriver(): int {
    global $pdo;
    if (empty($_SESSION['driver_id'])) fail('Driver sign-in required.', 401);
    $id=(int)$_SESSION['driver_id']; $stmt=$pdo->prepare("SELECT 1 FROM drivers WHERE driver_id=? AND status='active'"); $stmt->execute([$id]);
    if (!$stmt->fetch()) { unset($_SESSION['driver_id'],$_SESSION['driver_csrf_token']); fail('Driver account is no longer active.',401); }
    return $id;
}
function requireDriverMutation(): int {
    $driverId = requireDriver();
    $expected = (string)($_SESSION['driver_csrf_token'] ?? '');
    $provided = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) fail('Driver session token is missing or expired.', 403);
    return $driverId;
}
function inputString(array $source, string $key): string {
    $value = (string)($source[$key] ?? '');
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value) ?? '';
    return trim(substr($value, 0, 4096));
}
function decodeImagePayload(mixed $photo): array|false {
    if (!is_string($photo) || $photo === '' || strlen($photo) > 7 * 1024 * 1024) return false;
    if (preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+\/=]+)$/i', $photo, $matches)) {
        $encoded = $matches[2];
    } else {
        $encoded = $photo;
    }
    $data = base64_decode($encoded, true);
    if ($data === false || strlen($data) < 100 || strlen($data) > 5 * 1024 * 1024) return false;
    try { $image = getimagesizefromstring($data); } catch (Throwable) { return false; }
    if (!$image || empty($image['mime'])) return false;
    $extension = match ($image['mime']) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        default => null,
    };
    if ($extension === null) return false;
    return ['data' => $data, 'extension' => $extension];
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
} catch (Throwable $error) {
    respond(['success' => false, 'message' => 'Database connection failed. Check MariaDB, database name, and credentials.'], 500);
}

// --- Runtime schema migration ---
// Fix: donations.status ENUM is missing 'in_transit' in older installs.
try {
    $col = $pdo->query("SHOW COLUMNS FROM donations WHERE Field='status'")->fetch();
    if ($col && strpos($col['Type'], 'in_transit') === false) {
        $pdo->exec("ALTER TABLE donations MODIFY status ENUM('pledged','received','verified','allocated','in_transit','distributed','cancelled') DEFAULT 'pledged'");
    }
} catch (Throwable $e) { /* ignore migration errors */ }

// Existing installations may run the updated API before the manual migration.
// Add shipment GPS and donation checkpoint columns idempotently so reads work.
try {
    $shipmentColumns = array_column($pdo->query('SHOW COLUMNS FROM shipments')->fetchAll(), 'Field');
    if (!in_array('current_latitude', $shipmentColumns, true)) $pdo->exec('ALTER TABLE shipments ADD COLUMN current_latitude DECIMAL(10,7) NULL');
    if (!in_array('current_longitude', $shipmentColumns, true)) $pdo->exec('ALTER TABLE shipments ADD COLUMN current_longitude DECIMAL(10,7) NULL');
    if (!in_array('gps_updated_at', $shipmentColumns, true)) $pdo->exec('ALTER TABLE shipments ADD COLUMN gps_updated_at DATETIME NULL');
} catch (Throwable $e) { /* migration script remains available for restricted DB users */ }
try {
    $updateColumns = array_column($pdo->query('SHOW COLUMNS FROM donation_updates')->fetchAll(), 'Field');
    if (!in_array('location', $updateColumns, true)) $pdo->exec('ALTER TABLE donation_updates ADD COLUMN location VARCHAR(255) NULL');
} catch (Throwable $e) { /* migration script remains available for restricted DB users */ }
try {
    $donationColumns = array_column($pdo->query('SHOW COLUMNS FROM donations')->fetchAll(), 'Field');
    if (!in_array('drop_off_location_id', $donationColumns, true)) $pdo->exec('ALTER TABLE donations ADD COLUMN drop_off_location_id INT NULL');
    if (!in_array('payment_proof', $donationColumns, true)) $pdo->exec('ALTER TABLE donations ADD COLUMN payment_proof VARCHAR(255) NULL');
} catch (Throwable $e) { /* migration script remains available for restricted DB users */ }
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS drivers (driver_id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(150) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, status ENUM('pending','active','inactive') NOT NULL DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
    $driverStatusColumn=$pdo->query("SHOW COLUMNS FROM drivers LIKE 'status'")->fetch();
    if ($driverStatusColumn && !str_contains((string)$driverStatusColumn['Type'], "'pending'")) $pdo->exec("ALTER TABLE drivers MODIFY status ENUM('pending','active','inactive') NOT NULL DEFAULT 'pending'");
    foreach (['phone'=>'VARCHAR(30) NULL','driving_license_number'=>'VARCHAR(80) NULL','driving_license_type'=>'VARCHAR(80) NULL'] as $column=>$definition) {
        if (!$pdo->query('SHOW COLUMNS FROM drivers LIKE ' . $pdo->quote($column))->fetch()) $pdo->exec("ALTER TABLE drivers ADD COLUMN $column $definition");
    }
    if (!$pdo->query("SHOW COLUMNS FROM shipments LIKE 'driver_id'")->fetch()) $pdo->exec('ALTER TABLE shipments ADD COLUMN driver_id INT NULL');
    $pdo->exec('UPDATE shipments sh JOIN vehicles v ON v.vehicle_id=sh.vehicle_id SET sh.driver_id=v.driver_id WHERE sh.driver_id IS NULL AND v.driver_id IS NOT NULL');
    $vehicleColumns = array_column($pdo->query('SHOW COLUMNS FROM vehicles')->fetchAll(), 'Field');
    if (!in_array('driver_id', $vehicleColumns, true)) $pdo->exec('ALTER TABLE vehicles ADD COLUMN driver_id INT NULL');
} catch (Throwable $e) { /* apply scripts/migrate.sql if runtime DDL is restricted */ }

try {
    foreach (['contact_phone'=>'VARCHAR(30) NULL','operated_by'=>'VARCHAR(150) NULL','photo_url'=>'TEXT NULL','detail'=>'TEXT NULL','feedback_rating'=>'DECIMAL(2,1) NULL','feedback_count'=>'INT UNSIGNED NULL'] as $column=>$definition) {
        if (!$pdo->query("SHOW COLUMNS FROM locations LIKE " . $pdo->quote($column))->fetch()) $pdo->exec("ALTER TABLE locations ADD COLUMN $column $definition");
    }
    foreach (['driving_license_number'=>'VARCHAR(80) NULL','driving_license_type'=>'VARCHAR(80) NULL','first_aid_qualification'=>'VARCHAR(255) NULL','last_check_in'=>'DATETIME NULL','verification_photo'=>'VARCHAR(255) NULL','verification_status'=>"ENUM('unverified','pending','approved','rejected') NOT NULL DEFAULT 'unverified'",'verification_submitted_at'=>'DATETIME NULL','verification_reviewed_by'=>'INT NULL','verification_reviewed_at'=>'DATETIME NULL','verification_notes'=>'TEXT NULL'] as $column=>$definition) {
        if (!$pdo->query("SHOW COLUMNS FROM volunteers LIKE " . $pdo->quote($column))->fetch()) $pdo->exec("ALTER TABLE volunteers ADD COLUMN $column $definition");
    }
    if (!$pdo->query("SHOW COLUMNS FROM operations LIKE 'volunteers_needed'")->fetch()) $pdo->exec('ALTER TABLE operations ADD COLUMN volunteers_needed INT UNSIGNED NOT NULL DEFAULT 0');
    $pdo->exec('CREATE TABLE IF NOT EXISTS shift_skills (shift_id INT NOT NULL, skill_id INT NOT NULL, PRIMARY KEY (shift_id, skill_id), FOREIGN KEY (shift_id) REFERENCES shifts(shift_id) ON DELETE CASCADE, FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS operation_locations (operation_id INT NOT NULL, location_id INT NOT NULL, PRIMARY KEY (operation_id, location_id), FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE, FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS api_rate_limits (limit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, endpoint VARCHAR(80) NOT NULL, key_hash CHAR(64) NOT NULL, requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_api_rate_limits_endpoint_key_time (endpoint, key_hash, requested_at))');
    $pdo->exec('INSERT IGNORE INTO operation_locations (operation_id, location_id) SELECT operation_id, location_id FROM locations WHERE operation_id IS NOT NULL');
    $pdo->exec('DELETE ol FROM operation_locations ol LEFT JOIN operations o ON o.operation_id=ol.operation_id WHERE o.operation_id IS NULL');
} catch (Throwable $e) { /* schema.sql can also apply these fields before deployment */ }

try {
    foreach (['failed_attempts'=>'TINYINT UNSIGNED NOT NULL DEFAULT 0','request_ip'=>'VARCHAR(45) NULL'] as $column=>$definition) {
        if (!$pdo->query("SHOW COLUMNS FROM login_codes LIKE " . $pdo->quote($column))->fetch()) $pdo->exec("ALTER TABLE login_codes ADD COLUMN $column $definition");
    }
    $pdo->exec('ALTER TABLE login_codes MODIFY code VARCHAR(255) NOT NULL');
    $pdo->exec('CREATE INDEX idx_login_codes_email_used ON login_codes (email, used, expires_at)');
} catch (Throwable $e) { /* indexes and columns may already exist */ }

try {
    $staffRows = $pdo->query('SELECT staff_id, password FROM staff_users')->fetchAll();
    $updatePassword = $pdo->prepare('UPDATE staff_users SET password = ? WHERE staff_id = ?');
    foreach ($staffRows as $staffRow) {
        if (password_get_info($staffRow['password'])['algo'] === null) {
            $updatePassword->execute([password_hash($staffRow['password'], PASSWORD_DEFAULT), (int)$staffRow['staff_id']]);
        }
    }
    $codeRows = $pdo->query('SELECT code_id, code FROM login_codes WHERE used = FALSE')->fetchAll();
    $updateCode = $pdo->prepare('UPDATE login_codes SET code = ? WHERE code_id = ?');
    foreach ($codeRows as $codeRow) {
        if (password_get_info($codeRow['code'])['algo'] === null) {
            $updateCode->execute([password_hash($codeRow['code'], PASSWORD_DEFAULT), (int)$codeRow['code_id']]);
        }
    }
} catch (Throwable $e) { /* keep API availability if a legacy schema is read-only */ }

// --- Ensure volunteer_skill_verifications table exists.
try { $pdo->exec("CREATE TABLE IF NOT EXISTS volunteer_skill_verifications (verification_id INT AUTO_INCREMENT PRIMARY KEY, volunteer_id INT NOT NULL, skill_id INT NOT NULL, photo_filename VARCHAR(255) NOT NULL, status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_by INT NULL, reviewed_at DATETIME NULL, notes TEXT NULL, UNIQUE KEY uq_volunteer_skill (volunteer_id, skill_id), KEY idx_vsv_status (status)) ENGINE=InnoDB"); } catch (Throwable $e) { /* ignore */ }

// Merge the retired Medical Assistance skill into First Aid for existing installations.
try {
    $skillRows = $pdo->query("SELECT skill_name, skill_id FROM skills WHERE skill_name IN ('First Aid', 'Medical Assistance')")->fetchAll(PDO::FETCH_KEY_PAIR);
    $firstAidId = isset($skillRows['First Aid']) ? (int)$skillRows['First Aid'] : null;
    $medicalId = isset($skillRows['Medical Assistance']) ? (int)$skillRows['Medical Assistance'] : null;
    if ($medicalId !== null && $firstAidId === null) {
        $pdo->prepare("UPDATE skills SET skill_name = 'First Aid', description = 'Basic emergency, first aid, and medical assistance' WHERE skill_id = ?")->execute([$medicalId]);
    } elseif ($medicalId !== null && $firstAidId !== null) {
        $pdo->prepare('INSERT IGNORE INTO volunteer_skills (volunteer_id, skill_id, skill_level) SELECT volunteer_id, ?, skill_level FROM volunteer_skills WHERE skill_id = ?')->execute([$firstAidId, $medicalId]);
        $pdo->prepare('DELETE FROM volunteer_skills WHERE skill_id = ?')->execute([$medicalId]);
        $pdo->prepare('INSERT IGNORE INTO shift_skills (shift_id, skill_id) SELECT shift_id, ? FROM shift_skills WHERE skill_id = ?')->execute([$firstAidId, $medicalId]);
        $pdo->prepare('DELETE FROM shift_skills WHERE skill_id = ?')->execute([$medicalId]);
        $pdo->prepare('DELETE med FROM volunteer_skill_verifications med JOIN volunteer_skill_verifications aid ON aid.volunteer_id = med.volunteer_id AND aid.skill_id = ? WHERE med.skill_id = ?')->execute([$firstAidId, $medicalId]);
        $pdo->prepare('UPDATE volunteer_skill_verifications SET skill_id = ? WHERE skill_id = ?')->execute([$firstAidId, $medicalId]);
        $pdo->prepare('UPDATE skills SET description = ? WHERE skill_id = ?')->execute(['Basic emergency, first aid, and medical assistance', $firstAidId]);
        $pdo->prepare('DELETE FROM skills WHERE skill_id = ?')->execute([$medicalId]);
    }
} catch (Throwable $e) { /* preserve API availability if legacy skill relations differ */ }

// Auto-deactivate volunteers whose last check-in is older than 24 hours.
try { $pdo->exec("UPDATE volunteers SET status = 'pending' WHERE status = 'active' AND (last_check_in IS NULL OR last_check_in < DATE_SUB(NOW(), INTERVAL 24 HOUR))"); } catch (Throwable $e) { /* ignore */ }

$endpoint = basename(parse_url($_GET['endpoint'] ?? $_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '');
$body = json_decode(file_get_contents('php://input'), true) ?: [];

/// Parse a donation reference that may be "RT-000124" or a bare numeric id.
function parseReference(string $reference): int {
    $ref = trim($reference);
    if (preg_match('/^RT-(?:\d{4}-)?(\d+)$/i', $ref, $m)) return (int) $m[1];
    return (int) $ref;
}

/// Format a numeric donation id as a display reference: "RT-000124".
function fmtReference(int $id): string {
    return 'RT-' . str_pad((string) $id, 6, '0', STR_PAD_LEFT);
}

/// Format a donation row's amount for display.
function fmtAmount(string $donationType, float $amount, int $itemCount): string {
    if ($donationType === 'cash' || $donationType === 'mixed') {
        return "\u{20B1}" . number_format($amount, 0, '.', ',');
    }
    return $itemCount . ' item type' . ($itemCount != 1 ? 's' : '');
}

/// Fetch all donation items for a given donation id.
function fetchDonationItems(PDO $pdo, int $donationId): array {
    $stmt = $pdo->prepare("SELECT item_name, category, quantity, unit FROM donation_items WHERE donation_id = ? ORDER BY donation_item_id");
    $stmt->execute([$donationId]);
    return array_map(function ($r) {
        return [
            'name' => $r['item_name'],
            'category' => $r['category'] ?? '',
            'quantity' => (int) $r['quantity'],
            'unit' => $r['unit'] ?? 'pcs',
        ];
    }, $stmt->fetchAll());
}

/// Fetch all donation updates for a given donation id, oldest first.
function fetchDonationUpdates(PDO $pdo, int $donationId): array {
    $stmt = $pdo->prepare("SELECT status, message, location, created_at FROM donation_updates WHERE donation_id = ? ORDER BY created_at ASC, update_id ASC");
    $stmt->execute([$donationId]);
    return array_map(function ($r) {
        return [
            'stage' => $r['status'],
            'message' => $r['message'] ?? '',
            'location' => $r['location'] ?? null,
            'time' => date('M j, Y g:i A', strtotime($r['created_at'])),
        ];
    }, $stmt->fetchAll());
}

/// Build a full TrackedDonation shape from a joined DB row + pre-loaded items + updates.
function fetchDonationShipment(PDO $pdo, int $donationId): ?array {
    $stmt = $pdo->prepare("SELECT sh.shipment_reference,sh.status,sh.current_latitude,sh.current_longitude,sh.gps_updated_at,src.location_name origin_name,src.latitude origin_latitude,src.longitude origin_longitude,dst.location_name destination_name,dst.latitude destination_latitude,dst.longitude destination_longitude FROM shipments sh LEFT JOIN locations src ON src.location_id=sh.source_location_id LEFT JOIN locations dst ON dst.location_id=sh.destination_location_id WHERE sh.donation_id = ? ORDER BY sh.shipment_id DESC LIMIT 1");
    $stmt->execute([$donationId]);
    $shipment = $stmt->fetch();
    if (!$shipment) return null;
    $hasGps = $shipment['current_latitude'] !== null && $shipment['current_longitude'] !== null;
    return [
        'reference' => $shipment['shipment_reference'],
        'status' => $shipment['status'],
        'coordinates' => $hasGps ? [(float)$shipment['current_latitude'], (float)$shipment['current_longitude']] : null,
        'locationUpdatedAt' => $shipment['gps_updated_at'],
        'lastLocation' => $hasGps ? 'Driver GPS location' : ($shipment['status'] === 'delivered' ? ($shipment['destination_name'] ?? 'Destination') : ($shipment['origin_name'] ?? 'Pickup site')),
        'origin' => $shipment['origin_name'] ?? null,
        'destination' => $shipment['destination_name'] ?? null,
        'originCoordinates' => $shipment['origin_latitude'] !== null ? [(float)$shipment['origin_latitude'],(float)$shipment['origin_longitude']] : null,
        'destinationCoordinates' => $shipment['destination_latitude'] !== null ? [(float)$shipment['destination_latitude'],(float)$shipment['destination_longitude']] : null,
    ];
}

function buildTrackedDonation(array $row, array $items, array $updates, ?array $shipmentTracking = null): array {
    return [
        'reference' => fmtReference((int) $row['donation_id']),
        'donor' => $row['donor_name'],
        'donorEmail' => $row['donor_email'] ?? '',
        'type' => $row['donation_type'],
        'amount' => fmtAmount($row['donation_type'], (float) ($row['amount'] ?? 0), count($items)),
        'operation' => $row['operation_name'] ?? '',
        'destination' => $row['location_name'] ?? ($row['operation_name'] ?? 'Caloocan'),
        'donorPreference' => $row['donor_preference'] ?? '',
        'destinationLocationId' => isset($row['preferred_location_id']) ? (string)$row['preferred_location_id'] : null,
        'dropOffLocation' => $row['drop_off_name'] ?? null,
        'dropOffLocationId' => isset($row['drop_off_location_id']) ? (string)$row['drop_off_location_id'] : null,
        'shipmentTracking' => $shipmentTracking,
        'date' => date('M j, Y', strtotime($row['donated_at'])),
        'stage' => $updates ? $updates[count($updates) - 1]['stage'] : $row['status'],
        'items' => $items,
        'updates' => $updates,
    ];
}

/// Fetch a volunteer's joined shifts (excludes cancelled signups).
function getVolunteerShifts(PDO $pdo, int $volunteerId): array {
    $stmt = $pdo->prepare(
        "SELECT s.shift_id, s.shift_name, s.shift_date, s.start_time, s.end_time,
                s.required_volunteers, s.status,
                l.location_name, l.city, l.latitude, l.longitude,
                g.signup_status, g.check_in, g.check_out
         FROM signups g
         JOIN shifts s ON s.shift_id = g.shift_id
         LEFT JOIN locations l ON l.location_id = s.location_id
         WHERE g.volunteer_id = ? AND g.signup_status != 'cancelled'
         ORDER BY s.shift_date DESC"
    );
    $stmt->execute([$volunteerId]);
    return array_map(function ($r) {
        if ($r['check_in'] && $r['check_out']) {
            $hours = round((strtotime($r['check_out']) - strtotime($r['check_in'])) / 3600, 1);
        } else {
            $hours = round((strtotime($r['end_time']) - strtotime($r['start_time'])) / 3600, 1);
        }
        return [
            'id' => (string) $r['shift_id'],
            'name' => $r['shift_name'],
            'location' => $r['location_name'] ?? 'To be announced',
            'city' => $r['city'] ?? 'Caloocan',
            'date' => date('D, M j', strtotime($r['shift_date'])),
            'window' => date('g:i A', strtotime($r['start_time'])) . ' - ' . date('g:i A', strtotime($r['end_time'])),
            'signupStatus' => $r['signup_status'],
            'hours' => $hours,
            'coordinates' => $r['latitude'] !== null ? [(float) $r['latitude'], (float) $r['longitude']] : null,
        ];
    }, $stmt->fetchAll());
}

/// Map a volunteer profile from a DB row.
function mapVolunteer(array $row, PDO $pdo): array {
    $stmt = $pdo->prepare("SELECT s.skill_name FROM volunteer_skills vs JOIN skills s ON s.skill_id = vs.skill_id WHERE vs.volunteer_id = ?");
    $stmt->execute([$row['volunteer_id']]);
    $skills = array_column($stmt->fetchAll(), 'skill_name');
    return [
        'volunteerId' => (string) $row['volunteer_id'],
        'fullName' => $row['full_name'],
        'email' => $row['email'],
        'phone' => $row['phone'] ?? '',
        'address' => $row['address'] ?? '',
        'emergencyContact' => $row['emergency_contact'] ?? '',
        'emergencyPhone' => $row['emergency_phone'] ?? '',
        'drivingLicenseNumber' => $row['driving_license_number'] ?? '',
        'drivingLicenseType' => $row['driving_license_type'] ?? '',
        'firstAidQualification' => $row['first_aid_qualification'] ?? '',
        'status' => $row['status'],
        'skills' => $skills,
        'verificationStatus' => $row['verification_status'] ?? 'unverified',
        'verificationPhoto' => $row['verification_photo'] ?? null,
        'verificationSubmittedAt' => $row['verification_submitted_at'] ?? null,
        'verificationNotes' => $row['verification_notes'] ?? null,
    ];
}

function publicLocation(array $row): array {
    return ['id' => (string) $row['location_id'], 'kind' => $row['location_type'], 'name' => $row['location_name'], 'address' => $row['address'], 'city' => $row['city'] ?: 'Caloocan', 'province' => $row['province'] ?: 'Metro Manila', 'coordinates' => [$row['latitude'] !== null ? (float) $row['latitude'] : 14.6547, $row['longitude'] !== null ? (float) $row['longitude'] : 120.9830], 'status' => $row['status'], 'detail' => ($row['detail'] ?? '') !== '' ? $row['detail'] : 'ReliefTrack checkpoint.', 'contactPhone' => $row['contact_phone'] ?? null, 'operatedBy' => $row['operated_by'] ?? null, 'imageUrl' => $row['photo_url'] ?? null, 'feedbackRating' => isset($row['feedback_rating']) ? (float)$row['feedback_rating'] : null, 'feedbackCount' => isset($row['feedback_count']) ? (int)$row['feedback_count'] : null, 'volunteersNeeded' => (int)($row['volunteers_needed'] ?? 0), 'operationIds' => isset($row['operation_ids']) && $row['operation_ids'] !== '' ? explode(',', $row['operation_ids']) : []];
}

function enforceRateLimit(PDO $pdo, string $endpoint, string $identity, int $limit, int $windowMinutes): void {
    $keyHash = hash('sha256', $identity);
    $pdo->prepare('DELETE FROM api_rate_limits WHERE requested_at < DATE_SUB(NOW(), INTERVAL 1 DAY)')->execute();
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM api_rate_limits WHERE endpoint=? AND key_hash=? AND requested_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)');
    $stmt->execute([$endpoint, $keyHash, $windowMinutes]);
    if ((int)$stmt->fetchColumn() >= $limit) fail('Too many requests. Try again later.', 429);
    $pdo->prepare('INSERT INTO api_rate_limits (endpoint,key_hash) VALUES (?,?)')->execute([$endpoint, $keyHash]);
}

function ensureSystemAlert(PDO $pdo, string $type, string $title, string $message, string $priority): void {
    $title = substr($title, 0, 200);
    $stmt = $pdo->prepare('SELECT alert_id FROM alerts WHERE alert_type=? AND title=? LIMIT 1');
    $stmt->execute([$type, $title]);
    if (!$stmt->fetch()) {
        $pdo->prepare('INSERT INTO alerts (alert_type,title,message,priority,is_read) VALUES (?,?,?,?,FALSE)')->execute([$type, $title, $message, $priority]);
    }
}

function generateOperationalAlerts(PDO $pdo): void {
    $rows = $pdo->query("SELECT i.inventory_id,i.item_name,COALESCE(l.location_name,'Unassigned') location_name,i.status FROM inventory i LEFT JOIN locations l ON l.location_id=i.location_id WHERE i.status IN ('low_stock','out_of_stock')")->fetchAll();
    foreach ($rows as $row) {
        $title = ucfirst(str_replace('_', ' ', $row['status'])) . ': ' . $row['item_name'] . ' at ' . $row['location_name'];
        ensureSystemAlert($pdo, 'inventory', $title, $row['item_name'] . ' is ' . str_replace('_', ' ', $row['status']) . ' at ' . $row['location_name'] . '.', $row['status'] === 'out_of_stock' ? 'critical' : 'high');
    }

    $rows = $pdo->query("SELECT needed_item_id,item_name,location_id FROM needed_items WHERE priority='critical' AND status!='fulfilled'")->fetchAll();
    foreach ($rows as $row) {
        $stmt = $pdo->prepare('SELECT location_name FROM locations WHERE location_id=?');
        $stmt->execute([$row['location_id']]);
        $location = $stmt->fetchColumn() ?: 'Unassigned';
        $title = 'Critical need: ' . $row['item_name'] . ' at ' . $location;
        ensureSystemAlert($pdo, 'system', $title, 'Critical supplies are still required: ' . $row['item_name'] . ' at ' . $location . '.', 'critical');
    }

    $rows = $pdo->query("SELECT s.shift_id,s.shift_name,s.required_volunteers,(SELECT COUNT(*) FROM signups g WHERE g.shift_id=s.shift_id AND g.signup_status IN ('pending','approved')) filled FROM shifts s WHERE s.status IN ('open','full','ongoing') HAVING filled > required_volunteers")->fetchAll();
    foreach ($rows as $row) {
        $title = 'Overfilled shift: ' . $row['shift_name'];
        ensureSystemAlert($pdo, 'volunteer', $title, $row['shift_name'] . ' has ' . (int)$row['filled'] . ' signups for ' . (int)$row['required_volunteers'] . ' slots.', 'medium');
    }

    $rows = $pdo->query("SELECT d.donation_id,d.donor_name,COALESCE(MAX(u.created_at),d.donated_at) last_update FROM donations d LEFT JOIN donation_updates u ON u.donation_id=d.donation_id WHERE d.status IN ('pledged','received','allocated','in_transit') GROUP BY d.donation_id HAVING last_update < DATE_SUB(NOW(), INTERVAL 3 DAY)")->fetchAll();
    foreach ($rows as $row) {
        $reference = fmtReference((int)$row['donation_id']);
        ensureSystemAlert($pdo, 'donation', 'Stalled donation: ' . $reference, $row['donor_name'] . ' Ã‚Â· ' . $reference . ' has had no checkpoint update for more than 3 days.', 'medium');
    }
}

// --- Endpoints ---

try {
    switch ($endpoint) {
        case 'admin_login.php':
            $email = strtolower(inputString($body, 'email')); $password = (string)($body['password'] ?? '');
            $stmt = $pdo->prepare("SELECT staff_id, full_name, email, password, role FROM staff_users WHERE email = ? AND status = 'active' LIMIT 1");
            $stmt->execute([$email]); $staff = $stmt->fetch();
            if (!$staff || !password_verify($password, $staff['password'])) fail('Invalid email or password.', 401);
            // A browser may have used the driver portal before staff sign-in.
            // Start with one identity so subsequent mutations use the right CSRF token.
            $_SESSION = [];
            session_regenerate_id(true); $_SESSION['staff_id'] = (int)$staff['staff_id']; $_SESSION['role'] = $staff['role']; $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            ok(['admin' => ['staffId' => (string)$staff['staff_id'], 'fullName' => $staff['full_name'], 'email' => $staff['email'], 'role' => $staff['role'], 'csrfToken' => $_SESSION['csrf_token']]]);
            break;

        case 'admin_session.php':
            $staffId = requireStaff();
            $stmt = $pdo->prepare("SELECT staff_id, full_name, email, role FROM staff_users WHERE staff_id = ? AND status = 'active' LIMIT 1");
            $stmt->execute([$staffId]);
            $staff = $stmt->fetch();
            if (!$staff) { $_SESSION = []; session_destroy(); fail('Staff session is no longer active.', 401); }
            if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            ok(['admin' => ['staffId' => (string)$staff['staff_id'], 'fullName' => $staff['full_name'], 'email' => $staff['email'], 'role' => $staff['role'], 'csrfToken' => $_SESSION['csrf_token']]]);
            break;

        case 'admin_logout.php':
            requireStaffMutation();
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $cookie = session_get_cookie_params();
                setcookie(session_name(), '', ['expires' => time() - 42000, 'path' => $cookie['path'] ?: '/', 'domain' => $cookie['domain'], 'secure' => $cookie['secure'], 'httponly' => $cookie['httponly'], 'samesite' => $cookie['samesite'] ?? 'Lax']);
            }
            session_destroy();
            ok(['signedOut' => true]);
            break;

        case 'admin_driver_create.php':
            $staffId = requireStaffMutation();
            $name = inputString($body, 'fullName');
            $email = strtolower(inputString($body, 'email'));
            $password = (string)($body['password'] ?? '');
            $phone = inputString($body, 'phone');
            $vehicleId = (int)($body['vehicleId'] ?? 0);
            if (!$name || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 10 || !$vehicleId) fail('Enter a driver name, valid email, password with at least 10 characters, and vehicle.');
            $vehicleQuery = $pdo->prepare("SELECT vehicle_id FROM vehicles WHERE vehicle_id=? AND status='available' AND (driver_id IS NULL OR driver_id=0)");
            $vehicleQuery->execute([$vehicleId]);
            if (!$vehicleQuery->fetch()) fail('Choose an available vehicle without a driver account.');
            try {
                $pdo->beginTransaction();
                $pdo->prepare("INSERT INTO drivers (full_name,email,password_hash,phone,status) VALUES (?,?,?,?,'active')")->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$phone ?: null]);
                $driverId = (int)$pdo->lastInsertId();
                $pdo->prepare('UPDATE vehicles SET driver_id=?,driver_name=?,driver_contact=? WHERE vehicle_id=?')->execute([$driverId,$name,$phone ?: null,$vehicleId]);
                $pdo->prepare("INSERT INTO activity_log (staff_id,action,description,module,reference_id) VALUES (?,'Created Driver Account',?,'Logistics',?)")->execute([$staffId,$name.' can now sign in to view shipments for the assigned vehicle.',$driverId]);
                $pdo->commit();
            } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
            ok(['created'=>true,'driver'=>['id'=>(string)$driverId,'fullName'=>$name,'email'=>$email,'vehicleId'=>(string)$vehicleId]]);
            break;

        case 'driver_register.php':
            $name=trim(inputString($body,'fullName')); $email=strtolower(trim(inputString($body,'email'))); $password=(string)($body['password'] ?? '');
            $phone=trim(inputString($body,'phone')); $licenseNumber=trim(inputString($body,'drivingLicenseNumber')); $licenseType=trim(inputString($body,'drivingLicenseType'));
            if ($name==='' || strlen($name)>150 || !filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($password)<10) fail('Enter your name, a valid email, and a password with at least 10 characters.');
            try { $pdo->prepare("INSERT INTO drivers (full_name,email,password_hash,phone,driving_license_number,driving_license_type,status) VALUES (?,?,?,?,?,?,'pending')")->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$phone ?: null,$licenseNumber ?: null,$licenseType ?: null]); }
            catch (PDOException $e) { if ($e->getCode()==='23000') fail('An account already uses that email.'); throw $e; }
            ok(['created'=>true,'status'=>'pending']);
            break;

        case 'driver_profile_update.php':
            $driverId = requireDriverMutation();
            $name = trim(inputString($body, 'fullName')); $phone = trim(inputString($body, 'phone'));
            $licenseNumber = trim(inputString($body, 'drivingLicenseNumber')); $licenseType = trim(inputString($body, 'drivingLicenseType'));
            if ($name === '' || strlen($name) > 150) fail('Enter a valid full name.');
            $stmt = $pdo->prepare("UPDATE drivers SET full_name=?,phone=?,driving_license_number=?,driving_license_type=? WHERE driver_id=? AND status='active'");
            $stmt->execute([$name,$phone ?: null,$licenseNumber ?: null,$licenseType ?: null,$driverId]);
            $pdo->prepare('UPDATE vehicles SET driver_name=?,driver_contact=? WHERE driver_id=?')->execute([$name,$phone ?: null,$driverId]);
            $stmt = $pdo->prepare('SELECT d.driver_id,d.full_name,d.email,d.phone,d.driving_license_number,d.driving_license_type,v.vehicle_name,v.plate_number FROM drivers d LEFT JOIN vehicles v ON v.driver_id=d.driver_id WHERE d.driver_id=?');
            $stmt->execute([$driverId]); $r=$stmt->fetch();
            ok(['driver'=>['driverId'=>(string)$r['driver_id'],'fullName'=>$r['full_name'],'email'=>$r['email'],'phone'=>$r['phone'] ?? '','drivingLicenseNumber'=>$r['driving_license_number'] ?? '','drivingLicenseType'=>$r['driving_license_type'] ?? '','vehicleName'=>$r['vehicle_name'] ?? 'No vehicle','plateNumber'=>$r['plate_number'] ?? '']]);
            break;

        case 'driver_account_delete.php':
            $driverId = requireDriverMutation(); $password = (string)($body['password'] ?? '');
            $stmt=$pdo->prepare("SELECT password_hash FROM drivers WHERE driver_id=? AND status='active'"); $stmt->execute([$driverId]); $hash=$stmt->fetchColumn();
            if (!$hash || !password_verify($password,(string)$hash)) fail('Your current password is incorrect.',401);
            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE shipments sh JOIN vehicles v ON v.vehicle_id=sh.vehicle_id SET sh.status='cancelled',sh.notes=CONCAT(COALESCE(sh.notes,''),' Driver account deactivated.') WHERE v.driver_id=? AND sh.status IN ('pending','packed')")->execute([$driverId]);
                $pdo->prepare("UPDATE drivers SET status='inactive' WHERE driver_id=?")->execute([$driverId]);
                $pdo->prepare("UPDATE vehicles AS v SET driver_id=NULL,driver_name=NULL,driver_contact=NULL,status=IF(EXISTS(SELECT 1 FROM shipments sh WHERE sh.vehicle_id=v.vehicle_id AND sh.status='in_transit'),'in_use','available') WHERE v.driver_id=?")->execute([$driverId]);
                $pdo->commit();
            } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
            $_SESSION=[]; session_destroy(); ok(['deleted'=>true]);
            break;

        case 'admin_drivers.php':
            requireStaff();
            $rows=$pdo->query('SELECT d.driver_id,d.full_name,d.email,d.phone,d.driving_license_number,d.driving_license_type,d.status,v.vehicle_id,v.vehicle_name,v.plate_number,(SELECT COUNT(*) FROM shipments sh WHERE sh.driver_id=d.driver_id AND sh.status=\'delivered\') completed_deliveries FROM drivers d LEFT JOIN vehicles v ON v.driver_id=d.driver_id ORDER BY d.full_name')->fetchAll();
            ok(array_map(fn($r)=>['id'=>(string)$r['driver_id'],'fullName'=>$r['full_name'],'email'=>$r['email'],'phone'=>$r['phone'] ?? '','drivingLicenseNumber'=>$r['driving_license_number'] ?? '','drivingLicenseType'=>$r['driving_license_type'] ?? '','status'=>$r['status'],'vehicleId'=>$r['vehicle_id'] !== null ? (string)$r['vehicle_id'] : null,'vehicleName'=>$r['vehicle_name'] ?? 'Unassigned','plateNumber'=>$r['plate_number'] ?? '','completedDeliveries'=>(int)$r['completed_deliveries']],$rows));
            break;

        case 'admin_driver_manage.php':
            $staffId=requireStaffMutation(); $driverId=(int)($body['driverId'] ?? 0);
            $name=trim(inputString($body,'fullName')); $email=strtolower(trim(inputString($body,'email'))); $phone=trim(inputString($body,'phone')); $licenseNumber=trim(inputString($body,'drivingLicenseNumber')); $licenseType=trim(inputString($body,'drivingLicenseType')); $status=inputString($body,'status'); $newPassword=(string)($body['newPassword'] ?? ''); $vehicleId=isset($body['vehicleId']) && $body['vehicleId'] !== '' ? (int)$body['vehicleId'] : null;
            if (!$driverId || $name === '' || !filter_var($email,FILTER_VALIDATE_EMAIL) || !in_array($status,['pending','active','inactive'],true)) fail('Driver details are incomplete.');
            if ($status==='active' && !$vehicleId) fail('Assign an available vehicle before activating this driver.');
            if ($newPassword !== '' && strlen($newPassword)<10) fail('New password must be at least 10 characters.');
            $stmt=$pdo->prepare('SELECT driver_id FROM drivers WHERE driver_id=?'); $stmt->execute([$driverId]); if (!$stmt->fetch()) fail('Driver not found.',404);
            $pdo->beginTransaction();
            try {
                $sql='UPDATE drivers SET full_name=?,email=?,phone=?,driving_license_number=?,driving_license_type=?,status=?'; $params=[$name,$email,$phone ?: null,$licenseNumber ?: null,$licenseType ?: null,$status];
                if ($newPassword !== '') { $sql.=',password_hash=?'; $params[]=password_hash($newPassword,PASSWORD_DEFAULT); }
                $sql.=' WHERE driver_id=?'; $params[]=$driverId; $pdo->prepare($sql)->execute($params);
                $current=$pdo->prepare('SELECT vehicle_id FROM vehicles WHERE driver_id=?'); $current->execute([$driverId]); $currentVehicle=$current->fetchColumn();
                if ($currentVehicle && (empty($vehicleId) || (int)$currentVehicle !== $vehicleId || $status !== 'active')) $pdo->prepare("UPDATE vehicles AS v SET driver_id=NULL,driver_name=NULL,driver_contact=NULL,status=IF(EXISTS(SELECT 1 FROM shipments sh WHERE sh.vehicle_id=v.vehicle_id AND sh.status='in_transit'),'in_use','available') WHERE v.vehicle_id=?")->execute([(int)$currentVehicle]);
                if ($status==='active' && $vehicleId && (int)$currentVehicle !== $vehicleId) {
                    $q=$pdo->prepare("SELECT vehicle_id FROM vehicles WHERE vehicle_id=? AND (driver_id IS NULL OR driver_id=?) AND status='available'"); $q->execute([$vehicleId,$driverId]); if (!$q->fetch()) fail('Choose an available vehicle without another driver.');
                    $pdo->prepare('UPDATE vehicles SET driver_id=?,driver_name=?,status=IF(status=\'in_use\',status,\'available\') WHERE vehicle_id=?')->execute([$driverId,$name,$vehicleId]);
                } elseif ($status==='active' && $vehicleId) {
                    $pdo->prepare('UPDATE vehicles SET driver_name=? WHERE vehicle_id=? AND driver_id=?')->execute([$name,$vehicleId,$driverId]);
                }
                if ($status!=='active' && $currentVehicle) $pdo->prepare("UPDATE shipments SET status='cancelled',notes=CONCAT(COALESCE(notes,''),' Driver account deactivated.') WHERE vehicle_id=? AND status IN ('pending','packed')")->execute([(int)$currentVehicle]);
                $pdo->prepare("INSERT INTO activity_log (staff_id,action,description,module,reference_id) VALUES (?,?,?,'Logistics',?)")->execute([$staffId,$status==='active'?'Updated Driver Account':'Deactivated Driver Account',$name.' account details were updated by an administrator.',$driverId]);
                $pdo->commit();
            } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
            if (!empty($_SESSION['driver_id']) && (int)$_SESSION['driver_id']===$driverId) { $_SESSION=[]; session_destroy(); }
            ok(['updated'=>true]);
            break;

        case 'driver_login.php':
            $email = strtolower(inputString($body,'email')); $password = (string)($body['password'] ?? '');
            $stmt = $pdo->prepare("SELECT d.driver_id,d.full_name,d.email,d.phone,d.driving_license_number,d.driving_license_type,d.password_hash,v.vehicle_name,v.plate_number FROM drivers d LEFT JOIN vehicles v ON v.driver_id=d.driver_id WHERE d.email=? AND d.status='active' LIMIT 1");
            $stmt->execute([$email]); $driver = $stmt->fetch();
            if (!$driver || !password_verify($password,$driver['password_hash'])) fail('Invalid email or password.',401);
            $_SESSION=[]; session_regenerate_id(true); $_SESSION['driver_id']=(int)$driver['driver_id']; $_SESSION['driver_csrf_token']=bin2hex(random_bytes(32));
            ok(['driver'=>['driverId'=>(string)$driver['driver_id'],'fullName'=>$driver['full_name'],'email'=>$driver['email'],'phone'=>$driver['phone'] ?? '','drivingLicenseNumber'=>$driver['driving_license_number'] ?? '','drivingLicenseType'=>$driver['driving_license_type'] ?? '','vehicleName'=>$driver['vehicle_name'] ?? 'No vehicle','plateNumber'=>$driver['plate_number'] ?? '','csrfToken'=>$_SESSION['driver_csrf_token']]]);
            break;

        case 'driver_session.php':
            $driverId = requireDriver();
            $stmt = $pdo->prepare("SELECT d.driver_id,d.full_name,d.email,d.phone,d.driving_license_number,d.driving_license_type,v.vehicle_name,v.plate_number FROM drivers d LEFT JOIN vehicles v ON v.driver_id=d.driver_id WHERE d.driver_id=? AND d.status='active'");
            $stmt->execute([$driverId]); $driver=$stmt->fetch();
            if (!$driver) { unset($_SESSION['driver_id']); fail('Driver account is no longer active.',401); }
            if (empty($_SESSION['driver_csrf_token'])) $_SESSION['driver_csrf_token']=bin2hex(random_bytes(32));
            ok(['driver'=>['driverId'=>(string)$driver['driver_id'],'fullName'=>$driver['full_name'],'email'=>$driver['email'],'phone'=>$driver['phone'] ?? '','drivingLicenseNumber'=>$driver['driving_license_number'] ?? '','drivingLicenseType'=>$driver['driving_license_type'] ?? '','vehicleName'=>$driver['vehicle_name'] ?? 'No vehicle','plateNumber'=>$driver['plate_number'] ?? '','csrfToken'=>$_SESSION['driver_csrf_token']]]);
            break;

        case 'driver_logout.php':
            requireDriverMutation(); unset($_SESSION['driver_id'],$_SESSION['driver_csrf_token']); ok(['signedOut'=>true]); break;

        case 'driver_shipments.php':
            $driverId=requireDriver();
            $stmt=$pdo->prepare("SELECT sh.shipment_id,sh.shipment_reference,sh.item_description,sh.quantity,sh.status,sh.notes,sh.current_latitude,sh.current_longitude,sh.gps_updated_at,src.location_name origin_name,src.address origin_address,src.latitude origin_latitude,src.longitude origin_longitude,dst.location_name destination_name,dst.address destination_address,dst.latitude destination_latitude,dst.longitude destination_longitude,v.vehicle_name,v.plate_number,d.donation_id FROM shipments sh JOIN vehicles v ON v.vehicle_id=sh.vehicle_id LEFT JOIN locations src ON src.location_id=sh.source_location_id LEFT JOIN locations dst ON dst.location_id=sh.destination_location_id LEFT JOIN donations d ON d.donation_id=sh.donation_id WHERE v.driver_id=? AND sh.status IN ('pending','packed','in_transit') ORDER BY FIELD(sh.status,'in_transit','packed','pending'),sh.created_at DESC");
            $stmt->execute([$driverId]);
            ok(array_map(fn($r)=>['id'=>(string)$r['shipment_id'],'reference'=>$r['shipment_reference'],'origin'=>$r['origin_name'] ?? 'Pickup site','destination'=>$r['destination_name'] ?? 'Destination','originAddress'=>$r['origin_address'] ?? '','destinationAddress'=>$r['destination_address'] ?? '','originCoordinates'=>$r['origin_latitude'] !== null ? [(float)$r['origin_latitude'],(float)$r['origin_longitude']] : null,'coordinates'=>$r['current_latitude'] !== null ? [(float)$r['current_latitude'],(float)$r['current_longitude']] : ($r['destination_latitude'] !== null ? [(float)$r['destination_latitude'],(float)$r['destination_longitude']] : null),'itemDescription'=>$r['item_description'] ?? '','quantity'=>(int)$r['quantity'],'vehicle'=>$r['vehicle_name'],'plateNumber'=>$r['plate_number'],'status'=>$r['status'],'note'=>$r['notes'] ?? '','locationUpdatedAt'=>$r['gps_updated_at'],'donationReference'=>$r['donation_id'] ? fmtReference((int)$r['donation_id']) : null],$stmt->fetchAll()));
            break;

        case 'operations.php':
            $rows = $pdo->query("SELECT o.*, (SELECT COUNT(DISTINCT ol.location_id) FROM operation_locations ol WHERE ol.operation_id=o.operation_id) location_count, (SELECT COALESCE(SUM(GREATEST(s.required_volunteers - (SELECT COUNT(*) FROM signups g WHERE g.shift_id=s.shift_id AND g.signup_status IN ('pending','approved')),0)),0) FROM shifts s WHERE s.operation_id=o.operation_id AND s.status IN ('open','full')) volunteer_shortfall FROM operations o ORDER BY o.created_at DESC")->fetchAll();
            ok(array_map(fn($r) => ['id'=>(string)$r['operation_id'],'name'=>$r['operation_name'],'description'=>$r['description'] ?? '','type'=>$r['operation_type'],'status'=>$r['status'],'startDate'=>$r['start_date'],'endDate'=>$r['end_date'],'locationCount'=>(int)$r['location_count'],'volunteersNeeded'=>(int)$r['volunteers_needed'],'volunteerShortfall'=>(int)$r['volunteer_shortfall']], $rows));
            break;

        case 'operation_create.php':
            $staffId = requireStaffMutation();
            $name = inputString($body, 'name');
            $description = inputString($body, 'description');
            $type = inputString($body, 'type') ?: 'disaster_response';
            $volunteersNeeded = (int)($body['volunteersNeeded'] ?? 0);
            $status = inputString($body, 'status') === 'active' ? 'active' : 'planned';
            $startDate = inputString($body, 'startDate');
            $endDate = inputString($body, 'endDate');
            $locationName = inputString($body, 'locationName');
            $address = inputString($body, 'address');
            $city = inputString($body, 'city');
            $province = inputString($body, 'province') ?: 'Metro Manila';
            $coordinates = $body['coordinates'] ?? null;
            $shiftName = inputString($body, 'shiftName');
            $shiftDate = inputString($body, 'shiftDate');
            $shiftStart = inputString($body, 'shiftStart');
            $shiftEnd = inputString($body, 'shiftEnd');
            $requiredSkillIds = $body['requiredSkillIds'] ?? [];
            if (!$name || !$description || !$startDate || !$endDate || !$shiftName || !$shiftDate || !$shiftStart || !$shiftEnd) fail('Complete all required operation and first-shift fields.');
            if (!in_array($type, ['disaster_response','relief_distribution','rescue','donation_drive','other'], true)) fail('Choose a valid operation type.');
            if ($volunteersNeeded < 1) fail('The first volunteer shift needs at least one open slot.');
            $validDate = static function (string $value): bool {
                $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
                return $date !== false && $date->format('Y-m-d') === $value;
            };
            if (!$validDate($startDate) || !$validDate($endDate) || !$validDate($shiftDate)) fail('Enter valid operation and shift dates.');
            if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $shiftStart) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $shiftEnd)) fail('Enter valid shift start and end times.');
            if ($endDate < $startDate) fail('End date must be on or after the start date.');
            if ($shiftDate < $startDate || $shiftDate > $endDate) fail('The first volunteer shift must fall within the operation dates.');
            if ($shiftEnd <= $shiftStart) fail('The shift end time must be later than its start time.');
            if (!$address || !$coordinates || !is_array($coordinates) || count($coordinates) !== 2) fail('Add an exact address and pin the operation on the map.');
            if (!is_numeric($coordinates[0]) || !is_numeric($coordinates[1]) || (float)$coordinates[0] < -90 || (float)$coordinates[0] > 90 || (float)$coordinates[1] < -180 || (float)$coordinates[1] > 180) fail('Choose a valid map location.');
            if (stripos($address, 'caloocan') === false && stripos($city, 'caloocan') === false) fail('The checkpoint address must be in Caloocan.');
            if (!is_array($requiredSkillIds)) fail('Choose valid volunteer skills.');
            $requiredSkillIds = array_values(array_unique(array_map('intval', $requiredSkillIds)));
            $skillExists = $pdo->prepare('SELECT 1 FROM skills WHERE skill_id=?');
            foreach ($requiredSkillIds as $skillId) {
                if ($skillId < 1) fail('Choose valid volunteer skills.');
                $skillExists->execute([$skillId]);
                if (!$skillExists->fetchColumn()) fail('One of the selected volunteer skills is no longer available. Refresh and try again.');
            }
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare("INSERT INTO operations (operation_name, description, operation_type, status, start_date, end_date, volunteers_needed, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$name, $description, $type, $status, $startDate, $endDate, $volunteersNeeded, $staffId]);
                $operationId = (int) $pdo->lastInsertId();
                $stmt = $pdo->prepare("INSERT INTO locations (operation_id, location_name, address, city, province, latitude, longitude, location_type, status, detail, operated_by, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, 'distribution_center', 'active', ?, ?, ?)");
                $stmt->execute([$operationId, $locationName ?: ($name . ' checkpoint'), $address, 'Caloocan', $province, (float)$coordinates[0], (float)$coordinates[1], $name . ' volunteer and donation checkpoint.', 'Caloocan ReliefTrack Team', '/85d10986-1e79-4d08-9a63-921b83635322.jpg']);
                $locationId = (int) $pdo->lastInsertId();
                $pdo->prepare('INSERT INTO operation_locations (operation_id, location_id) VALUES (?, ?)')->execute([$operationId, $locationId]);
                $shiftStmt = $pdo->prepare("INSERT INTO shifts (operation_id, location_id, shift_name, shift_date, start_time, end_time, required_volunteers, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')");
                $shiftStmt
                    ->execute([$operationId, $locationId, $shiftName, $shiftDate, $shiftStart, $shiftEnd, $volunteersNeeded]);
                $shiftId = (int)$pdo->lastInsertId();
                $skillInsert = $pdo->prepare('INSERT INTO shift_skills (shift_id, skill_id) VALUES (?, ?)');
                foreach ($requiredSkillIds as $skillId) $skillInsert->execute([$shiftId, $skillId]);
                $stmt = $pdo->prepare("INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$staffId, 'Created Operation', $name . ' and its first volunteer shift were added to the response plan.', 'Operations', $operationId]);
                $pdo->commit();
                ok(['id'=>(string)$operationId,'name'=>$name,'description'=>$description,'type'=>$type,'status'=>$status,'startDate'=>$startDate,'endDate'=>$endDate,'locationCount'=>1,'volunteersNeeded'=>$volunteersNeeded,'volunteerShortfall'=>$volunteersNeeded]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                fail('Could not create operation: ' . $e->getMessage(), 500);
            }
            break;

        case 'operation_update.php':
            $staffId = requireStaffMutation();
            $operationId = (int)inputString($body, 'operationId');
            $name = inputString($body, 'name');
            $description = inputString($body, 'description');
            $type = inputString($body, 'type');
            $status = inputString($body, 'status');
            $startDate = inputString($body, 'startDate');
            $endDate = inputString($body, 'endDate');
            $volunteersNeeded = filter_var($body['volunteersNeeded'] ?? null, FILTER_VALIDATE_INT);
            $validTypes = ['disaster_response','relief_distribution','rescue','donation_drive','other'];
            $validStatuses = ['planned','active','completed','cancelled'];
            $validDate = static function (string $value): bool {
                $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
                return $date !== false && $date->format('Y-m-d') === $value;
            };
            if (!$operationId || !$name || !$description || !in_array($type, $validTypes, true) || !in_array($status, $validStatuses, true) || $volunteersNeeded === false || $volunteersNeeded < 0) fail('Complete all required operation fields with valid values.');
            if (!$validDate($startDate) || !$validDate($endDate) || $endDate < $startDate) fail('Enter valid operation dates with the end date on or after the start date.');
            $stmt = $pdo->prepare('UPDATE operations SET operation_name=?, description=?, operation_type=?, status=?, start_date=?, end_date=?, volunteers_needed=? WHERE operation_id=?');
            $stmt->execute([$name, $description, $type, $status, $startDate, $endDate, $volunteersNeeded, $operationId]);
            if ($stmt->rowCount() === 0 && !$pdo->query('SELECT 1 FROM operations WHERE operation_id=' . $operationId)->fetchColumn()) fail('Operation not found.', 404);
            $pdo->prepare("INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES (?, 'Updated Operation', ?, 'Operations', ?)")->execute([$staffId, $name . ' was updated.', $operationId]);
            ok(['updated' => true]);
            break;

        case 'operation_delete.php':
            $staffId = requireStaffMutation();
            $operationId = (int)inputString($body, 'operationId');
            if (!$operationId) fail('Operation ID is required.');
            $stmt = $pdo->prepare('SELECT operation_name FROM operations WHERE operation_id=?');
            $stmt->execute([$operationId]);
            $name = $stmt->fetchColumn();
            if ($name === false) fail('Operation not found.', 404);
            $pdo->beginTransaction();
            try {
                $pdo->prepare('DELETE FROM operations WHERE operation_id=?')->execute([$operationId]);
                $pdo->prepare("INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES (?, 'Deleted Operation', ?, 'Operations', ?)")->execute([$staffId, $name . ' was deleted along with its shifts and sign-ups.', $operationId]);
                $pdo->commit();
                ok(['deleted' => true]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                fail('Could not delete operation: ' . $e->getMessage(), 500);
            }
            break;

        case 'dashboard.php':
            requireStaff();
            generateOperationalAlerts($pdo);
            $periodDelta = static function (int $current, int $previous): array {
                if ($current === 0 && $previous === 0) return ['delta' => '0%', 'trend' => 'flat'];
                if ($previous === 0) return ['delta' => '+100%', 'trend' => 'up'];
                $change = (int)round(($current - $previous) * 100 / $previous);
                return ['delta' => ($change > 0 ? '+' : '') . $change . '%', 'trend' => $change > 0 ? 'up' : ($change < 0 ? 'down' : 'flat')];
            };
            $activeVolunteers = (int)$pdo->query("SELECT COUNT(*) FROM volunteers WHERE status='active'")->fetchColumn();
            $activeVolunteersCurrent = (int)$pdo->query("SELECT COUNT(*) FROM volunteers WHERE status='active' AND registered_at >= CURDATE() - INTERVAL 6 DAY")->fetchColumn();
            $activeVolunteersPrevious = (int)$pdo->query("SELECT COUNT(*) FROM volunteers WHERE status='active' AND registered_at >= CURDATE() - INTERVAL 13 DAY AND registered_at < CURDATE() - INTERVAL 6 DAY")->fetchColumn();
            $donationTotal = (int)$pdo->query('SELECT COUNT(*) FROM donations')->fetchColumn();
            $donationsCurrent = (int)$pdo->query('SELECT COUNT(*) FROM donations WHERE donated_at >= CURDATE() - INTERVAL 6 DAY')->fetchColumn();
            $donationsPrevious = (int)$pdo->query('SELECT COUNT(*) FROM donations WHERE donated_at >= CURDATE() - INTERVAL 13 DAY AND donated_at < CURDATE() - INTERVAL 6 DAY')->fetchColumn();
            $inventoryTotal = (int)$pdo->query('SELECT COUNT(*) FROM inventory')->fetchColumn();
            $inventoryCurrent = (int)$pdo->query('SELECT COUNT(*) FROM inventory WHERE last_updated >= CURDATE() - INTERVAL 6 DAY')->fetchColumn();
            $inventoryPrevious = (int)$pdo->query('SELECT COUNT(*) FROM inventory WHERE last_updated >= CURDATE() - INTERVAL 13 DAY AND last_updated < CURDATE() - INTERVAL 6 DAY')->fetchColumn();
            $activeOperations = (int)$pdo->query("SELECT COUNT(*) FROM operations WHERE status='active'")->fetchColumn();
            $operationsCurrent = (int)$pdo->query("SELECT COUNT(*) FROM operations WHERE status='active' AND created_at >= CURDATE() - INTERVAL 6 DAY")->fetchColumn();
            $operationsPrevious = (int)$pdo->query("SELECT COUNT(*) FROM operations WHERE status='active' AND created_at >= CURDATE() - INTERVAL 13 DAY AND created_at < CURDATE() - INTERVAL 6 DAY")->fetchColumn();
            $volunteerDelta = $periodDelta($activeVolunteersCurrent, $activeVolunteersPrevious);
            $donationDelta = $periodDelta($donationsCurrent, $donationsPrevious);
            $inventoryDelta = $periodDelta($inventoryCurrent, $inventoryPrevious);
            $operationDelta = $periodDelta($operationsCurrent, $operationsPrevious);
            $kpis = [
                ['id'=>'active-volunteers','label'=>'Active volunteers','value'=>(string)$activeVolunteers,'sub'=>'weekly registrations vs prior week','delta'=>$volunteerDelta['delta'],'trend'=>$volunteerDelta['trend']],
                ['id'=>'donations','label'=>'Donations received','value'=>(string)$donationTotal,'sub'=>'weekly pledges vs prior week','delta'=>$donationDelta['delta'],'trend'=>$donationDelta['trend']],
                ['id'=>'inventory','label'=>'Inventory items','value'=>(string)$inventoryTotal,'sub'=>'recently updated rows vs prior week','delta'=>$inventoryDelta['delta'],'trend'=>$inventoryDelta['trend']],
                ['id'=>'operations','label'=>'Active operations','value'=>(string)$activeOperations,'sub'=>'new active operations vs prior week','delta'=>$operationDelta['delta'],'trend'=>$operationDelta['trend']]
            ];
            $alerts = $pdo->query("SELECT alert_id,alert_type,title,message,priority,is_read,DATE_FORMAT(created_at,'%b %e, %Y') time FROM alerts ORDER BY FIELD(priority,'critical','high','medium','low'), created_at DESC")->fetchAll();
            $activity = $pdo->query("SELECT a.activity_id,a.action,a.description,a.module,COALESCE(s.full_name,'') staff,DATE_FORMAT(a.created_at,'%b %e, %Y %l:%i %p') time FROM activity_log a LEFT JOIN staff_users s ON s.staff_id=a.staff_id ORDER BY a.created_at DESC LIMIT 20")->fetchAll();
            $mix = $pdo->query('SELECT category,COALESCE(SUM(quantity),0) quantity FROM donation_items GROUP BY category')->fetchAll();
            $trendByDate = [];
            $periodStart = new DateTimeImmutable('today -6 days');
            for ($index = 0; $index < 7; $index++) {
                $date = $periodStart->modify('+' . $index . ' days')->format('Y-m-d');
                $trendByDate[$date] = ['day' => date('D', strtotime($date)), 'cash' => 0.0, 'goods' => 0];
            }
            $cashRows = $pdo->query("SELECT DATE(donated_at) donation_day, SUM(CASE WHEN donation_type IN ('cash','mixed') THEN amount ELSE 0 END) / 1000 cash_total FROM donations WHERE donated_at >= CURDATE() - INTERVAL 6 DAY GROUP BY DATE(donated_at)")->fetchAll();
            foreach ($cashRows as $row) if (isset($trendByDate[$row['donation_day']])) $trendByDate[$row['donation_day']]['cash'] = (float)$row['cash_total'];
            $goodsRows = $pdo->query("SELECT DATE(d.donated_at) donation_day, COALESCE(SUM(di.quantity),0) goods_total FROM donations d JOIN donation_items di ON di.donation_id=d.donation_id WHERE d.donated_at >= CURDATE() - INTERVAL 6 DAY GROUP BY DATE(d.donated_at)")->fetchAll();
            foreach ($goodsRows as $row) if (isset($trendByDate[$row['donation_day']])) $trendByDate[$row['donation_day']]['goods'] = (int)$row['goods_total'];
            ok(['kpis'=>$kpis,'alerts'=>array_map(fn($r)=>['id'=>(string)$r['alert_id'],'type'=>$r['alert_type'],'title'=>$r['title'],'message'=>$r['message'],'priority'=>$r['priority'],'isRead'=>(bool)$r['is_read'],'time'=>$r['time']],$alerts),'activity'=>array_map(fn($r)=>['id'=>(string)$r['activity_id'],'action'=>$r['action'],'description'=>$r['description'],'module'=>$r['module'],'staff'=>$r['staff'],'time'=>$r['time']],$activity),'donationTrend'=>array_values($trendByDate),'categoryMix'=>array_map(fn($r)=>['category'=>$r['category'],'quantity'=>(int)$r['quantity']],$mix)]);
            break;

        case 'locations.php':
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $staffId = requireStaffMutation();
                $name = inputString($body, 'name');
                $address = inputString($body, 'address');
                $city = inputString($body, 'city');
                $province = inputString($body, 'province');
                $detail = inputString($body, 'detail');
                $phone = inputString($body, 'contactPhone');
                $latitude = filter_var($body['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
                $longitude = filter_var($body['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
                if ($name === '' || $address === '' || $city === '' || $province === '' || $latitude === false || $longitude === false) fail('Name, address, city, province, latitude, and longitude are required.');
                if (strlen($name) > 150 || strlen($address) > 255 || strlen($city) > 100 || strlen($province) > 100 || strlen($phone) > 30 || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) fail('Check the drop-off location details and coordinates.');
                $stmt = $pdo->prepare("INSERT INTO locations (location_name,address,city,province,latitude,longitude,location_type,status,detail,contact_phone) VALUES (?,?,?,?,?,?,'donation_center','active',?,?)");
                $stmt->execute([$name,$address,$city,$province,$latitude,$longitude,$detail ?: null,$phone ?: null]);
                $locationId = (int)$pdo->lastInsertId();
                $pdo->prepare("INSERT INTO activity_log (staff_id,action,description,module,reference_id) VALUES (?,'Added Drop-off Location',?,'Logistics',?)")->execute([$staffId,$name.' was added as a donation drop-off location.',$locationId]);
                ok(['created'=>true,'location'=>['id'=>(string)$locationId,'kind'=>'donation_center','name'=>$name,'address'=>$address,'city'=>$city,'province'=>$province,'coordinates'=>[(float)$latitude,(float)$longitude],'status'=>'active','detail'=>$detail ?: 'Donation drop-off center.','contactPhone'=>$phone ?: null,'volunteersNeeded'=>0,'operationIds'=>[]]]);
            }
            $rows = $pdo->query("SELECT l.*, COALESCE((SELECT SUM(GREATEST(s.required_volunteers - (SELECT COUNT(*) FROM signups g WHERE g.shift_id=s.shift_id AND g.signup_status IN ('pending','approved')), 0)) FROM shifts s WHERE s.location_id=l.location_id AND s.status IN ('open','full')),0) volunteers_needed, (SELECT GROUP_CONCAT(ol.operation_id ORDER BY ol.operation_id) FROM operation_locations ol WHERE ol.location_id=l.location_id) operation_ids FROM locations l WHERE l.status='active' AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL")->fetchAll(); ok(array_map('publicLocation', $rows));
            break;

        case 'alerts.php':
            requireStaff();
            $rows = $pdo->query("SELECT alert_id, alert_type, title, message, priority, is_read, DATE_FORMAT(created_at,'%b %e, %Y') time FROM alerts ORDER BY FIELD(priority,'critical','high','medium','low'), created_at DESC")->fetchAll(); ok(array_map(fn($r) => ['id'=>(string)$r['alert_id'],'type'=>$r['alert_type'],'title'=>$r['title'],'message'=>$r['message'],'priority'=>$r['priority'],'isRead'=>(bool)$r['is_read'],'time'=>$r['time']], $rows));
            break;

        case 'activity_log.php':
            requireStaff();
            $rows = $pdo->query("SELECT a.activity_id,a.action,a.description,a.module,COALESCE(s.full_name,'') staff,DATE_FORMAT(a.created_at,'%b %e, %Y %l:%i %p') time FROM activity_log a LEFT JOIN staff_users s ON s.staff_id=a.staff_id ORDER BY a.created_at DESC LIMIT 100")->fetchAll(); ok(array_map(fn($r) => ['id'=>(string)$r['activity_id'],'action'=>$r['action'],'description'=>$r['description'],'module'=>$r['module'],'staff'=>$r['staff'],'time'=>$r['time']], $rows));
            break;

        case 'inventory.php':
            requireStaff();
            $rows = $pdo->query("SELECT i.*,l.location_name FROM inventory i LEFT JOIN locations l ON l.location_id=i.location_id ORDER BY FIELD(i.status,'out_of_stock','low_stock','available'), i.item_name")->fetchAll(); ok(array_map(fn($r) => ['id'=>(string)$r['inventory_id'],'itemName'=>$r['item_name'],'category'=>$r['category'] ?? '','location'=>$r['location_name'] ?? '','quantity'=>(int)$r['quantity'],'unit'=>$r['unit'],'minimumStock'=>(int)$r['minimum_stock'],'status'=>$r['status']], $rows));
            break;

        case 'shipments.php':
            $rows = $pdo->query("SELECT sh.shipment_id, sh.shipment_reference, sh.item_description, sh.quantity, sh.status, sh.dispatched_at, sh.delivered_at, sh.current_latitude, sh.current_longitude, sh.gps_updated_at, COALESCE(src.location_name,'—') origin_name, COALESCE(dst.location_name,'—') destination_name, dst.latitude, dst.longitude, COALESCE(v.vehicle_name,'Unassigned') vehicle_name, COALESCE(v.plate_number,'') plate_number, d.donation_id linked_donation_id FROM shipments sh LEFT JOIN locations src ON src.location_id = sh.source_location_id LEFT JOIN locations dst ON dst.location_id = sh.destination_location_id LEFT JOIN vehicles v ON v.vehicle_id = sh.vehicle_id LEFT JOIN donations d ON d.donation_id=sh.donation_id ORDER BY FIELD(sh.status,'in_transit','packed','pending','delivered','cancelled'), sh.created_at DESC")->fetchAll(); ok(array_map(fn($r)=>['id'=>(string)$r['shipment_id'],'reference'=>$r['shipment_reference'],'origin'=>$r['origin_name'],'destination'=>$r['destination_name'],'itemDescription'=>$r['item_description'] ?? '','quantity'=>(int)$r['quantity'],'vehicle'=>$r['vehicle_name'],'plateNumber'=>$r['plate_number'],'status'=>$r['status'],'note'=>($r['status']==='delivered' && $r['delivered_at'] ? 'Delivered '.date('M j, Y g:i A', strtotime($r['delivered_at'])) : ($r['status']==='in_transit' && $r['dispatched_at'] ? 'Dispatched '.date('M j, Y g:i A', strtotime($r['dispatched_at'])) : ($r['status']==='pending' ? 'Awaiting packing' : 'Awaiting dispatch'))),'coordinates'=>$r['current_latitude'] !== null ? [(float)$r['current_latitude'],(float)$r['current_longitude']] : ($r['latitude'] !== null ? [(float)$r['latitude'],(float)$r['longitude']] : null),'locationUpdatedAt'=>$r['gps_updated_at'],'donationReference'=>$r['linked_donation_id'] ? fmtReference((int)$r['linked_donation_id']) : null],$rows));
            break;

        case 'vehicles.php':
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $staffId = requireStaffMutation();
                $name = trim((string)($body['name'] ?? ''));
                $plateNumber = strtoupper(trim((string)($body['plateNumber'] ?? '')));
                $vehicleType = trim((string)($body['vehicleType'] ?? ''));
                $capacity = trim((string)($body['capacity'] ?? ''));
                if ($name === '' || $plateNumber === '') fail('Vehicle name and plate number are required.');
                if (strlen($name) > 100 || strlen($plateNumber) > 30 || strlen($vehicleType) > 100 || strlen($capacity) > 100) fail('One or more vehicle fields are too long.');
                try {
                    $stmt = $pdo->prepare("INSERT INTO vehicles (vehicle_name,plate_number,vehicle_type,capacity,status) VALUES (?,?,?,?,'available')");
                    $stmt->execute([$name, $plateNumber, $vehicleType ?: null, $capacity ?: null]);
                } catch (PDOException $e) {
                    if ($e->getCode() === '23000') fail('A vehicle with that plate number already exists.');
                    throw $e;
                }
                $vehicleId = (int)$pdo->lastInsertId();
                $pdo->prepare("INSERT INTO activity_log (staff_id,action,description,module,reference_id) VALUES (?,'Added Vehicle',?,'Logistics',?)")->execute([$staffId, $name.' ('.$plateNumber.') was added to the fleet.', $vehicleId]);
                ok(['created'=>true,'vehicle'=>['id'=>(string)$vehicleId,'name'=>$name,'plateNumber'=>$plateNumber,'driverName'=>'','hasDriverAccount'=>false,'status'=>'available']]);
            }
            requireStaff();
            $rows = $pdo->query("SELECT vehicle_id, vehicle_name, plate_number, COALESCE(driver_name,'') driver_name, (driver_id IS NOT NULL) has_driver_account, status FROM vehicles ORDER BY FIELD(status,'available','in_use','maintenance','unavailable'), vehicle_name")->fetchAll();
            ok(array_map(fn($r)=>['id'=>(string)$r['vehicle_id'],'name'=>$r['vehicle_name'],'plateNumber'=>$r['plate_number'],'driverName'=>$r['driver_name'],'hasDriverAccount'=>(bool)$r['has_driver_account'],'status'=>$r['status']], $rows));
            break;

        case 'shipment_update_location.php':
            $staffId = !empty($_SESSION['staff_id']) ? requireStaffMutation() : null;
            $driverId = $staffId === null ? requireDriverMutation() : null;
            $shipmentId = (int)($body['shipmentId'] ?? 0);
            $latitude = filter_var($body['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
            $longitude = filter_var($body['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
            if (!$shipmentId || $latitude === false || $longitude === false || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) fail('Valid shipment and GPS coordinates are required.');
            $check = $pdo->prepare('SELECT sh.status,v.driver_id FROM shipments sh LEFT JOIN vehicles v ON v.vehicle_id=sh.vehicle_id WHERE sh.shipment_id=?'); $check->execute([$shipmentId]);
            $gpsShipment = $check->fetch();
            if (!$gpsShipment) fail('Shipment not found.', 404);
            if ($driverId !== null && (int)$gpsShipment['driver_id'] !== $driverId) fail('You can only share location for your assigned shipment.',403);
            if ($gpsShipment['status'] !== 'in_transit') fail('GPS sharing is available for shipments in transit.');
            $stmt = $pdo->prepare('UPDATE shipments SET current_latitude=?, current_longitude=?, gps_updated_at=NOW() WHERE shipment_id=?');
            $stmt->execute([$latitude, $longitude, $shipmentId]);
            ok(['updated' => true]);
            break;

        case 'shipment_create.php':
            $staffId = requireStaffMutation();
            $donationId = parseReference(inputString($body, 'donationReference'));
            $vehicleId = (int)($body['vehicleId'] ?? 0);
            $sourceId = (int)($body['sourceLocationId'] ?? 0);
            $destinationId = (int)($body['destinationLocationId'] ?? 0);
            $note = inputString($body, 'note');
            if (!$donationId || !$vehicleId || !$sourceId || !$destinationId) fail('Choose a donation, pickup site, destination, and vehicle.');
            $donationQuery = $pdo->prepare("SELECT d.*, o.operation_name FROM donations d LEFT JOIN operations o ON o.operation_id=d.operation_id WHERE d.donation_id=?");
            $donationQuery->execute([$donationId]); $donation = $donationQuery->fetch();
            if (!$donation) fail('Donation reference not found.', 404);
            if ($donation['status'] !== 'allocated' || $donation['donation_type'] === 'cash') fail('Only allocated goods donations can be shipped.');
            if (!empty($donation['drop_off_location_id']) && (int)$donation['drop_off_location_id'] !== $sourceId) fail('The shipment pickup site must match the donor’s selected drop-off center.');
            if ($donation['preferred_location_id'] && (int)$donation['preferred_location_id'] !== $destinationId) fail('The shipment destination must match the donor’s selected relief area.');
            $existing = $pdo->prepare("SELECT shipment_id FROM shipments WHERE donation_id=? AND status<>'cancelled'"); $existing->execute([$donationId]);
            if ($existing->fetch()) fail('This donation already has a shipment.');
            $vehicleQuery = $pdo->prepare("SELECT vehicle_name, plate_number, driver_name, driver_id FROM vehicles WHERE vehicle_id=? AND status='available'");
            $vehicleQuery->execute([$vehicleId]); $vehicle = $vehicleQuery->fetch();
            if (!$vehicle) fail('Choose a vehicle that is currently available.');
            if (empty($vehicle['driver_id'])) fail('Assign a driver account to this vehicle before preparing its shipment.');
            $siteQuery = $pdo->prepare("SELECT location_id, location_name, latitude, longitude FROM locations WHERE location_id IN (?,?) AND status='active'");
            $siteQuery->execute([$sourceId, $destinationId]); $sites = $siteQuery->fetchAll();
            if (count($sites) !== 2) fail('Choose active pickup and destination sites.');
            $siteById = []; foreach ($sites as $site) $siteById[(int)$site['location_id']] = $site;
            $itemsQuery = $pdo->prepare('SELECT item_name, quantity, unit FROM donation_items WHERE donation_id=? ORDER BY donation_item_id');
            $itemsQuery->execute([$donationId]); $items = $itemsQuery->fetchAll();
            if (!$items) fail('This donation has no goods to ship.');
            $itemDescription = implode(', ', array_map(fn($item)=>$item['quantity'].' '.$item['unit'].' '.$item['item_name'], $items));
            $quantity = array_sum(array_map(fn($item)=>(int)$item['quantity'], $items));
            $pdo->beginTransaction();
            try {
                $lockedDonation = $pdo->prepare('SELECT drop_off_location_id FROM donations WHERE donation_id=? FOR UPDATE');
                $lockedDonation->execute([$donationId]);
                $lockedDropOffId = (int)$lockedDonation->fetchColumn();
                if ($lockedDropOffId && $lockedDropOffId !== $sourceId) fail('The shipment pickup site must match the donor’s selected drop-off center.');
                if (!$lockedDropOffId) {
                    $pdo->prepare('UPDATE donations SET drop_off_location_id=? WHERE donation_id=?')->execute([$sourceId,$donationId]);
                    $pdo->prepare("INSERT INTO donation_updates (donation_id,status,message,location,updated_by) VALUES (?,'allocated',?,?,?)")->execute([$donationId,'Pickup site set while preparing the shipment.',$siteById[$sourceId]['location_name'],$staffId]);
                }
                $sequenceQuery = $pdo->prepare('SELECT COUNT(*)+1 FROM shipments WHERE donation_id=?'); $sequenceQuery->execute([$donationId]);
                $shipmentReference = 'SHIP-'.date('Y').'-'.str_pad((string)$donationId,6,'0',STR_PAD_LEFT).'-'.str_pad((string)$sequenceQuery->fetchColumn(),2,'0',STR_PAD_LEFT);
                $stmt = $pdo->prepare("INSERT INTO shipments (operation_id,vehicle_id,driver_id,donation_id,source_location_id,destination_location_id,shipment_reference,item_description,quantity,status,notes) VALUES (?,?,?,?,?,?,?,?,?,'pending',?)");
                $stmt->execute([$donation['operation_id'], $vehicleId, (int)$vehicle['driver_id'], $donationId, $sourceId, $destinationId, $shipmentReference, $itemDescription, $quantity, $note ?: 'Prepared for packing.']);
                $shipmentId = (int)$pdo->lastInsertId();
                $pdo->prepare("UPDATE vehicles SET status='in_use' WHERE vehicle_id=?")->execute([$vehicleId]);
                $pdo->prepare("INSERT INTO activity_log (staff_id,action,description,module,reference_id) VALUES (?,'Prepared Shipment',?,'Shipments',?)")->execute([$staffId, 'Shipment prepared for donation '.fmtReference($donationId).'.', $shipmentId]);
                $pdo->commit();
            } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
            $destination = $siteById[$destinationId];
            ok(['id'=>(string)$shipmentId,'reference'=>$shipmentReference,'origin'=>$siteById[$sourceId]['location_name'],'destination'=>$destination['location_name'],'itemDescription'=>$itemDescription,'quantity'=>$quantity,'vehicle'=>$vehicle['vehicle_name'],'plateNumber'=>$vehicle['plate_number'],'status'=>'pending','note'=>$note ?: 'Prepared for packing.','coordinates'=>$destination['latitude'] !== null ? [(float)$destination['latitude'],(float)$destination['longitude']] : null,'locationUpdatedAt'=>null,'donationReference'=>fmtReference($donationId)]);
            break;

        case 'shipment_update_status.php':
            $staffId = !empty($_SESSION['staff_id']) ? requireStaffMutation() : null;
            $driverId = $staffId === null ? requireDriverMutation() : null;
            $shipmentId = (int)($body['shipmentId'] ?? 0);
            $nextStatus = inputString($body, 'status');
            $note = inputString($body, 'note');
            $shipmentQuery = $pdo->prepare('SELECT * FROM shipments WHERE shipment_id=?'); $shipmentQuery->execute([$shipmentId]);
            $shipment = $shipmentQuery->fetch();
            if (!$shipment) fail('Shipment not found.', 404);
            if ($driverId !== null) {
                $owner = $pdo->prepare('SELECT driver_id FROM vehicles WHERE vehicle_id=?'); $owner->execute([$shipment['vehicle_id']]);
                if ((int)$owner->fetchColumn() !== $driverId) fail('You can only update your assigned shipment.',403);
                if (!in_array($nextStatus,['in_transit','delivered'],true)) fail('Drivers can dispatch packed shipments or confirm delivery.',403);
            }
            $transitions = ['pending'=>['packed','cancelled'],'packed'=>['in_transit','cancelled'],'in_transit'=>['delivered'],'delivered'=>[],'cancelled'=>[]];
            if (!in_array($nextStatus, $transitions[$shipment['status']] ?? [], true)) fail('This shipment status change is not allowed.');
            $donationId = (int)($shipment['donation_id'] ?? 0);
            $pdo->beginTransaction();
            try {
                if ($nextStatus === 'in_transit' && $donationId) {
                    $itemsQuery = $pdo->prepare('SELECT item_name,category,quantity,unit FROM donation_items WHERE donation_id=?'); $itemsQuery->execute([$donationId]);
                    foreach ($itemsQuery->fetchAll() as $item) {
                        $stockQuery = $pdo->prepare('SELECT inventory_id,quantity,minimum_stock FROM inventory WHERE location_id=? AND item_name=? AND COALESCE(category,\'\')=? AND COALESCE(unit,\'pcs\')=? ORDER BY inventory_id LIMIT 1');
                        $stockQuery->execute([$shipment['source_location_id'], $item['item_name'], $item['category'] ?? '', $item['unit'] ?? 'pcs']);
                        $stock = $stockQuery->fetch();
                        if (!$stock || (int)$stock['quantity'] < (int)$item['quantity']) fail('There is not enough verified stock at the pickup site to dispatch this shipment.');
                        $remaining = (int)$stock['quantity'] - (int)$item['quantity'];
                        $stockStatus = $remaining <= 0 ? 'out_of_stock' : ($remaining < (int)$stock['minimum_stock'] ? 'low_stock' : 'available');
                        $pdo->prepare('UPDATE inventory SET quantity=?,status=? WHERE inventory_id=?')->execute([$remaining,$stockStatus,$stock['inventory_id']]);
                    }
                }
                $pdo->prepare("UPDATE shipments SET status=?, notes=COALESCE(NULLIF(?,''),notes), dispatched_at=IF(?='in_transit',NOW(),dispatched_at), delivered_at=IF(?='delivered',NOW(),delivered_at) WHERE shipment_id=?")->execute([$nextStatus,$note,$nextStatus,$nextStatus,$shipmentId]);
                if ($donationId && in_array($nextStatus,['in_transit','delivered','cancelled'],true)) {
                    $destinationId = (int)($nextStatus === 'in_transit' ? $shipment['source_location_id'] : ($nextStatus === 'cancelled' ? $shipment['source_location_id'] : $shipment['destination_location_id']));
                    $siteQuery = $pdo->prepare('SELECT location_name FROM locations WHERE location_id=?'); $siteQuery->execute([$destinationId]); $siteName = (string)$siteQuery->fetchColumn();
                    if ($nextStatus === 'in_transit' || $nextStatus === 'delivered') {
                        $donationStage = $nextStatus === 'in_transit' ? 'in_transit' : 'distributed';
                        $pdo->prepare('UPDATE donations SET status=? WHERE donation_id=?')->execute([$donationStage,$donationId]);
                        $message = $nextStatus === 'in_transit' ? $shipment['shipment_reference'].' departed the hub.' : $shipment['shipment_reference'].' was delivered successfully.';
                        $pdo->prepare('INSERT INTO donation_updates (donation_id,status,message,location,updated_by) VALUES (?,?,?,?,?)')->execute([$donationId,$donationStage,$message,$siteName,$staffId]);
                    } else {
                        $pdo->prepare('INSERT INTO donation_updates (donation_id,status,message,location,updated_by) VALUES (?,\'allocated\',?,?,?)')->execute([$donationId,$shipment['shipment_reference'].' was cancelled before dispatch. The donation remains allocated.',$siteName,$staffId]);
                    }
                    if ($nextStatus === 'delivered') {
                        $itemsQuery = $pdo->prepare('SELECT item_name,category,quantity FROM donation_items WHERE donation_id=?'); $itemsQuery->execute([$donationId]);
                        foreach ($itemsQuery->fetchAll() as $item) {
                            $needQuery = $pdo->prepare("UPDATE needed_items SET status=CASE WHEN quantity_received+? >= quantity_needed THEN 'fulfilled' WHEN quantity_received+? > 0 THEN 'partially_fulfilled' ELSE 'needed' END, quantity_received=LEAST(quantity_needed,quantity_received+?) WHERE location_id=? AND item_name=? AND COALESCE(category,'')=?");
                            $needQuery->execute([(int)$item['quantity'],(int)$item['quantity'],(int)$item['quantity'],$shipment['destination_location_id'],$item['item_name'],$item['category'] ?? '']);
                        }
                    }
                }
                if ($nextStatus === 'delivered' || $nextStatus === 'cancelled') $pdo->prepare("UPDATE vehicles SET status='available' WHERE vehicle_id=?")->execute([$shipment['vehicle_id']]);
                $pdo->prepare('INSERT INTO activity_log (staff_id,action,description,module,reference_id) VALUES (?,?,?,?,?)')->execute([$staffId,'Shipment '.ucfirst(str_replace('_',' ',$nextStatus)),$shipment['shipment_reference'].' marked '.$nextStatus.'.','Shipments',$shipmentId]);
                $pdo->commit();
            } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
            ok(['updated'=>true,'status'=>$nextStatus]);
            break;

        case 'needed_items.php':
            $rows = $pdo->query("SELECT n.*,l.location_name FROM needed_items n LEFT JOIN locations l ON l.location_id=n.location_id ORDER BY FIELD(n.priority,'critical','high','medium','low')")->fetchAll(); ok(array_map(fn($r) => ['id'=>(string)$r['needed_item_id'],'itemName'=>$r['item_name'],'category'=>$r['category'] ?? '','location'=>$r['location_name'] ?? '','quantityNeeded'=>(int)$r['quantity_needed'],'quantityReceived'=>(int)$r['quantity_received'],'priority'=>$r['priority'],'status'=>$r['status']], $rows));
            break;

        case 'skills.php':
            $rows = $pdo->query('SELECT skill_id,skill_name,description FROM skills ORDER BY skill_name')->fetchAll(); ok(array_map(fn($r) => ['id'=>(string)$r['skill_id'],'name'=>$r['skill_name'],'description'=>$r['description'] ?? ''], $rows));
            break;

        case 'shifts.php':
            $rows = $pdo->query("SELECT s.*,l.location_name,l.city,l.latitude,l.longitude,(SELECT COUNT(*) FROM signups g WHERE g.shift_id=s.shift_id AND g.signup_status IN ('pending','approved')) filled,(SELECT COUNT(*) FROM signups g WHERE g.shift_id=s.shift_id AND g.signup_status='approved') approved FROM shifts s LEFT JOIN locations l ON l.location_id=s.location_id ORDER BY s.shift_date,s.start_time")->fetchAll();
            foreach ($rows as &$row) { $skillQuery = $pdo->prepare('SELECT sk.skill_name FROM shift_skills ss JOIN skills sk ON sk.skill_id=ss.skill_id WHERE ss.shift_id=? ORDER BY sk.skill_name'); $skillQuery->execute([(int)$row['shift_id']]); $row['required_skills'] = array_column($skillQuery->fetchAll(), 'skill_name'); }
            unset($row);
            ok(array_map(fn($r) => ['id'=>(string)$r['shift_id'],'name'=>$r['shift_name'],'location'=>$r['location_name'] ?? '','city'=>$r['city'] ?? 'Caloocan','date'=>date('D, M j',strtotime($r['shift_date'])),'window'=>date('g:i A',strtotime($r['start_time'])).' - '.date('g:i A',strtotime($r['end_time'])),'filled'=>(int)$r['filled'],'approved'=>(int)$r['approved'],'needed'=>(int)$r['required_volunteers'],'status'=>$r['status'],'coordinates'=>$r['latitude'] !== null ? [(float)$r['latitude'],(float)$r['longitude']] : null,'requiredSkills'=>$r['required_skills']], $rows));
            break;

        case 'volunteers.php':
            requireStaff();
            $rows = $pdo->query("SELECT v.*,GROUP_CONCAT(sk.skill_name SEPARATOR ', ') skills,(SELECT COUNT(*) FROM signups g WHERE g.volunteer_id=v.volunteer_id AND g.signup_status='completed') completed FROM volunteers v LEFT JOIN volunteer_skills vs ON vs.volunteer_id=v.volunteer_id LEFT JOIN skills sk ON sk.skill_id=vs.skill_id GROUP BY v.volunteer_id ORDER BY v.full_name")->fetchAll(); ok(array_map(fn($r) => ['id'=>(string)$r['volunteer_id'],'fullName'=>$r['full_name'],'email'=>$r['email'],'phone'=>$r['phone'] ?? '','address'=>$r['address'] ?? '', 'status'=>$r['status'],'skills'=>$r['skills'] ? explode(', ', $r['skills']) : [],'shiftsCompleted'=>(int)$r['completed'],'emergencyContact'=>$r['emergency_contact'] ?? '','emergencyPhone'=>$r['emergency_phone'] ?? '','drivingLicenseNumber'=>$r['driving_license_number'] ?? '','drivingLicenseType'=>$r['driving_license_type'] ?? '','firstAidQualification'=>$r['first_aid_qualification'] ?? '','verificationStatus'=>$r['verification_status'] ?? 'unverified','verificationPhoto'=>$r['verification_photo'] ?? null,'verificationSubmittedAt'=>$r['verification_submitted_at'] ?? null,'verificationNotes'=>$r['verification_notes'] ?? null], $rows));
            break;

        case 'donations.php':
            requireStaff();
            $rows = $pdo->query("SELECT d.donation_id, d.donor_name, d.donor_email, d.donor_phone, d.donation_type, d.amount, d.status, d.donated_at, d.donor_preference, d.payment_proof, d.preferred_location_id, d.drop_off_location_id, l.location_name, dl.location_name drop_off_name, DATE_FORMAT(d.donated_at,'%b %e, %Y') time, (SELECT COUNT(*) FROM donation_items di WHERE di.donation_id=d.donation_id) item_count, (SELECT GROUP_CONCAT(CONCAT(di.item_name, ' × ', di.quantity, ' ', COALESCE(di.unit,'pcs')) ORDER BY di.donation_item_id SEPARATOR ', ') FROM donation_items di WHERE di.donation_id=d.donation_id) item_summary, (SELECT du.location FROM donation_updates du WHERE du.donation_id=d.donation_id AND du.location IS NOT NULL AND du.location<>'' ORDER BY du.created_at DESC, du.update_id DESC LIMIT 1) last_checkpoint, (SELECT sh.shipment_reference FROM shipments sh WHERE sh.donation_id=d.donation_id ORDER BY sh.shipment_id DESC LIMIT 1) shipment_reference, (SELECT sh.status FROM shipments sh WHERE sh.donation_id=d.donation_id ORDER BY sh.shipment_id DESC LIMIT 1) shipment_status FROM donations d LEFT JOIN locations l ON l.location_id=d.preferred_location_id LEFT JOIN locations dl ON dl.location_id=d.drop_off_location_id ORDER BY d.donated_at DESC")->fetchAll();
            ok(array_map(fn($r) => ['id'=>fmtReference((int)$r['donation_id']),'donorEmail'=>$r['donor_email'] ?? '','donor'=>$r['donor_name'],'type'=>$r['donation_type'],'amount'=>fmtAmount($r['donation_type'],(float)$r['amount'],(int)$r['item_count']),'destination'=>$r['location_name'] ?? 'Caloocan Distribution Hub','destinationLocationId'=>$r['preferred_location_id'] !== null ? (string)$r['preferred_location_id'] : null,'dropOffLocation'=>$r['drop_off_name'] ?? null,'dropOffLocationId'=>$r['drop_off_location_id'] !== null ? (string)$r['drop_off_location_id'] : null,'itemSummary'=>$r['item_summary'] ?? '','donorPreference'=>$r['donor_preference'] ?? '','paymentProof'=>$r['payment_proof'] ?? null,'lastCheckpoint'=>$r['last_checkpoint'],'shipmentReference'=>$r['shipment_reference'],'shipmentStatus'=>$r['shipment_status'],'status'=>$r['status'],'time'=>$r['time']], $rows));
            break;

        case 'donation_create.php':
            $donorName = inputString($body, 'donorName');
            $donorEmail = strtolower(inputString($body, 'donorEmail'));
            $donorPhone = inputString($body, 'donorPhone');
            $donationType = inputString($body, 'donationType') ?: 'goods';
            $amount = (float)($body['amount'] ?? 0);
            $operationId = (int)($body['operationId'] ?? 0);
            $preferredLocationId = isset($body['preferredLocationId']) && $body['preferredLocationId'] ? (int)$body['preferredLocationId'] : null;
            $dropOffLocationId = isset($body['dropOffLocationId']) && $body['dropOffLocationId'] ? (int)$body['dropOffLocationId'] : null;
            $donorPreference = inputString($body, 'donorPreference');
            $items = $body['items'] ?? [];
            if (!$donorName || !filter_var($donorEmail, FILTER_VALIDATE_EMAIL) || !in_array($donationType, ['cash','goods','mixed'])) fail('Enter your name and a valid email address, then choose a donation type.');
            if (!$preferredLocationId) fail('Choose the relief area this donation should support.');
            if (in_array($donationType, ['cash','mixed'], true) && $amount < 1) fail('Enter a donation amount greater than zero.');
            if (in_array($donationType, ['goods','mixed'], true) && (!$dropOffLocationId || !is_array($items) || count($items) === 0)) fail('Choose a drop-off center and at least one item.');
            $decodedPaymentProof = null;
            if (!empty($body['paymentProof'])) {
                if ($donationType !== 'cash') fail('Payment receipt photos are only accepted for cash donations.');
                $decodedPaymentProof = decodeImagePayload($body['paymentProof']);
                if ($decodedPaymentProof === false) fail('Invalid receipt image. Choose a valid JPEG, PNG, or WebP image smaller than 5 MB.');
            }
            if ($dropOffLocationId) {
                $checkSite = $pdo->prepare("SELECT location_id FROM locations WHERE location_id=? AND status='active' AND location_type IN ('donation_center','warehouse')");
                $checkSite->execute([$dropOffLocationId]);
                if (!$checkSite->fetchColumn()) fail('Choose an active donation center or warehouse for drop-off.');
            }
            $checkDestination = $pdo->prepare("SELECT location_id FROM locations WHERE location_id=? AND status='active'");
            $checkDestination->execute([$preferredLocationId]);
            if (!$checkDestination->fetchColumn()) fail('Choose an active relief destination.');
            $pdo->beginTransaction();
            $paymentProofPath = null;
            try {
                $stmt = $pdo->prepare("INSERT INTO donations (donor_name, donor_email, donor_phone, donation_type, amount, operation_id, preferred_location_id, drop_off_location_id, donor_preference, status, donated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pledged', NOW())");
                $stmt->execute([$donorName, $donorEmail, $donorPhone, $donationType, $amount, $operationId ?: null, $preferredLocationId, $dropOffLocationId, $donorPreference]);
                $donationId = (int) $pdo->lastInsertId();
                if ($decodedPaymentProof !== null) {
                    $uploadDir = __DIR__ . '/uploads/payment_proofs';
                    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
                    $filename = 'payment_' . $donationId . '_' . time() . '.' . $decodedPaymentProof['extension'];
                    $paymentProofPath = $uploadDir . '/' . $filename;
                    if (file_put_contents($paymentProofPath, $decodedPaymentProof['data']) === false) fail('Could not save the payment receipt photo.', 500);
                    $pdo->prepare('UPDATE donations SET payment_proof = ? WHERE donation_id = ?')->execute([$filename, $donationId]);
                }
                if ($donationType === 'goods' || $donationType === 'mixed') {
                    foreach ($items as $item) {
                        $itemName = inputString($item, 'name');
                        $quantity = (int)($item['quantity'] ?? 1);
                        if ($itemName === '' || $quantity < 1) fail('Each donated item needs a name and a quantity of at least one.');
                        $stmt = $pdo->prepare("INSERT INTO donation_items (donation_id, item_name, category, quantity, unit, condition_status) VALUES (?, ?, ?, ?, ?, 'new')");
                        $stmt->execute([$donationId, $itemName, inputString($item, 'category'), $quantity, inputString($item, 'unit') ?: 'pcs']);
                    }
                }
                $stmt = $pdo->prepare("INSERT INTO donation_updates (donation_id, status, message) VALUES (?, 'pledged', 'Donation was registered in the system.')");
                $stmt->execute([$donationId]);
                $stmt = $pdo->prepare("INSERT INTO activity_log (action, description, module, reference_id) VALUES ('Pledged Donation', ?, 'Donations', ?)");
                $stmt->execute(["{$donorName} created donation " . fmtReference($donationId) . ".", $donationId]);
                $pdo->commit();
                ok(['reference' => fmtReference($donationId), 'donationId' => (string)$donationId]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                if ($paymentProofPath && is_file($paymentProofPath)) unlink($paymentProofPath);
                fail('Could not record donation: ' . $e->getMessage(), 500);
            }
            break;

        case 'donation_track.php':
            $reference = inputString($_GET, 'reference');
            $email = strtolower(inputString($_GET, 'email'));
            if (!$reference || !$email) fail('Donation reference and donor email are required.', 400);
            $requestIp = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
            enforceRateLimit($pdo, 'donation_track.php', $email . '|' . $requestIp, 10, 15);
            $donationId = parseReference($reference);
            $stmt = $pdo->prepare("SELECT d.*, o.operation_name, l.location_name, l.city, dl.location_name drop_off_name FROM donations d LEFT JOIN operations o ON o.operation_id = d.operation_id LEFT JOIN locations l ON l.location_id = d.preferred_location_id LEFT JOIN locations dl ON dl.location_id=d.drop_off_location_id WHERE d.donation_id = ? AND LOWER(d.donor_email) = ?");
            $stmt->execute([$donationId, $email]);
            $row = $stmt->fetch();
            if (!$row) fail('Donation reference not found.', 404);
            $items = fetchDonationItems($pdo, $donationId);
            $updates = fetchDonationUpdates($pdo, $donationId);
            ok(buildTrackedDonation($row, $items, $updates, fetchDonationShipment($pdo, $donationId)));
            break;

        case 'donation_list.php':
            $email = strtolower(inputString($_GET, 'email'));
            $reference = inputString($_GET, 'reference');
            if (!$email || !$reference) fail('Donation reference and donor email are required.', 400);
            $requestIp = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
            enforceRateLimit($pdo, 'donation_list.php', $email . '|' . $requestIp, 10, 15);
            $donationId = parseReference($reference);
            $stmt = $pdo->prepare("SELECT d.*, o.operation_name, l.location_name, l.city, dl.location_name drop_off_name FROM donations d LEFT JOIN operations o ON o.operation_id = d.operation_id LEFT JOIN locations l ON l.location_id = d.preferred_location_id LEFT JOIN locations dl ON dl.location_id=d.drop_off_location_id WHERE d.donation_id = ? AND LOWER(d.donor_email) = ?");
            $stmt->execute([$donationId, $email]);
            $rows = $stmt->fetchAll();
            $result = array_map(function ($row) use ($pdo) {
                $donationId = (int)$row['donation_id'];
                $items = fetchDonationItems($pdo, $donationId);
                return buildTrackedDonation($row, $items, fetchDonationUpdates($pdo, $donationId), fetchDonationShipment($pdo, $donationId));
            }, $rows);
            ok($result);
            break;

        case 'admin_donations_delete.php':
            requireStaffMutation();
            $ref = inputString($body, 'id');
            $donationId = parseReference($ref);
            $exists = $pdo->prepare("SELECT donation_id FROM donations WHERE donation_id = ?");
            $exists->execute([$donationId]);
            if (!$exists->fetch()) fail('Donation reference not found.');
            $shipmentCheck = $pdo->prepare('SELECT COUNT(*) FROM shipments WHERE donation_id = ?');
            $shipmentCheck->execute([$donationId]);
            if ((int)$shipmentCheck->fetchColumn() > 0) fail('This donation is linked to a shipment and cannot be deleted.');
            $pdo->prepare("DELETE FROM donations WHERE donation_id = ?")->execute([$donationId]);
            $stmt = $pdo->prepare("INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES (?, 'Deleted Donation', ?, 'Donations', ?)");
            $stmt->execute([$_SESSION['staff_id'], "Donation " . fmtReference($donationId) . " was removed from the donation ledger.", $donationId]);
            ok(['deleted' => true]);
            break;

        case 'donation_update_stage.php':
            $staffId = requireStaffMutation();
            $ref = inputString($body, 'reference');
            $donationId = parseReference($ref);
            $stage = inputString($body, 'stage');
            $message = inputString($body, 'message');
            $location = inputString($body, 'location');
            if (!in_array($stage, ['received','verified','allocated','distributed'], true)) fail('Choose a valid intake, allocation, or completion stage.');
            $stmt = $pdo->prepare('SELECT status, donation_type, drop_off_location_id FROM donations WHERE donation_id=?'); $stmt->execute([$donationId]);
            $donationState = $stmt->fetch();
            if (!$donationState) fail('Donation reference not found.', 404);
            $current = $donationState['status'];
            $nextStage = ['pledged'=>'received','received'=>'verified','verified'=>'allocated'][$current] ?? ($current === 'allocated' && $donationState['donation_type'] === 'cash' ? 'distributed' : null);
            if ($nextStage !== $stage) fail('Donation progress must follow intake and allocation. Goods donations move to transit through a linked shipment.');
            $pdo->beginTransaction();
            $pdo->prepare('UPDATE donations SET status=? WHERE donation_id=?')->execute([$stage, $donationId]);
            $pdo->prepare('INSERT INTO donation_updates (donation_id,status,message,location,updated_by) VALUES (?,?,?,?,?)')->execute([$donationId, $stage, $message, $location ?: null, $staffId]);
            if ($stage === 'verified' && $donationState['donation_type'] !== 'cash') {
                $itemsQuery = $pdo->prepare('SELECT item_name,category,quantity,unit FROM donation_items WHERE donation_id=?'); $itemsQuery->execute([$donationId]);
                foreach ($itemsQuery->fetchAll() as $item) {
                    $stockQuery = $pdo->prepare("SELECT inventory_id,quantity,minimum_stock FROM inventory WHERE location_id=? AND item_name=? AND COALESCE(category,'')=? AND COALESCE(unit,'pcs')=? ORDER BY inventory_id LIMIT 1");
                    $stockQuery->execute([$donationState['drop_off_location_id'],$item['item_name'],$item['category'] ?? '',$item['unit'] ?? 'pcs']);
                    $stock = $stockQuery->fetch();
                    if ($stock) {
                        $quantity = (int)$stock['quantity'] + (int)$item['quantity'];
                        $stockStatus = $quantity <= 0 ? 'out_of_stock' : ($quantity < (int)$stock['minimum_stock'] ? 'low_stock' : 'available');
                        $pdo->prepare('UPDATE inventory SET quantity=?,status=? WHERE inventory_id=?')->execute([$quantity,$stockStatus,$stock['inventory_id']]);
                    } else {
                        $pdo->prepare("INSERT INTO inventory (location_id,item_name,category,quantity,unit,minimum_stock,status) VALUES (?,?,?,?,?,0,'available')")->execute([$donationState['drop_off_location_id'],$item['item_name'],$item['category'] ?? '',$item['quantity'],$item['unit'] ?? 'pcs']);
                    }
                }
            }
            $pdo->prepare("INSERT INTO activity_log (staff_id,action,description,module,reference_id) VALUES (?,?,?,?,?)")->execute([$staffId, 'Updated Donation', 'Updated donation checkpoint to ' . $stage, 'Donations', $donationId]);
            $pdo->commit();
            $stmt = $pdo->prepare("SELECT d.*, o.operation_name, l.location_name, l.city, dl.location_name drop_off_name FROM donations d LEFT JOIN operations o ON o.operation_id = d.operation_id LEFT JOIN locations l ON l.location_id = d.preferred_location_id LEFT JOIN locations dl ON dl.location_id=d.drop_off_location_id WHERE d.donation_id = ?");
            $stmt->execute([$donationId]);
            $row = $stmt->fetch();
            $items = fetchDonationItems($pdo, $donationId);
            $updates = fetchDonationUpdates($pdo, $donationId);
            ok(buildTrackedDonation($row, $items, $updates, fetchDonationShipment($pdo, $donationId)));
            break;

        case 'auth_request_code.php':
            $email = strtolower(inputString($body, 'email'));
            if (!$email) fail('Enter an email address.');
            $requestIp = substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
            $rateLimit = $pdo->prepare('SELECT COUNT(*) FROM login_codes WHERE email = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)');
            $rateLimit->execute([$email]);
            if ((int)$rateLimit->fetchColumn() >= 5) fail('Too many code requests. Try again in 15 minutes.', 429);
            if ($requestIp !== '') {
                $ipLimit = $pdo->prepare('SELECT COUNT(*) FROM login_codes WHERE request_ip = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)');
                $ipLimit->execute([$requestIp]);
                if ((int)$ipLimit->fetchColumn() >= 20) fail('Too many code requests from this network. Try again later.', 429);
            }
            $stmt = $pdo->prepare("SELECT volunteer_id FROM volunteers WHERE email = ? AND status NOT IN ('inactive','suspended') LIMIT 1");
            $stmt->execute([$email]);
            $volunteer = $stmt->fetch();
            if (!$volunteer) fail('No volunteer is registered with that email.', 404);
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $pdo->prepare('UPDATE login_codes SET used = TRUE WHERE email = ? AND used = FALSE')->execute([$email]);
            $stmt = $pdo->prepare("INSERT INTO login_codes (volunteer_id, email, code, expires_at, used, failed_attempts, request_ip) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), FALSE, 0, ?)");
            $stmt->execute([(int)$volunteer['volunteer_id'], $email, password_hash($code, PASSWORD_DEFAULT), $requestIp ?: null]);
            $debugCode = getenv('RELIEF_ALLOW_DEBUG_CODES') === '1';
            $mailFrom = getenv('RELIEF_MAIL_FROM') ?: getenv('MAIL_FROM');
            $mailSent = $mailFrom && function_exists('mail') && mail($email, 'ReliefTrack verification code', "Your ReliefTrack verification code is $code. It expires in 10 minutes.", 'From: ' . $mailFrom);
            if ($debugCode) {
                ok(['sent' => true, 'debugCode' => $code]);
            }
            if (!$mailSent) fail('Email delivery is not configured. Contact the ReliefTrack administrator.', 503);
            ok(['sent' => true]);
            break;

        case 'auth_verify_code.php':
            $email = strtolower(inputString($body, 'email'));
            $code = inputString($body, 'code');
            if (!$email || !preg_match('/^\d{6}$/', $code)) fail('Enter a valid 6-digit verification code.');
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("SELECT code_id, volunteer_id, code, failed_attempts FROM login_codes WHERE email = ? AND used = FALSE AND expires_at > NOW() ORDER BY code_id DESC LIMIT 1 FOR UPDATE");
            $stmt->execute([$email]);
            $loginCode = $stmt->fetch();
            if (!$loginCode) { $pdo->rollBack(); fail('That code is invalid or has expired.'); }
            if ((int)$loginCode['failed_attempts'] >= 5 || !password_verify($code, $loginCode['code'])) {
                $attempts = (int)$loginCode['failed_attempts'] + 1;
                $pdo->prepare('UPDATE login_codes SET failed_attempts = ?, used = ? WHERE code_id = ?')->execute([$attempts, $attempts >= 5, (int)$loginCode['code_id']]);
                $pdo->commit();
                fail('That code is invalid or has expired.');
            }
            $pdo->prepare('UPDATE login_codes SET used = TRUE WHERE code_id = ?')->execute([(int)$loginCode['code_id']]);
            $stmt = $pdo->prepare("SELECT * FROM volunteers WHERE volunteer_id = ?");
            $stmt->execute([(int)$loginCode['volunteer_id']]);
            $volRow = $stmt->fetch();
            if (!$volRow || in_array($volRow['status'], ['inactive','suspended'], true)) { $pdo->rollBack(); fail('This volunteer account is inactive.', 403); }
            session_regenerate_id(true);
            $_SESSION['volunteer_id'] = (int)$volRow['volunteer_id'];
            $_SESSION['volunteer_reauthenticated_at'] = time();
            $pdo->commit();
            $volunteer = mapVolunteer($volRow, $pdo);
            $shifts = getVolunteerShifts($pdo, (int)$volRow['volunteer_id']);
            ok(['volunteer' => $volunteer, 'shifts' => $shifts]);
            break;

        case 'volunteer_session.php':
            $volunteerId = requireVolunteer();
            $stmt = $pdo->prepare("SELECT * FROM volunteers WHERE volunteer_id = ? AND status NOT IN ('inactive','suspended')");
            $stmt->execute([$volunteerId]);
            $volRow = $stmt->fetch();
            if (!$volRow) { $_SESSION = []; session_destroy(); fail('Volunteer session is no longer active.', 401); }
            ok(['volunteer' => mapVolunteer($volRow, $pdo), 'shifts' => getVolunteerShifts($pdo, $volunteerId)]);
            break;

        case 'volunteer_logout.php':
            unset($_SESSION['volunteer_id'], $_SESSION['volunteer_reauthenticated_at']);
            ok(['signedOut' => true]);
            break;

        case 'volunteer_profile_update.php':
            $volunteerId=requireVolunteer();
            $name=trim(inputString($body,'fullName')); $phone=trim(inputString($body,'phone')); $address=trim(inputString($body,'address'));
            $email=strtolower(trim(inputString($body,'email'))); $emergencyContact=trim(inputString($body,'emergencyContact')); $emergencyPhone=trim(inputString($body,'emergencyPhone'));
            $licenseNumber=trim(inputString($body,'drivingLicenseNumber')); $licenseType=trim(inputString($body,'drivingLicenseType')); $firstAid=trim(inputString($body,'firstAidQualification'));
            $skillIds=$body['skillIds'] ?? [];
            if ($name==='' || strlen($name)>150 || !is_array($skillIds)) fail('Enter a valid name and skills.');
            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE volunteers SET full_name=?,phone=?,address=?,emergency_contact=?,emergency_phone=?,driving_license_number=?,driving_license_type=?,first_aid_qualification=? WHERE volunteer_id=? AND status NOT IN ('inactive','suspended')")->execute([$name,$phone ?: null,$address ?: null,$emergencyContact ?: null,$emergencyPhone ?: null,$licenseNumber ?: null,$licenseType ?: null,$firstAid ?: null,$volunteerId]);
                $pdo->prepare('DELETE FROM volunteer_skills WHERE volunteer_id=?')->execute([$volunteerId]);
                $skillStmt=$pdo->prepare('INSERT INTO volunteer_skills (volunteer_id,skill_id,skill_level) SELECT ?,skill_id,\'beginner\' FROM skills WHERE skill_id=?');
                foreach (array_unique(array_map('intval',$skillIds)) as $skillId) if ($skillId>0) $skillStmt->execute([$volunteerId,$skillId]);
                $pdo->commit();
            } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
            $stmt=$pdo->prepare('SELECT * FROM volunteers WHERE volunteer_id=?'); $stmt->execute([$volunteerId]); ok(['volunteer'=>mapVolunteer($stmt->fetch(),$pdo)]);
            break;

        case 'volunteer_account_delete.php':
            $volunteerId=requireVolunteer();
            if (empty($_SESSION['volunteer_reauthenticated_at']) || time()-(int)$_SESSION['volunteer_reauthenticated_at']>300) fail('Confirm your email with a fresh sign-in code before deactivating your account.',403);
            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE volunteers SET status='inactive' WHERE volunteer_id=?")->execute([$volunteerId]);
                $pdo->prepare("UPDATE signups SET signup_status='cancelled' WHERE volunteer_id=? AND signup_status IN ('pending','approved')")->execute([$volunteerId]);
                $pdo->commit();
            } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
            $_SESSION=[]; session_destroy(); ok(['deleted'=>true]);
            break;

        case 'volunteer_register.php':
            $fullName = inputString($body, 'fullName');
            $email = strtolower(inputString($body, 'email'));
            $phone = inputString($body, 'phone');
            $address = inputString($body, 'address');
            $emergencyContact = inputString($body, 'emergencyContact');
            $emergencyPhone = inputString($body, 'emergencyPhone');
            $drivingLicenseNumber = inputString($body, 'drivingLicenseNumber');
            $drivingLicenseType = inputString($body, 'drivingLicenseType');
            $firstAidQualification = inputString($body, 'firstAidQualification');
            $skillIds = $body['skillIds'] ?? [];
            $shiftId = isset($body['shiftId']) && $body['shiftId'] ? (int)$body['shiftId'] : null;
            if (!$fullName || !$email) fail('Full name and email are required.');
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare("SELECT volunteer_id,status FROM volunteers WHERE email = ? LIMIT 1");
                $stmt->execute([$email]);
                $existing = $stmt->fetch();
                if ($existing) {
                    if (in_array($existing['status'], ['inactive','suspended'], true)) fail('This volunteer account is inactive. Contact an administrator for help.');
                    $volunteerId = (int)$existing['volunteer_id'];
                    $pdo->prepare("UPDATE volunteers SET full_name = ?, phone = ?, address = ?, emergency_contact = ?, emergency_phone = ?, driving_license_number = ?, driving_license_type = ?, first_aid_qualification = ? WHERE volunteer_id = ?")->execute([$fullName, $phone, $address, $emergencyContact, $emergencyPhone, $drivingLicenseNumber, $drivingLicenseType, $firstAidQualification, $volunteerId]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO volunteers (full_name, email, phone, address, emergency_contact, emergency_phone, driving_license_number, driving_license_type, first_aid_qualification, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')");
                    $stmt->execute([$fullName, $email, $phone, $address, $emergencyContact, $emergencyPhone, $drivingLicenseNumber, $drivingLicenseType, $firstAidQualification]);
                    $volunteerId = (int) $pdo->lastInsertId();
                }
                // Replace skills
                $pdo->prepare("DELETE FROM volunteer_skills WHERE volunteer_id = ?")->execute([$volunteerId]);
                foreach ($skillIds as $skillId) {
                    $pdo->prepare("INSERT INTO volunteer_skills (volunteer_id, skill_id, skill_level) VALUES (?, ?, 'beginner')")->execute([$volunteerId, (int)$skillId]);
                }
                if ($shiftId) {
                    $pdo->prepare("INSERT INTO signups (volunteer_id, shift_id, signup_status) VALUES (?, ?, 'pending') ON DUPLICATE KEY UPDATE signup_status = 'pending'")->execute([$volunteerId, $shiftId]);
                }
                $pdo->prepare("INSERT INTO activity_log (action, description, module, reference_id) VALUES ('Registered Volunteer', ?, 'Volunteers', ?)")->execute(["{$fullName} registered as a volunteer.", $volunteerId]);
                $pdo->commit();
                $stmt = $pdo->prepare("SELECT * FROM volunteers WHERE volunteer_id = ?");
                $stmt->execute([$volunteerId]);
                $volunteer = mapVolunteer($stmt->fetch(), $pdo);
                $shifts = getVolunteerShifts($pdo, $volunteerId);
                ok(['volunteer' => $volunteer, 'shifts' => $shifts]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                fail('Could not register volunteer: ' . $e->getMessage(), 500);
            }
            break;

        case 'volunteer_shifts.php':
            $volunteerId = requireVolunteer();
            $requestedId = (int)inputString($_GET, 'volunteer_id');
            if ($requestedId && $requestedId !== $volunteerId) fail('You may only view your own shifts.', 403);
            ok(getVolunteerShifts($pdo, $volunteerId));
            break;

        case 'shift_join.php':
            $volunteerIdRaw = inputString($body, 'volunteerId');
            $shiftId = (int)inputString($body, 'shiftId');
            $volunteerId = requireVolunteer();
            if (parseReference($volunteerIdRaw) !== $volunteerId) fail('You may only join shifts for your own account.', 403);
            if (!$volunteerId || !$shiftId) fail('Volunteer ID and shift ID are required.');
            $active=$pdo->prepare("SELECT 1 FROM volunteers WHERE volunteer_id=? AND status='active'"); $active->execute([$volunteerId]); if (!$active->fetch()) fail('Only active volunteers can join shifts.',403);
            $pdo->prepare("INSERT INTO signups (volunteer_id, shift_id, signup_status) VALUES (?, ?, 'pending') ON DUPLICATE KEY UPDATE signup_status = 'pending'")->execute([$volunteerId, $shiftId]);
            ok(getVolunteerShifts($pdo, $volunteerId));
            break;

        case 'shift_cancel.php':
            $volunteerIdRaw = inputString($body, 'volunteerId');
            $shiftId = (int)inputString($body, 'shiftId');
            $volunteerId = requireVolunteer();
            if (parseReference($volunteerIdRaw) !== $volunteerId) fail('You may only cancel your own shifts.', 403);
            if (!$volunteerId || !$shiftId) fail('Volunteer ID and shift ID are required.');
            $pdo->prepare("UPDATE signups SET signup_status = 'cancelled' WHERE volunteer_id = ? AND shift_id = ?")->execute([$volunteerId, $shiftId]);
            ok(getVolunteerShifts($pdo, $volunteerId));
            break;

        case 'volunteer_checkin.php':
            $staffId = requireStaffMutation();
            $code = inputString($body, 'code');
            $shiftId = (int)($body['shiftId'] ?? 0);
            if (!preg_match('/^RT-VOL-([A-Za-z0-9_-]+)$/i', $code, $match) || !$shiftId) fail('Scan a valid volunteer QR code and select a shift.');
            if (!ctype_digit($match[1])) fail('No registered volunteer matches this QR code.', 404);
            $volunteerId = (int)$match[1];
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare('SELECT volunteer_id, full_name FROM volunteers WHERE volunteer_id = ? FOR UPDATE');
                $stmt->execute([$volunteerId]);
                $volunteer = $stmt->fetch();
                if (!$volunteer) { $pdo->rollBack(); fail('No registered volunteer matches this QR code.', 404); }

                $stmt = $pdo->prepare('SELECT g.signup_status, g.check_in, s.shift_name, s.status AS shift_status FROM signups g JOIN shifts s ON s.shift_id = g.shift_id WHERE g.volunteer_id = ? AND g.shift_id = ? FOR UPDATE');
                $stmt->execute([$volunteerId, $shiftId]);
                $signup = $stmt->fetch();
                if (!$signup) { $pdo->rollBack(); fail('This volunteer is not signed up for the selected shift.'); }
                if (!in_array($signup['shift_status'], ['open', 'full', 'ongoing'], true) || !in_array($signup['signup_status'], ['pending', 'approved'], true)) {
                    $pdo->rollBack();
                    fail('This signup is not eligible for check-in.');
                }

                $alreadyCheckedIn = !empty($signup['check_in']);
                $pdo->prepare("UPDATE volunteers SET status = 'active', last_check_in = NOW() WHERE volunteer_id = ?")->execute([$volunteerId]);
                $pdo->prepare("UPDATE signups SET signup_status = 'approved', check_in = COALESCE(check_in, NOW()) WHERE volunteer_id = ? AND shift_id = ?")->execute([$volunteerId, $shiftId]);
                if (!$alreadyCheckedIn) {
                    $pdo->prepare("INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES (?, 'Checked In Volunteer', ?, 'Volunteers', ?)")->execute([$staffId, $volunteer['full_name'] . ' checked in for ' . $signup['shift_name'] . '.', $volunteerId]);
                }
                $pdo->commit();

                $stmt = $pdo->prepare('SELECT check_in FROM signups WHERE volunteer_id = ? AND shift_id = ?');
                $stmt->execute([$volunteerId, $shiftId]);
                $checkedInAt = $stmt->fetchColumn();
                ok(['volunteerId' => (string)$volunteerId, 'fullName' => $volunteer['full_name'], 'status' => 'active', 'shiftId' => (string)$shiftId, 'shiftName' => $signup['shift_name'], 'checkedInAt' => date(DATE_ATOM, strtotime((string)$checkedInAt)), 'alreadyCheckedIn' => $alreadyCheckedIn]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                fail('Could not record volunteer attendance: ' . $e->getMessage(), 500);
            }
            break;
        case 'volunteer_upload_verification.php':
            $volunteerId = requireVolunteer();
            $decodedPhoto = decodeImagePayload($body['photo'] ?? null);
            if ($decodedPhoto === false) fail('Invalid image data. Choose a valid JPEG, PNG, or WebP image smaller than 5 MB.');
            $data = $decodedPhoto['data'];
            $ext = $decodedPhoto['extension'];
            $uploadDir = __DIR__ . '/uploads/verifications';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            $filename = 'vol_' . $volunteerId . '_' . time() . '.' . $ext;
            $path = $uploadDir . '/' . $filename;
            if (file_put_contents($path, $data) === false) fail('Could not save the photo.', 500);
            $stmt = $pdo->prepare("UPDATE volunteers SET verification_photo = ?, verification_status = 'pending', verification_submitted_at = NOW(), verification_notes = NULL WHERE volunteer_id = ?");
            $stmt->execute([$filename, $volunteerId]);
            $stmt = $pdo->prepare("SELECT * FROM volunteers WHERE volunteer_id = ?");
            $stmt->execute([$volunteerId]);
            ok(['uploaded' => true, 'photo' => $filename, 'status' => 'pending', 'volunteer' => mapVolunteer($stmt->fetch(), $pdo)]);
            break;

        case 'admin_volunteer_verify.php':
            $staffId = requireStaffMutation();
            $volunteerId = (int)inputString($body, 'volunteerId');
            $decision = inputString($body, 'decision');
            $notes = inputString($body, 'notes');
            if (!$volunteerId) fail('Volunteer ID is required.');
            if (!in_array($decision, ['approve', 'reject'], true)) fail('Decision must be approve or reject.');
            $stmt = $pdo->prepare('SELECT volunteer_id, full_name FROM volunteers WHERE volunteer_id = ?');
            $stmt->execute([$volunteerId]);
            $vol = $stmt->fetch();
            if (!$vol) fail('Volunteer not found.', 404);
            $newStatus = $decision === 'approve' ? 'approved' : 'rejected';
            $pdo->prepare("UPDATE volunteers SET verification_status = ?, verification_reviewed_by = ?, verification_reviewed_at = NOW(), verification_notes = ? WHERE volunteer_id = ?")->execute([$newStatus, $staffId, $notes ?: null, $volunteerId]);
            if ($decision === 'approve') {
                $pdo->prepare("UPDATE volunteers SET status = 'active' WHERE volunteer_id = ? AND status = 'pending'")->execute([$volunteerId]);
            }
            $pdo->prepare("INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES (?, ?, ?, 'Volunteers', ?)")->execute([$staffId, ucfirst($decision) . ' Volunteer Verification', $vol['full_name'] . ' verification was ' . $decision . 'd.', $volunteerId]);
            $stmt = $pdo->prepare("SELECT * FROM volunteers WHERE volunteer_id = ?");
            $stmt->execute([$volunteerId]);
            ok(['decision' => $decision, 'volunteer' => mapVolunteer($stmt->fetch(), $pdo)]);
            break;
        case 'admin_volunteer_status.php':
            $staffId = requireStaffMutation();
            $volunteerId = (int)inputString($body, 'volunteerId');
            $newStatus = inputString($body, 'status');
            if (!$volunteerId) fail('Volunteer ID is required.');
            if (!in_array($newStatus, ['active', 'inactive'], true)) fail('Invalid status.');
            $stmt = $pdo->prepare('SELECT volunteer_id, status, verification_status FROM volunteers WHERE volunteer_id = ?');
            $stmt->execute([$volunteerId]);
            $vol = $stmt->fetch();
            if (!$vol) fail('Volunteer not found.', 404);
            $current = $vol['status'];
            // Validate transitions
            if ($newStatus === 'active' && $current !== 'inactive') fail('Only inactive volunteers can be reactivated.');
            if ($newStatus === 'inactive' && $current !== 'active') fail('Only active volunteers can be deactivated.');
            if ($newStatus === 'active' && ($vol['verification_status'] ?? 'unverified') !== 'approved') fail('Volunteer must have approved verification to be reactivated.');
            $pdo->prepare("UPDATE volunteers SET status = ? WHERE volunteer_id = ?")->execute([$newStatus, $volunteerId]);
            if ($newStatus === 'inactive') $pdo->prepare("UPDATE signups SET signup_status='cancelled' WHERE volunteer_id=? AND signup_status IN ('pending','approved')")->execute([$volunteerId]);
            $action = $newStatus === 'active' ? 'Reactivated Volunteer' : 'Deactivated Volunteer';
            $pdo->prepare("INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES (?, ?, ?, 'Volunteers', ?)")->execute([$staffId, $action, 'Volunteer ' . $volunteerId . ' set to ' . $newStatus . '.', $volunteerId]);
            $stmt = $pdo->prepare("SELECT * FROM volunteers WHERE volunteer_id = ?");
            $stmt->execute([$volunteerId]);
            ok(['status' => $newStatus, 'volunteer' => mapVolunteer($stmt->fetch(), $pdo)]);
            break;
        case 'admin_volunteer_delete.php':
            $staffId = requireStaffMutation();
            $volunteerId = (int)inputString($body, 'volunteerId');
            if (!$volunteerId) fail('Volunteer ID is required.');
            $stmt = $pdo->prepare('SELECT full_name FROM volunteers WHERE volunteer_id = ?');
            $stmt->execute([$volunteerId]);
            $vol = $stmt->fetch();
            if (!$vol) fail('Volunteer not found.', 404);
            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE volunteers SET status='inactive' WHERE volunteer_id=?")->execute([$volunteerId]);
                $pdo->prepare("UPDATE signups SET signup_status='cancelled' WHERE volunteer_id=? AND signup_status IN ('pending','approved')")->execute([$volunteerId]);
                $pdo->prepare("INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES (?, 'Deactivated Volunteer Account', ?, 'Volunteers', ?)")->execute([$staffId, $vol['full_name'] . ' was deactivated; historical shifts and attendance were retained.', $volunteerId]);
                $pdo->commit();
            } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
            ok(['deleted' => true]);
            break;
        case 'admin_volunteer_manage.php':
            $staffId=requireStaffMutation(); $volunteerId=(int)($body['volunteerId'] ?? 0);
            $name=trim(inputString($body,'fullName')); $phone=trim(inputString($body,'phone')); $address=trim(inputString($body,'address'));
            $email=strtolower(trim(inputString($body,'email'))); $emergencyContact=trim(inputString($body,'emergencyContact')); $emergencyPhone=trim(inputString($body,'emergencyPhone'));
            $licenseNumber=trim(inputString($body,'drivingLicenseNumber')); $licenseType=trim(inputString($body,'drivingLicenseType')); $firstAid=trim(inputString($body,'firstAidQualification')); $skillIds=$body['skillIds'] ?? [];
            if (!$volunteerId || $name==='' || !filter_var($email,FILTER_VALIDATE_EMAIL) || !is_array($skillIds)) fail('Volunteer details are incomplete.');
            $pdo->beginTransaction();
            try {
                $pdo->prepare('UPDATE volunteers SET full_name=?,email=?,phone=?,address=?,emergency_contact=?,emergency_phone=?,driving_license_number=?,driving_license_type=?,first_aid_qualification=? WHERE volunteer_id=?')->execute([$name,$email,$phone ?: null,$address ?: null,$emergencyContact ?: null,$emergencyPhone ?: null,$licenseNumber ?: null,$licenseType ?: null,$firstAid ?: null,$volunteerId]);
                $pdo->prepare('DELETE FROM volunteer_skills WHERE volunteer_id=?')->execute([$volunteerId]);
                $skillStmt=$pdo->prepare('INSERT INTO volunteer_skills (volunteer_id,skill_id,skill_level) SELECT ?,skill_id,\'beginner\' FROM skills WHERE skill_id=?');
                foreach (array_unique(array_map('intval',$skillIds)) as $skillId) if ($skillId>0) $skillStmt->execute([$volunteerId,$skillId]);
                $pdo->prepare("INSERT INTO activity_log (staff_id,action,description,module,reference_id) VALUES (?,'Updated Volunteer Account',?,'Volunteers',?)")->execute([$staffId,$name.' account details were updated by an administrator.',$volunteerId]);
                $pdo->commit();
            } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
            $stmt=$pdo->prepare('SELECT * FROM volunteers WHERE volunteer_id=?'); $stmt->execute([$volunteerId]); ok(['volunteer'=>mapVolunteer($stmt->fetch(),$pdo)]);
            break;
        case 'serve_file.php':
            $staffId = requireStaff();
            $type = inputString($_GET, 'type') ?: 'skill';
            $file = basename(inputString($_GET, 'file'));
            if ($file === '') fail('File not specified.', 400);
            $uploadDirs = ['skill' => 'skill_verifications', 'payment' => 'payment_proofs', 'volunteer' => 'verifications'];
            if (!isset($uploadDirs[$type])) fail('Invalid file type.', 400);
            $baseDir = __DIR__ . '/uploads/' . $uploadDirs[$type];
            $path = $baseDir . '/' . $file;
            if (!is_file($path)) fail('File not found.', 404);
            // Prevent path traversal
            $realBase = realpath($baseDir);
            $realPath = realpath($path);
            if ($realBase === false || $realPath === false || strpos($realPath, $realBase) !== 0) fail('Access denied.', 403);
            $mime = mime_content_type($realPath) ?: 'application/octet-stream';
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . filesize($realPath));
            readfile($realPath);
            exit;
            break;
        case 'volunteer_upload_skill_verification.php':
            $volunteerId = requireVolunteer();
            $skillId = (int)inputString($body, 'skillId');
            if (!$skillId || empty($body['photo'])) fail('Skill ID and photo are required.');
            // Verify the volunteer has this skill
            $stmt = $pdo->prepare('SELECT 1 FROM volunteer_skills WHERE volunteer_id = ? AND skill_id = ?');
            $stmt->execute([$volunteerId, $skillId]);
            if (!$stmt->fetch()) fail('You do not have this skill assigned.');
            $decodedPhoto = decodeImagePayload($body['photo']);
            if ($decodedPhoto === false) fail('Invalid image data. Choose a valid JPEG, PNG, or WebP image smaller than 5 MB.');
            $data = $decodedPhoto['data'];
            $ext = $decodedPhoto['extension'];
            $uploadDir = __DIR__ . '/uploads/skill_verifications';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            $filename = 'skill_' . $volunteerId . '_' . $skillId . '_' . time() . '.' . $ext;
            $path = $uploadDir . '/' . $filename;
            if (file_put_contents($path, $data) === false) fail('Could not save the photo.', 500);
            $pdo->prepare("INSERT INTO volunteer_skill_verifications (volunteer_id, skill_id, photo_filename, status) VALUES (?, ?, ?, 'pending') ON DUPLICATE KEY UPDATE photo_filename = VALUES(photo_filename), status = 'pending', submitted_at = NOW(), reviewed_by = NULL, reviewed_at = NULL, notes = NULL")->execute([$volunteerId, $skillId, $filename]);
            $stmt = $pdo->prepare("SELECT vsv.*, s.skill_name FROM volunteer_skill_verifications vsv JOIN skills s ON s.skill_id = vsv.skill_id WHERE vsv.volunteer_id = ? AND vsv.skill_id = ?");
            $stmt->execute([$volunteerId, $skillId]);
            ok(['uploaded' => true, 'verification' => $stmt->fetch()]);
            break;

        case 'admin_skill_verify.php':
            $staffId = requireStaffMutation();
            $verificationId = (int)inputString($body, 'verificationId');
            $decision = inputString($body, 'decision');
            $notes = inputString($body, 'notes');
            if (!$verificationId) fail('Verification ID is required.');
            if (!in_array($decision, ['approve', 'reject'], true)) fail('Decision must be approve or reject.');
            $stmt = $pdo->prepare('SELECT vsv.*, v.full_name, s.skill_name FROM volunteer_skill_verifications vsv JOIN volunteers v ON v.volunteer_id = vsv.volunteer_id JOIN skills s ON s.skill_id = vsv.skill_id WHERE vsv.verification_id = ?');
            $stmt->execute([$verificationId]);
            $ver = $stmt->fetch();
            if (!$ver) fail('Verification not found.', 404);
            $newStatus = $decision === 'approve' ? 'approved' : 'rejected';
            $pdo->prepare("UPDATE volunteer_skill_verifications SET status = ?, reviewed_by = ?, reviewed_at = NOW(), notes = ? WHERE verification_id = ?")->execute([$newStatus, $staffId, $notes ?: null, $verificationId]);
            $pdo->prepare("INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES (?, ?, ?, 'Volunteers', ?)")->execute([$staffId, ucfirst($decision) . ' Skill Verification', $ver['full_name'] . ' ' . $ver['skill_name'] . ' verification was ' . $decision . 'd.', $ver['volunteer_id']]);
            $stmt = $pdo->prepare("SELECT vsv.*, s.skill_name FROM volunteer_skill_verifications vsv JOIN skills s ON s.skill_id = vsv.skill_id WHERE vsv.verification_id = ?");
            $stmt->execute([$verificationId]);
            ok(['decision' => $decision, 'verification' => $stmt->fetch()]);
            break;

        case 'volunteer_skill_verifications.php':
            $volunteerId = requireVolunteer();
            $requestedId = (int)inputString($_GET, 'volunteer_id');
            if ($requestedId && $requestedId !== $volunteerId) fail('You may only view your own verifications.', 403);
            $targetId = $requestedId ?: $volunteerId;
            $stmt = $pdo->prepare("SELECT vsv.*, s.skill_name FROM volunteer_skill_verifications vsv JOIN skills s ON s.skill_id = vsv.skill_id WHERE vsv.volunteer_id = ? ORDER BY vsv.submitted_at DESC");
            $stmt->execute([$targetId]);
            ok($stmt->fetchAll());
            break;

        case 'admin_skill_verifications.php':
            requireStaff();
            $status = inputString($_GET, 'status');
            $sql = "SELECT vsv.*, v.full_name, v.email, s.skill_name FROM volunteer_skill_verifications vsv JOIN volunteers v ON v.volunteer_id = vsv.volunteer_id JOIN skills s ON s.skill_id = vsv.skill_id";
            if ($status && in_array($status, ['pending', 'approved', 'rejected'], true)) $sql .= " WHERE vsv.status = " . $pdo->quote($status);
            $sql .= " ORDER BY vsv.submitted_at DESC";
            ok($pdo->query($sql)->fetchAll());
            break;



        default: fail('Endpoint not implemented: ' . $endpoint, 404);
    }
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fail('Server error: ' . $error->getMessage(), 500);
}
