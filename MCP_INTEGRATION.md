# Integración MCP (Model Context Protocol)

Este proyecto ahora incluye integración con MCP (Model Context Protocol) que permite usar diferentes APIs y servicios de IA de forma coordinada.

## 🚀 Características

- ✅ **API de Clima (OpenWeatherMap)**: Obtén clima actual, pronósticos y probabilidad de lluvia
- ✅ **Google Gemini AI**: Genera respuestas inteligentes y análisis contextual
- ✅ **Análisis Integrado**: Combina datos de sensores con clima y genera insights con IA

## 📋 Configuración

### 1. Obtener API Keys

#### OpenWeatherMap API
1. Visita https://openweathermap.org/api
2. Crea una cuenta gratuita
3. Obtén tu API key
4. Agrega al `src/.env`:
```env
OPENWEATHER_API_KEY=tu_api_key_aqui
```

#### Google Gemini API
1. Visita https://makersuite.google.com/app/apikey
2. Crea una API key
3. Agrega al `src/.env`:
```env
GEMINI_API_KEY=tu_api_key_aqui
```

**Nota:** El archivo `.env` debe estar en la carpeta `src/`, no en la raíz del proyecto.

### 2. Instalar Dependencias

```bash
npm install
```

## 📡 Endpoints Disponibles

### MCP Core

#### Listar Herramientas Disponibles
```http
GET /api/mcp/tools
```

Respuesta:
```json
{
  "success": true,
  "tools": [
    {
      "name": "weather",
      "description": "Obtiene información del clima actual y pronósticos",
      "available": true
    },
    {
      "name": "gemini",
      "description": "Genera respuestas usando Google Gemini AI",
      "available": true
    }
  ],
  "total": 2,
  "available": 2
}
```

#### Ejecutar Herramienta
```http
POST /api/mcp/execute
Content-Type: application/json

{
  "tool": "weather",
  "params": {
    "action": "current",
    "city": "Guatemala"
  }
}
```

#### Análisis Integrado
```http
POST /api/mcp/analyze
Content-Type: application/json

{
  "sensorId": "507f1f77bcf86cd799439011",
  "city": "Guatemala",
  "question": "¿Cómo afecta el clima actual al nivel de agua?"
}
```

### Clima

#### Clima Actual
```http
GET /api/mcp/weather/current?city=Guatemala&units=metric&lang=es
```

O por coordenadas:
```http
GET /api/mcp/weather/current?lat=14.6349&lon=-90.5069&units=metric
```

#### Pronóstico del Tiempo
```http
GET /api/mcp/weather/forecast?city=Guatemala&days=5&units=metric&lang=es
```

Respuesta incluye:
- Pronóstico cada 3 horas
- Agrupado por día
- Temperaturas mínimas y máximas
- Probabilidad de lluvia
- Velocidad del viento
- Humedad

#### Probabilidad de Lluvia
```http
GET /api/mcp/weather/rain?city=Guatemala&days=5
```

Respuesta:
```json
{
  "success": true,
  "city": "Guatemala",
  "country": "GT",
  "rainAnalysis": [
    {
      "date": "2025-01-15T00:00:00.000Z",
      "maxProbability": 0.85,
      "avgProbability": 0.65,
      "totalRain": 12.5,
      "hasRain": true,
      "description": "lluvia moderada",
      "main": "Rain"
    }
  ],
  "summary": {
    "daysWithRain": 3,
    "totalDays": 5,
    "highestProbability": 0.85
  }
}
```

### Gemini AI

#### Generar Texto
```http
POST /api/mcp/gemini/generate
Content-Type: application/json

{
  "prompt": "Explica cómo funciona un sensor ultrasónico",
  "model": "gemini-pro"
}
```

#### Chat con Historial
```http
POST /api/mcp/gemini/chat
Content-Type: application/json

{
  "prompt": "¿Qué más puedo hacer?",
  "history": [
    {
      "role": "user",
      "text": "Hola"
    },
    {
      "role": "model",
      "text": "¡Hola! ¿En qué puedo ayudarte?"
    }
  ]
}
```

#### Analizar Sensor con Clima
```http
POST /api/mcp/gemini/analyze
Content-Type: application/json

{
  "sensorId": "507f1f77bcf86cd799439011",
  "city": "Guatemala",
  "question": "¿Hay riesgo de inundación?"
}
```

## 💡 Ejemplos de Uso

### Ejemplo 1: Consultar Clima y Probabilidad de Lluvia

