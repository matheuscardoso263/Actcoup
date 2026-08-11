import React, { useState } from 'react';
import { GameState } from '../types/game';
import { socketService } from '../services/socket';
import { sound } from '../audio/sound';
import { Users, Play, Copy, Check, Bot, Crown, LogOut, Sparkles, ShieldAlert } from 'lucide-react';

interface LobbyProps {
  gameState: GameState | null;
  playerId: string | null;
  onLeaveRoom: () => void;
  onEnterRoom: () => void;
}

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

  if (!gameState) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white relative overflow-hidden">
        {/* Glow ambient background elements */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl" />

        <div className="relative z-10 w-full max-w-md xl:max-w-lg bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-8 xl:p-10 shadow-2xl">
          <div className="text-center mb-6">
            <img
              src="/logosemfundo.png"
              alt="Coup Logo"
              className="w-48 mx-auto mb-2 drop-shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:scale-105 transition-transform"
            />
            <p className="text-xs text-slate-400">
              Jogo de blefe, manipulação e estratégia
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-sm flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Seu Nome
              </label>
              <input
                type="text"
                placeholder="Ex: Duque Matheus"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl font-bold bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                Criar Nova Sala
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800" />
                <span className="flex-shrink mx-4 text-xs font-bold text-slate-500 uppercase">Ou entrar com código</span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="CÓDIGO (Ex: CP8X9A)"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-white placeholder-slate-500 tracking-widest text-center font-mono uppercase outline-none transition-all"
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 hover:border-cyan-400 shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                >
                  Entrar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white relative">
      <div className="w-full max-w-xl xl:max-w-2xl max-h-[92dvh] overflow-y-auto bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex justify-between items-center pb-6 border-b border-slate-800">
          <div>
            <img src="/logosemfundo.png" alt="Coup Logo" className="h-10 mb-2 drop-shadow-md" />
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Sala de Espera</span>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-3xl font-extrabold tracking-wider font-mono text-amber-400">
                {gameState.code}
              </h2>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs"
                title="Copiar código"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <button
            onClick={onLeaveRoom}
            className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 hover:text-white transition-all flex items-center gap-2 text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-sm flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="my-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Jogadores ({gameState.players.length}/6)
            </span>
            <span className="text-xs text-slate-400">Mínimo: 2 jogadores</span>
          </div>

          <div className="space-y-2 max-h-[min(40dvh,20rem)] overflow-y-auto pr-1">
            {gameState.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  player.id === playerId
                    ? 'bg-purple-950/50 border-purple-500/50 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-sm">{player.name}</span>
                    {player.id === playerId && <span className="ml-2 text-xs text-purple-400 font-bold">(Você)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {player.isHost && (
                    <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5" /> Host
                    </span>
                  )}
                  {player.isBot && (
                    <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-xs font-bold flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5" /> IA
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Host Controls */}
        {isHost && (
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
            {gameState.players.length < gameState.maxPlayers && (
              <button
                onClick={handleAddBot}
                className="w-full py-2.5 px-4 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 flex items-center justify-center gap-2 text-sm transition-all"
              >
                <Bot className="w-4 h-4 text-cyan-400" />
                Adicionar Bot (IA)
              </button>
            )}

            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full py-3.5 px-6 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5 fill-current" />
              Iniciar Partida
            </button>
          </div>
        )}

        {!isHost && !canClaimHost && (
          <div className="pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400 animate-pulse">
              Aguardando o host iniciar a partida...
            </p>
          </div>
        )}

        {canClaimHost && (
          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
            <p className="text-xs text-slate-400 text-center">
              O host da sala está ausente. Assuma o controle para iniciar a partida.
            </p>
            <button
              onClick={handleClaimHost}
              className="w-full py-3 px-6 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Assumir a sala
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
