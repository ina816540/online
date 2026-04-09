// ============================================================
// JUEGO PRINCIPAL (Modo Práctica 3D)
// ============================================================

let scene, camera, renderer, gunGroup, yawObj, pitchObj, raycaster;
let animFrameId, locked = false;
let mouseDX = 0, mouseDY = 0;
let state = {};
let gridActive = -1;
let roomMat;

// Variables de menú
let selMode = 'clicking';
let selDiff = 'medium';
const prevFns = {};

// Variable de pausa compartida
var paused = false;

// Variables para movimiento en modo Strafing
let strafeKeys = { a: false, d: false };
let strafePlayerPos = { x: 0, z: 0 };
let strafeTarget = null;
let strafeTargetSpeed = 0;
let strafeTargetDir = 1;
let strafeTargetPos = { x: 0, z: 0 };
const STRAFE_BOUNDS = { left: -6, right: 6 };
const STRAFE_PLAYER_BOUNDS = { left: -5, right: 5 };
const STRAFE_DISTANCE_Z = -12; // distancia fija en Z

function initThree() {
    const canvas = document.getElementById('three-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    scene = new THREE.Scene();
    yawObj = new THREE.Object3D();
    pitchObj = new THREE.Object3D();
    yawObj.add(pitchObj);
    scene.add(yawObj);
    
    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.05, 500);
    pitchObj.add(camera);
    camera.position.set(0, 0, 0);
    yawObj.position.set(0, 1.7, 0);
    
    raycaster = new THREE.Raycaster();
    buildPracticeRoom();
    buildGun();
    buildLights();
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

let practiceRoomObjects = []; // track objetos del room normal para poder ocultarlos

function buildPracticeRoom() {
    practiceRoomObjects = [];
    const col = new THREE.Color(CFG.room.color);
    scene.background = col;
    scene.fog = new THREE.Fog(col, 20, 80);
    
    roomMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(CFG.room.color).multiplyScalar(1.8), side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 50), roomMat);
    room.position.set(0, 3.3, -23);
    scene.add(room);
    practiceRoomObjects.push(room);
    
    const grid = new THREE.GridHelper(60, 30, 0x222244, 0x111133);
    grid.position.set(0, -1.7, 0);
    scene.add(grid);
    practiceRoomObjects.push(grid);
    
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x0d0520, side: THREE.DoubleSide });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(28, 8), wallMat);
    wall.position.set(0, 2.3, -22);
    scene.add(wall);
    practiceRoomObjects.push(wall);
    
    const lm = new THREE.LineBasicMaterial({ color: 0x331155 });
    for (let i = -14; i <= 14; i += 2) {
        const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, -1.7, -22), new THREE.Vector3(i, 6.3, -22)]);
        const line = new THREE.Line(g, lm);
        scene.add(line);
        practiceRoomObjects.push(line);
    }
    for (let j = -1.7; j <= 6.3; j += 2) {
        const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-14, j, -22), new THREE.Vector3(14, j, -22)]);
        const line = new THREE.Line(g, lm);
        scene.add(line);
        practiceRoomObjects.push(line);
    }
}

function setPracticeRoomVisible(visible) {
    practiceRoomObjects.forEach(o => { o.visible = visible; });
}

function buildGun() {
    gunGroup = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
    const slideMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3e });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const accentMat = new THREE.MeshLambertMaterial({ color: 0xe040fb, emissive: 0xe040fb, emissiveIntensity: 0.8 });
    
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), bodyMat);
    gunGroup.add(body);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.48), slideMat);
    slide.position.set(0, 0.09, -0.02);
    gunGroup.add(slide);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.06, -0.37);
    gunGroup.add(barrel);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 8), darkMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.06, -0.50);
    gunGroup.add(tip);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.10), bodyMat);
    handle.position.set(0, -0.14, 0.08);
    handle.rotation.x = 0.18;
    gunGroup.add(handle);
    const tg = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 12, Math.PI), darkMat);
    tg.position.set(0, -0.065, -0.02);
    tg.rotation.z = Math.PI / 2;
    tg.rotation.y = Math.PI / 2;
    gunGroup.add(tg);
    const sf = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.01), accentMat);
    sf.position.set(0, 0.132, -0.25);
    gunGroup.add(sf);
    const al = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.12, 0.01), accentMat);
    al.position.set(0.04, 0, 0.04);
    gunGroup.add(al);
    const al2 = al.clone();
    al2.position.set(-0.04, 0, 0.04);
    gunGroup.add(al2);
    gunGroup.position.set(0.22, -0.22, -0.4);
    gunGroup.rotation.y = 0.06;
    camera.add(gunGroup);
}

let defaultLights = [];

function buildLights() {
    const al = new THREE.AmbientLight(0x221133, 1.2);
    scene.add(al); defaultLights.push(al);
    const spot = new THREE.SpotLight(0xffffff, 1.5);
    spot.position.set(0, 8, -10);
    spot.target.position.set(0, 0, -20);
    spot.angle = 0.5;
    spot.penumbra = 0.4;
    spot.castShadow = true;
    scene.add(spot); scene.add(spot.target);
    defaultLights.push(spot); defaultLights.push(spot.target);
    const dl1 = new THREE.DirectionalLight(0x6622aa, 0.6);
    dl1.position.set(-10, 5, 0);
    scene.add(dl1); defaultLights.push(dl1);
    const dl2 = new THREE.DirectionalLight(0x00e5ff, 0.3);
    dl2.position.set(10, 3, -20);
    scene.add(dl2); defaultLights.push(dl2);
}

function setDefaultLightsVisible(visible) {
    defaultLights.forEach(l => { l.visible = visible; });
}

function updateRoomColor() {
    if (state && state.modeId === 'humanoid') return; // no pisar el fondo del humanoid
    const col = new THREE.Color(CFG.room.color);
    scene.background = col;
    scene.fog = new THREE.Fog(col, 20, 80);
    if (roomMat) roomMat.color.set(col.clone().multiplyScalar(1.8));
}

function updateCamera() {
    if (!mouseDX && !mouseDY) return;
    const s = CFG.sensMap.hipfire * 0.00005;
    yawObj.rotation.y -= mouseDX * s;
    pitchObj.rotation.x -= mouseDY * s;
    pitchObj.rotation.x = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, pitchObj.rotation.x));
    mouseDX = 0;
    mouseDY = 0;
}

let shootAnim = 0, gunBob = 0;
function updateGun(dt) {
    if (!gunGroup) return;
    if (shootAnim > 0) {
        shootAnim = Math.max(0, shootAnim - dt * 8);
        gunGroup.position.z = -0.4 + shootAnim * 0.06;
        gunGroup.rotation.x = shootAnim * 0.12;
    } else {
        gunGroup.position.z += (-0.4 - gunGroup.position.z) * dt * 8;
        gunGroup.rotation.x += (0 - gunGroup.rotation.x) * dt * 8;
    }
    gunBob += dt * 1.2;
    gunGroup.position.y = -0.22 + Math.sin(gunBob) * 0.003;
}

function triggerShoot() {
    shootAnim = 1;
    const flash = new THREE.PointLight(0xe040fb, 8, 2);
    flash.position.set(0, 0.06, -0.5);
    camera.add(flash);
    setTimeout(() => camera.remove(flash), 50);
}

// ========== MODO PRÁCTICA ==========

