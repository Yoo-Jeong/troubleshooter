/* ============================================================
   TS·OS — 캐릭터 프로필 · 화면 상호작용 4종 (6명 공유 · 단일 출처)
   ------------------------------------------------------------
   전부 서로 상태를 안 나눠 쓰는 독립된 (function(){...})() 블록:
   1) 라이트박스        — 서술카드 안 그림 클릭 → 화면 가득 크게 보기
   2) 카드 접기/펼치기   — 서술카드·확장카드 공통, max-height 트랜지션
   3) 사원증 스캔 토글   — #idScan 애니메이션 켜기/끄기
   4) 무대 접기(읽기 모드) 토글 — 옷장·무대를 접어 서술카드를 넓게 보기

   profile.js(옷장·메타·스탯)·profile-generations.js(세대 전환)와는 변수를
   안 나눠 쓰므로 이 파일은 그 두 파일보다 먼저 실행돼도 상관없음(순서 무관).
   ============================================================ */

// 서술카드 안 그림 클릭 → 화면 가득 크게 보기(라이트박스). 오버레이 하나를 재사용(그림마다 새로 안 만듦).
(function(){
  var box, img;
  function ensure(){
    if(box) return;
    box = document.createElement('div'); box.className = 'lightbox';
    img = document.createElement('img');
    box.appendChild(img);
    box.addEventListener('click', close);
    document.body.appendChild(box);
  }
  function open(src, alt){ ensure(); img.src = src; img.alt = alt || ''; box.classList.add('on'); }
  function close(){ if(box) box.classList.remove('on'); }
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('.prose .p-fig img');
    if(t) open(t.src, t.alt);
  });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') close(); });
})();

/* ============================================================
   카드 접기/펼치기 — 서술카드(.card, 기본 열림)·확장카드(.acc, 기본 닫힘) 공통, max-height 트랜지션으로 부드럽게.
   ------------------------------------------------------------
   · 서술카드는 원래 접는 기능이 없었음 → 새로 추가(순수 화면 동작, 새로고침하면 다시 열림 상태로 — 저장 안 됨).
   · 확장카드는 원래도 <details>로 접혀 있었지만 브라우저 기본 동작이라 애니메이션 없이 뚝 끊겨 열리고 닫혔음.
     ★[open] 속성은 그대로 상태값으로 계속 씀(기밀 카드가 [open] 유무로 스타일이 갈리므로) — 여닫는 "과정"만 부드럽게 만듦.
   ============================================================ */
(function(){
  function rememberPad(box){   // 원래(열린) 패딩값을 최초 1회 기억 — 닫을 때 0으로 줄였다가 열 때 이 값으로 복원
    if(box.dataset.padT === undefined){
      var cs = getComputedStyle(box);
      box.dataset.padT = cs.paddingTop; box.dataset.padB = cs.paddingBottom;
    }
  }
  // 펼침/접힘을 빠르게 연타하면 중간에 끊긴 전환은 transitionend가 안 뜨므로, 리스너를 안 떼고 새로 달면
  // 계속 쌓인다 — 박스마다 "지금 걸린 리스너"를 기억해뒀다가 새로 달기 전에 먼저 떼서 최대 1개만 유지.
  function clearFoldListener(box){
    if(box._tsFoldTE){ box.removeEventListener('transitionend', box._tsFoldTE); box._tsFoldTE = null; }
  }
  function openBox(box){
    rememberPad(box);
    clearFoldListener(box);
    box.style.paddingTop = box.dataset.padT; box.style.paddingBottom = box.dataset.padB;
    box.style.maxHeight = box.scrollHeight + 'px';
    box._tsFoldTE = function te(e){
      if(e.propertyName !== 'max-height') return;
      box.style.maxHeight = 'none';   // 다 열린 뒤엔 고정 높이를 풀어줘야 내용이 늘어나도 안 잘림
      clearFoldListener(box);
    };
    box.addEventListener('transitionend', box._tsFoldTE);
  }
  function closeBox(box, onDone){
    rememberPad(box);
    clearFoldListener(box);
    box.style.maxHeight = box.scrollHeight + 'px';   // 'none'이던 높이를 실제 px로 고정(트랜지션 시작점 확보)
    requestAnimationFrame(function(){
      box.style.maxHeight = '0px'; box.style.paddingTop = '0px'; box.style.paddingBottom = '0px';
    });
    box._tsFoldTE = function te(e){
      if(e.propertyName !== 'max-height') return;
      clearFoldListener(box);
      if(onDone) onDone();
    };
    box.addEventListener('transitionend', box._tsFoldTE);
  }

  // ---- 서술카드(.card) ----
  document.querySelectorAll('.card > .card-h').forEach(function(h){
    var body = h.nextElementSibling;
    if(!body || !body.classList.contains('card-b')) return;   // 능력치·사원증 카드는 대상 아님
    h.classList.add('foldable');   // CSS가 이 클래스로만 화살표·포인터 커서를 보여줌(사원증 등엔 안 붙게)
    h.setAttribute('role', 'button'); h.setAttribute('tabindex', '0'); h.setAttribute('aria-expanded', 'true');
    function toggle(){
      var closing = !h.classList.contains('closed');
      h.classList.toggle('closed', closing);
      h.setAttribute('aria-expanded', closing ? 'false' : 'true');
      if(closing) closeBox(body); else openBox(body);
    }
    h.addEventListener('click', toggle);
    h.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(); } });
  });

  // ---- 확장카드(.acc, <details>) ----
  document.querySelectorAll('details.acc').forEach(function(det){
    var summary = det.querySelector(':scope > summary'), body = det.querySelector(':scope > .acc-b');
    if(!summary || !body) return;
    if(!det.open){ rememberPad(body); body.style.maxHeight = '0px'; body.style.paddingTop = '0px'; body.style.paddingBottom = '0px'; }
    summary.addEventListener('click', function(e){
      e.preventDefault();   // 네이티브 즉시 토글을 막고, 우리가 open 속성 타이밍까지 맞춰가며 대신 처리
      if(det.open){ closeBox(body, function(){ det.removeAttribute('open'); }); }
      else{ det.setAttribute('open', ''); openBox(body); }
    });
  });
})();

