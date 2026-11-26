const pool = require('../config/database');
const { recordAudit } = require('../utils/audit');
const { validId, validateCategory } = require('../validators/healthContent');

const canManage = (req) => ['ADMIN', 'CONTENT_MANAGER'].includes(req.user?.role);
const SELECT_CATEGORY = `SELECT c.id, c.name, c.description, c.status, c.created_at, c.updated_at,
  (SELECT COUNT(*) FROM health_articles a WHERE a.category_id = c.id AND a.status = 'PUBLISHED') AS published_article_count,
  (SELECT COUNT(*) FROM health_articles a WHERE a.category_id = c.id) AS article_count
  FROM health_categories c`;

function unexpected(res, error, context) {
  console.error(`${context}: ${error.message}`);
  return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
}

async function list(req, res) {
  const privileged = canManage(req);
  const includeInactive = req.query.includeInactive;
  if (includeInactive !== undefined && !['true', 'false'].includes(includeInactive)) {
    return res.status(400).json({ success: false, message: 'includeInactive must be true or false.' });
  }
  if (includeInactive === 'true' && !privileged) {
    return res.status(403).json({ success: false, message: 'Only content managers can view inactive categories.' });
  }
  const where = privileged && includeInactive !== 'false' ? '' : " WHERE c.status = 'ACTIVE'";
  try {
    const [categories] = await pool.execute(`${SELECT_CATEGORY}${where} ORDER BY c.name ASC`);
    return res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    return unexpected(res, error, 'Category list failed');
  }
}

async function getById(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Category ID must be a positive integer.' });
  const visibility = canManage(req) ? '' : " AND c.status = 'ACTIVE'";
  try {
    const [rows] = await pool.execute(`${SELECT_CATEGORY} WHERE c.id = ?${visibility} LIMIT 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Category not found.' });
    return res.status(200).json({ success: true, data: { category: rows[0] } });
  } catch (error) {
    return unexpected(res, error, 'Category lookup failed');
  }
}

async function create(req, res) {
  const { errors, value } = validateCategory(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: 'Invalid category.', errors });
  try {
    const isDemoRecord = process.env.DATABASE_MODE === 'demo' && Number(req.user.is_demo) === 1;
    const [result] = await pool.execute(
      `INSERT INTO health_categories (name, description, status${isDemoRecord ? ', is_demo' : ''})
       VALUES (?, ?, ?${isDemoRecord ? ', 1' : ''})`,
      [value.name, value.description, value.status || 'ACTIVE'],
    );
    await recordAudit({ userId: req.user.id, action: 'CATEGORY_CREATED', entity: 'health_categories', entityId: result.insertId, details: { name: value.name } });
    const [rows] = await pool.execute(`${SELECT_CATEGORY} WHERE c.id = ?`, [result.insertId]);
    return res.status(201).json({ success: true, data: { category: rows[0] } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A category with that name already exists.' });
    return unexpected(res, error, 'Category creation failed');
  }
}

async function update(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Category ID must be a positive integer.' });
  const { errors, value } = validateCategory(req.body, true);
  if (errors.length) return res.status(400).json({ success: false, message: 'Invalid category update.', errors });
  const fields = Object.keys(value);
  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  try {
    const [result] = await pool.execute(`UPDATE health_categories SET ${assignments} WHERE id = ?`, [...fields.map((field) => value[field]), id]);
    if (result.affectedRows === 0) {
      const [exists] = await pool.execute('SELECT id FROM health_categories WHERE id = ?', [id]);
      if (!exists.length) return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    await recordAudit({ userId: req.user.id, action: 'CATEGORY_UPDATED', entity: 'health_categories', entityId: id, details: { fields } });
    const [rows] = await pool.execute(`${SELECT_CATEGORY} WHERE c.id = ?`, [id]);
    return res.status(200).json({ success: true, data: { category: rows[0] } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A category with that name already exists.' });
    return unexpected(res, error, 'Category update failed');
  }
}

async function remove(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Category ID must be a positive integer.' });
  try {
    const [result] = await pool.execute('DELETE FROM health_categories WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Category not found.' });
    await recordAudit({ userId: req.user.id, action: 'CATEGORY_DELETED', entity: 'health_categories', entityId: id });
    return res.status(200).json({ success: true, data: { message: 'Category deleted.' } });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(409).json({ success: false, message: 'This category is still referenced by articles. Reassign or remove those articles before deleting it.' });
    }
    return unexpected(res, error, 'Category deletion failed');
  }
}

module.exports = { list, getById, create, update, remove };