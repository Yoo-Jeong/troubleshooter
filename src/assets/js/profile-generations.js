/* ============================================================
   TS·OS — 캐릭터 프로필 · 세대 전환 (선택 기능 · 데이터로 켜짐) — window.CHAR_GENERATIONS
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

   ▷ profile.js(반드시 먼저 로드)의 paintWardrobe/paintMeta/paintStats/setArtCredit을
     window.__paintWardrobe·window.__paintMeta·window.__paintStats·window.__setArtCredit으로 빌려 씀
     (세대 전환 시 그 세대 데이터로 다시 그리기 위함 — 두 파일이 같은 함수를 따로 구현하지 않도록).
   ============================================================ */
(function(){
  'use strict';
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
        //   보일 수 있다 — 이 토글만은 트랜지션을 잠깐 끄고 즉시 바뀌게 한다.
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
    //   (세대 2개 이상인 캐릭터는 본문이 .gen-panel[data-gen] 로 나뉘어 있음. 단일 세대는 위에서 이미 return.)
    var phBody = null;   // 미작성 세대일 때 임시로 넣는 플레이스홀더 본문
    function renderGenPanel(it, sel){
      var panel = fileArea.querySelector('.gen-panel[data-gen="'+sel+'"]');   // 이 세대 프로필이 작성돼 있으면 패널이 있음
      fileArea.querySelectorAll('.gen-panel[data-gen]').forEach(function(p){ if(p!==phBody) p.style.display='none'; });
      if(phBody){ phBody.remove(); phBody = null; }
      if(panel){                                     // 작성됨 → 그 세대 전체 표시
        panel.style.display = '';
        // 세대 항목에 값 있으면 그 세대 것, 없으면(=main) top-level CHAR_* 폴백(중복 저장 방지)
        window.__paintStats(it.stats || window.CHAR_STATS, panel.querySelector('.statbars'));
        window.__paintMeta(it.meta || window.CHAR_META);
        window.__paintWardrobe(it.wardrobe || window.CHAR_WARDROBE);
      } else {                                       // 미작성 → 플레이스홀더("기록 없음")
        phBody = document.createElement('div'); phBody.className = 'gen-panel'; phBody.innerHTML = phHTML(it);
        fileArea.appendChild(phBody);
        var _cm = window.CHAR_META || {};            // 상단바 record·소속은 캐릭터 맥락 유지. 프레임 글자(code)는 영문 이름 전용(단일 출처) → 미작성이면 비움
        window.__paintMeta(it.meta || { record:_cm.record, crumb:_cm.crumb, sector:_cm.sector, id:_cm.id, code:'' });
        window.__paintWardrobe(it.wardrobe || []);   // 옷장은 비움(이 세대 의상 없음)
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
      // 무대 뒤 세로 코드명(bg-type = data-meta="code" 요소, character.html 참고)은 renderGenPanel이
      //   paintMeta로 채운다(아래 codeFor 참고) — 여기서 따로 건드리면 renderGenPanel 호출 때 바로 덮여써짐.
      var real = !!it.img;
      stage.classList.toggle('fx-off', !real);         // 플레이스홀더 = 효과 숨김
      if(real){ if(stageArt){ stageArt.src = it.img; stageArt.style.display=''; }
                if(stageGhost){ stageGhost.src = it.img; stageGhost.style.display=''; } hidePh(); window.__setArtCredit(it.artist); }
      else { if(stageArt) stageArt.style.display='none'; if(stageGhost) stageGhost.style.display='none'; showPh(it); window.__setArtCredit(''); }
      applyFx(real ? (it.effect || []) : []);           // 컨트롤러 효과 교체(켜짐/꺼짐 스위치는 applyFx가 존중)
    }
    function switchTo(sel){
      if(sel === curId) return;
      var it = byId(sel);
      var ms = document.querySelector('.mscreen');   // 세대 전환 = 다른 캐릭터 보듯 새로 시작 → 스크롤을 맨 위로
      if(ms) ms.scrollTop = 0;
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