function startGame(modeId, diff) {
    // Reiniciar estado
    state = {
        running: true,
        modeId, diff,
        score: 0, shots: 0, hits: 0,
        combo: 0, bestCombo: 0,
        timeLeft: DIFF[diff].time,
        lives: 3,
        targets: [],
        timerStarted: false,
        survSec: 0,
        spawnIv: null,
        timerIv: null,
        trackData: null,
        gridOrder: [],
        gridIndex: 0,
        strafe: {
            startTime: performance.now(),
            speedMultiplier: 0.5,
            pauseTimer: 0,
            isPaused: false
        }
    };
    
    // Configuración específica para modo Strafing
    if (modeId === 'strafing') {
        // Posición inicial del jugador (centro)
        strafePlayerPos = { x: 0, z: 0 };
        yawObj.position.x = strafePlayerPos.x;
        yawObj.position.z = strafePlayerPos.z;
        // Crear objetivo
        const radius = DIFF[diff].minR * CFG.tgt.sizeMult;
        const mesh = makeTargetMesh(radius, 'strafing');
        mesh.position.set(0, 1.5, STRAFE_DISTANCE_Z);
        scene.add(mesh);
        strafeTarget = { mesh, radius, alive: true };
        state.targets = [strafeTarget];
        strafeTargetPos = { x: 0, z: STRAFE_DISTANCE_Z };
        strafeTargetSpeed = 0.8;
        strafeTargetDir = 1;
    }

    if (modeId === 'humanoid') {
        state.humanoid = {
            startTime: performance.now(),
            mesh: null,
            x: 0,
            y: 0,          // Y offset para salto
            velY: 0,       // velocidad vertical
            isGrounded: true,
            dir: 1,
            speed: 2.2,
            speedMultiplier: 1.0,
            pauseTimer: 0,
            isPaused: false,
            microAccelTimer: 0,
            microAccelActive: false,
            jumpTimer: 0,  // timer para próximo salto
            hp: 100,
            maxHp: 100,
            hits: 0,
            headshots: 0,
            parts: {}
        };
        // Construir escenario BloodStrike
        buildHumanoidScene();
        spawnHumanoidTarget();
    }
    
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    if (!scene) initThree();
    updateRoomColor();
    document.getElementById('three-canvas').style.display = 'block';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('bottom-bar').style.display = 'flex';
    document.getElementById('crosshair').style.display = 'block';
    
    const m = MODES[modeId];
    const modeTag = document.getElementById('mode-tag');
    modeTag.textContent = m.tag;
    modeTag.style.borderColor = m.color;
    modeTag.style.color = m.color;
    
    if (modeId === 'survival') {
        document.getElementById('timer-val').textContent = '0s';
        document.getElementById('lives-hud').style.display = 'flex';
        updateLives();
    } else {
        document.getElementById('timer-val').textContent = DIFF[diff].time;
        document.getElementById('lives-hud').style.display = 'none';
    }
    document.getElementById('lock-mode-name').textContent = m.name;
    
    if (mobileMode) {
        document.getElementById('lock-overlay').style.display = 'none';
        document.getElementById('mobile-controls').classList.add('active');
        document.getElementById('crosshair').style.display = 'block';
        if (!state.timerStarted) beginTimerAndSpawn();
    } else {
        document.getElementById('mobile-controls').classList.remove('active');
        document.getElementById('lock-overlay').style.display = 'flex';
    }
    
    if (animFrameId) cancelAnimationFrame(animFrameId);
    
    let lastFrameTime = performance.now();
    let lastRender = performance.now();
    const targetFPS = CFG.fps.target;
    const frameInterval = 1000 / targetFPS;
    let fpsFrames = 0, fpsAccum = 0;
    const fpsVal = document.getElementById('fps-val');
    
    function renderLoop(now) {
        animFrameId = requestAnimationFrame(renderLoop);
        const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
        const deltaTime = now - lastFrameTime;
        lastFrameTime = now;
        
        if (state.running) {
            updateCamera();
            updateGun(dt);
            
            if (modeId === 'strafing') {
                updateStrafing(dt);
            } else if (modeId === 'humanoid') {
                updateHumanoid(dt);
            } else {
                updateTargets(dt);
                if (modeId === 'tracking') updateTracking(dt);
            }
        }
        
        fpsAccum += deltaTime;
        fpsFrames++;
        if (fpsAccum >= 500) {
            const fd = Math.round(fpsFrames / (fpsAccum / 1000));
            fpsFrames = 0;
            fpsAccum = 0;
            if (fpsVal) {
                fpsVal.textContent = fd;
                fpsVal.style.color = fd >= 100 ? 'var(--green)' : fd >= 60 ? 'var(--accent3)' : fd >= 30 ? '#ffd700' : 'var(--accent2)';
            }
        }
        
        if (CFG.fps.limit) {
            if (now - lastRender >= frameInterval) {
                renderer.render(scene, camera);
                lastRender = now;
            }
        } else {
            renderer.render(scene, camera);
            lastRender = now;
        }
    }
    renderLoop(performance.now());
    
    const canvas = document.getElementById('three-canvas');
    canvas.removeEventListener('click', onShoot);
    canvas.addEventListener('click', onShoot);
}

// ========== FUNCIONES DEL MODO STRAFING ==========
function updateStrafing(dt) {
    if (!state.running) return;
    
    // Movimiento del jugador (A/D)
    let move = 0;
    if (strafeKeys.a) move = -1;
    if (strafeKeys.d) move = 1;
    if (move !== 0) {
        const speed = 6.0; // velocidad de strafe
        strafePlayerPos.x += move * speed * dt;
        strafePlayerPos.x = Math.max(STRAFE_PLAYER_BOUNDS.left, Math.min(STRAFE_PLAYER_BOUNDS.right, strafePlayerPos.x));
        yawObj.position.x = strafePlayerPos.x;
    }
    
    // Lógica de movimiento del objetivo
    const elapsed = (performance.now() - state.strafe.startTime) / 1000;
    let speedFactor = Math.min(2.5, 0.5 + elapsed / 30);
    let baseSpeed = 2.0 * DIFF[state.diff].speed * CFG.tgt.speedMult;
    
    if (state.strafe.pauseTimer > 0) {
        state.strafe.pauseTimer -= dt;
        if (state.strafe.pauseTimer <= 0) {
            state.strafe.isPaused = false;
            strafeTargetDir = (Math.random() > 0.5 ? 1 : -1);
            strafeTargetSpeed = baseSpeed * speedFactor * (0.7 + Math.random() * 0.8);
        }
    }
    
    if (!state.strafe.isPaused) {
        strafeTargetPos.x += strafeTargetDir * strafeTargetSpeed * dt;
        if (strafeTargetPos.x > STRAFE_BOUNDS.right) {
            strafeTargetPos.x = STRAFE_BOUNDS.right - (strafeTargetPos.x - STRAFE_BOUNDS.right);
            strafeTargetDir = -1;
        } else if (strafeTargetPos.x < STRAFE_BOUNDS.left) {
            strafeTargetPos.x = STRAFE_BOUNDS.left + (STRAFE_BOUNDS.left - strafeTargetPos.x);
            strafeTargetDir = 1;
        }
        if (Math.random() < 0.01 * dt * 60) {
            state.strafe.isPaused = true;
            state.strafe.pauseTimer = 0.2 + Math.random() * 0.3;
        }
    }
    
    if (strafeTarget && strafeTarget.mesh) {
        strafeTarget.mesh.position.x = strafeTargetPos.x;
        strafeTarget.mesh.position.y = 1.5;
        strafeTarget.mesh.position.z = STRAFE_DISTANCE_Z;
    }
}

function strafeShoot() {
    if (!state.running || !locked) return;
    const m = state.modeId;
    if (m !== 'strafing') return;
    
    playGunshot();
    triggerShoot();
    const ch = document.getElementById('crosshair');
    ch.classList.add('shoot');
    setTimeout(() => ch.classList.remove('shoot'), 100);
    
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects([strafeTarget.mesh], false);
    if (hits.length > 0) {
        state.hits++;
        state.shots++;
        state.combo++;
        if (state.combo > state.bestCombo) state.bestCombo = state.combo;
        const pts = 100 + Math.min(state.combo, 10) * 10;
        state.score += pts;
        playHitSound();
        showHitFlash();
        if (CFG.vis.combo && state.combo >= 2) {
            document.getElementById('combo-num').textContent = state.combo;
            document.getElementById('combo-disp').classList.add('show');
            clearTimeout(state.comboT);
            state.comboT = setTimeout(() => document.getElementById('combo-disp').classList.remove('show'), 1500);
        }
        showFloatPts(pts, strafeTarget.mesh.position);
        updateHUD();
    } else {
        state.shots++;
        state.combo = 0;
        document.getElementById('combo-disp').classList.remove('show');
        playMissSound();
        updateHUD();
        state.score = Math.max(0, state.score - 10);
        updateHUD();
    }
}

// ========== FUNCIONES COMUNES ==========
function updateLives() {
    for (let i = 1; i <= 3; i++) {
        document.getElementById('lf' + i).classList.toggle('lost', i > state.lives);
    }
}

function startTimer() {
    state.timerIv = setInterval(() => {
        if (!state.running) return;
        state.timeLeft--;
        document.getElementById('timer-val').textContent = state.timeLeft;
        if (state.timeLeft <= 5) document.getElementById('timer-val').classList.add('warn');
        if (state.timeLeft <= 0) endGame();
    }, 1000);
}

function startSurvivalTimer() {
    state.timerIv = setInterval(() => {
        if (!state.running) return;
        state.survSec++;
        document.getElementById('timer-val').textContent = state.survSec + 's';
    }, 1000);
}

