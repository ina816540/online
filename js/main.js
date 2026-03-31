// ============================================================
// PUNTO DE ENTRADA PRINCIPAL
// ============================================================

// Variables globales necesarias
const resultsScreen = document.getElementById('results-screen');
const menuScreen = document.getElementById('menu-screen');

// Inicializar dificultad por defecto
window.selDiff = 'medium';

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar configuración UI
    initCFG();
    applyCH();

    // Cargar sesión de usuario
    loadSession();
    if (currentUser) {
        showMenu();
        loadMyConfig();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
    }

    // Configurar eventos globales de las pantallas
    setupEventListeners();
});

function setupEventListeners() {
    // --- Menú principal ---
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        clearSession();
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('login-msg').textContent = '';
    });

    // Leaderboard
    document.getElementById('open-lb-btn')?.addEventListener('click', () => {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('lb-screen').classList.remove('hidden');
        loadLB();
    });
    document.getElementById('lb-back-btn')?.addEventListener('click', () => {
        document.getElementById('lb-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
    });
    document.getElementById('lb-refresh-btn')?.addEventListener('click', loadLB);
    document.getElementById('lb-tabs')?.querySelectorAll('.lb-tab').forEach(t => {
        t.addEventListener('click', () => {
            document.querySelectorAll('.lb-tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            lbMode = t.dataset.mode;
            loadLB();
        });
    });

    // Estadísticas
    document.getElementById('open-stats-btn')?.addEventListener('click', () => {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('stats-screen').classList.remove('hidden');
        loadStats();
    });
    document.getElementById('stats-back-btn')?.addEventListener('click', () => {
        document.getElementById('stats-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
    });

    // Amigos
    document.getElementById('open-friends-btn')?.addEventListener('click', () => {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('friends-screen').classList.remove('hidden');
        loadFriends();
    });
    document.getElementById('friends-back-btn')?.addEventListener('click', () => {
        document.getElementById('friends-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
    });
    document.getElementById('friend-search-btn')?.addEventListener('click', searchFriend);
    document.getElementById('friend-search-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') searchFriend();
    });

    // --- Modo VS BOTS ---
    document.getElementById('open-bots-btn')?.addEventListener('click', () => {
        if (onActive || (onWS && onWS.readyState === WebSocket.OPEN)) {
            alert("⚠ Ya estás en una partida o sala. Sal de ella antes de iniciar VS Bots.");
            return;
        }
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('bots-screen').classList.remove('hidden');
    });
    document.getElementById('bots-back-btn')?.addEventListener('click', () => {
        document.getElementById('bots-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
    });
    // Número de bots
    document.querySelectorAll('.bot-count-btn').forEach(b => {
        b.addEventListener('click', () => {
            botsCount = parseInt(b.dataset.n);
            document.querySelectorAll('.bot-count-btn').forEach(x => {
                x.style.background = 'rgba(34,119,204,.35)';
                x.style.border = '1px solid rgba(34,119,204,.5)';
            });
            b.style.background = 'rgba(34,119,204,.8)';
            b.style.border = 'none';
            updateBotsDesc();
        });
    });
    // Dificultad bots
    document.querySelectorAll('.bot-diff-btn').forEach(b => {
        b.addEventListener('click', () => {
            botsDiff = b.dataset.d;
            document.querySelectorAll('.bot-diff-btn').forEach(x => {
                x.style.opacity = '.5';
                x.style.fontWeight = '400';
            });
            b.style.opacity = '1';
            b.style.fontWeight = '900';
            updateBotsDesc();
        });
    });
    document.getElementById('bots-start-btn')?.addEventListener('click', () => {
        document.getElementById('bots-screen').classList.add('hidden');
        botsStartMatch(botsCount, botsDiff);
    });

    // --- Modo ZOMBIES ---
    document.getElementById('open-zombie-btn')?.addEventListener('click', () => {
        menuScreen.classList.add('hidden');
        onMyName = currentUser?.name || 'Jugador';
        onMySpawn = { x: 0, z: 0, yaw: 0 };
        zmStart();
    });

    // --- Modo ONLINE (1v1, etc.) ---
    document.getElementById('open-1v1-btn')?.addEventListener('click', () => {
        menuScreen.classList.add('hidden');
        onShowScreen('duel-lobby-screen');
        onMyName = currentUser?.name || 'Jugador';
        onConnect();
    });
    document.getElementById('duel-lobby-back')?.addEventListener('click', () => {
        onDisconnect();
        onShowScreen(null);
        menuScreen.classList.remove('hidden');
    });
    document.getElementById('duel-refresh-rooms')?.addEventListener('click', () => onSend({ type: 'get_rooms' }));
    document.getElementById('duel-open-create')?.addEventListener('click', () => {
        document.getElementById('duel-room-name').value = '';
        document.getElementById('duel-create-err').textContent = '';
        document.getElementById('duel-is-private').checked = false;
        document.getElementById('duel-password-wrap').style.display = 'none';
        onShowScreen('duel-create-screen');
    });
    document.getElementById('duel-create-back-btn')?.addEventListener('click', () => onShowScreen('duel-lobby-screen'));
    document.getElementById('duel-is-private')?.addEventListener('change', function () {
        document.getElementById('duel-password-wrap').style.display = this.checked ? 'block' : 'none';
    });
    document.querySelectorAll('#duel-mode-pills .diff-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#duel-mode-pills .diff-btn').forEach(x => x.classList.remove('act'));
            b.classList.add('act');
            onCreateMode = b.dataset.mode;
        });
    });
    document.getElementById('duel-do-create')?.addEventListener('click', () => {
        const name = document.getElementById('duel-room-name').value.trim();
        const isPrivate = document.getElementById('duel-is-private').checked;
        const pw = document.getElementById('duel-room-password').value;
        if (!name) {
            document.getElementById('duel-create-err').textContent = 'Pon un nombre a la sala';
            return;
        }
        if (isPrivate && !pw) {
            document.getElementById('duel-create-err').textContent = 'Pon una contraseña';
            return;
        }
        if (!onWS || onWS.readyState !== 1) {
            document.getElementById('duel-create-err').textContent = 'Sin conexión al servidor';
            return;
        }
        onSend({ type: 'create_room', name, mode: onCreateMode, isPrivate, password: pw, playerName: onMyName });
    });
    document.getElementById('duel-waiting-back')?.addEventListener('click', () => {
        if (onWS) {
            onWS.close();
            onWS = null;
        }
        onCleanup();
        onShowScreen(null);
        menuScreen.classList.remove('hidden');
        onActive = false;
        onLocked = false;
        try { document.exitPointerLock(); } catch(e) {}
    });
    document.getElementById('duel-force-start')?.addEventListener('click', () => onSend({ type: 'force_start' }));
    document.getElementById('duel-rematch-btn')?.addEventListener('click', () => {
        onWS?.close();
        onCleanup();
        onShowScreen('duel-lobby-screen');
        onConnect();
    });
    document.getElementById('duel-menu-btn')?.addEventListener('click', () => {
        onWS?.close();
        onCleanup();
        onShowScreen(null);
        menuScreen.classList.remove('hidden');
    });

    // --- Botón de salida en pantalla de bloqueo online ---
    document.getElementById('duel-exit-menu-btn')?.addEventListener('click', () => {
        if (onWS) {
            onWS.close();
            onWS = null;
        }
        onCleanup();
        onShowScreen(null);
        menuScreen.classList.remove('hidden');
        onActive = false;
        onLocked = false;
        try { document.exitPointerLock(); } catch(e) {}
    });

    // --- Pausa (práctica) ---
    document.getElementById('pause-resume-btn')?.addEventListener('click', () => {
        document.getElementById('three-canvas').requestPointerLock();
    });
    document.getElementById('pause-quit-btn')?.addEventListener('click', () => {
        document.getElementById('pause-overlay').style.display = 'none';
        paused = false;
        endGame();
        setTimeout(() => {
            resultsScreen.classList.add('hidden');
            menuScreen.classList.remove('hidden');
        }, 50);
    });

    // --- Bloqueo del ratón ---
    document.getElementById('lock-btn')?.addEventListener('click', () => {
        document.getElementById('three-canvas').requestPointerLock();
    });
    document.getElementById('duel-lock-btn')?.addEventListener('click', () => {
        if (mobileMode && onActive) {
            onLocked = true;
            document.getElementById('duel-lock-screen').style.display = 'none';
            document.getElementById('duel-crosshair').style.display = 'block';
            document.getElementById('duel-mobile-controls').classList.add('active');
        } else {
            document.getElementById('duel-canvas').requestPointerLock();
        }
    });

    // --- Eventos de teclado (globales) ---
    document.addEventListener('keydown', e => {
        // ESC para salir del modo práctica
        if (e.key === 'Escape' && state && state.running && locked) {
            document.exitPointerLock();
        }
        // Teclas para el modo multijugador / bots / zombies
        onKeys[e.key] = true;
        if (!onActive) return;
        if (e.key === '1') onSwitchWeapon('pistol');
        if (e.key === '2') onSwitchWeapon('rifle');
        if (e.key === '3') onSwitchWeapon('shotgun');
        if (e.key === 'r' || e.key === 'R') onStartReload();
        if (e.key === 'g' || e.key === 'G') {
            if (zmActive || onActive) onThrowGrenade();
        }
    });
    document.addEventListener('keyup', e => { onKeys[e.key] = false; });

    // --- Movimiento del ratón para multijugador / bots / zombies ---
    document.addEventListener('mousemove', e => {
        if ((!onLocked && !mobileMode) || !onActive) return;
        onMX += e.movementX;
        onMY += e.movementY;
    });

    // --- Disparo (corregido) ---
    const canvas3d = document.getElementById('three-canvas');
    canvas3d?.addEventListener('click', onShoot);
    const duelCanvas = document.getElementById('duel-canvas');
    duelCanvas?.addEventListener('click', () => {
        console.log("Click en canvas duel, onLocked:", onLocked, "onActive:", onActive);
        // Si el puntero NO está bloqueado y el juego está activo, bloqueamos
        if (!onLocked && onActive && !mobileMode) {
            duelCanvas.requestPointerLock();
            return;
        }
        // Si el puntero está bloqueado (o en móvil), disparamos
        if (onLocked || mobileMode) {
            if (zmActive) zmOnShoot();
            else if (onActive) onTryShoot();
        }
    });

    // --- Salir de partida (práctica) ---
    document.getElementById('quit-btn')?.addEventListener('click', endGame);

    // --- Resultados: jugar de nuevo o menú ---
    document.getElementById('play-again-btn')?.addEventListener('click', () => {
        resultsScreen.classList.add('hidden');
        startGame(window.selMode, window.selDiff);
    });
    document.getElementById('menu-btn')?.addEventListener('click', () => {
        resultsScreen.classList.add('hidden');
        menuScreen.classList.remove('hidden');
    });

    // --- Botón "JUGAR" en el menú principal ---
    document.getElementById('start-btn')?.addEventListener('click', () => {
        startGame(window.selMode, window.selDiff);
    });

    // --- Dificultad (selector) ---
    document.querySelectorAll('.diff-btn[data-d]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.diff-btn[data-d]').forEach(b => b.classList.remove('act'));
            btn.classList.add('act');
            window.selDiff = btn.dataset.d;
        });
    });

    // --- Actualizar last_seen cada minuto ---
    setInterval(() => {
        if (currentUser) {
            sbClient.from('game_users').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
        }
    }, 60000);
}

