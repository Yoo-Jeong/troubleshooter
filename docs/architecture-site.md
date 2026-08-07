# 사이트 참고자료 (폴더 구조, 디자인, 캐시 버전)

[← README로 돌아가기](../README.md)

특정 페이지 하나에 속하지 않는, 사이트 전체에 걸친 참고 정보를 모아둔 문서입니다.

---

## 📁 폴더 구조 (전체)

> **핵심: 내가 쓰는 원본은 전부 `src/` 안에 있습니다. 루트에는 설정과 결과물만 있습니다.**

```
troubleshooter/
├── src/                       # ★ 모든 원본(사람이 쓴 것), 여기 한 폴더만 보면 됨
│   ├── index.html             #   홈 "틀"(진입점), modes/ 조각을 골라 끼우는 로더
│   ├── characters.html        #   캐릭터 도감(로스터, 마스터-디테일)
│   ├── display_preview.html   #   홈 디스플레이 모드 프리뷰(4종 비교)
│   ├── transitions_preview.html #  화면 전환 프리뷰
│   │
│   ├── _layouts/
│   │   └── character.html     #   ★캐릭터 페이지 공통 뼈대(딱 한 곳). 데이터를 끼워 완성 HTML 생성
│   │
│   ├── characters/            #   ★캐릭터 개별 프로필 (URL = /characters/<이름>/)
│   │   ├── vector/
│   │   │   ├── index.html     #     front matter(데이터) + .file 본문만. 뼈대는 레이아웃 재사용
│   │   │   ├── vector_full.png#     전신 일러(프로필 무대). 의상별 _suit.png 등 추가 가능
│   │   │   ├── vector_id.jpeg #     사원증
│   │   │   └── gallery/       #     이 캐릭터 갤러리 그림 파일 (sd_01.png 등)
│   │   └── myt, meant, merely, seluka, s   (총 6명)
│   │
│   ├── _data/
│   │   └── gallery.yml        #   (레거시, 미사용) 갤러리 초기 설계 시 만든 태그 색인. 실제 갤러리는 gallery-data.js를 씀
│   │
│   ├── world/               #   미래 섹션(현재 준비중 안내 화면만)
│   ├── gallery/             #   그림/글 모아보기. 그리드와 라이트박스(완성). 데이터는 assets/js/gallery-data.js
│   ├── logs/               #   익명 게시판(LOGS·교신기록). Cusdis 위젯 임베드
│   │
│   ├── modes/                 #   ★홈 화면 "조각"(단일 출처). index.html이 골라 끼움
│   │   ├── index_pcb.html     #     PCB 모드            ← 설정 토글 O
│   │   ├── index_terminal.html#     터미널 모드(CLI)     ← 설정 토글 O
│   │   ├── index_minimal.html #     미니멀 모드          ← 프리뷰 EXTRA
│   │   └── index_orbit.html   #     Orbit 모드(3D 궤도)  ← 프리뷰 EXTRA
│   │
│   ├── tools/
│   │   ├── profile-builder.html #  ★비개발자용 캐릭터 프로필 작성 폼(코드 몰라도 사용 가능)
│   │   └── profile-builder.css, profile-builder-*.js(6개)  # 파일 구성은 architecture-profile-builder.md 참고
│   │
│   └── assets/                #   공용 자산(CSS, JS, 이미지)
│       ├── css/  common.css, profile.css, transitions.css
│       ├── js/   common.js, profile.js, profile-generations.js, profile-ui.js
│       │         (프로필 3파일, 자세히는 architecture-character-pages.md)
│       │         stage-fx.js, transitions.js, motion.js(모션 감소 옵션)
│       │         gallery-data.js(★갤러리 그림 목록 단일 출처), cusdis-config.js(LOGS 위젯 설정)
│       │         list-editor.js, edit-core.js, editor.js (?edit 조정 도구, 필요할 때만 로드)
│       └── img/  ui/(로고, 워드마크), deco/(배경 데코), gallery/(갤러리 원본 이미지)
│                 lineup/(도감 라인업, 생성물), lineup_raw/(라인업 원본)
│
├── .github/workflows/pages.yml # GitHub Actions 배포 워크플로 (main에 push되면 자동 빌드, 배포)
├── _config.yml                # Jekyll 설정 (source: src → destination: _site)
├── _site/                     # 빌드 결과물(자동 생성, .gitignore). 지워도 됨, 다시 빌드하면 생김
├── _local/                    # 개인 자료(레퍼런스, 백업, .gitignore). 사이트 아님
├── docs/                      # 이 문서들(유지보수자용 심화 자료)
├── tools/                     # 관리 스크립트(사이트 화면과 무관, 터미널에서 실행)
│   ├── build-lineup.py        #   도감 라인업 이미지 생성
│   ├── bump-cache.ps1         #   ?v= 캐시 버전 일괄 올리기(PowerShell)
│   └── bump-cache.bat         #   위와 같은 기능(cmd)
├── README.md, .gitignore
```

