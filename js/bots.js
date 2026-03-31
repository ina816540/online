// ============================================================
// MODO VS BOTS (OFFLINE)
// ============================================================

let btActive = false, btBots = [], btScore = { player: 0 }, btAnimId = null, btDiff = 'easy', btFirstTo = 10;
const BT_DIFF = {
    easy:   { spd: 2.5, aimErr: 0.18, reactionT: 1.8, shootCd: 1400, dmg: 15, vision: 12 },
    medium: { spd: 4.0, aimErr: 0.08, reactionT: 0.9, shootCd: 900,  dmg: 20, vision: 18 },
    hard:   { spd: 5.5, aimErr: 0.02, reactionT: 0.3, shootCd: 500,  dmg: 25, vision: 24 }
};
const BT_SPAWNS_RED = [{ x: -14, z: -12, yaw: 0.75 }, { x: -12, z: -5, yaw: 0.6 }, { x: -15, z: 1, yaw: 0.35 }];
const BT_SPAWNS_BLUE = [{ x: 14, z: 12, yaw: -Math.PI + 0.75 }, { x: 12, z: 5, yaw: -Math.PI + 0.6 }, { x: 15, z: -1, yaw: -Math.PI + 0.35 }];

function botsStartMatch(count, diff) {
    if (btActive) botsCleanup();
    btActive = true;
    btBots = [];
    btDiff = diff;
    btFirstTo = 10;
    btScore = { player: 0 };

    // Ocultar pantallas y mostrar canvas
    onShowScreen(null);
    menuScreen.classList.add('hidden');
    document.getElementById('bots-screen').classList.add('hidden');
    const cv = document.getElementById('duel-canvas');
    cv.style.display = 'block';
    document.getElementById('duel-hud').style.display = 'block';
    document.getElementById('duel-crosshair').style.display = 'block';

    // Inicializar Three si es necesario
    if (!onThreeReady) {
        onInitThree();
    } else {
        const remove = [];
        onScene.children.forEach(c => {
            if (c.userData.isMapObj || c.type === 'AmbientLight' || c.type === 'DirectionalLight' || c.type === 'PointLight') remove.push(c);
        });
        remove.forEach(c => onScene.remove(c));
        onWalls.length = 0;
        onObs.length = 0;
    }

    // Construir mapa de entrenamiento
    btBuildMap();

    // Arma
    if (onGun && onCamera) {
        onCamera.remove(onGun);
        onGun = null;
    }
    onBuildGun();

    // Variables de partida
    onMyTeam = 0;
    onMySlot = 0;
    onRoomMode = '1v1';
    onFirstTo = btFirstTo;
    onActive = true;
    onPlayerNames = new Map([[0, currentUser?.name || 'TÚ']]);
    onTeamScores = [0, 0];
    onPScores = {};
    onAlive = false;
    onCanShoot = true;
    onReloading = false;

    // Spawn jugador
    const pSpawn = BT_SPAWNS_RED[0];
    onMySpawn = pSpawn;
    onSpawnPlayer(pSpawn);

    // HUD
    document.getElementById('duel-my-name-hud').textContent = (currentUser?.name || 'TÚ').toUpperCase();
    document.getElementById('duel-opp-name-hud').textContent = count === 1 ? '🤖 BOT' : '🤖 BOTS';
    document.getElementById('duel-my-kills').textContent = '0';
    document.getElementById('duel-opp-kills').textContent = '0';
    const oppW = document.getElementById('duel-opp-hp-wrap');
    if (oppW) oppW.style.display = 'flex';
    document.getElementById('duel-death-vignette').style.display = 'none';
    document.getElementById('duel-respawn-msg').style.display = 'none';
    onInitWeaponSlots();

    if (!mobileMode) {
        document.getElementById('duel-lock-screen').style.display = 'flex';
        const lockOpp = document.getElementById('duel-opp-name-lock');
        if (lockOpp) lockOpp.textContent = count + ' BOT' + (count > 1 ? 'S' : '');
        const lockTeam = document.getElementById('duel-lock-team');
        if (lockTeam) lockTeam.textContent = 'Equipo: ROJO';
    } else {
        onLocked = true;
        document.getElementById('duel-mobile-controls').classList.add('active');
    }

    // Crear bots
    for (let i = 0; i < count; i++) {
        const sp = BT_SPAWNS_BLUE[i % BT_SPAWNS_BLUE.length];
        btSpawnBot(i + 1, sp, diff);
    }

    // Botón de salir al menú
    document.getElementById('duel-menu-btn').onclick = () => {
        botsCleanup();
        document.getElementById('duel-canvas').style.display = 'none';
        document.getElementById('duel-hud').style.display = 'none';
        document.getElementById('duel-crosshair').style.display = 'none';
        document.getElementById('menu-screen').classList.remove('hidden');
    };

    // Loop
    if (btAnimId) cancelAnimationFrame(btAnimId);
    let last = performance.now();
    function btLoop(now) {
        btAnimId = requestAnimationFrame(btLoop);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (btActive) {
            onMove(dt);
            onApplyCam();
            onAnimGun(dt);
            btUpdateBots(dt);
            onUpdateGrenades(dt);
            onApplyCamShake(dt);
            onAnimateAllChars(dt);
        }
        onRenderer.render(onScene, onCamera);
    }
    btLoop(performance.now());
}

