CREATE TABLE IF NOT EXISTS ussd_session_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id VARCHAR(191) NOT NULL,
  event_key CHAR(64) NOT NULL,
  menu VARCHAR(64) NOT NULL,
  selection VARCHAR(32) NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ussd_session_events_event_key (event_key),
  KEY idx_ussd_session_events_session_created (session_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ussd_menu_configs (
  menu_key VARCHAR(64) NOT NULL,
  menu_text TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (menu_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hospitals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(200) NOT NULL,
  location VARCHAR(200) NOT NULL,
  address VARCHAR(500) NULL,
  phone VARCHAR(50) NULL,
  description TEXT NOT NULL,
  operating_info TEXT NULL,
  emergency_contact VARCHAR(200) NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  image_path VARCHAR(500) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hospitals_slug (slug),
  UNIQUE KEY uq_hospitals_name (name),
  KEY idx_hospitals_status_name (status, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hospital_services (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  hospital_id BIGINT UNSIGNED NOT NULL,
  service_name VARCHAR(200) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  source_url VARCHAR(1000) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hospital_services_name (hospital_id, service_name),
  CONSTRAINT fk_hospital_services_hospital
    FOREIGN KEY (hospital_id) REFERENCES hospitals (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
