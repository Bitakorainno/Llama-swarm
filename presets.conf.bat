@echo off
REM =========================================================
REM CONFIGURACIÓN DE PERFILES (PRESETS) FAVORITOS
REM =========================================================
REM Para agregar uno nuevo, copia un bloque y cambia el numero (ej: PRESET_4).
REM Asegurate de cambiar tambien "PRESET_COUNT" al total de presets que tengas.

set "PRESET_COUNT=5"

set "PRESET_COUNT=5"
set "PRESET_1_NAME=Coder"
set "PRESET_1_CTX=24576"
set "PRESET_1_NPRED=4096"
set "PRESET_1_TEMPERATURE=0.7"
set "PRESET_1_TOPP=0.9"
set "PRESET_1_REP=1.1"
set "PRESET_1_REASONING=auto"
set "PRESET_1_REASONING_BUDGET=256"
set "PRESET_1_THINKING=true"

set "PRESET_2_NAME=LFM2 Thinking"
set "PRESET_2_CTX=24576"
set "PRESET_2_NPRED=8192"
set "PRESET_2_TEMPERATURE=0.2"
set "PRESET_2_TOPP=0.85"
set "PRESET_2_REP=1.1"
set "PRESET_2_REASONING=auto"
set "PRESET_2_REASONING_BUDGET=512"
set "PRESET_2_THINKING=true"

set "PRESET_3_NAME=Chat General"
set "PRESET_3_CTX=24576"
set "PRESET_3_NPRED=4096"
set "PRESET_3_TEMPERATURE=0.7"
set "PRESET_3_TOPP=0.9"
set "PRESET_3_REP=1.1"
set "PRESET_3_REASONING=auto"
set "PRESET_3_REASONING_BUDGET=256"
set "PRESET_3_THINKING=true"

set "PRESET_4_NAME=Creativo"
set "PRESET_4_CTX=24576"
set "PRESET_4_NPRED=4096"
set "PRESET_4_TEMPERATURE=0.8"
set "PRESET_4_TOPP=0.95"
set "PRESET_4_REP=1.0"
set "PRESET_4_REASONING=auto"
set "PRESET_4_REASONING_BUDGET=256"
set "PRESET_4_THINKING=true"

set "PRESET_5_NAME=Rapido"
set "PRESET_5_CTX=24576"
set "PRESET_5_NPRED=2048"
set "PRESET_5_TEMPERATURE=0.7"
set "PRESET_5_TOPP=0.9"
set "PRESET_5_REP=1.1"
set "PRESET_5_REASONING=off"
set "PRESET_5_REASONING_BUDGET=0"
set "PRESET_5_THINKING=false"

REM =========================================================
REM No toques nada debajo de esta linea
goto :eof
