const axios = require('axios');
require('dotenv').config();

/**
 * Script para configurar el webhook de Telegram
 * Ejecutar una sola vez después de deployar tu servidor
 */

async function setupWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.WEBHOOK_URL;

  if (!token) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN no configurado en .env');
    return;
  }

  if (!webhookUrl) {
    console.error('❌ Error: WEBHOOK_URL no configurado en .env');
    console.log('Ejemplo: WEBHOOK_URL=https://tu-dominio.com/telegram/webhook');
    return;
  }

  try {
    // 1. Verificar estado actual del webhook
    console.log('🔍 Verificando webhook actual...');
    const infoResponse = await axios.get(
      `https://api.telegram.org/bot${token}/getWebhookInfo`
    );
    console.log('Estado actual:', infoResponse.data.result);

    // 2. Configurar nuevo webhook
    console.log('\n⚙️  Configurando webhook...');
    const setResponse = await axios.post(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        url: webhookUrl,
        allowed_updates: ['message', 'edited_message']
      }
    );

    if (setResponse.data.ok) {
      console.log('✅ Webhook configurado exitosamente!');
      console.log('URL:', webhookUrl);
      
      // 3. Verificar configuración
      const verifyResponse = await axios.get(
        `https://api.telegram.org/bot${token}/getWebhookInfo`
      );
      console.log('\n📊 Configuración final:');
      console.log(JSON.stringify(verifyResponse.data.result, null, 2));
      
      console.log('\n📝 Próximos pasos:');
      console.log('1. Abre Telegram y busca tu bot');
      console.log('2. Envía el comando /start');
      console.log('3. Verifica que aparezca en GET /telegram/subscribers');
    } else {
      console.error('❌ Error:', setResponse.data);
    }
  } catch (error) {
    console.error('❌ Error al configurar webhook:', error.message);
    if (error.response) {
      console.error('Detalles:', error.response.data);
    }
  }
}

// Para desarrollo local (usar ngrok o similar)
async function removeWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/deleteWebhook`
    );
    console.log('Webhook eliminado:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Ejecutar
const command = process.argv[2];

if (command === 'remove') {
  removeWebhook();
} else {
  setupWebhook();
}