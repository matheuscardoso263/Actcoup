import React, { useEffect, useRef, useState } from 'react';
import { CHARACTER_INFO } from '../types/game';
import { CinematicEvent } from '../hooks/useGameEvents';
import { sound } from '../audio/sound';
import { Skull } from 'lucide-react';

interface CinematicProps {
  event: CinematicEvent;
  onDone: () => void;
}

const DURATION: Record<CinematicEvent['kind'], number> = {
  kill: 2600,
  eject: 5600
};

const FADE_OUT = 420;

export const Cinematic: React.FC<CinematicProps> = ({ event, onDone }) => {
  const [closing, setClosing] = useState(false);
  const timers = useRef<number[]>([]);
  const info = CHARACTER_INFO[event.character];

  // O GameTable re-renderiza a cada broadcast do servidor. Sem esta ref, um
  // onDone recriado entraria nas dependências do efeito e reiniciaria a cena
  // (e o som) no meio da reprodução.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const kind = event.kind;

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hold = reduced ? 1400 : DURATION[kind];

    sound.playSlash();
    timers.current.push(
      kind === 'kill'
        ? window.setTimeout(() => sound.playThud(), 320)
        : window.setTimeout(() => sound.playEject(), 260)
    );

    timers.current.push(window.setTimeout(() => setClosing(true), hold));
    timers.current.push(window.setTimeout(() => onDoneRef.current(), hold + FADE_OUT));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [kind]);

  const skip = () => {
    if (closing) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setClosing(true);
    timers.current.push(window.setTimeout(() => onDoneRef.current(), FADE_OUT));
  };

  const rootClass = [
    'cine-root',
    event.kind === 'kill' ? 'cine-kill' : 'cine-eject',
    event.isMe ? 'is-me' : '',
    closing ? 'is-closing' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} onClick={skip} role="presentation">
      {event.kind === 'kill' ? (
        <>
          <div className="cine-flash" />
          <div className="cine-slash cine-slash-1" />
          <div className="cine-slash cine-slash-2" />

          <div className="cine-card">
            <div className="cine-half cine-half-l">
              <img src={info.image} alt="" />
            </div>
            <div className="cine-half cine-half-r">
              <img src={info.image} alt="" />
            </div>
            <div className="cine-cut" />
          </div>

          <div className="cine-kill-caption">
            <h2
              className={`font-serif font-extrabold uppercase tracking-[0.15em] drop-shadow-[0_0_25px_rgba(239,68,68,0.6)] ${
                event.isMe
                  ? 'text-[clamp(1.5rem,5vw,3rem)] text-red-400'
                  : 'text-[clamp(1.25rem,4vw,2.25rem)] text-slate-100'
              }`}
            >
              {event.isMe ? 'Você foi atingido!' : `${event.victimName} perdeu uma influência`}
            </h2>
            <p className="mt-2 text-[clamp(0.8rem,2vw,1.05rem)] text-red-300/80 font-semibold tracking-wide">
              {info.name} foi revelada — a carta está fora do jogo.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="cine-stars cine-stars-1" />
          <div className="cine-stars cine-stars-2" />
          <div className="cine-stars cine-stars-3" />

          <div className="cine-body-track">
            <div className="cine-body">
              <img src={info.image} alt="" />
            </div>
          </div>

          <div className="cine-eject-caption">
            <h2
              className={`cine-eject-name font-serif font-extrabold uppercase tracking-[0.2em] text-[clamp(1.5rem,6vw,3.75rem)] leading-tight ${
                event.isMe
                  ? 'text-red-400 drop-shadow-[0_0_35px_rgba(239,68,68,0.65)]'
                  : 'text-slate-100 drop-shadow-[0_0_35px_rgba(148,163,184,0.45)]'
              }`}
            >
              {event.isMe ? 'Você foi eliminado' : `${event.victimName} foi eliminado`}
            </h2>

            <p className="cine-eject-role mt-4 flex items-center justify-center gap-2 text-[clamp(0.85rem,2.2vw,1.25rem)] font-semibold tracking-widest uppercase text-amber-300/90">
              <Skull className="w-[1.1em] h-[1.1em]" />
              Última influência: {info.name}
            </p>

            <p className="cine-eject-remain mt-6 text-[clamp(0.75rem,1.8vw,1rem)] tracking-[0.25em] uppercase text-slate-400">
              {event.playersLeft === 1
                ? 'Resta 1 jogador na mesa'
                : `Restam ${event.playersLeft} jogadores na mesa`}
            </p>
          </div>
        </>
      )}

      <span className="cine-skip">clique para pular</span>
    </div>
  );
};
