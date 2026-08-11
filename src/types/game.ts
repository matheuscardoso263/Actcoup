export type Character = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'countess';
export type CardCharacter = Character | 'hidden';

export interface Card {
  id: string;
  character: CardCharacter;
  revealed: boolean;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  coins: number;
  cards: Card[];
  isConnected: boolean;
}

export type ActionType =
  | 'income'
  | 'foreign_aid'
  | 'coup'
  | 'tax'
  | 'assassinate'
  | 'steal'
  | 'exchange';

/** Desafio resolvido: quem duvidou, de quem, e no que deu. */
export interface ChallengeLogEvent {
  kind: 'challenge';
  /** Desafio à ação declarada ou ao bloqueio alegado. */
  scope: 'action' | 'block';
  /** `truth` = o acusado tinha a carta; `bluff` = estava blefando. */
  outcome: 'truth' | 'bluff';
  claimerId: string;
  claimerName: string;
  challengerId: string;
  challengerName: string;
  character: Character;
  /** Quem perde influência por causa deste desafio. */
  loserId: string;
  loserName: string;
}

/** Bloqueio declarado — ainda pode ser desafiado. */
export interface BlockLogEvent {
  kind: 'block';
  blockerId: string;
  blockerName: string;
  character: Character;
  action: ActionType;
}

export type LogEvent = ChallengeLogEvent | BlockLogEvent;

export interface ActionLog {
  id: string;
  timestamp: number;
  text: string;
  type: 'action' | 'challenge' | 'block' | 'system' | 'elimination';
  /** Presente só nos lances que merecem animação. Ver addLog no servidor. */
  event?: LogEvent;
}

export type PendingStage =
  | 'ACTION_CHALLENGE'           // Players can challenge the action claim
  | 'ACTION_BLOCK'               // Eligible players can block the action
  | 'BLOCK_CHALLENGE'            // Players can challenge the block claim
  | 'LOSS_CHOICE'                // Player must pick an influence card to reveal
  | 'EXCHANGE_CHOICE';           // Player must pick cards to keep after exchange

export interface PendingAction {
  id: string;
  actorId: string;
  action: ActionType;
  targetId?: string;
  claimedCharacter?: Character;
  stage: PendingStage;
  responses: Record<string, 'pass' | 'challenge' | 'block'>;
  blockerId?: string;
  blockedCharacter?: Character;
  timerExpiresAt?: number;
}

export interface PendingLoss {
  playerId: string;
  reason: string;
  callbackAction?: () => void;
}

export interface PendingExchange {
  playerId: string;
  drawnCards: Card[];
  currentCards: Card[];
  keepCount: number;
}

export interface GameState {
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  players: Player[];
  deck: Character[];
  currentTurnPlayerId: string;
  pendingAction: PendingAction | null;
  pendingLoss: PendingLoss | null;
  pendingExchange: PendingExchange | null;
  logs: ActionLog[];
  winner: Player | null;
  maxPlayers: number;
  minPlayers: number;
}

export const CHARACTER_INFO: Record<Character, { name: string; description: string; action?: string; block?: string; image: string }> = {
  duke: {
    name: 'Duque',
    description: 'Pega 3 moedas da tesouraria. Bloqueia Ajuda Externa.',
    action: 'Taxa (+3 moedas)',
    block: 'Bloqueia Ajuda Externa',
    image: '/cards/duke.webp'
  },
  assassin: {
    name: 'Assassino',
    description: 'Paga 3 moedas para tentar eliminar uma influência de um jogador.',
    action: 'Assassinar (Custa 3 moedas)',
    block: undefined,
    image: '/cards/assassin.webp'
  },
  captain: {
    name: 'Capitão',
    description: 'Rouba até 2 moedas de outro jogador. Bloqueia Roubo.',
    action: 'Roubar (Até 2 moedas)',
    block: 'Bloqueia Roubo',
    image: '/cards/captain.webp'
  },
  ambassador: {
    name: 'Embaixador',
    description: 'Troca cartas com o baralho. Bloqueia Roubo.',
    action: 'Trocar (Comprar 2 do baralho)',
    block: 'Bloqueia Roubo',
    image: '/cards/ambassador.webp'
  },
  countess: {
    name: 'Condessa',
    description: 'Não possui ação ativa. Bloqueia Assassinato.',
    action: undefined,
    block: 'Bloqueia Assassinato',
    image: '/cards/countess.webp'
  }
};
