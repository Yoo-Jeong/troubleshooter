"use strict";
/* ============================================================
   프로필 작성 툴 — 카드 본문(서술·확장) 빌더 + YAML 출력
   ------------------------------------------------------------
   구조화 폼 → HTML 생성(buildIdentity/buildBody, 마크다운라이트 proseToHtml) ·
   HTML → 구조화 폼 역파서(htmlToProse 계열/parseBody, 불러오기용) ·
   상태 → front matter YAML(flowMeta~buildFM/buildFile).
   ============================================================ */
/* ---------- 본문: 구조화 폼 → HTML 생성 ---------- */
// 텍스트칸에서 선택한 글자만 감싸서 서식 표시(**굵게**·_기울임_). 선택 없으면 무시.
function wrapSelection(ta, marker){
  var s=ta.selectionStart, e=ta.selectionEnd; if(s==null || s===e) return;
  var v=ta.value, sel=v.slice(s,e);
  ta.value = v.slice(0,s) + marker + sel + marker + v.slice(e);
  ta.focus(); ta.selectionStart=s+marker.length; ta.selectionEnd=e+marker.length;
  ta.dispatchEvent(new Event('input', {bubbles:true}));   // 폼 변경 감지(라이브 미리보기 갱신)로 이어지게
}
// 서술카드 한 줄(블록) = 텍스트 또는 그림. 블록을 쌓은 순서 그대로 카드 안에 위→아래로 들어간다(문단 사이 어디든 그림 삽입 가능).
function blockRow(blk, list){
  blk = blk || { type:'text', body:'' };
  var d = document.createElement('div'); d.className = 'blk-row';
  var ctl = '<div class="blk-ctl">'+
      '<button type="button" class="blk-mv" data-act="up" title="위로">↑</button>'+
      '<button type="button" class="blk-mv" data-act="down" title="아래로">↓</button>'+
      '<button type="button" class="blk-mv" data-act="del" title="삭제">✕</button>'+
    '</div>';
  if(blk.type==='img'){
    d.classList.add('blk-img');
    d.innerHTML =
      '<div class="blk-body">'+
        '<span class="imgcell"><input class="blk-imgval" value="'+esc(blk.img)+'" placeholder="예: 그림.jpg"><label class="filebtn imgbtn" title="이미지 선택">📁<input type="file" accept="image/*" hidden></label></span>'+
        '<input class="blk-alt" value="'+esc(blk.alt)+'" placeholder="이미지 설명 · 안 보일 때 대신 나올 글(선택)">'+
        '<input class="blk-artist" value="'+esc(blk.artist||'')+'" placeholder="그린 사람 · 화면에 작게 표시(선택)">'+
      '</div>'+ ctl;
  } else {
    d.classList.add('blk-text');
    d.innerHTML =
      '<div class="blk-body">'+
        '<div class="blk-fmtbar">'+
          '<button type="button" class="blk-fmt" data-mk="**" title="굵게 (글자 선택하고 누르기)"><b>B</b></button>'+
          '<button type="button" class="blk-fmt" data-mk="_" title="기울임 (글자 선택하고 누르기)"><i>I</i></button>'+
          '<button type="button" class="blk-fmt" data-mk="++" title="크게 (글자 선택하고 누르기)"><big>A</big></button>'+
          '<button type="button" class="blk-fmt" data-mk="~~" title="작게 (글자 선택하고 누르기)"><small>A</small></button>'+
        '</div>'+
        '<textarea class="blk-text-v" rows="4" placeholder="내용. 줄 맨 앞 # = 소제목, &gt; = 강조문, 엔터 한 번 = 줄바꿈, 엔터 두 번(빈 줄) = 문단 나눔(간격 큼). 글자 선택 후 위 B·I·A+·A-로 굵게·기울임·크게·작게. 코드는 ``` 로 위아래를 감싸면 코드블럭이 됨.">'+esc(blk.body)+'</textarea>'+
      '</div>'+ ctl;
    var ta = d.querySelector('.blk-text-v');
    Array.prototype.forEach.call(d.querySelectorAll('.blk-fmt'), function(btn){
      btn.onclick = function(){ wrapSelection(ta, btn.getAttribute('data-mk')); };
    });
  }
  function refreshCtl(){   // 첫/끝 블록은 그 방향 버튼 비활성(경계에서 더 못 움직이게)
    var items=Array.prototype.slice.call(list.children);
    items.forEach(function(row){
      row.querySelector('[data-act=up]').disabled   = (row===items[0]);
      row.querySelector('[data-act=down]').disabled = (row===items[items.length-1]);
    });
  }
  d.querySelector('[data-act=up]').onclick = function(){
    var prev=d.previousElementSibling; if(prev){ list.insertBefore(d, prev); refreshCtl(); render(); } };
  d.querySelector('[data-act=down]').onclick = function(){
    var next=d.nextElementSibling; if(next){ list.insertBefore(next, d); refreshCtl(); render(); } };
  d.querySelector('[data-act=del]').onclick = function(){ d.remove(); refreshCtl(); render(); };
  d._refreshCtl = refreshCtl;   // 추가 직후(blk-add) 새 목록 전체에 경계 상태 다시 매길 때 씀
  return d;
}
function proseRow(p){
  p = p || {};
  var d = document.createElement('div'); d.className = 'subcard prose-card';
  d.innerHTML =
    '<div class="row c2"><div><label>제목 (영문)</label><input class="p-title" value="'+esc(p.title)+'" placeholder="Appearance"></div>'+
    '<div><label>부제 (한글)</label><input class="p-sub" value="'+esc(p.sub)+'" placeholder="외관"></div></div>'+
    '<div class="blk-list"></div>'+
    '<div class="blk-add"><button type="button" class="sm blk-add-text">＋ 텍스트</button><button type="button" class="sm blk-add-img">＋ 그림</button></div>'+
    '<button class="del">✕ 삭제</button>';
  var list = d.querySelector('.blk-list');
  // 옛 데이터(블록 없이 body 하나뿐이던 시절)도 텍스트 블록 1개로 그대로 불러와짐(호환)
  var blocks = (p.blocks && p.blocks.length) ? p.blocks : [{ type:'text', body:p.body||'' }];
  function refreshAll(){ Array.prototype.forEach.call(list.children, function(row){ if(row._refreshCtl){ row._refreshCtl(); } }); }
  blocks.forEach(function(blk){ list.appendChild(blockRow(blk, list)); });
  refreshAll();
  d.querySelector('.del').onclick = function(){ d.remove(); render(); };
  d.querySelector('.blk-add-text').onclick = function(){ list.appendChild(blockRow({type:'text',body:''}, list)); refreshAll(); render(); };
  d.querySelector('.blk-add-img').onclick = function(){ list.appendChild(blockRow({type:'img',img:'',alt:''}, list)); refreshAll(); render(); };
  return d;
}
function extRow(e){
  e = e || {};
  var d = document.createElement('div'); d.className = 'subcard ext-card';
  d.innerHTML =
    '<div class="row c2"><div><label>제목</label><input class="e-title" value="'+esc(e.title)+'" placeholder="Voice"></div>'+
    '<div><label>부제</label><input class="e-sub" value="'+esc(e.sub)+'" placeholder="보이스"></div></div>'+
    '<div class="blk-list"></div>'+
    '<div class="blk-add"><button type="button" class="sm blk-add-text">＋ 텍스트</button><button type="button" class="sm blk-add-img">＋ 그림</button></div>'+
    '<label class="chk" style="justify-content:flex-start;margin-top:6px"><input type="checkbox" class="e-classified"'+(e.classified?' checked':'')+'> 🔒 기밀(CLASSIFIED)로 표시 <span class="note" style="display:inline">· 사이트에선 눌러야 내용이 보여요</span></label>'+
    '<button class="del">✕ 삭제</button>';
  var list = d.querySelector('.blk-list');
  // 서술카드와 같은 블록 목록(텍스트/그림) — ★옛 데이터(블록 없이 body 하나뿐이던 시절)도 텍스트 블록 1개로 그대로 불러와짐(호환)
  var blocks = (e.blocks && e.blocks.length) ? e.blocks : [{ type:'text', body:e.body||'' }];
  function refreshAll(){ Array.prototype.forEach.call(list.children, function(row){ if(row._refreshCtl){ row._refreshCtl(); } }); }
  blocks.forEach(function(blk){ list.appendChild(blockRow(blk, list)); });
  refreshAll();
  d.querySelector('.del').onclick = function(){ d.remove(); render(); };
  d.querySelector('.blk-add-text').onclick = function(){ list.appendChild(blockRow({type:'text',body:''}, list)); refreshAll(); render(); };
  d.querySelector('.blk-add-img').onclick = function(){ list.appendChild(blockRow({type:'img',img:'',alt:''}, list)); refreshAll(); render(); };
  return d;
}
// ★역할·부서 단일 출처 — ko(화면입력·프로필 idmeta용) + en(캐릭터 목록 표시용).
//   이 두 배열만 고치면 드롭다운·idmeta역파싱·영문변환이 모두 반영됨.
//   ⚠ 부서 영문명(en)은 '제안값'이니 원하는 표기로 자유롭게 고치세요.
//   ⚠ 부서 한글명은 서로 접두어가 되지 않게(예: 'A'와 'A팀' 동시 금지) — 역파싱이 앞에서 떼어냄.
var ROLES=[{ko:'드라이버',en:'DRIVER'},{ko:'히트맨',en:'HITMAN'},{ko:'오퍼레이터',en:'OPERATOR'}];
var DEPTS=[{ko:'보스',en:'BOSS'},{ko:'콘실리에리',en:'CONSIGLIERE'},{ko:'캡틴',en:'CAPTAIN'},{ko:'스키퍼',en:'SKIPPER'},
           {ko:'지휘팀',en:'CONTROL TEAM'},{ko:'실무팀',en:'EXECUTIVE TEAM'},{ko:'교육팀',en:'TRAINING TEAM'},
           {ko:'관리팀',en:'MANAGEMENT TEAM'},{ko:'연구 개발팀',en:'EXPERIMENT TEAM'},{ko:'정보팀',en:'INFORMATION TEAM'},{ko:'복지팀',en:'WELFARE TEAM'}];
