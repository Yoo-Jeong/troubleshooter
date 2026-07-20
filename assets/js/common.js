/* ============================================================
   TS·OS  —  공통 동작 (테마 토글 + 시계 + 기기 크롬 주입)
   이 파일 하나만 고치면 홈·도감 전 페이지에 반영됩니다.
   ============================================================ */

/* 1) 테마 + 홈 디스플레이 모드를 렌더 전에 즉시 적용 (깜빡임 방지) — <head>에서 실행됨
   · URL ?home=pcb|terminal 로 모드 강제(프리뷰 iframe용, localStorage 안 건드림)
   · URL ?bare=1 이면 부팅/설정톱니 생략(프리뷰 iframe용) → data-bare */
(function(){
  var r = document.documentElement, forced = null, bare = false;
  try{ var q = new URLSearchParams(location.search); forced = q.get('home'); bare = q.has('bare'); }catch(e){}
  try{ r.setAttribute('data-theme', localStorage.getItem('ts-theme') || 'dark'); }
  catch(e){ r.setAttribute('data-theme','dark'); }
  try{ r.setAttribute('data-home', forced || localStorage.getItem('ts-home') || 'pcb'); }
  catch(e){ r.setAttribute('data-home','pcb'); }
  if(bare) r.setAttribute('data-bare','1');
})();

/* 공유 데이터 — 홈 디스플레이 모드 목록(단일 출처).
   SYSTEM CONFIG 패널과 display_preview.html 이 함께 참조. 모드 추가는 여기 한 곳만.
   ※ head 최상위에서 노출 → 본문 인라인 스크립트(프리뷰)가 파싱 시점에 읽을 수 있음 */
window.TS_HOME_MODES = [
  { id:'pcb',      name:'PCB 모드',    desc:'회로형 홈 · 노드 배선' },
  { id:'terminal', name:'터미널 모드', desc:'콘솔형 홈 · 커맨드 로그' }
];

