const { timingSafeEqual } = require('node:crypto');
const ussd = require('../services/ussdService');

function sendError(res, error) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(`USSD request failed: ${error.message}`);
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'USSD service unavailable.' : error.message,
  });
}

async function startSimulator(req, res) {
  try {
    const result = await ussd.startSession({ phoneNumber: req.body?.phoneNumber });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error);
  }
}

async function continueSimulator(req, res) {
  try {
    const result = await ussd.processUssd({
      sessionId: req.body?.sessionId,
      phoneNumber: req.body?.phoneNumber,
      text: req.body?.text,
      provider: 'simulator',
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error);
  }
}

async function sessionHistory(req, res) {
  try {
    const events = await ussd.getSessionHistory(req.params.sessionId);
    return res.status(200).json({ success: true, data: { events } });
  } catch (error) {
    return sendError(res, error);
  }
}

function sameSecret(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

async function africaTalkingWebhook(req, res) {
  const token = process.env.USSD_PROVIDER_TOKEN;
  if (!token) {
    return res.status(503).type('text').send('END USSD provider is not configured.');
  }
  if (!sameSecret(req.get('X-USSD-Provider-Token'), token)) {
    return res.status(401).type('text').send('END Unauthorized USSD request.');
  }
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.status(400).type('text').send('END HTTPS is required.');
  }

  const { sessionId, phoneNumber, text, serviceCode } = req.body || {};
  if (typeof serviceCode !== 'string' || serviceCode.length > 100) {
    return res.status(400).type('text').send('END Invalid service code.');
  }
  try {
    const result = await ussd.processUssd({
      sessionId,
      phoneNumber,
      text: text || '',
      provider: 'africas-talking',
    });
    return res.status(200).type('text').send(result.response);
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(`USSD provider request failed: ${error.message}`);
    return res.status(status).type('text').send(status >= 500
      ? 'END USSD service unavailable.'
      : `END ${error.message}`);
  }
}

module.exports = { startSimulator, continueSimulator, sessionHistory, africaTalkingWebhook };
