// ============================================================
// UI: Menús, leaderboard, estadísticas, amigos, configuración
// ============================================================

// ------------------------------------------------------------------
// Leaderboard
// ------------------------------------------------------------------
let lbMode = 'all';

async function loadLB() {
    const body = document.getElementById('lb-body');
    body.innerHTML = '汽<td colspan="6" class="lb-loading">⟳ CARGANDO RÉCORDS GLOBALES...  </td>';
    try {
        let q = sbClient.from('scores').select('*').order('score', { ascending: false }).limit(200);
        if (lbMode !== 'all') q = q.eq('mode', lbMode);
        const { data, error } = await q;
        if (error) throw error;
        const best = {};
        (data || []).forEach(e => {
            const key = (e.user_id || e.name) + '_' + e.mode;
            if (!best[key] || e.score > best[key].score) best[key] = e;
        });
        let top = Object.values(best).sort((a, b) => b.score - a.score).slice(0, 50);
        if (top.length === 0) {
            body.innerHTML = '汽<td colspan="6" class="lb-empty">🏆 Sin récords aún. ¡Sé el primero!</td>';
            return;
        }
        renderLBRows(body, top);
    } catch (e) {
        body.innerHTML = '汽<td colspan="6" class="lb-empty">⚠ Error al cargar. Verifica tu conexión.</td>';
    }
}

function renderLBRows(body, top) {
    body.innerHTML = '';
    top.forEach((e, i) => {
        const tr = document.createElement('tr');
        const isMe = currentUser && (e.user_id === currentUser.id || e.name === currentUser.name);
        if (isMe) tr.classList.add('lb-me');
        const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        const diffLabel = { easy: 'FÁCIL', medium: 'MEDIO', hard: 'DIFÍCIL' }[e.diff || e.difficulty] || (e.diff || e.difficulty || '—');
        const modeLabel = (MODES[e.mode]?.name) || e.mode || '—';
        const acc = e.acc ?? e.accuracy ?? 0;
        tr.innerHTML = `
            <td class="lb-rank ${rankClass}">${medal || ('#' + (i + 1))}</td>
            <td><div class="lb-player"><span>${e.avatar || '🎯'}</span><span>${e.name}${isMe ? ' ★' : ''}</span></div></td>
            <td><span class="lb-score-val">${(e.score || 0).toLocaleString()}</span></td>
            <td><span class="lb-acc">${acc}%</span></td>
            <td style="color:var(--dim)">${modeLabel}</td>
            <td style="color:var(--dim)">${diffLabel}</td>
        `;
        body.appendChild(tr);
    });
}

// ------------------------------------------------------------------
// Estadísticas
// ------------------------------------------------------------------
async function loadStats() {
    if (!currentUser) return;
    document.getElementById('profile-av').textContent = currentUser.avatar;
    document.getElementById('profile-name').textContent = currentUser.name.toUpperCase();
    const s = await getMyStats();
    document.getElementById('st-games').textContent = s.games || 0;
    document.getElementById('st-best').textContent = (s.best_score || 0).toLocaleString();
    const avgAcc = (s.total_shots || 0) > 0 ? Math.round((s.total_hits || 0) / (s.total_shots || 0) * 100) : 0;
    document.getElementById('st-acc').textContent = avgAcc + '%';
    document.getElementById('st-hits').textContent = (s.total_hits || 0).toLocaleString();
    document.getElementById('st-shots').textContent = (s.total_shots || 0).toLocaleString();
    document.getElementById('st-combo').textContent = s.best_combo || 0;
    const mrRows = document.getElementById('mr-rows');
    mrRows.innerHTML = '';
    const recs = s.mode_records || {};
    Object.keys(MODES).forEach(id => {
        const rec = recs[id];
        const row = document.createElement('div');
        row.className = 'mr-row';
        row.innerHTML = `
            <span class="mr-mode">${MODES[id]?.name || id}</span>
            <span class="mr-score">${rec ? (rec.score || 0).toLocaleString() : '—'}</span>
            <span class="mr-acc">${rec ? rec.acc + '%' : '—'}</span>
        `;
        mrRows.appendChild(row);
    });
}

