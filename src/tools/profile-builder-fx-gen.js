"use strict";
// ============================================================
//  프로필 작성 툴 — 무대 효과 레이어 편집기(앞/뒤 2컬럼) + 세대 탭바 + collect()
//  ------------------------------------------------------------
//  collect()/buildFullBody()/rosterOf() — 폼 전체를 한 번에 상태 객체로
//  모으는 함수도 이 파일에 있음(저장·내보내기·미리보기가 전부 이 상태를 씀).
//  ------------------------------------------------------------
//  · 효과 목록의 정식 출처 = stage-fx.js 의 TSFX.effects()/presets().
//  · 편집 상태(레이어 배열)는 숨은 #genEffect 에 YAML-flow 문자열로 보관 →
//    readGen/build/저장 파이프라인은 예전 그대로 이 문자열만 읽음.
//  · 레이어 = {fx, place('back'=캐릭터뒤 | 'front'=캐릭터앞), colorDark, colorLight(각각 null=그 테마색 따라감 / hex=직접, 서로 독립)}.
//  · 배열은 '뒤 먼저 → 앞' 그룹 순서로 보관 → 각 컬럼 안에서 배열순서=위아래.
// ============================================================
function fxTSFX(){ return window.TSFX || null; }                          // 부모창에 로드된 컨트롤러(단일 출처)
function fxCatalog(){ var T=fxTSFX();                                     // TSFX 없으면(서버 없이 열림) 빈 목록
  return (T && T.effects) ? { effects:T.effects(), presets:(T.presets?T.presets():[]) } : { effects:[], presets:[] }; }
function fxLabel(id){ var e=fxCatalog().effects.filter(function(x){return x.id===id;})[0]; return e?e.label:id; }
function fxIsTakeover(id){ var e=fxCatalog().effects.filter(function(x){return x.id===id;})[0]; return !!(e&&e.kind==='takeover'); }  // 화면 장악=항상 앞 고정
// 문자열(YAML-flow) → 레이어 배열 [{fx,place,color,off,origin}] (프리셋·옛 포맷은 TSFX.normalize 가 펼침)
function fxParse(str){ var arr=parseEffectField(str), T=fxTSFX();
  var out = (T && T.normalize) ? T.normalize(arr)
          : arr.map(function(e){ return (e&&typeof e==='object') ? e : {fx:e,place:'back'}; }).filter(function(l){return l.fx;});
  return out.map(function(l){ return { fx:l.fx, place:(l.place==='front'?'front':'back'),
    // ★색은 다크/라이트 각자 필드. 옛 데이터(색 하나만 있던 시절의 l.color)는 두 테마 모두의 초기값으로 씀(호환).
    colorDark:  (l.colorDark  != null) ? l.colorDark  : (l.color || null),
    colorLight: (l.colorLight != null) ? l.colorLight : (l.color || null),
    off:!!l.off, origin:l.origin||null }; }); }
