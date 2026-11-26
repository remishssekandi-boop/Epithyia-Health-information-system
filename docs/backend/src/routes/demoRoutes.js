const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const demoController = require('../controllers/demoController');

const router = express.Router();

router.use(requireAuth, requireRole('ADMIN'));
router.get('/activity', demoController.activity);
router.post('/sessions/clear', demoController.clearSessions);
router.post('/reset', demoController.reset);

module.exports = router;
