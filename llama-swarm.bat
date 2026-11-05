@echo off
setlocal enabledelayedexpansion
set "BASEDIR=%~dp0"
pushd "%BASEDIR%" >nul 2>nul

if not exist "%BASEDIR%models\*.gguf" (
    echo [ERROR] No se encontraron modelos .gguf en la carpeta "models".
    pause
    exit /b 1
)
if not exist "%BASEDIR%presets.conf.bat" (
    echo [ERROR] No se encontro presets.conf.bat
    pause
    exit /b 1
)

call "%BASEDIR%presets.conf.bat"
if not defined PRESET_COUNT set "PRESET_COUNT=0"
if "%PRESET_COUNT%"=="0" (
    echo [ERROR] PRESET_COUNT no definido.
    pause
    exit /b 1
)

echo.
echo ================== MODELOS DISPONIBLES ==================
set "MODEL_COUNT=0"
for %%F in (%BASEDIR%models\*.gguf) do (
    set /a MODEL_COUNT+=1
    set "MODEL_NAME_!MODEL_COUNT!=%%~nxF"
    set "MODEL_PATH_!MODEL_COUNT!=%%~fF"
    echo   !MODEL_COUNT!. %%~nxF
)
echo =========================================================
echo.

set "MODEL_CHOICE="
set /p "MODEL_CHOICE=Selecciona el numero del modelo: "
if not defined MODEL_CHOICE (
    echo [ERROR] No seleccionaste modelo.
    pause
    exit /b 1
)
call set "SELECTED_MODEL=%%MODEL_PATH_%MODEL_CHOICE%%%"
if not defined SELECTED_MODEL (
    echo [ERROR] Seleccion de modelo invalida.
    pause
    exit /b 1
)
call set "SELECTED_MODEL_NAME=%%MODEL_NAME_%MODEL_CHOICE%%%"
echo Modelo seleccionado: !SELECTED_MODEL_NAME!

echo.
echo ================== PRESETS DISPONIBLES ==================
for /l %%I in (1,1,%PRESET_COUNT%) do (
    call set "PNAME=%%PRESET_%%I_NAME%%"
    echo   %%I. !PNAME!
)
echo =========================================================
echo.

set "PRESET_CHOICE="
set /p "PRESET_CHOICE=Selecciona el numero del preset: "
if not defined PRESET_CHOICE (
    echo [ERROR] No seleccionaste preset.
    pause
    exit /b 1
)
if %PRESET_CHOICE% lss 1 (
    echo [ERROR] Preset invalido.
    pause
    exit /b 1
)
if %PRESET_CHOICE% gtr %PRESET_COUNT% (
    echo [ERROR] Preset invalido.
    pause
    exit /b 1
)

call set "PRESET_NAME=%%PRESET_%PRESET_CHOICE%_NAME%%"
call set "CTX=%%PRESET_%PRESET_CHOICE%_CTX%%"
call set "NPRED=%%PRESET_%PRESET_CHOICE%_NPRED%%"
call set "TEMPERATURE=%%PRESET_%PRESET_CHOICE%_TEMPERATURE%%"
call set "TOPP=%%PRESET_%PRESET_CHOICE%_TOPP%%"
call set "REP=%%PRESET_%PRESET_CHOICE%_REP%%"
call set "REASONING=%%PRESET_%PRESET_CHOICE%_REASONING%%"
call set "REASONING_BUDGET=%%PRESET_%PRESET_CHOICE%_REASONING_BUDGET%%"
call set "THINKING=%%PRESET_%PRESET_CHOICE%_THINKING%%"

if not defined CTX set "CTX=0"
if not defined NPRED set "NPRED=-1"
if not defined TEMPERATURE set "TEMPERATURE=0.8"
if not defined TOPP set "TOPP=0.95"
if not defined REP set "REP=1.1"
if not defined REASONING set "REASONING=auto"
if not defined REASONING_BUDGET set "REASONING_BUDGET=-1"

echo.
echo Preset seleccionado: %PRESET_NAME%
echo   ctx=%CTX%  n-predict=%NPRED%  temp=%TEMPERATURE%  top-p=%TOPP%  repeat=%REP%
echo   reasoning=%REASONING%  budget=%REASONING_BUDGET%  thinking=%THINKING%

