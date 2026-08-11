import { v4 as uuidv4 } from 'uuid';

export class GameEngine {
  constructor() {
    this.rooms = new Map();
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  createRoom(hostId, hostName) {
    let code = this.generateCode();
    while (this.rooms.has(code)) {
      code = this.generateCode();
    }

    const host = {
      id: hostId,
      name: hostName || 'Host',
      isHost: true,
      isBot: false,
      coins: 2,
      cards: [],
      isConnected: true
    };

    const room = {
      code,
      status: 'lobby', // lobby | playing | ended
      players: [host],
      deck: [],
      currentTurnPlayerId: hostId,
      pendingAction: null,
      pendingLoss: null,
      pendingExchange: null,
      lastStateChange: Date.now(),
      logs: [{
        id: uuidv4(),
        timestamp: Date.now(),
        text: `Sala criada com sucesso! Código: ${code}`,
        type: 'system'
      }],
      winner: null,
      minPlayers: 2,
      maxPlayers: 6
    };

    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code?.toUpperCase());
  }

  joinRoom(code, playerId, playerName) {
    const room = this.getRoom(code);
    if (!room) throw new Error('Sala não encontrada.');
    if (room.status !== 'lobby') throw new Error('Partida já em andamento.');
    if (room.players.length >= room.maxPlayers) throw new Error('Sala cheia.');

    const existingPlayer = room.players.find(p => p.id === playerId);
    if (existingPlayer) {
      existingPlayer.isConnected = true;
      existingPlayer.name = playerName || existingPlayer.name;
      return room;
    }

    const newPlayer = {
      id: playerId,
      name: playerName || `Jogador ${room.players.length + 1}`,
      isHost: false,
      isBot: false,
      coins: 2,
      cards: [],
      isConnected: true
    };

    room.players.push(newPlayer);
    this.addLog(room, `${newPlayer.name} entrou na sala.`, 'system');
    return room;
  }

  addBot(code, hostId) {
    const room = this.getRoom(code);
    if (!room) throw new Error('Sala não encontrada.');
    if (room.status !== 'lobby') throw new Error('Partida já em andamento.');
    if (!room.players.find(p => p.id === hostId && p.isHost)) throw new Error('Apenas o host pode adicionar bots.');
    if (room.players.length >= room.maxPlayers) throw new Error('Sala cheia.');

    const botNames = ['Bot Arthur', 'Bot Beatriz', 'Bot Carlos', 'Bot Diana', 'Bot Eduardo', 'Bot Fernanda'];
    const usedNames = room.players.map(p => p.name);
    const availableName = botNames.find(n => !usedNames.includes(n)) || `Bot ${room.players.length + 1}`;

    const botPlayer = {
      id: `bot_${uuidv4().substring(0, 8)}`,
      name: availableName,
      isHost: false,
      isBot: true,
      coins: 2,
      cards: [],
      isConnected: true
    };

    room.players.push(botPlayer);
    this.addLog(room, `${botPlayer.name} (IA) entrou na sala.`, 'system');
    return room;
  }

  removePlayer(code, playerId, requesterId) {
    const room = this.getRoom(code);
    if (!room) return null;

    const requester = room.players.find(p => p.id === requesterId);
    const targetPlayer = room.players.find(p => p.id === playerId);

    if (!targetPlayer) return room;

    if (playerId !== requesterId && (!requester || !requester.isHost)) {
      throw new Error('Apenas o próprio jogador ou o host pode remover um jogador.');
    }

    if (room.status === 'lobby') {
      room.players = room.players.filter(p => p.id !== playerId);
      this.addLog(room, `${targetPlayer.name} saiu da sala.`, 'system');
      if (targetPlayer.isHost && room.players.length > 0) {
        room.players[0].isHost = true;
        this.addLog(room, `${room.players[0].name} agora é o host.`, 'system');
      }
    } else {
      targetPlayer.isConnected = false;
      this.addLog(room, `${targetPlayer.name} desconectou-se da partida.`, 'system');
    }

    return room;
  }