// ------------------------------------------------------------------
// Amigos
// ------------------------------------------------------------------
async function searchFriend() {
    if (!currentUser) {
        alert('Debes iniciar sesión');
        return;
    }
    const q = document.getElementById('friend-search-input').value.trim().toLowerCase();
    if (!q) return;
    const res = document.getElementById('friend-search-result');
    res.innerHTML = '<span style="color:var(--dim);font-size:.58rem">Buscando...</span>';
    const { data, error } = await sbClient.from('game_users').select('id,display_name,avatar').eq('username', q).single();
    if (error || !data) {
        res.innerHTML = '<span style="color:#ff4444;font-size:.58rem">⚠ Usuario no encontrado</span>';
        return;
    }
    if (data.id === currentUser.id) {
        res.innerHTML = '<span style="color:#ff4444;font-size:.58rem">⚠ Eres tú mismo</span>';
        return;
    }
    const { data: existing } = await sbClient.from('friendships').select('id,status')
        .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
        .or(`requester_id.eq.${data.id},addressee_id.eq.${data.id}`);
    const rel = existing?.find(r => (r.requester_id === currentUser.id && r.addressee_id === data.id) ||
        (r.requester_id === data.id && r.addressee_id === currentUser.id));
    let actionBtn = '';
    if (!rel) {
        actionBtn = `<button onclick="sendFriendReq('${data.id}','${data.display_name}')" style="padding:5px 12px;background:var(--accent);border:none;color:#fff;font-family:'Orbitron',monospace;font-size:.55rem;font-weight:900;cursor:pointer;clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)">+ AGREGAR</button>`;
    } else if (rel.status === 'pending') {
        actionBtn = '<span style="color:#ffd700;font-size:.55rem">⏳ PENDIENTE</span>';
    } else if (rel.status === 'accepted') {
        actionBtn = '<span style="color:#44ff88;font-size:.55rem">✓ YA SON AMIGOS</span>';
    }
    res.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,.05);border:1px solid var(--border)">
        <span style="font-size:1.4rem">${data.avatar || '🎮'}</span>
        <span style="font-family:'Orbitron',monospace;font-size:.65rem;font-weight:700;flex:1">${data.display_name}</span>
        ${actionBtn}
    </div>`;
}

async function sendFriendReq(toId, toName) {
    const { error } = await sbClient.from('friendships').insert({
        requester_id: currentUser.id,
        addressee_id: toId,
        status: 'pending',
        created_at: new Date().toISOString()
    });
    if (error) {
        document.getElementById('friend-search-result').innerHTML = '<span style="color:#ff4444;font-size:.58rem">Error al enviar solicitud</span>';
        return;
    }
    document.getElementById('friend-search-result').innerHTML = `<span style="color:#44ff88;font-size:.58rem">✓ Solicitud enviada a ${toName}</span>`;
}

async function loadFriends() {
    if (!currentUser) return;
    const list = document.getElementById('friends-list');
    const empty = document.getElementById('friends-empty');
    const reqWrap = document.getElementById('friend-requests-wrap');
    const reqList = document.getElementById('friend-requests-list');
    list.innerHTML = '';
    reqList.innerHTML = '';

    // Amigos aceptados
    const { data: fs } = await sbClient.from('friendships').select('*')
        .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
        .eq('status', 'accepted');
    const friendIds = (fs || []).map(f => f.requester_id === currentUser.id ? f.addressee_id : f.requester_id);
    document.getElementById('friends-count').textContent = friendIds.length;
    if (friendIds.length === 0) {
        empty.style.display = 'block';
        list.style.display = 'none';
    } else {
        empty.style.display = 'none';
        list.style.display = 'flex';
        const { data: users } = await sbClient.from('game_users').select('id,display_name,avatar,last_seen').in('id', friendIds);
        (users || []).forEach(u => {
            const online = u.last_seen && (Date.now() - new Date(u.last_seen).getTime()) < 120000;
            const fr = fs.find(f => f.requester_id === u.id || f.addressee_id === u.id);
            const el = document.createElement('div');
            el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 12px;background:rgba(255,255,255,.04);border:1px solid var(--border)';
            el.innerHTML = `
                <span style="font-size:1.3rem">${u.avatar || '🎮'}</span>
                <div style="flex:1">
                    <div style="font-family:'Orbitron',monospace;font-size:.65rem;font-weight:700">${u.display_name}</div>
                    <div style="font-size:.48rem;color:${online ? '#44ff88' : 'var(--dim)'}">${online ? '● EN LÍNEA' : '○ Desconectado'}</div>
                </div>
                <button onclick="inviteFriend('${u.display_name}')" style="padding:4px 10px;background:rgba(34,119,204,.6);border:none;color:#fff;font-family:'Orbitron',monospace;font-size:.5rem;cursor:pointer;clip-path:polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%)">INVITAR</button>
                <button onclick="removeFriend('${fr?.id}','${u.display_name}')" style="padding:4px 8px;background:rgba(255,50,50,.2);border:1px solid rgba(255,50,50,.3);color:#ff6666;font-family:'Orbitron',monospace;font-size:.48rem;cursor:pointer">✕</button>
            `;
            list.appendChild(el);
        });
    }

    // Solicitudes pendientes
    const { data: reqs } = await sbClient.from('friendships').select('*').eq('addressee_id', currentUser.id).eq('status', 'pending');
    if (reqs && reqs.length > 0) {
        reqWrap.style.display = 'block';
        const { data: reqUsers } = await sbClient.from('game_users').select('id,display_name,avatar').in('id', reqs.map(r => r.requester_id));
        reqs.forEach(req => {
            const u = reqUsers?.find(x => x.id === req.requester_id);
            if (!u) return;
            const el = document.createElement('div');
            el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);margin-bottom:5px';
            el.innerHTML = `
                <span style="font-size:1.2rem">${u.avatar || '🎮'}</span>
                <span style="font-family:'Orbitron',monospace;font-size:.6rem;flex:1">${u.display_name}</span>
                <button onclick="acceptFriendReq('${req.id}','${u.display_name}')" style="padding:4px 10px;background:rgba(68,255,136,.7);border:none;color:#000;font-family:'Orbitron',monospace;font-size:.5rem;font-weight:900;cursor:pointer">✓ ACEPTAR</button>
                <button onclick="declineFriendReq('${req.id}')" style="padding:4px 8px;background:rgba(255,50,50,.3);border:none;color:#fff;font-family:'Orbitron',monospace;font-size:.5rem;cursor:pointer">✕</button>
            `;
            reqList.appendChild(el);
        });
    } else {
        reqWrap.style.display = 'none';
    }

    // Actualizar last_seen
    sbClient.from('game_users').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
}

async function acceptFriendReq(reqId, name) {
    await sbClient.from('friendships').update({ status: 'accepted' }).eq('id', reqId);
    loadFriends();
}
async function declineFriendReq(reqId) {
    await sbClient.from('friendships').delete().eq('id', reqId);
    loadFriends();
}
async function removeFriend(friendshipId, name) {
    if (!confirm('¿Eliminar a ' + name + ' de amigos?')) return;
    await sbClient.from('friendships').delete().eq('id', friendshipId);
    loadFriends();
}
function inviteFriend(name) {
    const room = document.getElementById('duel-room-name-input')?.value || 'mi sala';
    navigator.clipboard?.writeText('¡Te invito a jugar INA TRAINER! Únete a la sala: ' + room).then(() => alert('¡Invitación copiada! Pégala en el chat de ' + name));
}

// ------------------------------------------------------------------
// Configuración (CFG) - UI
// ------------------------------------------------------------------
function applyCH() {
    const col = CFG.ch.color;
    const ch = document.getElementById('crosshair');
    document.querySelectorAll('.ch-line,.ch-dot').forEach(el => el.style.background = col);
    const gap = CFG.ch.gap, len = CFG.ch.size, th = CFG.ch.thick;
    const base = `background:${col};border-radius:1px;position:absolute;transition:all 0.06s;`;
    const chT = ch.querySelector('.ch-top'), chB = ch.querySelector('.ch-bottom');
    const chL = ch.querySelector('.ch-left'), chR = ch.querySelector('.ch-right');
    if (chT) {
        chT.style.cssText = `${base}width:${th}px;height:${len}px;left:50%;top:calc(50% - ${gap + len}px);transform:translateX(-50%);`;
        chB.style.cssText = `${base}width:${th}px;height:${len}px;left:50%;top:calc(50% + ${gap}px);transform:translateX(-50%);`;
        chL.style.cssText = `${base}height:${th}px;width:${len}px;top:50%;left:calc(50% - ${gap + len}px);transform:translateY(-50%);`;
        chR.style.cssText = `${base}height:${th}px;width:${len}px;top:50%;left:calc(50% + ${gap}px);transform:translateY(-50%);`;
    }
    const dot = ch.querySelector('.ch-dot');
    if (dot) dot.style.display = CFG.ch.dot ? 'block' : 'none';
}

function applyCfgToDOM() {
    // Mira
    const sz = document.getElementById('ch-size');
    if (sz) { sz.value = CFG.ch.size; document.getElementById('ch-size-v').textContent = CFG.ch.size; }
    const th = document.getElementById('ch-thick');
    if (th) { th.value = CFG.ch.thick; document.getElementById('ch-thick-v').textContent = CFG.ch.thick; }
    const gp = document.getElementById('ch-gap');
    if (gp) { gp.value = CFG.ch.gap; document.getElementById('ch-gap-v').textContent = CFG.ch.gap; }
    const dt = document.getElementById('ch-dot');
    if (dt) dt.checked = CFG.ch.dot;
    document.querySelectorAll('#ch-colors .color-opt').forEach(o => o.classList.toggle('active', o.dataset.c === CFG.ch.color));

    // Sensibilidad múltiple (rango 1-300)
    const sensKeys = ['hipfire', 'reddot', 'tactical', 'scope2x', 'scope3x', 'scope4x', 'scope6x'];
    sensKeys.forEach(key => {
        const slider = document.getElementById(`sens-${key}`);
        const display = document.getElementById(`sens-${key}-v`);
        if (slider) {
            slider.value = CFG.sensMap[key];
            if (display) display.textContent = CFG.sensMap[key];
        }
    });

    // Tamaño objetivos, velocidad, máximo
    const ts = document.getElementById('tgt-size');
    if (ts) { ts.value = Math.round(CFG.tgt.sizeMult * 100); document.getElementById('tgt-size-v').textContent = CFG.tgt.sizeMult.toFixed(1) + 'x'; }
    const tp = document.getElementById('tgt-spd');
    if (tp) { tp.value = Math.round(CFG.tgt.speedMult * 100); document.getElementById('tgt-spd-v').textContent = CFG.tgt.speedMult.toFixed(1) + 'x'; }
    const tm = document.getElementById('tgt-max');
    if (tm) { tm.value = CFG.tgt.max; document.getElementById('tgt-max-v').textContent = CFG.tgt.max; }

    // Visual
    const fx = document.getElementById('fx-tog'); if (fx) fx.checked = CFG.vis.fx;
    const pt = document.getElementById('pts-tog'); if (pt) pt.checked = CFG.vis.pts;
    const cb = document.getElementById('combo-tog'); if (cb) cb.checked = CFG.vis.combo;
    document.querySelectorAll('#room-colors .color-opt').forEach(o => o.classList.toggle('active', o.dataset.c === CFG.room.color));

    // Audio
    const sh = document.getElementById('snd-shot'); if (sh) sh.checked = CFG.snd.shot;
    const hi = document.getElementById('snd-hit'); if (hi) hi.checked = CFG.snd.hit;
    const ms = document.getElementById('snd-miss'); if (ms) ms.checked = CFG.snd.miss;
    const vl = document.getElementById('vol-sl'); if (vl) { vl.value = Math.round(CFG.snd.vol * 100); document.getElementById('vol-v').textContent = Math.round(CFG.snd.vol * 100) + '%'; }
}

function initCFG() {
    // Color de mira
    document.querySelectorAll('#ch-colors .color-opt').forEach(o => o.addEventListener('click', () => {
        document.querySelectorAll('#ch-colors .color-opt').forEach(x => x.classList.remove('active'));
        o.classList.add('active');
        CFG.ch.color = o.dataset.c;
        applyCH();
    }));
    // Color de entorno
    document.querySelectorAll('#room-colors .color-opt').forEach(o => o.addEventListener('click', () => {
        document.querySelectorAll('#room-colors .color-opt').forEach(x => x.classList.remove('active'));
        o.classList.add('active');
        CFG.room.color = o.dataset.c;
        if (scene) updateRoomColor();
    }));

    // Handlers de la mira
    const handlers = [
        ['ch-size', 'ch-size-v', v => { CFG.ch.size = v; applyCH(); }, v => v],
        ['ch-thick', 'ch-thick-v', v => { CFG.ch.thick = v; applyCH(); }, v => v],
        ['ch-gap', 'ch-gap-v', v => { CFG.ch.gap = v; applyCH(); }, v => v]
    ];
    handlers.forEach(([id, vid, fn, fmt]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', function () { fn(+this.value); document.getElementById(vid).textContent = fmt(this.value); });
    });

    // Handlers de sensibilidad múltiple (rango 1-300)
    const sensHandlers = [
        ['sens-hipfire', 'sens-hipfire-v', v => CFG.sensMap.hipfire = v, v => v],
        ['sens-reddot', 'sens-reddot-v', v => CFG.sensMap.reddot = v, v => v],
        ['sens-tactical', 'sens-tactical-v', v => CFG.sensMap.tactical = v, v => v],
        ['sens-scope2x', 'sens-scope2x-v', v => CFG.sensMap.scope2x = v, v => v],
        ['sens-scope3x', 'sens-scope3x-v', v => CFG.sensMap.scope3x = v, v => v],
        ['sens-scope4x', 'sens-scope4x-v', v => CFG.sensMap.scope4x = v, v => v],
        ['sens-scope6x', 'sens-scope6x-v', v => CFG.sensMap.scope6x = v, v => v]
    ];
    sensHandlers.forEach(([id, vid, fn, fmt]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', function () { fn(parseInt(this.value)); document.getElementById(vid).textContent = fmt(this.value); });
    });

    // Handlers de tamaño, velocidad, máximo de objetivos
    const tgtHandlers = [
        ['tgt-size', 'tgt-size-v', v => CFG.tgt.sizeMult = v / 100, v => (v / 100).toFixed(1) + 'x'],
        ['tgt-spd', 'tgt-spd-v', v => CFG.tgt.speedMult = v / 100, v => (v / 100).toFixed(1) + 'x'],
        ['tgt-max', 'tgt-max-v', v => CFG.tgt.max = v, v => v]
    ];
    tgtHandlers.forEach(([id, vid, fn, fmt]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', function () { fn(+this.value); document.getElementById(vid).textContent = fmt(this.value); });
    });

    // Handlers de volumen
    const vol = document.getElementById('vol-sl');
    if (vol) vol.addEventListener('input', function () { CFG.snd.vol = this.value / 100; document.getElementById('vol-v').textContent = this.value + '%'; });

    // Toggles
    const toggles = [
        ['ch-dot', CFG.ch, 'dot', applyCH],
        ['fx-tog', CFG.vis, 'fx'],
        ['pts-tog', CFG.vis, 'pts'],
        ['combo-tog', CFG.vis, 'combo'],
        ['snd-shot', CFG.snd, 'shot'],
        ['snd-hit', CFG.snd, 'hit'],
        ['snd-miss', CFG.snd, 'miss']
    ];
    toggles.forEach(([id, obj, key, cb]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', function () { obj[key] = this.checked; if (cb) cb(); });
    });

    // ------------------------------------------------------------------
    // BOTÓN PARA SINCRONIZAR TODAS LAS SENSIBILIDADES
    // ------------------------------------------------------------------
    document.getElementById('sync-sens-btn')?.addEventListener('click', () => {
        const hipfireVal = CFG.sensMap.hipfire;
        const keys = ['reddot', 'tactical', 'scope2x', 'scope3x', 'scope4x', 'scope6x'];
        keys.forEach(key => {
            CFG.sensMap[key] = hipfireVal;
            const slider = document.getElementById(`sens-${key}`);
            const display = document.getElementById(`sens-${key}-v`);
            if (slider) {
                slider.value = hipfireVal;
                if (display) display.textContent = hipfireVal;
            }
        });
    });

    // ------------------------------------------------------------------
    // PRESETS DE JUEGOS (sensibilidad en rango 1-300)
    // ------------------------------------------------------------------
    const gameSensMap = {
        fortnite:   { hipfire: 35, reddot: 35, tactical: 35, scope2x: 30, scope3x: 27, scope4x: 25, scope6x: 22 },
        warzone:    { hipfire: 40, reddot: 40, tactical: 40, scope2x: 32, scope3x: 28, scope4x: 25, scope6x: 20 },
        bloodstrike:{ hipfire: 45, reddot: 45, tactical: 45, scope2x: 35, scope3x: 30, scope4x: 28, scope6x: 25 },
        valorant:   { hipfire: 25, reddot: 25, tactical: 25, scope2x: 20, scope3x: 18, scope4x: 16, scope6x: 14 },
        csgo:       { hipfire: 28, reddot: 28, tactical: 28, scope2x: 23, scope3x: 20, scope4x: 18, scope6x: 15 },
        apex:       { hipfire: 42, reddot: 42, tactical: 42, scope2x: 35, scope3x: 30, scope4x: 27, scope6x: 24 },
        pubgm:      { hipfire: 50, reddot: 50, tactical: 50, scope2x: 40, scope3x: 35, scope4x: 30, scope6x: 25 },
        freefire:   { hipfire: 55, reddot: 55, tactical: 55, scope2x: 45, scope3x: 40, scope4x: 35, scope6x: 30 },
        roblox:     { hipfire: 30, reddot: 30, tactical: 30, scope2x: 25, scope3x: 22, scope4x: 20, scope6x: 18 }
    };

    function applyGamePreset(game) {
        const values = gameSensMap[game];
        if (values) {
            CFG.sensMap = { ...CFG.sensMap, ...values };
            // Actualizar todos los sliders y displays
            for (const [key, val] of Object.entries(values)) {
                const slider = document.getElementById(`sens-${key}`);
                const display = document.getElementById(`sens-${key}-v`);
                if (slider) {
                    slider.value = val;
                    if (display) display.textContent = val;
                }
            }
            applyCfgToDOM(); // actualizar otros controles
        }
    }

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const game = btn.dataset.game;
            applyGamePreset(game);
        });
    });

    // Botones de configuración
    document.getElementById('open-cfg-btn').addEventListener('click', () => {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('settings-screen').classList.remove('hidden');
    });
    document.getElementById('cfg-save').addEventListener('click', () => {
        document.getElementById('settings-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
        applyCH();
        saveMyConfig();
    });
    document.getElementById('cfg-reset').addEventListener('click', () => {
        CFG.ch = { color: '#ffffff', size: 12, thick: 2, gap: 8, dot: true };
        CFG.sensMap = {
            hipfire: 30, reddot: 30, tactical: 30,
            scope2x: 25, scope3x: 22, scope4x: 20, scope6x: 18
        };
        CFG.tgt = { sizeMult: 1, speedMult: 1, max: 4 };
        CFG.vis = { fx: true, pts: true, combo: true };
        CFG.snd = { shot: true, hit: true, miss: false, vol: 0.7 };
        applyCH();
        applyCfgToDOM();
    });
}

// Exponer funciones globales
window.loadLB = loadLB;
window.loadStats = loadStats;
window.loadFriends = loadFriends;
window.searchFriend = searchFriend;
window.sendFriendReq = sendFriendReq;
window.acceptFriendReq = acceptFriendReq;
window.declineFriendReq = declineFriendReq;
window.removeFriend = removeFriend;
window.inviteFriend = inviteFriend;
window.applyCH = applyCH;
window.applyCfgToDOM = applyCfgToDOM;
window.initCFG = initCFG;