@echo off
chcp 65001 >nul
title Secretaria IEL
cd /d "%~dp0"
if not exist "%~dp0node\node.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ferramentas\instalar-node.ps1"
  if errorlevel 1 (
    echo.
    echo Nao foi possivel baixar o Node.js. Verifique a internet e tente de novo.
    pause
    exit /b 1
  )
)
cd /d "%~dp0app"
start "" "http://localhost:3000"
"%~dp0node\node.exe" --no-warnings server.js
echo.
echo O sistema foi encerrado. Pressione uma tecla para fechar.
pause >nul
