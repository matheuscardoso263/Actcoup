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

/* O leque da tela de entrada. A ordem é a da mesa, não a alfabética:
   Duque na esquerda e Condessa na direita deixam os dois retratos de
   manto vermelho nas pontas, e o leque fecha simétrico. */
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
      <div className="court-screen flex items-center justify-center p-4 sm:p-6 text-slate-100">
        <div className="court-stage w-full max-w-6xl grid gap-8 lg:gap-12 lg:grid-cols-[1.05fr_minmax(0,22rem)] items-center">

          {/* --- O convite ------------------------------------- */}
          <div className="text-center lg:text-left">
            <span className="court-crest court-rise" style={{ '--delay': '40ms' } as React.CSSProperties}>
              <span>2 a 6 nobres</span>
            </span>

            <h1
              className="court-title court-rise mt-4 text-[clamp(3.5rem,11vw,7.5rem)]"
              style={{ '--delay': '90ms' } as React.CSSProperties}
            >
              Coup
            </h1>

            <div
              className="court-rule is-start court-rise mt-5 max-w-sm mx-auto lg:mx-0"
              style={{ '--delay': '150ms' } as React.CSSProperties}
            />

            <p
              className="court-lede court-rise mt-5 max-w-sm mx-auto lg:mx-0"
              style={{ '--delay': '200ms' } as React.CSSProperties}
            >
              Duas cartas na mão e <strong>nenhuma verdade na mesa</strong>. Derrube a
              corte inteira sem que ninguém descubra quem você realmente é.
            </p>

            {/* O leque é o herói: são os cinco retratos do jogo, e passar
                o mouse revela o nome de cada um. */}
            <div className="court-fan mt-2 lg:-ml-6">
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
                  <span className="court-fan-name">{CHARACTER_INFO[card.id].name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* --- A mesa ---------------------------------------- */}
          <div
            className="court-plate court-rise p-6 sm:p-7"
            style={{ '--delay': '260ms' } as React.CSSProperties}
          >
            <span className="court-plate-corner is-tl" />
            <span className="court-plate-corner is-br" />

            <img src="/logosemfundo.png" alt="ActCoup" className="h-11 mx-auto opacity-90" />

            <div className="court-rule mt-5" />

            {error && (
              <div className="court-alert mt-5">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-rose-300" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6">
              <label className="court-label mb-2" htmlFor="lobby-name">
                Seu nome
              </label>
              <input
                id="lobby-name"
                type="text"
                placeholder="Ex: Duque Matheus"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="court-field"
              />
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="court-btn is-gold w-full mt-5"
            >
              Abrir uma mesa
            </button>

            <div className="court-divider my-6">
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
              className="court-btn is-stone w-full mt-3"
            >
              Entrar na mesa
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
    <div className="court-screen flex items-center justify-center p-4 text-slate-100">
      <div className="court-stage w-full max-w-2xl">
        <div className="court-plate court-rise max-h-[92dvh] overflow-y-auto p-6 sm:p-8">
          <span className="court-plate-corner is-tl" />
          <span className="court-plate-corner is-br" />

          {/* --- Cabeçalho: o código é o que importa aqui ------- */}
          <div className="flex items-start justify-between gap-4">
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

            <button onClick={onLeaveRoom} className="court-btn is-crimson is-compact shrink-0">
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>

          <div className="court-rule mt-6" />

          {error && (
            <div className="court-alert mt-5">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-rose-300" />
              <span>{error}</span>
            </div>
          )}

          {/* --- Os assentos ----------------------------------- */}
          <div className="flex items-baseline justify-between mt-6 mb-3">
            <span className="court-label is-row">
              <Users className="w-3.5 h-3.5" />
              À mesa · {gameState.players.length} de {gameState.maxPlayers}
            </span>
            {missing > 0 && (
              <span className="text-[0.7rem] font-semibold text-amber-300/70">
                {missing === 1 ? 'Falta 1 jogador' : `Faltam ${missing} jogadores`}
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-[min(38dvh,22rem)] overflow-y-auto pr-1">
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
                      <span className="ml-2 text-[0.65rem] font-bold uppercase tracking-widest text-rose-300/80">
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
            <div className="mt-6 pt-5 border-t border-[rgba(201,180,140,0.14)] flex flex-col gap-3">
              {gameState.players.length < gameState.maxPlayers && (
                <button onClick={handleAddBot} className="court-btn is-stone w-full">
                  <Bot className="w-4 h-4" />
                  Sentar uma IA à mesa
                </button>
              )}

              <button onClick={handleStartGame} disabled={!canStart} className="court-btn is-gold w-full">
                <Play className="w-4 h-4 fill-current" />
                Distribuir as cartas
              </button>
            </div>
          )}

          {!isHost && !canClaimHost && (
            <div className="mt-6 pt-5 border-t border-[rgba(201,180,140,0.14)] text-center">
              <p className="court-label is-tight">
                {currentHost ? `${currentHost.name} abre a partida` : 'Aguardando o anfitrião'}
              </p>
            </div>
          )}

          {canClaimHost && (
            <div className="mt-6 pt-5 border-t border-[rgba(201,180,140,0.14)] flex flex-col gap-3">
              <p className="text-xs text-center text-slate-400">
                O anfitrião não está mais à mesa. Assuma para poder começar.
              </p>
              <button onClick={handleClaimHost} className="court-btn is-gold w-full">
                <Crown className="w-4 h-4" />
                Assumir a sala
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
