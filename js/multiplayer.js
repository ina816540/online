// ============================================================
// MULTIJUGADOR ONLINE (WebSocket, salas, partidas 1v1/2v2/etc)
// ============================================================

let onWS = null, onMySlot = -1, onMyTeam = -1, onMySpawn = null, onMyName = '';
let onRoomMode = '1v1', onFirstTo = 6;
let onActive = false, onLocked = false, onAlive = true;
let onPos = { x: 0, z: 0 }, onYaw = 0, onPitch = 0;
const onOpps = new Map(), onPlayerNames = new Map();
let onTeamScores = [0, 0], onPScores = {};
let onCreateMode = '1v1', onWaitPlayers = [];
let onPing = 0, onPingIv = null, onReconnectT = null;
let onThreeReady = false, onAnimId = null, onStateIv = null;
let onCanShoot = true;
const onKeys = {};
let onMX = 0, onMY = 0;
const ON_H = 1.65, ON_SPD = 7.5, ON_SENS = 0.002, ON_CD = 1500;
const ON_GRAVITY = 22, ON_JUMP_FORCE = 8.0;
let onVelY = 0, onPosY = 0, onIsGrounded = true;
let onScene, onCamera, onRenderer, onRaycaster, onYawObj, onPitchObj, onGun, onGunAnim = 0;
let onWalls = [], onObs = [];
let onCurWeapon = 'pistol';
let onAmmo = { pistol: 12, rifle: 30, shotgun: 6 };
let onReloading = false, onReloadT = null;
let onMyHP = 100;
let onGrenades = 2, onGrenCooldown = false;
const onGrenList = [];
let onCamShake = 0;

// Armas
const WEAPONS = {
    pistol: { name: 'PISTOLA', key: '1', dmgHead: 50, dmgBody: 25, dmgLegs: 15, cd: 900, spread: 0, ammoMax: 12, reload: 1600, pellets: 1, color: 0x999999 },
    rifle: { name: 'RIFLE', key: '2', dmgHead: 50, dmgBody: 25, dmgLegs: 15, cd: 140, spread: 0.012, ammoMax: 30, reload: 2000, pellets: 1, color: 0x334455 },
    shotgun: { name: 'ESCOPETA', key: '3', dmgHead: 50, dmgBody: 25, dmgLegs: 15, cd: 850, spread: 0.09, ammoMax: 6, reload: 2400, pellets: 7, color: 0x553322 }
};

window.WEAPONS = WEAPONS;

// Configuración de servidor WebSocket (se reemplaza en tiempo de ejecución con la URL correcta)
window.ONLINE_SRV = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;

// Colores de equipos
window.TEAM_COLORS = [0xff4444, 0x4488ff, 0x44cc66, 0xffcc00, 0xcc44ff, 0x44cccc, 0xff8844, 0x88ff44];
window.TEAM_HEX = ['#ff4444', '#4488ff', '#44cc66', '#ffcc00', '#cc44ff', '#44cccc', '#ff8844', '#88ff44'];
window.TEAM_LBL = ['ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'MORADO', 'CYAN', 'NARANJA', 'LIMA'];

// ------------------------------------------------------------------
// Funciones de inicialización de Three.js (mapa multijugador)
// ------------------------------------------------------------------
function onInitThree() {
    const cv = document.getElementById('duel-canvas');
    onRenderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    onRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    onRenderer.setSize(window.innerWidth, window.innerHeight);
    onRenderer.shadowMap.enabled = true;
    onScene = new THREE.Scene();
    onYawObj = new THREE.Object3D();
    onPitchObj = new THREE.Object3D();
    onYawObj.add(onPitchObj);
    onScene.add(onYawObj);
    onCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 200);
    onPitchObj.add(onCamera);
    onRaycaster = new THREE.Raycaster();
    onRaycaster.far = 150;
    window.addEventListener('resize', () => {
        onCamera.aspect = window.innerWidth / window.innerHeight;
        onCamera.updateProjectionMatrix();
        onRenderer.setSize(window.innerWidth, window.innerHeight);
    });
    onBuildMap();
    onBuildLights();
    onBuildGun();
    onThreeReady = true;
}

function onBuildLights() {
    onScene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const sun = new THREE.DirectionalLight(0xfff4cc, 1.3);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
    onScene.add(sun);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(-10, 10, -15);
    onScene.add(fill);
}

function onBuildGun() {
    if (onGun) {
        onCamera.remove(onGun);
        onGun = null;
    }
    onGun = new THREE.Group();
    const wp = WEAPONS[onCurWeapon];
    const m1 = new THREE.MeshLambertMaterial({ color: 0x1a1a2a });
    const m2 = new THREE.MeshLambertMaterial({ color: 0x0a0a0f });
    const m4 = new THREE.MeshLambertMaterial({ color: 0x333348 });
    const mAcc = new THREE.MeshLambertMaterial({ color: wp.color, emissive: wp.color, emissiveIntensity: 0.5 });
    if (onCurWeapon === 'pistol') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.4), m1);
        onGun.add(body);
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.36), m4);
        slide.position.set(0, 0.065, -0.01);
        onGun.add(slide);
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.18), m2);
        barrel.position.set(0, 0.03, -0.29);
        onGun.add(barrel);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.034, 0.04), m2);
        tip.position.set(0, 0.03, -0.39);
        onGun.add(tip);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.12, 0.065), m1);
        handle.position.set(0, -0.1, 0.06);
        handle.rotation.x = 0.2;
        onGun.add(handle);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.067, 0.007, 0.18), mAcc);
        stripe.position.set(0, 0.048, 0.0);
        onGun.add(stripe);
        onGun.position.set(0.19, -0.19, -0.33);
        onGun.rotation.y = 0.05;
    } else if (onCurWeapon === 'rifle') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.65), m1);
        onGun.add(body);
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.55), m4);
        top.position.set(0, 0.055, 0);
        onGun.add(top);
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.3), m2);
        barrel.position.set(0, 0.02, -0.47);
        onGun.add(barrel);
        const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.06), m2);
        muzzle.position.set(0, 0.02, -0.63);
        onGun.add(muzzle);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.18), m4);
        stock.position.set(0, -0.01, 0.36);
        stock.rotation.x = 0.05;
        onGun.add(stock);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 0.065), m1);
        handle.position.set(0, -0.1, 0.12);
        handle.rotation.x = 0.18;
        onGun.add(handle);
        const scope = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.2), mAcc);
        scope.position.set(0, 0.075, 0.05);
        onGun.add(scope);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.055), m2);
        mag.position.set(0, -0.06, 0.07);
        onGun.add(mag);
        onGun.position.set(0.2, -0.18, -0.42);
        onGun.rotation.y = 0.04;
    } else if (onCurWeapon === 'shotgun') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), m1);
        onGun.add(body);
        const barrel1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.028, 0.38), m2);
        barrel1.position.set(-0.022, 0.01, -0.34);
        onGun.add(barrel1);
        const barrel2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.028, 0.38), m2);
        barrel2.position.set(0.022, 0.01, -0.34);
        onGun.add(barrel2);
        const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.07), m2);
        muzzle.position.set(0, 0.01, -0.57);
        onGun.add(muzzle);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.085, 0.22), mAcc);
        stock.position.set(0, -0.01, 0.3);
        onGun.add(stock);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.07), m1);
        handle.position.set(0, -0.1, 0.08);
        handle.rotation.x = 0.2;
        onGun.add(handle);
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.055, 0.14), m4);
        pump.position.set(0, -0.018, -0.12);
        onGun.add(pump);
        onGun.position.set(0.2, -0.2, -0.38);
        onGun.rotation.y = 0.05;
    }
    onCamera.add(onGun);
}

function onRebuildGunMesh() {
    if (!onGun || !onCamera) return;
    onCamera.remove(onGun);
    onGun = null;
    onBuildGun();
}

function onAnimGun(dt) {
    if (!onGun) return;
    if (onGunAnim > 0) {
        onGunAnim = Math.max(0, onGunAnim - dt * 9);
        onGun.position.z = -0.33 + onGunAnim * 0.06;
        onGun.rotation.x = onGunAnim * 0.12;
    } else {
        onGun.position.z += (-0.33 - onGun.position.z) * dt * 9;
        onGun.rotation.x *= (1 - dt * 9);
    }
    onGun.position.y = -0.19 + Math.sin(performance.now() * 0.0009) * 0.003;
}

