"use strict";
/* ============================================================
   프로필 작성 툴 — 미리보기 iframe 조립 + 이중버퍼 렌더
   ------------------------------------------------------------
   buildSrcdoc() : 상태(st) → 미리보기 iframe에 넣을 HTML 통째로 조립(단일 출처).
   paintPreview()/render() : iframe 2장을 겹쳐 교차 페이드(깜빡임 없는 갱신).
   ============================================================ */
/* ---------- 상태 → 미리보기 iframe(srcdoc) ---------- */
var EDIT_MODE = false;   // 무대 배치 편집 모드 — 켜면 buildSrcdoc 가 미리보기에 편집기를 넣음
function buildSrcdoc(st){
  // ★상대경로(../)로 계산 — 이 페이지(tools/profile-builder.html) 기준 실제 캐릭터 페이지 위치를 흉내냄.
  //   절대경로("/characters/...")를 쓰면 사이트가 도메인 루트가 아닌 하위경로에 배포됐을 때(예: GitHub Pages 프로젝트 페이지) 깨진다.
  var base = '../characters/' + (st.slug || '_preview') + '/';
  // 미리보기는 '지금 편집 중인 세대(CUR_GEN)'를 보여줌 → current=CUR_GEN, 대표색·프레임도 그 세대 것
  var curGd = GEN_FORMS[CUR_GEN] || blankGen();
  var accent = curGd.accent || st.accent || '#bfc7d4';
  var accentL = curGd.accentLight || accent;   // 밝은 테마 색 = 현재 세대 것(비대표 세대는 profile.js가 라이트에서 적용)
  var accent2 = curGd.accent2 || accent;       // 대표색 2번째(그라데이션 끝색). 비면 accent=단색(그라데이션 안 보임)
  var accent2L = curGd.accent2Light || '';     // 밝은 2번째: 있으면 light에 적용, 없으면 :root(어두운 2번째) 상속 = 레이아웃과 동일
  // 로컬 선택 이미지는 미리보기에서 blob URL로 표시(파일명은 그대로 출력에 유지)
  var artSrc = resolveImg(curGd.art);
  // st.meta/st.wardrobe/st.stats는 항상 대표 세대 것(저장 파일의 top-level 값) — 미리보기 초기 페인트는
  // 그게 아니라 '지금 편집 중인 세대'를 보여줘야 해서 curGd에서 따로 계산한다(옷장·무대 뒤 이름이 세대를
  // 바꿔도 대표 세대 것으로 남아있던 버그의 원인이 이것 — 최초 페인트가 항상 대표 세대 값을 썼었음).
  var curMeta = metaOf(curGd);
  var curStats = statsOut(curGd.stats);
  var ward = curGd.wardrobe.map(function(w){ var c={}; for(var k in w) c[k]=w[k]; c.img=resolveImg(w.img); return c; });
  var gens = { current: CUR_GEN, items: (st.generations.items||[]).map(function(it){ var c={}; for(var k in it) c[k]=it[k]; c.img=resolveImg(it.img);
    if(c.wardrobe) c.wardrobe=c.wardrobe.map(function(w){ var d={}; for(var k in w) d[k]=w[k]; d.img=resolveImg(w.img); return d; }); return c; }) };
  var body = buildFullBody(true).replace(/(<img\b[^>]*\ssrc=")([^"]*)(")/gi, function(m,a,s,c){ return a+resolveImg(s)+c; });
  var CH = function(v){ return JSON.stringify(v); };
  // 무대 배치 편집(=페이지 ?edit) : 편집 모드일 때만 edit-core.js + 툴 어댑터를 미리보기에 주입.
  //   어댑터 = editor.js 와 같은 레이어(일러/고스트)를 쓰되, 파일쓰기 대신 값을 parent.pvStageEdit 로 되돌림(편집 코어 재사용, 이중구현 없음).
  var editorScript = !EDIT_MODE ? '' :
    '<script src="../../assets/js/edit-core.js?v=1"><\/script>'+
    '<script>(function(){var P=window.TSProfile;if(!P||!P.art||!window.TSEditCore)return;'+
    'var F=[{id:"art",name:"▤ 일러",anchorBottom:true,el:function(){return P.art;},fields:['+
      '{k:"크기",v:"--art-h",min:30,max:220,def:118,kind:"h",a:"data-arth"},'+
      '{k:"폭",v:"--art-w",min:60,max:260,def:124,kind:"w",a:"data-artw"},'+
      '{k:"가로",v:"--art-x",min:-45,max:45,def:0,kind:"x",a:"data-shiftx"},'+
      '{k:"세로",v:"--art-shift",min:-45,max:45,def:0,kind:"y",a:"data-shift"}]},'+
     '{id:"ghost",name:"▨ 고스트",anchorBottom:true,el:function(){return P.ghost;},fields:['+
      '{k:"크기",v:"--ghost-h",min:50,max:190,def:128,kind:"h",a:"data-ghosth"},'+
      '{k:"가로",v:"--ghost-x",min:-45,max:45,def:0,kind:"x",a:"data-ghostx"},'+
      '{k:"세로",v:"--ghost-y",min:-45,max:45,def:0,kind:"y",a:"data-ghosty"},'+
      '{k:"투명",v:"--ghost-op",min:0,max:45,def:9,kind:"op",a:"data-ghostop"}]}];'+
    'var _core=window.TSEditCore.create({root:P.root,title:"무대 배치 편집",layerSwitch:true,layers:F,'+
     'onChange:function(s){var v={};s.fields.forEach(function(f){var g=s.get(f.v);v[f.a.replace("data-","")]=(g!==f.def)?(g+"%"):null;});var _sls=[].slice.call(document.querySelectorAll(".slot[data-img]")),_i=_sls.indexOf(P.onSlot&&P.onSlot());try{parent.pvStageEdit(_i,v);}catch(_){}}});'+
    '["edApply","edCode","edSnip","edCopy"].forEach(function(id){var e=document.getElementById(id);if(e)e.style.display="none";});'+
    // 선택한 레이어의 슬라이더만 표시. 고스트는 실제(옅은) 최종상태 그대로 보이고 그 상태로 편집(편집 박스는 이미지가 옅어도 크기가 있어 드래그 가능).
    'var _eb=document.getElementById("edBoth");if(_eb&&_eb.parentNode)_eb.parentNode.style.display="none";'+
    'var _p=document.getElementById("edP"),_rows=[].slice.call(_p.querySelectorAll(".row")),_grps=[].slice.call(_p.querySelectorAll(".grp")),_cur=0;'+
    // 이 패널을 열었던 스위치(🖼 배치)를 그대로 다시 눌러 끄는 것과 같은 닫기 버튼 — edit-core.js(공용 코어)는 안 건드리고
    //   이 어댑터(툴 전용)에서만 붙인다(실제 ?edit 모드는 이 버튼이 필요 없어서 core 자체엔 안 넣음).
    //   제목(#edGrip)은 전체가 "드래그해서 이동" 손잡이라 그 안에 버튼을 얹으면 클릭이 드래그로 먹혀버릴 수 있어,
    //   같은 줄에 나란히 두되 별도 엘리먼트로 감싼다(제목 겹쳐 잘리는 것도 방지).
    'var _h5=_p.querySelector("#edGrip"),_head=document.createElement("div");'+
      '_head.style.cssText="display:flex;align-items:center;gap:8px;margin:0 0 8px";'+
      '_h5.parentNode.insertBefore(_head,_h5);_head.appendChild(_h5);_h5.style.cssText="flex:1;margin:0";'+
      'var _closeBtn=document.createElement("button");_closeBtn.type="button";_closeBtn.textContent="\\u2715";'+
      '_closeBtn.title="닫기";_closeBtn.style.cssText="flex:none;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid #4aa;color:#8ee;border-radius:4px;width:20px;height:20px;padding:0;font-size:11px;line-height:1;cursor:pointer";'+
      '_closeBtn.addEventListener("click",function(){try{parent.pvStagePanelToggle();}catch(_){}});'+
      '_head.appendChild(_closeBtn);'+
    'var _st=document.createElement("style");_st.textContent="#edP .row label,#edP .lyr button,#edP h5{white-space:nowrap}";document.head.appendChild(_st);'+   // 패널 한글 라벨 줄바꿈(keep-all 상속) 방지 — 폭은 그대로(숫자칸 안 밀리게)
    'function _showLayer(i){_cur=i;_rows.forEach(function(r,j){r.style.display=(Math.floor(j/4)===i)?"":"none";});_grps.forEach(function(g){g.style.display="none";});try{_core.resync();}catch(e){}}'+
    '_p.querySelectorAll(".lyr button").forEach(function(b,i){b.addEventListener("click",function(){_showLayer(i);});});_showLayer(0);'+
    // 미리보기에서 다른 의상을 클릭하면 그 의상 값으로 편집기 재동기화(의상마다 배치 따로 편집).
    'document.querySelectorAll(".slot[data-img]").forEach(function(sl){sl.addEventListener("click",function(){setTimeout(function(){_showLayer(_cur);},0);});});'+
    '})();<\/script>';
  return '<!DOCTYPE html><html lang="ko" data-theme="'+THEME+'"><head><meta charset="UTF-8">'+
    '<base href="'+base+'">'+
    '<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Chakra+Petch:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Share+Tech+Mono&family=Gothic+A1:wght@300;400;500;700;800&display=swap" rel="stylesheet">'+
    '<link rel="stylesheet" href="../../assets/css/common.css">'+
    '<link rel="stylesheet" href="../../assets/css/transitions.css">'+
    '<link rel="stylesheet" href="../../assets/css/profile.css?v=55">'+
    '<style>:root,:root[data-theme="dark"]{--accent:'+accent+';--accent2:'+accent2+';'+(st.statPlus?'--stat-plus:'+st.statPlus+';':'')+'}:root[data-theme="light"]{--accent:'+accentL+';'+(accent2L?'--accent2:'+accent2L+';':'')+'}'+
    '.stage .ghost{display:block}'+   /* 미리보기(폭 좁음)에서 고스트 확실히 표시 — profile.css 캐시와 무관하게. !important 안 씀=이미지 없을 때 profile.js 인라인 숨김은 존중 */
    '[data-edit]{cursor:text;border-radius:3px}[data-edit]:hover{box-shadow:0 0 0 1px var(--accent-line,#7aa)}[data-edit]:focus{outline:none;box-shadow:0 0 0 2px var(--accent);background:rgba(120,180,210,.07)}'+
    '.pb-add{display:flex;gap:10px;justify-content:center;margin-top:16px}.pb-add button{background:transparent;border:1px dashed var(--accent-line);color:var(--accent-deep);border-radius:6px;padding:7px 16px;font:inherit;font-size:13px;cursor:pointer}.pb-add button:hover{background:rgba(120,180,210,.1)}'+
    '.p-add{display:flex;gap:8px;margin-top:10px}.p-add button{background:transparent;border:1px dashed var(--accent-line);color:var(--accent-deep);border-radius:5px;padding:4px 11px;font:inherit;font-size:12px;cursor:pointer}.p-add button:hover{background:rgba(120,180,210,.1)}'+
    // 서술카드 편집 컨트롤들 — .p-add와 톤 맞춤(점선 테두리·같은 색 변수).
    '.card-del{margin-left:auto;flex:none;background:transparent;border:1px solid var(--line);color:var(--ink-faint);border-radius:5px;width:22px;height:22px;line-height:1;font-size:12px;cursor:pointer}.card-del:hover{border-color:#e0616b;color:#e0616b}'+
    '.blk-wrap{position:relative;margin-bottom:6px}.blk-ctl2{display:flex;gap:4px;justify-content:flex-end;margin-top:2px}'+
    '.blk-ctl2 button{background:transparent;border:1px solid var(--line);color:var(--ink-faint);border-radius:4px;width:20px;height:20px;line-height:1;font-size:11px;cursor:pointer}.blk-ctl2 button:hover{border-color:var(--accent-line);color:var(--accent-deep)}'+
    // 그림 위에 안 겹치게 그림 아래 보통 버튼으로 — 그림 위에 겹치면 최종 모습이 안 보인다.
    '.img-pick{display:inline-flex;align-items:center;gap:4px;margin-top:6px;background:transparent;border:1px dashed var(--accent-line);color:var(--accent-deep);border-radius:5px;padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}.img-pick:hover{background:rgba(120,180,210,.1)}'+
    '.p-alt{margin-top:6px;font-size:12px;color:var(--ink-faint);cursor:text;border-radius:3px;padding:2px 4px}.p-alt:hover{box-shadow:0 0 0 1px var(--accent-line,#7aa)}.p-alt:focus{outline:none;box-shadow:0 0 0 2px var(--accent);background:rgba(120,180,210,.07)}'+
    '.p-alt:empty::before{content:"이미지 설명 · 안 보일 때 대신 나올 글(선택)";opacity:.6;font-style:italic}'+
    // 글자 선택 시 뜨는 서식 툴바 — 마우스로 드래그해 고른 글자에 굵게/기울임을 바로 토글.
    '.fmt-bar{position:fixed;display:flex;gap:2px;background:var(--elev);border:1px solid var(--line);border-radius:6px;padding:3px;box-shadow:0 4px 14px rgba(0,0,0,.35);z-index:999}'+
    '.fmt-bar[hidden]{display:none}'+
    '.fmt-bar button{background:transparent;border:none;color:var(--ink);width:26px;height:26px;border-radius:4px;font-size:13px;cursor:pointer;line-height:1}'+
    '.fmt-bar button:hover{background:var(--accent-tint)}'+
    '.fmt-bar button.on{background:var(--accent);color:#fff}'+
    // 옷장 관리(트랙 슬롯의 ⋮ 손잡이 · ＋추가 타일 · 편집 팝오버) — 옷장 트랙(.slot)은 profile.css가 이미 54×54px·position:relative로 그리므로 그 위에 얹기만 함.
    '.ward-handle{position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:50%;border:1px solid var(--line);background:var(--paper);color:var(--ink-faint);font-size:12px;line-height:1;cursor:grab;touch-action:none;display:flex;align-items:center;justify-content:center;z-index:2}'+
    '.ward-handle:hover{border-color:var(--accent-line);color:var(--accent-deep)}'+
    '.slot.dragging{opacity:.6;cursor:grabbing}'+
    '.ward-add-tile{display:flex;flex-direction:column;align-items:center;gap:4px;background:transparent;border:none;font:inherit;cursor:pointer;padding:0}'+
    '.ward-add-tile .thumb{width:54px;height:54px;border-radius:10px;border:1px dashed var(--accent-line);display:flex;align-items:center;justify-content:center;color:var(--accent-deep);font-size:18px}'+
    '.ward-add-tile .cap{font-family:"Share Tech Mono";font-size:var(--fs-xs);color:var(--ink-faint);letter-spacing:.5px}'+
    '.ward-pop{position:fixed;display:flex;flex-direction:column;gap:6px;background:var(--elev);border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 4px 14px rgba(0,0,0,.35);z-index:999;width:180px}'+
    '.ward-pop[hidden]{display:none}'+
    '.ward-pop input{background:var(--elev2);border:1px solid var(--line);color:var(--ink);border-radius:5px;padding:5px 7px;font:inherit;font-size:12px}'+
    '.ward-pop button{background:transparent;border:1px solid var(--line);color:var(--ink);border-radius:5px;padding:5px 7px;font:inherit;font-size:12px;cursor:pointer;text-align:left}'+
    '.ward-pop button:hover{background:var(--accent-tint)}'+
    '.ward-pop .wp-del{border-color:rgba(224,97,107,.5);color:#e0616b}'+
    '.ward-pop .wp-del:hover{background:rgba(224,97,107,.12)}'+
    '.ward-pop .wp-del.armed{background:#e0616b;border-color:#e0616b;color:#fff;text-align:center}'+
    // 능력치 관리(막대 클릭 → 편집 팝오버 · 목록 끝 ＋추가 줄) — .statbars는 2열 그리드라 추가 줄은 grid-column으로 전체 폭을 차지하게 함.
    '.sb.stat-editable{cursor:pointer;border-radius:6px;padding:2px 4px;margin:-2px -4px;transition:background .15s}'+
    '.sb.stat-editable:hover{background:var(--accent-tint)}'+
    '.stat-pop{position:fixed;display:flex;flex-direction:column;gap:6px;background:var(--elev);border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 4px 14px rgba(0,0,0,.35);z-index:999;width:180px;box-sizing:border-box}'+
    '.stat-pop[hidden]{display:none}'+
    '.stat-pop input{background:var(--elev2);border:1px solid var(--line);color:var(--ink);border-radius:5px;padding:5px 7px;font:inherit;font-size:12px;width:100%;box-sizing:border-box}'+
    // 숫자칸의 브라우저 기본 위아래 화살표(스핀버튼)를 없앰 — 팝오버 폭이 좁아 화살표가 작은 스크롤바처럼 걸려보였음.
    '.stat-pop input[type=number]{-moz-appearance:textfield}'+
    '.stat-pop input[type=number]::-webkit-inner-spin-button,.stat-pop input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}'+
    '.stat-pop label{display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--ink-faint)}'+
    // 신원 한 줄 정보(나이·키·생일·소속·부서·역할) 편집 — 신원 카드의 idmeta 옆 ✎ 버튼 → 자체 팝오버.
    '.idmeta-edit{margin-left:6px;background:transparent;border:1px solid var(--line);color:var(--ink-faint);border-radius:4px;width:18px;height:18px;line-height:1;font-size:10px;cursor:pointer;vertical-align:middle}'+
    '.idmeta-edit:hover{border-color:var(--accent-line);color:var(--accent-deep)}'+
    '.id-pop{position:fixed;display:flex;flex-direction:column;gap:6px;background:var(--elev);border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 4px 14px rgba(0,0,0,.35);z-index:999;width:220px;box-sizing:border-box}'+
    '.id-pop[hidden]{display:none}'+
    '.id-pop .idp-row{display:flex;gap:5px}'+
    '.id-pop label{flex:1;display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--ink-faint)}'+
    '.id-pop input,.id-pop select{background:var(--elev2);border:1px solid var(--line);color:var(--ink);border-radius:5px;padding:5px 7px;font:inherit;font-size:12px;width:100%;box-sizing:border-box}'+
    // 인용구·사원증 그린사람은 비어 있어도(편집 모드) 요소를 그려두고 이 안내글로 "클릭해서 입력"을 알려줌
    //   (그림 설명 칸 .p-alt:empty::before와 같은 방식) — 클릭하면 바로 타이핑해서 처음 값을 넣을 수 있다.
    //   부제는 이름·기록번호와 함께 ✎ 팝오버에서만 고침(카드에서 직접 클릭 편집 안 함).
    '.namehead .quote:empty::before{content:"인용구(선택) · 눌러서 입력";opacity:.5;font-style:italic}'+
    '.idc-meta b:empty::before{content:"그린 사람(선택)";opacity:.5;font-style:italic}'+
    '.idmeta-empty{opacity:.5;font-style:italic}'+
    '.idc-imgpick{cursor:pointer}.idc-imgpick:hover{box-shadow:0 0 0 2px var(--accent)}'+
    // 무대 바로 아래 도구 버튼 줄(효과·배치·목록 이미지) — 무대를 직접 만지는 기능이라 여기 붙여 위치로 뜻이 보이게 함.
    '.stage-tools{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}'+
    '.stage-tools button{background:var(--panel-2,rgba(255,255,255,.05));border:1px solid var(--line);color:var(--ink-soft);border-radius:6px;padding:5px 9px;font:inherit;font-size:11px;cursor:pointer}'+
    '.stage-tools button:hover{border-color:var(--accent-line);color:var(--accent-deep)}'+
    // 세대 관리(타임라인 옆 ⚙) — 대표세대지정·세대구분끄기·이세대초기화. 팝오버 톤은 옷장/능력치/신원과 동일.
    '.gen-gear{align-self:flex-end;margin:0 0 6px 6px;background:transparent;border:1px solid var(--line);color:var(--ink-faint);border-radius:4px;width:22px;height:22px;line-height:1;font-size:12px;cursor:pointer}'+
    '.gen-gear:hover{border-color:var(--accent-line);color:var(--accent-deep)}'+
    '.gen-pop{position:fixed;display:flex;flex-direction:column;gap:6px;background:var(--elev);border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 4px 14px rgba(0,0,0,.35);z-index:999;width:190px;box-sizing:border-box}'+
    '.gen-pop[hidden]{display:none}'+
    '.gen-pop button{background:transparent;border:1px solid var(--line);color:var(--ink);border-radius:5px;padding:6px 8px;font:inherit;font-size:12px;cursor:pointer;text-align:left}'+
    '.gen-pop button:hover{background:var(--accent-tint)}'+
    '.gen-pop .gp-reset.armed{background:#e0616b;border-color:#e0616b;color:#fff;text-align:center}</style>'+
    '</head><body><div class="mscreen">'+
      '<div class="osbar mono"><img class="lg" src="../../assets/img/ui/ts_typo.png" alt="">'+
      '<span class="os">TS·OS</span><span class="sec"><span class="d"></span>SECURE LINK</span>'+
      '<div class="right"><span data-meta="record"></span>'+
      '<span class="sig"><i></i><i></i><i></i><i></i></span>'+
      '<span class="bat"><span>82%</span><span class="b"><i></i></span></span>'+
      '<span id="clock">--:--</span><button class="tg" id="themeBtn" title="테마">◐</button></div></div>'+
      '<div class="topbar"><div class="brand"><div class="bt">TROUBLE<span>SHOOTER</span> <span class="tag" data-meta="sector"></span></div>'+
      '<div class="crumb"><a href="../../characters.html">◂ CHARACTERS</a> · <b data-meta="crumb"></b></div></div></div>'+
      '<div class="sheet"><div class="left-fixed">'+
      '<button class="stage-fold-tab mono" id="stageViewToggle" type="button" title="옷장·무대 접기/펼치기">‹</button>'+
      '<aside class="wardrobe"><div class="track"></div></aside>'+
      '<div class="stage-col"><section class="stage">'+
      '<span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>'+
      '<div class="bg-type" data-meta="code" aria-hidden="true"></div>'+
      '<div class="stage-head"><span data-meta="id"></span><span class="rec"><span class="dot"></span>REC · VISUAL FEED<button class="fx-toggle mono" id="fxToggle" type="button" title="무대 효과 끄기/켜기">FX ON</button></span></div>'+
      '<img class="ghost" id="stageGhost" src="'+artSrc+'" alt="">'+
      '<img class="art" id="stageArt" src="'+artSrc+'" alt="'+esc(st.artAlt||'')+'">'+
      '<div class="art-credit" id="artCredit">'+esc(curGd.artArtist||'')+'</div></section>'+
      // 효과·배치·목록 이미지는 무대를 직접 만지는 기능이라 무대 바로 아래 버튼으로 둠(도구 패널과 분리) —
      //   패널 자체는 부모(이 페이지)에 있으므로 클릭은 parent.pvXxx()로 넘긴다(세대 관리 ⚙메뉴와 같은 방식).
      '<div class="stage-tools"><button type="button" id="stFx" title="무대 효과 편집">⚡ 효과</button>'+
      '<button type="button" id="stPlace" title="일러·고스트 크기·위치 편집">🖼 배치</button>'+
      '<button type="button" id="stLineup" title="목록에서 키 비교용 이미지 설정">📏 목록 이미지</button></div>'+
      '<script>(function(){function on(id,fn){var b=document.getElementById(id);if(b)b.addEventListener("click",fn);}'+
        'on("stFx",function(){try{parent.pvFxPanelToggle();}catch(_){}});'+
        'on("stPlace",function(){try{parent.pvStagePanelToggle();}catch(_){}});'+
        'on("stLineup",function(){try{parent.pvLineupPanelToggle();}catch(_){}});'+
      '})();<\/script>'+
      '</div></div>'+
      '<section class="file">'+body+'</section></div>'+
      // 다른 화면과 통일감을 위한 마감 푸터 — 실제 페이지(_layouts/character.html)와 마크업 동일하게(레이아웃
      //   바꾸면 이 미리보기 사본도 같이 고칠 것 — 프로필 툴 대원칙).
      '<footer class="foot"><span><span class="g">AGENT</span> · UID 000-ACCESS</span><span class="r">TS-DB · '+esc(curMeta.title||'')+'</span></footer>'+
      '</div>'+
      '<input type="file" accept="image/*" hidden id="pvFilePick">'+   // 서술카드 그림 블록의 "이미지 바꾸기"가 쓰는 공유 파일창(같은 프레임 클릭이라야 브라우저가 대화상자를 허용)
      '<div class="fmt-bar" id="fmtBar" hidden><button type="button" data-fmt="bold"><b>B</b></button><button type="button" data-fmt="italic"><i>I</i></button><button type="button" data-fmt="quote" title="인용문으로">&ldquo;</button><button type="button" data-fmt="faint" title="회색 글자로(연하게)" style="opacity:.6">A</button><button type="button" data-fmt="code" title="코드블럭으로(고른 문단 전체)" style="font-family:monospace">&lt;/&gt;</button></div>'+   // 글자 선택 시 뜨는 서식 툴바
    '<script>window.CHAR_META='+CH(curMeta)+';window.CHAR_STATS='+CH(curStats)+';'+
      'window.CHAR_WARDROBE='+CH(ward)+';window.CHAR_GENERATIONS='+CH(gens)+';<\/script>'+
    '<script src="../../assets/js/common.js?v=8"><\/script>'+
    '<script src="../../assets/js/profile.js?v=39"><\/script>'+
    '<script src="../../assets/js/profile-generations.js?v=2"><\/script>'+
    '<script src="../../assets/js/profile-ui.js?v=1"><\/script>'+
    '<script src="../../assets/js/stage-fx.js?v=131"><\/script>'+
    // 서술/확장 카드 안 코드블럭 문법강조(실제 페이지 _layouts/character.html과 같은 CDN 라이브러리 — 모양 바꾸면 거기도 같이).
    //   미리보기는 폼을 고칠 때마다 liveText()가 이 패널만 다시 그리는데, 그때는 페이지 재로드가 아니라서 이 스크립트가 다시
    //   안 돌아감 → liveText() 쪽에서 win.hljs.highlightAll()을 직접 한 번 더 불러줌(중복 호출은 hljs가 알아서 건너뜀, 안전).
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"><\/script>'+
    '<script>if(window.hljs){hljs.highlightAll();document.querySelectorAll(\'pre.p-code code[class*="language-"]\').forEach(function(c){var m=c.className.match(/language-(\\S+)/);if(m)c.closest("pre").setAttribute("data-lang",m[1]);});}<\/script>'+
    // 텍스트노드 하나만 보는 방식은 엔터(<br>)로 줄이 나뉘면 여는쪽 마커를 못 찾아 그대로 글자로 남는다.
    //   Range.toString()+Selection.modify로 이동하면 <br>을 건너뛰는 글자수 계산이 실제 이동량과 안 맞아(오프바이원)
    //   줄바꿈이 통째로 사라지거나 마커 한 글자가 안 지워지는 문제가 생긴다. 그래서 Selection.modify를 아예 안 쓰고,
    //   el 전체를 직접 훑어(텍스트=글자 하나, <br>=한 칸) 좌표 목록을 만들고 그 목록에서 시작 위치를 인덱스로 정확히
    //   찾아 Range를 세운다(엔진의 근사 이동에 안 기대는 결정적 방식). 줄바꿈은 실제 <br> 노드로 재구성한다.
    '<script>function tsBold(el){var d=el.ownerDocument,s=d.getSelection();if(!s.rangeCount||!s.isCollapsed)return;var r0=s.getRangeAt(0);'+
      'function flatText(n){var o="";(function w(x){var c=x.firstChild;while(c){if(c.nodeType===3)o+=c.nodeValue;else if(c.nodeType===1){if(c.tagName==="BR")o+="\\n";else w(c);}c=c.nextSibling;}})(n);return o;}'+
      'function flatList(x){var l=[];(function w(n){var c=n.firstChild;while(c){if(c.nodeType===3){var t=c.nodeValue;for(var i=0;i<t.length;i++)l.push({node:c,off:i});}else if(c.nodeType===1){if(c.tagName==="BR")l.push({node:c,off:null});else w(c);}c=c.nextSibling;}})(x);return l;}'+
      // 마커 탐색 시작점은 카드 전체(el)가 아니라 지금 커서가 있는 문단(P)으로 한정한다.
      //   마커(**~**·_~_·++~++·~~~~·==~==)는 문단 경계를 못 넘으므로 결과는 그대로면서, 카드가 길어질수록
      //   매 키 입력마다 그 카드에 지금까지 쓴 글자 전체를 다시 훑는 비용을 문단 길이만큼으로 줄인다.
      'var scope=r0.endContainer.nodeType===1?r0.endContainer:r0.endContainer.parentNode;'+
      'while(scope&&scope!==el&&scope.tagName!=="P")scope=scope.parentNode;if(!scope)scope=el;'+
      'var pre=d.createRange();pre.setStart(scope,0);pre.setEnd(r0.endContainer,r0.endOffset);var bf=flatText(pre.cloneContents());'+
      'var mb=bf.match(/\\*\\*([^*]+)\\*\\*$/),mi=!mb&&bf.match(/_([^_]+)_$/),mB=!mb&&!mi&&bf.match(/\\+\\+([^+]+)\\+\\+$/),mS=!mb&&!mi&&!mB&&bf.match(/~~([^~]+)~~$/),mF=!mb&&!mi&&!mB&&!mS&&bf.match(/==([^=]+)==$/),m=mb||mi||mB||mS||mF,tag=mb?"b":mi?"i":mB?"big":mS?"small":"span";'+
      'if(!m)return;var len=m[0].length,list=flatList(scope),startEntry=list[bf.length-len];if(!startEntry)return;'+
      'var rr=d.createRange();if(startEntry.off===null){var p=startEntry.node.parentNode,idx=Array.prototype.indexOf.call(p.childNodes,startEntry.node);rr.setStart(p,idx);}else rr.setStart(startEntry.node,startEntry.off);'+
      'rr.setEnd(r0.endContainer,r0.endOffset);rr.deleteContents();'+
      'var tagEl=d.createElement(tag);if(mF)tagEl.className="faint";var parts=m[1].split("\\n");parts.forEach(function(pt,i){if(i>0)tagEl.appendChild(d.createElement("br"));tagEl.appendChild(d.createTextNode(pt));});'+
      'rr.insertNode(tagEl);rr.setStartAfter(tagEl);rr.collapse(true);'+
      'var zw=d.createTextNode("\\u200b");rr.insertNode(zw);rr.setStartAfter(zw);rr.collapse(true);'+
      's.removeAllRanges();s.addRange(rr);}'+
    // 굵게 등 서식이 걸린 문단 끝에서 Enter로 새 문단을 만들면, 브라우저가 그 서식을 그대로 이어받아
    //   아직 아무 글자도 안 쓴 새 문단 전체가 굵게로 나온다. 새 문단이 "서식 태그로만 감싸인 빈 상태"일
    //   때만 그 빈 서식을 풀어 평문으로 되돌린다 — 이미 글자가 있는 서식(의도적으로 이어쓴 경우)은 안 건드린다.
    'function tsUnwrapEmptyMark(el){var d=el.ownerDocument,s=d.getSelection();if(!s.rangeCount)return;'+
      'var node=s.getRangeAt(0).startContainer,p=node.nodeType===1?node:node.parentNode;'+
      'while(p&&p!==el&&p.tagName!=="P")p=p.parentNode;if(!p||p===el||p.tagName!=="P")return;'+
      'while(p.childNodes.length===1&&p.firstChild.nodeType===1){var only=p.firstChild,tag=only.tagName;'+
        'var isMark=tag==="B"||tag==="I"||tag==="BIG"||tag==="SMALL"||(tag==="SPAN"&&only.classList.contains("faint"));'+
        'if(!isMark)break;if(only.textContent.replace(/\\u200b/g,"").length>0)break;'+
        'while(only.firstChild)p.insertBefore(only.firstChild,only);p.removeChild(only);}'+
      'if(!p.firstChild)p.appendChild(d.createElement("br"));'+
      'var r=d.createRange();r.selectNodeContents(p);r.collapse(true);s.removeAllRanges();s.addRange(r);}'+
    'document.addEventListener("input",function(e){var el=e.target.closest&&e.target.closest("[data-edit]");if(!el)return;var k=el.getAttribute("data-edit"),isBody=/(:body|:text:\\d+)$/.test(k);if(isBody)tsBold(el);var v=isBody?el.innerHTML:el.textContent;try{parent.pvEdit(k,v);}catch(_){}}, true);'+
    // 엔터=새 문단 / Shift+엔터=줄바꿈(노션·티스토리와 동일한 규칙). 엔터를 항상 줄바꿈(<br>)으로 고정하면
    //   새 문단을 만들 방법이 아예 없어진다. 문단 구분자를 <p>로 고정(안 하면 브라우저가 기본으로 <div>를 씀)
    //   → htmlToProse가 <p>를 "빈 줄로 구분된 문단"으로 되읽는다(대칭).
    'try{document.execCommand("defaultParagraphSeparator",false,"p");}catch(_){}'+
    // 이름·부제·나이·인용구 같은 "한 줄" 칸은 Enter를 막지 않으면, 화면엔 두 줄로 보여도(브라우저 기본
    //   줄바꿈 삽입) 실제 값은 textContent라 줄바꿈 없이 그대로 이어붙는다(예: "마이티"+Enter+"테스트" →
    //   "마이티테스트"). 그래서 한 줄 칸은 Enter 자체를 막는다(보통 <input>처럼 아무 일도 안 일어남). 여러 줄(본문) 칸은 기존 그대로.
    'document.addEventListener("keydown",function(e){if(e.key!=="Enter")return;var el=e.target.closest&&e.target.closest("[data-edit]");if(!el)return;var k=el.getAttribute("data-edit"),isBody=/(:body|:text:\\d+)$/.test(k);'+
      'if(!isBody){e.preventDefault();return;}'+
      'if(e.shiftKey){e.preventDefault();document.execCommand("insertLineBreak");return;}'+
      'setTimeout(function(){tsUnwrapEmptyMark(el);},0);'+
    '}, true);'+
    // 붙여넣기는 항상 순수 텍스트만 받는다 — 워드/한글 문서 등에서 복사해오면 mso-* 같은 서식 찌꺼기가 그대로
    //   들어와 화면에 깨진 글자로 노출된다. 굵게 등은 붙여넣은 뒤 **글자**나 B버튼으로 다시 적용하면 된다.
    //   워드/한글(HWP)·파워포인트 등 일부 앱은 클립보드에 "text/plain"을 아예 안 담고 "text/html"만 준다 —
    //   그 경우 text/plain이 없으면 text/html에서 글자만 추려 대신 쓰고, 그것도 없으면 아무 것도 안 하고
    //   빠져나가 원래 선택돼 있던 글자를 보존한다(빈 문자열로 insertText하면 선택 글자만 지워지고 아무것도
    //   안 채워져 내용이 사라진 것처럼 보이기 때문).
    // 붙여넣은 텍스트에 줄바꿈이 있으면: 한 줄 칸은 줄바꿈을 공백으로 바꿔서 Enter 때처럼 그대로 이어붙는 걸
    //   막고, 여러 줄(본문) 칸은 이 화면의 규칙(빈 줄=새 문단·홑줄바꿈=문단 안 줄바꿈)을 그대로 적용한다.
    'document.addEventListener("paste",function(e){var el=e.target.closest&&e.target.closest("[data-edit]");if(!el)return;e.preventDefault();'+
      'var cd=(e.clipboardData||window.clipboardData),t=cd.getData("text/plain");'+
      'if(!t){var h=cd.getData("text/html");if(h){var tmp=document.createElement("div");tmp.innerHTML=h;t=tmp.textContent||tmp.innerText||"";}}'+
      'if(!t)return;'+   // 아무 텍스트도 못 뽑으면(이미지만 복사 등) 아무것도 안 함 — 선택돼 있던 글자를 실수로 지우지 않음
      'var isBody=/(:body|:text:\\d+)$/.test(el.getAttribute("data-edit"));t=t.replace(/\\r\\n?/g,"\\n");'+
      'if(!isBody){t=t.replace(/\\n+/g," ");}'+
      'else{t=t.replace(/\\n{2,}/g,"\\uE000").replace(/\\n/g," ").replace(/\\uE000/g,"\\n");}'+
      'document.execCommand("insertText",false,t);}, true);'+
    // 글자 선택 시 뜨는 서식 툴바 — 타이핑 즉시 적용되는 자동 ** 변환과 달리, 이미 쓴 글자를 나중에
    //   서식 적용할 때 쓴다. 선택한 글자 위에 B/I/인용문 버튼이 뜨고, 눌러서 굵게·기울임·인용문(문단
    //   통째로 .prose .lead 스타일)을 토글한다.
    '(function(){var bar=document.getElementById("fmtBar");'+
      // ★인용문 버튼 = 글자가 아니라 "그 글자가 속한 문단(<p>)" 통째로 바뀜(굵게/기울임과 성격이 다름) → 문단 태그를 직접 찾아 class="lead"를 토글.
      'function closestP(node, root){var n=node.nodeType===1?node:node.parentElement;while(n&&n!==root&&root.contains(n)){if(n.tagName==="P")return n;n=n.parentElement;}return null;}'+
      'function place(){'+
        'var s=window.getSelection();'+
        'if(!s||s.rangeCount===0||s.isCollapsed){bar.hidden=true;return;}'+
        'var el=s.anchorNode&&s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode&&s.anchorNode.parentElement;'+
        'var ed=el&&el.closest&&el.closest("[data-edit]");'+
        'if(!ed||!/(:body|:text:\\d+)$/.test(ed.getAttribute("data-edit"))){bar.hidden=true;return;}'+
        'var r=s.getRangeAt(0).getBoundingClientRect();'+
        'if(!r||(!r.width&&!r.height)){bar.hidden=true;return;}'+
        'bar.hidden=false;'+
        'bar.style.left=Math.max(4,r.left+r.width/2-bar.offsetWidth/2)+"px";'+
        'bar.style.top=Math.max(4,r.top-bar.offsetHeight-6)+"px";'+
        'bar.querySelector(\'[data-fmt="bold"]\').className=document.queryCommandState("bold")?"on":"";'+
        'bar.querySelector(\'[data-fmt="italic"]\').className=document.queryCommandState("italic")?"on":"";'+
        'var p0=closestP(s.getRangeAt(0).startContainer, ed);'+
        'bar.querySelector(\'[data-fmt="quote"]\').className=(p0&&p0.classList.contains("lead"))?"on":"";'+
        'bar.querySelector(\'[data-fmt="faint"]\').className=(el&&el.closest&&el.closest("span.faint"))?"on":"";'+
      '}'+
      'document.addEventListener("selectionchange",place);'+
      // ★버튼 mousedown에서 막아야 클릭해도 방금 고른 글자 선택이 안 풀림(안 막으면 버튼이 포커스를 가져가며 selection이 사라짐).
      'bar.addEventListener("mousedown",function(e){e.preventDefault();});'+
      'bar.addEventListener("click",function(e){var b=e.target.closest("button[data-fmt]");if(!b)return;var fmt=b.getAttribute("data-fmt");'+
        'var s2=window.getSelection();if(!s2||s2.rangeCount===0)return;'+
        'var an=s2.anchorNode,el2=an&&(an.nodeType===1?an:an.parentElement),ed2=el2&&el2.closest&&el2.closest("[data-edit]");'+
        'if(fmt==="quote"){'+
          'if(!ed2)return;'+
          'var p=closestP(s2.getRangeAt(0).startContainer, ed2);'+
          'if(!p){p=document.createElement("p");while(ed2.firstChild)p.appendChild(ed2.firstChild);ed2.appendChild(p);}'+   // 아직 <p>로 안 나뉜 한 줄짜리 내용이면 통째로 <p>로 감싼 뒤 토글
          'p.classList.toggle("lead");'+
        // ★회색 글자(연하게) — bold/italic처럼 네이티브 execCommand가 없어 직접 span.faint로 감싸거나(토글 ON) 풀어냄(토글 OFF).
        '}else if(fmt==="faint"){'+
          'var rg=s2.getRangeAt(0),dimEl=el2&&el2.closest&&el2.closest("span.faint");'+
          'if(dimEl&&dimEl.textContent===s2.toString()){'+
            'var pr=dimEl.parentNode;while(dimEl.firstChild)pr.insertBefore(dimEl.firstChild,dimEl);pr.removeChild(dimEl);'+
          '}else{'+
            'var fsp=document.createElement("span");fsp.className="faint";'+
            'try{rg.surroundContents(fsp);}catch(_e){fsp.appendChild(rg.extractContents());rg.insertNode(fsp);}'+
          '}'+
        // ★코드블럭 — 굵게/기울임(글자만)이나 인용문(문단 하나)과 달리, 선택이 걸친 문단(들)을 통째로 code블럭 하나로 바꿔치기한다.
        //   문단 경계가 애매한 부분편집(글자 일부만) 대신 "문단 단위로만" 동작하게 해서(quote와 같은 단위) DOM이 안 깨지게 한다.
        //   여기서 만든 code블럭은 pre.p-code(형식은 ```코드블럭``` 입력과 완전히 같은 결과물) — htmlToProse가 그대로 역파싱해줌.
        '}else if(fmt==="code"){'+
          'if(!ed2)return;'+
          'var rg2=s2.getRangeAt(0);'+
          'var ps=[].filter.call(ed2.querySelectorAll("p"),function(p){return rg2.intersectsNode(p);});'+
          'if(!ps.length)return;'+
          'var codeText=ps.map(function(p){return (p.innerText||p.textContent||"").replace(/\\u00a0/g," ");}).join("\\n");'+
          'var pre=document.createElement("pre");pre.className="p-code";'+
          'var codeEl=document.createElement("code");codeEl.textContent=codeText;'+
          'pre.appendChild(codeEl);'+
          'ps[0].parentNode.insertBefore(pre,ps[0]);'+
          'ps.forEach(function(p){p.remove();});'+
          'if(window.hljs){window.hljs.highlightElement(codeEl);var lm=codeEl.className.match(/language-(\\S+)/);if(lm)pre.setAttribute("data-lang",lm[1]);}'+   // 방금 만든 블록도 바로 색깔 입혀서 보여줌(자동판별)
          's2.removeAllRanges();'+
        '}else{document.execCommand(fmt);}'+
        // ★execCommand는 대부분 브라우저에서 input 이벤트를 같이 내지만, 확실히 하려고 직접 한 번 더 쏴서(이미 있는 input 리스너 재사용) 저장까지 이어지게 한다.
        'if(ed2)ed2.dispatchEvent(new Event("input",{bubbles:true}));'+
        'place();});'+
    '})();'+
      'document.addEventListener("click",function(e){'+
        // 타임라인(genline) 세대 클릭 — profile-generations.js 자신의 리스너는 iframe 재생성 없이 부드럽게
        // 넘기지만, 그건 카드 영역을 편집 배선 없는 방문자용 마크업으로 다시 그려서 잠깐 "진짜 프로필 페이지"처럼
        // 보이게 만든다. 그래서 이 캡처 단계 리스너가 먼저 잡아 stopPropagation으로 그 리스너까지 안 내려가게
        // 막고, 부모의 세대 전환(폼 동기화 + 통짜 재생성)만 일어나게 한다(profile-generations.js는 안 건드림).
        'var gl=e.target.closest&&e.target.closest(".genline .gen");if(gl){e.stopPropagation();try{parent.pvGenSwitch(gl.getAttribute("data-gen"));}catch(_){}return;}'+
        'var a=e.target.closest&&e.target.closest("[data-add]");if(a){e.preventDefault();try{parent.pvAdd(a.getAttribute("data-add"));}catch(_){}return;}'+
        // ★그림 블록 "이미지 바꾸기" — 대화상자는 반드시 이 프레임 안의 클릭이라야 열림 → iframe 자신의 #pvFilePick을 누름(부모 쪽 input이면 브라우저가 막음).
        'var ip=e.target.closest&&e.target.closest("[data-imgpick]");if(ip){e.preventDefault();window.pvPickTarget=ip.getAttribute("data-imgpick");var fi=document.getElementById("pvFilePick");if(fi)fi.click();return;}'+
        'var bm=e.target.closest&&e.target.closest("[data-blkmove]");if(bm){e.preventDefault();var v=bm.getAttribute("data-blkmove").split(":");try{parent.pvBlkMove(v[0],+v[1],+v[2],v[3]);}catch(_){}return;}'+
        'var cd=e.target.closest&&e.target.closest("[data-carddel]");if(cd){e.preventDefault();try{parent.pvCardDel(+cd.getAttribute("data-carddel"));}catch(_){}return;}'+
        // ★확장 카드 삭제 버튼은 <summary> 안에 있어 preventDefault 안 하면 클릭이 아코디언 접기/펼치기로도 먹힘 → 막고 삭제만.
        'var xd=e.target.closest&&e.target.closest("[data-extdel]");if(xd){e.preventDefault();try{parent.pvExtDel(+xd.getAttribute("data-extdel"));}catch(_){}return;}'+
        // ★기밀(CLASSIFIED) 자물쇠 버튼도 <summary> 안에 있어 preventDefault 안 하면 클릭이 아코디언 접기/펼치기로도 먹힘.
        'var xl=e.target.closest&&e.target.closest("[data-extlock]");if(xl){e.preventDefault();try{parent.pvExtToggleClassified(+xl.getAttribute("data-extlock"));}catch(_){}return;}'+
        'if(e.target.closest&&e.target.closest("summary [contenteditable]"))e.preventDefault();'+
      '},true);'+
      // ★파일을 고른 뒤엔 같은 출처라 File 객체를 그대로 부모 함수 인자로 넘긴다(postMessage 불필요).
      //   같은 파일을 다시 골라도 change가 또 뜨도록 매번 value를 비움.
      'document.getElementById("pvFilePick").addEventListener("change",function(){var f=this.files&&this.files[0];this.value="";if(!f)return;'+
        'var pt=window.pvPickTarget||"";try{if(pt.indexOf("ward:")===0)parent.pvWardImagePick(+pt.slice(5),f);else if(pt==="idimg")parent.pvIdImagePick(f);else parent.pvImagePick(pt,f);}catch(_){}});'+
      '(function(){var PH="'+PH_IMG+'";function fx(i){if(i.id==="stageArt"||i.id==="stageGhost")return;if(i.dataset.ph)return;i.dataset.ph=1;i.src=PH;i.style.opacity=".82";if(i.closest&&i.closest(".idcard-stage")){i.style.objectFit="contain";}else{i.style.cssText+=";object-fit:contain;width:auto;max-width:120px;max-height:140px;margin:10px auto;display:block;";}}'+
      'document.addEventListener("error",function(e){if(e.target.tagName==="IMG")fx(e.target);},true);'+
      'addEventListener("load",function(){document.querySelectorAll("img").forEach(function(i){if(i.id==="stageArt"||i.id==="stageGhost")return;if(!i.getAttribute("src")||!i.naturalWidth)fx(i);});});})();<\/script>'+
    // 옷장 관리(트랙 슬롯의 ⋮ 손잡이 · ＋추가 타일 · 편집 팝오버 · 드래그 순서변경) — profile.js/profile-generations.js는 안 건드리고
    //   이 스크립트 하나로만 동작(옷장 실제 그림·전환 로직은 그대로, 편집용 UI만 위에 얹음).
    '<script>(function(){'+
      'var pop=document.createElement("div");pop.className="ward-pop";pop.hidden=true;'+
      'pop.innerHTML=\'<input class="wp-cap" placeholder="이름(예: 후드)"><input class="wp-artist" placeholder="그린 사람(선택)"><button type="button" class="wp-img">\\uD83D\\uDCC1 이미지 바꾸기</button><button type="button" class="wp-main">\\u2606 대표로 지정</button><button type="button" class="wp-del">\\u2715 삭제</button>\';'+
      'document.body.appendChild(pop);'+
      'var popIdx=-1,popSlot=null,delBtn=pop.querySelector(".wp-del"),delArmTimer=null;'+
      // ★삭제는 확인이 필요하지만 alert 계열(confirm())은 iframe 안에서 브라우저 전체가 멈춰버리는 등 문제가 있어(자동화 테스트에서도 실제로 겪음),
      //   버튼을 한 번 더 눌러야 지워지는 "두 번 누르기" 방식으로 대신함 — 화면을 막지 않으면서도 실수로 지우는 걸 막아준다.
      'function disarmDel(){delBtn.textContent="\\u2715 삭제";delBtn.classList.remove("armed");clearTimeout(delArmTimer);delArmTimer=null;}'+
      'function slots(){var t=document.querySelector(".wardrobe .track");return t?[].slice.call(t.querySelectorAll(".slot")):[];}'+
      // 팝오버는 position:fixed(화면 기준)라 그 안 스크롤 영역(.mscreen)이 움직여도 안 따라감 → 편집 중이던
      // 슬롯에서 뚝 떨어져 보였다(스크롤하면 팝오버만 화면에 그대로 남음) — 스크롤마다 다시 붙여준다.
      'function place(){if(pop.hidden||!popSlot)return;var r=popSlot.getBoundingClientRect();'+
        'pop.style.top=Math.min(window.innerHeight-190,r.bottom+6)+"px";'+
        'pop.style.left=Math.min(window.innerWidth-190,Math.max(6,r.left))+"px";}'+
      'function openPop(slot,idx){popIdx=idx;popSlot=slot;disarmDel();'+
        'var capEl=pop.querySelector(".wp-cap"),artEl=pop.querySelector(".wp-artist");'+
        'var capSpan=slot.querySelector(".cap");capEl.value=capSpan?capSpan.textContent:"";'+
        'artEl.value=slot.getAttribute("data-artist")||"";'+
        'pop.hidden=false;place();}'+
      'function closePop(){pop.hidden=true;popIdx=-1;popSlot=null;disarmDel();}'+
      '(function(){var ms=document.querySelector(".mscreen");if(ms)ms.addEventListener("scroll",place,{passive:true});})();'+
      // 캡션·작가는 팝오버 입력칸이 슬롯 자체와 별개 요소라, 화면 반영은 여기서 직접 하고(부모의 render() 없이) 저장만 부모에.
      'pop.querySelector(".wp-cap").addEventListener("input",function(){if(popSlot){var c=popSlot.querySelector(".cap");if(c)c.textContent=this.value;}try{parent.pvWardEdit(popIdx,{cap:this.value});}catch(_){}});'+
      'pop.querySelector(".wp-artist").addEventListener("input",function(){if(popSlot)popSlot.setAttribute("data-artist",this.value);try{parent.pvWardEdit(popIdx,{artist:this.value});}catch(_){}});'+
      'pop.querySelector(".wp-main").addEventListener("click",function(){try{parent.pvWardEdit(popIdx,{on:true});}catch(_){}closePop();});'+
      'delBtn.addEventListener("click",function(){if(popIdx<0)return;'+
        'if(!delBtn.classList.contains("armed")){delBtn.textContent="한 번 더 누르면 삭제";delBtn.classList.add("armed");'+
          'delArmTimer=setTimeout(disarmDel,3000);return;}'+   // 3초 안에 다시 안 누르면 원래대로(실수 방지)
        'try{parent.pvWardDel(popIdx);}catch(_){}closePop();});'+
      'pop.querySelector(".wp-img").addEventListener("click",function(){window.pvPickTarget="ward:"+popIdx;var fi=document.getElementById("pvFilePick");if(fi)fi.click();});'+
      'document.addEventListener("click",function(e){if(!pop.hidden&&!pop.contains(e.target)&&!(e.target.closest&&e.target.closest(".ward-handle")))closePop();});'+
      // 슬롯마다 ⋮ 손잡이 + 트랙 끝에 ＋추가 타일을 붙임. paintWardrobe가 다시 그릴 때(세대 전환 등)마다 새로 붙어야 하므로
      // profile-generations.js가 하듯 window.__paintWardrobe 자체를 감싼다(profile.js가 이 훅을 그 용도로 미리 열어둠).
      'function decorate(){var t=document.querySelector(".wardrobe .track");if(!t)return;'+
        't.querySelectorAll(".slot").forEach(function(s){if(s.querySelector(".ward-handle"))return;'+
          'var h=document.createElement("button");h.type="button";h.className="ward-handle";h.textContent="\\u22EE";h.title="꾹 눌러 순서 바꾸기 · 짧게 눌러 편집";s.appendChild(h);});'+
        'var add=t.querySelector(".ward-add-tile");'+
        'if(!add){add=document.createElement("button");add.type="button";add.className="ward-add-tile";'+
          'add.innerHTML=\'<span class="thumb"><span class="plus">＋</span></span><span class="cap">옷 추가</span>\';'+
          'add.addEventListener("click",function(){try{parent.pvWardAdd();}catch(_){}});}'+
        't.appendChild(add);}'+   // 이미 있어도 맨 끝으로 다시 옮김(슬롯이 새로 그려진 뒤라 순서가 밀릴 수 있음)
      'if(window.__paintWardrobe){var _orig=window.__paintWardrobe;window.__paintWardrobe=function(list){_orig(list);decorate();};}'+
      // 드래그(⋮ 손잡이, Pointer Events=마우스·터치·펜 공용) — 문턱 넘게 움직이면 순서변경, 그대로면 탭으로 보고 편집 팝오버.
      'var TH=6,drag=null;'+
      'document.addEventListener("pointerdown",function(e){var h=e.target.closest&&e.target.closest(".ward-handle");if(!h)return;var s=h.closest(".slot");if(!s)return;e.preventDefault();'+
        'drag={x:e.clientX,y:e.clientY,startIdx:slots().indexOf(s),slot:s,moved:false};'+
        'try{h.setPointerCapture(e.pointerId);}catch(_){}});'+
      'document.addEventListener("pointermove",function(e){if(!drag)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;'+
        // ★드래그 중인 슬롯 자신이 마우스 바로 아래로 옮겨오므로(transform) pointer-events를 꺼서
        //   elementFromPoint가 자기 자신 말고 "그 아래(옮겨갈 자리)"의 슬롯을 짚게 한다 — 안 그러면
        //   자기 자신이 항상 잡혀서 over===drag.slot이 되어 순서변경이 절대 안 걸리는 문제가 있었음.
        'if(!drag.moved&&Math.hypot(dx,dy)>TH){drag.moved=true;drag.slot.classList.add("dragging");drag.slot.style.pointerEvents="none";}'+
        'if(!drag.moved)return;'+
        'drag.slot.style.transform="translate("+dx+"px,"+dy+"px)";drag.slot.style.zIndex=5;'+
        'var el=document.elementFromPoint(e.clientX,e.clientY),over=el&&el.closest&&el.closest(".slot");'+
        'if(over&&over!==drag.slot){var sl=slots(),oi=sl.indexOf(over),ci=sl.indexOf(drag.slot);'+
          'if(oi>-1&&ci>-1&&oi!==ci){document.querySelector(".wardrobe .track").insertBefore(drag.slot,oi<ci?over:over.nextSibling);}}});'+
      'document.addEventListener("pointerup",function(e){if(!drag)return;var s=drag.slot;s.classList.remove("dragging");s.style.transform="";s.style.zIndex="";s.style.pointerEvents="";'+
        'if(drag.moved){var fi=slots().indexOf(s);if(fi!==drag.startIdx){try{parent.pvWardReorder(drag.startIdx,fi);}catch(_){}}}'+
        'else{openPop(s,slots().indexOf(s));}'+
        'drag=null;});'+
    '})();<\/script>'+
    // 능력치 관리(막대 클릭 → 이름·값·증가분 편집 팝오버). 항목 추가/삭제는 지원 안 함(칸 개수가 늘면 정해진
    //   2열×6행 격자를 넘어가 레이아웃이 깨짐) — 항목 자체를 늘리거나 줄여야 하면 코드에서 직접 고친다.
    '<script>(function(){'+
      'var pop=document.createElement("div");pop.className="stat-pop";pop.hidden=true;'+
      'pop.innerHTML=\'<input type="text" class="stp-name" placeholder="이름"><label>값<input type="number" inputmode="numeric" class="stp-val" min="0" max="10" step="1"></label><label>증가분<input type="number" inputmode="numeric" class="stp-plus" min="0" max="10" step="1"></label>\';'+
      'document.body.appendChild(pop);'+
      'var popIdx=-1,popEl=null;'+
      // 팝오버는 position:fixed(화면 기준)라 스크롤 영역(.mscreen)이 움직여도 안 따라감 → 편집 중이던 막대에서
      // 뚝 떨어져 보였다(스크롤하면 팝오버만 화면에 그대로 남음) — 스크롤마다 다시 붙여준다.
      'function place(){if(pop.hidden||!popEl)return;var r=popEl.getBoundingClientRect();'+
        'pop.style.top=Math.min(window.innerHeight-140,r.bottom+6)+"px";'+
        'pop.style.left=Math.min(window.innerWidth-190,Math.max(6,r.left))+"px";}'+
      // 현재 값은 왼쪽 폼이 아니라 화면에 이미 그려진 막대(.n)에서 그대로 읽는다 — 이미 0~10으로 정리된 값이라 왕복이 안전함.
      'function openPop(el,idx){popIdx=idx;popEl=el;'+
        'var nameEl=pop.querySelector(".stp-name"),valEl=pop.querySelector(".stp-val"),plusEl=pop.querySelector(".stp-plus");'+
        'var kEl=el.querySelector(".k"),nEl=el.querySelector(".n"),bEl=nEl&&nEl.querySelector("b");'+
        'nameEl.value=kEl?kEl.textContent:"";'+
        'valEl.value=nEl&&nEl.firstChild?(parseInt(nEl.firstChild.textContent,10)||0):0;'+
        'plusEl.value=bEl?(parseInt(bEl.textContent.replace("+",""),10)||0):0;'+
        'pop.hidden=false;place();}'+
      'function closePop(){pop.hidden=true;popIdx=-1;popEl=null;}'+
      '(function(){var ms=document.querySelector(".mscreen");if(ms)ms.addEventListener("scroll",place,{passive:true});})();'+
      'pop.querySelector(".stp-name").addEventListener("input",function(){try{parent.pvStatEdit(popIdx,{name:this.value});}catch(_){}});'+
      'pop.querySelector(".stp-val").addEventListener("input",function(){try{parent.pvStatEdit(popIdx,{val:this.value});}catch(_){}});'+
      'pop.querySelector(".stp-plus").addEventListener("input",function(){try{parent.pvStatEdit(popIdx,{plus:this.value});}catch(_){}});'+
      'document.addEventListener("click",function(e){if(!pop.hidden&&!pop.contains(e.target)&&!(e.target.closest&&e.target.closest(".sb.stat-editable")))closePop();});'+
      // paintStats는 매번 .statbars 안을 통째로 새로 그리므로(옷장 트랙과 같은 방식), 다시 그릴 때마다(세대 전환 등) 다시 붙어야 함
      // → window.__paintStats 자체를 감싼다(옷장의 window.__paintWardrobe 훅과 같은 방식, profile.js가 이 용도로 미리 열어둠).
      'function decorate(box){if(!box)return;'+
        '[].forEach.call(box.querySelectorAll(".sb"),function(el,i){el.classList.add("stat-editable");'+
          'el.addEventListener("click",function(){openPop(el,i);});});}'+
      'if(window.__paintStats){var _orig=window.__paintStats;window.__paintStats=function(stats,box){_orig(stats,box);decorate(box||document.querySelector(".statbars"));};}'+
    '})();<\/script>'+
    // 신원 한 줄 정보(나이·키·생일·소속·부서·역할) 편집 — namehead는 페이지당 한 번만 그려지고 다시 그려지지 않으므로
    //   옷장·능력치처럼 매번 다시 붙일 필요 없이 한 번만 배선하면 됨.
    '<script>(function(){'+
      'var btn=document.querySelector(".idmeta-edit");if(!btn)return;'+
      'var pop=document.createElement("div");pop.className="id-pop";pop.hidden=true;'+
      // 부제·이름·기록번호는 전부 이 팝오버 하나에서만 고친다 — 카드에서 직접 클릭해 고치게 두면
      //   (부제·인용구처럼) 이 줄만 예외로 보여서 "왜 이건 되고 저건 안 되지" 헷갈림. 부제·한글 이름은
      //   자유 텍스트라 원래 카드에서 직접 고쳐도 안전하지만, 바로 옆 한글 성·영문 이름(슬러그·경로에 쓰임)은
      //   안전하게 팝오버로만 둬야 해서, 같은 줄 안에서 "이건 되고 이건 안 되고"가 안 생기게 전부 여기로 모았다.
      'pop.innerHTML=\'<label>부제<input class="idp-eyebrow" placeholder="이름 위 작은 글(선택)"></label>\'+'+
        '\'<div class="idp-row"><label>한글 이름<input class="idp-krname" placeholder="이름"></label><label>한글 성<input class="idp-krsur" placeholder="성(선택)"></label></div>\'+'+
        '\'<div class="idp-row"><label>영문 이름<input class="idp-enname" placeholder="first name"></label><label>영문 성<input class="idp-ensur" placeholder="선택"></label></div>\'+'+
        '\'<label>기록번호<input class="idp-record" placeholder="예: M-01"></label>\'+'+
        '\'<div class="idp-row"><label>나이<input class="idp-age" placeholder="20 (모르면 ?)"></label><label>키(cm)<input class="idp-height" type="number"></label></div>\'+'+
        '\'<label>생일<input class="idp-bday" placeholder="1/1"></label>\'+'+
        '\'<label>지부<select class="idp-sector"></select></label>\'+'+
        '\'<label>부서<select class="idp-dept"></select></label>\'+'+
        '\'<label>역할<select class="idp-role"></select></label>\';'+
      'document.body.appendChild(pop);'+
      'var eyebrowEl=pop.querySelector(".idp-eyebrow"),krnameEl=pop.querySelector(".idp-krname"),'+
        'recordEl=pop.querySelector(".idp-record"),krsurEl=pop.querySelector(".idp-krsur"),ennameEl=pop.querySelector(".idp-enname"),ensurEl=pop.querySelector(".idp-ensur"),'+
        'ageEl=pop.querySelector(".idp-age"),heightEl=pop.querySelector(".idp-height"),bdayEl=pop.querySelector(".idp-bday"),'+
        'sectorEl=pop.querySelector(".idp-sector"),deptEl=pop.querySelector(".idp-dept"),roleEl=pop.querySelector(".idp-role");'+
      // 드롭다운 항목은 부모 폼의 실제 <select>에서 그대로 복제(단일 출처 = 부모의 SECTORS/DEPTS/ROLES 배열).
      'function cloneOpts(sel,srcId){try{sel.innerHTML=parent.document.getElementById(srcId).innerHTML;}catch(e){}}'+
      'cloneOpts(sectorEl,"bi_sector");cloneOpts(deptEl,"bi_dept");cloneOpts(roleEl,"bi_role");'+
      'function place(){if(pop.hidden)return;var r=btn.getBoundingClientRect();'+
        'pop.style.top=Math.min(window.innerHeight-400,r.bottom+6)+"px";'+
        'pop.style.left=Math.min(window.innerWidth-230,Math.max(6,r.left))+"px";}'+
      'function openPop(){try{'+
          'eyebrowEl.value=parent.document.getElementById("b_eyebrow").value;'+
          'krnameEl.value=parent.document.getElementById("b_krname").value;'+
          'recordEl.value=parent.document.getElementById("m_record").value;'+
          'krsurEl.value=parent.document.getElementById("b_krsur").value;'+
          'ennameEl.value=parent.document.getElementById("b_enname").value;'+
          'ensurEl.value=parent.document.getElementById("b_ensur").value;'+
          'ageEl.value=parent.document.getElementById("bi_age").value;'+
          'heightEl.value=parent.document.getElementById("bi_height").value;'+
          'bdayEl.value=parent.document.getElementById("bi_bday").value;'+
          'sectorEl.value=parent.document.getElementById("bi_sector").value;'+
          'deptEl.value=parent.document.getElementById("bi_dept").value;'+
          'roleEl.value=parent.document.getElementById("bi_role").value;'+
        '}catch(e){}'+
        'pop.hidden=false;place();}'+
      'function closePop(){pop.hidden=true;}'+
      'btn.addEventListener("click",function(){if(pop.hidden)openPop();else closePop();});'+
      '(function(){var ms=document.querySelector(".mscreen");if(ms)ms.addEventListener("scroll",place,{passive:true});})();'+
      // 타이핑마다(input) 반영하면 구조변경이라 iframe을 통째로 다시 그려 팝오버가 매 글자마다 사라진다
      // → 칸을 벗어나거나(change) 드롭다운을 고른 순간에만 반영.
      'function commit(patch){try{parent.pvIdentityEdit(patch);}catch(_){}}'+
      'eyebrowEl.addEventListener("change",function(){commit({eyebrow:this.value});});'+
      'krnameEl.addEventListener("change",function(){commit({krname:this.value});});'+
      'recordEl.addEventListener("change",function(){commit({record:this.value});});'+
      'krsurEl.addEventListener("change",function(){commit({krsur:this.value});});'+
      'ennameEl.addEventListener("change",function(){commit({enname:this.value});});'+
      'ensurEl.addEventListener("change",function(){commit({ensur:this.value});});'+
      'ageEl.addEventListener("change",function(){commit({age:this.value});});'+
      'heightEl.addEventListener("change",function(){commit({height:this.value});});'+
      'bdayEl.addEventListener("change",function(){commit({bday:this.value});});'+
      'sectorEl.addEventListener("change",function(){commit({sector:this.value});});'+
      'deptEl.addEventListener("change",function(){commit({dept:this.value});});'+
      'roleEl.addEventListener("change",function(){commit({role:this.value});});'+
      'document.addEventListener("click",function(e){if(!pop.hidden&&!pop.contains(e.target)&&e.target!==btn)closePop();});'+
    '})();<\/script>'+
    // 세대 관리 ⚙메뉴 — 타임라인(genline)은 profile-generations.js가 세대 2개 이상일 때만 그리므로(단일 프로필=없음),
    //   그 시점에 맞춰 DOMContentLoaded 뒤에 찾아 옆에 버튼을 붙인다(먼저 등록된 initGens의 리스너가 먼저 돈다).
    '<script>(function(){function setup(){'+
      'var line=document.querySelector(".genline");if(!line)return;'+
      'var gear=document.createElement("button");gear.type="button";gear.className="gen-gear";gear.title="세대 관리";gear.textContent="\\u2699";'+
      'line.parentNode.insertBefore(gear,line.nextSibling);'+
      'var pop=document.createElement("div");pop.className="gen-pop";pop.hidden=true;'+
      'pop.innerHTML=\'<button type="button" class="gp-main">\\u2605 대표로 지정</button>\'+'+
        '\'<button type="button" class="gp-off">세대 구분 끄기 (단일 프로필로)</button>\'+'+
        '\'<button type="button" class="gp-reset">초기화</button>\';'+
      'document.body.appendChild(pop);'+
      'var mainBtn=pop.querySelector(".gp-main"),resetBtn=pop.querySelector(".gp-reset"),armTimer=null;'+
      'function activeGen(){var g=line.querySelector(".gen.on");return g?g.getAttribute("data-gen"):null;}'+
      // "이 세대"라고만 하면 지금 몇 세대를 누르는지 헷갈린다는 피드백 — 타임라인의 실제 라벨(예: "1세대")을 그대로 씀.
      'function activeGenLabel(){var g=line.querySelector(".gen.on");var l=g&&g.querySelector(".glab");return l?l.textContent:"이 세대";}'+
      'function disarmReset(){resetBtn.textContent=activeGenLabel()+" 초기화";resetBtn.classList.remove("armed");clearTimeout(armTimer);armTimer=null;}'+
      'function place(){if(pop.hidden)return;var r=gear.getBoundingClientRect();'+
        'pop.style.top=Math.min(window.innerHeight-150,r.bottom+6)+"px";'+
        'pop.style.left=Math.min(window.innerWidth-198,Math.max(6,r.right-190))+"px";}'+
      'function openPop(){disarmReset();mainBtn.textContent="\\u2605 "+activeGenLabel()+"를 대표로 지정";pop.hidden=false;place();}'+
      'function closePop(){pop.hidden=true;disarmReset();}'+
      'gear.addEventListener("click",function(){if(pop.hidden)openPop();else closePop();});'+
      '(function(){var ms=document.querySelector(".mscreen");if(ms)ms.addEventListener("scroll",place,{passive:true});})();'+
      'pop.querySelector(".gp-main").addEventListener("click",function(){var id=activeGen();if(id){try{parent.pvGenSetMain(id);}catch(_){}}closePop();});'+
      'pop.querySelector(".gp-off").addEventListener("click",function(){try{parent.pvGenToggle(false);}catch(_){}closePop();});'+
      // 삭제와 같은 "두 번 누르기" 방식 — confirm()은 iframe 안에서 브라우저가 멈추는 문제가 있어 안 씀(옷장 삭제와 같은 이유).
      'resetBtn.addEventListener("click",function(){'+
        'if(!resetBtn.classList.contains("armed")){resetBtn.textContent="정말 "+activeGenLabel()+"를 지울까요? 다시 클릭";resetBtn.classList.add("armed");armTimer=setTimeout(disarmReset,3000);return;}'+
        'var id=activeGen();try{parent.pvGenReset(id);}catch(_){}closePop();});'+
      'document.addEventListener("click",function(e){if(!pop.hidden&&!pop.contains(e.target)&&e.target!==gear)closePop();});'+
    '}'+
    'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();'+
    '})();<\/script>'+
    editorScript+'</body></html>';
}

/* ---------- 렌더(디바운스) ---------- */
function isHex6(v){ return /^#[0-9a-fA-F]{6}$/.test(v); }
// 스와치가 보여줄 색 — 그 입력칸의 hex, 비었으면 fallback(밝은색이 비면 대표색). 세대 전환 시 이전 색 잔상 방지.
function swatchColor(target){
  var v=($('#'+target).value||'').trim();
  if(isHex6(v)) return v;
  // 비었을 때: 끝색/밝은색은 시작색·대표색으로 표시(그라데이션 끝색 비면 단색이라 시작색과 같게 보임)
  var chain={ accent2:['accent'], accentLight:['accent'], accent2Light:['accent2','accentLight','accent'], statPlus:['accent'] }[target]||[];
  for(var i=0;i<chain.length;i++){ var c=($('#'+chain[i]).value||'').trim(); if(isHex6(c)) return c; }
  return '#bfc7d4';
}
function syncColorPickers(){   // 각 커스텀 색 스와치 배경을 현재 값으로
  document.querySelectorAll('.cp-sw').forEach(function(sw){
    if(sw.dataset.fxcolor!==undefined){ if(sw.dataset.fxval) sw.style.background=sw.dataset.fxval; return; }   // 효과 색 스와치는 자기 값 유지
    sw.style.background=swatchColor(sw.dataset.target); });
}
/* ---------- 미리보기: 이중 버퍼 교차 페이드 (깜빡임 없음) ----------
   원리: 겹쳐둔 iframe 2장 중 '안 보이는' 쪽에 새 화면을 통째로 그리고,
   다 그려진 뒤에야(onload) 부드럽게 앞으로 교체한다.
   → 화면을 통째로 지웠다 다시 그릴 때 생기는 '빈 화면 번쩍임'이 없다.
   ※ 미리보기 HTML을 만드는 곳은 여전히 buildSrcdoc 하나 → 유지보수는 그대로. */
var PV = document.querySelectorAll('.pv-frame');
var pvFront = 0;          // 지금 보이는 iframe 번호(0 또는 1)
var pvLastHTML = null;    // 직전에 그린 HTML. 같으면 다시 안 그림(불필요한 깜빡임 차단)
var pvResetScroll = false;   // 세대 전환 등 "새 화면"으로 넘어갈 때만 true(selectGen이 켬) — 켜져 있으면 이번 렌더는 스크롤을 이어받지 않고 맨 위로
function pvScroll(fr){    // 미리보기 스크롤 위치 읽기(.mscreen 이 스크롤 영역)
  try{ var m = fr.contentDocument && fr.contentDocument.querySelector('.mscreen'); return m ? m.scrollTop : 0; }
  catch(e){ return 0; }
}
function paintPreview(st){
  var html = buildSrcdoc(st);
  if(html === pvLastHTML) return;    // 바뀐 게 없으면 손대지 않는다(핵심 깜빡임 차단)
  pvLastHTML = html;
  var front = PV[pvFront], back = PV[pvFront ^ 1];
  var keepScroll = pvResetScroll ? 0 : pvScroll(front);  // 평소엔 보던 위치 유지(위로 튀지 않게), 세대 전환 직후만 맨 위로
  pvResetScroll = false;
  back.onload = function(){
    try{
      var doc = back.contentDocument;
      doc.documentElement.setAttribute('data-theme', THEME);   // 사이트 테마가 덮어쓰지 않게 강제
      var m = doc.querySelector('.mscreen'); if(m && keepScroll) m.scrollTop = keepScroll;
    }catch(e){}
    back.classList.add('show');       // 다 그려진 뒤에야 앞으로 꺼내 보인다
    front.classList.remove('show');
    pvFront ^= 1;
  };
  back.srcdoc = html;
}
// 자동저장(브라우저 임시보관) — render·scheduleSave 공용(중복 제거)
function saveLocal(st){ try{ localStorage.setItem('tsPB', JSON.stringify({ file: buildFile(st), slug: st.slug })); }catch(e){} }
var timer = null;
function render(){
  syncColorPickers();
  clearTimeout(timer);
  timer = setTimeout(function(){
    var st = collect();          // collect가 현재 세대(CUR_GEN)를 GEN_FORMS에 스냅샷함
    refreshGenBar();             // 입력에 따라 세대 탭의 작성(●/○) 상태 갱신
    saveLocal(st);   // 자동저장
    if(typeof regenLineup==='function') regenLineup();   // 옷장 main·키 바뀌면 라인업 미리보기 갱신('키 비교' 켰을 때만 실제 생성)
    paintPreview(st);
    var path = 'characters/' + (st.slug||'<슬러그>') + '/index.html';
    $('#outPath').textContent = path;
  }, 300);
}