function showMenu() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('menu-user-av').textContent = currentUser.avatar;
    document.getElementById('menu-user-name').textContent = currentUser.name.toUpperCase();
    loadMyConfig();
    buildMenu();   // Construye la cuadrícula de modos de práctica
}

function onShowScreen(id) {
    const screens = ['duel-lobby-screen', 'duel-create-screen', 'duel-waiting-screen', 'duel-gameover-screen'];
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });
    if (id) document.getElementById(id).classList.remove('hidden');
}

function updateBotsDesc() {
    const diffMap = {
        easy: { label: 'FÁCIL', col: '#66ff66', txt: 'patrullan lentamente y tienen mala puntería' },
        medium: { label: 'MEDIO', col: '#ffaa00', txt: 'rastrean tu posición y disparan con precisión normal' },
        hard: { label: 'DIFÍCIL', col: '#ff4444', txt: 'reaccionan rápido, flanquean y tienen mira precisa' }
    };
    const d = diffMap[botsDiff];
    document.getElementById('bots-desc').innerHTML = `<b style="color:${d.col}">${d.label}</b> — Los bots ${d.txt}<br><b style="color:#fff">${botsCount} BOT${botsCount > 1 ? 'S' : ''}</b> — Mapa PVP normal, kills hasta 10`;
}

// Variables globales para bots
let botsCount = 1, botsDiff = 'easy';
window.botsCount = botsCount;
window.botsDiff = botsDiff;