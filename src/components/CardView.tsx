import React from 'react';
import { Card, CHARACTER_INFO, Character } from '../types/game';
import { Shield, Skull, EyeOff } from 'lucide-react';
import { sound } from '../audio/sound';

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
  const isHidden = card.character === 'hidden';
  const info = !isHidden ? CHARACTER_INFO[card.character as Character] : null;

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
        selectable ? 'cursor-pointer hover:scale-105 hover:shadow-amber-500/40' : ''
      } ${selected ? 'ring-4 ring-amber-400 scale-105 shadow-amber-500/80' : ''} ${
        card.revealed ? 'filter grayscale brightness-75 border-2 border-red-500/80' : 'border border-amber-500/40'
      }`}
    >
      {/* Front Face (Revealed or Self Hidden) */}
      {!isHidden && info ? (
        <div className="w-full h-full relative flex flex-col justify-between p-[4cqw] bg-gradient-to-b from-slate-900 via-slate-800 to-black text-white">
          {/* Card Image */}
          <div className="absolute inset-0 z-0 opacity-85 hover:opacity-100 transition-opacity">
            <img
              src={info.image}
              alt={info.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70" />
          </div>

          {/* Header Badge */}
          <div className="relative z-10 flex justify-between items-center gap-[2cqw] bg-black/75 backdrop-blur-md px-[4cqw] py-[2.5cqw] rounded-lg border border-amber-500/30 shadow-md">
            <span className="font-extrabold tracking-wider text-amber-300 uppercase text-[8.5cqw] leading-none font-serif truncate">
              {info.name}
            </span>
            {card.revealed ? (
              <Skull className="w-[11cqw] h-[11cqw] shrink-0 text-red-500 animate-pulse" />
            ) : (
              <Shield className="w-[11cqw] h-[11cqw] shrink-0 text-cyan-400" />
            )}
          </div>

          {/* Revealed Banner */}
          {card.revealed && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/85 backdrop-blur-xs text-red-200 font-extrabold uppercase tracking-widest border-2 border-red-500 rotate-[-12deg] shadow-2xl">
              <Skull className="w-[26cqw] h-[26cqw] mb-[2cqw] text-red-400 animate-pulse" />
              <span className="text-[10cqw] leading-none font-serif">REVELADA</span>
            </div>
          )}

          {/* Footer Info - Complete Uncut Description */}
          {!card.revealed && (
            <div className="relative z-10 bg-black/85 backdrop-blur-md p-[3.5cqw] rounded-lg border border-amber-500/30 text-slate-100 font-sans shadow-lg">
              <p className="font-medium text-slate-200 text-[7.5cqw] leading-snug">
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
            COUP
          </span>
          <span className="text-[6.5cqw] leading-none text-purple-300/80 font-medium mt-[3cqw]">Oculta</span>
        </div>
      )}
    </div>
  );
};
