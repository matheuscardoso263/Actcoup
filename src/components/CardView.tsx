import React, { useEffect, useRef, useState } from 'react';
import { Card, CHARACTER_INFO, Character } from '../types/game';
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
  const [artFailed, setArtFailed] = useState(false);
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
     O conteúdo interno é dimensionado em cqw, então a carta escala inteira
     em vez de ficar com texto fixo dentro de moldura variável. */
  const sizeClasses = {
    sm: 'h-[var(--card-h-sm)]',
    md: 'h-[var(--card-h-md)]',
    lg: 'h-[var(--card-h-lg)]'
  }[size];

  const state = [
    flipping ? 'card-flip' : '',
    selectable ? 'is-pick' : '',
    selected ? 'is-on' : '',
    display.revealed ? 'is-down' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div onClick={handleClick} className={`@container court-card ${sizeClasses} ${state}`}>
      {!isHidden && info ? (
        <>
          {/* A arte já é a carta inteira — nome na tarja, as duas habilidades
              e o texto de ambientação. Repetir isso em caixas por cima só
              tapava a pintura. */}
          {artFailed ? (
            <div className="court-card-back">
              <span className="court-card-emblem">
                <i />
              </span>
              <span className="court-card-back-word is-name">{info.name}</span>
            </div>
          ) : (
            <img
              src={info.image}
              alt={info.name}
              className="court-card-art"
              onError={() => setArtFailed(true)}
            />
          )}

          {display.revealed && <span className="court-card-stamp">Deposta</span>}
        </>
      ) : (
        /* Verso: o brasão da casa. */
        <div className="court-card-back">
          <span className="court-card-emblem">
            <i />
          </span>
          <span className="court-card-back-word">Coup</span>
        </div>
      )}
    </div>
  );
};
