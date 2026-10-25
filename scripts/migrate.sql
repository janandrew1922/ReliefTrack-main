USE relieftrack;

SET @schema_name = DATABASE();

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='donations' AND COLUMN_NAME='status' AND COLUMN_TYPE LIKE '%in_transit%') > 0,
  'SELECT 1',
  "ALTER TABLE donations MODIFY status ENUM('pledged','received','verified','allocated','in_transit','distributed','cancelled') DEFAULT 'pledged'"
);
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='locations' AND COLUMN_NAME='contact_phone'), 'SELECT 1', 'ALTER TABLE locations ADD COLUMN contact_phone VARCHAR(30) NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='locations' AND COLUMN_NAME='operated_by'), 'SELECT 1', 'ALTER TABLE locations ADD COLUMN operated_by VARCHAR(150) NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='locations' AND COLUMN_NAME='photo_url'), 'SELECT 1', 'ALTER TABLE locations ADD COLUMN photo_url TEXT NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='locations' AND COLUMN_NAME='feedback_rating'), 'SELECT 1', 'ALTER TABLE locations ADD COLUMN feedback_rating DECIMAL(2,1) NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='locations' AND COLUMN_NAME='feedback_count'), 'SELECT 1', 'ALTER TABLE locations ADD COLUMN feedback_count INT UNSIGNED NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='locations' AND COLUMN_NAME='detail'), 'SELECT 1', 'ALTER TABLE locations ADD COLUMN detail TEXT NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='driving_license_number'), 'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN driving_license_number VARCHAR(80) NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='driving_license_type'), 'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN driving_license_type VARCHAR(80) NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='first_aid_qualification'), 'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN first_aid_qualification VARCHAR(255) NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='last_check_in'), 'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN last_check_in DATETIME NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='verification_photo'), 'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN verification_photo VARCHAR(255) NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='verification_status'), 'SELECT 1', "ALTER TABLE volunteers ADD COLUMN verification_status ENUM('unverified','pending','approved','rejected') NOT NULL DEFAULT 'unverified'");
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='verification_submitted_at'), 'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN verification_submitted_at DATETIME NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='verification_reviewed_by'), 'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN verification_reviewed_by INT NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='verification_reviewed_at'), 'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN verification_reviewed_at DATETIME NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='volunteers' AND COLUMN_NAME='verification_notes'), 'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN verification_notes TEXT NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='operations' AND COLUMN_NAME='volunteers_needed'),
  'SELECT 1',
  'ALTER TABLE operations ADD COLUMN volunteers_needed INT UNSIGNED NOT NULL DEFAULT 0'
);
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='login_codes' AND COLUMN_NAME='failed_attempts'),
  'SELECT 1',
  'ALTER TABLE login_codes ADD COLUMN failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0'
);
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='login_codes' AND COLUMN_NAME='request_ip'),
  'SELECT 1',
  'ALTER TABLE login_codes ADD COLUMN request_ip VARCHAR(45) NULL'
);
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

ALTER TABLE login_codes MODIFY code VARCHAR(255) NOT NULL;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  limit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(80) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_api_rate_limits_endpoint_key_time (endpoint, key_hash, requested_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS operation_locations (
  operation_id INT NOT NULL,
  location_id INT NOT NULL,
  PRIMARY KEY (operation_id, location_id),
  KEY idx_operation_locations_location (location_id),
  CONSTRAINT fk_operation_locations_operation FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE,
  CONSTRAINT fk_operation_locations_location FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shift_skills (
  shift_id INT NOT NULL,
  skill_id INT NOT NULL,
  PRIMARY KEY (shift_id, skill_id),
  CONSTRAINT fk_shift_skills_shift FOREIGN KEY (shift_id) REFERENCES shifts(shift_id) ON DELETE CASCADE,
  CONSTRAINT fk_shift_skills_skill FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
) ENGINE=InnoDB;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='shift_skills' AND COLUMN_NAME='shift_id' AND REFERENCED_TABLE_NAME='shifts'), 'SELECT 1', 'ALTER TABLE shift_skills ADD CONSTRAINT fk_shift_skills_shift FOREIGN KEY (shift_id) REFERENCES shifts(shift_id) ON DELETE CASCADE');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='shift_skills' AND COLUMN_NAME='skill_id' AND REFERENCED_TABLE_NAME='skills'), 'SELECT 1', 'ALTER TABLE shift_skills ADD CONSTRAINT fk_shift_skills_skill FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='operation_locations' AND COLUMN_NAME='operation_id' AND REFERENCED_TABLE_NAME='operations'), 'SELECT 1', 'ALTER TABLE operation_locations ADD CONSTRAINT fk_operation_locations_operation FOREIGN KEY (operation_id) REFERENCES operations(operation_id) ON DELETE CASCADE');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='operation_locations' AND COLUMN_NAME='location_id' AND REFERENCED_TABLE_NAME='locations'), 'SELECT 1', 'ALTER TABLE operation_locations ADD CONSTRAINT fk_operation_locations_location FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

DELETE ol FROM operation_locations ol
LEFT JOIN operations o ON o.operation_id=ol.operation_id
WHERE o.operation_id IS NULL;

INSERT IGNORE INTO operation_locations (operation_id, location_id)
SELECT operation_id, location_id FROM locations WHERE operation_id IS NOT NULL;

-- Location metadata backfill. The map popup renders "Operated by" only when
-- operated_by is set, so every checkpoint needs an operator and a photo. The
-- WHERE guards keep the statement idempotent and leave staff-edited rows alone.
UPDATE locations
SET operated_by = 'Caloocan ReliefTrack Team'
WHERE operated_by IS NULL OR operated_by = '';

