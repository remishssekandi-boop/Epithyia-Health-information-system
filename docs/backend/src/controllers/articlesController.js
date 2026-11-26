const pool = require('../config/database');
const { recordAudit } = require('../utils/audit');
const {
  ARTICLE_STATUSES,
  validId,
  validateArticle,
  parsePagination,
} = require('../validators/healthContent');

const canManage = (req) => ['ADMIN', 'CONTENT_MANAGER'].includes(req.user?.role);
const ARTICLE_SELECT = `SELECT a.id, a.category_id, c.name AS category_name,
  a.title, a.summary, a.content, a.language, a.status, a.created_by,
  u.name AS created_by_name, a.created_at, a.updated_at, a.published_at
  FROM health_articles a
  INNER JOIN health_categories c ON c.id = a.category_id
  INNER JOIN users u ON u.id = a.created_by`;

function unexpected(res, error, context) {
  console.error(`${context}: ${error.message}`);
  return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
}

function parseArticleFilters(req, privileged) {
  const errors = [];
  const where = [];
  const parameters = [];
  const query = req.query;

  if (!privileged) {
    where.push("a.status = 'PUBLISHED'", "c.status = 'ACTIVE'");
    if (query.status !== undefined && query.status !== 'PUBLISHED') {
      errors.push('Only content managers can filter unpublished articles.');
    }
  } else if (query.status !== undefined) {
    if (!ARTICLE_STATUSES.has(query.status)) errors.push('status must be DRAFT, PUBLISHED, or ARCHIVED.');
    else {
      where.push('a.status = ?');
      parameters.push(query.status);
    }
  }

  if (query.category_id !== undefined) {
    const categoryId = validId(query.category_id);
    if (!categoryId) errors.push('category_id must be a positive integer.');
    else {
      where.push('a.category_id = ?');
      parameters.push(categoryId);
    }
  }
  if (query.language !== undefined) {
    const language = typeof query.language === 'string' ? query.language.trim() : '';
    if (!language || language.length > 32) errors.push('language must be between 1 and 32 characters.');
    else {
      where.push('a.language = ?');
      parameters.push(language);
    }
  }
  if (query.q !== undefined) {
    const search = typeof query.q === 'string' ? query.q.trim() : '';
    if (!search || search.length > 120) errors.push('q must be between 1 and 120 characters.');
    else {
      where.push('(a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)');
      const pattern = `%${search}%`;
      parameters.push(pattern, pattern, pattern);
    }
  }

  const pagination = parsePagination(query);
  errors.push(...pagination.errors);
  const sort = query.sort || 'newest';
  const orderBy = {
    newest: 'a.created_at DESC, a.id DESC',
    oldest: 'a.created_at ASC, a.id ASC',
    title: 'a.title ASC, a.id ASC',
  }[sort];
  if (!orderBy) errors.push('sort must be newest, oldest, or title.');

  return {
    errors,
    whereSql: where.length ? ` WHERE ${where.join(' AND ')}` : '',
    parameters,
    limit: pagination.limit,
    offset: pagination.offset,
    orderBy: orderBy || 'a.created_at DESC, a.id DESC',
  };
}

async function list(req, res) {
  const privileged = canManage(req);
  const filters = parseArticleFilters(req, privileged);
  if (filters.errors.includes('Only content managers can filter unpublished articles.')) {
    return res.status(403).json({ success: false, message: 'Only content managers can filter unpublished articles.' });
  }
  if (filters.errors.length) return res.status(400).json({ success: false, message: 'Invalid article filters.', errors: filters.errors });
  try {
    const [articles] = await pool.execute(
      `${ARTICLE_SELECT}${filters.whereSql} ORDER BY ${filters.orderBy} LIMIT ? OFFSET ?`,
      [...filters.parameters, filters.limit, filters.offset],
    );
    const [[count]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM health_articles a
       INNER JOIN health_categories c ON c.id = a.category_id
       INNER JOIN users u ON u.id = a.created_by${filters.whereSql}`,
      filters.parameters,
    );
    return res.status(200).json({
      success: true,
      data: { articles, pagination: { limit: filters.limit, offset: filters.offset, total: Number(count.total) } },
    });
  } catch (error) {
    return unexpected(res, error, 'Article list failed');
  }
}

async function getById(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Article ID must be a positive integer.' });
  const visibility = canManage(req) ? '' : " AND a.status = 'PUBLISHED' AND c.status = 'ACTIVE'";
  try {
    const [rows] = await pool.execute(`${ARTICLE_SELECT} WHERE a.id = ?${visibility} LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Article not found.' });
    return res.status(200).json({ success: true, data: { article: rows[0] } });
  } catch (error) {
    return unexpected(res, error, 'Article lookup failed');
  }
}

async function activeCategoryExists(categoryId) {
  const [rows] = await pool.execute('SELECT id FROM health_categories WHERE id = ? AND status = \'ACTIVE\' LIMIT 1', [categoryId]);
  return rows.length > 0;
}

async function create(req, res) {
  const { errors, value } = validateArticle(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: 'Invalid article.', errors });
  try {
    if (!(await activeCategoryExists(value.category_id))) {
      return res.status(400).json({ success: false, message: 'An active health category is required.' });
    }
    const isDemoRecord = process.env.DATABASE_MODE === 'demo' && Number(req.user.is_demo) === 1;
    const [result] = await pool.execute(
      `INSERT INTO health_articles
         (category_id, title, summary, content, language, status, created_by${isDemoRecord ? ', is_demo' : ''})
       VALUES (?, ?, ?, ?, ?, 'DRAFT', ?${isDemoRecord ? ', 1' : ''})`,
      [value.category_id, value.title, value.summary, value.content, value.language || 'English', req.user.id],
    );
    await recordAudit({ userId: req.user.id, action: 'ARTICLE_CREATED', entity: 'health_articles', entityId: result.insertId, details: { status: 'DRAFT', category_id: value.category_id } });
    const [rows] = await pool.execute(`${ARTICLE_SELECT} WHERE a.id = ?`, [result.insertId]);
    return res.status(201).json({ success: true, data: { article: rows[0] } });
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ success: false, message: 'Health category does not exist.' });
    return unexpected(res, error, 'Article creation failed');
  }
}

