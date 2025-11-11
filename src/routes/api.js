const express = require('express');
const router = express.Router();
const SensorData = require('../models/SensorData');

// GET /api/data - Obtener todos los datos con paginación
router.get('/data', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const data = await SensorData.find()
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SensorData.countDocuments();

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/data/latest - Obtener últimas N lecturas
router.get('/data/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const data = await SensorData.find()
      .sort({ receivedAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/data/stats - Estadísticas de las lecturas
router.get('/data/stats', async (req, res) => {
  try {
    const total = await SensorData.countDocuments();
    const successful = await SensorData.countDocuments({ ok: true });
    const failed = await SensorData.countDocuments({ ok: false });

    // Promedio de distancia y profundidad (solo lecturas exitosas)
    const avgStats = await SensorData.aggregate([
      { $match: { ok: true, dist_cm: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgDistance: { $avg: '$dist_cm' },
          avgDepth: { $avg: '$depth_cm' },
          minDistance: { $min: '$dist_cm' },
          maxDistance: { $max: '$dist_cm' },
          minDepth: { $min: '$depth_cm' },
          maxDepth: { $max: '$depth_cm' },
          avgRssi: { $avg: '$rssi' },
          avgSnr: { $avg: '$snr' }
        }
      }
    ]);

    const latest = await SensorData.findOne().sort({ receivedAt: -1 });

    res.json({
      success: true,
      stats: {
        total,
        successful,
        failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : '0%',
        averages: avgStats.length > 0 ? avgStats[0] : null,
        latestReading: latest
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/data/range - Obtener datos en un rango de fechas
router.get('/data/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren parámetros startDate y endDate (formato ISO 8601)'
      });
    }

    const data = await SensorData.find({
      receivedAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ receivedAt: -1 });

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
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
router.post('/data/lora', async (req, res) => {
  try {
    const { data, rssi, snr, length, count } = req.body;

    console.log('📡 Datos recibidos por WiFi desde LoRa:', req.body);

    // Preparar datos para guardar
    let dataToSave = {
      rawData: data,
      rssi,
      snr,
      ok: false
    };

    // Intentar parsear el campo "data" que viene del sender
    if (data) {
      try {
        const sensorData = JSON.parse(data);
        dataToSave = { ...dataToSave, ...sensorData };
        console.log('📊 Datos del sensor parseados:', sensorData);
      } catch (e) {
        // Si no es JSON, guardar como texto plano
        console.log('📝 Datos de texto:', data);
      }
    }

    // Guardar en MongoDB
    const sensorData = new SensorData(dataToSave);
    await sensorData.save();
    
    console.log(`💾 Datos guardados en MongoDB con ID: ${sensorData._id}`);

    res.json({
      success: true,
      message: 'Datos recibidos y guardados correctamente',
      id: sensorData._id
    });

  } catch (error) {
    console.error('❌ Error al procesar datos WiFi:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
