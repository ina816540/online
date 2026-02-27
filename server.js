const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const fp = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const t = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
    res.writeHead(200, { 'Content-Type': t[path.extname(fp)] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

// ── CONFIGURACIÓN DE MODOS ───────────────────────────────────
const MODE_CFG = {
  '1v1': { perTeam:1, max:2,  firstTo:6,  teams:2 },
  '2v2': { perTeam:2, max:4,  firstTo:10, teams:2 },
  '3v3': { perTeam:3, max:6,  firstTo:15, teams:2 },
  '4v4': { perTeam:4, max:8,  firstTo:20, teams:2 },
  'ffa': { perTeam:0, max:8,  firstTo:10, teams:0 }
};

// Spawns por equipo (hasta 4 por equipo)
const TEAM_SP = [
  [ {x:-14,z:-12,yaw:0.75}, {x:-12,z:-5,yaw:0.6}, {x:-15,z:1,yaw:0.35}, {x:-11,z:-17,yaw:0.9} ],
  [ {x:14,z:12,yaw:-Math.PI+0.75}, {x:12,z:5,yaw:-Math.PI+0.6}, {x:15,z:-1,yaw:-Math.PI+0.35}, {x:11,z:17,yaw:-Math.PI+0.9} ]
];
const FFA_SP = [
  {x:-14,z:-12,yaw:0.75}, {x:14,z:12,yaw:-Math.PI+0.75},
  {x:-14,z:12,yaw:-0.75}, {x:14,z:-12,yaw:Math.PI-0.75},
  {x:0,z:-16,yaw:0},      {x:0,z:16,yaw:Math.PI},
  {x:-16,z:0,yaw:Math.PI/2}, {x:16,z:0,yaw:-Math.PI/2}
];

const rooms   = new Map();
const clients = new Set();
let   nextId  = 1;

const RESPAWN_DELAY = 1500; // 1.5 segundos — ambos jugadores respawnean

// ── HELPERS ──────────────────────────────────────────────────
function getSpawn(room, player) {
  if (room.mode === 'ffa') return FFA_SP[player.slot % 8];
  const teammates = room.players.filter(p => p.team === player.team);
  const idx = teammates.findIndex(p => p === player);
  return TEAM_SP[player.team][Math.max(0, idx) % 4];
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcastAll(msg) {
  const s = JSON.stringify(msg);
  for (const ws of clients) if (ws.readyState === 1) ws.send(s);
}

function getRoomList() {
  return Array.from(rooms.values())
    .filter(r => !r.closed && r.state === 'waiting')
    .map(r => ({ id:r.id, name:r.name, mode:r.mode, players:r.players.length, max:r.max, isPrivate:r.isPrivate }));
}

function pushRoomList() {
  broadcastAll({ type:'room_list', rooms: getRoomList() });
}

function pushOnlineCount() {
  broadcastAll({ type:'online_count', count: clients.size });
}

// ── WEBSOCKET ────────────────────────────────────────────────
wss.on('connection', ws => {
  clients.add(ws);
  let room = null, me = null;

  send(ws, { type:'room_list', rooms: getRoomList() });
  pushOnlineCount();

  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {

      // ── PING / PONG ───────────────────────────────────────
      case 'ping':
        send(ws, { type:'pong', t: msg.t });
        break;

      // ── LISTAR SALAS ──────────────────────────────────────
      case 'get_rooms':
        send(ws, { type:'room_list', rooms: getRoomList() });
        break;

      // ── CREAR SALA ────────────────────────────────────────
      case 'create_room': {
        if (room) return;
        const mode = msg.mode in MODE_CFG ? msg.mode : '1v1';
        const cfg  = MODE_CFG[mode];
        room = {
          id: nextId++,
          name: (msg.name || 'Sala').substring(0, 30),
          mode, max: cfg.max, firstTo: cfg.firstTo,
          isPrivate: !!msg.isPrivate,
          password: msg.isPrivate ? (msg.password || '').substring(0, 20) : '',
          players: [], teamScores: [0, 0], pScores: {},
          state: 'waiting', closed: false,
          chatHistory: []
        };
        rooms.set(room.id, room);
        me = { ws, slot:0, team:0, name:(msg.playerName||'Jugador').substring(0,20), alive:true };
        room.players.push(me);
        room.pScores[me.name] = 0;
        send(ws, {
          type:'room_joined', roomId:room.id, slot:0, team:0,
          spawn: getSpawn(room, me), mode:room.mode, max:room.max,
          name:room.name, firstTo:room.firstTo,
          players:[{ slot:0, team:0, name:me.name, spawn:getSpawn(room,me) }]
        });
        pushRoomList();
        break;
      }

      // ── UNIRSE A SALA ─────────────────────────────────────
      case 'join_room': {
        if (room) return;
        const r = rooms.get(msg.roomId);
        if (!r)                            { send(ws,{type:'join_err',msg:'Sala no encontrada'}); return; }
        if (r.state !== 'waiting')         { send(ws,{type:'join_err',msg:'Partida en curso'}); return; }
        if (r.players.length >= r.max)     { send(ws,{type:'join_err',msg:'Sala llena'}); return; }
        if (r.isPrivate && r.password !== (msg.password||'')) { send(ws,{type:'join_err',msg:'Contraseña incorrecta'}); return; }

        room = r;
        const slot = room.players.length;
        const team = room.mode === 'ffa' ? slot : slot % 2;
        me = { ws, slot, team, name:(msg.playerName||'Jugador').substring(0,20), alive:true };
        room.players.push(me);
        room.pScores[me.name] = 0;
        const spawn = getSpawn(room, me);

        send(ws, {
          type:'room_joined', roomId:room.id, slot, team, spawn,
          mode:room.mode, max:room.max, name:room.name, firstTo:room.firstTo,
          players: room.players.map(p => ({ slot:p.slot, team:p.team, name:p.name, spawn:getSpawn(room,p) })),
          chatHistory: room.chatHistory || []
        });

        room.players.forEach(p => {
          if (p !== me) send(p.ws, { type:'player_joined', slot, team, name:me.name, spawn });
        });

        const joinMsg = { type:'chat_msg', sender:'SISTEMA', text: me.name + ' se unió a la sala', system:true, t: Date.now() };
        room.chatHistory.push(joinMsg);
        if (room.chatHistory.length > 50) room.chatHistory.shift();
        room.players.forEach(p => send(p.ws, joinMsg));

        pushRoomList();
        break;
      }

      // ── CHAT ──────────────────────────────────────────────
      case 'chat': {
        if (!room || !me) return;
        const text = (msg.text || '').substring(0, 80).trim();
        if (!text) return;
        const chatMsg = { type:'chat_msg', sender: me.name, slot: me.slot, text, system:false, t: Date.now() };
        room.chatHistory.push(chatMsg);
        if (room.chatHistory.length > 50) room.chatHistory.shift();
        room.players.forEach(p => send(p.ws, chatMsg));
        break;
      }

      // ── FORZAR START (solo host) ──────────────────────────
      case 'force_start': {
        if (!room || !me || me.slot !== 0 || room.state !== 'waiting') return;
        if (room.players.length < 2) { send(me.ws, {type:'join_err', msg:'Necesitas al menos 2 jugadores'}); return; }
        startMatch(room);
        break;
      }

      // ── ESTADO (posición + pitch) ─────────────────────────
      case 'state':
        if (!room || !me) return;
        room.players.forEach(p => {
          if (p !== me) send(p.ws, {
            type:'opp_state',
            slot:  me.slot,
            pos:   msg.pos,
            yaw:   msg.yaw,
            pitch: msg.pitch || 0,
            posY:  msg.posY  || 0
          });
        });
        break;

      // ── DISPARO VISUAL ────────────────────────────────────
      case 'shoot':
        if (!room || !me) return;
        room.players.forEach(p => { if (p !== me) send(p.ws, { type:'opp_shoot', slot:me.slot }); });
        break;

      // ── HIT ───────────────────────────────────────────────
      case 'hit': {
        if (!room || !me || !me.alive) return;
        const victim = room.players.find(p => p.slot === msg.victimSlot);
        if (!victim || !victim.alive) return;
        if (room.mode !== 'ffa' && me.team === victim.team) return; // sin FF

        // Ambos mueren temporalmente
        victim.alive = false;
        me.alive     = false;

        // Actualizar puntaje
        if (room.mode === 'ffa') {
          room.pScores[me.name] = (room.pScores[me.name] || 0) + 1;
        } else {
          room.teamScores[me.team]++;
        }

        const myScore  = room.mode === 'ffa' ? room.pScores[me.name] : room.teamScores[me.team];
        const matchOver = myScore >= room.firstTo;

        // Calcular spawns de ambos
        const victimSpawn = getSpawn(room, victim);
        const killerSpawn = getSpawn(room, me);

        // Notificar kill a todos (con spawns incluidos para que el cliente los use)
        const killMsg = {
          type:       'kill',
          killerSlot: me.slot,
          victimSlot: victim.slot,
          killerTeam: me.team,
          teamScores: [...room.teamScores],
          pScores:    {...room.pScores},
          matchOver,
          mySpawn:     killerSpawn,   // spawn del killer  (usado por el killer)
          killerSpawn: killerSpawn    // spawn del killer  (usado por la víctima para referencia)
        };
        room.players.forEach(p => send(p.ws, killMsg));

        if (matchOver) {
          room.state = 'finished'; room.closed = true;
          setTimeout(() => rooms.delete(room.id), 15000);
          pushRoomList();
        } else {
          // ── RESPAWN DE AMBOS después de 1.5s ─────────────
          setTimeout(() => {
            if (room.closed) return;

            // Respawnear víctima
            victim.alive = true;
            send(victim.ws, { type:'respawn', spawn: victimSpawn });
            room.players.forEach(p => {
              if (p !== victim) send(p.ws, { type:'player_respawn', slot: victim.slot, spawn: victimSpawn });
            });

            // Respawnear killer también
            me.alive = true;
            send(me.ws, { type:'respawn', spawn: killerSpawn });
            room.players.forEach(p => {
              if (p !== me) send(p.ws, { type:'player_respawn', slot: me.slot, spawn: killerSpawn });
            });

          }, RESPAWN_DELAY);
        }
        break;
      }
    }
  });

  // ── DESCONEXIÓN ───────────────────────────────────────────
  ws.on('close', () => {
    clients.delete(ws);
    pushOnlineCount();
    if (!room || room.closed) return;
    room.closed = true; room.state = 'finished';
    room.players.forEach(p => {
      if (p !== me) send(p.ws, { type:'opp_disconnect', slot:me?.slot??-1, name:me?.name??'' });
    });
    rooms.delete(room.id);
    pushRoomList();
  });
});

function startMatch(room) {
  room.state = 'playing';
  const players = room.players.map(p => ({ slot:p.slot, team:p.team, name:p.name, spawn:getSpawn(room,p) }));
  room.players.forEach(p => send(p.ws, { type:'start', players, mode:room.mode, firstTo:room.firstTo }));
  pushRoomList();
}

server.listen(PORT, () => console.log(`INA TRAINER Online · puerto ${PORT}`));
