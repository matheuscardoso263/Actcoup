import { useState, useEffect } from 'react';
import { GameState } from './types/game';
import { socketService } from './services/socket';
import { Lobby } from './components/Lobby';
import { GameTable } from './components/GameTable';

export function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    socketService.onRoomState((state) => {
      setGameState(state);
      if (!playerId && socketService.socket.id) {
        setPlayerId(socketService.socket.id);
      }
    });

    socketService.socket.on('connect', () => {
      setPlayerId(socketService.socket.id || null);
    });
  }, [playerId]);

  const handleLeaveRoom = () => {
    const currentId = playerId || socketService.socket.id;
    if (gameState && currentId) {
      socketService.removePlayer(gameState.code, currentId);
      setGameState(null);
    }
  };

  const activePlayerId = playerId || socketService.socket.id || '';

  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100">
      {!gameState || gameState.status === 'lobby' ? (
        <Lobby
          gameState={gameState}
          playerId={activePlayerId}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : (
        <GameTable
          gameState={gameState}
          playerId={activePlayerId}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </div>
  );
}

export default App;
