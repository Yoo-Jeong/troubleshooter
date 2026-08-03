# 캐릭터 페이지 구조

[← README로 돌아가기](../README.md)

이 문서는 **캐릭터 상세 페이지**(`characters/<이름>/index.html`)가 어떻게 짜여 있는지만 다룹니다.  
홈 화면, 목록, 갤러리 등 다른 페이지 구조는 여기 없습니다. 각자 필요할 때 별도 문서로 추가합니다.

---

## 🧩 레이아웃 + 데이터(front matter)

캐릭터 페이지는 뼈대(`_layouts/character.html`) 한 곳에 페이지별 데이터를 끼워 자동으로 조립됩니다.

그래서 `src/characters/<이름>/index.html`은 데이터와 본문만 담습니다:

```yaml
---
layout: character
accent: "#bfc7d4"                 # 캐릭터 색, 이것만 정하면 나머지 색은 profile.css가 파생

art: "vector_full.png"            # 무대 초기 일러
art_alt: "벡스터"
# ↑ 옷장(wardrobe)에 "on": true 항목이 있으면 그쪽이 항상 우선입니다.
#   art/art_alt는 옷장이 비어있을 때만 쓰는 폴백이라, 보통은 안 건드려도 됩니다.

root: { "art-h": "100%" }         # (선택) 페이지별 :root 변수(일러 크기, 위치 기본값)

meta: { title: "VECTOR", record: "M-01", crumb: "VECTOR", sector: "HQ · SECTOR 1", code: "VECTOR", id: "TS-M01" }

stats: []                         # 능력치 [["신체강도", 4], …] (비면 빈 배열)

wardrobe:                         # 옷장 슬롯(profile.js가 생성). on = 시작 의상
  - { cap: "후드", img: "" }
  - { cap: "정장", img: "vector_full.png", "on": true, arth: "93.5%", shiftx: "12.5%", shift: "-2.3%" }

generations:                      # 세대(1, 2, 3세대). main = 현재 실제 프로필, 나머지 = 플레이스홀더
  current: "3"
  items:
    - { id: "1", label: "1세대", sub: "ORIGIN", img: "" }
    - { id: "3", label: "3세대", sub: "HEIR", img: "vector_full.png", main: true,
        effect: [{ fx: "film", place: "back" }, { fx: "decode", place: "back" }, { fx: "decode", place: "front" }] }
---
<!-- 여기 아래 = 우측 정보(.file) 본문 = 캐릭터 내용(이름, 사원증, 서술 등) -->
```

- **뼈대(상단바, 프레임, 스크립트)를 고치려면** `_layouts/character.html` 한 곳만 고치면 6명 전부 반영됩니다.
- 상단바의 레코드번호, 크럼, ID 등은 `meta`에서 자동 주입됩니다(`profile.js`).
- **새 캐릭터 추가** = `characters/새이름/index.html`(front matter + 본문) + 이미지. 뼈대는 재사용합니다.

> ⚠️ **YAML 주의**: `on:`, 색값(`#…`), `%`값은 반드시 따옴표로 감쌉니다(`"on": true`, `"#bfc7d4"`).  
> `on`은 YAML 예약어라서 안 감싸면 깨집니다.

