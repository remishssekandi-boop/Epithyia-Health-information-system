const express = require('express');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const categoriesController = require('../controllers/categoriesController');
const articlesController = require('../controllers/articlesController');

const router = express.Router();
const contentManagers = [requireAuth, requireRole('ADMIN', 'CONTENT_MANAGER')];

router.get('/categories', optionalAuth, categoriesController.list);
router.get('/categories/:id', optionalAuth, categoriesController.getById);
router.post('/categories', ...contentManagers, categoriesController.create);
router.put('/categories/:id', ...contentManagers, categoriesController.update);
router.delete('/categories/:id', ...contentManagers, categoriesController.remove);

router.get('/articles', optionalAuth, articlesController.list);
router.get('/articles/:id', optionalAuth, articlesController.getById);
router.post('/articles', ...contentManagers, articlesController.create);
router.put('/articles/:id', ...contentManagers, articlesController.update);
router.patch('/articles/:id/publish', ...contentManagers, articlesController.publish);
router.patch('/articles/:id/archive', ...contentManagers, articlesController.archive);
router.delete('/articles/:id', ...contentManagers, articlesController.remove);

module.exports = router;