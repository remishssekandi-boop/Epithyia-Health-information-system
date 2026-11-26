const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const hospitalsController = require('../controllers/hospitalsController');

const router = express.Router();

router.get('/', hospitalsController.list);
router.post('/', requireAuth, requireRole('ADMIN'), hospitalsController.create);
router.get('/:slug', hospitalsController.getBySlug);

module.exports = router;
