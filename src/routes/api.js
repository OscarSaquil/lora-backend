//src/routes/api.js
const express = require('express');
const router = express.Router();
const SensorData = require('../models/SensorData');
const AlertService = require('../services/alertService');

const onlyValidDefault = (q) => ({
  ...q,
  type: 'ultra',
  ok: true,
  dist_cm: { $exists: true }
});

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

// Seguridad simple para dispositivos
const requireDeviceKey = (req, res, next) => {
  const key = req.get('X-Device-Key');
  const expected = process.env.DEVICE_KEY;
  if (!expected) return next(); // opcional: sin llave en dev
  if (key !== expected) {
    return res.status(401).json({ success: false, error: 'DEVICE_KEY inválido' });
  }
  next();
};

// GET /api/data - Obtener todos los datos con paginación
router.get('/data', async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const onlyValid = (req.query.onlyValid ?? 'true') === 'true';
    const skip  = (page - 1) * limit;

    let query = {};
    if (onlyValid) query = onlyValidDefault(query);

    const [data, total] = await Promise.all([
      SensorData.find(query).sort({ receivedAt: -1 }).skip(skip).limit(limit),
      SensorData.countDocuments(query)
    ]);

    res.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// GET /api/data/latest - Obtener últimas N lecturas
router.get('/data/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const onlyValid = (req.query.onlyValid ?? 'true') === 'true';

    let query = {};
    if (onlyValid) query = onlyValidDefault(query);

    const data = await SensorData.find(query).sort({ receivedAt: -1 }).limit(limit);

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/data/stats - Estadísticas de las lecturas
router.get('/data/stats', async (req, res) => {
  try {
    const total = await SensorData.countDocuments();
    const successful = await SensorData.countDocuments(onlyValidDefault({}));
    const failed = total - successful;

    const avgStats = await SensorData.aggregate([
      { $match: onlyValidDefault({}) },
      { $group: {
          _id: null,
          avgDistance: { $avg: '$dist_cm' },
          avgDepth:    { $avg: '$depth_cm' },
          minDistance: { $min: '$dist_cm' },
          maxDistance: { $max: '$dist_cm' },
          minDepth:    { $min: '$depth_cm' },
          maxDepth:    { $max: '$depth_cm' },
          avgRssi:     { $avg: '$rssi' },
          avgSnr:      { $avg: '$snr' }
      } }
    ]);

    const latest = await SensorData.findOne(onlyValidDefault({})).sort({ receivedAt: -1 });

    res.json({
      success: true,
      stats: {
        total, successful, failed,
        successRate: total ? `${((successful/total)*100).toFixed(2)}%` : '0%',
        averages: avgStats[0] ?? null,
        latestReading: latest ?? null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// GET /api/data/range - Obtener datos en un rango de fechas
router.get('/data/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const onlyValid = (req.query.onlyValid ?? 'true') === 'true';
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate y endDate (ISO 8601) son requeridos' });
    }

    let query = {
      receivedAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };
    if (onlyValid) query = onlyValidDefault(query);

    const data = await SensorData.find(query).sort({ receivedAt: -1 });
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/data/:id - Obtener un dato específico por ID
router.get('/data/:id', async (req, res) => {
  try {
    const data = await SensorData.findById(req.params.id);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Dato no encontrado'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/data/:id - Eliminar un dato específico
router.delete('/data/:id', async (req, res) => {
  try {
    const data = await SensorData.findByIdAndDelete(req.params.id);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Dato no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Dato eliminado correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/ports - Listar puertos seriales disponibles
router.get('/ports', async (req, res) => {
  try {
    const SerialService = require('../services/serialService');
    const ports = await SerialService.listPorts();
    
    res.json({
      success: true,
      ports: ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer,
        serialNumber: p.serialNumber,
        pnpId: p.pnpId,
        vendorId: p.vendorId,
        productId: p.productId
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/data/lora - Recibir datos directamente del LoRa Receiver por WiFi
router.post('/data/lora', requireDeviceKey, async (req, res) => {
  try {
    const { data, rssi, snr, length, count } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, error: 'data requerido' });
    }

    // 1) Intenta parsear el JSON del sensor
    let payload;
    try { payload = JSON.parse(data); }
    catch {
      return res.status(400).json({ success: false, error: 'data no es JSON válido' });
    }

    // 2) Valida "sólo lo que te importa"
    const isUltra = payload?.type === 'ultra';
    const okTrue  = payload?.ok === true;
    const distOK  = isFiniteNumber(payload?.dist_cm);

    if (!(isUltra && okTrue && distOK)) {
      return res.status(422).json({
        success: false,
        error: 'Payload inválido (se requiere type=ultra, ok=true, dist_cm numérico)'
      });
    }

    // 3) Rango físico opcional (ajusta a tu instalación)
    if (payload.dist_cm < 0 || payload.dist_cm > 1000) {
      return res.status(422).json({ success: false, error: 'dist_cm fuera de rango' });
    }

    // 4) Construye documento limpio (guardamos crudo SOLO si válido)
    const doc = await SensorData.create({
      type: 'ultra',
      ok: true,
      dist_cm: payload.dist_cm,
      depth_cm: isFiniteNumber(payload.depth_cm) ? payload.depth_cm : undefined,
      h_cm:     isFiniteNumber(payload.h_cm)     ? payload.h_cm     : undefined,
      ts:       isFiniteNumber(payload.ts)       ? payload.ts       : undefined,
      rssi:     isFiniteNumber(rssi) ? rssi : undefined,
      snr:      isFiniteNumber(snr)  ? snr  : undefined,
      rawData:  JSON.stringify(payload),
      receivedAt: new Date()
    });

    // Ejecutar verificación de alertas en background (no bloquear respuesta)
    try {
      AlertService.checkAndNotify(doc.toObject()).catch(err => console.error('[AlertService]', err.message));
    } catch (err) {
      console.error('Error scheduling alert check', err.message);
    }

    return res.status(201).json({ success: true, data: { id: doc._id } });
  } catch (error) {
    console.error('[/api/data/lora]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


module.exports = router;
