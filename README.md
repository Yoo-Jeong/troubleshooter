# TROUBLESHOOTER · CHARACTERS DATABASE

트러블슈터 세계관 아카이브.  
디제틱 휴대용 단말기(**TS·OS**)로 통합 데이터베이스에 접속하는 컨셉의 웹사이트입니다.  

**[Jekyll](https://jekyllrb.com/) 정적 사이트 생성기**로 빌드합니다 — 사람이 쓴 원본은
전부 `src/` 안에 있고, 빌드하면 `_site/`에 완성된 정적 사이트가 나옵니다.
결과물은 프레임워크·런타임 없는 **순수 HTML + CSS + JavaScript**입니다.

> 왜 Jekyll? 캐릭터 페이지처럼 **뼈대는 같고 데이터만 다른** 페이지가 여러 개라,
> 뼈대(레이아웃) 하나 + 데이터(front matter)로 자동 생성하기 위해서입니다.

---

## 💻 다른 컴퓨터에서 이어가기

이 저장소는 GitHub(`origin`)에 올라가 있으므로, 다른 컴퓨터에서도 그대로 이어서 작업할 수 있습니다.

1. **처음 받는 컴퓨터**라면 터미널에서:
   ```powershell
   git clone https://github.com/Yoo-Jeong/troubleshooter.git
   cd troubleshooter
   ```
2. **이미 클론해둔 컴퓨터**로 돌아왔다면 최신 내용만 받으면 됩니다:
   ```powershell
   git pull
   ```
3. 아래 [🖥 로컬에서 사이트 켜는 법](#-로컬에서-사이트-켜는-법-미리보기)대로 Ruby + Jekyll을 설치(최초 1회, 컴퓨터마다)하고 `jekyll serve --livereload`로 켜서 확인합니다.
4. 작업이 끝나면 그 컴퓨터에서 직접 `git add` / `git commit` / `git push`로 GitHub에 올려야, 다른 컴퓨터에서 `git pull` 했을 때 받아집니다. (Claude는 git 작업을 대신 실행하지 않습니다 — 항상 사용자가 직접.)

> ⚠️ **AI(Claude)와의 이전 대화 기억은 계정별로 저장돼 있어 컴퓨터/계정을 옮기면 따라오지 않습니다.**
> 대신 이 저장소 안의 **`CLAUDE.md`**(에이전트가 매 세션 읽는 작업 규칙·최근 작업 요약)와 **`README.md`**(지금 이 파일)가
> git으로 어디든 함께 이동하는 **진짜 인수인계 문서**입니다. 큰 작업을 마쳤다면 이 두 파일도 최신 상태로 갱신해두는 것이 좋습니다.

---

## 🌿 브랜치 운영

`main`은 [🚀 배포](#-배포-github-pages)에서 보듯 **push되는 순간 실제 사이트에 반영되는 브랜치**입니다.
그래서 평소 작업은 `main`에 바로 하지 않고 **`dev`(개발) 브랜치**에서 하다가, 방문자에게 보여줘도 될 만큼 정리됐을 때만 `main`으로 옮기는 방식을 권장합니다.

**평소 작업 흐름**
1. `dev` 브랜치에서 작업하고 그대로 `git commit` (필요하면 `git push origin dev`로 원격에도 백업 — `dev`에 push해도 배포 워크플로는 `main`만 보므로 사이트에는 아무 영향 없음).
2. 미완성·실험적인 내용이 섞여 있어도 상관없음 — 방문자는 `main`만 보게 되는 배포된 사이트만 보니까요.

**공개(배포)하고 싶을 때**
1. `dev`가 정리된 상태인지 확인(로컬에서 `jekyll serve`로 미리보기 확인).
2. `main`으로 옮기는 방법은 둘 중 편한 쪽으로:
   - **간단하게(로컬에서 병합)**: `git checkout main` → `git merge dev` → `git push` (이 push가 배포를 트리거함)
   - **기록을 남기며(GitHub PR)**: GitHub에서 `dev` → `main` Pull Request를 만들고 병합 — 무엇을 언제 공개했는지 이력이 GitHub에 남아, 나중에 "그때 뭘 올렸었지" 되짚기 편함. `main` merge 자체가 곧 배포이므로 CI 통과를 기다리는 절차는 따로 없음.

**처음 한 번만 — `dev` 브랜치 만들기** (지금 저장소엔 아직 `main` 하나뿐)
```powershell
git checkout -b dev
git push -u origin dev
```
이후로는 `git checkout dev`로 돌아와 평소처럼 작업하면 됩니다.

> 💡 (선택) GitHub 저장소 **Settings → Branches**에서 `main`에 **Pull Request 필수** 규칙(branch protection)을 걸어두면, `main`에 실수로 직접 push하는 상황 자체를 막을 수 있습니다. 지금처럼 혼자 작업할 땐 없어도 무방하지만, 나중에 다른 사람과 같이 작업하게 되면 유용합니다.
> 💡 Claude는 이 규칙대로 **`dev`에서 로컬 커밋까지는 돕더라도, `main`으로의 병합·push나 원격 브랜치 생성 같은 GitHub에 흔적이 남는 작업은 항상 사용자가 직접** 하는 걸 원칙으로 합니다.

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
│   │   └── gallery.yml        #   (레거시·미사용) 갤러리 초기 설계 시 만든 태그 색인. 실제 갤러리는 gallery-data.js를 씀
│   │
│   ├── world/               #   미래 섹션(현재 "준비중" 안내 화면만)
│   ├── gallery/             #   그림/글 모아보기 — 그리드 + 라이트박스(완성). 데이터는 assets/js/gallery-data.js
│   ├── logs/               #   익명 게시판(LOGS·교신기록) — Cusdis 위젯 임베드
│   │
│   ├── modes/                 #   ★홈 화면 "조각"(단일 출처). index.html이 골라 끼움
│   │   ├── index_pcb.html     #     PCB 모드            ← 설정 토글 O
│   │   ├── index_terminal.html#     터미널 모드(CLI)     ← 설정 토글 O
│   │   ├── index_minimal.html #     미니멀 모드          ← 프리뷰 EXTRA
│   │   └── index_orbit.html   #     Orbit 모드(3D 궤도)  ← 프리뷰 EXTRA
│   │
│   ├── tools/
│   │   └── profile-builder.html #  ★비개발자용 캐릭터 프로필 작성 폼(코드 몰라도 사용 가능). 자세히↓
│   │
│   └── assets/                #   공용 자산(CSS·JS·이미지)
│       ├── css/  common.css · profile.css · transitions.css
│       ├── js/   common.js · profile.js · stage-fx.js · transitions.js · motion.js(모션 감소 옵션)
│       │         gallery-data.js(★갤러리 그림 목록 단일 출처) · cusdis-config.js(LOGS 위젯 설정) · list-editor.js
│       │         edit-core.js · editor.js  (?edit 조정 도구, 필요할 때만 로드)
│       └── img/  ui/(로고·워드마크) · deco/(배경 데코) · gallery/(갤러리 원본 이미지)
│                 lineup/(도감 라인업·생성물) · lineup_raw/(라인업 원본)
│
├── .github/workflows/pages.yml # GitHub Actions 배포 워크플로 (main에 push되면 자동 빌드·배포)
├── _config.yml                # Jekyll 설정 (source: src → destination: _site)
├── _site/                     # 빌드 결과물(자동 생성 · .gitignore) — 지워도 됨, 다시 빌드하면 생김
├── _local/                    # 개인 자료(레퍼런스·백업 · .gitignore) — 사이트 아님
├── tools/                     # 관리 스크립트(사이트 화면과 무관, 터미널에서 실행)
│   ├── build-lineup.py        #   도감 라인업 이미지 생성(아래 별도 섹션)
│   ├── bump-cache.ps1         #   ?v= 캐시 버전 일괄 올리기(PowerShell)
│   └── bump-cache.bat         #   위와 같은 기능(cmd)
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
    - { id: "3", label: "3세대", sub: "HEIR", img: "vector_full.png", main: true, effect: [{ fx: "film", place: "back" }, { fx: "decode", place: "back" }, { fx: "decode", place: "front" }] }
---
<!-- 여기 아래 = 우측 정보(.file) 본문 = 캐릭터 내용(이름·사원증·서술 등) -->
```

- **뼈대(상단바·프레임·스크립트)를 고치려면** `_layouts/character.html` **한 곳**만 고치면 6명 전부 반영됩니다.
- 상단바의 레코드번호·크럼·ID 등은 `meta`에서 자동 주입(`profile.js`).
- ⚠️ **YAML 주의**: `on:`·색값(`#…`)·`%`값은 **반드시 따옴표**(`"on": true`, `"#bfc7d4"`). `on`은 YAML 예약어라 안 감싸면 깨집니다.
- **새 캐릭터 추가** = `characters/새이름/index.html`(front matter+본문) + 이미지. 뼈대는 재사용.

> 💡 front matter를 손으로 직접 안 쓰고 폼으로 채워서 만들고 싶다면 아래 [🧰 프로필 작성 툴](#-프로필-작성-툴-비개발자용) 참고.

---

## 🧰 프로필 작성 툴 (비개발자용)

`src/tools/profile-builder.html` — **코드·페이지 구조를 몰라도** 새 캐릭터 프로필을 만들거나 기존 프로필을 고칠 수 있는 폼입니다.
이름·소속·능력치·서술·이미지 등을 폼에 입력하면 오른쪽에 **실제 페이지와 거의 동일한 실시간 미리보기**가 뜨고,
완성하면 `src/characters/<이름>/index.html`에 들어갈 코드를 만들어줍니다.

1. `jekyll serve`로 켠 뒤 `http://localhost:4000/tools/profile-builder.html` 접속(또는 `file://`로 그냥 더블클릭해도 폼 자체는 열립니다 — 상단에 안내 문구가 뜸).
2. 폼을 채우면 오른쪽 미리보기가 바로 갱신됩니다. 서술/확장 카드는 미리보기 안에서 직접 클릭해 노션처럼 편집도 가능.
3. 무대 효과(아래 섹션)도 이 툴의 **효과 고르기 갤러리**에서 실제로 움직이는 미리보기를 보면서 골라 쌓을 수 있어, `stage-fx.js` 코드를 몰라도 조합할 수 있습니다.
4. 완성 후 두 가지 중 하나:
   - **💾 저장** — 이 컴퓨터에 사이트 폴더가 있는 관리자용. 대상 `index.html` 파일을 골라 자동으로 써넣습니다.
   - **📤 제출** — GitHub 계정이 없는 동맹원용. 디스코드 웹훅으로 관리자에게 전송, 관리자가 검토 후 반영합니다.

> 도감 라인업용 전신 이미지 정규화도 이 툴에서 같이 할 수 있습니다(아래 [📏 도감 라인업 이미지](#-도감-라인업-이미지-toolsbuild-lineuppy) 참고).

---

## 🎭 무대 뒤 능력 연출 (`stage-fx.js`) + 세대 전환

- 무대 효과는 **`TSFX` 컨트롤러**가 각 세대 항목의 `effect`를 읽어 캔버스를 동적 생성·재생합니다(`profile.js`가 자동 장착).
- **효과 하나 = 그림함수 하나.** `effect:`는 그 효과들을 **레이어로 쌓은 배열**입니다 — 각 레이어가 `{ fx: "효과이름", place: "back" | "front" }`로 캐릭터 그림 **뒤**에 그릴지 **앞**에 그릴지 정하고, 같은 면에 여러 개를 쌓을 수도 있습니다.
  ```yaml
  effect: [{ fx: "film", place: "back" }, { fx: "decode", place: "back" }, { fx: "decode", place: "front" }]
  ```
  - 효과 수가 60종 이상으로 많아 이 문서엔 전부 나열하지 않습니다 — 목록은 **프로필 작성 툴의 효과 고르기 갤러리**(실제로 움직이는 미리보기 포함)가 최신 상태의 유일한 출처입니다.
  - 자주 같이 쓰는 앞/뒤 조합은 **세트(PRESETS)** 로 미리 묶여 있어(균열·데이터 스트림·기록 스캔 등) 이름 하나만 써도 앞뒤 레이어가 자동으로 펼쳐집니다: `effect: ["crack"]`.
  - `glitch`처럼 화면 전체를 장악하는 연출은 `kind:'takeover'`로 표시돼 있고, 이런 효과는 항상 맨 앞에 고정됩니다(뒤로 지정해도 자동으로 앞).
- **세대 전환**: 세대가 2개 이상이면 상단에 타임라인이 자동으로 뜹니다. 세대를 바꾸면
  **그림·효과·색·우측 패널·무대 뒤 코드명** 이 통째로 교체됩니다(이미지 없는 세대는 "준비중" 플레이스홀더 + 효과 숨김).
- 방문자는 무대 우상단 `FX ON`/`FX OFF` 버튼으로 이 효과들을 껐다 켤 수 있습니다(브라우저에 기억, 기본은 켜짐).
- 새 효과 추가 = `stage-fx.js`의 `FX`(그림함수)·`INIT`(초깃값)에 하나씩 + `EFFECTS`에 한 줄 → 프로필 작성 툴 갤러리에 자동으로 나타납니다.

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

## 🖼 갤러리

`gallery/index.html` — 그림/글을 **그리드로 모아보고 클릭하면 라이트박스(전체화면 확대)** 로 보는 화면입니다.

- **데이터 단일 출처** → `assets/js/gallery-data.js` 의 `window.GALLERY_ITEMS` 배열 하나. 이 갤러리 화면과 홈 화면(GALLERY 노드의 "N RECORDS" 표시)이 같이 봅니다 — 항목을 추가/삭제하면 두 화면 모두 자동으로 반영됩니다.
- **그림 원본 파일** → `assets/img/gallery/`
- **두 가지 종류**:
  - **그림**(`type` 없음 또는 `'art'`) — 클릭하면 라이트박스로 원본 확대.
  - **글/연성**(`type:'fic'` + `url`) — 표지 그림은 여전히 필수. 클릭하면 그림과 똑같이 먼저 라이트박스(표지+정보)가 뜨고, 그 안의 "원문 보러가기 ↗" 버튼을 눌러야 `url`이 새 탭으로 열립니다(바로 이동 안 함).

새 항목 추가 = 이미지를 `assets/img/gallery/`에 넣고 `gallery-data.js`의 배열에 `{ }` 항목 하나 복사해 값만 채우면 끝(파일 상단 한글 주석에 필드 설명 있음). 날짜순 자동 정렬이라 순서를 직접 맞출 필요 없습니다.

> `_data/gallery.yml`은 갤러리 초기 설계 때 만든 파일로 지금은 어디서도 읽지 않는 레거시입니다(정리 예정).

---

## 🎨 디자인 · 색

- **공통 디자인(팔레트·프레임)** → `assets/css/common.css` 한 곳. **캐릭터 프로필 공통** → `profile.css`.
- **캐릭터 색** → 각 페이지 front matter의 `accent` 한 줄만 정하면 나머지 색은 `profile.css`가 파생.
- **다크/라이트** → 우상단 ◐ 버튼.
- **페이지 전환** → 링크에 `data-ts="accesslog"`(또는 `fade`) 속성. 모듈 = `assets/js/transitions.js`.

---

## 🔄 캐시 버전 (`?v=`)

브라우저가 CSS/JS를 캐시하므로, `assets/` 파일을 고치면 뒤의 **버전 번호**(`common.css?v=1` 등)를 올려야
방문자가 새 파일을 받습니다. 정확한 현재 번호는 `src/_layouts/character.html`의 `?v=`를 보는 게 가장 확실합니다
(이 README는 사람이 손으로 갱신하는 문서라 버전 숫자가 늦게 반영될 수 있음). 참고로 이 문서를 마지막으로 손본 시점 기준: `common.css v2` · `profile.css v47` · `transitions.css v1` ·
`common.js v7` · `profile.js v32` · `stage-fx.js v130` · `transitions.js v3` · `motion.js v3` · `gallery-data.js v1`.

- **개발 중** → 번호 안 올려도 `jekyll serve` 재빌드 + 브라우저 **`Ctrl`+`Shift`+`R`**.
- **배포 전** → 고친 파일의 `?v=` 를 올려주세요. 참조하는 곳이 **여러 군데**일 수 있습니다 — 예를 들어 `profile.css`·`stage-fx.js`는 실제 캐릭터 레이아웃(`_layouts/character.html`) 말고도 **프로필 작성 툴의 미리보기(`buildSrcdoc()` 등)** 에서도 따로 불러오므로 그곳도 같이 올려야 툴 미리보기에서도 최신 버전이 반영됩니다.
- `tools/bump-cache.ps1`(또는 더블클릭용 `.bat`)을 실행하면 **모든 `.html`의 모든 `?v=` 번호를 한 번에 같은 새 번호로** 맞춰줍니다 — 파일마다 각자 다른 번호를 매기고 싶다면(지금처럼) 쓰지 말고 해당 줄만 직접 올리세요.

---

## 🚀 배포 (GitHub Pages)

이 저장소는 **public**이고, `main` 브랜치에 push되면 **GitHub Actions**가 자동으로 빌드·배포합니다.
실제 사이트 주소: **https://yoo-jeong.github.io/troubleshooter/**

- 워크플로 파일 → `.github/workflows/pages.yml`. GitHub이 기본 제공하는 Jekyll 빌드 대신, 로컬과 똑같이 `jekyll build`를 그대로 실행해 `_site`를 배포합니다.
  > 이유: GitHub 기본 빌드는 `_config.yml`의 `source: src` 설정을 무시하는 알려진 문제가 있어(저장소 루트를 그대로 빌드), `README.md`가 홈페이지로 뜨는 등 오작동합니다.
- 저장소 **Settings → Pages → Source**가 반드시 **`GitHub Actions`**로 설정돼 있어야 이 워크플로가 배포를 담당합니다(`Deploy from a branch`로 두면 GitHub이 자체 레거시 빌드를 돌려 위 문제가 재발합니다).
- 사이트가 `username.github.io/저장소이름/`처럼 **하위경로에 배포**되므로, 코드에서 링크는 항상 **상대경로**(`../`, `characters/slug/`)만 씁니다. 절대경로(`/assets/...`)를 쓰면 하위경로 배포에서 깨집니다 — `common.js`의 `TSROOT()`(로고 클릭·설정 패널 링크가 쓰는 사이트 루트 계산 함수)도 이 원칙으로 만들어져 있습니다.
- 배포는 `main` push에만 반응합니다(`workflow_dispatch`로 Actions 탭에서 수동 실행도 가능) — 개발 중인 다른 브랜치에 push해도 사이트에는 영향 없습니다. 위 [🌿 브랜치 운영](#-브랜치-운영) 참고.

---