function beginTimerAndSpawn() {
    if (state.timerStarted) return;
    state.timerStarted = true;
    if (state.modeId === 'tracking') startTracking3D();
    else if (state.modeId === 'gridshot') initGridShot();
    else if (state.modeId === 'strafing' || state.modeId === 'humanoid') {
        startTimer();
    } else {
        startSpawner3D();
    }
    if (state.modeId === 'survival') startSurvivalTimer();
    else if (state.modeId !== 'strafing' && state.modeId !== 'humanoid' && state.modeId !== 'gridshot' && state.modeId !== 'tracking') startTimer();
}

function startSpawner3D() {
    const m = state.modeId;
    const d = DIFF[state.diff];
    spawnFor3D();
    state.spawnIv = setInterval(() => {
        if (!state.running) return;
        const max = m === 'flicking' ? 1 : CFG.tgt.max;
        if (state.targets.length < max) spawnFor3D();
    }, m === 'flicking' ? 150 : d.rate);
}

function spawnFor3D() {
    const m = state.modeId;
    if (m === 'flicking' && state.targets.length > 0) return;
    if (m === 'gridshot') return;
    if (m === 'tracking') return;
    if (m === 'strafing') return;
    spawnTarget3D(m);
}

function makeTargetMesh(radius, modeId) {
    const cols = {
        clicking: 0x00aacc, flicking: 0xcc6600, tracking: 0x00cc66,
        micro: 0xcc1144, strafing: 0xffaa44, survival: 0xccaa00,
        gridshot: 0xaa00cc, wide: 0xcc4400
    };
    const col = cols[modeId] || 0x00aacc;
    const geo = new THREE.SphereGeometry(radius, 24, 24);
    const mat = new THREE.MeshPhongMaterial({ color: col, emissive: new THREE.Color(col).multiplyScalar(0.3), shininess: 80, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.2, radius * 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5 }));
    mesh.add(ring);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.z = radius * 0.85;
    mesh.add(dot);
    return mesh;
}

function spawnTarget3D(modeId) {
    if (!state.running || !scene) return;
    const d = DIFF[state.diff];
    const [minL, maxL] = d.life;
    const life = minL + Math.random() * (maxL - minL);
    let r;
    if (modeId === 'micro') r = (d.minR * 0.3 + Math.random() * d.minR * 0.2) * CFG.tgt.sizeMult;
    else if (modeId === 'wide') r = d.minR * 1.5 * CFG.tgt.sizeMult;
    else r = (d.minR + Math.random() * (d.maxR - d.minR)) * CFG.tgt.sizeMult;
    let x, y;
    const z = -10 - Math.random() * 10;
    if (modeId === 'wide') {
        const side = Math.floor(Math.random() * 4);
        switch(side) {
            case 0: x = -12; y = 1.5; break;
            case 1: x = 12; y = 1.5; break;
            case 2: x = 0; y = 5.5; break;
            default: x = 0; y = -1; break;
        }
    } else if (modeId === 'micro') {
        x = (Math.random() - 0.5) * 10;
        y = 0.5 + Math.random() * 4;
    } else {
        x = (Math.random() - 0.5) * 14;
        y = 0.5 + Math.random() * 4;
    }
    const mesh = makeTargetMesh(r, modeId);
    mesh.position.set(x, y, z);
    mesh.scale.set(0, 0, 0);
    scene.add(mesh);
    const spd = d.speed * CFG.tgt.speedMult;
    let vx = (Math.random() - 0.5) * spd * 0.6;
    let vy = (Math.random() - 0.5) * spd * 0.3;
    if (modeId === 'wide') {
        vx = 0; vy = 0;
    }
    const tgt = { mesh, modeId, radius: r, life, age: 0, vx, vy, alive: true };
    state.targets.push(tgt);
    let sa = 0;
    const si = () => { sa += 0.016; const s = Math.min(1, sa / 0.12); mesh.scale.set(s, s, s); if (s < 1) requestAnimationFrame(si); };
    requestAnimationFrame(si);
    return tgt;
}

// ==================== GRIDSHOT ====================
function initGridShot() {
    state.targets.forEach(t => scene.remove(t.mesh));
    state.targets = [];
    const sx = -6, sy = 0.5, stx = 4.5, sty = 3.5, z = -12;
    state.gridOrder = [];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const mesh = makeTargetMesh(0.28, 'gridshot');
            mesh.position.set(sx + c * stx, sy + r * sty, z);
            mesh.scale.set(0.9, 0.9, 0.9);
            scene.add(mesh);
            state.targets.push({ mesh, modeId: 'gridshot', radius: 0.28, life: 9999, age: 0, vx: 0, vy: 0, alive: true, gridIdx: r * 3 + c });
            state.gridOrder.push(r * 3 + c);
        }
    }
    for (let i = state.gridOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.gridOrder[i], state.gridOrder[j]] = [state.gridOrder[j], state.gridOrder[i]];
    }
    state.gridIndex = 0;
    updateGridActive();
    startTimer();
}

function updateGridActive() {
    const activeIdx = state.gridOrder[state.gridIndex];
    state.targets.forEach(t => {
        if (!t.mesh || !t.mesh.material) return;
        const a = t.gridIdx === activeIdx;
        t.mesh.material.emissiveIntensity = a ? 0.8 : 0.1;
        t.mesh.material.opacity = a ? 1 : 0.35;
        t.mesh.scale.set(a ? 1 : 0.75, a ? 1 : 0.75, a ? 1 : 0.75);
    });
}

function gridHit() {
    const activeIdx = state.gridOrder[state.gridIndex];
    const tgt = state.targets.find(t => t.gridIdx === activeIdx);
    if (tgt) {
        state.hits++;
        state.shots++;
        state.combo++;
        if (state.combo > state.bestCombo) state.bestCombo = state.combo;
        const pts = 100 + Math.min(state.combo, 10) * 10;
        state.score += pts;
        playHitSound();
        showHitFlash();
        showFloatPts(pts, tgt.mesh.position);
        state.gridIndex++;
        if (state.gridIndex >= state.gridOrder.length) {
            state.score += 500;
            initGridShot();
        } else {
            updateGridActive();
        }
        updateHUD();
    }
}

// ==================== TRACKING ====================
function startTracking3D() {
    const d = DIFF[state.diff];
    const r = (d.minR + d.maxR) * 0.6 * CFG.tgt.sizeMult;
    const mesh = makeTargetMesh(r, 'tracking');
    mesh.position.set(0, 2, -12);
    scene.add(mesh);
    state.targets.push({ mesh, modeId: 'tracking', radius: r, life: Infinity, age: 0, vx: 0, vy: 0, alive: true });
    state.trackData = { frames: 0, onFrames: 0 };
    startTimer();
}

function updateTracking(dt) {
    if (!state.trackData || !state.targets[0]) return;
    const tgt = state.targets[0];
    if (!tgt.mesh) return;
    
    const time = performance.now() / 1000;
    const speed = DIFF[state.diff].speed * CFG.tgt.speedMult * 1.5;
    const radiusX = 5.5;
    const radiusY = 3.2;
    const x = Math.sin(time * 0.8) * radiusX + Math.sin(time * 1.2) * 1.5;
    const y = Math.cos(time * 0.6) * radiusY + Math.sin(time * 1.5) * 1.2;
    tgt.mesh.position.x = x;
    tgt.mesh.position.y = y + 1.5;
    
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObject(tgt.mesh, false);
    const onTarget = hits.length > 0;
    
    state.trackData.frames++;
    if (onTarget) {
        state.trackData.onFrames++;
        tgt.mesh.material.emissiveIntensity = 0.9;
        state.score += dt * 50;
    } else {
        tgt.mesh.material.emissiveIntensity = 0.3;
    }
    state.shots++;
    const pct = Math.round(state.trackData.onFrames / state.trackData.frames * 100);
    document.getElementById('acc-pct').textContent = pct;
    document.getElementById('acc-fill').style.width = pct + '%';
    document.getElementById('score-val').textContent = Math.floor(state.score).toLocaleString();
}

