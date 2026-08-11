import React, { useEffect, useRef, useState } from 'react';
import { CHARACTER_INFO } from '../types/game';
import { ChallengeScene as ChallengeSceneEvent } from '../hooks/useTableEvents';
import { sound } from '../audio/sound';
import { Zap, Swords, ShieldOff } from 'lucide-react';

interface ChallengeSceneProps {
  event: ChallengeSceneEvent;
  onDone: () => void;
}

const HOLD = 3300;
const FADE_OUT = 420;

/** Instante do choque das faixas — o baque, o tremor e o clarão saem juntos. */
const CLASH_AT = 370;
/** Instante em que o carimbo bate e o veredito é dito. */
const VERDICT_AT = 1120;

export const ChallengeSceneView: React.FC<ChallengeSceneProps> = ({ event, onDone }) => {
  const [closing, setClosing] = useState(false);
  const timers = useRef<number[]>([]);
  const info = CHARACTER_INFO[event.character];
  const isTruth = event.outcome === 'truth';

  // Mesmo motivo do Cinematic: o GameTable re-renderiza a cada broadcast e um
  // onDone recriado reiniciaria a cena (e o som) no meio da reprodução.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const outcome = event.outcome;

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hold = reduced ? 1600 : HOLD;

    if (!reduced) {
      timers.current.push(window.setTimeout(() => sound.playChallenge(), CLASH_AT));
      timers.current.push(
        window.setTimeout(
          () => (outcome === 'truth' ? sound.playTruth() : sound.playBluff()),
          VERDICT_AT
        )
      );
    }

    timers.current.push(window.setTimeout(() => setClosing(true), hold));
    timers.current.push(window.setTimeout(() => onDoneRef.current(), hold + FADE_OUT));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [outcome]);

  const skip = () => {
    if (closing) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setClosing(true);
    timers.current.push(window.setTimeout(() => onDoneRef.current(), FADE_OUT));
  };

  /* O texto muda de pessoa conforme o seu papel no lance: assistir a um
     desafio alheio e levar um desafio na cara não são a mesma cena. */
  const verdict = (() => {
    if (isTruth) {
      if (event.iAmChallenger) {
        return {
          title: 'Você duvidou — e ele tinha',
          detail: `${event.claimerName} revelou ${info.name}. Você perde uma influência.`
        };
      }
      if (event.iAmClaimer) {
        return {
          title: 'Sua palavra valeu',
          detail: `${info.name} revelada. ${event.challengerName} perde uma influência.`
        };
      }
      return {
        title: `${event.claimerName} tinha mesmo`,
        detail: `${info.name} revelada. ${event.challengerName} perde uma influência.`
      };
    }

    if (event.iAmClaimer) {
      return {
        title: 'Seu blefe foi desmascarado',
        detail: `Você não tinha ${info.name}. Perde uma influência.`
      };
    }
    if (event.iAmChallenger) {
      return {
        title: 'Blefe desmascarado!',
        detail: `${event.claimerName} não tinha ${info.name} e perde uma influência.`
      };
    }
    return {
      title: `${event.claimerName} estava blefando`,
      detail: `Não tinha ${info.name}. Perde uma influência.`
    };
  })();

  const rootClass = [
    'cine-root',
    'cine-duel',
    isTruth ? 'is-truth' : 'is-bluff',
    event.iAmClaimer || event.iAmChallenger ? 'is-mine' : '',
    closing ? 'is-closing' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} onClick={skip} role="presentation">
      <div className="cine-duel-flash" />

      {/* --- O choque: quem duvidou contra quem declarou --- */}
      <div className="cine-duel-head">
        <span className="cine-duel-label">
          {event.scope === 'block' ? (
            <>
              <ShieldOff className="w-[1.1em] h-[1.1em]" />
              Desafio ao bloqueio
            </>
          ) : (
            <>
              <Swords className="w-[1.1em] h-[1.1em]" />
              Desafio
            </>
          )}
        </span>

        <div className="cine-duel-row">
          <div className="cine-duel-side cine-duel-left">
            <span className="cine-duel-role">Desafiante</span>
            <span className="cine-duel-name">
              {event.iAmChallenger ? 'Você' : event.challengerName}
            </span>
          </div>

          {/* O ícone anima dentro de um invólucro parado: o estilhaço e a onda
              de choque são pseudo-elementos do invólucro e não podem herdar a
              escala nem a opacidade do raio. */}
          <span className="cine-duel-bolt">
            <span className="cine-duel-bolt-icon">
              <Zap />
            </span>
          </span>

          <div className="cine-duel-side cine-duel-right">
            <span className="cine-duel-role">Acusado</span>
            <span className="cine-duel-name">
              {event.iAmClaimer ? 'Você' : event.claimerName}
            </span>
          </div>
        </div>

        <p className="cine-duel-claim">
          Alegou ser <strong>{info.name}</strong>
          {event.scope === 'block' ? ' para bloquear a ação' : ''}
        </p>
      </div>

      {/* --- A prova: a carta em questão --- */}
      <div className="cine-duel-card">
        <img src={info.image} alt={info.name} />
        <div className="cine-duel-veil" />
        <div className="cine-duel-cross cine-duel-cross-1" />
        <div className="cine-duel-cross cine-duel-cross-2" />
        <span className="cine-duel-stamp">{isTruth ? 'Verdade' : 'Blefe'}</span>
      </div>

      {/* --- A sentença --- */}
      <div className="cine-duel-verdict">
        <h2 className="cine-duel-title">{verdict.title}</h2>
        <div className="cine-duel-rule" />
        <p className="cine-duel-detail">{verdict.detail}</p>
      </div>

      <span className="cine-skip">clique para pular</span>
    </div>
  );
};