// ------------------------------------------------------------------
// Funciones de mapa (onBuildMap)
// ------------------------------------------------------------------
function onBuildMap() {
    // Limpiar objetos anteriores
    const toRemove = [];
    onScene.children.forEach(c => { if (c.userData.isMapObj) toRemove.push(c); });
    toRemove.forEach(c => onScene.remove(c));
    onWalls.length = 0;
    onObs.length = 0;

    // Restaurar cielo/niebla PVP
    onScene.background = new THREE.Color(0x87ceeb);
    onScene.fog = new THREE.Fog(0x87ceeb, 30, 75);

    // Suelo: tierra con caminos, césped y logo INA
    const gc = document.createElement('canvas');
    gc.width = gc.height = 1024;
    const gx = gc.getContext('2d');
    gx.fillStyle = '#8B6914';
    gx.fillRect(0, 0, 1024, 1024);
    gx.fillStyle = '#4a7c3f';
    const grassPatches = [
        [0,0,220,220], [804,0,220,220], [0,804,220,220], [804,804,220,220],
        [200,350,120,80], [650,600,110,90], [300,700,90,70], [700,280,80,90]
    ];
    grassPatches.forEach(([x,y,w,h]) => gx.fillRect(x,y,w,h));
    gx.fillStyle = '#a07830';
    gx.fillRect(400,0,224,1024);
    gx.fillRect(0,400,1024,224);
    gx.save();
    gx.globalAlpha = 0.18;
    gx.font = 'bold 160px Arial Black';
    gx.textAlign = 'center';
    gx.textBaseline = 'middle';
    gx.fillStyle = '#fff';
    gx.fillText('INA', 512, 512);
    gx.restore();
    gx.strokeStyle = '#555555';
    gx.lineWidth = 40;
    gx.beginPath();
    gx.ellipse(512, 512, 490, 490, 0, 0, Math.PI * 2);
    gx.stroke();
    const groundTex = new THREE.CanvasTexture(gc);
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(1, 1);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshLambertMaterial({ map: groundTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.isMapObj = true;
    onScene.add(ground);

    // Materiales
    const concMat = new THREE.MeshLambertMaterial({ color: 0xaab0b8 });
    const concDark = new THREE.MeshLambertMaterial({ color: 0x8a9098 });
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xc8a86a });
    const barrelR = new THREE.MeshLambertMaterial({ color: 0xcc2200 });
    const barrelB = new THREE.MeshLambertMaterial({ color: 0x1144cc });
    const barrelG = new THREE.MeshLambertMaterial({ color: 0x226622 });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B6020 });
    const coneMat = new THREE.MeshLambertMaterial({ color: 0xff6600 });

    function addConcreteWall(x, z, w, h, d, ry = 0) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concMat);
        wall.position.set(x, h / 2, z);
        wall.rotation.y = ry;
        wall.castShadow = true;
        wall.receiveShadow = true;
        onScene.add(wall);
        onWalls.push(wall);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.15, d + 0.1), concDark);
        cap.position.set(x, h + 0.075, z);
        cap.rotation.y = ry;
        onScene.add(cap);
        const hw = ry !== 0 ? (d / 2 + 0.45) : (w / 2 + 0.45);
        const hd = ry !== 0 ? (w / 2 + 0.45) : (d / 2 + 0.45);
        onObs.push({ x, z, hw, hd });
    }

    function addSandbagWall(x, z, len, ry = 0) {
        const H = 0.7, D = 0.55;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(len, H, D), sandMat);
        wall.position.set(x, H / 2, z);
        wall.rotation.y = ry;
        wall.castShadow = true;
        onScene.add(wall);
        const hw = ry !== 0 ? (D / 2 + 0.35) : (len / 2 + 0.35);
        const hd = ry !== 0 ? (len / 2 + 0.35) : (D / 2 + 0.35);
        onObs.push({ x, z, hw, hd });
        const nb = Math.floor(len / 0.9);
        for (let i = 0; i < nb; i++) {
            const bx = (i - (nb - 1) / 2) * 0.9;
            const bag = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.38, 0.5), sandMat);
            const cos_r = Math.cos(ry), sin_r = Math.sin(ry);
            bag.position.set(x + cos_r * bx, H / 2 + 0.22, z + sin_r * bx);
            bag.rotation.y = ry;
            onScene.add(bag);
        }
    }

    function addBarrel(x, z, mat) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 10), mat);
        b.position.set(x, 0.35, z);
        b.castShadow = true;
        onScene.add(b);
        onObs.push({ x, z, hw: 0.55, hd: 0.55 });
    }

    function addCrate(x, z, s = 1) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 0.8 * s, 0.8 * s), woodMat);
        c.position.set(x, 0.4 * s, z);
        c.castShadow = true;
        onScene.add(c);
        const lines = new THREE.EdgesGeometry(c.geometry);
        const lm = new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ color: 0x5a3a00 }));
        lm.position.copy(c.position);
        onScene.add(lm);
        onObs.push({ x, z, hw: 0.6 * s, hd: 0.6 * s });
    }

    function addCone(x, z) {
        const g = new THREE.ConeGeometry(0.18, 0.55, 8);
        const c = new THREE.Mesh(g, coneMat);
        c.position.set(x, 0.275, z);
        onScene.add(c);
    }

    // Paredes de concreto centrales
    addConcreteWall(-1, -7, 5.5, 1.8, 0.5);
    addConcreteWall(5, -7, 4.0, 1.8, 0.5);
    addConcreteWall(-1, -4.5, 0.5, 1.8, 4.5, 0);
    addConcreteWall(-7, -1, 4.5, 1.8, 0.5);
    addConcreteWall(-7, 2, 0.5, 1.8, 4.0, 0);
    addConcreteWall(7, 0, 4.5, 1.8, 0.5);
    addConcreteWall(7, -3, 0.5, 1.8, 3.5, 0);
    addConcreteWall(0, 7, 5.5, 1.8, 0.5);
    addConcreteWall(-2.5, 5, 0.5, 1.8, 3.5, 0);
    addConcreteWall(2.5, 5, 0.5, 1.8, 3.5, 0);
    addConcreteWall(2, -1, 3.5, 1.8, 0.5);
    addConcreteWall(-3, 2, 3.5, 1.8, 0.5);

    // Sacos de arena perimetrales
    addSandbagWall(-14, -13, 4.5);
    addSandbagWall(-16, -11, 3.5, Math.PI / 2);
    addSandbagWall(-12, -15, 3.0);
    addSandbagWall(14, -13, 4.5);
    addSandbagWall(16, -11, 3.5, Math.PI / 2);
    addSandbagWall(12, -15, 3.0);
    addSandbagWall(-14, 14, 4.0);
    addSandbagWall(-16, 12, 3.0, Math.PI / 2);
    addSandbagWall(-12, 16, 3.5);
    addSandbagWall(14, 14, 4.0);
    addSandbagWall(16, 12, 3.0, Math.PI / 2);
    addSandbagWall(12, 16, 3.5);
    addSandbagWall(-17, 0, 5.0, Math.PI / 2);
    addSandbagWall(17, 0, 5.0, Math.PI / 2);
    addSandbagWall(0, -18, 5.0);
    addSandbagWall(0, 18, 5.0);

    // Barriles
    addBarrel(-16, -14, barrelR);
    addBarrel(-15, -13, barrelR);
    addBarrel(-14, -14, barrelG);
    addBarrel(16, 14, barrelB);
    addBarrel(15, 13, barrelB);
    addBarrel(14, 14, barrelG);
    addBarrel(10, -10, barrelG);
    addBarrel(-10, 10, barrelR);
    addBarrel(4, 4, barrelB);
    addBarrel(-4, -4, barrelG);
    addBarrel(12, 2, barrelR);
    addBarrel(-12, -2, barrelB);
    addBarrel(8, -15, barrelG);
    addBarrel(-8, 15, barrelR);

    // Cajas
    addCrate(-13, -13);
    addCrate(-12, -11);
    addCrate(-11, -13, 1.2);
    addCrate(13, 13);
    addCrate(12, 11);
    addCrate(11, 13, 1.2);
    addCrate(14, -8);
    addCrate(13, -7);
    addCrate(-14, 8);
    addCrate(-13, 7);
    addCrate(8, 8);
    addCrate(-8, -8);
    addCrate(16, 4);
    addCrate(15, 5);

    // Conos naranja
    addCone(-2, -3);
    addCone(2, -3);
    addCone(0, 0);
    addCone(-4, 0);
    addCone(4, 2);
    addCone(-1, 4);

    // Techo camuflaje
    const camGeo = new THREE.PlaneGeometry(5, 4);
    const camMat = new THREE.MeshLambertMaterial({ color: 0x3d5a2a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const cam = new THREE.Mesh(camGeo, camMat);
    cam.rotation.x = -Math.PI / 2;
    cam.position.set(-14, 1.8, 14);
    onScene.add(cam);
    [[-.13, 14, 2.1], [.13, 14, 2.1], [-14, -.13, 2.1], [-14, .13, 2.1]].forEach(([dx, dz, h]) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 6), new THREE.MeshLambertMaterial({ color: 0x4a3010 }));
        p.position.set(-14 + dx, h / 2, 14 + dz);
        onScene.add(p);
    });

    // Bases roja y azul
    function addBuilding(cx, cz, color, team) {
        const mat = new THREE.MeshLambertMaterial({ color });
        const dmat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.3) });
        const roofmat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.7) });
        const body = new THREE.Mesh(new THREE.BoxGeometry(5, 2.8, 4.5), mat);
        body.position.set(cx, 1.4, cz);
        body.castShadow = true;
        body.receiveShadow = true;
        onScene.add(body);
        onWalls.push(body);
        onObs.push({ x: cx, z: cz, hw: 3.0, hd: 2.7 });
        const roof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.2, 4.9), roofmat);
        roof.position.set(cx, 2.9, cz);
        onScene.add(roof);
        const stepMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
        for (let i = 0; i < 3; i++) {
            const fz = team === 'red' ? cz + 2.25 + i * 0.3 : cz - 2.25 - i * 0.3;
            const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15 + i * 0.1, 0.35), stepMat);
            step.position.set(cx, 0.075 + i * 0.1, fz);
            onScene.add(step);
        }
        const fz = team === 'red' ? cz + 2.26 : cz - 2.26;
        [-1.5, 1.5].forEach(ox => {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.08), dmat);
            win.position.set(cx + ox, 1.8, fz);
            onScene.add(win);
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.06), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
            frame.position.set(cx + ox, 1.8, fz);
            onScene.add(frame);
        });
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.08), dmat);
        door.position.set(cx, 0.8, fz);
        onScene.add(door);
        const sandMat2 = new THREE.MeshLambertMaterial({ color: 0xc8a86a });
        [[-2.2, 0, 3.5], [2.2, 0, 3.5], [0, -2, 3.5], [0, 2, 3.5]].forEach(([ox, oz, len]) => {
            const ry = Math.abs(oz) > 0.5 ? Math.PI / 2 : 0;
            const sb = new THREE.Mesh(new THREE.BoxGeometry(ry ? 0.5 : len, 0.6, ry ? len : 0.5), sandMat2);
            sb.position.set(cx + ox, 0.3, cz + oz * (team === 'red' ? -1 : 1));
            onScene.add(sb);
        });
    }
    addBuilding(-16, -16, 0xdd3311, 'red');
    addBuilding(16, 16, 0x1155cc, 'blue');

    // Borde del mapa (invisible)
    [{ x: 0, z: -21, w: 44, d: 0.6 }, { x: 0, z: 21, w: 44, d: 0.6 }, { x: -21, z: 0, w: 0.6, d: 44 }, { x: 21, z: 0, w: 0.6, d: 44 }].forEach(({ x, z, w, d }) => {
        onObs.push({ x, z, hw: w / 2, hd: d / 2 });
    });

    // Árboles decorativos
    [[-19, -19], [19, -19], [-19, 19]].forEach(([tx, tz]) => {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.5, 8), new THREE.MeshLambertMaterial({ color: 0x4a2e08 }));
        trunk.position.set(tx, 0.75, tz);
        onScene.add(trunk);
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshLambertMaterial({ color: 0x2d6e1a }));
        leaves.position.set(tx, 2.5, tz);
        onScene.add(leaves);
    });
}