// ==================== ACTUALIZACIÓN DE OBJETIVOS (excepto tracking y strafing) ====================
function updateTargets(dt) {
    const d = DIFF[state.diff];
    const m = state.modeId;
    if (m === 'tracking' || m === 'strafing') return;
    state.targets.forEach(tgt => {
        if (!tgt.alive || m === 'gridshot') return;
        tgt.age += dt;
        tgt.mesh.position.x += tgt.vx * dt;
        tgt.mesh.position.y += tgt.vy * dt;
        const px = tgt.mesh.position.x, py = tgt.mesh.position.y;
        if (Math.abs(px) > 13) { tgt.vx *= -1; tgt.mesh.position.x = Math.sign(px) * 13; }
        if (py < 0.3) { tgt.vy = Math.abs(tgt.vy); tgt.mesh.position.y = 0.3; }
        if (py > 6) { tgt.vy = -Math.abs(tgt.vy); tgt.mesh.position.y = 6; }
        if (Math.random() < 0.008 * dt * 60) {
            tgt.vx += (Math.random() - 0.5) * d.speed * CFG.tgt.speedMult * 0.3;
            tgt.vy += (Math.random() - 0.5) * d.speed * CFG.tgt.speedMult * 0.2;
        }
        if (tgt.mesh.children[0]) {
            tgt.mesh.children[0].rotation.y += dt * 1.5;
            tgt.mesh.children[0].rotation.x += dt * 0.8;
        }
        if (m !== 'tracking') {
            tgt.mesh.material.opacity = Math.max(0, 1 - Math.pow(tgt.age / tgt.life, 3) * 0.5);
            if (tgt.age >= tgt.life) {
                if (m === 'survival') loseLife();
                removeTarget3D(tgt);
            }
        }
    });
}

