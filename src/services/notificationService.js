const axios = require('axios');
const Subscriber = require('../models/Subscriber');

class NotificationService {
  constructor() {
    this.telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!this.telegramToken) {
      console.info('NotificationService: Telegram token not set (TELEGRAM_BOT_TOKEN)');
    }
  }

  /**
   * Send a Telegram message. If `chatId` is omitted, send to all subscribers
   * stored in the DB. If no subscribers exist, fallback to `TELEGRAM_CHAT_ID`.
   */
  async sendTelegram(message, chatId) {
    if (!this.telegramToken) {
      throw new Error('Telegram no configurado (falta TELEGRAM_BOT_TOKEN)');
    }

    // If chatId explicitly provided, send only there
    if (chatId) {
      return this._postMessage(chatId, message);
    }

    // Otherwise send to all subscribers
    const subs = await Subscriber.find({}).select('chatId -_id').lean();
    const ids = (subs && subs.length) ? subs.map(s => s.chatId) : (this.telegramChatId ? [this.telegramChatId] : []);

    if (!ids || ids.length === 0) {
      throw new Error('No hay destinatarios configurados para Telegram (subs o TELEGRAM_CHAT_ID)');
    }

    const results = await Promise.all(ids.map(id => this._postMessage(id, message).catch(err => ({ error: err.message, chatId: id }))));
    return results;
  }

  async _postMessage(chatId, message) {
    const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
    const resp = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    return resp.data;
  }
}

module.exports = new NotificationService();
