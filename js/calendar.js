/* =====================================================
   IPL TRACKER - GENERADOR DE CALENDARIO INTELIGENTE
   ===================================================== */

class CalendarGenerator {
  constructor(startDate, availability = 'weekend') {
    this.startDate = new Date(startDate);
    this.availability = availability;
    this.events = [];
  }

  // Generar calendario completo (Fases 1, 2 y 3)
  generate() {
    this.events = [];
    
    // FASE 1: ATAQUE (12 semanas - Semanal)
    this.generatePhase1();
    
    // FASE 2: TRANSICIÓN (8 semanas - Quincenal)
    this.generatePhase2();
    
    // FASE 3: MANTENIMIENTO (Mensual - 4 meses)
    this.generatePhase3();
    
    return this.events;
  }

  // FASE 1: Ataque (12 semanas)
  generatePhase1() {
    const phaseStart = new Date(this.startDate);
    
    for (let week = 0; week < 12; week++) {
      // Sábado: Tren Inferior
      const saturday = this.addDays(phaseStart, week * 7);
      if (saturday.getDay() !== 6) {
        // Ajustar al sábado más cercano
        saturday.setDate(saturday.getDate() + (6 - saturday.getDay()));
      }
      
      this.events.push({
        date: this.formatDate(saturday),
        type: 'legs',
        title: 'Tren Inferior',
        zones: ['Piernas', 'Glúteos'],
        icon: '🦵',
        phase: 'attack',
        week: week + 1,
        completed: false,
        notes: 'Recuerda rasurar el viernes por la noche'
      });

      // Domingo: Torso (+ Hombros cada 4 semanas)
      const sunday = this.addDays(saturday, 1);
      const includeShoulders = (week + 1) % 4 === 0;
      
      this.events.push({
        date: this.formatDate(sunday),
        type: includeShoulders ? 'torso_shoulders' : 'torso',
        title: includeShoulders ? 'Torso + Hombros' : 'Torso',
        zones: includeShoulders ? ['Pecho', 'Abdomen', 'Hombros (Degradado)'] : ['Pecho', 'Abdomen'],
        icon: includeShoulders ? '👕💪' : '👕',
        phase: 'attack',
        week: week + 1,
        completed: false,
        notes: includeShoulders ? 'Recortar hombros al 1-2mm antes de disparar' : ''
      });
    }
  }

  // FASE 2: Transición (8 semanas - Quincenal)
  generatePhase2() {
    const phase1End = this.addDays(this.startDate, 12 * 7);
    
    // Semana de descanso después de Fase 1
    const restSaturday = new Date(phase1End);
    restSaturday.setDate(restSaturday.getDate() + (6 - restSaturday.getDay()));
    
    this.events.push({
      date: this.formatDate(restSaturday),
      type: 'rest',
      title: 'Descanso',
      zones: [],
      icon: '💤',
      phase: 'transition',
      week: 0,
      completed: false,
      notes: 'Fin de Fase 1. La piel descansa esta semana.'
    });

    this.events.push({
      date: this.formatDate(this.addDays(restSaturday, 1)),
      type: 'rest',
      title: 'Descanso',
      zones: [],
      icon: '💤',
      phase: 'transition',
      week: 0,
      completed: false,
      notes: ''
    });

    // 8 semanas quincenales (4 ciclos de 2 semanas)
    let currentDate = this.addDays(restSaturday, 7);
    
    for (let cycle = 0; cycle < 4; cycle++) {
      // Semana de descanso
      const restSat = new Date(currentDate);
      restSat.setDate(restSat.getDate() + (6 - restSat.getDay()));
      
      this.events.push({
        date: this.formatDate(restSat),
        type: 'rest',
        title: 'Descanso',
        zones: [],
        icon: '💤',
        phase: 'transition',
        week: cycle * 2 + 1,
        completed: false,
        notes: 'Semana libre'
      });

      this.events.push({
        date: this.formatDate(this.addDays(restSat, 1)),
        type: 'rest',
        title: 'Descanso',
        zones: [],
        icon: '💤',
        phase: 'transition',
        week: cycle * 2 + 1,
        completed: false,
        notes: ''
      });

      // Semana de sesión
      const sessionSat = this.addDays(restSat, 7);
      const includeShoulders = cycle % 2 === 0;
      
      this.events.push({
        date: this.formatDate(sessionSat),
        type: 'legs',
        title: 'Tren Inferior',
        zones: ['Piernas', 'Glúteos'],
        icon: '🦵',
        phase: 'transition',
        week: cycle * 2 + 2,
        completed: false,
        notes: ''
      });

      this.events.push({
        date: this.formatDate(this.addDays(sessionSat, 1)),
        type: includeShoulders ? 'torso_shoulders' : 'torso',
        title: includeShoulders ? 'Torso + Hombros' : 'Torso',
        zones: includeShoulders ? ['Pecho', 'Abdomen', 'Hombros'] : ['Pecho', 'Abdomen'],
        icon: includeShoulders ? '👕💪' : '👕',
        phase: 'transition',
        week: cycle * 2 + 2,
        completed: false,
        notes: includeShoulders ? 'Repaso de hombros' : ''
      });

      currentDate = this.addDays(sessionSat, 7);
    }
  }

