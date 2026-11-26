function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateHospital(body) {
  const errors = [];
  if (!isObject(body)) return { errors: ['A JSON object is required.'], value: {} };

  const value = {};
  const fields = {
    name: ['Hospital name', 2, 200, true],
    location: ['Location', 2, 200, true],
    address: ['Address', 0, 500, false],
    phone: ['Telephone', 0, 50, false],
    description: ['Description', 2, 5000, true],
    operating_info: ['Operating information', 0, 2000, false],
    emergency_contact: ['Emergency contact', 0, 200, false],
  };

  for (const [field, [label, minimum, maximum, required]] of Object.entries(fields)) {
    const raw = body[field];
    if (raw === undefined && !required) {
      value[field] = '';
      continue;
    }
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (text.length < minimum || text.length > maximum) {
      errors.push(`${label} must be ${required ? 'between' : 'at most'} ${required ? `${minimum} and ` : ''}${maximum} characters.`);
    } else {
      value[field] = text;
    }
  }

  const imagePath = typeof body.image_path === 'string' ? body.image_path.trim() : '';
  try {
    const imageUrl = new URL(imagePath);
    if (imagePath.length > 500 || imageUrl.protocol !== 'https:' || !imageUrl.hostname || imageUrl.username || imageUrl.password) {
      throw new Error('invalid image URL');
    }
    value.image_path = imagePath;
  } catch {
    errors.push('A valid HTTPS image URL of at most 500 characters is required.');
  }

  const allowedFields = new Set([...Object.keys(fields), 'image_path']);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    errors.push('Only name, location, address, phone, description, operating_info, emergency_contact, and image_path may be provided.');
  }
  return { errors, value };
}

module.exports = { validateHospital };
