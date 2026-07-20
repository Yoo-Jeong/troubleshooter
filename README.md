# TROUBLESHOOTER · 아카이브 사이트

트러블슈터 아카이브. 디제틱 휴대용 단말기(**TS·OS**)로 통합 데이터베이스에
접속하는 컨셉의 정적(static) 웹사이트입니다. 빌드 도구·프레임워크 없이 순수
**HTML + CSS + JavaScript**로만 만들어졌습니다.

---

## 📁 폴더 구조

> **한 줄 규칙: "화면에 보이는 페이지(.html)는 바깥에, 나머지 재료는 전부 `assets/` 안에."**

```
troubleshooter/
├── index.html               # 홈 (사이트 진입점 — 파일명 고정). PCB·터미널 2가지 디스플레이 모드
├── characters.html          # 캐릭터 도감 (마스터-디테일 브라우저)
├── display_preview.html     # 홈 디스플레이 모드 프리뷰 (모드 비교)
├── transitions_preview.html # 화면 전환(트랜지션) 프리뷰
├── README.md                # 이 문서
│
├── assets/                  # ★ 모든 공용 자산은 여기 한 곳에 모음
│   ├── css/                 #   스타일시트 (디자인)
│   │   ├── common.css       #     공통 디자인 = 팔레트·타이포·프레임 토큰 + 기기 크롬  (여기만 고치면 전 페이지 반영)
│   │   └── transitions.css  #     페이지 전환 효과 스타일
│   ├── js/                  #   자바스크립트 (동작)
│   │   ├── common.js        #     테마 토글 + 시계 + 기기 외곽/SYSTEM CONFIG 주입
│   │   └── transitions.js   #     페이지 전환 모듈 (window.TS)
│   └── img/                 #   이미지
│       ├── ts_*.png         #     로고 · 워드마크
│       ├── deco_*.png       #     배경 데코 (육각형 · 레이더 HUD)
│       └── members/         #     캐릭터 썸네일 (vector, meant, ... myt.png)
│
├── myt/                     # 캐릭터 개별 페이지. 폴더명 = 캐릭터 영문명 소문자
│   ├── index.html           #   → /myt/ 주소로 접속됨 (깔끔한 URL)
│   └── myt_full.png         #   그 캐릭터 전용 이미지
│
├── modes/                   # 추가 홈 레이아웃 모드 (프리뷰 전용). 파일명 = index_<모드>.html
│   ├── index_minimal.html   #   미니멀 모드 (중앙 링 + 그리드 nav)
│   └── index_orbit.html     #   오빗 모드 (3D 틸트 궤도 + 글래스 메뉴)
│
├── lab/                     # 실험/시안 모음 (채택 안 된 네비·전환·transdemo). 배포엔 불필요
└── backup/                  # 옛 홈 시안 백업 (index_min, index_lighttilt, nav0_table)
```

> **개인 작업 자료**는 `_local/` 폴더에 모아두며 `.gitignore`로 **저장소에는 올라가지 않습니다**(로컬 전용).
> 하위: `source/`(원본 설정·아트) · `reference/`(외부 레퍼런스 이미지) · `drafts/`(과거 시안·프로토타입) · `backup/`(코드 백업).

---

## 🖥 로컬에서 미리보기

`.html` 파일을 브라우저로 그냥 열어도 대부분 보이지만, **페이지 전환 기능은 로컬 서버에서
열어야 정상 작동**합니다(브라우저 보안 정책 때문). 둘 중 편한 방법:

**방법 A — VS Code (가장 쉬움)**
1. VS Code에서 이 폴더를 엽니다.
2. 확장 프로그램 **"Live Server"** 설치.
3. `index.html` 우클릭 → **"Open with Live Server"**.

**방법 B — 터미널 (Python이 있으면)**
```bash
python -m http.server 8777
```
→ 브라우저에서 `http://localhost:8777/` 접속.

---

## 🎨 디자인 수정 팁

- **색·기기 프레임 같은 공통 디자인** → `assets/css/common.css` 한 곳만 고치면 전 페이지에 반영됩니다.
- **다크/라이트 테마** → 우상단 ◐ 버튼. 색은 `common.css` 상단의 CSS 변수(`--bg`, `--acc` 등)에서 관리.
- **페이지 전환 효과** → 링크에 `data-ts="accesslog"`(또는 `fade`) 속성만 달면 자동 적용됩니다.
  자세한 사용법은 `assets/js/transitions.js` 파일 상단 주석 참고.

---

## 🚀 배포 (GitHub Pages)

이 저장소를 GitHub에 올리고 **Settings → Pages**에서 브랜치를 지정하면
`https://<아이디>.github.io/troubleshooter/` 로 게시됩니다. 별도 빌드 과정이 필요 없습니다.
(`lab/`, `backup/`은 게시에 꼭 필요하진 않으니 나중에 정리해도 됩니다.)