  // FASE 3: Mantenimiento (Mensual - 4 meses)
  generatePhase3() {
    const phase2End = this.addDays(this.startDate, (12 * 7) + (8 * 7) + 7);
    
    for (let month = 0; month < 4; month++) {
      const sessionDate = this.addDays(phase2End, month * 30);
      sessionDate.setDate(sessionDate.getDate() + (6 - sessionDate.getDay())); // Ajustar a sábado
      
      this.events.push({
        date: this.formatDate(sessionDate),
        type: 'legs',
        title: 'Tren Inferior (Mantenimiento)',
        zones: ['Piernas', 'Glúteos'],
        icon: '🦵',
        phase: 'maintenance',
        week: 0,
        completed: false,
        notes: 'Sesión mensual de mantenimiento'
      });

      this.events.push({
        date: this.formatDate(this.addDays(sessionDate, 1)),
        type: 'torso_shoulders',
        title: 'Torso + Hombros (Mantenimiento)',
        zones: ['Pecho', 'Abdomen', 'Hombros'],
        icon: '👕💪',
        phase: 'maintenance',
        week: 0,
        completed: false,
        notes: 'Incluye repaso de hombros'
      });
    }
  }

  // Utilidades
  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  // Obtener evento por fecha
  getEventByDate(dateString) {
    return this.events.find(e => e.date === dateString);
  }

  // Obtener próximo evento
  getNextEvent() {
    const today = this.formatDate(new Date());
    const futureEvents = this.events.filter(e => e.date >= today && !e.completed);
    return futureEvents[0] || null;
  }

  // Obtener eventos de un mes específico
  getEventsByMonth(year, month) {
    return this.events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });
  }

  // Calcular fase actual
  getCurrentPhase() {
    const today = new Date();
    const daysSinceStart = Math.floor((today - this.startDate) / (1000 * 60 * 60 * 24));
    const weeksSinceStart = Math.floor(daysSinceStart / 7);

    if (weeksSinceStart < 12) {
      return { 
        name: 'ATAQUE', 
        week: weeksSinceStart + 1, 
        total: 12,
        color: 'phase-attack'
      };
    } else if (weeksSinceStart < 20) {
      return { 
        name: 'TRANSICIÓN', 
        week: weeksSinceStart - 11, 
        total: 8,
        color: 'phase-transition'
      };
    } else {
      return { 
        name: 'MANTENIMIENTO', 
        week: 0, 
        total: 0,
        color: 'phase-maintenance'
      };
    }
  }
}