// 레이어 배열 → 문자열(명시적 {fx,place} + 있을 때만 colorDark·colorLight·off·origin)
function fxSerialize(layers){ return (layers||[]).map(function(l){
  var p = ['fx: '+q(l.fx), 'place: '+q(l.place)];
  if(l.colorDark)  p.push('colorDark: '+q(l.colorDark));
  if(l.colorLight) p.push('colorLight: '+q(l.colorLight));
  if(l.off) p.push('off: true');
  if(l.origin) p.push('origin: '+q(l.origin));   // 세트 조각의 원래 설계 위치(표시용)
  return '{ '+p.join(', ')+' }';
}).join(', '); }
function fxCommit(layers){ var h=$('#genEffect'); if(h) h.value=fxSerialize(layers); }   // 숨은 필드에 반영
function fxCurrent(){ return fxParse($('#genEffect').value); }                            // 숨은 필드에서 역파싱
// 항상 '뒤 → 앞' 그룹 순서로 정렬(컬럼 안 순서는 유지) → 인덱스와 화면 일치
function fxGroup(ls){ ls=ls||[]; return ls.filter(function(l){return l.place!=='front';}).concat(ls.filter(function(l){return l.place==='front';})); }
// 레이어 한 줄 HTML: 이름 + 순서/이동/삭제 + 상시·순간 + 색
function fxRowHTML(L, i, isFirst, isLast){
  var on=!L.off, tk=fxIsTakeover(L.fx);
  var themeD=!L.colorDark,  colD=L.colorDark ||'#4bbad6';    // 다크 테마 : 체크=테마색 따라감 / 해제=아래 스와치 색
  var themeL=!L.colorLight, colL=L.colorLight||'#4bbad6';    // 라이트 테마 : 다크와 별개로 독립 설정
  return '<div class="fxrow'+(on?'':' off')+'" data-i="'+i+'">'+
    '<div class="fx-top-row">'+
      (tk?'<span class="fx-grip lock" title="화면 장악 효과는 항상 앞">🔒</span>':'<span class="fx-grip" draggable="true" title="드래그해서 순서 변경">⠿</span>')+
      '<label class="fx-sw" title="효과 켜기/끄기"><input type="checkbox" class="fx-on" data-act="onoff"'+(on?' checked':'')+'><span class="fx-sw-t"></span></label>'+
      (L.origin ? '<span class="fx-origin'+(L.place!==L.origin?' moved':'')+'" title="세트 설계상 원래 위치'+(L.place!==L.origin?' (지금은 옮겨짐)':'')+'">원래 '+(L.origin==='front'?'앞':'뒤')+'</span>' : '')+   // 세트 조각의 설계 위치(옮기면 강조)
    '</div>'+
    '<div class="fx-nm" title="'+esc(fxLabel(L.fx))+(tk?' · 항상 앞':'')+'">'+esc(fxLabel(L.fx))+'</div>'+
    '<div class="fxrow-ctl">'+
      '<button type="button" class="fx-mv" data-act="up"'+(isFirst?' disabled':'')+' title="위로">↑</button>'+
      '<button type="button" class="fx-mv" data-act="down"'+(isLast?' disabled':'')+' title="아래로">↓</button>'+
      (tk?'':'<button type="button" class="fx-mv" data-act="swap" title="'+(L.place==='front'?'뒤로 보내기':'앞으로 보내기')+'">⇄</button>')+
      '<button type="button" class="fx-mv del" data-act="del" title="삭제">✕</button>'+
    '</div>'+
    '<div class="fxrow-ctl fxrow-color">'+
      '<label class="fx-mini" title="다크 테마에서 볼 때 이 효과 색"><input type="checkbox" class="fx-theme" data-act="themeDark"'+(themeD?' checked':'')+'> 다크 테마색</label>'+
      '<button type="button" class="cp-sw fx-cval" data-fxcolor data-theme="dark" data-fxval="'+colD+'" title="다크 테마 색 (클릭해서 고르기)"'+(themeD?' hidden':'')+' style="background:'+colD+'"></button>'+
      '<span class="fx-gap"></span>'+
      '<label class="fx-mini" title="라이트 테마에서 볼 때 이 효과 색"><input type="checkbox" class="fx-theme" data-act="themeLight"'+(themeL?' checked':'')+'> 라이트 테마색</label>'+
      '<button type="button" class="cp-sw fx-cval" data-fxcolor data-theme="light" data-fxval="'+colL+'" title="라이트 테마 색 (클릭해서 고르기)"'+(themeL?' hidden':'')+' style="background:'+colL+'"></button>'+
    '</div>'+
  '</div>';
}
// 두 컬럼(뒤/앞)에 렌더 (+ 숨은 필드 동기화)
function renderFxLayers(layers){
  (layers||[]).forEach(function(l){ if(fxIsTakeover(l.fx)) l.place='front'; });   // 화면 장악은 뒤로 못 감 = 항상 앞으로 강제(드래그·스왑 후에도 보장)
  layers=fxGroup(layers||[]); fxCommit(layers);
  var backEl=$('#fxColBack'), frontEl=$('#fxColFront'); if(!backEl||!frontEl) return;
  var back=[], front=[];
  layers.forEach(function(L,i){ (L.place==='front'?front:back).push({L:L,i:i}); });
  function draw(items){ return items.map(function(o,k){ return fxRowHTML(o.L, o.i, k===0, k===items.length-1); }).join(''); }
  backEl.innerHTML=draw(back); frontEl.innerHTML=draw(front);
}
// ── 효과 고르기 갤러리(움직이는 미리보기) ──────────────────
//  타일 목록·미리보기 모두 부모창 TSFX(단일 출처)로 생성 → 새 효과 추가하면 여기 자동 등장.
//  각 타일 = 실제 stage-fx `mount().set()` 을 그대로 재사용해 효과를 살아 움직이게 그림.
function fxgTile(add, label, badge){                              // 타일 1개(움직이는 미리보기 자리 + 라벨)
  return '<button type="button" class="fxg-tile" data-add="'+esc(add)+'"><span class="fxg-stage"></span>'+
         '<span class="fxg-lb">'+esc(label)+(badge||'')+'</span></button>'; }
