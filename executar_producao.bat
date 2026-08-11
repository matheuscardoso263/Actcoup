@echo off
title Coup Online - Servidor de Producao
color 0B
cls

echo ============================================================
echo   🏆 COUP ONLINE - MODO PRODUCAO 🏆
echo ============================================================
echo.
echo  Compilando a aplicacao web e iniciando o servidor...
echo.

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha ao compilar a aplicacao.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo  Iniciando o servidor Node.js...
node server/index.js

pause
