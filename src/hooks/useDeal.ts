import { useEffect, useRef, useState } from 'react';
import { GameState } from '../types/game';

/** Tempo de voo de uma carta do baralho até a mão. */
export const DEAL_FLIGHT = 520;
/** Intervalo entre uma carta e a seguinte. */
export const DEAL_STAGGER = 90;
/** Folga depois da última carta pousar, antes de tirar a camada da tela. */
const DEAL_TAIL = 420;

/** Duas rodadas de distribuição: uma carta para cada, depois a segunda. */
export const dealDuration = (playerCount: number) =>
  DEAL_FLIGHT + DEAL_STAGGER * Math.max(0, playerCount * 2 - 1);

/**
 * Sinaliza o começo de uma partida.
 *
 * Fica no App, e não no GameTable, porque o GameTable só é montado quando o
 * jogo já está em andamento — de dentro dele é impossível distinguir "a
 * partida acabou de começar" de "acabei de reconectar numa partida em curso".
 * Aqui em cima a transição lobby -> playing é visível.
 *
 * Retorna um contador: 0 = nunca distribuiu; qualquer outro valor identifica
 * uma distribuição e serve de key pra remontar a animação.
 */
export function useDealTrigger(gameState: GameState | null): number {
  const [dealKey, setDealKey] = useState(0);
  const prevStatus = useRef<GameState['status'] | null>(null);

  useEffect(() => {
    const status = gameState?.status ?? null;
    const previous = prevStatus.current;
    prevStatus.current = status;

    // Primeiro estado da sessão: quem caiu de paraquedas numa partida em
    // andamento (refresh, reconexão) não vê cartas sendo distribuídas.
    if (previous === null) return;
    if (previous !== 'playing' && status === 'playing') {
      setDealKey(current => current + 1);
    }
  }, [gameState?.status]);

  return dealKey;
}

/**
 * Segura a mesa em "modo distribuição" enquanto as cartas voam, para que as
 * cartas de verdade só apareçam quando a que está voando pousa.
 */
export function useDealing(dealKey: number, playerCount: number): boolean {
  // Inicializa já ligado: o GameTable monta no mesmo instante em que a
  // partida começa, e ligar isso só no efeito deixaria as cartas piscarem
  // visíveis por um frame antes de sumirem para a animação.
  const [dealing, setDealing] = useState(
    () => dealKey > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (dealKey <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setDealing(true);
    const timer = window.setTimeout(
      () => setDealing(false),
      dealDuration(playerCount) + DEAL_TAIL
    );
    return () => clearTimeout(timer);
    // playerCount fora das dependências de propósito: um jogador caindo no
    // meio da distribuição não pode reiniciar a animação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey]);

  return dealing;
}

/** Atraso, em ms, até a carta `round` (0 ou 1) do jogador `index` pousar. */
export const dealArrival = (index: number, round: number, playerCount: number) =>
  DEAL_FLIGHT + DEAL_STAGGER * (round * playerCount + index);
