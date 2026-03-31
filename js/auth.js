// ============================================================
// SISTEMA DE AUTENTICACIÓN y ESTADÍSTICAS
// ============================================================

let currentUser = null;
let selectedAvatar = '🎯';
let usernameCheckTimer = null;

async function hashPassword(pw) {
    const enc = new TextEncoder();
    const data = enc.encode('inatrainer_2025_' + pw);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function loadSession() {
    try {
        const s = localStorage.getItem('ina_session');
        if (s) currentUser = JSON.parse(s);
    } catch(e) {}
}

function saveSession() {
    try {
        localStorage.setItem('ina_session', JSON.stringify(currentUser));
    } catch(e) {}
}

function clearSession() {
    currentUser = null;
    try {
        localStorage.removeItem('ina_session');
    } catch(e) {}
}

function switchTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const panelLogin = document.getElementById('panel-login');
    const panelRegister = document.getElementById('panel-register');
    const loginMsg = document.getElementById('login-msg');
    const registerMsg = document.getElementById('register-msg');
    
    tabLogin.classList.toggle('active', tab === 'login');
    tabRegister.classList.toggle('active', tab === 'register');
    panelLogin.style.display = tab === 'login' ? 'flex' : 'none';
    panelRegister.style.display = tab === 'register' ? 'flex' : 'none';
    if (loginMsg) loginMsg.textContent = '';
    if (registerMsg) registerMsg.textContent = '';
}

function updatePwStrength() {
    const pw = document.getElementById('reg-password').value;
    const fill = document.getElementById('pw-strength-fill');
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    const colors = ['#ff3d71', '#ff9500', '#ffd700', '#00ff88'];
    const widths = ['25%', '50%', '75%', '100%'];
    fill.style.width = pw.length ? widths[score - 1] || '10%' : '0%';
    fill.style.background = pw.length ? colors[score - 1] || '#ff3d71' : 'transparent';
}

function checkUsernameAvail() {
    const el = document.getElementById('username-avail');
    const val = document.getElementById('reg-username').value.trim();
    el.textContent = '';
    if (val.length < 3) return;
    clearTimeout(usernameCheckTimer);
    el.style.color = 'var(--dim)';
    el.textContent = '⟳ Verificando...';
    usernameCheckTimer = setTimeout(async () => {
        try {
            const { data } = await sbClient.from('game_users').select('id').eq('username', val.toLowerCase()).limit(1);
            if (data && data.length > 0) {
                el.style.color = 'var(--accent2)';
                el.textContent = '✗ Nombre no disponible';
            } else {
                el.style.color = 'var(--green)';
                el.textContent = '✓ Nombre disponible';
            }
        } catch(e) { el.textContent = ''; }
    }, 500);
}

function setBtnLoading(id, loading) {
    const btn = document.getElementById(id);
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
}

function showAuthMsg(panel, text, isError) {
    const el = document.getElementById(panel + '-msg');
    el.className = 'auth-msg ' + (isError ? 'error' : 'success');
    el.textContent = text;
}

async function doRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    showAuthMsg('register', '', false);
    
    if (username.length < 3) {
        showAuthMsg('register', 'El nombre debe tener al menos 3 caracteres', true);
        return;
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(username)) {
        showAuthMsg('register', 'Solo letras, números, _ - .', true);
        return;
    }
    if (password.length < 6) {
        showAuthMsg('register', 'La contraseña debe tener al menos 6 caracteres', true);
        return;
    }
    if (password !== confirm) {
        showAuthMsg('register', 'Las contraseñas no coinciden', true);
        return;
    }
    
    setBtnLoading('register-submit', true);
    try {
        const { data: existing } = await sbClient.from('game_users').select('id').eq('username', username.toLowerCase()).limit(1);
        if (existing && existing.length > 0) {
            showAuthMsg('register', '⚠ Ese nombre de usuario ya está en uso', true);
            setBtnLoading('register-submit', false);
            return;
        }
        const hash = await hashPassword(password);
        const { data, error } = await sbClient.from('game_users').insert({
            username: username.toLowerCase(),
            display_name: username,
            password_hash: hash,
            avatar: selectedAvatar,
            created_at: new Date().toISOString()
        }).select().single();
        if (error) throw error;
        currentUser = { id: data.id, name: data.display_name, avatar: data.avatar };
        saveSession();
        showAuthMsg('register', '✓ ¡Cuenta creada! Entrando...', false);
        setTimeout(showMenu, 800);
    } catch(e) {
        console.error(e);
        showAuthMsg('register', '⚠ Error al crear cuenta. Inténtalo de nuevo.', true);
    }
    setBtnLoading('register-submit', false);
}

