@echo off
setlocal
title Configuracao local do JARVIS

echo.
echo J.A.R.V.I.S. - Configuracao Local
echo.
echo Este assistente usa:
echo   - Node.js 22+ para executar o aplicativo
echo   - Ollama para a IA local
echo   - Qwen3.5 4B como modelo inicial
echo.
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama nao foi encontrado.
  echo Abra https://ollama.com/download/windows e instale o Ollama.
  echo Depois execute este arquivo novamente.
  pause
  exit /b 1
)

ollama pull qwen3.5:4b
echo.
echo IA local configurada.
echo Agora execute INICIAR-JARVIS.bat
pause
