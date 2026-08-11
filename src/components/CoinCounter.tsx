import React, { useEffect, useRef, useState } from 'react';
import { Coins } from 'lucide-react';

/** Casa com o voo das moedas: elas saem em 0 e chegam em ~620ms. */
const DELAY = 380;
const DURATION = 480;
const DELTA_HOLD = 1500;

/** Mesmo relógio das animações CSS (a timeline do documento), não o
 *  performance.now(): assim o contador e o voo das moedas não podem
 *  divergir, e o harness headless consegue adiantar os dois juntos. */
const clock = () => Number(document.timeline.currentTime ?? performance.now());

interface CoinCounterProps {
  /** Vira data-coin-anchor: é este elemento que as moedas procuram. */
  playerId: string;
  value: number;
  /** Classes do badge (o visual continua no GameTable). */
  className?: string;
  suffix?: string;
  iconClassName?: string;
}

export const CoinCounter: React.FC<CoinCounterProps> = ({
  playerId,
  value,
  className = '',
  suffix = '',
  iconClassName = 'w-3.5 h-3.5 text-amber-400'
}) => {
  const [shown, setShown] = useState(value);
  const [delta, setDelta] = useState(0);
  const [pulse, setPulse] = useState(0);

  // O tween parte de onde o número está agora, não do último valor do
  // servidor: dois ganhos seguidos não podem fazer o contador saltar.
  const shownRef = useRef(value);
  const targetRef = useRef(value);
  const frame = useRef(0);
  const timer = useRef(0);

  useEffect(() => {
    if (value === targetRef.current) return;
    const change = value - targetRef.current;
    targetRef.current = value;

    setDelta(change);
    setPulse(current => current + 1);

    const from = shownRef.current;
    const startAt = clock() + DELAY;

    const step = () => {
      const t = Math.min(1, Math.max(0, (clock() - startAt) / DURATION));
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (value - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    timer.current = window.setTimeout(() => setDelta(0), DELAY + DELTA_HOLD);

    return () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(timer.current);
    };
  }, [value]);

  return (
    <div data-coin-anchor={playerId} className={`coin-badge ${className}`}>
      <Coins className={iconClassName} />
      <span key={pulse} className="coin-count-pop">
        {shown}
        {suffix}
      </span>

      {delta !== 0 && (
        <span
          key={`delta-${pulse}`}
          className={`coin-delta ${delta > 0 ? 'coin-delta-up' : 'coin-delta-down'}`}
        >
          {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
        </span>
      )}
    </div>
  );
};
