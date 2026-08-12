/* Harness temporário de layout: renderiza a mesa com um estado falso e
   mede a altura, para conferir que nada rola. Não entra no build de
   produção (entrada própria, fora do index.html). */
import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GameState, Player, Character } from './types/game';
import { GameTable } from './components/GameTable';
import './index.css';

const params = new URLSearchParams(window.location.search);
const opponents = Number(params.get('opps') ?? '3');

const ME = 'me';
const CHARS: Character[] = ['captain', 'countess', 'duke', 'assassin', 'ambassador'];

const makePlayer = (i: number): Player => ({
  id: i === 0 ? ME : `bot${i}`,
  name: i === 0 ? 'Guilherme' : `Bot Jogador ${i}`,
  isHost: i === 0,
  isBot: i !== 0,
  coins: 2 + i,
  cards: [
    { id: `${i}a`, character: i === 0 ? CHARS[0] : 'hidden', revealed: false },
    { id: `${i}b`, character: i === 0 ? CHARS[1] : 'hidden', revealed: false }
  ],
  isConnected: true
});

const state: GameState = {
  code: '58DCEQ',
  status: 'playing',
  players: Array.from({ length: opponents + 1 }, (_, i) => makePlayer(i)),
  deck: [],
  currentTurnPlayerId: ME,
  pendingAction: null,
  pendingLoss: null,
  pendingExchange: null,
  logs: Array.from({ length: 14 }, (_, i) => ({
    id: `l${i}`,
    timestamp: Date.now() - i * 1000,
    text: `Bot Jogador 1 pediu Coleta Geral (+2 bananas). Linha ${i}`,
    type: (['action', 'challenge', 'block', 'system', 'elimination'] as const)[i % 5]
  })),
  winner: null,
  maxPlayers: 6,
  minPlayers: 2
};

function Probe() {
  const [txt, setTxt] = useState('…');

  useEffect(() => {
    const measure = () => {
      const doc = document.documentElement;
      const board = document.querySelector('.court-board') as HTMLElement | null;
      const arena = document.querySelector('.court-arena') as HTMLElement | null;
      const hand = document.querySelector('.court-hand') as HTMLElement | null;
      const rivals = document.querySelector('.court-rivals') as HTMLElement | null;
      const over = (el: HTMLElement | null) =>
        el ? `${el.scrollHeight}/${el.clientHeight}${el.scrollHeight > el.clientHeight + 1 ? ' ROLA!' : ''}` : '-';
      setTxt(
        [
          `win ${window.innerWidth}x${window.innerHeight}`,
          `doc ${over(doc)}`,
          `arena ${over(arena)}`,
          `board ${over(board)}`,
          `rivais ${rivals?.clientHeight ?? 0}px`,
          `mao ${hand?.offsetHeight ?? 0}px`
        ].join(' | ')
      );
    };
    const t = window.setTimeout(measure, 900);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        zIndex: 9999,
        background: '#000',
        color: '#0f0',
        font: '11px ui-monospace, monospace',
        padding: '2px 6px'
      }}
    >
      {txt}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <div className="min-h-[100dvh] bg-slate-950 font-sans antialiased text-slate-100">
    <GameTable
      gameState={state}
      playerId={ME}
      dealKey={0}
      onLeaveRoom={() => {}}
      onReturnToLobby={() => {}}
    />
    <Probe />
  </div>
);
