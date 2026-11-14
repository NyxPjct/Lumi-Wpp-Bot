@echo off
setlocal
cd /d "%~dp0"
title Lumi - demonstracao
if not exist "scripts\start-demo.mjs" (
  echo Extraia o ZIP completo da Lumi antes de abrir este arquivo.
  pause
  exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo Instale Node.js 22 ou mais recente e abra este arquivo novamente.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<22){console.error('A Lumi precisa do Node.js 22 ou mais recente.');process.exit(1)}"
if errorlevel 1 goto erro
if not exist "node_modules\next\dist\bin\next" (
  echo Instalando dependencias da Lumi. Aguarde; a primeira vez precisa de internet.
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto erro
)
node scripts\start-demo.mjs
if errorlevel 1 goto erro
exit /b 0
:erro
echo.
echo Nao foi possivel iniciar a Lumi. Copie a mensagem acima para pedir ajuda.
pause
exit /b 1
