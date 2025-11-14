//src/services/geminiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY no configurada. El servicio de Gemini no funcionará.');
      this.client = null;
    } else {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
  }

  /**
   * Genera una respuesta usando Gemini
   * @param {string} prompt - El prompt para el modelo
   * @param {Object} options - Opciones adicionales
   */
  async generateText(prompt, options = {}) {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    try {
      const model = this.client.getGenerativeModel({ 
        model: options.model || 'gemini-pro',
        ...options.modelOptions 
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        success: true,
        text,
        model: options.model || 'gemini-pro',
        usage: {
          promptTokens: result.usageMetadata?.promptTokenCount || 0,
          completionTokens: result.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: result.usageMetadata?.totalTokenCount || 0
        }
      };
    } catch (error) {
      throw new Error(`Error al generar texto con Gemini: ${error.message}`);
    }
  }

  /**
   * Genera una respuesta con contexto (historial de conversación)
   * @param {Array} history - Historial de mensajes [{role: 'user'|'model', parts: [{text: '...'}]}]
   * @param {string} prompt - Nuevo prompt del usuario
   * @param {Object} options - Opciones adicionales
   */
  async generateWithHistory(history, prompt, options = {}) {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    try {
      const model = this.client.getGenerativeModel({ 
        model: options.model || 'gemini-pro',
        ...options.modelOptions 
      });

      // Construir el historial de conversación
      const chat = model.startChat({
        history: history.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        })),
        ...options.chatOptions
      });

      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        success: true,
        text,
        model: options.model || 'gemini-pro'
      };
    } catch (error) {
      throw new Error(`Error al generar con historial: ${error.message}`);
    }
  }

  /**
   * Analiza datos de sensores usando Gemini con contexto del clima
   * @param {Object} sensorData - Datos del sensor
   * @param {Object} weatherData - Datos del clima
   * @param {string} question - Pregunta específica
   */
  async analyzeSensorWithWeather(sensorData, weatherData, question = null) {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    const context = `
Datos del sensor LoRa:
- Distancia medida: ${sensorData.dist_cm} cm
- Profundidad: ${sensorData.depth_cm} cm
- RSSI: ${sensorData.rssi} dBm
- SNR: ${sensorData.snr}
- Fecha: ${sensorData.receivedAt}

Datos del clima actual:
- Temperatura: ${weatherData.temperature}°C
- Humedad: ${weatherData.humidity}%
- Descripción: ${weatherData.description}
- Velocidad del viento: ${weatherData.windSpeed} m/s
- Probabilidad de lluvia: ${weatherData.pop ? (weatherData.pop * 100).toFixed(0) : 'N/A'}%
`;

    const prompt = question 
      ? `${context}\n\nPregunta: ${question}\n\nPor favor, analiza estos datos y responde la pregunta.`
      : `${context}\n\nAnaliza estos datos del sensor y el clima, y proporciona insights relevantes sobre cómo el clima podría afectar las lecturas del sensor o el nivel de agua.`;

    return await this.generateText(prompt, {
      model: 'gemini-pro'
    });
  }

  /**
   * Genera recomendaciones basadas en datos de sensores y clima
   */
  async generateRecommendations(sensorData, weatherForecast) {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    const context = `
Datos del sensor:
- Distancia: ${sensorData.dist_cm} cm
- Profundidad: ${sensorData.depth_cm} cm
- Fecha: ${sensorData.receivedAt}

Pronóstico del clima para los próximos días:
${weatherForecast.dailyForecast.map(day => 
  `- ${day.date.toLocaleDateString('es-ES')}: ${day.forecasts[0].description}, Temp: ${day.avgTemp.toFixed(1)}°C, Prob. lluvia: ${(day.maxRainProbability * 100).toFixed(0)}%`
).join('\n')}
`;

    const prompt = `${context}\n\nBasándote en estos datos, proporciona recomendaciones sobre:\n1. Cómo el clima podría afectar el nivel de agua\n2. Qué acciones preventivas se podrían tomar\n3. Alertas si hay riesgo de inundación o sequía`;

    return await this.generateText(prompt);
  }
}

module.exports = new GeminiService();

