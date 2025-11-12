//src/models/SensorData.js
const mongoose = require('mongoose');

const isFiniteNumber = v => typeof v === 'number' && Number.isFinite(v);

const sensorDataSchema = new mongoose.Schema({
  type: { type: String, default: 'ultra', index: true }, // único tipo permitido
  ok:   { type: Boolean, required: true, index: true },

  // Métricas del sensor (parseadas, NO confiar en rawData)
  dist_cm:  { type: Number },
  depth_cm: { type: Number },
  h_cm:     { type: Number },
  ts:       { type: Number },

  // Radio
  rssi: { type: Number },
  snr:  { type: Number },

  // Crudo sólo cuando el payload fue válido (opcional)
  rawData: { type: String },

  receivedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

// Validaciones suaves (si vienen, que sean números finitos)
sensorDataSchema.path('dist_cm').validate(v => (v === undefined) || isFiniteNumber(v), 'dist_cm inválido');
sensorDataSchema.path('depth_cm').validate(v => (v === undefined) || isFiniteNumber(v), 'depth_cm inválido');
sensorDataSchema.path('h_cm').validate(v => (v === undefined) || isFiniteNumber(v), 'h_cm inválido');

sensorDataSchema.index({ type: 1, ok: 1, receivedAt: -1 });

module.exports = mongoose.model('SensorData', sensorDataSchema);
