"use strict";
/* ============================================================
   프로필 작성 툴 — 초기화 + 이벤트 바인딩 + 저장/제출 + 라인업
   ------------------------------------------------------------
   코드 내보내기 · seed()/boot() 진입점 · 폼 전체 이벤트 바인딩(40여 건) ·
   커스텀 색선택기 팝오버 · 사이드패널 토글 · 저장(IndexedDB)/디스코드 제출 ·
   목록 라인업(키 비교) 이미지 섹션 전체 · 마지막 render() 호출.
   ★이 파일은 즉시실행문(seed()/boot()/이벤트 바인딩 등)과 그 즉시실행문이
   바로 부르는 도우미 함수가 촘촘히 섞여 있어 항상 마지막에 로드되어야 하고,
   더 잘게 쪼개면 순서 사고 위험이 생긴다 — docs/architecture-profile-builder.md 참고.
   ============================================================ */
/* ---------- 본문 스니펫 ---------- */
/* ---------- 코드 생성 / 복사 / 다운로드 ---------- */
function showOut(){
  var st = collect();
  $('#outCode').value = buildFile(st);
  $('#out').classList.add('on');
}

/* ---------- 초기화 · 바인딩 ---------- */
function seed(){   // 새 캐릭터 기본: 대표(3세대)에만 씨앗(능력치 이름·옷장·서술 3종), 1·2세대는 빈 상태
  buildFxGallery();
  var main = blankGen();
  main.stats = STAT_NAMES.map(function(n){ return [n,'','']; });
  main.wardrobe = [{cap:'후드',img:'',on:true},{cap:'정장',img:'',on:false}];
  main.proses = [{title:'Appearance',sub:'외관',body:''},{title:'Personality',sub:'성격',body:''},{title:'Abilities',sub:'특성',body:''}];
  MAIN_GEN='3'; CUR_GEN='3'; GEN_ON=false;   // 새 캐릭터 기본 = 단일(세대 없음). 필요하면 '세대 구분 사용'으로 켬.
  GEN_FORMS = { '1':blankGen(false), '2':blankGen(false), '3':main };   // 1·2세대는 사원증·능력치 기본 꺼짐
  writeGen(GEN_FORMS['3']);
  refreshGenBar();
}
seed();
// 진입 방식 결정: ?load=<슬러그>(그 캐릭터 편집) · ?new=1(빈 새 캐릭터) · (없으면) 이전 작업 자동 복원.
// 캐릭터 페이지 ⚙의 '편집'과 목록의 '＋ 새 캐릭터'가 이 파라미터로 연결됨.
(function boot(){
  var qs; try{ qs = new URLSearchParams(location.search); }catch(e){ qs = null; }   // q라는 이름은 위쪽 YAML 따옴표 헬퍼 q()가 이미 쓰고 있어 겹치지 않게 qs로
  var loadSlug = qs && qs.get('load');
  var isNew = qs && (qs.get('new') != null);
  if((loadSlug || isNew) && window.history && history.replaceState){
    try{ history.replaceState(null, '', location.pathname); }catch(e){}   // 주소에서 ?load/?new 제거 → 새로고침하면 편집 내용 유지(복원)
  }
  if(loadSlug){                                    // 캐릭터 페이지 ⚙ '이 캐릭터 편집'으로 진입
    var pick = $('#loadPick'); if(pick) pick.value = loadSlug;   // 드롭다운도 맞춤(목록에 있으면)
    loadCharacter(loadSlug);                        // 그 캐릭터를 fetch로 불러와 폼 채움
    return;
  }
  if(isNew){                                       // 목록의 '＋ 새 캐릭터'로 진입
    WAS_NEW = true;                                 // (기록번호 자동 제안은 syncLoadList 로드 후)
    loadMsg('새 캐릭터 — 빈 상태로 시작합니다. 왼쪽 폼부터 채우세요.', true);
    return;                                         // seed() 그대로(빈 템플릿)
  }
  try{ var raw=localStorage.getItem('tsPB'); if(!raw) return; var s=JSON.parse(raw);   // 이전 작업 자동 복원(새로고침해도 유지)
    if(s && s.file){ loadFromText(s.file); if(s.slug) setVal('#slug', s.slug); loadMsg('이전 작업을 복원했어요 · 처음부터 하려면 아래 ‘전체 지우기’', true); }
  }catch(e){}
})();

// 입력 분기: 능력치·색·텍스트·무대효과는 '라이브 패치'(재생성 없음=번쩍임 없음), 구조 변경(이미지·체크박스·대표)만 재생성.
//   ※ 무대효과는 폼 입력이 아니라 레이어 편집기(갤러리 fxgPick/fxEdit)→liveEffect() 로 별도 라이브 패치.
function isStatInput(t){ return !!(t && t.classList && (t.classList.contains('s-val')||t.classList.contains('s-plus')||t.classList.contains('s-name'))); }
function isAccentInput(t){ return !!(t && (t.id==='accent'||t.id==='accentLight'||t.id==='accent2'||t.id==='accent2Light'||t.id==='statPlus')); }
// 신원·서술·사원증 '텍스트' 필드(→ 패널만 다시 그림). 이미지·main·카드표시 체크박스는 제외(구조변경 = 재생성). (효과는 레이어 편집기가 따로 처리)
var TEXT_IDS={ b_eyebrow:1,b_krname:1,b_krsur:1,b_enname:1,b_ensur:1,bi_age:1,bi_height:1,bi_bday:1,b_quote:1,
  bi_sector:1,bi_dept:1,bi_role:1,b_idstatus:1,b_idartist:1 };
function isTextInput(t){ if(!t) return false; if(TEXT_IDS[t.id]) return true;
  // .blk-text-v/.blk-alt/.blk-artist는 서술카드·확장카드 블록 공용.
  return !!(t.classList && (t.classList.contains('p-title')||t.classList.contains('p-sub')||
    t.classList.contains('blk-text-v')||t.classList.contains('blk-alt')||t.classList.contains('blk-artist')||
    t.classList.contains('e-title')||t.classList.contains('e-sub'))); }
