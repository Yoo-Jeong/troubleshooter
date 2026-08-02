/* ============================================================
   TS·OS — 캐릭터 프로필 공통 동작 (12명 공유 · 단일 출처)
   ------------------------------------------------------------
   이 파일이 하는 일은 딱 두 가지:
   1) 능력치 스탯 바 그리기  — 각 페이지의 window.CHAR_STATS 배열을 읽어 자동 생성.
   2) 옷장 슬롯 전환         — 슬롯을 누르면 스테이지 일러가 바뀜.

   ▷ 스탯 데이터 형식 (각 페이지 <script> 에 정의):
        window.CHAR_STATS = [
          ['신체강도', 4],        // 단일 값  → 기본색으로 4칸
          ['근력', 6, 2],         // 기본값+증가분 → 기본색 6칸 + 보조색 2칸 (셀루카 등)
          ...
        ];
      · 만점 10칸. 3번째 값(증가분)은 없으면 생략.
      · 증가분 보조색은 CSS 변수 --stat-plus (각 페이지에서 지정, 없으면 기본).
   ============================================================ */
(function(){
  'use strict';
  var MAX = 10;
  var SELF = document.currentScript;   // profile.js 자기 위치(편집기 경로 계산용, 폴더 깊이 무관)

  // 0) 옷장 슬롯 렌더 — window.CHAR_WARDROBE(또는 세대별 wardrobe) 배열로. 세대 전환 시 재호출 가능하게 함수화.
  //    각 항목: { cap, img, artist?, on?, arth?, artw?, shift?, shiftx?, ghosth?, ghosty?, ghostx?, ghostop? }
  function paintWardrobe(list){
    var track = document.querySelector('.wardrobe .track');
    if(!track) return;
    var SZ = ['arth','artw','shift','shiftx','ghosth','ghosty','ghostx','ghostop'];
    track.innerHTML = (list||[]).map(function(w){
      var a = 'data-img="' + (w.img || '') + '" data-artist="' + (w.artist || '') + '"';
      SZ.forEach(function(k){ if(w[k]) a += ' data-' + k + '="' + w[k] + '"'; });
      var thumb = w.img ? '<div class="thumb"><img src="' + w.img + '" alt="' + (w.cap||'') + '"></div>'
                        : '<div class="thumb empty">＋</div>';
      return '<div class="slot' + (w.on?' on':'') + '" ' + a + '><span class="node"></span>' +
             thumb + '<span class="cap">' + (w.cap||'') + '</span></div>';
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
        '<span class="k">' + name + '</span>' +
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
  // 슬롯의 data-* → CSS 변수 (일러 art + 고스트 ghost)
  var SLOT_VARS = [['data-arth','--art-h'],['data-artw','--art-w'],['data-shift','--art-shift'],['data-shiftx','--art-x'],
                   ['data-ghosth','--ghost-h'],['data-ghosty','--ghost-y'],['data-ghostx','--ghost-x'],
                   ['data-ghostop','--ghost-op']];
  var ALL_VARS = ['--art-h','--art-w','--art-x','--art-shift','--ghost-h','--ghost-x','--ghost-y','--ghost-op'];
  function applySlotSize(s){               // 슬롯의 data-* (HTML에 굳혀둔 값)
    SLOT_VARS.forEach(function(m){ var v = s.getAttribute(m[0]);
      if(v) root.style.setProperty(m[1], v); else root.style.removeProperty(m[1]); });
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
        //   페이드는 .art/.ghost 의 CSS transition:opacity 가 담당(별도 애니메이션 불필요).
        var pre = new Image();               // 교체 순간 깜빡임 방지용 사전 로드
        var swap = function(){
          art.src = img; if(ghost) ghost.src = img;   // (이미 로드된) 새 의상으로 교체
          applyAll(s);                                 // 크기·위치도 새 의상 기준으로
          art.style.opacity = ''; if(ghost) ghost.style.opacity = '';   // 페이드인
        };
        pre.onload = pre.onerror = function(){
          art.style.opacity = '0'; if(ghost) ghost.style.opacity = '0'; // 페이드아웃
          setTimeout(swap, 300);             // .art transition(.35s)에 맞춰 거의 사라진 뒤 교체→페이드인
        };
        pre.src = img;
      });
    });
    var onSlot = document.querySelector('.slot.on') || document.querySelector('.slot[data-img]');
    if(onSlot) applyAll(onSlot);             // 처음 켜진 의상 반영(저장값 포함)
  }

  // ---- 초기 렌더(현재=대표 세대 데이터). 세대 전환 시 initGens가 세대별로 다시 호출 ----
  paintWardrobe(window.CHAR_WARDROBE);
  paintMeta(window.CHAR_META);
  paintStats(window.CHAR_STATS);

  // 외부(프로필 작성 툴 미리보기)에서 iframe 재생성 없이 부분만 다시 그릴 수 있게 노출(번쩍임 방지용).
  window.__paintStats = paintStats;
  window.__paintMeta = paintMeta;   // 상단바(소속·경로·코드명)·무대 ID 갱신

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

  /* ============================================================
     4) 세대 전환 (선택 기능 · 데이터로 켜짐) — window.CHAR_GENERATIONS
     ------------------------------------------------------------
     "세대 = 다른 캐릭터" : 세대를 바꾸면 그림·효과·색·우측패널이 통째로 교체.
     세대가 있는 캐릭터만 이 데이터를 정의하면, 타임라인 UI가 자동으로 뜬다.
        window.CHAR_GENERATIONS = {
          current: '3',                 // 시작 세대 id
          items: [
            { id:'1', label:'1세대', sub:'ORIGIN', img:'',           phIcon:'✧', phName:'기록되지 않은 형상' },
            { id:'3', label:'3세대', sub:'HEIR',   img:'x_full.png', artist:'작가명', effect:['film',{fx:'decode'}], main:true }
          ]
        };
      · main:true = "실제 프로필"이 쓰인 세대(현재 페이지 본문). 나머지는 플레이스홀더.
      · artist = 이 세대 무대 그림의 작가(선택). 무대 우하단 크레딧에 표시.
      · img 없으면 무대 플레이스홀더 + 효과 숨김. effect 는 무대효과 컨트롤러(__stageFX)로 교체.
     ============================================================ */
  function initGens(){
    var G = window.CHAR_GENERATIONS;
    var stage = document.querySelector('.stage');
    // 무대효과 컨트롤러를 공통으로 장착(stage-fx.js 로드된 페이지)
    var fx = (window.TSFX && TSFX.mount && stage) ? TSFX.mount(stage) : null;
    window.__stageFX = fx;

    // ---- 무대 효과 끄기/켜기(방문자 취향 · 이 브라우저에 기억됨) ----
    //   실제로 어떤 효과를 켤지는 그대로(세대 전환 등) 결정되고, 이 스위치는 "켤지 말지"만 관여.
    //   applyFx()를 그 결정 지점(아래·applyStage) 딱 한 곳에서만 부르게 해서 로직이 두 곳으로 안 갈라지게 함.
    var fxOn = true;
    try{ fxOn = localStorage.getItem('ts-fx') !== 'off'; }catch(e){}
    var curEffect = [];
    function applyFx(effect){
      curEffect = effect || [];
      if(!fx) return;
      if(fxOn) fx.set(curEffect); else fx.stop();
    }
    var fxBtn = document.getElementById('fxToggle');
    if(fxBtn){
      var paintFxBtn = function(){ fxBtn.classList.toggle('off', !fxOn); fxBtn.textContent = fxOn ? 'FX ON' : 'FX OFF'; };
      paintFxBtn();
      fxBtn.addEventListener('click', function(){
        fxOn = !fxOn;
        try{ localStorage.setItem('ts-fx', fxOn ? 'on' : 'off'); }catch(e){}
        paintFxBtn();
        // ★일러(.art)엔 세대전환용 opacity 트랜지션(.35s)이 걸려있어서, 이 스위치로 바뀌는 투명도에도
        //   그게 그대로 타 서서히 나타나다 보니 그 사이로 뒤의 고스트(잔상)가 비쳐 두 장이 겹친 것처럼
        //   보였음(2026-07-27 지적으로 수정) — 이 토글만은 트랜지션을 잠깐 끄고 즉시 바뀌게 한다.
        var artEl = document.getElementById('stageArt');
        if(artEl) artEl.style.transition = 'none';
        if(fx){ if(fxOn) fx.set(curEffect); else fx.stop(); }
        if(artEl) requestAnimationFrame(function(){ requestAnimationFrame(function(){ artEl.style.transition = ''; }); });
      });
    }

    if(!G || !G.items || G.items.length < 2){           // 세대 없음/1개 → 현재 효과만 설정
      if(G && G.items && G.items[0] && G.items[0].effect) applyFx(G.items[0].effect);
      return;
    }
    var items = G.items,
        fileArea = document.querySelector('.file'),
        topbar = document.querySelector('.topbar'),
        stageArt = document.getElementById('stageArt'),
        stageGhost = document.getElementById('stageGhost'),
        rootEl = document.documentElement,
        order = items.map(function(i){ return i.id; }),
        mainItem = items.filter(function(i){ return i.main; })[0] || items[0],
        mainId = mainItem.id,
        curId = G.current || mainId,
        ph = null,
        genAccentEl = null;   // 비대표 세대의 대표색(라이트/다크)을 덮는 동적 <style>. 대표 세대는 비움(페이지 기본 <style> 사용)
    function byId(id){ for(var i=0;i<items.length;i++) if(items[i].id===id) return items[i]; return items[0]; }

    // ★세대별 완전 프로필 — 세대 전환 시 그 세대 패널로 교체 + 능력치·상단바·옷장을 그 세대 데이터로 다시 그림.
    //   (세대 2개 이상인 캐릭터는 본문이 .gen-panel[data-gen] 로 나뉘어 있음. 단일 세대는 위 L168에서 이미 return.)
    var phBody = null;   // 미작성 세대일 때 임시로 넣는 플레이스홀더 본문
    function renderGenPanel(it, sel){
      var panel = fileArea.querySelector('.gen-panel[data-gen="'+sel+'"]');   // 이 세대 프로필이 작성돼 있으면 패널이 있음
      fileArea.querySelectorAll('.gen-panel[data-gen]').forEach(function(p){ if(p!==phBody) p.style.display='none'; });
      if(phBody){ phBody.remove(); phBody = null; }
      if(panel){                                     // 작성됨 → 그 세대 전체 표시
        panel.style.display = '';
        // 세대 항목에 값 있으면 그 세대 것, 없으면(=main) top-level CHAR_* 폴백(중복 저장 방지)
        paintStats(it.stats || window.CHAR_STATS, panel.querySelector('.statbars'));
        paintMeta(it.meta || window.CHAR_META);
        paintWardrobe(it.wardrobe || window.CHAR_WARDROBE);
      } else {                                       // 미작성 → 플레이스홀더("기록 없음")
        phBody = document.createElement('div'); phBody.className = 'gen-panel'; phBody.innerHTML = phHTML(it);
        fileArea.appendChild(phBody);
        var _cm = window.CHAR_META || {};            // 상단바 record·소속은 캐릭터 맥락 유지. 프레임 글자(code)는 영문 이름 전용(단일 출처) → 미작성이면 비움
        paintMeta(it.meta || { record:_cm.record, crumb:_cm.crumb, sector:_cm.sector, id:_cm.id, code:'' });
        paintWardrobe(it.wardrobe || []);            // 옷장은 비움(이 세대 의상 없음)
      }
    }

    // 타임라인 UI 생성 (topbar 우측)
    var line = document.createElement('div'); line.className = 'genline'; line.setAttribute('aria-label','세대 전환');
    items.forEach(function(it, idx){
      var g = document.createElement('div'); g.className = 'gen'; g.setAttribute('data-gen', it.id);
      g.innerHTML = '<span class="dot"></span><span class="glab">'+(it.label||it.id)+'</span><span class="gsub">'+(it.sub||'')+'</span>';
      g.addEventListener('click', function(){ switchTo(it.id); });
      line.appendChild(g);
      if(idx < items.length-1){ var sg = document.createElement('div'); sg.className = 'genseg'; line.appendChild(sg); }
    });
    if(topbar) topbar.appendChild(line);

    // 세대 종류별 기본 플레이스홀더 문구(전 캐릭터 공통). 항목에 phName/phNote/phIcon 있으면 덮어씀.
    var PH_DEFAULTS = {   // 미작성 세대 플레이스홀더 기본값(항목에 phName/phNote/phIcon 있으면 덮어씀)
      ORIGIN: { icon:'✧', name:'원형', note:'미작성' },
      DUMMY:  { icon:'?', name:'더미',   note:'미작성' }
    };
    function phData(it){ var d = PH_DEFAULTS[it.sub] || {};
      return { icon: it.phIcon || d.icon || '?', name: it.phName || d.name || '기록 없음', note: it.phNote || d.note || '준비중' }; }
    function hidePh(){ if(ph){ ph.remove(); ph = null; } }
    function showPh(it){ hidePh(); var p = phData(it); ph = document.createElement('div'); ph.className = 'stage-ph';
      ph.innerHTML = '<div class="pht">'+p.icon+'</div><div class="phn">'+p.name+'</div>'+
                     '<div class="phs">'+(it.sub||'')+' · '+p.note+'</div>';
      stage.appendChild(ph); }
    function phHTML(it){ var p = phData(it); return ''+
      '<div class="namehead span2"><div class="eyebrow">'+(it.label||'')+' · '+(it.sub||'')+'</div>'+
      '<div class="kr">'+p.name+' <span class="en">'+(it.sub||'')+'</span></div></div>'+
      '<div class="card span2"><div class="card-h"><span class="idx">◇</span><h3>Records</h3><span class="kr-sub">'+p.note+'</span></div>'+
      '<div class="card-b prose"></div></div>'; }
    function paintAxis(sel){
      var si = order.indexOf(sel);
      line.querySelectorAll('.gen').forEach(function(g){ var n = g.getAttribute('data-gen'), ni = order.indexOf(n);
        g.classList.remove('on','past'); if(n===sel) g.classList.add('on'); else if(ni<si) g.classList.add('past'); });
      line.querySelectorAll('.genseg').forEach(function(s,i){ if(i<si) s.classList.add('fill'); else s.classList.remove('fill'); });
    }
    function applyStage(it){
      // 세대별 대표색 : 비대표 세대는 동적 <style>로 라이트/다크 각각 덮어씀(인라인은 두 테마를 다 덮으니 X).
      //   대표 세대는 이 <style>를 비워 페이지 기본 <style>(accent/accent_light)을 그대로 씀.
      if(it.main){ if(genAccentEl) genAccentEl.textContent=''; }
      else {
        var _d=it.accent, _l=it.accent_light||it.accent;
        if(_d){ if(!genAccentEl){ genAccentEl=document.createElement('style'); document.head.appendChild(genAccentEl); }
          genAccentEl.textContent=':root,:root[data-theme="dark"]{--accent:'+_d+'}:root[data-theme="light"]{--accent:'+(_l||_d)+'}'; }
        else if(genAccentEl){ genAccentEl.textContent=''; }   // 색 없는 비대표(플레이스홀더 등)=기본색
      }
      // 무대 뒤 세로 코드명(bg-type)도 세대 따라 바뀜 — 항목 code 우선, 없으면 메인=CHAR_META.code / 그 외=sub
      var bgt = document.querySelector('.bg-type');
      if(bgt) bgt.textContent = it.code || (it.main ? ((window.CHAR_META && CHAR_META.code) || '') : (it.sub || ''));
      var real = !!it.img;
      stage.classList.toggle('fx-off', !real);         // 플레이스홀더 = 효과 숨김
      if(real){ if(stageArt){ stageArt.src = it.img; stageArt.style.display=''; }
                if(stageGhost){ stageGhost.src = it.img; stageGhost.style.display=''; } hidePh(); setArtCredit(it.artist); }
      else { if(stageArt) stageArt.style.display='none'; if(stageGhost) stageGhost.style.display='none'; showPh(it); setArtCredit(''); }
      applyFx(real ? (it.effect || []) : []);           // 컨트롤러 효과 교체(켜짐/꺼짐 스위치는 applyFx가 존중)
    }
    function switchTo(sel){
      if(sel === curId) return;
      var it = byId(sel);
      stage.classList.add('switching');
      if(fileArea){ fileArea.style.transition = 'opacity .3s ease'; fileArea.style.opacity = '0'; }
      setTimeout(function(){
        applyStage(it);
        renderGenPanel(it, sel);
        stage.classList.remove('switching');
        if(fileArea) fileArea.style.opacity = '1';
      }, 240);
      paintAxis(sel); curId = sel;
    }

    // 초기 상태 적용
    paintAxis(curId);
    var c0 = byId(curId); applyStage(c0);
    renderGenPanel(c0, curId);

    // 외부(작성 툴 미리보기)에서 iframe 재생성 없이 세대 전환(부드러운 내부 전환)하도록 노출 — 번쩍임 방지.
    window.__genSwitch = switchTo;
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGens);
  else initGens();
})();

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
  function openBox(box){
    rememberPad(box);
    box.style.paddingTop = box.dataset.padT; box.style.paddingBottom = box.dataset.padB;
    box.style.maxHeight = box.scrollHeight + 'px';
    box.addEventListener('transitionend', function te(e){
      if(e.propertyName !== 'max-height') return;
      box.style.maxHeight = 'none';   // 다 열린 뒤엔 고정 높이를 풀어줘야 내용이 늘어나도 안 잘림
      box.removeEventListener('transitionend', te);
    });
  }
  function closeBox(box, onDone){
    rememberPad(box);
    box.style.maxHeight = box.scrollHeight + 'px';   // 'none'이던 높이를 실제 px로 고정(트랜지션 시작점 확보)
    requestAnimationFrame(function(){
      box.style.maxHeight = '0px'; box.style.paddingTop = '0px'; box.style.paddingBottom = '0px';
    });
    box.addEventListener('transitionend', function te(e){
      if(e.propertyName !== 'max-height') return;
      box.removeEventListener('transitionend', te);
      if(onDone) onDone();
    });
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

// 읽기 모드(2026-08-01) — 옷장·무대(.left-fixed) 오른쪽 끝의 작은 탭(.stage-fold-tab)으로 접고,
//   서술카드(.file)만 넓게 본다. 탭 자체가 패널 경계에 걸쳐 있어 "이걸 누르면 옆이 접힌다"가 모양으로 보이므로
//   글자 라벨 대신 화살표 방향(‹ 접기 / › 펼치기)만 바꾼다.
//   ★방문 취향을 기억하지 않음(FX/SCAN 스위치와 다른 점) — 새로고침·다른 캐릭터로 이동하면 항상 기본값(펼침)으로 돌아온다.
(function(){
  var btn = document.getElementById('stageViewToggle'), sheet = document.querySelector('.sheet');
  if(!btn || !sheet) return;
  var expanded = true;
  function paint(){
    sheet.classList.toggle('read-mode', !expanded);
    btn.textContent = expanded ? '‹' : '›';
    btn.title = expanded ? '옷장·무대 접기' : '옷장·무대 펼치기';
  }
  paint();
  btn.addEventListener('click', function(){
    expanded = !expanded;
    paint();
  });
})();