function btSpawnBot(slot, spawn, diff) {
    const col = TEAM_COLORS[1] || 0x2277ff;
    const g = onCreateRobloxChar(col);
    g.position.set(spawn.x, 0, spawn.z);
    onScene.add(g);
    const cfg = BT_DIFF[diff];
    const bot = {
        slot, group: g,
        hitbox: g.userData.hitbox,
        headHitbox: g.userData.headHitbox,
        legHitbox: g.userData.legHitbox,
        hp: 100, alive: true,
        spawn, diff, cfg,
        state: 'patrol',
        patrolTarget: null,
        shootCd: 0,
        reactionT: 0,
        stuckT: 0,
        prevX: null, prevZ: null,
        name: 'BOT ' + (slot)
    };
    onOpps.set(slot, { group: g, hitbox: g.userData.hitbox, headHitbox: g.userData.headHitbox, legHitbox: g.userData.legHitbox });
    onPlayerNames.set(slot, bot.name);
    btBots.push(bot);
}

function btUpdateBots(dt) {
    if (!btActive) return;
    btBots.forEach(bot => {
        if (!bot.alive) return;
        const cfg = bot.cfg;
        const px = onPos.x, pz = onPos.z;
        const bx = bot.group.position.x, bz = bot.group.position.z;
        const dx = px - bx, dz = pz - bz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const canSee = dist < cfg.vision;

        if (!canSee) {
            bot.state = 'patrol';
            bot.reactionT = cfg.reactionT;
        } else if (canSee && bot.reactionT > 0) {
            bot.reactionT -= dt;
            bot.state = 'chase';
        } else {
            bot.state = dist > 5 ? 'chase' : 'shoot';
        }

        if (bot.state === 'patrol') {
            if (!bot.patrolTarget || btDist(bot.group.position, bot.patrolTarget) < 1.2) {
                bot.patrolTarget = { x: (Math.random() - 0.5) * 24, z: (Math.random() - 0.5) * 24 };
            }
            const tx = bot.patrolTarget.x - bx, tz = bot.patrolTarget.z - bz;
            const td = Math.sqrt(tx * tx + tz * tz) || 1;
            const spd = cfg.spd * 0.5 * dt;
            const nx = bx + tx / td * spd, nz = bz + tz / td * spd;
            if (!onCollides(nx, nz)) {
                bot.group.position.x = nx;
                bot.group.position.z = nz;
            }
            bot.group.rotation.y = Math.atan2(tx, tz);
        }

        if (bot.state === 'chase' || bot.state === 'shoot') {
            bot.group.rotation.y = Math.atan2(dx, dz);
            if (bot.state === 'chase' && dist > 1.5) {
                const spd = cfg.spd * dt;
                const nx = bx + dx / dist * spd, nz = bz + dz / dist * spd;
                if (!onCollides(nx, nz)) {
                    bot.group.position.x = nx;
                    bot.group.position.z = nz;
                } else {
                    const nx2 = bx + (-dz / dist) * spd, nz2 = bz + (dx / dist) * spd;
                    if (!onCollides(nx2, nz2)) {
                        bot.group.position.x = nx2;
                        bot.group.position.z = nz2;
                    }
                }
            }
        }

        bot.shootCd = Math.max(0, bot.shootCd - dt * 1000);
        if (bot.state === 'shoot' && bot.shootCd <= 0 && onAlive) {
            bot.shootCd = cfg.shootCd;
            const aimX = dx / dist + (Math.random() - 0.5) * cfg.aimErr * 2;
            const aimZ = dz / dist + (Math.random() - 0.5) * cfg.aimErr * 2;
            const acc = 1 - cfg.aimErr;
            const roll = Math.random();
            if (roll < acc) {
                const r2 = Math.random();
                const zone = r2 < 0.15 ? 'head' : r2 < 0.55 ? 'body' : 'legs';
                const dmg = zone === 'head' ? 50 : zone === 'body' ? cfg.dmg : 15;
                onMyHP = Math.max(0, onMyHP - dmg);
                onUpdateHP(onMyHP);
                onHandleDamage({ hp: onMyHP, dmg, zone });
                if (onMyHP <= 0) btPlayerDied(bot);
            }
            if (bot.group.userData.anim) bot.group.userData.anim.shootT = 1;
            onAddFeed(bot.name + ' ➤ ' + (currentUser?.name || 'TÚ'), '#4488ff');
        }

        onAnimateChar(bot.group, dt);
    });
}

