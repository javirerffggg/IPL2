/* =====================================================
   IPL TRACKER - GESTIÓN DE BASE DE DATOS (IndexedDB)
   ===================================================== */

const DB_NAME = 'IPLTrackerDB';
const DB_VERSION = 1;

// Clase para gestionar IndexedDB
class IPLDatabase {
  constructor() {
    this.db = null;
  }

  // Inicializar base de datos
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store: Configuración del usuario
        if (!db.objectStoreNames.contains('config')) {
          const configStore = db.createObjectStore('config', { keyPath: 'key' });
        }

        // Store: Sesiones completadas
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          sessionStore.createIndex('date', 'date', { unique: false });
          sessionStore.createIndex('type', 'type', { unique: false });
        }

        // Store: Fotos de progreso
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          photoStore.createIndex('date', 'date', { unique: false });
          photoStore.createIndex('zone', 'zone', { unique: false });
        }

        // Store: Calendario generado
        if (!db.objectStoreNames.contains('calendar')) {
          const calendarStore = db.createObjectStore('calendar', { 
            keyPath: 'date' 
          });
        }
      };
    });
  }

  // === CONFIGURACIÓN ===
  
  async getConfig(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async setConfig(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['config'], 'readwrite');
      const store = transaction.objectStore('config');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllConfig() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');
      const request = store.getAll();

      request.onsuccess = () => {
        const config = {};
        request.result.forEach(item => {
          config[item.key] = item.value;
        });
        resolve(config);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // === SESIONES ===

  async addSession(sessionData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      
      const session = {
        date: new Date().toISOString(),
        type: sessionData.type, // 'legs', 'torso', 'shoulders'
        zones: sessionData.zones, // Array de zonas tratadas
        duration: sessionData.duration, // Segundos
        shots: sessionData.shots || 0,
        notes: sessionData.notes || '',
        completed: true,
        timestamp: Date.now()
      };

      const request = store.add(session);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionsByDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const index = store.index('date');
      
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSessions() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionStats() {
    const sessions = await this.getAllSessions();
    
    const totalSessions = sessions.length;
    const totalTime = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
    const totalShots = sessions.reduce((acc, s) => acc + (s.shots || 0), 0);

    return {
      totalSessions,
      totalTime: Math.floor(totalTime / 3600), // Convertir a horas
      totalShots
    };
  }

  // === FOTOS ===

  async addPhoto(photoData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readwrite');
      const store = transaction.objectStore('photos');
      
      const photo = {
        date: new Date().toISOString(),
        zone: photoData.zone, // 'chest', 'abdomen', 'shoulders', etc.
        imageData: photoData.imageData, // Base64 o Blob
        week: photoData.week || 0,
        phase: photoData.phase || 'attack',
        notes: photoData.notes || '',
        timestamp: Date.now()
      };

      const request = store.add(photo);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPhotosByZone(zone) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readonly');
      const store = transaction.objectStore('photos');
      const index = store.index('zone');
      const request = index.getAll(zone);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPhotos() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readonly');
      const store = transaction.objectStore('photos');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePhoto(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readwrite');
      const store = transaction.objectStore('photos');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // === CALENDARIO ===

  async addCalendarEvent(eventData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['calendar'], 'readwrite');
      const store = transaction.objectStore('calendar');
      const request = store.put(eventData);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCalendarEvent(date) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['calendar'], 'readonly');
      const store = transaction.objectStore('calendar');
      const request = store.get(date);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCalendarMonth(year, month) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['calendar'], 'readonly');
      const store = transaction.objectStore('calendar');
      const request = store.getAll();

      request.onsuccess = () => {
        const events = request.result.filter(event => {
          const eventDate = new Date(event.date);
          return eventDate.getFullYear() === year && 
                 eventDate.getMonth() === month;
        });
        resolve(events);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateCalendarEvent(date, updates) {
    const event = await this.getCalendarEvent(date);
    if (!event) return null;

    const updatedEvent = { ...event, ...updates };
    return this.addCalendarEvent(updatedEvent);
  }

  // === EXPORTAR/IMPORTAR ===

  async exportAllData() {
    const config = await this.getAllConfig();
    const sessions = await this.getAllSessions();
    const photos = await this.getAllPhotos();
    
    const transaction = this.db.transaction(['calendar'], 'readonly');
    const store = transaction.objectStore('calendar');
    const calendarRequest = store.getAll();
    
    return new Promise((resolve, reject) => {
      calendarRequest.onsuccess = () => {
        const exportData = {
          version: DB_VERSION,
          exportDate: new Date().toISOString(),
          config,
          sessions,
          photos,
          calendar: calendarRequest.result
        };
        resolve(exportData);
      };
      calendarRequest.onerror = () => reject(calendarRequest.error);
    });
  }

  async importData(importedData) {
    // Validar versión
    if (importedData.version !== DB_VERSION) {
      throw new Error('Versión de datos incompatible');
    }

    // Importar configuración
    if (importedData.config) {
      for (const [key, value] of Object.entries(importedData.config)) {
        await this.setConfig(key, value);
      }
    }

    // Importar sesiones
    if (importedData.sessions) {
      const transaction = this.db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      
      for (const session of importedData.sessions) {
        store.add(session);
      }
    }

    // Importar fotos
    if (importedData.photos) {
      const transaction = this.db.transaction(['photos'], 'readwrite');
      const store = transaction.objectStore('photos');
      
      for (const photo of importedData.photos) {
        store.add(photo);
      }
    }

    // Importar calendario
    if (importedData.calendar) {
      const transaction = this.db.transaction(['calendar'], 'readwrite');
      const store = transaction.objectStore('calendar');
      
      for (const event of importedData.calendar) {
        store.put(event);
      }
    }

    return true;
  }

  async clearAllData() {
    return new Promise((resolve, reject) => {
      const storeNames = ['config', 'sessions', 'photos', 'calendar'];
      const transaction = this.db.transaction(storeNames, 'readwrite');

      storeNames.forEach(storeName => {
        transaction.objectStore(storeName).clear();
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // === CALCULAR ALMACENAMIENTO ===

  async calculateStorageUsed() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
      const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
      return { usedMB, quotaMB, percentage: (estimate.usage / estimate.quota * 100).toFixed(1) };
    }
    return null;
  }
}

// Instancia global
const db = new IPLDatabase();
