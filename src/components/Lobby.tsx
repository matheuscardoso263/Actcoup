import React, { useState } from 'react';
import { GameState, CHARACTER_INFO, Character } from '../types/game';
import { socketService } from '../services/socket';
import { sound } from '../audio/sound';
import { Users, Play, Copy, Check, Bot, Crown, LogOut, ShieldAlert, WifiOff } from 'lucide-react';

interface LobbyProps {
  gameState: GameState | null;
  playerId: string | null;
  onLeaveRoom: () => void;
  onEnterRoom: () => void;
}

/* O leque da tela de entrada. A ordem é a da colônia: o Gorila abre à
   esquerda e o Babuíno fecha à direita, deixando os dois retratos de
   manto verde nas pontas para o leque fechar simétrico. */
const FAN: Array<{ id: Character; rot: string; lift: string }> = [
  { id: 'duke', rot: '-14deg', lift: '1.1rem' },
  { id: 'assassin', rot: '-7deg', lift: '0.35rem' },
  { id: 'captain', rot: '0deg', lift: '0rem' },
  { id: 'ambassador', rot: '7deg', lift: '0.35rem' },
  { id: 'countess', rot: '14deg', lift: '1.1rem' }
];

export const Lobby: React.FC<LobbyProps> = ({ gameState, playerId, onLeaveRoom, onEnterRoom }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Por favor, informe seu nome.');
      return;
    }
    sound.playClick();
    setLoading(true);
    setError(null);
    onEnterRoom();
    const res = await socketService.createRoom(playerName.trim());
    setLoading(false);
    if (!res.success) {
      setError(res.message || 'Erro ao criar sala.');
      sound.playError();
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      setError('Por favor, informe seu nome.');
      return;
    }
    if (!roomCodeInput.trim()) {
      setError('Por favor, informe o código da sala.');
      return;
    }
    sound.playClick();
    setLoading(true);
    setError(null);
    onEnterRoom();
    const res = await socketService.joinRoom(roomCodeInput.trim().toUpperCase(), playerName.trim());
    setLoading(false);
    if (!res.success) {
      setError(res.message || 'Erro ao entrar na sala.');
      sound.playError();
    }
  };

  const handleAddBot = async () => {
    if (!gameState) return;
    sound.playClick();
    const res = await socketService.addBot(gameState.code);
    if (!res.success) {
      setError(res.message || 'Não foi possível adicionar bot.');
    }
  };

  const handleStartGame = async () => {
    if (!gameState) return;
    sound.playClick();
    const res = await socketService.startGame(gameState.code);
    if (!res.success) {
      setError(res.message || 'Não foi possível iniciar a partida.');
      sound.playError();
    }
  };

  const handleCopyCode = () => {
    if (!gameState) return;
    navigator.clipboard.writeText(gameState.code);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaimHost = async () => {
    if (!gameState) return;
    sound.playClick();
    const res = await socketService.claimHost(gameState.code);
    if (!res.success) {
      setError(res.message || 'Não foi possível assumir a sala.');
      sound.playError();
    }
  };

  const me = gameState?.players.find(p => p.id === playerId);
  const isHost = me?.isHost;
  const currentHost = gameState?.players.find(p => p.isHost);
  // Sala travada: host virou bot, sumiu ou caiu — qualquer humano presente destrava.
  const canClaimHost = Boolean(
    gameState && me && !isHost && (!currentHost || currentHost.isBot || !currentHost.isConnected)
  );
  const canStart = isHost && gameState && gameState.players.length >= gameState.minPlayers && gameState.players.length <= gameState.maxPlayers;

  /* ============================================================
     ENTRADA
     ============================================================ */

  if (!gameState) {
    return (
      <div className="court-screen court-hall text-slate-100">
        <div className="court-stage court-entry">

          {/* --- O convite ------------------------------------- */}
          <div className="court-entry-intro">
            <span
              className="court-crest court-entry-crest court-rise"
              style={{ '--delay': '40ms' } as React.CSSProperties}
            >
              <span>2 a 6 primatas</span>
            </span>

            <h1
              className="court-title court-entry-title court-rise"
              style={{ '--delay': '90ms' } as React.CSSProperties}
            >
              República
              <br />
              dos Primatas
            </h1>

            <div
              className="court-rule is-start court-entry-rule court-rise"
              style={{ '--delay': '150ms' } as React.CSSProperties}
            />

            <p
              className="court-lede court-entry-lede court-rise"
              style={{ '--delay': '200ms' } as React.CSSProperties}
            >
              Duas cartas na mão e <strong>nenhuma verdade na copa</strong>. Exile a
              colônia inteira sem que ninguém descubra quem você realmente é.
            </p>

            {/* O leque é o herói: são os cinco retratos do jogo, e passar
                o mouse abre a ficha de cada um — quem é e o que faz. */}
            <div className="court-fan court-entry-fan">
              {FAN.map((card, i) => (
                <div
                  key={card.id}
                  className="court-fan-card"
                  style={{ '--rot': card.rot, '--lift': card.lift } as React.CSSProperties}
                >
                  <div
                    className="court-fan-drop"
                    style={{ '--delay': `${320 + i * 85}ms` } as React.CSSProperties}
                  >
                    <div className="court-fan-face">
                      <img src={CHARACTER_INFO[card.id].image} alt={CHARACTER_INFO[card.id].name} />
                    </div>
                  </div>
                  <span className="court-fan-say">
                    <span className="court-fan-name">{CHARACTER_INFO[card.id].name}</span>
                    <span className="court-fan-desc">{CHARACTER_INFO[card.id].description}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* --- A mesa ---------------------------------------- */}
          <div
            className="court-plate court-entry-plate court-rise"
            style={{ '--delay': '260ms' } as React.CSSProperties}
          >
            <span className="court-plate-corner is-tl" />
            <span className="court-plate-corner is-br" />

            <img src="/logo.png" alt="República dos Primatas" className="court-entry-logo" />

            <div className="court-rule" />

            {error && (
              <div className="court-alert">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="court-entry-name">
              <label className="court-label" htmlFor="lobby-name">
                Seu nome
              </label>
              <input
                id="lobby-name"
                type="text"
                placeholder="Ex: Gorila Alfa"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="court-field"
              />
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="court-btn is-gold w-full"
            >
              Abrir uma copa
            </button>

            <div className="court-divider court-entry-divider">
              <span className="court-label is-tight">ou entre numa</span>
            </div>

            <input
              type="text"
              maxLength={6}
              placeholder="CÓDIGO"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              className="court-field is-code"
            />

            <button
              onClick={handleJoinRoom}
              disabled={loading}
              className="court-btn is-stone w-full"
            >
              Entrar na copa
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     ANTESSALA
     ============================================================ */

  // Cadeiras vazias até lotar: mostra de relance quanta gente ainda cabe,
  // que é justamente a decisão de quem está esperando na sala.
  const emptySeats = Math.max(0, gameState.maxPlayers - gameState.players.length);
  const missing = Math.max(0, gameState.minPlayers - gameState.players.length);

  return (
    <div className="court-screen court-hall text-slate-100">
      <div className="court-stage court-plate court-room court-rise">
        <span className="court-plate-corner is-tl" />
        <span className="court-plate-corner is-br" />

        {/* --- Cabeçalho: o código é o que importa aqui ------- */}
        <div className="flex items-start justify-between gap-4 shrink-0">
          <div>
            <span className="court-crest">
              <span>Antessala</span>
            </span>

            <div className="flex items-center gap-3 mt-3">
              <span className="court-code">{gameState.code}</span>
              <button
                onClick={handleCopyCode}
                className="court-btn is-stone is-compact"
                title="Copiar código da sala"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <p className="court-label is-tight mt-2">Passe o código para quem vai jogar</p>
          </div>

          <button onClick={onLeaveRoom} className="court-btn is-ember is-compact shrink-0">
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>

        <div className="court-rule shrink-0" />

        {error && (
          <div className="court-alert shrink-0">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* --- Os assentos ----------------------------------- */}
        <div className="flex items-baseline justify-between shrink-0">
          <span className="court-label is-row">
            <Users className="w-3.5 h-3.5" />
            Na copa · {gameState.players.length} de {gameState.maxPlayers}
          </span>
          {missing > 0 && (
            <span className="text-[0.7rem] font-semibold text-amber-300/70">
              {missing === 1 ? 'Falta 1 jogador' : `Faltam ${missing} jogadores`}
            </span>
          )}
        </div>

        {/* A única parte que rola: seis cadeiras numa janela baixa não
            cabem, e é melhor rolar a lista do que a tela inteira. */}
        <div className="court-room-seats">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className={`court-seat ${player.id === playerId ? 'is-me' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="court-sigil">{player.name.charAt(0).toUpperCase()}</span>
                <span className="font-semibold text-sm truncate">
                  {player.name}
                  {player.id === playerId && (
                    <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-widest text-[color:var(--court-ember-hi)]">
                      Você
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {player.isHost && (
                  <span className="court-tag is-host">
                    <Crown className="w-3 h-3" /> Anfitrião
                  </span>
                )}
                {player.isBot && (
                  <span className="court-tag is-bot">
                    <Bot className="w-3 h-3" /> IA
                  </span>
                )}
                {!player.isBot && !player.isConnected && (
                  <span className="court-tag is-away">
                    <WifiOff className="w-3 h-3" /> Caiu
                  </span>
                )}
              </div>
            </div>
          ))}

          {Array.from({ length: emptySeats }, (_, i) => (
            <div key={`empty-${i}`} className="court-seat is-empty">
              <div className="flex items-center gap-3">
                <span className="court-sigil opacity-30">·</span>
                <span className="court-label is-tight">Cadeira vaga</span>
              </div>
            </div>
          ))}
        </div>

        {/* --- Comandos -------------------------------------- */}
        {isHost && (
          <div className="court-room-acts">
            {gameState.players.length < gameState.maxPlayers && (
              <button onClick={handleAddBot} className="court-btn is-stone w-full">
                <Bot className="w-4 h-4" />
                Sentar uma IA na copa
              </button>
            )}

            <button onClick={handleStartGame} disabled={!canStart} className="court-btn is-gold w-full">
              <Play className="w-4 h-4 fill-current" />
              Distribuir as cartas
            </button>
          </div>
        )}

        {!isHost && !canClaimHost && (
          <div className="court-room-acts text-center">
            <p className="court-label is-tight">
              {currentHost ? `${currentHost.name} abre a partida` : 'Aguardando o anfitrião'}
            </p>
          </div>
        )}

        {canClaimHost && (
          <div className="court-room-acts">
            <p className="text-xs text-center text-slate-400">
              O anfitrião não está mais na copa. Assuma para poder começar.
            </p>
            <button onClick={handleClaimHost} className="court-btn is-gold w-full">
              <Crown className="w-4 h-4" />
              Assumir a sala
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
