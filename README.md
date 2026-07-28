# TROUBLESHOOTER · CHARACTERS DATABASE

트러블슈터 세계관 아카이브.  
디제틱 휴대용 단말기(**TS·OS**)로 통합 데이터베이스에 접속하는 컨셉의 웹사이트입니다.  

**[Jekyll](https://jekyllrb.com/) 정적 사이트 생성기**로 빌드합니다 — 사람이 쓴 원본은
전부 `src/` 안에 있고, 빌드하면 `_site/`에 완성된 정적 사이트가 나옵니다.
결과물은 프레임워크·런타임 없는 **순수 HTML + CSS + JavaScript**입니다.

> 왜 Jekyll? 캐릭터 페이지처럼 **뼈대는 같고 데이터만 다른** 페이지가 여러 개라,
> 뼈대(레이아웃) 하나 + 데이터(front matter)로 자동 생성하기 위해서입니다.

---

## 📁 폴더 구조

> **핵심: 내가 쓰는 "원본"은 전부 `src/` 안. 루트엔 설정·결과물만.**

```
troubleshooter/
├── src/                       # ★ 모든 원본(사람이 쓴 것) — 여기 한 폴더만 보면 됨
│   ├── index.html             #   홈 "틀"(진입점). modes/ 조각을 골라 끼우는 로더
│   ├── characters.html        #   캐릭터 도감(로스터 · 마스터-디테일)
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
│   │   └── myt · meant · merely · seluka · s   (총 6명)
│   │
│   ├── _data/
│   │   └── gallery.yml        #   ★갤러리 색인(태그 목록). 그림마다 캐릭터·유형·출처·매체·작가 태그
│   │
│   ├── world/  gallery/   #   미래 섹션(현재 "준비중"). gallery/는 _data/gallery.yml을 읽어 표시
│   ├── logs/               #   익명 게시판(LOGS·교신기록) — Cusdis 위젯 임베드
│   │
│   ├── modes/                 #   ★홈 화면 "조각"(단일 출처). index.html이 골라 끼움
│   │   ├── index_pcb.html     #     PCB 모드            ← 설정 토글 O
│   │   ├── index_terminal.html#     터미널 모드(CLI)     ← 설정 토글 O
│   │   ├── index_minimal.html #     미니멀 모드          ← 프리뷰 EXTRA
│   │   └── index_orbit.html   #     Orbit 모드(3D 궤도)  ← 프리뷰 EXTRA
│   │
│   └── assets/                #   공용 자산(CSS·JS·이미지)
│       ├── css/  common.css · profile.css · transitions.css
│       ├── js/   common.js · profile.js · stage-fx.js · transitions.js
│       │         edit-core.js · editor.js  (?edit 조정 도구, 필요할 때만 로드)
│       └── img/  ui/(로고·워드마크) · deco/(배경 데코) · lineup/(도감 라인업·생성물) · lineup_raw/(라인업 원본)
│
├── _config.yml                # Jekyll 설정 (source: src → destination: _site)
├── _site/                     # 빌드 결과물(자동 생성 · .gitignore) — 지워도 됨, 다시 빌드하면 생김
├── _local/                    # 개인 자료(레퍼런스·백업 · .gitignore) — 사이트 아님
├── tools/                     # 관리 스크립트(사이트 화면과 무관)
├── README.md · .gitignore
```

> **원본 vs 결과물 구분:** `src/…/index.html`(소스)은 `---`(front matter)로 시작하고,
> `_site/…/index.html`(빌드 결과)은 `<!DOCTYPE html>`로 시작합니다. **`_site/`는 언제든 지워도** 됩니다.

---

## 🖥 로컬에서 사이트 켜는 법 (미리보기)

> **다 잊어버려도 이 순서만 그대로 따라 하면 열립니다.** 파일을 더블클릭해서 여는 게 아니라, 터미널에서 서버를 켜서 봅니다.

### 0. 최초 1회만 — 설치
Ruby + Jekyll 이 필요합니다.
- 윈도우: [RubyInstaller](https://rubyinstaller.org/) 설치 → 터미널에서 `gem install jekyll bundler`
- 확인: 터미널에 `jekyll -v` 입력 → 버전 숫자가 뜨면 준비 완료.

### 매번 — 켜는 순서
1. **터미널을 엽니다.** (윈도우: 시작 버튼 → `PowerShell` 검색 → 실행)
2. **이 프로젝트 폴더로 이동합니다.** `cd` 뒤에 이 폴더의 경로를 붙여 입력:
   ```powershell
   cd C:\projects\troubleshooter
   ```
   > ↑ 경로는 **본인 폴더 위치**로 바꾸세요. (예시일 뿐입니다.)
   > 팁: `cd ` 까지만 치고 **탐색기에서 폴더를 터미널 창으로 끌어다 놓으면** 경로가 자동으로 입력됩니다.
3. **서버를 켭니다.** 이 창은 **켜 둔 채로** 둡니다:
   ```powershell
   jekyll serve --livereload
   ```
   `Server address: http://127.0.0.1:4000/` 같은 줄이 뜨면 성공. (`--livereload` = 파일을 저장하면 브라우저가 자동 새로고침)
4. **브라우저 주소창**에 아래 주소를 입력해 봅니다:
   - 홈: `http://localhost:4000`
   - 캐릭터 예: `http://localhost:4000/characters/myt/`
   - 프로필 작성 툴: `http://localhost:4000/tools/profile-builder.html`
5. **서버 끄기**: 터미널 창에서 `Ctrl` + `C`. (jekyll 서버가 멈추고 미리보기 주소도 닫힙니다. 브라우저를 끄는 게 아니라 **터미널의 서버**를 끄는 것.)

> 한 번만 빌드하고 싶으면(서버 없이) `jekyll build` → `_site/` 에 결과물이 생깁니다.
> 로컬 서버라서 **저장소가 private이어도 로컬 확인은 100% 가능**합니다(인터넷·호스팅 불필요).

### ⚠️ 왜 그냥 파일 더블클릭은 안 되고 서버가 필요할까?
두 가지 이유입니다.
1. **원본엔 데이터만 있음** — `src/characters/*/index.html` 은 `---`(front matter)로 시작하는 **데이터+본문**일 뿐, 완성된 페이지가 아닙니다. Jekyll이 레이아웃과 합쳐 **완성 HTML로 빌드**해야 보입니다.
2. **홈은 실행 중에 다른 파일을 가져옴** — `index.html`은 틀만 있고, 실제 홈 화면(`modes/…`)을 자바스크립트가 **`fetch`로 가져와 끼웁니다.** 그런데 브라우저는 보안상 **`file://`(파일 직접 열기)에서는 `fetch`를 차단**합니다. `jekyll serve`로 `http://localhost:4000` 이라는 **진짜 주소**가 되면 허용됩니다.

> **요약:** 파일을 더블클릭(`file://`)하면 홈은 `LOAD ERROR`, 캐릭터 원본은 안 보입니다. **항상 `jekyll serve --livereload` → `http://localhost:4000` 으로 여세요.** (이미지·CSS·JS는 file://서도 되지만, `fetch`를 쓰는 홈만 서버가 꼭 필요합니다.)

---

## 🧩 캐릭터 페이지 = 레이아웃 + 데이터(front matter)

캐릭터 페이지는 **뼈대(`_layouts/character.html`) 한 곳 + 페이지별 데이터**로 자동 조립됩니다.
그래서 `src/characters/<이름>/index.html` 은 **데이터 + 본문만** 담습니다:

```yaml
---
layout: character
accent: "#bfc7d4"                 # 캐릭터 색 — 이것만 정하면 나머지 색은 profile.css가 파생
art: "vector_full.png"            # 무대 초기 일러
art_alt: "벡스터"
root: { "art-h": "100%" }         # (선택) 페이지별 :root 변수(일러 크기·위치 기본값)
meta: { title: "VECTOR", record: "M-01", crumb: "VECTOR", sector: "HQ · SECTOR 1", code: "VECTOR", id: "TS-M01" }
stats: []                         # 능력치 [["신체강도", 4], …] (비면 빈 배열)
wardrobe:                         # 옷장 슬롯(profile.js가 생성). on=시작 의상
  - { cap: "후드", img: "" }
  - { cap: "정장", img: "vector_full.png", "on": true, arth: "93.5%", shiftx: "12.5%", shift: "-2.3%" }
generations:                      # 세대(1·2·3세대). main=현재 실제 프로필, 나머지=플레이스홀더
  current: "3"
  items:
    - { id: "1", label: "1세대", sub: "ORIGIN", img: "" }
    - { id: "3", label: "3세대", sub: "HEIR", img: "vector_full.png", main: true, effect: ["film", { fx: "decode" }] }
---
<!-- 여기 아래 = 우측 정보(.file) 본문 = 캐릭터 내용(이름·사원증·서술 등) -->
```

- **뼈대(상단바·프레임·스크립트)를 고치려면** `_layouts/character.html` **한 곳**만 고치면 6명 전부 반영됩니다.
- 상단바의 레코드번호·크럼·ID 등은 `meta`에서 자동 주입(`profile.js`).
- ⚠️ **YAML 주의**: `on:`·색값(`#…`)·`%`값은 **반드시 따옴표**(`"on": true`, `"#bfc7d4"`). `on`은 YAML 예약어라 안 감싸면 깨집니다.
- **새 캐릭터 추가** = `characters/새이름/index.html`(front matter+본문) + 이미지. 뼈대는 재사용.

---

## 🎭 무대 뒤 능력 연출 (`stage-fx.js`) + 세대 전환

- 무대 효과는 **`TSFX` 컨트롤러**가 `CHAR_GENERATIONS`의 `effect`를 읽어 캔버스를 동적 생성·재생합니다(`profile.js`가 자동 장착).
- 효과 종류: `film`(벡스터·필름) · `decode`(벡스터 순간효과) · `ecg`(마이티·심박) · `crack`(민트·균열) · `snow`(셀루카·눈) · `glitch`(S·글리치) · `recall`(메릴리·기억).
  - 조합·순간효과·색 지정 가능: `["film", { fx: "decode" }]`, `[{ fx: "glitch", color: "#5ec8dd" }]`.
- **세대 전환**: 세대가 2개 이상이면 상단에 타임라인이 자동으로 뜹니다. 세대를 바꾸면
  **그림·효과·색·우측 패널·무대 뒤 코드명(bg-type)** 이 통째로 교체됩니다(이미지 없는 세대는 "준비중" 플레이스홀더 + 효과 숨김).
- 새 효과 추가 = `stage-fx.js`의 `FX`/`INIT`에 함수 하나 + `FX_LAYERS`에 한 줄.

---

## 🧍 일러 크기·위치 맞추기 (`?edit` 조정 도구)

원화마다 캔버스·구도가 달라 무대 위 일러 크기·위치를 캐릭터/의상별로 맞춰야 합니다.
**주소 뒤에 `?edit`** 만 붙이면 드래그로 맞추는 패널이 뜹니다.

1. `jekyll serve`로 캐릭터 페이지를 연 뒤 주소 끝에 **`?edit`** → 예: `http://localhost:4000/characters/merely/?edit`
2. 좌하단 조정 패널에서 편집 박스를 끌어 이동 · 모서리로 크기(슬라이더·수치도 가능). **일러/실루엣** 레이어 전환.
3. 옷장에서 조정할 의상을 클릭하면 그 의상 값으로 바뀝니다.
4. **드래그하면 이 브라우저(localStorage)에 자동 저장** — 새로고침해도 유지(임시 미리보기용).
5. **굳혀서 배포하려면 [💾 코드에 적용]** → 파일 선택(그 캐릭터의 **`src/` 원본** `index.html`) 후,
   **front matter의 `wardrobe` 항목**에 크기·위치값을 자동으로 써넣습니다.

> · `?edit` 없으면 패널은 안 뜨니 실제 방문자엔 영향 없습니다.
> · 편집기 = `assets/js/editor.js`(+`edit-core.js`), 적용 대상 = **front matter의 wardrobe**(옛 HTML data-* 아님).

---

## 📏 도감 라인업 이미지 (`tools/build-lineup.py`)

도감(`characters.html`) 상세 패널의 **키 비교 라인업 이미지**는 손으로 만들지 않고 스크립트가 생성합니다.
원본을 **실제 키(cm) 비율로 리사이즈 + 발을 공통 바닥선에 정렬**해, 여러 캐릭터를 같은 화면에서 정확히 비교할 수 있게 합니다.

```
lineup_raw/<이름>.png   →   [build-lineup.py]   →   lineup/<이름>.png
(원본, 내가 교체)              (키 정규화·바닥 정렬)      (생성물, 손 안 댐)
```

- **원본**: `src/assets/img/lineup_raw/<이름>.png`  ← 여기만 교체
- **생성물**: `src/assets/img/lineup/<이름>.png`  ← 스크립트가 덮어씀 (직접 편집 금지)
- **실행**: 프로젝트 **루트**에서 `python tools/build-lineup.py` (Pillow 필요: `pip install pillow`)

**라인업 일러를 바꾸려면**
1. `lineup_raw/<이름>.png` 를 새 "서 있는" 일러로 덮어쓰기
2. `python tools/build-lineup.py` 실행 → `lineup/<이름>.png` 자동 재생성
3. 새로고침(`Ctrl`+`Shift`+`R`)

**새 캐릭터를 라인업에 추가하려면**
1. `lineup_raw/<새이름>.png` 추가
2. `build-lineup.py` 의 키 표 `CM` 에 한 줄 추가 — 예: `'newchar': 178`
3. 원본이 서 있는 포즈가 아니면 `SRC_OVERRIDE` 에 다른 소스 지정 (현재 `s` 가 예시 — 점프 포즈라 정장 전신으로 교체)
4. `python tools/build-lineup.py` 실행
5. 도감 로스터(`characters.html`)와 `characters/<새이름>/` 프로필도 추가

> 스크립트 없이 `lineup/` 에 PNG를 직접 넣으면 **키 비율·바닥선이 안 맞아** 비교가 틀어집니다 — 그 정렬이 스크립트의 존재 이유입니다.

---

## 🖼 갤러리 (준비 중)

캐릭터 그림/영상/글은 **파일은 캐릭터별 폴더, 정보는 태그**로 분리합니다.

- **그림 파일** → `characters/<이름>/gallery/` (여러 캐릭터·무소속은 `gallery/etc/`)
- **태그 색인** → `src/_data/gallery.yml` — 그림마다 `chars`(캐릭터)·`type`(유형)·`source`(공식/커미션/팬아트)·`kind`(이미지/영상/글)·`artist`·`date` 태그
- **보는 페이지** → `gallery/index.html` (색인을 읽어 태그 필터 — 구현 예정)

새 그림 추가 = 파일을 캐릭터 폴더에 넣고 `_data/gallery.yml` 에 항목 한 덩어리 추가. (페이지 코드는 안 건드림)

---

## 🎨 디자인 · 색

- **공통 디자인(팔레트·프레임)** → `assets/css/common.css` 한 곳. **캐릭터 프로필 공통** → `profile.css`.
- **캐릭터 색** → 각 페이지 front matter의 `accent` 한 줄만 정하면 나머지 색은 `profile.css`가 파생.
- **다크/라이트** → 우상단 ◐ 버튼.
- **페이지 전환** → 링크에 `data-ts="accesslog"`(또는 `fade`) 속성. 모듈 = `assets/js/transitions.js`.

---

## 🔄 캐시 버전 (`?v=`)

브라우저가 CSS/JS를 캐시하므로, `assets/` 파일을 고치면 뒤의 **버전 번호**(`common.css?v=1` 등)를 올려야
방문자가 새 파일을 받습니다. 현재 버전: `common.css v1` · `profile.css v7` · `transitions.css v1` ·
`common.js v4` · `profile.js v11` · `stage-fx.js v38` · `transitions.js v2`.

- **개발 중** → 번호 안 올려도 `jekyll serve` 재빌드 + 브라우저 **`Ctrl`+`Shift`+`R`**.
- **배포 전** → 고친 파일의 `?v=` 를 올려주세요(참조하는 모든 `.html`/레이아웃에서 동일하게). `tools/`의 bump 스크립트는 `src/` 기준으로 손봐야 할 수 있습니다.

---

## 🚀 배포 (GitHub Pages)

- GitHub Pages는 **Jekyll을 자동 빌드**합니다 — 저장소를 올리고 **Settings → Pages**에서 브랜치를 지정하면 게시됩니다(로컬에서 별도 빌드 불필요).
- **private 저장소**를 GitHub Pages로 **공개 호스팅**하려면 보통 **유료 플랜**이 필요합니다(또는 public으로 전환). *로컬 미리보기(`jekyll serve`)는 이와 무관하게 항상 가능*합니다.

---

