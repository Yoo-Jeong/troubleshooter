# 프로필 작성 툴 구조

[← README로 돌아가기](../README.md)

이 문서는 **프로필 작성 툴**(`src/tools/profile-builder.html`)이 어떻게 파일로 나뉘어 있는지만 다룹니다. 캐릭터 페이지 자체의 구조는 `docs/architecture-character-pages.md`에 따로 있습니다.

---

## 왜 나눴나

원래 `profile-builder.html` 하나에 HTML 마크업 + `<style>`(333줄) + 인라인 `<script>`(약 2790줄)가 전부 들어 있었습니다. 파일이 너무 길어 유지보수가 힘들어서, **HTML/CSS/JS를 표준대로 분리**하고 JS는 다시 주제별로 나눴습니다.

나누는 방식은 **코드를 재배치하지 않고 원본 순서 그대로 8조각으로 자르는 것**이었습니다. 이 파일 전체에서 "함수 밖에서 즉시 실행되는 코드가 아직 로드 안 된 뒤쪽 파일의 함수를 부르는" 경우가 없었기 때문에, 순서만 지키면 동작이 원본과 100% 동일하다는 게 보장됩니다. 그래서 "주제별로 재구성"하는 대신 이미 있던 섹션 주석 경계에서만 잘랐습니다.

## 파일 구성

`src/tools/` 바로 아래 플랫하게 있습니다(하위 폴더 없음 — `assets/js/profile*.js` 선례와 같은 방식, 파일이 8개뿐이라 폴더로 묶을 만큼 많지 않음).

| 파일 | 내용 |
|---|---|
| `profile-builder.css` | 툴 전체 스타일. `:root`/라이트테마 변수, 폼, 색선택기, fx 편집기, 효과 갤러리 모달, 라인업(키 비교) 등 |
| `profile-builder.html` | HTML 마크업(상단바, 숨은 `.form` 데이터 저장소, `#out`, `#fxGallery` 모달)만. 스타일은 `<link>`, 로직은 아래 6개 `<script src>`로 불러옴 |
| `profile-builder-core.js` | 유틸(`esc`/`slugify` 등), 전역 상태(`TOOL_ROSTER`/`SECTORS`/`THEME` 등), YAML-flow 미니파서, front matter 파싱(`applyData`/`loadCharacter`), 폼 동적 행(`statRow`/`wardRow`), 세대 폼 읽기·쓰기(`readGen`/`writeGen`/`blankGen`) |
| `profile-builder-fx-gen.js` | 무대 효과 레이어 편집기(앞/뒤 2컬럼, 효과 갤러리) + 세대 탭바(`selectGen`/`setMain`) + `collect` |
| `profile-builder-body.js` | 카드 본문(서술·확장) 빌더 — 구조화 폼 → HTML(`buildIdentity`/`buildBody`, 마크다운라이트 `proseToHtml`), HTML → 구조화 폼 역파서(`htmlToProse*`/`parseBody`, 불러오기용), 상태 → front matter YAML(`buildFM`/`buildFile`) |
| `profile-builder-preview.js` | `buildSrcdoc()`(상태 → 미리보기 iframe HTML 통째로 조립, 단일 출처) + 이중버퍼 교차 페이드 렌더(`paintPreview`/`render`) |
| `profile-builder-edit.js` | 라이브 패치(`liveStats` 등, iframe 재생성 없이 부분만 갱신) + 클릭편집 동기화 `pvEdit` 계열(`window.pvXxx` — 미리보기 iframe 안 편집 UI가 부모를 호출해 폼에 값을 반영) |
| `profile-builder-boot.js` | 코드 내보내기, `seed()`/`boot()` 진입점, 폼 전체 이벤트 바인딩(40여 건), 커스텀 색선택기, 사이드패널 토글, 저장(IndexedDB)/디스코드 제출, 라인업(키 비교 이미지) 섹션 전체, 마지막 `render()` 호출 |

## 로드 순서

`profile-builder.html` 맨 끝, `stage-fx.js` 다음에 이 순서로 불러옵니다:

```
profile-builder-core.js → fx-gen.js → body.js → preview.js → edit.js → boot.js
```

**`profile-builder-boot.js`가 항상 마지막**입니다. `seed()`/`boot()`/모든 이벤트 바인딩/마지막 `render()`가 원본 순서 그대로 이 파일 안에 있고, 이 파일이 참조하는 다른 5개 파일의 함수·변수는 전부 그보다 먼저 로드되어 있기 때문에 안전합니다.

함수 **정의**는 어느 파일에 있든 상관없습니다(모두 전역 스코프의 클래식 스크립트라, 실제로 호출되는 시점엔 이미 8개 파일이 다 로드된 뒤이기 때문). 순서가 진짜 중요한 건 **함수 밖에서 즉시 실행되는 코드**(`seed()` 호출, 이벤트 바인딩 등)뿐이고, 이건 전부 `boot.js` 안에 원본 순서 그대로 모여 있습니다.

## ★`profile-builder-boot.js`는 더 쪼개지 말 것

이 파일만 유독 큽니다(약 690줄). 이 구간은 즉시실행문과 그게 바로 부르는 소규모 도우미 함수(저장·제출·라인업 등)가 원본에서부터 촘촘히 섞여 있어서, 억지로 더 쪼개면 "이 즉시실행문이 부르는 함수가 다른 파일로 갔는데 아직 로드가 안 됐다" 같은 순서 사고가 날 위험이 생깁니다. 크기 균형보다 정확성을 우선한 결정입니다.

## 새 기능을 추가할 때

- 미리보기 iframe 안에서 부모를 호출하는 새 `window.pvXxx` 함수 → `profile-builder-edit.js`
- 폼 요소에 새로 붙이는 즉시실행 이벤트 바인딩(`$('#foo').onclick=...`) → `profile-builder-boot.js` 맨 끝(원본처럼 관련 함수 바로 옆에 둬도 되고, 그 함수가 다른 파일에 있으면 boot.js 끝에 몰아서 둬도 안전)
- 새 카드 본문 형식(서술/확장 카드 변형) → `profile-builder-body.js`
- 새 무대 효과 갤러리 항목 자체는 `assets/js/stage-fx.js`의 `EFFECTS`가 단일 출처라 이 툴 쪽은 손댈 필요 없음(자동으로 갤러리에 나타남)

## 캐시 버전(`?v=`)

이 7개 파일(css 1 + js 6)은 `profile-builder.html` 자신의 `<link>`/`<script src>` 한 곳에서만 참조됩니다(실제 캐릭터 페이지나 iframe 미리보기 안에서는 안 쓰임). 그래서 `assets/js/profile*.js`처럼 레이아웃 + srcdoc 두 곳을 다 bump할 필요 없이, 이 한 곳만 관리하면 됩니다. 현재 전부 `v=1`(2026-08-08 분할 시점).

## 검증 방식

분할 자체는 로직을 한 줄도 바꾸지 않는 작업이라, 원본 `git show HEAD:src/tools/profile-builder.html`의 CSS/JS 구간과 새 7개 파일을 원래 순서대로 이어붙인 결과를 diff해서 확인했습니다(`"use strict";` 추가분과 파일 헤더 주석 외엔 차이 없음). 그 위에 `jekyll build` + 6개 js 파일 각각 `node --check` + 실브라우저로 옷장/능력치/신원 팝오버, 세대 전환, 효과 갤러리, 코드 내보내기, 라인업 이미지, 테마 전환을 콘솔 에러 없이 확인했습니다.
