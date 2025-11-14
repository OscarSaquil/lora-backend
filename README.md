# Backend LoRa - WiFi LoRa 32 V3 (Heltec)

Backend en Node.js para recibir datos del **WiFi LoRa 32 V3 de Heltec** a través del puerto serial y almacenarlos en MongoDB.

## 📋 Características

- ✅ Conexión serial con el LoRa Receiver
- ✅ Parseo automático de datos JSON del sensor ultrasónico HC-SR04
- ✅ Almacenamiento en MongoDB con timestamps
- ✅ API REST completa para consultar datos
- ✅ Captura de métricas LoRa (RSSI, SNR)
- ✅ Estadísticas y análisis de datos
- ✅ **Integración MCP (Model Context Protocol)**
- ✅ **API de Clima (OpenWeatherMap)** - Clima actual, pronósticos y probabilidad de lluvia
- ✅ **Google Gemini AI** - Análisis inteligente y recomendaciones contextuales

## 🔧 Requisitos Previos

- Node.js >= 16.x
- MongoDB instalado y ejecutándose localmente o en la nube
- WiFi LoRa 32 V3 conectado por USB
- Driver USB-Serial instalado (CP210x o CH340)

## 📦 Instalación

1. **Clonar o crear el proyecto**:
```bash
cd d:\UMG\lora\backend
```

2. **Instalar dependencias**:
```bash
npm install
```

3. **Configurar variables de entorno**:

Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```

Edita `.env` con tus configuraciones:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/lora_data
SERIAL_PORT=COM3          # Cambia según tu sistema
SERIAL_BAUDRATE=115200

# API Keys para funcionalidades MCP (opcionales)
OPENWEATHER_API_KEY=tu_api_key_aqui      # https://openweathermap.org/api
GEMINI_API_KEY=tu_api_key_aqui          # https://makersuite.google.com/app/apikey
```

### 🔍 Encontrar el puerto serial correcto

**Windows**:
- Abre el Administrador de Dispositivos
- Busca en "Puertos (COM y LPT)"
- Identifica el puerto del dispositivo (ej: COM3, COM4)

**Linux/Mac**:
```bash
ls /dev/tty*
# Busca algo como /dev/ttyUSB0 o /dev/ttyACM0
```

También puedes usar el endpoint del API:
```bash
curl http://localhost:3000/api/ports
```

## 🚀 Uso

### Modo Desarrollo (con auto-reload):
```bash
npm run dev
```

### Modo Producción:
```bash
npm start
```

El servidor iniciará en `http://localhost:3000`

## 📡 API Endpoints

### 1. Información General
```
GET /
```
Retorna información del API y lista de endpoints disponibles.

### 2. Obtener Todos los Datos (Paginado)
```
GET /api/data?page=1&limit=50
```
**Parámetros**:
- `page`: Número de página (default: 1)
- `limit`: Registros por página (default: 50)

**Respuesta**:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

### 3. Últimas Lecturas
```
GET /api/data/latest?limit=10
```
**Parámetros**:
- `limit`: Cantidad de registros (default: 10)

### 4. Estadísticas
```
GET /api/data/stats
```
Retorna estadísticas generales:
- Total de lecturas
- Lecturas exitosas/fallidas
- Promedios de distancia, profundidad, RSSI, SNR
- Última lectura

**Respuesta**:
```json
{
  "success": true,
  "stats": {
    "total": 100,
    "successful": 95,
    "failed": 5,
    "successRate": "95.00%",
    "averages": {
      "avgDistance": 45.2,
      "avgDepth": 74.8,
      "minDistance": 20.0,
      "maxDistance": 100.0,
      "avgRssi": -65,
      "avgSnr": 8
    },
    "latestReading": {...}
  }
}
```

### 5. Datos por Rango de Fechas
```
GET /api/data/range?startDate=2025-11-10T00:00:00Z&endDate=2025-11-11T23:59:59Z
```
**Parámetros**:
- `startDate`: Fecha inicio (ISO 8601)
- `endDate`: Fecha fin (ISO 8601)

### 6. Obtener Dato Específico
```
GET /api/data/:id
```

### 7. Eliminar Dato
```
DELETE /api/data/:id
```

### 8. Listar Puertos Seriales Disponibles
```
GET /api/ports
```
Útil para identificar el puerto correcto del dispositivo.

### 9. MCP (Model Context Protocol) - Nuevo! 🌟

#### Listar Herramientas Disponibles
```
GET /api/mcp/tools
```

#### Clima Actual
```
GET /api/mcp/weather/current?city=Guatemala
```

#### Pronóstico del Tiempo
```
GET /api/mcp/weather/forecast?city=Guatemala&days=5
```

#### Probabilidad de Lluvia
```
GET /api/mcp/weather/rain?city=Guatemala&days=5
```

