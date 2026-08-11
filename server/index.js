import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import { gameEngine } from './gameLogic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

// Paths for assets
const cardsPath = fs.existsSync(path.join(__dirname, '../public/cards'))
  ? path.join(__dirname, '../public/cards')
  : path.join(process.cwd(), 'public/cards');

const distPath = fs.existsSync(path.join(__dirname, '../dist'))
  ? path.join(__dirname, '../dist')
  : path.join(process.cwd(), 'dist');

// Serve static cards and dist
app.use('/cards', express.static(cardsPath));
app.use(express.static(distPath));

app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Coup Online Server running. Build frontend with npm run build.');
  }
});

// Helper to sanitize room state per player (hides unrevealed cards of opponents)
function sanitizeRoomForPlayer(room, socketPlayerId) {
  if (!room) return null;

  return {
    ...room,
    players: room.players.map(player => {
      const isSelf = player.id === socketPlayerId;
      return {
        ...player,
        cards: player.cards.map(card => {
          if (card.revealed || isSelf) {
            return card;
          }
          return {
            id: card.id,
            character: 'hidden',
            revealed: false
          };
        })
      };
    })
  };
}

function broadcastRoomState(code) {
  const room = gameEngine.getRoom(code);
  if (!room) return;

  const roomSockets = io.sockets.adapter.rooms.get(code);
  if (roomSockets) {
    for (const socketId of roomSockets) {
      const clientSocket = io.sockets.sockets.get(socketId);
      if (clientSocket) {
        const sanitized = sanitizeRoomForPlayer(room, clientSocket.data.playerId || socketId);
        clientSocket.emit('roomState', sanitized);
      }
    }
  }
}

// Bot periodic update loop
setInterval(() => {
  for (const [code, room] of gameEngine.rooms.entries()) {
    if (room.status === 'playing') {
      const updated = gameEngine.handleBotTurns(code);
      if (updated) {
        broadcastRoomState(code);
      }
    }
  }
}, 1200);

// Jogadores desconectados só são removidos após um período de tolerância,
// para que refresh/queda de rede não faça o jogador perder o lugar (nem o host).
const DISCONNECT_GRACE_MS = 30000;
const pendingRemovals = new Map();

function cancelPendingRemoval(code, playerId) {
  const key = `${code}:${playerId}`;
  const timer = pendingRemovals.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingRemovals.delete(key);
  }
}

function scheduleRemoval(code, playerId) {
  cancelPendingRemoval(code, playerId);
  const key = `${code}:${playerId}`;
  const timer = setTimeout(() => {
    pendingRemovals.delete(key);
    const room = gameEngine.getRoom(code);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player || player.isConnected) return;

    if (room.status === 'lobby') {
      gameEngine.removePlayer(code, playerId, playerId);
    }
    cleanupOrBroadcast(code, true);
  }, DISCONNECT_GRACE_MS);
  pendingRemovals.set(key, timer);
}

// Sala sem humano é descartada (senão sobra lobby só de bots ocupando memória).
// `pruneInactive` só é usado após o período de tolerância, para não matar
// a sala de quem está no meio de uma reconexão.
function cleanupOrBroadcast(code, pruneInactive = false) {
  const room = gameEngine.getRoom(code);
  if (!room) return;

  const hasActiveHuman = room.players.some(p => !p.isBot && p.isConnected);
  if (!gameEngine.hasHumanPlayers(room) || (pruneInactive && !hasActiveHuman)) {
    gameEngine.deleteRoom(code);
    return;
  }
  broadcastRoomState(code);
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ playerName, playerId }, callback) => {
    try {
      const id = playerId || socket.id;
      const room = gameEngine.createRoom(id, playerName);
      socket.data.playerId = id;
      socket.data.roomCode = room.code;
      socket.join(room.code);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true, code: room.code, playerId: id });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('joinRoom', ({ code, playerName, existingPlayerId }, callback) => {
    try {
      const playerId = existingPlayerId || socket.id;
      const roomCode = code.toUpperCase();
      const room = gameEngine.joinRoom(roomCode, playerId, playerName);
      socket.data.playerId = playerId;
      socket.data.roomCode = room.code;
      socket.join(room.code);
      cancelPendingRemoval(room.code, playerId);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true, code: room.code, playerId });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('claimHost', ({ code }, callback) => {
    try {
      const room = gameEngine.claimHost(code, socket.data.playerId || socket.id);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('addBot', ({ code }, callback) => {
    try {
      const room = gameEngine.addBot(code, socket.data.playerId || socket.id);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('removePlayer', ({ code, targetPlayerId }, callback) => {
    try {
      const requesterId = socket.data.playerId || socket.id;
      const room = gameEngine.removePlayer(code, targetPlayerId, requesterId);

      // Saída própria: desliga o socket da sala, senão os broadcasts
      // continuam chegando e jogam o jogador de volta na tela da sala.
      if (targetPlayerId === requesterId) {
        const roomCode = (room && room.code) || code?.toUpperCase();
        cancelPendingRemoval(roomCode, requesterId);
        socket.leave(roomCode);
        socket.data.roomCode = null;
      }

      if (room) cleanupOrBroadcast(room.code);
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('resetRoom', ({ code }, callback) => {
    try {
      const room = gameEngine.resetRoom(code);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('startGame', ({ code }, callback) => {
    try {
      const room = gameEngine.startGame(code, socket.data.playerId || socket.id);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('playAction', ({ code, action, targetId }, callback) => {
    try {
      const room = gameEngine.playAction(code, socket.data.playerId || socket.id, action, targetId);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('respondToAction', ({ code, responseType, blockCharacter }, callback) => {
    try {
      const room = gameEngine.respondToAction(code, socket.data.playerId || socket.id, responseType, blockCharacter);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('selectLossCard', ({ code, cardId }, callback) => {
    try {
      const room = gameEngine.selectLossCard(code, socket.data.playerId || socket.id, cardId);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('selectExchangeCards', ({ code, keptCardIds }, callback) => {
    try {
      const room = gameEngine.selectExchangeCards(code, socket.data.playerId || socket.id, keptCardIds);
      broadcastRoomState(room.code);
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback({ success: false, message: err.message });
    }
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const playerId = socket.data.playerId || socket.id;
    if (!code) return;

    // Outro socket já assumiu essa identidade (reconexão rápida): ignora.
    const stillConnected = [...io.sockets.sockets.values()].some(
      s => s.id !== socket.id && s.data.playerId === playerId && s.data.roomCode === code
    );
    if (stillConnected) return;

    gameEngine.markDisconnected(code, playerId);
    scheduleRemoval(code, playerId);
    broadcastRoomState(code);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n==================================================`);
  console.log(` 🏆 COUP ONLINE SERVIDOR INICIADO COM SUCESSO! 🏆`);
  console.log(` 🌐 Acesse no navegador: ${url}`);
  console.log(`==================================================\n`);

  // Auto open browser on Windows
  if (process.platform === 'win32') {
    exec(`start ${url}`);
  }
});