UPDATE locations
SET photo_url = '/85d10986-1e79-4d08-9a63-921b83635322.jpg'
WHERE photo_url IS NULL OR photo_url = '';

-- The map popup shows the checkpoint description. Seed the sample locations so
-- API mode reads like the local demo instead of a generic placeholder.
UPDATE locations SET detail = 'Main sorting and repacking hub.' WHERE (detail IS NULL OR detail = '') AND location_name = 'Main Relief Warehouse';
UPDATE locations SET detail = 'Family relief pack distribution point.' WHERE (detail IS NULL OR detail = '') AND location_name = 'Barangay Relief Center';
UPDATE locations SET detail = 'Priority area for current response.' WHERE (detail IS NULL OR detail = '') AND location_name = 'Community Evacuation Center';
UPDATE locations SET detail = 'Open daily, 8:00 AM to 6:00 PM.' WHERE (detail IS NULL OR detail = '') AND location_name = 'Caloocan Donation Center';
UPDATE locations SET detail = 'Drop-off point for donated goods.' WHERE (detail IS NULL OR detail = '') AND location_name = 'Bagong Silang Community Drop-off';
UPDATE locations SET detail = 'ReliefTrack checkpoint.' WHERE detail IS NULL OR detail = '';

-- Shifts advertise the skills they need. The join table is the only source for
-- shifts.php, so seed the requirement set for the sample shifts.
INSERT IGNORE INTO shift_skills (shift_id, skill_id)
SELECT s.shift_id, sk.skill_id
FROM shifts s
JOIN skills sk
WHERE (s.shift_name = 'Morning Warehouse Shift' AND sk.skill_name IN ('Packing', 'Driving'))
   OR (s.shift_name = 'Relief Distribution Shift' AND sk.skill_name IN ('First Aid', 'Distribution'))
   OR (s.shift_name = 'Evacuation Center Assistance' AND sk.skill_name IN ('First Aid', 'Medical Assistance'));

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='donations' AND INDEX_NAME='idx_donations_donor_email'), 'SELECT 1', 'CREATE INDEX idx_donations_donor_email ON donations(donor_email)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='shipments' AND COLUMN_NAME='current_latitude'), 'SELECT 1', 'ALTER TABLE shipments ADD COLUMN current_latitude DECIMAL(10,7) NULL, ADD COLUMN current_longitude DECIMAL(10,7) NULL, ADD COLUMN gps_updated_at DATETIME NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='donation_updates' AND COLUMN_NAME='location'), 'SELECT 1', 'ALTER TABLE donation_updates ADD COLUMN location VARCHAR(255) NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='donations' AND COLUMN_NAME='drop_off_location_id'), 'SELECT 1', 'ALTER TABLE donations ADD COLUMN drop_off_location_id INT NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
CREATE TABLE IF NOT EXISTS drivers (
  driver_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='vehicles' AND COLUMN_NAME='driver_id'), 'SELECT 1', 'ALTER TABLE vehicles ADD COLUMN driver_id INT NULL');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='donations' AND INDEX_NAME='idx_donations_donated_at'), 'SELECT 1', 'CREATE INDEX idx_donations_donated_at ON donations(donated_at)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='donation_items' AND INDEX_NAME='idx_donation_items_donation'), 'SELECT 1', 'CREATE INDEX idx_donation_items_donation ON donation_items(donation_id)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='donation_updates' AND INDEX_NAME='idx_donation_updates_donation'), 'SELECT 1', 'CREATE INDEX idx_donation_updates_donation ON donation_updates(donation_id, created_at)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='signups' AND INDEX_NAME='idx_signups_volunteer'), 'SELECT 1', 'CREATE INDEX idx_signups_volunteer ON signups(volunteer_id)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='signups' AND INDEX_NAME='idx_signups_shift_status'), 'SELECT 1', 'CREATE INDEX idx_signups_shift_status ON signups(shift_id, signup_status)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='login_codes' AND INDEX_NAME='idx_login_codes_email_used'), 'SELECT 1', 'CREATE INDEX idx_login_codes_email_used ON login_codes(email, used, expires_at)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='login_codes' AND INDEX_NAME='idx_login_codes_ip_created'), 'SELECT 1', 'CREATE INDEX idx_login_codes_ip_created ON login_codes(request_ip, created_at)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='activity_log' AND INDEX_NAME='idx_activity_log_created'), 'SELECT 1', 'CREATE INDEX idx_activity_log_created ON activity_log(created_at)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='locations' AND INDEX_NAME='idx_locations_status_city'), 'SELECT 1', 'CREATE INDEX idx_locations_status_city ON locations(status, city)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='operations' AND INDEX_NAME='idx_operations_status'), 'SELECT 1', 'CREATE INDEX idx_operations_status ON operations(status)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='donations' AND INDEX_NAME='ft_donations_donor_name'), 'SELECT 1', 'ALTER TABLE donations ADD FULLTEXT INDEX ft_donations_donor_name(donor_name)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='donation_items' AND INDEX_NAME='ft_donation_items_name'), 'SELECT 1', 'ALTER TABLE donation_items ADD FULLTEXT INDEX ft_donation_items_name(item_name)');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;
CREATE TABLE IF NOT EXISTS volunteer_skill_verifications (
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
-- Auto-deactivate volunteers whose last check-in is older than 24 hours.
UPDATE volunteers SET status = 'pending' WHERE status = 'active' AND (last_check_in IS NULL OR last_check_in < DATE_SUB(NOW(), INTERVAL 24 HOUR));