(function fillSelects(){   // 역할·부서 드롭다운을 위 배열에서 생성(단일 출처)
  function fill(sel, list){ if(!sel) return; list.forEach(function(x){ var o=document.createElement('option'); o.textContent=x.ko; sel.appendChild(o); }); }
  fill($('#bi_role'), ROLES); fill($('#bi_dept'), DEPTS);
})();
function ko2en(ko){ var all=ROLES.concat(DEPTS); for(var i=0;i<all.length;i++) if(all[i].ko===ko) return all[i].en; return ko; }   // 한글→영문(목록용, 없으면 그대로)
// (부서+역할 합치기는 위 joinDeptRole 한 곳 — idmeta=공백결합, 목록=' · '결합·영문)
// 나이 표기 규칙(단일 출처): 숫자면 "24Y", 물음표 등 숫자가 아니면(=나이 미상) 그대로 "?" · 신원·목록 공용
function ageStr(a){ a=String(a||'').trim(); return a ? (/^\d+$/.test(a) ? a+'Y' : a) : ''; }
function assembleIdmeta(s){   // {age,height,bday,sector,dept,role} → "24Y · 164cm · 4/1 · 제1지부 캡틴 드라이버" (호출부 bodyObjOf가 세대데이터로 넘김)
  s = s || {};
  var parts=[]; if(s.age)parts.push(ageStr(s.age)); if(s.height)parts.push(s.height+'cm'); if(s.bday)parts.push(s.bday);
  var role=joinDeptRole(s.dept, s.role, ' ', false);
  var secLabel = s.sector==='etc' ? '무소속' : (s.sector ? '제'+s.sector+'지부' : '');
  var sr = secLabel + (role ? (secLabel?' ':'')+role : '');
  if(sr) parts.push(sr);
  return parts.join(' · ');
}
// 공백결합 "지휘팀 드라이버" 같은 문자열 앞의 부서(보스/캡틴/…팀)를 떼어낸다 — parseIdmeta·genDataFrom 공용.
function splitDeptFromRole(roleFull){
  var o={dept:'', role:roleFull||''};
  DEPTS.forEach(function(D){ var t=D.ko; if(o.role===t || o.role.indexOf(t+' ')===0){ o.dept=t; o.role=o.role.slice(t.length).trim(); } });
  return o;
}
function parseIdmeta(str){   // 역분해(옛 포맷 idmeta 문자열을 불러올 때만 씀 — 새로 저장하는 파일은 age/height/bday/sector/role을 각각 저장)
  var o={age:'',height:'',bday:'',sector:'',role:'',dept:''};
  String(str||'').split('·').forEach(function(p){ p=p.trim(); if(!p)return; var m;
    if(m=p.match(/^(\d+)\s*Y$/i)) o.age=m[1];
    else if(!o.age && /^\?+$/.test(p)) o.age=p;   // 나이 미상 "?"/"??" → 나이로 (역할칸으로 새는 것 방지)
    else if(m=p.match(/^(\d+)\s*cm$/i)) o.height=m[1];
    else if(m=p.match(/^무소속\s*(.*)$/)){ o.sector='etc'; o.role=(m[1]||'').trim(); }
    else if(m=p.match(/^제\s*(\d+)\s*지부\s*(.*)$/)){ o.sector=m[1]; o.role=(m[2]||'').trim(); }
    else if(!o.bday && /[\d/]/.test(p)) o.bday=p;   // 생일은 숫자 포함(예: 4/1)
    else if(!o.role) o.role=p;                       // 지부 없이 역할/부서만 있으면 역할로(생일칸에 새는 것 방지)
  });
  var spl = splitDeptFromRole(o.role); o.dept=spl.dept; o.role=spl.role;
  return o;
}
function md(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/_([^_]+)_/g,'<i>$1</i>')
  .replace(/\+\+([^+]+)\+\+/g,'<big>$1</big>').replace(/~~([^~]+)~~/g,'<small>$1</small>')
  .replace(/==([^=]+)==/g,'<span class="faint">$1</span>'); }   // **굵게** · _기울임_ · ++크게++ · ~~작게~~ · ==회색글자==
