---
name: improve
description: Auditoria do Coup Online em modo proposta. Levanta melhorias verificadas no código e devolve lista numerada — nenhuma edição. Use quando a pergunta for "o que pode ser melhorado / o que está errado aqui".
argument-hint: "[escopo opcional, ex: server/gameLogic.js ou 'vazamento de informação']"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep
---

Respond tersely. Fragments OK.

Auditoria **read-only**. Sem tools de escrita nesta skill de propósito: a fase de proposta não edita nada.

Escopo do argumento, se houver. Sem argumento: `src/` + `server/`.

## Regra central

Grep gera **candidato**. Achado só entra na lista depois de abrir o arquivo e ler o trecho. O que não der para provar lendo, sai da lista — não vira "provavelmente".

Prefira 5 itens provados a 20 suspeitos. Em jogo de estado compartilhado, palpite errado sobre a máquina de estados custa mais que o achado vale.

## O que varrer

**Autoridade e informação oculta**

- regra que existe só no cliente (`disabled` do botão, `if` em `GameTable`) e não em `gameLogic.js` — dá para burlar emitindo direto pelo socket
- campo com informação privada trafegando no `roomState` sem passar por `sanitizeRoomForPlayer` (`server/index.js`)
- `socket.emit` fora de `src/services/socket.ts`, sem `ensureConnected`/`withTimeout`/ack
- handler em `server/index.js` sem `try/catch` ou sem `broadcastRoomState` no caminho de sucesso

**Máquina de estados**

- caminho em `respondToAction`/`executeAction` que não termina em `advanceTurn`, `pendingLoss`, `pendingExchange` ou `checkWinCondition` — sala trava
- estágio de `pendingAction` sem branch correspondente em `handleBotTurns` — trava com bot na mesa
- mutação de estado sem `addLog`: sem atualizar `lastStateChange`, o cooldown dos bots não reinicia
- jogador eliminado ou desconectado ainda contando como resposta pendente em `allEligiblePassed`
- `getNextPlayerId` / `advanceTurn` com risco de laço quando sobra 1 vivo

**Contrato de tipos**

- divergência entre `src/types/game.ts` e o que a engine realmente monta (campo, união de string, opcionalidade). O TS não cobre o servidor — a checagem é leitura lado a lado
- `any` em tipo de domínio no cliente

**UI**

- ação que emite sem `isSubmitting`/`Loader2` (dá para clicar duas vezes)
- erro de servidor descartado (`res.message` ignorado) ou virando `alert()`
- clique sem `sound.playClick()` / falha sem `sound.playError()`
- `log.type` novo sem cor no histórico do `GameTable`
- botão de ação escondido em vez de desabilitado (esconde o custo do jogador)

**Higiene**

- asset duplicado ou não referenciado
- dependência declarada e não usada

## Achados já verificados — não conte como descoberta

Estes já foram lidos e conferidos. Só entram na lista se forem o assunto do pedido, e aí com a evidência abaixo:

- **`room.deck` inteiro vai no `roomState` para todos.** `sanitizeRoomForPlayer` (`server/index.js`) só mascara `players[].cards`; o resto da sala é espalhado com `...room`. A ordem do baralho é legível no payload do socket.
- **`pendingExchange.drawnCards` idem** — as 2 cartas compradas na Troca ficam visíveis para a mesa inteira, não só para quem trocou.
- **`timerExpiresAt` é gravado e nunca lido.** Cinco ocorrências em `gameLogic.js` (`Date.now() + 15000`), nenhuma verificação em lugar nenhum, nenhum uso no cliente. Nada expira: se um humano não responder, a sala fica parada para sempre.
- **`cards/` na raiz duplica `public/cards/`** e não é referenciado — o servidor serve `public/cards`. `logosemfundo.png.png` (≈600 KB, extensão dobrada) na raiz também: o usado é `public/logosemfundo.png`.

## Falsos positivos conhecidos — cheque antes de listar

- **Validação duplicada cliente + servidor é proposital.** Custo de moedas checado nos dois lados evita round-trip. Só é achado quando existe **apenas** no cliente.
- **`game.md` descreve outra stack** (.NET 8, SignalR, PostgreSQL, EF Core, entidades `User`/`Room`/`Match`). A implementação é Node + Socket.IO com estado em memória. A divergência é do documento, não do código — não proponha migrar a stack nem "corrigir" o código para bater com o doc.
- **Estado em `Map` na memória, perdido a cada restart**, é escolha do MVP. Só vale listar se o pedido for persistência.
- **`dist/` versionado é intencional**: o Express serve `dist/` e o deploy consome. Não proponha ignorar sem falar com quem cuida do deploy.
- **Strings pt-BR hardcoded**: não há i18n e não é meta.
- **`console.log` no servidor e no `socket.ts`** é o único canal de diagnóstico — não há logger. Ausência de logger não é achado.
- **Bots decidindo com `Math.random()`** é proposital (`0.15` de desafio, `0.2` de blefe de Duque). "IA fraca" não é bug.
- **`server/` fora do `tsconfig`** é escolha: o `pkg` empacota `.js`. Não proponha migrar o servidor para TS como item de higiene.
- **Classe singleton (`socketService`, `gameEngine`, `sound`)** é o padrão vigente. Não é gap por si só.

## Saída

Máximo **7 itens**, ordenados por impacto ÷ risco de regressão:

```
N. <título curto>
   evidência: <arquivo:linha> — <trecho que você leu>
   ocorrências: <n> (como contou / o que descartou)
   esforço: S|M|L   risco: baixo|médio|alto
   o que muda: <uma linha>
```

Marque com `[regra do jogo]` todo item que altere comportamento de partida — esses precisam de decisão, não só de aprovação técnica.

Depois da lista: **pare**. Nada de edição, nada de "já vou adiantando o item 1". Espere os números escolhidos.

Se um item depender de rodar algo (tamanho do bundle, dependência morta, comportamento em partida real), liste como **não verificado** e diga qual comando ou qual cenário de mesa provaria — não chute.
