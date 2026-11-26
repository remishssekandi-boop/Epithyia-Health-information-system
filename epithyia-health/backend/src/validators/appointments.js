function kampalaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateAppointment(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['A JSON object is required.'], value: {} };
  }

  const hospitalId = Number(body.hospital_id);
  if (!Number.isSafeInteger(hospitalId) || hospitalId < 1) {
    errors.push('A valid hospital_id is required.');
  }

  const appointmentDate = typeof body.appointment_date === 'string' ? body.appointment_date : '';
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)
    ? new Date(`${appointmentDate}T00:00:00.000Z`)
    : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== appointmentDate) {
    errors.push('appointment_date must be a valid date in YYYY-MM-DD format.');
  } else if (appointmentDate < kampalaDate()) {
    errors.push('appointment_date cannot be in the past.');
  }

  const appointmentTime = typeof body.appointment_time === 'string' ? body.appointment_time : '';
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime)) {
    errors.push('appointment_time must use 24-hour HH:MM format.');
  }

  const requestedService = body.requested_service === undefined
    ? ''
    : typeof body.requested_service === 'string' ? body.requested_service.trim() : null;
  if (requestedService === null || requestedService.length > 120) {
    errors.push('requested_service must be at most 120 characters.');
  }

  const allowedFields = new Set(['hospital_id', 'appointment_date', 'appointment_time', 'requested_service']);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    errors.push('Only hospital_id, appointment_date, appointment_time, and requested_service may be provided.');
  }
  return {
    errors,
    value: { hospital_id: hospitalId, appointment_date: appointmentDate, appointment_time: appointmentTime, requested_service: requestedService || '' },
  };
}

module.exports = { validateAppointment };