// 여러 줄(문단 안 줄바꿈으로 묶인 것)을 한 덩어리로 보고 서식 적용 — 한 줄씩 따로 md()를 걸면 **여는쪽**과 **닫는쪽**이
// 서로 다른 줄에 있을 때(엔터로 줄바꿈한 가운데에서 서식이 걸쳐질 때) 짝을 못 찾아 별표가 그대로 글자로 남는다.
// → 줄바꿈을 임시로 \n 그대로 둔 채 통째로 서식 적용한 뒤, 맨 마지막에만 \n을 <br>로 바꿔치기(<br> 도입 전에 서식 매칭부터).
function mdBlock(lines){ return md(lines.join('\n')).replace(/\n/g,'<br>'); }
function proseToHtml(text, ind){       // 줄 맨앞 # = 소제목, > = 강조문(lead), ``` = 코드블럭, 빈 줄 = 문단, **텍스트** = 굵게, 문단 안 줄바꿈은 그대로 <br>
  var lines = String(text||'').split('\n'), out=[], para=[], lead=[], blanks=0;
  function flushPara(){ if(para.length){ out.push(ind+'<p>'+mdBlock(para)+'</p>'); para=[]; } }   // 한 번 엔터=<br>(붙어보임), 빈 줄=새 문단(간격 큼)
  function flushLead(){ if(lead.length){ out.push(ind+'<p class="lead">'+mdBlock(lead)+'</p>'); lead=[]; } }   // > 줄들 = 강조문(줄바꿈은 <br>)
  function flush(){ flushLead(); flushPara(); }
  var i=0, n=lines.length;
  while(i<n){
    var ln=lines[i], t=ln.trim();
    if(t.slice(0,3)==='```'){
      // 코드블럭: 여는 ``` 뒤에 언어이름(선택, 예: ```python) — 비우면 화면에서 자동판별(hljs).
      //   닫는 ``` 까지는 #/>/**같은 서식 규칙을 전혀 안 걸고 원문 그대로 둔다(코드 안에 별표 등이 서식으로 오작동하면 안 되니까).
      flush();
      var lang = t.slice(3).trim();
      var code = []; i++;
      while(i<n && lines[i].trim()!=='```'){ code.push(lines[i]); i++; }
      i++;   // 닫는 ``` 줄(또는 안 닫고 끝난 경우 그대로) 건너뛰기
      out.push(ind+'<pre class="p-code"><code'+(lang?' class="language-'+esc(lang)+'"':'')+'>'+esc(code.join('\n'))+'</code></pre>');
      blanks = 0;
      continue;
    }
    if(t===''){
      blanks++;
      if(blanks===1) flush();                          // 첫 빈 줄 = 그냥 문단 구분(예전과 동일)
      else out.push(ind+'<p><br></p>');                 // 그 다음 빈 줄부터는 사용자가 일부러 준 여백 한 칸 → 그대로 보존
    } else {
      blanks = 0;
      if(t.charAt(0)==='#'){ flush(); out.push(ind+'<h4>'+md(t)+'</h4>'); }
      else if(t.charAt(0)==='>'){ flushPara(); lead.push(t.replace(/^>\s?/,'')); }   // > = 강조문(lead)
      else { flushLead(); para.push(t); }
    }
    i++;
  }
  flush(); return out.join('\n');
}
// 신원(namehead)+사원증(idcard) HTML — _layouts/character.html 이 실제 사이트에서 그리는 것과 '같은 모양'(두 번째 거울).
//   레이아웃이 없는 미리보기(iframe)·라이브패치에서만 씀. ★모양을 바꾸면 _layouts/character.html 도 똑같이 바꿀 것!
// gid: 세대 구분 미리보기에서 여러 세대의 사원증이 동시에 DOM에 존재할 때 id 충돌 방지용.
//   editable(=지금 보이는 세대)이면 실제 사이트와 똑같은 고정 id(idScanToggle/idScan) — profile.js 스캔토글 스크립트가
//   이 id를 그대로 찾으므로 보이는 세대는 반드시 이 id를 써야 함. 숨은(비대표) 세대만 gid로 접미사를 붙여 구분.
function buildIdentity(b, editable, gid){
  var ed=function(k){ return editable? ' contenteditable="true" data-edit="'+k+'"' : ''; };
  var idSuf = editable ? '' : ('-'+(gid!=null?gid:'x'));
  var L=[];
  L.push('      <div class="namehead span2">');
  // 부제는 비어 있으면 아예 안 그림(카드에서 직접 편집 안 하고 ✎ 팝오버 전용이라, 빈 칸 안내글도 필요 없음).
  if(b.eyebrow) L.push('        <div class="eyebrow">'+esc(b.eyebrow)+'</div>');
  // 이름·성·기록번호는 전부 구조적인 값(슬러그·경로에 쓰임)이라 카드에서 직접 타이핑하지 않고 옆 ✎ 팝오버에서만 고친다.
  var krSur = b.krsur ? ' '+esc(b.krsur) : '';
  L.push('        <div class="kr">'+esc(b.krname)+krSur+(b.enname?' <span class="en">'+esc(b.enname)+'</span>':'')+'</div>');
  // idmeta(나이·키·생일·소속)는 roster+생일+부서·역할에서 매번 계산되는 값이라 여기서 직접 고칠 수 없게 함
  //   (예전엔 이 줄도 contenteditable이라 자유롭게 고칠 수 있었는데, 형식이 조금만 달라도 parseIdmeta가
  //   조용히 정보를 잃어버렸음) — ✎ 팝오버 하나가 부제·한글 이름·성·영문 이름·성·기록번호·나이·키·생일·소속·부서·역할을 전부 관리.
  if(editable || b.idmeta) L.push('        <div class="idmeta">'+(b.idmeta?esc(b.idmeta):(editable?'<span class="idmeta-empty">정보 없음</span>':''))+(editable?'<button type="button" class="idmeta-edit" title="부제·이름·기록번호·나이·키·생일·소속·부서·역할 수정">✎</button>':'')+'</div>');
  if(editable || b.quote) L.push('        <div class="quote"'+ed('quote')+'>'+esc(b.quote)+'</div>');
  L.push('      </div>');
  if(b.idcardOn){
    L.push('');
    L.push('      <div class="card span2 idcard">');
    L.push('        <div class="card-h"><span class="idx">ID</span><h3>Agent Pass</h3><span class="kr-sub">사원증 · 인증 기록</span><button class="fx-toggle mono" id="idScanToggle'+idSuf+'" type="button" title="사원증 스캔 효과 끄기/켜기">SCAN ON</button></div>');
    L.push('        <div class="idcard-b"><div class="idcard-stage">');
    L.push('          <span class="idc-corner tl"></span><span class="idc-corner tr"></span><span class="idc-corner bl"></span><span class="idc-corner br"></span>');
    L.push('          <img src="'+esc(b.idimg)+'" alt="'+esc((b.krname||'')+' 사원증')+'"'+(editable?' class="idc-imgpick" data-imgpick="idimg" title="클릭해서 사원증 이미지 바꾸기"':'')+'>');
    L.push('          <span class="idc-scan" id="idScan'+idSuf+'"></span><span class="idc-stamp">● AUTHENTICATED</span>');
    L.push('        </div><div class="idc-meta">');
    L.push('          <span>RETRIEVED · <b>'+esc(b.idsource||'CENTRAL DATABASE')+'</b></span>');
    L.push('          <span>ID · <b>'+esc(b.idrecord)+'</b></span>');
    L.push('          <span>STATUS · <b class="ok"'+ed('idstatus')+'>'+esc(b.idstatus||'ACTIVE')+'</b></span>');
    if(editable || b.idartist) L.push('          <span>@<b'+ed('idartist')+'>'+esc(b.idartist)+'</b></span>');
    L.push('        </div></div>');
    L.push('      </div>');
  }
  return L.join('\n');
}
// 서술카드에 실제 내용(글 또는 그림)이 있나 — buildBody(빈 카드 숨김)·isWritten 공용. (확장카드도 blocks를 쓰므로 같이 재사용)
function proseHasContent(p){ return (p.blocks||[]).some(function(b){ return b.type==='img' ? !!b.img : !!String(b.body||'').trim(); }); }
// 블록 목록(텍스트/그림) → 카드 안 마크업 줄들 — 서술카드·확장카드가 이 함수 하나를 공유(단일 출처).
//   블록 마크업을 두 카드 종류에 따로 두면 바꿀 때 한쪽만 고치고 다른 쪽을 놓치기 쉬워 하나로 합쳤다.
//   key = 이 카드를 가리키는 접두어('prose:0'/'ext:1', 콜론 없이) · ind = 블록 한 칸의 들여쓰기(호출부가 감싸는 div보다 한 단계 깊게).
function blocksToHtml(blocks, key, ind, editable){
  var L=[];
  blocks.forEach(function(blk, bi){
    if(blk.type==='img'){
      if(!blk.img && !editable) return;   // 저장용에선 아직 파일 안 고른 빈 그림 블록 생략
      if(editable) L.push(ind+'<div class="blk-wrap">');
      L.push(ind+'<figure class="p-fig">');
      // alt 빈칸이면 카드 제목으로 대신 채우지 않고 그냥 빈 채로 둔다 — 채워두면 저장 후 불러올 때
      //   '사용자가 실제로 입력한 값'과 구별이 안 돼서 다시 빈칸으로 되돌릴 방법이 없어진다.
      L.push(ind+'  <img src="'+(blk.img?esc(blk.img):PH_IMG)+'" alt="'+esc(blk.alt||'')+'">');
      // 그림 작가 크레딧(선택) — 저장용은 값 있을 때만 태그 자체를 넣음(빈 태그 안 남김). 편집용은 늘 넣어 클릭해서 채울 수 있게.
      if(editable) L.push(ind+'  <figcaption contenteditable="true" data-edit="'+key+':artist:'+bi+'">'+esc(blk.artist||'')+'</figcaption>');
      else if(blk.artist) L.push(ind+'  <figcaption>'+esc(blk.artist)+'</figcaption>');
      L.push(ind+'</figure>');
      // "이미지 바꾸기" 버튼은 그림 위에 안 덮이게 그림 밖(아래)에 따로 둔다 — 사진 위에 겹치면
      //   최종 화면이 어떻게 보일지 미리보기에서 가려진다.
      if(editable) L.push(ind+'  <button type="button" class="img-pick" data-imgpick="'+key+':'+bi+'">📁 이미지 바꾸기</button>');
      if(editable){
        L.push(ind+'<div class="p-alt" contenteditable="true" data-edit="'+key+':alt:'+bi+'">'+esc(blk.alt||'')+'</div>');
        L.push(ind+'<div class="blk-ctl2"><button type="button" data-blkmove="'+key+':'+bi+':up" title="위로">↑</button><button type="button" data-blkmove="'+key+':'+bi+':down" title="아래로">↓</button><button type="button" data-blkmove="'+key+':'+bi+':del" title="삭제">✕</button></div>');
        L.push(ind+'</div>');
      }
    } else {
      var bd = proseToHtml(blk.body, '            ');
      if(editable) L.push(ind+'<div class="blk-wrap">');
      var edAttr = editable ? ' contenteditable="true" data-edit="'+key+':text:'+bi+'"' : '';
      L.push(ind+'<div class="p-blk"'+edAttr+'>'+(bd?('\n'+bd+'\n'+ind):'')+'</div>');
      if(editable){
        L.push(ind+'<div class="blk-ctl2"><button type="button" data-blkmove="'+key+':'+bi+':up" title="위로">↑</button><button type="button" data-blkmove="'+key+':'+bi+':down" title="아래로">↓</button><button type="button" data-blkmove="'+key+':'+bi+':del" title="삭제">✕</button></div>');
        L.push(ind+'</div>');
      }
    }
  });
  return L;
}
// 확장카드(.acc-b) 안쪽 — 서술카드(card-b prose)와 완전히 같은 블록(텍스트/그림) 규칙, 감싸는 태그만 다름.
//   그림 없는 기본형(대다수)은 예전과 같은 한 줄 압축 마크업, 그림이 섞이면 서술카드처럼 블록별 여러 줄로.
function extBodyHtml(e, i, editable){
  var ed=function(k){ return editable? ' contenteditable="true" data-edit="'+k+'"' : ''; };
  var blocks = (e.blocks && e.blocks.length) ? e.blocks : [{ type:'text', body:e.body||'' }];
  if(blocks.length===1 && blocks[0].type==='text'){
    var flat = proseToHtml(blocks[0].body, '').replace(/\n/g,'');
    return '<div class="acc-b"'+ed('ext:'+i+':body')+'>'+flat+'</div>';
  }
  // L2[0]는 앞에 공백을 안 둔다 — 확장카드 전체가 <details>...한 줄로 이어붙는데, 앞에 공백이 있으면
  //   "</summary><div class=\"acc-b\">"를 정확히 찾는 불러오기 정규식(parseBody)이 못 찾아 확장카드가 통째로 사라진다.
  var L2=['<div class="acc-b">'].concat(blocksToHtml(blocks, 'ext:'+i, '        ', editable));
  L2.push('      </div>');
  return L2.join('\n');
}
/* ---------- 본문(카드): 능력치·서술·확장 → HTML. 신원/사원증은 위 buildIdentity(+레이아웃) 담당 ---------- */
function buildBody(b, hasStats, editable){
  var ed=function(k){ return editable? ' contenteditable="true" data-edit="'+k+'"' : ''; };
  var L=[];
  if(b.statOn && hasStats){
    L.push('      <div class="card span2">');
    L.push('        <div class="card-h"><span class="idx">STAT</span><h3>Combat Stats</h3><span class="kr-sub">능력치</span></div>');
    L.push('        <div class="statbars"></div>');   // 세대별 프로필 = class만(id 없음) · profile.js 가 이 패널의 .statbars 에 능력치 그림
    L.push('      </div>');
  }
  b.proses.forEach(function(p, idx){
    if(!editable && !p.title && !p.sub && !proseHasContent(p)) return;
    L.push('');
    L.push('      <div class="card span2">');
    L.push('        <div class="card-h"><span class="idx">◆</span><h3'+ed('prose:'+idx+':title')+'>'+esc(p.title)+'</h3><span class="kr-sub"'+ed('prose:'+idx+':sub')+'>'+esc(p.sub)+'</span>'+(editable?'<button type="button" class="card-del" data-carddel="'+idx+'" title="이 서술카드 삭제">✕</button>':'')+'</div>');
    var blocks = (p.blocks && p.blocks.length) ? p.blocks : [{ type:'text', body:'' }];
    if(blocks.length===1 && blocks[0].type==='text'){
      // 그림 없는 기본형(대다수 카드) — 예전과 완전히 같은 마크업으로(빈 카드 안내문구 등 호환 유지)
      L.push('        <div class="card-b prose"'+ed('prose:'+idx+':body')+'>');
      var body = proseToHtml(blocks[0].body, '          '); if(body) L.push(body);
      L.push('        </div>');
    } else {
      // 그림이 섞인 카드 — 블록마다(텍스트=문단 묶음 / 그림=figure) 순서대로. blocksToHtml이 확장카드와 공용(단일 출처).
      // 편집 모드(미리보기)에서는 그림 선택·설명(alt)·순서변경(↑↓)·삭제(✕)도 이 자리에서 바로(왼쪽 폼과 통합).
      //   저장용(editable=false)은 예전과 완전히 같은 마크업 — blk-wrap/버튼류는 편집모드에서만 추가.
      L.push('        <div class="card-b prose">');
      L = L.concat(blocksToHtml(blocks, 'prose:'+idx, '          ', editable));
      L.push('        </div>');
    }
    if(editable){   // 미리보기에서 바로 이 카드에 블록 추가(왼쪽 폼의 +텍스트/+그림 버튼과 동일한 동작, parent.pvAdd 경유)
      L.push('        <div class="p-add"><button type="button" data-add="prose-text:'+idx+'">＋ 텍스트</button><button type="button" data-add="prose-img:'+idx+'">＋ 그림</button></div>');
    }
    L.push('      </div>');
  });
  var exts = editable ? b.exts : b.exts.filter(function(e){ return e.title||e.sub||proseHasContent(e); });
  if(exts.length){
    L.push('');
    L.push('      <div class="ext-h"><span class="idx">＋</span><h3>Extended</h3><span class="kr-sub">확장 기록</span></div>');
    exts.forEach(function(e, i){
      var cls = 'acc'+(e.classified?' classified':'');
      var accBody = extBodyHtml(e, i, editable);   // ← 확장카드도 서술카드처럼 텍스트/그림 블록 지원
      if(editable){
        // 편집화면(툴 미리보기)은 항상 열어서 그대로 편집 — '기밀'은 숨기지 않고, 클릭으로 켜고 끄는 자물쇠 버튼으로 표시
        var lockBtn = '<button type="button" class="acc-lock-tog'+(e.classified?' on':'')+'" data-extlock="'+i+'" title="기밀(CLASSIFIED)로 표시 — 실제 사이트에선 클릭 전까지 가려짐. 눌러서 켜고 끄기">🔒</button>';
        L.push('      <details class="'+cls+'" open><summary>'+lockBtn+'<span'+ed('ext:'+i+':title')+'>'+esc(e.title)+'</span> <span class="kr-sub"'+ed('ext:'+i+':sub')+'>'+esc(e.sub)+'</span><button type="button" class="card-del" data-extdel="'+i+'" title="이 확장 카드 삭제">✕</button></summary>'+accBody+
          '<div class="p-add"><button type="button" data-add="ext-text:'+i+'">＋ 텍스트</button><button type="button" data-add="ext-img:'+i+'">＋ 그림</button></div></details>');
      } else if(e.classified){
        // 실제 사이트: 닫혀 있을 땐 가려진 라벨만, 열면 진짜 제목·부제(acc-real)가 드러남(CSS가 토글)
        L.push('      <details class="'+cls+'"><summary><span class="acc-lock">CLASSIFIED · 눌러서 확인</span><span class="acc-real">'+esc(e.title)+(e.sub?' <span class="kr-sub">'+esc(e.sub)+'</span>':'')+'</span></summary>'+accBody+'</details>');
      } else {
        L.push('      <details class="'+cls+'"><summary>'+esc(e.title)+(e.sub?' <span class="kr-sub">'+esc(e.sub)+'</span>':'')+'</summary>'+accBody+'</details>');
      }
    });
  }
  if(editable){
    L.push('');
    L.push('      <div class="pb-add span2"><button type="button" data-add="prose">＋ 서술카드</button><button type="button" data-add="ext">＋ 확장 서술카드</button></div>');
  }
  return L.join('\n');
}