// ------------------------------------------------------------------
// Funciones de personaje y animación
// ------------------------------------------------------------------
function onCreateRobloxChar(teamColor) {
    const g = new THREE.Group();
    const col = new THREE.Color(teamColor);
    const mat = new THREE.MeshPhongMaterial({ color: teamColor, shininess: 25 });
    const dark = new THREE.MeshPhongMaterial({ color: col.clone().multiplyScalar(0.5), shininess: 15 });
    const skin = new THREE.MeshPhongMaterial({ color: 0xffcc99 });
    const shoe = new THREE.MeshPhongMaterial({ color: 0x111111 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skin);
    head.position.y = 1.62;
    head.castShadow = true;
    g.add(head);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x111122 });
    [-1, 1].forEach(sx => {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.02), eyeM);
        e.position.set(sx * 0.12, 1.65, 0.24);
        g.add(e);
    });
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), mat);
    hat.position.y = 1.88;
    g.add(hat);
    const hatTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), mat);
    hatTop.position.y = 1.98;
    g.add(hatTop);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.26), mat);
    torso.position.y = 1.09;
    torso.castShadow = true;
    g.add(torso);
    const aLPivot = new THREE.Object3D();
    aLPivot.position.set(-0.35, 1.37, 0);
    g.add(aLPivot);
    const aLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.5, 0.19), mat);
    aLMesh.position.y = -0.25;
    aLPivot.add(aLMesh);
    const aRPivot = new THREE.Object3D();
    aRPivot.position.set(0.35, 1.37, 0);
    g.add(aRPivot);
    const aRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.5, 0.19), dark);
    aRMesh.position.y = -0.25;
    aRPivot.add(aRMesh);
    const lLPivot = new THREE.Object3D();
    lLPivot.position.set(-0.13, 0.72, 0);
    g.add(lLPivot);
    const lLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.5, 0.21), dark);
    lLMesh.position.y = -0.25;
    lLPivot.add(lLMesh);
    const lRPivot = new THREE.Object3D();
    lRPivot.position.set(0.13, 0.72, 0);
    g.add(lRPivot);
    const lRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.5, 0.21), dark);
    lRMesh.position.y = -0.25;
    lRPivot.add(lRMesh);
    const sg = new THREE.BoxGeometry(0.23, 0.1, 0.26);
    const sh1 = new THREE.Mesh(sg, shoe);
    sh1.position.set(-0.13, 0.12, 0.03);
    g.add(sh1);
    const sh2 = new THREE.Mesh(sg, shoe);
    sh2.position.set(0.13, 0.12, 0.03);
    g.add(sh2);
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.95, 0.52), new THREE.MeshBasicMaterial({ visible: false }));
    hb.position.y = 1.1;
    g.add(hb);
    g.userData.hitbox = hb;
    const headHB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
    headHB.position.y = 1.72;
    g.add(headHB);
    g.userData.headHitbox = headHB;
    const legHB = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.85, 0.52), new THREE.MeshBasicMaterial({ visible: false }));
    legHB.position.y = 0.42;
    g.add(legHB);
    g.userData.legHitbox = legHB;

    const gm1 = new THREE.MeshLambertMaterial({ color: 0x1a1a2a });
    const gm2 = new THREE.MeshLambertMaterial({ color: 0x0a0a0f });
    const gm3 = new THREE.MeshLambertMaterial({ color: teamColor, emissive: teamColor, emissiveIntensity: 0.5 });
    const gunGrp = new THREE.Group();
    const gb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.32), gm1);
    gunGrp.add(gb);
    const gsl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.032, 0.28), new THREE.MeshLambertMaterial({ color: 0x333348 }));
    gsl.position.set(0, 0.05, -0.01);
    gunGrp.add(gsl);
    const gbar = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.14), gm2);
    gbar.position.set(0, 0.024, -0.23);
    gunGrp.add(gbar);
    const gstr = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.006, 0.14), gm3);
    gstr.position.set(0, 0.038, 0.0);
    gunGrp.add(gstr);
    const ghand = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.095, 0.052), gm1);
    ghand.position.set(0, -0.08, 0.05);
    ghand.rotation.x = 0.2;
    gunGrp.add(ghand);
    gunGrp.position.set(0.12, -0.18, -0.16);
    gunGrp.rotation.y = -0.05;
    aRPivot.add(gunGrp);
    g.userData.limbs = { head, torso, aL: aLPivot, aR: aRPivot, lL: lLPivot, lR: lRPivot };
    g.userData.anim = { walkPhase: 0, shootT: 0, deathT: 0, dead: false, prevX: null, prevZ: null, idleT: Math.random() * 100, jumping: false };
    return g;
}

function onAnimateChar(g, dt) {
    const L = g.userData.limbs;
    const A = g.userData.anim;
    if (!L || !A) return;
    A.idleT += dt;
    const px = g.position.x, pz = g.position.z;
    const moved = A.prevX !== null && (Math.abs(px - A.prevX) > 0.004 || Math.abs(pz - A.prevZ) > 0.004);
    A.prevX = px;
    A.prevZ = pz;
    if (A.dead) {
        A.deathT = Math.min(1, A.deathT + dt * 3.5);
        g.rotation.z = A.deathT * Math.PI * 0.48;
        g.position.y = -A.deathT * 0.55;
        return;
    }
    const idleY = Math.sin(A.idleT * 1.1) * 0.018;
    if (!A.jumping) g.position.y = idleY;
    if (moved) A.walkPhase += dt * 9;
    const sw = Math.sin(A.walkPhase);
    const blend = moved ? 1 : 0;
    const walkAmt = sw * 0.52 * blend;
    L.lL.rotation.x = walkAmt;
    L.lR.rotation.x = -walkAmt;
    L.aL.rotation.x = -walkAmt * 0.7;
    L.aR.rotation.x = walkAmt * 0.7;
    if (!moved) {
        L.lL.rotation.x *= 0.85;
        L.lR.rotation.x *= 0.85;
        L.aL.rotation.x *= 0.85;
        L.aR.rotation.x *= 0.85;
    }
    L.head.position.y = 1.62 + Math.abs(sw) * 0.025 * blend;
    if (A.shootT > 0) {
        A.shootT = Math.max(0, A.shootT - dt * 7);
        L.aR.rotation.x = -Math.PI * 0.35 * A.shootT;
        L.torso.rotation.x = A.shootT * 0.12;
    } else {
        L.torso.rotation.x *= 0.88;
    }
}

