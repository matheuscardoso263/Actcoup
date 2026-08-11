import React, { useState, useEffect, useRef } from 'react';
import { GameState, ActionType, CHARACTER_INFO, Character } from '../types/game';
import { CardView } from './CardView';
import { ActionModal, getWaitingPlayerNames } from './ActionModal';
import { GameOverModal } from './GameOverModal';
import { Cinematic } from './Cinematic';
import { ChallengeSceneView } from './ChallengeScene';
import { BlockFlashes } from './BlockFlash';
import { CoinFlights } from './CoinFlights';
import { DealFlights } from './DealFlights';
import { CoinCounter } from './CoinCounter';
import { useGameEvents } from '../hooks/useGameEvents';
import { useTableEvents } from '../hooks/useTableEvents';
import { useCoinFlow, TREASURY } from '../hooks/useCoinFlow';
import { useDealing, dealArrival, DEAL_STAGGER } from '../hooks/useDeal';
import { useTurnAnnounce } from '../hooks/useTurnAnnounce';
import { socketService } from '../services/socket';
import { sound } from '../audio/sound';
import { Shield, Crown, HelpCircle, History, Sparkles, AlertCircle, LogOut, Eye } from 'lucide-react';

interface GameTableProps {
  gameState: GameState;
  playerId: string;
  /** Muda quando uma partida começa — dispara a distribuição das cartas. */
  dealKey: number;
  onLeaveRoom: () => void;
  onReturnToLobby: () => void;
}

