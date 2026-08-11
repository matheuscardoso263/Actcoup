import { useCallback, useEffect, useRef, useState } from 'react';
import { BlockLogEvent, ChallengeLogEvent, GameState } from '../types/game';

export interface ChallengeScene extends ChallengeLogEvent {
  /** Id do log de origem — serve de key pra remontar a cena no React. */
  id: string;
  /** O desafiado é você. */
  iAmClaimer: boolean;
  /** Você é quem duvidou. */
  iAmChallenger: boolean;
}

export interface BlockFlashEvent extends BlockLogEvent {
  id: string;
  iAmBlocker: boolean;
}

/**
 * Converte os logs recém-chegados em animações.
 *
 * O servidor manda o estado inteiro a cada broadcast, então "o que acabou de
 * acontecer" é sempre uma diferença. Para moedas e cartas dá pra inferir do
 * saldo e do `revealed`; um desafio, não — ele nasce e se resolve dentro do
 * mesmo broadcast, sem deixar rastro no estado. Por isso o gancho aqui são os
 * ids dos logs, que o servidor já gera únicos e estáveis.
 */
export function useTableEvents(gameState: GameState, playerId: string) {
  const [challenges, setChallenges] = useState<ChallengeScene[]>([]);
  const [blocks, setBlocks] = useState<BlockFlashEvent[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const prevStatus = useRef<GameState['status']>(gameState.status);

  useEffect(() => {
    const ids = new Set(gameState.logs.map(log => log.id));

    // Troca de fase (nova partida, volta ao lobby): rebaseia e limpa o que
    // estivesse em cena — a partida daqueles eventos acabou.
    if (prevStatus.current !== gameState.status) {
      prevStatus.current = gameState.status;
      seen.current = ids;
      setChallenges([]);
      setBlocks([]);
      return;
    }

    const before = seen.current;
    seen.current = ids;

    // Primeiro estado da sessão (entrada ou reconexão) é só baseline: quem
    // acabou de sentar não assiste aos desafios que já aconteceram.
    if (!before) return;

    const freshChallenges: ChallengeScene[] = [];
    const freshBlocks: BlockFlashEvent[] = [];

    // logs vem do mais novo pro mais antigo (unshift no servidor); percorrer
    // ao contrário devolve a ordem cronológica, que é a ordem das cenas.
    for (let i = gameState.logs.length - 1; i >= 0; i--) {
      const log = gameState.logs[i];
      if (!log.event || before.has(log.id)) continue;

      if (log.event.kind === 'challenge') {
        freshChallenges.push({
          ...log.event,
          id: log.id,
          iAmClaimer: log.event.claimerId === playerId,
          iAmChallenger: log.event.challengerId === playerId
        });
      } else if (log.event.kind === 'block') {
        freshBlocks.push({
          ...log.event,
          id: log.id,
          iAmBlocker: log.event.blockerId === playerId
        });
      }
    }

    if (freshChallenges.length > 0) setChallenges(current => [...current, ...freshChallenges]);
    if (freshBlocks.length > 0) setBlocks(current => [...current, ...freshBlocks]);
  }, [gameState, playerId]);

  // Estáveis: as cenas usam isso como dependência de efeito e não podem
  // reiniciar a cada broadcast do servidor.
  const dismissChallenge = useCallback(() => {
    setChallenges(current => current.slice(1));
  }, []);

  const dismissBlock = useCallback((id: string) => {
    setBlocks(current => current.filter(block => block.id !== id));
  }, []);

  return {
    challenge: challenges[0] ?? null,
    dismissChallenge,
    blocks,
    dismissBlock
  };
}
