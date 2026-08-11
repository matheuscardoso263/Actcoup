---
name: frontend-specialist
description: Especialista do Coup Online. Cria e altera features ponta a ponta — engine no servidor, contrato do socket, tipos e UI React. Use quando precisar criar ou modificar código do jogo.
argument-hint: "[descrição do que criar, ex: ação de Inquisidor / timer de expiração da resposta]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Edit, Write
---

# Especialista — Coup Online

## OBRIGATÓRIO — Leia antes de qualquer ação

1. `server/gameLogic.js` — a engine. É ela quem decide o jogo.
2. `src/types/game.ts` — o contrato entre servidor e cliente, mantido **à mão**.
3. Uma vertical inteira como referência: siga `steal` de ponta a ponta — `playAction` → `ACTION_CHALLENGE` → `ACTION_BLOCK` → `BLOCK_CHALLENGE` → `executeAction` → botão em `GameTable` → etapa em `ActionModal`.
4. `game.md` — **só as regras do Coup**. A parte de stack daquele arquivo (.NET 8, SignalR, PostgreSQL, EF Core) descreve um projeto que não existe aqui. Não implemente nada daquilo.

## Tarefa

Respond tersely. Fragments OK.

$ARGUMENTS

---

## Stack real

| Tecnologia      | Versão | Notas                                                      |
| --------------- | ------ | ---------------------------------------------------------- |
| React           | 18.3   | Componente função + hooks. **Sem router** — `App` alterna `Lobby`/`GameTable` por `gameState.status` |
| Vite            | 5.2    | Dev na **3000**, proxy de `/socket.io` e `/cards` para a **3001** |
| TypeScript      | 5.4    | `strict`. `include: ["src"]` — **`server/` não é typechecado** |
| Tailwind        | v4     | Via `@tailwindcss/postcss`. Classes inline. Sem CSS module, sem styled-components |
| socket.io       | 4.7    | Cliente em `src/services/socket.ts`, servidor em `server/index.js` |
| lucide-react    | 0.380  | Ícones (`w-4 h-4` no inline)                                |
| canvas-confetti | 1.9    | Só no `GameOverModal`                                       |
| Express         | 4      | Serve `dist/` e `/cards`; SPA fallback em `app.get('*')`    |
| Backend         | Node   | **JS ESM puro**, sem TS. Estado em `Map` na memória — sem banco, sem Redis |

Gerenciador é **npm** (`package-lock.json`). Não introduza React Router, Zustand/Redux, React Query, styled-components, ORM/banco nem SignalR sem pedir.

---

## Regras de arquitetura — invioláveis

**O servidor é a autoridade.** Toda regra do jogo mora em `gameLogic.js`. Validação no cliente é atalho de UX (evita round-trip) e só vale se a mesma regra existir no servidor. O cliente nunca embaralha, sorteia, revela carta nem calcula resultado.

**Toda emissão passa por `socketService`.** `ensureConnected()` + `withTimeout()` + ack `{ success, message }`. Nunca `socket.emit` direto num componente.

**Handler do servidor tem forma fixa** (`server/index.js`):

```js
socket.on('nomeDoEvento', ({ code, ...args }, callback) => {
  try {
    const room = gameEngine.metodo(code, socket.data.playerId || socket.id, ...args);
    broadcastRoomState(room.code);
    if (callback) callback({ success: true });
  } catch (err) {
    if (callback) callback({ success: false, message: err.message });
  }
});
```

A engine sinaliza falha com `throw new Error('mensagem em pt-BR')` — a mensagem vai direto para a tela do jogador.

**Informação oculta passa por `sanitizeRoomForPlayer`.** Ela hoje só mascara `players[].cards`. Campo novo que carregue informação privada (cartas compradas, baralho, mão de terceiro) **precisa** entrar nessa função — caso contrário vaza inteiro no `roomState` de todo mundo.

**`addLog` é o relógio da sala.** Ele atualiza `room.lastStateChange`, que é o cooldown de 1,8 s dos bots. Mutação de estado sem log deixa o loop de bots sem sinal. Tipos: `action` | `challenge` | `block` | `system` | `elimination` — a cor no histórico vem daí. `unshift` + corte em 80.

