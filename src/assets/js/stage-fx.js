/* =====================================================================
   stage-fx.js — 캐릭터별 무대 배경효과 (능력 시각화)
   ---------------------------------------------------------------------
   사용법: 무대(.stage) 안에 캔버스 하나 두고 data-fx 로 효과 이름 지정.
     <canvas class="fx-bg fx-full" data-fx="film"></canvas>
   그리고 페이지 끝에서 이 파일을 include 하면 자동 실행됨.
   색은 페이지의 --accent(캐릭터 테마색)를 자동으로 사용.

   효과 목록:
     film   — 벡스터 : 영화필름(미래를 미리 상영) — 필름스트립이 흐름
     shock  — 민트   : 충격파/크랙 — 바닥에서 링이 퍼지고 균열이 번쩍
     frost  — 셀루카 : 서리/냉각 — 모서리부터 성에가 번지고 육각결정
     signal — S      : 전자기파/글리치 — 각진 디지털 파형 + 노이즈
     archive— 메릴리 : 서가/기억 — 책 스파인이 늘어서고 인덱스카드가 쌓임
     heart  — 마이티 : 심박 ECG (마이티 페이지는 인라인 버전 사용 중, 참고용)

   새 캐릭터/효과 추가 = 아래 FX 객체에 함수 하나만 추가.
   ===================================================================== */
