import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { coinAnchor, handAnchor, Point } from '../utils/anchors';
import { DEAL_FLIGHT, DEAL_STAGGER, dealDuration } from '../hooks/useDeal';
import { TREASURY } from '../hooks/useCoinFlow';
import { sound } from '../audio/sound';

interface Toss {
  key: string;
  from: Point;
  to: Point;
  delay: number;
  /** Leque: cada carta cai com uma inclinação um pouco diferente. */
  tilt: number;
}

interface DealFlightsProps {
  /** Na ordem de `gameState.players` — é a ordem em que a mesa é servida. */
  playerIds: string[];
}

/**
 * Distribuição inicial: duas voltas na mesa, uma carta por jogador em cada.
 *
 * Mesma técnica das moedas em voo (três camadas aninhadas: X, arco em Y e giro
 * por dentro), porque o problema é o mesmo — o trajeto depende do layout real,
 * que só é conhecido em tempo de execução.
 */
export const DealFlights: React.FC<DealFlightsProps> = ({ playerIds }) => {
  const [tosses, setTosses] = useState<Toss[] | null>(null);
  const timers = useRef<number[]>([]);

  useLayoutEffect(() => {
    const deck = coinAnchor(TREASURY);
    if (!deck) return;

    const planned: Toss[] = [];
    for (let round = 0; round < 2; round++) {
      playerIds.forEach((id, index) => {
        const hand = handAnchor(id);
        // Âncora ausente (jogador sem lugar na mesa ainda): pula a carta em
        // vez de mandá-la para o canto superior esquerdo.
        if (!hand) return;
        planned.push({
          key: `${round}-${id}`,
          from: deck,
          // Cartas empilhadas na mão não pousam exatamente no mesmo ponto.
          to: { x: hand.x + (round === 0 ? -14 : 14), y: hand.y },
          delay: DEAL_STAGGER * (round * playerIds.length + index),
          tilt: (round === 0 ? -1 : 1) * (6 + index * 3)
        });
      });
    }

    setTosses(planned);
  }, [playerIds]);

  useEffect(() => {
    if (!tosses || tosses.length === 0) return;

    for (const toss of tosses) {
      timers.current.push(window.setTimeout(() => sound.playDeal(), toss.delay));
    }

    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, [tosses]);

  if (!tosses || tosses.length === 0) return null;

  return (
    <div
      className="deal-layer"
      style={{ '--deal-total': `${dealDuration(playerIds.length)}ms` } as React.CSSProperties}
    >
      {tosses.map(toss => (
        <span
          key={toss.key}
          className="deal-fly"
          style={
            {
              '--x0': `${toss.from.x}px`,
              '--y0': `${toss.from.y}px`,
              '--x1': `${toss.to.x}px`,
              '--y1': `${toss.to.y}px`,
              '--tilt': `${toss.tilt}deg`,
              '--delay': `${toss.delay}ms`,
              '--flight': `${DEAL_FLIGHT}ms`
            } as React.CSSProperties
          }
        >
          <span className="deal-fly-arc">
            <span className="deal-fly-card" />
          </span>
        </span>
      ))}
    </div>
  );
};