function fxgSec(title, note){ return '<div class="fxg-sec">'+esc(title)+(note?' <span>'+esc(note)+'</span>':'')+'</div>'; }
function buildFxGallery(){                                        // 타일 목록 생성 — kind(단일 출처)로 3분류: 효과 / 화면 장악 / 세트
  var grid=$('#fxgGrid'); if(!grid) return; var c=fxCatalog();
  document.querySelectorAll('.fx-add-btn').forEach(function(b){ b.disabled=!c.effects.length; });
  if(!c.effects.length){ grid.innerHTML='<div class="note" style="grid-column:1/-1;padding:8px">서버(jekyll serve)로 열어야 효과 미리보기가 나옵니다.</div>'; return; }
  // 세트에 들어있는 효과(예: 디코드·균열임팩트·균열잔금)는 낱개 목록에서 숨김 → 세트에서만 추가(단일 출처=PRESETS).
  var inSet={}; (c.presets||[]).forEach(function(p){ (p.layers||[]).forEach(function(l){ inSet[l.fx]=1; }); });
  var layer=c.effects.filter(function(e){return e.kind!=='takeover' && !inSet[e.id];});   // 일반(앞/뒤 자유)
  var takeover=c.effects.filter(function(e){return e.kind==='takeover';});                // 화면 장악(항상 앞)
  var h=fxgSec('효과','· 앞/뒤 자유');
  h+=layer.map(function(e){ return fxgTile('fx:'+e.id, e.label); }).join('');
  if(takeover.length){ h+=fxgSec('화면 장악','· 화면 전체를 덮음 · 항상 앞');
    h+=takeover.map(function(e){ return fxgTile('fx:'+e.id, e.label); }).join(''); }
  if(c.presets && c.presets.length){ h+=fxgSec('세트','· 앞뒤 자동 배치');
    h+=c.presets.map(function(p){ return fxgTile('preset:'+p.id, p.label, '<b class="fxg-set">세트</b>'); }).join(''); }
  grid.innerHTML=h;
}
// 타일 하나에 그릴 레이어 스택. 낱개는 효과 기본 위치(place)로, 프리셋은 자기 앞뒤 그대로. 미리보기 색=현재 대표색.
//  ※ 낱개엔 place 를 반드시 넣는다 — 안 넣으면 이름이 프리셋과 같은 효과(crack·decode)가 normalize에서 세트로 펼쳐져 미리보기가 겹침.
function fxgLayersFor(spec, color){ var T=fxTSFX();
  if(spec.indexOf('preset:')===0){ var pl=(T&&T.expand)?T.expand(spec.slice(7)):[];
    return (pl||[]).map(function(l){ return {fx:l.fx, place:l.place, color:color}; }); }
  var id=spec.slice(3), e=fxCatalog().effects.filter(function(x){return x.id===id;})[0];
  return [{ fx:id, place:(e&&e.place)||'back', color:color }]; }