function onShoot() {
    if (!state.running || !locked) return;
    const m = state.modeId;
    if (m === 'tracking') return;
    if (m === 'strafing') {
        strafeShoot();
        return;
    }
    if (m === 'humanoid') {
        humanoidShoot();
        return;
    }
    playGunshot();
    triggerShoot();
    const ch = document.getElementById('crosshair');
    ch.classList.add('shoot');
    setTimeout(() => ch.classList.remove('shoot'), 100);
    
    if (m === 'gridshot') {
        gridHit();
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

function recordHit(tgt) {
    state.hits++;
    state.shots++;
    state.combo++;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    let pts = calcPts(tgt);
    if (tgt.modeId === 'micro') pts *= 2;
    state.score += pts;
    playHitSound();
    showHitFlash();
    if (CFG.vis.combo && state.combo >= 2) {
        document.getElementById('combo-num').textContent = state.combo;
        document.getElementById('combo-disp').classList.add('show');
        clearTimeout(state.comboT);
        state.comboT = setTimeout(() => document.getElementById('combo-disp').classList.remove('show'), 1500);
    }
    showFloatPts(pts, tgt.mesh.position);
    removeTarget3D(tgt);
    updateHUD();
}

function recordMiss() {
    state.shots++;
    state.combo = 0;
    document.getElementById('combo-disp').classList.remove('show');
    playMissSound();
    updateHUD();
}

function loseLife() {
    if (!state.running) return;
    state.lives--;
    updateLives();
    if (state.lives <= 0) setTimeout(endGame, 300);
}

function calcPts(tgt) {
    const base = {
        clicking: 100, flicking: 180, micro: 280, strafing: 120,
        survival: 90, wide: 120, gridshot: 100
    }[tgt.modeId] || 100;
    return Math.max(base + Math.round(Math.max(0, (0.3 - tgt.radius) * 300)) + Math.min(state.combo, 10) * 10, 30);
}

function showHitFlash() {
    const f = document.getElementById('hit-flash');
    f.classList.add('show');
    setTimeout(() => f.classList.remove('show'), 80);
}

function showFloatPts(pts, worldPos) {
    if (!CFG.vis.pts) return;
    const v = worldPos.clone().project(camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-0.5 * v.y + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.textContent = '+' + pts;
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-family:Orbitron,monospace;font-weight:700;font-size:1rem;color:#e040fb;text-shadow:0 0 10px #e040fb;pointer-events:none;z-index:60;transform:translate(-50%,-50%);animation:float-up .7s ease-out forwards;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
}

function removeTarget3D(tgt) {
    if (!tgt.alive) return;
    tgt.alive = false;
    let a = 0;
    const s = () => {
        a += 0.016;
        const sc = Math.max(0, 1 - a / 0.1);
        if (tgt.mesh) { tgt.mesh.scale.set(sc, sc, sc); if (sc > 0) requestAnimationFrame(s); else scene.remove(tgt.mesh); }
    };
    requestAnimationFrame(s);
    state.targets = state.targets.filter(t => t !== tgt);
}

function updateHUD() {
    document.getElementById('score-val').textContent = Math.floor(state.score).toLocaleString();
    document.getElementById('shots-val').textContent = state.shots + ' / ' + state.hits;
    const acc = state.shots > 0 ? Math.round(state.hits / state.shots * 100) : 0;
    document.getElementById('acc-pct').textContent = acc;
    document.getElementById('acc-fill').style.width = acc + '%';
}

function endGame() {
    state.running = false;
    clearInterval(state.timerIv);
    clearInterval(state.spawnIv);
    document.exitPointerLock();
    if (state.humanoid && state.humanoid.mesh) {
        scene.remove(state.humanoid.mesh);
        state.humanoid.mesh = null;
        const ch = document.getElementById('crosshair');
        if (ch) ch.style.filter = '';
        // Limpiar escenario humanoid
        if (state.humanoid.sceneObjects) {
            state.humanoid.sceneObjects.forEach(o => scene.remove(o));
            state.humanoid.sceneObjects = [];
        }
        // Restaurar escenario y luces originales
        setPracticeRoomVisible(true);
        setDefaultLightsVisible(true);
        updateRoomColor();
    }
    state.targets.forEach(t => { if (t.mesh) scene.remove(t.mesh); });
    state.targets = [];
    document.getElementById('three-canvas').style.display = 'none';
    document.getElementById('mobile-controls').classList.remove('active');
    document.getElementById('hud').style.display = 'none';
    document.getElementById('bottom-bar').style.display = 'none';
    document.getElementById('crosshair').style.display = 'none';
    document.getElementById('pause-overlay').style.display = 'none';
    paused = false;
    const fpsV = document.getElementById('fps-val');
    if (fpsV) fpsV.textContent = '—';
    document.getElementById('lives-hud').style.display = 'none';
    document.getElementById('lock-overlay').style.display = 'none';
    document.getElementById('combo-disp').classList.remove('show');
    document.getElementById('timer-val').classList.remove('warn');
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    const acc = state.shots > 0 ? Math.round(state.hits / state.shots * 100) : 0;
    document.getElementById('r-score').textContent = Math.floor(state.score).toLocaleString();
    document.getElementById('r-acc').textContent = acc + '%';
    document.getElementById('r-hits').textContent = state.hits;
    document.getElementById('r-misses').textContent = Math.max(0, state.shots - state.hits);
    document.getElementById('r-combo').textContent = state.bestCombo;
    document.getElementById('r-mode').textContent = MODES[state.modeId]?.name || '—';
    const g = getGrade(acc);
    const ge = document.getElementById('grade-el');
    ge.textContent = g.label;
    ge.style.color = g.color;
    ge.style.textShadow = `0 0 30px ${g.color}`;
    if (currentUser && state.score > 0) submitScore({ score: Math.floor(state.score), acc, hits: state.hits, shots: state.shots, combo: state.bestCombo, mode: state.modeId, diff: state.diff, ts: Date.now() });
    document.getElementById('results-screen').classList.remove('hidden');
}

function getGrade(acc) {
    if (acc >= 90) return { label: 'S+', color: '#ffd700' };
    if (acc >= 75) return { label: 'A', color: '#00ff88' };
    if (acc >= 60) return { label: 'B', color: '#00e5ff' };
    if (acc >= 40) return { label: 'C', color: '#a259ff' };
    return { label: 'D', color: '#ff3d71' };
}

// ========== MENÚ DE MODOS ==========
function buildMenu() {
    const grid = document.getElementById('modes-grid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.values(MODES).forEach(m => {
        const card = document.createElement('div');
        card.className = 'mode-card' + (m.id === selMode ? ' selected' : '');
        card.dataset.id = m.id;
        card.innerHTML = `
            <div class="mode-prev"><canvas id="prev-${m.id}" width="200" height="60"></canvas></div>
            <div class="mode-info">
                <div class="m-tag" style="color:${m.color}">${m.tag}</div>
                <div class="m-name">${m.name}</div>
                <div class="m-desc">${m.desc}</div>
            </div>
        `;
        card.addEventListener('click', () => {
            selMode = m.id;
            window.selMode = selMode;   // <-- ACTUALIZAR VARIABLE GLOBAL
            document.querySelectorAll('.mode-card').forEach(c => c.classList.toggle('selected', c.dataset.id === m.id));
        });
        grid.appendChild(card);
    });
    animPrevs();
}

// Previews animados
function dp(id, fn) { prevFns[id] = fn; }
dp('clicking', (c, w, h, t) => {
    c.fillStyle = '#030608'; c.fillRect(0, 0, w, h);
    const targets = [{ x: 0.2, y: 0.4, r: 9 }, { x: 0.6, y: 0.6, r: 12 }, { x: 0.78, y: 0.25, r: 7 }];
    targets.forEach((tg, i) => {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t / 900 + i * 2));
        c.beginPath();
        c.arc(tg.x * w, tg.y * h, tg.r, 0, Math.PI * 2);
        c.fillStyle = `rgba(0,160,200,${0.25 * a})`;
        c.fill();
        c.strokeStyle = `rgba(0,229,255,${a})`;
        c.lineWidth = 2;
        c.stroke();
    });
});
dp('flicking', (c, w, h, t) => {
    c.fillStyle = '#030608'; c.fillRect(0, 0, w, h);
    const x = w * (0.15 + 0.7 * ((Math.sin(t / 800) + 1) / 2));
    const y = h * 0.5;
    c.beginPath();
    c.arc(x, y, 11, 0, Math.PI * 2);
    c.fillStyle = 'rgba(180,80,0,.25)'; c.fill();
    c.strokeStyle = 'rgba(255,149,0,.9)';
    c.lineWidth = 2;
    c.stroke();
});
dp('tracking', (c, w, h, t) => {
    c.fillStyle = '#030608'; c.fillRect(0, 0, w, h);
    const x = w * 0.5 + Math.cos(t / 1100) * w * 0.3;
    const y = h * 0.5 + Math.sin(t / 800) * h * 0.25;
    c.beginPath();
    c.arc(x, y, 14, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,180,80,.2)'; c.fill();
    c.strokeStyle = 'rgba(0,255,136,.9)';
    c.lineWidth = 2;
    c.stroke();
});
dp('micro', (c, w, h, t) => {
    c.fillStyle = '#030608'; c.fillRect(0, 0, w, h);
    const pts = [{ x: 0.25, y: 0.4 }, { x: 0.68, y: 0.3 }, { x: 0.5, y: 0.65 }, { x: 0.15, y: 0.65 }, { x: 0.82, y: 0.55 }];
    pts.forEach((p, i) => {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t / 700 + i));
        c.beginPath();
        c.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2);
        c.fillStyle = `rgba(180,0,60,${0.3 * a})`;
        c.fill();
        c.strokeStyle = `rgba(255,61,113,${a})`;
        c.lineWidth = 1.5;
        c.stroke();
    });
});
dp('strafing', (c, w, h, t) => {
    c.fillStyle = '#030608'; c.fillRect(0, 0, w, h);
    const x = w * 0.5 + Math.sin(t / 700) * w * 0.38;
    const y = h * 0.5;
    c.beginPath();
    c.arc(x, y, 12, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,170,0,.2)'; c.fill();
    c.strokeStyle = 'rgba(255,170,0,.9)';
    c.lineWidth = 2;
    c.stroke();
    // Flechas laterales
    c.beginPath();
    c.moveTo(10, h/2);
    c.lineTo(25, h/2-8);
    c.lineTo(25, h/2+8);
    c.fillStyle = '#ffaa44';
    c.fill();
    c.beginPath();
    c.moveTo(w-10, h/2);
    c.lineTo(w-25, h/2-8);
    c.lineTo(w-25, h/2+8);
    c.fill();
});
dp('survival', (c, w, h, t) => {
    c.fillStyle = '#030608'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + t / 2000;
        const x = w * 0.5 + Math.cos(ang) * w * 0.3;
        const y = h * 0.5 + Math.sin(ang) * h * 0.28;
        const a = 0.5 + 0.5 * Math.sin(t / 600 + i * 1.5);
        c.beginPath();
        c.arc(x, y, 8, 0, Math.PI * 2);
        c.fillStyle = `rgba(180,140,0,${0.2 * a})`;
        c.fill();
        c.strokeStyle = `rgba(255,215,0,${a})`;
        c.lineWidth = 2;
        c.stroke();
    }
});
dp('gridshot', (c, w, h, t) => {
    c.fillStyle = '#030608'; c.fillRect(0, 0, w, h);
    const act = Math.floor(t / 600) % 9;
    for (let r = 0; r < 3; r++) {
        for (let col = 0; col < 3; col++) {
            const idx = r * 3 + col;
            const x = (col + 0.5) * (w / 3);
            const y = (r + 0.5) * (h / 2);
            const hit = idx === act;
            c.beginPath();
            c.arc(x, y, 8, 0, Math.PI * 2);
            c.fillStyle = hit ? 'rgba(224,64,251,.35)' : 'rgba(50,20,80,.3)';
            c.fill();
            c.strokeStyle = hit ? 'rgba(224,64,251,1)' : 'rgba(100,60,140,.4)';
            c.lineWidth = hit ? 2 : 1;
            c.stroke();
        }
    }
});
dp('wide', (c, w, h, t) => {
    c.fillStyle = '#030608'; c.fillRect(0, 0, w, h);
    const pts = [{ x: 0.05, y: 0.5 }, { x: 0.95, y: 0.5 }, { x: 0.5, y: 0.05 }, { x: 0.5, y: 0.95 }];
    pts.forEach((p, i) => {
        const a = 0.5 + 0.5 * Math.abs(Math.sin(t / 800 + i * 1.5));
        c.beginPath();
        c.arc(p.x * w, p.y * h, 10, 0, Math.PI * 2);
        c.fillStyle = `rgba(255,100,40,${0.2 * a})`;
        c.fill();
        c.strokeStyle = `rgba(255,107,53,${a})`;
        c.lineWidth = 2;
        c.stroke();
    });
});
dp('humanoid', (c, w, h, t) => {
    c.fillStyle = '#060208'; c.fillRect(0, 0, w, h);
    const x = w * 0.5 + Math.sin(t / 900) * w * 0.38;
    const cy = h * 0.5;
    const sc = h * 0.014;
    // Cuerpo
    c.beginPath();
    c.roundRect(x - sc * 3, cy - sc * 8, sc * 6, sc * 10, sc);
    c.fillStyle = 'rgba(255,110,199,0.15)'; c.fill();
    c.strokeStyle = 'rgba(255,110,199,0.85)'; c.lineWidth = 1.5; c.stroke();
    // Cabeza
    c.beginPath();
    c.arc(x, cy - sc * 10.5, sc * 2.5, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,110,199,0.2)'; c.fill();
    c.strokeStyle = 'rgba(255,110,199,0.9)'; c.lineWidth = 1.5; c.stroke();
    // Piernas animadas
    const lg = Math.sin(t / 200) * sc * 2;
    c.strokeStyle = 'rgba(255,110,199,0.7)'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(x - sc, cy + sc * 2); c.lineTo(x - sc + lg, cy + sc * 7); c.stroke();
    c.beginPath(); c.moveTo(x + sc, cy + sc * 2); c.lineTo(x + sc - lg, cy + sc * 7); c.stroke();
    // Crosshair
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - 8, cy - sc * 4); c.lineTo(x + 8, cy - sc * 4); c.stroke();
    c.beginPath(); c.moveTo(x, cy - sc * 4 - 8); c.lineTo(x, cy - sc * 4 + 8); c.stroke();
    // Tracking ring
    c.beginPath(); c.arc(x, cy - sc * 4, 11, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,110,199,0.5)'; c.lineWidth = 1; c.stroke();
});

// ==================== HUMANOID STRAFE MODE ====================

