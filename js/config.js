// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================

// Modos de juego
const MODES = {
    clicking:  { id:'clicking',  tag:'CLICKING',    name:'Clicking',      desc:'Múltiples objetivos. Elimínalos antes de que desaparezcan.', color:'#00e5ff' },
    flicking:  { id:'flicking',  tag:'FLICKING',    name:'Flick Shot',    desc:'Un objetivo a la vez en posición aleatoria. Reacciona rápido.', color:'#ff9500' },
    tracking:  { id:'tracking',  tag:'TRACKING',    name:'Tracking',      desc:'Sigue un objetivo en movimiento suave. Puntuación por tiempo sobre objetivo.', color:'#00ff88' },
    micro:     { id:'micro',     tag:'PRECISION',   name:'Micro Shot',    desc:'Objetivos pequeños. Máxima precisión requerida.', color:'#ff3d71' },
    strafing:  { id:'strafing',  tag:'STRAFING',    name:'Strafing',      desc:'Muévete con A/D mientras sigues un objetivo lateral. Velocidad creciente.', color:'#ffaa44' },
    survival:  { id:'survival',  tag:'SURVIVAL',    name:'Supervivencia', desc:'Sin tiempo. 3 vidas. Cada objetivo perdido cuesta una vida.', color:'#ffd700' },
    gridshot:  { id:'gridshot',  tag:'GRIDSHOT',    name:'Grid Shot',     desc:'Cuadrícula 3x3. Dispara en orden aleatorio.', color:'#e040fb' },
    wide:      { id:'wide',      tag:'WIDE ANGLE',  name:'Wide Angle',    desc:'Objetivos en los extremos. Entrena movimientos amplios.', color:'#ff6b35' },
    humanoid:  { id:'humanoid', tag:'HUMANOID',    name:'Humanoid Strafe', desc:'Sigue al humanoide con la mira mientras se desplaza lateralmente. Puntuación por precisión de tracking. Sin disparar — solo smooth aim.', color:'#ff6ec7' },
};

// Dificultades (todos los modos duran 60 segundos)
const DIFF = {
    easy:   { time:60, maxT:4, rate:1200, minR:.28, maxR:.42, speed:1.8, life:[3.5,6] },
    medium: { time:60, maxT:5, rate:850,  minR:.18, maxR:.30, speed:3.0, life:[2,3.5] },
    hard:   { time:60, maxT:6, rate:550,  minR:.10, maxR:.20, speed:5.0, life:[1,2] },
};

// Configuración por defecto
const CFG = {
    ch: { color: '#ffffff', size: 12, thick: 2, gap: 8, dot: true },
    sensMap: {
        hipfire: 30, reddot: 30, tactical: 30,
        scope2x: 25, scope3x: 22, scope4x: 20, scope6x: 18
    },
    tgt: { sizeMult: 1.0, speedMult: 1.0, max: 4 },
    vis: { fx: true, pts: true, combo: true },
    snd: { shot: true, hit: true, miss: false, vol: 0.7 },
    room: { color: '#1a0a2e' },
    fps: { limit: false, target: 60 }   // 🔥 FPS limit desactivado por defecto
};

window.MODES = MODES;
window.DIFF = DIFF;
window.CFG = CFG;
