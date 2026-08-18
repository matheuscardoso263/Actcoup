@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Republica dos Primatas - Servidor e Aplicacao
color 0A
cls

echo ============================================================
echo   REPUBLICA DOS PRIMATAS - INICIANDO APLICACAO MULTIPLAYER
echo ============================================================
echo.

if not exist "node_modules\" (
  echo  [AVISO] Dependencias nao encontradas. Instalando pacotes...
  echo.
  call npm install
  echo.
)

if not exist "dist\" (
  echo  [AVISO] Frontend nao compilado. Gerando build...
  echo.
  call npm run build
  echo.
)

echo  Iniciando o servidor...
echo.

node server/index.js

pause


