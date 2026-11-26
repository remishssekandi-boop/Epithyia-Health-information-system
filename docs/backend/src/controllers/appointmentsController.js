const pool = require('../config/database');
const { recordAudit } = require('../utils/audit');
const { validateAppointment } = require('../validators/appointments');

const APPOINTMENT_SELECT = `SELECT a.id, a.hospital_id, h.name AS hospital_name, h.phone AS hospital_phone,
  a.appointment_date, a.appointment_time, a.requested_service, a.status, a.created_at`;

function unexpected(res, error, context) {
  console.error(`${context}: ${error.message}`);
  return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
}

function formatAppointments(appointments) {
  return appointments.map((appointment) => {
    const date = appointment.appointment_date;
    return {
      ...appointment,
      appointment_date: date instanceof Date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : String(date).slice(0, 10),
      appointment_time: String(appointment.appointment_time).slice(0, 5),
    };
  });
}

async function list(req, res) {
  try {
    const admin = req.user.role === 'ADMIN';
    const [appointments] = await pool.execute(
      `${APPOINTMENT_SELECT}${admin ? ', u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone' : ''}
       FROM appointments a
       INNER JOIN hospitals h ON h.id = a.hospital_id
       ${admin ? 'INNER JOIN users u ON u.id = a.user_id' : ''}
       ${admin ? '' : 'WHERE a.user_id = ?'}
       ORDER BY a.appointment_date ASC, a.appointment_time ASC, a.id DESC`,
      admin ? [] : [req.user.id],
    );
    return res.status(200).json({ success: true, data: { appointments: formatAppointments(appointments) } });
  } catch (error) {
    return unexpected(res, error, 'Appointment list failed');
  }
}

async function create(req, res) {
  const { errors, value } = validateAppointment(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: 'Invalid appointment request.', errors });
  try {
    const [hospitals] = await pool.execute(
      "SELECT id FROM hospitals WHERE id = ? AND status = 'ACTIVE' LIMIT 1",
      [value.hospital_id],
    );
    if (hospitals.length === 0) {
      return res.status(400).json({ success: false, message: 'Choose an active hospital from the directory.' });
    }

    const isDemoRecord = process.env.DATABASE_MODE === 'demo' && Number(req.user.is_demo) === 1;
    const [result] = await pool.execute(
      `INSERT INTO appointments
         (user_id, hospital_id, appointment_date, appointment_time, requested_service, status${isDemoRecord ? ', is_demo' : ''})
       VALUES (?, ?, ?, ?, ?, 'REQUESTED'${isDemoRecord ? ', 1' : ''})`,
      [req.user.id, value.hospital_id, value.appointment_date, value.appointment_time, value.requested_service || null],
    );
    await recordAudit({
      userId: req.user.id,
      action: 'APPOINTMENT_REQUESTED',
      entity: 'appointments',
      entityId: result.insertId,
      details: { hospital_id: value.hospital_id, appointment_date: value.appointment_date },
    });
    const [appointments] = await pool.execute(
      `${APPOINTMENT_SELECT} FROM appointments a
       INNER JOIN hospitals h ON h.id = a.hospital_id
       WHERE a.id = ? AND a.user_id = ? LIMIT 1`,
      [result.insertId, req.user.id],
    );
    return res.status(201).json({ success: true, data: { appointment: formatAppointments(appointments)[0] } });
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: 'The selected hospital or account is no longer available.' });
    }
    return unexpected(res, error, 'Appointment request failed');
  }
}

async function updateStatus(req, res) {
  const id = typeof req.params.id === 'string' && /^\d+$/.test(req.params.id)
    ? Number(req.params.id)
    : 0;
  const status = req.body?.status;
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: 'Appointment ID must be a positive integer.' });
  }
  if (!['CONFIRMED', 'DECLINED'].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be CONFIRMED or DECLINED.' });
  }
  if (Object.keys(req.body || {}).some((field) => field !== 'status')) {
    return res.status(400).json({ success: false, message: 'Only status may be provided.' });
  }

  try {
    const [result] = await pool.execute(
      "UPDATE appointments SET status = ? WHERE id = ? AND status = 'REQUESTED'",
      [status, id],
    );
    if (result.affectedRows === 0) {
      const [existing] = await pool.execute('SELECT id, status FROM appointments WHERE id = ? LIMIT 1', [id]);
      if (existing.length === 0) return res.status(404).json({ success: false, message: 'Appointment request not found.' });
      return res.status(409).json({ success: false, message: 'This appointment request has already been handled.' });
    }
    await recordAudit({
      userId: req.user.id,
      action: `APPOINTMENT_${status}`,
      entity: 'appointments',
      entityId: id,
      details: { status },
    });
    const [appointments] = await pool.execute(
      `${APPOINTMENT_SELECT}, u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM appointments a
       INNER JOIN hospitals h ON h.id = a.hospital_id
       INNER JOIN users u ON u.id = a.user_id
       WHERE a.id = ? LIMIT 1`,
      [id],
    );
    return res.status(200).json({ success: true, data: { appointment: formatAppointments(appointments)[0] } });
  } catch (error) {
    return unexpected(res, error, 'Appointment status update failed');
  }
}

module.exports = { list, create, updateStatus };
