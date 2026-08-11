import { useEffect, useRef, useState } from 'react';
import { GameState } from '../types/game';

const HOLD = 1700;

export interface TurnAnnounce {
  /** Muda a cada troca de vez — serve de key pra reiniciar a animação. */
  id: number;
  name: string;
  isMe: boolean;
}

/**
 * Anuncia a troca de vez. Fica em silêncio na entrada e na reconexão:
 * quem acabou de sentar não precisa ver "vez de fulano" surgir do nada.
 */
export function useTurnAnnounce(gameState: GameState, playerId: string): TurnAnnounce | null {
  const [announce, setAnnounce] = useState<TurnAnnounce | null>(null);
  const prevTurn = useRef<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const turn = gameState.currentTurnPlayerId;

    if (gameState.status !== 'playing' || !turn) {
      prevTurn.current = null;
      setAnnounce(null);
      return;
    }

    if (prevTurn.current === null) {
      prevTurn.current = turn;
      return;
    }
    if (prevTurn.current === turn) return;

    prevTurn.current = turn;
    const player = gameState.players.find(p => p.id === turn);
    if (!player) return;

    seq.current += 1;
    setAnnounce({ id: seq.current, name: player.name, isMe: player.id === playerId });
  }, [gameState, playerId]);

  useEffect(() => {
    if (!announce) return;
    const timer = window.setTimeout(() => setAnnounce(null), HOLD);
    return () => clearTimeout(timer);
  }, [announce]);

  return announce;
}
