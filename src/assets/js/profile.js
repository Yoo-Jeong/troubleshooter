/* ============================================================
   TS·OS — 캐릭터 프로필 공통 동작 · 핵심(데이터 렌더링) (6명 공유 · 단일 출처)
   ------------------------------------------------------------
   이 파일이 하는 일은 딱 세 가지:
   1) 능력치 스탯 바 그리기  — 각 페이지의 window.CHAR_STATS 배열을 읽어 자동 생성.
   2) 옷장 슬롯 전환         — 슬롯을 누르면 스테이지 일러가 바뀜.
   3) 상단바·무대 메타 텍스트 채우기 — window.CHAR_META를 data-meta 자리에 반영.

   ▷ 스탯 데이터 형식 (각 페이지 <script> 에 정의):
        window.CHAR_STATS = [
          ['신체강도', 4],        // 단일 값  → 기본색으로 4칸
          ['근력', 6, 2],         // 기본값+증가분 → 기본색 6칸 + 보조색 2칸 (셀루카 등)
          ...
        ];
      · 만점 10칸. 3번째 값(증가분)은 없으면 생략.
      · 증가분 보조색은 CSS 변수 --stat-plus (각 페이지에서 지정, 없으면 기본).

   ▷ 같이 로드되는 형제 파일(같은 폴더, 역할 분담 — 이 파일이 먼저 로드돼야 함):
      · profile-generations.js — 세대 전환(있는 캐릭터만). 이 파일의 paintWardrobe/paintMeta/
        paintStats/setArtCredit을 window.__paint*·window.__setArtCredit으로 빌려 씀.
      · profile-ui.js — 라이트박스·카드 접기·사원증 스캔 토글·무대 접기 토글. 이 파일과는
        변수를 안 나눠 쓰는 완전히 독립된 화면 상호작용이라 따로 뺌.
   ============================================================ */