function onAddOppMesh(slot, team) {
    if (onOpps.has(slot)) return;
    const group = onCreateRobloxChar(TEAM_COLORS[team] || 0x4488ff);
    group.visible = false;
    onScene.add(group);
    onOpps.set(slot, { group, hitbox: group.userData.hitbox, headHitbox: group.userData.headHitbox, legHitbox: group.userData.legHitbox });
}

function onUpdateOpp(slot, pos, yaw, pitch, posY) {
    const o = onOpps.get(slot);
    if (!o) return;
    const oy = posY || 0;
    o.group.visible = true;
    o.group.position.set(pos.x, oy, pos.z);
    o.group.rotation.y = yaw;
    if (o.group.userData.anim) o.group.userData.anim.jumping = (oy > 0.05);
    if (pitch !== undefined && o.group.userData.limbs) {
        const L = o.group.userData.limbs;
        const cp = Math.max(-0.7, Math.min(0.7, pitch));
        L.head.rotation.x = cp;
        L.aR.rotation.x = -cp * 0.6;
        L.torso.rotation.x = cp * 0.25;
    }
}

function onHandlePlayerRespawn(slot, spawn) {
    const o = onOpps.get(slot);
    if (o && spawn) o.group.position.set(spawn.x, 0, spawn.z);
    if (o && o.group.userData.anim) {
        const a = o.group.userData.anim;
        a.dead = false;
        a.deathT = 0;
        o.group.rotation.z = 0;
        o.group.position.y = 0;
    }
}

function onAnimateAllChars(dt) {
    onOpps.forEach(opp => {
        if (opp.group && opp.group.visible) onAnimateChar(opp.group, dt);
    });
}

// ------------------------------------------------------------------
// Funciones de movimiento, disparo, etc.
// ------------------------------------------------------------------
function onSpawnPlayer(spawn) {
    if (!spawn) spawn = onMySpawn;
    onPos = { x: spawn.x, z: spawn.z };
    onYaw = spawn.yaw;
    onPitch = 0;
    onAlive = true;
    onVelY = 0;
    onPosY = 0;
    onIsGrounded = true;
    onYawObj.position.set(spawn.x, ON_H, spawn.z);
    onYawObj.rotation.y = onYaw;
    onPitchObj.rotation.x = 0;
    onUpdateHP(100);
    onAmmo = { pistol: WEAPONS.pistol.ammoMax, rifle: WEAPONS.rifle.ammoMax, shotgun: WEAPONS.shotgun.ammoMax };
    onGrenades = 2;
    onGrenCooldown = false;
    onReloading = false;
    onCanShoot = true;
    clearTimeout(onReloadT);
    onCurWeapon = 'pistol';
    onUpdateWeaponHUD();
    if (onGun && onCamera) onRebuildGunMesh();
    const grenEl = document.getElementById('duel-gren-hud');
    if (grenEl) grenEl.textContent = '💣'.repeat(onGrenades) || '—';
}

function onMove(dt) {
    if (!onAlive || !onActive) return;
    const fw = (onKeys['w'] || onKeys['W'] ? 1 : 0) - (onKeys['s'] || onKeys['S'] ? 1 : 0);
    const ri = (onKeys['d'] || onKeys['D'] ? 1 : 0) - (onKeys['a'] || onKeys['A'] ? 1 : 0);
    if ((onKeys[' '] || onKeys['Spacebar']) && onIsGrounded) {
        onVelY = ON_JUMP_FORCE;
        onIsGrounded = false;
    }
    onVelY -= ON_GRAVITY * dt;
    onPosY += onVelY * dt;
    if (onPosY <= 0) {
        onPosY = 0;
        onVelY = 0;
        onIsGrounded = true;
    }
    onYawObj.position.y = ON_H + onPosY;
    if (!fw && !ri) return;
    const len = Math.sqrt(fw * fw + ri * ri);
    const sp = ON_SPD * dt;
    const nx = onPos.x + ((fw / len) * (-Math.sin(onYaw)) + (ri / len) * Math.cos(onYaw)) * sp;
    const nz = onPos.z + ((fw / len) * (-Math.cos(onYaw)) + (ri / len) * (-Math.sin(onYaw))) * sp;
    if (!onCollides(nx, onPos.z)) onPos.x = nx;
    if (!onCollides(onPos.x, nz)) onPos.z = nz;
    onYawObj.position.set(onPos.x, ON_H + onPosY, onPos.z);
}

function onCollides(nx, nz) {
    for (const o of onObs) {
        if (nx > o.x - o.hw && nx < o.x + o.hw && nz > o.z - o.hd && nz < o.z + o.hd) return true;
    }
    return false;
}

function onApplyCam() {
    if (!onMX && !onMY) return;
    const dynSens = CFG.sensMap.hipfire * 0.00005;
    onYaw -= onMX * dynSens;
    onPitch -= onMY * dynSens;
    onPitch = Math.max(-Math.PI / 2 + 0.04, Math.min(Math.PI / 2 - 0.04, onPitch));
    onYawObj.rotation.y = onYaw;
    onPitchObj.rotation.x = onPitch;
    onMX = onMY = 0;
}

function onTryShoot() {
    if (!onAlive || !onActive || !onCanShoot || onReloading) return;
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
    const fl = new THREE.PointLight(0xff3d71, 7, 2);
    fl.position.set(0, 0.03, -0.42);
    onCamera.add(fl);
    setTimeout(() => onCamera.remove(fl), 55);
    onSend({ type: 'shoot' });

    for (let p = 0; p < wp.pellets; p++) {
        const spread = wp.spread;
        const dx = (Math.random() - 0.5) * spread * 2;
        const dy = (Math.random() - 0.5) * spread * 2;
        const dir = new THREE.Vector2(dx, dy);
        onRaycaster.setFromCamera(dir, onCamera);
        const wallHits = onRaycaster.intersectObjects(onWalls, false);
        const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;
        let hit = false;

        // Cabeza
        const headBoxes = [...onOpps.values()].map(o => o.headHitbox).filter(Boolean);
        const headHits = onRaycaster.intersectObjects(headBoxes, false);
        if (headHits.length > 0 && headHits[0].distance < wallDist) {
            for (const [slot, opp] of onOpps) {
                if (opp.headHitbox === headHits[0].object) {
                    onSend({ type: 'hit', victimSlot: slot, dmg: wp.dmgHead, zone: 'head' });
                    onShowHitMarker('head');
                    onFlashOppHit(opp);
                    hit = true;
                    break;
                }
            }
            if (hit) continue;
        }

        // Cuerpo
        const bodyBoxes = [...onOpps.values()].map(o => o.hitbox).filter(Boolean);
        const bodyHits = onRaycaster.intersectObjects(bodyBoxes, false);
        if (bodyHits.length > 0 && bodyHits[0].distance < wallDist) {
            for (const [slot, opp] of onOpps) {
                if (opp.hitbox === bodyHits[0].object) {
                    onSend({ type: 'hit', victimSlot: slot, dmg: wp.dmgBody, zone: 'body' });
                    onShowHitMarker('body');
                    onFlashOppHit(opp);
                    hit = true;
                    break;
                }
            }
            if (hit) continue;
        }

        // Piernas
        const legBoxes = [...onOpps.values()].map(o => o.legHitbox).filter(Boolean);
        const legHits = onRaycaster.intersectObjects(legBoxes, false);
        if (legHits.length > 0 && legHits[0].distance < wallDist) {
            for (const [slot, opp] of onOpps) {
                if (opp.legHitbox === legHits[0].object) {
                    onSend({ type: 'hit', victimSlot: slot, dmg: wp.dmgLegs, zone: 'legs' });
                    onShowHitMarker('legs');
                    onFlashOppHit(opp);
                    break;
                }
            }
        }
    }
}

function onShowHitMarker(zone) {
    const f = document.getElementById('duel-hit-flash');
    const isHead = zone === 'head';
    const isLegs = zone === 'legs';
    f.style.opacity = isHead ? '0.55' : isLegs ? '0.18' : '0.28';
    f.style.background = isHead
        ? 'radial-gradient(ellipse at center,rgba(255,215,0,.65) 0%,transparent 65%)'
        : 'radial-gradient(ellipse at center,rgba(255,61,113,.35) 0%,transparent 70%)';
    setTimeout(() => { f.style.opacity = '0'; }, isHead ? 140 : 90);
    if (isHead) {
        const el = document.createElement('div');
        el.innerHTML = '💥 HEADSHOT! <span style="font-size:.75em;color:#ffaa00">+50</span>';
        el.style.cssText = 'position:fixed;top:37%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:1.15rem;font-weight:900;color:#ffd700;text-shadow:0 0 22px #ffd700,0 0 8px #ff8800;pointer-events:none;z-index:65;animation:float-up 1s ease-out forwards;';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    } else if (isLegs) {
        const el = document.createElement('div');
        el.textContent = '🦵 PIERNA';
        el.style.cssText = 'position:fixed;top:42%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:.7rem;font-weight:700;color:#aaaaff;text-shadow:0 0 10px #8888ff;pointer-events:none;z-index:65;animation:float-up .7s ease-out forwards;';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 700);
    }
}