var fxgMounts=[], fxgPlace='back';
function fxgStopTiles(){ fxgMounts.forEach(function(m){ try{ m.stop(); }catch(e){} }); fxgMounts=[]; }
var FXG_STAGE_W=460;   // 실제 무대 폭(profile.css --F). 이 크기로 그린 뒤 타일에 맞춰 축소.
function fxgMountTiles(){ fxgStopTiles(); var T=fxTSFX(); if(!T||!T.mount) return;
  var acc=($('#accent')&&$('#accent').value.trim())||'#4bbad6';   // 미리보기를 현재 캐릭터 색으로
  document.querySelectorAll('#fxgGrid .fxg-tile').forEach(function(tile){
    var stage=tile.querySelector('.fxg-stage'); if(!stage) return;
    stage.innerHTML='';                                            // 재오픈 시 이전 스케일러 제거
    var sc=document.createElement('div'); sc.className='fxg-scaler';
    sc.style.transform='scale('+((stage.clientWidth||90)/FXG_STAGE_W)+')';   // 460 → 타일폭으로 축소
    stage.appendChild(sc);
    var m=T.mount(sc); m.set(fxgLayersFor(tile.getAttribute('data-add'), acc)); fxgMounts.push(m); }); }
function openFxGallery(place){ fxgPlace=(place==='front')?'front':'back';
  var ov=$('#fxGallery'); if(!ov) return;
  var w=$('#fxgWhere'); if(w) w.textContent=(fxgPlace==='front'?'앞(캐릭터 앞)':'뒤(캐릭터 뒤)');
  ov.hidden=false;
  fxgMountTiles(); }        // 바로 mount — clientWidth 읽기가 레이아웃을 강제하므로 크기 정상(rAF는 백그라운드 탭에서 안 돌아 초기 렌더 누락됨)
function closeFxGallery(){ var ov=$('#fxGallery'); if(ov) ov.hidden=true; fxgStopTiles(); }
// 타일 클릭 = 추가. 낱개=연 컬럼(place)에 · 세트=설계된 앞/뒤 그대로(자동) · 화면 장악=항상 앞(색은 기본=다크/라이트 둘 다 테마색 null).
function fxgPick(spec){ var layers=fxCurrent(), T=fxTSFX();
  if(spec.indexOf('preset:')===0){ var pl=(T&&T.expand)?T.expand(spec.slice(7)):[];   // 세트 = 앞뒤 자동 배치(어느 컬럼에서 눌러도)
    (pl||[]).forEach(function(l){ layers.push({fx:l.fx, place:l.place, colorDark:null, colorLight:null, origin:l.place}); }); }   // origin=세트 설계상 원래 위치(옮겨도 유지)
  else if(spec.indexOf('fx:')===0){ var id=spec.slice(3);
    layers.push({ fx:id, place:(fxIsTakeover(id)?'front':fxgPlace), colorDark:null, colorLight:null }); }   // 화면 장악=항상 앞
  else return;
  closeFxGallery(); renderFxLayers(layers); liveEffect(); }
