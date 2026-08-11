import { useState, useEffect, useRef } from 'react';
import { GameState } from './types/game';
import {
  socketService,
  getPersistentPlayerId,
  saveSession,
  loadSession,
  clearSession
} from './services/socket';
import { Lobby } from './components/Lobby';
import { GameTable } from './components/GameTable';
import { useDealTrigger } from './hooks/useDeal';

export function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const playerId = getPersistentPlayerId();
  // Precisa morar aqui: o GameTable só nasce com a partida já em curso e não
  // teria como saber se ela acabou de começar ou se é uma reconexão.
  const dealKey = useDealTrigger(gameState);
  // Depois de sair, broadcasts atrasados não podem recolocar o jogador na sala.
  const leftRoomRef = useRef(false);

  useEffect(() => {
    socketService.onRoomState((state) => {
      if (leftRoomRef.current) return;
      setGameState(state);
      saveSession({
        code: state.code,
        playerName: state.players.find(p => p.id === playerId)?.name || ''
      });
    });

    // Reconexão (refresh, queda de rede, troca de rede): reentra na sala
    // com a mesma identidade, preservando host, vez e cartas.
    const handleConnect = () => {
      const session = loadSession();
      if (!session || leftRoomRef.current) return;
      socketService.joinRoom(session.code, session.playerName, playerId).then((res) => {
        if (!res.success) clearSession();
      });
    };

    socketService.socket.on('connect', handleConnect);
    if (socketService.socket.connected) handleConnect();

    return () => {
      socketService.socket.off('connect', handleConnect);
    };
  }, [playerId]);

  const handleLeaveRoom = () => {
    if (!gameState) return;
    leftRoomRef.current = true;
    clearSession();
    socketService.removePlayer(gameState.code, playerId);
    setGameState(null);
  };

  // Fim de partida: a sala foi resetada para o lobby, o jogador continua nela.
  const handleReturnToLobby = () => {
    setGameState(prev => (prev ? { ...prev, status: 'lobby', winner: null } : prev));
  };

  const handleEnterRoom = () => {
    leftRoomRef.current = false;
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 font-sans antialiased text-slate-100">
      {!gameState || gameState.status === 'lobby' ? (
        <Lobby
          gameState={gameState}
          playerId={playerId}
          onLeaveRoom={handleLeaveRoom}
          onEnterRoom={handleEnterRoom}
        />
      ) : (
        <GameTable
          gameState={gameState}
          playerId={playerId}
          dealKey={dealKey}
          onLeaveRoom={handleLeaveRoom}
          onReturnToLobby={handleReturnToLobby}
        />
      )}
    </div>
  );
}

export default App;