echo.
echo ================== MODO DE EJECUCION ====================
echo   1. Chat en terminal (interactivo)
echo   2. Servidor web (http://localhost:8080)
echo =========================================================
echo.

set "MODE_CHOICE="
set /p "MODE_CHOICE=Selecciona el modo (1/2): "
if not defined MODE_CHOICE (
    echo [ERROR] No seleccionaste modo.
    pause
    exit /b 1
)

set "COMMON_ARGS=-m "%SELECTED_MODEL%" -c %CTX% -n %NPRED% --temp %TEMPERATURE% --top-p %TOPP% --repeat-penalty %REP% -rea %REASONING% --reasoning-budget %REASONING_BUDGET% -ngl 999"
if /I "%THINKING%"=="false" set "COMMON_ARGS=%COMMON_ARGS% --reasoning off"

if "%MODE_CHOICE%"=="1" goto :CHAT
if "%MODE_CHOICE%"=="2" goto :SERVER
echo [ERROR] Modo invalido.
pause
exit /b 1

:CHAT
echo.
echo Iniciando chat en terminal con el preset "%PRESET_NAME%"...
echo (Escribe /exit o Ctrl+C para salir)
echo.
set "LLAMA_COMPLETION_BIN=%~dp0dist\llama-completion.exe"
if not exist "%LLAMA_COMPLETION_BIN%" set "LLAMA_COMPLETION_BIN=H:\llama-b11963-bin-win-vulkan-x64\llama-completion.exe"
"%LLAMA_COMPLETION_BIN%" %COMMON_ARGS% --jinja -cnv -sys "Eres un asistente util y preciso."
goto :END

:SERVER
set "PORT=8080"
set /p "PORT= Puerto del servidor [8080]: "
if not defined PORT set "PORT=8080"
echo.
echo Iniciando servidor web en http://localhost:!PORT! ...
echo Abre tu navegador en esa direccion. Ctrl+C para detener.
echo Herramientas de agente habilitadas: read_file, file_glob_search,
echo grep_search, exec_shell_command, write_file, edit_file, get_info.
if defined LLAMA_TOOLS_ALLOWLIST echo Allowlist de binarios: !LLAMA_TOOLS_ALLOWLIST!
echo Orquestador MCP habilitado: agents_spawn_agent, agents_spawn_agents,
echo agents_list_agents.
echo ADVERTENCIA: exec_shell_command ejecuta comandos con tus permisos.
echo.
set "LLAMA_URL=http://127.0.0.1:!PORT!"
if not defined AGENT_WORKSPACE set "AGENT_WORKSPACE=%BASEDIR%Proyects"
if not defined FORK_UI set "FORK_UI=%BASEDIR%tools\ui\dist"
if not defined LLAMA_TOOLS set "LLAMA_TOOLS=all"
set "TOOLS_ARGS=--tools !LLAMA_TOOLS!"
if defined LLAMA_TOOLS_RUNTIME (
    echo Sandbox de herramientas: !LLAMA_TOOLS_RUNTIME!
    set "TOOLS_ARGS=!TOOLS_ARGS! --tools-runtime "!LLAMA_TOOLS_RUNTIME!""
)
set "UI_ARGS="
if exist "%FORK_UI%\index.html" (
    echo Interfaz: fork con modos (Planificador / Desarrollador / Orquestador)
    set "UI_ARGS=--path "%FORK_UI%""
) else (
    echo Interfaz: UI embebida (no se encontro el build del fork)
)
set "LLAMA_SERVER_BIN=H:\llama-b11963-bin-win-vulkan-x64\llama-server.exe"
if not exist "%LLAMA_SERVER_BIN%" set "LLAMA_SERVER_BIN=%~dp0dist\llama-server-fork.exe"
if not exist "%LLAMA_SERVER_BIN%" (
    echo [ERROR] No se encontro llama-server.exe
    pause
    exit /b 1
)
"%LLAMA_SERVER_BIN%" %COMMON_ARGS% --jinja !TOOLS_ARGS! --mcp-servers-config "%BASEDIR%mcp.json" --host 127.0.0.1 --port !PORT! !UI_ARGS!
goto :END

:END
popd >nul 2>nul
echo.
echo Proceso finalizado.
pause
exit /b 0