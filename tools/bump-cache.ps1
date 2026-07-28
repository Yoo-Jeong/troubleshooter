# ============================================================
#  캐시 버전 올리기 (bump-cache)
#  ------------------------------------------------------------
#  하는 일: 모든 .html 안의  ?v=25  같은 캐시 번호를 찾아
#           다음 번호(예: 25 -> 26)로 "한 번에" 전부 올립니다.
#
#  왜 필요? CSS/JS(assets/)를 고친 뒤 이 번호를 올려야
#           방문자 브라우저가 "옛날 파일"이 아닌 "새 파일"을 읽습니다.
#
#  언제 실행? 깃허브에 올리기(배포) 직전에 한 번.
#           (개발 중에는 브라우저에서 Ctrl+Shift+R 로도 충분)
#
#  실행법: 같은 폴더의  bump-cache.bat  을 더블클릭.
#          (또는 PowerShell 에서  powershell -File tools\bump-cache.ps1 )
# ============================================================

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# 프로젝트 루트 = 이 스크립트가 든 tools/ 폴더의 부모
$root = Split-Path -Parent $PSScriptRoot

# _local, .git 을 뺀 모든 .html 수집
$files = Get-ChildItem -Path $root -Recurse -Filter *.html -File |
  Where-Object { $_.FullName -notmatch '\\(_local|\.git)\\' }

# 1) 현재 가장 큰 버전 번호 찾기
$cur = 0
foreach ($f in $files) {
  $txt = [System.IO.File]::ReadAllText($f.FullName)
  foreach ($m in [regex]::Matches($txt, '\?v=(\d+)')) {
    $n = [int]$m.Groups[1].Value
    if ($n -gt $cur) { $cur = $n }
  }
}

if ($cur -eq 0) {
  Write-Host "!! '?v=' 캐시 번호를 찾지 못했습니다. 바꿀 게 없습니다."
  return
}

# 2) 다음 번호로 모든 파일 일괄 교체 (한글 보존 위해 BOM 없는 UTF-8 로 저장)
$new = $cur + 1
$enc = New-Object System.Text.UTF8Encoding($false)
$changed = 0

foreach ($f in $files) {
  $txt = [System.IO.File]::ReadAllText($f.FullName)
  $out = [regex]::Replace($txt, '\?v=\d+', "?v=$new")
  if ($out -ne $txt) {
    [System.IO.File]::WriteAllText($f.FullName, $out, $enc)
    Write-Host ("  갱신: " + $f.FullName.Substring($root.Length + 1))
    $changed++
  }
}

Write-Host ""
Write-Host ("완료 · 캐시 버전  v$cur  ->  v$new   (파일 $changed 개)")
Write-Host "이제 깃허브에 올리면 방문자가 새 CSS/JS 를 읽습니다."