(function(){
  'use strict';
  var MAX = 10;
  var SELF = document.currentScript;   // profile.js 자기 위치(편집기 경로 계산용, 폴더 깊이 무관)

  // front matter 값을 innerHTML 문자열에 꽂기 전에 거치는 방어 헬퍼 — 값에 "나 <가 섞여도
  // 마크업이 안 깨지게(예: 캡션에 큰따옴표가 들어가면 data-* 속성이 거기서 끊겨버림).
  function escapeHtml(s){
    return String(s==null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  // 0) 옷장 슬롯 렌더 — window.CHAR_WARDROBE(또는 세대별 wardrobe) 배열로. 세대 전환 시 재호출 가능하게 함수화.
  //    각 항목: { cap, img, artist?, on?, arth?, artw?, shift?, shiftx?, ghosth?, ghosty?, ghostx?, ghostop? }
  function paintWardrobe(list){
    var track = document.querySelector('.wardrobe .track');
    if(!track) return;
    track.innerHTML = (list||[]).map(function(w){
      var a = 'data-img="' + escapeHtml(w.img) + '" data-artist="' + escapeHtml(w.artist) + '"';
      WARDROBE_FIELDS.forEach(function(f){ if(w[f.key]) a += ' ' + f.attr + '="' + escapeHtml(w[f.key]) + '"'; });
      var thumb = w.img ? '<div class="thumb"><img src="' + escapeHtml(w.img) + '" alt="' + escapeHtml(w.cap) + '"></div>'
                        : '<div class="thumb empty">＋</div>';
      return '<div class="slot' + (w.on?' on':'') + '" ' + a + '><span class="node"></span>' +
             thumb + '<span class="cap">' + escapeHtml(w.cap) + '</span></div>';
    }).join('');
    bindWardrobe();   // 슬롯 클릭 재배선(재렌더마다)
  }

  // 0.5) 페이지 메타 — CHAR_META(또는 세대별 meta)를 뼈대(osbar·topbar·stage)에 채움. 세대 전환 시 재호출.
  //      HTML은 data-meta 자리표시만, 실제 값은 데이터 한 곳에.
  function paintMeta(M){
    if(!M) return;
    if(M.title) document.title = 'TROUBLESHOOTER // ' + M.title;
    function set(k, v){    // 세대 전환 시 이전 값을 지우려면 null→'' 로 비움
      document.querySelectorAll('[data-meta="'+k+'"]').forEach(function(el){ el.textContent = (v==null?'':v); }); }
    set('record', M.record!=null ? 'RECORD ' + M.record : '');
    set('crumb',  M.crumb);
    set('sector', M.sector);
    set('code',   M.code);
    set('id',     M.id!=null ? 'ID · ' + M.id : '');
  }

  // 1) 능력치 스탯 바 — box(세대별 패널의 .statbars) 지정 가능. 세대 전환 시 재호출.
  function paintStats(stats, box){
    box = box || document.querySelector('.statbars'); if(!box) return;   // 마이그레이션으로 statbars는 class만(id 없음) → 단일세대(초기 1회 호출)도 찾게 class 셀렉터
    box.innerHTML = '';
    if(!stats || !stats.length) return;
    var frag = document.createDocumentFragment();
    stats.forEach(function(s){
      var name = s[0];
      var v    = Math.max(0, Math.min(MAX, s[1] || 0));
      var plus = Math.max(0, Math.min(MAX - v, s[2] || 0));   // 증가분 (기본값 위에 이어 채움)
      var el = document.createElement('div');
      el.className = 'sb';
      el.innerHTML =
        '<span class="k">' + escapeHtml(name) + '</span>' +
        '<span class="bar">' +
          '<i class="fill" style="width:' + (v / MAX * 100) + '%"></i>' +
          (plus ? '<i class="plus" style="left:' + (v / MAX * 100) + '%;width:' + (plus / MAX * 100) + '%"></i>' : '') +
        '</span>' +
        '<span class="n">' + v + (plus ? '<b>+' + plus + '</b>' : '') + '</span>';
      frag.appendChild(el);
    });
    box.appendChild(frag);
  }

  // 2) 옷장 슬롯 전환 — data-img 가 있는 슬롯만 클릭 가능
  //    의상마다 구도/크기가 다르면 슬롯에 data-arth(높이 %)·data-shift(세로이동 %) 지정 가능.
  //    예: <div class="slot" data-img="x_suit.png" data-arth="80%" data-shift="-4%">
  var art   = document.getElementById('stageArt');
  var ghost = document.getElementById('stageGhost');
  var root  = document.documentElement;
  // 일러 작가 크레딧 — 무대에 지금 걸린 그림이 바뀔 때마다(옷장 전환·세대 전환) 이 한 요소의 글자만 갱신.
  //   "art. " 접두어는 profile.css(.art-credit::before)가 붙임 → 여기선 이름만.
  var artCredit = document.getElementById('artCredit');
  function setArtCredit(name){
    if(!artCredit) return;
    artCredit.textContent = (name || '').trim();
  }
  // 옷장 의상 크기·위치 필드 8개(단일 출처) — 이 배열 하나에서 wardrobe 데이터 키(key)·slot의 data-* 속성명
  //   (attr)·CSS 변수 이름(css)이 전부 파생됨. 필드를 추가/변경할 땐 이 배열 한 줄만 고치면 됨
  //   (예전엔 SZ/SLOT_VARS/ALL_VARS 세 배열에 같은 내용을 순서까지 다르게 중복 관리했었음).
  var WARDROBE_FIELDS = [
    {key:'arth',    attr:'data-arth',    css:'--art-h'},
    {key:'artw',    attr:'data-artw',    css:'--art-w'},
    {key:'shift',   attr:'data-shift',   css:'--art-shift'},
    {key:'shiftx',  attr:'data-shiftx',  css:'--art-x'},
    {key:'ghosth',  attr:'data-ghosth',  css:'--ghost-h'},
    {key:'ghosty',  attr:'data-ghosty',  css:'--ghost-y'},
    {key:'ghostx',  attr:'data-ghostx',  css:'--ghost-x'},
    {key:'ghostop', attr:'data-ghostop', css:'--ghost-op'}
  ];
  var ALL_VARS = WARDROBE_FIELDS.map(function(f){ return f.css; });
  function applySlotSize(s){               // 슬롯의 data-* (HTML에 굳혀둔 값)
    WARDROBE_FIELDS.forEach(function(f){ var v = s.getAttribute(f.attr);
      if(v) root.style.setProperty(f.css, v); else root.style.removeProperty(f.css); });
  }
  // 브라우저 자동저장(localStorage) — ?edit 에서 드래그하면 복붙 없이 여기 저장, 다음에 그대로 적용.
  function saveKey(s){ return 'tsArt:' + location.pathname + '::' + (s.getAttribute('data-img')||'base'); }
  function applySaved(s){                  // 저장값이 있으면 data-* 위에 덮어씀(내 브라우저 한정)
    var raw; try { raw = localStorage.getItem(saveKey(s)); } catch(e){ return; }
    if(!raw) return; var map; try { map = JSON.parse(raw); } catch(e){ return; }
    ALL_VARS.forEach(function(v){ if(map[v] != null) root.style.setProperty(v, map[v]); });
  }
  function saveCurrent(s){                 // 현재 적용된 값을 저장
    var map = {}; ALL_VARS.forEach(function(v){ var x = root.style.getPropertyValue(v); if(x) map[v] = x; });
    try { localStorage.setItem(saveKey(s), JSON.stringify(map)); } catch(e){}
  }
  function clearSaved(s){ try { localStorage.removeItem(saveKey(s)); } catch(e){} }
  function applyAll(s){ applySlotSize(s); applySaved(s); setArtCredit(s.getAttribute('data-artist')); }   // HTML 기본값 → 저장값 순으로 적용 + 크레딧도 이 의상 것으로

  function bindWardrobe(){                  // 슬롯 클릭 배선 — 옷장 재렌더마다 재호출
    document.querySelectorAll('.slot[data-img]').forEach(function(s){
      var img = s.getAttribute('data-img');
      if(!img) return;                       // 빈 슬롯(의상 준비중)은 클릭 무시
      s.addEventListener('click', function(){
        document.querySelectorAll('.slot').forEach(function(x){ x.classList.remove('on'); });
        s.classList.add('on');               // 슬롯 선택 표시(즉시)
        if(!art){ applyAll(s); return; }
        // ★의상 전환을 부드럽게 : 새 의상 미리 로드 → 페이드아웃 → 교체 → 페이드인 (뚝 바뀌지 않게)
        //   ★.art/.ghost 각각이 아니라 .stage 전체를 페이드한다 — S·민트처럼 '화면 장악' 효과가 진짜 일러
        //   대신 캔버스에 매 프레임 그림을 새로 그려서 보여주는 경우엔 .art만 페이드해선 안 보임(캔버스는
        //   opacity 트랜지션과 무관하게 매 프레임 그대로 다시 그려지기 때문). 부모인 .stage 자체를 페이드하면
        //   안에 뭐가 있든(진짜 이미지든 캔버스든) 다 같이 가려진다.
        var stageEl = document.querySelector('.stage');
        var pre = new Image();               // 교체 순간 깜빡임 방지용 사전 로드
        var swap = function(){
          art.src = img; if(ghost) ghost.src = img;   // (이미 로드된) 새 의상으로 교체
          applyAll(s);                                 // 크기·위치도 새 의상 기준으로
          if(stageEl) stageEl.style.opacity = '';       // 페이드인
        };
        pre.onload = pre.onerror = function(){
          if(stageEl) stageEl.style.opacity = '0';      // 페이드아웃
          setTimeout(swap, 300);             // .stage transition(.35s)에 맞춰 거의 사라진 뒤 교체→페이드인
        };
        pre.src = img;
      });
    });
    var onSlot = document.querySelector('.slot.on') || document.querySelector('.slot[data-img]');
    if(onSlot) applyAll(onSlot);             // 처음 켜진 의상 반영(저장값 포함)
  }

  // ---- 초기 렌더(현재=대표 세대 데이터). 세대 전환 시 profile-generations.js가 세대별로 다시 호출 ----
  paintWardrobe(window.CHAR_WARDROBE);
  paintMeta(window.CHAR_META);
  paintStats(window.CHAR_STATS);

  // 외부(프로필 작성 툴 미리보기 · profile-generations.js)에서 iframe 재생성 없이 부분만 다시 그릴 수 있게 노출(번쩍임 방지용).
  window.__paintStats = paintStats;
  window.__paintMeta = paintMeta;      // 상단바(소속·경로·코드명)·무대 ID 갱신
  window.__paintWardrobe = paintWardrobe;
  window.__setArtCredit = setArtCredit;

  /* 3) (개발용) 편집 도구는 별도 파일 editor.js 로 분리 — ?edit 일 때만 로드.
        editor.js 가 필요로 하는 것들을 window.TSProfile 로 노출.
        (나중에 프로필 작성 툴 등 다른 편집기도 여기 API 를 재사용하면 됨) */
  window.TSProfile = {
    root: root, art: art, ghost: ghost, stage: document.querySelector('.stage'),
    ALL_VARS: ALL_VARS,
    applySlotSize: applySlotSize, saveCurrent: saveCurrent, clearSaved: clearSaved,
    onSlot: function(){ return document.querySelector('.slot.on'); }
  };
  if(art && /[?&]edit\b/.test(location.search)){
    var jsdir = (SELF && SELF.src) ? SELF.src.replace(/[^/]+$/, '') : '../assets/js/';   // profile.js 와 같은 폴더
    [jsdir+'edit-core.js?v=1', jsdir+'editor.js?v=7'].forEach(function(src){
      var es = document.createElement('script'); es.src = src; es.async = false; document.body.appendChild(es);   // 코어 먼저, 순서 보장
    });
  }
})();
