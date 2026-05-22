# IPL Tracker 🌟

![IPL Tracker App](icons/icon-192.png)

Una **PWA (Progressive Web App)** diseñada para gestionar y hacer un seguimiento inteligente de tratamientos con luz pulsada intensa (IPL) en casa. Pensada para una estrategia offline-first, lo que te permite usarla en el baño o en cualquier sitio sin necesidad de conexión a internet.

## ✨ Características Principales

- **Calendario Inteligente**: Generación automática de calendario basado en tus disponibilidad (ej. "Weekend Split") y tipo de piel/vello.
- **Seguimiento por Zonas**: Historial detallado de la intensidad y número de disparos aplicados por cada zona del cuerpo.
- **Comparador Fotográfico (Ghost Overlay)**: Utiliza la cámara con un modo "fantasma" que superpone la foto anterior para sacar la nueva foto exactamente en el mismo ángulo, permitiendo comparar el progreso de reducción de vello a lo largo de las semanas.
- **Modo Oscuro/Claro**: Adaptable a tus preferencias para uso en cualquier entorno de iluminación.
- **Índice UV en Tiempo Real**: Te avisa si la exposición solar en tu ubicación es segura para la depilación IPL.
- **Offline First**: Guarda todos los datos en tu dispositivo, sin necesidad de cuentas ni servidores. Exporta e importa en formato JSON.

## 📅 Fases del Tratamiento

El algoritmo organiza el calendario en 3 fases:

1. **Fase de Ataque**: Las primeras 12 semanas, con sesiones semanales intensivas.
2. **Fase de Transición**: Las siguientes 8 semanas, reduciendo la frecuencia a una sesión quincenal.
3. **Fase de Mantenimiento**: A partir de la semana 20, sesiones puntuales de repaso (mensuales o bimestrales).

## 🚀 Instalación (PWA)

Al ser una Progressive Web App, no necesitas buscarla en el App Store o Google Play.

**iOS (Safari)**:
1. Abre la aplicación en Safari.
2. Toca el botón "Compartir" (el cuadrado con la flecha hacia arriba).
3. Selecciona **"Añadir a pantalla de inicio"**.

**Android (Chrome)**:
1. Abre la aplicación en Chrome.
2. Toca el menú de tres puntos arriba a la derecha.
3. Selecciona **"Instalar aplicación"** o "Añadir a pantalla de inicio".

## 🔒 Privacidad y Datos

Tus fotos y el historial de tratamiento **NUNCA** abandonan tu dispositivo. Se guardan localmente en IndexedDB. Puedes hacer copias de seguridad usando el botón "Exportar Copia de Seguridad" en los ajustes.