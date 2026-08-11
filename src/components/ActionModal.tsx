import React, { useState, useEffect } from 'react';
import { GameState, Character } from '../types/game';
import { CardView } from './CardView';
import { socketService } from '../services/socket';
import { sound } from '../audio/sound';
import { ShieldAlert, Sword, Shield, Shuffle, Skull, CheckCircle2, Loader2 } from 'lucide-react';

interface ActionModalProps {
  gameState: GameState;
  playerId: string;
  targetActionReq: 'assassinate' | 'steal' | 'coup' | null;
  onCloseTargetReq: () => void;
}

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
        <div className="w-full max-w-lg 2xl:max-w-xl max-h-[90dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <h3 className="text-xl font-bold text-amber-400 mb-2 flex items-center gap-2">
            <Sword className="w-5 h-5" />
            Selecione o Alvo
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Escolha um jogador para ser afetado pela ação: <span className="uppercase font-bold text-white">{targetActionReq}</span>
          </p>

          {error && (
            <div className="mb-4 p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 mb-6 max-h-60 overflow-y-auto pr-1">
            {aliveTargets.map(target => (
              <button
                key={target.id}
                disabled={isSubmitting}
                onClick={() => {
                  sound.playClick();
                  setSelectedTargetId(target.id);
                }}
                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  selectedTargetId === target.id
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold text-sm">{target.name}</div>
                <div className="text-xs text-amber-400 font-bold">{target.coins} moedas</div>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                sound.playClick();
                onCloseTargetReq();
              }}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmTarget}
              disabled={!selectedTargetId || isSubmitting}
              className="px-6 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar Alvo
            </button>
          </div>
        </div>
      </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg 2xl:max-w-xl max-h-[90dvh] overflow-y-auto bg-slate-900 border border-red-500/60 rounded-2xl p-6 shadow-2xl text-center">
            <div className="inline-flex p-3 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 mb-3 animate-bounce">
              <Skull className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-extrabold text-red-400 mb-2">Perda de Influência!</h3>
            <p className="text-sm text-slate-300 mb-6">{pendingLoss.reason}</p>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
                {error}
              </div>
            )}

            <div className="flex justify-center gap-4 mb-6">
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

            <button
              onClick={handleConfirmLoss}
              disabled={!selectedLossCardId || isSubmitting}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Revelar Carta Selecionada
            </button>
          </div>
        </div>
      );
    } else {
      // Pending loss for OTHER player: Show waiting message
      const targetName = getWaitingPlayerNames(gameState);
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900/90 border border-red-500/40 rounded-2xl p-6 shadow-2xl text-center">
            <div className="inline-flex p-3 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 mb-3 animate-spin">
              <Loader2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-red-400 mb-2">Aguardando Revelação de Carta</h3>
            <p className="text-xs text-slate-300">
              Aguardando a ação de: <span className="font-bold text-white">{targetName}</span> escolher a carta a ser revelada...
            </p>
          </div>
        </div>
      );
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl xl:max-w-4xl max-h-[90dvh] overflow-y-auto bg-slate-900 border border-cyan-500/60 rounded-2xl p-6 shadow-2xl text-center">
            <div className="inline-flex p-3 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 mb-3">
              <Shuffle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-extrabold text-cyan-400 mb-2">Troca do Embaixador</h3>
            <p className="text-sm text-slate-300 mb-6">
              Escolha <span className="font-bold text-cyan-300">{pendingExchange.keepCount}</span> carta(s) para MANTER. As outras serão devolvidas ao baralho.
            </p>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
                {error}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-4 mb-6">
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

            <button
              onClick={handleConfirmExchange}
              disabled={selectedExchangeCardIds.length !== pendingExchange.keepCount || isSubmitting}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar Troca ({selectedExchangeCardIds.length}/{pendingExchange.keepCount})
            </button>
          </div>
        </div>
      );
    } else {
      // Pending exchange for OTHER player: Show waiting message
      const targetName = getWaitingPlayerNames(gameState);
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl text-center">
            <div className="inline-flex p-3 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 mb-3 animate-spin">
              <Loader2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-cyan-400 mb-2">Aguardando Troca de Cartas</h3>
            <p className="text-xs text-slate-300">
              Aguardando a ação de: <span className="font-bold text-white">{targetName}</span> concluir a troca...
            </p>
          </div>
        </div>
      );
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900/90 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
            <div className="inline-flex p-3 rounded-full bg-slate-800 border border-slate-700 text-amber-400 mb-3 animate-spin">
              <Loader2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-amber-400 mb-2">
              {myResponse ? 'Sua resposta foi registrada!' : 'Ação Declarada'}
            </h3>
            <p className="text-xs text-slate-300">
              Aguardando a ação de: <span className="font-bold text-white">{waitingNames}</span>...
            </p>
          </div>
        </div>
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
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-amber-500/60 rounded-2xl p-6 shadow-2xl text-center">
            <div className="inline-flex p-3 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-400 mb-3 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-amber-400 mb-1">Ação em Análise!</h3>
            <p className="text-sm text-slate-200 mb-4">
              <span className="font-bold text-white">{actor?.name}</span> declarou ser{' '}
              <span className="font-bold text-amber-400 uppercase">{pendingAction.claimedCharacter}</span> para realizar a ação.
            </p>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                disabled={isSubmitting}
                onClick={() => handleResponse('challenge')}
                className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sword className="w-5 h-5" />}
                DESAFIAR (Acredita que é mentira!)
              </button>

              <button
                disabled={isSubmitting}
                onClick={() => handleResponse('pass')}
                className="w-full py-3 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                Passar / Aceitar
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Stage 2: ACTION_BLOCK
    if (pendingAction.stage === 'ACTION_BLOCK') {
      const canIBlock = pendingAction.action === 'foreign_aid' ? !isActor : isTarget;

      if (canIBlock) {
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-lg bg-slate-900 border border-blue-500/60 rounded-2xl p-6 shadow-2xl text-center">
              <div className="inline-flex p-3 rounded-full bg-blue-950/60 border border-blue-500/40 text-blue-400 mb-3">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-blue-400 mb-1">Deseja Bloquear?</h3>
              <p className="text-sm text-slate-200 mb-4">
                <span className="font-bold text-white">{actor?.name}</span> está realizando{' '}
                <span className="font-bold text-blue-300 uppercase">{pendingAction.action}</span>.
              </p>

              {error && (
                <div className="mb-4 p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
                  {error}
                </div>
              )}

              {pendingAction.action === 'steal' && (
                <div className="mb-4 flex justify-center gap-3">
                  <button
                    disabled={isSubmitting}
                    onClick={() => setBlockCharChoice('captain')}
                    className={`px-4 py-2 rounded-lg border text-xs font-bold ${
                      blockCharChoice === 'captain'
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Bloquear como Capitão
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={() => setBlockCharChoice('ambassador')}
                    className={`px-4 py-2 rounded-lg border text-xs font-bold ${
                      blockCharChoice === 'ambassador'
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Bloquear como Embaixador
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  disabled={isSubmitting}
                  onClick={() => handleResponse('block')}
                  className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  Declarar Bloqueio
                </button>

                <button
                  disabled={isSubmitting}
                  onClick={() => handleResponse('pass')}
                  className="w-full py-3 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  Permitir Ação
                </button>
              </div>
            </div>
          </div>
        );
      }
    }

    // Stage 3: BLOCK_CHALLENGE
    if (pendingAction.stage === 'BLOCK_CHALLENGE' && playerId !== pendingAction.blockerId) {
      const blocker = gameState.players.find(p => p.id === pendingAction.blockerId);
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-purple-500/60 rounded-2xl p-6 shadow-2xl text-center">
            <div className="inline-flex p-3 rounded-full bg-purple-950/60 border border-purple-500/40 text-purple-400 mb-3 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-purple-400 mb-1">Bloqueio em Análise!</h3>
            <p className="text-sm text-slate-200 mb-4">
              <span className="font-bold text-white">{blocker?.name}</span> declarou possuir{' '}
              <span className="font-bold text-purple-300 uppercase">{pendingAction.blockedCharacter}</span> para BLOQUEAR a ação.
            </p>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                disabled={isSubmitting}
                onClick={() => handleResponse('challenge')}
                className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sword className="w-5 h-5" />}
                DESAFIAR BLOQUEIO!
              </button>

              <button
                disabled={isSubmitting}
                onClick={() => handleResponse('pass')}
                className="w-full py-3 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-2 transition-all text-sm disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                Aceitar Bloqueio
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return null;
};
