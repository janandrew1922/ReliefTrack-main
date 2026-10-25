-- =====================================================
-- ReliefTrack — MySQL schema (XAMPP / phpMyAdmin)
-- Paste this whole file into the phpMyAdmin SQL tab.
-- =====================================================

CREATE DATABASE IF NOT EXISTS relieftrack
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE relieftrack;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS drivers;
DROP TABLE IF EXISTS needed_items;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS donation_updates;
DROP TABLE IF EXISTS donation_items;
DROP TABLE IF EXISTS donations;
DROP TABLE IF EXISTS signups;
DROP TABLE IF EXISTS shift_skills;
DROP TABLE IF EXISTS operation_locations;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS login_codes;
DROP TABLE IF EXISTS volunteer_skills;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS volunteers;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS operations;
DROP TABLE IF EXISTS staff_users;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- 1. STAFF USERS
-- =====================================================
CREATE TABLE staff_users (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','staff','coordinator') NOT NULL DEFAULT 'staff',
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. OPERATIONS
-- =====================================================
CREATE TABLE operations (
    operation_id INT AUTO_INCREMENT PRIMARY KEY,
    operation_name VARCHAR(150) NOT NULL,
    description TEXT,
    operation_type ENUM(
        'disaster_response',
        'relief_distribution',
        'rescue',
        'donation_drive',
        'other'
    ) DEFAULT 'disaster_response',
    status ENUM('planned','active','completed','cancelled') DEFAULT 'planned',
    start_date DATE,
    end_date DATE,
    volunteers_needed INT UNSIGNED NOT NULL DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_operations_status (status),
    FOREIGN KEY (created_by) REFERENCES staff_users(staff_id) ON DELETE SET NULL
);

-- =====================================================
-- 3. LOCATIONS
-- =====================================================
CREATE TABLE locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    operation_id INT,
    location_name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100),
    province VARCHAR(100),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    location_type ENUM(
        'warehouse',
        'evacuation_center',
        'distribution_center',
        'donation_center',
        'affected_area',
        'other'
    ) DEFAULT 'other',
    status ENUM('active','inactive') DEFAULT 'active',
    contact_phone VARCHAR(30) NULL,
    operated_by VARCHAR(150) NULL,
    photo_url TEXT NULL,
    detail TEXT NULL,
    feedback_rating DECIMAL(2,1) NULL,
    feedback_count INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_locations_status_city (status, city),
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE SET NULL
);

CREATE TABLE operation_locations (
    operation_id INT NOT NULL,
    location_id INT NOT NULL,
    PRIMARY KEY (operation_id, location_id),
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE
);

