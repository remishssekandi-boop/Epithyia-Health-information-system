-- Demonstration-only data. The article bodies below are not medical advice.
-- Password values are bcrypt hashes generated with bcryptjs (cost 12).
-- Demo passwords are documented in README.md and must not be reused in production.

INSERT INTO roles (name, description) VALUES
  ('ADMIN', 'Demonstration administrator role.'),
  ('CONTENT_MANAGER', 'Demonstration health-content manager role.'),
  ('HEALTH_WORKER', 'Demonstration health-worker role.'),
  ('USER', 'Demonstration community user role.')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO users (name, email, phone, password_hash, role_id, status)
SELECT 'Demo Administrator', 'admin.demo@epithyia.local', '+256700000001', '$2b$12$kKQXYv.VwcB.acSqURxwoOqXaWybZoSX68hMxXqQoPcMr6CgPjcQW', id, 'ACTIVE'
FROM roles WHERE name = 'ADMIN'
ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role_id = VALUES(role_id), status = VALUES(status);

INSERT INTO users (name, email, phone, password_hash, role_id, status)
SELECT 'Demo Content Manager', 'content.demo@epithyia.local', '+256700000002', '$2b$12$MbqvsmRjiUFGiv1D6jWNkuQFm9U5dUQoKpcaZn9hohj81a6Nj2RKK', id, 'ACTIVE'
FROM roles WHERE name = 'CONTENT_MANAGER'
ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role_id = VALUES(role_id), status = VALUES(status);

INSERT INTO users (name, email, phone, password_hash, role_id, status)
SELECT 'Demo Health Worker', 'worker.demo@epithyia.local', '+256700000003', '$2b$12$9pGDvzNHw2e8Dub10/.qn.P5fvsBOBhuYWfXgYFvKKd1njMcvZiVK', id, 'ACTIVE'
FROM roles WHERE name = 'HEALTH_WORKER'
ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role_id = VALUES(role_id), status = VALUES(status);

INSERT INTO users (name, email, phone, password_hash, role_id, status)
SELECT 'Demo Community User', 'user.demo@epithyia.local', '+256700000004', '$2b$12$CrdxBuFlk1gnhGrmsF1IROU0Zv3bfNTjSGM9avK59l6AcO/U4XOXC', id, 'ACTIVE'
FROM roles WHERE name = 'USER'
ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role_id = VALUES(role_id), status = VALUES(status);

INSERT INTO health_categories (name, description, status) VALUES
  ('Maternal Health', 'Antenatal care, pregnancy preparation, and urgent warning signs.', 'ACTIVE'),
  ('Child Health', 'Child wellness visits, vaccination, illness warning signs, and caregiver questions.', 'ACTIVE'),
  ('Malaria', 'Malaria prevention, testing, symptoms, and timely care.', 'ACTIVE'),
  ('HIV and Sexual Health', 'Confidential testing, prevention, treatment, and reproductive health information.', 'ACTIVE'),
  ('Nutrition', 'Everyday nutrition for children and adults.', 'ACTIVE'),
  ('Immunization', 'Routine vaccine schedules and health-safety guidance.', 'ACTIVE'),
  ('Disease Prevention', 'Simple measures that reduce everyday infection risks.', 'ACTIVE'),
  ('Emergency Information', 'Recognizing severe warning signs and obtaining appropriate urgent care.', 'ACTIVE'),
  ('Hospital Access', 'Finding a hospital and preparing for a visit.', 'ACTIVE')
ON DUPLICATE KEY UPDATE description = VALUES(description), status = VALUES(status);

INSERT INTO health_articles (category_id, title, summary, content, language, status, created_by, published_at)
SELECT c.id,
       CONCAT('[DEMO ONLY] Information placeholder: ', c.name),
       'Demonstration record only. Replace with content reviewed and approved by qualified local health authorities.',
       CONCAT('DEMONSTRATION / SAMPLE CONTENT — NOT MEDICAL ADVICE. This record intentionally contains no health instructions or medical claims. Replace it with information reviewed and approved by qualified local health authorities before publication or community use. Topic: ', c.name, '.'),
       'English', 'DRAFT', u.id, NULL