// 레이어 편집: 순서/이동/삭제(버튼 click) + 상시·순간·색(입력 input)
function fxEdit(e){ var el=e.target, act=el.getAttribute&&el.getAttribute('data-act'); if(!act) return;
  var isBtn=(act==='up'||act==='down'||act==='swap'||act==='del');
  if(isBtn && e.type!=='click') return;                    // 버튼은 click 만
  if(!isBtn && e.type==='click') return;                   // 입력은 input 만(체크박스 click 중복 방지)
  var row=el.closest('.fxrow'); if(!row) return; var i=+row.getAttribute('data-i');
  var layers=fxCurrent(), L=layers[i]; if(!L) return;
  var reRender=true;
  if(act==='del') layers.splice(i,1);
  else if(act==='swap') L.place=(L.place==='front'?'back':'front');
  else if(act==='up'||act==='down'){                       // 같은 면 안에서 인접 스왑
    var step=(act==='up'?-1:1), j=i+step;
    while(j>=0 && j<layers.length && layers[j].place!==L.place) j+=step;
    if(j>=0 && j<layers.length){ var t=layers[i]; layers[i]=layers[j]; layers[j]=t; }
  }
  else if(act==='onoff') L.off = !el.checked;    // 체크=켜짐 · 해제=꺼짐(목록엔 남고 렌더만 제외)
  // 테마색 체크=색 없음(null, 그 테마의 캐릭터색을 따라감) · 해제=아래 스와치에 저장된 색 사용. 다크/라이트 서로 독립.
  else if(act==='themeDark'){ var swbD=row.querySelector('.fx-cval[data-theme="dark"]'); L.colorDark = el.checked ? null : ((swbD&&swbD.dataset.fxval)||'#4bbad6'); }
  else if(act==='themeLight'){ var swbL=row.querySelector('.fx-cval[data-theme="light"]'); L.colorLight = el.checked ? null : ((swbL&&swbL.dataset.fxval)||'#4bbad6'); }
  else return;   // 실제 색 지정은 커스텀 컬러피커(.cp-sw)가 fxSetColor 로 처리
  if(reRender) renderFxLayers(layers); else fxCommit(layers);
  liveEffect(); }
// 커스텀 컬러피커(.cp-sw)가 고른 색을 그 레이어에 적용(재렌더 없이 = 피커 열린 채 유지)
//   sw의 data-theme("dark"/"light")로 어느 테마 색인지 구분 — 다크/라이트 스와치가 각자 자기 것만 바꾼다.
function fxSetColor(sw, hex){
  var row=sw.closest('.fxrow'); if(!row) return;
  var i=+row.getAttribute('data-i'), layers=fxCurrent(); if(!layers[i]) return;
  var field = sw.dataset.theme==='light' ? 'colorLight' : 'colorDark';
  layers[i][field]=hex; sw.dataset.fxval=hex; sw.style.background=hex;
  fxCommit(layers); liveEffect(); }
// 드래그로 순서 변경(그립 ⠿). 다른 컬럼에 떨어뜨리면 앞/뒤도 바뀜.
var fxDragI=null;
function fxDrop(e){
  if(fxDragI==null) return; e.preventDefault();
  var layers=fxCurrent(), moved=layers[fxDragI], di=fxDragI; fxDragI=null;
  var row=e.target.closest('.fxrow'), cont=e.target.closest('.fxlayers') || (row && row.closest('.fxlayers'));
  if(!moved || !cont){ renderFxLayers(layers); return; }
  var place=cont.getAttribute('data-place')||'back';
  var target = row ? layers[+row.getAttribute('data-i')] : null;
  if(target===moved){ renderFxLayers(layers); return; }        // 자기 위에 떨굼 = 변화 없음
  layers.splice(di,1); moved.place=place;                       // 원위치에서 빼고 이동한 컬럼 면으로
  var at = target ? layers.indexOf(target) : layers.length;     // target 앞에 삽입(빈 컬럼이면 끝)
  if(at<0) at=layers.length;
  layers.splice(at,0,moved);
  renderFxLayers(layers); liveEffect(); }