function buildHumanoidScene() {
    // ---- OCULTAR el escenario de práctica normal ----
    setPracticeRoomVisible(false);
    setDefaultLightsVisible(false);

    // Limpiar objetos previos del humanoid si existen
    if (state.humanoid.sceneObjects) {
        state.humanoid.sceneObjects.forEach(o => scene.remove(o));
    }
    state.humanoid.sceneObjects = [];

    const add = (obj) => { scene.add(obj); state.humanoid.sceneObjects.push(obj); };

    // ---- CIELO azul claro estilo BloodStrike ----
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0xb0d8f0, 0.018);

    // ---- SUELO (baldosas) ----
    const floorGeo = new THREE.PlaneGeometry(60, 60, 20, 20);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.7;
    floor.receiveShadow = true;
    add(floor);

    // Grid de baldosas sobre el suelo
    const tileGrid = new THREE.GridHelper(60, 30, 0x666666, 0x777777);
    tileGrid.position.y = -1.69;
    add(tileGrid);

    // ---- PAREDES grises estilo BloodStrike ----
    const wallMatBS = new THREE.MeshLambertMaterial({ color: 0xb0b0b0 });

    // Pared trasera
    const wBack = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), wallMatBS);
    wBack.position.set(0, 4.3, -28);
    add(wBack);

    // Pared izquierda
    const wLeft = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), wallMatBS);
    wLeft.rotation.y = Math.PI / 2;
    wLeft.position.set(-28, 4.3, -4);
    add(wLeft);

    // Pared derecha
    const wRight = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), wallMatBS);
    wRight.rotation.y = -Math.PI / 2;
    wRight.position.set(28, 4.3, -4);
    add(wRight);

    // ---- CAJAS / cover estilo BloodStrike ----
    const boxMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    const concMat = new THREE.MeshLambertMaterial({ color: 0x999999 });

    const boxes = [
        { pos: [-8, -0.7, -18], size: [1.6, 2, 1.6], mat: boxMat },
        { pos: [8,  -0.7, -18], size: [1.6, 2, 1.6], mat: boxMat },
        { pos: [-4, -1.2, -22], size: [3, 1, 1.2],   mat: concMat },
        { pos: [4,  -1.2, -22], size: [3, 1, 1.2],   mat: concMat },
        { pos: [0,  -0.2, -26], size: [2, 3, 2],      mat: concMat },
    ];
    boxes.forEach(b => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(...b.size), b.mat);
        m.position.set(...b.pos);
        m.castShadow = true; m.receiveShadow = true;
        add(m);
    });

    // ---- LUCES estilo outdoor ----
    // Ambient fuerte (cielo abierto)
    const ambient = new THREE.AmbientLight(0xffffff, 1.4);
    add(ambient);

    // Luz direccional (sol)
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.8);
    sun.position.set(10, 20, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    add(sun);

    // Fill light sutil
    const fill = new THREE.DirectionalLight(0xc8e0ff, 0.5);
    fill.position.set(-8, 6, -10);
    add(fill);
}

function buildHumanoidMesh() {
    const group = new THREE.Group();

    // Materiales estilo soldado táctico BloodStrike
    const skinMat   = new THREE.MeshPhongMaterial({ color: 0xc68642, shininess: 20 });
    const uniformMat= new THREE.MeshPhongMaterial({ color: 0x3d4c2e, shininess: 30 }); // verde militar
    const gearMat   = new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 60 });
    const vestMat   = new THREE.MeshPhongMaterial({ color: 0x4a3728, shininess: 40 });  // marrón chaleco
    const helmetMat = new THREE.MeshPhongMaterial({ color: 0x3a3a28, shininess: 50 });  // verde oliva oscuro
    const bootMat   = new THREE.MeshPhongMaterial({ color: 0x1a1410, shininess: 80 });
    const gloveMat  = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 50 });
    const gunMetal  = new THREE.MeshPhongMaterial({ color: 0x1c1c1c, shininess: 100 });

    // === ESCALA REAL: humanoide de 1.75m ===
    // El grupo entero escala a tamaño de jugador real
    // base Y en suelo = -1.7 (misma que yawObj)

    // --- CABEZA ---
    const headGroup = new THREE.Group();
    // Cráneo
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 14), skinMat);
    headGroup.add(skull);
    // Casco táctico (cubre parte superior y lados)
    const helmetTop = new THREE.Mesh(new THREE.SphereGeometry(0.128, 16, 12), helmetMat);
    helmetTop.scale.y = 0.72;
    helmetTop.position.y = 0.035;
    headGroup.add(helmetTop);
    // Ala frontal del casco
    const helmetBrim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.08), helmetMat);
    helmetBrim.position.set(0, -0.02, 0.1);
    headGroup.add(helmetBrim);
    // Cara / balaclave
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), skinMat);
    face.position.set(0, -0.055, 0.1);
    headGroup.add(face);
    // Googles
    const gogGeo = new THREE.BoxGeometry(0.18, 0.055, 0.04);
    const gogMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 200, specular: 0x444444 });
    const gogs = new THREE.Mesh(gogGeo, gogMat);
    gogs.position.set(0, 0.01, 0.125);
    headGroup.add(gogs);
    // Correa de casco
    const strapMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.12, 0.005), strapMat);
    strap.position.set(0.09, -0.04, 0.06);
    headGroup.add(strap);

    // userData para headshot detection
    headGroup.userData.isHead = true;
    headGroup.position.y = 1.62; // altura de la cabeza desde base del grupo
    group.add(headGroup);

    // --- CUELLO ---
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.07, 8), skinMat);
    neck.position.y = 1.5;
    group.add(neck);

    // --- TORSO ---
    const torsoGroup = new THREE.Group();
    // Cuerpo base (uniforme)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.19), uniformMat);
    torsoGroup.add(torso);
    // Chaleco táctico
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.14), vestMat);
    vest.position.z = 0.025;
    torsoGroup.add(vest);
    // Placa balística frontal
    const bplate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.05), gearMat);
    bplate.position.set(0, 0.05, 0.1);
    torsoGroup.add(bplate);
    // Bolsillos MOLLE
    const mGeo = new THREE.BoxGeometry(0.07, 0.055, 0.038);
    [-0.1, 0.1].forEach(xOff => {
        [0.08, -0.04].forEach(yOff => {
            const m = new THREE.Mesh(mGeo, gearMat);
            m.position.set(xOff, yOff, 0.12);
            torsoGroup.add(m);
        });
    });
    // Cinturón táctico
    const beltM = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.21), gearMat);
    beltM.position.y = -0.26;
    torsoGroup.add(beltM);
    // Hebilla
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.025), new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 200 }));
    buckle.position.set(0, -0.26, 0.12);
    torsoGroup.add(buckle);

    torsoGroup.position.y = 1.15;
    group.add(torsoGroup);

    // --- CADERA ---
    const hipsM = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.18), uniformMat);
    hipsM.position.y = 0.88;
    group.add(hipsM);

    // --- BRAZO IZQUIERDO ---
    const armLGroup = new THREE.Group();
    // Hombro
    const shldL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), uniformMat);
    shldL.position.y = 0.14;
    armLGroup.add(shldL);
    // Bícep
    const upArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.29, 10), uniformMat);
    upArmL.position.y = -0.01;
    armLGroup.add(upArmL);
    // Codo
    const elL = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), gearMat);
    elL.position.y = -0.16;
    armLGroup.add(elL);
    // Antebrazo
    const foArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.26, 10), uniformMat);
    foArmL.position.y = -0.31;
    armLGroup.add(foArmL);
    // Guante
    const glL = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.055), gloveMat);
    glL.position.y = -0.46;
    armLGroup.add(glL);
    armLGroup.position.set(-0.215, 1.26, 0);
    armLGroup.rotation.z = 0.12;
    group.add(armLGroup);

    // --- BRAZO DERECHO (con arma) ---
    const armRGroup = new THREE.Group();
    const shldR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), uniformMat);
    shldR.position.y = 0.14;
    armRGroup.add(shldR);
    const upArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.29, 10), uniformMat);
    upArmR.position.y = -0.01;
    armRGroup.add(upArmR);
    const elR = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), gearMat);
    elR.position.y = -0.16;
    armRGroup.add(elR);
    const foArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.26, 10), uniformMat);
    foArmR.position.y = -0.31;
    armRGroup.add(foArmR);
    const glR = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.055), gloveMat);
    glR.position.y = -0.46;
    armRGroup.add(glR);

    // Arma (rifle táctico)
    const gunGroup2 = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.065, 0.36), gunMetal);
    gunGroup2.add(receiver);
    const barrelG = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), gunMetal);
    barrelG.rotation.x = Math.PI / 2;
    barrelG.position.set(0, 0.015, -0.28);
    gunGroup2.add(barrelG);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 0.18), gearMat);
    stock.position.set(0, -0.005, 0.22);
    gunGroup2.add(stock);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.038), gunMetal);
    mag.position.set(0, -0.075, 0.02);
    gunGroup2.add(mag);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), gearMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.05, -0.06);
    gunGroup2.add(scope);
    gunGroup2.position.set(0.04, -0.38, -0.12);
    gunGroup2.rotation.x = -0.3;
    armRGroup.add(gunGroup2);

    armRGroup.position.set(0.215, 1.26, 0);
    armRGroup.rotation.z = -0.12;
    armRGroup.rotation.x = 0.25;
    group.add(armRGroup);

    // --- PIERNA IZQUIERDA ---
    const legLGroup = new THREE.Group();
    const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.38, 10), uniformMat);
    legLGroup.add(thighL);
    // Bolsillo de muslo
    const tPocL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.052), gearMat);
    tPocL.position.set(-0.04, 0.04, 0.04);
    legLGroup.add(tPocL);
    const knL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), gearMat);
    knL.position.y = -0.21;
    legLGroup.add(knL);
    // Rodillera
    const kpadL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.04), gearMat);
    kpadL.position.set(0, -0.21, 0.05);
    legLGroup.add(kpadL);
    const shinLM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.36, 10), uniformMat);
    shinLM.position.y = -0.4;
    legLGroup.add(shinLM);
    const btL = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.085, 0.175), bootMat);
    btL.position.set(-0.01, -0.63, 0.025);
    legLGroup.add(btL);
    legLGroup.position.set(-0.095, 0.855, 0);
    group.add(legLGroup);

    // --- PIERNA DERECHA ---
    const legRGroup = new THREE.Group();
    const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.38, 10), uniformMat);
    legRGroup.add(thighR);
    const tPocR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.052), gearMat);
    tPocR.position.set(0.04, 0.04, 0.04);
    legRGroup.add(tPocR);
    const knR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), gearMat);
    knR.position.y = -0.21;
    legRGroup.add(knR);
    const kpadR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.04), gearMat);
    kpadR.position.set(0, -0.21, 0.05);
    legRGroup.add(kpadR);
    const shinRM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.36, 10), uniformMat);
    shinRM.position.y = -0.4;
    legRGroup.add(shinRM);
    const btR = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.085, 0.175), bootMat);
    btR.position.set(0.01, -0.63, 0.025);
    legRGroup.add(btR);
    legRGroup.position.set(0.095, 0.855, 0);
    group.add(legRGroup);

    // Sombra en el suelo
    const shadowGeo = new THREE.CircleGeometry(0.25, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    const shadow2D = new THREE.Mesh(shadowGeo, shadowMat);
    shadow2D.rotation.x = -Math.PI / 2;
    shadow2D.position.y = -1.695; // justo en el suelo
    group.add(shadow2D);
    group.userData.shadow2D = shadow2D;

    group.userData.parts = { headGroup, torsoGroup, armLGroup, armRGroup, legLGroup, legRGroup, hipsM };
    return group;
}