FROM health_categories AS c
CROSS JOIN users AS u
WHERE u.email = 'admin.demo@epithyia.local'
  AND c.name IN ('Maternal Health', 'Child Health', 'Malaria', 'HIV/AIDS', 'Nutrition', 'Immunization', 'Sexual and Reproductive Health', 'Disease Prevention', 'Emergency Information')
  AND NOT EXISTS (
    SELECT 1 FROM health_articles AS existing
    WHERE existing.category_id = c.id AND existing.title = CONCAT('[DEMO ONLY] Information placeholder: ', c.name)
  );

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('demo_mode', 'true'),
  ('sample_content_notice', 'Demonstration data only. Health articles must be reviewed and approved by qualified local health authorities before publication.')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO hospitals
  (slug, name, location, address, phone, description, operating_info, emergency_contact, status, image_path, is_verified, is_demo)
VALUES
  ('mengo-hospital', 'Mengo Hospital', 'Mengo, Kampala, Uganda',
   'Sir Albert Cook Road, Mengo, Kampala, Uganda; P.O. Box 7161',
   '+256 771 370 263; +256 771 370 264; +256 757 143 951; +256 757 143 961; +256 312 307 100',
   'A Kampala hospital on Sir Albert Cook Road in Mengo.',
   'Accident and Emergency is advertised as 24/7. Clinic hours vary; call the hospital to confirm.',
   'No separate emergency number is published. Call the main hospital line and ask for Accident and Emergency.',
   'ACTIVE', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSByC5Cl5u25RdZQH2gd4fyy3VPRDGSv9R_gS8A_Y_XhQ&s=10', TRUE, TRUE),
  ('rubaga-hospital', 'Rubaga Hospital', 'Lubaga Hill, Kampala, Uganda',
   'Next to Lubaga Cathedral, Lubaga Hill, Kampala, Uganda; P.O. Box 14130',
   '+256 200 244 800',
   'A tertiary hospital located beside Lubaga Cathedral on Lubaga Hill.',
   'The hospital contact page states 24/7 service; KCCA lists the emergency department as 24/7. Clinic hours may vary.',
   'No separate emergency number is published. Call +256 200 244 800 and ask for the emergency department.',
   'ACTIVE', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS54jJRO2AF0DNbTmxTVPEfeDQ9NcZue0vzgJzKE6-mZg&s=10', TRUE, TRUE),
  ('old-kampala-hospital', 'Old Kampala Hospital', 'Old Kampala Hill, Kampala, Uganda',
   'Old Kampala Hill, opposite Old Kampala Police Post, Kampala, Uganda',
   '+256 752 024 333',
   'A hospital located on Old Kampala Hill, opposite the Old Kampala Police Post.',
   'The hospital advertises 24/7 service and a 24-hour Accident and Emergency unit. Clinic hours vary.',
   '+256 752 024 333 (published by the hospital for emergency care).',
   'ACTIVE', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwGsq8MwCH5N6StbiEJ6hAEx0YrrDoM6Lhwz68BGxWrQ&s=10', TRUE, TRUE),
  ('kibuli-hospital', 'Kibuli Muslim Hospital', 'Kibuli Hill, Makindye Division, Kampala, Uganda',
   'Kibuli Hill, off Prince Badru Kakungulu Road, Kampala, Uganda; P.O. Box 24548',
   '+256 414 236 476/7; +256 702 542 719',
   'A hospital on Kibuli Hill in Makindye Division, off Prince Badru Kakungulu Road.',
   'Emergency services are listed as 24/7 by KCCA. General and outpatient clinic hours are not published; call to confirm.',
   '+256 414 236 476/7 (published by the hospital as its emergency call number).',
   'ACTIVE', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmo-wmV-bP7ghPNQ0gy9Kiz_Ipzmf28yAc9yp2jnvgWg&s=10', TRUE, TRUE),
  ('mulago-hospital', 'Mulago National Referral Hospital', 'Mulago Hill, Kawempe North Division, Kampala, Uganda',
   'Mulago Hill, Kawempe North Division, Kampala, Uganda; P.O. Box 7051',
   '+256 414 554 008; +256 414 554 001',
   'Uganda’s national referral hospital, located on Mulago Hill in Kawempe North Division.',
   'Medical Emergency, surgical Accident and Emergency, and paediatric Acute Care operate 24/7. Assessment-centre walk-in clinics run during regular working hours; specialist schedules vary.',
   'Medical Emergency: +256 414 675 065; Acute Care Unit: +256 414 675 066.',
   'ACTIVE', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThwK-UcgW_tOtsB8eA_sCJJlPrFcjeGALh56eOVKKr9A&s=10', TRUE, TRUE),
  ('nakasero-hospital', 'Nakasero Hospital', 'Nakasero, Kampala, Uganda',
   '14A Akii Bua Road, Nakasero, Kampala, Uganda',
   '+256 312 531 400; +256 800 200 035; +256 776 970 220',
   'A private general hospital on Akii Bua Road in Nakasero, Kampala.',
   'The hospital describes 24/7 emergency support. Call ahead to confirm outpatient clinic schedules and service availability.',
   'The hospital provides 24/7 support. Call +256 312 531 400 or +256 800 200 035 and ask for the emergency department.',
   'ACTIVE', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5AF1PejntZq2UBMvAbKs5iKfJZPyzZniQnggZdwdq4g&s=10', TRUE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  location = VALUES(location),
  address = VALUES(address),
  phone = VALUES(phone),
  description = VALUES(description),
  operating_info = VALUES(operating_info),
  emergency_contact = VALUES(emergency_contact),
  status = VALUES(status),
  image_path = VALUES(image_path),
  is_verified = VALUES(is_verified),
  is_demo = VALUES(is_demo);

INSERT INTO hospital_services (hospital_id, service_name, is_verified, source_url) VALUES
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Internal medicine', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Surgery', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Eye care', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Obstetrics and gynecology', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Paediatrics', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Dental care', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Endocrinology and non-communicable diseases', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Pathology', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Outpatient care', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Public health and research', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Laboratory', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Mental health', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Accident and Emergency', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Intensive care', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Ambulance', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Blood bank', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'mengo-hospital'), 'Urology', TRUE, 'https://mengohospital.org/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'rubaga-hospital'), 'Cardiology', TRUE, 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'rubaga-hospital'), 'Surgery', TRUE, 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'rubaga-hospital'), 'Dialysis and transplant care', TRUE, 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'rubaga-hospital'), 'CT and MRI imaging', TRUE, 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'rubaga-hospital'), 'Intensive care', TRUE, 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'rubaga-hospital'), 'Maternity and paediatrics', TRUE, 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'rubaga-hospital'), 'ENT and neurosurgery', TRUE, 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'rubaga-hospital'), 'Dental care', TRUE, 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'rubaga-hospital'), 'Emergency department', TRUE, 'https://visitkampala.kcca.go.ug/business_details/lubaga-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'old-kampala-hospital'), 'Diagnostics and therapeutics', TRUE, 'https://oldkampalahospital.org/'),
  ((SELECT id FROM hospitals WHERE slug = 'old-kampala-hospital'), 'Eye care', TRUE, 'https://oldkampalahospital.org/'),
  ((SELECT id FROM hospitals WHERE slug = 'old-kampala-hospital'), 'Dental care', TRUE, 'https://oldkampalahospital.org/'),
  ((SELECT id FROM hospitals WHERE slug = 'old-kampala-hospital'), 'Primary care and medicine', TRUE, 'https://oldkampalahospital.org/'),
  ((SELECT id FROM hospitals WHERE slug = 'old-kampala-hospital'), 'Obstetrics and gynecology', TRUE, 'https://oldkampalahospital.org/'),
  ((SELECT id FROM hospitals WHERE slug = 'old-kampala-hospital'), 'Surgical services and neurosurgery', TRUE, 'https://oldkampalahospital.org/'),
  ((SELECT id FROM hospitals WHERE slug = 'old-kampala-hospital'), '24-hour Accident and Emergency', TRUE, 'https://oldkampalahospital.org/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Infectious disease and HIV clinic', TRUE, 'https://kibulimuslimhospital.ug/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Pharmacy', TRUE, 'https://kibulimuslimhospital.ug/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Paediatrics', TRUE, 'https://kibulimuslimhospital.ug/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Eye centre', TRUE, 'https://kibulimuslimhospital.ug/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Surgery and theatre', TRUE, 'https://kibulimuslimhospital.ug/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Radiology and imaging', TRUE, 'https://kibulimuslimhospital.ug/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Physiotherapy', TRUE, 'https://kibulimuslimhospital.ug/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Dental clinic', TRUE, 'https://kibulimuslimhospital.ug/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Laboratory', TRUE, 'https://kibulimuslimhospital.ug/services/'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Emergency, inpatient and outpatient care', TRUE, 'https://visitkampala.kcca.go.ug/business_details/kibuli-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'kibuli-hospital'), 'Maternity and dialysis', TRUE, 'https://visitkampala.kcca.go.ug/business_details/kibuli-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Paediatrics', TRUE, 'https://mulagohospital.go.ug/'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Surgery', TRUE, 'https://mulagohospital.go.ug/'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Internal medicine', TRUE, 'https://mulagohospital.go.ug/'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Radiology and imaging', TRUE, 'https://mulagohospital.go.ug/'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Clinical laboratory and pathology', TRUE, 'https://mulagohospital.go.ug/'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Nuclear medicine', TRUE, 'https://mulagohospital.go.ug/'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'ENT and neurology', TRUE, 'https://visitkampala.kcca.go.ug/business_details/mulago-national-referral-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Rheumatology and renal dialysis', TRUE, 'https://visitkampala.kcca.go.ug/business_details/mulago-national-referral-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Orthopedics', TRUE, 'https://visitkampala.kcca.go.ug/business_details/mulago-national-referral-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Obstetrics, gynecology and neonatology', TRUE, 'https://visitkampala.kcca.go.ug/business_details/mulago-national-referral-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'mulago-hospital'), 'Medical Emergency and Accident and Emergency', TRUE, 'https://mulagohospital.go.ug/contact2.html'),
  ((SELECT id FROM hospitals WHERE slug = 'nakasero-hospital'), 'Outpatient and inpatient care', TRUE, 'https://nakaserohospital.com/patient-support/'),
  ((SELECT id FROM hospitals WHERE slug = 'nakasero-hospital'), 'Emergency and critical care', TRUE, 'https://nakaserohospital.com/patient-support/'),
  ((SELECT id FROM hospitals WHERE slug = 'nakasero-hospital'), 'Surgery', TRUE, 'https://nakaserohospital.com/'),
  ((SELECT id FROM hospitals WHERE slug = 'nakasero-hospital'), 'Maternity and neonatal care', TRUE, 'https://nakaserohospital.com/'),
  ((SELECT id FROM hospitals WHERE slug = 'nakasero-hospital'), 'Diagnostics and imaging', TRUE, 'https://nakaserohospital.com/'),
  ((SELECT id FROM hospitals WHERE slug = 'nakasero-hospital'), 'Laboratory and pharmacy', TRUE, 'https://visitkampala.kcca.go.ug/business_details/nakasero-hospital'),
  ((SELECT id FROM hospitals WHERE slug = 'nakasero-hospital'), 'Specialist care', TRUE, 'https://nakaserohospital.com/'),
  ((SELECT id FROM hospitals WHERE slug = 'nakasero-hospital'), 'Physiotherapy and rehabilitation', TRUE, 'https://nakaserohospital.com/')
ON DUPLICATE KEY UPDATE
  is_verified = VALUES(is_verified),
  source_url = VALUES(source_url);

INSERT INTO ussd_menu_configs (menu_key, menu_text) VALUES
  ('HOME', 'EPITHYIA HEALTH DIRECTORY\n1. Hospital directory\n2. Hospital details\n3. Health guides on the website\n4. Emergency contacts\n5. About this guide\n6. Help\n0. End'),
  ('HELP', '1/2: Hospitals. Choose 1-6, then 1 phone 2 address 3 services 4 hours 5 emergency. 0 Back; 00 Main; 9 End.')
ON DUPLICATE KEY UPDATE menu_text = VALUES(menu_text);