import React, { useState, useEffect } from 'react';
import { GameState, Character, CHARACTER_INFO, ACTION_LABELS } from '../types/game';
import { CardView } from './CardView';
import { socketService } from '../services/socket';
import { sound } from '../audio/sound';
import { ShieldAlert, Sword, Shield, Shuffle, Skull, CheckCircle2, Loader2, Crosshair } from 'lucide-react';

interface ActionModalProps {
  gameState: GameState;
  playerId: string;
  targetActionReq: 'assassinate' | 'steal' | 'coup' | null;
  onCloseTargetReq: () => void;
}

/* Os três tons da corte. Antes cada janela escolhia uma cor do
   Tailwind — âmbar, vermelho, ciano, azul, roxo, rosa —, o que dava
   sete matizes para três significados. Aqui: ouro é a sua vez de
   decidir, carmim é o que custa influência, ardósia é defesa. */
type Tone = 'gold' | 'ember' | 'moss';

/* ============================================================
   Duas formas cobrem as oito janelas: uma decide, a outra espera.
   ============================================================ */

const Decree: React.FC<{
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ tone, icon, title, wide, children }) => (
  <div className="court-scrim">
    <div className={`court-modal is-${tone}${wide ? ' is-wide' : ''}`}>
      <div className="court-modal-scroll">
        <span className="court-seal">{icon}</span>
        <h3 className="court-modal-title">{title}</h3>
        {children}
      </div>
    </div>
  </div>
);

/* Espera não trava a leitura da mesa: véu fraco e cartela curta,
   porque a informação útil aqui é só quem ainda não respondeu. */
const Waiting: React.FC<{ tone: Tone; label: string; who: string }> = ({ tone, label, who }) => (
  <div className="court-scrim is-soft">
    <div className={`court-modal is-${tone} is-slim`}>
      <div className="court-modal-scroll">
        <span className="court-wait-dots">
          <i />
          <i />
          <i />
        </span>
        <p className="court-label is-tight mt-3">{label}</p>
        <span className="court-wait-who">{who}</span>
      </div>
    </div>
  </div>
);

export function getWaitingPlayerNames(gameState: GameState): string {
  const pending = gameState.pendingAction;
  const pendingLoss = gameState.pendingLoss;
  const pendingExchange = gameState.pendingExchange;

  if (pendingLoss) {
    const target = gameState.players.find(p => p.id === pendingLoss.playerId);
    return target ? target.name : 'outro jogador';
  }

  if (pendingExchange) {
    const target = gameState.players.find(p => p.id === pendingExchange.playerId);
    return target ? target.name : 'outro jogador';
  }

  if (pending) {
    const alive = gameState.players.filter(p => p.cards.some(c => !c.revealed));

    if (pending.stage === 'ACTION_CHALLENGE') {
      const waiting = alive.filter(p => p.id !== pending.actorId && !pending.responses[p.id]);
      return waiting.map(p => p.name).join(', ');
    }

    if (pending.stage === 'ACTION_BLOCK') {
      if (pending.action === 'foreign_aid') {
        const waiting = alive.filter(p => p.id !== pending.actorId && !pending.responses[p.id]);
        return waiting.map(p => p.name).join(', ');
      } else {
        const target = gameState.players.find(p => p.id === pending.targetId);
        return target ? target.name : 'alvo';
      }
    }

    if (pending.stage === 'BLOCK_CHALLENGE') {
      const waiting = alive.filter(p => p.id !== pending.blockerId && !pending.responses[p.id]);
      return waiting.map(p => p.name).join(', ');
    }
  }

  return 'outros jogadores';
}

