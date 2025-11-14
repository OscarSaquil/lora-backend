# Ejemplos de Uso de MCP

## ⚠️ Nombres de Herramientas Correctos

El servicio MCP solo reconoce estos nombres de herramientas:
- ✅ `"weather"` - Para servicios de clima
- ✅ `"gemini"` - Para servicios de IA

❌ **NO uses**: `"get_weather"`, `"weather_tool"`, `"getWeather"`, etc.

## 📋 Ejemplos de Pruebas

### 1. Listar Herramientas Disponibles

**GET** `/api/mcp/tools`

```bash
curl https://lora-backend-9606.onrender.com/api/mcp/tools
```

**Respuesta:**
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

---

### 2. Ejecutar Herramienta de Clima - Clima Actual

**POST** `/api/mcp/execute`

```bash
curl -X POST https://lora-backend-9606.onrender.com/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "weather",
    "params": {
      "action": "current",
      "city": "Guatemala",
      "units": "metric",
      "lang": "es"
    }
  }'
```

**Body JSON (Postman):**
```json
{
  "tool": "weather",
  "params": {
    "action": "current",
    "city": "Guatemala",
    "units": "metric",
    "lang": "es"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "city": "Guatemala City",
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
  "timestamp": "2025-01-15T14:30:00.000Z"
}
```

---

### 3. Ejecutar Herramienta de Clima - Pronóstico

**POST** `/api/mcp/execute`

```bash
curl -X POST https://lora-backend-9606.onrender.com/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "weather",
    "params": {
      "action": "forecast",
      "city": "Guatemala",
      "days": 5,
      "units": "metric",
      "lang": "es"
    }
  }'
```

**Body JSON (Postman):**
```json
{
  "tool": "weather",
  "params": {
    "action": "forecast",
    "city": "Guatemala",
    "days": 5,
    "units": "metric",
    "lang": "es"
  }
}
```

---

### 4. Ejecutar Herramienta de Clima - Probabilidad de Lluvia

**POST** `/api/mcp/execute`

```bash
curl -X POST https://lora-backend-9606.onrender.com/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "weather",
    "params": {
      "action": "rain",
      "city": "Guatemala",
      "days": 5
    }
  }'
```

**Body JSON (Postman):**
```json
{
  "tool": "weather",
  "params": {
    "action": "rain",
    "city": "Guatemala",
    "days": 5
  }
}
```

---

### 5. Ejecutar Herramienta Gemini - Generar Texto

**POST** `/api/mcp/execute`

```bash
curl -X POST https://lora-backend-9606.onrender.com/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "gemini",
    "params": {
      "action": "generate",
      "prompt": "Explica brevemente qué es un sensor ultrasónico",
      "model": "gemini-pro"
    }
  }'
```

**Body JSON (Postman):**
```json
{
  "tool": "gemini",
  "params": {
    "action": "generate",
    "prompt": "Explica brevemente qué es un sensor ultrasónico",
    "model": "gemini-pro"
  }
}
```

---

### 6. Clima Actual (GET - Más Simple)

**GET** `/api/mcp/weather/current?city=Guatemala&units=metric&lang=es`

```bash
curl "https://lora-backend-9606.onrender.com/api/mcp/weather/current?city=Guatemala&units=metric&lang=es"
```

O desde el navegador:
```
https://lora-backend-9606.onrender.com/api/mcp/weather/current?city=Guatemala
```

---

### 7. Análisis Integrado (Requiere sensorId válido)

**POST** `/api/mcp/analyze`

Primero obtén un sensorId:
```bash
curl "https://lora-backend-9606.onrender.com/api/data/latest?limit=1"
```

Luego analiza:
```bash
curl -X POST https://lora-backend-9606.onrender.com/api/mcp/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "sensorId": "TU_SENSOR_ID_AQUI",
    "city": "Guatemala",
    "question": "¿Cómo afecta el clima actual al nivel de agua?"
  }'
```

**Body JSON (Postman):**
```json
{
  "sensorId": "507f1f77bcf86cd799439011",
  "city": "Guatemala",
  "question": "¿Cómo afecta el clima actual al nivel de agua?"
}
```

---

## ❌ Errores Comunes

### Error: "Herramienta \"get_weather\" no encontrada"

**Causa:** Estás usando un nombre incorrecto para la herramienta.

**Solución:**
```json
// ❌ INCORRECTO
{
  "tool": "get_weather",
  "params": { ... }
}

// ✅ CORRECTO
{
  "tool": "weather",
  "params": {
    "action": "current",
    "city": "Guatemala"
  }
}
```

### Error: "Acción \"get_current\" no válida"

**Causa:** Estás usando un nombre incorrecto para la acción.

**Solución:**
```json
// ❌ INCORRECTO
{
  "tool": "weather",
  "params": {
    "action": "get_current",
    "city": "Guatemala"
  }
}

// ✅ CORRECTO
{
  "tool": "weather",
  "params": {
    "action": "current",
    "city": "Guatemala"
  }
}
```

### Acciones Válidas para "weather":
- ✅ `"current"` - Clima actual
- ✅ `"forecast"` - Pronóstico
- ✅ `"rain"` o `"rainProbability"` - Probabilidad de lluvia

### Acciones Válidas para "gemini":
- ✅ `"generate"` - Generar texto
- ✅ `"chat"` - Chat con historial
- ✅ `"analyze"` - Analizar datos
- ✅ `"recommendations"` - Generar recomendaciones

---

## 🧪 Probar con el Script

Ejecuta el script de prueba incluido:

```bash
# Probar en Render
node test-mcp.js https://lora-backend-9606.onrender.com

# Probar localmente
node test-mcp.js http://localhost:3000
```

---

## 📝 Resumen de Formatos Correctos

### Para Clima:
```json
{
  "tool": "weather",
  "params": {
    "action": "current",      // o "forecast" o "rain"
    "city": "Guatemala",      // requerido para current, forecast, rain
    "lat": 14.6349,           // opcional (alternativa a city)
    "lon": -90.5069,          // opcional (alternativa a city)
    "units": "metric",        // opcional: "metric", "imperial", "kelvin"
    "lang": "es",             // opcional: "es", "en", etc.
    "days": 5                 // opcional: para forecast y rain
  }
}
```

### Para Gemini:
```json
{
  "tool": "gemini",
  "params": {
    "action": "generate",     // o "chat", "analyze", "recommendations"
    "prompt": "Tu pregunta aquí",
    "model": "gemini-pro",    // opcional
    "history": [],            // opcional: para "chat"
    "sensorData": {},         // requerido para "analyze" y "recommendations"
    "weatherData": {},        // requerido para "analyze" y "recommendations"
    "question": "..."         // opcional: para "analyze"
  }
}
```

