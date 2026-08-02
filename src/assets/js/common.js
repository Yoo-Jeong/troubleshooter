/* ============================================================
   TS·OS  —  공통 동작 (테마 토글 + 시계 + 기기 크롬 주입)
   이 파일 하나만 고치면 홈·캐릭터 목록 전 페이지에 반영됩니다.
   ============================================================ */

// 이 스크립트 자신이 실제로 로드된 주소를 지금(동기 실행 중) 잡아둔다 — TSROOT()가 이걸로 사이트 루트를 계산.
//   DOMContentLoaded 안(비동기)에서 document.currentScript를 읽으면 이미 null이라 반드시 여기서 미리 저장해야 함.
var TS_SELF_SRC = document.currentScript && document.currentScript.src;

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

/* 1.5) 사원증(idcard) 이미지가 없거나 깨졌을 때 → 점선 플레이스홀더로 대체.
   프로필 작성 툴 미리보기와 실제 캐릭터 페이지가 똑같이 보이도록 여기(공용)에 둔다.
   ※ .idcard-stage 안의 <img> 에만 적용(다른 이미지엔 영향 없음). */
(function idcardPlaceholder(){
  // 점선 박스 + 이미지 글리프(회색). 브라우저 기본 '깨진 이미지' 아이콘 방지.
  var PH = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='340' height='214'%3E%3Crect x='2' y='2' width='336' height='210' rx='8' fill='%23808080' fill-opacity='0.05' stroke='%23808080' stroke-opacity='0.4' stroke-width='2' stroke-dasharray='8 7'/%3E%3Cg fill='%23808080' fill-opacity='0.45'%3E%3Ccircle cx='170' cy='90' r='15'/%3E%3Cpath d='M124 142 l30 -34 20 22 18 -20 24 32 z'/%3E%3C/g%3E%3C/svg%3E";
  function fix(img){ if(img.dataset.ph) return; img.dataset.ph = 1; img.src = PH; img.style.objectFit = 'contain'; img.style.opacity = '.82'; }
  // 파일명이 틀려 로드 실패한 경우 → 즉시 교체
  document.addEventListener('error', function(e){
    var t = e.target;
    if(t && t.tagName === 'IMG' && t.closest && t.closest('.idcard-stage')) fix(t);
  }, true);
  // 파일명이 아예 비었을 때 → 전체 로드 후 한 번 검사
  addEventListener('load', function(){
    document.querySelectorAll('.idcard-stage img').forEach(function(img){
      if(!img.getAttribute('src') || !img.naturalWidth) fix(img);
    });
  });
})();

/* 공유 데이터 — 홈 디스플레이 모드 목록(단일 출처).
   ※ head 최상위에서 노출 → 본문 인라인 스크립트(프리뷰)가 파싱 시점에 읽을 수 있음

   · TS_HOME_MODES    = SYSTEM CONFIG 설정 패널의 "선택 가능" 모드(2종). 실제로 홈에서 켤 수 있는 것.
   · TS_PREVIEW_MODES = display_preview.html 이 보여주는 전체 모드(4종). exp:true 는 실험(미리보기 전용).
   각 모드의 실제 화면은 modes/index_<id>.html 한 곳에만 있음(단일 출처). */
window.TS_HOME_MODES = [
  { id:'pcb',      name:'PCB 모드',    desc:'회로형 홈 · 노드 배선' },
  { id:'terminal', name:'터미널 모드', desc:'콘솔형 홈 · 커맨드 로그' }
];
window.TS_PREVIEW_MODES = window.TS_HOME_MODES.concat([
  { id:'minimal', name:'미니멀 모드', desc:'중앙 링 + 하단 그리드 nav', exp:true },
  { id:'orbit',   name:'Orbit 모드', desc:'3D 틸트 궤도 + 글래스 메뉴', exp:true }
]);

