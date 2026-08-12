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
import { Crown, HelpCircle, History, AlertCircle, LogOut, Eye, Hourglass } from 'lucide-react';

/* As ações do turno. `claim` é o personagem que a ação obriga a alegar —
   é o que abre espaço para desafio, e por isso aparece no botão. Renda e
   Ajuda Externa não alegam nada; o Golpe fica de fora porque não é
   bloqueável nem desafiável e tem botão próprio. */
const TABLE_ACTIONS: Array<{
  id: ActionType;
  name: string;
  cost: string;
  claim?: Character;
  minCoins?: number;
}> = [
  { id: 'income', name: 'Renda', cost: '+1 moeda' },
  { id: 'foreign_aid', name: 'Ajuda externa', cost: '+2 moedas' },
  { id: 'tax', name: 'Taxa', cost: '+3 moedas', claim: 'duke' },
  { id: 'assassinate', name: 'Assassinar', cost: 'custa 3 moedas', claim: 'assassin', minCoins: 3 },
  { id: 'steal', name: 'Roubar', cost: 'até 2 moedas', claim: 'captain' },
  { id: 'exchange', name: 'Trocar', cost: 'compra 2 do deck', claim: 'ambassador' }
];

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
    <div className="court-table w-full text-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="court-bar">
        <div className="flex items-center gap-3">
          <img src="/logosemfundo.png" alt="ActCoup" className="h-7 2xl:h-9 opacity-85" />
          <span className="court-bar-code">{gameState.code}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playClick();
              setShowCheatSheet(true);
            }}
            className="court-btn is-stone is-compact"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            As 5 cartas
          </button>
          <button onClick={onLeaveRoom} className="court-btn is-crimson is-compact">
            <LogOut className="w-3.5 h-3.5" />
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

              /* Um estado, um tom: carmim quando você saiu, ouro quando a
                 decisão é sua, pedra no resto. Antes eram quatro cores e
                 dois `animate-pulse` disputando atenção ao mesmo tempo. */
              return (
                <div
                  className={`court-status ${
                    isEliminated ? 'is-out' : !waitingFor && isMyTurn ? 'is-mine' : ''
                  }`}
                >
                  <span className="court-status-say">
                    {isEliminated ? (
                      <>
                        <Eye className="w-4 h-4 shrink-0" />
                        Eliminado — você assiste ao resto
                      </>
                    ) : waitingFor ? (
                      <>
                        <Hourglass className="w-4 h-4 shrink-0 opacity-70" />
                        A mesa responde · falta {waitingFor}
                      </>
                    ) : isMyTurn ? (
                      <>
                        <Crown className="w-4 h-4 shrink-0" />
                        Sua vez
                      </>
                    ) : (
                      <>
                        <Hourglass className="w-4 h-4 shrink-0 opacity-70" />
                        Vez de {activePlayer?.name}
                      </>
                    )}
                  </span>
                </div>
              );
            })()}
          </div>

          {error && (
            <div className="court-alert max-w-md flex-shrink-0">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-300" />
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
                  className={`court-seat-panel ${isTurn ? 'turn-aura is-turn' : ''} ${
                    playerEliminated ? 'is-out' : ''
                  }`}
                >
                  <span className="court-seat-name">
                    {player.isHost && <Crown className="w-3 h-3 shrink-0 text-amber-400" />}
                    <span className="truncate">{player.name}</span>
                  </span>

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

                  <CoinCounter playerId={player.id} value={player.coins} className="court-purse mt-1" />
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
            <img src="/logosemfundo.png" alt="ActCoup" className="h-[clamp(1.5rem,4.5vh,3.5rem)] opacity-70" />
            <span className="court-label is-tight">Tesouraria</span>
          </div>

          {/* Player Hand & Controls Bottom */}
          {me && (
            <div
              className={`court-panel is-open w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl p-3 xl:p-5 flex flex-col lg:flex-row justify-between items-center gap-4 xl:gap-6 flex-shrink-0 ${
                isMyTurn ? 'turn-aura' : ''
              }`}
            >
              <div className="flex items-center gap-3 xl:gap-5 min-w-0">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <span className="court-label is-tight">Sua mão</span>
                  <CoinCounter
                    playerId={me.id}
                    value={me.coins}
                    suffix=" moedas"
                    iconClassName="w-3.5 h-3.5"
                    className="court-purse is-big"
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
                <span className="court-label is-tight mb-2 text-center md:text-left">
                  {isEliminated ? 'Você está eliminado' : 'Ações'}
                </span>

                {/* As seis ações não são seis cores: são dois grupos. Quem
                    alega um personagem pode ser desafiado, e é essa a única
                    informação que muda a decisão — então a alegação vai
                    escrita no botão. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TABLE_ACTIONS.map(act => (
                    <button
                      key={act.id}
                      onClick={() => handleActionClick(act.id)}
                      disabled={
                        !isMyTurn ||
                        isEliminated ||
                        me.coins >= 10 ||
                        (act.minCoins !== undefined && me.coins < act.minCoins)
                      }
                      className={`court-act ${act.claim ? 'is-claim' : ''}`}
                    >
                      <span className="court-act-name">{act.name}</span>
                      <span className="court-act-cost">{act.cost}</span>
                      {act.claim && (
                        <span className="court-act-claim">
                          alega {CHARACTER_INFO[act.claim].name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleActionClick('coup')}
                  disabled={!isMyTurn || isEliminated || me.coins < 7}
                  className={`court-act is-coup w-full mt-2 ${
                    !isEliminated && me.coins >= 10 ? 'is-forced' : ''
                  }`}
                >
                  <span className="court-act-name">Golpe de Estado</span>
                  <span className="court-act-cost">
                    {!isEliminated && me.coins >= 10
                      ? 'custa 7 · obrigatório com 10 moedas'
                      : 'custa 7 · ninguém bloqueia nem desafia'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Capped Height Action History Chat Feed */}
        <div className="court-panel w-full lg:w-72 xl:w-80 2xl:w-96 h-40 lg:h-auto lg:self-stretch min-h-0 shrink-0">
          <div className="court-panel-head">
            <History className="w-3.5 h-3.5" />
            <span className="court-label is-tight">O que aconteceu</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 p-2.5 text-xs xl:text-sm">
            <div ref={logTopRef} />
            {gameState.logs.map(log => (
              <div key={log.id} className={`court-log is-${log.type}`}>
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
        <div className="court-scrim">
          <div className="court-modal is-gold is-wide">
            <div className="court-modal-scroll text-left">
              <span className="court-crest">
                <span>As cinco cartas</span>
              </span>

              <div className="space-y-2.5 mt-4">
                {(Object.keys(CHARACTER_INFO) as Character[]).map(charKey => {
                  const info = CHARACTER_INFO[charKey];
                  return (
                    <div
                      key={charKey}
                      className="flex gap-3.5 p-2.5 rounded-[3px] bg-[rgba(6,8,13,0.5)] border border-[rgba(201,180,140,0.14)]"
                    >
                      <img
                        src={info.image}
                        alt={info.name}
                        className="w-14 h-20 object-cover rounded-[3px] border border-[rgba(224,169,46,0.3)] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="court-act-name">{info.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug">{info.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {info.action && <span className="court-tag is-act">{info.action}</span>}
                          {info.block && <span className="court-tag is-def">{info.block}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="court-modal-acts">
                <button
                  onClick={() => {
                    sound.playClick();
                    setShowCheatSheet(false);
                  }}
                  className="court-btn is-stone"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
