//src/services/serialService.js
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const SensorData = require('../models/SensorData');

class SerialService {
  constructor() {
    this.port = null;
    this.parser = null;
    this.isConnected = false;
  }

  // Inicializar conexión serial
  async connect() {
    try {
      const portPath = process.env.SERIAL_PORT;
      const baudRate = parseInt(process.env.SERIAL_BAUDRATE) || 115200;

      console.log(`📡 Intentando conectar al puerto serial: ${portPath} @ ${baudRate} baud`);

      this.port = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        autoOpen: false
      });

      // Parser para leer líneas completas
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      // Abrir puerto
      await new Promise((resolve, reject) => {
        this.port.open((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.isConnected = true;
      console.log(`✅ Puerto serial conectado: ${portPath}`);

      // Configurar listeners
      this.setupListeners();

    } catch (error) {
      console.error(`❌ Error al conectar puerto serial: ${error.message}`);
      throw error;
    }
  }

  // Configurar eventos del puerto serial
  setupListeners() {
    // Procesar datos recibidos
    this.parser.on('data', async (line) => {
      await this.processData(line);
    });

    // Manejo de errores
    this.port.on('error', (err) => {
      console.error(`❌ Error en puerto serial: ${err.message}`);
      this.isConnected = false;
    });

    // Manejo de cierre
    this.port.on('close', () => {
      console.log('⚠️ Puerto serial cerrado');
      this.isConnected = false;
    });
  }

  // Procesar y almacenar datos
  async processData(line) {
    try {
      const trimmed = line.trim();
      
      // Ignorar líneas vacías o de debug
      if (!trimmed || trimmed.startsWith('into RX') || trimmed.startsWith('Receiver listo')) {
        return;
      }

      console.log(`📥 Datos recibidos: ${trimmed}`);

      let dataToSave = {
        rawData: trimmed,
        ok: false
      };

      // Intentar parsear línea como JSON directo
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const receiverData = JSON.parse(trimmed);
          
          // receiverData contiene: {data: "...", rssi: -65, snr: 8, length: 50, count: 123}
          dataToSave.rssi = receiverData.rssi;
          dataToSave.snr = receiverData.snr;
          
          // Intentar parsear el campo "data" que viene del sender (JSON dentro de JSON)
          if (receiverData.data) {
            try {
              const sensorData = JSON.parse(receiverData.data);
              // sensorData contiene: {type: "ultra", ok: true, dist_cm: 45.2, ...}
              dataToSave = { ...dataToSave, ...sensorData };
              console.log('📊 Datos del sensor parseados:', sensorData);
            } catch (e) {
              // Si no es JSON, guardar como texto plano
              dataToSave.rawData = receiverData.data;
              console.log('📝 Datos de texto:', receiverData.data);
            }
          }
          
          console.log('📡 RSSI:', receiverData.rssi, 'dBm | SNR:', receiverData.snr);
          
        } catch (e) {
          console.log('⚠️ No se pudo parsear JSON principal:', e.message);
        }
      } 
      // Fallback: buscar JSON embebido (formato antiguo)
      else {
        const jsonMatch = trimmed.match(/"(\{.*\})"/);
        
        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[1]);
            dataToSave = { ...dataToSave, ...jsonData };
            console.log('📊 Datos parseados (formato antiguo):', jsonData);
          } catch (e) {
            console.log('⚠️ No se pudo parsear JSON, guardando como raw');
          }
        }

        // Extraer RSSI y SNR si están en la línea
        const rssiMatch = trimmed.match(/rssi\s+(-?\d+)/);
        const snrMatch = trimmed.match(/snr\s+(-?\d+)/);
        
        if (rssiMatch) {
          dataToSave.rssi = parseInt(rssiMatch[1]);
        }
        
        if (snrMatch) {
          dataToSave.snr = parseInt(snrMatch[1]);
        }
      }

      // Guardar en MongoDB
      const sensorData = new SensorData(dataToSave);
      await sensorData.save();
      
      console.log(`💾 Datos guardados en MongoDB con ID: ${sensorData._id}`);

    } catch (error) {
      console.error(`❌ Error al procesar datos: ${error.message}`);
    }
  }

  // Cerrar conexión
  async disconnect() {
    if (this.port && this.port.isOpen) {
      await new Promise((resolve) => {
        this.port.close(() => {
          console.log('🔌 Puerto serial desconectado');
          resolve();
        });
      });
    }
    this.isConnected = false;
  }

  // Listar puertos disponibles
  static async listPorts() {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    return ports;
  }
}

module.exports = SerialService;
