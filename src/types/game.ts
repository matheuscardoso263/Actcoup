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

/** Nome em português de cada ação, para o texto que aparece ao jogador.
 *  Os identificadores do protocolo continuam em inglês — só a exibição traduz. */
export const ACTION_LABELS: Record<ActionType, string> = {
  income: 'Colheita',
  foreign_aid: 'Colheita Farta',
  coup: 'Exílio',
  tax: 'Coleta',
  assassinate: 'Caçada',
  steal: 'Furto',
  exchange: 'Sabedoria'
};

/** `accent` é a cor da casa, em canais soltos para caber em `rgb(… / α)`.
 *  Serve de identidade da carta: a moldura no hover, o brilho quando ela
 *  respalda a ação em foco e a barra da própria ação. A mesa continua
 *  verde e ouro — o acento aparece só no objeto que está em jogo. */
export const CHARACTER_INFO: Record<
  Character,
  { name: string; description: string; action?: string; block?: string; image: string; accent: string }
> = {
  duke: {
    name: 'Gorila',
    description: 'Recolhe 3 bananas do estoque. Bloqueia Colheita Farta.',
    action: 'Coleta (+3 bananas)',
    block: 'Bloqueia Colheita Farta',
    image: '/cards/gorila.png',
    accent: '226 176 48'
  },
  assassin: {
    name: 'Chimpanzé',
    description: 'Paga 3 bananas para eliminar uma influência de outro jogador.',
    action: 'Caçar (Custa 3 bananas)',
    block: undefined,
    image: '/cards/chimpanze.png',
    accent: '198 68 40'
  },
  captain: {
    name: 'Macaco-prego',
    description: 'Furta até 2 bananas de outro jogador. Bloqueia Furto.',
    action: 'Furtar (Até 2 bananas)',
    block: 'Bloqueia Furto',
    image: '/cards/macacoprego.png',
    accent: '70 160 140'
  },
  ambassador: {
    name: 'Orangotango',
    description: 'Troca cartas com o baralho. Bloqueia Furto.',
    action: 'Sabedoria (Comprar 2 do baralho)',
    block: 'Bloqueia Furto',
    image: '/cards/orangotango.png',
    accent: '164 112 198'
  },
  countess: {
    name: 'Babuíno',
    description: 'Não possui ação ativa. Bloqueia Caçada.',
    action: undefined,
    block: 'Bloqueia Caçada',
    image: '/cards/babuino.png',
    accent: '120 146 205'
  }
};