/* 2) DOM 준비되면 공통 크롬 주입 + 토글/시계 연결 */
document.addEventListener('DOMContentLoaded', function(){
  // 기기 외곽(베젤·광택·스피커·각인)을 페이지마다 안 적어도 되게 여기서 주입
  if(!document.querySelector('.device')){
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="device"></div>'+
      '<div class="fx"></div>');
  }

  // 좌상단 로고+OS명 = 홈(index) 복귀 버튼 (모든 페이지 공통)
  (function(){
    var lg = document.querySelector('.osbar .lg');
    if(!lg || (lg.parentNode && lg.parentNode.classList && lg.parentNode.classList.contains('home'))) return;
    var p = location.pathname;
    var sub = /\/(myt|lab|backup|modes)\//.test(p);             // 하위 폴더 페이지
    var home = sub ? '../index.html' : 'index.html';
    var isHome = !sub && /(^|\/)(index\.html)?$/.test(p); // 루트 index.html 또는 '/'
    var osbar = lg.parentNode;
    var a = document.createElement('a');
    a.className = 'home' + (isHome ? ' here' : '');
    a.href = home; a.setAttribute('aria-label', '홈으로');
    if(!isHome) a.setAttribute('data-ts', 'fade');        // 복귀는 조용한 페이드
    osbar.insertBefore(a, lg);
    a.appendChild(lg);
    var os = osbar.querySelector('.os'); if(os) a.appendChild(os);
  })();

  // 테마 토글 버튼 (#themeBtn 이 있는 페이지에서만)
  var root = document.documentElement;
  var btn = document.getElementById('themeBtn');
  if(btn){
    btn.addEventListener('click', function(){
      var t = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', t);
      try{ localStorage.setItem('ts-theme', t); }catch(e){}
    });
  }

  // 시계 (#clock 이 있는 페이지에서만)
  function z(n){ return (n<10?'0':'')+n; }
  function tick(){
    var e = document.getElementById('clock');
    if(e){ var d = new Date(); e.textContent = z(d.getHours())+':'+z(d.getMinutes()); }
  }
  tick(); setInterval(tick, 1000);

  // ===== SYSTEM CONFIG — 전 페이지 공통 (톱니 버튼 + 우측 패널 주입) =====
  (function(){
    if(document.documentElement.hasAttribute('data-bare')) return;   // 프리뷰 iframe 에선 설정 UI 생략
    var osRight = document.querySelector('.osbar .right');
    if(!osRight) return;
    var sub = /\/(myt|lab|backup|modes)\//.test(location.pathname);
    var pvHref = (sub ? '../' : '') + 'transitions_preview.html';
    var dpHref = (sub ? '../' : '') + 'display_preview.html';

    if(!document.getElementById('cfgBtn')){
      osRight.insertAdjacentHTML('beforeend',
        '<span class="dv"></span>' +
        '<button class="gear" id="cfgBtn" title="시스템 설정" aria-label="시스템 설정">⚙</button>');
    }
    if(!document.getElementById('cfg')){
      document.body.insertAdjacentHTML('beforeend',
        '<div class="cfg-scrim" id="cfgScrim"></div>' +
        '<div class="cfg-clip">' +               /* 단말기 화면 영역으로 클립 → 패널이 화면 안에서 슬라이드 */
        '<aside class="cfg" id="cfg" aria-label="시스템 설정" aria-hidden="true">' +
          '<div class="cfg-hd"><div class="ti">SYSTEM <b>CONFIG</b> · 시스템 설정</div>' +
            '<button class="x" id="cfgClose" aria-label="닫기">✕</button></div>' +
          '<div class="cfg-bd">' +
            '<div class="cfg-sec"><div class="sh">DISPLAY MODE · 디스플레이 모드</div>' +
              '<div class="sd">홈 화면 레이아웃을 선택합니다. 콘텐츠는 그대로, 표시 형식만 바뀝니다. 선택은 다음 방문에도 유지됩니다.</div>' +
              '<div id="modeList"></div>' +
              '<a class="cfg-link" href="' + dpHref + '" target="_blank" rel="noopener" style="margin-top:2px">모드 프리뷰 열기 <span class="ar">↗</span></a></div>' +
            '<div class="cfg-sec"><div class="sh">TRANSITION PREVIEW · 화면 전환</div>' +
              '<div class="sd">적용된 화면 전환 목록을 비교·재생합니다.</div>' +
              '<a class="cfg-link" href="' + pvHref + '" target="_blank" rel="noopener">트랜지션 프리뷰 열기 <span class="ar">↗</span></a></div>' +
            '<div class="cfg-sec"><div class="sh">BUILD LOG · 빌드 기록</div>' +
              '<div class="sd">이 아카이브에 적용된 갱신 이력.</div>' +
              '<ul class="cfg-log" id="buildLog"></ul></div>' +
          '</div></aside></div>');
    }

    // 홈 디스플레이 모드 목록 — 단일 출처(window.TS_HOME_MODES). 모드 추가는 그곳에서.
    var HOME_MODES = window.TS_HOME_MODES;
    // 빌드 로그 — 실제 개발 이력을 세계관 톤으로 (최신이 위, neu=true 면 시안 강조)
    var BUILD_LOG = [
      { dt:'2026.07', tx:'SYSTEM CONFIG 전 페이지 공통화 · 톱니 / 패널 모듈', neu:true },
      { dt:'2026.07', tx:'홈 복귀 링크(로고 · ROOT) 활성화' },
      { dt:'2026.07', tx:'홈 디스플레이 모드(PCB / 터미널) 전환 추가' },
      { dt:'2026.07', tx:'화면 전환 모듈 확장 · scan / slide 계열' },
      { dt:'2026.07', tx:'SECTOR 01 · 인물 기록 6건 등록' },
      { dt:'2026.07', tx:'통합 아카이브 단말기(TS·OS) 초기화' }
    ];

    function curMode(){ return root.getAttribute('data-home') || 'pcb'; }
    function revealTerm(){   // 터미널 콘솔 행 순차 노출 (홈에만 존재, 그 외엔 no-op)
      document.querySelectorAll('.m-terminal .cmd').forEach(function(r,i){
        setTimeout(function(){ r.classList.add('reveal'); }, i*110);
      });
    }
    function setMode(id){
      if(id === curMode()) return;
      try{ localStorage.setItem('ts-home', id); }catch(e){}
      var apply = function(){ root.setAttribute('data-home', id); renderModes(); if(id === 'terminal') revealTerm(); };
      // 홈 화면에선 "재구성" 전환 연출로 교체, 그 외엔 즉시
      if(window.TS && TS.reconfig && document.querySelector('.home-mode')) TS.reconfig('reconfiglog', apply);
      else apply();
    }
    function renderModes(){
      var box = document.getElementById('modeList'); if(!box) return;
      box.innerHTML = '';
      HOME_MODES.forEach(function(m){
        var b = document.createElement('button'); b.type = 'button';
        b.className = 'cfg-opt' + (curMode() === m.id ? ' sel' : '');
        b.innerHTML = '<span class="rd"></span><span class="oi"><span class="on">'+m.name+'</span><span class="od">'+m.desc+'</span></span>';
        b.addEventListener('click', function(){ setMode(m.id); });
        box.appendChild(b);
      });
    }
    function renderLog(){
      var ul = document.getElementById('buildLog'); if(!ul) return;
      ul.innerHTML = BUILD_LOG.map(function(e){
        return '<li'+(e.neu?' class="new"':'')+'><span class="dt">['+e.dt+']</span> '+e.tx+'</li>';
      }).join('');
    }

    var cfg = document.getElementById('cfg'), scrim = document.getElementById('cfgScrim'), gearBtn = document.getElementById('cfgBtn');
    function openCfg(){ cfg.classList.add('open'); scrim.classList.add('open'); gearBtn.classList.add('on'); cfg.setAttribute('aria-hidden','false'); }
    function closeCfg(){ cfg.classList.remove('open'); scrim.classList.remove('open'); gearBtn.classList.remove('on'); cfg.setAttribute('aria-hidden','true'); }
    gearBtn.addEventListener('click', function(){ cfg.classList.contains('open') ? closeCfg() : openCfg(); });
    document.getElementById('cfgClose').addEventListener('click', closeCfg);
    scrim.addEventListener('click', closeCfg);
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeCfg(); });
    renderModes(); renderLog();
  })();
});
