const ARTICLE_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const CATEGORY_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

function validId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateCategory(body, partial = false) {
  const errors = [];
  if (!isObject(body)) return { errors: ['A JSON object is required.'], value: {} };
  const value = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 120) errors.push('Category name must be between 2 and 120 characters.');
    else value.name = name;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'description')) {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (Buffer.byteLength(description, 'utf8') > 65535) errors.push('Category description is too long.');
    else value.description = description;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (!CATEGORY_STATUSES.has(body.status)) errors.push('Category status must be ACTIVE or INACTIVE.');
    else value.status = body.status;
  }
  const allowed = new Set(['name', 'description', 'status']);
  if (Object.keys(body).some((field) => !allowed.has(field))) errors.push('Only name, description, and status may be provided.');
  if (partial && Object.keys(value).length === 0 && errors.length === 0) errors.push('Provide at least one category field to update.');
  return { errors, value };
}

function validateArticle(body, partial = false) {
  const errors = [];
  if (!isObject(body)) return { errors: ['A JSON object is required.'], value: {} };
  const value = {};
  const fields = ['category_id', 'title', 'summary', 'content', 'language'];

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'category_id')) {
    const categoryId = Number(body.category_id);
    if (!Number.isSafeInteger(categoryId) || categoryId < 1) errors.push('A positive category_id is required.');
    else value.category_id = categoryId;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length < 3 || title.length > 200) errors.push('Article title must be between 3 and 200 characters.');
    else value.title = title;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'summary')) {
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    if (summary.length < 1 || summary.length > 500) errors.push('Article summary must be between 1 and 500 characters.');
    else value.summary = summary;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'content')) {
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (content.length < 1 || Buffer.byteLength(content, 'utf8') > 16000000) errors.push('Article content is required and must be at most 16 MB.');
    else value.content = content;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'language') || !partial) {
    const language = body.language === undefined && !partial ? 'English' : body.language;
    if (typeof language !== 'string' || language.trim().length < 2 || language.trim().length > 32) errors.push('Language must be between 2 and 32 characters.');
    else value.language = language.trim();
  }

  if (Object.keys(body).some((field) => !fields.includes(field))) {
    errors.push('Only category_id, title, summary, content, and language may be provided; use publish/archive endpoints for status.');
  }
  if (partial && Object.keys(value).length === 0 && errors.length === 0) errors.push('Provide at least one article field to update.');
  return { errors, value };
}

function parsePagination(query) {
  const errors = [];
  const parse = (value, fallback, name, minimum, maximum) => {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) {
      errors.push(`${name} must be an integer.`);
      return fallback;
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
      errors.push(`${name} must be between ${minimum} and ${maximum}.`);
      return fallback;
    }
    return number;
  };

  return {
    errors,
    limit: parse(query.limit, 20, 'limit', 1, 100),
    offset: parse(query.offset, 0, 'offset', 0, Number.MAX_SAFE_INTEGER),
  };
}

module.exports = {
  ARTICLE_STATUSES,
  CATEGORY_STATUSES,
  validId,
  validateCategory,
  validateArticle,
  parsePagination,
};