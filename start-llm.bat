@echo off
echo Starting LLM Server...
echo Make sure you have the model file in the correct location
echo.

REM Change this path to where YOUR llama.cpp is installed
cd C:\llama.cpp

REM Change this path to where YOUR model file is located
llama-server.exe -m C:\Users\jacki\Projects\nft-lending-agent\llama-3.2-3b-instruct-q4.gguf --port 8000

pause