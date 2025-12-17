/* =====================================================
   IPL TRACKER - APLICACIÓN PRINCIPAL
   ===================================================== */

// Variables globales
let currentView = 'dashboard';
let calendarInstance = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let sessionTimer = null;
let sessionStartTime = null;

// =====================================================
// INICIALIZACIÓN
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando IPL Tracker...');

  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registrado:', registration);
    } catch (error) {
      console.error('❌ Error registrando Service Worker:', error);
    }
  }

  // Inicializar base de datos
  try {
    await db.init();
    console.log('✅ Base de datos inicializada');
  } catch (error) {
    console.error('❌ Error inicializando DB:', error);
    alert('Error al inicializar la aplicación. Intenta recargar la página.');
    return;
  }

  // Verificar si es la primera vez
  const isFirstTime = await db.getConfig('firstTime');
  
  if (isFirstTime === undefined || isFirstTime === true) {
    // Mostrar onboarding
    showOnboarding();
  } else {
    // Inicializar aplicación normal
    await initializeApp();
  }

  // Configurar event listeners
  setupEventListeners();

  // Mostrar prompt de instalación para iOS
  detectAndPromptInstall();
});

// =====================================================
// ONBOARDING
// =====================================================

let currentOnboardingStep = 1;
let selectedFitzpatrick = 3;

function showOnboarding() {
  document.getElementById('onboardingModal').style.display = 'flex';
  
  // Configurar selector Fitzpatrick
  document.querySelectorAll('.fitz-option').forEach(option => {
    option.addEventListener('click', function() {
      document.querySelectorAll('.fitz-option').forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');
      selectedFitzpatrick = parseInt(this.dataset.type);
    });
  });

  // Establecer fecha mínima (hoy)
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('startDate').value = today;
  document.getElementById('startDate').min = today;
}

function nextOnboardingStep() {
  const currentStepEl = document.querySelector(`.onboarding-step[data-step="${currentOnboardingStep}"]`);
  
  // Validación básica
  if (currentOnboardingStep === 4) {
    const startDate = document.getElementById('startDate').value;
    if (!startDate) {
      alert('Por favor selecciona una fecha de inicio');
      return;
    }
  }

  currentStepEl.classList.remove('active');
  currentOnboardingStep++;
  
  const nextStepEl = document.querySelector(`.onboarding-step[data-step="${currentOnboardingStep}"]`);
  if (nextStepEl) {
    nextStepEl.classList.add('active');
  }
}

function prevOnboardingStep() {
  const currentStepEl = document.querySelector(`.onboarding-step[data-step="${currentOnboardingStep}"]`);
  currentStepEl.classList.remove('active');
  currentOnboardingStep--;
  
  const prevStepEl = document.querySelector(`.onboarding-step[data-step="${currentOnboardingStep}"]`);
  prevStepEl.classList.add('active');
}

async function completeOnboarding() {
  // Recoger datos del onboarding
  const config = {
    gender: document.getElementById('userGender').value,
    hairType: document.getElementById('hairType').value,
    availability: document.querySelector('input[name="availability"]:checked').value,
    skinType: selectedFitzpatrick,
    startDate: document.getElementById('startDate').value,
    firstTime: false
  };

  // Guardar configuración
  for (const [key, value] of Object.entries(config)) {
    await db.setConfig(key, value);
  }

  // Generar calendario
  const generator = new CalendarGenerator(config.startDate, config.availability);
  const events = generator.generate();
  
  // Guardar eventos en la base de datos
  for (const event of events) {
    await db.addCalendarEvent(event);
  }

  console.log('✅ Configuración guardada, calendario generado');

  // Cerrar modal y mostrar app
  document.getElementById('onboardingModal').style.display = 'none';
  await initializeApp();
}

// =====================================================
// INICIALIZACIÓN DE LA APP
// =====================================================

async function initializeApp() {
  console.log('📱 Inicializando aplicación...');

  // Cargar configuración
  const config = await db.getAllConfig();
  
  if (!config.startDate) {
    showOnboarding();
    return;
  }

  // Crear instancia del calendario
  calendarInstance = new CalendarGenerator(config.startDate, config.availability || 'weekend');

  // Actualizar UI del dashboard
  await updateDashboard();

  // Cargar índice UV
  await updateUVWidget();

  // Renderizar calendario del mes actual
  renderCalendar(currentYear, currentMonth);

  // Cargar galería de fotos
  await updatePhotoGallery();

  // Actualizar ajustes
  updateSettingsUI(config);

  // Calcular almacenamiento
  updateStorageInfo();

  console.log('✅ Aplicación lista');
}

// =====================================================
// DASHBOARD
// =====================================================

