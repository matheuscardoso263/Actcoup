---
name: verify
description: Portão de verificação do Coup Online — roda typecheck do cliente e checagem de sintaxe do servidor, e reporta falhas com arquivo:linha. Use antes de commitar ou quando pedirem para conferir se está tudo verde.
argument-hint: "[escopo opcional, ex: server/gameLogic.js]"
disable-model-invocation: true
allowed-tools: Bash, PowerShell, Read, Grep, Glob
---

Respond tersely. Fragments OK.

Portão, não conserto: roda, reporta, para. Não edita código nem commita.

## Como rodar

Da raiz do repositório. Prefixe com `rtk`. PowerShell 5.1 não tem `&&` — use `;` ou chamadas separadas.

```bash
rtk npx tsc --noEmit
rtk node --check server/gameLogic.js
rtk node --check server/index.js
```

`tsconfig.json` tem `include: ["src"]` — **o typecheck não enxerga `server/`**. A engine é JS puro: o que dá para verificar sem rodar é sintaxe (`node --check`). Diga isso explicitamente quando a mudança for no servidor; não deixe passar como "typecheck verde" o que o typecheck nem leu.

**Não existe lint nem teste neste repositório.** Sem config de ESLint, sem Jest/Vitest, sem script `lint` ou `test` no `package.json`. Não invente `npm run lint`, `npm test` nem cobertura. Se pedirem "roda os testes", diga que não existem e rode o que existe.

## Build — só quando pedirem

```bash
rtk npm run build
```

É `tsc && vite build`. Duas consequências:

- Reescreve `dist/`, que é **rastreado pelo git** → `git status` fica sujo depois. Isso é esperado, não é falha.
- O `tsc` aí é o mesmo `tsc --noEmit`; se este já rodou verde, o build só acrescenta o empacotamento do Vite.

Não rode o build como verificação de rotina — rode se o pedido envolver deploy ou o bundle.

## Subir o servidor — não é verificação

`npm run server` / `npm run dev` prendem a porta 3001 e, no Windows, **abrem o navegador sozinhos** (`exec('start')` em `server/index.js`). Não use como conferência. Se o pedido for mesmo "vê se sobe", avise antes, rode e derrube depois.

Falha 2 vezes seguidas pelo mesmo motivo: pare de repetir, reporte e proponha contorno.

## Saída

Verde:

```
verify: OK  (tsc src/ | node --check server/)
```

Vermelho — agrupado por arquivo, sem despejar o log inteiro:

```
✗ typecheck
  src/components/ActionModal.tsx:118  TS2345 <mensagem>
✗ sintaxe server
  server/gameLogic.js:412  <mensagem do node>
```

Feche com o veredito explícito: **não commitar enquanto houver ✗**. E, se a mudança tocou `server/`, feche também com o lembrete de que sintaxe verde ali não é prova de que a partida funciona — a engine só se prova jogando.

## Fora do escopo desta skill

`npm run build:exe` (pkg), deploy, teste manual de partida. Se o pedido for "confere se o jogo funciona", isso não é typecheck — diga qual comando sobe o servidor e pare.