function isWardArtistInput(t){ return !!(t && t.classList && t.classList.contains('w-artist')); }
function onFormChange(e){
  var t=e.target;
  if(t && t.closest && t.closest('.cp-pop')) return;   // 색 선택기 팝오버 내부 입력은 팝오버가 알아서 처리(재생성 안 함)
  if(t && t.closest && t.closest('.fxcols')) return;   // 효과 편집기(2컬럼) 내부는 전용 핸들러가 처리(재생성 X)
  if(isStatInput(t)){ liveStats(); return; }
  if(isAccentInput(t)){ liveAccent(); return; }
  if(isWardArtistInput(t)){ liveArtCredit(); return; }   // 옷장 '작가'만 바뀜 = 무대 크레딧 글자만 갱신(재생성 X)
  if(isTextInput(t)){ liveText(); return; }
  render();
}
document.addEventListener('input', onFormChange);
document.addEventListener('change', onFormChange);
// 섹션 카드 접기/펼치기 — legend 클릭으로 그 섹션 토글. 기본=전부 펼침, 필요할 때만 접기.
document.querySelectorAll('.form > .sec > .sec-h').forEach(function(hd){
  hd.addEventListener('click', function(e){
    if(e.target.closest('input,button,select,a,textarea')) return;   // 헤더 안 조작요소 클릭은 접기 무시
    hd.parentNode.classList.toggle('collapsed');
  });
});
// 폴더 이름(slug)은 폼에서 벗어날 때 자동으로 안전한 형태(영문 소문자·숫자·-)로 정리
$('#slug').addEventListener('change', function(){ var c=slugify(this.value); if(c!==this.value){ this.value=c; render(); } });
// 세대 토글 바: 탭 클릭=편집할 세대 전환 · 아래 라디오=대표 세대 지정
$('#genTabs').addEventListener('click', function(e){
  var tab=e.target.closest('.gtab'); if(tab) selectGen(tab.getAttribute('data-gen'));
});
$('#genMainPick').addEventListener('change', function(e){
  var r=e.target.closest('input[name="genmainpick"]'); if(r) setMain(r.value);
});
// 무대 효과 레이어 편집기(앞/뒤 2컬럼): 버튼(click)·＋추가(click)·옵션 입력(input)
(function(){ var c=document.querySelector('.fxcols'); if(!c) return;
  c.addEventListener('click', function(e){ var add=e.target.closest('.fx-add-btn'); if(add) openFxGallery(add.getAttribute('data-place')); else fxEdit(e); });
  c.addEventListener('input', fxEdit);
  // 드래그 순서변경(그립 ⠿ 잡고 이동, 다른 컬럼에 놓으면 앞/뒤 전환)
  c.addEventListener('dragstart', function(e){ var g=e.target.closest('.fx-grip'); if(!g) return;
    var row=g.closest('.fxrow'); if(!row) return; fxDragI=+row.getAttribute('data-i');
    e.dataTransfer.effectAllowed='move'; try{ e.dataTransfer.setData('text/plain',String(fxDragI)); e.dataTransfer.setDragImage(row,12,12); }catch(_){}
    row.classList.add('dragging'); });
  c.addEventListener('dragover', function(e){ if(fxDragI==null) return; e.preventDefault(); e.dataTransfer.dropEffect='move';
    c.querySelectorAll('.fxrow.dropbefore').forEach(function(r){ r.classList.remove('dropbefore'); });
    var row=e.target.closest('.fxrow'); if(row) row.classList.add('dropbefore'); });
  c.addEventListener('drop', fxDrop);
  c.addEventListener('dragend', function(){ fxDragI=null;
    c.querySelectorAll('.dragging,.dropbefore').forEach(function(r){ r.classList.remove('dragging','dropbefore'); }); });
})();
// 효과 고르기 갤러리(모달): 타일 클릭=추가 · ✕/바깥클릭/Esc=닫기
(function(){ var ov=$('#fxGallery'); if(!ov) return;
  ov.addEventListener('click', function(e){
    if(e.target===ov || e.target.closest('[data-fxg-close]')){ closeFxGallery(); return; }
    var tile=e.target.closest('.fxg-tile'); if(tile) fxgPick(tile.getAttribute('data-add')); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !ov.hidden) closeFxGallery(); });
})();
// 세대 구분(타임라인) on/off — 끄면 대표 세대 하나만 편집(단일). 켜면 1·2·3 탭이 나타남.
//   미리보기 안 타임라인 옆 ⚙메뉴("세대 구분 끄기")·상단 '세대 구분 사용' 버튼(genPanelToggle)도
//   이 함수 하나만 부른다(단일 출처) — 왼쪽 체크박스로 켜든 미리보기에서 켜든 결과가 항상 같다.
function setGenOn(on){
  GEN_ON=on;
  GEN_FORMS[CUR_GEN]=readGen();                 // 지금 편집분 저장
  if(!GEN_ON && CUR_GEN!==MAIN_GEN){ CUR_GEN=MAIN_GEN; writeGen(GEN_FORMS[MAIN_GEN]||(GEN_FORMS[MAIN_GEN]=blankGen())); }  // 단일=대표 세대 편집
  refreshGenBar(); syncColorPickers(); pvLastHTML=null; render();
}
$('#genOn').addEventListener('change', function(){ setGenOn(this.checked); });
$('#genPanelToggle').onclick = function(){ setGenOn(true); };
window.pvGenToggle = setGenOn;
// 이 세대(단일이면 이 프로필) 작성 내용만 비우기 — 다른 세대·폴더이름·기록번호는 그대로.
//   id를 주면 그 세대로 먼저 옮겨간 뒤 비운다(미리보기 ⚙메뉴가 지금 보이는 세대 id를 넘겨줌).
function doGenReset(id){
  if(id && id!==CUR_GEN) selectGen(id);
  GEN_FORMS[CUR_GEN]=blankGen(CUR_GEN===MAIN_GEN);
  writeGen(GEN_FORMS[CUR_GEN]);
  refreshGenBar(); syncColorPickers(); pvLastHTML=null; render();
}
$('#genReset').onclick = function(){
  var m=genMeta(CUR_GEN), what = GEN_ON ? (m.label+' '+m.sub+' 세대') : '프로필';
  if(!confirm(what+' 작성 내용을 모두 지울까요?\n(다른 세대·폴더 이름·기록번호는 그대로 둡니다)')) return;
  doGenReset(CUR_GEN);
};
// 미리보기 ⚙메뉴는 confirm() 대신 팝오버 안에서 "두 번 누르기"로 이미 확인받은 뒤 이 함수를 부른다
//   (iframe 안에서 confirm()을 쓰면 자동화 테스트 중 브라우저가 멈추는 문제가 실제로 있었음 — 옷장 삭제와 같은 이유).
window.pvGenReset = doGenReset;
$('#addStat').onclick = function(){ $('#stats').appendChild(statRow('', '', '')); render(); };
$('#addWard').onclick = function(){ $('#ward').appendChild(wardRow('', '', false)); render(); };
// 무대 배치 편집 토글 — 켜면 미리보기에 편집기(edit-core.js) 표시, 끄면 깨끗한 미리보기. 새로 그려야 반영.
$('#stageEdit').onchange = function(){ EDIT_MODE = this.checked; pvLastHTML = null; render(); };
$('#addProse').onclick = function(){ $('#proses').appendChild(proseRow({})); render(); };
$('#addExt').onclick   = function(){ $('#exts').appendChild(extRow({})); render(); };
/* ---------- 커스텀 색 선택기(팝오버) — 네이티브 OS 대화상자 대신. 채도/명도 사각 + 색상 바 + hex ---------- */
(function colorPicker(){
  // 색 변환(표준 공식) — hex ↔ rgb ↔ hsv
  function hex2rgb(h){ h=String(h||'').replace('#',''); if(h.length===3)h=h.split('').map(function(c){return c+c;}).join(''); if(!/^[0-9a-fA-F]{6}$/.test(h))h='bfc7d4'; var n=parseInt(h,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
  function rgb2hex(r,g,b){ return '#'+[r,g,b].map(function(x){ return ('0'+Math.round(Math.max(0,Math.min(255,x))).toString(16)).slice(-2); }).join(''); }
  function rgb2hsv(r,g,b){ r/=255;g/=255;b/=255; var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0; if(d){ if(mx===r)h=((g-b)/d)%6; else if(mx===g)h=(b-r)/d+2; else h=(r-g)/d+4; h*=60; if(h<0)h+=360; } return {h:h,s:mx?d/mx:0,v:mx}; }
  function hsv2rgb(h,s,v){ var c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r,g,b;
    if(h<60){r=c;g=x;b=0;}else if(h<120){r=x;g=c;b=0;}else if(h<180){r=0;g=c;b=x;}else if(h<240){r=0;g=x;b=c;}else if(h<300){r=x;g=0;b=c;}else{r=c;g=0;b=x;}
    return {r:(r+m)*255,g:(g+m)*255,b:(b+m)*255}; }

  var pop=document.createElement('div'); pop.className='cp-pop'; pop.hidden=true;
  pop.innerHTML='<div class="cp-sv"><div class="cp-sv-t"></div></div><div class="cp-hue"><div class="cp-hue-t"></div></div>'+
    '<div class="cp-foot"><input class="cp-hex hexin" maxlength="7" spellcheck="false"><span class="cp-prev"></span></div>'+
    '<div class="cp-rgb">'+
      '<span class="cp-rgb-f"><span>R</span><input class="cp-r" type="number" min="0" max="255"></span>'+
      '<span class="cp-rgb-f"><span>G</span><input class="cp-g" type="number" min="0" max="255"></span>'+
      '<span class="cp-rgb-f"><span>B</span><input class="cp-b" type="number" min="0" max="255"></span>'+
    '</div>';
  document.body.appendChild(pop);
  var svEl=pop.querySelector('.cp-sv'), svT=pop.querySelector('.cp-sv-t'),
      hueEl=pop.querySelector('.cp-hue'), hueT=pop.querySelector('.cp-hue-t'),
      hexEl=pop.querySelector('.cp-hex'), prevEl=pop.querySelector('.cp-prev'),
      rEl=pop.querySelector('.cp-r'), gEl=pop.querySelector('.cp-g'), bEl=pop.querySelector('.cp-b');
  var cur={h:0,s:0,v:0,input:null,sw:null,onCommit:null};

  function draw(){   // 현재 h,s,v → 팝오버 화면 갱신, hex 반환
    var pure=hsv2rgb(cur.h,1,1);
    svEl.style.background='linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,'+rgb2hex(pure.r,pure.g,pure.b)+')';
    svT.style.left=(cur.s*100)+'%'; svT.style.top=((1-cur.v)*100)+'%'; hueT.style.left=(cur.h/360*100)+'%';
    var rgb=hsv2rgb(cur.h,cur.s,cur.v), hex=rgb2hex(rgb.r,rgb.g,rgb.b);
    prevEl.style.background=hex; hexEl.value=hex;
    // 지금 타이핑 중인 칸은 건드리지 않는다(포커스 있는 동안 값을 되돌려 쓰면 커서가 튐).
    if(document.activeElement!==rEl) rEl.value=Math.round(rgb.r);
    if(document.activeElement!==gEl) gEl.value=Math.round(rgb.g);
    if(document.activeElement!==bEl) bEl.value=Math.round(rgb.b);
    return hex;
  }
  function fromRgbInputs(){   // R/G/B 칸 값 → h,s,v (셋 다 있는 칸 기준으로 조합)
    var r=Math.max(0,Math.min(255,+rEl.value||0)), g=Math.max(0,Math.min(255,+gEl.value||0)), b=Math.max(0,Math.min(255,+bEl.value||0));
    var hsv=rgb2hsv(r,g,b); cur.h=hsv.h; cur.s=hsv.s; cur.v=hsv.v;
  }
  [rEl,gEl,bEl].forEach(function(el){ el.addEventListener('input', function(){ fromRgbInputs(); commit(); }); });
  function commit(){   // 바인딩된 입력칸+스와치에 반영 + 라이브 패치(재생성 없음=번쩍임 없음)
    var hex=draw();
    if(cur.onCommit){ cur.onCommit(hex); return; }        // 효과 색: 콜백이 레이어·스와치·라이브패치 처리
    if(cur.input) cur.input.value=hex;
    if(cur.sw) cur.sw.style.background=hex;
    try{ liveAccent(); }catch(e){}
  }
  function fromHex(hex){ var rgb=hex2rgb(hex), hsv=rgb2hsv(rgb.r,rgb.g,rgb.b); cur.h=hsv.h; cur.s=hsv.s; cur.v=hsv.v; }
  function pos(e,el){ var r=el.getBoundingClientRect(); return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)), y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}; }
  function svAt(e){ var p=pos(e,svEl); cur.s=p.x; cur.v=1-p.y; commit(); }
  function hueAt(e){ var p=pos(e,hueEl); cur.h=p.x*360; commit(); }
  function drag(fn){ return function(e){ e.preventDefault(); fn(e); function mv(ev){ fn(ev); } function up(){ document.removeEventListener('pointermove',mv); document.removeEventListener('pointerup',up); } document.addEventListener('pointermove',mv); document.addEventListener('pointerup',up); }; }
  svEl.addEventListener('pointerdown', drag(svAt));
  hueEl.addEventListener('pointerdown', drag(hueAt));
  hexEl.addEventListener('input', function(){ var v=hexEl.value.trim(); if(v && v.charAt(0)!=='#')v='#'+v; if(/^#[0-9a-fA-F]{6}$/.test(v)){ fromHex(v); commit(); } });

  function open(sw){
    cur.sw=sw;
    if(sw.dataset.fxcolor!==undefined){                          // 효과 색 스와치(고정 입력 없음 → 콜백으로 레이어에 반영)
      cur.input=null; cur.onCommit=function(hex){ fxSetColor(sw, hex); };
      fromHex(sw.dataset.fxval || '#4bbad6');
    } else {                                                     // 대표색 등 고정 입력 바인딩
      var input=document.getElementById(sw.dataset.target); if(!input){ cur.sw=null; return; }
      cur.input=input; cur.onCommit=null; fromHex(swatchColor(sw.dataset.target));
    }
    draw(); pop.hidden=false;
    var r=sw.getBoundingClientRect(), top=r.bottom+6, left=Math.min(r.left, window.innerWidth-210);
    if(top+240>window.innerHeight) top=r.top-240;                 // 아래 공간 없으면 위로
    pop.style.top=Math.max(6,top)+'px'; pop.style.left=Math.max(6,left)+'px';
  }
  function close(){ pop.hidden=true; cur.input=null; cur.sw=null; cur.onCommit=null; }
  document.addEventListener('click', function(e){
    var sw=e.target.closest && e.target.closest('.cp-sw');
    if(sw){ e.preventDefault(); if(!pop.hidden && cur.sw===sw) close(); else open(sw); return; }
    if(!pop.hidden && !pop.contains(e.target)) close();
  });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !pop.hidden) close(); });
})();
$('#repaint').onclick = function(){ pvLastHTML = null; render(); };   // 강제 새로고침(내용 같아도 다시 그림)
// 효과·배치·목록 이미지는 트리거 버튼이 무대 아래(미리보기 iframe 안)로 옮겨가서, iframe이 parent.pvXxx()로
//   부르는 함수로 노출한다(세대 관리 ⚙메뉴 등과 같은 방식) — 패널 자체는 그대로 이 페이지(부모)에 있음.
// 세 패널(효과·목록 이미지·도구)이 전부 같은 자리(오른쪽 서랍)에 뜨므로, 하나를 열 때 나머지는 닫아
//   겹쳐 보이지 않게 한다(안 그러면 뒤에 열려있던 패널이 숨은 채로 남아있다가 다른 패널을 닫을 때 불쑥 드러남).
function toggleSidePanel(id){
  var p=$('#'+id), willOpen=p.hidden;
  ['fxPanel','lineupPanel','toolsPanel'].forEach(function(pid){ var el=$('#'+pid); if(el) el.hidden=true; });
  p.hidden=!willOpen;
}
window.pvFxPanelToggle = function(){ toggleSidePanel('fxPanel'); };
window.pvStagePanelToggle = function(){ var cb=$('#stageEdit'); cb.checked=!cb.checked; cb.dispatchEvent(new Event('change')); };
window.pvLineupPanelToggle = function(){ toggleSidePanel('lineupPanel'); };
$('#toolsPanelToggle').onclick = function(){ toggleSidePanel('toolsPanel'); };
$('#prevBarToggle').onclick = function(){
  var c=$('#prevBar').classList.toggle('collapsed');
  this.textContent = c?'▾':'▴'; this.title = c?'이 도구줄 펼치기':'이 도구줄 접기/펼치기';
};
// 서랍 안에서도 바로 닫을 수 있게 맨 위에 ✕ 전용 줄을 하나씩 붙임(셋 다 같은 모양이라 마크업 3번 반복 안 하고 여기서 한 번에).
//   내용 위에 겹쳐 띄우면 첫 줄 글이 잘려 보이므로, 콘텐츠 앞에 "줄"로 넣는다(겹침 아님, 새 줄).
['fxPanel','lineupPanel','toolsPanel'].forEach(function(id){
  var p=$('#'+id); if(!p) return;
  var head=document.createElement('div'); head.className='side-panel-head';
  var x=document.createElement('button'); x.type='button'; x.className='side-panel-close'; x.title='닫기'; x.textContent='✕';
  x.onclick=function(){ p.hidden=true; };
  head.appendChild(x);
  p.insertBefore(head, p.firstChild);
});
// 능력치 카드 자체를 껐다 켬(카드 삭제/추가) — 켜져 있으면 위 '＋텍스트'류 버튼들처럼 그림이 바뀌는 구조변경이라 render()로 다시 그림.
$('#statPanelToggle').onclick = function(){ var cb=$('#b_stat_on'); cb.checked=!cb.checked; render(); };
$('#idPanelToggle').onclick = function(){ var cb=$('#b_idcard_on'); cb.checked=!cb.checked; render(); };
$('#reset').onclick = function(){ if(confirm('입력한 내용을 모두 지울까요? (빈 상태로 돌아갑니다)')){ try{ localStorage.removeItem('tsPB'); }catch(e){} location.reload(); } };
$('#gen').onclick = showOut;
$('#loadBtn').onclick = function(){ loadFromText($('#loadSrc').value); };
$('#loadPickBtn').onclick = function(){ loadCharacter($('#loadPick').value); };
$('#loadPick').onchange = function(){ if(this.value) loadCharacter(this.value); };
// 불러오기 드롭다운을 실제 캐릭터 목록(characters.html 로스터)과 동기화 → 신규 캐릭터 자동 표시.
// 못 읽으면(오프라인 등) HTML에 박아둔 기본 목록을 그대로 둔다.
TOOL_ROSTER_READY = (function syncLoadList(){
  return fetch('../characters.html').then(function(r){ return r.ok ? r.text() : ''; }).then(function(html){
    // id·ko 는 값이 없으면 목록이 null(따옴표 없이)로 출력 → 그 캐릭터도 누락 없이 잡히게 "값" 또는 null 모두 허용.
    var re=/\{\s*k:\s*"([^"]+)"[^}]*?id:\s*(?:"([^"]*)"|null)[^}]*?ko:\s*(?:"([^"]*)"|null)[^}]*?ht:\s*(\d+)/g, m, items=[];
    while(m=re.exec(html)) items.push({ slug:m[1], id:m[2]||'', ko:m[3]||'', ht:+m[4] });   // ht = 키(cm) · 라인업 비교 라벨용
    if(!items.length){ buildLineupChips(); return; }
    TOOL_ROSTER = items.slice();                                        // 기록번호 자동/중복검사용 보관
    buildLineupChips();                                                 // 라인업 '옆에 세워 비교' 칩 채우기
    if(WAS_NEW && !$('#m_record').value.trim()){ setVal('#m_record', nextRecord()); render(); }   // 새 캐릭터면 다음 번호 자동
    items.sort(function(a,b){ return a.slug<b.slug?-1:(a.slug>b.slug?1:0); });   // 이름(slug) 순 정렬
    var sel=$('#loadPick'); if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="">기존 캐릭터 선택…</option>'+
      items.map(function(c){ return '<option value="'+esc(c.slug)+'">'+esc(c.slug)+(c.ko?' · '+c.ko:'')+'</option>'; }).join('');
    if(cur) sel.value=cur;
  }).catch(function(){ buildLineupChips(); });   // file:// 등 로드 실패 시 칩 영역에 안내
})();
$('#loadFile').onchange = function(){ var f=this.files[0]; if(!f) return; var rd=new FileReader();
  rd.onload=function(){ if(loadFromText(rd.result)) loadMsg('✓ '+f.name+' 불러옴 — 폼에서 편집하세요', true); }; rd.readAsText(f); };