> 💡 front matter를 손으로 직접 안 쓰고 폼으로 채워서 만들고 싶다면 [🧰 프로필 작성 툴](../README.md#-프로필-작성-툴)을 씁니다.

---

## 🧵 profile.js 구조 (3개 파일)

캐릭터 페이지 동작은 성격이 다른 두 종류라서, 파일 하나가 아니라 3개로 나뉘어 있습니다.  
2026년 8월 3일, 전체 코드 점검 2라운드에서 나눴습니다.

셋 다 `_layouts/character.html`과 프로필 작성 툴 미리보기가 함께 로드하며, 아래 순서대로 로드돼야 합니다.

| 파일 | 역할 |
|---|---|
| `assets/js/profile.js` | **핵심**. 옷장 렌더링/전환, 상단바와 무대 메타 텍스트, 능력치 스탯 바. |
| `assets/js/profile-generations.js` | 세대 전환(있는 캐릭터만). 타임라인 UI, 세대별 그림/효과/패널 교체. |
| `assets/js/profile-ui.js` | 라이트박스, 카드 접기/펼치기, 사원증 스캔 토글, 무대 접기 토글. |

**의존 관계:**

- `profile.js`가 반드시 가장 먼저 로드돼야 합니다.  
  아래 두 파일이 이 파일의 함수를 빌려 쓰기 때문입니다.
- `profile-generations.js`는 `profile.js`가 노출한 `window.__paintWardrobe`, `__paintMeta`, `__paintStats`, `__setArtCredit`을 호출해서,  
  세대가 바뀔 때마다 옷장, 메타, 스탯을 다시 그립니다.
- `profile-ui.js`는 다른 두 파일과 변수를 전혀 안 나눠 씁니다. 완전히 독립돼 있습니다.  
  그래서 이 파일만은 로드 순서가 달라도 상관없습니다.

**왜 나눴나:**

원래 파일 하나(477줄)에 위 세 가지가 다 섞여 있어서, 이 동작이 어디 있는지 스크롤로 찾아야 했습니다.  
옷장, 세대전환처럼 서로 상태를 공유하는 부분은 같이 두고, 라이트박스, 토글류처럼 완전히 독립적인 화면 상호작용만 따로 뺐습니다.

**새 기능을 추가한다면:**

- 옷장, 스탯, 메타나 세대 데이터에 관련된 동작은 위 두 파일 중 하나에 넣습니다.
- 그 페이지에서만 일어나는 독립적인 화면 상호작용(토글, 팝업 등)은 `profile-ui.js`에 새 `(function(){...})()` 블록으로 추가합니다.

---

## 🎭 무대 뒤 능력 연출 (`stage-fx.js`)

- 무대 효과는 `TSFX` 컨트롤러가 각 세대 항목의 `effect`를 읽어 캔버스를 동적으로 생성하고 재생합니다.  
  자동 장착은 `profile-generations.js`가 합니다.
- **효과 하나는 그림함수 하나입니다.** `effect:`는 그 효과들을 레이어로 쌓은 배열입니다.  
  각 레이어가 `{ fx: "효과이름", place: "back" | "front" }`로 캐릭터 그림 뒤에 그릴지 앞에 그릴지 정하고, 같은 면에 여러 개를 쌓을 수도 있습니다.
  ```yaml
  effect: [{ fx: "film", place: "back" }, { fx: "decode", place: "back" }, { fx: "decode", place: "front" }]
  ```
- 효과 수가 60종 넘게 많아서 이 문서엔 전부 나열하지 않습니다.  
  목록은 프로필 작성 툴의 효과 고르기 갤러리(실제로 움직이는 미리보기 포함)가 항상 최신 상태입니다.
- 자주 같이 쓰는 앞뒤 조합은 세트(PRESETS)로 미리 묶여 있습니다(균열, 데이터 스트림, 기록 스캔 등).  
  이름 하나만 써도 앞뒤 레이어가 자동으로 펼쳐집니다: `effect: ["crack"]`.
- `glitch`처럼 화면 전체를 장악하는 연출은 `kind:'takeover'`로 표시돼 있고, 이런 효과는 항상 맨 앞에 고정됩니다. 뒤로 지정해도 자동으로 앞에 옵니다.
- **세대 전환**: 세대가 2개 이상이면 상단에 타임라인이 자동으로 뜹니다.  
  세대를 바꾸면 그림, 효과, 색, 우측 패널, 무대 뒤 코드명이 통째로 교체됩니다.  
  이미지 없는 세대는 준비중 플레이스홀더가 뜨고 효과는 숨겨집니다.
- 방문자는 무대 우상단 `FX ON`/`FX OFF` 버튼으로 이 효과들을 껐다 켤 수 있습니다. 브라우저에 기억되고, 기본값은 켜짐입니다.
- **새 효과 추가** = `stage-fx.js`의 `FX`(그림함수), `INIT`(초깃값)에 하나씩 추가하고 `EFFECTS`에 한 줄 더합니다.  
  그러면 프로필 작성 툴 갤러리에 자동으로 나타납니다.