function onFlashOppHit(opp) {
    if (!opp || !opp.group) return;
    const mats = [];
    opp.group.traverse(c => {
        if (c.isMesh && c.material && c.material.visible !== false) {
            mats.push({ m: c.material, orig: c.material.emissive.clone(), oi: c.material.emissiveIntensity });
            c.material.emissive.setHex(0xff0000);
            c.material.emissiveIntensity = 1.2;
        }
    });
    setTimeout(() => mats.forEach(({ m, orig, oi }) => {
        m.emissive.copy(orig);
        m.emissiveIntensity = oi;
    }), 90);
}

function onStartReload() {
    if (onReloading || !onAlive) return;
    const wp = WEAPONS[onCurWeapon];
    if (onAmmo[onCurWeapon] >= wp.ammoMax) return;
    onReloading = true;
    onCanShoot = false;
    const nameEl = document.getElementById('duel-weapon-name');
    const origName = wp.name;
    nameEl.textContent = '⟳ RECARGANDO...';
    nameEl.style.color = '#ffd700';
    clearTimeout(onReloadT);
    onReloadT = setTimeout(() => {
        onAmmo[onCurWeapon] = wp.ammoMax;
        onReloading = false;
        onCanShoot = true;
        nameEl.textContent = origName;
        nameEl.style.color = '#fff';
        onUpdateWeaponHUD();
    }, wp.reload);
}

function onSwitchWeapon(id) {
    if (onCurWeapon === id || onReloading) return;
    clearTimeout(onReloadT);
    onReloading = false;
    onCanShoot = true;
    onCurWeapon = id;
    onUpdateWeaponHUD();
    onRebuildGunMesh();
}

function onUpdateWeaponHUD() {
    const wp = WEAPONS[onCurWeapon];
    const nameEl = document.getElementById('duel-weapon-name');
    const ammoEl = document.getElementById('duel-ammo-hud');
    if (nameEl && !onReloading) nameEl.textContent = wp.name;
    if (ammoEl) ammoEl.textContent = onAmmo[onCurWeapon] + ' / ' + wp.ammoMax;
    document.querySelectorAll('.duel-wp-slot').forEach(s => {
        s.style.borderColor = s.dataset.wp === onCurWeapon ? '#fff' : 'rgba(255,255,255,.2)';
        s.style.background = s.dataset.wp === onCurWeapon ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.05)';
    });
}

function onUpdateHP(hp) {
    onMyHP = Math.max(0, Math.min(100, hp));
    const bar = document.getElementById('duel-hp-bar');
    const num = document.getElementById('duel-hp-num');
    if (bar) {
        bar.style.width = onMyHP + '%';
        bar.style.background = onMyHP > 60 ? 'linear-gradient(90deg,#44cc66,#66ff88)' : onMyHP > 30 ? 'linear-gradient(90deg,#ffaa00,#ffd700)' : 'linear-gradient(90deg,#ff2200,#ff5533)';
    }
    if (num) {
        num.textContent = onMyHP;
        num.style.color = onMyHP > 60 ? '#66ff88' : onMyHP > 30 ? '#ffd700' : '#ff4444';
    }
}

let onOppHP = 100;
function onUpdateOppHP(msg) {
    if (onRoomMode !== '1v1') return;
    const hp = Math.max(0, Math.min(100, msg.hp || 0));
    const zone = msg.zone || 'body';
    const dmg = msg.dmg || 0;
    const wrap = document.getElementById('duel-opp-hp-wrap');
    const bar = document.getElementById('duel-opp-hp-bar');
    const num = document.getElementById('duel-opp-hp-num');
    if (wrap && (onRoomMode === '1v1' || onOpps.size <= 1)) wrap.style.display = 'flex';
    if (bar) {
        bar.style.width = hp + '%';
        bar.style.background = hp > 60 ? 'linear-gradient(90deg,#44cc66,#66ff88)' : hp > 30 ? 'linear-gradient(90deg,#ffaa00,#ffd700)' : 'linear-gradient(90deg,#ff2200,#ff5533)';
        bar.style.filter = 'brightness(2.2)';
        setTimeout(() => { bar.style.filter = ''; }, 140);
    }
    if (num) {
        num.textContent = hp;
        num.style.color = hp > 60 ? '#66ff88' : hp > 30 ? '#ffd700' : '#ff4444';
    }

    const opp = onOpps.get(msg.slot);
    if (opp && opp.group) {
        opp.group.traverse(c => {
            if (c.isMesh && c.material && c.material.color) {
                if (c.userData._oc === undefined) c.userData._oc = c.material.color.getHex();
                c.material.color.setHex(0xff1100);
                if (c.material.emissive) c.material.emissive.setHex(0xff1100);
            }
        });
        setTimeout(() => {
            if (!opp || !opp.group) return;
            opp.group.traverse(c => {
                if (c.isMesh && c.material && c.userData._oc !== undefined) {
                    c.material.color.setHex(c.userData._oc);
                    if (c.material.emissive) c.material.emissive.setHex(0x000000);
                }
            });
        }, 90);
    }

    if (zone === 'head') {
        const he = document.createElement('div');
        he.textContent = '💥 HEADSHOT!';
        he.style.cssText = 'position:fixed;top:28%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:1.25rem;font-weight:900;color:#ffd700;text-shadow:0 0 25px #ffd700,0 0 50px #ff8800;pointer-events:none;z-index:66;animation:float-up 1s ease-out forwards;';
        document.body.appendChild(he);
        setTimeout(() => he.remove(), 1000);
    }

    const zLabel = zone === 'head' ? '+' + dmg + ' 🎯' : zone === 'legs' ? '+' + dmg + ' 🦵' : '+' + dmg;
    const zCol = zone === 'head' ? '#ffd700' : zone === 'legs' ? '#ff9900' : '#ff4444';
    const de = document.createElement('div');
    de.textContent = zLabel;
    de.style.cssText = 'position:fixed;top:44%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:.9rem;font-weight:900;color:' + zCol + ';text-shadow:0 0 14px ' + zCol + ';pointer-events:none;z-index:65;animation:float-up .75s ease-out forwards;';
    document.body.appendChild(de);
    setTimeout(() => de.remove(), 750);
}

function onHandleOppGrenade(msg) {
    if (!onScene) return;
    const geo = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a2a0a });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const startX = msg.pos ? msg.pos.x : 0;
    const startZ = msg.pos ? msg.pos.z : 0;
    mesh.position.set(startX, ON_H - 0.1, startZ);
    onScene.add(mesh);
    const yaw = msg.yaw || 0, pitch = msg.pitch || 0;
    const vel = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch) + 0.4, -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(18).add(new THREE.Vector3(0, 8, 0));
    onGrenList.push({ mesh, vel, life: 0, exploded: false });
}

function onUpdateGrenades(dt) {
    for (let i = onGrenList.length - 1; i >= 0; i--) {
        const g = onGrenList[i];
        if (g.exploded) {
            onGrenList.splice(i, 1);
            continue;
        }
        g.life += dt;
        g.vel.y -= 18 * dt;
        g.mesh.position.addScaledVector(g.vel, dt);
        g.mesh.rotation.x += dt * 8;
        g.mesh.rotation.z += dt * 5;
        if (g.mesh.position.y < 0.15) g.mesh.position.y = 0.15;
        if (g.life >= 2.5) onExplodeGrenade(g, i);
    }
}

function onExplodeGrenade(g, idx) {
    g.exploded = true;
    const pos = g.mesh.position.clone();
    onScene.remove(g.mesh);
    const fl = new THREE.PointLight(0xff6600, 20, 8);
    fl.position.copy(pos);
    onScene.add(fl);
    setTimeout(() => onScene.remove(fl), 180);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 }));
    sphere.position.copy(pos);
    onScene.add(sphere);
    let t = 0;
    function expandWave() {
        t += 0.05;
        sphere.scale.setScalar(1 + t * 40);
        sphere.material.opacity = Math.max(0, 0.9 - t * 3);
        if (t < 0.3) requestAnimationFrame(expandWave);
        else onScene.remove(sphere);
    }
    requestAnimationFrame(expandWave);
    const dist = new THREE.Vector3(onPos.x, ON_H, onPos.z).distanceTo(pos);
    if (dist < 6) onCamShake = 0.4 * (1 - dist / 6);
}

function onApplyCamShake(dt) {
    if (onCamShake <= 0) return;
    onCamShake = Math.max(0, onCamShake - dt * 3);
    onCamera.position.x = (Math.random() - 0.5) * onCamShake * 0.12;
    onCamera.position.y = (Math.random() - 0.5) * onCamShake * 0.12;
}

function onInitWeaponSlots() {
    const container = document.getElementById('duel-weapon-slots');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(WEAPONS).forEach(([id, wp]) => {
        const slot = document.createElement('div');
        slot.className = 'duel-wp-slot';
        slot.dataset.wp = id;
        slot.style.cssText = 'padding:4px 10px;border:1px solid rgba(255,255,255,.2);border-radius:3px;cursor:pointer;font-family:Orbitron,monospace;font-size:.52rem;letter-spacing:.1em;color:#ccc;background:rgba(255,255,255,.05);transition:all .15s;';
        slot.innerHTML = '<div style="font-size:.65rem">' + wp.key + '</div><div>' + wp.name + '</div>';
        slot.onclick = () => onSwitchWeapon(id);
        container.appendChild(slot);
    });
    onUpdateWeaponHUD();
}