  resetRoom(code) {
    const room = this.getRoom(code);
    if (!room) throw new Error('Sala não encontrada.');

    room.status = 'lobby';
    room.winner = null;
    room.pendingAction = null;
    room.pendingLoss = null;
    room.pendingExchange = null;
    room.deck = [];

    room.players.forEach(p => {
      p.coins = 2;
      p.cards = [];
    });

    this.addLog(room, '🔄 A partida foi encerrada. Todos os jogadores retornaram à sala de espera.', 'system');
    return room;
  }

  startGame(code, hostId) {
    const room = this.getRoom(code);
    if (!room) throw new Error('Sala não encontrada.');
    if (!room.players.find(p => p.id === hostId && p.isHost)) throw new Error('Apenas o host pode iniciar o jogo.');
    if (room.players.length < room.minPlayers) throw new Error(`Mínimo de ${room.minPlayers} jogadores para iniciar.`);

    const characters = ['duke', 'assassin', 'captain', 'ambassador', 'countess'];
    const deck = [];
    characters.forEach(char => {
      deck.push(char, char, char);
    });

    this.shuffle(deck);

    room.players.forEach(player => {
      player.coins = 2;
      player.cards = [
        { id: uuidv4(), character: deck.pop(), revealed: false },
        { id: uuidv4(), character: deck.pop(), revealed: false }
      ];
    });

    room.deck = deck;
    room.status = 'playing';
    room.winner = null;
    room.pendingAction = null;
    room.pendingLoss = null;
    room.pendingExchange = null;
    room.lastStateChange = Date.now();
    
    const startIndex = Math.floor(Math.random() * room.players.length);
    room.currentTurnPlayerId = room.players[startIndex].id;

    this.addLog(room, `🎮 O jogo começou! É a vez de ${room.players[startIndex].name}.`, 'system');

    return room;
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  addLog(room, text, type = 'action') {
    room.lastStateChange = Date.now();
    room.logs.unshift({
      id: uuidv4(),
      timestamp: Date.now(),
      text,
      type
    });
    if (room.logs.length > 80) room.logs.pop();
  }

  getAlivePlayers(room) {
    return room.players.filter(p => p.cards.some(c => !c.revealed));
  }

  getNextPlayerId(room, currentId) {
    const alive = this.getAlivePlayers(room);
    if (alive.length <= 1) return currentId;
    const currentIndex = room.players.findIndex(p => p.id === currentId);
    let nextIndex = (currentIndex + 1) % room.players.length;
    while (room.players[nextIndex].cards.every(c => c.revealed)) {
      nextIndex = (nextIndex + 1) % room.players.length;
    }
    return room.players[nextIndex].id;
  }

  advanceTurn(room) {
    if (this.checkWinCondition(room)) return;
    room.pendingAction = null;
    room.pendingLoss = null;
    room.pendingExchange = null;
    room.currentTurnPlayerId = this.getNextPlayerId(room, room.currentTurnPlayerId);
    const current = room.players.find(p => p.id === room.currentTurnPlayerId);
    this.addLog(room, `🔄 Vez de ${current.name}. (Moedas: ${current.coins})`, 'system');
  }

  checkWinCondition(room) {
    const alive = this.getAlivePlayers(room);
    if (alive.length === 1 && room.status === 'playing') {
      room.status = 'ended';
      room.winner = alive[0];
      this.addLog(room, `🏆 ${alive[0].name} venceu o jogo Coup!`, 'system');
      return true;
    }
    return false;
  }

  playAction(code, playerId, action, targetId) {
    const room = this.getRoom(code);
    if (!room || room.status !== 'playing') throw new Error('Jogo não está em andamento.');
    if (room.currentTurnPlayerId !== playerId) throw new Error('Não é sua vez!');
    
    const player = room.players.find(p => p.id === playerId);
    if (!player || player.cards.every(c => c.revealed)) {
      throw new Error('Jogadores eliminados não podem jogar.');
    }

    if (room.pendingAction || room.pendingLoss || room.pendingExchange) {
      throw new Error('Aguarde a resolução da ação pendente.');
    }

    if (player.coins >= 10 && action !== 'coup') {
      throw new Error('Com 10 ou mais moedas, você é OBRIGADO a realizar um Golpe!');
    }

    let target = null;
    if (targetId) {
      target = room.players.find(p => p.id === targetId);
      if (!target || target.cards.every(c => c.revealed)) {
        throw new Error('Alvo inválido ou eliminado.');
      }
      if (target.id === playerId) {
        throw new Error('Você não pode ter a si mesmo como alvo.');
      }
    }

    switch (action) {
      case 'income':
        player.coins += 1;
        this.addLog(room, `💰 ${player.name} pegou Renda (+1 moeda).`);
        this.advanceTurn(room);
        break;

      case 'foreign_aid':
        this.addLog(room, `🤝 ${player.name} pediu Ajuda Externa (+2 moedas).`);
        room.pendingAction = {
          id: uuidv4(),
          actorId: playerId,
          action: 'foreign_aid',
          claimedCharacter: undefined,
          stage: 'ACTION_BLOCK',
          responses: {},
          timerExpiresAt: Date.now() + 15000
        };
        break;

      case 'coup':
        if (player.coins < 7) throw new Error('Moedas insuficientes para Golpe (Custa 7).');
        if (!target) throw new Error('Selecione um alvo para o Golpe.');
        player.coins -= 7;
        this.addLog(room, `⚔️ ${player.name} deu um GOLPE em ${target.name}! (-7 moedas)`);
        room.pendingLoss = {
          playerId: target.id,
          reason: `${player.name} deu um Golpe em você! Escolha uma carta para perder.`
        };
        break;

      case 'tax':
        this.addLog(room, `👑 ${player.name} declarou ser DUQUE e cobrou Taxa (+3 moedas).`);
        room.pendingAction = {
          id: uuidv4(),
          actorId: playerId,
          action: 'tax',
          claimedCharacter: 'duke',
          stage: 'ACTION_CHALLENGE',
          responses: {},
          timerExpiresAt: Date.now() + 15000
        };
        break;

      case 'assassinate':
        if (player.coins < 3) throw new Error('Moedas insuficientes para Assassinato (Custa 3).');
        if (!target) throw new Error('Selecione um alvo para o Assassinato.');
        player.coins -= 3;
        this.addLog(room, `🗡️ ${player.name} pagou 3 moedas e declarou ser ASSASSINO para eliminar ${target.name}.`);
        room.pendingAction = {
          id: uuidv4(),
          actorId: playerId,
          action: 'assassinate',
          targetId: target.id,
          claimedCharacter: 'assassin',
          stage: 'ACTION_CHALLENGE',
          responses: {},
          timerExpiresAt: Date.now() + 15000
        };
        break;

      case 'steal':
        if (!target) throw new Error('Selecione um alvo para Roubo.');
        if (target.coins === 0) throw new Error(`${target.name} não possui moedas para serem roubadas!`);
        this.addLog(room, `🪝 ${player.name} declarou ser CAPITÃO e tentou roubar ${target.name}.`);
        room.pendingAction = {
          id: uuidv4(),
          actorId: playerId,
          action: 'steal',
          targetId: target.id,
          claimedCharacter: 'captain',
          stage: 'ACTION_CHALLENGE',
          responses: {},
          timerExpiresAt: Date.now() + 15000
        };
        break;

      case 'exchange':
        this.addLog(room, `📜 ${player.name} declarou ser EMBAIXADOR para trocar cartas.`);
        room.pendingAction = {
          id: uuidv4(),
          actorId: playerId,
          action: 'exchange',
          claimedCharacter: 'ambassador',
          stage: 'ACTION_CHALLENGE',
          responses: {},
          timerExpiresAt: Date.now() + 15000
        };
        break;

      default:
        throw new Error('Ação desconhecida.');
    }

    return room;
  }

  respondToAction(code, playerId, responseType, blockCharacter) {
    const room = this.getRoom(code);
    if (!room || !room.pendingAction) throw new Error('Nenhuma ação aguardando resposta.');

    const pending = room.pendingAction;
    const player = room.players.find(p => p.id === playerId);
    
    // Eliminated players CANNOT respond or play!
    if (!player || player.cards.every(c => c.revealed)) {
      throw new Error('Jogadores eliminados não podem responder.');
    }

    // Validation per stage
    if (pending.stage === 'ACTION_CHALLENGE') {
      if (playerId === pending.actorId) throw new Error('O autor da ação não pode responder.');
      if (responseType === 'challenge') {
        this.addLog(room, `⚡ ${player.name} DESAFIOU a alegação de ${pending.claimedCharacter?.toUpperCase()} de ${room.players.find(p => p.id === pending.actorId).name}!`, 'challenge');
        this.resolveChallenge(room, pending.actorId, playerId, pending.claimedCharacter, () => {
          this.executeAction(room, pending);
        });
        return room;
      } else if (responseType === 'block') {
        this.addLog(room, `${player.name} declarou bloqueio.`, 'block');
        this.initiateBlock(room, pending, playerId, blockCharacter);
        return room;
      } else if (responseType === 'pass') {
        pending.responses[playerId] = 'pass';
        if (this.allEligiblePassed(room, pending)) {
          if (pending.action === 'assassinate' || pending.action === 'steal') {
            pending.stage = 'ACTION_BLOCK';
            pending.responses = {};
            const targetPlayer = room.players.find(p => p.id === pending.targetId);
            this.addLog(room, `Nenhum desafio feito. ${targetPlayer.name} deseja bloquear?`, 'system');
          } else {
            this.executeAction(room, pending);
          }
        }
      }
    } else if (pending.stage === 'ACTION_BLOCK') {
      if (pending.action === 'foreign_aid') {
        if (playerId === pending.actorId) throw new Error('O autor da ação não pode bloquear.');
        if (responseType === 'block') {
          this.initiateBlock(room, pending, playerId, 'duke');
          return room;
        } else if (responseType === 'pass') {
          pending.responses[playerId] = 'pass';
          if (this.allEligiblePassed(room, pending)) {
            this.executeAction(room, pending);
          }
        }
      } else if (pending.action === 'assassinate' || pending.action === 'steal') {
        if (playerId !== pending.targetId) throw new Error('Apenas o alvo pode bloquear esta ação.');
        if (responseType === 'block') {
          const char = pending.action === 'assassinate' ? 'countess' : blockCharacter;
          if (pending.action === 'steal' && char !== 'captain' && char !== 'ambassador') {
            throw new Error('Carta de bloqueio inválida para Roubo.');
          }
          this.initiateBlock(room, pending, playerId, char);
          return room;
        } else if (responseType === 'pass') {
          this.executeAction(room, pending);
        }
      }
    } else if (pending.stage === 'BLOCK_CHALLENGE') {
      if (playerId === pending.blockerId) throw new Error('O bloqueador não pode desafiar o próprio bloqueio.');
      if (responseType === 'challenge') {
        const blocker = room.players.find(p => p.id === pending.blockerId);
        this.addLog(room, `⚡ ${player.name} DESAFIOU o bloqueio de ${pending.blockedCharacter?.toUpperCase()} feito por ${blocker.name}!`, 'challenge');
        this.resolveChallenge(room, pending.blockerId, playerId, pending.blockedCharacter, () => {
          this.addLog(room, `🛡️ O bloqueio de ${blocker.name} foi bem sucedido! A ação foi cancelada.`, 'block');
          this.advanceTurn(room);
        }, () => {
          this.addLog(room, `💥 O bloqueio de ${blocker.name} FALHOU!`, 'block');
          this.executeAction(room, pending);
        });
        return room;
      } else if (responseType === 'pass') {
        pending.responses[playerId] = 'pass';
        if (this.allEligiblePassed(room, pending)) {
          const blocker = room.players.find(p => p.id === pending.blockerId);
          this.addLog(room, `🛡️ O bloqueio de ${blocker.name} foi aceito. Ação bloqueada.`, 'block');
          this.advanceTurn(room);
        }
      }
    }

    return room;
  }

  allEligiblePassed(room, pending) {
    const alive = this.getAlivePlayers(room);
    if (pending.stage === 'ACTION_CHALLENGE') {
      const eligible = alive.filter(p => p.id !== pending.actorId);
      return eligible.every(p => pending.responses[p.id] === 'pass');
    } else if (pending.stage === 'ACTION_BLOCK') {
      if (pending.action === 'foreign_aid') {
        const eligible = alive.filter(p => p.id !== pending.actorId);
        return eligible.every(p => pending.responses[p.id] === 'pass');
      } else {
        return pending.responses[pending.targetId] === 'pass';
      }
    } else if (pending.stage === 'BLOCK_CHALLENGE') {
      const eligible = alive.filter(p => p.id !== pending.blockerId);
      return eligible.every(p => pending.responses[p.id] === 'pass');
    }
    return false;
  }

  initiateBlock(room, pending, blockerId, character) {
    const blocker = room.players.find(p => p.id === blockerId);
    pending.blockerId = blockerId;
    pending.blockedCharacter = character;
    pending.stage = 'BLOCK_CHALLENGE';
    pending.responses = {};
    this.addLog(room, `🛡️ ${blocker.name} declarou possuir ${character.toUpperCase()} para BLOQUEAR a ação!`, 'block');
  }

  resolveChallenge(room, claimerId, challengerId, claimedCharacter, onSuccess, onFailure) {
    const claimer = room.players.find(p => p.id === claimerId);
    const challenger = room.players.find(p => p.id === challengerId);

    const matchingCardIndex = claimer.cards.findIndex(c => !c.revealed && c.character === claimedCharacter);

    if (matchingCardIndex !== -1) {
      const matchingCard = claimer.cards[matchingCardIndex];
      this.addLog(room, `✨ ${claimer.name} REVELOU ${claimedCharacter.toUpperCase()}! O desafio de ${challenger.name} falhou.`, 'challenge');

      room.deck.push(matchingCard.character);
      this.shuffle(room.deck);
      claimer.cards[matchingCardIndex] = {
        id: uuidv4(),
        character: room.deck.pop(),
        revealed: false
      };

      room.pendingLoss = {
        playerId: challengerId,
        reason: `Você perdeu o desafio contra ${claimer.name}! Escolha uma carta para revelar.`,
        callbackAction: () => {
          if (onSuccess) onSuccess();
        }
      };
    } else {
      this.addLog(room, `❌ ${claimer.name} NÃO possuía ${claimedCharacter.toUpperCase()}! O desafio de ${challenger.name} foi vitorioso.`, 'challenge');
      
      room.pendingLoss = {
        playerId: claimerId,
        reason: `Seu blefe (${claimedCharacter.toUpperCase()}) foi desmascarado por ${challenger.name}! Escolha uma carta para revelar.`,
        callbackAction: () => {
          if (onFailure) {
            onFailure();
          } else {
            this.advanceTurn(room);
          }
        }
      };
    }
  }

  executeAction(room, pending) {
    const actor = room.players.find(p => p.id === pending.actorId);
    if (!actor || actor.cards.every(c => c.revealed)) {
      this.advanceTurn(room);
      return;
    }

    switch (pending.action) {
      case 'foreign_aid':
        actor.coins += 2;
        this.addLog(room, `💰 ${actor.name} recebeu 2 moedas de Ajuda Externa.`);
        this.advanceTurn(room);
        break;

      case 'tax':
        actor.coins += 3;
        this.addLog(room, `💰 ${actor.name} recolheu 3 moedas de Taxa.`);
        this.advanceTurn(room);
        break;

      case 'exchange': {
        const drawn = [
          { id: uuidv4(), character: room.deck.pop(), revealed: false },
          { id: uuidv4(), character: room.deck.pop(), revealed: false }
        ];
        const unrevealedCards = actor.cards.filter(c => !c.revealed);
        room.pendingAction = null;
        room.pendingExchange = {
          playerId: actor.id,
          drawnCards: drawn,
          currentCards: unrevealedCards,
          keepCount: unrevealedCards.length
        };
        this.addLog(room, `📜 ${actor.name} está escolhendo as cartas da Troca.`);
        break;
      }

      case 'assassinate': {
        const target = room.players.find(p => p.id === pending.targetId);
        if (target && target.cards.some(c => !c.revealed)) {
          this.addLog(room, `🗡️ O assassinato contra ${target.name} foi executado!`);
          room.pendingAction = null;
          room.pendingLoss = {
            playerId: target.id,
            reason: `${actor.name} te assassinou! Escolha uma carta para perder.`
          };
        } else {
          this.advanceTurn(room);
        }
        break;
      }

      case 'steal': {
        const target = room.players.find(p => p.id === pending.targetId);
        if (target) {
          const stolenAmount = Math.min(2, target.coins);
          target.coins -= stolenAmount;
          actor.coins += stolenAmount;
          this.addLog(room, `🪝 ${actor.name} roubou ${stolenAmount} moeda(s) de ${target.name}.`);
        }
        this.advanceTurn(room);
        break;
      }

      default:
        this.advanceTurn(room);
        break;
    }
  }

  selectLossCard(code, playerId, cardId) {
    const room = this.getRoom(code);
    if (!room || !room.pendingLoss) throw new Error('Nenhuma perda de influência pendente.');
    if (room.pendingLoss.playerId !== playerId) throw new Error('Não é você quem deve escolher a carta a ser revelada.');

    const player = room.players.find(p => p.id === playerId);
    const card = player.cards.find(c => c.id === cardId && !c.revealed);

    if (!card) throw new Error('Carta inválida ou já revelada.');

    card.revealed = true;
    this.addLog(room, `💀 ${player.name} revelou a carta ${card.character.toUpperCase()}!`, 'elimination');

    if (player.cards.every(c => c.revealed)) {
      this.addLog(room, `☠️ ${player.name} perdeu todas as influências e foi ELIMINADO!`, 'elimination');
    }

    const callback = room.pendingLoss.callbackAction;
    room.pendingLoss = null;

    if (this.checkWinCondition(room)) return room;

    if (callback) {
      callback();
    } else if (room.pendingAction) {
      this.executeAction(room, room.pendingAction);
    } else {
      this.advanceTurn(room);
    }

    return room;
  }

  selectExchangeCards(code, playerId, keptCardIds) {
    const room = this.getRoom(code);
    if (!room || !room.pendingExchange) throw new Error('Nenhuma troca pendente.');
    if (room.pendingExchange.playerId !== playerId) throw new Error('Não é a sua vez de trocar cartas.');

    const { drawnCards, currentCards, keepCount } = room.pendingExchange;
    const allAvailable = [...drawnCards, ...currentCards];

    if (keptCardIds.length !== keepCount) {
      throw new Error(`Você deve selecionar exatamente ${keepCount} carta(s) para manter.`);
    }

    const keptCards = allAvailable.filter(c => keptCardIds.includes(c.id));
    if (keptCards.length !== keepCount) {
      throw new Error('Seleção de cartas inválida.');
    }

    const returnedCards = allAvailable.filter(c => !keptCardIds.includes(c.id));

    const player = room.players.find(p => p.id === playerId);
    const revealedCards = player.cards.filter(c => c.revealed);
    player.cards = [...revealedCards, ...keptCards.map(c => ({ ...c, revealed: false }))];

    returnedCards.forEach(c => room.deck.push(c.character));
    this.shuffle(room.deck);

    this.addLog(room, `📜 ${player.name} concluiu a Troca de cartas.`);
    room.pendingExchange = null;
    this.advanceTurn(room);

    return room;
  }

  // AI Bot Automated Decision Making with Turn Delay Cooldown
  handleBotTurns(code) {
    const room = this.getRoom(code);
    if (!room || room.status !== 'playing') return false;

    // Enforce 1.8 seconds delay between bot actions so players can follow what happened!
    const now = Date.now();
    if (room.lastStateChange && (now - room.lastStateChange < 1800)) {
      return false;
    }

    // Case 1: Pending Loss for Bot
    if (room.pendingLoss) {
      const target = room.players.find(p => p.id === room.pendingLoss.playerId);
      if (target && target.isBot) {
        const unrevealed = target.cards.filter(c => !c.revealed);
        if (unrevealed.length > 0) {
          const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
          this.selectLossCard(code, target.id, pick.id);
          return true;
        }
      }
    }

    // Case 2: Pending Exchange for Bot
    if (room.pendingExchange) {
      const target = room.players.find(p => p.id === room.pendingExchange.playerId);
      if (target && target.isBot) {
        const { drawnCards, currentCards, keepCount } = room.pendingExchange;
        const allAvailable = [...drawnCards, ...currentCards];
        const keptIds = allAvailable.slice(0, keepCount).map(c => c.id);
        this.selectExchangeCards(code, target.id, keptIds);
        return true;
      }
    }

    // Case 3: Pending Action Challenges / Blocks
    if (room.pendingAction) {
      const pending = room.pendingAction;
      const aliveBots = room.players.filter(p => p.isBot && p.cards.some(c => !c.revealed));

      for (const bot of aliveBots) {
        if (pending.stage === 'ACTION_CHALLENGE' && bot.id !== pending.actorId && !pending.responses[bot.id]) {
          const shouldChallenge = Math.random() < 0.15;
          if (shouldChallenge) {
            this.respondToAction(code, bot.id, 'challenge');
          } else {
            this.respondToAction(code, bot.id, 'pass');
          }
          return true;
        }

        if (pending.stage === 'ACTION_BLOCK' && !pending.responses[bot.id]) {
          if (pending.action === 'foreign_aid' && bot.id !== pending.actorId) {
            const hasDuke = bot.cards.some(c => !c.revealed && c.character === 'duke');
            if (hasDuke || Math.random() < 0.2) {
              this.respondToAction(code, bot.id, 'block', 'duke');
            } else {
              this.respondToAction(code, bot.id, 'pass');
            }
            return true;
          } else if (pending.action === 'assassinate' && bot.id === pending.targetId) {
            const hasCountess = bot.cards.some(c => !c.revealed && c.character === 'countess');
            if (hasCountess || Math.random() < 0.5) {
              this.respondToAction(code, bot.id, 'block', 'countess');
            } else {
              this.respondToAction(code, bot.id, 'pass');
            }
            return true;
          } else if (pending.action === 'steal' && bot.id === pending.targetId) {
            const hasCap = bot.cards.some(c => !c.revealed && c.character === 'captain');
            const hasAmb = bot.cards.some(c => !c.revealed && c.character === 'ambassador');
            if (hasCap) {
              this.respondToAction(code, bot.id, 'block', 'captain');
            } else if (hasAmb) {
              this.respondToAction(code, bot.id, 'block', 'ambassador');
            } else if (Math.random() < 0.25) {
              this.respondToAction(code, bot.id, 'block', 'captain');
            } else {
              this.respondToAction(code, bot.id, 'pass');
            }
            return true;
          }
        }

        if (pending.stage === 'BLOCK_CHALLENGE' && bot.id !== pending.blockerId && !pending.responses[bot.id]) {
          if (Math.random() < 0.15) {
            this.respondToAction(code, bot.id, 'challenge');
          } else {
            this.respondToAction(code, bot.id, 'pass');
          }
          return true;
        }
      }
    }

    // Case 4: Bot's Turn to choose Action
    const currentTurnPlayer = room.players.find(p => p.id === room.currentTurnPlayerId);
    if (currentTurnPlayer && currentTurnPlayer.isBot && !room.pendingAction && !room.pendingLoss && !room.pendingExchange) {
      // Ensure bot is alive before acting!
      if (currentTurnPlayer.cards.every(c => c.revealed)) {
        this.advanceTurn(room);
        return true;
      }

      const aliveOpponents = room.players.filter(p => p.id !== currentTurnPlayer.id && p.cards.some(c => !c.revealed));
      const randomOpponent = aliveOpponents[Math.floor(Math.random() * aliveOpponents.length)];

      if (currentTurnPlayer.coins >= 10) {
        this.playAction(code, currentTurnPlayer.id, 'coup', randomOpponent?.id);
      } else if (currentTurnPlayer.coins >= 7 && Math.random() < 0.6) {
        this.playAction(code, currentTurnPlayer.id, 'coup', randomOpponent?.id);
      } else if (currentTurnPlayer.coins >= 3 && Math.random() < 0.4) {
        this.playAction(code, currentTurnPlayer.id, 'assassinate', randomOpponent?.id);
      } else {
        const actions = ['income', 'foreign_aid', 'tax', 'exchange'];
        if (randomOpponent && randomOpponent.coins > 0) actions.push('steal');
        const chosen = actions[Math.floor(Math.random() * actions.length)];

        if (chosen === 'steal') {
          this.playAction(code, currentTurnPlayer.id, 'steal', randomOpponent?.id);
        } else {
          this.playAction(code, currentTurnPlayer.id, chosen);
        }
      }
      return true;
    }

    return false;
  }
}

export const gameEngine = new GameEngine();