async function updateDashboard() {
  // Obtener fase actual
  const phase = calendarInstance.getCurrentPhase();
  
  document.getElementById('currentPhase').textContent = phase.name;
  document.getElementById('currentPhase').className = `value ${phase.color}`;
  
  if (phase.total > 0) {
    document.getElementById('currentWeek').textContent = `${phase.week} / ${phase.total}`;
    const progress = (phase.week / phase.total) * 100;
    document.getElementById('phaseProgress').style.width = `${progress}%`;
  } else {
    document.getElementById('currentWeek').textContent = 'Mantenimiento';
    document.getElementById('phaseProgress').style.width = '100%';
  }

  // Obtener próxima sesión
  const nextEvent = calendarInstance.getNextEvent();
  
  if (nextEvent) {
    const eventDate = new Date(nextEvent.date);
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    
    document.getElementById('nextDay').textContent = dayNames[eventDate.getDay()];
    document.getElementById('nextDate').textContent = `${eventDate.getDate()} ${monthNames[eventDate.getMonth()]}`;
    document.getElementById('nextTarget').textContent = nextEvent.title.toUpperCase();
    document.getElementById('nextZones').textContent = nextEvent.zones.join(' + ');

    // Determinar próximo protocolo
    const futureEvents = calendarInstance.events.filter(e => e.date > nextEvent.date && !e.completed);
    const nextSpecial = futureEvents.find(e => e.type === 'torso_shoulders');
    
    if (nextSpecial) {
      document.getElementById('nextProtocol').textContent = 'HOMBROS (Degradado)';
    } else {
      document.getElementById('nextProtocol').textContent = 'ESTÁNDAR';
    }
  } else {
    document.getElementById('nextDay').textContent = '--';
    document.getElementById('nextDate').textContent = '--';
    document.getElementById('nextTarget').textContent = 'No hay sesiones pendientes';
    document.getElementById('nextZones').textContent = '';
  }

  // Actualizar estadísticas
  const stats = await db.getSessionStats();
  document.getElementById('totalSessions').textContent = stats.totalSessions;
  document.getElementById('totalTime').textContent = `${stats.totalTime}h`;
  document.getElementById('totalShots').textContent = stats.totalShots.toLocaleString();

  // Estado del dispositivo (simulado - puede personalizarse)
  document.getElementById('deviceBattery').textContent = '98% - Listo';
  document.getElementById('shotsRemaining').textContent = '~285,000';
}

// =====================================================
// ÍNDICE UV
// =====================================================

async function updateUVWidget() {
  const uvData = await weatherService.getUVIndex();
  
  document.getElementById('uvValue').textContent = uvData.value;
  document.getElementById('uvValue').style.color = uvData.color;
  document.getElementById('uvStatus').textContent = uvData.status;

  const warningBanner = document.getElementById('uvWarning');
  
  if (uvData.warning) {
    warningBanner.style.display = 'flex';
    warningBanner.querySelector('p').textContent = uvData.message;
  } else {
    warningBanner.style.display = 'none';
  }
}

// =====================================================
// CALENDARIO
// =====================================================

function renderCalendar(year, month) {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  // Actualizar título
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;

  // Headers de días
  const dayHeaders = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  dayHeaders.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-day header';
    header.textContent = day;
    grid.appendChild(header);
  });

  // Obtener primer día del mes
  const firstDay = new Date(year, month, 1);
  let dayOfWeek = firstDay.getDay();
  dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Ajustar: Lunes = 0

  // Días vacíos al inicio
  for (let i = 0; i < dayOfWeek; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    grid.appendChild(empty);
  }

  // Días del mes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateString = date.toISOString().split('T')[0];
    
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayEl.appendChild(dayNumber);

    // Buscar evento para este día
    const event = calendarInstance.getEventByDate(dateString);
    
    if (event) {
      dayEl.classList.add(event.type === 'rest' ? 'rest' : 'session');
      
      if (event.completed) {
        dayEl.classList.add('completed');
        const check = document.createElement('div');
        check.className = 'check-mark';
        check.textContent = '✓';
        dayEl.appendChild(check);
      }

      const icon = document.createElement('div');
      icon.className = 'day-icon';
      icon.textContent = event.icon;
      dayEl.appendChild(icon);

      // Click para mostrar detalles
      dayEl.addEventListener('click', () => showSessionDetails(event));
    }

    grid.appendChild(dayEl);
  }
}

function showSessionDetails(event) {
  const details = document.getElementById('sessionDetails');
  const content = document.getElementById('detailContent');

  const eventDate = new Date(event.date);
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  document.getElementById('detailDate').textContent = 
    `${dayNames[eventDate.getDay()]} ${eventDate.getDate()} ${monthNames[eventDate.getMonth()]}`;

  let html = `
    <div class="zone-info-item">
      <strong>Tipo de sesión</strong>
      <p>${event.title}</p>
    </div>
  `;

  if (event.zones && event.zones.length > 0) {
    html += `
      <div class="zone-info-item">
        <strong>Zonas a tratar</strong>
        <p>${event.zones.join(', ')}</p>
      </div>
    `;
  }

  html += `
    <div class="zone-info-item">
      <strong>Fase</strong>
      <p>${event.phase === 'attack' ? 'Ataque' : event.phase === 'transition' ? 'Transición' : 'Mantenimiento'}</p>
    </div>
  `;

  if (event.notes) {
    html += `
      <div class="zone-info-item">
        <strong>Notas importantes</strong>
        <p>${event.notes}</p>
      </div>
    `;
  }

  if (!event.completed && event.type !== 'rest') {
    html += `
      <button class="btn-primary btn-block" onclick="startSession('${event.date}')">
        <span class="material-icons">play_arrow</span>
        Iniciar Sesión
      </button>
    `;
  } else if (event.completed) {
    html += `
      <div class="info-text">
        <span class="material-icons">check_circle</span>
        Sesión completada
      </div>
    `;
  }

  content.innerHTML = html;
  details.style.display = 'block';
}

