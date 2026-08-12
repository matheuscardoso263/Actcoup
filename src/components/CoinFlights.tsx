import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CoinFlow } from '../hooks/useCoinFlow';
import { coinAnchor } from '../utils/anchors';
import { sound } from '../audio/sound';

/** Mais que isso vira confusão visual — o número no contador já diz o total. */
const MAX_COINS = 5;
const STAGGER = 85;
const FLIGHT = 620;

interface Geometry {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const Flight: React.FC<{ flow: CoinFlow; onDone: () => void }> = ({ flow, onDone }) => {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const count = Math.min(flow.amount, MAX_COINS);

  // onDone vem do GameTable, que re-renderiza a cada broadcast. Sem a ref o
  // efeito reiniciaria e o voo recomeçaria do zero no meio do caminho.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useLayoutEffect(() => {
    const from = coinAnchor(flow.fromId);
    const to = coinAnchor(flow.toId);

    // Âncora ausente (jogador que saiu, layout ainda montando): descarta o
    // voo em silêncio em vez de deixar moedas presas na tela.
    if (!from || !to) {
      onDoneRef.current();
      return;
    }
    setGeometry({ x0: from.x, y0: from.y, x1: to.x, y1: to.y });
  }, [flow.fromId, flow.toId]);

  useEffect(() => {
    if (!geometry) return;
    sound.playCoin();
    const total = FLIGHT + STAGGER * (count - 1);
    const timer = window.setTimeout(() => onDoneRef.current(), total + 60);
    return () => clearTimeout(timer);
  }, [geometry, count]);

  if (!geometry) return null;

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="coin-fly"
          style={
            {
              '--x0': `${geometry.x0}px`,
              '--y0': `${geometry.y0}px`,
              '--x1': `${geometry.x1}px`,
              '--y1': `${geometry.y1}px`,
              // Espalha o ponto de partida, senão as moedas viajam empilhadas.
              '--jitter': `${(i - (count - 1) / 2) * 9}px`,
              '--delay': `${i * STAGGER}ms`,
              '--flight': `${FLIGHT}ms`
            } as React.CSSProperties
          }
        >
          <span className="coin-fly-arc">
            <span className="banana-fly-item">🍌</span>
          </span>
        </span>
      ))}
    </>
  );
};

interface CoinFlightsProps {
  flows: CoinFlow[];
  onDone: (id: string) => void;
}

export const CoinFlights: React.FC<CoinFlightsProps> = ({ flows, onDone }) => {
  if (flows.length === 0) return null;

  return (
    <div className="coin-layer">
      {flows.map(flow => (
        <Flight key={flow.id} flow={flow} onDone={() => onDone(flow.id)} />
      ))}
    </div>
  );
};