// Hitboxes separadas: cabeza y cuerpo para headshot
function buildHumanoidHitboxes(group) {
    // Hitbox de cuerpo completo
    const bodyHitGeo = new THREE.BoxGeometry(0.42, 1.4, 0.28);
    const bodyHitMat = new THREE.MeshBasicMaterial({ visible: false });
    const bodyHitbox = new THREE.Mesh(bodyHitGeo, bodyHitMat);
    bodyHitbox.position.y = 0.75;
    bodyHitbox.userData.zone = 'body';
    group.add(bodyHitbox);

    // Hitbox de cabeza (más pequeña, más difícil = más puntos)
    const headHitGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const headHitMat = new THREE.MeshBasicMaterial({ visible: false });
    const headHitbox = new THREE.Mesh(headHitGeo, headHitMat);
    headHitbox.position.y = 1.62;
    headHitbox.userData.zone = 'head';
    group.add(headHitbox);

    group.userData.bodyHitbox = bodyHitbox;
    group.userData.headHitbox = headHitbox;
}

function spawnHumanoidTarget() {
    if (!state.humanoid) return;
    const group = buildHumanoidMesh();
    buildHumanoidHitboxes(group);
    // Z=-10: ajustado para ver el humanoid a escala 2.2
    group.position.set(state.humanoid.x || 0, -1.7, -10);
    scene.add(group);
    if (state.humanoid.sceneObjects) state.humanoid.sceneObjects.push(group);
    state.humanoid.mesh = group;
    state.humanoid.parts = group.userData.parts;
    state.humanoid.groundY = -1.7;

    group.scale.set(0.01, 0.01, 0.01);
    let sa = 0;
    const si = () => {
        sa += 0.025;
        const s = Math.min(2.2, sa / 0.15 * 2.2);  // escala final = 2.2 (tamaño real BloodStrike)
        group.scale.set(s, s, s);
        if (s < 2.2) requestAnimationFrame(si);
    };
    requestAnimationFrame(si);

    // Barra de HP del humanoid en HUD
    _humanoidUpdateHPBar();
}

const HMN_BOUNDS = { left: -5, right: 5 };  // más estrecho por estar más cerca
const HMN_JUMP_FORCE = 5.2;
const HMN_GRAVITY   = -14;
const HMN_DISTANCE_Z = -10;

function updateHumanoid(dt) {
    if (!state.running || !state.humanoid || !state.humanoid.mesh) return;
    const h = state.humanoid;
    const elapsed = (performance.now() - h.startTime) / 1000;

    // Progresión de velocidad
    h.speedMultiplier = Math.min(3.2, 1.0 + elapsed / 22);
    const baseSpeed = 2.2 * DIFF[state.diff].speed * CFG.tgt.speedMult * h.speedMultiplier;

    // --- PAUSA entre direcciones ---
    if (h.pauseTimer > 0) {
        h.pauseTimer -= dt;
        if (h.pauseTimer <= 0) {
            h.isPaused = false;
            h.dir = Math.random() > 0.5 ? 1 : -1;
            h.speed = baseSpeed * (0.55 + Math.random() * 0.9);
        }
    }

    // --- MICRO-ACELERACIONES (después de 12s) ---
    if (h.microAccelTimer > 0) {
        h.microAccelTimer -= dt;
        if (h.microAccelTimer <= 0) h.microAccelActive = false;
    }
    if (!h.microAccelActive && Math.random() < 0.004 * dt * 60 && elapsed > 12) {
        h.microAccelActive = true;
        h.microAccelTimer = 0.12 + Math.random() * 0.22;
        h.speed = Math.min(baseSpeed * 2.6, h.speed * (1.9 + Math.random()));
    }

    // --- CAMBIO ESPONTÁNEO DE DIRECCIÓN ---
    if (!h.isPaused && Math.random() < 0.007 * dt * 60) {
        h.dir *= -1;
        h.speed = baseSpeed * (0.5 + Math.random() * 1.1);
    }

    // --- MOVIMIENTO LATERAL ---
    if (!h.isPaused) {
        h.x += h.dir * h.speed * dt;
        if (h.x > HMN_BOUNDS.right) {
            h.x = HMN_BOUNDS.right;
            h.isPaused = true;
            h.pauseTimer = 0.06 + Math.random() * 0.2;
            h.dir = -1;
        } else if (h.x < HMN_BOUNDS.left) {
            h.x = HMN_BOUNDS.left;
            h.isPaused = true;
            h.pauseTimer = 0.06 + Math.random() * 0.2;
            h.dir = 1;
        }
    }

    // --- SALTOS ---
    h.jumpTimer -= dt;
    if (h.isGrounded && h.jumpTimer <= 0 && Math.random() < 0.018 * dt * 60) {
        h.velY = HMN_JUMP_FORCE * (0.8 + Math.random() * 0.4);
        h.isGrounded = false;
        h.jumpTimer = 2.5 + Math.random() * 3.0; // espera mínima entre saltos
    }

    // Física vertical
    if (!h.isGrounded) {
        h.velY += HMN_GRAVITY * dt;
        h.y += h.velY * dt;
        if (h.y <= 0) {
            h.y = 0;
            h.velY = 0;
            h.isGrounded = true;
        }
    }

    // Aplicar posición al mesh
    h.mesh.position.x = h.x;
    h.mesh.position.y = (h.groundY || -1.7) + h.y;
    h.mesh.position.z = HMN_DISTANCE_Z;

    // Actualizar sombra (se aplana cuando está en el aire)
    if (h.mesh.userData.shadow2D) {
        const shadowScale = Math.max(0.4, 1.0 - h.y * 0.15);
        h.mesh.userData.shadow2D.scale.set(shadowScale, shadowScale, shadowScale);
        h.mesh.userData.shadow2D.position.y = -1.695 - h.mesh.position.y + (h.groundY || -1.7);
    }

    // Rotación hacia dirección de movimiento
    const targetRot = h.isPaused ? h.mesh.rotation.y : (h.dir > 0 ? 0.12 : -0.12);
    h.mesh.rotation.y += (targetRot - h.mesh.rotation.y) * dt * 7;

    // --- ANIMACIÓN DE CAMINADO ---
    const walkCycle = performance.now() / 1000;
    const walkSpd = (!h.isPaused && h.isGrounded) ? Math.min(7, h.speed * 1.3) : (h.isGrounded ? 0 : 3);
    const inAir = !h.isGrounded;
    const legSwing = inAir ? 0.45 : Math.sin(walkCycle * walkSpd) * 0.32;
    const armSwing = inAir ? -0.5 : Math.sin(walkCycle * walkSpd + Math.PI) * 0.26;
    const bodyBob  = inAir ? 0 : Math.abs(Math.sin(walkCycle * walkSpd)) * 0.022;
    const jumpLean = inAir ? (h.velY > 0 ? -0.2 : 0.1) : 0;

    if (h.parts) {
        h.parts.legLGroup.rotation.x = legSwing;
        h.parts.legRGroup.rotation.x = -legSwing;
        h.parts.armLGroup.rotation.x = armSwing;
        h.parts.armRGroup.rotation.x = -armSwing;
        h.parts.torsoGroup.position.y = 1.15 + bodyBob;
        h.parts.torsoGroup.rotation.x = jumpLean;
        h.parts.headGroup.position.y = 1.62 + bodyBob * 0.6;
    }
}

