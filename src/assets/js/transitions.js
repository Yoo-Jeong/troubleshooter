/* ============================================================
   TS·OS  —  공통 페이지 트랜지션 모듈  (window.TS)
   페이지 이동에 통일된 전환을 입히는 라이브러리.
   ------------------------------------------------------------
   설치 (head, common.js 뒤 순서 권장):
     <link rel="stylesheet" href="css/common.css">
     <link rel="stylesheet" href="css/transitions.css">
     <script src="js/common.js"></script>
     <script src="js/transitions.js"></script>
   사용:
     · 링크에 data-ts 만 달면 자동 처리 (권장):
         <a href="characters.html" data-ts="accesslog">CHARACTER</a>
         <a href="index.html"      data-ts="fade">◂ back</a>   (복귀는 조용히)
     · 수동 호출:  TS.go('characters.html','accesslog')
     · 첫 진입 부팅(세션당 1회 자동 스킵):  TS.boot({ onDone:fn })
   전환 스타일:  'accesslog' | 'scan-access' | 'scan' | 'slide-left' | 'slide-up' | 'resync' | 'fade' | 'grant' | 'instant'
   ('grant' = 조용한 페이드 + ● ACCESS GRANTED. 스캔·로그 없이 깔끔한 접속 승인 연출)
   ------------------------------------------------------------
   설계 메모: 실제 페이지는 별도 파일(index/characters/myt)이라
   "오버레이 핸드오프" 방식 — 나가는 쪽이 애니메이션을 재생하고
   sessionStorage 에 표식을 남기면, 도착한 쪽이 커버를 걷어내며
   콘텐츠를 드러낸다. 상·하단 기기 크롬은 양쪽이 동일하므로
   전환 내내 화면이 "같은 단말기 세션"으로 읽힌다.
   ============================================================ */
