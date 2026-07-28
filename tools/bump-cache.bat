@echo off
rem ============================================================
rem  캐시 버전 올리기 - 이 파일을 더블클릭하면 실행됩니다.
rem  모든 .html 의  ?v=25  같은 번호를 다음 번호로 한 번에 올립니다.
rem  (자세한 설명은 같은 폴더의 bump-cache.ps1 참고)
rem ============================================================
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bump-cache.ps1"
echo.
pause