export const ActionModal: React.FC<ActionModalProps> = ({
  gameState,
  playerId,
  targetActionReq,
  onCloseTargetReq
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedLossCardId, setSelectedLossCardId] = useState<string | null>(null);
  const [selectedExchangeCardIds, setSelectedExchangeCardIds] = useState<string[]>([]);
  const [blockCharChoice, setBlockCharChoice] = useState<Character>('captain');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSubmitting(false);
    setError(null);
  }, [
    gameState.pendingAction?.id,
    gameState.pendingAction?.stage,
    gameState.pendingLoss?.playerId,
    gameState.pendingExchange?.playerId
  ]);

  const me = gameState.players.find(p => p.id === playerId);
  const isEliminated = !me || me.cards.every(c => c.revealed);

  if (isEliminated) {
    return null;
  }

  const pendingAction = gameState.pendingAction;
  const pendingLoss = gameState.pendingLoss;
  const pendingExchange = gameState.pendingExchange;

  const alert = error && (
    <div className="court-alert mt-4 text-left">
      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{error}</span>
    </div>
  );

  // 1. Target Picker Modal
  if (targetActionReq) {
    const aliveTargets = gameState.players.filter(
      p => p.id !== playerId && p.cards.some(c => !c.revealed)
    );

    const handleConfirmTarget = async () => {
      if (!selectedTargetId || isSubmitting) return;
      setIsSubmitting(true);
      sound.playClick();
      setError(null);
      const res = await socketService.playAction(gameState.code, targetActionReq, selectedTargetId);
      setIsSubmitting(false);
      if (!res.success) {
        setError(res.message || 'Erro ao executar ação.');
        sound.playError();
      } else {
        onCloseTargetReq();
      }
    };

    return (
      <Decree tone="gold" icon={<Crosshair className="w-6 h-6" />} title="Contra quem?">
        <p className="court-modal-say">
          Escolha quem sofre <em>{ACTION_LABELS[targetActionReq]}</em>.
        </p>

        {alert}

        <div className="flex flex-col gap-2 mt-5 max-h-60 overflow-y-auto pr-1">
          {aliveTargets.map(target => (
            <button
              key={target.id}
              disabled={isSubmitting}
              onClick={() => {
                sound.playClick();
                setSelectedTargetId(target.id);
              }}
              className={`court-pick ${selectedTargetId === target.id ? 'is-on' : ''}`}
            >
              <span className="font-semibold text-sm truncate">{target.name}</span>
              <span className="court-pick-coins">{target.coins} bananas</span>
            </button>
          ))}
        </div>

        <div className="court-modal-acts is-row">
          <button
            onClick={() => {
              sound.playClick();
              onCloseTargetReq();
            }}
            disabled={isSubmitting}
            className="court-btn is-stone"
          >
            Voltar
          </button>
          <button
            onClick={handleConfirmTarget}
            disabled={!selectedTargetId || isSubmitting}
            className="court-btn is-gold"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </Decree>
    );
  }

  // 2. Pending Loss Choice Modal
  if (pendingLoss) {
    if (pendingLoss.playerId === playerId) {
      const unrevealedCards = me.cards.filter(c => !c.revealed);

      const handleConfirmLoss = async () => {
        if (!selectedLossCardId || isSubmitting) return;
        setIsSubmitting(true);
        sound.playClick();
        setError(null);
        const res = await socketService.selectLossCard(gameState.code, selectedLossCardId);
        setIsSubmitting(false);
        if (!res.success) {
          setError(res.message || 'Erro ao selecionar carta.');
          sound.playError();
        } else {
          setSelectedLossCardId(null);
        }
      };

      return (
        <Decree tone="ember" icon={<Skull className="w-6 h-6" />} title="Você perde uma influência">
          <p className="court-modal-say">{pendingLoss.reason}</p>

          <div className="court-stake">
            A carta escolhida é <strong>revelada para todos</strong> e sai do jogo. A outra
            continua sua, e ninguém sabe qual é.
          </div>

          {alert}

          <div className="flex justify-center gap-4 mt-5 mb-1">
            {unrevealedCards.map(card => (
              <CardView
                key={card.id}
                card={card}
                selectable={!isSubmitting}
                selected={selectedLossCardId === card.id}
                onClick={() => !isSubmitting && setSelectedLossCardId(card.id)}
                size="md"
              />
            ))}
          </div>

          <div className="court-modal-acts">
            <button
              onClick={handleConfirmLoss}
              disabled={!selectedLossCardId || isSubmitting}
              className="court-btn is-ember"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Revelar esta carta
            </button>
          </div>
        </Decree>
      );
    } else {
      // Pending loss for OTHER player: Show waiting message
      const targetName = getWaitingPlayerNames(gameState);
      return <Waiting tone="ember" label="Escolhendo a carta que perde" who={targetName} />;
    }
  }

  // 3. Pending Exchange Choice Modal (Ambassador)
  if (pendingExchange) {
    if (pendingExchange.playerId === playerId) {
      const allAvailable = [...pendingExchange.drawnCards, ...pendingExchange.currentCards];

      const toggleExchangeCard = (cardId: string) => {
        if (isSubmitting) return;
        if (selectedExchangeCardIds.includes(cardId)) {
          setSelectedExchangeCardIds(selectedExchangeCardIds.filter(id => id !== cardId));
        } else {
          if (selectedExchangeCardIds.length < pendingExchange.keepCount) {
            setSelectedExchangeCardIds([...selectedExchangeCardIds, cardId]);
          }
        }
      };

      const handleConfirmExchange = async () => {
        if (selectedExchangeCardIds.length !== pendingExchange.keepCount || isSubmitting) return;
        setIsSubmitting(true);
        sound.playClick();
        setError(null);
        const res = await socketService.selectExchangeCards(gameState.code, selectedExchangeCardIds);
        setIsSubmitting(false);
        if (!res.success) {
          setError(res.message || 'Erro na troca.');
          sound.playError();
        } else {
          setSelectedExchangeCardIds([]);
        }
      };

      return (
        <Decree tone="gold" icon={<Shuffle className="w-6 h-6" />} title={`Sabedoria do ${CHARACTER_INFO.ambassador.name}`} wide>
          <p className="court-modal-say">
            Fique com <em>{pendingExchange.keepCount}</em>{' '}
            {pendingExchange.keepCount === 1 ? 'carta' : 'cartas'}. O resto volta para o baralho.
          </p>

          <div className="court-stake">
            Ninguém viu o que você comprou — trocar ou manter as mesmas cartas é decisão
            invisível para a mesa.
          </div>

          {alert}

          <div className="flex flex-wrap justify-center gap-4 mt-5 mb-1">
            {allAvailable.map(card => (
              <CardView
                key={card.id}
                card={card}
                selectable={!isSubmitting}
                selected={selectedExchangeCardIds.includes(card.id)}
                onClick={() => toggleExchangeCard(card.id)}
                size="md"
              />
            ))}
          </div>

          <div className="court-modal-acts">
            <button
              onClick={handleConfirmExchange}
              disabled={selectedExchangeCardIds.length !== pendingExchange.keepCount || isSubmitting}
              className="court-btn is-gold"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar ({selectedExchangeCardIds.length}/{pendingExchange.keepCount})
            </button>
          </div>
        </Decree>
      );
    } else {
      // Pending exchange for OTHER player: Show waiting message
      const targetName = getWaitingPlayerNames(gameState);
      return <Waiting tone="gold" label="Trocando cartas com o baralho" who={targetName} />;
    }
  }

  // 4. Response Window (Challenge / Block / Pass)
  if (pendingAction) {
    const actor = gameState.players.find(p => p.id === pendingAction.actorId);
    const isActor = playerId === pendingAction.actorId;
    const isTarget = playerId === pendingAction.targetId;
    const myResponse = pendingAction.responses[playerId];

    // If player has already responded or is the actor waiting for responses
    if (myResponse || (isActor && pendingAction.stage === 'ACTION_CHALLENGE') || (isActor && pendingAction.stage === 'ACTION_BLOCK' && pendingAction.action === 'foreign_aid')) {
      const waitingNames = getWaitingPlayerNames(gameState);
      return (
        <Waiting
          tone="gold"
          label={myResponse ? 'Resposta registrada · falta' : 'A mesa decide · falta'}
          who={waitingNames}
        />
      );
    }

    const handleResponse = async (type: 'pass' | 'challenge' | 'block', char?: Character) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      sound.playClick();
      setError(null);
      const res = await socketService.respondToAction(gameState.code, type, char || blockCharChoice);
      setIsSubmitting(false);
      if (!res.success) {
        setError(res.message || 'Erro na resposta.');
        sound.playError();
      }
    };

    // Stage 1: ACTION_CHALLENGE
    if (pendingAction.stage === 'ACTION_CHALLENGE' && !isActor) {
      const claimed = pendingAction.claimedCharacter
        ? CHARACTER_INFO[pendingAction.claimedCharacter].name
        : '';

      return (
        <Decree tone="ember" icon={<ShieldAlert className="w-6 h-6" />} title="Acredita nele?">
          <p className="court-modal-say">
            <strong>{actor?.name}</strong> declarou ser <em>{claimed}</em>.
          </p>

          {/* O botão dizia "acredita que é mentira" sem nunca dizer o
              preço de errar — que é a única coisa que importa aqui. */}
          <div className="court-stake">
            Se duvidar e ele <strong>não tiver {claimed}</strong>, ele perde uma influência.
            Se tiver, quem perde é <strong>você</strong>.
          </div>

          {alert}

          <div className="court-modal-acts">
            <button
              disabled={isSubmitting}
              onClick={() => handleResponse('challenge')}
              className="court-btn is-ember"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sword className="w-4 h-4" />}
              Duvidar
            </button>

            <button
              disabled={isSubmitting}
              onClick={() => handleResponse('pass')}
              className="court-btn is-stone"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Deixar passar
            </button>
          </div>
        </Decree>
      );
    }

    // Stage 2: ACTION_BLOCK
    if (pendingAction.stage === 'ACTION_BLOCK') {
      const canIBlock = pendingAction.action === 'foreign_aid' ? !isActor : isTarget;

      if (canIBlock) {
        return (
          <Decree tone="moss" icon={<Shield className="w-6 h-6" />} title="Quer bloquear?">
            <p className="court-modal-say">
              <strong>{actor?.name}</strong> está fazendo <em>{ACTION_LABELS[pendingAction.action]}</em>.
            </p>

            <div className="court-stake">
              Bloquear é <strong>alegar uma carta</strong>. Se alguém duvidar e você não
              tiver, perde uma influência.
            </div>

            {alert}

            {pendingAction.action === 'steal' && (
              <div className="flex flex-col gap-2 mt-4">
                <span className="court-label is-tight">Bloquear como</span>
                {(['captain', 'ambassador'] as Character[]).map(char => (
                  <button
                    key={char}
                    disabled={isSubmitting}
                    onClick={() => setBlockCharChoice(char)}
                    className={`court-pick ${blockCharChoice === char ? 'is-on' : ''}`}
                  >
                    <span className="font-semibold text-sm">{CHARACTER_INFO[char].name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="court-modal-acts">
              <button
                disabled={isSubmitting}
                onClick={() => handleResponse('block')}
                className="court-btn is-gold"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Bloquear
              </button>

              <button
                disabled={isSubmitting}
                onClick={() => handleResponse('pass')}
                className="court-btn is-stone"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Permitir
              </button>
            </div>
          </Decree>
        );
      }
    }

    // Stage 3: BLOCK_CHALLENGE
    if (pendingAction.stage === 'BLOCK_CHALLENGE' && playerId !== pendingAction.blockerId) {
      const blocker = gameState.players.find(p => p.id === pendingAction.blockerId);
      const blocked = pendingAction.blockedCharacter
        ? CHARACTER_INFO[pendingAction.blockedCharacter].name
        : '';

      return (
        <Decree tone="ember" icon={<ShieldAlert className="w-6 h-6" />} title="Acredita no bloqueio?">
          <p className="court-modal-say">
            <strong>{blocker?.name}</strong> alegou ter <em>{blocked}</em> para bloquear.
          </p>

          <div className="court-stake">
            Se duvidar e ele <strong>não tiver {blocked}</strong>, o bloqueio cai e ele perde
            uma influência. Se tiver, quem perde é <strong>você</strong>.
          </div>

          {alert}

          <div className="court-modal-acts">
            <button
              disabled={isSubmitting}
              onClick={() => handleResponse('challenge')}
              className="court-btn is-ember"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sword className="w-4 h-4" />}
              Duvidar do bloqueio
            </button>

            <button
              disabled={isSubmitting}
              onClick={() => handleResponse('pass')}
              className="court-btn is-stone"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Aceitar bloqueio
            </button>
          </div>
        </Decree>
      );
    }
  }

  return null;
};
