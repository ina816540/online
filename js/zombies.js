// ============================================================
// MODO ZOMBIES (OFFLINE)
// ============================================================

let zmActive = false, zmWave = 0, zmBots = [], zmScore = 0, zmHP = 100, zmAnimId = null;
const ZM_SPAWNS = [{ x: -18, z: -18 }, { x: 18, z: -18 }, { x: -18, z: 18 }, { x: 18, z: 18 }, { x: 0, z: -19 }, { x: 0, z: 19 }];

function zmStart() {
    if (zmActive) return;
    zmActive = true;
    zmWave = 0;
    zmBots = [];
    zmScore = 0;
    zmHP = 100;

    onShowScreen(null);
    menuScreen.classList.add('hidden');
    document.getElementById('duel-canvas').style.display = 'block';
    document.getElementById('duel-hud').style.display = 'block';
    document.getElementById('duel-crosshair').style.display = 'block';

    if (!onThreeReady) {
        onInitThree();
    } else {
        const rem = [];
        onScene.children.forEach(c => {
            if (c.userData.isMapObj || c.type === 'AmbientLight' || c.type === 'DirectionalLight' || c.type === 'PointLight') rem.push(c);
        });
        rem.forEach(c => onScene.remove(c));
        onWalls.length = 0;
        onObs.length = 0;
    }

    zmBuildMap();

    if (onGun && onCamera) {
        onCamera.remove(onGun);
        onGun = null;
    }
    onBuildGun();

    onSpawnPlayer({ x: 0, z: 0, yaw: 0 });
    onActive = true;

    document.getElementById('duel-my-name-hud').textContent = 'ZOMBIES';
    document.getElementById('duel-opp-name-hud').textContent = 'OLEADA';
    document.getElementById('duel-my-kills').textContent = '0';
    document.getElementById('duel-opp-kills').textContent = '1';
    onInitWeaponSlots();

    if (!mobileMode) {
        document.getElementById('duel-lock-screen').style.display = 'flex';
        document.getElementById('duel-lock-btn').onclick = () => {
            document.getElementById('duel-canvas').requestPointerLock();
            document.getElementById('duel-lock-screen').style.display = 'none';
        };
    } else {
        onLocked = true;
        document.getElementById('duel-mobile-controls').classList.add('active');
    }

    if (onAnimId) cancelAnimationFrame(onAnimId);
    let last = performance.now();
    function zmLoop(now) {
        onAnimId = requestAnimationFrame(zmLoop);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (zmActive) {
            onMove(dt);
            onApplyCam();
            onAnimGun(dt);
            zmUpdateBots(dt);
            onUpdateGrenades(dt);
            onApplyCamShake(dt);
        }
        onRenderer.render(onScene, onCamera);
    }
    zmLoop(performance.now());
    setTimeout(() => zmSpawnWave(), 800);
}

function zmSpawnWave() {
    if (!zmActive) return;
    zmWave++;
    document.getElementById('duel-opp-kills').textContent = zmWave;
    const count = Math.min(3 + zmWave * 2, 16);
    const waveEl = document.createElement('div');
    waveEl.textContent = '🧟 OLEADA ' + zmWave + ' · ' + count + ' ZOMBIES';
    waveEl.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:1.3rem;font-weight:900;color:#44ff44;text-shadow:0 0 20px #00ff00;pointer-events:none;z-index:65;animation:float-up 1.8s ease-out forwards;';
    document.body.appendChild(waveEl);
    setTimeout(() => waveEl.remove(), 1800);
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            if (zmActive) zmSpawnBot();
        }, i * 400);
    }
}

