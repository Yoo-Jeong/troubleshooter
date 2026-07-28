/* motion.js — 캐릭터 일러스트에 '마우스 패럴랙스'를 은은하게 부여.
   ------------------------------------------------------------------
   ★기본 정지 : 마우스가 대상 영역에 들어와야 커서를 따라 살짝 움직이고,
     벗어나면 부드럽게 제자리로 돌아가 다시 완전히 정지한다. (둥실 같은 상시 애니메이션 없음)
   쓰는 법 : 움직일 요소(또는 그 부모)에 data-kinetic 속성만 붙이면 됨.
     data-kinetic="hover"   → 그 영역에 마우스 올렸을 때만, 영역 안 커서 위치 기준으로 움직임 (기본 권장)
     data-kinetic="global"  → 항상 켜짐 + 화면(뷰포트) 마우스 따라 (필요할 때만)
   이 스크립트는 대상에 CSS 변수 --kx / --ky (px)만 세팅한다.
   → 실제 이동은 각 요소의 CSS transform 이 `translate(var(--kx,0px),var(--ky,0px))` 로 더해서 그림.
     (부모에 붙이면 자식이 변수를 상속받아 씀 — 무대=자식 .art / 목록=자식 .dimg img)

   ★세기 조절은 아래 상수 한 곳에서 (유지보수 쉽게):
     PARA_MAX 마우스 최대 이동(px)  ·  EASE 위치 관성  ·  EASE_ON 들어오고/나갈 때 부드러움
   ★접근성 : 사용자가 '동작 최소화'(prefers-reduced-motion)를 켜면 전부 정지. */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  // DOM이 아직 안 그려졌으면(head에서 로드된 경우 등) 다 그려진 뒤 시작 — 대상 요소를 확실히 찾게.
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); return; }
  init();

  function init() {
  var PARA_MAX = 10;      // 마우스 패럴랙스 최대 ±px (은은하게)
  var EASE     = 0.075;   // 위치 관성 : 목표로 다가가는 비율(작을수록 더 부드럽게 지연)
  var EASE_ON  = 0.06;    // 켜짐(존재감 amt) 전환 부드러움 : 마우스 들어옴/나감 시 서서히

  var items = [];
  document.querySelectorAll('[data-kinetic]').forEach(function (el) {
    items.push({ el: el, mode: el.getAttribute('data-kinetic') || 'hover',
                 tx: 0, ty: 0, cx: 0, cy: 0, amt: 0, active: false });
  });
  if (!items.length) return;

  // 전역(뷰포트) 마우스 위치 → -1..1 (global 모드용)
  var gx = 0, gy = 0;
  window.addEventListener('mousemove', function (e) {
    gx = (e.clientX - innerWidth / 2) / (innerWidth / 2);
    gy = (e.clientY - innerHeight / 2) / (innerHeight / 2);
  }, { passive: true });

  // hover 모드 : 영역에 들어오면 켜지고(active), 나가면 꺼짐 + 제자리로
  items.forEach(function (it) {
    if (it.mode !== 'hover') { it.active = true; return; }   // global 은 항상 켜짐
    it.el.addEventListener('mouseenter', function () { it.active = true; });
    it.el.addEventListener('mousemove', function (e) {
      var r = it.el.getBoundingClientRect();
      it.tx = ((e.clientX - r.left) / r.width  - 0.5) * 2;   // -1..1 (영역 안 커서 위치)
      it.ty = ((e.clientY - r.top)  / r.height - 0.5) * 2;
    }, { passive: true });
    it.el.addEventListener('mouseleave', function () { it.active = false; it.tx = 0; it.ty = 0; });
  });

  function loop() {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      it.amt += ((it.active ? 1 : 0) - it.amt) * EASE_ON;     // 존재감 0↔1 부드럽게(정지↔활성)
      var tX = (it.mode === 'hover' ? it.tx : gx) * PARA_MAX * it.amt;
      var tY = (it.mode === 'hover' ? it.ty : gy) * PARA_MAX * it.amt;
      it.cx += (tX - it.cx) * EASE;                           // 관성으로 부드럽게 추적(나가면 0으로)
      it.cy += (tY - it.cy) * EASE;
      if (it.amt < 0.002 && Math.abs(it.cx) < 0.02 && Math.abs(it.cy) < 0.02) {   // 완전 정지면 변수 비움
        it.el.style.removeProperty('--kx'); it.el.style.removeProperty('--ky');
      } else {
        it.el.style.setProperty('--kx', it.cx.toFixed(2) + 'px');
        it.el.style.setProperty('--ky', it.cy.toFixed(2) + 'px');
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  }
})();
