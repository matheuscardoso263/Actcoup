import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../types/game';
import confetti from 'canvas-confetti';
import { sound } from '../audio/sound';
import { socketService } from '../services/socket';
import { Crown, RefreshCw } from 'lucide-react';

interface GameOverModalProps {
  gameState: GameState;
  playerId: string;
  onReturnToLobby: () => void;
}

/** Instante em que a coroa assenta — casa com vicCrownDrop em victory.css. */
const CROWN_LANDS = 880;
/** Quando o botão de saída passa a valer. Casa com o delay de vicRise
 *  em .vic-action: habilitar antes deixaria um botão invisível clicável. */
const READY_AT = 2300;

/* Ouro batido, nas mesmas cores da arte das cartas. O confete padrão da
   biblioteca é multicolorido de festa de aniversário e destoa de tudo. */
const GOLD = ['#fffbeb', '#fde68a', '#fbbf24', '#d97706', '#92400e'];

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameState,
  playerId,
  onReturnToLobby
}) => {
  const winner = gameState.winner;
  const isWinner = winner?.id === playerId;
  const [ready, setReady] = useState(false);
  const timers = useRef<number[]>([]);

  // A corte que ficou pelo caminho. Pela condição de vitória, é todo mundo
  // menos o vencedor — não precisa reconstruir a ordem das quedas.
  const fallen = gameState.players.filter(p => p.id !== winner?.id);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      sound.playCoronation();
      setReady(true);
      return;
    }

    // Som e confete no impacto da coroa, não na abertura: disparar tudo no
    // frame zero desperdiça o único momento de clímax que a cena tem.
    timers.current.push(
      window.setTimeout(() => {
        sound.playCoronation();

        // Duas fontes nas laterais em vez de um estouro central: o ouro
        // atravessa a tela na diagonal e cai por cima do nome.
        for (const [x, angle] of [[0, 62], [1, 118]] as Array<[number, number]>) {
          confetti({
            particleCount: 70,
            angle,
            spread: 62,
            startVelocity: 58,
            origin: { x, y: 0.42 },
            colors: GOLD,
            scalar: 1.05,
            ticks: 280
          });
        }
      }, CROWN_LANDS)
    );

    // Segunda leva, mais lenta, caindo do alto: mantém a tela viva enquanto
    // o texto do decreto ainda está subindo.
    timers.current.push(
      window.setTimeout(() => {
        confetti({
          particleCount: 55,
          spread: 130,
          startVelocity: 26,
          decay: 0.93,
          gravity: 0.7,
          origin: { x: 0.5, y: -0.1 },
          colors: GOLD,
          scalar: 0.95,
          ticks: 340
        });
      }, CROWN_LANDS + 620)
    );

    timers.current.push(window.setTimeout(() => setReady(true), READY_AT));

    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  const handleReturnToLobby = async () => {
    sound.playClick();
    await socketService.resetRoom(gameState.code);
    onReturnToLobby();
  };

  return (
    <div className="vic-root" role="dialog" aria-label="Fim de partida">
      <div className="vic-rays" />
      <div className="vic-beam" />

      {/* As mesmas brasas do salão da cena de deposição. */}
      <div className="cine-embers cine-embers-1" />
      <div className="cine-embers cine-embers-2" />
      <div className="cine-embers cine-embers-3" />

      <div className="vic-crown">
        <span className="vic-crown-icon">
          <Crown />
        </span>
      </div>

      <div className="vic-body">
        <span className="vic-eyebrow">
          {isWinner ? 'A liderança é sua' : 'A colônia tem um novo líder'}
        </span>

        <h2 className="vic-name">{winner?.name ?? 'Ninguém'}</h2>

        <div className="vic-rule" />

        <p className="vic-claim">
          {isWinner ? (
            <>
              Você foi o <strong>último primata de pé</strong>. A república é sua.
            </>
          ) : (
            <>
              Último primata de pé depois de <strong>{fallen.length}</strong>{' '}
              {fallen.length === 1 ? 'exílio' : 'exílios'}.
            </>
          )}
        </p>

        {fallen.length > 0 && (
          <div className="vic-fallen">
            <span className="vic-fallen-label">Os exilados</span>
            <div className="vic-fallen-list">
              {fallen.map(player => (
                <span key={player.id} className="vic-fallen-name">
                  {player.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <button className="vic-action" onClick={handleReturnToLobby} disabled={!ready}>
          <RefreshCw className="w-[1.15em] h-[1.15em]" />
          Voltar para a sala
        </button>
      </div>

      <img src="/logo.png" alt="Copas" className="vic-mark" />
    </div>
  );
};