function zmSpawnBot() {
    const sp = ZM_SPAWNS[Math.floor(Math.random() * ZM_SPAWNS.length)];
    const g = zmCreateZombie();
    g.position.set(sp.x + (Math.random() - 0.5) * 3, 0, sp.z + (Math.random() - 0.5) * 3);
    onScene.add(g);
    const bot = {
        group: g,
        hp: Math.min(40 + zmWave * 15, 200),
        hitbox: g.userData.hitbox,
        headHitbox: g.userData.headHitbox,
        slot: 'zm_' + Date.now() + '_' + Math.random(),
        alive: true,
        attackCd: 0
    };
    onOpps.set(bot.slot, { group: g, hitbox: g.userData.hitbox, headHitbox: g.userData.headHitbox, legHitbox: g.userData.legHitbox });
    zmBots.push(bot);
}

function zmUpdateBots(dt) {
    const px = onPos.x, pz = onPos.z;
    zmBots.forEach(bot => {
        if (!bot.alive) return;
        const bx = bot.group.position.x, bz = bot.group.position.z;
        const dx = px - bx, dz = pz - bz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        bot.group.rotation.y = Math.atan2(dx, dz);
        if (dist > 0.8) {
            const spd = (1.8 + zmWave * 0.15) * dt;
            bot.group.position.x += dx / dist * spd;
            bot.group.position.z += dz / dist * spd;
        } else {
            bot.attackCd -= dt;
            if (bot.attackCd <= 0) {
                bot.attackCd = 1.2;
                zmHP = Math.max(0, zmHP - 15);
                onUpdateHP(zmHP);
                onCamShake = 0.35;
                if (zmHP <= 0) {
                    zmGameOver();
                    return;
                }
            }
        }
        onAnimateChar(bot.group, dt);
    });

    if (zmBots.length > 0 && zmBots.every(b => !b.alive)) {
        zmBots = [];
        zmHP = Math.min(100, zmHP + 20);
        onUpdateHP(zmHP);
        setTimeout(() => {
            if (zmActive) zmSpawnWave();
        }, 2000);
    }
}

function zmOnShoot() {
    if (!zmActive || !onCanShoot || onReloading) return;
    const wp = WEAPONS[onCurWeapon];
    if (onAmmo[onCurWeapon] <= 0) {
        onStartReload();
        return;
    }
    onCanShoot = false;
    setTimeout(() => onCanShoot = true, wp.cd);
    onAmmo[onCurWeapon]--;
    onUpdateWeaponHUD();
    if (onAmmo[onCurWeapon] === 0) setTimeout(onStartReload, 300);
    playGunshot();
    onGunAnim = 1;
    for (let p = 0; p < wp.pellets; p++) {
        const spread = wp.spread;
        const dir = new THREE.Vector2((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2);
        onRaycaster.setFromCamera(dir, onCamera);
        const wallHits = onRaycaster.intersectObjects(onWalls, false);
        const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;

        // Cabeza
        const headBoxes = zmBots.filter(b => b.alive && b.headHitbox).map(b => b.headHitbox);
        const hHits = onRaycaster.intersectObjects(headBoxes, false);
        if (hHits.length > 0 && hHits[0].distance < wallDist) {
            const hit = zmBots.find(b => b.headHitbox === hHits[0].object);
            if (hit && hit.alive) {
                zmDamageBot(hit, wp.dmgHead, true);
                continue;
            }
        }
        // Cuerpo
        const bodyBoxes = zmBots.filter(b => b.alive && b.hitbox).map(b => b.hitbox);
        const bHits = onRaycaster.intersectObjects(bodyBoxes, false);
        if (bHits.length > 0 && bHits[0].distance < wallDist) {
            const hit = zmBots.find(b => b.hitbox === bHits[0].object);
            if (hit && hit.alive) zmDamageBot(hit, wp.dmgBody, false);
        }
    }
}

function zmDamageBot(bot, dmg, head) {
    bot.hp -= dmg;
    onShowHitMarker(head);
    if (bot.hp <= 0) {
        bot.alive = false;
        onOpps.delete(bot.slot);
        if (bot.group.userData.anim) {
            bot.group.userData.anim.dead = true;
            bot.group.userData.anim.deathT = 0;
        }
        setTimeout(() => onScene.remove(bot.group), 1500);
        zmScore += head ? 200 : 100;
        zmScore += zmWave * 10;
        document.getElementById('duel-my-kills').textContent = zmScore;
        const el = document.createElement('div');
        el.textContent = head ? '💥 +' + (200 + zmWave * 10) : '+' + (100 + zmWave * 10);
        el.style.cssText = 'position:fixed;top:45%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:.85rem;color:' + (head ? '#ffd700' : '#00ff88') + ';pointer-events:none;z-index:65;animation:float-up .7s ease-out forwards;';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 700);
    }
}