function btDist(a, b) {
    const dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function btPlayerDied(killer) {
    if (!onAlive) return;
    onAlive = false;
    onTeamScores[1] = (onTeamScores[1] || 0) + 1;
    document.getElementById('duel-opp-kills').textContent = onTeamScores[1];
    document.getElementById('duel-death-vignette').style.display = 'block';
    document.getElementById('duel-death-vignette').style.opacity = '1';
    const rm = document.getElementById('duel-respawn-msg');
    rm.textContent = '💀 REAPARECIENDO...';
    rm.style.display = 'block';
    rm.style.color = '#ff3d71';
    if (onTeamScores[1] >= btFirstTo) {
        btGameOver(false);
        return;
    }
    setTimeout(() => {
        if (!btActive) return;
        onSpawnPlayer(onMySpawn);
        document.getElementById('duel-death-vignette').style.display = 'none';
        document.getElementById('duel-respawn-msg').style.display = 'none';
        btBots.forEach(b => btRespawnBot(b));
    }, 1500);
}

function btBotKilled(bot) {
    bot.alive = false;
    bot.hp = 0;
    onOpps.delete(bot.slot);
    if (bot.group.userData.anim) {
        bot.group.userData.anim.dead = true;
        bot.group.userData.anim.deathT = 0;
    }
    setTimeout(() => {
        onScene.remove(bot.group);
    }, 1500);

    onTeamScores[0] = (onTeamScores[0] || 0) + 1;
    document.getElementById('duel-my-kills').textContent = onTeamScores[0];
    onAddFeed((currentUser?.name || 'TÚ') + ' ➤ ' + bot.name, '#44ff88');

    const wrap = document.getElementById('duel-opp-hp-wrap');
    const bar = document.getElementById('duel-opp-hp-bar');
    const num = document.getElementById('duel-opp-hp-num');
    if (wrap) wrap.style.display = 'flex';
    if (bar) {
        bar.style.width = '0%';
        bar.style.background = 'linear-gradient(90deg,#ff2200,#ff5533)';
    }
    if (num) {
        num.textContent = 0;
        num.style.color = '#ff4444';
    }

    if (onTeamScores[0] >= btFirstTo) {
        btGameOver(true);
        return;
    }

    setTimeout(() => {
        if (!btActive) return;
        btRespawnBot(bot);
        onSpawnPlayer(onMySpawn);
        document.getElementById('duel-death-vignette').style.display = 'none';
        document.getElementById('duel-respawn-msg').style.display = 'none';
    }, 1500);
}

function btRespawnBot(bot) {
    const sp = BT_SPAWNS_BLUE[bot.slot % BT_SPAWNS_BLUE.length];
    const col = TEAM_COLORS[1] || 0x2277ff;
    const g = onCreateRobloxChar(col);
    g.position.set(sp.x + (Math.random() - 0.5) * 2, 0, sp.z + (Math.random() - 0.5) * 2);
    onScene.add(g);
    bot.group = g;
    bot.hp = 100;
    bot.alive = true;
    bot.spawn = sp;
    bot.hitbox = g.userData.hitbox;
    bot.headHitbox = g.userData.headHitbox;
    bot.legHitbox = g.userData.legHitbox;
    onOpps.set(bot.slot, { group: g, hitbox: g.userData.hitbox, headHitbox: g.userData.headHitbox, legHitbox: g.userData.legHitbox });
    const bar = document.getElementById('duel-opp-hp-bar');
    const num = document.getElementById('duel-opp-hp-num');
    if (bar) {
        bar.style.width = '100%';
        bar.style.background = 'linear-gradient(90deg,#44cc66,#66ff88)';
    }
    if (num) {
        num.textContent = 100;
        num.style.color = '#66ff88';
    }
}

function btGameOver(won) {
    btActive = false;
    const t = document.getElementById('duel-go-title');
    const s = document.getElementById('duel-go-score');
    if (t) {
        t.textContent = won ? '¡VICTORIA!' : 'DERROTA';
        t.style.color = won ? 'var(--green)' : 'var(--accent2)';
    }
    if (s) s.textContent = 'Tú ' + onTeamScores[0] + ' — Bots ' + onTeamScores[1];
    document.getElementById('duel-go-vs').textContent = 'VS BOTS · ' + btDiff.toUpperCase();
    onShowScreen('duel-gameover-screen');
    document.getElementById('play-again-btn').onclick = () => {
        onShowScreen(null);
        botsStartMatch(btBots.length, btDiff);
    };
    document.getElementById('menu-btn').onclick = () => {
        botsCleanup();
        onShowScreen(null);
        document.getElementById('menu-screen').classList.remove('hidden');
    };
}

function botsCleanup() {
    btActive = false;
    btBots.forEach(b => {
        if (b.group && onScene) onScene.remove(b.group);
    });
    btBots = [];
    onOpps.clear();
    if (btAnimId) {
        cancelAnimationFrame(btAnimId);
        btAnimId = null;
    }
    onActive = false;
    onLocked = false;
    try { document.exitPointerLock(); } catch (e) { }
}

// Sobrescribir onTryShoot para que funcione con bots
const _origTryShoot = window.onTryShoot;
window.onTryShoot = function() {
    if (!btActive) {
        if (_origTryShoot) _origTryShoot();
        return;
    }
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

    for (let p = 0; p < wp.pellets; p++) {
        const dx2 = (Math.random() - 0.5) * wp.spread * 2;
        const dy2 = (Math.random() - 0.5) * wp.spread * 2;
        onRaycaster.setFromCamera(new THREE.Vector2(dx2, dy2), onCamera);
        const wallHits = onRaycaster.intersectObjects(onWalls, false);
        const wallDist = wallHits.length > 0 ? wallHits[0].distance : Infinity;

        // Cabeza
        const heads = btBots.filter(b => b.alive && b.headHitbox).map(b => b.headHitbox);
        const hh = onRaycaster.intersectObjects(heads, false);
        if (hh.length > 0 && hh[0].distance < wallDist) {
            const bot = btBots.find(b => b.headHitbox === hh[0].object);
            if (bot && bot.alive) {
                btDamageBotByPlayer(bot, wp.dmgHead, 'head');
                onShowHitMarker(true);
                continue;
            }
        }
        // Cuerpo
        const bodies = btBots.filter(b => b.alive && b.hitbox).map(b => b.hitbox);
        const bh = onRaycaster.intersectObjects(bodies, false);
        if (bh.length > 0 && bh[0].distance < wallDist) {
            const bot = btBots.find(b => b.hitbox === bh[0].object);
            if (bot && bot.alive) {
                btDamageBotByPlayer(bot, wp.dmgBody, 'body');
                onShowHitMarker(false);
                continue;
            }
        }
        // Piernas
        const legs = btBots.filter(b => b.alive && b.legHitbox).map(b => b.legHitbox);
        const lh = onRaycaster.intersectObjects(legs, false);
        if (lh.length > 0 && lh[0].distance < wallDist) {
            const bot = btBots.find(b => b.legHitbox === lh[0].object);
            if (bot && bot.alive) {
                btDamageBotByPlayer(bot, wp.dmgLegs, 'legs');
                onShowHitMarker(false);
            }
        }
    }
};

function btDamageBotByPlayer(bot, dmg, zone) {
    bot.hp = Math.max(0, bot.hp - dmg);
    bot.group.traverse(c => {
        if (c.isMesh && c.material?.color) {
            if (!c.userData._oc) c.userData._oc = c.material.color.getHex();
            c.material.color.setHex(0xff1100);
        }
    });
    setTimeout(() => {
        bot.group.traverse(c => {
            if (c.isMesh && c.userData._oc) c.material.color.setHex(c.userData._oc);
        });
    }, 90);
    onUpdateOppHP({ slot: bot.slot, hp: bot.hp, dmg, zone });
    if (bot.hp <= 0) btBotKilled(bot);
}

function btBuildMap() {
    // Cielo de día, luz de tarde
    onScene.background = new THREE.Color(0x7ab8d4);
    onScene.fog = new THREE.Fog(0x9dcce0, 35, 90);
    
    // Luces
    onScene.add(new THREE.AmbientLight(0xfff0dd, 0.9));
    const sun = new THREE.DirectionalLight(0xffe8aa, 1.4);
    sun.position.set(15, 28, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
    onScene.add(sun);
    const fill = new THREE.DirectionalLight(0x88aacc, 0.4);
    fill.position.set(-10, 12, -18);
    onScene.add(fill);
    
    function addM(obj) { obj.userData.isMapObj = true; onScene.add(obj); return obj; }
    
    // Suelo
    const gc = document.createElement('canvas');
    gc.width = gc.height = 1024;
    const gx = gc.getContext('2d');
    gx.fillStyle = '#b8924a';
    gx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 120; i++) {
        gx.fillStyle = `rgba(${160 + Math.random() * 30 | 0},${120 + Math.random() * 20 | 0},${50 + Math.random() * 20 | 0},0.4)`;
        gx.fillRect(Math.random() * 1024, Math.random() * 1024, 20 + Math.random() * 50, 15 + Math.random() * 35);
    }
    gx.fillStyle = '#6a8c3a';
    const grassPatches = [
        [0,0,260,260], [764,0,260,260], [0,764,260,260], [764,764,260,260],
        [280,180,80,60], [650,700,90,55], [350,620,70,60], [700,300,65,55],
        [120,450,85,50], [830,420,80,55]
    ];
    grassPatches.forEach(([x,y,w,h]) => gx.fillRect(x,y,w,h));
    gx.strokeStyle = '#c8a060';
    gx.lineWidth = 55;
    gx.beginPath();
    gx.ellipse(512, 512, 460, 460, 0, 0, Math.PI * 2);
    gx.stroke();
    gx.fillStyle = 'rgba(100,0,0,0.3)';
    gx.beginPath();
    gx.ellipse(512, 560, 35, 20, 0, 0, Math.PI * 2);
    gx.fill();
    gx.beginPath();
    gx.ellipse(490, 590, 20, 12, 0.5, 0, Math.PI * 2);
    gx.fill();
    gx.save();
    gx.globalAlpha = 0.22;
    gx.font = 'bold 90px Arial Black';
    gx.textAlign = 'center';
    gx.textBaseline = 'middle';
    gx.fillStyle = '#ffffff';
    gx.fillText('BOT', 512, 470);
    gx.fillText('TRAINING', 512, 570);
    gx.restore();
    const groundTex = new THREE.CanvasTexture(gc);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(52, 52), new THREE.MeshLambertMaterial({ map: groundTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    addM(ground);
    
    // Muro perimetral de piedra
    const wallM = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
    const wallTop = new THREE.MeshLambertMaterial({ color: 0x6a5a3a });
    function addPerimWall(cx, cz, w, d) {
        const wl = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), wallM);
        wl.position.set(cx, 0.55, cz);
        wl.castShadow = true;
        addM(wl);
        onWalls.push(wl);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.18, d + 0.05), wallTop);
        cap.position.set(cx, 1.15, cz);
        addM(cap);
        onObs.push({ x: cx, z: cz, hw: w / 2 + 0.1, hd: d / 2 + 0.1 });
    }
    addPerimWall(0, -22, 20, 1.0);
    addPerimWall(0, 22, 20, 1.0);
    addPerimWall(-22, 0, 1.0, 20);
    addPerimWall(22, 0, 1.0, 20);
    addPerimWall(-11, -22, 8, 1.0);
    addPerimWall(11, -22, 8, 1.0);
    addPerimWall(-11, 22, 8, 1.0);
    addPerimWall(11, 22, 8, 1.0);
    addPerimWall(-22, -11, 1.0, 8);
    addPerimWall(-22, 11, 1.0, 8);
    addPerimWall(22, -11, 1.0, 8);
    addPerimWall(22, 11, 1.0, 8);
    
    // Bloques de concreto centrales
    const concM = new THREE.MeshLambertMaterial({ color: 0xb0b8c0 });
    const concD = new THREE.MeshLambertMaterial({ color: 0x8a9298 });
    function addConcreteBlock(x, z, w = 1.8, h = 1.5, d = 0.6, ry = 0) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concM);
        b.position.set(x, h / 2, z);
        b.rotation.y = ry;
        b.castShadow = true;
        addM(b);
        onWalls.push(b);
        const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.1, d + 0.05), concD);
        top.position.set(x, h + 0.05, z);
        top.rotation.y = ry;
        addM(top);
        const hw = ry !== 0 ? d / 2 + 0.15 : w / 2 + 0.15;
        const hd = ry !== 0 ? w / 2 + 0.15 : d / 2 + 0.15;
        onObs.push({ x, z, hw, hd });
    }
    addConcreteBlock(-3.5, -7);
    addConcreteBlock(3.5, -7);
    addConcreteBlock(-4, 0);
    addConcreteBlock(4, 0);
    addConcreteBlock(-3.5, 7);
    addConcreteBlock(3.5, 7);
    addConcreteBlock(0, -10);
    
    // Base roja
    const redM = new THREE.MeshLambertMaterial({ color: 0xcc2200 });
    const redBase = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.8, 4.5), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    redBase.position.set(-14, 1.4, 14);
    addM(redBase);
    onWalls.push(redBase);
    onObs.push({ x: -14, z: 14, hw: 3.0, hd: 2.5 });
    const redRoofM = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.2, 4.7), redM);
    redRoofM.position.set(-14, 2.9, 14);
    addM(redRoofM);
    const rdoorL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 0.3), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    rdoorL.position.set(-15.5, 1.4, 11.8);
    addM(rdoorL);
    const rdoorR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 0.3), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    rdoorR.position.set(-12.5, 1.4, 11.8);
    addM(rdoorR);
    const rSign = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
    rSign.position.set(-14, 2.5, 11.64);
    addM(rSign);
    const rLight = new THREE.PointLight(0xff4400, 1.8, 8);
    rLight.position.set(-14, 2, 14);
    addM(rLight);
    
    // Base azul
    const blueM = new THREE.MeshLambertMaterial({ color: 0x1155cc });
    const blueBase = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.8, 4.5), new THREE.MeshLambertMaterial({ color: 0x4a6a8a }));
    blueBase.position.set(14, 1.4, 14);
    addM(blueBase);
    onWalls.push(blueBase);
    onObs.push({ x: 14, z: 14, hw: 3.0, hd: 2.5 });
    const blueRoofM = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.2, 4.7), blueM);
    blueRoofM.position.set(14, 2.9, 14);
    addM(blueRoofM);
    const bdoorL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 0.3), new THREE.MeshLambertMaterial({ color: 0x4a6a8a }));
    bdoorL.position.set(12.5, 1.4, 11.8);
    addM(bdoorL);
    const bdoorR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 0.3), new THREE.MeshLambertMaterial({ color: 0x4a6a8a }));
    bdoorR.position.set(15.5, 1.4, 11.8);
    addM(bdoorR);
    const bLight = new THREE.PointLight(0x2244ff, 1.8, 8);
    bLight.position.set(14, 2, 14);
    addM(bLight);
    
    // Cajas
    const boxM = new THREE.MeshLambertMaterial({ color: 0x8B5c1a });
    [[-18, -8, 0.3], [-17, -5, 0], [-16, -14, 0.1], [18, -8, -0.2], [17, -5, 0.1], [16, -13, -0.1],
     [-18, 5, 0.2], [18, 5, -0.15], [-8, -18, 0.4], [8, -18, -0.3], [-8, 18, 0.1], [8, 18, 0.2]].forEach(([x, z, ry]) => {
        const sz = 0.55 + Math.random() * 0.3;
        const box = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), boxM);
        box.position.set(x, sz / 2, z);
        box.rotation.y = ry;
        box.castShadow = true;
        addM(box);
    });
    
    // Barriles
    [[0xcc2200, -20, -14], [0xcc2200, -19, -10], [0x1155cc, 20, -14], [0x1155cc, 19, -10],
     [0x226622, -16, 0], [0x226622, 16, 0], [0xaa8800, -10, -20], [0xaa8800, 10, -20],
     [0xcc2200, -20, 14], [0x1155cc, 20, 14]].forEach(([col, x, z]) => {
        const brl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.72, 10), new THREE.MeshLambertMaterial({ color: col }));
        brl.position.set(x, 0.36, z);
        brl.castShadow = true;
        addM(brl);
    });
    
    // Sacos de arena perimetrales
    const sandM = new THREE.MeshLambertMaterial({ color: 0xc8a86a });
    function addSandbags(cx, cz, count, dir) {
        for (let i = 0; i < count; i++) {
            const sb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.42), sandM);
            const stagger = (i % 2) * 0.08;
            sb.position.set(cx + dir[0] * i * 0.5, 0.2 + stagger, cz + dir[1] * i * 0.5);
            sb.rotation.y = (Math.random() - 0.5) * 0.3;
            sb.castShadow = true;
            addM(sb);
        }
    }
    addSandbags(-20, -20, 5, [1, 0]);
    addSandbags(15, -20, 5, [1, 0]);
    addSandbags(-20, 20, 5, [1, 0]);
    addSandbags(15, 20, 5, [1, 0]);
    addSandbags(-22, -18, 5, [0, 1]);
    addSandbags(-22, 13, 5, [0, 1]);
    addSandbags(21, -18, 5, [0, 1]);
    addSandbags(21, 13, 5, [0, 1]);
    
    // Conos naranja
    const coneM = new THREE.MeshLambertMaterial({ color: 0xff6600 });
    [[-5, -3], [5, -3], [0, 4], [-3, 10], [3, 10], [-8, 2], [8, 2]].forEach(([x, z]) => {
        if (!isNaN(x)) {
            const cone = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.18, 0.55, 8), coneM);
            cone.position.set(x, 0.275, z);
            addM(cone);
        }
    });
    
    // Árboles en bordes
    const trunkM = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
    const leavesColors = [0x2d5a1b, 0x3a7a22, 0x255a18, 0x4a8a28];
    [[-22, -22], [22, -22], [-22, 22], [22, 22], [-22, -8], [22, -8], [-22, 8], [22, 8], [0, -24], [0, 24]].forEach(([x, z], i) => {
        const h = 2.5 + Math.random() * 0.8;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h, 6), trunkM);
        trunk.position.set(x, h / 2, z);
        addM(trunk);
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 0.4, 7, 5), new THREE.MeshLambertMaterial({ color: leavesColors[i % 4] }));
        leaves.position.set(x, h + 0.7, z);
        leaves.castShadow = true;
        addM(leaves);
    });
    
    // Antorcha/fuego en base roja
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), new THREE.MeshBasicMaterial({ color: 0xff6600 }));
    flame.position.set(-17, 1.1, 14);
    flame.userData.isFlame = true;
    addM(flame);
    const fLight = new THREE.PointLight(0xff4400, 2, 5);
    fLight.position.set(-17, 1.5, 14);
    fLight.userData.isFlameLight = true;
    addM(fLight);
    function flickerBt() {
        onScene.children.forEach(c => {
            if (c.userData.isFlame) { c.scale.y = 0.9 + Math.random() * 0.25; c.rotation.y += 0.1; }
            if (c.userData.isFlameLight) c.intensity = 1.5 + Math.random() * 1.2;
        });
        if (btActive) requestAnimationFrame(flickerBt);
    }
    flickerBt();
}