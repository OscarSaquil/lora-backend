const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const notificationService = require('../services/notificationService');

/**
 * Webhook endpoint for Telegram updates.
 * Registers users that send /start to the bot.
 */
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    const msg = update.message || update.edited_message;
    if (!msg || !msg.chat) return res.sendStatus(200);

    const chatId = String(msg.chat.id);
    const from = msg.from || {};
    const name = from.username || `${from.first_name || ''} ${from.last_name || ''}`.trim();

    if (msg.text && msg.text.trim().startsWith('/start')) {
      await Subscriber.updateOne({ chatId }, { $set: { name } }, { upsert: true });
      return res.sendStatus(200);
    }

    // Optionally handle unsubscribe command
    if (msg.text && msg.text.trim().startsWith('/stop')) {
      await Subscriber.deleteOne({ chatId });
      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('[Telegram webhook]', err.message);
    res.sendStatus(500);
  }
});

// Manual subscribe endpoint (useful if users provide chatId externally)
router.post('/subscribe', async (req, res) => {
  try {
    const { chatId, name } = req.body;
    if (!chatId) return res.status(400).json({ success: false, error: 'chatId required' });
    await Subscriber.updateOne({ chatId: String(chatId) }, { $set: { name } }, { upsert: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ success: false, error: 'chatId required' });
    await Subscriber.deleteOne({ chatId: String(chatId) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List subscribers (for admin/testing)
router.get('/subscribers', async (req, res) => {
  try {
    const subs = await Subscriber.find({}).select('-__v').lean();
    res.json({ success: true, count: subs.length, subscribers: subs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-protected broadcast endpoint: sends `message` to all subscribers
router.post('/broadcast', async (req, res) => {
  try {
    const apiKey = process.env.ADMIN_API_KEY;
    if (apiKey) {
      const provided = req.get('X-API-KEY');
      if (!provided || provided !== apiKey) {
        return res.status(401).json({ success: false, error: 'Invalid API key' });
      }
    }

    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message required' });

    const results = await notificationService.sendTelegram(message);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

