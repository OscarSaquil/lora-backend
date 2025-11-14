//src/services/mcpService.js
const weatherService = require('./weatherService');
const geminiService = require('./geminiService');

/**
 * Servicio MCP (Model Context Protocol) que coordina diferentes APIs y herramientas
 * Actúa como un orquestador que permite usar múltiples servicios de forma integrada
 */
class MCPService {
  constructor() {
    this.tools = {
      weather: {
        name: 'weather',
        description: 'Obtiene información del clima actual y pronósticos',
        available: !!process.env.OPENWEATHER_API_KEY
      },
      gemini: {
        name: 'gemini',
        description: 'Genera respuestas usando Google Gemini AI',
        available: !!process.env.GEMINI_API_KEY
      }
    };
  }

  /**
   * Lista todas las herramientas disponibles
   */
  listTools() {
    return {
      success: true,
      tools: Object.values(this.tools).map(tool => ({
        name: tool.name,
        description: tool.description,
        available: tool.available
      })),
      total: Object.keys(this.tools).length,
      available: Object.values(this.tools).filter(t => t.available).length
    };
  }

  /**
   * Ejecuta una herramienta específica
   * @param {string} toolName - Nombre de la herramienta
   * @param {Object} params - Parámetros para la herramienta
   */
  async executeTool(toolName, params = {}) {
    const tool = this.tools[toolName];
    
    if (!tool) {
      throw new Error(`Herramienta "${toolName}" no encontrada`);
    }

    if (!tool.available) {
      throw new Error(`Herramienta "${toolName}" no está disponible (falta configuración)`);
    }

    try {
      switch (toolName) {
        case 'weather':
          return await this.executeWeatherTool(params);
        case 'gemini':
          return await this.executeGeminiTool(params);
        default:
          throw new Error(`Herramienta "${toolName}" no implementada`);
      }
    } catch (error) {
      throw new Error(`Error al ejecutar herramienta ${toolName}: ${error.message}`);
    }
  }

  /**
   * Ejecuta herramientas de clima
   */
  async executeWeatherTool(params) {
    const { action, city, days, lat, lon, units, lang } = params;

    switch (action) {
      case 'current':
        if (lat && lon) {
          return await weatherService.getWeatherByCoords(lat, lon, units, lang);
        }
        if (!city) {
          throw new Error('Se requiere "city" o coordenadas (lat, lon)');
        }
        return await weatherService.getCurrentWeather(city, units, lang);

      case 'forecast':
        if (!city) {
          throw new Error('Se requiere "city" para el pronóstico');
        }
        return await weatherService.getForecast(city, days || 5, units, lang);

      case 'rain':
      case 'rainProbability':
        if (!city) {
          throw new Error('Se requiere "city" para la probabilidad de lluvia');
        }
        return await weatherService.getRainProbability(city, days || 5);

      default:
        throw new Error(`Acción "${action}" no válida. Use: current, forecast, rain`);
    }
  }

  /**
   * Ejecuta herramientas de Gemini
   */
  async executeGeminiTool(params) {
    const { action, prompt, history, sensorData, weatherData, question, model } = params;

    switch (action) {
      case 'generate':
        if (!prompt) {
          throw new Error('Se requiere "prompt" para generar texto');
        }
        return await geminiService.generateText(prompt, { model });

      case 'chat':
        if (!prompt) {
          throw new Error('Se requiere "prompt" para el chat');
        }
        return await geminiService.generateWithHistory(history || [], prompt, { model });

      case 'analyze':
        if (!sensorData || !weatherData) {
          throw new Error('Se requiere "sensorData" y "weatherData" para análisis');
        }
        return await geminiService.analyzeSensorWithWeather(sensorData, weatherData, question);

      case 'recommendations':
        if (!sensorData || !weatherData) {
          throw new Error('Se requiere "sensorData" y "weatherData" para recomendaciones');
        }
        return await geminiService.generateRecommendations(sensorData, weatherData);

      default:
        throw new Error(`Acción "${action}" no válida. Use: generate, chat, analyze, recommendations`);
    }
  }

  /**
   * Ejecuta múltiples herramientas en secuencia o paralelo
   * @param {Array} tasks - Array de tareas [{tool, params}]
   * @param {boolean} parallel - Si ejecutar en paralelo o secuencial
   */
  async executeMultiple(tasks, parallel = false) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Se requiere un array de tareas');
    }

    if (parallel) {
      const results = await Promise.all(
        tasks.map(task => this.executeTool(task.tool, task.params))
      );
      return {
        success: true,
        results,
        count: results.length
      };
    } else {
      const results = [];
      for (const task of tasks) {
        const result = await this.executeTool(task.tool, task.params);
        results.push(result);
      }
      return {
        success: true,
        results,
        count: results.length
      };
    }
  }

  /**
   * Análisis integrado: combina datos de sensores con clima y genera insights con Gemini
   */
  async integratedAnalysis(sensorData, city, options = {}) {
    try {
      // 1. Obtener clima actual
      const currentWeather = await weatherService.getCurrentWeather(
        city,
        options.units || 'metric',
        options.lang || 'es'
      );

      // 2. Obtener pronóstico
      const forecast = await weatherService.getForecast(
        city,
        options.forecastDays || 5,
        options.units || 'metric',
        options.lang || 'es'
      );

      // 3. Análisis con Gemini
      const analysis = await geminiService.analyzeSensorWithWeather(
        sensorData,
        {
          ...currentWeather,
          pop: forecast.dailyForecast[0]?.maxRainProbability || 0
        },
        options.question
      );

      // 4. Recomendaciones
      const recommendations = await geminiService.generateRecommendations(
        sensorData,
        forecast
      );

      return {
        success: true,
        sensorData,
        weather: {
          current: currentWeather,
          forecast
        },
        analysis: analysis.text,
        recommendations: recommendations.text,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Error en análisis integrado: ${error.message}`);
    }
  }
}

module.exports = new MCPService();