(function(){
  'use strict';
  var TS = window.TS = window.TS || {};

  var HANDOFF = 'ts-fx';       // 페이지 넘김 표식 (도착 쪽이 읽음)
  var BOOTED  = 'ts-booted';   // 세션 부팅 완료 표식

  var reduce = false;
  try{ reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; }catch(e){}

  /* 페이지에서 TS.config.xxx 로 덮어쓸 수 있는 설정 */
  var CFG = TS.config = {
    type:      4,     // 로그 글자 타이핑 간격(ms) — 빠르게
    linePause: 22,    // 로그 줄 간격(ms)
    revealMs:  460,   // 도착해서 커버를 걷어내는 시간
    fadeMs:    340,   // fade 스타일 길이 (복귀용)
    log: ['> ACCESSING CHARACTERS_DB','> AUTHORIZING · AGENT','> DECRYPTING RECORDS'],
    bootSteps: [
      'POWER ON · TS-TERM MDL-2','ESTABLISHING SECURE LINK',
      'AUTHENTICATING AGENT','HANDSHAKE · CENTRAL DATABASE','CHANNEL ENCRYPTED'
    ]
  };

  /* sessionStorage 안전 래퍼 (프라이빗 모드 등에서 예외 방지) */
  function get(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
  function set(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} }
  function del(k){ try{ sessionStorage.removeItem(k); }catch(e){} }

  /* ============================================================
     (A) 도착 즉시 커버 주입 — head 파싱 시점에 실행.
         body 가 아직 없을 수 있어 documentElement 에 붙였다가
         reveal() 에서 걷어낸다. 목적지 콘텐츠가 번쩍이지 않게.
     ============================================================ */
  (function injectCover(){
    if(!get(HANDOFF)) return;
    var c = document.createElement('div');
    c.className = 'ts-cover'; c.id = 'ts-cover';
    (document.body || document.documentElement).appendChild(c);
  })();

  /* ============================================================
     (B) 도착 reveal — 저장된 스타일대로 커버를 걷어낸다.
     ============================================================ */
  function reveal(){
    var c = document.getElementById('ts-cover');
    var raw = get(HANDOFF); del(HANDOFF);
    if(!c) return;
    if(!raw || reduce){ c.parentNode && c.parentNode.removeChild(c); return; }

    var style = 'accesslog';
    try{ style = (JSON.parse(raw) || {}).style || style; }catch(e){}

    if(style === 'instant'){ c.parentNode && c.parentNode.removeChild(c); return; }

    // slide-* : 실제 화면(.screen)이 방향에 맞게 미끄러져 들어옴 (커버는 slideIn 이 제거)
    if(isSlide(style)){ slideIn(slideAxis(style)); return; }
    // scan(render) : 스캔 라인이 위→아래로 내려가며 라인 단위로 페이지를 그려냄
    if(style === 'scan'){
      c.classList.add('render');
      var sc = document.createElement('div'); sc.className = 'ts-scan render'; c.appendChild(sc);
      requestAnimationFrame(function(){ c.classList.add('go'); sc.classList.add('go'); });
      setTimeout(function(){ c.parentNode && c.parentNode.removeChild(c); }, 740);
      return;
    }
    // 기본(accesslog · scan-access · fade) : 조용한 opacity 페이드
    var ms = (style === 'fade') ? CFG.fadeMs : CFG.revealMs;
    requestAnimationFrame(function(){
      c.style.transition = 'opacity ' + ms + 'ms ease';
      c.style.opacity = '0';
    });
    setTimeout(function(){ c.parentNode && c.parentNode.removeChild(c); }, ms + 80);
  }

  /* ============================================================
     (C) 나가는 전환 — 애니메이션 재생 후 실제 페이지 이동.
     ============================================================ */
  var busy = false;

  function seal(fx){                    // 이동 직전 스크림을 '즉시' 불투명하게(페이드 없이) → 도착 커버로 매끈히 연결
    var s = fx && fx.querySelector('.scrim');
    // ★transition:background(.18s)를 끄고 바로 불투명으로. 안 그러면 서서히 불투명해지는 사이
    //   location.assign 로딩 중에 반투명 커버 뒤로 이전(홈) 화면이 순간 비친다.
    if(s){ s.style.transition = 'none'; s.style.background = 'var(--bg)'; void s.offsetWidth; }
  }

  TS.go = function(url, style, opts){
    style = style || 'accesslog'; opts = opts || {};
    if(busy || !url) return;

    // 모션 최소화 / instant → 애니메이션 없이 바로 이동
    if(reduce || style === 'instant'){
      set(HANDOFF, JSON.stringify({style:'instant'}));
      location.assign(url); return;
    }
    // slide-* 는 오버레이가 아니라 실제 화면을 밀어낸다 (방향별)
    if(isSlide(style)){
      busy = true;
      slideOut(slideAxis(style), function(){ set(HANDOFF, JSON.stringify({style:style})); location.assign(url); });
      return;
    }
    busy = true;
    var fx = buildFx(style);
    runExit(style, fx, function(){
      seal(fx); set(HANDOFF, JSON.stringify({style:style}));
      // 불투명 커버가 실제로 한 번 그려진 뒤 이동 → 로딩 중 이전(홈) 화면이 비치지 않게.
      //  두 프레임 뒤(그려진 것 보장) 이동, rAF가 멈춘 상황(백그라운드 등) 대비 250ms 폴백. 한 번만.
      var went = false, go = function(){ if(went) return; went = true; location.assign(url); };
      requestAnimationFrame(function(){ requestAnimationFrame(go); });
      setTimeout(go, 250);
    });
  };

  /* 나가는 오버레이 생성 (TS.go · TS.demo 공용) */
  function buildFx(style){
    var fx = document.createElement('div');
    fx.className = 'ts-fx';
    if(style === 'fade' || style === 'scan' || style === 'grant') fx.classList.add('solid');   // 나갈 땐 단색으로 덮음
    if(style === 'resync') fx.classList.add('resync');
    fx.innerHTML = '<div class="scrim"></div>';
    if(style === 'accesslog') fx.insertAdjacentHTML('beforeend', '<div class="log"><div class="box" id="ts-logbox"></div></div>');
    else if(style === 'scan-access' || style === 'resync') fx.insertAdjacentHTML('beforeend', '<div class="ts-scan" id="ts-exscan"></div>');
    if(style === 'fade' || style === 'scan' || style === 'grant') fx.style.transition = 'opacity ' + CFG.fadeMs + 'ms ease';
    document.body.appendChild(fx);
    requestAnimationFrame(function(){ fx.classList.add('on'); });
    return fx;
  }

  /* 스타일별 나가는 연출 재생 → done */
  function runExit(style, fx, done){
    if(style === 'accesslog')        playLog(fx, done);
    else if(style === 'scan-access') playScanAccess(fx, done);
    else if(style === 'resync')      playResync(fx, done);
    else if(style === 'grant')       playGrant(fx, done);
    else                             playFade(done);   // fade · scan(render) · 기타
  }

  /* grant : 조용한 페이드로 덮은 뒤 중앙에 ● ACCESS GRANTED → 이동 (스캔·로그 없음) */
  function playGrant(fx, done){
    var g = document.createElement('div'); g.className = 'grant center mono'; g.textContent = '● ACCESS GRANTED';
    fx.appendChild(g);
    setTimeout(function(){ g.classList.add('go'); }, 200);   // 커버가 차오른 뒤 승인 표시
    setTimeout(done, 640);
  }

  /* resync : 신호 재동기화 글리치(지터 + 스캔라인) → 이동. 끝에 불투명해져 도착 커버로 핸드오프 */
  function playResync(fx, done){
    var s = fx.querySelector('#ts-exscan');
    requestAnimationFrame(function(){ fx.classList.add('go'); if(s) s.classList.add('go'); });
    setTimeout(done, 460);
  }

  /* 접속 로그 타이핑 → ACCESS GRANTED → 이동 */
  function playLog(fx, done){
    var box = fx.querySelector('#ts-logbox'), lines = CFG.log, li = 0;
    (function line(){
      if(li >= lines.length){
        var g = document.createElement('div'); g.className = 'grant'; g.textContent = 'ACCESS GRANTED';
        box.appendChild(g);
        requestAnimationFrame(function(){ g.classList.add('go'); });
        setTimeout(done, 240); return;
      }
      var full = lines[li], ci = 0, d = document.createElement('div'); d.className = 'll'; box.appendChild(d);
      (function ch(){
        if(ci <= full.length){ d.innerHTML = full.slice(0, ci) + '<span class="cur"></span>'; ci++; setTimeout(ch, CFG.type); }
        else{ d.textContent = full; li++; setTimeout(line, CFG.linePause); }
      })();
    })();
  }

  /* scan access : 스캔 빔이 훑고 지나간 뒤 중앙 ACCESS GRANTED → 이동 */
  function playScanAccess(fx, done){
    var s = fx.querySelector('#ts-exscan');
    requestAnimationFrame(function(){ s.classList.add('go'); });
    var g = document.createElement('div'); g.className = 'grant center mono'; g.textContent = '● ACCESS GRANTED';
    fx.appendChild(g);
    setTimeout(function(){ g.classList.add('go'); }, 240);   // 빔이 지나간 뒤 결과 표시
    setTimeout(done, 640);
  }

  /* slide-* : 오버레이가 아니라 실제 화면(.screen)을 밀어낸다. 문서가 분리돼 있어도
     나가는 쪽은 진행 방향으로 빠지고 도착 쪽은 반대편에서 들어와 "진짜 콘텐츠가
     슬라이드"되는 것으로 읽힌다. ax='X'(가로=slide-left) / 'Y'(세로=slide-up). (.device 베젤은 고정) */
  function isSlide(s){ return s === 'slide-left' || s === 'slide-up'; }
  function slideAxis(s){ return s === 'slide-up' ? 'Y' : 'X'; }
  function slideOut(ax, done){
    var scr = document.querySelector('.screen');
    if(!scr){ done(); return; }
    scr.style.transition = 'transform .42s cubic-bezier(.65,0,.25,1)';
    requestAnimationFrame(function(){ scr.style.transform = 'translate' + ax + '(-100%)'; });
    setTimeout(done, 430);
  }
  function slideIn(ax){
    var c = document.getElementById('ts-cover'); if(c && c.parentNode) c.parentNode.removeChild(c);
    var scr = document.querySelector('.screen');
    if(!scr) return;
    scr.style.transition = 'none';
    scr.style.transform = 'translate' + ax + '(100%)';
    void scr.offsetWidth;                        // 시작 위치 확정
    requestAnimationFrame(function(){
      scr.style.transition = 'transform .5s cubic-bezier(.65,0,.25,1)';
      scr.style.transform = 'translate' + ax + '(0)';
    });
    setTimeout(function(){ scr.style.transition = ''; scr.style.transform = ''; }, 540);
  }

  /* 조용한 페이드 (복귀 · scan 렌더의 나가는 연출) */
  function playFade(done){ setTimeout(done, CFG.fadeMs); }

  /* ============================================================
     (C-2) 프리뷰/데모 — 실제 이동 없이 '나가는 연출 → 도착 reveal'
           을 한 자리에서 재생. transitions_preview.html 이 사용.
           실제 코드(buildFx/runExit/reveal)를 그대로 태우므로
           모듈을 고치면 프리뷰에도 즉시 반영된다.
     ============================================================ */
  TS.demo = function(style){
    style = style || 'accesslog';
    if(busy) return; busy = true;
    if(reduce || style === 'instant'){ busy = false; flashArrival(style); return; }
    // 데모는 "콘텐츠가 어떻게 들어오는지"를 보여주는 게 목적 → 진입(slideIn)만 재생
    if(isSlide(style)){ slideIn(slideAxis(style)); setTimeout(function(){ busy = false; }, 560); return; }

    var fx = buildFx(style);
    runExit(style, fx, function(){
      seal(fx);
      if(fx.parentNode) fx.parentNode.removeChild(fx);
      busy = false;
      flashArrival(style);                 // 도착 reveal 시뮬
    });
  };

  /* 도착 reveal 시뮬 : 불투명 커버를 깔고 저장된 스타일대로 걷어냄 */
  function flashArrival(style){
    set(HANDOFF, JSON.stringify({style: style}));
    var c = document.getElementById('ts-cover');
    if(!c){ c = document.createElement('div'); c.className = 'ts-cover'; c.id = 'ts-cover'; document.body.appendChild(c); }
    reveal();
  }

  /* ============================================================
     홈 재구성 전환 — 페이지 이동 없이 홈 디스플레이 모드를 교체.
     applyFn() 이 실제 교체(data-home 스왑). 연출 5종:
       reconfiglog | (scan/fade=커버리빌)
     프리뷰에선 applyFn 없이 연출만 재생 가능.
     ============================================================ */
  var rcBusy = false;
  TS.reconfig = function(style, applyFn){
    style = style || 'reconfiglog'; applyFn = applyFn || function(){};
    if(reduce){ applyFn(); return; }
    if(rcBusy) return; rcBusy = true;
    var done = function(){ rcBusy = false; };
    if(style === 'reconfiglog') rcLog(applyFn, done);
    else                        rcReveal(applyFn, done, style);   // scan/fade
  };
  function rcMake(cls, html){
    var o = document.createElement('div'); o.className = 'ts-rc ' + cls;
    if(html) o.innerHTML = html; document.body.appendChild(o); return o;
  }
  function rcKill(o, done, at){ setTimeout(function(){ o.parentNode && o.parentNode.removeChild(o); done(); }, at); }

  /* 커버 페이드 → 스타일대로 reveal (scan/fade 폴백) */
  function rcReveal(applyFn, done, style){
    var c = document.createElement('div'); c.className = 'ts-cover'; c.id = 'ts-cover';
    c.style.opacity = '0'; c.style.transition = 'opacity .16s ease'; document.body.appendChild(c);
    requestAnimationFrame(function(){ c.style.opacity = '1'; });
    setTimeout(function(){
      c.style.transition = ''; c.style.opacity = '';
      applyFn(); set(HANDOFF, JSON.stringify({style: style === 'fade' ? 'fade' : 'scan'})); reveal();
      setTimeout(done, 720);
    }, 180);
  }
  /* reconfiglog : 재구성 로그 + 프로그레스 → 페이드아웃 */
  function rcLog(applyFn, done){
    var o = rcMake('log', '<div class="rc-hd mono">▶ RECONFIGURING · <b>DISPLAY MODE</b></div><div class="rc-pb"><i></i></div>');
    var bar = o.querySelector('.rc-pb i');
    requestAnimationFrame(function(){ bar.style.width = '100%'; });
    setTimeout(applyFn, 520);
    setTimeout(function(){ o.classList.add('out'); }, 640);
    rcKill(o, done, 1000);
  }

  /* ============================================================
     (D) 첫 진입 부팅 — 세션당 1회. 재방문/모션최소화면 자동 스킵.
         markup 을 넘기지 않으면 스스로 오버레이를 만든다.
         onDone(skipped) : skipped===true 면 부팅을 건너뛴 것.
     ============================================================ */
  TS.boot = function(o){
    o = o || {};
    var onDone = o.onDone || function(){};
    var host = o.el || null;                 // 기존 .ts-boot / .connect 요소를 넘길 수도 있음

    if(get(BOOTED) || reduce){               // 이미 이번 세션에 부팅함 → 스킵(부팅 오버레이 '즉시' 숨김, 페이드 없이)
      if(host){ host.style.transition = 'none'; host.classList.add('done'); }
      onDone(true); return;
    }
    set(BOOTED, '1');

    var made = false;
    if(!host){
      host = document.createElement('div'); host.className = 'ts-boot';
      host.innerHTML =
        '<div class="ct mono">TS·OS <b>HANDHELD DATABASE TERMINAL</b> v2.04</div>' +
        '<div class="cl mono" id="ts-bcl"></div>' +
        '<div class="pbar"><i id="ts-bpb"></i></div>';
      (document.body || document.documentElement).appendChild(host);
      made = true;
    }
    var cl = host.querySelector('#ts-bcl') || host.querySelector('.cl');
    var pb = host.querySelector('#ts-bpb') || host.querySelector('.pbar i');
    var steps = o.steps || CFG.bootSteps, i = 0, html = '';

    setTimeout(function step(){
      if(i < steps.length){
        html += '<div><span class="ok">✓</span> ' + steps[i] + '</div>';
        if(cl) cl.innerHTML = html;
        if(pb) pb.style.width = Math.round((i+1)/steps.length*100) + '%';
        i++; setTimeout(step, 250);
      }else{
        if(cl) cl.innerHTML = html + '<div>ENTERING DATABASE<span class="cur"></span></div>';
        setTimeout(function(){
          host.classList.add('done');
          if(made) setTimeout(function(){ host.parentNode && host.parentNode.removeChild(host); }, 500);
          onDone(false);
        }, 420);
      }
    }, 240);
  };

  /* ============================================================
     (E) 유틸 & 자동 배선
     ============================================================ */

  /* 세션당 1회성 이벤트 판별 (부팅 외 다른 곳에도 재사용 가능) */
  TS.seen = function(key){
    key = 'ts-seen-' + key;
    if(get(key)) return true;
    set(key, '1'); return false;
  };

  /* a[data-ts] 링크를 자동으로 전환 처리 (동적 추가분엔 TS.wire(root) 재호출) */
  TS.wire = function(root){
    var links = (root || document).querySelectorAll('a[data-ts]');
    Array.prototype.forEach.call(links, function(a){
      if(a._tsw) return; a._tsw = 1;
      a.addEventListener('click', function(e){
        var url = a.getAttribute('href');
        if(!url || url.charAt(0) === '#') return;
        if(e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // 새 탭 열기 등은 존중
        e.preventDefault();
        TS.go(url, a.getAttribute('data-ts') || 'accesslog');
      });
    });
  };

  /* bfcache(뒤로가기 복원) 시 남아있던 오버레이/커버 정리 */
  window.addEventListener('pageshow', function(e){
    if(!e.persisted) return;
    busy = false;
    var f = document.querySelector('.ts-fx'); if(f && f.parentNode) f.parentNode.removeChild(f);
    var c = document.getElementById('ts-cover'); if(c && c.parentNode) c.parentNode.removeChild(c);
  });

  /* 로드되면 도착 reveal + 링크 배선 */
  function init(){ reveal(); TS.wire(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
