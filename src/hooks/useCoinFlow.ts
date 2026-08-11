import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState } from '../types/game';

/** Âncora da tesouraria — o "jogador" que representa o banco. */
export const TREASURY = '__treasury__';

export interface CoinFlow {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
}

/**
 * Diferencia o saldo de cada jogador entre dois broadcasts e descreve o
 * movimento das moedas. Como o servidor manda só o saldo final, a origem é
 * inferida: um ganho isolado vem da tesouraria, uma perda isolada volta pra
 * ela, e um par ganho/perda do mesmo valor é um Roubo.
 */
export function useCoinFlow(gameState: GameState) {
  const [flows, setFlows] = useState<CoinFlow[]>([]);
  const prevCoins = useRef<Map<string, number> | null>(null);
  const prevStatus = useRef<GameState['status']>(gameState.status);
  const seq = useRef(0);

  useEffect(() => {
    const snapshot = new Map(gameState.players.map(p => [p.id, p.coins]));

    // Troca de fase (nova partida): rebaseia sem animar as 2 moedas iniciais.
    if (prevStatus.current !== gameState.status) {
      prevStatus.current = gameState.status;
      prevCoins.current = snapshot;
      setFlows([]);
      return;
    }

    const before = prevCoins.current;
    prevCoins.current = snapshot;

    // Primeiro estado da sessão (entrada ou reconexão) serve só de baseline.
    if (!before) return;

    const gains: Array<[string, number]> = [];
    const losses: Array<[string, number]> = [];

    for (const [id, coins] of snapshot) {
      const was = before.get(id);
      if (was === undefined || was === coins) continue;
      if (coins > was) gains.push([id, coins - was]);
      else losses.push([id, was - coins]);
    }

    if (gains.length === 0 && losses.length === 0) return;

    const fresh: CoinFlow[] = [];
    const push = (fromId: string, toId: string, amount: number) =>
      fresh.push({ id: `flow-${seq.current++}`, fromId, toId, amount });

    if (gains.length === 1 && losses.length === 1 && gains[0][1] === losses[0][1]) {
      // Roubo: as moedas saem da mão de um e caem na do outro.
      push(losses[0][0], gains[0][0], gains[0][1]);
    } else {
      for (const [id, amount] of gains) push(TREASURY, id, amount);
      // Golpe e Assassinato: o pagamento volta pro banco.
      for (const [id, amount] of losses) push(id, TREASURY, amount);
    }

    setFlows(current => [...current, ...fresh]);
  }, [gameState]);

  // Estável: cada moeda usa isso num timeout e não pode ser recriada a
  // cada broadcast, senão o voo reinicia no meio.
  const consume = useCallback((id: string) => {
    setFlows(current => current.filter(flow => flow.id !== id));
  }, []);

  return { flows, consume };
}
