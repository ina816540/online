// ============================================================
// SISTEMA DE SONIDOS (Web Audio API)
// ============================================================

let audioCtx;

function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playGunshot() {
    if (!CFG.snd.shot) return;
    try {
        const ctx = getAudio();
        const vol = CFG.snd.vol;
        const now = ctx.currentTime;
        
        // Crear buffer de sonido de disparo
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            const t = i / ctx.sampleRate;
            data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 25) * 1.5 +
                      Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 18) * 0.7 +
                      Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 10) * 0.8;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 80;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3500;
        const gain = ctx.createGain();
        gain.gain.value = vol * 2.5;
        src.connect(hp);
        hp.connect(lp);
        lp.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.18);
        
        // Añadir eco grave
        const buf2 = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
        const d2 = buf2.getChannelData(0);
        for (let i = 0; i < d2.length; i++) {
            const t = i / ctx.sampleRate;
            d2[i] = (Math.random() * 2 - 1) * Math.exp(-t * 8) * 0.3;
        }
        const src2 = ctx.createBufferSource();
        src2.buffer = buf2;
        const g2 = ctx.createGain();
        g2.gain.value = vol * 0.6;
        const lp2 = ctx.createBiquadFilter();
        lp2.type = 'lowpass';
        lp2.frequency.value = 1200;
        src2.connect(lp2);
        lp2.connect(g2);
        g2.connect(ctx.destination);
        src2.start(now + 0.02);
        src2.stop(now + 0.45);
    } catch(e) {}
}

function playHitSound() {
    if (!CFG.snd.hit) return;
    try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const vol = CFG.snd.vol;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        
        const osc2 = ctx.createOscillator();
        osc2.type = 'square';
        osc2.frequency.value = 2400;
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(vol * 0.15, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.04);
    } catch(e) {}
}

function playMissSound() {
    if (!CFG.snd.miss) return;
    try {
        const ctx = getAudio();
        const now = ctx.currentTime;
        const vol = CFG.snd.vol;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 200;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol * 0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    } catch(e) {}
}

// Exponer funciones al ámbito global
window.playGunshot = playGunshot;
window.playHitSound = playHitSound;
window.playMissSound = playMissSound;