require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/database');
const SerialService = require('./services/serialService');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Conectar a MongoDB
connectDB();

// Rutas
app.use('/api', apiRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'Backend LoRa - WiFi LoRa 32 V3',
    version: '1.0.0',
    mode: process.env.NODE_ENV || 'development',
    serialEnabled: !!process.env.SERIAL_PORT,
    endpoints: {
      'GET /api/data': 'Obtener todos los datos (paginado)',
      'GET /api/data/latest': 'Obtener últimas lecturas',
      'GET /api/data/stats': 'Estadísticas de las lecturas',
      'GET /api/data/range': 'Datos en rango de fechas',
      'GET /api/data/:id': 'Obtener dato por ID',
      'DELETE /api/data/:id': 'Eliminar dato por ID',
      'POST /api/data/lora': 'Recibir datos del LoRa Receiver por WiFi',
      'GET /api/ports': 'Listar puertos seriales disponibles'
    }
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado'
  });
});

// Inicializar servicio serial solo si está configurado
let serialService = null;
if (process.env.SERIAL_PORT && process.env.NODE_ENV !== 'production') {
  serialService = new SerialService();
}

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 Modo: ${process.env.NODE_ENV || 'development'}`);
  
  // Intentar conectar al puerto serial solo en desarrollo
  if (serialService) {
    try {
      await serialService.connect();
    } catch (error) {
      console.error('⚠️ No se pudo conectar al puerto serial. Asegúrate de:');
      console.error('   1. Configurar correctamente SERIAL_PORT en .env');
      console.error('   2. Que el dispositivo esté conectado');
      console.error('   3. Que no esté siendo usado por otro programa (Arduino IDE, etc.)');
      console.error('\n💡 Puedes listar puertos disponibles en: GET /api/ports');
      console.error('\n📡 El sistema continuará funcionando y recibirá datos por WiFi (POST /api/data/lora)');
    }
  } else {
    console.log('📡 Modo WiFi: El sistema recibirá datos por HTTP POST en /api/data/lora');
  }
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n⏹️ Cerrando servidor...');
  if (serialService) {
    await serialService.disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️ Cerrando servidor...');
  if (serialService) {
    await serialService.disconnect();
  }
  process.exit(0);
});