function onHandleDamage(msg) {
    onUpdateHP(msg.hp);
    const dmg = msg.dmg || 25;
    const zone = msg.zone || 'body';
    const isHead = (zone === 'head');
    const isLegs = (zone === 'legs');

    const v = document.getElementById('duel-death-vignette');
    const intensity = Math.min(1, 0.2 + (dmg / 100) * 1.2);
    v.style.display = 'block';
    v.style.opacity = intensity.toFixed(2);
    v.style.background = isHead
        ? 'radial-gradient(ellipse at center,rgba(255,0,0,.0) 25%,rgba(255,0,0,.98) 100%)'
        : 'radial-gradient(ellipse at center,rgba(160,0,0,.0) 35%,rgba(200,0,0,.88) 100%)';
    const dur = isHead ? 420 : 230;
    setTimeout(() => {
        if (!onAlive) return;
        v.style.opacity = '0';
        setTimeout(() => {
            if (!onAlive) return;
            v.style.display = 'none';
            v.style.background = '';
        }, 320);
    }, dur);

    onCamShake = 0.05 + (dmg / 100) * 0.32;

    try {
        const ac = new AudioContext();
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g);
        g.connect(ac.destination);
        osc.frequency.setValueAtTime(isHead ? 70 : 130, ac.currentTime);
        g.gain.setValueAtTime(isHead ? 0.4 : 0.25, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
        osc.start();
        osc.stop(ac.currentTime + 0.18);
    } catch (e) { }

    const zoneLabel = isHead ? '💀 HEADSHOT  -' + dmg : isLegs ? '🦵 PIERNAS  -' + dmg : '🎯 CUERPO  -' + dmg;
    const zoneCol = isHead ? '#ff1111' : isLegs ? '#ff9900' : '#ff5533';
    const fSize = isHead ? '1.15rem' : '.82rem';
    const el = document.createElement('div');
    el.textContent = zoneLabel;
    el.style.cssText = 'position:fixed;top:36%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:' + fSize + ';font-weight:900;color:' + zoneCol + ';text-shadow:0 0 20px ' + zoneCol + ';pointer-events:none;z-index:65;animation:float-up .9s ease-out forwards;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

function onHandleKill(msg) {
    onRefreshHUD();
    const killerName = onPlayerNames.get(msg.killerSlot) || '?';
    const victimName = onPlayerNames.get(msg.victimSlot) || '?';
    if (msg.victimSlot === onMySlot) {
        onAlive = false;
        document.getElementById('duel-death-vignette').style.display = 'block';
        document.getElementById('duel-respawn-msg').style.display = 'block';
        onAddFeed(killerName + ' ➤ ' + onMyName, '#ff4444');
        if (!msg.matchOver) setTimeout(() => { if (onActive) onHandleRespawn(msg.victimSpawn || onMySpawn); }, 1500);
    } else if (msg.killerSlot === onMySlot) {
        onOppHP = 100;
        onUpdateOppHP(msg.victimSlot, 100);
        document.getElementById('duel-kill-notif').style.opacity = '1';
        setTimeout(() => document.getElementById('duel-kill-notif').style.opacity = '0', 1600);
        onAddFeed(onMyName + ' ➤ ' + victimName, '#44ff88');
        const vO = onOpps.get(msg.victimSlot);
        if (vO && vO.group.userData.anim) {
            vO.group.userData.anim.dead = true;
            vO.group.userData.anim.deathT = 0;
        }
        if (!msg.matchOver) {
            onAlive = false;
            const rMsg = document.getElementById('duel-respawn-msg');
            rMsg.textContent = '⚡ REPOSICIONANDO...';
            rMsg.style.display = 'block';
            rMsg.style.color = '#00ff88';
            rMsg.style.textShadow = '0 0 14px #00ff88';
            document.getElementById('duel-death-vignette').style.opacity = '0.12';
            document.getElementById('duel-death-vignette').style.display = 'block';
            setTimeout(() => {
                if (onActive) {
                    onHandleRespawn(msg.killerSpawn || onMySpawn);
                    rMsg.textContent = '💀 REAPARECIENDO...';
                    rMsg.style.color = '#ff3d71';
                    rMsg.style.textShadow = '0 0 14px #ff3d71';
                    document.getElementById('duel-death-vignette').style.opacity = '1';
                }
            }, 1500);
        }
    } else {
        onAddFeed(killerName + ' ➤ ' + victimName, '#aaaaaa');
        const vO2 = onOpps.get(msg.victimSlot);
        if (vO2 && vO2.group.userData.anim) {
            vO2.group.userData.anim.dead = true;
            vO2.group.userData.anim.deathT = 0;
        }
    }
    if (msg.matchOver) {
        const won = msg.killerTeam === onMyTeam || msg.killerSlot === onMySlot;
        setTimeout(() => onShowGameOver(won), 1800);
    }
}

function onHandleRespawn(spawn) {
    onSpawnPlayer(spawn || onMySpawn);
    document.getElementById('duel-death-vignette').style.display = 'none';
    document.getElementById('duel-respawn-msg').style.display = 'none';
}

function onRefreshHUD() {
    if (onRoomMode === 'ffa') {
        document.getElementById('duel-my-kills').textContent = onPScores[onMyName] || 0;
        document.getElementById('duel-opp-kills').textContent = 'FFA';
    } else {
        document.getElementById('duel-my-kills').textContent = onTeamScores[onMyTeam] || 0;
        document.getElementById('duel-opp-kills').textContent = onTeamScores[onMyTeam === 0 ? 1 : 0] || 0;
    }
}

function onAddFeed(text, color) {
    const feed = document.getElementById('duel-kill-feed');
    const el = document.createElement('div');
    el.style.cssText = 'font-size:.6rem;letter-spacing:.06em;background:rgba(5,8,15,.88);padding:4px 10px;border-left:3px solid ' + color + ';color:' + color;
    el.textContent = text;
    feed.appendChild(el);
    if (feed.children.length > 6) feed.removeChild(feed.firstChild);
    setTimeout(() => { try { el.remove(); } catch (e) { } }, 5000);
}

function onShowGameOver(won) {
    onCleanup();
    const t = document.getElementById('duel-go-title');
    t.textContent = won ? '¡VICTORIA!' : 'DERROTA';
    t.style.color = won ? 'var(--green)' : 'var(--accent2)';
    t.style.textShadow = '0 0 30px ' + (won ? 'var(--green)' : 'var(--accent2)');
    const myK = onRoomMode === 'ffa' ? (onPScores[onMyName] || 0) : onTeamScores[onMyTeam];
    const oppK = onRoomMode === 'ffa' ? '?' : onTeamScores[onMyTeam === 0 ? 1 : 0];
    document.getElementById('duel-go-vs').textContent = 'Modo: ' + onRoomMode.toUpperCase();
    document.getElementById('duel-go-score').textContent = onRoomMode === 'ffa' ? ('Tu score: ' + myK) : (myK + ' — ' + oppK);
    onShowScreen('duel-gameover-screen');
}

function onSetErr(msg) {
    onCleanup();
    onLobbyErr(msg);
    onShowScreen('duel-lobby-screen');
    onConnect();
}

function onCleanup() {
    onActive = false;
    onLocked = false;
    clearInterval(onStateIv);
    try { document.exitPointerLock(); } catch (e) { }
    document.getElementById('duel-canvas').style.display = 'none';
    document.getElementById('duel-hud').style.display = 'none';
    document.getElementById('duel-crosshair').style.display = 'none';
    document.getElementById('duel-lock-screen').style.display = 'none';
    document.getElementById('duel-death-vignette').style.display = 'none';
    document.getElementById('duel-respawn-msg').style.display = 'none';
    const oppHpW = document.getElementById('duel-opp-hp-wrap');
    if (oppHpW) oppHpW.style.display = 'none';
    document.getElementById('duel-mobile-controls').classList.remove('active');
    onOpps.forEach(o => { if (onScene) onScene.remove(o.group); });
    onOpps.clear();
    if (onAnimId) {
        cancelAnimationFrame(onAnimId);
        onAnimId = null;
    }
}

function onThrowGrenade() {
    if (!onAlive || !onActive || onGrenades <= 0 || onGrenCooldown) return;
    onGrenades--;
    onGrenCooldown = true;
    setTimeout(() => onGrenCooldown = false, 3500);
    const grenEl = document.getElementById('duel-gren-hud');
    if (grenEl) grenEl.textContent = onGrenades > 0 ? '💣'.repeat(onGrenades) : '—';
    const geo = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x2a4a1a });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const dir = new THREE.Vector3();
    onCamera.getWorldDirection(dir);
    const startPos = new THREE.Vector3(onPos.x, ON_H + onPosY - 0.1, onPos.z).addScaledVector(dir, 0.4);
    mesh.position.copy(startPos);
    onScene.add(mesh);
    onSend({ type: 'grenade', pos: { x: onPos.x, z: onPos.z }, yaw: onYaw, pitch: onPitch });
    const vel = dir.clone().multiplyScalar(18).add(new THREE.Vector3(0, 8, 0));
    onGrenList.push({ mesh, vel, life: 0, exploded: false });
}