// =====================================================
// MAPA CORPORAL Y ZONAS
// =====================================================

function initBodyMap() {
  const zones = document.querySelectorAll('.body-zone.clickable');
  
  zones.forEach(zone => {
    zone.addEventListener('click', function() {
      const zoneId = this.id.replace('zone-', '');
      showZoneInfo(zoneId);
    });
  });

  document.getElementById('closeDetails')?.addEventListener('click', () => {
    document.getElementById('sessionDetails').style.display = 'none';
  });
}

function showZoneInfo(zoneId) {
  const zoneData = {
    shoulders: {
      name: 'Hombros (Zona Degradado)',
      info: [
        {
          title: 'Frecuencia',
          text: 'Solo 1 vez cada 4 semanas durante Fase de Ataque'
        },
        {
          title: 'Preparación',
          text: 'Recortar con máquina al 1-2mm (NO afeitar con cuchilla)'
        },
        {
          title: 'Técnica: Regla de la Axila',
          text: '🟢 Por ENCIMA de la axila: Disparos salteados (patrón ajedrez)\n🟡 Línea de la axila: Entresacar con máquina sin peine\n🔴 Por DEBAJO: NO disparar'
        },
        {
          title: 'Potencia',
          text: 'Nivel 3-4 (según tolerancia)'
        },
        {
          title: 'Advertencia',
          text: '⚠️ Esta es la zona más delicada. El objetivo es REDUCIR densidad, no eliminar.'
        }
      ]
    },
    chest: {
      name: 'Pecho',
      info: [
        {
          title: 'Preparación',
          text: 'Rasurado completo con cuchilla el mismo día'
        },
        {
          title: 'Potencia',
          text: 'Nivel máximo (5)'
        },
        {
          title: 'Técnica',
          text: 'Disparos en filas ordenadas de arriba a abajo'
        },
        {
          title: 'Zona sensible',
          text: 'El esternón puede doler más (menos grasa). Presiona bien el cabezal.'
        }
      ]
    },
    abdomen: {
      name: 'Abdomen',
      info: [
        {
          title: 'Preparación',
          text: 'Rasurado completo con cuchilla'
        },
        {
          title: 'Potencia',
          text: 'Nivel máximo (5)'
        },
        {
          title: 'Técnica',
          text: 'Disparos ordenados. Puedes estirar la piel para mejor contacto.'
        }
      ]
    },
    thighs: {
      name: 'Muslos',
      info: [
        {
          title: 'Preparación',
          text: 'Rasurado en la ducha del viernes noche o sábado mañana'
        },
        {
          title: 'Potencia',
          text: 'Nivel máximo (5) - Esta zona aguanta bien'
        },
        {
          title: 'Técnica',
          text: 'Modo deslizamiento rápido. Zona grande, paciencia.'
        },
        {
          title: 'Tiempo estimado',
          text: '15-20 minutos ambos muslos'
        }
      ]
    },
    calves: {
      name: 'Gemelos y Espinillas',
      info: [
        {
          title: 'Preparación',
          text: 'Rasurado con cuidado (zona con curvas)'
        },
        {
          title: 'Potencia',
          text: 'Nivel máximo (5) en gemelos\n⚠️ NIVEL 2-3 en espinillas (hueso)'
        },
        {
          title: 'Zona de dolor',
          text: '🔴 La espinilla DUELE. Cambia a modo suave justo encima del hueso de la tibia.'
        },
        {
          title: 'Tobillos',
          text: 'Mucho cuidado con la piel fina. Potencia reducida.'
        }
      ]
    },
    glutes: {
      name: 'Glúteos',
      info: [
        {
          title: 'Preparación',
          text: 'Rasurado. Usa un espejo.'
        },
        {
          title: 'Potencia',
          text: 'Nivel máximo (5)'
        },
        {
          title: 'Advertencia piel oscura',
          text: '⚠️ Zona interglútea: Si la piel es muy oscura, la máquina puede NO disparar (luz roja). No fuerces.'
        },
        {
          title: 'Protección',
          text: 'NO disparar cerca de zona íntima'
        }
      ]
    },
    arms: {
      name: 'Brazos',
      info: [
        {
          title: 'Recomendación',
          text: 'Los brazos normalmente NO se tratan con IPL en hombres (pelo natural).'
        },
        {
          title: 'Excepción',
          text: 'Si tienes vello muy denso y oscuro, puedes reducir densidad igual que los hombros.'
        }
      ]
    }
  };

  const data = zoneData[zoneId];
  
  if (!data) {
    console.error('Zona no encontrada:', zoneId);
    return;
  }

  document.getElementById('zoneName').textContent = data.name;
  
  let infoHTML = '';
  data.info.forEach(item => {
    infoHTML += `
      <div class="zone-info-item">
        <strong>${item.title}</strong>
        <p>${item.text.replace(/\n/g, '<br>')}</p>
      </div>
    `;
  });

  document.getElementById('zoneInfo').innerHTML = infoHTML;
  
  const sheet = document.getElementById('zoneSheet');
  sheet.classList.add('open');
}

