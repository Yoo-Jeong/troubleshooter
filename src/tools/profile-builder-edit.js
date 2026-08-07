"use strict";
/* ============================================================
   프로필 작성 툴 — 라이브 패치 + 미리보기→폼 클릭 편집 동기화
   ------------------------------------------------------------
   liveStats/liveAccent 등 : iframe 재생성 없이 부분만 갱신(번쩍임 방지).
   pvEdit 계열(window.pvXxx) : 미리보기 iframe 안 편집 UI가 부모(이 스크립트)를
   호출해 왼쪽 폼(데이터 저장소)에 값을 반영한다.
   ============================================================ */
/* ---------- 라이브 패치 — 무대 효과 애니가 매번 리셋되며 번쩍이지 않게, iframe 재생성 없이 부분만 갱신 ----------
   능력치 값·대표색/밝은색 변경은 미리보기를 통째로 다시 그리지 않고 살아있는 iframe만 고친다.
   훅(__paintStats)이 없거나 실패하면 안전하게 기존 방식(render 재생성)으로 폴백. */
// 라이브 패치 대상 패널 : 세대 모드=현재 세대 패널 · 단일 모드=우측 .file 전체(무대 .stage 는 안 건드림 → 효과 안 끊김)
function curPanel(doc){ return doc.querySelector('.gen-panel[data-gen="'+CUR_GEN+'"]') || doc.querySelector('.file'); }   // gen-panel 래퍼는 미리보기에 항상 있음(buildFullBody). 못 찾으면 .file 폴백
function pvSetAccent(){   // 현재 세대 색을 미리보기에 즉시(재생성 없이). !important 로 profile.js 기본색 위에 얹음
  try{ var doc=PV[pvFront].contentDocument; if(!doc||!doc.head) return;
    var el=doc.getElementById('tsLiveAccent'); if(!el){ el=doc.createElement('style'); el.id='tsLiveAccent'; doc.head.appendChild(el); }
    var gd=GEN_FORMS[CUR_GEN]||{}, d=gd.accent||'#bfc7d4', l=gd.accentLight||d;
    var d2=gd.accent2||d, l2=gd.accent2Light||'';   // 2번째 색 비면 accent로(단색). 밝은 2번째 없으면 :root(어두운 2번째) 상속
    var sp=($('#statPlus')&&$('#statPlus').value.trim())||'';   // +증가분 색(공통)
    el.textContent=':root,:root[data-theme="dark"]{--accent:'+d+' !important;--accent2:'+d2+' !important;'+(sp?'--stat-plus:'+sp+' !important;':'')+'}:root[data-theme="light"]{--accent:'+l+' !important;'+(l2?'--accent2:'+l2+' !important':'')+'}';
  }catch(e){}
}
// 라이브 변경 공통: 현재 세대 스냅샷 + 작성상태/저장 갱신. 작성↔미작성이 바뀌면(구조 변경) 재생성 필요 → false 반환.
function liveCommon(){
  var wasW=genWritten(CUR_GEN);
  GEN_FORMS[CUR_GEN]=readGen();
  if(genWritten(CUR_GEN)!==wasW){ pvLastHTML=null; render(); return false; }   // 작성 유무가 바뀜 = 패널 생겼/사라짐 → 재생성
  refreshGenBar(); syncColorPickers(); scheduleSave();
  return true;
}
function liveStats(){
  if(!liveCommon()) return;
  try{
    var win=PV[pvFront].contentWindow, doc=PV[pvFront].contentDocument;
    if(!win || !win.__paintStats){ pvLastHTML=null; render(); return; }
    var panel=curPanel(doc), box=panel?panel.querySelector('.statbars'):null;
    if(box) win.__paintStats(statsOut((GEN_FORMS[CUR_GEN]||{}).stats||[]), box);
    else { pvLastHTML=null; render(); }
  }catch(e){ pvLastHTML=null; render(); }
}
function liveAccent(){ if(!liveCommon()) return; pvSetAccent(); }
// 옷장 '작가' 칸 변경 → 무대 우하단 크레딧 글자만 즉시 교체(iframe 재생성 없이 = 번쩍임 없음).
//   liveCommon()의 readGen()이 옷장에서 대표(on) 의상의 artist를 다시 뽑아 GEN_FORMS[CUR_GEN].artArtist에 채워줌.
function liveArtCredit(){
  if(!liveCommon()) return;
  try{
    var doc=PV[pvFront].contentDocument, el=doc && doc.getElementById('artCredit');
    if(!el){ pvLastHTML=null; render(); return; }
    el.textContent=(GEN_FORMS[CUR_GEN]||{}).artArtist||'';
  }catch(e){ pvLastHTML=null; render(); }
}
// 무대 효과(레이어) 변경 → 미리보기 '무대만' 즉시 교체(iframe 재생성 없이 = 애니 안 끊김·번쩍임 없음).
//   미리보기가 노출한 window.__stageFX(=profile.js가 마운트한 컨트롤러)를 그대로 호출.
function liveEffect(){
  if(!liveCommon()) return;
  try{
    var win=PV[pvFront].contentWindow;
    if(!win || !win.__stageFX){ pvLastHTML=null; render(); return; }   // 훅 없으면 안전하게 재생성(폴백)
    var gd=GEN_FORMS[CUR_GEN]||{};
    win.__stageFX.set(gd.art ? fxCurrent() : []);                      // 그림 없는 세대 = 효과 숨김(페이지 applyStage 규칙과 동일)
  }catch(e){ pvLastHTML=null; render(); }
}
// 신원·서술·사원증 '텍스트' 변경 → 그 세대 패널(.file)만 다시 그림. 무대(.stage)는 안 건드리므로 효과 애니가 안 끊김 = 번쩍임 없음.
function liveText(){
  if(!liveCommon()) return;
  try{
    var win=PV[pvFront].contentWindow, doc=PV[pvFront].contentDocument;
    var panel=curPanel(doc);
    if(!win || !win.__paintStats || !panel){ pvLastHTML=null; render(); return; }   // 조건 안 맞으면 안전하게 재생성
    var gd=GEN_FORMS[CUR_GEN]||blankGen(), bo=bodyObjOf(gd);
    panel.innerHTML = (buildIdentity(bo, true)+'\n'+buildBody(bo, gd.stats.length>0, true))   // 신원/사원증 + 카드(미리보기 클릭편집 유지)
      .replace(/(<img\b[^>]*\ssrc=")([^"]*)(")/gi, function(m,a,s,c){ return a+resolveImg(s)+c; });
    win.__paintStats(statsOut(gd.stats), panel.querySelector('.statbars'));   // 새로 그린 빈 능력치칸 다시 채움
    if(win.__paintMeta) win.__paintMeta(metaOf(gd));                          // 상단바 소속·경로·코드명·무대 ID
    if(win.hljs){   // 방금 새로 그린 패널 안 코드블럭(있다면) 문법강조 — panel.innerHTML을 통째로 갈았으니 다시 걸어줘야 함
      win.hljs.highlightAll();
      panel.querySelectorAll('pre.p-code code[class*="language-"]').forEach(function(c){
        var m=c.className.match(/language-(\S+)/); if(m) c.closest('pre').setAttribute('data-lang', m[1]);
      });
    }
  }catch(e){ pvLastHTML=null; render(); }
}

/* ---------- 미리보기에서 클릭-편집 → 폼 동기화 (iframe 재생성 없이 커서 유지) ---------- */
function setValNoRender(id,v){ var el=$(id); if(el) el.value=v; }
var saveTimer=null;
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(function(){ saveLocal(collect()); }, 400); }
function pvEdit(key, val){
  var v=String(val==null?'':val);
  if(key==='eyebrow') setValNoRender('#b_eyebrow', v.trim());
  else if(key==='krname') setValNoRender('#b_krname', v.trim());
  else if(key==='quote') setValNoRender('#b_quote', v.trim());
  else if(key==='idstatus') setValNoRender('#b_idstatus', v.trim());
  else if(key==='idartist') setValNoRender('#b_idartist', v.trim());
  else if(key.indexOf('prose:')===0 || key.indexOf('ext:')===0){
    // 서술카드(prose)·확장카드(ext)는 같은 블록 구조라 처리 로직이 완전히 같음 — 제목/부제 선택자만 다름.
    var cardType = key.indexOf('ext:')===0 ? 'ext' : 'prose';
    var parts=key.split(':'), idx=+parts[1], field=parts[2];
    var card=cardFor(cardType, idx); if(!card) return;
    var titleSel = cardType==='ext' ? '.e-title' : '.p-title', subSel = cardType==='ext' ? '.e-sub' : '.p-sub';
    if(field==='title') card.querySelector(titleSel).value=v.trim();
    else if(field==='sub') card.querySelector(subSel).value=v.trim();
    else if(field==='body'){   // 그림 없는 기본형(블록 1개) 카드 — 그 유일한 텍스트 블록에 반영
      var ta=card.querySelector('.blk-text-v'); if(ta) ta.value=htmlToProse(v);
    }
    else if(field==='text'){   // 그림 섞인 카드 — parts[3]=블록 인덱스(그 텍스트 블록에만 반영)
      var row=card.querySelectorAll('.blk-row')[+parts[3]], ta2=row&&row.querySelector('.blk-text-v');
      if(ta2) ta2.value=htmlToProse(v);
    }
    else if(field==='alt'){   // 그림 설명(alt) — parts[3]=블록 인덱스
      var row4=card.querySelectorAll('.blk-row')[+parts[3]], altIn=row4&&row4.querySelector('.blk-alt');
      if(altIn) altIn.value=v.trim();
    }
    else if(field==='artist'){   // 그림 작가 크레딧 — parts[3]=블록 인덱스
      var row5=card.querySelectorAll('.blk-row')[+parts[3]], artIn=row5&&row5.querySelector('.blk-artist');
      if(artIn) artIn.value=v.trim();
    }
  }
  scheduleSave();
}
window.pvEdit = pvEdit;
// 무대 배치 편집기(미리보기)에서 온 값 → 그 의상 행에 숨겨 저장. 미리보기 재생성 없이(=편집기 유지) scheduleSave 만.
//   매칭: 미리보기의 '이미지 있는 슬롯' idx번째 ↔ 폼의 '이미지 있는 행' idx번째. 둘 다 옷장 배열 순서라 이름 중복/빈칸에도 안전.
function pvStageEdit(idx, vals){
  var imgRows=[].slice.call(document.querySelectorAll('#ward .ward-row')).filter(function(r){ var i=r.querySelector('.w-img'); return i && i.value.trim(); });
  var row = (idx>=0 && idx<imgRows.length) ? imgRows[idx] : null;
  if(!row){ var on=document.querySelector('#ward .ward-row .w-on:checked'); row = on?on.closest('.ward-row'):imgRows[0]; }   // 못 찾으면 대표(main)
  if(!row) return;
  if(!row._sz) row._sz={};
  Object.keys(vals).forEach(function(k){ if(vals[k]==null) delete row._sz[k]; else row._sz[k]=vals[k]; });   // 기본값=null → 키 제거
  scheduleSave();
}
window.pvStageEdit = pvStageEdit;
// 옷장 관리(미리보기 트랙의 ⋮ 메뉴·＋ 타일·드래그)에서 온 값 → 왼쪽 숨은 옷장 폼(#ward)에 반영.
//   슬롯 인덱스 = ward-row 인덱스와 1:1(paintWardrobe가 옷장 배열을 그대로, 필터 없이 그리기 때문).
function pvWardRows(){ return document.querySelectorAll('#ward .ward-row'); }
// 캡션·작가는 순수 글자 편집이라 render()(iframe 통째로 재생성)를 부르면 타이핑마다 팝오버까지 같이
// 사라진다 — 서술카드처럼 자동저장만 하고 화면 반영은 미리보기 쪽 스크립트가 그 자리에서 직접 함.
// 대표 지정만은 무대에 뜨는 그림이 바뀌는 구조변경이라 예외적으로 다시 그린다.
function pvWardEdit(idx, patch){
  var row=pvWardRows()[idx]; if(!row) return;
  if(patch.cap!=null) row.querySelector('.w-cap').value=patch.cap;
  if(patch.artist!=null) row.querySelector('.w-artist').value=patch.artist;
  if(patch.on){ row.querySelector('.w-on').checked=true; render(); return; }   // 라디오라 이 슬롯만 켜지면 나머지는 브라우저가 자동으로 끔
  scheduleSave();
}
window.pvWardEdit = pvWardEdit;
function pvWardAdd(){   // readWard()가 캡션·이미지 둘 다 빈 행은 걸러내므로(#addWard처럼 완전히 빈 채로 추가하면
  $('#ward').appendChild(wardRow('새 의상', '', false));   // 미리보기에 슬롯이 안 뜸) 기본 캡션을 채워서 추가한다.
  render();
}
window.pvWardAdd = pvWardAdd;
function pvWardDel(idx){
  var row=pvWardRows()[idx]; if(!row) return;
  var wasOn=row.querySelector('.w-on').checked;
  row.remove();
  if(wasOn){ var first=$('#ward .ward-row .w-on'); if(first) first.checked=true; }   // 대표를 지웠으면 첫 슬롯을 대표로
  render();
}
window.pvWardDel = pvWardDel;
function pvWardReorder(from, to){
  var wb=$('#ward'), rows=[].slice.call(wb.children);
  if(from<0||from>=rows.length||to<0||to>=rows.length||from===to) return;
  var moved=rows.splice(from,1)[0]; rows.splice(to,0,moved);
  rows.forEach(function(r){ wb.appendChild(r); });   // appendChild는 기존 노드를 옮길 뿐(복제 아님) → 순서만 바뀜
  render();
}
window.pvWardReorder = pvWardReorder;
function pvWardImagePick(idx, file){
  var row=pvWardRows()[idx]; if(!row) return;
  var fi=row.querySelector('.imgbtn input[type=file]'); if(!fi) return;
  var dt=new DataTransfer(); dt.items.add(file); fi.files=dt.files;
  fi.dispatchEvent(new Event('change', {bubbles:true}));   // 파일 선택 공용 change 리스너가 이름 반영·등록·render()까지 다 함
}
window.pvWardImagePick = pvWardImagePick;
// 사원증 이미지 클릭 → 미리보기에서 고른 파일을 왼쪽 숨은 #b_idimg 칸의 진짜 파일입력에 그대로 넣음(옷장과 같은 패턴).
function pvIdImagePick(file){
  var wrap = $('#b_idimg') && $('#b_idimg').closest('.imgcell'); if(!wrap) return;
  var fi = wrap.querySelector('input[type=file]'); if(!fi) return;
  var dt=new DataTransfer(); dt.items.add(file); fi.files=dt.files;
  fi.dispatchEvent(new Event('change', {bubbles:true}));
}
window.pvIdImagePick = pvIdImagePick;
// 능력치 관리(미리보기 막대 클릭 → 이름·값·증가분 편집)에서 온 값 → 왼쪽 숨은 능력치 폼(#stats)에 반영.
//   liveStats()가 이미 있는 '막대만 다시 그리는' 라이브패치라 재사용(iframe 전체를 다시 그릴 필요가 없음, 옷장과 다른 점).
//   항목 추가·삭제는 미리보기에서 지원 안 함(정해진 2열×6행 격자를 넘기면 레이아웃이 깨짐) — 필요하면 코드에서 직접.
function pvStatRows(){ return document.querySelectorAll('#stats .stat-row'); }
function pvStatEdit(idx, patch){
  var row=pvStatRows()[idx]; if(!row) return;
  if(patch.name!=null) row.querySelector('.s-name').value=patch.name;
  if(patch.val!=null) row.querySelector('.s-val').value=patch.val;
  if(patch.plus!=null) row.querySelector('.s-plus').value=patch.plus;
  liveStats();
}
window.pvStatEdit = pvStatEdit;
// 신원 카드 ✎ 팝오버(나이·키·생일·소속·부서·역할)에서 온 값 → 왼쪽 숨은 칸(#bi_*)에 반영.
//   idmeta 문자열은 buildIdentity가 만들 때 그 자리에서 조립돼 iframe HTML에 그대로 박히므로(별도 그림함수 없음)
//   막대·옷장 슬롯처럼 부분만 다시 그리는 라이브패치가 없다 — 값이 바뀌면 항상 통째로 다시 그림(render).
function pvIdentityEdit(patch){
  if(patch.eyebrow!=null) setVal('#b_eyebrow', patch.eyebrow);
  if(patch.krname!=null) setVal('#b_krname', patch.krname);
  if(patch.record!=null) setVal('#m_record', patch.record);
  if(patch.krsur!=null) setVal('#b_krsur', patch.krsur);
  if(patch.enname!=null) setVal('#b_enname', patch.enname);
  if(patch.ensur!=null) setVal('#b_ensur', patch.ensur);
  if(patch.age!=null) setVal('#bi_age', patch.age);
  if(patch.height!=null) setVal('#bi_height', patch.height);
  if(patch.bday!=null) setVal('#bi_bday', patch.bday);
  if(patch.sector!=null) setVal('#bi_sector', patch.sector);
  if(patch.dept!=null) setVal('#bi_dept', patch.dept);
  if(patch.role!=null) setVal('#bi_role', patch.role);
  render();
}
window.pvIdentityEdit = pvIdentityEdit;
// 서술카드/확장카드 둘 다 같은 블록 구조를 쓰므로 'prose'/'ext' 타입 문자열로 그 카드를 찾는 공용 함수.
function cardFor(cardType, idx){
  return document.querySelectorAll(cardType==='ext' ? '#exts .ext-card' : '#proses .prose-card')[idx];
}
function pvAdd(type){
  if(type==='prose') $('#proses').appendChild(proseRow({}));
  else if(type==='ext') $('#exts').appendChild(extRow({}));
  else if(type.indexOf('prose-text:')===0 || type.indexOf('prose-img:')===0 || type.indexOf('ext-text:')===0 || type.indexOf('ext-img:')===0){
    // 미리보기 카드의 ＋텍스트/＋그림 버튼 — 왼쪽 폼의 그 카드 블록목록에 바로 추가(왼쪽에서 누른 것과 동일 경로)
    var cardType = type.indexOf('ext-')===0 ? 'ext' : 'prose';
    var isImg = type.indexOf('-img:')!==-1, idx = +type.split(':')[1];
    var card = cardFor(cardType, idx);
    var list = card && card.querySelector('.blk-list');
    if(list){
      list.appendChild(blockRow(isImg ? {type:'img',img:'',alt:''} : {type:'text',body:''}, list));
      Array.prototype.forEach.call(list.children, function(r){ if(r._refreshCtl) r._refreshCtl(); });
    }
  }
  render();
}
window.pvAdd = pvAdd;
// ★아래 세 함수는 새 로직을 안 만들고 왼쪽 폼에 이미 있는 진짜 버튼을 인덱스로 찾아 그대로 눌러준다
//   (blockRow의 ↑↓✕, proseRow의 ✕삭제) — 경계처리(refreshCtl)·데이터 반영이 전부 그 버튼 것 그대로 재사용됨.
//   버튼 클릭이 내부적으로 예약하는 디바운스 render()(300ms 뒤 iframe 전체 재생성=깜빡임)는 취소하고,
//   liveText()로 그 자리에서 바로 패널만 다시 그려 미리보기가 즉시 반영되게 한다(느낌·정확도 둘 다 챙김).
function pvBlkMove(cardType, idx, bi, act){
  var card=cardFor(cardType, idx); if(!card) return;
  var row=card.querySelector('.blk-list').children[bi]; if(!row) return;
  var btn=row.querySelector('[data-act="'+act+'"]'); if(btn) btn.click();
  clearTimeout(timer); liveText();
}
window.pvBlkMove = pvBlkMove;
function pvCardDel(idx){
  var card=document.querySelectorAll('#proses .prose-card')[idx]; if(!card) return;
  var btn=card.querySelector('.del'); if(btn) btn.click();
  clearTimeout(timer); liveText();
}
window.pvCardDel = pvCardDel;
function pvExtDel(i){
  var card=document.querySelectorAll('#exts .ext-card')[i]; if(!card) return;
  var btn=card.querySelector('.del'); if(btn) btn.click();
  clearTimeout(timer); liveText();
}
window.pvExtDel = pvExtDel;
// 기밀(CLASSIFIED) 자물쇠 버튼 — 왼쪽(숨은) 폼의 진짜 체크박스를 대신 켜고 꺼서 기존 저장 경로 그대로 태움
function pvExtToggleClassified(i){
  var card=document.querySelectorAll('#exts .ext-card')[i]; if(!card) return;
  var cb=card.querySelector('.e-classified'); if(!cb) return;
  cb.checked=!cb.checked;
  cb.dispatchEvent(new Event('change', {bubbles:true}));
  clearTimeout(timer); liveText();
}
window.pvExtToggleClassified = pvExtToggleClassified;
// 서술카드/확장카드 그림 블록의 "이미지 바꾸기" — 미리보기(iframe)에서 고른 File을 그 블록의 진짜 파일입력에 넣고
// change를 직접 일으켜, 기존 문서 전체 change 리스너(파일명 반영·FILES/FILEOBJ 등록)를 그대로 태운다.
function pvImagePick(key, file){
  var parts=String(key||'').split(':'), cardType=parts[0], idx=+parts[1], bi=+parts[2];
  var card=cardFor(cardType, idx); if(!card) return;
  var row=card.querySelectorAll('.blk-row')[bi]; if(!row) return;
  var fi=row.querySelector('.imgbtn input[type=file]'); if(!fi) return;
  var dt=new DataTransfer(); dt.items.add(file); fi.files=dt.files;
  fi.dispatchEvent(new Event('change', {bubbles:true}));
  clearTimeout(timer); liveText();
}
window.pvImagePick = pvImagePick;

