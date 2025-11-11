// Script de prueba para simular datos del sensor sin hardware
// Uso: node test-api.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testAPI() {
  console.log('🧪 Iniciando pruebas del API...\n');

  try {
    // 1. Verificar que el servidor esté corriendo
    console.log('1️⃣ Verificando conexión al servidor...');
    const health = await axios.get('http://localhost:3000');
    console.log('✅ Servidor activo:', health.data.message);
    console.log('');

    // 2. Obtener estadísticas
    console.log('2️⃣ Obteniendo estadísticas...');
    const stats = await axios.get(`${BASE_URL}/data/stats`);
    console.log('✅ Estadísticas:', JSON.stringify(stats.data.stats, null, 2));
    console.log('');

    // 3. Obtener últimas lecturas
    console.log('3️⃣ Obteniendo últimas 5 lecturas...');
    const latest = await axios.get(`${BASE_URL}/data/latest?limit=5`);
    console.log(`✅ Se encontraron ${latest.data.count} lecturas`);
    if (latest.data.data.length > 0) {
      console.log('📊 Última lectura:', JSON.stringify(latest.data.data[0], null, 2));
    }
    console.log('');

    // 4. Listar puertos seriales
    console.log('4️⃣ Listando puertos seriales disponibles...');
    const ports = await axios.get(`${BASE_URL}/ports`);
    console.log('✅ Puertos encontrados:');
    ports.data.ports.forEach(port => {
      console.log(`   - ${port.path} (${port.manufacturer || 'N/A'})`);
    });
    console.log('');

    // 5. Obtener datos paginados
    console.log('5️⃣ Obteniendo datos paginados (página 1)...');
    const paginated = await axios.get(`${BASE_URL}/data?page=1&limit=10`);
    console.log(`✅ Total de registros: ${paginated.data.pagination.total}`);
    console.log(`   Páginas disponibles: ${paginated.data.pagination.pages}`);
    console.log('');

    console.log('✅ Todas las pruebas completadas exitosamente! 🎉');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Error: No se pudo conectar al servidor.');
      console.error('   Asegúrate de que el servidor esté corriendo: npm start');
    } else if (error.response) {
      console.error(`❌ Error ${error.response.status}:`, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Ejecutar pruebas
testAPI();