// Cerrar bottom sheet al hacer clic fuera
document.addEventListener('click', (e) => {
  const sheet = document.getElementById('zoneSheet');
  if (sheet && sheet.classList.contains('open') && !sheet.contains(e.target) && !e.target.closest('.body-zone')) {
    sheet.classList.remove('open');
  }
});
// =====================================================
// SESIÓN ACTIVA
// =====================================================

async function startSession(dateString) {
  const event = calendarInstance.getEventByDate(dateString);
  
  if (!event || event.type === 'rest') {
    alert('No hay sesión programada para este día');
    return;
  }

  // Cerrar detalles del calendario
  document.getElementById('sessionDetails').style.display = 'none';

  // Abrir modal de sesión
  const modal = document.getElementById('sessionModal');
  document.getElementById('sessionTitle').textContent = `Sesión: ${event.title}`;

  // Generar checklist de zonas
  const checklist = document.getElementById('sessionChecklist');
  checklist.innerHTML = '';

  event.zones.forEach((zone, index) => {
    const item = document.createElement('div');
    item.className = 'checklist-item';
    item.innerHTML = `
      <input type="checkbox" id="zone-${index}" data-zone="${zone}">
      <label for="zone-${index}">${zone}</label>
    `;
    
    item.querySelector('input').addEventListener('change', function() {
      if (this.checked) {
        item.classList.add('checked');
      } else {
        item.classList.remove('checked');
      }
    });

    checklist.appendChild(item);
  });

  // Resetear notas
  document.getElementById('sessionNotes').value = '';

  // Iniciar temporizador
  sessionStartTime = Date.now();
  startSessionTimer();

  modal.style.display = 'flex';
}

function startSessionTimer() {
  const display = document.getElementById('sessionTime');
  
  sessionTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
}

function stopSessionTimer() {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
}

async function completeSession() {
  const checklist = document.querySelectorAll('#sessionChecklist input[type="checkbox"]');
  const completedZones = [];
  
  checklist.forEach(checkbox => {
    if (checkbox.checked) {
      completedZones.push(checkbox.dataset.zone);
    }
  });

  if (completedZones.length === 0) {
    const confirm = window.confirm('No has marcado ninguna zona. ¿Continuar sin guardar progreso?');
    if (!confirm) return;
  }

  const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
  const notes = document.getElementById('sessionNotes').value;

  // Obtener evento actual
  const title = document.getElementById('sessionTitle').textContent.replace('Sesión: ', '');
  let sessionType = 'torso';
  
  if (title.includes('Inferior')) sessionType = 'legs';
  if (title.includes('Hombros')) sessionType = 'shoulders';

  // Guardar sesión en DB
  try {
    await db.addSession({
      type: sessionType,
      zones: completedZones,
      duration: duration,
      shots: estimateShots(completedZones),
      notes: notes
    });

    // Marcar evento del calendario como completado
    const today = new Date().toISOString().split('T')[0];
    await db.updateCalendarEvent(today, { completed: true });

    console.log('✅ Sesión guardada');

    // Detener timer
    stopSessionTimer();

    // Cerrar modal
    document.getElementById('sessionModal').style.display = 'none';

    // Actualizar dashboard
    await updateDashboard();
    renderCalendar(currentYear, currentMonth);

    // Mostrar mensaje de éxito
    showSuccessMessage('¡Sesión completada! 🎉');

  } catch (error) {
    console.error('Error guardando sesión:', error);
    alert('Error al guardar la sesión. Inténtalo de nuevo.');
  }
}

function estimateShots(zones) {
  // Estimación aproximada de disparos por zona
  const shotsPerZone = {
    'Piernas': 150,
    'Glúteos': 40,
    'Pecho': 50,
    'Abdomen': 60,
    'Hombros (Degradado)': 30,
    'Hombros': 30
  };

  return zones.reduce((total, zone) => {
    return total + (shotsPerZone[zone] || 30);
  }, 0);
}