> **원본과 결과물 구분:** `src/…/index.html`(소스)은 `---`(front matter)로 시작하고,  
> `_site/…/index.html`(빌드 결과)은 `<!DOCTYPE html>`로 시작합니다.  
> `_site/`는 언제든 지워도 됩니다.

---

## 🎨 디자인과 색

- **공통 디자인(팔레트, 프레임)** → `assets/css/common.css` 한 곳.
- **캐릭터 프로필 공통** → `profile.css`.
- **캐릭터 색** → 각 페이지 front matter의 `accent` 한 줄만 정하면 나머지 색은 `profile.css`가 파생합니다.
- **다크/라이트** → 우상단 ◐ 버튼.
- **페이지 전환** → 링크에 `data-ts="accesslog"`(또는 `fade`) 속성. 모듈은 `assets/js/transitions.js`.

---

## 🔄 캐시 버전 (`?v=`)

브라우저가 CSS/JS를 캐시하기 때문에, `assets/` 파일을 고치면 뒤의 버전 번호(`common.css?v=1` 등)를 올려야 방문자가 새 파일을 받습니다.

정확한 현재 번호는 `src/_layouts/character.html`의 `?v=`를 보는 게 가장 확실합니다.  
이 문서는 사람이 손으로 갱신하는 거라 번호가 늦게 반영될 수 있습니다.

이 문서를 마지막으로 손본 시점 기준입니다:

| 파일 | 버전 |
|---|---|
| `common.css` | v2 |
| `profile.css` | v47 |
| `transitions.css` | v1 |
| `common.js` | v7 |
| `profile.js` | v33 |
| `profile-generations.js` | v1 |
| `profile-ui.js` | v1 |
| `stage-fx.js` | v130 |
| `transitions.js` | v3 |
| `motion.js` | v3 |
| `gallery-data.js` | v1 |

- **개발 중** → 번호 안 올려도 `jekyll serve` 재빌드에 브라우저에서 `Ctrl`+`Shift`+`R`이면 충분합니다.
- **배포 전** → 고친 파일의 `?v=`를 올려주세요. 참조하는 곳이 여러 군데일 수 있습니다.  
  예를 들어 `profile.css`, `stage-fx.js`는 실제 캐릭터 레이아웃(`_layouts/character.html`) 말고도 프로필 작성 툴의 미리보기(`buildSrcdoc()` 등)에서도 따로 불러옵니다.  
  그곳도 같이 올려야 툴 미리보기에서도 최신 버전이 반영됩니다.
- `tools/bump-cache.ps1`(또는 더블클릭용 `.bat`)을 실행하면 모든 `.html`의 모든 `?v=` 번호를 한 번에 같은 새 번호로 맞춰줍니다.  
  파일마다 각자 다른 번호를 매기고 싶다면 지금처럼 쓰지 말고 해당 줄만 직접 올리세요.
