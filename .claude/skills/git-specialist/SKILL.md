---
name: git-specialist
description: Especialista Git do Coup Online. Use quando precisar de ajuda com comandos git, mensagens de commit, ou melhores práticas de versionamento.
argument-hint: "[descrição do que foi feito, ex: bloqueio de roubo pelo embaixador]"
disable-model-invocation: true
allowed-tools: Bash, PowerShell, Read, Glob, Grep
---

Respond tersely. Fragments OK.

Especialista git do Coup Online. Remote: `matheuscardoso263/Actcoup`. Branch de trabalho: `master`.

## Formato

```
TipoDemanda|Coup|Modulo||Descricao
```

Sem acento na mensagem. Exemplos:

- `Evolutivo|Coup|Engine||Adicionando bloqueio de roubo pelo embaixador`
- `Corretiva|Coup|Servidor|Socket||Sanitizando deck antes do broadcast`
- `Corretiva|Coup|Bots||Corrigindo travamento quando bot e alvo do assassinato`
- `Refatoracao|Coup|Mesa||Extraindo painel de acoes do GameTable`

Tipos: `Evolutivo` `Corretiva` `Refatoracao` `Hotfix`

Módulos:
`Engine` (`server/gameLogic.js`) · `Servidor` (`server/index.js`) · `Socket` (`src/services`) · `Tipos` (`src/types`) · `Lobby` · `Mesa` (`GameTable`) · `Cartas` (`CardView`) · `Modais` (`ActionModal`, `GameOverModal`) · `Bots` · `Audio` · `Estilo` (Tailwind, `index.css`) · `Build` · `Deploy` (`dist/`, `pkg`) · `Docs`

O histórico atual é livre (`fix conexao`, `fix timeout`, `fix deploy`) — **não copie**. Daqui pra frente é o formato pipe acima.

## Processo

1. `rtk git status`
2. `rtk git diff --stat`
3. `rtk git add <arquivos>` — nunca `-A` nem `.`
4. Commit com heredoc
5. `rtk git push` — só quando pedido

## Regras

- ❌ `git add -A` / `git add .`
- ❌ Trailer `Co-Authored-By`
- ❌ Amend em commit já enviado
- ❌ Commitar `.claude/settings.local.json`, `.code-review-graph/`, `node_modules/`, `.env` sem pedido explícito
- **`dist/` é rastreado** (o Express serve `dist/` e o deploy consome). Build regerado entra em **commit próprio** — `Build|Coup|Deploy||Regerando dist` — nunca misturado com mudança de código. Se `dist/` apareceu sujo só porque alguém rodou `npm run build`, pergunte antes de incluir.
- `package-lock.json` acompanha o `package.json` no mesmo commit — npm é o gerenciador aqui.
- Diff cobrindo duas coisas independentes → **dois commits**. Proponha o split em vez de amontoar.
- Mudança que atravessa servidor e cliente na mesma feature é **um commit** (o contrato do socket quebra se separar): `Evolutivo|Coup|Engine|Socket|Mesa||Descricao`.
- Mais de um módulo no mesmo assunto → separar com `|`: `Modulo1|Modulo2||Descricao`
- Mensagem não informada → inferir dos arquivos alterados
- `npx tsc --noEmit` verde e `node --check server/*.js` sem erro antes de commitar. **Não existe lint nem teste** neste repositório — não invente comando.
- `master` sem CI: o que vai para o remote é o que o deploy pega. Confirme antes de `push` quando o diff tocar `server/` ou `dist/`.

## Template

```bash
git commit -m "$(cat <<'EOF'
Evolutivo|Coup|Modulo||Descricao objetiva sem acento
EOF
)"
```