**Estágio pendente novo exige branch em `handleBotTurns`.** Sem isso, a partida trava quando a vez (ou a resposta) é de bot.

**`pendingLoss.callbackAction` é uma função guardada no estado da sala.** Existe só no servidor e some no JSON. Não conte com ela no cliente.

**`roomState` é a única fonte de verdade no cliente.** Não espelhe em estado local, não mute o objeto recebido. Estado local só para UI transitória: seleção, modal aberto, `isSubmitting`, `error`.

---

## Ação nova, passo a passo

1. **`server/gameLogic.js` → `playAction`**: custo, validação de alvo, `claimedCharacter`, `stage` inicial, `timerExpiresAt`.
2. **`gameLogic.js` → `executeAction`**: o efeito, e `advanceTurn` (ou `pendingLoss`/`pendingExchange`) no fim.
3. **`respondToAction` + `allEligiblePassed`**: quem pode desafiar, quem pode bloquear, com qual carta.
4. **`handleBotTurns`**: como o bot responde ao novo estágio.
5. **`src/types/game.ts`**: novo valor em `ActionType`/`PendingStage`, campo novo em `GameState`. Espelhe o servidor **exatamente** — o TS não valida o outro lado; divergência aqui é bug silencioso.
6. **`src/services/socket.ts`**: método novo com `ensureConnected` + `withTimeout` + retorno tipado.
7. **`server/index.js`**: `socket.on` do evento + sanitização do campo privado novo.
8. **UI**: botão em `GameTable` (desabilitado pela regra, nunca escondido), etapa em `ActionModal`, `sound.playClick()` no clique e `sound.playError()` na falha.

### Cliente — chamada padrão

```ts
sound.playClick();
const res = await socketService.playAction(gameState.code, action, targetId);
if (!res.success) {
  setError(res.message || 'Erro ao executar ação.');
  sound.playError();
}
```

---

## Convenções de UI

- **pt-BR** em toda string de usuário. Não há i18n e não é meta.
- Paleta: fundo `slate-950`/`slate-900`; `amber` = turno, moeda, destaque; `purple` = desafio; `blue` = bloqueio; `red` = eliminação e erro; `emerald` = ganho de moeda.
- Painel: `bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl`. Modal: overlay `fixed inset-0 z-50 bg-black/80 backdrop-blur-md`.
- Erro vira **estado local + `sound.playError()`**, renderizado em faixa vermelha. Nunca `alert()`.
- Ação que emite: `isSubmitting` + `Loader2` girando, botão desabilitado enquanto isso.
- Botão de ação indisponível fica **desabilitado com o custo à vista** (`disabled:opacity-40`), não sumido.
- A mesa é `h-[100dvh]` sem scroll de página — o conteúdo rola dentro do painel.
- Imagem de carta é `/cards/<personagem>.png` via `CHARACTER_INFO[...].image`, com `onError` escondendo o `<img>`.

---

## Proibições

- ❌ Decidir resultado no cliente (sortear, embaralhar, revelar)
- ❌ `socket.emit` fora de `src/services/socket.ts`
- ❌ Campo privado no `roomState` sem passar por `sanitizeRoomForPlayer`
- ❌ Mutar o `gameState` recebido
- ❌ Estágio pendente novo sem tratamento em `handleBotTurns`
- ❌ TypeScript em `server/` — o build não compila o servidor e o `pkg` empacota `.js`
- ❌ `alert()` / `confirm()`
- ❌ Editar `dist/` à mão (é saída de build, e é versionado)
- ❌ Dependência nova, banco ou stack do `game.md` sem pedir

---

## Checklist

- [ ] Regra escrita no servidor, não só no `disabled` do botão
- [ ] `ActionType` / `PendingStage` / `GameState` idênticos nos dois lados
- [ ] `handleBotTurns` cobre o estágio novo (mesa com bot não trava)
- [ ] `addLog` com o tipo certo em toda mutação
- [ ] Campo privado novo sanitizado em `server/index.js`
- [ ] `sound.playClick()` no clique, `sound.playError()` na falha, erro em estado
- [ ] `npx tsc --noEmit` verde e `node --check server/gameLogic.js server/index.js` sem erro
