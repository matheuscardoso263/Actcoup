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

  const sizeClasses = {
    sm: 'w-24 h-36 sm:w-28 sm:h-40 text-xs',
    md: 'w-44 h-64 sm:w-52 sm:h-76 text-sm',
    lg: 'w-56 h-84 text-base'
  }[size];

  return (
    <div
      onClick={handleClick}
      className={`relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 transform perspective-1000 ${sizeClasses} ${
        selectable ? 'cursor-pointer hover:scale-105 hover:shadow-amber-500/40' : ''
      } ${selected ? 'ring-4 ring-amber-400 scale-105 shadow-amber-500/80' : ''} ${
        card.revealed ? 'filter grayscale brightness-75 border-2 border-red-500/80' : 'border border-amber-500/40'
      }`}
    >
      {/* Front Face (Revealed or Self Hidden) */}
      {!isHidden && info ? (
        <div className="w-full h-full relative flex flex-col justify-between p-2.5 bg-gradient-to-b from-slate-900 via-slate-800 to-black text-white">
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
          <div className="relative z-10 flex justify-between items-center bg-black/75 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-amber-500/30 shadow-md">
            <span className="font-extrabold tracking-wider text-amber-300 uppercase text-xs font-serif">
              {info.name}
            </span>
            {card.revealed ? (
              <Skull className="w-4 h-4 text-red-500 animate-pulse" />
            ) : (
              <Shield className="w-4 h-4 text-cyan-400" />
            )}
          </div>

          {/* Revealed Banner */}
          {card.revealed && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-950/85 backdrop-blur-xs text-red-200 font-extrabold uppercase tracking-widest border-2 border-red-500 rotate-[-12deg] shadow-2xl">
              <Skull className="w-10 h-10 mb-1 text-red-400 animate-pulse" />
              <span className="text-sm font-serif">REVELADA</span>
            </div>
          )}

          {/* Footer Info - Complete Uncut Description */}
          {!card.revealed && (
            <div className="relative z-10 bg-black/85 backdrop-blur-md p-2 rounded-lg border border-amber-500/30 text-xs text-slate-100 leading-snug font-sans shadow-lg">
              <p className="font-medium text-slate-200 text-[11px] sm:text-xs leading-tight">
                {info.description}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Hidden Card Back */
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 p-4 border border-purple-500/40 text-purple-300">
          <div className="w-12 h-12 rounded-full border-2 border-amber-400/50 flex items-center justify-center mb-2 bg-purple-900/60 shadow-inner">
            <EyeOff className="w-6 h-6 text-amber-400" />
          </div>
          <span className="font-serif tracking-widest text-sm uppercase text-amber-300 font-extrabold">
            COUP
          </span>
          <span className="text-[10px] text-purple-300/80 font-medium mt-1">Oculta</span>
        </div>
      )}
    </div>
  );
};
