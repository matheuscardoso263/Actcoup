import React, { useState, useEffect, useRef } from 'react';
import { GameState, ActionType, CHARACTER_INFO, Character, ACTION_LABELS } from '../types/game';
import { CardView } from './CardView';
import { ActionModal, getWaitingPlayerNames } from './ActionModal';
import { CardGuide } from './CardGuide';
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

/* As ações do turno. `claim` é o primata que a ação obriga a alegar — é o
   que abre espaço para desafio, e por isso aparece no botão. Colheita e
   Coleta Geral não alegam nada; o Exílio fica de fora porque não é
   bloqueável nem desafiável e tem botão próprio.
   Os nomes saem de ACTION_LABELS para a lore ficar num lugar só. */
const TABLE_ACTIONS: Array<{
  id: ActionType;
  name: string;
  cost: string;
  claim?: Character;
  minCoins?: number;
}> = [
  { id: 'income', name: ACTION_LABELS.income, cost: '+1 banana' },
  { id: 'foreign_aid', name: ACTION_LABELS.foreign_aid, cost: '+2 bananas' },
  { id: 'tax', name: ACTION_LABELS.tax, cost: '+3 bananas', claim: 'duke' },
  { id: 'assassinate', name: ACTION_LABELS.assassinate, cost: 'custa 3 bananas', claim: 'assassin', minCoins: 3 },
  { id: 'steal', name: ACTION_LABELS.steal, cost: 'até 2 bananas', claim: 'captain' },
  { id: 'exchange', name: ACTION_LABELS.exchange, cost: 'compra 2 do deck', claim: 'ambassador' }
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
  /* Os dois lados do mesmo vínculo. `handFocus` é a carta sob o ponteiro:
     acende a ação que ela autoriza. `claimFocus` é a ação sob o ponteiro:
     faz brilhar a carta que a respalda, e diz se você a tem.

     Nada disso muda a mecânica — toda ação continua clicável com ou sem a
     carta, que é o Coup inteiro. É informação que o jogador já possui (a
     própria mão), mostrada no instante da decisão em vez de exigir que ele
     cruze os dois lados da tela de cabeça. Por isso vive no hover e não
     fixo: quem assiste por cima do ombro não lê a mão de graça. */
  const [handFocus, setHandFocus] = useState<Character | null>(null);
  const [claimFocus, setClaimFocus] = useState<Character | null>(null);
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

    // Exílio obrigatório com 10+ bananas
    if (me && me.coins >= 10 && action !== 'coup') {
      setError('Você possui 10 ou mais bananas e é OBRIGADO a realizar um Exílio!');
      sound.playError();
      return;
    }

    if (action === 'assassinate') {
      if (me && me.coins < 3) {
        setError('Bananas insuficientes para Caçada (Custa 3 bananas).');
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
        setError('Nenhum jogador disponível possui bananas para serem furtadas.');
        sound.playError();
        return;
      }
      setTargetActionReq('steal');
      return;
    }

    if (action === 'coup') {
      if (me && me.coins < 7) {
        setError('Bananas insuficientes para Exílio (Custa 7 bananas).');
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

  /* Quais alegações a mão sustenta de verdade. Só as cartas de pé contam:
     uma influência já exilada não respalda nada. */
  const myClaims = new Set<Character>(
    (me?.cards ?? [])
      .filter(c => !c.revealed && c.character !== 'hidden')
      .map(c => c.character as Character)
  );

  /* A carta é 2:3, então a largura de cada painel sai da altura dele: a
     linha inteira mede N × (2 cartas + moldura). Duas restrições, e vence
     a mais apertada — numa tela larga e baixa é a altura, numa estreita e
     alta é a largura.

     A parte da largura é medida em `cqw`, contra a própria linha dos
     oponentes (`container-type` em .court-rivals), e não em `vw`. Em `vw`
     a conta incluía a barra lateral e o respiro da mesa: com 4 oponentes
     numa janela de 1152 a linha quebrava em duas e o topo dos retratos
     era cortado. O termo fixo desconta moldura, respiro entre cartas e
     entre painéis, mais uma folga. */
  const seats = Math.max(opponents.length, 1);
  const chromePx = 33 * seats + 14 * (seats - 1) + 24;
  const byRowWidth = `calc((100cqw - ${chromePx}px) * ${(3 / (4 * seats)).toFixed(4)})`;
  /* Um teto a menos que o da própria mão, de propósito: quem decide o turno
     é a carta do jogador, e ela precisa ser a maior da mesa. Antes, com 1 ou
     2 oponentes, o retrato deles empatava em tamanho com o dela. */
  const byScreenHeight = seats <= 2 ? '24dvh' : seats <= 4 ? '20dvh' : '16dvh';
  const cardCeiling = seats <= 2 ? '14rem' : seats <= 4 ? '12rem' : '9.5rem';
  /* Quanto os oponentes podem tomar antes de espremer a mão. Esta linha é
     a que não encolhe (ver .court-rivals) — o que ela pegar sai da carta do
     jogador, que é quem cede. Não precisa mais fechar a conta da tela: se
     errar para menos sobra respiro, se errar para mais a carta encolhe, e
     em nenhum dos dois casos aparece rolagem. Os 300px descontam a faixa de
     ações e o Exílio, que medem em rem e não acompanham o dvh. */
  const byRowHeight = 'calc(62dvh - 300px)';
  const opponentCardHeight =
    `clamp(2.75rem, min(${byScreenHeight}, ${byRowWidth}, ${byRowHeight}), ${cardCeiling})`;

  return (
    <div className="court-table w-full text-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="court-bar">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="República dos Primatas" className="court-bar-logo" />
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
            Os 5 primatas
          </button>
          <button onClick={onLeaveRoom} className="court-btn is-ember is-compact">
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </header>

      {/* Main Container */}
      {/* A mesa inteira cabe na janela e nada aqui rola: as medidas vivem em
          .court-arena / .court-board (court.css §13b), onde a altura que
          sobra vai para a linha dos oponentes. Utilitário de flex-direction
          do Tailwind não serve nestes painéis — .court-panel está fora de
          @layer e venceria o `lg:flex-row` sem avisar. */}
      <div className="court-arena">
        {/* Left/Center Game Board Area */}
        <div className="court-board">
          {/* Status Banner */}
          <div className="court-board-head">
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

            {error && (
              <div className="court-alert">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Opponents — flex-wrap em vez de grid fixo de 5 colunas: com 1, 2 ou 3
              oponentes o grid deixava todo mundo encostado à esquerda. Aqui os
              cards têm largura de conteúdo e ficam sempre centralizados. É esta
              a linha que recebe a altura sobrando da tela. */}
          <div
            className="court-rivals"
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
                    className={`court-seat-hand ${dealing ? 'deal-hand' : ''}`}
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

          {/* Center Table Divider — também é o estoque: é daqui que as
              bananas saem e para cá que os pagamentos voltam. */}
          <div data-coin-anchor={TREASURY} className="court-treasury">
            <img src="/logo.png" alt="República dos Primatas" />
            <span className="court-label is-tight">Estoque de bananas</span>
          </div>

          {/* Player Hand & Controls Bottom */}
          {me && (
            <div className={`court-panel is-open court-hand ${isMyTurn ? 'turn-aura' : ''}`}>
              {/* O palco. As cartas ficam sozinhas no centro e são o maior
                  objeto da tela — é nelas que a decisão do turno mora, e é
                  delas que sai o realce das ações. O saldo fica na coluna da
                  esquerda; a da direita existe só para o centro óptico cair
                  no meio do painel, e não à direita do saldo. */}
              <div className="court-hand-stage">
                <div className="court-hand-purse">
                  <span className="court-label is-tight">Sua mão</span>
                  <CoinCounter
                    playerId={me.id}
                    value={me.coins}
                    suffix=" bananas"
                    iconClassName="w-3.5 h-3.5"
                    className="court-purse is-big"
                  />
                </div>

                <div
                  data-hand-anchor={me.id}
                  style={dealStyle(gameState.players.indexOf(me))}
                  className={`court-hand-cards ${dealing ? 'deal-hand' : ''}`}
                >
                  {me.cards.map((card, i) => (
                    <CardView
                      key={card.id}
                      card={card}
                      size="md"
                      fanIndex={i}
                      fanCount={me.cards.length}
                      vouched={claimFocus !== null && card.character === claimFocus}
                      onHoverCharacter={setHandFocus}
                    />
                  ))}
                </div>

                <div className="court-hand-side" aria-hidden="true" />
              </div>

              {/* A faixa de ações, abaixo das cartas e na largura toda. */}
              <div className="court-hand-acts">
                <span className="court-acts-head">
                  {isEliminated ? 'Você está eliminado' : 'Ações'}
                </span>

                {/* As seis ações não são seis cores: são dois grupos. Quem
                    alega um personagem pode ser desafiado, e é essa a única
                    informação que muda a decisão — então a alegação vai
                    escrita no botão. */}
                <div className="court-acts">
                  {TABLE_ACTIONS.map(act => {
                    const claimed = act.claim ? CHARACTER_INFO[act.claim] : null;
                    /* Acesa: a carta na mão sob o ponteiro é justamente a que
                       esta ação alega. Em foco: o ponteiro está nela, e aí o
                       selo diz se a alegação é verdade ou blefe. */
                    const lit = act.claim !== undefined && handFocus === act.claim;
                    const inFocus = act.claim !== undefined && claimFocus === act.claim;

                    return (
                      <button
                        key={act.id}
                        onClick={() => handleActionClick(act.id)}
                        onPointerEnter={() => setClaimFocus(act.claim ?? null)}
                        onPointerLeave={() => setClaimFocus(null)}
                        onFocus={() => setClaimFocus(act.claim ?? null)}
                        onBlur={() => setClaimFocus(null)}
                        disabled={
                          !isMyTurn ||
                          isEliminated ||
                          me.coins >= 10 ||
                          (act.minCoins !== undefined && me.coins < act.minCoins)
                        }
                        style={
                          claimed
                            ? ({ '--accent': claimed.accent, '--crest': `url(${claimed.image})` } as React.CSSProperties)
                            : undefined
                        }
                        className={`court-act ${act.claim ? 'is-claim' : ''} ${lit ? 'is-lit' : ''}`}
                      >
                        {claimed && <span className="court-act-crest" aria-hidden="true" />}

                        <span className="court-act-name">{act.name}</span>
                        <span className="court-act-cost">{act.cost}</span>
                        {claimed && <span className="court-act-claim">alega {claimed.name}</span>}

                        {inFocus && act.claim && (
                          <span className={`court-act-tell ${myClaims.has(act.claim) ? 'is-truth' : 'is-bluff'}`}>
                            {myClaims.has(act.claim) ? 'na mão' : 'blefe'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handleActionClick('coup')}
                  disabled={!isMyTurn || isEliminated || me.coins < 7}
                  className={`court-act is-coup w-full mt-1.5 ${
                    !isEliminated && me.coins >= 10 ? 'is-forced' : ''
                  }`}
                >
                  <span className="court-act-name">{ACTION_LABELS.coup}</span>
                  <span className="court-act-cost">
                    {!isEliminated && me.coins >= 10
                      ? 'custa 7 · obrigatório com 10 bananas'
                      : 'custa 7 · ninguém bloqueia nem desafia'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Capped Height Action History Chat Feed */}
        <div className="court-panel court-feed">
          <div className="court-panel-head">
            <History className="w-3.5 h-3.5" />
            <span className="court-label is-tight">O que aconteceu</span>
          </div>

          <div className="court-feed-log">
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

      {/* Bananas em voo entre o estoque e os jogadores (z-60). */}
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
      {showCheatSheet && <CardGuide onClose={() => setShowCheatSheet(false)} />}
    </div>
  );
};
