// ============================================================
// CONTROLES MÓVILES (touch)
// ============================================================

let mobileMode = false;
const isMobileDevice = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;

const mobLook = { active: false, id: -1, lastX: 0, lastY: 0 };
const duelJoy = { active: false, id: -1, baseX: 0, baseY: 0 };
const duelLook = { active: false, id: -1, lastX: 0, lastY: 0 };
const DJOY_MAX = 50;

function setMobileMode(on) {
    mobileMode = on;
    try { localStorage.setItem('ina_mobile', on ? '1' : '0'); } catch (e) { }
    document.querySelectorAll('.mob-toggle-btn').forEach(b => {
        b.classList.toggle('on', on);
        b.textContent = on ? '📱 MÓVIL: ON ✓' : '📱 MODO MÓVIL';
    });
    const hint = document.getElementById('lock-hint');
    if (hint) {
        hint.innerHTML = on
            ? 'Arrastra el lado derecho para apuntar<br>🔴 para disparar · ⬆ para saltar'
            : 'Mueve el mouse para apuntar<br>Clic izquierdo para disparar<br>Presiona <strong style="color:var(--accent)">ESC</strong> para pausar';
    }
}

// Inicializar modo móvil desde localStorage o detección
(function () {
    try {
        const s = localStorage.getItem('ina_mobile');
        if (s !== null) setMobileMode(s === '1');
        else if (isMobileDevice) setMobileMode(true);
    } catch (e) { }
})();

// Eventos para el modo práctica
const soloLookZone = document.getElementById('look-zone');
if (soloLookZone) {
    soloLookZone.addEventListener('touchstart', e => {
        if (!mobileMode || !state.running) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        mobLook.active = true;
        mobLook.id = t.identifier;
        mobLook.lastX = t.clientX;
        mobLook.lastY = t.clientY;
    }, { passive: false });
    soloLookZone.addEventListener('touchmove', e => {
        if (!mobLook.active) return;
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier !== mobLook.id) continue;
            const dx = t.clientX - mobLook.lastX, dy = t.clientY - mobLook.lastY;
            mobLook.lastX = t.clientX;
            mobLook.lastY = t.clientY;
            if (state.running && yawObj) {
                const sens = CFG.sens * 0.004;
                yawObj.rotation.y -= dx * sens;
                pitchObj.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitchObj.rotation.x - dy * sens));
            }
        }
    }, { passive: false });
    soloLookZone.addEventListener('touchend', e => {
        for (const t of e.changedTouches) {
            if (t.identifier === mobLook.id) {
                mobLook.active = false;
                mobLook.id = -1;
            }
        }
        e.preventDefault();
    }, { passive: false });
    soloLookZone.addEventListener('touchcancel', e => {
        mobLook.active = false;
        mobLook.id = -1;
    }, { passive: false });
}

document.getElementById('btn-fire')?.addEventListener('touchstart', e => {
    e.preventDefault();
    if (!mobileMode || !state.running) return;
    doMobileShoot();
}, { passive: false });

function doMobileShoot() {
    if (!state.running) return;
    const m = state.modeId;
    if (m === 'tracking') return;
    playGunshot();
    triggerShoot();
    const ch = document.getElementById('crosshair');
    ch.classList.add('shoot');
    setTimeout(() => ch.classList.remove('shoot'), 100);
    if (m === 'gridshot') {
        const at = state.targets.find(t => t.gridIdx === gridActive);
        if (at) {
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            if (raycaster.intersectObject(at.mesh, false).length > 0) {
                gridHit(at);
                return;
            }
        }
        recordMiss();
        return;
    }
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(state.targets.map(t => t.mesh).filter(Boolean), false);
    if (hits.length > 0) {
        const ht = state.targets.find(t => t.mesh === hits[0].object || t.mesh === hits[0].object.parent);
        if (ht && ht.alive) {
            recordHit(ht);
            if (m === 'flicking') setTimeout(spawnFor3D, 200);
        } else recordMiss();
    } else recordMiss();
}

document.getElementById('btn-pause-mob')?.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state.running) showPause();
}, { passive: false });
document.getElementById('btn-pause-mob')?.addEventListener('click', () => {
    if (state.running) showPause();
});

// Joystick para movimiento en duel
const duelJoyZone = document.getElementById('duel-joy-zone');
const duelJoyBase = document.getElementById('duel-joy-base');
const duelJoyKnob = document.getElementById('duel-joy-knob');
const duelLookZone = document.getElementById('duel-look-zone');