function showSuccessMessage(message) {
  // Crear toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #00d9ff, #7c3aed);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 2000;
    font-weight: 600;
    animation: slideDown 0.3s ease;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =====================================================
// PROGRESO FOTOGRÁFICO
// =====================================================

async function initPhotoCapture() {
  const video = document.getElementById('cameraPreview');
  const canvas = document.getElementById('captureCanvas');
  const ghostCanvas = document.getElementById('ghostOverlay');

  cameraService.init(video, canvas, ghostCanvas);

  // Botones de cámara
  document.getElementById('startCamera').addEventListener('click', async () => {
    const started = await cameraService.startCamera('user');
    
    if (started) {
      document.getElementById('startCamera').style.display = 'none';
      document.getElementById('capturePhoto').style.display = 'inline-flex';
      document.getElementById('stopCamera').style.display = 'inline-flex';
    }
  });

  document.getElementById('stopCamera').addEventListener('click', () => {
    cameraService.stopCamera();
    cameraService.disableGhostMode();
    
    document.getElementById('startCamera').style.display = 'inline-flex';
    document.getElementById('capturePhoto').style.display = 'none';
    document.getElementById('stopCamera').style.display = 'none';
    
    document.getElementById('enableGhost').checked = false;
  });

  document.getElementById('capturePhoto').addEventListener('click', async () => {
    const imageData = cameraService.capturePhoto();
    
    if (!imageData) return;

    const zone = document.getElementById('photoZone').value;
    const config = await db.getAllConfig();
    const phase = calendarInstance.getCurrentPhase();

    try {
      await db.addPhoto({
        zone: zone,
        imageData: imageData,
        week: phase.week,
        phase: phase.name.toLowerCase()
      });

      showSuccessMessage('Foto guardada correctamente');
      await updatePhotoGallery();

    } catch (error) {
      console.error('Error guardando foto:', error);
      alert('Error al guardar la foto');
    }
  });

  // Ghost mode
  document.getElementById('enableGhost').addEventListener('change', async function() {
    if (this.checked) {
      const zone = document.getElementById('photoZone').value;
      const opacity = document.getElementById('ghostOpacity').value / 100;
      
      const enabled = await cameraService.enableGhostMode(zone, opacity);
      
      if (!enabled) {
        this.checked = false;
      }
    } else {
      cameraService.disableGhostMode();
    }
  });

  document.getElementById('ghostOpacity').addEventListener('input', function() {
    document.getElementById('opacityValue').textContent = this.value;
    
    if (document.getElementById('enableGhost').checked) {
      const opacity = this.value / 100;
      cameraService.updateGhostOpacity(opacity);
    }
  });
}

async function updatePhotoGallery() {
  const gallery = document.getElementById('photoGallery');
  const photos = await db.getAllPhotos();

  if (photos.length === 0) {
    gallery.innerHTML = `
      <div class="empty-state">
        <span class="material-icons">photo_library</span>
        <p>No hay fotos guardadas</p>
        <small>Captura tu primera foto de referencia</small>
      </div>
    `;
    return;
  }

  // Ordenar por fecha (más recientes primero)
  photos.sort((a, b) => b.timestamp - a.timestamp);

  gallery.innerHTML = '';

  photos.forEach(photo => {
    const item = document.createElement('div');
    item.className = 'photo-item';
    
    const photoDate = new Date(photo.date);
    const dateStr = photoDate.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short' 
    });

    item.innerHTML = `
      <img src="${photo.imageData}" alt="${photo.zone}">
      <div class="photo-info">
        <strong>${photo.zone.toUpperCase()}</strong><br>
        ${dateStr} - Semana ${photo.week}
      </div>
    `;

    item.addEventListener('click', () => showPhotoModal(photo));

    gallery.appendChild(item);
  });

  // Actualizar selectores del comparador
  updateCompareSelectors(photos);
}

