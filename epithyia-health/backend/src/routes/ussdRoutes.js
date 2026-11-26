const express = require('express');
const ussdController = require('../controllers/ussdController');

const router = express.Router();

router.post('/simulator/start', ussdController.startSimulator);
router.post('/simulator/continue', ussdController.continueSimulator);
router.get('/sessions/:sessionId/events', ussdController.sessionHistory);
router.post('/providers/africas-talking', ussdController.africaTalkingWebhook);

module.exports = router;