// ------------------------------------------------------------------
// Funciones de red (WebSocket)
// ------------------------------------------------------------------
function onConnect() {
    if (onWS && onWS.readyState <= 1) return;
    onUpdateLobbyStatus(false);
    try {
        onWS = new WebSocket(ONLINE_SRV);
    } catch (e) {
        onLobbyErr('No se pudo conectar al servidor');
        return;
    }
    onWS.onopen = () => {
        onUpdateLobbyStatus(true);
        onSend({ type: 'get_rooms' });
        clearInterval(onPingIv);
        onPingIv = setInterval(() => {
            if (onWS && onWS.readyState === 1) onSend({ type: 'ping', t: Date.now() });
        }, 2000);
    };
    onWS.onmessage = e => {
        try { onMsg(JSON.parse(e.data)); } catch (err) { console.error('onMsg:', err); }
    };
    onWS.onclose = e => {
        clearInterval(onPingIv);
        onPingIv = null;
        onUpdateLobbyStatus(false);
        if (onActive) onSetErr('Conexión perdida');
        else {
            onLobbyErr('Desconectado · reconectando en 3s...');
            clearTimeout(onReconnectT);
            onReconnectT = setTimeout(() => {
                if (!onActive) onConnect();
            }, 3000);
        }
    };
    onWS.onerror = () => {
        onUpdateLobbyStatus(false);
        onLobbyErr('Error de conexión con el servidor');
    };
}

function onDisconnect() {
    clearInterval(onPingIv);
    if (onWS) {
        onWS.onclose = null;
        onWS.close();
        onWS = null;
    }
}

function onSend(msg) {
    if (onWS && onWS.readyState === 1) onWS.send(JSON.stringify(msg));
}

function onMsg(msg) {
    switch (msg.type) {
        case 'pong': onPing = Date.now() - msg.t; onUpdatePingDisplay(); break;
        case 'online_count': onUpdateOnlineCount(msg.count); break;
        case 'room_list': onUpdateRoomList(msg.rooms); break;
        case 'room_joined': onRoomJoined(msg); break;
        case 'player_joined': onPlayerJoined(msg); break;
        case 'chat_msg': onHandleChatMsg(msg); break;
        case 'start': setTimeout(() => onStartGame(msg), 150); break;
        case 'opp_state': onUpdateOpp(msg.slot, msg.pos, msg.yaw, msg.pitch || 0, msg.posY || 0); break;
        case 'opp_shoot': {
            const o = onOpps.get(msg.slot);
            if (o && o.group.userData.anim) o.group.userData.anim.shootT = 1;
            break;
        }
        case 'kill': onTeamScores = msg.teamScores; onPScores = msg.pScores; onHandleKill(msg); break;
        case 'damage': onHandleDamage(msg); break;
        case 'opp_hp': onUpdateOppHP(msg); break;
        case 'opp_grenade': onHandleOppGrenade(msg); break;
        case 'respawn': onHandleRespawn(msg.spawn); break;
        case 'player_respawn': onHandlePlayerRespawn(msg.slot, msg.spawn); break;
        case 'join_err': onLobbyErr(msg.msg); break;
        case 'opp_disconnect': onSetErr((msg.name || 'Un jugador') + ' se desconectó'); break;
    }
}

function onUpdateOnlineCount(count) {
    const m = document.getElementById('menu-online-count');
    const l = document.getElementById('lobby-online-count');
    if (m) m.textContent = count;
    if (l) l.textContent = count;
}

function onUpdateLobbyStatus(connected) {
    const dot = document.getElementById('lobby-conn-dot');
    const lbl = document.getElementById('lobby-conn-label');
    if (!dot || !lbl) return;
    if (connected) {
        dot.style.background = '#00ff88';
        lbl.textContent = 'CONECTADO';
        lbl.style.color = '#00ff88';
        dot.style.animation = '';
    } else {
        dot.style.background = '#ff3d71';
        lbl.textContent = 'DESCONECTADO · Reconectando...';
        lbl.style.color = '#ff3d71';
        dot.style.animation = 'ping-pulse .8s infinite';
    }
}

function onUpdatePingDisplay() {
    const pingEl = document.getElementById('duel-ping-hud');
    const qualEl = document.getElementById('duel-conn-quality');
    if (!pingEl) return;
    pingEl.textContent = onPing + ' MS';
    let color, label;
    if (onPing === 0) {
        color = 'var(--dim)';
        label = '● —';
    } else if (onPing < 60) {
        color = '#00ff88';
        label = '● BUENA';
        if (qualEl) {
            qualEl.className = '';
            qualEl.style.background = 'rgba(0,255,136,.08)';
        }
    } else if (onPing < 120) {
        color = '#ffd700';
        label = '● MEDIA';
        if (qualEl) {
            qualEl.className = '';
            qualEl.style.background = 'rgba(255,215,0,.08)';
        }
    } else {
        color = '#ff3d71';
        label = '● ALTA';
        if (qualEl) {
            qualEl.className = 'ping-bad';
            qualEl.style.background = 'rgba(255,61,113,.08)';
        }
    }
    pingEl.style.color = color;
    if (qualEl) {
        qualEl.textContent = label;
        qualEl.style.color = color;
    }
}

