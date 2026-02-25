const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ── HTTP: serve index.html ──────────────────────────────────
const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'text/plain' });
    res.end(data);
  });
});

// ── WebSocket ───────────────────────────────────────────────
const wss = new WebSocketServer({ server });

const rooms    = new Map();
let   nextRoom = 1;
const MAX_KILLS = 6;

const SPAWNS = [
  { x: -13, z: -10, yaw: 0.75 },              // slot 0 → equipo rojo
  { x:  13, z:  10, yaw: -Math.PI + 0.75 }    // slot 1 → equipo azul
];

function getRoom() {
  for (const r of rooms.values())
    if (r.players.length < 2 && !r.closed) return r;
  const r = { id: nextRoom++, players: [], scores: [0, 0], closed: false };
  rooms.set(r.id, r);
  return r;
}

function send(player, msg) {
  if (player.ws.readyState === 1) player.ws.send(JSON.stringify(msg));
}

function opp(room, player) {
  return room.players.find(p => p !== player) || null;
}

wss.on('connection', ws => {
  let room = null;
  let me   = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    // ── JOIN ──────────────────────────────────────────────
    if (msg.type === 'join') {
      room = getRoom();
      const slot = room.players.length;
      me = { ws, slot, name: (msg.name || 'Jugador').substring(0, 20), alive: true };
      room.players.push(me);

      send(me, { type: 'joined', slot, spawn: SPAWNS[slot], name: me.name });

      if (room.players.length === 2) {
        const [p0, p1] = room.players;
        send(p0, { type: 'start', opponent: { name: p1.name, slot: 1, spawn: SPAWNS[1] } });
        send(p1, { type: 'start', opponent: { name: p0.name, slot: 0, spawn: SPAWNS[0] } });
      } else {
        send(me, { type: 'waiting' });
      }
      return;
    }

    if (!room || !me) return;
    const opponent = opp(room, me);

    switch (msg.type) {

      // ── POSITION STATE ─────────────────────────────────
      case 'state':
        if (opponent) send(opponent, {
          type: 'opp_state',
          pos:   msg.pos,
          yaw:   msg.yaw,
          pitch: msg.pitch
        });
        break;

      // ── SHOOT VISUAL ──────────────────────────────────
      case 'shoot':
        if (opponent) send(opponent, { type: 'opp_shoot' });
        break;

      // ── HIT ───────────────────────────────────────────
      case 'hit':
        if (!me.alive || !opponent || !opponent.alive) return;

        opponent.alive = false;
        room.scores[me.slot]++;

        const matchOver = room.scores[me.slot] >= MAX_KILLS;
        const killMsg   = {
          type:      'kill',
          killer:    me.slot,
          victim:    opponent.slot,
          scores:    [...room.scores],
          matchOver
        };
        room.players.forEach(p => send(p, killMsg));

        if (!matchOver) {
          // Reaparición 3 s
          setTimeout(() => {
            if (room.closed) return;
            room.players.forEach(p => { p.alive = true; });
            room.players.forEach((p, i) =>
              send(p, { type: 'respawn', spawn: SPAWNS[i] })
            );
          }, 3000);
        } else {
          room.closed = true;
          setTimeout(() => rooms.delete(room.id), 10000);
        }
        break;
    }
  });

  // ── DISCONNECT ──────────────────────────────────────────
  ws.on('close', () => {
    if (!room || room.closed) return;
    room.closed = true;
    const opponent = opp(room, me);
    if (opponent) send(opponent, { type: 'opp_disconnect' });
    rooms.delete(room.id);
  });
});

server.listen(PORT, () =>
  console.log(`INA TRAINER 1v1 · servidor en puerto ${PORT}`)
);
