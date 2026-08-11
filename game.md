# GAME_DESIGN.md

# Coup Online (.NET 8 + React)

## Objetivo
Ser o último jogador com pelo menos uma influência (carta) não revelada.

## Tecnologias
- Backend: ASP.NET Core 8 Web API
- Tempo real: SignalR
- Frontend: React + Vite + TypeScript
- Banco: PostgreSQL
- Cache: Redis (opcional)
- ORM: EF Core

## Multiplayer
- Criar sala
- Código de 6 caracteres
- Entrar por código
- Host inicia partida
- 2 a 6 jogadores
- Reconexão por Token da partida

## Fluxo
Lobby -> Distribuição -> Turnos -> Eliminações -> Vitória

## Baralho
15 cartas:
- 3 Duques
- 3 Assassinos
- 3 Capitães
- 3 Embaixadores
- 3 Condessas

Cada jogador recebe 2 cartas e 2 moedas.

## Ações Livres
### Renda
+1 moeda. Não pode ser bloqueada.

### Ajuda Externa
+2 moedas.
Bloqueável por Duque.

### Golpe
Custa 7 moedas.
Alvo perde uma influência.
Não pode ser bloqueado.
Com 10+ moedas é obrigatório realizar Golpe.

## Personagens

### Duque
- Taxa: +3 moedas.
- Bloqueia Ajuda Externa.

### Assassino
Paga 3 moedas para tentar eliminar uma influência.

Pode ser bloqueado apenas pela Condessa.

### Capitão
Rouba até 2 moedas.

Pode ser bloqueado por:
- Capitão
- Embaixador

### Embaixador
Compra 2 cartas do baralho.
Escolhe 2 para manter.
Demais retornam embaralhadas.

Também bloqueia Roubo.

### Condessa
Não possui ação ativa.
Bloqueia Assassinato.

## Blefe

Qualquer jogador pode declarar possuir qualquer personagem.

Exemplo:

"Sou Duque, faço Taxa."

Os demais podem:

- aceitar
- desafiar

## Desafio

Se desafiado:

Caso realmente possua a carta:
- revela
- compra outra
- desafiante perde influência

Caso não possua:
- perde influência
- ação cancelada

## Bloqueios

Bloqueios também podem ser blefados.

Também podem ser desafiados.

## Influências

Ao perder influência:

- jogador escolhe carta
- revela
- permanece aberta até fim

Duas cartas reveladas:
Jogador eliminado.

## Ordem do turno

1. Jogador escolhe ação
2. Espera desafio
3. Espera bloqueio
4. Espera desafio ao bloqueio
5. Resolve ação
6. Próximo jogador

## Vitória

Último jogador vivo.

# Estrutura Backend

/Game.Api
/Game.Domain
/Game.Application
/Game.Infrastructure

Entidades:
- User
- Room
- Match
- Player
- Deck
- Card
- Turn
- ActionLog

# SignalR

Client -> Server

CreateRoom
JoinRoom
LeaveRoom
StartGame
PlayAction
Challenge
Block
LoseInfluence

Server -> Client

RoomCreated
PlayerJoined
GameStarted
TurnStarted
CoinsUpdated
InfluenceLost
PlayerEliminated
GameFinished

# API

POST /rooms
POST /rooms/{code}/join
POST /rooms/{code}/start
GET /rooms/{code}

# Banco

Users
Rooms
RoomPlayers
Matches
Turns
Cards
Logs

# Regras importantes

- Todas as validações devem ocorrer exclusivamente no servidor.
- O cliente nunca decide resultado.
- O servidor controla baralho, moedas, turnos e cartas.
- Cartas ocultas nunca são enviadas para outros jogadores.
- Logs privados enviados apenas ao dono.
- Logs públicos mostram apenas ações permitidas.

# Interface

Tela Inicial
Criar Sala
Entrar por Código
Lobby
Mesa
Fim de Jogo

Mesa:
- cartas do jogador
- moedas
- histórico
- jogadores
- ações disponíveis
- temporizador
- animações

# Melhorias futuras

- Ranking
- Estatísticas
- Partidas privadas
- IA
- Replay
- Espectador
- Chat
- Emojis
- Internacionalização
