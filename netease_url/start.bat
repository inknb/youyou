@echo off
rem 网易云音乐解析服务启动脚本（需先配置 cookie.txt）
chcp 65001 >nul
title 网易云音乐解析服务 (port 5000)
cd /d %~dp0
python main.py
pause
