/* =====================================================
   IPL TRACKER - MÓDULO DE CÁMARA Y COMPARADOR VISUAL
   ===================================================== */

class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.ghostCanvas = null;
    this.isActive = false;
    this.currentZone = 'chest';
    this.referencePhoto = null;
  }

  // Inicializar elementos de video y canvas
  init(videoElement, canvasElement, ghostCanvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ghostCanvas = ghostCanvasElement;
  }

  // Activar cámara
  async startCamera(facingMode = 'user') {
    try {
      // Solicitar permisos de cámara
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      // Asignar stream al video
      this.video.srcObject = this.stream;
      this.video.classList.add('active');
      
      await this.video.play();
      this.isActive = true;

      return true;

    } catch (error) {
      console.error('Error al acceder a la cámara:', error);
      
      let errorMessage = 'No se pudo acceder a la cámara.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permiso de cámara denegado. Ve a Ajustes > Safari > Cámara.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No se detectó ninguna cámara en el dispositivo.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'La cámara está siendo usada por otra aplicación.';
      }

      alert(errorMessage);
      return false;
    }
  }

  // Detener cámara
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video.classList.remove('active');
    }

    this.isActive = false;
  }

  // Capturar foto
  capturePhoto() {
    if (!this.isActive) {
      alert('La cámara no está activa');
      return null;
    }

    // Crear canvas temporal con las dimensiones del video
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.video.videoWidth;
    tempCanvas.height = this.video.videoHeight;
    
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0);

    // Convertir a Base64
    return tempCanvas.toDataURL('image/jpeg', 0.9);
  }

  // Cargar foto de referencia para modo fantasma
  async loadReferencePhoto(zone) {
    try {
      const photos = await db.getPhotosByZone(zone);
      
      if (photos.length === 0) {
        return null;
      }

      // Obtener la foto más antigua (primera de referencia)
      const oldestPhoto = photos.sort((a, b) => a.timestamp - b.timestamp)[0];
      this.referencePhoto = oldestPhoto.imageData;
      
      return this.referencePhoto;

    } catch (error) {
      console.error('Error cargando foto de referencia:', error);
      return null;
    }
  }

  // Activar modo fantasma (Ghost Overlay)
  async enableGhostMode(zone, opacity = 0.3) {
    if (!this.referencePhoto) {
      const ref = await this.loadReferencePhoto(zone);
      if (!ref) {
        alert('No hay foto de referencia para esta zona. Captura tu primera foto.');
        return false;
      }
    }

    // Cargar imagen de referencia
    const img = new Image();
    img.onload = () => {
      this.ghostCanvas.width = this.video.videoWidth;
      this.ghostCanvas.height = this.video.videoHeight;
      
      const ctx = this.ghostCanvas.getContext('2d');
      ctx.clearRect(0, 0, this.ghostCanvas.width, this.ghostCanvas.height);
      
      // Dibujar imagen con opacidad
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, 0, 0, this.ghostCanvas.width, this.ghostCanvas.height);
      
      this.ghostCanvas.classList.add('active');
    };
    
    img.src = this.referencePhoto;
    return true;
  }

  // Desactivar modo fantasma
  disableGhostMode() {
    if (this.ghostCanvas) {
      const ctx = this.ghostCanvas.getContext('2d');
      ctx.clearRect(0, 0, this.ghostCanvas.width, this.ghostCanvas.height);
      this.ghostCanvas.classList.remove('active');
    }
  }

  // Actualizar opacidad del fantasma
  updateGhostOpacity(opacity) {
    if (!this.referencePhoto || !this.ghostCanvas.classList.contains('active')) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      const ctx = this.ghostCanvas.getContext('2d');
      ctx.clearRect(0, 0, this.ghostCanvas.width, this.ghostCanvas.height);
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, 0, 0, this.ghostCanvas.width, this.ghostCanvas.height);
    };
    img.src = this.referencePhoto;
  }

  // Generar animación Flicker (Antes/Después)
  async generateFlickerAnimation(photo1Data, photo2Data, targetCanvas) {
    return new Promise((resolve, reject) => {
      const img1 = new Image();
      const img2 = new Image();
      
      let loaded = 0;
      
      const onLoad = () => {
        loaded++;
        if (loaded === 2) {
          // Ambas imágenes cargadas, generar animación
          const ctx = targetCanvas.getContext('2d');
          const width = Math.max(img1.width, img2.width);
          const height = Math.max(img1.height, img2.height);
          
          targetCanvas.width = width;
          targetCanvas.height = height;

          let frame = 0;
          const animate = () => {
            ctx.clearRect(0, 0, width, height);
            
            if (frame % 2 === 0) {
              ctx.drawImage(img1, 0, 0, width, height);
            } else {
              ctx.drawImage(img2, 0, 0, width, height);
            }
            
            frame++;
            
            if (frame < 20) { // 10 ciclos de flickeo
              setTimeout(animate, 500); // Cambio cada 0.5s
            } else {
              resolve(targetCanvas);
            }
          };
          
          animate();
        }
      };

      img1.onload = onLoad;
      img2.onload = onLoad;
      img1.onerror = reject;
      img2.onerror = reject;

      img1.src = photo1Data;
      img2.src = photo2Data;
    });
  }

  // Convertir canvas a Blob para descarga
  canvasToBlob(canvas) {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
    });
  }

  // Descargar imagen
  async downloadImage(canvas, filename = 'ipl-tracker-comparison.jpg') {
    const blob = await this.canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  // Activar espejo digital con líneas de guía (para degradado de hombros)
  enableDigitalMirror() {
    if (!this.isActive) return;

    // Crear overlay de líneas guía
    const overlay = document.createElement('div');
    overlay.id = 'mirrorGuideOverlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;

    // Líneas horizontales de guía
    const lines = [
      { position: '25%', color: '#ff4444', label: 'ZONA ROJA (No disparar)' },
      { position: '40%', color: '#ffa500', label: 'FRONTERA (Entresacar)' },
      { position: '55%', color: '#00ff88', label: 'ZONA VERDE (Disparar)' }
    ];

    lines.forEach(line => {
      const lineDiv = document.createElement('div');
      lineDiv.style.cssText = `
        position: absolute;
        top: ${line.position};
        left: 0;
        width: 100%;
        height: 2px;
        background: ${line.color};
        box-shadow: 0 0 10px ${line.color};
      `;
      
      const label = document.createElement('span');
      label.textContent = line.label;
      label.style.cssText = `
        position: absolute;
        left: 10px;
        top: -20px;
        color: ${line.color};
        font-size: 12px;
        font-weight: bold;
        text-shadow: 0 0 5px rgba(0,0,0,0.8);
      `;
      
      lineDiv.appendChild(label);
      overlay.appendChild(lineDiv);
    });

    this.video.parentElement.appendChild(overlay);
  }

  // Desactivar espejo digital
  disableDigitalMirror() {
    const overlay = document.getElementById('mirrorGuideOverlay');
    if (overlay) {
      overlay.remove();
    }
  }
}

// Instancia global
const cameraService = new CameraService();
