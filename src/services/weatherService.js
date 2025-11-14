//src/services/weatherService.js
const axios = require('axios');

class WeatherService {
  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    
    if (!this.apiKey) {
      console.warn('⚠️ OPENWEATHER_API_KEY no configurada. El servicio de clima no funcionará.');
    }
  }

  /**
   * Obtiene el clima actual de una ciudad
   * @param {string} city - Nombre de la ciudad
   * @param {string} units - Unidades: 'metric' (Celsius), 'imperial' (Fahrenheit), 'kelvin' (default)
   * @param {string} lang - Idioma de la respuesta (es, en, etc.)
   */
  async getCurrentWeather(city, units = 'metric', lang = 'es') {
    if (!this.apiKey) {
      throw new Error('OPENWEATHER_API_KEY no configurada');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: city,
          appid: this.apiKey,
          units,
          lang
        }
      });

      return {
        success: true,
        city: response.data.name,
        country: response.data.sys.country,
        temperature: response.data.main.temp,
        feelsLike: response.data.main.feels_like,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        description: response.data.weather[0].description,
        main: response.data.weather[0].main,
        windSpeed: response.data.wind?.speed || 0,
        windDirection: response.data.wind?.deg || 0,
        visibility: response.data.visibility ? response.data.visibility / 1000 : null, // en km
        clouds: response.data.clouds?.all || 0,
        sunrise: new Date(response.data.sys.sunrise * 1000),
        sunset: new Date(response.data.sys.sunset * 1000),
        timestamp: new Date(response.data.dt * 1000),
        raw: response.data
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Ciudad "${city}" no encontrada`);
      }
      if (error.response?.status === 401) {
        throw new Error('API Key de OpenWeather inválida');
      }
      throw new Error(`Error al obtener clima: ${error.message}`);
    }
  }

  /**
   * Obtiene el pronóstico del tiempo para los próximos días
   * @param {string} city - Nombre de la ciudad
   * @param {number} days - Número de días (máximo 5 para free tier)
   * @param {string} units - Unidades: 'metric', 'imperial', 'kelvin'
   * @param {string} lang - Idioma de la respuesta
   */
  async getForecast(city, days = 5, units = 'metric', lang = 'es') {
    if (!this.apiKey) {
      throw new Error('OPENWEATHER_API_KEY no configurada');
    }

    if (days > 5) {
      days = 5; // OpenWeather free tier solo permite 5 días
    }

    try {
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          q: city,
          appid: this.apiKey,
          units,
          lang,
          cnt: days * 8 // 8 mediciones por día (cada 3 horas)
        }
      });

      const forecast = response.data.list.map(item => ({
        date: new Date(item.dt * 1000),
        temperature: item.main.temp,
        feelsLike: item.main.feels_like,
        minTemp: item.main.temp_min,
        maxTemp: item.main.temp_max,
        humidity: item.main.humidity,
        pressure: item.main.pressure,
        description: item.weather[0].description,
        main: item.weather[0].main,
        windSpeed: item.wind?.speed || 0,
        windDirection: item.wind?.deg || 0,
        clouds: item.clouds?.all || 0,
        pop: item.pop || 0, // Probability of Precipitation (0-1)
        rain: item.rain?.['3h'] || 0, // mm de lluvia en las últimas 3h
        snow: item.snow?.['3h'] || 0 // mm de nieve en las últimas 3h
      }));

      // Agrupar por día para facilitar el análisis
      const dailyForecast = this.groupByDay(forecast);

      return {
        success: true,
        city: response.data.city.name,
        country: response.data.city.country,
        forecast,
        dailyForecast,
        count: forecast.length
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Ciudad "${city}" no encontrada`);
      }
      if (error.response?.status === 401) {
        throw new Error('API Key de OpenWeather inválida');
      }
      throw new Error(`Error al obtener pronóstico: ${error.message}`);
    }
  }

  /**
   * Obtiene información sobre probabilidad de lluvia para los próximos días
   * @param {string} city - Nombre de la ciudad
   * @param {number} days - Número de días
   */
  async getRainProbability(city, days = 5) {
    const forecast = await this.getForecast(city, days);
    
    const rainAnalysis = forecast.dailyForecast.map(day => {
      const forecasts = day.forecasts || [];
      if (forecasts.length === 0) {
        return {
          date: day.date,
          maxProbability: 0,
          avgProbability: 0,
          totalRain: 0,
          hasRain: false,
          description: 'N/A',
          main: 'N/A'
        };
      }

      return {
        date: day.date,
        maxProbability: Math.max(...forecasts.map(f => f.pop || 0)),
        avgProbability: forecasts.reduce((sum, f) => sum + (f.pop || 0), 0) / forecasts.length,
        totalRain: forecasts.reduce((sum, f) => sum + (f.rain || 0), 0),
        hasRain: forecasts.some(f => (f.rain || 0) > 0),
        description: forecasts[0]?.description || 'N/A',
        main: forecasts[0]?.main || 'N/A'
      };
    });

    return {
      success: true,
      city: forecast.city,
      country: forecast.country,
      rainAnalysis,
      summary: {
        daysWithRain: rainAnalysis.filter(d => d.hasRain).length,
        totalDays: rainAnalysis.length,
        highestProbability: rainAnalysis.length > 0 ? Math.max(...rainAnalysis.map(d => d.maxProbability)) : 0
      }
    };
  }

  /**
   * Agrupa el pronóstico por día
   */
  groupByDay(forecast) {
    if (!forecast || forecast.length === 0) {
      return [];
    }

    const grouped = {};
    
    forecast.forEach(item => {
      const dateKey = item.date.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: new Date(dateKey),
          forecasts: []
        };
      }
      grouped[dateKey].forecasts.push(item);
    });

    return Object.values(grouped).map(day => {
      if (!day.forecasts || day.forecasts.length === 0) {
        return {
          date: day.date,
          forecasts: day.forecasts || [],
          avgTemp: 0,
          minTemp: 0,
          maxTemp: 0,
          avgHumidity: 0,
          maxRainProbability: 0
        };
      }

      return {
        date: day.date,
        forecasts: day.forecasts,
        avgTemp: day.forecasts.reduce((sum, f) => sum + f.temperature, 0) / day.forecasts.length,
        minTemp: Math.min(...day.forecasts.map(f => f.minTemp)),
        maxTemp: Math.max(...day.forecasts.map(f => f.maxTemp)),
        avgHumidity: day.forecasts.reduce((sum, f) => sum + f.humidity, 0) / day.forecasts.length,
        maxRainProbability: Math.max(...day.forecasts.map(f => f.pop))
      };
    });
  }

  /**
   * Obtiene el clima por coordenadas
   */
  async getWeatherByCoords(lat, lon, units = 'metric', lang = 'es') {
    if (!this.apiKey) {
      throw new Error('OPENWEATHER_API_KEY no configurada');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units,
          lang
        }
      });

      return {
        success: true,
        city: response.data.name,
        country: response.data.sys.country,
        coordinates: {
          lat: response.data.coord.lat,
          lon: response.data.coord.lon
        },
        temperature: response.data.main.temp,
        feelsLike: response.data.main.feels_like,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        description: response.data.weather[0].description,
        main: response.data.weather[0].main,
        windSpeed: response.data.wind?.speed || 0,
        windDirection: response.data.wind?.deg || 0,
        visibility: response.data.visibility ? response.data.visibility / 1000 : null,
        clouds: response.data.clouds?.all || 0,
        timestamp: new Date(response.data.dt * 1000)
      };
    } catch (error) {
      throw new Error(`Error al obtener clima por coordenadas: ${error.message}`);
    }
  }
}

module.exports = new WeatherService();