// 사원증 스캔 효과 끄기/켜기 — #idScan(위아래로 훑는 CSS 애니메이션) 하나만 대상, 무대 효과 스위치와는 별개.
// 브라우저에 기억(localStorage) — 무대 효과 스위치와 같은 방식이되 키는 따로 둬서 서로 안 얽히게 함.
(function(){
  var btn = document.getElementById('idScanToggle'), scan = document.getElementById('idScan');
  if(!btn || !scan) return;
  var on = true;
  try{ on = localStorage.getItem('ts-idscan') !== 'off'; }catch(e){}
  function paint(){
    scan.classList.toggle('off', !on);
    btn.classList.toggle('off', !on);
    btn.textContent = on ? 'SCAN ON' : 'SCAN OFF';
  }
  paint();
  btn.addEventListener('click', function(){
    on = !on;
    try{ localStorage.setItem('ts-idscan', on ? 'on' : 'off'); }catch(e){}
    paint();
  });
})();

// 읽기 모드 — 옷장·무대(.left-fixed) 오른쪽 끝의 작은 탭(.stage-fold-tab)으로 접고,
//   서술카드(.file)만 넓게 본다. 탭 자체가 패널 경계에 걸쳐 있어 "이걸 누르면 옆이 접힌다"가 모양으로 보이므로
//   글자 라벨 대신 화살표 방향(‹ 접기 / › 펼치기)만 바꾼다.
//   ※ 이 탭은 좁은 화면(≤900px)에선 profile.css가 아예 숨긴다 — 그 폭은 이미 옷장·무대·카드가 1열로
//   쌓이는 구조라 "옆으로 접어 넓힌다"는 개념 자체가 안 맞기 때문(모바일 사용성 재점검, 2026-08-03).
//   ★방문 취향을 기억하지 않음(FX/SCAN 스위치와 다른 점) — 새로고침·다른 캐릭터로 이동하면 항상 기본값(펼침)으로 돌아온다.
(function(){
  var btn = document.getElementById('stageViewToggle'), sheet = document.querySelector('.sheet');
  if(!btn || !sheet) return;
  var expanded = true, busy = false;
  function paintBtn(){
    btn.textContent = expanded ? '‹' : '›';
    btn.title = expanded ? '옷장·무대 접기' : '옷장·무대 펼치기';
  }
  paintBtn();
  btn.addEventListener('click', function(){
    if(busy) return;                 // 애니메이션 도중 연타 방지
    expanded = !expanded; paintBtn(); busy = true;
    if(!expanded){
      // 접기 : 내용부터 페이드아웃(.2s) → 다 지워진 뒤에야 열 폭을 스냅으로 줄인다(빈 상태라 안 튐).
      sheet.classList.add('folding');
      setTimeout(function(){ sheet.classList.add('read-mode'); busy = false; }, 200);
    } else {
      // 펼치기 : 열 폭부터 스냅으로 늘리고(아직 내용은 숨김 상태) → 다음 프레임에 페이드인.
      sheet.classList.remove('read-mode');
      requestAnimationFrame(function(){
        sheet.classList.remove('folding');
        setTimeout(function(){ busy = false; }, 200);
      });
    }
  });
})();
