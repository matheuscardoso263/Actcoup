import { useCallback, useEffect, useRef, useState } from 'react';
import { Character, GameState } from '../types/game';

export type CinematicKind = 'kill' | 'eject';

export interface CinematicEvent {
  id: string;
  kind: CinematicKind;
  victimId: string;
  victimName: string;
  /** A carta que acabou de virar — só é conhecida depois da revelação. */
  character: Character;
  isMe: boolean;
  /** Jogadores ainda com influência, já contando esta perda. */
  playersLeft: number;
}

/** cardId -> revealed. Os ids são estáveis entre broadcasts (o servidor só
 *  troca `character` por 'hidden' ao sanitizar), então dá pra diferenciar
 *  "carta nova" de "carta que virou" sem tocar no back-end. */
type RevealMap = Map<string, boolean>;

function snapshot(state: GameState): RevealMap {
  const map: RevealMap = new Map();
  for (const player of state.players) {
    for (const card of player.cards) {
      map.set(card.id, card.revealed);
    }
  }
  return map;
}

/**
 * Observa o gameState e emite uma cutscene a cada influência perdida.
 * Fila em vez de evento único: um desafio pode derrubar duas cartas no
 * mesmo broadcast, e as duas merecem sua cena.
 */
/** Espaço para a carta virar na mesa antes da cutscene cobrir tudo.
 *  Tem que acompanhar FLIP_MS do CardView. */
const FLIP_LEAD = 640;

export function useGameEvents(gameState: GameState, playerId: string) {
  const [queue, setQueue] = useState<CinematicEvent[]>([]);
  const prevReveals = useRef<RevealMap | null>(null);
  const prevStatus = useRef<GameState['status']>(gameState.status);
  const pending = useRef<number[]>([]);

  useEffect(() => {
    // Troca de fase (nova partida, volta ao lobby): rebaseia sem disparar nada.
    if (prevStatus.current !== gameState.status) {
      prevStatus.current = gameState.status;
      prevReveals.current = snapshot(gameState);
      // Também descarta cutscene em espera: a partida anterior acabou.
      pending.current.forEach(clearTimeout);
      pending.current = [];
      setQueue([]);
      return;
    }

    const previous = prevReveals.current;
    prevReveals.current = snapshot(gameState);

    // Primeiro estado da sessão (entrada ou reconexão): serve só de baseline,
    // senão quem reconecta leva na cara todas as mortes que já aconteceram.
    if (!previous) return;

    const playersLeft = gameState.players.filter(p => p.cards.some(c => !c.revealed)).length;
    const fresh: CinematicEvent[] = [];

    for (const player of gameState.players) {
      // `=== false` e não `!previous.get(...)`: carta que não existia antes
      // (comprada na troca do Embaixador) retorna undefined e não vale evento.
      const justRevealed = player.cards.filter(c => c.revealed && previous.get(c.id) === false);
      if (justRevealed.length === 0) continue;

      const isOut = player.cards.every(c => c.revealed);

      justRevealed.forEach((card, index) => {
        const isLast = index === justRevealed.length - 1;
        fresh.push({
          id: `${player.id}:${card.id}`,
          // Só a última revelação do jogador vira eliminação; as anteriores
          // continuam sendo baixas simples.
          kind: isOut && isLast ? 'eject' : 'kill',
          victimId: player.id,
          victimName: player.name,
          character: card.character as Character,
          isMe: player.id === playerId,
          playersLeft
        });
      });
    }

    if (fresh.length > 0) {
      // Segura a cutscene pelo tempo da virada 3D: sem isso o overlay
      // cobre a mesa antes de dar pra ver qual carta virou.
      pending.current.push(
        window.setTimeout(() => setQueue(current => [...current, ...fresh]), FLIP_LEAD)
      );
    }
  }, [gameState, playerId]);

  useEffect(
    () => () => {
      pending.current.forEach(clearTimeout);
      pending.current = [];
    },
    []
  );

  // Estável: a cutscene usa isso como dependência de efeito e não pode
  // reiniciar a cada broadcast do servidor.
  const dismiss = useCallback(() => {
    setQueue(current => current.slice(1));
  }, []);

  return { current: queue[0] ?? null, dismiss };
}