function zmGameOver() {
    zmActive = false;
    zmBots.forEach(b => {
        if (onScene) onScene.remove(b.group);
    });
    zmBots = [];
    onOpps.forEach(o => onScene.remove(o.group));
    onOpps.clear();
    onCleanup();
    const t = document.getElementById('duel-go-title');
    t.textContent = '💀 GAME OVER';
    t.style.color = '#ff3d71';
    t.style.textShadow = '0 0 30px #ff3d71';
    document.getElementById('duel-go-vs').textContent = 'MODO ZOMBIE · OLEADA ' + zmWave;
    document.getElementById('duel-go-score').textContent = 'PUNTUACIÓN: ' + zmScore;
    document.getElementById('duel-gameover-screen').classList.remove('hidden');
}

function zmCreateZombie() {
    // Crea un modelo de zombie con hitboxes
    const g = new THREE.Group();
    const variant = Math.floor(Math.random() * 3);
    const skinColors = [0x3d4a1a, 0x2e3d18, 0x3a4030];
    const skinM = new THREE.MeshPhongMaterial({ color: skinColors[variant], shininess: 5 });
    const clothColors = [0x2a1a0e, 0x1e1e1e, 0x2e2010];
    const clothM = new THREE.MeshPhongMaterial({ color: clothColors[variant], shininess: 3 });
    const darkM = new THREE.MeshPhongMaterial({ color: 0x0f0f0f, shininess: 2 });

    // Cabeza
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.5, 0.46), skinM);
    head.position.y = 1.55;
    head.rotation.x = 0.25;
    head.castShadow = true;
    g.add(head);

    // Ojos brillantes
    const eyeColors = [0xff1100, 0xffaa00, 0xff6600];
    const eyeM = new THREE.MeshBasicMaterial({ color: eyeColors[variant] });
    [-1, 1].forEach(sx => {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.03), eyeM);
        eye.position.set(sx * 0.12, 1.58, 0.24);
        g.add(eye);
        const glow = new THREE.PointLight(eyeColors[variant], 0.6, 1.2);
        glow.position.set(sx * 0.1, 1.58, 0.2);
        g.add(glow);
    });

    // Boca
    const mouthM = new THREE.MeshBasicMaterial({ color: 0x0a0000 });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.02), mouthM);
    mouth.position.set(0, 1.45, 0.24);
    g.add(mouth);
    const toothM = new THREE.MeshBasicMaterial({ color: 0xccbb99 });
    [-1, 0, 1].forEach(ti => {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), toothM);
        tooth.position.set(ti * 0.06, 1.46, 0.245);
        g.add(tooth);
    });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.6, 0.3), clothM);
    torso.position.y = 1.05;
    torso.rotation.x = 0.2;
    torso.castShadow = true;
    g.add(torso);

    // Brazos
    const aLPivot = new THREE.Object3D();
    aLPivot.position.set(-0.35, 1.35, 0);
    g.add(aLPivot);
    const aLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.2), clothM);
    aLMesh.position.y = -0.26;
    aLPivot.add(aLMesh);
    aLPivot.rotation.x = -0.9;

    const aRPivot = new THREE.Object3D();
    aRPivot.position.set(0.35, 1.35, 0);
    g.add(aRPivot);
    const aRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.2), skinM);
    aRMesh.position.y = -0.26;
    aRPivot.add(aRMesh);
    aRPivot.rotation.x = -0.5;

    // Manos/garras
    const clawM = new THREE.MeshPhongMaterial({ color: 0x1a1a0a, shininess: 8 });
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.18), skinM);
    lHand.position.y = -0.5;
    aLPivot.add(lHand);
    [-1, 0, 1].forEach(fi => {
        const claw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), clawM);
        claw.position.set(fi * 0.06, -0.64, 0);
        claw.rotation.x = 0.4;
        aLPivot.add(claw);
    });
    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.18), skinM);
    rHand.position.y = -0.5;
    aRPivot.add(rHand);

    // Piernas
    const lLPivot = new THREE.Object3D();
    lLPivot.position.set(-0.14, 0.7, 0);
    g.add(lLPivot);
    const lLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), clothM);
    lLMesh.position.y = -0.26;
    lLPivot.add(lLMesh);
    const lRPivot = new THREE.Object3D();
    lRPivot.position.set(0.14, 0.7, 0);
    g.add(lRPivot);
    const lRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), darkM);
    lRMesh.position.y = -0.26;
    lRPivot.add(lRMesh);

    // Pies
    const footM = new THREE.MeshPhongMaterial({ color: 0x0a0808 });
    const fL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.28), footM);
    fL.position.set(-0.14, 0.1, 0.04);
    g.add(fL);
    const fR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.28), footM);
    fR.position.set(0.14, 0.1, 0.04);
    g.add(fR);

    // Manchas de sangre
    const bloodM = new THREE.MeshBasicMaterial({ color: 0x330000 });
    const blood = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.31), bloodM);
    blood.position.set(0.1, 1.1, 0.16);
    g.add(blood);

    // Hitboxes
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.95, 0.54), new THREE.MeshBasicMaterial({ visible: false }));
    hb.position.y = 1.05;
    g.add(hb);
    g.userData.hitbox = hb;
    const headHB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.52, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
    headHB.position.y = 1.58;
    g.add(headHB);
    g.userData.headHitbox = headHB;
    const legHB = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.75, 0.54), new THREE.MeshBasicMaterial({ visible: false }));
    legHB.position.y = 0.4;
    g.add(legHB);
    g.userData.legHitbox = legHB;

    g.userData.limbs = { head, torso, aL: aLPivot, aR: aRPivot, lL: lLPivot, lR: lRPivot };
    g.userData.anim = { walkPhase: 0, shootT: 0, deathT: 0, dead: false, prevX: null, prevZ: null, idleT: Math.random() * 100, jumping: false };
    g.userData.isZombie = true;
    return g;
}