if (duelJoyZone) {
    duelJoyZone.addEventListener('touchstart', e => {
        if (!mobileMode || !onActive) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        duelJoy.active = true;
        duelJoy.id = t.identifier;
        duelJoy.baseX = t.clientX;
        duelJoy.baseY = t.clientY;
        duelJoyBase.style.cssText = `position:absolute;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,61,113,.4);transform:translate(-50%,-50%);left:${t.clientX}px;top:${t.clientY}px;display:block;`;
        duelJoyKnob.style.cssText = `position:absolute;width:50px;height:50px;border-radius:50%;background:rgba(255,61,113,.7);box-shadow:0 0 18px rgba(255,61,113,.5);border:2px solid rgba(255,61,113,.9);transform:translate(-50%,-50%);left:${t.clientX}px;top:${t.clientY}px;display:block;`;
    }, { passive: false });
    duelJoyZone.addEventListener('touchmove', e => {
        if (!duelJoy.active) return;
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier !== duelJoy.id) continue;
            const dx = t.clientX - duelJoy.baseX, dy = t.clientY - duelJoy.baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const clamp = Math.min(dist, DJOY_MAX);
            const ang = Math.atan2(dy, dx);
            duelJoyKnob.style.left = (duelJoy.baseX + Math.cos(ang) * clamp) + 'px';
            duelJoyKnob.style.top = (duelJoy.baseY + Math.sin(ang) * clamp) + 'px';
            const ndx = dx / DJOY_MAX, ndy = dy / DJOY_MAX;
            onKeys['w'] = ndy < -0.25;
            onKeys['s'] = ndy > 0.25;
            onKeys['a'] = ndx < -0.25;
            onKeys['d'] = ndx > 0.25;
        }
    }, { passive: false });

    function duelJoyEnd(e) {
        for (const t of e.changedTouches) {
            if (t.identifier !== duelJoy.id) continue;
            duelJoy.active = false;
            duelJoy.id = -1;
            onKeys['w'] = onKeys['s'] = onKeys['a'] = onKeys['d'] = false;
            duelJoyBase.style.display = 'none';
            duelJoyKnob.style.display = 'none';
        }
        e.preventDefault();
    }
    duelJoyZone.addEventListener('touchend', duelJoyEnd, { passive: false });
    duelJoyZone.addEventListener('touchcancel', duelJoyEnd, { passive: false });
}

if (duelLookZone) {
    duelLookZone.addEventListener('touchstart', e => {
        if (!mobileMode || !onActive) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        duelLook.active = true;
        duelLook.id = t.identifier;
        duelLook.lastX = t.clientX;
        duelLook.lastY = t.clientY;
    }, { passive: false });
    duelLookZone.addEventListener('touchmove', e => {
        if (!duelLook.active) return;
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier !== duelLook.id) continue;
            const dx = t.clientX - duelLook.lastX, dy = t.clientY - duelLook.lastY;
            duelLook.lastX = t.clientX;
            duelLook.lastY = t.clientY;
            const mobileSensMult = CFG.sens * 0.18;
            onMX += dx * mobileSensMult;
            onMY += dy * mobileSensMult;
        }
    }, { passive: false });
    duelLookZone.addEventListener('touchend', e => {
        for (const t of e.changedTouches) {
            if (t.identifier === duelLook.id) {
                duelLook.active = false;
                duelLook.id = -1;
            }
        }
        e.preventDefault();
    }, { passive: false });
    duelLookZone.addEventListener('touchcancel', e => {
        duelLook.active = false;
        duelLook.id = -1;
    }, { passive: false });
}

document.getElementById('duel-btn-fire')?.addEventListener('touchstart', e => {
    e.preventDefault();
    if (mobileMode && onActive) {
        if (zmActive) zmOnShoot();
        else onTryShoot();
    }
}, { passive: false });

document.getElementById('duel-btn-jump')?.addEventListener('touchstart', e => {
    e.preventDefault();
    if (mobileMode && onActive && onIsGrounded) {
        onVelY = ON_JUMP_FORCE;
        onIsGrounded = false;
    }
}, { passive: false });

document.getElementById('duel-btn-pause-mob')?.addEventListener('touchstart', e => {
    e.preventDefault();
    if (onActive) {
        onLocked = false;
        document.getElementById('duel-mobile-controls').classList.remove('active');
        document.getElementById('duel-crosshair').style.display = 'none';
        document.getElementById('duel-lock-screen').style.display = 'flex';
    }
}, { passive: false });
document.getElementById('duel-btn-pause-mob')?.addEventListener('click', () => {
    if (onActive) {
        onLocked = false;
        document.getElementById('duel-mobile-controls').classList.remove('active');
        document.getElementById('duel-crosshair').style.display = 'none';
        document.getElementById('duel-lock-screen').style.display = 'flex';
    }
});

// Botones de alternar modo móvil
document.getElementById('mob-toggle-btn')?.addEventListener('click', () => setMobileMode(!mobileMode));
document.getElementById('mob-toggle-menu-btn')?.addEventListener('click', () => setMobileMode(!mobileMode));
document.getElementById('mob-toggle-duel-btn')?.addEventListener('click', () => setMobileMode(!mobileMode));
document.getElementById('mob-toggle-duel-btn-lock')?.addEventListener('click', () => setMobileMode(!mobileMode));

if (isMobileDevice) setMobileMode(true);