#### Análisis Integrado (Sensor + Clima + Gemini AI)
```
POST /api/mcp/analyze
Body: {
  "sensorId": "ID_DEL_SENSOR",
  "city": "Guatemala",
  "question": "¿Cómo afecta el clima al nivel de agua?"
}
```

#### Generar Texto con Gemini
```
POST /api/mcp/gemini/generate
Body: {
  "prompt": "Explica cómo funciona un sensor ultrasónico"
}
```

**📖 Para más detalles sobre MCP, consulta [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)**

## 📊 Estructura de Datos en MongoDB

```javascript
{
  "_id": "ObjectId",
  "type": "ultra",              // Tipo de sensor
  "ok": true,                   // Lectura exitosa
  "dist_cm": 45.2,              // Distancia medida (cm)
  "depth_cm": 74.8,             // Profundidad calculada (cm)
  "h_cm": 120.0,                // Altura del sensor (cm)
  "ts": 123456789,              // Timestamp del dispositivo (millis)
  "rssi": -65,                  // RSSI del paquete LoRa (dBm)
  "snr": 8,                     // SNR del paquete LoRa
  "rawData": "...",             // Datos raw del serial
  "receivedAt": "2025-11-11T..." // Timestamp del servidor
}
```

## 🔌 Configuración del Hardware

### Conexión del LoRa Receiver:

1. Conecta el **WiFi LoRa 32 V3** por USB a tu computadora
2. Carga el código `LoRaReceiver-1.ino` en el dispositivo
3. El dispositivo recibirá datos LoRa y los imprimirá por Serial
4. El backend leerá estos datos automáticamente

### Modificación Recomendada del Receiver:

Para una mejor integración, modifica el `LoRaReceiver-1.ino` para que envíe datos JSON estructurados:

```cpp
void OnRxDone(uint8_t *payload, uint16_t size, int16_t rssi_cb, int8_t snr_cb) {
  uint16_t copy = (size < BUFFER_SIZE - 1) ? size : (BUFFER_SIZE - 1);
  memcpy(rxpacket, payload, copy);
  rxpacket[copy] = '\0';

  g_rssi = rssi_cb;
  g_snr  = snr_cb;
  g_rxLen = copy;
  g_rxCount++;

  // Enviar JSON estructurado por Serial
  Serial.print("{\"data\":\"");
  Serial.print(rxpacket);
  Serial.print("\",\"rssi\":");
  Serial.print(g_rssi);
  Serial.print(",\"snr\":");
  Serial.print(g_snr);
  Serial.print(",\"length\":");
  Serial.print(g_rxLen);
  Serial.println("}");

  Radio.Sleep();
  lora_idle = true;
}
```

## 🛠️ Troubleshooting

### Error: Puerto serial no encontrado
- Verifica que el dispositivo esté conectado
- Usa `GET /api/ports` para listar puertos disponibles
- Asegúrate de que el driver USB-Serial esté instalado
- Cierra el Arduino IDE si está abierto (puede bloquear el puerto)

### Error: MongoDB connection failed
- Verifica que MongoDB esté ejecutándose: `mongod --version`
- Confirma la URI en `.env`
- Si usas MongoDB Atlas, verifica las credenciales

### No se reciben datos
- Verifica que el baudrate coincida (115200)
- Revisa el Monitor Serial del Arduino IDE para confirmar que el receiver está recibiendo datos
- Verifica la frecuencia LoRa (433 MHz) en ambos dispositivos

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # Configuración MongoDB
│   ├── models/
│   │   └── SensorData.js        # Modelo de datos
│   ├── routes/
│   │   └── api.js               # Rutas del API
│   ├── services/
│   │   └── serialService.js     # Servicio de puerto serial
│   └── index.js                 # Punto de entrada
├── .env.example                 # Ejemplo de variables de entorno
├── .gitignore
├── package.json
├── LoRaReceiver-1.ino          # Código Arduino Receiver
└── LoRaSender-1.ino            # Código Arduino Sender
```

## 🌐 Ejemplo de Uso con Frontend

```javascript
// Obtener últimas 5 lecturas
fetch('http://localhost:3000/api/data/latest?limit=5')
  .then(res => res.json())
  .then(data => console.log(data));

// Obtener estadísticas
fetch('http://localhost:3000/api/data/stats')
  .then(res => res.json())
  .then(stats => console.log(stats));
```

## 📝 Notas Importantes

- **Frecuencia LoRa**: Este proyecto usa 433 MHz. Si tu región requiere 915 MHz, cambia `RF_FREQUENCY` en ambos archivos .ino
- **Rango LoRa**: Dependiendo del entorno, el alcance puede variar de 100m a varios km
- **Persistencia**: Todos los datos se almacenan en MongoDB para análisis histórico

## 🤝 Contribuciones

Este es un proyecto educativo para monitoreo de nivel de agua con LoRa. Siéntete libre de mejorarlo y adaptarlo a tus necesidades.

## 📄 Licencia

ISC

---

**Desarrollado para WiFi LoRa 32 V3 (Heltec)** 🚀