export const GameTable: React.FC<GameTableProps> = ({ gameState, playerId, dealKey, onLeaveRoom, onReturnToLobby }) => {
  const [targetActionReq, setTargetActionReq] = useState<'assassinate' | 'steal' | 'coup' | null>(null);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logTopRef = useRef<HTMLDivElement>(null);
  const { current: cinematic, dismiss: dismissCinematic } = useGameEvents(gameState, playerId);
  const {
    challenge,
    dismissChallenge,
    blocks,
    dismissBlock
  } = useTableEvents(gameState, playerId);
  const { flows: coinFlows, consume: consumeCoinFlow } = useCoinFlow(gameState);
  const turnAnnounce = useTurnAnnounce(gameState, playerId);
  const dealing = useDealing(dealKey, gameState.players.length);

  /* Enquanto as cartas voam, a mão de cada jogador espera a sua chegar. Os
     dois atrasos vão como custom property porque quem anima é o CSS, mas o
     relógio é o mesmo do voo — daí virem do useDeal, e não de números soltos. */
  const dealStyle = (playerIndex: number): React.CSSProperties | undefined =>
    dealing
      ? ({
          '--deal-delay': `${dealArrival(playerIndex, 0, gameState.players.length)}ms`,
          '--deal-round': `${DEAL_STAGGER * gameState.players.length}ms`
        } as React.CSSProperties)
      : undefined;

  const me = gameState.players.find(p => p.id === playerId);
  const isEliminated = !me || me.cards.every(c => c.revealed);
  const isMyTurn = !isEliminated && gameState.currentTurnPlayerId === playerId;
  const activePlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);

  // O servidor faz unshift nos logs, então o lance mais recente é o primeiro
  // da lista e aparece no topo do painel — é para lá que a rolagem vai.
  useEffect(() => {
    logTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [gameState.logs]);

  const handleActionClick = async (action: ActionType) => {
    if (!isMyTurn || isEliminated) return;
    setError(null);

    // Mandatory coup rule (10+ coins)
    if (me && me.coins >= 10 && action !== 'coup') {
      setError('Você possui 10 ou mais moedas e é OBRIGADO a realizar um Golpe!');
      sound.playError();
      return;
    }

    if (action === 'assassinate') {
      if (me && me.coins < 3) {
        setError('Moedas insuficientes para Assassinato (Custa 3 moedas).');
        sound.playError();
        return;
      }
      setTargetActionReq('assassinate');
      return;
    }

    if (action === 'steal') {
      const validTargets = gameState.players.filter(
        p => p.id !== playerId && p.cards.some(c => !c.revealed) && p.coins > 0
      );
      if (validTargets.length === 0) {
        setError('Nenhum jogador disponível possui moedas para serem roubadas.');
        sound.playError();
        return;
      }
      setTargetActionReq('steal');
      return;
    }

    if (action === 'coup') {
      if (me && me.coins < 7) {
        setError('Moedas insuficientes para Golpe (Custa 7 moedas).');
        sound.playError();
        return;
      }
      setTargetActionReq('coup');
      return;
    }

    sound.playClick();
    const res = await socketService.playAction(gameState.code, action);
    if (!res.success) {
      setError(res.message || 'Erro ao executar ação.');
      sound.playError();
    }
  };

  const opponents = gameState.players.filter(p => p.id !== playerId);

  /* Quanto menos oponentes, maior a carta: com 1 ou 2 sobra tela de sobra,
     com 5 tudo precisa caber numa linha só sem estourar a altura. */
  const opponentCardHeight =
    opponents.length <= 2
      ? 'clamp(7rem, 22vh, 17rem)'
      : opponents.length <= 4
      ? 'clamp(6.5rem, 17vh, 13rem)'
      : 'clamp(6rem, 13vh, 10rem)';

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-white flex flex-col relative overflow-hidden select-none">
      {/* Background ambient elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-purple-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-20 flex-shrink-0 flex justify-between items-center px-6 2xl:px-10 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center gap-4">
          <img src="/logosemfundo.png" alt="Coup Logo" className="h-8 2xl:h-10 drop-shadow-md" />
          <span className="text-xs 2xl:text-sm px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono">
            Sala: {gameState.code}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              setShowCheatSheet(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <HelpCircle className="w-4 h-4" />
            Guia de Personagens
          </button>
          <button
            onClick={onLeaveRoom}
            className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      {/* Main Container */}
      {/* min-h-0 é obrigatório: sem ele o filho com overflow-y-auto não encolhe
          e o conteúdo vaza para fora da tela em vez de rolar internamente.
          A altura vem só do flex-1 — nada de calc(100vh - header) chutado. */}
      <div className="relative z-10 flex-1 min-h-0 w-full max-w-[120rem] mx-auto flex flex-col lg:flex-row p-3 xl:p-5 gap-3 xl:gap-5 overflow-hidden">
        {/* Left/Center Game Board Area */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col justify-between items-center gap-2 overflow-y-auto pr-1">
          
          {/* Status Banner */}
          <div className="w-full max-w-xl xl:max-w-2xl mx-auto text-center flex-shrink-0">
            {(() => {
              const waitingFor = (gameState.pendingAction || gameState.pendingLoss || gameState.pendingExchange)
                ? getWaitingPlayerNames(gameState)
                : null;

              return (
                <div className={`py-2.5 px-4 rounded-xl border backdrop-blur-md transition-all shadow-lg ${
                  isEliminated
                    ? 'bg-red-950/60 border-red-500/60 text-red-300'
                    : waitingFor
                    ? 'bg-purple-950/60 border-purple-500/60 text-purple-300 animate-pulse'
                    : isMyTurn
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                    : 'bg-slate-900/90 border-slate-700 text-slate-300'
                }`}>
                  <span className="text-[11px] 2xl:text-xs uppercase tracking-widest block opacity-75 font-semibold">
                    Status da Partida
                  </span>
                  <span className="text-sm xl:text-base font-bold flex items-center justify-center gap-2">
                    {isEliminated ? (
                      <>
                        <Eye className="w-4 h-4 text-red-400" />
                        Você foi ELIMINADO! (Modo Espectador)
                      </>
                    ) : waitingFor ? (
                      `⏳ Aguardando a ação de: ${waitingFor}`
                    ) : isMyTurn ? (
                      '👉 Sua vez! Escolha uma ação.'
                    ) : (
                      `Vez de ${activePlayer?.name}...`
                    )}
                  </span>
                </div>
              );
            })()}
          </div>

          {error && (
            <div className="mb-2 p-2.5 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-xs flex items-center gap-2 max-w-md shadow-lg animate-bounce flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Opponents — flex-wrap em vez de grid fixo de 5 colunas: com 1, 2 ou 3
              oponentes o grid deixava todo mundo encostado à esquerda. Aqui os
              cards têm largura de conteúdo e ficam sempre centralizados. */}
          <div
            className="w-full flex flex-wrap justify-center items-stretch gap-3 xl:gap-5 flex-shrink-0"
            style={{ '--card-h-sm': opponentCardHeight } as React.CSSProperties}
          >
            {opponents.map(player => {
              const isTurn = player.id === gameState.currentTurnPlayerId;
              const playerEliminated = player.cards.every(c => c.revealed);

              return (
                <div
                  key={player.id}
                  className={`relative p-3 xl:p-4 rounded-2xl border backdrop-blur-md transition-all flex flex-col items-center justify-between shadow-xl ${
                    isTurn
                      ? 'turn-aura bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-amber-500/20 scale-105'
                      : playerEliminated
                      ? 'bg-red-950/20 border-red-900/40 opacity-60'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-2 w-full justify-center">
                    {player.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    <span className={`text-xs xl:text-sm font-bold truncate max-w-[12ch] ${playerEliminated ? 'line-through text-red-400' : 'text-slate-200'}`}>
                      {player.name}
                    </span>
                  </div>

                  {/* Destino das cartas na distribuição inicial. */}
                  <div
                    data-hand-anchor={player.id}
                    style={dealStyle(gameState.players.indexOf(player))}
                    className={`flex justify-center gap-2 xl:gap-3 my-2 ${dealing ? 'deal-hand' : ''}`}
                  >
                    {player.cards.map(card => (
                      <CardView key={card.id} card={card} size="sm" />
                    ))}
                  </div>

                  <CoinCounter
                    playerId={player.id}
                    value={player.coins}
                    className="mt-2 flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs xl:text-sm font-bold shadow-inner"
                  />
                </div>
              );
            })}
          </div>

          {/* Center Table Divider — também é a tesouraria: é daqui que as
              moedas saem e para cá que os pagamentos voltam. */}
          <div
            data-coin-anchor={TREASURY}
            className="py-1 text-center text-slate-600 flex flex-col items-center gap-1 pointer-events-none flex-shrink-0 opacity-70"
          >
            <img src="/logosemfundo.png" alt="Coup Logo" className="h-[clamp(1.75rem,5vh,4rem)] opacity-80 filter brightness-110 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]" />
            <span className="font-serif tracking-widest text-[10px] uppercase text-amber-500/60 font-bold">Mesa de Jogo</span>
          </div>

          {/* Player Hand & Controls Bottom */}
          {me && (
            <div
              className={`w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl bg-slate-900/90 backdrop-blur-xl border rounded-3xl p-3 xl:p-5 shadow-2xl flex flex-col lg:flex-row justify-between items-center gap-4 xl:gap-6 flex-shrink-0 transition-colors ${
                isMyTurn ? 'turn-aura border-amber-500/60' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 xl:gap-5 min-w-0">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <span className="text-xs xl:text-sm uppercase tracking-widest font-extrabold text-amber-400 font-serif">Sua Mão</span>
                  <CoinCounter
                    playerId={me.id}
                    value={me.coins}
                    suffix=" Moedas"
                    iconClassName="w-4 h-4 text-amber-400"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm xl:text-base font-extrabold shadow-inner"
                  />
                </div>

                <div
                  data-hand-anchor={me.id}
                  style={dealStyle(gameState.players.indexOf(me))}
                  className={`flex gap-2 xl:gap-4 ${dealing ? 'deal-hand' : ''}`}
                >
                  {me.cards.map(card => (
                    <CardView key={card.id} card={card} size="md" />
                  ))}
                </div>
              </div>

              {/* Action Buttons Panel */}
              <div className="flex-1 min-w-0 w-full max-w-md xl:max-w-lg 2xl:max-w-xl">
                <span className="text-xs xl:text-sm uppercase tracking-widest font-bold text-slate-400 mb-2 block text-center md:text-left">
                  {isEliminated ? 'Você está Eliminado' : 'Ações Disponíveis'}
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleActionClick('income')}
                    disabled={!isMyTurn || isEliminated || me.coins >= 10}
                    className="p-2 xl:p-2.5 rounded-xl border bg-slate-800/80 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-white text-xs xl:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-0.5"
                  >
                    <span className="font-bold text-emerald-400">Renda</span>
                    <span className="text-[10px] xl:text-xs text-slate-400">+1 Moeda (Livre)</span>
                  </button>

                  <button
                    onClick={() => handleActionClick('foreign_aid')}
                    disabled={!isMyTurn || isEliminated || me.coins >= 10}
                    className="p-2 xl:p-2.5 rounded-xl border bg-slate-800/80 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-white text-xs xl:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-0.5"
                  >
                    <span className="font-bold text-blue-400">Ajuda Externa</span>
                    <span className="text-[10px] xl:text-xs text-slate-400">+2 Moedas</span>
                  </button>

                  <button
                    onClick={() => handleActionClick('tax')}
                    disabled={!isMyTurn || isEliminated || me.coins >= 10}
                    className="p-2 xl:p-2.5 rounded-xl border bg-slate-800/80 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-white text-xs xl:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-0.5"
                  >
                    <span className="font-bold text-amber-400">Taxa (Duque)</span>
                    <span className="text-[10px] xl:text-xs text-slate-400">+3 Moedas</span>
                  </button>

                  <button
                    onClick={() => handleActionClick('assassinate')}
                    disabled={!isMyTurn || isEliminated || me.coins < 3 || me.coins >= 10}
                    className="p-2 xl:p-2.5 rounded-xl border bg-slate-800/80 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-white text-xs xl:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-0.5"
                  >
                    <span className="font-bold text-red-400">Assassinar</span>
                    <span className="text-[10px] xl:text-xs text-slate-400">Custa 3 Moedas</span>
                  </button>

                  <button
                    onClick={() => handleActionClick('steal')}
                    disabled={!isMyTurn || isEliminated || me.coins >= 10}
                    className="p-2 xl:p-2.5 rounded-xl border bg-slate-800/80 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-white text-xs xl:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-0.5"
                  >
                    <span className="font-bold text-purple-400">Roubar</span>
                    <span className="text-[10px] xl:text-xs text-slate-400">Até 2 Moedas</span>
                  </button>

                  <button
                    onClick={() => handleActionClick('exchange')}
                    disabled={!isMyTurn || isEliminated || me.coins >= 10}
                    className="p-2 xl:p-2.5 rounded-xl border bg-slate-800/80 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-white text-xs xl:text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-0.5"
                  >
                    <span className="font-bold text-cyan-400">Trocar</span>
                    <span className="text-[10px] xl:text-xs text-slate-400">Comprar 2 do deck</span>
                  </button>
                </div>

                <button
                  onClick={() => handleActionClick('coup')}
                  disabled={!isMyTurn || isEliminated || me.coins < 7}
                  className={`w-full mt-2 py-2 xl:py-2.5 px-4 rounded-xl font-extrabold uppercase tracking-wider text-xs xl:text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                    !isEliminated && me.coins >= 10
                      ? 'bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white animate-bounce ring-4 ring-red-500/50'
                      : 'bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500 text-white disabled:opacity-40'
                  }`}
                >
                  ⚔️ GOLPE DE ESTADO (Custa 7 Moedas) {!isEliminated && me.coins >= 10 && ' - OBRIGATÓRIO!'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Capped Height Action History Chat Feed */}
        <div className="w-full lg:w-72 xl:w-80 2xl:w-96 h-40 lg:h-auto lg:self-stretch min-h-0 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 xl:p-4 flex flex-col shrink-0 shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-800 text-slate-300 font-bold text-sm xl:text-base shrink-0">
            <History className="w-4 h-4 text-amber-400" />
            <span>Histórico da Partida</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 text-xs xl:text-sm">
            <div ref={logTopRef} />
            {gameState.logs.map(log => (
              <div
                key={log.id}
                className={`p-2.5 rounded-lg border leading-snug transition-all ${
                  log.type === 'challenge'
                    ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                    : log.type === 'block'
                    ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
                    : log.type === 'elimination'
                    ? 'bg-red-950/40 border-red-500/40 text-red-200 font-bold'
                    : log.type === 'system'
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400 italic'
                    : 'bg-slate-950/80 border-slate-800 text-slate-200'
                }`}
              >
                <span>{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Modals */}
      <ActionModal
        gameState={gameState}
        playerId={playerId}
        targetActionReq={targetActionReq}
        onCloseTargetReq={() => setTargetActionReq(null)}
      />

      {/* Cartas saindo do baralho para as mãos no começo da partida (z-55). */}
      {dealing && (
        <DealFlights key={dealKey} playerIds={gameState.players.map(p => p.id)} />
      )}

      {/* Moedas em voo entre a tesouraria e os jogadores (z-60). */}
      <CoinFlights flows={coinFlows} onDone={consumeCoinFlow} />

      {/* Anúncio de bloqueio (z-80). Não intercepta clique: o modal de desafio
          ao bloqueio sobe no mesmo broadcast e precisa continuar utilizável. */}
      <BlockFlashes events={blocks} onDone={dismissBlock} />

      {/* Anúncio da vez. `key` remonta o elemento a cada troca, que é o que
          faz a animação rodar de novo. */}
      {turnAnnounce && (
        <div key={turnAnnounce.id} className="turn-announce">
          <div className={`turn-announce-pill ${turnAnnounce.isMe ? 'is-me' : ''}`}>
            <Crown className="w-[1.15em] h-[1.15em] shrink-0" />
            {turnAnnounce.isMe ? 'Sua vez' : `Vez de ${turnAnnounce.name}`}
          </div>
        </div>
      )}

      {/* Desfecho de um desafio: blefe desmascarado ou palavra confirmada.
          Vem antes da cutscene de perda no DOM porque também é anterior no
          tempo — a carta só vira depois que o perdedor escolhe qual entregar. */}
      {challenge && (
        <ChallengeSceneView key={challenge.id} event={challenge} onDone={dismissChallenge} />
      )}

      {/* Cutscene de assassinato / eliminação. Fica acima dos modais (z-100). */}
      {cinematic && (
        <Cinematic key={cinematic.id} event={cinematic} onDone={dismissCinematic} />
      )}

      {/* Game Over Modal — só depois da última cutscene, senão o confete e o
          som de vitória atropelam a cena que encerrou a partida. */}
      {gameState.status === 'ended' && !cinematic && !challenge && (
        <GameOverModal
          gameState={gameState}
          playerId={playerId}
          onReturnToLobby={onReturnToLobby}
        />
      )}

      {/* Character Cheat Sheet Dialog */}
      {showCheatSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-xl 2xl:max-w-2xl max-h-[90dvh] flex flex-col bg-slate-900 border border-purple-500/50 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2 shrink-0">
              <Shield className="w-5 h-5" />
              Guia das 5 Cartas do Coup
            </h3>

            <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
              {(Object.keys(CHARACTER_INFO) as Character[]).map(charKey => {
                const info = CHARACTER_INFO[charKey];
                return (
                  <div key={charKey} className="flex gap-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <img src={info.image} alt={info.name} className="w-14 h-20 object-cover rounded-lg border border-amber-500/30" />
                    <div className="flex-1 text-xs">
                      <h4 className="font-extrabold text-amber-400 text-sm uppercase">{info.name}</h4>
                      <p className="text-slate-300 mt-1">{info.description}</p>
                      {info.action && (
                        <span className="inline-block mt-1.5 mr-2 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-semibold">
                          Ação: {info.action}
                        </span>
                      )}
                      {info.block && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-blue-950 border border-blue-500/40 text-blue-300 font-semibold">
                          {info.block}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                sound.playClick();
                setShowCheatSheet(false);
              }}
              className="w-full mt-6 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm shrink-0"
            >
              Fechar Guia
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