/* ---------- 본문: HTML → 구조화 폼 (불러오기 역파싱) ---------- */
function stripTags(s){ return String(s||'').replace(/​/g,'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'')
  // ★&amp; 되돌리기(줄 끝) → 그 결과로 새로 드러나는 &nbsp;까지 마저 진짜 공백으로(브라우저가 contenteditable에 종종 심는 &nbsp;가
  //   여기서 안 풀리면 다음에 다시 esc()될 때 &amp;nbsp; 문자가 그대로 화면에 찍힘 — 이중이스케이프 방지).
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim(); }
function htmlToProse(inner){       // <p>/<h4>/<div> → 텍스트(문단=빈줄, 소제목=#, 굵게 <b>→**, 기울임 <i>→_, 크게 <big>→++, 작게 <small>→~~)
  var s = String(inner||'').replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi,'**$1**')     // 굵게 역변환
                            .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi,'**$1**')
                            .replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi,'_$1_')       // 기울임 역변환
                            .replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi,'_$1_')
                            .replace(/<big\b[^>]*>([\s\S]*?)<\/big>/gi,'++$1++')     // 크게 역변환
                            .replace(/<small\b[^>]*>([\s\S]*?)<\/small>/gi,'~~$1~~')  // 작게 역변환
                            .replace(/<span class="faint">([\s\S]*?)<\/span>/gi,'==$1==');  // 회색글자 역변환
  var lines=[], re=/<(p|h4|div)\b[^>]*>([\s\S]*?)<\/\1>|<pre\b[^>]*class="[^"]*\bp-code\b[^"]*"[^>]*><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi, m, any=false;
  // 블록 사이엔 빈 줄 하나(문단 구분 신호)를 직접 쌓는다 — join('\n\n')으로 뭉뚱그려 붙이면
  //   "빈 문단(사용자가 일부러 준 여백)"까지 있을 때 줄 수가 안 맞는다.
  function sep(){ if(lines.length) lines.push(''); }
  while(m=re.exec(s)){ any=true;
    if(m[1]==null){   // 코드블럭(pre.p-code>code) 매치 — m[3]=code 태그 속성, m[4]=코드 내용(문법강조 후엔 <span>이 섞여 있을 수 있어 태그부터 벗겨냄)
      var langM=/language-([^\s"]+)/.exec(m[3]||''), langName=langM?langM[1]:'';
      var codeTxt=m[4].replace(/<[^>]+>/g,'')
        .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
      sep(); lines.push('```'+langName); lines=lines.concat(codeTxt.split('\n')); lines.push('```');
      continue;
    }
    var tag=m[1].toLowerCase(), full=m[0], innerC=m[2];
    if(tag==='p' && /class="[^"]*\blead\b/.test(full)){   // <p class="lead"> = 강조문 → > 줄들로(내부 <br>=줄바꿈)
      var lead=innerC.replace(/<br\s*\/?>/gi,'\n').split('\n').map(stripTags).filter(Boolean).map(function(l){ return '> '+l; });
      if(!lead.length) continue;
      sep(); lines=lines.concat(lead); continue;
    }
    if(tag==='p'){
      // 일반 문단은 내부 <br>을 줄바꿈으로 되살림(한 번 엔터=문단 안 줄바꿈, proseToHtml과 대칭).
      var t = innerC.replace(/<br\s*\/?>/gi,'\n').split('\n').map(stripTags).join('\n');
      if(!t.trim()){ sep(); continue; }   // ★빈 문단(<p><br></p>) = 사용자가 일부러 넣은 여백 한 칸 → 빈 줄로 보존(예전엔 그냥 버려서 저장할 때 사라졌음)
      sep(); lines=lines.concat(t.split('\n')); continue;
    }
    var t2 = stripTags(innerC);   // h4/div는 한 줄이라 그대로
    if(!t2.trim()) continue;
    sep(); lines.push(tag==='h4' ? (t2.charAt(0)==='#'?t2:'#'+t2) : t2);
  }
  if(!any){   // 태그 없는 순수 텍스트/<br>만 있는 경우 → 줄 단위 (내용 유실 방지)
    stripTags(s.replace(/<br\s*\/?>/gi,'\n')).split('\n').forEach(function(l){ l=l.trim(); if(l) lines.push(l); });
  }
  return lines.join('\n');
}
// 서술카드 본문 → 블록 배열(텍스트/그림). 그림이 섞인 새 포맷은 <div class="p-blk">/<figure class="p-fig">가 나란히 있고,
// 그림 없는 옛 포맷(대다수)은 <p>/<h4>가 블록 감쌈 없이 바로 있음 → 그 경우 텍스트 블록 하나로.
function htmlToProseBlocks(inner){
  inner = String(inner||'');
  var blocks=[], re=/<div class="p-blk"[^>]*>([\s\S]*?)<\/div>|<figure class="p-fig"[^>]*>([\s\S]*?)<\/figure>/gi, m, any=false;
  while(m=re.exec(inner)){
    any=true;
    if(m[2]!=null){   // figure 블록 = 그림
      var imgTag=(m[2].match(/<img\b[^>]*>/i)||[''])[0];
      var src=(imgTag.match(/\ssrc="([^"]*)"/i)||['',''])[1];
      var alt=(imgTag.match(/\salt="([^"]*)"/i)||['',''])[1];
      var artistTag=(m[2].match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)||['',''])[1];
      blocks.push({ type:'img', img:src, alt:stripTags(alt), artist:stripTags(artistTag) });
    } else {          // p-blk 블록 = 텍스트
      blocks.push({ type:'text', body:htmlToProse(m[1]) });
    }
  }
  if(!any) blocks.push({ type:'text', body:htmlToProse(inner) });   // 옛 포맷(블록 나눔 없음) = 텍스트 블록 하나
  return blocks;
}
function pickBody(html, re){ var m=(html||'').match(re); return m? m[1] : ''; }
function parseBody(html){
  html = String(html||'').replace(/<!--[\s\S]*?-->/g,'');   // 주석(비활성 내용) 무시
  var b={ proses:[], exts:[] };
  var nh = pickBody(html, /<div class="namehead[^"]*"[^>]*>([\s\S]*?)(?=<div class="card|<div class="ext-h|$)/);
  b.eyebrow = stripTags(pickBody(nh, /<div class="eyebrow">([\s\S]*?)<\/div>/));
  var kr = pickBody(nh, /<div class="kr">([\s\S]*?)<\/div>/);
  b.enname = stripTags(pickBody(kr, /<span class="en">([\s\S]*?)<\/span>/));
  b.krname = stripTags(kr.replace(/<span class="en">[\s\S]*?<\/span>/,''));
  b.idmeta = stripTags(pickBody(nh, /<div class="idmeta">([\s\S]*?)<\/div>/));
  b.quote  = stripTags(pickBody(nh, /<div class="quote">([\s\S]*?)<\/div>/));
  b.idcardOn = /class="[^"]*\bidcard\b[^"]*"/.test(html);
  if(b.idcardOn){
    b.idimg    = pickBody(html, /idcard-stage[\s\S]*?<img[^>]*\ssrc="([^"]*)"/);
    b.idsource = stripTags(pickBody(html, /RETRIEVED[\s\S]*?<b>([\s\S]*?)<\/b>/));
    b.idstatus = stripTags(pickBody(html, /STATUS[\s\S]*?<b[^>]*>([\s\S]*?)<\/b>/));
  }
  b.statOn = /class="statbars"/.test(html);   // 능력치 카드 유무(신·구 포맷 모두: class 로 판별)
  // ★뒤쪽 두 </div>(prose 닫기+card 닫기) 뒤에 '다음 카드/확장/추가버튼/끝'이 오는지 확인(lookahead, nh 파싱과 동일 기법)
  //   그림 블록(.p-blk)이 카드의 마지막 자식이면 그 블록 자신의 </div>까지 합쳐 "</div></div>"가 세 번 연달아 나와
  //   lookahead 없이는 실제 카드 끝보다 한 칸 앞에서 잘못 멈춘다.
  var pre=/<div class="card span2">\s*<div class="card-h">[\s\S]*?<h3>([^<]*)<\/h3><span class="kr-sub">([^<]*)<\/span><\/div>\s*<div class="card-b prose">([\s\S]*?)<\/div>\s*<\/div>(?=\s*(?:<div class="card|<div class="ext-h|<div class="pb-add|$))/g, pm;
  while(pm=pre.exec(html)){ b.proses.push({ title:stripTags(pm[1]), sub:stripTags(pm[2]), blocks:htmlToProseBlocks(pm[3]) }); }
  // \s* 를 앞뒤에 둬서 acc-b 여는/닫는 태그 주변에 줄바꿈·공백이 섞여도 안전하게.
  var ere=/<details class="acc( classified)?"><summary>([\s\S]*?)<\/summary>\s*<div class="acc-b">([\s\S]*?)<\/div>\s*<\/details>/g, em;
  while(em=ere.exec(html)){
    var isC=!!em[1], sum=em[2], title, sub;
    if(isC){   // '기밀' 카드 = 진짜 제목·부제가 summary 맨 끝의 acc-real 안에 있음(acc-lock 라벨은 무시)
      var real=pickBody(sum, /<span class="acc-real">([\s\S]*)<\/span>\s*$/);
      sub=stripTags(pickBody(real, /<span class="kr-sub">([\s\S]*?)<\/span>/));
      title=stripTags(real.replace(/<span class="kr-sub">[\s\S]*?<\/span>/,''));
    } else {
      sub=stripTags(pickBody(sum, /<span class="kr-sub">([\s\S]*?)<\/span>/));
      title=stripTags(sum.replace(/<span class="kr-sub">[\s\S]*?<\/span>/,''));
    }
    b.exts.push({ title:title, sub:sub, blocks:htmlToProseBlocks(em[3]), classified:isC });
  }
  return b;
}
/* ---------- 상태 → front matter YAML ---------- */
function q(s){ return '"' + String(s).replace(/"/g,'\\"') + '"'; }
function flowMeta(m){
  var parts = [];
  ['title','record','crumb','sector','code','id'].forEach(function(k){
    if(m[k]) parts.push(k+': '+q(m[k]));
  });
  return '{ '+parts.join(', ')+' }';
}
function flowWard(w){
  var p = ['cap: '+q(w.cap||''), 'img: '+q(w.img||'')];
  if(w.artist) p.push('artist: '+q(w.artist));
  if(w.on) p.push('"on": true');
  WARD_SZ.forEach(function(k){ if(w[k]) p.push(k+': '+q(w[k])); });   // 위치/크기 미세조정값(있을 때만)
  return '{ '+p.join(', ')+' }';
}
function flowStats(rows){ return '['+(rows||[]).map(function(s){ return '['+q(s[0])+', '+s[1]+(s[2]!=null?', '+s[2]:'')+']'; }).join(', ')+']'; }
function flowGen(g){
  var p = ['id: '+q(g.id), 'label: '+q(g.label||''), 'sub: '+q(g.sub||''), 'img: '+q(g.img||'')];
  if(g.main) p.push('main: true');
  if(g.accent) p.push('accent: '+q(g.accent));
  if(g.accent_light) p.push('accent_light: '+q(g.accent_light));
  if(g.accent2) p.push('accent2: '+q(g.accent2));
  if(g.accent2_light) p.push('accent2_light: '+q(g.accent2_light));
  if(g.effect && g.effect.length) p.push('effect: ['+g.effect.map(toFlow).join(', ')+']');
  // 작성된 '비대표' 세대는 자기 meta/stats/wardrobe 도 함께(페이지가 세대 전환 시 그 세대로 다시 그림). 대표는 top-level 폴백이라 생략.
  if(g.meta) p.push('meta: '+flowMeta(g.meta));
  if(g.stats) p.push('stats: '+flowStats(g.stats));
  if(g.wardrobe) p.push('wardrobe: ['+g.wardrobe.map(flowWard).join(', ')+']');
  return '{ '+p.join(', ')+' }';
}
function buildFM(st){
  var L = [];
  L.push('layout: character');
  if(st.accent) L.push('accent: '+q(st.accent));
  if(st.accentLight) L.push('accent_light: '+q(st.accentLight));
  if(st.accent2) L.push('accent2: '+q(st.accent2));               // 대표색 2번째 색(그라데이션 끝색) · 레이아웃이 --accent2 로 씀
  if(st.accent2Light) L.push('accent2_light: '+q(st.accent2Light));
  if(st.statPlus) L.push('stat_plus: '+q(st.statPlus));           // +증가분 막대 색 · 레이아웃이 --stat-plus 로 씀
  if(st.art) L.push('art: '+q(st.art));
  if(st.artArtist) L.push('art_artist: '+q(st.artArtist));
  if(st.artAlt) L.push('art_alt: '+q(st.artAlt));
  L.push('meta: '+flowMeta(st.meta));
  // roster: 목록(characters.html) 표시용 요약 = 대표 세대에서 파생(공통). collect의 rosterOf가 만듦.
  var R=st.roster||{}, rp=[];
  if(R.ko) rp.push('ko: '+q(R.ko));
  if(R.role) rp.push('role: '+q(R.role));
  if(R.age) rp.push('age: '+q(R.age));
  if(R.height!=null) rp.push('height: '+R.height);
  rp.push('sec: '+(/^\d+$/.test(String(R.sec))? R.sec : q(R.sec||'etc')));
  L.push('roster: { '+rp.join(', ')+' }');
  // 신원·사원증: 레이아웃(_layouts/character.html)이 이 데이터로 신원/사원증을 그림 → 본문엔 카드만 남음.
  // 나이·키·소속은 위 roster에 이미 있으므로 여기 안 둠(레이아웃이 roster+bday+role로 idmeta 한 줄을 조립).
  var NH=st.namehead||{}, nhp=['eyebrow: '+q(NH.eyebrow||''), 'kr: '+q(NH.kr||''), 'en: '+q(NH.en||'')];
  if(NH.bday) nhp.push('bday: '+q(NH.bday));
  if(NH.role) nhp.push('role: '+q(NH.role));
  if(NH.quote) nhp.push('quote: '+q(NH.quote));
  L.push('namehead: { '+nhp.join(', ')+' }');
  if(st.idcard) L.push('idcard: { img: '+q(st.idcard.img||'')+', status: '+q(st.idcard.status||'ACTIVE')+' }');
  if(st.stats.length){
    L.push('stats:');
    st.stats.forEach(function(s){ L.push('  - ['+q(s[0])+', '+s[1]+(s[2]!=null?', '+s[2]:'')+']'); });
  } else { L.push('stats: []'); }
  if(st.wardrobe.length){
    L.push('wardrobe:');
    st.wardrobe.forEach(function(w){ L.push('  - '+flowWard(w)); });
  }
  if(st.generations.items.length){
    L.push('generations:');
    L.push('  current: '+q(st.generations.current||''));
    L.push('  items:');
    st.generations.items.forEach(function(g){ L.push('    - '+flowGen(g)); });
  }
  return L.join('\n');
}
function buildFile(st){ return '---\n'+buildFM(st)+'\n---\n'+st.body+'\n'; }