// ---- 세대 토글 바(1/2/3 탭 + 작성상태 + 대표 지정) ----
function refreshGenBar(){
  // 세대 구분 on/off 반영: 체크박스·genbar 클래스(단일이면 gen-body 숨김)·버튼/라벨 문구
  var gb=$('#genbar'); if(gb) gb.classList.toggle('single', !GEN_ON);
  var chk=$('#genOn'); if(chk) chk.checked=GEN_ON;
  var rb=$('#genReset'); if(rb) rb.textContent = GEN_ON ? (genMeta(CUR_GEN).label+' 초기화') : '내용 초기화';
  // 세대 구분을 켜면 미리보기에 타임라인+⚙메뉴가 새로 생겨 이 상시 버튼과 하는 일이 겹침 → 그때는 숨김.
  var gpt=$('#genPanelToggle'); if(gpt) gpt.hidden = GEN_ON;
  var host=$('#genTabs');
  if(host){ host.innerHTML=GENS.map(function(g){   // 탭 = 편집할 세대 선택(대표 지정은 아래 라디오)
    var cur=(g.id===CUR_GEN), main=(g.id===MAIN_GEN), written=genWritten(g.id);
    return '<div class="gtab'+(cur?' cur':'')+(written?' written':'')+'" data-gen="'+g.id+'">'+
      '<span class="gt-star">'+(main?'★ 대표':'')+'</span>'+
      '<span class="gt-dot" title="'+(written?'작성됨':'미작성 · 기록 없음으로 나감')+'">'+(written?'●':'○')+'</span>'+
      '<span class="gt-lab">'+esc(g.label)+'</span><span class="gt-sub">'+esc(g.sub)+'</span>'+
    '</div>';
  }).join(''); }
  var gmp=$('#genMainPick');   // 대표 세대 라디오(한 번만 생성 → 이후 checked 만 갱신)
  if(gmp){
    if(!gmp.children.length) gmp.innerHTML=GENS.map(function(g){ return '<label><input type="radio" name="genmainpick" value="'+g.id+'"> '+esc(g.label)+'</label>'; }).join('');
    GENS.forEach(function(g){ var r=gmp.querySelector('input[value="'+g.id+'"]'); if(r) r.checked=(g.id===MAIN_GEN); });
  }
  // 섹션 헤더의 '· <현재 세대>' 표기를 지금 편집 중인 세대(CUR_GEN)로 갱신 (예: 3세대 선택 → "3세대")
  var cgl=genMeta(CUR_GEN).label||''; document.querySelectorAll('.curgen').forEach(function(s){ s.textContent=cgl; });
}
function selectGen(id){   // 세대 탭 전환: 현재 폼 저장 → 다른 세대 폼 로드
  if(id===CUR_GEN) return;
  GEN_FORMS[CUR_GEN]=readGen();
  CUR_GEN=id;
  writeGen(GEN_FORMS[id] || (GEN_FORMS[id]=blankGen(id===MAIN_GEN)));
  syncLineupHeight();          // 라인업 키는 대표세대 기준(공통) → 탭 바꿔도 유지
  refreshGenBar(); syncColorPickers();
  // ★iframe 재생성 없이 부드럽게 넘기는 __genSwitch 최적화는 안 쓴다 — 카드 영역(신원 ✎ 팝오버 등)의 편집 기능은
  //   iframe이 처음 열릴 때 한 번만 그 안 요소를 찾아 배선되는데, __genSwitch는 무대만 바꾸고 카드는 그대로 두거나
  //   방문자용 "기록 없음" 틀로 바꿔서 편집 배선이 없는 상태가 됐다(실제로 겪은 버그). render()는 뒤 iframe에
  //   전부 새로 지어 배선한 뒤 다 된 뒤에야 화면에 꺼내므로(2장 교차 페이드) 번쩍임 없이도 항상 편집 가능하다.
  pvLastHTML=null; pvResetScroll=true; render();   // 세대 전환 = 다른 캐릭터 보듯 새로 시작 → 이번만 스크롤을 이어받지 않고 맨 위로
}
function setMain(id){   // 대표 세대 지정
  GEN_FORMS[CUR_GEN]=readGen();
  MAIN_GEN=id; refreshGenBar(); syncLineupHeight(); pvLastHTML=null; render();
}
// 미리보기 타임라인 클릭·⚙메뉴가 왼쪽 탭이 하던 것과 똑같은 함수를 그대로 부른다(로직 두 벌 안 만듦).
window.pvGenSwitch = selectGen;
window.pvGenSetMain = setMain;

