const notificationService = require('./notificationService');

class AlertService {
  constructor() {
    // Distancia en cm: menor distancia = agua más alta
    this.thresholdHigh = parseFloat(process.env.ALERT_DIST_HIGH) || 100; // aviso
    this.thresholdCritical = parseFloat(process.env.ALERT_DIST_CRITICAL) || 5; // crítico (por defecto 5cm)
    this.cooldownSeconds = parseInt(process.env.ALERT_COOLDOWN_SECONDS) || 60 * 30; // 30 minutos por defecto

    // Map sensorId -> timestamp (ms) última alerta enviada
    this.lastAlertAt = new Map();
  }

  _shouldSend(sensorId, level) {
    const key = `${sensorId}:${level}`;
    const last = this.lastAlertAt.get(key) || 0;
    const now = Date.now();
    if (now - last < this.cooldownSeconds * 1000) return false;
    this.lastAlertAt.set(key, now);
    return true;
  }

  _formatMessage(sensor, levelName) {
    const dist = sensor.dist_cm != null ? `${sensor.dist_cm} cm` : 'N/A';
    const depth = sensor.depth_cm != null ? `${sensor.depth_cm} cm` : 'N/A';
    return `⚠️ Alerta de nivel de río (${levelName})\n` +
      `Sensor: ${sensor._id || 'unknown'}\n` +
      `Distancia sensor-agua: ${dist}\n` +
      `Profundidad (si aplica): ${depth}\n` +
      `Timestamp: ${sensor.receivedAt || new Date().toISOString()}\n` +
      `Mensaje: Precaución — el nivel del río está ${levelName === 'CRÍTICO' ? 'MUY' : ''} alto.`;
  }

  async checkAndNotify(sensor) {
    try {
      const sensorId = sensor._id || sensor.id || 'unknown';
      const dist = Number(sensor.dist_cm);
      if (!Number.isFinite(dist)) return { sent: false, reason: 'dist_cm no numérico' };

      let level = null;
      let levelName = null;
      if (dist <= this.thresholdCritical) {
        level = 'critical';
        levelName = 'CRÍTICO';
      } else if (dist <= this.thresholdHigh) {
        level = 'high';
        levelName = 'ALTO';
      } else {
        return { sent: false, reason: 'nivel normal' };
      }

      if (!this._shouldSend(sensorId, level)) {
        return { sent: false, reason: 'cooldown' };
      }

      const message = this._formatMessage(sensor, levelName);

      // Enviar alerta por Telegram (se manda a suscriptores o al TELEGRAM_CHAT_ID configurado)
      try {
        await notificationService.sendTelegram(message);
      } catch (err) {
        console.error('[AlertService] Telegram send failed', err.message);
      }

      return { sent: true, level };
    } catch (err) {
      console.error('[AlertService] checkAndNotify error', err.message);
      return { sent: false, error: err.message };
    }
  }
}

module.exports = new AlertService();