function zmBuildMap() {
    // Limpiar obstáculos previos
    onWalls.length = 0;
    onObs.length = 0;
    
    // Cielo nocturno + niebla oscura
    onScene.background = new THREE.Color(0x0a0d14);
    onScene.fog = new THREE.FogExp2(0x0a0d14, 0.045);
    
    // Limpiar objetos de mapa previo conservando jugadores
    const toRemove = [];
    onScene.children.forEach(c => { if (c.userData.isMapObj) toRemove.push(c); });
    toRemove.forEach(c => onScene.remove(c));
    
    function addMap(obj) { obj.userData.isMapObj = true; onScene.add(obj); return obj; }
    
    // Suelo
    const gc = document.createElement('canvas');
    gc.width = gc.height = 1024;
    const gx = gc.getContext('2d');
    gx.fillStyle = '#1a1208';
    gx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 80; i++) gx.fillRect(Math.random() * 1024, Math.random() * 1024, 20 + Math.random() * 60, 15 + Math.random() * 40);
    gx.fillStyle = '#1a2010';
    for (let i = 0; i < 40; i++) gx.fillRect(Math.random() * 1024, Math.random() * 1024, 30 + Math.random() * 80, 25 + Math.random() * 50);
    gx.fillStyle = '#2a1f14';
    gx.fillRect(430, 0, 160, 1024);
    gx.fillRect(0, 430, 1024, 160);
    const groundTex = new THREE.CanvasTexture(gc);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), new THREE.MeshLambertMaterial({ map: groundTex }));
    ground.rotation.x = -Math.PI / 2;
    addMap(ground);
    
    // Iluminación nocturna
    addMap(new THREE.AmbientLight(0x1a2040, 0.6));
    const moon = new THREE.DirectionalLight(0x3040a0, 0.4);
    moon.position.set(-8, 20, 5);
    addMap(moon);
    
    // Función para fuego
    function addFire(x, z, scale = 1) {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.25, 8), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        base.position.set(x, 0.12, z);
        addMap(base);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.35 * scale, 7), new THREE.MeshBasicMaterial({ color: 0xff6600 }));
        flame.position.set(x, 0.45 * scale, z);
        flame.userData.isFlame = true;
        addMap(flame);
        const light = new THREE.PointLight(0xff4400, 2.5 * scale, 5 * scale);
        light.position.set(x, 0.6 * scale, z);
        light.userData.isFlameLight = true;
        addMap(light);
    }
    
    // Edificio con puerta
    function addBuilding(cx, cz, w, d, h, rot, hasLight) {
        const wallM = new THREE.MeshLambertMaterial({ color: 0x2a2218 });
        const roofM = new THREE.MeshLambertMaterial({ color: 0x1a1510 });
        const doorW = 1.1, doorH = 1.9;
        
        // Pared trasera (norte) sólida
        const wBack = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1 + h, 0.22), wallM);
        wBack.position.set(cx, h / 2 - 0.05, cz - d / 2 + 0.11);
        addMap(wBack);
        onWalls.push(wBack);
        
        // Paredes laterales sólidas
        const wLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, d), wallM);
        wLeft.position.set(cx - w / 2 + 0.11, h / 2, cz);
        addMap(wLeft);
        onWalls.push(wLeft);
        const wRight = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, d), wallM);
        wRight.position.set(cx + w / 2 - 0.11, h / 2, cz);
        addMap(wRight);
        onWalls.push(wRight);
        
        // Pared frontal con hueco de puerta
        const sideW = (w - doorW) / 2 - 0.11;
        if (sideW > 0.1) {
            const wFL = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, 0.22), wallM);
            wFL.position.set(cx - (doorW / 2 + sideW / 2), h / 2, cz + d / 2 - 0.11);
            addMap(wFL);
            onWalls.push(wFL);
            const wFR = new THREE.Mesh(new THREE.BoxGeometry(sideW, h, 0.22), wallM);
            wFR.position.set(cx + (doorW / 2 + sideW / 2), h / 2, cz + d / 2 - 0.11);
            addMap(wFR);
            onWalls.push(wFR);
        }
        const wFTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22 * (h - doorH), 0.22), wallM);
        wFTop.position.set(cx, doorH + (h - doorH) / 2, cz + d / 2 - 0.11);
        if (h > doorH + 0.1) { addMap(wFTop); onWalls.push(wFTop); }
        
        // Colisiones (izq, der, fondo)
        onObs.push({ x: cx - w / 2 + 0.6, z: cz, hw: 0.6, hd: d / 2 + 0.1 });
        onObs.push({ x: cx + w / 2 - 0.6, z: cz, hw: 0.6, hd: d / 2 + 0.1 });
        onObs.push({ x: cx, z: cz - d / 2 + 0.3, hw: w / 2, hd: 0.3 });
        
        // Techo
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.14, d + 0.25), roofM);
        roof.position.set(cx, h + 0.07, cz);
        addMap(roof);
        const ridgeM = new THREE.MeshLambertMaterial({ color: 0x151210 });
        const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0, Math.max(w, d) * 0.52, 1.1, 4), ridgeM);
        ridge.position.set(cx, h + 0.65, cz);
        ridge.rotation.y = Math.PI / 4;
        addMap(ridge);
        
        if (hasLight) {
            const wl = new THREE.PointLight(0x806020, 1.5, 7);
            wl.position.set(cx, h * 0.6, cz);
            addMap(wl);
            const dl = new THREE.PointLight(0x604010, 0.8, 3.5);
            dl.position.set(cx, 1.0, cz + d / 2 + 0.3);
            addMap(dl);
        }
        
        // Marco de puerta
        const frameM = new THREE.MeshLambertMaterial({ color: 0x120c06 });
        const fL = new THREE.Mesh(new THREE.BoxGeometry(0.1, doorH, 0.22), frameM);
        fL.position.set(cx - doorW / 2, doorH / 2, cz + d / 2 - 0.11);
        addMap(fL);
        const fR = new THREE.Mesh(new THREE.BoxGeometry(0.1, doorH, 0.22), frameM);
        fR.position.set(cx + doorW / 2, doorH / 2, cz + d / 2 - 0.11);
        addMap(fR);
        const fT = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.1, 0.1, 0.22), frameM);
        fT.position.set(cx, doorH, cz + d / 2 - 0.11);
        addMap(fT);
        
        // Tablones decorativos
        const plankM = new THREE.MeshLambertMaterial({ color: 0x1a100a });
        for (let i = 0; i < 2; i++) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, d * 0.7), plankM);
            plank.position.set(cx - w / 2 + 0.12, 0.5 + i * 0.6, cz);
            addMap(plank);
        }
    }
    
    // Carro oxidado
    function addCar(x, z, rot) {
        const carM = new THREE.MeshLambertMaterial({ color: 0x2a1a10 });
        const rustM = new THREE.MeshLambertMaterial({ color: 0x3d1a08 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.0), carM);
        body.position.set(x, 0.4, z);
        body.rotation.y = rot;
        body.castShadow = true;
        addMap(body);
        onWalls.push(body);
        onObs.push({ x, z, hw: 1.1, hd: 2.1 });
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.0), rustM);
        cab.position.set(x, 0.92 + 0.3, z - 0.3);
        cab.rotation.y = rot;
        addMap(cab);
        [[-0.95, -0.0, 1.2], [0.95, -0.0, 1.2], [-0.95, -0.0, -1.2], [0.95, -0.0, -1.2]].forEach(([wx, wy, wz]) => {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x + wx, 0.28, z + wz);
            addMap(wheel);
        });
    }
    
    // Bus abandonado
    function addBus(x, z, rot) {
        const busM = new THREE.MeshLambertMaterial({ color: 0x222018 });
        const bus = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 7.5), busM);
        bus.position.set(x, 0.9, z);
        bus.rotation.y = rot;
        bus.castShadow = true;
        addMap(bus);
        onWalls.push(bus);
        onObs.push({ x, z, hw: 1.3, hd: 3.9 });
        const winM = new THREE.MeshBasicMaterial({ color: 0x0a0f14 });
        for (let i = -2; i <= 2; i++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.5), winM);
            win.position.set(x + 1.21, 1.2, z + i * 1.1);
            win.rotation.y = Math.PI / 2;
            addMap(win);
        }
        [[-1.2, 0, 2.8], [1.2, 0, 2.8], [-1.2, 0, -2.8], [1.2, 0, -2.8]].forEach(([wx, wy, wz]) => {
            const w2 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), new THREE.MeshLambertMaterial({ color: 0x080808 }));
            w2.rotation.z = Math.PI / 2;
            w2.position.set(x + wx, 0.32, z + wz);
            addMap(w2);
        });
    }
    
    // Barricada de cajas
    function addBarricade(x, z, rot, count = 3) {
        const boxM = new THREE.MeshLambertMaterial({ color: 0x2a1e0e });
        for (let i = 0; i < count; i++) {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.55), boxM);
            box.position.set(x + Math.cos(rot) * i * 0.6, 0.28, z + Math.sin(rot) * i * 0.6);
            box.rotation.y = rot + Math.random() * 0.3;
            addMap(box);
            onWalls.push(box);
        }
        onObs.push({ x, z, hw: count * 0.35, hd: 0.4 });
    }
    
    // Árbol muerto
    function addDeadTree(x, z) {
        const trunkM = new THREE.MeshLambertMaterial({ color: 0x1a1208 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.5, 6), trunkM);
        trunk.position.set(x, 1.75, z);
        addMap(trunk);
        [[0.6, 3.2, 0.5, 0, 0.4], [-0.7, 2.8, 0.45, 0, 0.35], [0.3, 3.6, 0.35, 0, 0.28], [-0.2, 2.4, 0.4, 0, 0.32]].forEach(([bx, by, bz, _, r]) => {
            const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 1.4, 5), trunkM);
            br.position.set(x + bx, by, z + bz);
            br.rotation.z = (bx > 0 ? 1 : -1) * 0.6;
            br.rotation.x = 0.3;
            addMap(br);
        });
    }
    
    // Construir edificios
    addBuilding(0, 0, 6, 5, 3.2, 0, true);
    addBuilding(-13, 12, 7, 5.5, 2.8, 0, false);
    addBuilding(13, 12, 4.5, 5, 4.0, 0, true);
    addBuilding(-13, -2, 6, 5.5, 2.6, 0.05, true);
    addBuilding(13, -2, 5.5, 5, 2.8, -0.04, false);
    addBuilding(-8, -13, 5, 4.5, 2.2, 0, false);
    addBuilding(2, -13, 4.5, 4, 2.0, 0.1, false);
    
    // Bus y carros
    addBus(5, 2, Math.PI / 2);
    addCar(-4, 6, 0.3);
    addCar(10, -8, -0.2);
    addCar(-9, 8, 2.8);
    
    // Barricadas
    addBarricade(4, -5, 0.1, 4);
    addBarricade(-5, 4, 1.6, 3);
    addBarricade(8, 6, 0.8, 3);
    addBarricade(-3, -7, 2.2, 3);
    
    // Fuegos
    addFire(-13, 2);
    addFire(13, 6);
    addFire(-8, 12);
    addFire(3, -11);
    addFire(0, 6, 1.4);
    addFire(-5, -4, 0.8);
    addFire(9, -3, 0.9);
    addFire(-14, -10, 0.7);
    
    // Barriles
    const barrelM = new THREE.MeshLambertMaterial({ color: 0x1a1010 });
    [[-6, 2], [6, -6], [3, 8], [-10, 5], [11, 3], [-4, -10], [7, 11], [-11, -7]].forEach(([bx, bz]) => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.7, 8), barrelM);
        b.position.set(bx, 0.35, bz);
        addMap(b);
    });
    
    // Árboles muertos
    addDeadTree(-22, -22);
    addDeadTree(22, -20);
    addDeadTree(-20, 20);
    addDeadTree(21, 21);
    addDeadTree(0, -22);
    addDeadTree(-22, 5);
    addDeadTree(22, 8);
    
    // Cerca de madera perimetral
    const fenceM = new THREE.MeshLambertMaterial({ color: 0x1a1208 });
    for (let i = -5; i <= 5; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), fenceM);
        post.position.set(i * 4.2, -0.1, -23);
        addMap(post);
        const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), fenceM);
        post2.position.set(i * 4.2, -0.1, 23);
        addMap(post2);
    }
    
    // Piedras dispersas
    const stoneM = new THREE.MeshLambertMaterial({ color: 0x252220 });
    [[4, 4], [-7, 8], [8, -4], [-3, 12], [11, 10], [-12, -5]].forEach(([sx, sz]) => {
        if (!isNaN(sx)) {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.18 + Math.random() * 0.12, 5, 4), stoneM);
            s.position.set(sx, 0.1, sz);
            addMap(s);
        }
    });
    
    // Animación de llamas
    function flickerFires() {
        onScene.children.forEach(c => {
            if (c.userData.isFlame) {
                c.scale.y = 0.85 + Math.random() * 0.3;
                c.rotation.y += 0.08;
                c.material.color.setHSL(0.06 + Math.random() * 0.04, 0.9, 0.5 + Math.random() * 0.1);
            }
            if (c.userData.isFlameLight) c.intensity = 2 + Math.random() * 1.5;
        });
        if (zmActive) requestAnimationFrame(flickerFires);
    }
    flickerFires();
}