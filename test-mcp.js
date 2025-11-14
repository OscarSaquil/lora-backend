// Script de prueba para endpoints MCP
// Uso: node test-mcp.js [BASE_URL]
// Ejemplo: node test-mcp.js https://lora-backend-9606.onrender.com

const axios = require('axios');

// Obtener URL base desde argumentos o usar localhost por defecto
const BASE_URL = process.argv[2] || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/mcp`;

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function testMCP() {
  log('\n🧪 Iniciando pruebas de endpoints MCP...\n', 'blue');
  log(`📍 URL Base: ${BASE_URL}\n`, 'cyan');

  try {
    // 1. Verificar que el servidor esté corriendo
    logInfo('1️⃣ Verificando conexión al servidor...');
    try {
      const health = await axios.get(BASE_URL);
      logSuccess(`Servidor activo: ${health.data.message}`);
      log(`   MCP Weather habilitado: ${health.data.mcpEnabled?.weather ? 'Sí' : 'No'}`);
      log(`   MCP Gemini habilitado: ${health.data.mcpEnabled?.gemini ? 'Sí' : 'No'}\n`);
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logError('No se pudo conectar al servidor.');
        logWarning('Asegúrate de que el servidor esté corriendo.');
        return;
      }
      throw error;
    }

    // 2. Listar herramientas MCP disponibles
    logInfo('2️⃣ Listando herramientas MCP disponibles...');
    try {
      const tools = await axios.get(`${API_BASE}/tools`);
      logSuccess(`Herramientas disponibles: ${tools.data.total}`);
      tools.data.tools.forEach(tool => {
        const status = tool.available ? '✅' : '❌';
        log(`   ${status} ${tool.name}: ${tool.description}`);
      });
      console.log('');
    } catch (error) {
      if (error.response) {
        logError(`Error ${error.response.status}: ${error.response.data.error || error.response.data.message}`);
      } else {
        logError(error.message);
      }
      console.log('');
    }

    // 3. Probar clima actual (GET)
    logInfo('3️⃣ Probando clima actual (GET /api/mcp/weather/current)...');
    try {
      const weather = await axios.get(`${API_BASE}/weather/current`, {
        params: {
          city: 'Guatemala',
          units: 'metric',
          lang: 'es'
        }
      });
      logSuccess('Clima actual obtenido:');
      log(`   Ciudad: ${weather.data.city}, ${weather.data.country}`);
      log(`   Temperatura: ${weather.data.temperature}°C`);
      log(`   Descripción: ${weather.data.description}`);
      log(`   Humedad: ${weather.data.humidity}%`);
      console.log('');
    } catch (error) {
      if (error.response) {
        logError(`Error ${error.response.status}: ${error.response.data.error || error.response.data.message}`);
      } else {
        logError(error.message);
      }
      console.log('');
    }

    // 4. Probar ejecutar herramienta (POST)
    logInfo('4️⃣ Probando ejecutar herramienta (POST /api/mcp/execute)...');
    log('   ⚠️  IMPORTANTE: El nombre de la herramienta debe ser "weather" o "gemini", NO "get_weather"');
    try {
      const execute = await axios.post(`${API_BASE}/execute`, {
        tool: 'weather',  // ✅ CORRECTO: "weather"
        params: {
          action: 'current',  // ✅ CORRECTO: "current", "forecast", o "rain"
          city: 'Guatemala'
        }
      });
      logSuccess('Herramienta ejecutada correctamente:');
      log(`   Ciudad: ${execute.data.city || 'N/A'}`);
      log(`   Temperatura: ${execute.data.temperature || 'N/A'}°C`);
      log(`   Descripción: ${execute.data.description || 'N/A'}`);
      console.log('');
    } catch (error) {
      if (error.response) {
        logError(`Error ${error.response.status}: ${error.response.data.error || error.response.data.message}`);
        if (error.response.status === 404) {
          logWarning('⚠️  La ruta /api/mcp/execute no se encontró. Verifica que las rutas estén correctamente registradas.');
        }
        if (error.response.data.error && error.response.data.error.includes('no encontrada')) {
          logWarning('⚠️  Verifica que el nombre de la herramienta sea correcto:');
          logWarning('   ✅ Usa: "weather" o "gemini"');
          logWarning('   ❌ NO uses: "get_weather", "weather_tool", etc.');
        }
      } else {
        logError(error.message);
      }
      console.log('');
    }

    // 5. Probar análisis (POST) - requiere sensorId válido
    logInfo('5️⃣ Probando análisis integrado (POST /api/mcp/analyze)...');
    logWarning('   Nota: Esta prueba requiere un sensorId válido. Obteniendo último sensor...');
    try {
      // Primero obtener un sensor válido
      const latest = await axios.get(`${BASE_URL}/api/data/latest?limit=1`);
      if (latest.data.data && latest.data.data.length > 0) {
        const sensorId = latest.data.data[0]._id;
        log(`   Usando sensorId: ${sensorId}`);
        
        const analyze = await axios.post(`${API_BASE}/analyze`, {
          sensorId: sensorId,
          city: 'Guatemala',
          question: '¿Cómo está el clima hoy?'
        });
        logSuccess('Análisis completado:');
        log(`   ${JSON.stringify(analyze.data, null, 2).substring(0, 300)}...`);
      } else {
        logWarning('No hay sensores disponibles para probar el análisis.');
      }
      console.log('');
    } catch (error) {
      if (error.response) {
        logError(`Error ${error.response.status}: ${error.response.data.error || error.response.data.message}`);
        if (error.response.status === 404) {
          logWarning('⚠️  La ruta /api/mcp/analyze no se encontró. Verifica que las rutas estén correctamente registradas.');
        }
      } else {
        logError(error.message);
      }
      console.log('');
    }

    // 6. Probar Gemini (POST)
    logInfo('6️⃣ Probando generación de texto con Gemini (POST /api/mcp/gemini/generate)...');
    try {
      const gemini = await axios.post(`${API_BASE}/gemini/generate`, {
        prompt: 'Explica brevemente qué es un sensor ultrasónico',
        model: 'gemini-pro'
      });
      logSuccess('Texto generado con Gemini:');
      log(`   ${gemini.data.text || gemini.data.response || JSON.stringify(gemini.data).substring(0, 200)}...`);
      console.log('');
    } catch (error) {
      if (error.response) {
        logError(`Error ${error.response.status}: ${error.response.data.error || error.response.data.message}`);
        if (error.response.status === 404) {
          logWarning('⚠️  La ruta /api/mcp/gemini/generate no se encontró.');
        }
      } else {
        logError(error.message);
      }
      console.log('');
    }

    logSuccess('✅ Pruebas completadas!\n', 'green');
    log('📝 Notas importantes:', 'yellow');
    log('   - En Render, configura las variables de entorno en el panel de configuración:', 'yellow');
    log('     * OPENWEATHER_API_KEY', 'yellow');
    log('     * GEMINI_API_KEY', 'yellow');
    log('     * MONGODB_URI', 'yellow');
    log('     * DEVICE_KEY (opcional)', 'yellow');
    log('   - Las rutas POST requieren Content-Type: application/json', 'yellow');
    log('   - El puerto en Render se configura automáticamente, no uses PORT=10000\n', 'yellow');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logError('No se pudo conectar al servidor.');
      logWarning('Asegúrate de que el servidor esté corriendo.');
    } else if (error.response) {
      logError(`Error ${error.response.status}: ${error.response.data.error || error.response.data.message}`);
    } else {
      logError(`Error inesperado: ${error.message}`);
    }
  }
}

// Ejecutar pruebas
testMCP();

