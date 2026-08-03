# TROUBLESHOOTER · CHARACTERS DATABASE

트러블슈터 세계관 아카이브.  
디제틱 휴대용 단말기(**TS·OS**)로 통합 데이터베이스에 접속하는 컨셉의 웹사이트입니다.

**[Jekyll](https://jekyllrb.com/) 정적 사이트 생성기**로 빌드합니다.  
원본은 전부 `src/` 안에 있고, 빌드하면 `_site/`에 완성된 정적 사이트가 나옵니다.  
결과물은 프레임워크나 런타임 없이 그냥 열리는 순수 HTML, CSS, JavaScript입니다.

> 왜 Jekyll을 쓰나요? 캐릭터 페이지처럼 뼈대는 같고 데이터만 다른 페이지가 여러 개라서,  
> 뼈대(레이아웃) 하나에 데이터(front matter)만 갈아 끼워 자동으로 만들기 위해서입니다.

실제 사이트: **https://yoo-jeong.github.io/troubleshooter/**

---

## 🖥 로컬에서 사이트 켜는 법 (미리보기)

> 다 잊어버려도 이 순서만 그대로 따라 하면 열립니다.  
> 파일을 더블클릭해서 여는 게 아니라, 터미널에서 서버를 켜서 봅니다.

### 0. 최초 설치 (1회만)

Ruby와 Jekyll이 필요합니다.
- 윈도우: [RubyInstaller](https://rubyinstaller.org/) 설치 후 터미널에서 `gem install jekyll bundler`
- 확인: 터미널에 `jekyll -v` 입력하면 버전 숫자가 뜹니다.

### 매번 켜는 순서

1. **터미널을 엽니다.** (윈도우: 시작 버튼 → `PowerShell` 검색 → 실행)
2. **이 프로젝트 폴더로 이동합니다.** `cd` 뒤에 이 폴더의 경로를 붙여 입력합니다:
   ```powershell
   cd C:\projects\troubleshooter
   ```
   경로는 본인 폴더 위치로 바꿔서 씁니다. 위 경로는 그냥 예시입니다.  
   팁: `cd `까지만 치고 탐색기에서 폴더를 터미널 창으로 끌어다 놓으면 경로가 자동 입력됩니다.
3. **서버를 켭니다.** 이 창은 켜 둔 채로 둡니다:
   ```powershell
   jekyll serve --livereload
   ```
   `Server address: http://127.0.0.1:4000/` 같은 줄이 뜨면 성공입니다.  
   `--livereload`를 붙이면 파일을 저장할 때마다 브라우저가 자동으로 새로고침됩니다.
4. **브라우저 주소창**에 아래 주소를 입력해 봅니다:
   - 홈: `http://localhost:4000`
   - 캐릭터 예: `http://localhost:4000/characters/myt/`
   - 프로필 작성 툴: `http://localhost:4000/tools/profile-builder.html`
5. **서버 끄기**: 터미널 창에서 `Ctrl` + `C`를 누릅니다.  
   jekyll 서버가 멈추고 미리보기 주소도 닫힙니다. 브라우저가 아니라 터미널의 서버를 끄는 것입니다.

> 한 번만 빌드하고 싶으면 서버 없이 `jekyll build`만 실행해도 됩니다. `_site/`에 결과물이 생깁니다.  
> 로컬 서버라서 저장소가 private이어도 로컬 확인은 항상 됩니다. 인터넷이나 호스팅은 필요 없습니다.

### ⚠️ 왜 그냥 파일 더블클릭은 안 되고 서버가 필요할까?

두 가지 이유입니다.

1. **원본엔 데이터만 있음.** `src/characters/*/index.html`은 `---`(front matter)로 시작하는 데이터와 본문일 뿐, 완성된 페이지가 아닙니다.  
   Jekyll이 레이아웃과 합쳐 완성된 HTML로 빌드해야 보입니다.
2. **홈은 실행 중에 다른 파일을 가져옴.** `index.html`은 틀만 있고, 실제 홈 화면(`modes/…`)을 자바스크립트가 `fetch`로 가져와 끼웁니다.  
   그런데 브라우저는 보안상 `file://`로 파일을 직접 열었을 때는 `fetch`를 막습니다.  
   `jekyll serve`로 `http://localhost:4000`이라는 진짜 주소가 되면 그때는 허용됩니다.

> **요약:** 파일을 더블클릭(`file://`)하면 홈은 `LOAD ERROR`가 뜨고, 캐릭터 원본은 그냥 안 보입니다.  
> 항상 `jekyll serve --livereload`로 켜고 `http://localhost:4000`으로 여세요.  
> 이미지, CSS, JS는 `file://`에서도 열리지만, `fetch`를 쓰는 홈 화면만은 서버가 꼭 필요합니다.

---

## 🧰 프로필 작성 툴

`src/tools/profile-builder.html`은 코드나 페이지 구조를 몰라도 새 캐릭터 프로필을 만들거나 기존 프로필을 고칠 수 있는 폼입니다.

이름, 소속, 능력치, 서술, 이미지 등을 폼에 입력하면 오른쪽에 실제 페이지와 거의 동일한 실시간 미리보기가 뜹니다.  
완성하면 `src/characters/<이름>/index.html`에 들어갈 코드를 만들어줍니다.

1. `jekyll serve`로 켠 뒤 `http://localhost:4000/tools/profile-builder.html`에 접속합니다.  
   `file://`로 그냥 더블클릭해도 폼 자체는 열립니다. 그때는 상단에 안내 문구가 뜹니다.
2. 폼을 채우면 오른쪽 미리보기가 바로 갱신됩니다.  
   서술/확장 카드는 미리보기 안에서 직접 클릭해 편집할 수도 있습니다.
3. 무대 효과도 이 툴의 효과 고르기 갤러리에서 실제로 움직이는 미리보기를 보면서 골라 쌓을 수 있습니다.  
   `stage-fx.js` 코드를 몰라도 조합할 수 있습니다.
4. 완성 후 두 가지 중 하나를 고릅니다:
   - **💾 저장**: 이 컴퓨터에 사이트 폴더가 있는 관리자용입니다.  
     대상 `index.html` 파일을 골라 자동으로 써넣습니다.
   - **📤 제출**: GitHub 계정이 없는 멤버용입니다.  
     디스코드 웹훅으로 관리자에게 전송되고, 관리자가 검토한 뒤 반영합니다.

> 도감 라인업용 전신 이미지 정규화도 이 툴에서 같이 할 수 있습니다.  
> 자세한 사용법은 [`docs/guide-tools.md`](docs/guide-tools.md)에 있습니다.

---

## 📁 폴더 구조 (요약)

> 핵심: 내가 쓰는 원본은 전부 `src/` 안에 있습니다. 루트에는 설정과 결과물만 있습니다.  
> 전체 트리는 [`docs/architecture-site.md`](docs/architecture-site.md)에 있습니다.

```
troubleshooter/
├── src/              # 모든 원본, 여기 한 폴더만 보면 됨
│   ├── index.html          # 홈
│   ├── characters.html     # 캐릭터 도감(목록)
│   ├── _layouts/character.html   # 캐릭터 페이지 공통 뼈대
│   ├── characters/<이름>/  # 캐릭터별 프로필(front matter + 이미지)
│   ├── world/, gallery/, logs/   # 그 외 화면
│   ├── modes/               # 홈 화면 조각들
│   ├── tools/profile-builder.html  # 프로필 작성 툴
│   └── assets/               # 공용 CSS, JS, 이미지
├── .github/workflows/pages.yml   # GitHub Actions 배포
├── _config.yml        # Jekyll 설정
├── _site/              # 빌드 결과물(자동 생성, 지워도 됨)
├── docs/               # 이 저장소의 심화 문서(아래 참고)
└── tools/              # 관리 스크립트(라인업 생성 등)
```

> **원본과 결과물 구분:** `src/…/index.html`(소스)은 `---`(front matter)로 시작하고,  
> `_site/…/index.html`(빌드 결과)은 `<!DOCTYPE html>`로 시작합니다.  
> `_site/`는 언제든 지워도 됩니다.

---

## 📚 더 알아보기

세부 아키텍처와 유지보수에 관한 문서는 `docs/`에 있습니다.

- [`docs/guide-workflow.md`](docs/guide-workflow.md): 다른 컴퓨터에서 이어가기, 브랜치 운영, 배포(GitHub Pages)
- [`docs/architecture-character-pages.md`](docs/architecture-character-pages.md): 캐릭터 페이지 구조(레이아웃과 데이터), profile.js 3파일 구조, 무대 효과 엔진(stage-fx.js)
- [`docs/architecture-site.md`](docs/architecture-site.md): 전체 폴더 구조, 디자인과 색 시스템, 캐시 버전(`?v=`) 관리
- [`docs/guide-tools.md`](docs/guide-tools.md): `?edit` 조정 도구, 라인업 이미지 스크립트, 갤러리 데이터 모델
