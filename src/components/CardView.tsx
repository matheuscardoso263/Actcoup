import React, { useEffect, useRef, useState } from 'react';
import { Card, CHARACTER_INFO, Character } from '../types/game';
import { sound } from '../audio/sound';
import { Coins, Skull, Grab, Shuffle, ShieldCheck, Shield } from 'lucide-react';

/** Precisa bater com a duração de .card-flip em game-fx.css. */
const FLIP_MS = 640;

/* O glifo do canto superior esquerdo — o lugar onde Hearthstone põe o
   custo e Snap põe a energia. Aqui não há custo a pagar pela carta: o
   que decide o turno é qual ação ela autoriza, então é isso que o
   medalhão mostra. Quem só defende (Babuíno) leva o escudo. */
const ROLE_GLYPH: Record<Character, React.ComponentType<{ className?: string }>> = {
  duke: Coins,
  assassin: Skull,
  captain: Grab,
  ambassador: Shuffle,
  countess: ShieldCheck
};

/** Inclinação máxima no acompanhamento do ponteiro, em graus. */
const TILT_DEG = 9;

/** Abertura do leque: metade disto para cada lado, com duas cartas. */
const FAN_DEG = 7;

interface CardViewProps {
  card: Card;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  /** Posição na mão. Sem isto a carta fica reta, fora do leque. */
  fanIndex?: number;
  fanCount?: number;
  /** A ação sob o ponteiro alega justamente este personagem. */
  vouched?: boolean;
  /** Só a mão do próprio jogador escuta — é o que acende as ações. */
  onHoverCharacter?: (character: Character | null) => void;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  selectable = false,
  selected = false,
  onClick,
  size = 'md',
  fanIndex,
  fanCount,
  vouched = false,
  onHoverCharacter
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
  const root = useRef<HTMLDivElement>(null);

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

  /* O retrato do oponente é pequeno demais para render um relevo — e são
     até cinco deles em cena. A física fica para as cartas grandes. */
  const tilt = size !== 'sm';

  /* Inclinação e brilho vão direto no style do nó, não pelo estado do
     React: são dezenas de eventos por segundo e nenhum deles muda o que
     a carta é. O CSS lê as mesmas custom properties na transform. */
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = root.current;
    if (!tilt || !el || flippingRef.current) return;
    const box = el.getBoundingClientRect();
    const px = (e.clientX - box.left) / box.width;
    const py = (e.clientY - box.top) / box.height;
    el.style.setProperty('--card-ry', `${(px - 0.5) * 2 * TILT_DEG}deg`);
    el.style.setProperty('--card-rx', `${(0.5 - py) * 2 * TILT_DEG}deg`);
    el.style.setProperty('--foil-x', `${px * 100}%`);
    el.style.setProperty('--foil-y', `${py * 100}%`);
  };

  const rest = () => {
    const el = root.current;
    if (!el) return;
    for (const prop of ['--card-ry', '--card-rx', '--foil-x', '--foil-y']) {
      el.style.removeProperty(prop);
    }
  };

  const handleEnter = () => {
    // Carta virada não respalda alegação nenhuma — não acende ação.
    if (!isHidden && !display.revealed) onHoverCharacter?.(display.character as Character);
  };

  const handleLeave = () => {
    rest();
    onHoverCharacter?.(null);
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
    tilt ? 'has-tilt' : '',
    selectable ? 'is-pick' : '',
    selected ? 'is-on' : '',
    vouched && !display.revealed ? 'is-vouched' : '',
    display.revealed ? 'is-down' : ''
  ]
    .filter(Boolean)
    .join(' ');

  /* Leque: a carta gira em torno da própria base, como na mão de um
     jogador. A do meio fica reta; as das pontas abrem para fora. `--fan-z`
     é custom property, e não zIndex inline, porque o hover precisa poder
     jogar a carta para cima de todas — e uma regra de folha nunca vence
     um style inline. */
  const fan: Record<string, string> = {};
  if (fanIndex !== undefined && fanCount && fanCount > 1) {
    const offset = fanIndex - (fanCount - 1) / 2;
    fan['--fan-rot'] = `${offset * FAN_DEG}deg`;
    fan['--fan-y'] = `${offset * offset * 1.6}%`;
    fan['--fan-z'] = `${10 - Math.round(Math.abs(offset))}`;
  }
  if (info) fan['--accent'] = info.accent;

  const Glyph = info ? ROLE_GLYPH[display.character as Character] : null;

  return (
    <div
      ref={root}
      onClick={handleClick}
      onPointerMove={handleMove}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      style={fan as React.CSSProperties}
      className={`@container court-card ${sizeClasses} ${state}`}
    >
      {!isHidden && info ? (
        <>
          {/* A arte traz o nome gravado no topo, em ouro — repetir isso num
              badge por cima só tapava a pintura. O que ela não traz é a
              habilidade, então essa continua numa faixa no rodapé. */}
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

          {!display.revealed && (
            <>
              {/* Medalhão do papel + selo de defesa. Dois símbolos bastam
                  para ler a carta de relance; a frase inteira fica no pé
                  para quem ainda está aprendendo os cinco. */}
              {Glyph && (
                <span className="court-card-gem">
                  <Glyph />
                </span>
              )}
              {info.action && info.block && (
                <span className="court-card-ward" title={info.block}>
                  <Shield />
                </span>
              )}

              <div className="court-card-skill">
                <p>{info.description}</p>
              </div>
            </>
          )}

          {display.revealed && <span className="court-card-stamp">Exilada</span>}
        </>
      ) : (
        /* Verso: o brasão da casa. */
        <div className="court-card-back">
          <span className="court-card-emblem">
            <i />
          </span>
          <span className="court-card-back-word">Copas</span>
        </div>
      )}

      {/* Verniz: o reflexo que segue o ponteiro e a franja holográfica por
          baixo dele. Só aparece no hover das cartas grandes. */}
      {tilt && <span className="court-card-sheen" aria-hidden="true" />}
    </div>
  );
};
