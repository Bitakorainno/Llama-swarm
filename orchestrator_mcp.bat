@echo off
setlocal
rem Portable launcher for the orchestrator MCP server.
rem Set AGENT_PYTHON to an absolute python.exe to force an interpreter.

set "SCRIPT=%~dp0tools\orchestrator_mcp.py"
if not exist "%SCRIPT%" set "SCRIPT=%~dp0orchestrator_mcp.py"

if defined AGENT_PYTHON (
    "%AGENT_PYTHON%" "%SCRIPT%" %*
    exit /b
)

where py >nul 2>nul
if not errorlevel 1 (
    py -3 "%SCRIPT%" %*
    exit /b
)

python "%SCRIPT%" %*
exit /b