// ---- SISTEMA DE DISPARO HUMANOID ----
function humanoidShoot() {
    if (!state.running || !locked) return;
    if (state.modeId !== 'humanoid') return;
    if (!state.humanoid || !state.humanoid.mesh) return;

    playGunshot();
    triggerShoot();
    const ch = document.getElementById('crosshair');
    ch.classList.add('shoot');
    setTimeout(() => ch.classList.remove('shoot'), 100);

    state.shots++;

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const h = state.humanoid;
    const headHitbox = h.mesh.userData.headHitbox;
    const bodyHitbox = h.mesh.userData.bodyHitbox;

    // Headshot primero (hitbox más prioritaria)
    const headHits = headHitbox ? raycaster.intersectObject(headHitbox, false) : [];
    if (headHits.length > 0) {
        // HEADSHOT
        h.hits++;
        h.headshots++;
        state.hits++;
        state.combo++;
        if (state.combo > state.bestCombo) state.bestCombo = state.combo;
        const pts = 250 + Math.min(state.combo, 10) * 20;
        state.score += pts;
        playHitSound();
        showHitFlash();
        _humanoidShowDamage(pts, true, headHitbox.getWorldPosition(new THREE.Vector3()));
        _humanoidHurt(h, 40);
        updateHUD();
        return;
    }

    // Bodyshot
    const bodyHits = bodyHitbox ? raycaster.intersectObject(bodyHitbox, false) : [];
    if (bodyHits.length > 0) {
        h.hits++;
        state.hits++;
        state.combo++;
        if (state.combo > state.bestCombo) state.bestCombo = state.combo;
        const pts = 100 + Math.min(state.combo, 10) * 10;
        state.score += pts;
        playHitSound();
        showHitFlash();
        _humanoidShowDamage(pts, false, bodyHitbox.getWorldPosition(new THREE.Vector3()));
        _humanoidHurt(h, 20);
        updateHUD();
        return;
    }

    // Miss
    state.combo = 0;
    document.getElementById('combo-disp').classList.remove('show');
    playMissSound();
    updateHUD();
}

// Flash rojo en el humanoid al recibir daño
function _humanoidHurt(h, dmg) {
    if (!h.mesh) return;
    h.hp = Math.max(0, h.hp - dmg);
    _humanoidUpdateHPBar();

    // Parpadeo rojo
    h.mesh.traverse(child => {
        if (child.isMesh && child.material && child.material.color) {
            const origColor = child.material.color.clone();
            child.material.emissive = new THREE.Color(0xff0000);
            child.material.emissiveIntensity = 0.8;
            setTimeout(() => {
                if (child.material) {
                    child.material.emissive = new THREE.Color(0x000000);
                    child.material.emissiveIntensity = 0;
                }
            }, 120);
        }
    });

    // Si llega a 0 HP — respawn del humanoid
    if (h.hp <= 0) {
        scene.remove(h.mesh);
        h.mesh = null;
        h.hp = h.maxHp;
        h.x = (Math.random() - 0.5) * 12;
        h.y = 0;
        h.velY = 0;
        h.isGrounded = true;
        setTimeout(() => {
            if (state.running && state.modeId === 'humanoid') spawnHumanoidTarget();
        }, 600);
    }
}

function _humanoidUpdateHPBar() {
    const h = state.humanoid;
    if (!h) return;
    const pct = Math.round((h.hp / h.maxHp) * 100);
    // Usar el HUD de accuracy para mostrar la HP del bot
    document.getElementById('acc-pct').textContent = pct + '%';
    document.getElementById('acc-fill').style.width = pct + '%';
    document.getElementById('acc-fill').style.background = pct > 50 ? 'var(--green)' : pct > 25 ? '#ffd700' : 'var(--accent2)';
}

function _humanoidShowDamage(pts, isHead, worldPos) {
    if (!CFG.vis.pts) return;
    const v = worldPos.clone().project(camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-0.5 * v.y + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.textContent = (isHead ? '💀 ' : '') + '+' + pts;
    const color = isHead ? '#ffd700' : '#ff6ec7';
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-family:Orbitron,monospace;font-weight:900;font-size:${isHead ? '1.3' : '1'}rem;color:${color};text-shadow:0 0 12px ${color};pointer-events:none;z-index:60;transform:translate(-50%,-50%);animation:float-up .8s ease-out forwards;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);

    // Combo visual para headshot
    if (isHead && CFG.vis.combo) {
        document.getElementById('combo-num').textContent = '💀 HS!';
        document.getElementById('combo-disp').classList.add('show');
        clearTimeout(state.comboT);
        state.comboT = setTimeout(() => document.getElementById('combo-disp').classList.remove('show'), 1200);
    } else if (state.combo >= 2 && CFG.vis.combo) {
        document.getElementById('combo-num').textContent = state.combo;
        document.getElementById('combo-disp').classList.add('show');
        clearTimeout(state.comboT);
        state.comboT = setTimeout(() => document.getElementById('combo-disp').classList.remove('show'), 1400);
    }
}

// ==================== FIN HUMANOID STRAFE ====================

function animPrevs() {
    const t = performance.now();
    Object.keys(prevFns).forEach(id => {
        const cv = document.getElementById('prev-' + id);
        if (cv) prevFns[id](cv.getContext('2d'), cv.width, cv.height, t);
    });
    requestAnimationFrame(animPrevs);
}

// ========== MANEJADORES DE MOVIMIENTO (teclas A/D) ==========
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a') strafeKeys.a = true;
    if (key === 'd') strafeKeys.d = true;
});
document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a') strafeKeys.a = false;
    if (key === 'd') strafeKeys.d = false;
});

// ========== MANEJADORES DE RATÓN Y PAUSA ==========
document.addEventListener('mousemove', e => {
    if (state && state.running && !paused && locked) {
        mouseDX += e.movementX;
        mouseDY += e.movementY;
    }
});

document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === document.getElementById('three-canvas');
    if (locked) {
        document.getElementById('lock-overlay').style.display = 'none';
        if (paused) hidePause();
        if (!state.timerStarted && state.running) beginTimerAndSpawn();
    } else if (state && state.running) {
        if (!state.timerStarted) document.getElementById('lock-overlay').style.display = 'flex';
        else showPause();
    }
});

function showPause() {
    paused = true;
    if (state.timerIv) { clearInterval(state.timerIv); state.timerIv = null; }
    if (state.spawnIv) { clearInterval(state.spawnIv); state.spawnIv = null; }
    document.getElementById('pause-mode-name').textContent = MODES[state.modeId]?.name || '—';
    document.getElementById('pause-overlay').style.display = 'flex';
    document.getElementById('mobile-controls').classList.remove('active');
    document.getElementById('crosshair').style.display = 'none';
}

function hidePause() {
    paused = false;
    document.getElementById('pause-overlay').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    if (mobileMode) document.getElementById('mobile-controls').classList.add('active');
    if (state.running && state.timerStarted) {
        if (state.modeId === 'survival') startSurvivalTimer();
        else startTimer();
        if (state.modeId !== 'tracking' && state.modeId !== 'strafing' && state.modeId !== 'humanoid' && state.modeId !== 'gridshot') startSpawner3D();
    }
}

// ========== EXPOSICIÓN ==========
window.initThree = initThree;
window.startGame = startGame;
window.updateRoomColor = updateRoomColor;
window.buildMenu = buildMenu;
window.animPrevs = animPrevs;
window.selMode = selMode;
window.selDiff = selDiff;
window.paused = paused;
