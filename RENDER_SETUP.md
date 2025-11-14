# Configuración en Render

## ⚠️ Importante: Variables de Entorno en Render

En Render, **NO puedes subir el archivo `.env` directamente**. Debes configurar las variables de entorno en el panel de Render.

## 📋 Pasos para Configurar Variables de Entorno en Render

### 1. Accede al Panel de Render
1. Ve a tu dashboard en [render.com](https://render.com)
2. Selecciona tu servicio `lora-backend`
3. Ve a la sección **"Environment"** o **"Environment Variables"**

### 2. Agrega las Variables de Entorno

Agrega las siguientes variables de entorno (haz clic en "Add Environment Variable" para cada una):

#### Variables Requeridas:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MONGODB_URI` | URI de conexión a MongoDB | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `OPENWEATHER_API_KEY` | API Key de OpenWeatherMap | `tu_api_key_aqui` |
| `GEMINI_API_KEY` | API Key de Google Gemini | `tu_api_key_aqui` |

#### Variables Opcionales:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DEVICE_KEY` | Clave para autenticación de dispositivos | `tu_clave_secreta` |
| `NODE_ENV` | Entorno de ejecución | `production` |
| `PORT` | Puerto del servidor (Render lo asigna automáticamente) | No configurar manualmente |

### 3. Obtener las API Keys

#### OpenWeatherMap API Key:
1. Visita https://openweathermap.org/api
2. Crea una cuenta gratuita
3. Ve a "API keys" en tu cuenta
4. Copia tu API key

#### Google Gemini API Key:
1. Visita https://makersuite.google.com/app/apikey
2. Crea una API key
3. Copia la clave generada

### 4. Verificar la Configuración

Después de agregar las variables, Render reiniciará automáticamente tu servicio. Puedes verificar que todo esté funcionando:

```bash
# Probar el endpoint raíz
curl https://lora-backend-9606.onrender.com

# Probar herramientas MCP
curl https://lora-backend-9606.onrender.com/api/mcp/tools
```

## 🧪 Probar los Endpoints MCP

Usa el script de prueba incluido:

```bash
# Probar en tu servidor de Render
node test-mcp.js https://lora-backend-9606.onrender.com

# O probar localmente
node test-mcp.js http://localhost:3000
```

## 🔍 Verificar que las Rutas Estén Funcionando

### Endpoints GET (funcionan desde el navegador):
- `https://lora-backend-9606.onrender.com/api/mcp/tools`
- `https://lora-backend-9606.onrender.com/api/mcp/weather/current?city=Guatemala`

### Endpoints POST (requieren herramientas como Postman o curl):

```bash
# Ejecutar herramienta
curl -X POST https://lora-backend-9606.onrender.com/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "weather",
    "params": {
      "action": "current",
      "city": "Guatemala"
    }
  }'

# Análisis integrado (requiere sensorId válido)
curl -X POST https://lora-backend-9606.onrender.com/api/mcp/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "sensorId": "TU_SENSOR_ID",
    "city": "Guatemala",
    "question": "¿Cómo está el clima?"
  }'
```

## ⚠️ Errores Comunes

### Error 404 en las rutas MCP
- **Causa**: Las rutas no están registradas correctamente
- **Solución**: Verifica que `src/index.js` tenga `app.use('/api/mcp', mcpRoutes);`

### Error "API key not found"
- **Causa**: Las variables de entorno no están configuradas en Render
- **Solución**: Agrega `OPENWEATHER_API_KEY` y `GEMINI_API_KEY` en el panel de Render

### Error de conexión a MongoDB
- **Causa**: `MONGODB_URI` no está configurada o es incorrecta
- **Solución**: Verifica la URI en el panel de Render y asegúrate de que sea correcta

## 📝 Notas Importantes

1. **No subas el archivo `.env` a Git**: Asegúrate de que `.env` esté en `.gitignore`
2. **Render asigna el puerto automáticamente**: No necesitas configurar `PORT` manualmente
3. **Las variables son sensibles**: Nunca las compartas públicamente
4. **Reinicio automático**: Render reinicia el servicio cuando cambias variables de entorno

## 🔗 Enlaces Útiles

- [Documentación de Render sobre Variables de Entorno](https://render.com/docs/environment-variables)
- [Documentación de Render sobre Puertos](https://render.com/docs/web-services#port-binding)

