const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const appointmentsController = require('../controllers/appointmentsController');

const router = express.Router();

router.use(requireAuth);
router.get('/', appointmentsController.list);
router.post('/', requireRole('USER'), appointmentsController.create);
router.patch('/:id/status', requireRole('ADMIN'), appointmentsController.updateStatus);

module.exports = router;