function onUpdateRoomList(rooms) {
    const el = document.getElementById('duel-room-list');
    if (!rooms || !rooms.length) {
        el.innerHTML = '<div style="text-align:center;color:var(--dim);font-size:.68rem;letter-spacing:.15em;padding:28px">No hay salas disponibles. ¡Crea la primera!</div>';
        return;
    }
    el.innerHTML = '';
    rooms.forEach(r => {
        const card = document.createElement('div');
        card.className = 'room-card';
        const ml = { '1v1': '1v1', '2v2': '2v2', '3v3': '3v3', '4v4': '4v4', 'ffa': 'FFA' }[r.mode] || r.mode;
        card.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:3px">
                <span class="room-nm">${r.isPrivate ? '🔒 ' : ''}${esc(r.name)}</span>
                <span style="font-size:.54rem;color:var(--dim)">${ml} · ${r.players}/${r.max} jugadores</span>
            </div>
            <div style="display:flex;gap:7px;align-items:center">
                <span style="font-size:.52rem;letter-spacing:.2em;color:var(--accent);background:rgba(224,64,251,.1);padding:2px 8px">${ml}</span>
                <button class="room-join" onclick="onJoinClick(${r.id},${r.isPrivate})">ENTRAR →</button>
            </div>
        `;
        el.appendChild(card);
    });
}

function onJoinClick(roomId, isPrivate) {
    if (isPrivate) {
        const pw = prompt('Contraseña de la sala:');
        if (pw === null) return;
        onSend({ type: 'join_room', roomId, playerName: onMyName, password: pw });
    } else {
        onSend({ type: 'join_room', roomId, playerName: onMyName, password: '' });
    }
}

function onLobbyErr(msg) {
    const el = document.getElementById('duel-lobby-err');
    if (el) {
        el.textContent = '⚠ ' + msg;
        setTimeout(() => el.textContent = '', 5000);
    }
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function onRoomJoined(msg) {
    onMySlot = msg.slot;
    onMyTeam = msg.team;
    onMySpawn = msg.spawn;
    onRoomMode = msg.mode;
    onFirstTo = msg.firstTo;
    onWaitPlayers = msg.players || [{ slot: msg.slot, team: msg.team, name: onMyName }];
    onPlayerNames.clear();
    onWaitPlayers.forEach(p => onPlayerNames.set(p.slot, p.name));
    document.getElementById('duel-room-info').textContent = msg.name + ' · ' + msg.mode.toUpperCase() + ' · Primero en ' + msg.firstTo + ' kills gana';
    document.getElementById('duel-share-url').textContent = location.href;
    document.getElementById('duel-force-start').style.display = msg.slot === 0 ? 'block' : 'none';
    const chatEl = document.getElementById('duel-chat-msgs');
    if (chatEl && msg.chatHistory) {
        chatEl.innerHTML = '';
        msg.chatHistory.forEach(m => onHandleChatMsg(m));
    }
    onRenderWaitingPlayers(msg.max);
    onUpdateStartBtn();
    onShowScreen('duel-waiting-screen');
}

function onPlayerJoined(p) {
    if (!onWaitPlayers.find(x => x.slot === p.slot)) onWaitPlayers.push(p);
    onPlayerNames.set(p.slot, p.name);
    onRenderWaitingPlayers();
    onUpdateStartBtn();
    if (onThreeReady) onAddOppMesh(p.slot, p.team);
}

function onUpdateStartBtn() {
    const btn = document.getElementById('duel-force-start');
    if (!btn) return;
    const ready = onWaitPlayers.length >= 2;
    btn.style.background = ready ? '#ff3d71' : '#555566';
    btn.style.color = ready ? '#fff' : '#aaa';
    btn.style.boxShadow = ready ? '0 0 18px rgba(255,61,113,.5)' : 'none';
    btn.style.opacity = ready ? '1' : '.5';
    btn.textContent = ready ? '▶ INICIAR PARTIDA' : '⏳ ESPERANDO JUGADORES...';
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
    btn.disabled = !ready;
}

function onRenderWaitingPlayers(max) {
    const el = document.getElementById('duel-players-in-room');
    el.innerHTML = '';
    const total = max || onWaitPlayers.length;
    for (let i = 0; i < total; i++) {
        const p = onWaitPlayers[i];
        const div = document.createElement('div');
        div.className = 'player-slot';
        if (p) {
            const col = TEAM_HEX[p.team] || '#fff';
            const isMe = p.slot === onMySlot;
            div.innerHTML = `
                <span style="width:10px;height:10px;border-radius:2px;background:${col};display:inline-block;flex-shrink:0"></span>
                <span style="font-size:.68rem;color:${isMe ? 'var(--accent)' : 'var(--text)'}">${esc(p.name)}${isMe ? ' (Tú)' : ''}</span>
                <span style="margin-left:auto;font-size:.55rem;letter-spacing:.15em;font-weight:700;color:${col}">${TEAM_LBL[p.team] || '?'}</span>
            `;
        } else {
            div.innerHTML = `
                <span style="width:10px;height:10px;border-radius:2px;background:var(--border);display:inline-block"></span>
                <span style="font-size:.6rem;color:var(--dim);font-style:italic">Esperando jugador...</span>
            `;
        }
        el.appendChild(div);
    }
}

function onHandleChatMsg(msg) {
    const el = document.getElementById('duel-chat-msgs');
    if (!el) return;
    const div = document.createElement('div');
    const isMe = !msg.system && msg.slot === onMySlot;
    if (msg.system) {
        div.style.cssText = 'font-size:.58rem;color:var(--dim);font-style:italic;padding:1px 0;';
        div.textContent = '· ' + msg.text;
    } else {
        div.style.cssText = `font-size:.6rem;padding:1px 0;color:${isMe ? 'var(--accent)' : 'var(--text)'}`;
        div.innerHTML = `<span style="color:${isMe ? 'var(--accent)' : '#7a9acc'};font-weight:700">[${esc(msg.sender)}]</span> ${esc(msg.text)}`;
    }
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
}

function onSendChat() {
    const input = document.getElementById('duel-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    onSend({ type: 'chat', text });
    input.value = '';
}

function onStartGame(msg) {
    if (!onThreeReady) onInitThree();
    onRoomMode = msg.mode;
    onFirstTo = msg.firstTo;
    onTeamScores = [0, 0];
    onPScores = {};
    onActive = true;
    onWaitPlayers = [];
    msg.players.forEach(p => {
        onPlayerNames.set(p.slot, p.name);
        if (p.slot === onMySlot) {
            onMySpawn = p.spawn;
            onMyTeam = p.team;
        } else {
            onAddOppMesh(p.slot, p.team);
        }
    });
    onSpawnPlayer(onMySpawn);
    if (msg.mode === '1v1') {
        const w = document.getElementById('duel-opp-hp-wrap');
        if (w) w.style.display = 'flex';
    }
    const myCol = TEAM_HEX[onMyTeam] || '#ff4444';
    document.getElementById('duel-my-name-hud').textContent = onMyName.toUpperCase();
    document.getElementById('duel-opp-name-hud').textContent = msg.mode === 'ffa' ? 'FFA' : 'RIVAL';
    const oppHpHud = document.getElementById('duel-opp-hp-hud');
    if (oppHpHud) oppHpHud.style.display = msg.mode === '1v1' ? 'flex' : 'none';
    onOppHP = 100;
    document.getElementById('duel-team-label').textContent = TEAM_LBL[onMyTeam] || '?';
    document.getElementById('duel-team-label').style.color = myCol;
    document.getElementById('duel-my-kills').style.color = myCol;
    document.getElementById('duel-my-kills').style.textShadow = '0 0 12px ' + myCol;
    const ft = document.getElementById('duel-firstto');
    if (ft) ft.textContent = msg.firstTo;
    onPing = 0;
    onUpdatePingDisplay();
    onRefreshHUD();
    onInitWeaponSlots();
    const oppNames = msg.players.filter(p => p.slot !== onMySlot).map(p => p.name).join(', ');
    document.getElementById('duel-opp-name-lock').textContent = oppNames || 'Rival';
    document.getElementById('duel-lock-team').textContent = 'Equipo: ' + TEAM_LBL[onMyTeam];
    onShowScreen(null);
    document.getElementById('duel-canvas').style.display = 'block';
    document.getElementById('duel-hud').style.display = 'block';

    if (mobileMode) {
        document.getElementById('duel-lock-screen').style.display = 'none';
        document.getElementById('duel-crosshair').style.display = 'block';
        document.getElementById('duel-mobile-controls').classList.add('active');
        onLocked = true;
        onKeys['w'] = onKeys['s'] = onKeys['a'] = onKeys['d'] = false;
    } else {
        document.getElementById('duel-lock-screen').style.display = 'flex';
        document.getElementById('duel-mobile-controls').classList.remove('active');
    }

    clearInterval(onStateIv);
    onStateIv = setInterval(() => {
        if (onAlive && onActive) onSend({ type: 'state', pos: { ...onPos }, yaw: onYaw, pitch: onPitch, posY: onPosY });
    }, 50);
    if (onAnimId) cancelAnimationFrame(onAnimId);
    
    let lastFrameTime = performance.now();
    let lastRender = performance.now();
    const targetFPS = CFG.fps.target;
    const frameInterval = 1000 / targetFPS;
    let fF = 0, fA = 0;
    
    function onLoop(now) {
        onAnimId = requestAnimationFrame(onLoop);
        const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
        lastFrameTime = now;
        
        // Actualizar lógica siempre
        if (onActive) {
            onMove(dt);
            onApplyCam();
            onAnimGun(dt);
            onAnimateAllChars(dt);
            onUpdateGrenades(dt);
            onApplyCamShake(dt);
        }
        
        // Mostrar FPS reales
        fF++;
        fA += dt;
        if (fA >= 0.5) {
            document.getElementById('duel-fps-hud').textContent = Math.round(fF / fA) + ' FPS';
            fF = 0;
            fA = 0;
        }
        
        // Renderizar según límite
        if (CFG.fps.limit) {
            if (now - lastRender >= frameInterval) {
                onRenderer.render(onScene, onCamera);
                lastRender = now;
            }
        } else {
            onRenderer.render(onScene, onCamera);
            lastRender = now;
        }
    }
    onLoop(performance.now());
}

// ========== EVENTO DE BLOQUEO DEL RATÓN (MULTIJUGADOR / BOTS / ZOMBIES) ==========
document.addEventListener('pointerlockchange', () => {
    const duelCanvas = document.getElementById('duel-canvas');
    onLocked = document.pointerLockElement === duelCanvas;
    
    if (onLocked) {
        // Ocultar pantalla de bloqueo
        document.getElementById('duel-lock-screen').style.display = 'none';
        // Mostrar mira y HUD
        document.getElementById('duel-crosshair').style.display = 'block';
        if (mobileMode) {
            document.getElementById('duel-mobile-controls').classList.add('active');
        }
    } else {
        // Mostrar pantalla de bloqueo si el juego sigue activo
        if (onActive) {
            document.getElementById('duel-lock-screen').style.display = 'flex';
            document.getElementById('duel-crosshair').style.display = 'none';
            document.getElementById('duel-mobile-controls').classList.remove('active');
        }
    }
});

// Exponer funciones globales
window.onConnect = onConnect;
window.onSendChat = onSendChat;
window.onJoinClick = onJoinClick;
window.onTryShoot = onTryShoot;
window.onThrowGrenade = onThrowGrenade;
window.onSwitchWeapon = onSwitchWeapon;
window.onStartReload = onStartReload;
window.onInitThree = onInitThree;
window.onBuildGun = onBuildGun;
window.onBuildLights = onBuildLights;
window.onBuildMap = onBuildMap;
window.onCreateRobloxChar = onCreateRobloxChar;
window.onAnimateChar = onAnimateChar;
window.onAddOppMesh = onAddOppMesh;
window.onSpawnPlayer = onSpawnPlayer;
window.onMove = onMove;
window.onCollides = onCollides;
window.onApplyCam = onApplyCam;
window.onShowHitMarker = onShowHitMarker;
window.onFlashOppHit = onFlashOppHit;
window.onUpdateHP = onUpdateHP;
window.onUpdateOppHP = onUpdateOppHP;
window.onUpdateWeaponHUD = onUpdateWeaponHUD;
window.onInitWeaponSlots = onInitWeaponSlots;
window.onRebuildGunMesh = onRebuildGunMesh;
window.onAnimateAllChars = onAnimateAllChars;
window.onCleanup = onCleanup;
window.onShowScreen = onShowScreen;