const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  // Tipo de dato recibido
  type: {
    type: String,
    default: 'ultra'
  },
  
  // Indica si la lectura fue exitosa
  ok: {
    type: Boolean,
    required: true
  },
  
  // Distancia medida por el sensor (cm)
  dist_cm: {
    type: Number,
    required: false
  },
  
  // Profundidad calculada (cm)
  depth_cm: {
    type: Number,
    required: false
  },
  
  // Altura del sensor sobre el nivel 0 (cm)
  h_cm: {
    type: Number,
    required: false
  },
  
  // Timestamp del dispositivo (millis)
  ts: {
    type: Number,
    required: false
  },
  
  // RSSI del paquete LoRa (dBm)
  rssi: {
    type: Number,
    required: false
  },
  
  // SNR del paquete LoRa
  snr: {
    type: Number,
    required: false
  },
  
  // Texto raw recibido
  rawData: {
    type: String,
    required: false
  },
  
  // Timestamp del servidor
  receivedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para consultas eficientes
sensorDataSchema.index({ receivedAt: -1 });
sensorDataSchema.index({ ok: 1 });
sensorDataSchema.index({ type: 1 });

module.exports = mongoose.model('SensorData', sensorDataSchema);