async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    showAuthMsg('login', '', false);
    if (!username || !password) {
        showAuthMsg('login', '⚠ Rellena todos los campos', true);
        return;
    }
    setBtnLoading('login-submit', true);
    try {
        const hash = await hashPassword(password);
        const { data, error } = await sbClient.from('game_users')
            .select('id, display_name, avatar, password_hash')
            .eq('username', username.toLowerCase())
            .single();
        if (error || !data) {
            showAuthMsg('login', '⚠ Usuario no encontrado', true);
            setBtnLoading('login-submit', false);
            return;
        }
        if (data.password_hash !== hash) {
            showAuthMsg('login', '⚠ Contraseña incorrecta', true);
            setBtnLoading('login-submit', false);
            return;
        }
        currentUser = { id: data.id, name: data.display_name, avatar: data.avatar };
        saveSession();
        showAuthMsg('login', '✓ ¡Bienvenido ' + data.display_name + '!', false);
        setTimeout(showMenu, 600);
    } catch(e) {
        console.error(e);
        showAuthMsg('login', '⚠ Error de conexión. Inténtalo de nuevo.', true);
    }
    setBtnLoading('login-submit', false);
}

// ------------------------------------------------------------------
// Estadísticas
// ------------------------------------------------------------------
async function getMyStats() {
    if (!currentUser) return null;
    try {
        const { data } = await sbClient.from('player_stats').select('*').eq('user_id', currentUser.id).single();
        return data || { games: 0, total_hits: 0, total_shots: 0, best_score: 0, best_combo: 0, mode_records: {} };
    } catch(e) {
        return { games: 0, total_hits: 0, total_shots: 0, best_score: 0, best_combo: 0, mode_records: {} };
    }
}

async function saveMyStats(stats) {
    if (!currentUser) return;
    try {
        await sbClient.from('player_stats').upsert({
            user_id: currentUser.id,
            games: stats.games,
            total_hits: stats.total_hits,
            total_shots: stats.total_shots,
            best_score: stats.best_score,
            best_combo: stats.best_combo,
            mode_records: stats.mode_records,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch(e) {
        console.warn('saveMyStats:', e);
    }
}

async function submitScore(scoreData) {
    if (!currentUser || scoreData.score <= 0) return;
    try {
        await sbClient.from('scores').insert({
            user_id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            score: scoreData.score,
            accuracy: scoreData.acc || 0,
            hits: scoreData.hits || 0,
            shots: scoreData.shots || 0,
            combo: scoreData.combo || 0,
            mode: scoreData.mode,
            difficulty: scoreData.diff || 'medium'
        });
        const stats = await getMyStats();
        stats.games++;
        stats.total_hits += scoreData.hits || 0;
        stats.total_shots += scoreData.shots || 0;
        if (scoreData.score > stats.best_score) stats.best_score = scoreData.score;
        if ((scoreData.combo || 0) > stats.best_combo) stats.best_combo = scoreData.combo || 0;
        if (!stats.mode_records) stats.mode_records = {};
        const mr = stats.mode_records[scoreData.mode];
        if (!mr || scoreData.score > mr.score) {
            stats.mode_records[scoreData.mode] = { score: scoreData.score, acc: scoreData.acc };
        }
        await saveMyStats(stats);
    } catch(e) {
        console.warn('submitScore:', e);
    }
}

// ------------------------------------------------------------------
// Configuración persistente
// ------------------------------------------------------------------
async function saveMyConfig() {
    if (!currentUser) return;
    try {
        const cfgData = {
            ch: { ...CFG.ch },
            sens: CFG.sens,
            tgt: { ...CFG.tgt },
            vis: { ...CFG.vis },
            snd: { ...CFG.snd },
            room: { ...CFG.room }
        };
        await sbClient.from('player_stats').upsert({
            user_id: currentUser.id,
            user_config: cfgData,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        console.log('✓ Config guardada en perfil');
    } catch(e) {
        console.warn('saveMyConfig:', e);
    }
}

async function loadMyConfig() {
    if (!currentUser) return;
    try {
        const { data } = await sbClient.from('player_stats').select('user_config').eq('user_id', currentUser.id).single();
        if (data && data.user_config) {
            const c = data.user_config;
            if (c.ch) Object.assign(CFG.ch, c.ch);
            if (c.sens != null) CFG.sens = c.sens;
            if (c.tgt) Object.assign(CFG.tgt, c.tgt);
            if (c.vis) Object.assign(CFG.vis, c.vis);
            if (c.snd) Object.assign(CFG.snd, c.snd);
            if (c.room) Object.assign(CFG.room, c.room);
            applyCfgToDOM();
            applyCH();
            console.log('✓ Config cargada del perfil');
        }
    } catch(e) {
        console.warn('loadMyConfig:', e);
    }
}

// Exponer funciones globales
window.switchTab = switchTab;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.checkUsernameAvail = checkUsernameAvail;
window.updatePwStrength = updatePwStrength;
window.currentUser = () => currentUser;
window.clearSession = clearSession;
window.loadSession = loadSession;
window.getMyStats = getMyStats;
window.saveMyStats = saveMyStats;
window.submitScore = submitScore;
window.saveMyConfig = saveMyConfig;
window.loadMyConfig = loadMyConfig;