window.TSFX = (function () {
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  // ★캔버스 해상도 배율 상한(2026-08-01) — 3배율 이상 고해상도 화면에서 화면 전체 효과가
  //   불필요하게 9배 픽셀로 그려지는 걸 막는다. 2배면 육안으로 차이가 거의 없다(단일 출처).
  var MAX_DPR = 2;

  // #rgb / #rrggbb → 'rgba(r,g,b,a)'
  function rgba(hex, a) {
    hex = (hex || '#4bbad6').replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var n = parseInt(hex, 16);
    return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
  }
  // 두 색을 t(0~1) 비율로 섞어 새 색(#rrggbb)을 만든다. t=0 이면 a, t=1 이면 b.
  //   예) 회색에 캐릭터 테마색을 살짝 타서 '무채색이지만 그 캐릭터 색기가 도는' 색 만들기.
  function mixCol(a, b, t) {
    function rgbOf(h){
      h = (h || '#000').replace('#','').trim();
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      var n = parseInt(h, 16);
      return [(n>>16)&255, (n>>8)&255, n&255];
    }
    var A = rgbOf(a), B = rgbOf(b), out = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.round(A[i] + (B[i] - A[i]) * t).toString(16);
      out += (v.length < 2 ? '0' : '') + v;
    }
    return out;
  }
  // 결정론적 난수(프레임마다 흔들리지 않게 시드 고정)
  function rng(seed) { return function(){ seed=(seed*9301+49297)%233280; return seed/233280; }; }

  // ── 라이트 테마 대응(단일 출처) ─────────────────────
  //   효과 안의 '밝은 장식색'(흰빛·크림빛·형광빛)은 다크 배경에선 잘 보이지만
  //   흰 배경(라이트 테마)에선 그대로 묻혀 버린다. 그래서 라이트일 땐 글자색(--ink,
  //   어두운 무채색)으로 갈아끼워 '같은 대비'를 만든다. 색은 profile.css 가 단일 출처.
  function isLight(){ return document.documentElement.getAttribute('data-theme') === 'light'; }
  //   dark = 다크 테마에서 쓸 색(원래 색). 라이트 테마면 --ink 로 대체.
  function brightCol(dark){ return isLight() ? cssVar('--ink', '#2b2b2b') : dark; }
  //   litCol = '주변보다 밝아야 하는' 것(빛·후광)에 쓰는 색.
  //     다크 테마의 밝은 쪽은 글자색(--ink), 라이트 테마의 밝은 쪽은 배경색(--paper)이다.
  //     ※brightCol 은 '배경에 안 묻히게'(대비), litCol 은 '빛나게'(밝기) — 목적이 다르다.
  function litCol(){ return isLight() ? cssVar('--paper', '#fafafa') : cssVar('--ink', '#eef4ff'); }

  // ── 반짝임(sparkle) 알갱이 생성 : 원본 '골드러시' 파라미터. opts로 개수·속도·은은함만 바꿔 변형 파생(단일 출처).
  //   FX.sparkle이 읽는 손잡이 = s.ryPer(폭 flip 주기)·s.ccHalf(점멸 반주기)·s.reflA(광택 세기).
  function buildSparkleGems(s, W, H, o) {
    var g = rng(o.seed); s.gems = [];
    s.ryPer = o.ryPer; s.ccHalf = o.ccHalf; s.reflA = o.reflA;
    var n = Math.round(Math.max(o.nMin, Math.min(o.nMax, W*H / o.div)));
    for (var i=0;i<n;i++){
      s.gems.push({ x:g()*W, y:g()*H, l:2+g()*10, r:2+g()*10, bo:2+g()*10,
        rz:g()*6.283, rotPer:600+g()*600, delay:Math.floor(g()*600), op:o.opBase+g()*o.opVar, hot:g()<0.5 });
    }
  }
  // ── 기록 스캔(archive) 막대 생성 : opts로 개수·주기(속도)만 바꿔 변형 파생(단일 출처). s.place(앞/뒤)로 밀도 분기.
  function buildArchiveBars(s, W, H, o) {
    // ★막대 밝기(두 테마 공통 손잡이) — 여기서만 고치면 archive 계열 전부에 반영된다.
    s.dim  = (o.dim  != null) ? o.dim  : 0.62;   // 다크 테마 배경 막대 불투명도(1=원래대로, 낮출수록 차분. 강조 막대는 항상 또렷)
    var front = s.place === 'front';
    var g = rng(front ? o.seedF : o.seedB);      // 앞/뒤 다른 시드 → 겹치지 않는 별개 막대
    s.W = W; s.H = H;
    function triY(){ return (g()+g())/2; }        // 세로 중앙 몰림(삼각분포)
    s.marks = [];                                 // 점 필드는 제거된 상태(가로 막대만)
    s.bars = [];
    var nBars = Math.round(W*H / (front ? o.divF : o.divB));   // 앞 레이어는 개수 줄여 캐릭터 덜 가림
    for (var b=0;b<nBars;b++){
      var thin = g() < 0.45;
      s.bars.push({
        y: triY()*H, startX: g()*W, dir: g()<0.68 ? -1 : 1,   // 다수(68%) 우→좌
        march: o.marchBase + g()*o.marchVar,                  // 등장마다 순간이동 폭
        seed: g()*9999, period: o.periodBase + Math.floor(g()*o.periodVar),   // 떴다 지는 총 프레임(클수록 느린 점멸)
        onFrac: 0.38 + g()*0.28,                              // 보이는 비율(나머지 쉼)
        th: thin ? (g()<0.5?1:2) : (5+Math.floor(g()*4)),     // 얇은/굵은 섞임
        hot: g() < 0.10                                       // ~10% 강조색 바
      });
    }
  }

  var FX = {

    /* ── 벡스터 : 영화필름(영사기 상영) ─────────────────
       미래를 미리 상영 = 양쪽에 세로 필름 2줄(스프로킷 홀·프레임 경계)이
       위로 흐르고, 화면 전체가 영사기처럼 미세하게 깜빡(램프)이며
       좌우로 떨리고(게이트 위블), 가끔 프레임 풀다운 띠가 위→아래로 훑음.
       무채색 은빛. (캐릭터 가운데는 비워 안 가림) */
    film: function (ctx, W, H, f, s, acc) {
      // 영사기 램프 깜빡임(전체 밝기) — 은은하게만(흔들림 아님)
      var flick = 0.90 + 0.06*Math.sin(f*0.9) + 0.04*Math.sin(f*2.3+1.1);
      var frameH = 132, perfR = 3, holeStep = 24;
      var d = f*0.6;                              // 연속 진행량(모듈로 전 — 이음매 없이 흐르게)
      var stripW = Math.max(52, Math.min(72, W*0.14));
      var xs  = [ W*0.16, W*0.84 - stripW ];      // 좌·우 (마스크에 안 잘리게 안쪽으로)
      var dir = [ +1, -1 ];                       // 왼쪽=아래로 · 오른쪽=위로 (반대 방향)

      ctx.save();
      ctx.globalAlpha = flick;                   // 전체에 램프 깜빡임 적용
      for (var si=0; si<2; si++) {
        var x0 = xs[si], dd = dir[si]*d;
        // ★홀·프레임을 각자 주기로 순환(132÷24=5.5라 공유하면 튐) → 이음매 없이 연속 이동
        var frameScroll = ((dd % frameH)  + frameH)  % frameH;
        var holeScroll  = ((dd % holeStep)+ holeStep) % holeStep;
        // 셀룰로이드 바탕 + 테두리
        ctx.fillStyle = rgba(acc, 0.055); ctx.fillRect(x0, 0, stripW, H);
        ctx.strokeStyle = rgba(acc, 0.24); ctx.lineWidth = 1;
        ctx.strokeRect(x0+0.5, 0, stripW-1, H);
        // 스프로킷 홀(양쪽 세로) — 필름 천공
        ctx.fillStyle = rgba(acc, 0.26);
        for (var hy = holeScroll - holeStep; hy < H+holeStep; hy += holeStep) {
          roundRect(ctx, x0+5-perfR,        hy-perfR, perfR*2, perfR*2, 1.3); ctx.fill();
          roundRect(ctx, x0+stripW-5-perfR, hy-perfR, perfR*2, perfR*2, 1.3); ctx.fill();
        }
        // 프레임 경계(밝은 띠) + 빈 컷
        var ix = x0+11, iw = stripW-22;
        for (var y = -frameH + frameScroll; y < H+frameH; y += frameH) {
          ctx.strokeStyle = rgba(acc, 0.30); ctx.lineWidth = 1.6;   // 프레임 사이 경계
          ctx.beginPath(); ctx.moveTo(ix, y); ctx.lineTo(ix+iw, y); ctx.stroke();
          ctx.strokeStyle = rgba(acc, 0.11); ctx.lineWidth = 1;     // 컷 프레임
          ctx.strokeRect(ix, y+7, iw, frameH-14);
        }
      }
      ctx.restore();

      // 프레임 풀다운 : 가끔 은빛 띠가 화면 전체를 위→아래로 훑음(영사 프레임 전환)
      var cyc = 168, t = f % cyc;
      if (t < 16) {
        var by = (t/16)*(H+80) - 40;
        var g = ctx.createLinearGradient(0, by-46, 0, by+46);
        g.addColorStop(0, rgba(acc,0)); g.addColorStop(0.5, rgba(acc,0.10)); g.addColorStop(1, rgba(acc,0));
        ctx.save(); ctx.globalAlpha = flick; ctx.fillStyle = g; ctx.fillRect(0, by-46, W, 92); ctx.restore();
      }
    },

    /* ── 영사기 (필름효과에서 '영사기' 부분만 분리 · 양쪽 필름스트립 없이) ──
       영사기 램프 깜빡임(전체 미세 밝기 브리딩) + 위→아래로 훑는 프레임 풀다운 띠 + 옅은 스캔라인.
       색 = 테마색(--accent). 라이트/다크 자동. */
    projector: function (ctx, W, H, f, s, acc) {
      var flick = 0.90 + 0.06*Math.sin(f*0.9) + 0.04*Math.sin(f*2.3+1.1);   // 램프 깜빡임
      // ★순간 재생 : s.sync면 자체 주기에만 재생(예: 기억 각인 동안). gA=동반 페이드.
      var gA = 1, sp = -1;
      if (s && s.sync){
        var stms = Date.now() % s.syncPer;
        if (stms > s.syncOn) return;                                        // 창 밖 → 안 그림
        sp = stms / s.syncOn;
        gA = sp < 0.15 ? sp/0.15 : (sp < 0.8 ? 1 : Math.max(0, 1-(sp-0.8)/0.2));
        if (gA <= 0.01) return;
      }
      ctx.save(); ctx.globalAlpha = gA;
      ctx.fillStyle = rgba(acc, 0.009*flick);                               // 옅은 스캔라인(영사 질감)
      for (var sy=0; sy<H; sy+=3) ctx.fillRect(0, sy, W, 1);
      // 프레임 풀다운(위→아래 훑음) : 상시=가끔(320f 주기) / 순간=창당 한 번
      var swept = -1;
      if (sp >= 0){ var bt = (sp-0.12)/0.16; if (bt>=0 && bt<=1) swept = bt; }   // 순간=창당 한 번, 빠르게 훑음
      else { var t = f % 320; if (t < 26) swept = t/26; }
      if (swept >= 0){
        var by = swept*(H+96) - 48;
        var g = ctx.createLinearGradient(0, by-52, 0, by+52);
        g.addColorStop(0, rgba(acc,0)); g.addColorStop(0.5, rgba(acc, 0.12*flick)); g.addColorStop(1, rgba(acc,0));
        ctx.fillStyle = g; ctx.fillRect(0, by-52, W, 104);
      }
      ctx.restore();
    },

    /* ── 민트 : 프레임 균열 (메타 · 앞 캔버스=임팩트 순간만) ──────
       강화육체 정면돌파 = 주먹으로 화면(유리)을 쳐 방사크랙+동심링으로 파쇄.
       [앞 fx-front] 타격 순간의 강한 깨짐(백색섬광·밝은 크랙·테두리·흔들림)만.
       남은 잔금은 [뒤 fx-bg crackBack]이 일러 뒤에서 그림. */
    crack: function (ctx, W, H, f, s, acc) {
      var t = f % 640;   // 주기 ↑ = 부수는 텀 길게(깨진 뒤 온전한 화면 유지)
      // 임팩트 : 프레임 전체가 짧게 흔들림(주먹 충격, 빠르게 감쇠)
      if (s.stage){
        if (t < 12){ var k = 1 - t/12, amp = 2.6*k;
          s.stage.style.transform = 'translate('+(Math.sin(t*2.1)*amp).toFixed(2)+'px,'+(Math.cos(t*2.7)*amp*0.7).toFixed(2)+'px)';
          s.shook = true;
        } else if (s.shook){ s.stage.style.transform=''; s.shook=false; }
      }
      if (t >= 34) return;                                   // 임팩트 순간만 앞에 강하게
      var hit = t < 14 ? 1 - t/14 : 0;
      var ff  = t < 14 ? 1 : 1 - (t-14)/20;                  // 14~34 : 앞 크랙 사라짐(뒤로 인계)
      ctx.save();
      if (hit > 0){                                          // 과다노출 + 테두리 + 원점 섬광
        //   다크=흰 섬광 / 라이트=어두운 섬광(흰 배경에선 흰 섬광이 안 보이므로)
        ctx.fillStyle = rgba(brightCol('#ffffff'), 0.22*hit); ctx.fillRect(0,0,W,H);
        ctx.strokeStyle = rgba(acc, 0.6*hit); ctx.lineWidth = 3; ctx.strokeRect(3, 3, W-6, H-6);
        var gg = ctx.createRadialGradient(s.ox, s.oy, 0, s.ox, s.oy, W*0.55);
        gg.addColorStop(0, rgba(acc, 0.18*hit)); gg.addColorStop(1, rgba(acc, 0));
        ctx.fillStyle = gg; ctx.fillRect(0,0,W,H);
      }
      var bright = 0.5*ff + 0.4*hit;                         // 앞 크랙 밝기
      for (var i=0;i<s.cracks.length;i++){ var c=s.cracks[i];
        if (hit > 0.15){                                     // 충돌 순간 RGB 어긋남(조각 변위)
          // RGB 어긋남 : 다크는 청/자홍 색수차, 라이트는 무채색 규칙에 맞춰 회색 어긋남만
          var off = 1.4 + 2.6*hit; ctx.lineWidth = (0.9+2*hit)*c.w;
          var sp1 = isLight() ? cssVar('--ink','#2b2b2b') : '#5adcff';
          var sp2 = isLight() ? cssVar('--ink','#2b2b2b') : '#ff4696';
          ctx.strokeStyle = rgba(sp1, 0.20*hit*c.a); strokeCrack(ctx, c, -off, 0);
          ctx.strokeStyle = rgba(sp2, 0.20*hit*c.a); strokeCrack(ctx, c,  off, 0);
        }
        ctx.strokeStyle = rgba(acc, bright*c.a); ctx.lineWidth = (0.9 + 2*hit) * c.w;
        ctx.shadowColor = rgba(acc, 0.5*hit); ctx.shadowBlur = 6*hit;
        strokeCrack(ctx, c, 0, 0); ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(acc, bright*0.5*c.a); ctx.lineWidth = 0.7;
        for (var b=0;b<c.branch.length;b++){ var br=c.branch[b];
          ctx.beginPath(); ctx.moveTo(br[0][0],br[0][1]); ctx.lineTo(br[1][0],br[1][1]); ctx.stroke(); }
      }
      for (var ri=0; ri<s.rings.length; ri++){ var rg2 = s.rings[ri];   // 동심 링
        ctx.strokeStyle = rgba(acc, bright*0.85*rg2.a); ctx.lineWidth = (0.7+1.2*hit)*rg2.w; strokeRing(ctx, rg2); }
      ctx.restore();
    },

    /* ── 민트(뒤 fx-bg) : 남은 잔여 균열 ───────────────
       일러 뒤에서 은은하게 유지되는 금(앞 임팩트 이후 인계받아 오래 남음). */
    crackBack: function (ctx, W, H, f, s, acc) {
      var t = f % 640, vis = 0;   // 앞(crack)과 동일 주기
      if (t < 14)       vis = (t/14) * 0.9;                  // 임팩트와 함께 뒤에서도 생김
      else if (t < 230) vis = 0.9;                           // 깨진 채 유지(길게)
      else if (t < 290) vis = 0.9 * (1 - (t-230)/60);        // 서서히 아뭄
      else return;                                           // 갬
      ctx.save();
      for (var i=0;i<s.cracks.length;i++){ var c=s.cracks[i];
        ctx.strokeStyle = rgba(acc, 0.30*vis*c.a); ctx.lineWidth = c.w; strokeCrack(ctx, c, 0, 0);
        ctx.strokeStyle = rgba(acc, 0.17*vis*c.a); ctx.lineWidth = 0.7;
        for (var b=0;b<c.branch.length;b++){ var br=c.branch[b];
          ctx.beginPath(); ctx.moveTo(br[0][0],br[0][1]); ctx.lineTo(br[1][0],br[1][1]); ctx.stroke(); }
      }
      for (var ri=0; ri<s.rings.length; ri++){ var rg2 = s.rings[ri];
        ctx.strokeStyle = rgba(acc, 0.22*vis*rg2.a); ctx.lineWidth = rg2.w; strokeRing(ctx, rg2); }
      ctx.restore();
    },

    /* ── 셀루카 : 눈 파티클 (흩날리는 눈송이) ───────────
       냉각 능력의 눈송이가 천천히 흩날려 내림. 색=캐릭터 테마색(--accent).
       ※ 서리·성에는 별도 효과 'frost'. 둘을 레이어로 함께 쌓으면 예전 눈결정 모습. */
    snow: function (ctx, W, H, f, s, acc) {
      ctx.save();
      for (var i=0;i<s.flakes.length;i++){                 // 눈송이(작은 점 · 큰 결정 · 아주 큰 결정)
        var fl = s.flakes[i];
        fl.y += fl.spd;
        fl.x += Math.sin(f*fl.sway + fl.ph) * fl.drift;
        fl.rot += fl.rspd;
        if (fl.y > H + 14){ fl.y = -14; fl.x = Math.random()*W; }
        var wx = (fl.x + W) % W;
        var tw = 0.62 + 0.38*Math.sin(f*0.05 + fl.ph);     // 반짝임
        // 일부는 하얀 눈, 나머지는 테마색. 라이트 테마에선 흰 눈이 안 보이므로 --ink 로 대체.
        var col = fl.white ? brightCol('#ffffff') : acc;
        if (fl.big){
          ctx.save(); ctx.translate(wx, fl.y); ctx.rotate(fl.rot);
          drawFlake(ctx, 0, 0, fl.r, rgba(col, fl.a*tw)); ctx.restore();
        } else {
          ctx.fillStyle = rgba(col, fl.a*tw*0.9);
          ctx.beginPath(); ctx.arc(wx, fl.y, fl.r*0.5, 0, 7); ctx.fill();
        }
      }
      ctx.restore();
    },

    /* ── 셀루카 : 성에 결정 (창문 서리) ──────
       레퍼런스(_local/reference/fx/frost.jpg) '느낌'을 절차적으로 재현 — 이미지 자체는 안 씀.
       가장자리부터 안으로 번지는 '가루 서리'(미세 반점, 가장자리 촘촘·중앙 맑음) + 고사리 결정.
       ★INIT.frost가 오프스크린 텍스처(s.frostTex) 한 장에 미리 구워 둠 → 매 프레임은
       테마 글자색(--ink)으로 틴트 + 냉기 서지로 짙기만 '호흡'(가볍고 촘촘). 다크=흰서리·라이트=회색서리 자동.
       ★모양을 바꾸려면 INIT.frost 의 반점 수(M)·비네트(0.62)·고사리 씨앗만 손보면 됨. */
    frost: function (ctx, W, H, f, s, acc) {
      var tex = s.frostTex; if (!tex) return;
      // ★냉기 서지 = 서리 '전체'의 진하기. 화면 전체가 싹 사라졌다가(≈0) 다시 차오름 — 캐릭터 피하는 원형 안 남게.
      //   pow↑ = 정점 짧고(다 찬 상태 짧게) 바닥 깊고 넓게(사라질 땐 많이·오래).
      var surge = Math.pow(0.5 + 0.5*Math.sin(f*0.008 - 1.4), 3);
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      var A = (light ? 0.6 : 0.92) * surge;                        // surge 0 → 완전히 사라짐(싹) / 정점 → 진하게
      if (A < 0.01) return;                                        // 사라진 구간엔 아무것도 안 그림
      ctx.save(); ctx.globalAlpha = A;
      ctx.drawImage(tintImage(s, tex, cssVar('--ink', '#dfecfc')), 0, 0);   // 서리 텍스처(모양)를 테마색으로 틴트해 얹음
      ctx.restore();
    },

    /* ── 셀루카 : 냉기 서림 (무대 외곽이 하얗게 김) ──────────
       상단 옅은 냉기(테마색) + 가장자리부터 하얗게 번지는 김서림(비네트).
       ★'성에 결정'은 별도 효과 'frost' → 이 효과는 하얀 서림만 담당(앞/뒤 자유롭게 레이어). */
    fog: function (ctx, W, H, f, s, acc) {
      ctx.save();
      // 상단 옅은 냉기(캐릭터 테마색)
      var rg = ctx.createLinearGradient(0,0,0,H*0.5);
      rg.addColorStop(0, rgba(acc, isLight() ? 0.03 : 0.06)); rg.addColorStop(1, rgba(acc,0));
      ctx.fillStyle = rg; ctx.fillRect(0,0,W,H*0.5);
      // 프레임 김서림 : 가장자리가 서서히 하얘졌다 걷힘 (얼어붙는 냉기)
      var frost = Math.pow(0.5 + 0.5*Math.sin(f*0.009 - 1.4), 2);   // 0~1, 대부분 옅고 가끔 짙게
      var vig = ctx.createRadialGradient(W*0.5, H*0.5, Math.min(W,H)*0.30, W*0.5, H*0.5, Math.max(W,H)*0.66);
      // 김서림 색 : 다크는 찬 흰빛.
      //   ★라이트에서 테마색을 그대로 쓰면 '파란 물'이 든 것처럼 보인다(냉기가 아니라).
      //     그래서 옅은 회색에 테마색을 살짝만 타서 '뿌옇게 서린 김'으로 읽히게 한다.
      var fcol = isLight() ? mixCol(cssVar('--ink-faint', '#767676'), acc, 0.3) : '#d6e6f8';
      var fa   = isLight() ? 0.10 : 0.16;                 // 라이트는 더 옅게(뿌연 정도만)
      vig.addColorStop(0, rgba(fcol, 0));
      vig.addColorStop(1, rgba(fcol, fa*frost));
      ctx.fillStyle = vig; ctx.fillRect(0,0,W,H);
      ctx.restore();
      // ★이름 워터마크(.bg-type)·꺽쇠(.corner)·REC 글씨(.stage-head)는 이 캔버스보다 z-index가 높아
      //   그림으로는 안 덮인다(2026-07-25 발견) → 냉기가 짙어진 만큼 그 요소들 자신을 옅게 해서 '같이 서린' 느낌을 낸다.
      for (var hi=0; hi<s.hud.length; hi++) s.hud[hi].style.opacity = 1 - 0.55*frost;
    },

    /* ── 셀루카 : 결정 반짝임 (레퍼런스 '골드러시' CSS 1:1 이식) ──
       ★원본 애니메이션을 그대로 옮김(재해석 없음). 금색만 테마색(--accent)+무채색(--ink)으로 치환.
       원본 구조(알갱이 1개) :
         · 삼각형(border 2~12px). 투명도 불변 — rotateY(3000ms)로 '폭만' 납작해져 사라졌다 나타남.
         · goldColor(750ms, alternate) : 테두리색 흰(0%)→금(10%)→어둠(100%) 왕복 → 밝기 맥동
           (검은 배경에선 어두운색=사라짐 / 금=보임 / 흰=번쩍).
         · reflect ::before/::after(750ms, alternate) : 삼각형 16배 크기의 수평·수직 소프트 그라디언트,
           opacity 1→0을 앞 10%에서, peak 0.4 → 아주 옅고 짧은 광택.
       각 알갱이는 랜덤 delay라 서로 다른 위상 → 밭 전체가 자글자글 shimmer. 다크=발광(lighter) 합성. */
    sparkle: function (ctx, W, H, f, s, acc) {
      // ★라이트 테마 : 무채색 그대로면 '빛'이 아니라 회색 얼룩으로 보인다.
      //   흰 배경 위에선 더 밝게 갈 수 없으므로, 대신 캐릭터 테마색을 진하게 섞어 '차가운 반짝임'으로.
      var ink = isLight() ? mixCol(cssVar('--ink-faint', '#767676'), acc, 0.75)
                          : cssVar('--ink', '#eef4ff');
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      var boost = light ? 1.4 : 1;
      ctx.save();
      if (!light) ctx.globalCompositeOperation = 'lighter';   // 다크 : 빛이 더해져 번짐(원본 검은 배경 위 금가루 톤)
      for (var i=0;i<s.gems.length;i++){ var g=s.gems[i];
        var t = f + g.delay;
        var half = s.ccHalf;                                       // 점멸(goldColor/reflect) 반주기 프레임 — 클수록 느림
        var face = Math.abs(Math.cos((t % s.ryPer) / s.ryPer * 6.28318));  // rotateY(폭 납작, 0 옆~1 정면)
        var cc = (t % (half*2)) / half; if (cc > 1) cc = 2 - cc;   // goldColor/reflect(alternate 왕복) : 0→1→0
        // goldColor : 앞 10% 흰빛 → 이후 점점 어둠. B=밝기, Wh=흰 정도.
        var B, Wh;
        if (cc < 0.1){ B = 1;                        Wh = 1 - cc/0.1; }
        else         { B = 1 - (cc-0.1)/0.9 * 0.85;  Wh = 0; }
        var refl = cc < 0.1 ? (1 - cc/0.1) : 0;                     // reflect : 앞 10%만 광택(opacity 1→0)
        var ang = g.rz + (f % g.rotPer) / g.rotPer * 6.28318;       // 고정 rotateZ + .rotate 느린 스핀
        var col = g.hot ? acc : ink;                               // 테마색 / 무채색
        var w = g.l + g.r;

        // ── reflect 광택(수평·수직 소프트 밴드, 삼각형 16배 · peak 0.4) : 원본 ::before/::after ──
        if (refl > 0.01){
          var A = (s.reflA || 0.3) * refl * boost;   // 광택 peak(INIT에서 조절 · 원본 0.4보다 은은)
          ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(ang);
          var RW = w*16, hg = ctx.createLinearGradient(-RW/2,0,RW/2,0);   // 수평 밴드(높이=bottom)
          hg.addColorStop(0,rgba(col,0)); hg.addColorStop(0.4,rgba(col,0.25*A));
          hg.addColorStop(0.5,rgba(col,A)); hg.addColorStop(0.6,rgba(col,0.25*A)); hg.addColorStop(1,rgba(col,0));
          ctx.fillStyle=hg; ctx.fillRect(-RW/2, -g.bo/2, RW, g.bo);
          var VH = g.bo*16, vg = ctx.createLinearGradient(0,-VH/2,0,VH/2);  // 수직 밴드(폭=left+right)
          vg.addColorStop(0,rgba(col,0)); vg.addColorStop(0.4,rgba(col,0.25*A));
          vg.addColorStop(0.5,rgba(col,A)); vg.addColorStop(0.6,rgba(col,0.25*A)); vg.addColorStop(1,rgba(col,0));
          ctx.fillStyle=vg; ctx.fillRect(-w/2, -VH/2, w, VH);
          ctx.restore();
        }

        // ── 삼각 알갱이 : rotateY(폭 납작) + goldColor(밝기 B·흰 Wh). 투명도는 밝기로만(원본은 색으로) ──
        ctx.save();
        ctx.translate(g.x, g.y); ctx.rotate(ang); ctx.scale(Math.max(0.04, face), 1);
        ctx.beginPath();
        ctx.moveTo(g.l - w/2, -g.bo/2); ctx.lineTo(-w/2, g.bo/2); ctx.lineTo(w/2, g.bo/2); ctx.closePath();
        ctx.fillStyle = rgba(col, B * g.op * boost);
        ctx.fill();
        if (Wh > 0.03){ ctx.fillStyle = rgba(ink, Wh * g.op * boost); ctx.fill(); }   // 앞 10% 흰빛 번쩍
        ctx.restore();
      }
      ctx.restore();
    },

    /* ── 셀루카 : 반짝이는 눈 (결정 반짝임 + 제자리 둥실 부유) ──
       sparkle의 반짝임(rotateY flip · 밝기 맥동 · 광택)은 그대로. 낙하 대신 제자리에서
       느리게 둥실 떠다닌다(부유, x·y 따로 도는 사인 → 원 그리듯). */
    snowglint: function (ctx, W, H, f, s, acc) {
      // ★라이트 테마 : sparkle(결정 반짝임)과 같은 이유로 무채색 그대로면 흰 배경 위에서 '빛'이 아니라
      //   회색 얼룩으로 보인다(2026-07-25 발견 — sparkle엔 이미 있던 처리가 snowglint엔 안 옮겨져 있었음).
      //   흰 배경 위에선 더 밝게 갈 수 없으므로, 대신 테마색을 살짝만 태워 대비를 준다.
      //   ★처음엔 sparkle과 같은 0.75(진하게)로 했더니 fl.hot(테마색/무채색 반반) 중 '무채색' 쪽도
      //   거의 테마색처럼 보여 반반 섞인 느낌이 없어졌음(2026-07-25) → 0.2로 낮춰 진짜 무채색(회색) 눈이
      //   테마색 눈과 섞여 보이게(다른 효과의 '살짝만' 배합 — fog·glitchSplit 실루엣과 같은 정도).
      var light = isLight();
      var ink = light ? mixCol(cssVar('--ink-faint', '#767676'), acc, 0.2) : cssVar('--ink', '#eef4ff');
      var boost = light ? 1.4 : 1;
      ctx.save();
      if (!light) ctx.globalCompositeOperation = 'lighter';     // 다크 : 빛이 더해져 번짐
      for (var i=0;i<s.flakes.length;i++){ var fl=s.flakes[i];
        // ── 제자리 둥실 부유(x·y 따로 도는 사인 → 원 그리듯) ──
        var px = fl.hx + Math.sin(f*fl.fsx + fl.phx)*fl.ampx;
        var py = fl.hy + Math.sin(f*fl.fsy + fl.phy)*fl.ampy;
        // ── 반짝임(sparkle과 동일 타이밍) ──
        var t = f + fl.delay, half = s.ccHalf;
        var face = Math.abs(Math.cos((t % s.ryPer) / s.ryPer * 6.28318));   // rotateY = 팔랑(폭 납작)
        var cc = (t % (half*2)) / half; if (cc > 1) cc = 2 - cc;
        var B, Wh; if (cc < 0.1){ B=1; Wh=1-cc/0.1; } else { B=1-(cc-0.1)/0.9*0.85; Wh=0; }
        var refl = cc < 0.1 ? (1 - cc/0.1) : 0;
        var ang = fl.rz + (f % fl.rotPer) / fl.rotPer * 6.28318;
        var col = fl.hot ? acc : ink;

        // 광택(빛 받는 순간) : sparkle과 동일한 수평·수직 소프트 밴드 (눈송이 크기에 맞춤)
        if (refl > 0.01){
          var A = 0.3 * refl * boost, ww = fl.r*2;
          ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
          var RW = ww*8, hg = ctx.createLinearGradient(-RW/2,0,RW/2,0);
          hg.addColorStop(0,rgba(col,0)); hg.addColorStop(0.4,rgba(col,0.25*A));
          hg.addColorStop(0.5,rgba(col,A)); hg.addColorStop(0.6,rgba(col,0.25*A)); hg.addColorStop(1,rgba(col,0));
          ctx.fillStyle=hg; ctx.fillRect(-RW/2, -fl.r*0.4, RW, fl.r*0.8);
          var VH = ww*8, vg = ctx.createLinearGradient(0,-VH/2,0,VH/2);
          vg.addColorStop(0,rgba(col,0)); vg.addColorStop(0.4,rgba(col,0.25*A));
          vg.addColorStop(0.5,rgba(col,A)); vg.addColorStop(0.6,rgba(col,0.25*A)); vg.addColorStop(1,rgba(col,0));
          ctx.fillStyle=vg; ctx.fillRect(-fl.r*0.4, -VH/2, fl.r*0.8, VH);
          ctx.restore();
        }

        // 눈송이(6갈래) : rotateY로 가로 납작 + 밝기 맥동
        ctx.save();
        ctx.translate(px, py); ctx.rotate(ang); ctx.scale(Math.max(0.12, face), 1);
        drawFlake(ctx, 0, 0, fl.r, rgba(col, B * fl.op * boost));
        if (Wh > 0.03) drawFlake(ctx, 0, 0, fl.r, rgba(ink, Wh * fl.op * boost));   // 앞 10% 흰빛 번쩍
        ctx.restore();
      }
      ctx.restore();
    },

    /* ── S : 신호 가로채기 (전자기파 능력, 일러 앞) ──────
       "프로필 보는 중 S가 피드를 가로챈다": 평상(라이브 피드) → 피드 찢으며
       S의 전자기 파형이 침투 → 화면 장악(SIGNAL LOST · 오실로스코프 파형)
       → 해제하고 피드 복귀. 수동적 '두절'이 아닌 능동적 '장악'. */
    glitch: function (ctx, W, H, f, s, acc) {
      var CYCLE = 620, t = f % CYCLE;
      var art = s.art;
      // realArt=진짜 <img> / canvasArt=피드 찢김 / intercept=S의 전자기 신호 장악 강도(0..1)
      var realArt = true, canvasArt = false, amt = 0, intercept = 0, snap = 0;
      if (t < 440) {                          // 평상 (라이브 피드, 아주 드물게 미세 간섭)
        amt = (Math.random() < 0.004) ? 0.05 : 0;
      } else if (t < 462) {                   // 가로채기 침투 : 피드 찢김이 고조
        realArt = false; canvasArt = true; amt = 0.15 + 0.5*ease((t-440)/22);
      } else if (t < 470) {                   // ★확 끄기 : 하드컷(세로 글리치 폭발) → 즉시 장악
        realArt = false; snap = 1 - (t-462)/8; intercept = 1;
      } else if (t < 548) {                   // S 장악 유지 (신호 가로챔)
        realArt = false; intercept = 1;
      } else {                                // 해제 : 스냅 복귀(짧은 찢김 후 피드)
        var q = (t-548)/56; intercept = Math.max(0, 1 - Math.min(1, q*2.4));
        if (q < 0.5){ realArt = false; canvasArt = (q > 0.16); amt = Math.max(0, 0.5-q)*1.2; }
      }
      if (art) art.style.opacity = realArt ? 1 : 0;
      // ★장악 강도만큼 프레임 HUD(꺽쇠·ID·REC)도 뺏김 → 프레임 전체를 S가 장악
      var hudV = 1 - Math.min(1, intercept*1.6);
      for (var hi=0; hi<s.hud.length; hi++) s.hud[hi].style.opacity = hudV;
      // 상시 라이브 피드 베이스라인 (장악 강도만큼 사라짐)
      var live = 1 - Math.min(1, intercept*1.4);
      if (live > 0.02){
        ctx.fillStyle = rgba(acc, 0.015*live);                             // 미세 스캔라인(캐릭터 테마색)
        for (var by=0; by<H; by+=3) ctx.fillRect(0, by, W, 1);
        var rb = (f*0.55) % (H+140) - 70;                                  // 느린 리프레시 밴드
        var fbg = ctx.createLinearGradient(0, rb, 0, rb+42);
        fbg.addColorStop(0, rgba(acc,0)); fbg.addColorStop(0.5, rgba(acc, 0.028*live)); fbg.addColorStop(1, rgba(acc,0));
        ctx.fillStyle = fbg; ctx.fillRect(0, rb, W, 42);
      }
      if (canvasArt) drawArtCyber(ctx, art, s.oc, s.canvasRect(), amt, f);
      if (intercept > 0.01) drawInterception(ctx, W, H, f, intercept, acc);   // S 전자기파 신호 장악(테마색)
      if (snap > 0.01){                                                  // ★확 끄는 순간 : 아주 옅은 순간 발광(하드컷)
        ctx.fillStyle = rgba(acc, 0.12*snap); ctx.fillRect(0,0,W,H);
      }
    },

    /* ── 별하늘 (레퍼런스: CodePen hitphy 'Starfield') ─────
       작은 별들이 오른쪽에서 왼쪽으로 흐른다. 별마다 속도·밝기가 달라 멀고 가까운
       느낌이 나고, 아주 가끔 하나가 반짝 커진다. 이따금 꼬리 긴 별똥별이 가로지른다.
       색 : 별 = 무채색(--ink) · 별똥별 = 캐릭터 테마색(--accent) → 라이트/다크 자동 대응.
       ※원본은 별 위치를 매 프레임 조금씩 옮겨 저장하지만, 여기서는 '시작 위치 - 속도×프레임'
         으로 그때그때 계산한다(저장할 상태가 없어 창 크기가 바뀌어도 안 엉킨다). */
    starfield: function (ctx, W, H, f, s, acc) {
      var ink = cssVar('--ink', '#eef4ff');
      // ── 별 : 왼쪽으로 흐르다 화면 밖으로 나가면 오른쪽 끝에서 다시 들어온다 ──
      for (var i = 0; i < s.stars.length; i++) {
        var st = s.stars[i];
        var x = ((st.x - st.v * f) % W + W) % W;         // 화면 폭 안에서 계속 순환
        var big = hnoise(st.seed + f) < s.twinkleRate;   // 아주 가끔 반짝 커짐
        ctx.fillStyle = rgba(ink, st.a);
        ctx.fillRect(x, st.y, big ? s.starSize + 2 : s.starSize, big ? s.starSize + 2 : s.starSize);
      }
      // ── 별똥별 : s.shootPer 프레임마다 한 번, 오른쪽 밖에서 들어와 왼쪽 밖으로 나간다 ──
      var cyc = Math.floor(f / s.shootPer), local = f % s.shootPer;
      var headX = W + s.shootLen - local * s.shootSpeed;
      if (headX > -s.shootLen) {
        var y = hnoise(cyc * 7.7) * H;                   // 이번 별똥별이 지나가는 높이
        // 꼬리는 머리 뒤(오른쪽)로 늘어지며 서서히 사라짐 — 그라데이션 한 번으로 그린다
        var grd = ctx.createLinearGradient(headX, 0, headX + s.shootLen, 0);
        grd.addColorStop(0, rgba(acc, 0.8));
        grd.addColorStop(1, rgba(acc, 0));
        ctx.fillStyle = grd;
        ctx.fillRect(headX, y, s.shootLen, s.shootSize);
      }
    },

    /* ── 주사선 (레퍼런스: CodePen YusukeNakaya 'GLITCH EFFECT' 의 배경) ──
       무대 전체에 아주 연한 가로줄이 촘촘히 깔려 브라운관 화면처럼 보인다. 움직이지 않는다.
       기본은 캐릭터 뒤(배경) — 앞에 놓으면 화면 유리처럼 캐릭터 위에도 덮인다. */
    scanline: function (ctx, W, H, f, s, acc) {
      // 색 = 글자색(--ink)을 아주 옅게 → 다크=옅은 밝은 줄 / 라이트=옅은 어두운 줄 자동
      ctx.fillStyle = rgba(cssVar('--ink', '#eef4ff'), s.scanAlpha);
      for (var y = 0; y < H; y += s.scanGap) ctx.fillRect(0, y, W, s.scanLine);
    },

    /* ── 훑는 줄 (레퍼런스: 위 CodePen 에서 아래→위로 올라가던 줄) ──
       얇은 줄 하나가 아래에서 위로 화면을 훑고 지나간다.
       기본은 캐릭터 앞 — 캐릭터를 가로질러 지나가며 그 자리를 끊어 놓는다. */
    sweepLine: function (ctx, W, H, f, s, acc) {
      // 배경색(--paper)으로 그어 '화면이 그 줄에서 끊긴 것'처럼 보이게
      var t = f / s.sweepPer;
      ctx.fillStyle = rgba(cssVar('--paper', '#0a0e14'), s.sweepAlpha);
      ctx.fillRect(0, (1 - (t - Math.floor(t))) * H, W, s.sweepPx);
    },

    /* ── 조각 글리치 (레퍼런스: CodePen YusukeNakaya 'GLITCH EFFECT') ──
       일러스트가 가로로 얇게 찢기는 연출만 담당한다.
       (브라운관 화면 느낌·훑고 지나가는 줄은 별개 효과 '화면 주사'로 분리해 뒀다 —
        둘을 같이 쓰고 싶으면 레이어를 두 겹 올리면 된다.)
         ① 온전한 일러 한 장 (일러 자체는 가만히 있는다)
         ② 찢김 — 얇은 가로줄 몇 개가 제자리에서 좌우·위아래로 떨며 테마색→무채색으로
                   번쩍였다 사라진다(위로 따라 올라가지 않는다). 가로 전체가 아니라
                   가운데는 두고 좌·우 바깥쪽만, 원래 자리를 지우고 밀어내 진짜로 찢는다.
       ★화면 장악(takeover) : 진짜 <img>는 숨기고 이 캔버스가 일러를 대신 그린다. */
    glitchSlice: function (ctx, W, H, f, s, acc) {
      var art = s.art;
      if (!art || !art.naturalWidth) return;
      art.style.opacity = 0;                       // 진짜 일러는 숨김(아래 그림이 대신함)
      var g = artRect(art, s.canvasRect());        // 일러가 실제로 그려지는 사각형
      if (!g) return;

      // ── ① 온전한 일러 한 장 (일러 자체는 가만히 있는다) ──
      ctx.drawImage(art, g.dx, g.dy, g.dw, g.dh);

      // ── ② 찢김 : 얇은 가로줄이 좌우·위아래로 떨며 테마색→무채색으로 번쩍였다 사라진다 ──
      //   위치(y)는 '몇 번째 찢김인지'로만 정하므로 찢겨 있는 동안 제자리에 머문다(위로 안 따라 올라감).
      //   ★흔들리는 건 찢긴 조각뿐이다 — 일러 전체는 안 흔들린다.
      var tearPx = g.dh * s.tearH;                 // 찢김 줄 굵기(픽셀)
      for (var k = 0; k < s.tears.length; k++) {
        var tr = s.tears[k];
        var local = (f + tr.phase) % s.tearPer;    // 이번 주기에서 흐른 프레임
        if (local >= s.tearOn) continue;           // 지금은 안 찢어져 있는 상태
        var stepN = Math.floor(local / s.tearStep);            // 0 테마색 → 1 무채색 → 2 색없음
        var cyc = Math.floor((f + tr.phase) / s.tearPer);      // 이번이 몇 번째 찢김인지
        var y0 = g.dy + hnoise(tr.seed + cyc * 7.7) * (g.dh - tearPx);   // 찢기는 높이(이번 회차 고정)
        tearRow(ctx, art, g, s, y0, tr.seed + cyc * 4.3 + stepN, tearFlash(stepN, acc));
      }
    },

    /* ── 기록 찢김 : '기록 스캔(느리게)'의 막대와 같은 자리·같은 타이밍으로 일러를 찢는다 ──
       막대가 캐릭터와 겹치는 높이에서만 찢어지므로, 스캔 막대가 일러를 훑고 지나가며
       그 자리를 뜯어내는 것처럼 보인다. 막대 자체는 별개 레이어('기록 스캔(느리게)')가 그린다.
       ★화면 장악(takeover) : 진짜 <img>는 숨기고 이 캔버스가 일러를 대신 그린다. */
    archiveTear: function (ctx, W, H, f, s, acc) {
      var art = s.art;
      if (!art || !art.naturalWidth) return;
      art.style.opacity = 0;
      var g = artRect(art, s.canvasRect());
      if (!g) return;
      ctx.drawImage(art, g.dx, g.dy, g.dw, g.dh);   // 온전한 일러 한 장

      var tearPx = g.dh * s.tearH;
      for (var b = 0; b < s.bars.length; b++) {
        var r = s.bars[b];
        // ★막대의 등장 타이밍 계산은 FX.archive 와 똑같다(같은 시드로 만든 같은 막대라 자리도 일치).
        var e = f + r.seed * 0.17, pi = Math.floor(e / r.period);
        var lp = (e - pi * r.period) / r.period;
        if (lp > r.onFrac) continue;                // 막대가 꺼져 있는 쉼 구간
        if (r.y < g.dy || r.y > g.dy + g.dh - tearPx) continue;   // 일러와 안 겹치는 높이는 건너뜀
        var stepN = Math.floor((lp / r.onFrac) * 3);              // 보이는 동안 3단계로 번쩍임
        tearRow(ctx, art, g, s, r.y, r.seed + pi * 4.3 + stepN, tearFlash(stepN, acc));
      }
    },

    /* ── 장악 전환 (S 글리치의 '시작·끝' 느낌만 떼어낸 것) ──
       S 글리치는 [찢김 고조 → 하드컷 번쩍 → 장악 화면 → 하드컷 복귀] 인데,
       여기서는 가운데 '장악 화면'을 빼고 앞뒤 전환만 남겼다.
       평소엔 그냥 일러 → 가끔 짧게 : 디지털 찢김이 고조 → 번쩍 → 짧은 암전
       → 다시 번쩍이며 찢김이 잦아들고 원래대로. 채널이 잠깐 튀었다 돌아오는 느낌.
       ★화면 장악(takeover) : 진짜 <img>는 숨기고 이 캔버스가 일러를 대신 그린다. */
    snapCut: function (ctx, W, H, f, s, acc) {
      var art = s.art;
      if (!art || !art.naturalWidth) return;
      var t = Date.now() % s.period;                          // 이번 주기에서 흐른 시간(ms)
      var A = s.tearIn, B = A + s.cutMs, C = B + s.blackMs, D = C + s.tearOut;
      if (t >= D) { art.style.opacity = 1; return; }          // 평상 : 진짜 일러 그대로, 캔버스는 비움
      art.style.opacity = 0;                                  // 전환 동안엔 캔버스가 일러를 대신 그린다

      var amt = 0, snap = 0, black = false;
      if (t < A)      { amt = 0.15 + 0.5 * ease(t / A); }                     // ① 찢김이 고조
      else if (t < B) { snap = 1 - (t - A) / s.cutMs; black = true; }         // ② 하드컷 번쩍
      else if (t < C) { black = true; }                                       // ③ 짧은 암전
      else { var q = (t - C) / s.tearOut;                                     // ④ 잦아들며 복귀
             amt = 0.5 * (1 - q); snap = (q < 0.25) ? 1 - q/0.25 : 0; }

      if (black) { ctx.fillStyle = rgba(cssVar('--paper','#0a0e14'), 0.92); ctx.fillRect(0,0,W,H); }
      else       { drawArtCyber(ctx, art, s.oc, s.canvasRect(), amt, f); }
      if (snap > 0.01) { ctx.fillStyle = rgba(acc, 0.14 * snap); ctx.fillRect(0,0,W,H); }
    },

    /* ── 셀루카 : 이중인격 (순간 장악) ─────────────────
       얼음 능력과 별개의 '분열' 면. 평상 → 순간 무대 암전 → 캐릭터 '실루엣'만 남고
       두 인격(무채색 본체 + 테마색 다른 자아)이 어긋나며 글리치·흔들림(위험) → 스냅 복귀.
       ★takeover(항상 앞). 벽시계 주기라 드물게(약 18초) 발동 → rAF 스로틀에도 동기 유지. */
    glitchSplit: function (ctx, W, H, f, s, acc){
      // ★셀루카 '이중인격' = 순간 효과. 시작 = S식 디지털 글리치로 캐릭터가 부서지며 '어두운 실루엣'으로,
      //   유지 = 페이지보다 '더 어두운' 단색 + 실루엣 뒤 후광(백라이트) = 취조실/시네마틱 무드(극적),
      //   복귀 = 흰 플래시가 터지며 원래대로. 무채색만(색감은 페이지 배경 톤에 맞춤).
      // ★주사선 색 = --ink(글자색, 테마별 최대대비) — 다크=밝은 줄 / 라이트=어두운 줄.
      //   ↳ 한때 --paper(배경 톤)로 바꿔봤는데 배경과 색이 거의 같아져 줄이 안 보이는 부작용이 있어(2026-07-25) --ink로 되돌림.
      var lineCol = cssVar('--ink', '#eef4ff'), darkCol = cssVar('--paper', '#0a0e14');
      var art = s.art, st = s.stage, hud = s.hud || [];
      var PER = s.per || 18000, ON = s.on || 2800;
      var tms = Date.now() % PER;
      // ── 창 밖(대부분의 시간) : 이 효과가 건드렸던 상태(일러 투명도·HUD) 원복하고 종료 ──
      if (tms >= ON){
        if (s.owned){
          if (art) art.style.opacity = 1;
          if (st)  st.style.transform = '';
          for (var h=0; h<hud.length; h++) hud[h].style.opacity = 1;
          s.owned = false;
        }
        return;
      }
      s.owned = true;
      // ── 국면 : 시작(찢기며 실루엣化) → 싸한 정적(백라이트·주사선) → 끝(같은 방식으로 찢기며 복귀) ──
      //   ★시작과 끝을 같은 길이·같은 방식으로 대칭(끝도 시작과 똑같이 찢기며 드나든다).
      var IN = s.transMs, OUT = ON - IN;
      var inQ  = Math.min(1, tms / IN);                           // 시작 진행 0→1
      var outQ = (tms < OUT) ? 0 : (tms - OUT) / (ON - OUT);      // 끝 진행 0→1
      var glin  = 1 - inQ;                                        // 시작 전환 강도(1→0)
      var glout = outQ;                                           // 끝 전환 강도(0→1) — 시작과 같은 방식
      var cover = Math.min(1, tms/90) * (1 - outQ);               // 어두운 베이스 농도
      var silA  = inQ * (1 - outQ);                               // 실루엣 등장/퇴장
      if (art) art.style.opacity = 0;                             // 장악 동안엔 캔버스가 대신 그린다
      for (var hi=0; hi<hud.length; hi++) hud[hi].style.opacity = 1 - 0.85*cover;   // 프레임 HUD도 뺏김

      var g = artRect(art, s.canvasRect());
      // 실루엣 색 = '주변보다 어두운 쪽'(다크 테마=--paper / 라이트 테마=--ink).
      //   덕분에 어느 테마에서든 '어두운 형태가 밝은 후광 앞에 서 있는' 같은 그림이 된다.
      //   라이트에선 순수 --ink(거의 검정)면 딱딱해 보여서, 조금 옅은 회색(--ink-soft)에
      //   캐릭터 테마색을 타 '부드럽고 차가운 어두운 색'으로 만든다.
      var sil = getSil(s, art, isLight() ? mixCol(cssVar('--ink-faint', '#767676'), acc, 0.14)
                                         : cssVar('--paper', '#0a0e14'));
      //   라이트에선 실루엣도 진하면 튄다 → 농도를 절반 정도로 낮춰 배경에 가깝게(은은하게).
      var silMul = isLight() ? 0.28 : 1;
      ctx.save();
      // ── 1) 페이지보다 살짝 더 어두운 단색 베이스(같은 톤, 너무 까맣지 않게) ──
      ctx.fillStyle = rgba(darkCol, cover); ctx.fillRect(0,0,W,H);                           // 페이지 배경색
      // ★라이트 테마에 검정을 그대로 덧칠하면 '죽은 회색'이 된다 →
      //   차가운 테마색을 옅게 얹고 검정은 조금만 써서 냉기 있는 톤으로 만든다.
      //   ★라이트에서는 검정을 안 덧칠한다 — S 장악 화면처럼 '하얗게' 두고 냉기만 아주 살짝.
      if (isLight()){
        ctx.fillStyle = rgba(acc, 0.012*cover);                                    ctx.fillRect(0,0,W,H);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,' + (0.30*cover).toFixed(3) + ')';             ctx.fillRect(0,0,W,H);
      }
      // ── 2) 백라이트 : 세로로 길게 부드럽게 퍼지는 빛(원 아님). 넓고 옅어 가장자리 없이 스며듦 ──
      var hcx = W*0.5, hcy = H*0.36;
      ctx.save();
      ctx.translate(hcx, hcy); ctx.scale(1.1, 1.95);              // 세로로 길쭉한 빛기둥
      var hR = W*0.80;                                            // 크게 = 원 테두리 프레임 밖으로(부드럽게)
      // ★후광 : 안쪽은 찬 밝은빛(테마의 밝은 쪽), 바깥으로 갈수록 캐릭터 테마색 → 차가운 조명.
      //   라이트에선 테마색을 아주 옅게만 — 무대가 파랗게 물들지 않고 흰 무대로 보이게.
      var haloAcc = isLight() ? 0.045 : 0.13;
      var hg = ctx.createRadialGradient(0,0,0, 0,0, hR);
      hg.addColorStop(0,    rgba(litCol(), 0.22*cover));
      hg.addColorStop(0.30, rgba(acc,      haloAcc*cover));
      hg.addColorStop(1,    rgba(acc, 0));
      ctx.fillStyle = hg; ctx.fillRect(-2*W, -2*H, 4*W, 4*H);
      ctx.restore();
      // ── 3) 주사선 : 실루엣 자리는 모양대로 도려내서 진짜로 안 보이게 ──
      //   색은 글자색(--ink) — 다크=옅은 밝은 줄 / 라이트=옅은 어두운 줄. 양 테마 모두 잘 보인다.
      //   ★그냥 실루엣보다 먼저 그리기만 하면(옛 방식) 라이트 테마는 실루엣 자체가 옅게(silMul=0.28) 얹히므로
      //   그 밑에 깔린 주사선이 비쳐 보였다(2026-07-25 발견) → 실루엣 '모양'으로 주사선 레이어에 실제 구멍을 뚫어서
      //   실루엣이 얼마나 옅게 보이든 그 자리엔 주사선이 아예 없게(오프스크린 s.sc에서 destination-out으로 도려낸 뒤 얹음).
      var scv = s.sc.getContext('2d');
      scv.clearRect(0, 0, W, H);
      scv.fillStyle = rgba(lineCol, s.scanAlpha * cover);
      for (var sy = 0; sy < H; sy += s.scanGap) scv.fillRect(0, sy, W, s.scanLine);
      if (g && sil && silA > 0.02){
        scv.save();
        scv.globalCompositeOperation = 'destination-out';
        scv.drawImage(sil, g.dx, g.dy, g.dw, g.dh);
        scv.restore();
      }
      ctx.drawImage(s.sc, 0, 0, W, H);
      // ── 찢김 한 회차의 위치·길이·두께를 정해 넘겨준다(전환용·실루엣용이 같은 리듬을 쓰게) ──
      //   가로 위치·길이·두께를 회차마다 다르게 — 바깥쪽만이 아니라 여기저기, 굵기도 제각각.
      function eachTear(cb){
        for (var k = 0; k < s.tears.length; k++) {
          var tr = s.tears[k];
          var lo = (f + tr.phase) % s.tearPer;
          if (lo >= s.tearOn) continue;                          // 지금은 안 찢어져 있는 줄
          var cyc = Math.floor((f + tr.phase) / s.tearPer);
          var th = s.tearMinH + hnoise(tr.seed + cyc * 8.9) * (s.tearMaxH - s.tearMinH);
          var uw = s.tearMinW + hnoise(tr.seed + cyc * 2.3) * (s.tearMaxW - s.tearMinW);
          var u0 = hnoise(tr.seed + cyc * 6.1) * (1 - uw);
          var ty = g.dy + hnoise(tr.seed + cyc * 7.7) * (g.dh - g.dh * th);
          cb(ty, th, u0, uw, tr.seed + cyc * 4.3);
        }
      }
      // ※바로 캔버스에 찢으면 아래 베이스·후광까지 지워지므로, 오프스크린(s.sc)에 그린 뒤 통째로 얹는다.
      var sc = s.sc.getContext('2d');

      // ── 5) 시작·끝 전환 : 일러가 얇게 여러 줄로 '진짜 찢겨' 밀려난다('일러 찢김'과 같은 tearRow) ──
      var trA = Math.max(glin, glout);
      if (trA > 0.01 && g){
        sc.clearRect(0, 0, W, H);
        sc.drawImage(art, g.dx, g.dy, g.dw, g.dh);
        eachTear(function(ty, th, u0, uw, seed){
          tearRow(sc, art, g, s, ty, seed, null, [[u0, uw]], th);   // 색 번쩍임 없이 어긋남만
        });
        ctx.globalAlpha = trA; ctx.drawImage(s.sc, 0, 0, W, H); ctx.globalAlpha = 1;
      }

      // ── 6) 실루엣 : 찢긴 띠가 좌우로 '밀린다'(일러는 안 비침) ──
      //   ★원래 자리를 지우고 밀면 그 빈자리로 뒤의 후광이 새어나와 밝은 선·ㄱ자처럼 보인다.
      //     그래서 지우지 않고, 그 띠의 실루엣 조각을 옆으로 옮겨 '덧그리기'만 한다.
      //     → 띠마다 실루엣 윤곽이 좌우로 툭 튀어나와 어긋나 보이고, 밝은 틈은 아예 안 생긴다.
      if (g && sil && silA > 0.02){
        var sw = sil.width, sh = sil.height;
        sc.clearRect(0, 0, W, H);
        sc.drawImage(sil, g.dx, g.dy, g.dw, g.dh);
        eachTear(function(ty, th, u0, uw, seed){
          var tp = g.dh * th;
          var dx = (hnoise(seed + 3.1) * 10 - 5) * s.jitter;       // 좌우로 밀리는 정도(띠마다 방향도 다름)
          sc.drawImage(sil, u0 * sw, (ty - g.dy) / g.dh * sh, uw * sw, tp / g.dh * sh,
                            g.dx + u0 * g.dw + dx, ty, uw * g.dw, tp);
        });
        ctx.globalAlpha = 0.86*silA*cover*silMul; ctx.drawImage(s.sc, 0, 0, W, H); ctx.globalAlpha = 1;
      }

      // ── 7) 진입·복귀 플래시 : 실루엣으로 들어갈 때와 나올 때 각각 아주 짧게 번쩍 ──
      //   spike() = 확 밝아졌다 곧바로 꺼지는 삼각형 모양(0→1→0).
      //   s.flashW = 전환 구간 중 플래시가 차지하는 비율(작을수록 더 짧게 번쩍).
      function spike(q){ return (q > 0 && q < 1) ? (q < 0.3 ? q/0.3 : 1 - (q - 0.3)/0.7) : 0; }
      //   ★둘 다 '전환이 끝나는 순간'에 터진다 : 찢기다가 → 번쩍 → 실루엣 / 찢기다가 → 번쩍 → 원래대로.
      var fa = Math.max(spike((inQ  - (1 - s.flashW)) / s.flashW),    // 들어갈 때(실루엣이 되는 순간)
                        spike((outQ - (1 - s.flashW)) / s.flashW));   // 나갈 때(원래대로 돌아오는 순간)
      if (fa > 0.01){ ctx.fillStyle = rgba(litCol(), s.flashA * fa); ctx.fillRect(0, 0, W, H); }
      ctx.restore();
    },

    /* ── 메릴리 : 떠오르는 기억 조각 ────────────────────
       잊혀진 것들의 주인·영구기억·사서. 잊힌 기록의 단어·기록번호가
       희미하게 떠올랐다(아래→위 부유) 사라짐. 드문드문·시적·코랄, 밤 톤. */
    recall: function (ctx, W, H, f, s, acc) {
      // 스폰 : 깊이감 있는 조각을 드문드문
      s.timer = (s.timer||0) - 1;
      if (s.timer <= 0 && s.active.length < s.maxActive){
        s.timer = 8 + Math.random()*16;                        // 자주 = 쏟아져 들어오는 느낌
        var depth = Math.random();                             // 0 먼·작음 → 1 가까움·큼
        var r = Math.random(), code = r < 0.14, phrase = !code && r < 0.48;   // 단어/문구/암호 섞기
        var text = code   ? s.codes[(Math.random()*s.codes.length)|0]
                 : phrase ? s.phrases[(Math.random()*s.phrases.length)|0]
                          : s.words[(Math.random()*s.words.length)|0];
        s.active.push({
          text: text, depth: depth,
          x: W*(0.06 + Math.random()*(phrase?0.5:0.8)), y: H*(0.24 + Math.random()*0.6),
          age: 0, life: 130 + Math.random()*120,               // 빠른 순환
          size: code ? 12+depth*6 : phrase ? 13+depth*12 : 15+depth*24,
          drift: 0.12 + depth*0.26,                            // 잔잔하게 상승(범람과 대비 — recall은 느리게)
          peak: 0.13 + depth*0.24,                             // 가까울수록 또렷(그래도 은은)
          italic: !code && Math.random() < 0.42,
          redact: !code && Math.random() < 0.13,               // 검열선(지워진 기억)
          warm: Math.random() < 0.28,                          // 일부는 바랜 종이빛
          code: code
        });
      }
      ctx.save(); ctx.textBaseline = 'alphabetic';
      for (var i=s.active.length-1; i>=0; i--){
        var g = s.active[i];
        g.age++; g.y -= g.drift;
        var t = g.age/g.life, fin = Math.min(1,t/0.24), fout = Math.min(1,(1-t)/0.32);
        var e = Math.max(0, Math.min(fin, fout));
        var a = (e*e*(3-2*e)) * g.peak;                        // 매끄러운 페이드(smoothstep)
        if (a < 0.004){ if(t>=1) s.active.splice(i,1); continue; }
        ctx.font = (g.italic?'italic ':'') + '400 ' + g.size.toFixed(0) +
                   'px Georgia,"Nanum Myeongjo","Batang",serif';
        try { ctx.letterSpacing = (1 + g.depth*2.5).toFixed(1) + 'px'; } catch(_){}
        ctx.shadowColor = rgba(acc, a*0.55); ctx.shadowBlur = 5 + g.depth*9;   // 부드러운 발광
        ctx.fillStyle = g.warm ? rgba(brightCol('#f0e0d6'), a) : rgba(acc, a);
        ctx.fillText(g.text, g.x, g.y);
        ctx.shadowBlur = 0;
        var w = ctx.measureText(g.text).width;
        if (g.redact){                                          // 지워진 기억 = 검열선
          ctx.fillStyle = rgba(acc, a*0.85); ctx.fillRect(g.x-2, g.y - g.size*0.32, w+4, Math.max(2, g.size*0.12));
        } else if (g.code){                                     // 기록번호 = 옅은 밑줄
          ctx.fillStyle = rgba(acc, a*0.5); ctx.fillRect(g.x, g.y+3, w, 1);
        }
        if (g.age >= g.life) s.active.splice(i,1);
      }
      try { ctx.letterSpacing = '0px'; } catch(_){}
      ctx.restore();
    },

    /* ── 메릴리 : 먼지 파티클 (기억의 티끌) ──────────────
       기억 글자와 함께 아래→위로 부유하는 먼지. 색=테마색(일부는 바랜 종이빛).
       (글자는 별도 효과 'recall'. 둘을 함께 쌓으면 예전 기억조각 모습.) */
    dust: function (ctx, W, H, f, s, acc) {
      ctx.save();
      for (var di=0; di<s.dust.length; di++){
        var d = s.dust[di];
        d.y -= d.spd;
        d.x += Math.sin(f*d.sway + d.ph) * d.drift;
        if (d.y < -4){ d.y = H+4; d.x = Math.random()*W; }
        var dx = (d.x + W) % W;
        var da = d.a * (0.55 + 0.45*Math.sin(f*d.tws + d.tw));   // 은은한 반짝임
        // ★결정 반짝임 같은 빛번짐(정말 아주 은은하게) : 빛나는 티끌(d.glow)만, 가끔 정점에서 십자 광택.
        if (d.glow){
          var glint = 0.5 + 0.5*Math.sin(f*d.tws + d.tw); glint = glint*glint*glint*glint;   // 드물게 정점(반짝일 때와 동기)
          if (glint > 0.12){
            var bcol = d.warm ? brightCol('#f0e0d6') : acc;      // 바랜 종이빛(라이트 테마=--ink) / 테마색
            var A = 0.11*glint, LEN = d.r*(4 + 5*glint), TH = Math.max(1.5, d.r*1.6);   // 팔 길이(짧게)/두께(납작하게)
            var hg = ctx.createLinearGradient(dx-LEN/2, d.y, dx+LEN/2, d.y);            // 수평 팔
            hg.addColorStop(0,rgba(bcol,0)); hg.addColorStop(0.5,rgba(bcol,A)); hg.addColorStop(1,rgba(bcol,0));
            ctx.fillStyle=hg; ctx.fillRect(dx-LEN/2, d.y-TH/2, LEN, TH);
            var vg = ctx.createLinearGradient(dx, d.y-LEN/2, dx, d.y+LEN/2);            // 수직 팔
            vg.addColorStop(0,rgba(bcol,0)); vg.addColorStop(0.5,rgba(bcol,A)); vg.addColorStop(1,rgba(bcol,0));
            ctx.fillStyle=vg; ctx.fillRect(dx-TH/2, d.y-LEN/2, TH, LEN);
          }
        }
        if (d.glow){ ctx.shadowColor = d.warm ? rgba(brightCol('#f0e0d6'), da) : rgba(acc, da); ctx.shadowBlur = 4; }
        ctx.beginPath(); ctx.arc(dx, d.y, d.r, 0, 6.283);
        ctx.fillStyle = d.warm ? rgba(brightCol('#f0e0d6'), da) : rgba(acc, da);
        ctx.fill();
        if (d.glow) ctx.shadowBlur = 0;
      }
      ctx.restore();
    },

    /* ── 메릴리 : 색인 격자 (순간효과 · 레퍼런스 프레임 움직임 재현) ────
       잊혀진 것들의 주인·사서가 머릿속 거대한 도서관에서 정보를 색인하는 순간.
       ★레퍼런스(merely_2.gif) 프레임 분석의 핵심 움직임 = '중앙에서 바깥으로 퍼지는 링(파문)'.
         (점 위치는 완전히 고정 — 프레임 간 이동 0. 움직이는 건 '어느 점이 켜지는가'다.)
       흐름: 링이 중앙에서 시작해 바깥으로 확장 → 링 전선이 닿은 점부터 등장(그리드가 중앙서 생김)
             → 전선에서 밝기·크기가 커졌다가 지나가면 옅은 베이스로 가라앉음
             → 지나간 점은 격자를 따라 가로/세로 색인 선을 그음 → 끝에 전부 소멸.
       색 = 테마 글자색(무수한 기록) + 캐릭터 테마색(강조 기록) → 라이트/다크 자동. */
    index: function (ctx, W, H, f, s, acc) {
      // ★순간효과 : PER 주기마다 ON 동안만. 데이터스트림처럼 가끔 잠깐 떠올랐다 사라짐.
      var PER = 13500, ON = 5000, tms = Date.now() % PER;
      if (tms > ON) return;                              // 비활성 구간 → 아무것도 안 그림
      var p = tms / ON;                                  // 0..1 한 사이클 진행
      var ink = cssVar('--ink', '#eef4ff');              // 무수한 기록 = 테마 글자색
      // ★라이트 테마 시인성 : 흰 무대에선 '어두운 글자색 점'이 낮은 알파로 옅게 묻힌다(다크에선 밝은 점이 검은 무대에 또렷).
      //   → 라이트일 때만 회색 점(강조색 아닌 점)의 알파·크기를 키워 다크와 존재감을 맞춘다. (색 자체는 profile.css가 단일 출처)
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      var inkBoost = light ? 2.0 : 1;                    // 회색 점·색인선 진하게(라이트에서만)
      var inkSz    = light ? 0.8 : 0;                    // 회색 점 살짝 크게(라이트에서만)
      // 중앙(0)에서 바깥으로 커지는 '원반(disc)' 반경 : 레퍼런스=중앙서 클러스터가 커지며 프레임을 채움(~1.4s)
      var discR = (p/0.42)*1.35; if (discR > 1.35) discR = 1.35;
      var fade = p < 0.80 ? 1 : Math.max(0, 1 - (p-0.80)/0.20);   // 그리드가 유지되다 끝에서 전부 소멸
      ctx.save();
      for (var i=0;i<s.dots.length;i++){ var d=s.dots[i];
        var edge = discR - d.dc - d.jit;                 // >0 : 원반이 이 점을 이미 덮음 / <0 : 아직 원반 밖
        if (edge < -0.02) continue;                      // 원반 밖 → 안 뜸(그리드가 중앙서부터 자라남)
        // ★원반 가장자리가 지날 때 스르륵 '등장' → 이후 그대로 유지(레퍼런스=한번 뜨면 켜진 채 남음)
        var appear = edge/0.10; if (appear > 1) appear = 1; if (appear < 0) appear = 0;
        // 갓 등장한 가장자리만 살짝 더 밝음 = 빛이 퍼지는 앞면
        var glow = edge < 0.13 ? (1 - edge/0.13) : 0;
        var col = d.hot ? acc : ink;                     // 강조 점(~5%)은 테마색
        var boost = d.hot ? 1 : inkBoost;                // 강조색 점은 그대로, 회색 점만 라이트에서 진하게
        var a  = fade * appear * (d.base + d.peak*0.55*glow) * boost;   // 등장 후엔 base로 '유지'(그리드 남음)
        var sz = 2.2 + glow*1.3 + (d.hot ? 0 : inkSz);   // 가장자리에서 살짝 크고, 유지되면 기본 크기(라이트 회색점만 조금 더)

        // 색인 선 : 링이 지난 뒤 격자를 따라 '그어졌다가(head 전진) 시작점부터 지워짐(tail 전진)'
        //   → 선이 격자를 타고 흐르듯 이동. 선마다 랜덤 지연·속도라 서로 다른 시점에 그어짐.
        if (d.line){
          var tSince = p - (d.dc + d.jit)*0.311 - d.ldelay;    // 원반 통과 + 선마다 랜덤 지연
          if (tSince > 0){
            var q = tSince/d.lspd;                  // 0~1 그림 → 1~2 시작점부터 지움(선마다 속도 다름)
            var head = q < 1 ? q : 1, tail = q > 1 ? q-1 : 0;
            if (head > tail && tail < 1){
              var L = s.step;
              ctx.fillStyle = rgba(col, fade*0.34 * (d.hot ? 1 : inkBoost));   // 색인선도 라이트에서 진하게
              if (d.lv) ctx.fillRect(d.x - 0.9, d.y + tail*L, 1.8, (head-tail)*L);   // 세로 선(아래로)
              else      ctx.fillRect(d.x + tail*L, d.y - 0.9, (head-tail)*L, 1.8);   // 가로 선(오른쪽)
            }
          }
        }
        if (a > 0.004){
          ctx.fillStyle = rgba(col, a);
          ctx.fillRect(d.x - sz/2, d.y - sz/2, sz, sz);  // 사각 점(제자리 고정)
        }
      }
      ctx.restore();
    },

    /* ── 메릴리 : 기록 스캔 필드 (레퍼런스 merely_1.gif 재현) ────────
       사서가 머릿속 거대한 아카이브를 훑는 장면. 화면 = 어두운 데이터 필드.
       ★레퍼런스 핵심 3요소 :
         ① 잘게 흩어진 '데이터 점'들 = 제자리 고정, 각자 따로 깜빡(트윙클).
         ② '기록 바' = 가로 막대가 여러 행에 걸쳐 스르륵 그어졌다(쓰기) → 잠깐 유지 → 사라짐.
            바마다 위치·길이·타이밍이 달라 항상 여러 개가 서로 다른 단계에 있음.
         ③ 밝은(활성) 바 뒤엔 부드러운 '광채(bloom)' 후광이 번짐.
       색 = 대부분 테마 글자색(--ink=무수한 기록) + 일부 캐릭터 테마색(강조 기록).
       연속 효과(순간효과 아님) : 아카이브는 늘 돌아간다. 라이트/다크 자동 대응. */
    archive: function (ctx, W, H, f, s, acc) {
      var light = isLight();
      // ★막대 색 = 회색과 섞지 않고 acc(테마색 또는 프로필 툴 컬러피커로 직접 고른 색) 그대로 사용(2026-07-25, 사용자 요청).
      //   배경/강조(hot) 구분은 색이 아니라 아래 boost(불투명도)만으로 준다.
      // ★막대 밝기(불투명도) 상한 : 배경 막대만 이 배수로 옅게, 강조(hot) 막대는 항상 또렷이(아래서 분기).
      //   라이트를 1 이상으로 주면 '켜져있는' 구간 내내 완전 불투명한 딱딱한 덩어리로 보인다 → 1 미만으로 낮춰 은은하게.
      var boost = light ? 0.85 : s.dim;

      // ── ① 점 필드 : 흐린 정적 밝기 + 좌→우 느린 드리프트(점마다 속도 달라 시차감) ──
      for (var i=0;i<s.marks.length;i++){ var m=s.marks[i];
        var mx = (m.bx + f*m.spd) % W; if (mx < 0) mx += W;  // 점마다 다른 속도 → 통짜로 안 움직임. 폭에서 wrap.
        ctx.fillStyle = rgba(acc, m.a * (m.hot?1:boost));    // 점마다 고정된 흐린 밝기(시간에 안 변함)
        ctx.fillRect(mx - m.w/2, m.y - m.h/2, m.w, m.h);
      }

      // ── ② 기록 바 : 번쩍 등장→유지→소멸. 등장마다 '방향(좌→우/우→좌)'대로 순간이동 행진 ──
      for (var b=0;b<s.bars.length;b++){ var r=s.bars[b];
        var e  = f + r.seed*0.17;                         // 바마다 다른 위상
        var pi = Math.floor(e / r.period);                // 이번 '등장' 번호 = 순간이동 단위
        var lp = (e - pi*r.period) / r.period;            // 0..1 주기 진행
        if (lp > r.onFrac) continue;                      // 꺼져있는 쉼 구간
        var t = lp / r.onFrac;                            // 0..1 보이는 동안
        // 번쩍 등장(앞 10%에 확 켜짐) → 유지 → 소멸(뒤 35% 페이드)
        var env = t < 0.10 ? t/0.10 : (t < 0.65 ? 1 : Math.max(0, 1 - (t-0.65)/0.35));
        if (env <= 0.01) continue;
        var len = 16 + hnoise(r.seed + pi*2.1) * Math.min(90, W*0.20);
        var range = Math.max(1, W - len);
        // 등장(pi)마다 dir 방향으로 march 만큼 이동 → 좌→우 또는 우→좌로 번쩍이며 건너뜀. 범위서 순환.
        var px = ((r.startX + r.dir*pi*r.march) % range + range) % range;
        var y  = r.y + Math.round((hnoise(r.seed + pi*3.3)-0.5)*2) * 3;

        // ★막대를 딱딱한 네모 대신 '양 끝이 스르륵 사라지는' 가로 그라데이션으로 → 부드럽게 보인다.
        //   boost는 배경 막대만 낮춰 은은하게(위 ①점 필드와 동일 규칙) — 강조(hot) 막대는 그대로 또렷이.
        var a = Math.min(1, env * (r.hot ? 1 : boost));
        var bg = ctx.createLinearGradient(px, 0, px + len, 0);
        bg.addColorStop(0,    rgba(acc, 0));
        bg.addColorStop(0.22, rgba(acc, a));
        bg.addColorStop(0.78, rgba(acc, a));
        bg.addColorStop(1,    rgba(acc, 0));
        ctx.fillStyle = bg;
        ctx.fillRect(px, y, len, r.th);
      }
    },

    /* ── 메릴리 : 기록 스트림 (기록 스캔을 데이터 스트림처럼 세련되게) ──────
       빈 막대 대신 '모노스페이스 기록'(참조번호·hex·색인코드)이 고정 가로 레인(채널)에서
       좌→우로 타이핑되듯 그어졌다(커서 깜빡) → 유지 → 사라짐. 다음 등장은 새 위치·새 기록으로 순간이동.
       ~12fps 이산 스텝(디지털 질감) + 활성 행 뒤 얇은 발광 밴드라인 + 옅은 스캔라인 = 터미널/HUD 톤.
       색 = 대부분 --ink(무수한 기록) + 일부 --accent(강조 기록). 라이트/다크 자동 대응. */
    stream: function (ctx, W, H, f, s, acc) {
      // ★라이트 테마 : 글자색(--ink)은 거의 검정이라 기록 글자가 새까맣게 나온다 → 옅은 회색으로.
      var ink = isLight() ? cssVar('--ink-faint', '#767676') : cssVar('--ink', '#eef4ff');
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      var boost = light ? 1.5 : 1;
      // ★순간 재생 : s.sync면 벽시계 창 [syncStart,syncEnd]에서만. 창 안에선 '레인마다 한 번' 스태거 스케줄로 등장→입력→소멸(일제 페이드 아님).
      var tick = 0, gA = 1, sp = 0;
      if (s.sync){
        var stms = Date.now() % s.syncPer;
        var a = s.syncStart || 0, b = (s.syncEnd != null ? s.syncEnd : s.syncOn);
        if (stms < a || stms > b) return;                 // 창 밖 → 안 그림
        sp = (stms - a) / (b - a);
        gA = sp < 0.08 ? sp/0.08 : 1;                     // 들머리 페이드인만(글자는 각자 여운 남기며 소멸)
      } else {
        tick = Math.floor(f / 5);                         // 상시(비동기) : ~12fps
      }
      ctx.save(); ctx.globalAlpha = gA;

      // 옅은 스캔라인(피드 질감)
      ctx.fillStyle = rgba(ink, 0.018 * boost);
      for (var sy=0; sy<H; sy+=3) ctx.fillRect(0, sy, W, 1);

      ctx.textBaseline = 'middle';
      for (var i=0;i<s.rows.length;i++){ var r=s.rows[i];
        var t, pick;
        if (s.sync){                                      // ★동기(순간) : 레인마다 한 번, 창 안에 스태거 스케줄 → 시작·소멸 제각각(각자 입력 끝내고 여운 남기며 사라짐)
          var rt0 = hnoise(i*3.7) * 0.5;                  // 등장 시작(창 0~50%, 레인마다 다름)
          var dur = 0.42 + hnoise(i*5.1) * 0.20;          // 수명(입력+유지+소멸)
          if (rt0 + dur > 0.98) rt0 = 0.98 - dur;         // 창 안에서 마치게
          if (sp < rt0 || sp > rt0 + dur) continue;       // 자기 구간 밖 → 안 그림
          t = (sp - rt0) / dur; pick = 0;
        } else {                                          // 상시(비동기) : 순환
          var e = tick + r.phase, pi = Math.floor(e / r.period);
          var local = e - pi*r.period, onSteps = r.period * r.onFrac;
          if (local >= onSteps) continue;                 // 쉬는 구간(채널 빔)
          t = local / onSteps; pick = pi;
        }
        var col = r.hot ? acc : ink;
        ctx.font = r.fs + "px 'Share Tech Mono',monospace";
        var tok = s.tokens[Math.floor(hnoise(i*7.1 + pick*3.3) * s.tokens.length)];
        var tw  = ctx.measureText(tok).width;
        var x0  = Math.round(hnoise(i*2.7 + pick*5.1) * Math.max(1, W - tw));
        // 타이핑 : 앞 40%에 글자수 늘어남(좌→우) → 유지 → 뒤 여운 소멸(레인마다 시점 다름)
        var reveal = t < 0.40 ? t/0.40 : 1;
        var fade   = t > 0.62 ? Math.pow(Math.max(0, (1-t)/0.38), 1.6) : 1;   // 각 글자 스스로 여운 남기며 소멸(이징)
        var nchar  = Math.round(tok.length * reveal);
        if (nchar <= 0) continue;
        var shown  = tok.substring(0, nchar), shownW = ctx.measureText(shown).width;

        // 얇은 발광 밴드라인(활성 행 뒤) : 흰 얇은 선 + 은은한 accent 글로우
        var bandA = fade * (r.hot ? 1 : 0.7);
        ctx.fillStyle = rgba(ink, 0.10*bandA*boost); ctx.fillRect(x0, r.y-1, shownW, 2);
        var gg = ctx.createLinearGradient(0, r.y-7, 0, r.y+7);
        gg.addColorStop(0, rgba(acc,0)); gg.addColorStop(0.5, rgba(acc, 0.06*bandA*boost)); gg.addColorStop(1, rgba(acc,0));
        ctx.fillStyle = gg; ctx.fillRect(x0, r.y-7, shownW, 14);

        // 기록 텍스트 + 타이핑 커서(끝에 깜빡이는 블록)
        ctx.fillStyle = rgba(col, Math.min(1, fade) * (r.hot?0.9:0.5) * boost);
        ctx.fillText(shown, x0, r.y);
        if (reveal < 1 && (tick & 1)){
          ctx.fillRect(x0 + shownW + 1, r.y - r.fs*0.42, r.fs*0.55, r.fs*0.84);   // 커서
        }
      }
      ctx.restore();
    },

    /* ── 메릴리 : 필름 번 (순간 장악 · 오래된 기억 상영→연소) ─────────
       평상엔 숨어있다 가끔(≈16초마다 ~4초) 오래된 필름 릴이 돌아가듯 화면을 장악 :
       따뜻한 상영 틴트 + 그레인 + 세로 스크래치 + 게이트 위블(흔들림) → 한 점에서 필름이
       '타듯'(과노출 하얀 코어 + 갈변 그을음 링) 번져 프레임을 삼켰다가 사그라지고 복귀.
       색 = 따뜻한 세피아(필름 톤). 순간 임팩트라 평상엔 recall+dust 그대로 보임. */
    filmburn: function (ctx, W, H, f, s, acc) {
      var PER = 16000, ON = 4200, tms = Date.now() % PER;
      if (tms > ON) return;                              // 평상 : 아무것도 안 그림
      var p = tms / ON;
      // 상영 온기 / 연소 불씨 / 그을음 — 밝은 두 색은 라이트 테마에서 --ink 로 대체(흰 배경에 안 묻히게)
      var warm = brightCol('#f6ead9'), ember = brightCol('#c8874a'), dark = '#2a1c12';
      var env = p < 0.2 ? p/0.2 : (p < 0.85 ? 1 : Math.max(0, 1-(p-0.85)/0.15));   // 등장/퇴장
      if (env <= 0.01) return;
      var wob = (Math.sin(f*0.7)*1.5 + Math.sin(f*1.9)*0.8) * env;   // 게이트 위블(필름 흔들림)
      ctx.save(); ctx.translate(0, wob);
      // 1) 따뜻한 상영 틴트 + 비네트
      ctx.fillStyle = rgba(warm, 0.05*env); ctx.fillRect(0,0,W,H);
      var vig = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.2, W/2,H/2,Math.max(W,H)*0.62);
      vig.addColorStop(0, rgba(dark,0)); vig.addColorStop(1, rgba(dark, 0.35*env));
      ctx.fillStyle = vig; ctx.fillRect(0,0,W,H);
      // 2) 필름 그레인(따뜻) + 옅은 세로 스크래치
      var gn = Math.round(W*H/1100 * env);
      ctx.fillStyle = rgba(warm, 0.06);
      for (var i=0;i<gn;i++) ctx.fillRect(Math.random()*W, Math.random()*H, 1, 1);
      for (var sc=0; sc<3; sc++){ if (hnoise(sc*3 + (f/6|0)) > 0.6){
        ctx.fillStyle = rgba(warm, 0.08*env); ctx.fillRect(hnoise(sc*7.7)*W, 0, 1, H); } }
      // 3) 필름 번(연소) : p>0.45 부터 한 점에서 과노출이 번져 프레임을 삼킴
      if (p > 0.45){
        var bp = (p-0.45)/0.4; if (bp > 1) bp = 1;
        var burnEnv = p < 0.85 ? 1 : Math.max(0, 1-(p-0.85)/0.15);
        var flick = 0.9 + 0.1*Math.sin(f*1.3);
        var cx = W*s.bx, cy = H*s.by, R = Math.max(W,H)*(0.15 + 1.1*bp);
        var g2 = ctx.createRadialGradient(cx,cy,R*0.5, cx,cy,R);      // 갈변 그을음 링(불씨 경계)
        g2.addColorStop(0, rgba(ember,0)); g2.addColorStop(0.7, rgba(ember, 0.5*burnEnv));
        g2.addColorStop(0.85, rgba(dark, 0.55*burnEnv)); g2.addColorStop(1, rgba(dark,0));
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx,cy,R,0,6.283); ctx.fill();
        var g3 = ctx.createRadialGradient(cx,cy,0, cx,cy,R*0.72);     // 과노출 코어(하얗게 탐)
        g3.addColorStop(0, rgba(warm, 0.85*burnEnv*flick)); g3.addColorStop(0.6, rgba(warm, 0.3*burnEnv));
        g3.addColorStop(1, rgba(warm,0));
        ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(cx,cy,R*0.72,0,6.283); ctx.fill();
      }
      ctx.restore();
    },

    /* ── 메릴리 : 기억의 범람 (순간 장악 · 서정적 홍수) ──────────────
       평상엔 숨어있다 가끔(≈14초마다 ~3.8초) 잊힌 단어·문구가 아래→위로 손겹 밀려올라
       프레임을 가득 채우고, 세피아 빛으로 부풀었다(과노출) 서서히 빠짐. recall을 증폭한 감정적 순간.
       색 = 무채색(--ink) + 바랜 종이빛. 세리프(명조/Georgia)라 서정적. 순간 임팩트라 평상엔 안 보임. */
    flood: function (ctx, W, H, f, s, acc) {
      var PER = 14000, ON = 3800, now = Date.now(), tms = now % PER, cyc = Math.floor(now / PER);
      if (tms > ON){ s.burst = null; return; }           // 평상 : 아무것도 안 그림
      var p = tms / ON, ink = cssVar('--ink', '#eef4ff'), warm = '#f0e0d6';
      // 이번 사이클의 단어 버스트 생성(한 번만 — 프레임마다 흔들리지 않게)
      if (!s.burst || s.cyc !== cyc){
        s.cyc = cyc; s.burst = []; var g = rng(cyc*131 + 7), n = 16 + Math.floor(g()*8);
        for (var k=0;k<n;k++) s.burst.push({
          text: s.words[Math.floor(g()*s.words.length)],
          x: g()*W, y0: H*(0.5 + g()*0.42), size: 13 + g()*24,
          t0: g()*0.5, dur: 0.4 + g()*0.28, rise: H*(0.42 + g()*0.48),   // 등장시점·수명·상승거리 제각각(조금 더 위까지)
          drift: (g()-0.5)*22, sph: g()*6.28, warm: g()<0.4, italic: g()<0.42
        });
      }
      var sf = p < 0.35 ? p/0.35 : (p < 0.62 ? 1 : Math.max(0, 1-(p-0.62)/0.38));
      var swell = sf*sf*(3-2*sf);                                                 // 부드럽게 부풀었다 빠짐(smoothstep)
      ctx.save();
      var bl = ctx.createRadialGradient(W/2,H*0.5,0, W/2,H*0.5,Math.max(W,H)*0.6);   // 세피아 과노출 부풀음
      bl.addColorStop(0, rgba(warm, 0.13*swell)); bl.addColorStop(1, rgba(warm,0));
      ctx.fillStyle = bl; ctx.fillRect(0,0,W,H);
      ctx.textBaseline = 'alphabetic';
      for (var i=0;i<s.burst.length;i++){ var w=s.burst[i];
        var lt = (p - w.t0)/w.dur; if (lt < 0 || lt > 1) continue;                // 단어마다 제 수명(스태거)
        var e = 1 - Math.pow(1-lt, 3);                                            // ease-out : 떠오르며 감속(부유)
        var y = w.y0 - w.rise*e;
        var fin = Math.min(1, lt/0.28), fout = Math.min(1, (1-lt)/0.40);          // 개별 페이드 인/아웃
        var ev = Math.max(0, Math.min(fin, fout)); ev = ev*ev*(3-2*ev);           // smoothstep
        var a = ev * (w.warm?0.52:0.42) * (0.5 + 0.5*swell);                      // 제 수명 + 전체 부풀음 약결합
        if (a < 0.01) continue;
        ctx.font = (w.italic?'italic ':'') + '400 ' + w.size.toFixed(0) + 'px Georgia,"Nanum Myeongjo","Batang",serif';
        ctx.fillStyle = w.warm ? rgba(warm,a) : rgba(ink,a);
        ctx.shadowColor = rgba(warm, a*0.5); ctx.shadowBlur = 6;
        var sway = Math.sin(f*0.018 + w.sph) * w.drift * (1 - e*0.5);             // 오르며 흔들림 잦아듦
        ctx.fillText(w.text, (w.x + sway + W) % W, y);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    },

    /* ── 메릴리 : 기억 각인 (순간 버스트 · 여기저기 '입력'되는 기록) ─────
       평상엔 숨어있다 가끔(≈13초마다 ~3.6초) 잊힌 단어들이 화면 여기저기에 스타카토로
       하나씩 '타이핑'된다(커서 깜빡). ★크기 격차 크게(작은 글자 다수 + 큰 글자 몇), ★서로 안 겹침.
       다 입력된 뒤 끝에서 한꺼번에 사그라짐. 색 = --ink + 바랜 종이빛, 큰 글자엔 accent 밑줄(각인). */
    imprint: function (ctx, W, H, f, s, acc) {
      var PER = 13000, now = Date.now(), tms = now % PER, cyc = Math.floor(now / PER);
      var A = s.winA || 0, B = (s.winB != null ? s.winB : 3600);   // 활성 창(기본 [0,3600] · 세트 시퀀스는 늦게)
      if (tms < A || tms > B){ s.burst = null; return; }  // 창 밖 : 아무것도 안 그림
      var p = (tms - A) / (B - A), ink = cssVar('--ink', '#eef4ff'), warm = '#f0e0d6';
      function fontOf(w){ return (w.italic?'italic ':'') + (w.big?'600 ':'400 ') + w.size.toFixed(0) + 'px Georgia,"Nanum Myeongjo","Batang",serif'; }
      // ── 이번 사이클 버스트 생성(한 번만) : 크기·위치 정하되 서로 안 겹치게 거절 샘플링 ──
      var front = s.place === 'front';                   // 앞/뒤 레이어면 서로 다른 내용(세트효과용)
      // 얼굴 존(앞 레이어만) : 캐릭터 얼굴(상단 중앙)은 안 가리게 이 영역 배치 금지
      var faceZone = front ? { x0:W*0.28, y0:H*0.03, x1:W*0.72, y1:H*0.44 } : null;
      if (!s.burst || s.cyc !== cyc){
        s.cyc = cyc; s.burst = []; var g = rng(cyc*197 + (front?3:53));
        var N = front ? (4 + Math.floor(g()*3)) : (8 + Math.floor(g()*4));   // 앞=적게 / 뒤=많이(주 밀도) → 세트로 합치면 원래 밀도
        var shorts = s.words.filter(function(t){ return t.length <= 6; });   // 큰 글자는 짧은 것만(화면 넘침 방지)
        for (var k=0;k<N;k++){
          var big = (k === 0) ? true : (g() > 0.85);     // ★첫 글자는 무조건 '엄청 큰' 글자(앞·뒤 각 1개=세트당 1~2개 보장) · 나머지 ~15%
          var pool = big ? shorts : s.words;
          var w = { text: pool[Math.floor(g()*pool.length)],
                    size: big ? 54 + g()*52 : 13 + g()*20, big: big,   // 큰 글자 54~106(엄청 큰) / 작은 13~33
                    warm: g() < 0.35, italic: g() < 0.30, rot: (g()-0.5)*0.06,
                    t0: 0.03 + (k/N)*0.62 + (g()-0.5)*0.03 };
          ctx.font = fontOf(w);
          var wpx = ctx.measureText(w.text).width, hpx = w.size, pad = 8;
          // 안 겹치는 자리 찾기 : 80회 시도, 완전히 안 겹치면 즉시 채택 / 못 찾으면 '가장 덜 겹치는' 자리
          var ok = false, best = null, bestPen = Infinity;
          for (var tryn=0; tryn<80; tryn++){
            var x = W*0.04 + g()*Math.max(1, W*0.92 - wpx), y = H*0.10 + g()*(H*0.80);
            var b = { x0:x-pad, y0:y-hpx/2-pad, x1:x+wpx+pad, y1:y+hpx/2+pad };
            var pen = 0;
            if (faceZone && b.x0<faceZone.x1 && b.x1>faceZone.x0 && b.y0<faceZone.y1 && b.y1>faceZone.y0) pen += 1e7;   // 얼굴은 강하게 회피
            for (var q=0; q<s.burst.length; q++){ var o=s.burst[q].box;
              var ox = Math.min(b.x1,o.x1)-Math.max(b.x0,o.x0), oy = Math.min(b.y1,o.y1)-Math.max(b.y0,o.y0);
              if (ox>0 && oy>0) pen += ox*oy;   // 겹친 넓이 누적(벌점)
            }
            if (pen === 0){ w.x=x; w.y=y; w.box=b; ok=true; break; }
            if (pen < bestPen){ bestPen = pen; best = { x:x, y:y, box:b }; }
          }
          if (!ok){ w.x=best.x; w.y=best.y; w.box=best.box; }   // 최선(가장 덜 겹침)
          w.typeDur = 0.10 + w.text.length*0.012;        // 글자수 비례 타이핑 시간
          s.burst.push(w);
        }
      }
      var endFade = p < 0.8 ? 1 : Math.max(0, 1-(p-0.8)/0.2);   // 끝에서 한꺼번에 사그라짐
      ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var curOn = (Math.floor(f/8) & 1);                 // 타이핑 커서 깜빡임
      for (var i=0;i<s.burst.length;i++){ var wd=s.burst[i];
        var lt = p - wd.t0; if (lt < 0) continue;        // 아직 입력 전
        var typeP = Math.min(1, lt / wd.typeDur);        // 0..1 타이핑 진행
        var nc = Math.max(1, Math.ceil(typeP * wd.text.length));
        var shown = wd.text.substring(0, nc);
        var a = Math.min(1, lt/0.03) * endFade * (wd.big ? 0.6 : 0.5) * (front ? 1 : 0.82);   // 뒤 레이어는 살짝 어둑(깊이감)
        if (a < 0.01) continue;
        var col = wd.warm ? warm : ink;
        ctx.save(); ctx.translate(wd.x, wd.y); ctx.rotate(wd.rot);
        ctx.font = fontOf(wd); ctx.fillStyle = rgba(col, a);
        ctx.fillText(shown, 0, 0);
        var cw = ctx.measureText(shown).width;
        if (typeP < 1 && curOn){                         // 입력 중 끝에 깜빡이는 커서
          ctx.fillRect(cw + 2, -wd.size*0.34, wd.size*0.5, wd.size*0.68);
        }
        if (wd.big){                                     // 큰 글자엔 얇은 accent 밑줄(각인)
          ctx.fillStyle = rgba(acc, a*0.5); ctx.fillRect(0, wd.size*0.42, cw, Math.max(1, wd.size*0.03));
        }
        ctx.restore();
      }
      ctx.restore();
    },

    /* ── 메릴리 : 개시 플래시 (세트 시퀀스 시작 신호 · 짧은 세피아 발광) ──
       세트 시퀀스 맨 앞(창 [0,syncOn])에 한 번 확 밝아졌다 꺼짐. 기억 각인 세트의 '트리거'. */
    flashPulse: function (ctx, W, H, f, s, acc) {
      var tms = Date.now() % s.syncPer;
      if (tms > s.syncOn) return;
      var pp = tms / s.syncOn, a = pp < 0.30 ? pp/0.30 : Math.max(0, 1-(pp-0.30)/0.70);   // 빠르게 확→서서히 꺼짐
      if (a <= 0.01) return;
      ctx.fillStyle = rgba('#f0e0d6', 0.32*a); ctx.fillRect(0,0,W,H);
    },

    /* ── 메릴리 : 데이터 스트림(세로) — decode 뒤 효과를 90° 돌려 가로선→세로선 ──
       벡스터 decode의 '뒤(컬럼+밴드)'를 그대로 쓰되 캔버스를 90° 회전(치수 W↔H 스왑)해 세로로 그림.
       기억 각인 창에 동기(INIT.decodeVert가 s.sync 설정). */
    decodeVert: function (ctx, W, H, f, s, acc) {
      ctx.save();
      ctx.translate(W, 0); ctx.rotate(Math.PI/2);       // 90° 회전 → 가로 밴드선이 세로선이 됨
      FX.decode(ctx, H, W, f, s, acc);                  // 치수 스왑(H×W)로 그리기
      ctx.restore();
    },

    /* ── 대각선 라인아트 (레퍼런스: Lea Rosema 'Generative animated SVG diagonal line art' — 원본 코드 이식) ──
       ★'펜' 몇 자루가 각자 돌아다니며 매 스텝(~10fps)마다 45° 선분을 '띡' 찍고 수직으로 한 칸(gap) 이동
         → 평행선이 '일정 간격으로 겹겹이' 쌓임(책 쌓이듯). 페이드 없음.
       가끔(5%) 방향 전환, 가끔(10%) 새 위치로 점프, 선분이 MAX 넘으면 오래된 것부터 제거(롤링).
       색 두 가지 = 테마색(--accent) / 무채색(--ink). 라이트/다크 자동 대응. */
    diagonal: function (ctx, W, H, f, s, acc) {
      var pal = [ cssVar('--ink', '#eef4ff'), acc ];      // 0=무채색(글자색) / 1=테마색
      // ── 상태 전진 : STEP 프레임마다 한 스텝(≈10fps). 밀린 스텝은 따라잡되 폭주 방지. ──
      var curStep = Math.floor(f / s.STEP);
      if (curStep - s.lastStep > 8) s.lastStep = curStep - 1;
      while (s.lastStep < curStep){
        for (var p=0;p<s.pens.length;p++){ var P=s.pens[p];
          if (Math.random() < 0.80){                     // 80% : 이 자리에 선분 한 겹 찍고 수직으로 한 칸 이동
            P.segs.push({ x:P.x, y:P.y, dx:-P.sx*s.SEG, dy:P.sy*s.SEG });
            P.x += P.sx*s.GAP; P.y += P.sy*s.GAP;
          }
          if (Math.random() < 0.05){ P.sx = Math.random()<0.5?-1:1; P.sy = Math.random()<0.5?-1:1; }  // 5% : 방향 전환
          if (Math.random() < 0.10){ P.x = Math.random()*W; P.y = Math.random()*H; }                  // 10% : 새 위치 점프
          if (P.segs.length > s.MAX && Math.random() < 0.8) P.segs.shift();   // 넘치면 오래된 겹부터 제거(롤링)
        }
        s.lastStep++;
      }
      // ── 렌더 : 각 펜의 모든 겹을 한 번에(페이드 없이, 색은 펜별) ──
      ctx.lineCap = 'round'; ctx.lineWidth = 1;
      for (var q=0;q<s.pens.length;q++){ var Q=s.pens[q];
        if (!Q.segs.length) continue;
        ctx.strokeStyle = rgba(pal[Q.ci], 0.9);
        ctx.beginPath();
        for (var k=0;k<Q.segs.length;k++){ var sg=Q.segs[k];
          ctx.moveTo(sg.x, sg.y); ctx.lineTo(sg.x+sg.dx, sg.y+sg.dy); }
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    },

    /* ── 벡스터 : decode 신호 해독 (레퍼런스 재현) ────────
       "미래 데이터 스트림 해독" = 고정 가로밴드 안에서 코드 컬럼이 제자리
       번쩍이며 순간이동, 큰 숫자(누움)가 밴드 선에 걸쳐 중앙을 흐름. ~15fps 이산 스텝.
       앞/뒤 분리 : data-fx-layer="back"(컬럼+상단밴드·일러 뒤) / "front"(하단밴드+큰숫자·일러 앞) */
    decode: function (ctx, W, H, f, s, acc) {
      var tick = Math.floor(f / 4);                     // ~15fps 이산 스텝
      // 글자 눕힘 각 · 밝은 은백. ★이 효과만은 라이트 테마에서도 '다크 테마에서 쓰던 색'을
      //   그대로 쓴다 — 밝은 화면 위에 옅게 얹히는 게 신호처럼 보여서(의도된 예외).
      var CA = Math.PI/2, BR = '#eef4fa';
      // ★순간효과 : 평소엔 숨고 가끔 나타났다 사라짐. s.sync면 지정 창[syncStart,syncEnd]에 동기(예: 기억 각인).
      var env;
      if (s.sync){
        var sper = s.syncPer, st2 = Date.now() % sper, sa = s.syncStart || 0, sb = (s.syncEnd != null ? s.syncEnd : s.syncOn);
        if (st2 < sa || st2 > sb){ env = 0; }
        else { var spp = (st2-sa)/(sb-sa); env = spp<0.15 ? spp/0.15 : (spp<0.8 ? 1 : Math.max(0, 1-(spp-0.8)/0.2)); }
      } else {
        var PER = 15000, ON = 3600, tms = Date.now() % PER;
        env = tms < ON ? Math.min(1, tms/450) * Math.min(1, (ON-tms)/850) : 0;
      }
      if (env <= 0.003) return;                          // 비활성 구간 → 아무것도 안 그림
      function dchar(ch, x, y){ ctx.save(); ctx.translate(x,y); ctx.rotate(CA);
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ch,0,0); ctx.restore(); }
      function gshape(ch, size){                          // 큰 글리프 : 숫자 / 대괄호박스 / M
        if (ch==='BOX'){ var w=size*1.1, h=size*0.72; ctx.lineWidth=size*0.09; ctx.beginPath();
          ctx.moveTo(-w*0.3,-h/2); ctx.lineTo(-w/2,-h/2); ctx.lineTo(-w/2,h/2); ctx.lineTo(-w*0.3,h/2);
          ctx.moveTo(w*0.3,-h/2); ctx.lineTo(w/2,-h/2); ctx.lineTo(w/2,h/2); ctx.lineTo(w*0.3,h/2); ctx.stroke();
        } else if (ch==='M'){ var r=size*0.5; ctx.lineWidth=size*0.1; ctx.beginPath();
          ctx.moveTo(-r,r); ctx.lineTo(-r,-r); ctx.lineTo(0,0); ctx.lineTo(r,-r); ctx.lineTo(r,r); ctx.stroke();
        } else { ctx.font='700 '+Math.round(size)+"px 'Share Tech Mono',monospace";
          ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ch,0,0); }
      }
      function bandline(y, sd){                           // 고정 하얀 선 : 틱마다 깜빡+미세 지터
        var bn = hnoise(sd*31 + tick*0.9), blink = bn<0.13?0:(bn<0.2?0.3:1);
        if (blink<=0) return;
        var jy = y + Math.round((hnoise(sd*7 + tick)-0.5)*3);
        ctx.fillStyle = rgba(BR, 0.42*blink*env); ctx.fillRect(0, jy, W, 1);
        var gg = ctx.createLinearGradient(0, jy-9, 0, jy+9);
        gg.addColorStop(0, rgba(acc,0)); gg.addColorStop(0.5, rgba(acc,0.09*blink*env)); gg.addColorStop(1, rgba(acc,0));
        ctx.fillStyle = gg; ctx.fillRect(0, jy-9, W, 18);
      }

      if (s.layer === 'front') {                          // ── 앞 : 하단 밴드 + 큰 숫자 ──
        if (!s.noLine) bandline(s.bandB, 2);
        for (var i=0;i<s.ghosts.length;i++){ var gh=s.ghosts[i];
          var sd2=gh.hold+gh.gap, e=tick+gh.phaseT, step=Math.floor(e/sd2), local=e-step*sd2;
          if (local >= gh.hold) continue;
          var total = gh.startX + step*gh.travelStep;     // 중앙 존서 천천히 오른쪽 드리프트
          var x = gh.x0 + (total % gh.zone) + (hnoise(gh.seed+step*1.7)-0.5)*gh.jitter;
          var cy = (gh.line==='top'? s.bandT : s.bandB);
          var ch = gh.variants[step % gh.variants.length];
          var size = gh.baseSize * (0.7 + hnoise(gh.seed+step*3.1)*0.6);   // 커졌다 작아졌다
          ctx.save(); ctx.filter = gh.blur>0 ? 'blur('+gh.blur.toFixed(1)+'px)' : 'none';
          var layers = gh.blur>0 ? 4 : 1;
          for (var q=0;q<layers;q++){ var off = layers>1 ? (q-(layers-1)/2)*(gh.smear/layers) : 0;
            ctx.save(); ctx.translate(x+off, cy); ctx.rotate(CA);       // 큰 숫자도 눕힘
            var col = rgba(gh.sharp?BR:acc, gh.alpha/layers*(layers>1?1.4:1)*env);
            ctx.fillStyle=col; ctx.strokeStyle=col; gshape(ch, size); ctx.restore();
          }
          ctx.restore();
        }
        ctx.filter='none';
      } else {                                            // ── 뒤 : 상단 밴드 + 코드 컬럼 ──
        if (!s.noLine) bandline(s.bandT, 0);              // s.noLine이면 선 없이 글자만
        var bandH = s.bandB - s.bandT;
        ctx.save(); ctx.filter='blur(0.8px)';             // 살짝 흐릿
        for (var c2=0;c2<s.cols.length;c2++){ var c=s.cols[c2];
          var sd3=c.hold+c.gap, e2=tick+c.phaseT, step2=Math.floor(e2/sd3), local2=e2-step2*sd3;
          if (local2 >= c.hold) continue;                 // 사라진 틱(번쩍)
          var cx = c.homeX + (hnoise(c.seed+step2*2.7)-0.5)*c.range;   // 좌우 자유 순간이동
          var seq = '<∧' + c.variants[step2 % c.variants.length] + '∨>';
          var chSp = c.fs*1.5, maxSp = bandH/Math.max(1, seq.length-1); if (chSp>maxSp) chSp=maxSp;
          ctx.font = c.fs + "px 'Share Tech Mono',monospace";
          for (var k2=0;k2<seq.length;k2++){ var py2 = s.bandT + k2*chSp;
            var fl = hnoise(c.seed+step2*13+k2) > 0.9;
            ctx.fillStyle = rgba(acc, (fl?Math.min(1,c.alpha*2.1):c.alpha)*env);
            dchar(seq[k2], cx, py2);
          }
        }
        ctx.restore(); ctx.filter='none';
      }
    },

    /* ── 마이티 : 심박(ECG) ─────────────────────────────
       좁은 밴드(fx-bg)에서 심전도 파형이 좌→우로 훑는다.
       ※그림 함수는 이거 하나뿐이고, INIT 세 개가 파형 모양과 리듬만 바꾼다:
         INIT.ecg(상시 = 쉬지 않고 계속)
         INIT.ecgFlash(순간 = 한 번 나왔다 쉬었다 반복)
         INIT.ecgMonitor(순간 = 모니터 파형이 훑고 지나가며 '그리면서 동시에' 뒤가 지워짐)
         INIT.ecgWipe(순간 = 끝까지 다 그린 뒤에 왼쪽부터 밀어 지움) */
    ecg: function (ctx, W, H, f, s, acc) {
      // ── 훑는 머리 위치(head)와 흐림 정도(fadeA)를 정한다 ──
      //   s.period 가 있으면 '순간효과'(INIT.ecgFlash), 없으면 '상시'(INIT.ecg)로 갈린다.
      var head, fadeA = 1, sweeping = true, eraseX = 0;
      if (s.period) {
        // 순간효과 : 벽시계(Date.now)로 한 주기를 나눈다.
        //   그리기(sweep) → 머무름(hold) → 지우기(erase) → 사라짐(fade) → 쉼(나머지)
        //   erase 가 0이면 '지우기' 구간이 없다(기존 심박·심박(모니터)와 동일).
        var live = s.sweep + s.hold + s.erase + s.fade;    // 보이는 총 시간
        var t = Date.now() % s.period;                     // 이번 주기에서 흐른 시간(ms)
        if (t >= live) return;                             // 쉬는 구간 — 아무것도 안 그림
        sweeping = t < s.sweep;
        head = Math.min(t / s.sweep, 1) * W;               // 그려진 오른쪽 끝
        if (s.erase && t > s.sweep + s.hold)               // 다 그린 뒤, 왼쪽부터 밀어 지운다
          eraseX = Math.min(1, (t - s.sweep - s.hold) / s.erase) * W;
        fadeA = (t < live - s.fade) ? 1 : 1 - (t - (live - s.fade)) / s.fade;   // 끝에서 서서히 사라짐
        if (s.fadeIn) fadeA = Math.min(fadeA, t / s.fadeIn);   // 나타날 때 서서히 밝아짐
        // 주기마다 파형 크기를 조금씩 다르게(주기 번호로 정해지는 값 → 프레임마다 안 흔들림)
        s.amp = 0.85 + hnoise(Math.floor(Date.now() / s.period)) * 0.28;
      } else {
        // 상시 : 좌→우로 쉬지 않고 계속 훑고, 끝에 닿으면 처음으로 되돌아간다.
        head = Math.min(s.scanX, W);
        s.scanX += s.speed;
        if (s.scanX >= W + W*0.06){ s.scanX = 0; s.amp = 0.85 + Math.random()*0.28; }
      }

      var mid = H*0.5, AMP = H*0.40;
      function waveY(x){ var t = x/W;
        for (var i=0;i<s.pat.length-1;i++){ var a=s.pat[i], b=s.pat[i+1];
          if (t>=a[0] && t<=b[0]){ var ff=(t-a[0])/((b[0]-a[0])||1); return (a[1]+(b[1]-a[1])*ff)*AMP*s.amp; } }
        return 0; }
      // 파형을 가로 a 부터 b 까지만 이어 그린다(a=0 이면 처음부터 = 그린 게 계속 남음).
      function drawSeg(a, b){
        if (b <= a) return;
        ctx.beginPath();
        ctx.moveTo(a, mid + waveY(a));
        for (var i=0;i<s.pat.length;i++){ var px=s.pat[i][0]*W;
          if (px <= a) continue;                           // 아직 시작점 앞
          if (px >= b) break;                              // 끝점을 넘음
          ctx.lineTo(px, mid + s.pat[i][1]*AMP*s.amp); }
        ctx.lineTo(b, mid + waveY(b));
        ctx.stroke(); }
      // 파형이 남아 있는 왼쪽 끝 :
      //   s.tail — 그리는 내내 머리 뒤로 그만큼만 남기고 지움(모니터처럼 한 구간만 흘러감)
      //   eraseX — 다 그린 뒤 '지우기' 구간에서 왼쪽부터 밀고 들어오는 지우개
      var tail = Math.max(eraseX, s.tail ? Math.max(0, head - s.tail * W) : 0);

      ctx.save();
      ctx.globalAlpha = fadeA;                             // 사라지는 구간에 전체가 함께 흐려짐
      if (s.round) { ctx.lineJoin='round'; ctx.lineCap='round'; }        // 선 끝이 둥근 모니터 파형
      else         { ctx.lineJoin='miter'; ctx.lineCap='butt'; ctx.miterLimit=10; }
      ctx.strokeStyle = rgba(acc,0.28); ctx.lineWidth = 4;   drawSeg(tail, head);
      ctx.strokeStyle = acc;            ctx.lineWidth = 1.8; drawSeg(tail, head);
      if (sweeping && s.headDot) {                         // 훑는 동안만 머리에 밝은 점
        var hy = mid+waveY(head);
        ctx.fillStyle = rgba(acc,0.95); ctx.beginPath(); ctx.arc(head,hy,2.6,0,6.2832); ctx.fill();
      }
      ctx.restore();
    },

    /* ── 입체 격자 (레퍼런스: 3D 와이어프레임 그리드) ─────
       무대 위·아래에 격자 '평면'이 한 장씩(천장·바닥) 깔려 있고, 둘 다
       화면 세로 가운데(지평선)로 멀어진다 → 가운데는 자연히 비어 캐릭터를 안 가림.
       가로줄이 계속 앞으로 밀려나와 '다가오는' 느낌. 교차점마다 작은 점.
       색은 캐릭터 테마색(--accent) 하나.
       ※그림 함수는 이거 하나뿐이고, 아래 INIT 두 개가 숫자만 바꿔 두 가지 느낌을 만든다:
         INIT.grid3d(평지 = 굴곡 0) · INIT.grid3dTerrain(지형 = 굴곡 크게)
       ※모양·속도를 바꾸려면 그 INIT 의 숫자만 고치면 된다. */
    grid3d: function (ctx, W, H, f, s, acc) {
      var t = f * s.speed;                       // 지금까지 다가온 거리(계속 커짐)
      function mod(a, b){ return ((a % b) + b) % b; }   // 항상 0 이상인 나머지(줄 순환용)

      // ── 월드 좌표(x=좌우, z=깊이) → 화면 좌표 ─────────
      //   원근의 기본 공식: 화면에서의 크기 = 실제 크기 ÷ 거리. z가 클수록 멀고 작게 보인다.
      function sx(x, z){ return W/2 + x * s.focal / z; }
      //   plane = +1 아래(바닥) / -1 위(천장). 같은 계산을 위아래로 뒤집어 써서 대칭을 만든다.
      function sy(x, z, plane){ return s.horizon + plane * (s.camH + wave(x, z)) * s.focal / z; }

      // ── 표면의 높낮이(굴곡) ──────────────────────────
      //   사인파 세 겹(큰 굴곡 → 잔 굴곡)을 더해 언덕처럼 울퉁불퉁하게 만든다.
      //   깊이를 z 가 아니라 (z + t)로 읽는 것이 핵심 : 굴곡이 격자에 '붙어서' 줄과 함께
      //   앞으로 다가온다 → 가만히 출렁이는 게 아니라 지형 위를 지나가는 느낌이 된다.
      //   s.waveAmp 가 0이면 세 겹이 통째로 0 = 완전 평지(기본).
      //   값이 클수록 평면이 카메라에서 멀어짐 = 화면에서 바깥(아래/위)으로 밀림.
      //   마지막 항(s.bowl)은 가장자리를 위로 휘게 해 그릇 모양을 만든다(0이면 반듯한 평면).
      function wave(x, z){
        var zz = z + t;
        return s.waveAmp * ( Math.sin(x*0.9 + zz*1.7) * 0.55
                           + Math.sin(x*0.5 - zz*1.1) * 0.30
                           + Math.sin(x*2.3 + zz*3.1) * 0.15 )
             - s.bowl * x * x;
      }
      // 깊이에 따른 밝기 : 먼 쪽(지평선 근처)은 어두워 사라지고 가까울수록 밝다.
      //   세로 그라데이션 한 장으로 선·점 전부에 적용(캔버스 좌표 기준이라 저절로 맞는다).
      function depthFade(plane, zFar, maxA){
        var yFar  = s.horizon + plane * s.camH * s.focal / zFar;
        var yNear = s.horizon + plane * s.camH * s.focal / s.near;
        var g = ctx.createLinearGradient(0, yFar, 0, yNear);
        g.addColorStop(0,    rgba(acc, 0));           // 가장 먼 줄 = 완전히 사라짐
        g.addColorStop(0.20, rgba(acc, maxA*0.40));
        g.addColorStop(1,    rgba(acc, maxA));        // 가장 가까운 줄 = 제일 진함
        return g;
      }

      for (var p = 0; p < 2; p++) {
        var plane = (p === 0) ? 1 : -1;              // 0회차=아래(바닥) · 1회차=위(천장)
        // ★위·아래가 다른 것은 '가장 먼 줄'뿐 : 가까운 쪽(화면 바깥)은 s.near 로 똑같다
        //   → 격자가 화면 위아래 끝까지 닿는 건 그대로고, 위쪽만 지평선에서 더 멀리서 끝난다
        //   = 가운데 빈 공간이 위쪽에서 더 넓어진다.
        var zFar   = (plane === 1) ? s.far : s.farTop;
        var span   = zFar - s.near;
        var rowGap = span / s.rows;                  // 가로줄 사이 깊이 간격(평면마다 따로)
        var zStep  = span / 24;                      // 세로줄을 그릴 때 깊이 샘플 간격
        var c, r, z, x, X, Y;

        // ── 격자 선 : 세로줄(멀리 뻗는 줄) + 가로줄(옆으로 잇는 줄)을 한 경로에 모아 그린다 ──
        ctx.beginPath();
        // 세로줄 : 깊이를 촘촘히 훑으며 이어 그림 → 굴곡을 따라 휜다. 화면에선 제자리(안 움직임).
        for (c = -s.colN; c <= s.colN; c++) {
          x = c * s.colGap;
          ctx.moveTo(sx(x, s.near), sy(x, s.near, plane));
          for (z = s.near + zStep; z <= zFar; z += zStep) ctx.lineTo(sx(x, z), sy(x, z, plane));
        }
        // 가로줄 : 깊이 하나에 좌우로 쭉. t 만큼 계속 앞으로 오고, 앞을 지나면 맨 뒤로 되돌아간다.
        for (r = 0; r < s.rows; r++) {
          z = s.near + mod(r * rowGap - t, span);
          ctx.moveTo(sx(-s.colN * s.colGap, z), sy(-s.colN * s.colGap, z, plane));
          for (c = -s.colN + 1; c <= s.colN; c++) { x = c * s.colGap; ctx.lineTo(sx(x, z), sy(x, z, plane)); }
        }
        // 같은 경로를 두 번 그어 부드러운 빛번짐(굵고 흐리게 → 가늘고 또렷하게)
        ctx.lineWidth = 2.6; ctx.strokeStyle = depthFade(plane, zFar, 0.16); ctx.stroke();
        ctx.lineWidth = 1;   ctx.strokeStyle = depthFade(plane, zFar, 0.50); ctx.stroke();

        // ── 교차점 : 격자가 만나는 자리에 작은 점(가까울수록 크다) ──
        ctx.fillStyle = depthFade(plane, zFar, 0.85);
        ctx.beginPath();
        for (r = 0; r < s.rows; r++) {
          z = s.near + mod(r * rowGap - t, span);
          var rad = Math.max(0.7, 3.0 * s.near / z);
          for (c = -s.colN; c <= s.colN; c++) {
            x = c * s.colGap; X = sx(x, z); Y = sy(x, z, plane);
            if (X < -8 || X > W + 8 || Y < -8 || Y > H + 8) continue;   // 화면 밖은 건너뜀(가벼워짐)
            ctx.moveTo(X + rad, Y); ctx.arc(X, Y, rad, 0, 6.2832);
          }
        }
        ctx.fill();
      }
    }
  };

  /* 효과별 초기 상태(리사이즈마다 재생성) — 시드 난수로 배치 고정 */
  var INIT = {
    film: null,
    projector: null,   // 영사기 = 시간함수만(고정 지오메트리 없음) → 초기화 불필요
    // 영사기(순간) : 영사기 그림 그대로 + 기억 각인과 같은 주기(13s/3.6s)에만 재생.
    projectorFlash: function (s, W, H) {
      s.sync = true; s.syncPer = 13000; s.syncOn = 3600;
    },
    crack: function (s, W, H, cv) {
      var g = rng(11); s.cracks = []; s.rings = [];
      s.stage = cv && cv.closest('.stage'); s.shook = false;   // 임팩트 흔들림 대상(프레임)
      s.ox = W*0.36; s.oy = H*0.30;               // 임팩트 점(주먹 자국) = 머리 좌상단 빈 공간(몸 밖)
      var N = 11, angs = [];
      for (var i=0;i<N;i++){
        // 방사 크랙 : 임팩트 점에서 사방으로 뻗음(발밑·위·옆 전부)
        var ang = (i/N)*Math.PI*2 + (g()-0.5)*0.5; angs.push(ang);
        var reach = Math.max(W,H)*(0.95+g()*0.7);
        var pts=[], x=s.ox, y=s.oy, branch=[], steps=6+Math.floor(g()*4), seg=reach/steps;
        for (var k=0;k<steps;k++){ ang += (g()-0.5)*0.4;
          x += Math.cos(ang)*seg; y += Math.sin(ang)*seg; pts.push([x,y]);
          if (k>1 && g()>0.5){ var ba=ang+(g()-0.5)*1.5, bl=seg*(0.4+g()*0.6);
            branch.push([[x,y],[x+Math.cos(ba)*bl, y+Math.sin(ba)*bl]]); }
          if (x<-30||x>W+30||y<-30||y>H+30) break;
        }
        s.cracks.push({o:[s.ox,s.oy], pts:pts, branch:branch, a:0.6+g()*0.4, w:0.7+g()*0.8});
      }
      // ★동심 링(주먹 충격의 거미줄 고리) — 방사선을 이어 '소실점' 아닌 '유리 파쇄'로
      var radii = [15, 33, 58, 92];
      for (var ri=0; ri<radii.length; ri++){
        var base = radii[ri]*(0.85+g()*0.5), rp=[];
        for (var a2=0; a2<angs.length; a2++){
          var jr = base*(0.8+g()*0.4);            // 꼭지점 반지름 흔들림(불규칙 다각형)
          rp.push([s.ox+Math.cos(angs[a2])*jr, s.oy+Math.sin(angs[a2])*jr]);
        }
        s.rings.push({pts:rp, a:0.5+g()*0.4, w:0.55+g()*0.5});
      }
    },
    crackBack: null,   // ↓ INIT 정의 뒤에서 crack 과 동일 지정(같은 시드=동일 균열)
    snow: function (s, W, H) {
      var g = rng(23); s.flakes = [];
      var n = Math.round(Math.max(28, W*H/8500));
      for (var i=0;i<n;i++){
        var t = g();
        var huge = t > 0.9, big = t > 0.5;          // 아주 큰 결정 10% · 큰 결정 40%
        var r = huge ? 8+g()*6 : big ? 3.5+g()*3 : 1.5+g()*2;
        s.flakes.push({
          x: g()*W, y: g()*H, r: r,
          spd: (huge?0.16:big?0.26:0.42) + g()*0.34,  // 낙하속도↓ = 더 사뿐히 내려옴
          sway: 0.008+g()*0.014, ph: g()*6.28,        // 좌우 흔들림 느긋하게
          drift: 0.15+g()*0.4, a: (huge?0.55:big?0.5:0.35)+g()*0.3, big: big||huge,  // 좌우 폭 줄임(너무 안 움직이게)
          rot: g()*6.28, rspd: (g()-0.5)*0.02,
          white: g() < 0.4                          // 40%는 하얀 눈, 나머지는 테마색
        });
      }
    },
    frost: function (s, W, H) {
      // ★성에 = 가장자리부터 안으로 번지는 '가루 서리' + 고사리 결정을 오프스크린 텍스처 1장에 미리 구움.
      //   (레퍼런스 _local/reference/fx/frost.jpg '느낌'을 코드로 재현 — 이미지 파일은 안 씀.)
      //   매 프레임(FX.frost)은 이 텍스처를 테마색 틴트+냉기 서지로 얹기만 함.
      s.tintCache = {};                                       // 텍스처가 새로 구워지므로 색 캐시 초기화(리사이즈 대비)
      var gf = rng(91);
      var tex = document.createElement('canvas'); tex.width = Math.max(1,W); tex.height = Math.max(1,H);
      var x = tex.getContext('2d');
      // 가장자리 근접도(0 가장자리 → 1 중앙). ★위아래(enY)는 1.7배 빨리 옅어지게 = 키 큰 셀루카 위·아래 답답 방지(서리 주로 좌우).
      function edgeN(px, py){
        var enX = Math.min(px, W-px)/(W*0.5), enY = Math.min(py, H-py)/(H*0.5);
        return Math.min(enX, enY*1.7);
      }

      // ── ① 가루 서리 : 미세 반점을 가장자리에 촘촘, 중앙으로 갈수록 성기고 옅게(비네트) ──
      var M = Math.round(W*H/9);                              // 반점 수(밀도) — 값↑ 더 촘촘(레퍼런스처럼 가장자리 거의 꽉)
      for (var i=0;i<M;i++){
        var px = gf()*W, py = gf()*H, en = edgeN(px, py);
        if (en > 0.66) continue;                             // 중앙 34%는 거의 비움(맑은 가운데)
        var wgt = Math.pow(1 - en/0.66, 1.2);                // 가장자리 1 → 안쪽 0
        if (gf() > wgt*0.85 + 0.12) continue;                // 안쪽일수록 반점 확률↓(성기게)
        var a = (0.20 + gf()*0.62) * wgt, r = 0.6 + gf()*1.8; // 안쪽일수록 옅게 · 알갱이 크기
        x.fillStyle = 'rgba(255,255,255,'+a.toFixed(3)+')';
        x.fillRect(px, py, r, r);
      }

      // ── ② 고사리 결정 : 사방 가장자리에서 안쪽으로(2단 재귀 양치 무늬). 큰 것 몇 개 = 악센트 ──
      x.lineCap='round'; x.lineJoin='round';
      function fern(px,py,ang,len,depth){
        if (len<5||depth<0) return;
        var steps=Math.max(4,Math.round(len/6)), sl=len/steps, cx=px, cy=py, w=0.5+depth*0.45, curve=(gf()-0.5)*0.05;
        for (var i2=0;i2<steps;i2++){
          ang += curve+(gf()-0.5)*0.025;
          var nx=cx+Math.cos(ang)*sl, ny=cy+Math.sin(ang)*sl;
          x.strokeStyle='rgba(255,255,255,'+(0.5*(1-i2/steps)).toFixed(3)+')'; x.lineWidth=w;
          x.beginPath(); x.moveTo(cx,cy); x.lineTo(nx,ny); x.stroke();
          if (i2>0 && i2%2===0){ var bl=len*0.5*(1-i2/steps); if(bl>5){ fern(nx,ny,ang-0.82,bl,depth-1); fern(nx,ny,ang+0.82,bl,depth-1); } }
          cx=nx; cy=ny;
        }
      }
      // 씨앗 : 네 코너(안쪽 대각) + 네 변 중앙(안쪽). 각도에 약간 랜덤.
      var seeds = [
        [0,0,0.7],[0,0,1.1], [W,0,Math.PI-0.7],[W,0,Math.PI-1.1],
        [0,H,-0.7],[0,H,-1.1], [W,H,Math.PI+0.7],[W,H,Math.PI+1.1],
        [W*0.5,0,1.57],[W*0.5,H,-1.57], [0,H*0.5,0.1],[W,H*0.5,Math.PI-0.1]
      ];
      for (var si=0; si<seeds.length; si++){ var sd=seeds[si]; fern(sd[0],sd[1], sd[2]+(gf()-0.5)*0.5, 70+gf()*70, 2); }
      s.frostTex = tex;
    },
    // 냉기 서림 : HUD(이름 워터마크·꺽쇠·REC 글씨)도 냉기가 서린 만큼 같이 옅어지게 참조를 잡아둔다(2026-07-25 추가).
    //   ★캔버스 자체는 그 아래(fx-bg, z1)라 꺽쇠(z6)·REC(z5) 위로는 안 덮이므로, 그 요소들 자신을 옅게 해서 '덮인 것처럼' 낸다.
    fog: function (s, W, H, cv) {
      var st = cv && cv.closest('.stage');
      s.hud = st ? [].slice.call(st.querySelectorAll('.stage-head, .corner, .bg-type')) : [];
    },
    // 결정 반짝임 : 원본 '골드러시' 알갱이(개수·속도·은은함은 opts 한 곳에서).
    sparkle: function (s, W, H) {
      buildSparkleGems(s, W, H, { seed:37, div:5600, nMin:28, nMax:120, ryPer:300, ccHalf:78, reflA:0.3, opBase:0.5, opVar:0.3 });
    },
    // 결정 반짝임(은은) : sparkle과 '같은 그림', 개수↓·점멸 더 느리게·더 은은하게만 다름.
    sparkleSoft: function (s, W, H) {
      buildSparkleGems(s, W, H, { seed:43, div:16000, nMin:8, nMax:38, ryPer:440, ccHalf:132, reflA:0.2, opBase:0.3, opVar:0.26 });
    },
    // 반짝이는 눈 : sparkle 반짝임 + 제자리 둥실 부유. ★튜닝 손잡이 = 아래 세 줄(주기·개수).
    snowglint: function (s, W, H) {
      var g = rng(59); s.flakes = [];
      s.ryPer  = 300;                        // rotateY(팔랑) 주기 — 클수록 느림 (sparkle과 동일)
      s.ccHalf = 78;                         // 점멸(밝기 맥동) 반주기 — 클수록 느리게 반짝
      var n = Math.round(Math.max(10, Math.min(48, W*H/18000)));   // 눈송이 개수(더 성기게)
      for (var i=0;i<n;i++){
        s.flakes.push({
          hx: g()*W, hy: g()*H,              // 제자리(부유 중심)
          r:   3 + g()*6,                    // 눈송이 크기
          fsx: 0.006 + g()*0.014, fsy: 0.006 + g()*0.014,   // 부유 주기(x·y 따로 → 원 그리듯 떠다님)
          phx: g()*6.28, phy: g()*6.28,
          ampx: 4 + g()*12, ampy: 4 + g()*12,               // 부유 반경(px)
          rz:  g()*6.283, rotPer: 500 + g()*700,   // 방향 + 느린 스핀
          delay: Math.floor(g()*600),        // 반짝 위상(각자 다르게)
          op:  0.5 + g()*0.3,                // 밝기 편차(은은)
          hot: g() < 0.5                     // 테마색 / 무채색 반반
        });
      }
    },
    glitch: function (s, W, H, cv) {
      s.art = document.getElementById('stageArt');
      s.oc = document.createElement('canvas');      // RGB 색수차용 오프스크린
      s.canvasRect = function(){ return cv.getBoundingClientRect(); };
      var st = cv.closest('.stage');                // 장악 시 같이 숨길 프레임 HUD(꺽쇠·ID·REC)
      s.hud = st ? [].slice.call(st.querySelectorAll('.stage-head, .corner')) : [];
    },
    // 주사선 : 가로줄 굵기·간격. ★느낌을 바꾸려면 여기 숫자만 고치면 된다.
    scanline: function (s, W, H) {
      s.scanGap    = 6;                  // 가로줄 간격(px)
      s.scanLine   = 2;                  // ★가로줄 두께(px) — 작을수록 가는 줄
      s.scanAlpha  = 0.06;               // 가로줄 진하기 — 아주 연하게(키우면 또렷해짐)
    },
    // 훑는 줄 : 아래→위로 올라가는 줄의 굵기·속도.
    sweepLine: function (s, W, H) {
      s.sweepPx    = 2;                  // ★줄 두께(px) — 주사선만큼 얇게
      s.sweepAlpha = 0.9;                // 줄 진하기(1이면 배경색으로 완전히 덮음)
      s.sweepPer   = 180;                // ★한 번 훑고 올라가는 데 걸리는 프레임(약 3초)
    },
    // 별하늘 : 별 개수·속도와 별똥별 주기. ★느낌을 바꾸려면 여기 숫자만 고치면 된다.
    starfield: function (s, W, H) {
      s.starN       = 350;               // 별 개수(원본과 동일)
      s.maxSpeed    = 2;                 // 별이 왼쪽으로 흐르는 최고 속도(1프레임에 px)
      s.starSize    = 1;                 // 별 한 점의 크기(px)
      s.twinkleRate = 0.0015;            // 별 하나가 한 프레임에 반짝 커질 확률
      s.shootPer    = 420;               // ★별똥별 주기(프레임) — 클수록 드물게(약 7초)
      s.shootSpeed  = 16;                // 별똥별이 지나가는 속도(1프레임에 px)
      s.shootLen    = 260;               // 별똥별 꼬리 길이(px)
      s.shootSize   = 2;                 // 별똥별 굵기(px)
      var g = rng(23);                   // 시드 고정 → 창 크기가 바뀌어도 같은 별자리
      s.stars = [];
      for (var i = 0; i < s.starN; i++) {
        s.stars.push({
          x: g() * W, y: g() * H,
          v: g() * s.maxSpeed,           // 별마다 속도가 달라 멀고 가까운 느낌이 난다
          a: 0.1 + g() * 0.9,            // 밝기 편차
          seed: g() * 9999               // 반짝임 타이밍용
        });
      }
    },
    // 조각 글리치 : 찢김 줄 굵기·개수·속도. ★느낌을 바꾸려면 여기 숫자만 고치면 된다.
    glitchSlice: function (s, W, H, cv) {
      s.art = document.getElementById('stageArt');
      s.canvasRect = function(){ return cv.getBoundingClientRect(); };
      s.tintCache = {};                  // 단색으로 칠한 일러 캐시(색마다 한 장씩 만들어 재사용)
      // ── 찢김(가로줄) ──
      s.tearH      = 0.005;              // ★찢김 줄 굵기(그림 높이 대비) — 작을수록 얇은 줄
      s.tearStep   = 3;                  // 한 단계(초록/빨강/색없음)가 유지되는 프레임 — 툭툭 튀는 속도
      s.tearN      = 6;                  // 찢김 줄 개수 — 여러 군데가 동시에 찢어질 수 있게
      s.tearPer    = 40;                 // ★한 줄이 다시 찢어지기까지의 주기(프레임) — 클수록 뜸함
      s.tearMid    = 0.4;                // ★가운데를 비우는 폭(가로 대비) — 키우면 바깥쪽만 얇게 찢김
      s.jitter     = 1;                  // 좌우로 어긋나는 정도(1 = 레퍼런스와 같은 ±5px 남짓)
      s.shake      = 2;                  // ★찢긴 조각이 위아래로 떨리는 정도(px) — 0이면 좌우로만 어긋남
      s.flashAlpha = 0.85;               // 번쩍일 때 단색으로 덮이는 진하기(1이면 완전 단색)
      //   ※번쩍임 색은 FX 쪽에서 --accent(캐릭터 테마색)·--ink(무채색)를 그때그때 읽는다
      //     → 캐릭터마다, 라이트/다크 테마마다 저절로 맞는 색이 된다(따로 지정할 값 없음).
      s.tearOn = s.tearStep * 3;         // 한 번 찢어졌을 때 유지되는 프레임(3단계)
      s.tears = [];
      for (var i = 0; i < s.tearN; i++)  // 줄마다 찢어지는 차례·난수 씨앗을 달리 줘서 따로 논다
        s.tears.push({ phase: Math.round(hnoise(i * 5.3) * s.tearPer), seed: i * 13.1 });
    },
    // 일러 찢김(느리게) : 그림함수는 '일러 찢김'과 완전히 같은 걸 그대로 재사용 — 다른 건 '얼마나 자주 찢어지는지'뿐.
    //   ★S처럼 상시(항상 켜 둠) 배경 효과로 쓰려고 만듦 — 동시 찢김 줄 수↓·주기↑로 뜸하게만 조정.
    glitchSliceSlow: function (s, W, H, cv) {
      INIT.glitchSlice(s, W, H, cv);                 // 찢김 굵기·번쩍임 색 등 기본은 그대로 물려받고
      s.tearN = 2; s.tearPer = 170;                  // ★이 효과만 뜸하게(개수 6→2, 주기 40→170프레임)
      s.tears = [];
      for (var i = 0; i < s.tearN; i++)
        s.tears.push({ phase: Math.round(hnoise(i * 5.3) * s.tearPer), seed: i * 13.1 });
    },
    // 장악 전환 : 얼마 만에 한 번, 얼마나 길게 튈지. ★느낌을 바꾸려면 여기 숫자만 고치면 된다.
    snapCut: function (s, W, H, cv) {
      s.art = document.getElementById('stageArt');
      s.oc = document.createElement('canvas');      // drawArtCyber 가 쓰는 오프스크린
      s.canvasRect = function(){ return cv.getBoundingClientRect(); };
      s.period  = 9000;                  // ★전환이 일어나는 주기(ms) — 클수록 드물게
      s.tearIn  = 380;                   // 찢김이 고조되는 시간
      s.cutMs   = 120;                   // 하드컷 번쩍
      s.blackMs = 90;                    // 짧은 암전
      s.tearOut = 420;                   // 잦아들며 복귀하는 시간
    },
    glitchSplit: function (s, W, H, cv) {
      INIT.glitchSlice(s, W, H, cv);                // 찢김 설정(굵기·개수·주기)을 '일러 찢김'에서 물려받음
      s.tearN = 10; s.tearPer = 22; s.tearH = 0.007;   // 이 효과는 더 촘촘하고 굵게 찢기게만 조정
      s.tears = [];
      for (var i = 0; i < s.tearN; i++)
        s.tears.push({ phase: Math.round(hnoise(i * 5.3) * s.tearPer), seed: i * 13.1 });
      s.canvasRect = function(){ return cv.getBoundingClientRect(); };
      s.stage = cv && cv.closest('.stage');         // HUD/투명도 원복 참조
      s.hud = s.stage ? [].slice.call(s.stage.querySelectorAll('.stage-head, .corner')) : [];
      s.per = 18000; s.on = 2800;                   // 약 18초마다 2.8초 장악
      s.transMs = 260;                              // ★시작·끝 전환 길이(ms) — 둘이 같다(대칭)
      s.tearMinW = 0.18; s.tearMaxW = 0.75;         // ★찢김 가로 길이 범위(그림 폭 대비) — 제각각 다르게
      s.tearMinH = 0.012; s.tearMaxH = 0.05;        // ★찢김 두께 범위(그림 높이 대비) — 가는 줄~굵은 띠 섞임
      s.flashW = 0.4;                               // ★플래시 길이(전환 구간 대비) — 작을수록 짧게 번쩍
      s.flashA = 0.5;                               // ★플래시 밝기
      s.scanGap = 4; s.scanLine = 1; s.scanAlpha = 0.07;   // 실루엣 뒤에 깔리는 주사선(가늘게)
      s.jitter = 4.5;                               // ★찢긴 띠가 좌우로 밀리는 정도(클수록 확실하게 어긋남)
      s.sc = document.createElement('canvas');      // 찢은 결과를 담을 오프스크린
      s.sc.width = Math.max(1, Math.round(W)); s.sc.height = Math.max(1, Math.round(H));
      s.owned = false; s.silCache = {};             // 실루엣(색상별) 캐시
    },
    recall: function (s, W, H) {
      s.active = []; s.timer = 0;
      s.maxActive = Math.max(7, Math.round(H/95));     // 영구기억 = 기억이 쏟아져 들어오는 밀도
      // 잊힌 기록 = 못 읽는 이국 문자(라틴어·독일어·복잡 한자) + 암호 문자열
      s.words = [
        // 라틴어
        'memento','oblivium','vestigium','silentium','reliquiae','arcanum','requiem',
        'umbra','cinis','perpetua','sepultum','ignotum','lacuna','fragmentum','tenebrae','vetustas',
        // 독일어
        'Vergessen','Erinnerung','Verlust','Schatten','Überrest','Geheimnis','verloren','Verfall',
        // 복잡 한자
        '忘却','記憶','遺失','痕跡','沈默','幽玄','埋葬','追憶','封印','廢墟','亡靈','灰燼','秘匿','殘骸','悠久','遺物','索引','幽冥'
      ];
      // 암호 문자열(가끔) : 로마숫자·참조번호·16진수 — 오래된 기록 느낌
      s.codes = ['MCMLXXXV','No.1985','REF.0912','0x1A9F','§447','LXXVII','MMX·',
                 '0xDEAD','Cod.114','No.0006'];
      // 문장/문구 (못 읽는 이국어) : 라틴어·독일어 + 한자 사자성어
      s.phrases = [
        'memento mori','sub rosa silentium','tempus fugit, memoria manet',
        'in tenebris quaerimus','nihil sub sole novum','quod oblivioni datur',
        'umbra rerum praeteritarum','vanitas vanitatum',
        'was einmal war','die verlorene Zeit','im Schatten der Erinnerung',
        'längst vergangen','niemand erinnert sich',
        '往事如煙','時過境遷','物是人非','過眼雲煙','鏡花水月','滄海遺珠','石沈大海','時光荏苒'
      ];
    },
    dust: function (s, W, H) {
      // 기억의 티끌 = 문자와 함께 부유하는 먼지 파티클
      var gd = rng(53), nd = Math.round(Math.max(30, W*H/5200));
      s.dust = [];
      for (var di=0; di<nd; di++){
        var dbig = gd() < 0.22;                         // 일부는 또렷한 큰 티끌
        s.dust.push({
          x: gd()*W, y: gd()*H, r: dbig ? 1.4 + gd()*1.8 : 0.5 + gd()*1.1,
          spd: 0.08 + gd()*0.32,                        // 위로 부유(문자와 같은 방향, 느리게)
          sway: 0.008 + gd()*0.02, ph: gd()*6.28, drift: 0.12 + gd()*0.5,
          a: (dbig ? 0.16 : 0.08) + gd()*0.16, warm: gd() < 0.45,
          glow: dbig, tw: gd()*6.28, tws: 0.015 + gd()*0.03   // 은은한 반짝임 위상
        });
      }
    },
    index: function (s, W, H) {
      // 색인 격자(레퍼런스 재현) : 32px '꽉 찬' 규칙 격자(거의 모든 점이 존재). 시드로 고정.
      var g = rng(67), step = 32;
      var cols = Math.max(1, Math.round(W/step)), rows = Math.max(1, Math.round(H/step));
      var ox = (W - (cols-1)*step)/2, oy = (H - (rows-1)*step)/2;   // 가운데 정렬
      var cxp = W/2, cyp = H/2, maxD = 0.5*Math.sqrt(W*W + H*H) || 1;
      s.dots = []; s.step = step;
      for (var r=0;r<rows;r++) for (var c=0;c<cols;c++){
        var tx = ox + c*step, ty = oy + r*step;          // 이 점의 격자 제자리(고정)
        s.dots.push({
          x: tx, y: ty,
          dc: Math.sqrt((tx-cxp)*(tx-cxp) + (ty-cyp)*(ty-cyp)) / maxD,  // 중앙 거리(0 중앙 … 1 모서리) — 링 확산용
          jit: (g()-0.5)*0.06,                 // 링 전선이 완벽한 원이 아니게 살짝 흔듦(유기적)
          seed: g()*9999,
          base: 0.15 + g()*0.08,               // ★링 지나간 뒤에도 또렷이 남는 그리드 밝기(안 사라지게)
          peak: 0.26 + g()*0.14,               // 링 전선이 지날 때(부풀 때) 더 밝아짐
          hot:  g() < 0.05,                    // 강조색 점(~5%, 레퍼런스의 블루)
          line: g() < 0.12,                    // 격자를 따라 선을 긋는 점(색인) — ~12%
          lv:   g() < 0.5,                     // 그 선이 세로(true)냐 가로(false)냐 — 반반
          ldelay: g()*0.15,                    // 선이 그어지기 시작하는 랜덤 지연(서로 다른 시점)
          lspd:   0.09 + g()*0.06              // 선 그리기 한 단계 속도(선마다 다르게)
        });
      }
    },

    // 메릴리 archive : 어두운 데이터 필드(레퍼런스 merely_1.gif 재현). 앞/뒤 세트(프리셋)로 씀.
    //   ★뒤(back) = 점 필드 + 가로 기록바 / 앞(front) = 가로 기록바만(캐릭터 앞으로 지나감).
    //   ★구성 : ① 짧은 세로막대 점 필드(중앙 촘촘·좌→우 느린 드리프트) ② 기록 바(얇은것+굵은것, 좌→우/우→좌로 번쩍 순간이동).
    archive: function (s, W, H) {
      buildArchiveBars(s, W, H, { seedF:97, seedB:53, divF:48000, divB:21000, periodBase:32, periodVar:42, marchBase:60, marchVar:130 });
    },
    // 기록 스캔(느리게) : archive와 '같은 그림', 막대 개수↓·주기↑(더 천천히 점멸·행진)만 다름.
    archiveSoft: function (s, W, H) {
      buildArchiveBars(s, W, H, { seedF:101, seedB:61, divF:96000, divB:42000, periodBase:72, periodVar:66, marchBase:36, marchVar:84 });
    },
    // 기록 찢김 : '기록 스캔(느리게)'와 똑같은 막대를 만들고(같은 시드 = 같은 자리·타이밍),
    //   찢김 설정은 '일러 찢김'에서 그대로 물려받는다. 값은 두 곳에만 있고 여기선 조합만 한다(단일 출처).
    archiveTear: function (s, W, H, cv) {
      INIT.glitchSlice(s, W, H, cv);     // 찢김 굵기·가운데 비움·떨림·번쩍임 진하기
      INIT.archiveSoft(s, W, H);         // 막대 위치·주기 (s.place='front' → 앞 막대와 같은 자리)
    },
    // 기록 스트림 : 고정 가로 레인(채널)마다 모노스페이스 기록이 타이핑되듯 떴다 사라짐. ★튜닝 = laneH(레인 간격)·period(채널 갱신 텀).
    stream: function (s, W, H) {
      var g = rng(71);
      // 모노스페이스 기록 토큰(사서/아카이브 톤) : 참조번호·hex·색인코드 + 일부 CJK 색인
      s.tokens = ['REF.0912','No.1985','0x1A9F','§447','LXXVII','MMX·9','0xDEAD',
                  'Cod.114','No.0006','IDX·77','REC/2213','ARC-1985','0xB2C0','REF.5508',
                  '§119','No.4471','索引','記錄','檔案','遺失'];
      var laneH = 26;                                      // 레인(채널) 간격 — 클수록 성기게
      var lanes = Math.max(4, Math.floor(H / laneH)), lh = H / lanes;
      s.rows = [];
      for (var i=0;i<lanes;i++){
        s.rows.push({
          y: Math.round(i*lh + lh*0.5),                    // 레인 중앙(baseline)
          period: 26 + Math.floor(g()*40),                 // 이 채널이 한 번 뜨는 총 스텝(클수록 뜸)
          onFrac: 0.45 + g()*0.3,                          // 보이는 비율(나머지는 빈 채널)
          phase:  Math.floor(g()*40),                      // 채널마다 다른 시작
          hot:    g() < 0.14,                              // 강조 기록(accent) ~14%
          fs:     11 + Math.floor(g()*3)                   // 글자 크기(11~13px)
        });
      }
    },
    // 기록 스트림(순간) : 레인 구성은 기록 스트림 그대로 + 자체 주기로 '가끔 잠깐' 떴다 사라짐(독립 순간효과).
    streamFlash: function (s, W, H) {
      INIT.stream(s, W, H);
      s.sync = true; s.syncPer = 10000; s.syncOn = 2800;   // 자체 순간 주기(다른 효과와 무관)
    },
    // 기록 스트림(전조) : 기억 각인 '직전'에 성기게 흘러 전조 느낌. 글자 수 확 줄이고 각인 시작 직전 페이드아웃.
    streamPrelude: function (s, W, H) {
      INIT.stream(s, W, H);
      s.rows = s.rows.filter(function(_, i){ return i % 3 === 0; });   // 1/3만 남김(성기게)
      s.rows.forEach(function(r){ r.fs = r.fs - 3; });                 // 전조는 더 작게(8~10px) → 각인 큰 글자와 크기 격차
      s.sync = true; s.syncPer = 13000; s.syncStart = 450; s.syncEnd = 2800;   // 플래시 뒤 ~ 각인 앞(전조)
    },
    // 필름 번 : 연소 시작점만 시드로 고정(나머지는 시간함수).
    filmburn: function (s, W, H) {
      var g = rng(83); s.bx = 0.3 + g()*0.4; s.by = 0.3 + g()*0.4;   // 필름 타들어가기 시작하는 지점
    },
    // 기억의 범람 : 잊힌 단어 목록(사이클마다 이 중에서 골라 버스트). recall과 같은 톤.
    flood: function (s, W, H) {
      s.burst = null; s.cyc = -1;
      s.words = ['memento','oblivium','vestigium','silentium','requiem','umbra','cinis','lacuna',
                 'fragmentum','tenebrae','Vergessen','Erinnerung','Verlust','verloren',
                 '忘却','記憶','遺失','痕跡','沈默','追憶','封印','殘骸','索引','幽冥'];
    },
    // 기억 각인 : 범람과 같은 단어풀, 스타카토로 여기저기 박히는 버스트.
    imprint: function (s, W, H) {
      s.burst = null; s.cyc = -1;
      s.words = ['memento','oblivium','vestigium','silentium','requiem','umbra','cinis','lacuna',
                 'fragmentum','tenebrae','Vergessen','Erinnerung','Verlust','verloren',
                 '忘却','記憶','遺失','痕跡','沈默','追憶','封印','殘骸','索引','幽冥'];
    },
    // 기억 각인(시퀀스용) : 단어풀 동일 + 전조 시작 직후 '치고 들어오는' 창[900,6200](플래시 뒤·전조와 겹침).
    imprintSeq: function (s, W, H) {
      INIT.imprint(s, W, H);
      s.winA = 900; s.winB = 6200;
    },
    // 개시 플래시 : 세트 시퀀스 맨 앞(13s 주기의 [0,450])에 한 번 확 터짐.
    flashPulse: function (s, W, H) {
      s.syncPer = 13000; s.syncOn = 450;
    },

    // 대각선 라인아트 : 원본(Lea Rosema)처럼 '펜' 몇 자루의 상태만 초기화. 선분은 FX가 매 스텝 찍어 쌓음.
    diagonal: function (s, W, H) {
      s.STEP = 6;                                         // 몇 프레임마다 한 스텝 '띡'(≈10fps)
      s.GAP  = 6;                                         // 한 스텝에 수직으로 걷는 거리 = 겹 간격(일정)
      s.SEG  = Math.round(Math.min(150, Math.max(W,H)*0.16));  // 선분 길이(축당) — 무대 크기 비례
      s.MAX  = 30;                                        // 펜이 유지하는 최대 겹 수(넘으면 오래된 것부터 제거)
      s.lastStep = -1;
      s.pens = [];
      for (var i=0;i<4;i++){                              // 원본과 동일하게 4자루
        s.pens.push({
          x: Math.random()*W, y: Math.random()*H,         // 시작 위치(랜덤)
          sx: Math.random()<0.5?-1:1, sy: Math.random()<0.5?-1:1,  // 진행 방향(±) → 45° 4방향
          ci: i % 2,                                      // 색 : 무채색(0)/테마색(1) 번갈아 = 2:2
          segs: []                                        // 찍은 선분들(롤링 버퍼)
        });
      }
    },

    // 입체 격자(기본=평지) : 평면의 크기·줄 개수·속도. ★모양을 바꾸고 싶으면 여기 숫자만 만지면 된다.
    grid3d: function (s, W, H) {
      s.horizon = H * 0.5;               // 지평선(화면 세로 가운데) — 위·아래 평면이 여기로 모인다
      s.focal   = W * 0.9;               // 렌즈 초점거리(클수록 격자가 크고 완만하게 보임)
      s.camH    = 1;                     // 카메라에서 평면까지 높이 = 깊이 계산의 기준값(1로 고정)
      // 깊이 범위 : '지평선에서 몇 % 떨어진 곳'을 원근 공식으로 되돌려 z 값을 구한다.
      //   ★가운데 빈 공간 = 아래 두 % 값이 정한다. 숫자를 키울수록 그쪽이 더 많이 빈다.
      //   위·아래 따로 두어 위쪽을 더 비웠다(가까운 쪽 s.near 는 공통이라 격자 위치는 그대로).
      s.far    = s.focal / (H * 0.15);   // 아래쪽 평면의 가장 먼 줄 = 지평선에서 15% 아래
      s.farTop = s.focal / (H * 0.30);   // 위쪽 평면의 가장 먼 줄 = 지평선에서 30% 위(더 많이 빔)
      s.near   = s.focal / (H * 0.62);   // 가장 가까운 줄(위·아래 공통) = 화면 밖(62%) → 화면 끝까지 채움
      // ★격자를 더 촘촘히/성기게 하려면 아래 줄 개수와 간격을 조절(개수↑·간격↓ = 촘촘)
      s.rows   = 12;                     // 가로줄 개수(평면 한 장당)
      s.colN   = 12;                     // 세로줄 개수(가운데 기준 좌·우 각각) — 화면 밖까지 덮게 넉넉히
      s.colGap = 0.22;                   // 세로줄 사이 좌우 간격
      s.speed  = 0.0025;                 // 줄이 다가오는 속도(1프레임에 줄어드는 깊이) — 작을수록 느림
      s.waveAmp = 0;                     // 굴곡 높이 — 0 = 완전 평지(반듯한 바둑판이 곧게 다가옴)
      s.bowl    = 0;                     // 가장자리가 위로 휘는 정도 — 0 = 휨 없이 반듯한 평면
    },
    // 입체 격자(지형) : 굴곡만 크게 켠 것 → 언덕이 줄과 함께 다가와 지형을 훑는 느낌.
    grid3dTerrain: function (s, W, H) {
      INIT.grid3d(s, W, H);              // 크기·개수·속도는 기본(평지)과 동일 — 아래 세 줄만 다름(단일 출처)
      s.waveAmp = 0.30;                  // 굴곡 높이 = 언덕처럼 크게 오르내림(키우면 더 험한 지형)
      s.bowl    = 0.015;                 // 가장자리가 위로 살짝 휨(그릇처럼 오목)
      s.speed   = 0.0032;                // 평지보다 살짝 빠르게 다가옴
    }
  };
  INIT.crackBack = INIT.crack;   // 뒤 캔버스도 같은 시드로 동일 균열 생성(앞과 정합)

  // 벡스터 decode : 레이어별(back=컬럼+상단밴드 / front=하단밴드+큰숫자) 상태 생성
  INIT.decode = function (s, W, H, cv) {
    s.layer = (cv && cv.dataset && cv.dataset.fxLayer) || 'back';
    s.bandT = H*0.22; s.bandB = H*0.86;                 // 약간 아래쪽 밴드
    var g = rng(s.layer==='front' ? 41 : 7);
    var GL='0123456789ABCDEFHLSX';
    var WD=['ERROR','SIGNAL','TRACE','VECTOR','DECODE','SYNC','RELAY','CONT'];
    var GP=['8','0','6','9','2','5','X','BOX','M'];
    function tok(){
      var r=g(), len = r<0.34 ? 3+Math.floor(g()*3) : r<0.67 ? 7+Math.floor(g()*4) : 11+Math.floor(g()*4), st='';
      if (g()<0.3 && len>=7){ var w=WD[Math.floor(g()*WD.length)]; st=w.substring(0,Math.min(w.length,len-3))+'/'; }
      while (st.length<len) st += (g()<0.12 ? (g()<0.5?'/':'-') : GL[Math.floor(g()*GL.length)]);
      return st;
    }
    if (s.layer==='back'){                              // 코드 컬럼(길이 믹스·번쩍·좌우 자유 순간이동)
      s.cols=[]; var n=3+Math.floor(W/240);
      for (var i=0;i<n;i++){ var vs=[]; for (var v=0;v<5;v++) vs.push(tok());
        s.cols.push({ variants:vs, homeX:(i+0.5)/n*W, range:W*0.32, fs:14+Math.floor(g()*3),
          hold:4+Math.floor(g()*4), gap:2+Math.floor(g()*3), phaseT:Math.floor(g()*30),
          alpha:0.26+g()*0.16, seed:Math.floor(g()*9999) }); }
    } else {                                            // 큰 숫자(누움·또렷/흐림·선에 걸쳐 중앙 드리프트)
      s.ghosts=[];
      function mk(line, freqGap){ var sharp=g()<0.45, vs=[]; for (var v=0;v<7;v++) vs.push(GP[Math.floor(g()*GP.length)]);
        return { variants:vs, line:line, x0:W*0.16, zone:W*0.62, startX:g()*W*0.62,
          travelStep:W*(0.02+g()*0.03), jitter:W*(0.03+g()*0.05), sharp:sharp,
          baseSize: sharp ? H*(0.14+g()*0.09) : W*(0.42+g()*0.28),
          blur: sharp?0:(6+g()*4), alpha: sharp?0.9:0.16,
          hold:1+Math.floor(g()*2), gap:freqGap+Math.floor(g()*3),
          phaseT:Math.floor(g()*50), smear:W*0.02+g()*W*0.03, seed:Math.floor(g()*9999) }; }
      for (var b=0;b<3;b++) s.ghosts.push(mk('bot',1));    // 하단 자주
      for (var t2=0;t2<2;t2++) s.ghosts.push(mk('top',5)); // 상단 드물게
    }
  };

  // 데이터 스트림(세로) : decode '뒤' 효과를 스왑 치수로 초기화(세로 그리기용) + 기억 각인 창에 동기.
  INIT.decodeVert = function (s, W, H, cv) {
    INIT.decode(s, H, W, null);                            // 치수 W↔H 스왑 + cv=null → decode가 '항상 back'(코드컬럼) 세팅 → 앞/뒤 어디 놔도 s.cols 존재(크래시 방지)
    s.layer = 'back';                                      // 뒤 효과(컬럼+밴드)만
    s.sync = true; s.syncPer = 13000; s.syncStart = 2000; s.syncEnd = 6200;   // 각인 시작(900)보다 조금 뒤 등장
  };

  // 데이터 글자(세로) : decodeVert에서 밴드선 빼고 '코드 글자만'. 기록 스트림(순간)이 사라지기 시작(1.68s)할 때 맞춰 시작.
  INIT.decodeGlyphV = function (s, W, H, cv) {
    INIT.decode(s, H, W, null);                           // 스왑 치수 + 항상 back(코드컬럼) 세팅
    s.layer = 'back'; s.noLine = true;                    // 선 없이 글자만
    s.sync = true; s.syncPer = 10000; s.syncStart = 1680; s.syncEnd = 4500;   // streamFlash(PER 10s)의 페이드 시작(0.60×2800=1680ms)에 맞춤
  };

  INIT.ecg = function (s, W, H) {
    s.pat = [[0,0],[0.14,0],[0.155,-0.9],[0.17,0.35],[0.185,0],
             [0.34,0],[0.355,-1.0],[0.37,0.4],[0.385,0],
             [0.54,0],[0.555,-0.32],[0.57,0],
             [0.72,0],[0.735,-0.82],[0.75,0.3],[0.765,0],
             [0.92,0],[0.935,-0.34],[0.95,0],[1.0,0]];
    // 상시 : 쉬지 않고 계속 훑는다(약 4.2초에 한 번 왕복).
    s.scanX = 0; s.amp = 1; s.speed = W/(4.2*60);
    s.period  = 0;                     // 0 = 상시(쉬는 구간 없음)
    s.tail    = 0;                     // 0 = 그리는 동안 뒤가 지워지지 않음
    s.erase   = 0;                     // 0 = 다 그린 뒤 밀어 지우는 구간 없음
    s.round   = false;                 // 선 끝을 각지게
    s.headDot = true;                  // 훑는 머리에 밝은 점
    s.fadeIn  = 0;                     // 나타날 때 서서히 밝아지는 시간 없음
  };
  // 심박(순간) : 한 번 훑고 잠깐 머물다 사라진 뒤 쉬었다가 다시. ★리듬은 여기 숫자만 고치면 된다.
  INIT.ecgFlash = function (s, W, H) {
    INIT.ecg(s, W, H);                 // 파형 모양은 상시와 동일(단일 출처)
    s.sweep  = 2600;                   // 좌→우로 한 번 훑는 데 걸리는 시간(ms)
    s.hold   = 900;                    // 다 그린 파형이 그대로 머무는 시간
    s.fade   = 700;                    // 서서히 사라지는 시간
    s.period = 11000;                  // 전체 주기 — (훑기+머무름+사라짐) 뒤 나머지가 쉬는 시간
  };
  // 심박(모니터) : 레퍼런스(CodePen vincentGuo)의 심전도 파형만 가져온 것.
  //   파형이 좌→우로 훑고 지나가되 뒤는 지워져서, 병원 모니터처럼 '한 구간만' 흘러간다.
  //   ★파형 모양·리듬은 여기 숫자만 고치면 된다.
  INIT.ecgMonitor = function (s, W, H) {
    INIT.ecgFlash(s, W, H);            // 순간효과 리듬을 물려받고 아래만 바꿈
    // 레퍼런스 SVG(viewBox 500×200) polyline 에서 '박동 한 번' 부분만 떼어 온 모양.
    //   [가로위치 0~1, 높이] — 원본은 오른쪽→왼쪽 순서라 뒤집었고,
    //   가장 높은 봉우리가 -1 이 되게 높이를 맞췄다(음수 = 위로).
    var BEAT = [[0,0],[0.068,-0.235],[0.130,0.134],[0.156,-0.053],[0.201,0.153],
                [0.247,-0.008],[0.253,0.062],[0.344,-1],[0.390,0.625],[0.438,0.084],
                [0.474,0.169],[0.792,-0.497],[0.886,0.226],[1,0.009]];
    // ★박동을 가로로 s.beats 번 늘어놓는다.
    //   원본은 박동이 한 번뿐이고 앞뒤가 전부 평평해서, 대부분의 시간엔 일자만 보인다.
    //   심장 모니터처럼 여러 번 늘어놓아야 훑는 창 어디에나 박동이 걸린다.
    s.beats = 3;                       // ★박동 개수 — 줄이면 하나가 크게, 늘리면 촘촘하게
    s.beatW = 0.75;                    // 한 칸에서 박동이 차지하는 비율(나머지는 평평한 쉼)
    s.pat = [];
    for (var b = 0; b < s.beats; b++) {
      for (var i = 0; i < BEAT.length; i++)
        s.pat.push([ (b + BEAT[i][0] * s.beatW) / s.beats, BEAT[i][1] ]);
      s.pat.push([ (b + 1) / s.beats, 0 ]);        // 박동 사이 평평한 구간
    }
    s.sweep   = 2200;                  // 한 번 훑는 시간(박동 여러 개가 지나가도록 조금 길게)
    s.hold    = 150;                   // 다 그린 뒤 잠깐 머무름
    s.fade    = 450;                   // 서서히 사라지는 시간
    s.fadeIn  = 350;                   // 나타날 때 서서히 밝아지는 시간
    s.period  = 8000;                  // 전체 주기 — 나머지는 쉬는 시간
    s.tail    = 0.55;                  // ★머리 뒤로 이만큼(가로 비율)만 남고 지워짐 = 훑고 지나가는 느낌
    s.round   = true;                  // 선 끝을 둥글게(레퍼런스와 동일)
    s.headDot = false;                 // 머리 점 없음(레퍼런스엔 없다)
  };
  // 심박(그렸다 지움) : 파형 모양은 '심박(순간)'과 같고, 그려지고 사라지는 방식만 모니터풍.
  //   ★심박(모니터)와 다른 점 = 가로를 '끝까지 다 그린 뒤'에 왼쪽부터 밀어 지운다.
  INIT.ecgWipe = function (s, W, H) {
    INIT.ecgFlash(s, W, H);            // 파형(스파이크 5박자)·순간효과 리듬을 물려받음
    s.sweep   = 1600;                  // 왼→오른쪽으로 끝까지 그리는 시간
    s.hold    = 500;                   // 다 그려진 채로 머무는 시간
    s.erase   = 1100;                  // ★그 뒤 왼쪽부터 밀어 지우는 시간
    s.fade    = 250;                   // 마지막에 살짝 흐려지며 마무리
    s.fadeIn  = 300;                   // 나타날 때 서서히 밝아지는 시간
    s.period  = 9000;                  // 전체 주기 — 나머지는 쉬는 시간
    s.tail    = 0;                     // 그리는 동안엔 안 지워짐(다 그린 뒤에만 지워진다)
    s.round   = true;                  // 선 끝을 둥글게(모니터 느낌)
    s.headDot = false;                 // 머리 점 없음(모니터 느낌)
  };

  // ── 유틸 도형 ──
  function roundRect(ctx,x,y,w,h,r){ ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  // 균열 경로를 (dx,dy) 오프셋으로 스트로크 (RGB 어긋남·본선 공용)
  function strokeCrack(ctx, c, dx, dy){
    ctx.beginPath(); ctx.moveTo(c.o[0]+dx, c.o[1]+dy);
    for (var j=0;j<c.pts.length;j++) ctx.lineTo(c.pts[j][0]+dx, c.pts[j][1]+dy);
    ctx.stroke();
  }
  // 동심 링(불규칙 다각형) 스트로크 — 주먹 충격 거미줄
  function strokeRing(ctx, ring){
    ctx.beginPath();
    for (var i=0;i<ring.pts.length;i++){ var p=ring.pts[i];
      i? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]); }
    ctx.closePath(); ctx.stroke();
  }
  function drawHex(ctx,cx,cy,r,stroke,fill){ ctx.beginPath();
    for (var i=0;i<6;i++){ var a=Math.PI/6 + i*Math.PI/3, x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
      i? ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.closePath();
    ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke(); }
  // 6갈래 눈송이 (팔 끝에 작은 가지)
  function drawFlake(ctx,cx,cy,r,col){
    ctx.strokeStyle=col; ctx.lineWidth=1; ctx.lineCap='round';
    for (var i=0;i<6;i++){ var a=i*Math.PI/3, ex=cx+Math.cos(a)*r, ey=cy+Math.sin(a)*r;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(ex,ey); ctx.stroke();
      var mx=cx+Math.cos(a)*r*0.6, my=cy+Math.sin(a)*r*0.6, br=r*0.3;
      ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx+Math.cos(a+0.7)*br, my+Math.sin(a+0.7)*br); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx+Math.cos(a-0.7)*br, my+Math.sin(a-0.7)*br); ctx.stroke();
    }
  }
  // 정수 시드 → 0..1 의사난수(매프레임 랜덤 대신 이산 스텝용)
  function hnoise(n){ var x=Math.sin(n*12.9898)*43758.5453; return x-Math.floor(x); }
  // S 전자기파 신호 장악 : 레퍼런스풍 '꽉 찬 글리치 에러/경고 화면'
  //   데이터 코드 그리드 + 큰 글리치 경고문구 + 경고화살표 + 글리치 언더라인.
  //   ★색=캐릭터 테마색(acc, --accent) → 라이트/다크 자동 대응. 점유 배경(어둠)·흰 코어만 고정.
  function drawInterception(ctx, W, H, f, k, acc){
    var paper = cssVar('--paper', '#0a0e14'), ink = cssVar('--ink', '#eef4ff');       // 테마 배경/글자색(라이트=밝게 암전, 다크=검게)
    // ★기존 0.92*k는 완전 장악 상태(k=1)에서도 8% 투명이 남아, 밑에 있는 다른 캔버스 레이어를 살짝 비쳐 보이게 했다
    //   (2026-07-25 발견 — '일러 찢김(느리게)'를 밑에 깔았더니 장악 중에도 에스 일러가 옅게 비침). k=1 근처에서
    //   완전 불투명이 되도록 배율을 올려(0.87 이후 포화) '장악'이 이름값대로 아래를 확실히 가리게 했다.
    ctx.fillStyle = rgba(paper, Math.min(1, 1.15*k)); ctx.fillRect(0,0,W,H);   // 점유 배경 = 테마 배경색으로 암전(화이트테마=하얗게)
    // 1) 데이터 코드 그리드 (셀 격자 + hex 코드, 위로 천천히 스크롤, 일부 밝게 깜빡)
    var cell=46, cols=Math.ceil(W/cell)+1, rows=Math.ceil(H/cell)+1, scroll=(f*0.25)%cell, tick=(f/18)|0;
    ctx.textAlign='left'; ctx.font='9px "Share Tech Mono",monospace';
    for (var r=-1;r<rows;r++) for (var c2=0;c2<cols;c2++){
      var sd=c2*7.1+r*13.7, gy=r*cell+scroll;
      ctx.strokeStyle=rgba(acc, 0.05*k); ctx.lineWidth=1;
      ctx.strokeRect(c2*cell+2, gy+2, cell-7, cell-8);
      if (hnoise(sd)>0.32){
        var hx=(hnoise(sd*1.7+tick*0.3)*65535|0).toString(16).toUpperCase(); while(hx.length<4) hx='0'+hx;
        var bright=hnoise(sd*2.3+tick)>0.88;
        ctx.fillStyle=rgba(acc, (bright?0.55:0.13)*k);
        ctx.fillText(hx, c2*cell+6, gy+16);
      }
    }
    // 2) 스캔라인
    ctx.fillStyle=rgba(acc, 0.04*k);
    for (var sy=0; sy<H; sy+=3) ctx.fillRect(0, sy, W, 1);
    // 3) 중앙 경고문 : 테마색 이중상(좌우 오프셋) + 흰 코어(어둠 위 = 양 테마 OK) + 미세 흔들림
    // ★가운데 큰 문구 — 바꾸려면 이 한 줄만 고치면 된다(뒤 배경상자·화살표·밑줄 폭은 글자 폭에서 자동 계산).
    var cx=W/2, cy=H*0.45, label='SIGNAL LOST';
    ctx.textAlign='center'; ctx.font='800 24px "Orbitron","Share Tech Mono",sans-serif';
    var tw=ctx.measureText(label).width, jit=(hnoise((f/3)|0)-0.5)*3.5, ka=Math.min(1,k);
    ctx.fillStyle=rgba(paper, 0.5*k); ctx.fillRect(cx-tw/2-16, cy-24, tw+32, 40);   // 뒤 배경색(가독 대비)
    ctx.fillStyle=rgba(acc, 0.85*ka); ctx.fillText(label, cx-3+jit, cy);         // 테마색 오프셋(왼)
    ctx.fillStyle=rgba(acc, 0.85*ka); ctx.fillText(label, cx+3-jit, cy);         // 테마색 오프셋(오)
    ctx.fillStyle=rgba(ink, 0.96*ka); ctx.fillText(label, cx, cy);              // 코어=테마 글자색(배경과 대비 자동)
    // 4) 경고 화살표(양옆) — 테마색
    var half=tw/2, gap=16, sz=9; ctx.fillStyle=rgba(acc, 0.9*ka);
    ctx.beginPath(); ctx.moveTo(cx-half-gap-sz,cy-11); ctx.lineTo(cx-half-gap,cy-4); ctx.lineTo(cx-half-gap-sz,cy+3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx+half+gap+sz,cy-11); ctx.lineTo(cx+half+gap,cy-4); ctx.lineTo(cx+half+gap+sz,cy+3); ctx.closePath(); ctx.fill();
    // 5) 글리치 언더라인 바(살짝 어긋난 이중선) — 테마색
    var uw=tw+18, ux=cx-uw/2, uy=cy+11;
    ctx.fillStyle=rgba(acc, 0.55*k); ctx.fillRect(ux-2, uy, uw, 3);
    ctx.fillStyle=rgba(acc, 0.4*k);  ctx.fillRect(ux+3, uy+2, uw, 2);
    // 6) 서브 텍스트(자간) — 테마색
    ctx.font='400 10px "Share Tech Mono",monospace';
    try{ ctx.letterSpacing='2px'; }catch(_){}
    // 작은 글씨 = 위 문구의 '원인' — 신호가 끊긴 이유(S의 전자기 간섭)라 SIGNAL LOST 와 뉘앙스가 맞는다.
    ctx.fillStyle=rgba(acc, 0.6*k); ctx.fillText('S · ELECTROMAGNETIC INTERFERENCE', cx, cy+28);
    try{ ctx.letterSpacing='0px'; }catch(_){}
  }
  // 캔버스 위 일러(<img>)의 실제 그림 사각형(object-fit:contain 계산) — 단일 출처.
  //   cr = 캔버스의 getBoundingClientRect. 못 구하면 null.
  function artRect(art, cr){
    if(!art || !art.naturalWidth) return null;
    var ar=art.getBoundingClientRect();
    var bx=ar.left-cr.left, by=ar.top-cr.top, bw=ar.width, bh=ar.height;
    if(bw<2||bh<2) return null;
    var ia=art.naturalWidth/art.naturalHeight, ba=bw/bh, dw,dh;
    if(ia>ba){ dw=bw; dh=bw/ia; } else { dh=bh; dw=bh*ia; }
    return { dx: bx+(bw-dw)/2, dy: by+(bh-dh)/2, dw:dw, dh:dh };
  }
  // 찢김 번쩍임 색 : 0=캐릭터 테마색(--accent) · 1=무채색(--ink) · 그 외=색 없음(원래 그림 그대로).
  //   라이트/다크·캐릭터별로 저절로 맞는 색이 된다. 찢김 계열 효과가 같이 쓰는 단일 출처.
  function tearFlash(stepN, acc) {
    return stepN === 0 ? acc : stepN === 1 ? cssVar('--ink', '#eef4ff') : null;
  }
  // 일러 한 줄 '찢기' : 그 높이의 가로 조각을 좌·우로 갈라, 원래 자리는 지우고 어긋난 자리에 다시 그린다.
  //   가운데는 손대지 않아 바깥쪽만 뜯겨 나가는 모양이 된다. flash 색을 주면 그 조각이 단색으로 번쩍인다.
  //   ★'일러 찢김'(무작위 위치)과 '기록 찢김'(기록 막대 위치)이 같이 쓰는 단일 출처.
  //   s 에서 읽는 값 : tearH(줄 굵기) · tearMid(가운데 비우는 폭) · jitter(좌우) · shake(위아래) · flashAlpha
  //   seed = 이번 찢김 고유의 난수 씨앗(같은 값이면 같은 모양 → 프레임마다 안 떨림)
  //   art  = <img>(일러) 또는 캔버스(실루엣) 둘 다 받는다.
  //   segs = 찢을 가로 구간 목록 [[시작(0~1), 길이(0~1)], …]. 안 주면 '가운데 비우고 좌·우 바깥쪽' 기본값.
  //   h    = 줄 두께(그림 높이 대비). 안 주면 s.tearH 기본값.
  function tearRow(ctx, art, g, s, y, seed, flash, segs, h) {
    var aw = art.naturalWidth || art.width, ah = art.naturalHeight || art.height;
    var tearPx = g.dh * (h || s.tearH);
    var srcY = (y - g.dy) / g.dh * ah;
    var srcH = tearPx / g.dh * ah;
    if (!segs) {
      // 기본 : 가운데는 그대로 두고 좌·우 바깥쪽 두 조각만(가운데 폭은 찢김마다 조금씩 달라진다)
      var mid = s.tearMid * (0.7 + hnoise(seed + 5.9) * 0.6);
      var sideW = Math.max(0.05, (1 - mid) / 2);
      segs = [[0, sideW], [1 - sideW, sideW]];
    }
    for (var side = 0; side < segs.length; side++) {
      var u0 = segs[side][0], uw = segs[side][1];           // 조각의 시작 위치와 길이(0~1)
      // 조각마다 다르게 어긋나야 '뜯겨 나가는' 느낌이 난다. 위아래로도 살짝 떨린다.
      var dx = (hnoise(seed + 3.1 + side) * 10 - 5) * s.jitter;
      var dy = (hnoise(seed + 9.4 + side) *  2 - 1) * s.shake;
      var sxr = u0 * aw, swr = uw * aw;                     // 원본에서 잘라올 가로 범위
      var homeX = g.dx + u0 * g.dw, dwr = uw * g.dw;        // 원래 있어야 할 가로 위치
      // ★원래 자리를 지우고 어긋난 자리에 다시 그린다 = 덧칠(잔상)이 아니라 진짜로 찢겨 밀려남
      ctx.clearRect(homeX, y, dwr, tearPx);
      ctx.drawImage(art, sxr, srcY, swr, srcH, homeX + dx, y + dy, dwr, tearPx);
      if (flash) {                                          // 번쩍이는 순간 = 같은 조각을 단색으로 덧칠
        var tinted = tintImage(s, art, flash);
        ctx.save(); ctx.globalAlpha = s.flashAlpha;
        ctx.drawImage(tinted, sxr, srcY, swr, srcH, homeX + dx, y + dy, dwr, tearPx);
        ctx.restore();
      }
    }
  }

  // 실루엣 : 캐릭터 이미지의 알파(모양)는 그대로 두고 색만 단색으로 채운 오프스크린(색상별 캐시).
  //   테마/캐릭터색이 바뀌면 색 문자열이 달라져 자동으로 새로 만든다.
  function getSil(s, art, color){
    if(!art || !art.complete || !art.naturalWidth) return null;
    s.silCache = s.silCache || {};
    if(!s.silCache[color]){
      var c = document.createElement('canvas');
      c.width = art.naturalWidth; c.height = art.naturalHeight;
      var x = c.getContext('2d');
      x.drawImage(art, 0, 0);
      x.globalCompositeOperation = 'source-in';           // 알파는 유지, 색만 교체 → 단색 실루엣
      x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
      s.silCache[color] = c;
    }
    return s.silCache[color];
  }
  // 이미지/캔버스 틴트 : 흰-알파 소스(서리 텍스처 등)의 모양(알파)은 유지하고 색만 단색으로 → 테마색 자동 대응(색상별 캐시).
  //   ※소스가 <img>면 naturalWidth, <canvas>면 width. INIT에서 소스가 바뀌면 s.tintCache={}로 캐시를 비워야 함.
  function tintImage(s, img, color){
    s.tintCache = s.tintCache || {};
    if (!s.tintCache[color]){
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'source-in';           // 알파 유지, 색만 교체
      x.fillStyle = color; x.fillRect(0, 0, w, h);
      s.tintCache[color] = c;
    }
    return s.tintCache[color];
  }
  // 일러 글리치 : 온전한 일러 + 색 없는 '이산 가로 찢김'(RGB 색수차·가산합성 없음 = 안 바램)
  function drawArtCyber(ctx, art, oc, cr, amt, f){
    if(!art || !art.naturalWidth) return;
    var paper = cssVar('--paper', '#0a0e14');            // 찢긴 틈 = 테마 배경색(화이트테마=밝은 틈)
    var g = artRect(art, cr); if(!g) return;
    var dx=g.dx, dy=g.dy, dw=g.dw, dh=g.dh;
    ctx.drawImage(art, dx, dy, dw, dh);                    // 온전한 일러(밝아짐/색번짐 없음)
    // 디지털 신호 찢김 : 가로 밴드 몇 개를 이산 스텝(8프레임 홀드)으로 좌우 어긋냄. 색 없음.
    var stepN = Math.floor((f||0)/8), nb = 2 + Math.round(amt*3);
    for (var b=0; b<nb; b++){
      var r1=hnoise(stepN*17.13 + b*4.7), r2=hnoise(stepN*7.31 + b*9.1), r3=hnoise(stepN*3.7 + b*2.3);
      if (r3 > 0.5) continue;                              // 매 스텝 일부만(드문드문)
      var bandH = dh*(0.025 + r2*0.05);
      var yTop = dy + r1*(dh - bandH);
      var sY = (yTop-dy)/dh * art.naturalHeight, sH = bandH/dh * art.naturalHeight;
      var off = (r2-0.5) * dw * 0.16 * amt;                // 좌우 어긋남
      ctx.fillStyle = rgba(paper, 0.85); ctx.fillRect(dx, yTop, dw, bandH);        // 원자리 틈(테마 배경색)
      ctx.drawImage(art, 0, sY, art.naturalWidth, sH, dx+off, yTop, dw, bandH);    // 어긋난 밴드
    }
  }
  function ease(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }

  // ============================================================
  //  효과 레지스트리 + 프리셋 + 레이어 스택 컨트롤러
  //  ------------------------------------------------------------
  //  ★설계: '효과'는 그림 함수 하나로만 존재(앞/뒤 위치와 무관).
  //   '레이어'가 그 효과를 앞(fx-front)/뒤(fx-bg) 중 어디에 그릴지 정한다.
  //   같은 효과를 뒤 레이어에 넣으면 캐릭터 뒤, 앞 레이어에 넣으면 캐릭터 앞.
  //   레이어는 배열 → 추가·삭제·순서변경 자유(배열 순서 = 같은 면에서 위아래).
  // ============================================================
  var kit = {
    rng: rng, hnoise: hnoise, rgba: rgba, reduced: reduced,
    tick: function (f, fps) { return Math.floor(f / (60 / (fps || 15))); },   // n fps 이산 스텝
    palette: function (acc) { return { base: acc, bright: '#eef4fa', rgba: rgba }; },
    // 순간효과 벽시계 엔벨로프(0..1) : m={period,on,fadeIn,fadeOut}(ms)
    env: function (m) {
      if (!m) return 1;
      var per = m.period || 15000, on = m.on || 3600, fi = m.fadeIn || 450, fo = m.fadeOut || 850;
      var t = Date.now() % per;
      return t < on ? Math.min(1, t / fi) * Math.min(1, (on - t) / fo) : 0;
    }
  };
  // ── 효과 목록(단일 출처) ─────────────────────────────
  //   '효과'는 그림 함수 하나로만 존재(앞/뒤 위치와 무관). 레이어가 위치를 정한다.
  //   id    = 코드/데이터에서 쓰는 이름
  //   label = 편집툴 드롭다운에 뜨는 한글 이름
  //   full  = true 무대 전체 덮음 / false 가운데 좁은 띠(심박용)
  //   place = 기본 배치(앞 front / 뒤 back) — 편집툴에서 새로 고를 때 초기값(자유 변경 가능)
  //   kind  = 'layer'(기본, 앞/뒤 자유) / 'takeover'(화면 장악 — 화면 전체를 불투명하게 덮음 → 항상 앞 고정)
  //   ★새 효과 추가 = 위 FX·INIT 에 함수 넣고, 여기 한 줄 추가 → 편집툴에 자동 등장(kind 로 분류칸도 자동).
  var EFFECTS = {
    film:      { label:'필름',        draw:FX.film,      init:INIT.film,      full:true,  place:'back'  },
    projector: { label:'영사기',      draw:FX.projector, init:INIT.projector, full:true,  place:'back'  },
    projectorFlash:{ label:'영사기(순간)', draw:FX.projector, init:INIT.projectorFlash, full:true, place:'back' },
    decode:    { label:'데이터 스트림', draw:FX.decode,   init:INIT.decode,    full:true,  place:'back'  },
    decodeVert:{ label:'데이터 스트림(세로)', draw:FX.decodeVert, init:INIT.decodeVert, full:true, place:'back' },
    decodeGlyphV:{ label:'데이터 글자(세로)', draw:FX.decodeVert, init:INIT.decodeGlyphV, full:true, place:'back' },
    ecg:       { label:'심박',        draw:FX.ecg,       init:INIT.ecg,       full:false, place:'back'  },
    ecgFlash:  { label:'심박(순간)',  draw:FX.ecg,       init:INIT.ecgFlash,  full:false, place:'back'  },
    ecgMonitor:{ label:'심박(모니터)', draw:FX.ecg,      init:INIT.ecgMonitor, full:false, place:'back' },
    ecgWipe:   { label:'심박(그렸다 지움)', draw:FX.ecg, init:INIT.ecgWipe,   full:false, place:'back' },
    crack:     { label:'균열',        draw:FX.crack,     init:INIT.crack,     full:true,  place:'front' },
    crackBack: { label:'균열',        draw:FX.crackBack, init:INIT.crackBack, full:true,  place:'back'  },
    snow:      { label:'눈 파티클',   draw:FX.snow,      init:INIT.snow,      full:true,  place:'back'  },
    frost:     { label:'성에',        draw:FX.frost,     init:INIT.frost,     full:true,  place:'back'  },
    fog:       { label:'냉기 서림',   draw:FX.fog,       init:INIT.fog,       full:true,  place:'back'  },
    sparkle:   { label:'결정 반짝임', draw:FX.sparkle,   init:INIT.sparkle,     full:true,  place:'back'  },
    sparkleSoft:{ label:'결정 반짝임(은은)', draw:FX.sparkle, init:INIT.sparkleSoft, full:true, place:'back' },
    snowglint: { label:'반짝이는 눈', draw:FX.snowglint, init:INIT.snowglint, full:true,  place:'back'  },
    glitch:    { label:'글리치',      draw:FX.glitch,    init:INIT.glitch,    full:true,  place:'front', kind:'takeover' },
    glitchSplit:{ label:'이중인격',   draw:FX.glitchSplit, init:INIT.glitchSplit, full:true, place:'front', kind:'takeover' },
    snapCut:   { label:'장악 전환',   draw:FX.snapCut,   init:INIT.snapCut,   full:true,  place:'front', kind:'takeover' },
    glitchSlice:{ label:'일러 찢김',  draw:FX.glitchSlice, init:INIT.glitchSlice, full:true, place:'front', kind:'takeover' },
    glitchSliceSlow:{ label:'일러 찢김(느리게)', draw:FX.glitchSlice, init:INIT.glitchSliceSlow, full:true, place:'front', kind:'takeover' },
    archiveTear:{ label:'기록 찢김',  draw:FX.archiveTear, init:INIT.archiveTear, full:true, place:'front', kind:'takeover' },
    scanline:  { label:'주사선',      draw:FX.scanline,  init:INIT.scanline,  full:true,  place:'back'  },
    sweepLine: { label:'훑는 줄',     draw:FX.sweepLine, init:INIT.sweepLine, full:true,  place:'front' },
    starfield: { label:'별하늘',      draw:FX.starfield, init:INIT.starfield, full:true,  place:'back'  },
    recall:    { label:'기억 글자',   draw:FX.recall,    init:INIT.recall,    full:true,  place:'back'  },
    dust:      { label:'먼지',        draw:FX.dust,      init:INIT.dust,      full:true,  place:'back'  },
    index:     { label:'색인 정리',   draw:FX.index,     init:INIT.index,     full:true,  place:'back'  },
    archive:   { label:'기록 스캔',   draw:FX.archive,   init:INIT.archive,     full:true,  place:'back'  },
    archiveSoft:{ label:'기록 스캔(느리게)', draw:FX.archive, init:INIT.archiveSoft, full:true, place:'back' },
    stream:    { label:'기록 스트림', draw:FX.stream,    init:INIT.stream,      full:true,  place:'back'  },
    streamFlash:{ label:'기록 스트림(순간)', draw:FX.stream, init:INIT.streamFlash, full:true, place:'back' },
    streamPrelude:{ label:'기록 스트림(전조)', draw:FX.stream, init:INIT.streamPrelude, full:true, place:'back' },
    filmburn:  { label:'필름 번',     draw:FX.filmburn,  init:INIT.filmburn,  full:true,  place:'front', kind:'takeover' },
    flood:     { label:'기억의 범람', draw:FX.flood,     init:INIT.flood,     full:true,  place:'front' },
    imprint:   { label:'기억 각인',   draw:FX.imprint,   init:INIT.imprint,   full:true,  place:'front' },
    imprintSeq:{ label:'기억 각인(시퀀스)', draw:FX.imprint, init:INIT.imprintSeq, full:true, place:'front' },
    flashPulse:{ label:'개시 플래시', draw:FX.flashPulse, init:INIT.flashPulse, full:true, place:'front' },
    diagonal:  { label:'대각선 라인', draw:FX.diagonal,  init:INIT.diagonal,  full:true,  place:'back'  },
    grid3d:    { label:'입체 격자',   draw:FX.grid3d,    init:INIT.grid3d,    full:true,  place:'back'  },
    grid3dTerrain:{ label:'입체 격자(지형)', draw:FX.grid3d, init:INIT.grid3dTerrain, full:true, place:'back' }
  };

  // ── 프리셋(묶음) : 앞/뒤가 짝을 이루는 효과를 한 번에 여러 레이어로 ──
  //   편집툴에서 프리셋을 고르면 아래 레이어들이 세트로 추가됨(추가 뒤엔 각 레이어 독립 = 순서·삭제 자유).
  //   ※ 옛 데이터 호환도 겸함: effect:["crack"] / ["decode"] 는 여기서 앞뒤 세트로 확장.
  var PRESETS = {
    crack:  { label:'균열',        layers:[ { fx:'crackBack', place:'back' }, { fx:'crack', place:'front' } ] },
    decode: { label:'데이터 스트림', layers:[ { fx:'decode', place:'back' }, { fx:'decode', place:'front' } ] },
    archive:{ label:'기록 스캔',    layers:[ { fx:'archive', place:'back' }, { fx:'archive', place:'front' } ] },
    archiveSoft:{ label:'기록 스캔(느리게)', layers:[ { fx:'archiveSoft', place:'back' }, { fx:'archiveSoft', place:'front' } ] },
    // 기록 스캔 + 찢김 : 막대가 캐릭터와 겹치는 자리를 찢는다.
    //   순서 = 뒤 막대 → 찢긴 일러 → 앞 막대 (찢김이 일러를 대신 그리므로 앞 막대보다 아래여야 한다)
    archiveGlitch:{ label:'기록 스캔 + 찢김', layers:[ { fx:'archiveSoft', place:'back' }, { fx:'archiveTear', place:'front' }, { fx:'archiveSoft', place:'front' } ] },
    imprint:{ label:'기억 각인',     layers:[ { fx:'streamPrelude', place:'back' }, { fx:'imprintSeq', place:'back' }, { fx:'imprintSeq', place:'front' } ] },
    // 화면 주사 : 뒤에 주사선을 깔고, 앞으로 훑는 줄이 아래→위로 지나간다(브라운관 화면 느낌 한 세트)
    scanScreen:{ label:'화면 주사',  layers:[ { fx:'scanline', place:'back' }, { fx:'sweepLine', place:'front' } ] }
  };

  // 레이어 한 겹을 완전한 형태로 채움(빈 칸은 효과 기본값 place/full 로 메움)
  function resolveLayer(L) {
    var def = EFFECTS[L.fx] || {};
    var place = L.place || def.place || 'back';
    if (def.kind === 'takeover') place = 'front';   // 화면 장악(glitch)=항상 앞(데이터가 뒤여도 강제 · 편집툴뿐 아니라 실제 페이지도 불변)
    // ★색은 다크/라이트 테마 따로 지정 가능(null=그 테마에선 캐릭터 테마색 따라감 / hex=그 테마에서만 직접 지정한 색).
    //   옛 데이터(색 하나만 있던 시절의 L.color)는 두 테마 모두에 그대로 적용해 호환.
    return {
      fx: L.fx,
      place: place,
      full:  (L.full != null) ? L.full : (def.full != null ? def.full : true),
      colorDark:  (L.colorDark  != null) ? L.colorDark  : (L.color || null),
      colorLight: (L.colorLight != null) ? L.colorLight : (L.color || null),
      momentary: L.momentary || null,
      off: !!L.off,                       // 꺼진 레이어(목록엔 남지만 렌더 제외)
      origin: L.origin || null            // 세트에서 추가될 때 '원래 설계 위치'(편집툴 표시용 · 런타임 렌더는 무시)
    };
  }
  // 데이터의 effect(문자열 | 배열 | 옛·새 포맷) → 평탄한 레이어 스택 [{fx,place,full,colorDark,colorLight,momentary}]
  //   · 이름이 프리셋이고 place 미지정 → 프리셋 레이어들로 확장(옛 데이터 ["crack"] 호환)
  //   · {fx,place,…} 객체는 그 자체가 레이어(이미 확장된 새 포맷). idempotent(여러 번 돌려도 동일).
  function normalize(effect) {
    if (!effect) return [];
    if (typeof effect === 'string') effect = [effect];
    if (!Array.isArray(effect)) effect = [effect];       // 단일 객체 방어
    var out = [];
    for (var i = 0; i < effect.length; i++) {
      var e = effect[i];
      var name = (typeof e === 'string') ? e : (e && e.fx);
      if (!name) continue;
      var hasPlace = (typeof e === 'object') && e && e.place;
      if (!hasPlace && PRESETS[name]) {                  // 프리셋 → 여러 레이어로 확장
        var pl = PRESETS[name].layers;
        for (var j = 0; j < pl.length; j++) {
          var rl = resolveLayer(pl[j]);
          rl.origin = rl.origin || rl.place;             // 세트 확장 = 각 조각의 '원래 설계 위치' 기록(옛 데이터로 불러와도 편집툴 배지 표시)
          out.push(rl);
        }
        continue;
      }
      out.push(resolveLayer(typeof e === 'string' ? { fx: e } : e));
    }
    return out;
  }
  // 현재 테마의 CSS 변수값 읽기(라이트/다크 자동). rgba() 는 #rrggbb 를 받음.
  //   ★프레임당 캐시(2026-08-01) : 레이어(효과)마다 같은 변수(--ink·--accent 등)를 매 프레임 따로
  //     읽던 걸, '같은 애니메이션 프레임 안에서는 한 번만 읽고 재사용'하도록 줄였다. 캐시는 매 rAF
  //     tick마다(아래 loop의 varCacheTs 갱신) 통째로 비우므로, 테마 토글·세대 전환으로 색이 바뀌어도
  //     늦어도 다음 프레임(≈16ms, 체감 불가)엔 항상 최신값 — 오래 남는 캐시가 아니라 '이번 틱 한정' 재사용.
  var varCache = {}, varCacheTs = -1;
  function cssVar(name, fb) {
    var v = varCache[name];
    if (v === undefined) {
      v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      varCache[name] = v;
    }
    return v || fb;
  }
  function accentColor() { return cssVar('--accent', '#4bbad6'); }

  // ── 무대에 레이어 스택 장착 ──────────────────────────
  //   place='back'  → fx-bg  캔버스(캐릭터 뒤, z-index 1)
  //   place='front' → fx-front 캔버스(캐릭터 앞, z-index 5)
  //   배열 순서 = 같은 면 안에서의 위아래(뒤쪽 항목이 위로). 순서변경·추가·삭제 = set() 재호출.
  function mount(stageEl) {
    if (!stageEl) return null;
    var insts = [], raf = null, frame = 0;

    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      for (var i = 0; i < insts.length; i++) {
        window.removeEventListener('resize', insts[i].resize);
        insts[i].cancelResize();
        var cv = insts[i].canvas;
        if (cv.parentNode) cv.parentNode.removeChild(cv);
      }
      insts = [];
      // ★frame을 0으로 되돌림(2026-07-27 버그수정) — 안 그러면 벽시계 주기 효과(예: S의 '신호 가로채기'
      //   화면장악, 620프레임 주기)가 켰다 끄고 다시 켤 때 멈춰있던 frame 값을 그대로 이어받아, 하필 그
      //   주기의 '장악 중' 구간에서 멈췄다 켜지면 계산 없이 즉시 장악 화면부터 번쩍 나타나 보였다
      //   (S만 유독 FX 껐다 켤 때 일러가 번쩍이던 원인). 매번 새로 켤 때는 항상 '평상시' 프레임(0)부터.
      frame = 0;
      // 화면 장악 효과가 일러(<img>)를 숨겨둔 채 꺼질 수 있으므로 항상 원래대로 되돌린다.
      //   (효과를 빼면 캐릭터가 안 보이는 사고 방지. 장악 효과가 계속 있으면 다음 프레임에 다시 숨긴다.)
      var art = document.getElementById('stageArt');
      if (art) art.style.opacity = '';
    }

    // 레이어 1겹 = 캔버스 1개. L = {fx, place, full, colorDark, colorLight, momentary}
    function addLayer(L) {
      var def = EFFECTS[L.fx];
      if (!def) return;                                  // 모르는 효과는 건너뜀
      var front = (L.place === 'front'), band = (L.full === false);
      var cv = document.createElement('canvas');
      // ★크기(full/band)와 깊이(앞/뒤)를 분리 : 같은 효과는 앞에 오든 뒤에 오든 '같은 모양', 앞/뒤는 그리는 순서(z)만 바꾼다.
      //   className = 의미 표시(fx-bg/fx-front 깊이 · fx-full/fx-band 크기) — .stage.fx-off 숨김 등에서 참조.
      cv.className = (front ? 'fx-front ' : 'fx-bg ') + (band ? 'fx-band' : 'fx-full');
      // ★위치·크기·마스크는 여기(단일 출처)서 인라인으로 — profile.css/편집툴 어디서든 같은 모양(툴엔 profile.css가 없어서 미러 안 만들어도 됨).
      var s0 = cv.style;
      s0.position = 'absolute'; s0.pointerEvents = 'none'; s0.zIndex = front ? '5' : '1';
      if (band) {                                        // 가운데 좁은 띠(심박) : 좌우 페이드(앞/뒤 공통)
        s0.left = '0'; s0.right = '0'; s0.top = '40%'; s0.width = '100%'; s0.height = '150px';
        s0.webkitMaskImage = s0.maskImage = 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)';
      } else {                                           // 무대 전체 덮음
        s0.top = '0'; s0.left = '0'; s0.width = '100%'; s0.height = '100%';
        if (!front) s0.webkitMaskImage = s0.maskImage =   // 방사형 페이드는 '뒤' 전체효과만(앞 효과=풀블리드 보존)
          'radial-gradient(120% 100% at 50% 50%,#000 62%,transparent 100%)';
      }
      cv.setAttribute('data-fx-managed', L.fx);
      cv.dataset.fxLayer = L.place;                      // 효과가 앞/뒤를 참고(예: decode 내용 분기)
      stageEl.appendChild(cv);                           // 배열 순서대로 append → 같은 면에서 뒤 항목이 위로
      var ctx = cv.getContext('2d'), st = {}, W = 0, H = 0, dpr = 1;
      function acc() { return (isLight() ? L.colorLight : L.colorDark) || accentColor(); }   // 다크/라이트 각자 지정 색 → 없으면 테마색
      function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        // 레이아웃 크기(offsetWidth/Height) 사용 : 부모가 CSS transform(scale)으로 축소돼 있어도 '실제 무대 크기'로 그린다(편집툴 갤러리 미리보기 = 460×874로 그린 뒤 타일에 맞춰 축소).
        W = cv.offsetWidth  || cv.getBoundingClientRect().width;
        H = cv.offsetHeight || cv.getBoundingClientRect().height;
        cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        st.layer = L.place; st.place = L.place;
        if (def.init) def.init(st, W, H, cv);
      }
      resize();
      // ★리사이즈 디바운스(2026-08-01) — 창을 드래그로 계속 늘였다 줄였다 하면 resize 이벤트가
      //   연달아 여러 번 발생하는데, 그때마다 def.init()이 파티클 배열 등을 통째로 다시 만들면
      //   낭비가 크다. 마지막 이벤트 후 150ms 동안 잠잠하면 그때 한 번만 실제로 다시 계산한다.
      var resizeTimer = null;
      function debouncedResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); }
      window.addEventListener('resize', debouncedResize);
      insts.push({
        canvas: cv, resize: debouncedResize,
        cancelResize: function () { clearTimeout(resizeTimer); },
        draw: function (f) {
          var e = L.momentary ? kit.env(L.momentary) : 1;
          if (L.momentary && e <= 0.003) { ctx.clearRect(0, 0, W, H); return; }   // 순간효과 비활성 구간
          ctx.clearRect(0, 0, W, H);
          def.draw(ctx, W, H, f, st, acc());
        }
      });
    }

    // set(effect) : 현재 효과 전부 교체. effect = 데이터 그대로(문자열 | 배열 | 옛·새 포맷) — 내부에서 정규화.
    function set(effect) {
      stop();
      var layers = normalize(effect);
      for (var i = 0; i < layers.length; i++) if (!layers[i].off) addLayer(layers[i]);   // 꺼진 레이어는 렌더 제외
      if (!insts.length) return;
      if (reduced) { frame = 120; varCache = {}; for (var j = 0; j < insts.length; j++) insts[j].draw(frame); return; }
      // ★rAF가 넘겨주는 타임스탬프(ts)로 '새 프레임'을 판별해 varCache를 딱 한 번씩만 비운다.
      //   전체 모듈에서 varCache/varCacheTs를 공유하므로, 같은 화면에 mount()가 여러 개 떠 있어도(예:
      //   프로필 툴의 효과 갤러리 미리보기 여러 장) 같은 vsync 안이면 캐시를 같이 재사용한다.
      (function loop(ts) {
        if (ts !== varCacheTs) { varCache = {}; varCacheTs = ts; }
        frame++; for (var k = 0; k < insts.length; k++) insts[k].draw(frame); raf = requestAnimationFrame(loop);
      })();
    }

    return { set: set, stop: stop, el: stageEl };
  }

  // ── 편집툴이 읽는 목록(단일 출처) — 새 효과/프리셋 추가 시 자동 반영 ──
  function effectList() {
    var a = []; for (var k in EFFECTS) if (EFFECTS.hasOwnProperty(k))
      a.push({ id: k, label: EFFECTS[k].label, place: EFFECTS[k].place, full: EFFECTS[k].full !== false, kind: EFFECTS[k].kind || 'layer' });
    return a;
  }
  function presetList() {
    var a = []; for (var k in PRESETS) if (PRESETS.hasOwnProperty(k))
      a.push({ id: k, label: PRESETS[k].label, layers: PRESETS[k].layers.map(resolveLayer) });
    return a;
  }
  function expandPreset(id) { return PRESETS[id] ? PRESETS[id].layers.map(resolveLayer) : null; }

  return {
    mount: mount, normalize: normalize,           // 페이지: 무대에 레이어 스택 장착
    effects: effectList, presets: presetList, expand: expandPreset,   // 편집툴: 효과·프리셋 목록(단일 출처)
    kit: kit                                       // 순간효과 엔벨로프 등 공통 재료(mount 내부 사용·확장용 노출)
  };
})();
