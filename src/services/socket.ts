import { io, Socket } from 'socket.io-client';
import { GameState, ActionType, Character } from '../types/game';

// Determine backend URL:
const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.port === '3000') {
      return `http://${window.location.hostname}:3001`;
    }
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const PLAYER_ID_KEY = 'coup_player_id';
const SESSION_KEY = 'coup_session';

export interface StoredSession {
  code: string;
  playerName: string;
}

// Identidade estável: socket.id muda a cada reconexão, então não serve
// como identificador de jogador (o jogador perderia host, vez e cartas).
export function getPersistentPlayerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `p_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    return `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export function saveSession(session: StoredSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* storage indisponível */ }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch { /* storage indisponível */ }
}

class SocketService {
  public socket: Socket;

  constructor() {
    this.socket = io(getBackendUrl(), {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      transports: ['polling', 'websocket']
    });

    this.socket.on('connect', () => {
      console.log('✅ Conectado ao servidor Coup:', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão Socket.io:', err.message);
    });
  }

  // Ensures socket is fully connected before emitting events
  private ensureConnected(timeoutMs = 25000): Promise<void> {
    if (this.socket.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('O servidor está levando muito tempo para inicializar (Cold Start). Tente novamente em alguns segundos.'));
      }, timeoutMs);

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err || new Error('Erro ao conectar ao servidor.'));
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onError);
      };

      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);

      if (!this.socket.connected) {
        this.socket.connect();
      }
    });
  }

  private withTimeout<T>(emitPromise: Promise<T>, timeoutMs = 15000): Promise<T> {
    return Promise.race([
      emitPromise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite atingido. O servidor não respondeu a ação.')), timeoutMs)
      )
    ]);
  }

  onRoomState(callback: (state: GameState) => void) {
    this.socket.off('roomState');
    this.socket.on('roomState', callback);
  }

  async createRoom(playerName: string): Promise<{ success: boolean; code?: string; playerId?: string; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; code?: string; playerId?: string; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('createRoom', { playerName, playerId: getPersistentPlayerId() }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message || 'Servidor não conectado.' };
    }
  }

  async joinRoom(code: string, playerName: string, existingPlayerId?: string): Promise<{ success: boolean; code?: string; playerId?: string; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; code?: string; playerId?: string; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit(
            'joinRoom',
            { code, playerName, existingPlayerId: existingPlayerId || getPersistentPlayerId() },
            resolve
          );
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message || 'Servidor não conectado.' };
    }
  }

  async addBot(code: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('addBot', { code }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async removePlayer(code: string, targetPlayerId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('removePlayer', { code, targetPlayerId }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async claimHost(code: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('claimHost', { code }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async resetRoom(code: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('resetRoom', { code }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async startGame(code: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('startGame', { code }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async playAction(code: string, action: ActionType, targetId?: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('playAction', { code, action, targetId }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async respondToAction(code: string, responseType: 'pass' | 'challenge' | 'block', blockCharacter?: Character): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('respondToAction', { code, responseType, blockCharacter }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async selectLossCard(code: string, cardId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('selectLossCard', { code, cardId }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async selectExchangeCards(code: string, keptCardIds: string[]): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureConnected();
      return await this.withTimeout<{ success: boolean; message?: string }>(
        new Promise((resolve) => {
          this.socket.emit('selectExchangeCards', { code, keptCardIds }, resolve);
        })
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}

export const socketService = new SocketService();