/* 2) DOM 준비되면 공통 크롬 주입 + 토글/시계 연결 */
document.addEventListener('DOMContentLoaded', function(){
  // 기기 외곽(베젤·광택·스피커·각인)을 페이지마다 안 적어도 되게 여기서 주입
  if(!document.querySelector('.device')){
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="device"></div>'+
      '<div class="fx"></div>');
  }

  // 현재 페이지 → 사이트 루트까지의 접두어.
  //   ★이 스크립트(common.js)는 항상 "<사이트 루트>/assets/js/common.js"에 있다는 사실을 이용 —
  //   자신이 실제로 로드된 주소(TS_SELF_SRC)에서 "assets/js/common.js…" 뒷부분을 떼어내면 사이트 루트가 나온다.
  //   이 방식은 사이트가 도메인 루트(username.github.io/)에 있든, GitHub Pages 프로젝트 페이지처럼
  //   하위경로(username.github.io/저장소이름/)에 있든 항상 정확하다(예전엔 URL 슬래시 개수만 세서
  //   "../"를 몇 개 붙일지 계산했는데, 그건 사이트가 도메인 루트에 있다고 가정한 계산이라 하위경로
  //   배포에선 한 단계씩 부족해 로고·SYSTEM CONFIG 링크가 사이트 바깥으로 새는 버그가 있었음, 2026-08-02).
  function TSROOT(){
    if(TS_SELF_SRC){
      var m = TS_SELF_SRC.match(/^(.*\/)assets\/js\/common\.js(?:[?#].*)?$/);
      if(m) return m[1];
    }
    // 위 방법이 안 통할 때(스크립트 태그를 다른 이름/경로로 불러온 경우 등)만 예전 방식으로 대체.
    var dir = location.pathname.replace(/[^/]*$/, '');          // 파일명 제거 → 디렉토리
    var depth = (dir.match(/\//g) || []).length - 1;            // 슬래시 수 - 1(선두)
    return depth > 0 ? new Array(depth + 1).join('../') : '';
  }

  // 좌상단 로고+OS명 = 홈(index) 복귀 버튼 (모든 페이지 공통)
  (function(){
    var lg = document.querySelector('.osbar .lg');
    if(!lg || (lg.parentNode && lg.parentNode.classList && lg.parentNode.classList.contains('home'))) return;
    var pfx = TSROOT();                                         // 루트까지 접두어(이제 절대 URL일 수도 있음)
    var home = pfx + 'index.html';
    // ★TSROOT()가 이제 상대경로("../")뿐 아니라 절대 URL도 돌려줄 수 있어서, 예전처럼 pfx==='' 로
    //   "지금이 루트냐"를 판단할 수 없다 — 두 후보(홈 파일 자체 · 파일명 없이 폴더로 접속한 경우) 모두
    //   절대 URL로 정규화해 지금 주소와 직접 비교(도메인 루트든 하위경로든 항상 정확).
    var hereAbs = location.href.split(/[?#]/)[0];
    var isHome = hereAbs === new URL(home, location.href).href || hereAbs === new URL(pfx || '.', location.href).href;
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
    var pfx = TSROOT();
    var pvHref = pfx + 'transitions_preview.html';
    var dpHref = pfx + 'display_preview.html';
    // '이 캐릭터 편집' 진입점 — 캐릭터 상세 페이지(/characters/<슬러그>/)에서만 노출.
    var charMatch = location.pathname.match(/\/characters\/([^\/]+)\/(?:index\.html)?$/);
    var charEditSec = '';
    if(charMatch){
      var editHref = pfx + 'tools/profile-builder.html?load=' + encodeURIComponent(charMatch[1]);
      charEditSec =
        '<div class="cfg-sec"><div class="sh">EDIT · 이 캐릭터 편집</div>' +
          '<div class="sd">이 캐릭터의 프로필을 편집 툴에서 엽니다. 현재 내용이 자동으로 불러와집니다.</div>' +
          '<a class="cfg-link" href="' + editHref + '" target="_blank" rel="noopener">✎ 이 캐릭터 편집 열기 <span class="ar">↗</span></a></div>';
    }
    // '새 캐릭터 추가' 진입점 — 캐릭터 목록 페이지(/characters.html)에서만 노출.
    var newCharSec = '';
    if(/\/characters\.html$/.test(location.pathname)){
      var newHref = pfx + 'tools/profile-builder.html?new=1';
      newCharSec =
        '<div class="cfg-sec"><div class="sh">NEW · 새 캐릭터</div>' +
          '<div class="sd">빈 편집 툴을 열어 새 캐릭터를 만듭니다.</div>' +
          '<a class="cfg-link" href="' + newHref + '" target="_blank" rel="noopener">＋ 새 캐릭터 추가 <span class="ar">↗</span></a></div>';
    }

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
          '<div class="cfg-bd">' + charEditSec + newCharSec +
            '<div class="cfg-sec"><div class="sh">ENVIRONMENT · 권장 환경</div>' +
              '<div class="sd">데스크탑 · 1280×800 이상 권장</div></div>' +
            '<div class="cfg-sec"><div class="sh">DISPLAY MODE · 디스플레이 모드</div>' +
              '<div class="sd">홈 화면 레이아웃을 선택합니다. 콘텐츠는 그대로, 표시 형식만 바뀝니다. 선택은 다음 방문에도 유지됩니다.</div>' +
              '<div id="modeList"></div>' +
              '<a class="cfg-link" href="' + dpHref + '" target="_blank" rel="noopener" style="margin-top:2px">모드 프리뷰 열기 <span class="ar">↗</span></a></div>' +
            '<div class="cfg-sec"><div class="sh">TRANSITION PREVIEW · 화면 전환</div>' +
              '<div class="sd">적용된 화면 전환 목록을 비교·재생합니다.</div>' +
              '<a class="cfg-link" href="' + pvHref + '" target="_blank" rel="noopener">트랜지션 프리뷰 열기 <span class="ar">↗</span></a></div>' +
            '<div class="cfg-sec"><div class="sh">BUILD LOG · 빌드 기록</div>' +
              '<div class="sd">이 데이터베이스에 적용된 갱신 이력.</div>' +
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
      { dt:'2026.07', tx:'통합 데이터베이스 단말기(TS·OS) 초기화' }
    ];

    function curMode(){ return root.getAttribute('data-home') || 'pcb'; }
    function setMode(id){
      if(id === curMode()) return;
      try{ localStorage.setItem('ts-home', id); }catch(e){}
      root.setAttribute('data-home', id);
      renderModes();
      // 홈(index)에선 로더(TS_loadHome)가 화면 조각을 교체 → "재구성" 연출과 함께.
      // 다른 페이지엔 로더가 없으니 저장만 하고 다음 홈 방문에 반영.
      if(window.TS_loadHome){
        if(window.TS && TS.reconfig) TS.reconfig('reconfiglog', function(){ window.TS_loadHome(id); });
        else window.TS_loadHome(id);
      }
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