-- =====================================================
-- 4. VOLUNTEERS
-- =====================================================
CREATE TABLE volunteers (
    volunteer_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(30),
    address TEXT,
    emergency_contact VARCHAR(150),
    emergency_phone VARCHAR(30),
    driving_license_number VARCHAR(80) NULL,
    driving_license_type VARCHAR(80) NULL,
    first_aid_qualification VARCHAR(255) NULL,
    last_check_in DATETIME NULL,
    verification_photo VARCHAR(255) NULL,
    verification_status ENUM('unverified','pending','approved','rejected') NOT NULL DEFAULT 'unverified',
    verification_submitted_at DATETIME NULL,
    verification_reviewed_by INT NULL,
    verification_reviewed_at DATETIME NULL,
    verification_notes TEXT NULL,
    status ENUM('pending','active','inactive','suspended') DEFAULT 'pending',
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. SKILLS
-- =====================================================
CREATE TABLE skills (
    skill_id INT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. VOLUNTEER SKILLS
-- =====================================================
CREATE TABLE volunteer_skills (
    volunteer_skill_id INT AUTO_INCREMENT PRIMARY KEY,
    volunteer_id INT NOT NULL,
    skill_id INT NOT NULL,
    skill_level ENUM('beginner','intermediate','advanced','expert') DEFAULT 'beginner',
    UNIQUE KEY unique_volunteer_skill (volunteer_id, skill_id),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(volunteer_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
);

-- =====================================================
-- 7. LOGIN CODES
-- =====================================================
CREATE TABLE login_codes (
    code_id INT AUTO_INCREMENT PRIMARY KEY,
    volunteer_id INT,
    email VARCHAR(150) NOT NULL,
    code VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    request_ip VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_login_codes_email_used (email, used, expires_at),
    KEY idx_login_codes_ip_created (request_ip, created_at),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(volunteer_id) ON DELETE CASCADE
);

CREATE TABLE api_rate_limits (
    limit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    endpoint VARCHAR(80) NOT NULL,
    key_hash CHAR(64) NOT NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_api_rate_limits_endpoint_key_time (endpoint, key_hash, requested_at)
);

-- =====================================================
-- 8. SHIFTS
-- =====================================================
CREATE TABLE shifts (
    shift_id INT AUTO_INCREMENT PRIMARY KEY,
    operation_id INT NOT NULL,
    location_id INT,
    shift_name VARCHAR(100) NOT NULL,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_volunteers INT DEFAULT 1,
    status ENUM('open','full','ongoing','completed','cancelled') DEFAULT 'open',
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
);

CREATE TABLE shift_skills (
    shift_id INT NOT NULL,
    skill_id INT NOT NULL,
    PRIMARY KEY (shift_id, skill_id),
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
);

-- =====================================================
-- 9. SIGNUPS
-- =====================================================
CREATE TABLE signups (
    signup_id INT AUTO_INCREMENT PRIMARY KEY,
    volunteer_id INT NOT NULL,
    shift_id INT NOT NULL,
    signup_status ENUM('pending','approved','rejected','completed','cancelled') DEFAULT 'pending',
    check_in DATETIME NULL,
    check_out DATETIME NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_volunteer_shift (volunteer_id, shift_id),
    KEY idx_signups_volunteer (volunteer_id),
    KEY idx_signups_shift_status (shift_id, signup_status),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(volunteer_id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id) ON DELETE CASCADE
);

-- =====================================================
-- 10. DONATIONS
-- =====================================================
CREATE TABLE donations (
    donation_id INT AUTO_INCREMENT PRIMARY KEY,
    donor_name VARCHAR(150) NOT NULL,
    donor_email VARCHAR(150),
    donor_phone VARCHAR(30),
    donation_type ENUM('cash','goods','mixed') NOT NULL DEFAULT 'goods',
    amount DECIMAL(12,2) DEFAULT 0.00,
    operation_id INT,
    preferred_location_id INT,
    drop_off_location_id INT,
    donor_preference TEXT,
    payment_proof VARCHAR(255) NULL,
    status ENUM('pledged','received','verified','allocated','in_transit','distributed','cancelled') DEFAULT 'pledged',
    donated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_donations_donor_email (donor_email),
    KEY idx_donations_donated_at (donated_at),
    FULLTEXT KEY ft_donations_donor_name (donor_name),
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE SET NULL,
    FOREIGN KEY (preferred_location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
    FOREIGN KEY (drop_off_location_id) REFERENCES locations(location_id) ON DELETE SET NULL
);

-- =====================================================
-- 11. DONATION ITEMS
-- =====================================================
CREATE TABLE donation_items (
    donation_item_id INT AUTO_INCREMENT PRIMARY KEY,
    donation_id INT NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    quantity INT NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'pcs',
    condition_status ENUM('new','good','used','damaged') DEFAULT 'new',
    notes TEXT,
    KEY idx_donation_items_donation (donation_id),
    FULLTEXT KEY ft_donation_items_name (item_name),
    FOREIGN KEY (donation_id) REFERENCES donations(donation_id) ON DELETE CASCADE
);

-- =====================================================
-- 12. DONATION UPDATES (donor tracking timeline)
-- =====================================================
CREATE TABLE donation_updates (
    update_id INT AUTO_INCREMENT PRIMARY KEY,
    donation_id INT NOT NULL,
    status ENUM('pledged','received','verified','allocated','in_transit','distributed','cancelled') NOT NULL,
    message TEXT,
    location VARCHAR(255) NULL,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_donation_updates_donation (donation_id, created_at),
    FOREIGN KEY (donation_id) REFERENCES donations(donation_id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES staff_users(staff_id) ON DELETE SET NULL
);

-- =====================================================
-- 13. INVENTORY
-- =====================================================
CREATE TABLE inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    quantity INT NOT NULL DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'pcs',
    minimum_stock INT DEFAULT 0,
    status ENUM('available','low_stock','out_of_stock') DEFAULT 'available',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
);

-- =====================================================
-- 14. NEEDED ITEMS
-- =====================================================
CREATE TABLE needed_items (
    needed_item_id INT AUTO_INCREMENT PRIMARY KEY,
    operation_id INT,
    location_id INT,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    quantity_needed INT NOT NULL DEFAULT 0,
    quantity_received INT NOT NULL DEFAULT 0,
    priority ENUM('low','medium','high','critical') DEFAULT 'medium',
    status ENUM('needed','partially_fulfilled','fulfilled') DEFAULT 'needed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE SET NULL,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
);

-- =====================================================
-- 15. VEHICLES
-- =====================================================
CREATE TABLE vehicles (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_name VARCHAR(100) NOT NULL,
    plate_number VARCHAR(30) NOT NULL UNIQUE,
    vehicle_type VARCHAR(100),
    capacity VARCHAR(100),
    driver_name VARCHAR(150),
    driver_contact VARCHAR(30),
    driver_id INT NULL,
    status ENUM('available','in_use','maintenance','unavailable') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE drivers (
    driver_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    driving_license_number VARCHAR(80),
    driving_license_type VARCHAR(80),
    status ENUM('pending','active','inactive') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 16. SHIPMENTS
-- =====================================================
CREATE TABLE shipments (
    shipment_id INT AUTO_INCREMENT PRIMARY KEY,
    operation_id INT,
    vehicle_id INT,
    driver_id INT,
    donation_id INT,
    source_location_id INT,
    destination_location_id INT,
    shipment_reference VARCHAR(50) NOT NULL UNIQUE,
    item_description TEXT,
    quantity INT DEFAULT 0,
    status ENUM('pending','packed','in_transit','delivered','cancelled') DEFAULT 'pending',
    dispatched_at DATETIME NULL,
    delivered_at DATETIME NULL,
    current_latitude DECIMAL(10,7) NULL,
    current_longitude DECIMAL(10,7) NULL,
    gps_updated_at DATETIME NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
    FOREIGN KEY (donation_id) REFERENCES donations(donation_id) ON DELETE SET NULL,
    FOREIGN KEY (source_location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
    FOREIGN KEY (destination_location_id) REFERENCES locations(location_id) ON DELETE SET NULL
);

-- =====================================================
-- 17. ACTIVITY LOG
-- =====================================================
CREATE TABLE activity_log (
    activity_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT,
    action VARCHAR(150) NOT NULL,
    description TEXT,
    module VARCHAR(100),
    reference_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_activity_log_created (created_at),
    FOREIGN KEY (staff_id) REFERENCES staff_users(staff_id) ON DELETE SET NULL
);

-- =====================================================
-- 18. ALERTS
-- =====================================================
CREATE TABLE alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT,
    operation_id INT,
    alert_type ENUM('inventory','volunteer','donation','shipment','operation','system') DEFAULT 'system',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    priority ENUM('low','medium','high','critical') DEFAULT 'medium',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff_users(staff_id) ON DELETE CASCADE,
    FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE
);

-- =====================================================
-- SAMPLE DATA
-- =====================================================

INSERT INTO staff_users (full_name, email, password, role, status) VALUES
('System Administrator', 'admin@relieftrack.com', '$2y$10$ZCBNhQfdrAgeXxbA1.B75.V6zNwkdncHcuACkb8jxqkQroakEx10K', 'admin', 'active'),
('Maria Santos', 'maria@relieftrack.com', '$2y$10$WiWQcKHAL.jsJYmaNn0RBOJ./GmD5TYhOjdRZEtwDJ1zpblmKxjZC', 'staff', 'active'),
('Juan Dela Cruz', 'juan@relieftrack.com', '$2y$10$ZRdtqwq68wCxW83GXf33Z.6Pxkrw6lSWoJlSu4NwiKwGO.oW5N9uG', 'coordinator', 'active');

INSERT INTO operations
(operation_name, description, operation_type, status, start_date, end_date, volunteers_needed, created_by) VALUES
('Typhoon Relief Operation', 'Relief distribution for communities affected by the typhoon.', 'disaster_response', 'active', '2026-09-01', '2026-09-30', 80, 1),
('Community Donation Drive', 'Collection and distribution of food and essential goods.', 'donation_drive', 'planned', '2026-10-01', '2026-10-15', 40, 2);

-- Latitude and longitude are REQUIRED for a location to appear on the map.
INSERT INTO locations
(operation_id, location_name, address, city, province, latitude, longitude, location_type, status, operated_by, photo_url, detail) VALUES
(1, 'Main Relief Warehouse', 'Samson Road', 'Caloocan', 'Metro Manila', 14.6549000, 120.9836000, 'warehouse', 'active', 'Caloocan ReliefTrack Team', '/85d10986-1e79-4d08-9a63-921b83635322.jpg', 'Main sorting and repacking hub.'),
(1, 'Barangay Relief Center', 'Barangay Hall, 10th Avenue', 'Caloocan', 'Metro Manila', 14.6420000, 120.9820000, 'distribution_center', 'active', 'Caloocan ReliefTrack Team', '/85d10986-1e79-4d08-9a63-921b83635322.jpg', 'Family relief pack distribution point.'),
(1, 'Community Evacuation Center', 'Community Center, Bagong Barrio', 'Caloocan', 'Metro Manila', 14.6510000, 120.9950000, 'evacuation_center', 'active', 'Caloocan ReliefTrack Team', '/85d10986-1e79-4d08-9a63-921b83635322.jpg', 'Priority area for current response.'),
(1, 'Caloocan Donation Center', '12th Avenue, Grace Park', 'Caloocan', 'Metro Manila', 14.6577000, 120.9830000, 'donation_center', 'active', 'Caloocan ReliefTrack Team', '/85d10986-1e79-4d08-9a63-921b83635322.jpg', 'Open daily, 8:00 AM to 6:00 PM.'),
(1, 'Bagong Silang Community Drop-off', 'Barangay 176, Bagong Silang', 'Caloocan', 'Metro Manila', 14.7566000, 120.9948000, 'donation_center', 'active', 'Caloocan ReliefTrack Team', '/85d10986-1e79-4d08-9a63-921b83635322.jpg', 'Drop-off point for donated goods.');

INSERT INTO operation_locations (operation_id, location_id)
SELECT operation_id, location_id FROM locations WHERE operation_id IS NOT NULL;

INSERT INTO operation_locations (operation_id, location_id)
SELECT 2, location_id FROM locations WHERE location_name IN ('Main Relief Warehouse', 'Bagong Silang Community Drop-off');

INSERT INTO volunteers
(full_name, email, phone, address, emergency_contact, emergency_phone, status) VALUES
('John Reyes', 'john@example.com', '09171234567', 'Caloocan City', 'Anna Reyes', '09181234567', 'active'),
('Ana Cruz', 'ana@example.com', '09192345678', 'Caloocan City', 'Mark Cruz', '09201234567', 'active'),
('Pedro Garcia', 'pedro@example.com', '09213456789', 'Caloocan City', 'Liza Garcia', '09224567890', 'active');

INSERT INTO skills (skill_name, description) VALUES
('First Aid', 'Basic emergency and first aid assistance'),
('Driving', 'Vehicle driving and transportation'),
('Packing', 'Packing and organizing relief goods'),
('Distribution', 'Distribution of relief goods');

INSERT INTO volunteer_skills (volunteer_id, skill_id, skill_level) VALUES
(1, 1, 'intermediate'), (1, 3, 'advanced'),
(2, 1, 'advanced'), (2, 4, 'intermediate'),
(3, 2, 'advanced'), (3, 3, 'intermediate');

INSERT INTO login_codes (volunteer_id, email, code, expires_at, used) VALUES
(1, 'john@example.com', '123456', '2026-09-30 23:59:59', FALSE);

INSERT INTO shifts
(operation_id, location_id, shift_name, shift_date, start_time, end_time, required_volunteers, status) VALUES
(1, 1, 'Morning Warehouse Shift', '2026-09-10', '08:00:00', '12:00:00', 5, 'open'),
(1, 2, 'Relief Distribution Shift', '2026-09-10', '13:00:00', '17:00:00', 8, 'open'),
(1, 3, 'Evacuation Center Assistance', '2026-09-11', '08:00:00', '16:00:00', 10, 'open');

INSERT INTO shift_skills (shift_id, skill_id) VALUES
(1, 2), (1, 3),
(2, 1), (2, 4),
(3, 1), (3, 4);

INSERT INTO signups (volunteer_id, shift_id, signup_status, notes) VALUES
(1, 1, 'approved', 'Assigned to packing area'),
(2, 2, 'approved', 'Assigned to distribution'),
(3, 1, 'pending', 'Waiting for confirmation');

INSERT INTO donations
(donor_name, donor_email, donor_phone, donation_type, amount, operation_id, preferred_location_id, donor_preference, status) VALUES
('ABC Foundation', 'contact@abcfoundation.org', '09170000001', 'goods', 0, 1, 1, 'Please prioritize food for affected families.', 'received'),
('Juan Family', 'juanfamily@example.com', '09170000002', 'goods', 0, 1, 2, 'Donate to families affected by the typhoon.', 'verified'),
('Community Supporter', 'support@example.com', '09170000003', 'cash', 10000.00, 1, NULL, 'Use for essential relief supplies. | Payment channel: GCash', 'received');

INSERT INTO donation_items (donation_id, item_name, category, quantity, unit, condition_status, notes) VALUES
(1, 'Rice', 'Food', 50, 'sacks', 'new', '25kg sacks'),
(1, 'Bottled Water', 'Water', 200, 'bottles', 'new', NULL),
(2, 'Blankets', 'Clothing', 50, 'pcs', 'new', NULL),
(2, 'Canned Goods', 'Food', 100, 'cans', 'new', NULL);

INSERT INTO donation_updates (donation_id, status, message, updated_by) VALUES
(1, 'pledged', 'Donation was registered in the system.', 1),
(1, 'received', 'Donation arrived at the main warehouse.', 2),
(1, 'verified', 'Donation contents were verified.', 1),
(2, 'pledged', 'Donation was registered in the system.', 2),
(2, 'received', 'Donation was received at the relief center.', 2),
(3, 'pledged', 'Cash donation pledged online.', 1),
(3, 'received', 'GCash payment received.', 1);

INSERT INTO inventory (location_id, item_name, category, quantity, unit, minimum_stock, status) VALUES
(1, 'Rice', 'Food', 75, 'sacks', 20, 'available'),
(1, 'Bottled Water', 'Water', 300, 'bottles', 100, 'available'),
(1, 'Canned Goods', 'Food', 150, 'cans', 50, 'available'),
(1, 'Blankets', 'Clothing', 35, 'pcs', 30, 'available'),
(2, 'Rice', 'Food', 15, 'sacks', 20, 'low_stock'),
(2, 'Bottled Water', 'Water', 50, 'bottles', 100, 'low_stock');

INSERT INTO needed_items
(operation_id, location_id, item_name, category, quantity_needed, quantity_received, priority, status) VALUES
(1, 2, 'Rice', 'Food', 100, 15, 'critical', 'partially_fulfilled'),
(1, 2, 'Bottled Water', 'Water', 300, 50, 'high', 'partially_fulfilled'),
(1, 3, 'Blankets', 'Clothing', 100, 35, 'high', 'partially_fulfilled'),
(1, 3, 'First Aid Kits', 'Medical', 50, 0, 'critical', 'needed');

INSERT INTO vehicles
(vehicle_name, plate_number, vehicle_type, capacity, driver_name, driver_contact, status) VALUES
('Relief Truck 1', 'ABC-1234', 'Truck', '2 tons', 'Pedro Garcia', '09213456789', 'in_use'),
('Relief Van 1', 'XYZ-5678', 'Van', '1 ton', 'Mark Santos', '09181234567', 'available');

INSERT INTO shipments
(operation_id, vehicle_id, donation_id, source_location_id, destination_location_id,
 shipment_reference, item_description, quantity, status, dispatched_at) VALUES
(1, 1, 1, 1, 2, 'SHIP-2026-001', 'Rice and bottled water', 100, 'in_transit', '2026-09-09 09:30:00'),
(1, 2, 2, 1, 3, 'SHIP-2026-002', 'Blankets and canned goods', 75, 'pending', NULL);

INSERT INTO activity_log (staff_id, action, description, module, reference_id) VALUES
(1, 'Created Operation', 'Created Typhoon Relief Operation.', 'Operations', 1),
(2, 'Approved Volunteer', 'Approved John Reyes as a volunteer.', 'Volunteers', 1),
(1, 'Verified Donation', 'Verified donation from ABC Foundation.', 'Donations', 1),
(2, 'Created Shipment', 'Created shipment SHIP-2026-001.', 'Shipments', 1);

INSERT INTO alerts (staff_id, operation_id, alert_type, title, message, priority, is_read) VALUES
(1, 1, 'inventory', 'Low Rice Stock', 'The relief center has reached low stock for rice.', 'high', FALSE),
(1, 1, 'inventory', 'Low Water Stock', 'Bottled water at the relief center is below the minimum stock level.', 'critical', FALSE),
(2, 1, 'donation', 'Donation Received', 'A new donation from ABC Foundation has been received.', 'medium', FALSE),
(2, 1, 'shipment', 'Shipment In Transit', 'Shipment SHIP-2026-001 is currently in transit.', 'medium', FALSE);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'ReliefTrack database successfully created!' AS message;

CREATE TABLE volunteer_skill_verifications (
  verification_id INT AUTO_INCREMENT PRIMARY KEY,
  volunteer_id INT NOT NULL,
  skill_id INT NOT NULL,
  photo_filename VARCHAR(255) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  notes TEXT NULL,
  UNIQUE KEY uq_volunteer_skill (volunteer_id, skill_id),
  KEY idx_vsv_status (status),
  CONSTRAINT fk_vsv_volunteer FOREIGN KEY (volunteer_id) REFERENCES volunteers(volunteer_id) ON DELETE CASCADE,
  CONSTRAINT fk_vsv_skill FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE,
  CONSTRAINT fk_vsv_reviewer FOREIGN KEY (reviewed_by) REFERENCES staff_users(staff_id) ON DELETE SET NULL
) ENGINE=InnoDB;
