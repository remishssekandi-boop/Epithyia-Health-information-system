const express = require('express');
const authRateLimit = require('../middleware/authRateLimit');
const { requireAuth } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/register', authRateLimit, authController.register);
router.post('/login', authRateLimit, authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);
router.put('/change-password', requireAuth, authRateLimit, authController.changePassword);

module.exports = router;