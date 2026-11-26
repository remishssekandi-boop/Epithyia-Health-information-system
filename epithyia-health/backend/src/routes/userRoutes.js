const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const usersController = require('../controllers/usersController');

const router = express.Router();

router.use(requireAuth);
router.get('/me', usersController.getOwnProfile);
router.put('/me', usersController.updateOwnProfile);

router.use(requireRole('ADMIN'));
router.get('/', usersController.listUsers);
router.get('/:id', usersController.getUser);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deactivateUser);
router.patch('/:id/status', usersController.setUserStatus);
router.patch('/:id/role', usersController.changeUserRole);

module.exports = router;