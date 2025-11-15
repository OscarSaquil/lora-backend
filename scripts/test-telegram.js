// scripts/test-telegram.js
// Small script to test Telegram notification using existing notificationService

require('dotenv').config();
const notificationService = require('../src/services/notificationService');

async function run() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your environment.');
    process.exit(1);
  }

  const message = `Prueba de notificaciones: el backend de LoRa está enviando mensajes (timestamp: ${new Date().toISOString()})`;

  try {
    const resp = await notificationService.sendTelegram(message, chatId);
    console.log('Telegram response:', resp);
    process.exit(0);
  } catch (err) {
    console.error('Failed to send Telegram message:', err.message);
    process.exit(2);
  }
}

run();
