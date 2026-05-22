/* =====================================================
   IPL TRACKER - MÓDULO DE ÍNDICE UV (OpenMeteo API)
   ===================================================== */

class WeatherService {
  constructor() {
    this.apiBase = 'https://api.open-meteo.com/v1/forecast';
    this.cachedData = null;
    this.cacheExpiry = null;
    this.cacheDuration = 3600000; // 1 hora en milisegundos
  }

  // Obtener coordenadas del usuario
  async getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no disponible'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        error => {
          reject(error);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 3600000 // Aceptar posición de hasta 1 hora
        }
      );
    });
  }

  // Obtener índice UV actual
  async getUVIndex() {
    try {
      // Verificar caché
      if (this.cachedData && this.cacheExpiry && Date.now() < this.cacheExpiry) {
        return this.cachedData;
      }

      // Obtener ubicación
      const location = await this.getLocation();
      
      // Construir URL de API
      const url = new URL(this.apiBase);
      url.searchParams.append('latitude', location.latitude);
      url.searchParams.append('longitude', location.longitude);
      url.searchParams.append('current', 'uv_index');
      url.searchParams.append('timezone', 'auto');

      // Hacer petición
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al obtener datos del clima');
      }

      const data = await response.json();
      
      // Procesar datos
      const uvIndex = data.current.uv_index;
      const uvData = {
        value: uvIndex,
        status: this.getUVStatus(uvIndex),
        color: this.getUVColor(uvIndex),
        warning: uvIndex >= 6,
        message: this.getUVMessage(uvIndex),
        timestamp: Date.now()
      };

      // Guardar en caché
      this.cachedData = uvData;
      this.cacheExpiry = Date.now() + this.cacheDuration;

      return uvData;

    } catch (error) {
      console.error('Error obteniendo UV index:', error);
      
      // Retornar datos por defecto en caso de error
      return {
        value: '--',
        status: 'Sin conexión — UV no disponible',
        color: '#ff4444',
        warning: true,
        message: 'Sin conexión a internet o error en la API. No se pudo obtener el índice UV.',
        error: true
      };
    }
  }

  // Clasificar nivel de UV
  getUVStatus(uv) {
    if (uv <= 2) return 'BAJO (Seguro)';
    if (uv <= 5) return 'MODERADO';
    if (uv <= 7) return 'ALTO';
    if (uv <= 10) return 'MUY ALTO';
    return 'EXTREMO';
  }

  // Color según nivel de UV
  getUVColor(uv) {
    if (uv <= 2) return '#00ff88'; // Verde
    if (uv <= 5) return '#ffa500'; // Naranja
    if (uv <= 7) return '#ff6b35'; // Naranja oscuro
    if (uv <= 10) return '#ff4444'; // Rojo
    return '#b91c1c'; // Rojo oscuro
  }

  // Mensaje según nivel de UV
  getUVMessage(uv) {
    if (uv <= 2) {
      return 'Radiación mínima. Operaciones autorizadas.';
    }
    if (uv <= 5) {
      return 'Nivel moderado. Evita exposición solar 24h antes/después de la sesión.';
    }
    if (uv <= 7) {
      return '⚠️ Nivel alto. No te expongas al sol sin protección.';
    }
    if (uv <= 10) {
      return '⚠️ Nivel muy alto. Si tienes sesión mañana, SUSPÉNDELA.';
    }
    return '🚨 NIVEL EXTREMO. NO hagas sesiones IPL en los próximos 7 días.';
  }

  // Verificar si es seguro hacer sesión
  isSafeForSession(uv) {
    return uv <= 5;
  }

  // Obtener pronóstico de UV para los próximos 3 días
  async getUVForecast() {
    try {
      const location = await this.getLocation();
      
      const url = new URL(this.apiBase);
      url.searchParams.append('latitude', location.latitude);
      url.searchParams.append('longitude', location.longitude);
      url.searchParams.append('daily', 'uv_index_max');
      url.searchParams.append('timezone', 'auto');
      url.searchParams.append('forecast_days', '3');

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al obtener pronóstico');
      }

      const data = await response.json();
      
      return data.daily.time.map((date, index) => ({
        date,
        uvMax: data.daily.uv_index_max[index],
        safe: data.daily.uv_index_max[index] <= 5
      }));

    } catch (error) {
      console.error('Error obteniendo pronóstico UV:', error);
      return null;
    }
  }
}

// Instancia global
const weatherService = new WeatherService();
