//src/routes/mcp.js
const express = require('express');
const router = express.Router();
const mcpService = require('../services/mcpService');
const weatherService = require('../services/weatherService');
const geminiService = require('../services/geminiService');
const SensorData = require('../models/SensorData');

/**
 * GET /api/mcp/tools - Lista todas las herramientas MCP disponibles
 */
router.get('/tools', (req, res) => {
  try {
    const tools = mcpService.listTools();
    res.json(tools);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mcp/execute - Ejecuta una herramienta MCP
 * Body: { tool: 'weather'|'gemini', params: {...} }
 */
router.post('/execute', async (req, res) => {
  try {
    const { tool, params } = req.body;

    if (!tool) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el parámetro "tool"'
      });
    }

    const result = await mcpService.executeTool(tool, params || {});
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mcp/execute-multiple - Ejecuta múltiples herramientas
 * Body: { tasks: [{tool, params}], parallel: boolean }
 */
router.post('/execute-multiple', async (req, res) => {
  try {
    const { tasks, parallel } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de "tasks"'
      });
    }

    const result = await mcpService.executeMultiple(tasks, parallel || false);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mcp/analyze - Análisis integrado de sensores con clima y Gemini
 * Body: { sensorId: string, city: string, question?: string, options?: {...} }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { sensorId, city, question, model, options } = req.body;  // Agregar 'model'

    if (!sensorId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "sensorId"'
      });
    }

    if (!city) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "city" para obtener datos del clima'
      });
    }

    // Obtener datos del sensor
    const sensorData = await SensorData.findById(sensorId);
    if (!sensorData) {
      return res.status(404).json({
        success: false,
        error: 'Sensor no encontrado'
      });
    }

    // Convertir a objeto plano
    const sensorDataObj = sensorData.toObject();

    // Ejecutar análisis integrado - pasar el modelo en options
    const result = await mcpService.integratedAnalysis(
      sensorDataObj,
      city,
      { question, model, ...options }  // Incluir 'model' aquí
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== RUTAS DE CLIMA ==========

/**
 * GET /api/mcp/weather/current - Obtiene el clima actual
 * Query: city, lat, lon, units, lang
 */
router.get('/weather/current', async (req, res) => {
  try {
    const { city, lat, lon, units, lang } = req.query;

    let result;
    if (lat && lon) {
      result = await weatherService.getWeatherByCoords(
        parseFloat(lat),
        parseFloat(lon),
        units || 'metric',
        lang || 'es'
      );
    } else if (city) {
      result = await weatherService.getCurrentWeather(
        city,
        units || 'metric',
        lang || 'es'
      );
    } else {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "city" o coordenadas (lat, lon)'
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/mcp/weather/forecast - Obtiene el pronóstico del tiempo
 * Query: city, days, units, lang
 */
router.get('/weather/forecast', async (req, res) => {
  try {
    const { city, days, units, lang } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "city"'
      });
    }

    const result = await weatherService.getForecast(
      city,
      parseInt(days) || 5,
      units || 'metric',
      lang || 'es'
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/mcp/weather/rain - Obtiene probabilidad de lluvia
 * Query: city, days
 */
router.get('/weather/rain', async (req, res) => {
  try {
    const { city, days } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "city"'
      });
    }

    const result = await weatherService.getRainProbability(
      city,
      parseInt(days) || 5
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== RUTAS DE GEMINI ==========

/**
 * POST /api/mcp/gemini/generate - Genera texto con Gemini
 * Body: { prompt: string, model?: string }
 */
router.post('/gemini/generate', async (req, res) => {
  try {
    const { prompt, model } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "prompt"'
      });
    }

    const result = await geminiService.generateText(prompt, { model });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mcp/gemini/chat - Chat con historial usando Gemini
 * Body: { prompt: string, history?: Array, model?: string }
 */
router.post('/gemini/chat', async (req, res) => {
  try {
    const { prompt, history, model } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "prompt"'
      });
    }

    const result = await geminiService.generateWithHistory(
      history || [],
      prompt,
      { model }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/mcp/gemini/analyze - Analiza datos de sensor con clima usando Gemini
 * Body: { sensorId: string, city: string, question?: string }
 */
router.post('/gemini/analyze', async (req, res) => {
  try {
    const { sensorId, city, question } = req.body;

    if (!sensorId || !city) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "sensorId" y "city"'
      });
    }

    // Obtener datos del sensor
    const sensorData = await SensorData.findById(sensorId);
    if (!sensorData) {
      return res.status(404).json({
        success: false,
        error: 'Sensor no encontrado'
      });
    }

    // Obtener clima actual
    const weatherData = await weatherService.getCurrentWeather(city);
    
    // Obtener pronóstico para probabilidad de lluvia
    const forecast = await weatherService.getForecast(city, 1);
    weatherData.pop = forecast.dailyForecast[0]?.maxRainProbability || 0;

    // Análisis con Gemini
    const result = await geminiService.analyzeSensorWithWeather(
      sensorData.toObject(),
      weatherData,
      question
    );

    res.json({
      success: true,
      analysis: result.text,
      sensorData: sensorData.toObject(),
      weatherData,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

