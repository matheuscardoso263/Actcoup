import React, { useEffect } from 'react';
import { GameState } from '../types/game';
import confetti from 'canvas-confetti';
import { sound } from '../audio/sound';
import { socketService } from '../services/socket';
import { Trophy, RefreshCw, LogOut } from 'lucide-react';

interface GameOverModalProps {
  gameState: GameState;
  playerId: string;
  onReturnToLobby: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameState,
  playerId,
  onReturnToLobby
}) => {
  const winner = gameState.winner;
  const isWinner = winner?.id === playerId;

  useEffect(() => {
    sound.playVictory();
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, []);

  const handleReturnToLobby = async () => {
    sound.playClick();
    await socketService.resetRoom(gameState.code);
    onReturnToLobby();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl" />

        <div className="relative z-10">
          <img src="/logosemfundo.png" alt="Coup Logo" className="w-36 mx-auto mb-3 drop-shadow-lg" />
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 mb-4 shadow-lg shadow-amber-500/40 animate-bounce">
            <Trophy className="w-12 h-12" />
          </div>

          <h2 className="text-3xl font-extrabold tracking-wider text-amber-400 font-serif mb-1">
            FIM DE JOGO!
          </h2>

          <div className="my-6 py-4 px-6 rounded-xl bg-slate-950/80 border border-amber-500/30">
            <span className="text-xs uppercase tracking-widest text-slate-400 block mb-1">Vencedor Supremo</span>
            <span className="text-2xl font-bold text-white tracking-wide">{winner?.name}</span>
            {isWinner && (
              <span className="block mt-1 text-xs text-amber-400 font-extrabold uppercase tracking-widest">
                🎉 Você foi o campeão! 🎉
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReturnToLobby}
              className="w-full py-3.5 px-6 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Voltar para a Sala
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