// art·의상 이미지: 📁 로 로컬 파일 선택 → 파일명 입력 + 미리보기(blob). 실제 파일은 캐릭터 폴더에 저장 필요.
document.addEventListener('change', function(e){
  var fi=e.target; if(fi.type!=='file' || !fi.closest('.imgbtn')) return;
  var f=fi.files&&fi.files[0]; if(!f) return;
  var box=fi.closest('.imgcell'), txt=box&&box.querySelector('input:not([type=file])');
  if(!txt) return;
  txt.value=f.name;
  if(FILES[f.name]) URL.revokeObjectURL(FILES[f.name]);   // 같은 이름 재선택 시 이전 objectURL 해제(누수 방지)
  FILES[f.name]=URL.createObjectURL(f); FILEOBJ[f.name]=f; render();
});
$('#closeOut').onclick = function(){ $('#out').classList.remove('on'); };
$('#themeBtn').onclick = function(){
  THEME = (THEME==='dark'?'light':'dark');
  try{ localStorage.setItem('ts-theme', THEME); }catch(e){}   // 사이트와 같은 키에 저장 → 다음에 캐릭터 페이지 가도 그대로
  document.body.setAttribute('data-theme', THEME);            // 툴 본체 테마(즉시)
  // 미리보기는 재생성(render) 없이 iframe의 data-theme 만 바꿈 → 깜빡임 없음.
  // (라이트/다크 accent 는 이미 buildSrcdoc·profile.js 에 둘 다 심겨 있어 즉시 반영됨)
  PV.forEach(function(fr){ try{ var d=fr.contentDocument; if(d&&d.documentElement) d.documentElement.setAttribute('data-theme', THEME); }catch(e){} });
  syncColorPickers();
};
$('#copy').onclick = function(){
  var ta = $('#outCode'); ta.select();
  navigator.clipboard ? navigator.clipboard.writeText(ta.value) : document.execCommand('copy');
  this.textContent = '복사됨 ✓'; var b=this; setTimeout(function(){ b.textContent='복사'; }, 1200);
};
$('#download').onclick = function(){
  var blob = new Blob([$('#outCode').value], {type:'text/html'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'index.html'; a.click(); URL.revokeObjectURL(a.href);
};
// 파일 시스템 접근 API로 캐릭터 index.html에 직접 써넣기 → jekyll 자동 반영.
// 저장 폴더(src/characters) 핸들을 IndexedDB에 기억 → 세션이 바뀌어도 다시 안 고르게.
function idbKV(mode, fn){   // 아주 작은 IndexedDB 헬퍼(키-값 저장소 'kv' 하나)
  return new Promise(function(res){
    var op=indexedDB.open('tsPB',1);
    op.onupgradeneeded=function(){ op.result.createObjectStore('kv'); };
    op.onsuccess=function(){ fn(op.result.transaction('kv',mode).objectStore('kv'), res); };
    op.onerror=function(){ res(null); };
  });
}
function idbGet(key){ return idbKV('readonly', function(st,res){ var rq=st.get(key); rq.onsuccess=function(){res(rq.result||null);}; rq.onerror=function(){res(null);}; }); }
function idbSet(key,val){ return idbKV('readwrite', function(st,res){ st.put(val,key); st.transaction.oncomplete=function(){res(true);}; st.transaction.onerror=function(){res(false);}; }); }

// ★저장 폴더 = 프로젝트의 'src' 루트 하나만 한 번 선택 → 거기서 characters/ 와 assets/img/lineup/ 을 자동으로 찾아 저장.
//   (src 루트 핸들을 IndexedDB에 기억 → 다음 세션에도 다시 안 고르게)
var srcDir=null;
idbGet('srcDir').then(function(h){ if(h && !srcDir) srcDir=h; }).catch(function(){});

function saveMsg(t,ok){ var e=$('#saveMsg'); if(e){ e.textContent=t; e.style.color=(ok===false?'var(--warn)':ok?'var(--ok)':'var(--dim)'); } }
async function grantRW(handle){   // 폴더 쓰기 권한 확인/요청(요청은 클릭 제스처 안에서 이뤄져야 함)
  try{ var p={mode:'readwrite'};
    if((await handle.queryPermission(p))==='granted') return true;
    if((await handle.requestPermission(p))==='granted') return true;
  }catch(e){}
  return false;
}
async function subDir(parent, name){ return await parent.getDirectoryHandle(name, {create:true}); }   // 하위 폴더(없으면 생성)
// src 루트 폴더 확보. 기억된 게 있으면 권한만 확인, 없거나 재선택이면 고르기. 안전장치: 안에 characters 폴더가 있어야 함.
async function ensureSrcDir(repick){
  if(repick) srcDir=null;
  if(srcDir){ var ok=await grantRW(srcDir); if(!ok) srcDir=null; }
  if(!srcDir){
    saveMsg('저장 폴더로 프로젝트의 ‘src’ 폴더를 한 번만 선택하세요…');
    srcDir=await window.showDirectoryPicker({ id:'tsSrc', mode:'readwrite' });
    var okSrc=false; try{ await srcDir.getDirectoryHandle('characters'); okSrc=true; }catch(_){}   // src 안엔 characters 폴더가 있음
    if(!okSrc){
      if(!confirm('선택한 폴더 "'+srcDir.name+'" 안에 characters 폴더가 안 보여요.\n프로젝트의 src 폴더가 맞나요?\n\n확인 = 이대로 / 취소 = 다시 선택')){
        srcDir=null; saveMsg('취소됨 — 📁 로 src 폴더를 다시 선택하세요.', false); return null;
      }
    }
    idbSet('srcDir', srcDir);
  }
  return srcDir;
}
// 이 캐릭터가 쓰는 이미지 파일명 모음 — 모든 세대의 프레임·사원증·옷장 그림 + 서술카드 그림 블록.
// 사이트 저장(saveToSite)과 멤버 제출(submitToDiscord) 둘 다 이 함수 하나로 계산(단일 출처).
function collectUsedImages(){
  var used={};
  GENS.forEach(function(g){ var gd=GEN_FORMS[g.id]; if(!gd) return;
    [gd.art, gd.idimg].forEach(function(n){ if(n)used[n]=1; });
    (gd.wardrobe||[]).forEach(function(x){ if(x.img)used[x.img]=1; });
    (gd.proses||[]).forEach(function(p){ (p.blocks||[]).forEach(function(b){ if(b.type==='img' && b.img) used[b.img]=1; }); });
  });
  return used;
}

/* ============================================================
   멤버 제출 — 디스코드 웹훅으로 전송 (GitHub 계정·git 불필요)
   ------------------------------------------------------------
   저장소에 직접 쓰지 않고, 지금 작성한 코드+이미지를 디스코드 채널로 보낸다.
   관리자가 그 채널에서 확인한 뒤 실제 사이트에 반영(💾 저장 또는 커밋)한다.
   ★단일 출처: 채널을 옮기게 되면 이 URL 한 줄만 새 웹훅 URL로 바꾸면 됨.

   ★SUBMIT_PASSPHRASE = 멤버 5인에게만 알려주는 암호(스팸 방지용 — 진짜 보안은 아니고,
   저장소가 public이 됐을 때 소스만 보고 아무나 누르는 걸 막는 정도). 값을 바꾸면 예전에
   맞혀서 기억된 브라우저도 다시 물어봄. 여기 이 줄만 고치면 됨(단일 출처).
   ============================================================ */
var SUBMIT_WEBHOOK = 'https://discord.com/api/webhooks/1530868006555619358/31vxwdlUBa8cDLhf8t9fUn4_pEuP03ln5iqNMl-QAU6bXgZ6sPME3vageNCvpagl5xYS';
var SUBMIT_PASSPHRASE = '20200731';

async function submitToDiscord(){
  var btn=$('#submitDiscord');
  var slug=slugify($('#slug').value);
  if(slug!==$('#slug').value) $('#slug').value=slug;
  if(!slug){ saveMsg('먼저 위쪽 ‘폴더 이름’을 입력하세요 (영문 소문자·숫자·- 만)', false); return; }
  if(!$('#b_krname').value.trim() && !$('#b_enname').value.trim()){
    saveMsg('먼저 이름(한글 또는 영문)을 입력하세요', false); return;
  }
  await TOOL_ROSTER_READY;   // 목록 로딩이 안 끝난 채로 중복 검사를 하면 아직 빈 TOOL_ROSTER를 보고 통과시켜버림 → 항상 로딩 완료를 기다림
  var isExisting=TOOL_ROSTER.some(function(r){ return r.slug===slug; });
  if(isExisting && slug!==LOADED_SLUG){
    if(!confirm('폴더 이름 "'+slug+'" 은 이미 있는 캐릭터예요. 그래도 제출할까요?\n(관리자가 검토할 때 기존 캐릭터를 덮어쓸지 판단해요)')) return;
  }
  // 암호 확인 — 한 번 맞히면 이 브라우저엔 기억(매번 다시 안 물어봄)
  var savedPass=null; try{ savedPass=localStorage.getItem('tsPB-pass'); }catch(e){}
  if(savedPass!==SUBMIT_PASSPHRASE){
    var entered=prompt('제출 암호를 입력하세요 (힌트:한국문제사격수재단 설립 년월일(yyyymmdd))');
    if(entered===null) return;   // 취소
    if(entered.trim()!==SUBMIT_PASSPHRASE){ saveMsg('암호가 달라요 — 관리자에게 확인하세요', false); return; }
    try{ localStorage.setItem('tsPB-pass', SUBMIT_PASSPHRASE); }catch(e){}
  }
  var name=joinName($('#b_krname').value, $('#b_krsur').value) || slug;
  var who=$('#submitterName').value.trim();
  try{ localStorage.setItem('tsPB-nick', who); }catch(e){}   // 닉네임은 브라우저에 기억 — 다음에 또 입력 안 해도 되게

  btn.disabled=true; var oldLabel=btn.textContent; btn.textContent='전송 중…';
  saveMsg('디스코드로 보내는 중…');
  try{
    var st=collect();
    var used=collectUsedImages();
    if(Object.keys(used).length===0){
      if(!confirm('이미지가 하나도 없어요. 그래도 제출할까요?')){ btn.disabled=false; btn.textContent=oldLabel; saveMsg(''); return; }
    }
    var fd=new FormData();
    // 관리자가 파일을 안 열어봐도 채널에서 바로 훑어볼 수 있게 임베드로 정리(대표 일러 + 핵심 정보).
    // 대표 일러 = 대표 세대(MAIN_GEN)의 art. 실제로 첨부되는 파일일 때만 image를 건다(없으면 깨진 링크가 됨).
    var mainArt=(GEN_FORMS[MAIN_GEN]||{}).art||'';
    var colorHex=(st.accent||'#5ec8dd').replace('#','');
    var embed={
      title: (isExisting?'✏️ 프로필 수정 제출':'🆕 새 프로필 제출')+' — '+name,
      description: '`'+slug+'`',
      color: parseInt(colorHex,16)||0x5ec8dd,
      fields: [
        { name:'기록번호', value: $('#m_record').value.trim()||'—', inline:true },
        { name:'제출자',   value: who||'—', inline:true },
        { name:'제출 시각', value: new Date().toLocaleString('ko-KR'), inline:true }
      ]
    };
    if(mainArt && FILEOBJ[mainArt]) embed.image={ url:'attachment://'+mainArt };
    fd.append('payload_json', JSON.stringify({ embeds:[embed] }));
    fd.append('files[0]', new Blob([buildFile(st)], {type:'text/html'}), slug+'-index.html');

    var i=1;
    for(var nm in used){ if(FILEOBJ[nm]){ fd.append('files['+i+']', FILEOBJ[nm], nm); i++; } }
    if($('#lineupResize') && $('#lineupResize').checked && LINEUP.blob){
      fd.append('files['+i+']', LINEUP.blob, slug+'-lineup.png'); i++;
    }

    var res=await fetch(SUBMIT_WEBHOOK+'?wait=true', { method:'POST', body: fd });
    if(!res.ok) throw new Error('서버 응답 '+res.status);
    saveMsg('✓ 제출됐어요! 관리자가 확인한 뒤 사이트에 반영할 거예요.', true);
  }catch(e){
    saveMsg('제출 실패: '+e.message+' — 인터넷 연결을 확인하거나 관리자에게 알려주세요', false);
  }finally{
    btn.disabled=false; btn.textContent=oldLabel;
  }
}
$('#submitDiscord').onclick = submitToDiscord;
try{ var _nick=localStorage.getItem('tsPB-nick'); if(_nick) $('#submitterName').value=_nick; }catch(e){}

async function saveToSite(repick){
  var slug=slugify($('#slug').value);
  if(slug!==$('#slug').value) $('#slug').value=slug;   // 폼에도 정리된 폴더명 반영
  if(!slug){ saveMsg('먼저 위쪽 ‘폴더 이름’을 입력하세요 (영문 소문자·숫자·- 만)', false); return; }
  await TOOL_ROSTER_READY;   // 목록 로딩이 안 끝난 채로 중복 검사를 하면 아직 빈 TOOL_ROSTER를 보고 통과시켜버림 → 항상 로딩 완료를 기다림
  // 기록번호(M-XX) 확인: 비었거나 다른 캐릭터와 겹치면 경고
  var recVal=$('#m_record').value.trim();
  if(!recVal){ if(!confirm('기록번호(예: M-07)가 비어 있어요. 그래도 저장할까요?\n(비우면 목록 정렬이 꼬일 수 있어요)')) return; }
  else if(TOOL_ROSTER.some(function(r){ return r.id===recVal && r.slug!==slug; })){
    if(!confirm('기록번호 '+recVal+' 는 이미 다른 캐릭터가 쓰고 있어요. 그래도 저장할까요?')) return;
  }
  if(!window.showDirectoryPicker){ saveMsg('이 브라우저는 폴더 저장 미지원 — 복사/다운로드를 쓰세요', false); return; }
  try{
    // 1) src 루트 확보 → characters 폴더
    if(!(await ensureSrcDir(repick))) return;
    var charsDir=await subDir(srcDir, 'characters');
    // 2) index.html + 이미지 쓰기
    var st=collect();
    if(slug!==LOADED_SLUG){   // 다른 캐릭터 실수 덮어쓰기 방지(불러온 그 캐릭터 재저장은 제외)
      var exists=false; try{ await charsDir.getDirectoryHandle(slug); exists=true; }catch(_e){}
      if(exists && !confirm('이미 있는 캐릭터 “'+slug+'” 을(를) 덮어씁니다. 계속할까요?')) return;
    }
    var charDir=await subDir(charsDir, slug);
    var fh=await charDir.getFileHandle('index.html', {create:true});
    var w=await fh.createWritable(); await w.write(buildFile(st)); await w.close();
    // 이 캐릭터가 쓰는 이미지(로컬 선택분만 실제로 써넣음) — 목록 계산은 collectUsedImages()(단일 출처, 제출 기능과 공유)
    var used=collectUsedImages();
    var n=0;
    for(var nm in used){ if(FILEOBJ[nm]){ try{ var ih=await charDir.getFileHandle(nm,{create:true}); var iw=await ih.createWritable(); await iw.write(FILEOBJ[nm]); await iw.close(); n++; }catch(_){} } }
    // 3) 키 비교 라인업 PNG → assets/img/lineup/<슬러그>.png. 켜져 있으면 저장, 꺼져 있으면 기존 것 제거(목록은 옷장 main 그림으로 폴백).
    var lineupSaved=false, resizeOn=$('#lineupResize') && $('#lineupResize').checked;
    var lineupPending=resizeOn && !LINEUP.blob;   // 키 비교 켰는데 정규화가 아직 안 끝남 → 저장 못 함(경고)
    try{ var ldir=await subDir(await subDir(await subDir(srcDir,'assets'),'img'),'lineup');
      if(resizeOn && LINEUP.blob){
        var lfh=await ldir.getFileHandle(slug+'.png', {create:true});
        var lw=await lfh.createWritable(); await lw.write(LINEUP.blob); await lw.close(); lineupSaved=true;
      } else if(!resizeOn){ try{ await ldir.removeEntry(slug+'.png'); }catch(_r){} }   // 리사이즈 껐으면 기존 키비교 이미지 제거
    }catch(_l){}
    // 4) 저장 완료 안내 + 그 캐릭터 페이지 바로 열기 링크
    var e=$('#saveMsg'); if(e){ e.style.color='var(--ok)';
      var isNewChar=!TOOL_ROSTER.some(function(r){ return r.slug===slug; });   // 이번에 처음 만든 캐릭터?
      e.innerHTML='✓ 저장됨 · <a href="../characters/'+encodeURIComponent(slug)+'/" target="_blank" rel="noopener" style="color:var(--acc)">그 페이지 열기 ↗</a>'+
        (n?' <span style="color:var(--dim)">(이미지 '+n+'개)</span>':'')+
        (lineupSaved?' <span style="color:var(--dim)">(키 비교 라인업 저장됨)</span>':'')+
        (lineupPending?' <br><span style="color:var(--warn)">⚠ 키 비교 이미지는 아직 준비 중이라 저장 안 됨 — 미리보기가 뜬 뒤 다시 저장하세요</span>':'')+
        (isNewChar && !lineupSaved && !lineupPending?' <br><span style="color:var(--dim)">· 목록엔 옷장 main 그림이 그대로 나옵니다(키 비교하려면 <b>목록 이미지</b>에서 켜기)</span>':''); }
  }catch(e){ if(e.name!=='AbortError') saveMsg('저장 실패: '+e.message, false); }
}
$('#savefile').onclick = function(){ saveToSite(false); };
$('#filepick').onclick = function(){ saveToSite(true); };

/* ============================================================
   목록 라인업 이미지 — 업로드 → 키 비례 자동 정규화 (tools/build-lineup.py 의 브라우저판)
   ------------------------------------------------------------
   하는 일: 배경 투명한 전신 PNG를 받아, 캐릭터 ‘키(cm)’에 비례해 크기를 맞추고
            발을 공통 바닥선에 세운 PNG(577×1080)를 만든다 → 기존 6명과 정렬이 맞음.
   ★상수의 단일 출처 = /assets/lineup-constants.json (tools/build-lineup.py 와 공유).
     아래 숫자는 그 JSON을 못 읽을 때만 쓰는 비상 기본값이니, 값을 바꾸려면 JSON을 고칠 것.
   ============================================================ */
var LINEUP = {
  // ↓ 비상 기본값(진짜 수정은 /assets/lineup-constants.json 에서). loadLineupConst()가 덮어씀.
  CANVAS_W: 577,    // 출력 폭(px) — 기존 6명 라인업과 같아야 정렬됨
  OUT_H:    1080,   // 출력 높이(px)
  FLOOR_GAP: 44,    // 캔버스 바닥에서 발까지 여백(px) = 공통 바닥선
  MAX_SIL:  980,    // 가장 큰 키(195cm)일 때 실루엣 높이(px)
  TALLEST:  195,    // 기준 최대 키(cm) — 현재 최장신(셀루카)
  blob: null,       // 정규화 결과 PNG(Blob) — '키 비교' 켰을 때만 생성·저장
  url:  null,       // 미리보기용 objectURL
  key:  null        // 마지막 정규화 기준(옷장main이미지명|키) — 안 바뀌면 재생성 건너뜀
};
// 상수 단일 출처: JSON을 읽어 위 기본값을 덮어씀 → JSON 한 곳만 고치면 py·툴 양쪽 반영.
// (fetch 실패 시엔 위 기본값 그대로 사용해서 툴이 멈추지 않음. 기본값은 JSON과 같게 유지할 것.)
(function loadLineupConst(){
  fetch('../assets/lineup-constants.json').then(function(r){ return r.ok ? r.json() : null; }).then(function(c){
    if(!c) return;
    ['CANVAS_W','OUT_H','FLOOR_GAP','MAX_SIL','TALLEST'].forEach(function(k){
      if(typeof c[k]==='number') LINEUP[k]=c[k];
    });
  }).catch(function(){});
})();
function lineupMsg(t, ok){ var e=$('#lineupMsg'); if(e){ e.textContent=t; e.style.color=(ok===false?'var(--warn)':ok?'var(--ok)':'var(--dim)'); } }
// 업로드한 라인업 비우기 — 다른 캐릭터를 불러오면 초기화(이전 캐릭터 라인업이 엉뚱하게 저장되는 것 방지)
function resetLineup(){
  if(typeof LINEUP==='undefined' || !LINEUP) return;
  if(LINEUP.url) URL.revokeObjectURL(LINEUP.url);
  LINEUP.blob=null; LINEUP.url=null; LINEUP.key=null;
  if(typeof lineupMsg==='function') lineupMsg('');
  if(typeof showLineupPreview==='function') showLineupPreview();
}

// 전신 PNG → 키 정규화 캔버스. 실패 시 null.
function normalizeLineup(imgEl, heightCm){
  var w=imgEl.naturalWidth, h=imgEl.naturalHeight;
  if(!w || !h) return null;
  // 1) 실루엣(그림이 있는 영역=발~머리) 찾기: 알파값이 있는 픽셀의 최소/최대 좌표
  var scan=document.createElement('canvas'); scan.width=w; scan.height=h;
  var sx=scan.getContext('2d'); sx.drawImage(imgEl,0,0);
  var data; try{ data=sx.getImageData(0,0,w,h).data; }catch(e){ return null; }
  var minX=w, minY=h, maxX=-1, maxY=-1;
  for(var y=0;y<h;y++){ for(var x=0;x<w;x++){
    if(data[(y*w+x)*4+3] > 10){   // 알파 > 10 = 그림이 있는 픽셀(투명 배경 제외)
      if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
    }
  }}
  if(maxX<0) return null;   // 전부 투명 = 그림 없음
  var bw=maxX-minX+1, bh=maxY-minY+1;
  // 2) 실제 키에 비례한 실루엣 높이 → 확대/축소 비율
  var silH  = LINEUP.MAX_SIL * heightCm / LINEUP.TALLEST;
  var scale = silH / bh;
  var nw=Math.max(1,Math.round(bw*scale)), nh=Math.max(1,Math.round(bh*scale));
  // 3) 공통 캔버스에 발을 바닥선에 맞춰 가운데 배치(크롭+리사이즈+배치를 drawImage 한 번에)
  var out=document.createElement('canvas'); out.width=LINEUP.CANVAS_W; out.height=LINEUP.OUT_H;
  var ox=out.getContext('2d'); ox.imageSmoothingEnabled=true; ox.imageSmoothingQuality='high';
  var dx=Math.round((LINEUP.CANVAS_W-nw)/2), dy=LINEUP.OUT_H-LINEUP.FLOOR_GAP-nh;
  ox.drawImage(imgEl, minX,minY,bw,bh, dx,dy,nw,nh);
  return out;
}
var LINEUP_CMP = {};       // 옆에 세워 비교할 캐릭터 slug 집합 (slug -> true)
// 목록 이미지 = 대표 세대의 옷장 main 그림(따로 안 받음). 키 비교 리사이즈는 이 그림을 대표세대 키로 정규화.
function lineupCm(){ return parseFloat((GEN_FORMS[MAIN_GEN]||{}).height)||0; }
function mainWardName(){ var mg=GEN_FORMS[MAIN_GEN]||{}; return ((mg.wardrobe||[]).filter(function(w){return w.on;})[0]||{}).img||''; }
function loadMainImg(cb){   // 옷장 main 그림을 Image 로 로드 — 로컬 업로드분은 FILEOBJ, 없으면 디스크(jekyll)에서
  var name=mainWardName(); if(!name){ cb(null); return; }
  var img=new Image(), isBlob=!!FILEOBJ[name];
  function done(res){ if(isBlob){ try{ URL.revokeObjectURL(img.src); }catch(e){} } cb(res); }   // blob URL 누수 방지(로드 끝나면 해제)
  img.onload=function(){ done(img); }; img.onerror=function(){ done(null); };
  if(isBlob) img.src=URL.createObjectURL(FILEOBJ[name]);
  else img.src='../characters/'+encodeURIComponent($('#slug').value.trim())+'/'+encodeURIComponent(name);
}

// 키(cm) → 스테이지에서 머리끝 높이(바닥부터 %). 그리드·이름표 위치 계산에 공통 사용.
function headPct(cm){ return (LINEUP.FLOOR_GAP + LINEUP.MAX_SIL*cm/LINEUP.TALLEST)/LINEUP.OUT_H*100; }
// 기록번호(M-01, M-02 …) 숫자 → 캐릭터 목록의 표준 순서(칩·비교 배치 정렬용). characters.html 정렬과 동일.
function recNum(r){ var m=String(r.id||'').match(/(\d+)/); return m?+m[1]:9999; }
function byRecord(a,b){ return recNum(a)-recNum(b); }
// 스테이지에 인물 배치: 새 캐릭터는 항상 중앙(50%), 비교 실루엣은 좌우 대칭으로.
// 인원이 많으면 간격(step)을 자동으로 좁혀 22~78% 안에 유지 → 화면 밖으로 안 나감(겹침 허용).
// 이름표(키 포함)는 각 인물 '머리 높이'에 둠 → 실루엣이 겹쳐도 세로로 흩어져 읽기 쉬움.
function renderLineupFigures(){
  var row=$('#lineupRow'); if(!row) return;
  var cmp=TOOL_ROSTER.filter(function(c){ return LINEUP_CMP[c.slug]; }).sort(byRecord);
  var maxSlot=Math.ceil(cmp.length/2);
  var step=maxSlot ? Math.min(20, 28/maxSlot) : 20;   // 바깥쪽이 22~78%를 넘지 않도록
  function nameTag(text, cm){
    var b = cm>0 ? ' style="bottom:'+Math.min(headPct(cm),93).toFixed(1)+'%"' : '';   // 머리 높이(너무 높으면 93%로 제한)
    return '<b class="lp-name"'+b+'>'+text+'</b>';
  }
  var html='';
  cmp.forEach(function(c,i){                            // 비교 실루엣: 슬롯 +1,-1,+2,-2,… (중앙 좌우 번갈아)
    var slot=Math.floor(i/2)+1; if(i%2===1) slot=-slot;
    var left=(50+slot*step).toFixed(1);
    html+='<div class="lp-fig cmp" style="left:'+left+'%;z-index:1"><img src="../assets/img/lineup/'+esc(c.slug)+'.png" alt="">'+
      nameTag(esc(c.ko||c.slug)+(c.ht?' ('+c.ht+'cm)':''), c.ht)+'</div>';
  });
  if(LINEUP.url){                                       // 내 캐릭터(옷장 main 정규화): 항상 중앙·맨 앞·원색
    var myName=($('#b_krname').value||$('#b_enname').value||'새 캐릭터').trim();
    var myHv=lineupCm();
    html+='<div class="lp-fig me" style="left:50%;z-index:5"><img src="'+LINEUP.url+'" alt="">'+
      nameTag(esc(myName)+(myHv?' ('+myHv+'cm)':''), myHv)+'</div>';
  }
  row.innerHTML=html;
}
// 키 눈금: cm 위치를 LINEUP 상수로 계산 → 가로선 (캔버스 바닥부터의 비율 = 스테이지에서의 위치)
function buildLineupGrid(){
  var host=$('#lineupGrid'); if(!host) return;
  var marks=[]; for(var cm=60; cm<=200; cm+=10) marks.push(cm);   // 60~200cm 눈금(10cm 간격)
  host.innerHTML=marks.map(function(cm){
    return '<div class="lp-grid" style="bottom:'+headPct(cm).toFixed(2)+'%"><b>'+cm+'</b></div>';
  }).join('');
}
// 비교 캐릭터 고르는 칩 — TOOL_ROSTER(현재 목록) 로드된 뒤 채워짐
function buildLineupChips(){
  var host=$('#lineupChips'); if(!host) return;
  if(!TOOL_ROSTER.length){ host.innerHTML='<span class="note" style="margin:0">목록을 못 불러왔어요 (jekyll 서버로 열면 나와요)</span>'; return; }
  host.innerHTML=TOOL_ROSTER.slice().sort(byRecord).map(function(c){
    return '<button type="button" class="lp-chip'+(LINEUP_CMP[c.slug]?' on':'')+'" data-slug="'+esc(c.slug)+'">'+esc(c.ko||c.slug)+'</button>';
  }).join('');
}
$('#lineupChips').addEventListener('click', function(e){
  var b=e.target.closest('.lp-chip'); if(!b) return;
  var s=b.getAttribute('data-slug');
  if(LINEUP_CMP[s]) delete LINEUP_CMP[s]; else LINEUP_CMP[s]=true;
  b.classList.toggle('on'); showLineupPreview();
});
// 스테이지 표시 여부 + 내용 갱신 (올린 그림·비교 캐릭터·키 눈금 중 하나라도 있으면 보여줌)
function showLineupPreview(){
  var gridOn=$('#lineupGridOn').checked;
  var has = !!LINEUP.url || Object.keys(LINEUP_CMP).length>0 || gridOn;   // 눈금만 켜도 표시(빈 눈금자)
  $('#lineupStage').style.display = has?'block':'none';
  $('#lineupEmpty').style.display = has?'none':'flex';
  if(has){ buildLineupGrid(); renderLineupFigures(); }
}
// 옷장 main 그림을 대표세대 키로 정규화 → 라인업 PNG. '키 비교' 켰을 때만.
var lineupToken=0;
function clearLineupBlob(){ if(LINEUP.url){ URL.revokeObjectURL(LINEUP.url); LINEUP.url=null; } LINEUP.blob=null; LINEUP.key=null; }
function regenLineup(){
  if(typeof LINEUP==='undefined' || !LINEUP) return;                     // 초기 boot 때 LINEUP 정의 전 호출 대비
  var on=$('#lineupResize') && $('#lineupResize').checked;
  if(!on){ clearLineupBlob(); if(typeof showLineupPreview==='function') showLineupPreview(); return; }   // 리사이즈 꺼짐 → 라인업 PNG 안 만듦(목록은 옷장 main 그대로)
  var name=mainWardName(), cm=lineupCm();
  if(!name || !cm){ clearLineupBlob(); lineupMsg(!name?'옷장 main 의상 그림을 먼저 넣으세요.':'신원의 키(cm)를 입력하세요.', false); showLineupPreview(); return; }
  var key=name+'|'+cm;
  if(key===LINEUP.key && LINEUP.blob){ showLineupPreview(); return; }     // 안 바뀌었으면 재생성 생략(무거운 픽셀 스캔 회피)
  var my=++lineupToken;
  loadMainImg(function(img){
    if(my!==lineupToken) return;                                         // 그새 또 바뀌면 이 결과는 버림(경쟁 방지)
    if(!img){ lineupMsg('옷장 main 그림을 불러오지 못했어요.', false); return; }
    var canvas=normalizeLineup(img, cm);
    if(!canvas){ lineupMsg('그림(실루엣)을 찾지 못했어요 — 배경이 투명한 전신인지 확인하세요.', false); return; }
    canvas.toBlob(function(blob){
      if(my!==lineupToken) return;
      if(LINEUP.url) URL.revokeObjectURL(LINEUP.url);
      LINEUP.blob=blob; LINEUP.url=URL.createObjectURL(blob); LINEUP.key=key;
      lineupMsg('✓ 키 '+cm+'cm 기준으로 정렬됨.', true);
      showLineupPreview();
    }, 'image/png');
  });
}
// 세대 전환/대표 변경 시 라인업 갱신(키·옷장 main = 대표 세대 것)
function syncLineupHeight(){ regenLineup(); }
// 신원 키(cm)를 바꾸면(대표 세대일 때) 라인업도 다시 정렬. change=칸에서 벗어날 때(타이핑마다 픽셀스캔 방지).
$('#bi_height').addEventListener('change', function(){ if(CUR_GEN===MAIN_GEN) regenLineup(); });

// '목록에서 키 비교' 체크박스 — 켜면 리사이즈 박스(미리보기) 표시 + 정규화, 끄면 접힘.
function toggleResizeBox(){ var b=$('#lineupResize'); if(b) $('#lineupResizeBox').style.display=b.checked?'':'none'; }
$('#lineupResize').onchange=function(){ toggleResizeBox(); regenLineup(); };
$('#lineupGridOn').onchange = function(){ $('#lineupStage').classList.toggle('no-grid', !this.checked); showLineupPreview(); };
$('#lineupStage').classList.toggle('no-grid', !$('#lineupGridOn').checked);
buildLineupGrid();
toggleResizeBox();     // 시작 = '키 비교' 꺼짐 → 리사이즈 박스 접힘
showLineupPreview();

// 이미 저장된 키비교 라인업 PNG 가 있으면 '키 비교' 체크를 켜서 유지(파일 존재로 판단)
function probeLineup(slug){
  var box=$('#lineupResize'); if(!box) return;
  if(!slug){ box.checked=false; toggleResizeBox(); return; }
  var img=new Image();
  img.onload=function(){ box.checked=true; toggleResizeBox(); regenLineup(); };
  img.onerror=function(){ box.checked=false; toggleResizeBox(); };
  img.src='../assets/img/lineup/'+encodeURIComponent(slug)+'.png?'+Date.now();
}

render();