function showPhotoModal(photo) {
  // Crear modal simple para ver foto completa
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 90%; background: transparent;">
      <img src="${photo.imageData}" style="width: 100%; border-radius: 16px;">
      <button class="btn-danger" style="margin-top: 16px;" onclick="deletePhoto(${photo.id})">
        <span class="material-icons">delete</span>
        Eliminar Foto
      </button>
      <button class="btn-secondary" style="margin-top: 8px;" onclick="this.closest('.modal').remove()">
        Cerrar
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function deletePhoto(photoId) {
  const confirm = window.confirm('¿Eliminar esta foto? Esta acción no se puede deshacer.');
  
  if (!confirm) return;

  try {
    await db.deletePhoto(photoId);
    await updatePhotoGallery();
    showSuccessMessage('Foto eliminada');
    
    // Cerrar modal si está abierto
    document.querySelectorAll('.modal').forEach(m => m.remove());
  } catch (error) {
    console.error('Error eliminando foto:', error);
    alert('Error al eliminar la foto');
  }
}

function updateCompareSelectors(photos) {
  const oldSelect = document.getElementById('compareOld');
  const newSelect = document.getElementById('compareNew');

  // Limpiar selectores
  oldSelect.innerHTML = '<option value="">Seleccionar...</option>';
  newSelect.innerHTML = '<option value="">Seleccionar...</option>';

  // Agrupar por zona
  const photosByZone = {};
  photos.forEach(photo => {
    if (!photosByZone[photo.zone]) {
      photosByZone[photo.zone] = [];
    }
    photosByZone[photo.zone].push(photo);
  });

  // Añadir opciones agrupadas
  Object.keys(photosByZone).forEach(zone => {
    const optgroup1 = document.createElement('optgroup');
    optgroup1.label = zone.toUpperCase();
    
    const optgroup2 = document.createElement('optgroup');
    optgroup2.label = zone.toUpperCase();

    photosByZone[zone].forEach(photo => {
      const date = new Date(photo.date).toLocaleDateString('es-ES');
      
      const option1 = document.createElement('option');
      option1.value = photo.id;
      option1.textContent = `${date} - Semana ${photo.week}`;
      
      const option2 = option1.cloneNode(true);

      optgroup1.appendChild(option1);
      optgroup2.appendChild(option2);
    });

    oldSelect.appendChild(optgroup1);
    newSelect.appendChild(optgroup2);
  });

  // Event listeners para previsualizar
  oldSelect.addEventListener('change', async function() {
    if (this.value) {
      const photos = await db.getAllPhotos();
      const photo = photos.find(p => p.id == this.value);
      
      const canvas = document.getElementById('compareCanvasOld');
      const ctx = canvas.getContext('2d');
      
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
      img.src = photo.imageData;
    }
  });

  newSelect.addEventListener('change', async function() {
    if (this.value) {
      const photos = await db.getAllPhotos();
      const photo = photos.find(p => p.id == this.value);
      
      const canvas = document.getElementById('compareCanvasNew');
      const ctx = canvas.getContext('2d');
      
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
      img.src = photo.imageData;
    }
  });
}

async function generateFlicker() {
  const oldId = document.getElementById('compareOld').value;
  const newId = document.getElementById('compareNew').value;

  if (!oldId || !newId) {
    alert('Selecciona dos fotos para comparar');
    return;
  }

  const photos = await db.getAllPhotos();
  const photo1 = photos.find(p => p.id == oldId);
  const photo2 = photos.find(p => p.id == newId);

  const resultCanvas = document.getElementById('flickerCanvas');

  try {
    await cameraService.generateFlickerAnimation(
      photo1.imageData, 
      photo2.imageData, 
      resultCanvas
    );

    document.getElementById('flickerResult').style.display = 'block';
    showSuccessMessage('Animación generada');

  } catch (error) {
    console.error('Error generando animación:', error);
    alert('Error al generar la comparación');
  }
}

async function downloadFlicker() {
  const canvas = document.getElementById('flickerCanvas');
  await cameraService.downloadImage(canvas, `ipl-comparison-${Date.now()}.jpg`);
}

// =====================================================
// AJUSTES
// =====================================================

function updateSettingsUI(config) {
  document.getElementById('settingsSkinType').value = config.skinType || 3;
  document.getElementById('settingsHairType').value = config.hairType || 'thick';
  document.getElementById('notificationsEnabled').checked = config.notifications !== false;
  document.getElementById('notificationTiming').value = config.notificationTiming || 2;
}

async function saveSettings() {
  const config = {
    skinType: document.getElementById('settingsSkinType').value,
    hairType: document.getElementById('settingsHairType').value,
    notifications: document.getElementById('notificationsEnabled').checked,
    notificationTiming: document.getElementById('notificationTiming').value
  };

  for (const [key, value] of Object.entries(config)) {
    await db.setConfig(key, value);
  }

  showSuccessMessage('Configuración guardada');
}

async function testNotification() {
  if (!('Notification' in window)) {
    alert('Tu navegador no soporta notificaciones');
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    new Notification('IPL Tracker', {
      body: 'Las notificaciones están funcionando correctamente 🎉',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [200, 100, 200]
    });
  } else {
    alert('Permisos de notificación denegados. Ve a Ajustes del navegador.');
  }
}

async function exportData() {
  try {
    const data = await db.exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `ipl-tracker-backup-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showSuccessMessage('Copia de seguridad creada');

  } catch (error) {
    console.error('Error exportando datos:', error);
    alert('Error al crear la copia de seguridad');
  }
}

function importData() {
  document.getElementById('importFile').click();
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const confirm = window.confirm('¿Importar datos? Esto sobrescribirá tu configuración actual.');
    
    if (!confirm) return;

    await db.importData(data);
    
    showSuccessMessage('Datos importados correctamente');
    
    // Recargar aplicación
    setTimeout(() => window.location.reload(), 1500);

  } catch (error) {
    console.error('Error importando datos:', error);
    alert('Error al importar datos. Verifica que el archivo sea válido.');
  }
}

async function clearAllData() {
  const confirm1 = window.confirm('⚠️ ¿ELIMINAR TODOS LOS DATOS?\n\nEsto incluye:\n- Configuración\n- Historial de sesiones\n- Fotos guardadas\n- Calendario\n\nEsta acción NO se puede deshacer.');
  
  if (!confirm1) return;

  const confirm2 = window.confirm('¿Estás completamente seguro? Escribe OK en el siguiente prompt.');
  
  if (!confirm2) return;

  const final = prompt('Escribe OK para confirmar:');
  
  if (final !== 'OK') {
    alert('Cancelado');
    return;
  }

  try {
    await db.clearAllData();
    alert('Todos los datos han sido eliminados. La página se recargará.');
    window.location.reload();

  } catch (error) {
    console.error('Error borrando datos:', error);
    alert('Error al borrar los datos');
  }
}

async function updateStorageInfo() {
  const storageInfo = await db.calculateStorageUsed();
  
  if (storageInfo) {
    document.getElementById('storageUsed').textContent = 
      `${storageInfo.usedMB} MB de ${storageInfo.quotaMB} MB (${storageInfo.percentage}%)`;
  } else {
    document.getElementById('storageUsed').textContent = 'No disponible';
  }
}
// =====================================================
// EVENT LISTENERS GENERALES
// =====================================================

function setupEventListeners() {
  // Navegación principal
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
      const view = this.dataset.view;
      switchView(view);
    });
  });

  // Calendario - Navegación entre meses
  document.getElementById('prevMonth')?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar(currentYear, currentMonth);
  });

  document.getElementById('nextMonth')?.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar(currentYear, currentMonth);
  });

  // Cerrar detalles de sesión del calendario
  document.getElementById('closeDetails')?.addEventListener('click', () => {
    document.getElementById('sessionDetails').style.display = 'none';
  });

  // Iniciar sesión desde dashboard
  document.getElementById('startSessionBtn')?.addEventListener('click', async () => {
    const nextEvent = calendarInstance.getNextEvent();
    if (nextEvent) {
      await startSession(nextEvent.date);
    }
  });

  // Cerrar sesión activa
  document.getElementById('closeSession')?.addEventListener('click', () => {
    const confirm = window.confirm('¿Cerrar sesión sin completar? El progreso no se guardará.');
    if (confirm) {
      stopSessionTimer();
      document.getElementById('sessionModal').style.display = 'none';
    }
  });

  // Completar sesión
  document.getElementById('completeSession')?.addEventListener('click', completeSession);

  // Tabs de progreso fotográfico
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tab = this.dataset.tab;
      
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      this.classList.add('active');
      document.getElementById(`${tab}Tab`).classList.add('active');
    });
  });

  // Comparador de fotos
  document.getElementById('generateFlicker')?.addEventListener('click', generateFlicker);
  document.getElementById('downloadFlicker')?.addEventListener('click', downloadFlicker);

  // Ajustes
  document.getElementById('settingsSkinType')?.addEventListener('change', saveSettings);
  document.getElementById('settingsHairType')?.addEventListener('change', saveSettings);
  document.getElementById('notificationsEnabled')?.addEventListener('change', saveSettings);
  document.getElementById('notificationTiming')?.addEventListener('change', saveSettings);

  document.getElementById('testNotification')?.addEventListener('click', testNotification);
  document.getElementById('exportData')?.addEventListener('click', exportData);
  document.getElementById('importData')?.addEventListener('click', importData);
  document.getElementById('importFile')?.addEventListener('change', handleImportFile);
  document.getElementById('clearData')?.addEventListener('click', clearAllData);

  // Cerrar prompt de instalación
  document.getElementById('dismissInstall')?.addEventListener('click', () => {
    document.getElementById('installPrompt').style.display = 'none';
    localStorage.setItem('installPromptDismissed', 'true');
  });

  // Inicializar mapa corporal
  initBodyMap();

  // Inicializar captura de fotos
  initPhotoCapture();
}

// =====================================================
// CAMBIO DE VISTAS
// =====================================================

function switchView(viewName) {
  // Actualizar navegación
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  // Actualizar vistas
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(viewName).classList.add('active');

  currentView = viewName;

  // Acciones específicas por vista
  switch(viewName) {
    case 'dashboard':
      updateDashboard();
      updateUVWidget();
      break;
    case 'calendar':
      renderCalendar(currentYear, currentMonth);
      break;
    case 'zones':
      // Mapa corporal ya está inicializado
      break;
    case 'progress':
      updatePhotoGallery();
      break;
    case 'settings':
      updateStorageInfo();
      break;
  }
}

// =====================================================
// DETECCIÓN DE INSTALACIÓN (iOS)
// =====================================================

function detectAndPromptInstall() {
  // Verificar si es iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // Verificar si ya está instalada (standalone mode)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                       || window.navigator.standalone === true;

  // Verificar si ya se rechazó el prompt
  const dismissed = localStorage.getItem('installPromptDismissed');

  if (isIOS && !isStandalone && !dismissed) {
    // Mostrar instrucciones para iOS
    setTimeout(() => {
      document.getElementById('installPrompt').style.display = 'block';
    }, 2000);
  }

  // Para Android y otros navegadores (A2HS nativo)
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Mostrar botón de instalación personalizado si lo deseas
    console.log('Puede instalarse como PWA');
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA instalada exitosamente');
    deferredPrompt = null;
  });
}

// =====================================================
// NOTIFICACIONES PROGRAMADAS
// =====================================================

async function scheduleNotifications() {
  if (!('Notification' in window)) {
    console.log('Notificaciones no disponibles');
    return;
  }

  const permission = await Notification.requestPermission();
  
  if (permission !== 'granted') {
    console.log('Permisos de notificación denegados');
    return;
  }

  const config = await db.getAllConfig();
  
  if (config.notifications === false) {
    console.log('Notificaciones desactivadas por el usuario');
    return;
  }

  // Obtener próxima sesión
  const nextEvent = calendarInstance.getNextEvent();
  
  if (!nextEvent || nextEvent.type === 'rest') {
    console.log('No hay sesiones próximas para notificar');
    return;
  }

  const eventDate = new Date(nextEvent.date);
  const notificationTiming = parseInt(config.notificationTiming || 2);
  const notificationDate = new Date(eventDate);
  notificationDate.setDate(notificationDate.getDate() - notificationTiming);
  notificationDate.setHours(20, 0, 0, 0); // 8 PM

  const now = new Date();
  const timeUntilNotification = notificationDate - now;

  if (timeUntilNotification > 0 && timeUntilNotification < 7 * 24 * 60 * 60 * 1000) {
    // Programar notificación si es dentro de los próximos 7 días
    setTimeout(() => {
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = dayNames[eventDate.getDay()];

      new Notification('Recordatorio IPL Tracker', {
        body: `${dayName}: ${nextEvent.title}\nRecuerda rasurar la zona esta noche.`,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'session-reminder',
        requireInteraction: false
      });
    }, timeUntilNotification);

    console.log(`Notificación programada para ${notificationDate.toLocaleString()}`);
  }
}

// Programar notificaciones al cargar la app
scheduleNotifications();

// =====================================================
// UTILIDADES
// =====================================================

// Formatear fechas
function formatDate(date, format = 'short') {
  const d = new Date(date);
  
  if (format === 'short') {
    return d.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short' 
    });
  }
  
  if (format === 'long') {
    return d.toLocaleDateString('es-ES', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  }
  
  return d.toLocaleDateString('es-ES');
}

// Calcular días entre fechas
function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const firstDate = new Date(date1);
  const secondDate = new Date(date2);
  
  return Math.round(Math.abs((firstDate - secondDate) / oneDay));
}

// Vibración háptica (si está disponible)
function hapticFeedback(type = 'light') {
  if ('vibrate' in navigator) {
    switch(type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([30, 10, 30]);
        break;
    }
  }
}

// Bloquear orientación en modo retrato (opcional)
function lockOrientation() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('portrait').catch(err => {
      console.log('No se pudo bloquear la orientación:', err);
    });
  }
}

// =====================================================
// MANEJO DE ERRORES GLOBAL
// =====================================================

window.addEventListener('error', (event) => {
  console.error('Error global:', event.error);
  
  // Log para debugging
  if (event.error && event.error.message) {
    console.error('Mensaje:', event.error.message);
    console.error('Stack:', event.error.stack);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rechazada:', event.reason);
});

// =====================================================
// MODO OFFLINE
// =====================================================

window.addEventListener('online', () => {
  showSuccessMessage('Conexión restaurada');
  updateUVWidget(); // Actualizar datos que requieren internet
});

window.addEventListener('offline', () => {
  showSuccessMessage('Modo offline activado. Tus datos están seguros.');
});

// =====================================================
// PREVENIR ZOOM EN INPUTS (iOS)
// =====================================================

document.addEventListener('gesturestart', (e) => {
  e.preventDefault();
});

// Prevenir zoom con doble tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// =====================================================
// SAFE AREA (NOTCH) SUPPORT
// =====================================================

function updateSafeAreas() {
  const safeAreaTop = getComputedStyle(document.documentElement)
    .getPropertyValue('--sat') || '0px';
  
  const safeAreaBottom = getComputedStyle(document.documentElement)
    .getPropertyValue('--sab') || '0px';

  console.log('Safe areas:', { top: safeAreaTop, bottom: safeAreaBottom });
}

updateSafeAreas();

// =====================================================
// LIFECYCLE HOOKS
// =====================================================

// Cuando la app vuelve al foreground
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    console.log('App en foreground');
    
    // Actualizar dashboard y UV
    if (currentView === 'dashboard') {
      await updateDashboard();
      await updateUVWidget();
    }
  }
});

// Antes de cerrar/recargar
window.addEventListener('beforeunload', (e) => {
  // Si hay una sesión activa, advertir
  if (sessionTimer) {
    e.preventDefault();
    e.returnValue = '¿Cerrar sin completar la sesión?';
    return e.returnValue;
  }
});

// =====================================================
// EXPORTAR FUNCIONES GLOBALES (para onclick en HTML)
// =====================================================

window.nextOnboardingStep = nextOnboardingStep;
window.prevOnboardingStep = prevOnboardingStep;
window.completeOnboarding = completeOnboarding;
window.startSession = startSession;
window.deletePhoto = deletePhoto;

console.log('✅ IPL Tracker cargado completamente');
