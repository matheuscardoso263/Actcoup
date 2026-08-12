import React, { useEffect, useRef, useState } from 'react';
import { Card, CHARACTER_INFO, Character } from '../types/game';
import { Shield, Skull, EyeOff } from 'lucide-react';
import { sound } from '../audio/sound';

/** Precisa bater com a duração de .card-flip em game-fx.css. */
const FLIP_MS = 640;

interface CardViewProps {
  card: Card;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  selectable = false,
  selected = false,
  onClick,
  size = 'md'
}) => {
  /* Durante a virada o conteúdo fica atrasado: até a metade da animação a
     carta ainda é a antiga (verso, para os oponentes), e a troca acontece
     com ela de perfil — invisível. É isso que faz um elemento só servir de
     verso e frente, sem precisar empilhar duas faces em 3D. */
  const [display, setDisplay] = useState(card);
  const [flipping, setFlipping] = useState(false);
  const wasRevealed = useRef(card.revealed);
  const flippingRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const justRevealed = card.revealed && !wasRevealed.current;
    wasRevealed.current = card.revealed;

    if (justRevealed) {
      flippingRef.current = true;
      setFlipping(true);
      sound.playCardFlip();
      timers.current.push(window.setTimeout(() => setDisplay(card), FLIP_MS * 0.5));
      timers.current.push(
        window.setTimeout(() => {
          flippingRef.current = false;
          setFlipping(false);
        }, FLIP_MS)
      );
      return;
    }

    // Fora da virada o conteúdo acompanha o servidor normalmente.
    if (!flippingRef.current) setDisplay(card);
  }, [card]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const isHidden = display.character === 'hidden';
  const info = !isHidden ? CHARACTER_INFO[display.character as Character] : null;

  const handleClick = () => {
    if (selectable && onClick) {
      sound.playClick();
      onClick();
    }
  };

  /* Altura vem da escala fluida (--card-h-*), largura sai da proporção 2:3.
     Todo o conteúdo interno é dimensionado em cqw, então a carta escala
     inteira em vez de ficar com texto fixo dentro de moldura variável. */
  const sizeClasses = {
    sm: 'h-[var(--card-h-sm)]',
    md: 'h-[var(--card-h-md)]',
    lg: 'h-[var(--card-h-lg)]'
  }[size];

  return (
    <div
      onClick={handleClick}
      className={`@container relative aspect-[2/3] shrink-0 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 transform perspective-1000 ${sizeClasses} ${
        flipping ? 'card-flip' : ''
      } ${selectable ? 'cursor-pointer hover:scale-105 hover:shadow-amber-500/40' : ''} ${
        selected ? 'ring-4 ring-amber-400 scale-105 shadow-amber-500/80' : ''
      } ${
        display.revealed ? 'filter grayscale brightness-75 border-2 border-red-500/80' : 'border border-amber-500/40'
      }`}
    >
      {/* Front Face (Revealed or Self Hidden) */}
      {!isHidden && info ? (
        <div className="w-full h-full relative flex flex-col justify-end p-[3.5cqw] text-white">
          {/* Card Image */}
          <div className="absolute inset-0 z-0 opacity-90 hover:opacity-100 transition-opacity">
            <img
              src={info.image}
              alt={info.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-slate-950/40 to-transparent" />
          </div>

          {/* Revealed Banner */}
          {display.revealed && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/85 backdrop-blur-xs text-red-200 font-extrabold uppercase tracking-widest border-2 border-red-500 rotate-[-12deg] shadow-2xl">
              <Skull className="w-[26cqw] h-[26cqw] mb-[2cqw] text-red-400 animate-pulse" />
              <span className="text-[10cqw] leading-none font-serif">REVELADA</span>
            </div>
          )}

          {/* Footer Info - Stylized Skill Box at Bottom */}
          {!display.revealed && (
            <div className="relative z-10 bg-slate-950/85 backdrop-blur-md px-[3.5cqw] py-[3cqw] rounded-xl border border-amber-500/40 text-slate-100 shadow-2xl">
              <p className="font-sans font-semibold text-slate-100 text-[6.2cqw] leading-[1.3] drop-shadow-sm">
                {info.description}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Hidden Card Back */
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 p-[6cqw] border border-purple-500/40 text-purple-300">
          <div className="w-[30cqw] h-[30cqw] rounded-full border-2 border-amber-400/50 flex items-center justify-center mb-[4cqw] bg-purple-900/60 shadow-inner">
            <EyeOff className="w-[15cqw] h-[15cqw] text-amber-400" />
          </div>
          <span className="font-serif tracking-widest text-[11cqw] leading-none uppercase text-amber-300 font-extrabold">
            COPAS
          </span>
          <span className="text-[6.5cqw] leading-none text-purple-300/80 font-medium mt-[3cqw]">Oculta</span>
        </div>
      )}
    </div>
  );
};