async function update(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Article ID must be a positive integer.' });
  const { errors, value } = validateArticle(req.body, true);
  if (errors.length) return res.status(400).json({ success: false, message: 'Invalid article update.', errors });

  const fields = Object.keys(value);
  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  try {
    if (value.category_id !== undefined && !(await activeCategoryExists(value.category_id))) {
      return res.status(400).json({ success: false, message: 'An active health category is required.' });
    }
    const [result] = await pool.execute(`UPDATE health_articles SET ${assignments} WHERE id = ?`, [...fields.map((field) => value[field]), id]);
    if (result.affectedRows === 0) {
      const [exists] = await pool.execute('SELECT id FROM health_articles WHERE id = ?', [id]);
      if (!exists.length) return res.status(404).json({ success: false, message: 'Article not found.' });
    }
    await recordAudit({ userId: req.user.id, action: 'ARTICLE_UPDATED', entity: 'health_articles', entityId: id, details: { fields } });
    const [rows] = await pool.execute(`${ARTICLE_SELECT} WHERE a.id = ?`, [id]);
    return res.status(200).json({ success: true, data: { article: rows[0] } });
  } catch (error) {
    return unexpected(res, error, 'Article update failed');
  }
}

async function changeStatus(req, res, status) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Article ID must be a positive integer.' });
  if (!ARTICLE_STATUSES.has(status)) return res.status(400).json({ success: false, message: 'Invalid article status.' });
  try {
    const [result] = await pool.execute(
      `UPDATE health_articles SET published_at = CASE
         WHEN ? = 'PUBLISHED' AND status = 'ARCHIVED' THEN CURRENT_TIMESTAMP
         WHEN ? = 'PUBLISHED' THEN COALESCE(published_at, CURRENT_TIMESTAMP)
         ELSE published_at
       END,
       status = ?
       WHERE id = ?`,
      [status, status, status, id],
    );
    if (result.affectedRows === 0) {
      const [exists] = await pool.execute('SELECT id FROM health_articles WHERE id = ?', [id]);
      if (!exists.length) return res.status(404).json({ success: false, message: 'Article not found.' });
    }
    const action = status === 'PUBLISHED' ? 'ARTICLE_PUBLISHED' : 'ARTICLE_ARCHIVED';
    await recordAudit({ userId: req.user.id, action, entity: 'health_articles', entityId: id, details: { status } });
    const [rows] = await pool.execute(`${ARTICLE_SELECT} WHERE a.id = ?`, [id]);
    return res.status(200).json({ success: true, data: { article: rows[0] } });
  } catch (error) {
    return unexpected(res, error, 'Article status change failed');
  }
}

async function publish(req, res) {
  return changeStatus(req, res, 'PUBLISHED');
}

async function archive(req, res) {
  return changeStatus(req, res, 'ARCHIVED');
}

async function remove(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Article ID must be a positive integer.' });
  try {
    const [result] = await pool.execute('DELETE FROM health_articles WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Article not found.' });
    await recordAudit({ userId: req.user.id, action: 'ARTICLE_DELETED', entity: 'health_articles', entityId: id });
    return res.status(200).json({ success: true, data: { message: 'Article deleted.' } });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(409).json({ success: false, message: 'This article is referenced by another record and cannot be deleted.' });
    }
    return unexpected(res, error, 'Article deletion failed');
  }
}

module.exports = { list, getById, create, update, publish, archive, remove };