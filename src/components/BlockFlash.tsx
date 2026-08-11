import React, { useEffect, useRef } from 'react';
import { CHARACTER_INFO } from '../types/game';
import { BlockFlashEvent } from '../hooks/useTableEvents';
import { sound } from '../audio/sound';
import { Shield } from 'lucide-react';

/** Tem que acompanhar a soma das animações em .block-flash (game-fx.css). */
const HOLD = 2100;

interface BlockFlashProps {
  event: BlockFlashEvent;
  onDone: (id: string) => void;
}

/**
 * Anúncio de bloqueio.
 *
 * Diferente das cutscenes, esta cena não interrompe ninguém: o bloqueio ainda
 * pode ser desafiado, e o modal com esse botão sobe no mesmo broadcast. Por
 * isso a faixa fica no terço superior, com pointer-events desligado — ela passa
 * por cima sem roubar o clique nem esconder os botões, que ficam no centro.
 */
const Flash: React.FC<BlockFlashProps> = ({ event, onDone }) => {
  const info = CHARACTER_INFO[event.character];

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) sound.playBlock();

    const timer = window.setTimeout(() => onDoneRef.current(event.id), reduced ? 1400 : HOLD);
    return () => clearTimeout(timer);
  }, [event.id]);

  return (
    <div className={`block-flash ${event.iAmBlocker ? 'is-mine' : ''}`}>
      <div className="block-flash-band" />
      <div className="block-flash-body">
        <span className="block-flash-crest">
          <Shield />
        </span>
        <span className="block-flash-text">
          <span className="block-flash-name">
            {event.iAmBlocker ? 'Você bloqueia' : `${event.blockerName} bloqueia`}
          </span>
          <span className="block-flash-role">{info.name}</span>
        </span>
      </div>
    </div>
  );
};

interface BlockFlashesProps {
  events: BlockFlashEvent[];
  onDone: (id: string) => void;
}

export const BlockFlashes: React.FC<BlockFlashesProps> = ({ events, onDone }) => {
  if (events.length === 0) return null;

  return (
    <>
      {events.map(event => (
        <Flash key={event.id} event={event} onDone={onDone} />
      ))}
    </>
  );
};
