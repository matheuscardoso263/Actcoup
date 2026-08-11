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

class SocketService {
  public socket: Socket;

  constructor() {
    this.socket = io(getBackendUrl(), {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['polling', 'websocket'] // Polling first for cloud stability (Render/Railway), then upgrade to WS
    });

    this.socket.on('connect', () => {
      console.log('✅ Conectado ao servidor Coup:', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Erro de conexão Socket.io:', err.message);
    });
  }

  // Increased timeout to 15s to support Render cold starts / cloud latency
  private withTimeout<T>(emitPromise: Promise<T>, timeoutMs = 15000): Promise<T> {
    return Promise.race([
      emitPromise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite atingido. Servidor ainda está inicializando ou não respondeu.')), timeoutMs)
      )
    ]);
  }

  onRoomState(callback: (state: GameState) => void) {
    this.socket.off('roomState');
    this.socket.on('roomState', callback);
  }

  createRoom(playerName: string): Promise<{ success: boolean; code?: string; playerId?: string; message?: string }> {
    if (!this.socket.connected) {
      this.socket.connect();
    }
    return this.withTimeout<{ success: boolean; code?: string; playerId?: string; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('createRoom', { playerName }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message || 'Servidor não conectado.' }));
  }

  joinRoom(code: string, playerName: string, existingPlayerId?: string): Promise<{ success: boolean; code?: string; playerId?: string; message?: string }> {
    if (!this.socket.connected) {
      this.socket.connect();
    }
    return this.withTimeout<{ success: boolean; code?: string; playerId?: string; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('joinRoom', { code, playerName, existingPlayerId }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message || 'Servidor não conectado.' }));
  }

  addBot(code: string): Promise<{ success: boolean; message?: string }> {
    return this.withTimeout<{ success: boolean; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('addBot', { code }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message }));
  }

  removePlayer(code: string, targetPlayerId: string): Promise<{ success: boolean; message?: string }> {
    return this.withTimeout<{ success: boolean; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('removePlayer', { code, targetPlayerId }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message }));
  }

  resetRoom(code: string): Promise<{ success: boolean; message?: string }> {
    return this.withTimeout<{ success: boolean; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('resetRoom', { code }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message }));
  }

  startGame(code: string): Promise<{ success: boolean; message?: string }> {
    return this.withTimeout<{ success: boolean; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('startGame', { code }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message }));
  }

  playAction(code: string, action: ActionType, targetId?: string): Promise<{ success: boolean; message?: string }> {
    return this.withTimeout<{ success: boolean; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('playAction', { code, action, targetId }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message }));
  }

  respondToAction(code: string, responseType: 'pass' | 'challenge' | 'block', blockCharacter?: Character): Promise<{ success: boolean; message?: string }> {
    return this.withTimeout<{ success: boolean; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('respondToAction', { code, responseType, blockCharacter }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message }));
  }

  selectLossCard(code: string, cardId: string): Promise<{ success: boolean; message?: string }> {
    return this.withTimeout<{ success: boolean; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('selectLossCard', { code, cardId }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message }));
  }

  selectExchangeCards(code: string, keptCardIds: string[]): Promise<{ success: boolean; message?: string }> {
    return this.withTimeout<{ success: boolean; message?: string }>(
      new Promise((resolve) => {
        this.socket.emit('selectExchangeCards', { code, keptCardIds }, resolve);
      })
    ).catch(err => ({ success: false, message: err.message }));
  }
}

export const socketService = new SocketService();