/* ---------- 폼(세대 3벌) → 상태 객체 ----------
   top-level(meta/stats/wardrobe/accent/art) = 대표(MAIN) 세대 값.
   generations.items = 세대별. 작성된 '비대표' 세대는 자기 meta/stats/wardrobe/accent 도 함께
   (페이지가 세대 전환 시 그 세대 것으로 다시 그림). 미작성 세대 = id/label/sub/img 만.
   본문 = 작성된 세대만 .gen-panel. */
function rosterOf(g){   // 목록 요약(공통) = 대표 세대에서 파생. 역할·나이는 폼 비면 불러온 값 보존.
  var r={};
  if(g.krname) r.ko=g.krname;                                  // 목록 이름 = 한글 '이름'만(짧게)
  var roleEn = joinDeptRole(g.dept, g.role, ' · ', true);      // 목록 역할 = 영문 "부서 · 역할"
  var rrole = roleEn || ((LOADED_ROSTER && LOADED_ROSTER.role!=null) ? String(LOADED_ROSTER.role) : '');
  if(rrole) r.role=rrole;
  if(g.age) r.age=ageStr(g.age); else if(LOADED_ROSTER && LOADED_ROSTER.age) r.age=String(LOADED_ROSTER.age);
  if(/^\d+$/.test(g.height)) r.height=+g.height;
  r.sec = /^\d+$/.test(g.sector) ? +g.sector : (g.sector||'etc');   // 지부 미선택이면 무소속(etc)
  return r;
}
function buildFullBody(editable){
  // editable=false → 파일 저장용: 카드만. 신원(namehead)·사원증(idcard)·gen-panel 래퍼는 _layouts/character.html 이
  //   front matter로 그림(단일 출처). 캐릭터당 신원은 대표 세대 1개 → 여러 세대 본문을 한 파일에 굽지 않음(레이아웃이 대표만 래핑).
  if(!editable){
    var gdF = GEN_FORMS[MAIN_GEN] || blankGen();
    return buildBody(bodyObjOf(gdF), gdF.stats.length>0, false);
  }
  // editable=true → 미리보기(iframe): 레이아웃이 없으므로 래퍼 + 신원/사원증(buildIdentity) + 카드를 직접 조립(레이아웃과 같은 모양).
  //   지금 편집 중인 세대(CUR_GEN)는 아직 한 글자도 안 썼어도 반드시 포함시킨다 — 안 그러면 세대 타임라인을
  //   눌러 안 써본 세대로 넘어갔을 때 편집 가능한 패널이 아예 안 생겨서(방문자용 "기록 없음" 틀만 남아) 못 고친다.
  var gens = GEN_ON ? GENS.filter(function(g){ return genWritten(g.id) || g.id===CUR_GEN; }) : [genMeta(MAIN_GEN)];
  return gens.map(function(g){
    var gd = GEN_FORMS[g.id] || blankGen(), bo = bodyObjOf(gd), ed = (g.id===CUR_GEN);
    return '      <div class="gen-panel" data-gen="'+g.id+'">\n'
         + buildIdentity(bo, ed, g.id) + '\n'
         + buildBody(bo, gd.stats.length>0, ed) + '\n      </div>';
  }).join('\n');
}
function collect(){
  GEN_FORMS[CUR_GEN]=readGen();                                // 지금 편집 중인 세대 폼을 먼저 저장
  var mainG = GEN_FORMS[MAIN_GEN] || (GEN_FORMS[MAIN_GEN]=blankGen());
  var st = {
    slug: $('#slug').value.trim(),
    accent: mainG.accent||'#bfc7d4',
    accentLight: mainG.accentLight,   // 밝은 테마 색 = 대표 세대 것(top-level=페이지 기본 <style>)
    accent2: mainG.accent2, accent2Light: mainG.accent2Light,   // 대표색 2번째 색(그라데이션 끝색) · 비면 단색
    statPlus: $('#statPlus').value.trim(),                       // +증가분 막대 색(공통) · 비면 자동(대표색 연한 버전)
    art: mainG.art,
    artArtist: mainG.artArtist,                      // 대표 일러 작가 = 대표 세대 옷장 main 의상의 작가(단일 출처)
    artAlt: joinName(mainG.krname, mainG.krsur),    // 이미지 설명 = 대표 세대 한글 풀네임
    meta: metaOf(mainG),
    stats: statsOut(mainG.stats),
    wardrobe: mainG.wardrobe.slice(),
    generations: { current: MAIN_GEN, items: [] }   // 페이지는 대표 세대로 열림(미리보기는 buildSrcdoc이 현재세대로 덮음)
  };
  if(!GEN_ON){   // 단일(세대 없음): 대표 세대 하나만 items 에(효과 운반용). 항목 1개 → 페이지가 스위처 없이 단일로 인식.
    var g0=genMeta(MAIN_GEN), it0={ id:g0.id, label:g0.label, sub:g0.sub, img: mainG.art, main:true };
    if(mainG.artArtist) it0.artist = mainG.artArtist;
    if(mainG.effect){ var ea0=parseEffectField(mainG.effect); if(ea0.length) it0.effect=ea0; }
    st.generations.items.push(it0);
  } else GENS.forEach(function(g){
    var gd = GEN_FORMS[g.id] || blankGen();
    var it = { id:g.id, label:g.label, sub:g.sub, img: gd.art };
    if(gd.artArtist) it.artist = gd.artArtist;
    if(gd.effect){ var ea=parseEffectField(gd.effect); if(ea.length) it.effect=ea; }
    if(g.id===MAIN_GEN) it.main=true;
    if(genWritten(g.id) && g.id!==MAIN_GEN){        // 작성된 비대표 세대 → 자기 데이터 포함(대표는 top-level 폴백=중복 방지)
      it.meta = metaOf(gd);
      it.stats = statsOut(gd.stats);
      it.wardrobe = gd.wardrobe.slice();
      if(gd.accent) it.accent = gd.accent;
      if(gd.accentLight) it.accent_light = gd.accentLight;   // 세대별 밝은 테마 색(페이지 profile.js가 라이트에서 적용)
      if(gd.accent2) it.accent2 = gd.accent2;
      if(gd.accent2Light) it.accent2_light = gd.accent2Light;
    }
    st.generations.items.push(it);
  });
  st.roster = rosterOf(mainG);
  // 신원·사원증 = 대표 세대에서 파생 → front matter 로 저장(레이아웃이 이 데이터로 그림. 본문엔 카드만).
  // 나이·키·소속 번호는 위 roster와 값이 같으므로 여기 또 저장하지 않는다 — 화면의 idmeta 한 줄은
  // _layouts/character.html이 roster(나이·키·소속)와 이 namehead(생일·부서+역할)를 매번 조립해서 만든다.
  var mainBo = bodyObjOf(mainG);
  st.namehead = { eyebrow:mainBo.eyebrow||'', kr:joinName(mainBo.krname, mainBo.krsur), en:mainBo.enname||'',
    bday:mainG.bday||'', role:joinDeptRole(mainG.dept, mainG.role, ' ', false), quote:mainBo.quote||'' };
  st.idcard = mainBo.idcardOn ? { img:mainBo.idimg||'', status:mainBo.idstatus||'ACTIVE', artist:mainBo.idartist||'' } : null;
  st.body = buildFullBody(false);
  return st;
}