```bash
# Clima actual
curl "http://localhost:3000/api/mcp/weather/current?city=Guatemala"

# Pronóstico 5 días
curl "http://localhost:3000/api/mcp/weather/forecast?city=Guatemala&days=5"

# Probabilidad de lluvia
curl "http://localhost:3000/api/mcp/weather/rain?city=Guatemala&days=5"
```

### Ejemplo 2: Análisis Completo con IA

```bash
# Primero obtén un ID de sensor
curl "http://localhost:3000/api/data/latest?limit=1"

# Luego analiza con clima y Gemini
curl -X POST "http://localhost:3000/api/mcp/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "sensorId": "TU_SENSOR_ID",
    "city": "Guatemala",
    "question": "¿Cómo afecta el clima a las lecturas del sensor?"
  }'
```

### Ejemplo 3: Ejecutar Múltiples Herramientas

```bash
curl -X POST "http://localhost:3000/api/mcp/execute-multiple" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {
        "tool": "weather",
        "params": {
          "action": "current",
          "city": "Guatemala"
        }
      },
      {
        "tool": "weather",
        "params": {
          "action": "forecast",
          "city": "Guatemala",
          "days": 3
        }
      }
    ],
    "parallel": true
  }'
```

## 🔧 Casos de Uso

### 1. Monitoreo Preventivo
Combina datos de sensores con pronóstico del clima para predecir posibles problemas:

```javascript
// Obtener último dato del sensor
const sensor = await fetch('/api/data/latest?limit=1');
const sensorData = await sensor.json();

// Obtener pronóstico
const forecast = await fetch('/api/mcp/weather/forecast?city=Guatemala&days=5');
const weather = await forecast.json();

// Analizar con Gemini
const analysis = await fetch('/api/mcp/gemini/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sensorId: sensorData.data[0]._id,
    city: 'Guatemala',
    question: '¿Hay riesgo de inundación en los próximos días?'
  })
});
```

### 2. Alertas Automáticas
Usa la probabilidad de lluvia para generar alertas:

```javascript
const rain = await fetch('/api/mcp/weather/rain?city=Guatemala&days=3');
const rainData = await rain.json();

if (rainData.summary.highestProbability > 0.7) {
  console.log('⚠️ Alta probabilidad de lluvia detectada');
  // Enviar alerta
}
```

### 3. Análisis Contextual
Gemini puede analizar cómo el clima afecta las lecturas:

```javascript
const analysis = await fetch('/api/mcp/gemini/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sensorId: 'SENSOR_ID',
    city: 'Guatemala',
    question: '¿Por qué el nivel de agua cambió? ¿Está relacionado con el clima?'
  })
});
```

## 📊 Estructura de Respuestas

### Respuesta de Clima Actual
```json
{
  "success": true,
  "city": "Guatemala",
  "country": "GT",
  "temperature": 22.5,
  "feelsLike": 23.1,
  "humidity": 65,
  "pressure": 1013,
  "description": "cielo despejado",
  "main": "Clear",
  "windSpeed": 3.2,
  "windDirection": 180,
  "visibility": 10,
  "clouds": 0,
  "sunrise": "2025-01-15T12:15:00.000Z",
  "sunset": "2025-01-15T23:45:00.000Z",
  "timestamp": "2025-01-15T14:30:00.000Z"
}
```

### Respuesta de Pronóstico
```json
{
  "success": true,
  "city": "Guatemala",
  "country": "GT",
  "forecast": [...], // Array con pronóstico cada 3 horas
  "dailyForecast": [
    {
      "date": "2025-01-15T00:00:00.000Z",
      "forecasts": [...],
      "avgTemp": 22.5,
      "minTemp": 18.0,
      "maxTemp": 27.0,
      "avgHumidity": 65,
      "maxRainProbability": 0.3
    }
  ],
  "count": 40
}
```

## ⚠️ Limitaciones

- **OpenWeatherMap Free Tier**: 
  - Máximo 5 días de pronóstico
  - 60 llamadas por minuto
  - 1,000,000 llamadas por mes

- **Gemini API**:
  - Requiere API key válida
  - Límites según tu plan de Google Cloud

## 🔒 Seguridad

- Las API keys deben estar en `src/.env` y nunca en el código
- El archivo `src/.env` está en `.gitignore` y no se versiona
- Considera usar variables de entorno en producción

## 📚 Recursos

- [OpenWeatherMap API Docs](https://openweathermap.org/api)
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [MCP Specification](https://modelcontextprotocol.io/)

