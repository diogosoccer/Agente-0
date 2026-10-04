@echo off
setlocal EnableExtensions
title J.A.R.V.I.S. - Agente Zero

echo.
echo ==================================================
echo              J.A.R.V.I.S. / BOOT
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  echo Instale Node.js 22 ou superior e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao encontrado.
  pause
  exit /b 1
)

where ollama >nul 2>nul
if errorlevel 1 (
  echo [ATENCAO] Ollama nao encontrado.
  echo JARVIS ainda pode abrir, mas a conversa inteligente local ficara offline.
  echo Instale Ollama e depois execute este arquivo novamente.
  echo.
) else (
  echo [OK] Ollama detectado.
  echo Verificando modelo local Qwen3.5 9B (fallback 4B)...
  ollama list | findstr /I "qwen3.5:4b" >nul 2>nul
  if errorlevel 1 (
    echo [INFO] Baixando qwen3.5:4b. Isso acontece apenas na primeira vez.
    ollama pull qwen3.5:4b
  ) else (
    echo [OK] Modelo local encontrado.
  )
)

if not exist node_modules (
  echo [INFO] Instalando dependencias do JARVIS...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist worker\node_modules (
  echo [INFO] Instalando dependencias do Worker...
  cd worker
  call npm install
  if errorlevel 1 goto :fail
  cd ..
)

echo [INFO] Garantindo Chromium do Worker...
cd worker
call npx playwright install chromium
if errorlevel 1 goto :fail
cd ..

echo.
echo [OK] Iniciando Worker local...
start "JARVIS Worker" cmd /k "cd /d %~dp0worker && npm start"

timeout /t 2 /nobreak >nul

echo [OK] Iniciando interface JARVIS...
start "JARVIS Interface" cmd /k "cd /d %~dp0 && npm run dev -- --host 127.0.0.1"

timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5173/jarvis"

echo.
echo ==================================================
echo JARVIS INICIADO.
echo Feche as duas janelas do terminal para encerrar.
echo ==================================================
exit /b 0

:fail
echo.
echo [ERRO] A instalacao inicial falhou.
echo Veja a mensagem acima e execute novamente.
pause
exit /b 1
