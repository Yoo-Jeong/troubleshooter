"use strict";
/* ============================================================
   프로필 작성 툴 — 기본 유틸 · 전역 상태 · 불러오기
   ------------------------------------------------------------
   문자열 유틸(esc/slugify) · TOOL_ROSTER 등 전역 변수 · SECTORS/THEME ·
   YAML-flow 미니파서 · front matter 파싱(applyData/loadCharacter) ·
   폼 동적 행(statRow/wardRow) · 세대 폼 읽기·쓰기(readGen/writeGen/blankGen).
   이 파일이 다른 5개 profile-builder-*.js보다 먼저 로드된다(profile-builder.html 참고).
   ============================================================ */
var $ = function(s){ return document.querySelector(s); };
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }  // HTML 속성 안전
function slugify(s){ return String(s||'').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,''); }  // 폴더/URL 안전 slug(영문 소문자·숫자·-)
function joinName(g, s){ g=String(g||'').trim(); s=String(s||'').trim(); return s ? (g? g+' '+s : s) : g; }  // 이름+성 합치기(빈 값이면 앞 공백 안 생기게)
var TOOL_ROSTER = [];   // syncLoadList가 채움: [{slug,id,ko,ht}] — 기록번호 자동 제안·중복 검사·라인업 비교용
var TOOL_ROSTER_READY = null;   // syncLoadList가 만듦 — 저장/제출 전 반드시 이 프로미스를 기다려야 TOOL_ROSTER가 다 채워진 뒤 중복 검사가 됨
var WAS_NEW = false;    // ?new=1(새 캐릭터)로 진입했는지
var LOADED_ROSTER = null;  // 편집 모드로 불러온 캐릭터의 roster(목록용 역할 등 보존)
var LOADED_SLUG = null;    // 불러온 캐릭터 슬러그(덮어쓰기 경고 판단)
// 지부 → 상단바 '소속' 표기(단일 출처: 지부 드롭다운 하나가 목록 sec·상단바 sector 모두 결정)
// ★지부 단일 출처 — v(저장값)·ko(드롭다운 표시)·label(상단바 소속=meta.sector 표기). 이 배열만 고치면 드롭다운·소속표기 함께 반영.
var SECTORS=[
  {v:'1',   ko:'제1지부 · HEADQUARTER', label:'HEADQUARTER · SECTOR 1'},
  {v:'2',   ko:'제2지부 · SUBQUARTER',  label:'SUBQUARTER · SECTOR 2'},
  {v:'3',   ko:'제3지부 · MEGALOPOLIS', label:'MEGALOPOLIS · SECTOR 3'},
  {v:'4',   ko:'제4지부 · OUTERCYCLE',  label:'OUTERCYCLE · SECTOR 4'},
  {v:'5',   ko:'제5지부 · BARREN',      label:'BARREN · SECTOR 5'},
  {v:'etc', ko:'무소속 · UNAFFILIATED', label:'UNAFFILIATED'}
];
(function fillSectorOptions(){ var sel=$('#bi_sector'); if(sel) SECTORS.forEach(function(s){ var o=document.createElement('option'); o.value=s.v; o.textContent=s.ko; sel.appendChild(o); }); })();
var SECTOR_NAMES = {}; SECTORS.forEach(function(s){ SECTOR_NAMES[s.v]=s.label; });   // 지부 v → 상단바 소속 표기(SECTORS에서 파생)
function nextRecord(){  // 기존 record 최대 번호 +1 → "M-07"
  var max=0; TOOL_ROSTER.forEach(function(r){ var m=String(r.id||'').match(/(\d+)\s*$/); if(m){ var n=+m[1]; if(n>max) max=n; } });
  return 'M-'+('0'+(max+1)).slice(-2);
}
var FILES = {};    // 파일명 → objectURL(미리보기용)
var FILEOBJ = {};  // 파일명 → File 객체(사이트 저장 시 실제 파일 써넣기용)
function resolveImg(name){ return (name && FILES[name]) ? FILES[name] : (name||''); }
var STAT_NAMES = ['신체강도','체력','근력','무기활용','공격력','민첩','행운','지능','정신력','투지','제압능력','살상능력'];
// 무대 효과 목록의 단일 출처 = stage-fx.js 의 TSFX.effects()/presets() (부모창에 로드됨).
// → 새 효과는 stage-fx.js EFFECTS 한 곳만 고치면 여기 드롭다운에 자동 반영(복붙 목록 없음).
//   서버 없이 파일만 열면 TSFX 가 없어 효과 편집이 비활성(툴 자체가 서버 필요 = 상단 경고 배너).
// 깨진/빈 이미지 대체용 점선 박스(글리프) — 브라우저 깨진 아이콘 방지
var PH_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='340' height='214'%3E%3Crect x='2' y='2' width='336' height='210' rx='8' fill='%23808080' fill-opacity='0.05' stroke='%23808080' stroke-opacity='0.4' stroke-width='2' stroke-dasharray='8 7'/%3E%3Cg fill='%23808080' fill-opacity='0.45'%3E%3Ccircle cx='170' cy='90' r='15'/%3E%3Cpath d='M124 142 l30 -34 20 22 18 -20 24 32 z'/%3E%3C/g%3E%3C/svg%3E";
// ★사이트(common.js)와 같은 localStorage 키('ts-theme')를 공유 — 캐릭터 페이지가 라이트면 이 툴도 라이트로 열린다.
var THEME = 'dark';
try{ var _t0=localStorage.getItem('ts-theme'); if(_t0==='light'||_t0==='dark') THEME=_t0; }catch(e){}
document.body.setAttribute('data-theme', THEME);
// 파일을 직접 열면(file://) 미리보기·저장이 안 되므로 상단에 경고 배너를 띄운다.
if(location.protocol === 'file:'){ var _fw=$('#fileWarn'); if(_fw) _fw.style.display='block'; }

/* ---------- YAML-flow 파서(불러오기용 · 우리 포맷 한정) ---------- */
function unq(s){ s=String(s).trim();
  if((s[0]==='"'&&s.slice(-1)==='"')||(s[0]==="'"&&s.slice(-1)==="'")) return s.slice(1,-1).replace(/\\"/g,'"');
  return s; }
function splitTop(inner){                 // 최상위 콤마 분리(따옴표·[]·{} 내부는 무시)
  var out=[], depth=0, inq=false, cur='';
  for(var i=0;i<inner.length;i++){ var c=inner[i];
    if(inq){ cur+=c; if(c==='"'&&inner[i-1]!=='\\') inq=false; continue; }
    if(c==='"'){ inq=true; cur+=c; continue; }
    if(c==='['||c==='{'){ depth++; cur+=c; continue; }
    if(c===']'||c==='}'){ depth--; cur+=c; continue; }
    if(c===','&&depth===0){ if(cur.trim())out.push(cur); cur=''; continue; }
    cur+=c; }
  if(cur.trim()) out.push(cur); return out; }
function parseValue(s){ s=String(s).trim();
  if(s==='') return '';
  if(s[0]==='"'||s[0]==="'") return unq(s);
  if(s[0]==='[') return splitTop(s.slice(1,-1)).map(parseValue);
  if(s[0]==='{') return parseMap(s);
  if(s==='true') return true; if(s==='false') return false;
  if(/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s; }
function parseMap(s){ var o={}; splitTop(s.slice(1,-1)).forEach(function(pair){
  pair=pair.trim(); if(!pair) return;
  var depth=0,inq=false,ci=-1;
  for(var i=0;i<pair.length;i++){ var c=pair[i];
    if(inq){ if(c==='"'&&pair[i-1]!=='\\')inq=false; continue; }
    if(c==='"'){inq=true;continue;}
    if(c==='['||c==='{')depth++; else if(c===']'||c==='}')depth--;
    else if(c===':'&&depth===0){ ci=i; break; } }
  if(ci<0) return; o[unq(pair.slice(0,ci))]=parseValue(pair.slice(ci+1)); }); return o; }
function toFlow(v){                        // 값 → YAML flow 문자열(생성용)
  if(typeof v==='string') return q(v);
  if(typeof v==='number'||typeof v==='boolean') return String(v);
  if(Array.isArray(v)) return '['+v.map(toFlow).join(', ')+']';
  if(v&&typeof v==='object') return '{ '+Object.keys(v).map(function(k){ return k+': '+toFlow(v[k]); }).join(', ')+' }';
  return q(String(v)); }
function parseEffectField(str){ return splitTop(str).map(function(t){ return parseValue(t.trim()); }).filter(function(x){ return x!==''; }); }
function effectToField(arr){ return (arr||[]).map(function(v){ return typeof v==='string'? v : toFlow(v); }).join(', '); }   // 객체 레이어는 통째로 보존({fx,place}) — place 안 잃게

/* ---------- front matter 파싱 → 폼 채우기(편집 모드) ---------- */
function parseFM(fm){
  var out={accent:'',accentLight:'',accent2:'',accent2Light:'',statPlus:'',art:'',artAlt:'',meta:{},stats:[],wardrobe:[],generations:{current:'',items:[]}};
  var lines=fm.split('\n'), mode=null;
  for(var i=0;i<lines.length;i++){ var ln=lines[i]; if(!ln.trim()) continue;
    if(/^\S/.test(ln)){                     // 최상위 키
      var mt=ln.match(/^(\w+):\s*(.*)$/); mode=null; if(!mt) continue;
      var k=mt[1], v=mt[2];
      if(k==='accent') out.accent=unq(v);
      else if(k==='accent_light') out.accentLight=unq(v);
      else if(k==='accent2') out.accent2=unq(v);
      else if(k==='accent2_light') out.accent2Light=unq(v);
      else if(k==='stat_plus') out.statPlus=unq(v);
      else if(k==='art') out.art=unq(v);
      else if(k==='art_alt') out.artAlt=unq(v);
      else if(k==='meta') out.meta=parseValue(v);
      else if(k==='roster') out.roster=parseValue(v);   // 이름 분리(given 한글)·목록 역할 보존에 사용
      else if(k==='namehead') out.namehead=parseValue(v);   // 신원(레이아웃 렌더) — 새 포맷 원본 붙여넣기/파일열기 시 본문 대신 여기서 읽음
      else if(k==='idcard') out.idcard=parseValue(v);       // 사원증(레이아웃 렌더)
      else if(k==='stats') mode='stats';
      else if(k==='wardrobe') mode='wardrobe';
      else if(k==='generations') mode='gens';
      continue; }
    var t=ln.trim();
    if(mode==='stats'){ var ms=t.match(/^-\s*(\[.*\])$/); if(ms) out.stats.push(parseValue(ms[1])); }
    else if(mode==='wardrobe'){ var mw=t.match(/^-\s*(\{.*\})$/); if(mw) out.wardrobe.push(parseValue(mw[1])); }
    else if(mode==='gens'){
      var mcur=t.match(/^current:\s*(.*)$/); if(mcur){ out.generations.current=unq(mcur[1]); continue; }
      if(/^items:/.test(t)) continue;
      var mi=t.match(/^-\s*(\{.*\})$/); if(mi) out.generations.items.push(parseValue(mi[1])); }
  }
  return out; }
function setVal(id,v){ var el=$(id); if(el) el.value=(v==null?'':v); }
function loadMsg(text, ok){ var m=$('#loadMsg'); if(!m) return; m.textContent=text; m.style.color=(ok===false?'var(--warn)':ok?'var(--ok)':'var(--dim)'); }
// 본문을 세대 패널별로 분리. .gen-panel[data-gen] 이 없으면 전체를 대표 세대 것으로(__single).
function splitGenPanels(body){
  var out={}, found=false, re=/<div class="gen-panel" data-gen="([^"]+)">/g, m, marks=[];
  while(m=re.exec(body)){ marks.push({ id:m[1], contentStart:re.lastIndex }); found=true; }
  if(!found){ out.__single=body; return out; }
  for(var i=0;i<marks.length;i++){
    var end = (i+1<marks.length) ? body.indexOf('<div class="gen-panel"', marks[i].contentStart) : body.length;
    if(end<0) end=body.length;
    out[marks[i].id] = body.slice(marks[i].contentStart, end);   // 뒤 </div> 남아도 parseBody 가 무시
  }
  return out;
}
// front matter + 세대 패널 → 한 세대의 폼 데이터(genData). isMain 이면 top-level(d) 값을 쓰고, 아니면 item 값을.
function genDataFrom(id, item, panelHtml, isMain, d){
  var gd = blankGen(isMain); item = item || {};
  gd.art = item.img || (isMain ? (d.art||'') : '');
  gd.artArtist = item.artist || (isMain ? (d.artArtist||'') : '');   // gd.art와 같은 원천(옷장 main)에서 나온 값 — 참고용, 실제 저장 시엔 readGen이 옷장에서 다시 계산
  gd.effect = effectToField(item.effect);
  gd.accent = isMain ? (d.accent||'#bfc7d4') : (item.accent||'#bfc7d4');
  gd.accentLight = isMain ? (d.accentLight||'') : (item.accent_light||'');
  gd.accent2 = isMain ? (d.accent2||'') : (item.accent2||'');
  gd.accent2Light = isMain ? (d.accent2Light||'') : (item.accent2_light||'');
  var stats = isMain ? (d.stats||[]) : (item.stats||[]);
  gd.stats = stats.map(function(s){ return [s[0], (s[1]==null?'':s[1]), (s.length>2?s[2]:'')]; });   // 날것(빈칸 유지)
  gd.wardrobe = (isMain ? (d.wardrobe||[]) : (item.wardrobe||[])).map(function(w){ var o={cap:w.cap||'', img:w.img||'', on:!!w.on}; if(w.artist) o.artist=w.artist; WARD_SZ.forEach(function(k){ if(w[k]) o[k]=w[k]; }); return o; });   // 위치/크기값·작가도 보존
  var M = isMain ? (d.meta||{}) : (item.meta||{});   // 이 세대 meta(소속·영문이름 등) — 아래 신원 파싱에서 사용
  if(!panelHtml) return gd;   // 미작성(패널 없음) → 신원·서술 없이 빈 채(작성 안 한 세대)
  var b = parseBody(panelHtml);
  gd.statOn = b.statOn!==false;
  gd.proses = b.proses||[]; gd.exts = b.exts||[];
  // 신원/사원증: 빌드된 페이지 본문엔 렌더돼 있음(parseBody가 읽음). 새 포맷 '원본 파일'(붙여넣기/파일열기)은
  //   본문에 없고 front matter(d.namehead/d.idcard)에 있음 → 대표 세대는 front matter 우선, 없으면 본문.
  var nh = (isMain && d && d.namehead) ? d.namehead : null;
  var idc = (isMain && d && d.idcard) ? d.idcard : null;
  gd.eyebrow  = (nh ? nh.eyebrow : b.eyebrow) || '';
  gd.quote    = (nh ? nh.quote   : b.quote)   || '';
  gd.idcardOn = idc ? true : (b.idcardOn!==false);
  gd.idimg    = idc ? (idc.img||'')    : (b.idimg||'');
  gd.idstatus = idc ? (idc.status||'') : (b.idstatus||'');
  gd.idartist = idc ? (idc.artist||'') : (b.idartist||'');
  if(nh && (nh.bday!=null || nh.role!=null)){   // 새 포맷: 나이·키·소속은 roster에서, 생일·부서+역할은 namehead에서
    gd.bday = nh.bday || '';
    var spl = splitDeptFromRole(nh.role || ''); gd.dept = spl.dept; gd.role = spl.role;
    var _r = (d && d.roster) || {};
    gd.age = _r.age ? String(_r.age).replace(/Y$/i,'') : '';
    gd.height = _r.height!=null ? String(_r.height) : '';
    gd.sector = _r.sec==='etc' ? 'etc' : (_r.sec!=null ? String(_r.sec) : '');
  } else {   // 옛 포맷(나이·키·생일·소속·역할을 문자열 하나로 합쳐 저장하던 방식) 호환 — 역파싱
    var im = parseIdmeta((nh ? nh.idmeta : b.idmeta) || '');
    gd.age=im.age; gd.height=im.height; gd.bday=im.bday; gd.sector=im.sector; gd.dept=im.dept; gd.role=im.role;
  }
  if(!gd.sector){ var _ms=String(M.sector||''), _mm=_ms.match(/SECTOR\s*(\d+)/i); gd.sector = _mm?_mm[1] : (/UNAFFILIATED|무소속/i.test(_ms)?'etc':''); }
  // 이름 분해: 짧은형(meta.title / roster.ko) 을 given, 풀네임(front matter namehead 또는 본문)에서 빼서 성(surname)
  var enGiven=(M.title||'').trim(), enFull=((nh ? nh.en : b.enname)||'').trim();
  gd.enname = enGiven || enFull;
  gd.ensur = (enGiven && enFull.indexOf(enGiven)===0) ? enFull.slice(enGiven.length).trim() : '';
  var krFull=((nh ? nh.kr : b.krname)||'').trim();
  if(isMain){   // 한글 given = roster.ko(대표 세대만 있음) → 성 = 풀 − given
    var _r=d.roster||LOADED_ROSTER||{}, krGiven=(_r.ko!=null && String(_r.ko).trim()) ? String(_r.ko).trim() : krFull;
    gd.krname=krGiven; gd.krsur=(krGiven && krFull.indexOf(krGiven)===0) ? krFull.slice(krGiven.length).trim() : '';
  } else { gd.krname=krFull; gd.krsur=''; }   // 비대표 세대는 given 근거 없음 → 이름 칸에 통째(왕복 안전)
  return gd;
}
function applyData(d, body){
  d=d||{}; var g=d.generations||{};
  // 공통(세대 무관) 항목만 여기서. 세대별 항목(밝은 테마 색 등)은 writeGen이 채움
  setVal('#slug', d.slug || ((d.art||'').match(/^([A-Za-z0-9]+)_/)||[])[1] || '');
  setVal('#m_record', (d.meta&&d.meta.record)||'');
  setVal('#statPlus', d.statPlus||'');   // +증가분 막대 색(공통)
  // 대표 세대 = items 의 main:true, 없으면 current, 없으면 3
  var items=(g.items&&g.items.length)?g.items:[];
  GEN_ON = items.length >= 2;   // 세대 항목 2개 이상 = 타임라인(스위처), 1개 이하 = 단일 프로필
  var mainItem=items.filter(function(x){return x.main;})[0];
  MAIN_GEN = mainItem ? String(mainItem.id) : (g.current ? String(g.current) : '3');
  // 본문 → 세대 패널별. 세대별 genData 3벌 구성
  var panels = splitGenPanels(body||'');
  GEN_FORMS = {};
  GENS.forEach(function(gm){
    var item = items.filter(function(x){return String(x.id)===gm.id;})[0] || {};
    var isMain = (gm.id===MAIN_GEN);
    var panelHtml = panels[gm.id] || (isMain ? (panels.__single||'') : '');
    GEN_FORMS[gm.id] = genDataFrom(gm.id, item, panelHtml, isMain, d);
  });
  CUR_GEN = MAIN_GEN;
  writeGen(GEN_FORMS[CUR_GEN]);
  refreshGenBar();
  resetLineup();
  if($('#lineupResize')){ $('#lineupResize').checked=false; toggleResizeBox(); }   // 새로 불러오면 일단 끔
  probeLineup($('#slug').value.trim());   // 저장된 키비교 라인업 있으면 자동으로 켬
  render();
}
function loadFromText(txt){
  var m=String(txt||'').match(/^\s*---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if(!m){ loadMsg('⚠ front matter(--- ~ ---)를 못 찾음', false); return false; }
  applyData(parseFM(m[1]), m[2].replace(/\s+$/,''));
  loadMsg('✓ 붙여넣기 불러옴 — 폼에서 편집하세요', true); return true;
}
function pick(html, re){ var m=html.match(re); return m? m[1] : null; }
function loadCharacter(slug){
  if(!slug) return;
  loadMsg('불러오는 중… '+slug);
  fetch('../characters/'+encodeURIComponent(slug)+'/').then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status); return r.text();
  }).then(function(html){
    var d={ slug:slug,
      accent:(pick(html,/--accent:\s*([^;}]+)/)||'').trim(),
      accentLight:(pick(html,/\[data-theme="light"\][^{]*\{\s*--accent:\s*([^;}]+)/)||'').trim(),
      accent2:(pick(html,/--accent2:\s*([^;}]+)/)||'').trim(),                                            // 대표색 2번째(어두운 테마)
      accent2Light:(pick(html,/\[data-theme="light"\][^{]*\{[^}]*--accent2:\s*([^;}]+)/)||'').trim(),     // 대표색 2번째(밝은 테마)
      statPlus:(pick(html,/--stat-plus:\s*([^;}]+)/)||'').trim(),                                          // +증가분 막대 색
      art:pick(html,/id="stageArt"[^>]*\ssrc="([^"]*)"/)||'',
      artAlt:pick(html,/id="stageArt"[^>]*\salt="([^"]*)"/)||'',
      meta:JSON.parse(pick(html,/window\.CHAR_META\s*=\s*(.+);\s*$/m)||'{}'),
      stats:JSON.parse(pick(html,/window\.CHAR_STATS\s*=\s*(.+);\s*$/m)||'[]'),
      wardrobe:JSON.parse(pick(html,/window\.CHAR_WARDROBE\s*=\s*(.+);\s*$/m)||'[]'),
      generations:JSON.parse(pick(html,/window\.CHAR_GENERATIONS\s*=\s*(.+);\s*$/m)||'{}'),
      roster:JSON.parse(pick(html,/window\.CHAR_ROSTER\s*=\s*(.+);\s*$/m)||'null')
    };
    var body=(pick(html,/<section class="file">([\s\S]*?)<\/section>/)||'').replace(/^\s*\n/,'').replace(/\s+$/,'');
    LOADED_ROSTER = d.roster || null;   // 목록용 역할 등 보존(재저장 시 덮어쓰지 않게)
    LOADED_SLUG = slug;                 // 덮어쓰기 경고 판단용
    applyData(d, body);
    loadMsg('✓ '+slug+' 불러옴 — 폼에서 편집하세요', true);
  }).catch(function(e){ loadMsg('⚠ 불러오기 실패: '+e.message+' (jekyll serve 에서 열어야 함)', false); });
}

/* ---------- 동적 행(스탯/옷장/세대) 생성 ---------- */
function statRow(name, val, plus){
  var d = document.createElement('div'); d.className = 'list-row stat-row';
  d.innerHTML =
    '<input class="s-name" value="'+esc(name)+'">'+
    '<input class="s-val" type="number" min="0" max="10" value="'+(val==null?'':val)+'">'+
    '<input class="s-plus" type="number" min="0" max="10" placeholder="-" value="'+(plus==null?'':plus)+'">'+
    '<button class="del" title="삭제">✕</button>';
  d.querySelector('.del').onclick = function(){ d.remove(); render(); };
  return d;
}
// 옷장 위치/크기 미세조정 키 — 무대 배치 편집기(=페이지 ?edit)·profile.js WARDROBE_FIELDS·editor.js 와 같은 단일 출처.
var WARD_SZ = ['arth','artw','shiftx','shift','ghosth','ghostx','ghosty','ghostop'];   // 순서 = editor.js 필드 순서(기존 파일과 diff 최소화)
function wardRow(cap, img, on, sz){
  var d = document.createElement('div'); d.className = 'list-row ward-row';
  d.innerHTML =
    '<input class="w-cap" value="'+esc(cap)+'" placeholder="후드">'+
    '<span class="imgcell"><input class="w-img" value="'+esc(img)+'" placeholder="예: 이름_후드.png"><label class="filebtn imgbtn" title="이미지 선택">📁<input type="file" accept="image/*" hidden></label></span>'+
    '<input class="w-artist" value="'+esc((sz&&sz.artist)||'')+'" placeholder="그린 사람(선택)">'+
    '<span class="chk"><input type="radio" name="wardon" class="w-on"'+(on?' checked':'')+'></span>'+
    '<button class="del" title="삭제">✕</button>';
  // 위치/크기값(arth 등)은 폼에 입력칸 없이 행에 숨겨 보존 — 무대 배치 편집기로만 조정하고 저장까지 그대로 흘려보냄.
  d._sz = {}; if(sz) WARD_SZ.forEach(function(k){ if(sz[k]) d._sz[k]=sz[k]; });
  d.querySelector('.del').onclick = function(){ d.remove(); render(); };
  return d;
}
// ★세대는 1~3세대 고정(단일 출처). id·label·sub는 여기서 관리 → 사용자는 이미지·효과·main만 편집.
var GENS=[
  {id:'1', label:'1세대', sub:'ORIGIN'},
  {id:'2', label:'2세대', sub:'DUMMY'},
  {id:'3', label:'3세대', sub:'HEIR'}
];
function genMeta(id){ for(var i=0;i<GENS.length;i++) if(GENS[i].id===String(id)) return GENS[i]; return {id:String(id||''),label:'',sub:''}; }

/* ============================================================
   세대별 완전 프로필 — 세대 3벌(1·2·3)을 각각 편집
   ------------------------------------------------------------
   구조: 세대별 폼 데이터(genData)를 GEN_FORMS[세대id]에 3벌 보관.
         화면 폼은 늘 '한 세대'만 보여줌(CUR_GEN). 탭을 바꾸면
         지금 폼을 읽어 저장(readGen) → 다음 세대를 폼에 씀(writeGen).
   · '작성됨' = 내용이 하나라도 있는 세대(isWritten). 대표(MAIN_GEN)는 항상 작성.
   · 미작성 세대 = 출력에서 .gen-panel 없이 → 페이지가 "기록 없음" 플레이스홀더로.
   · 공통(세대 무관) = 폴더이름(slug)·기록번호·밝은테마색·라인업·목록요약(roster=대표세대).
   ============================================================ */
var GEN_FORMS = {};        // 세대id → genData(그 세대의 폼 내용)
var CUR_GEN  = '3';        // 지금 폼에 보이는(편집 중인) 세대
var MAIN_GEN = '3';        // 대표 세대(목록·처음 보이는 세대 = HEIR 기본)
var GEN_ON   = false;      // 세대 구분(타임라인) 사용? false=단일 프로필(스위처 없음, 대표세대 하나만 편집·출력)

// 부서+역할 합치기 한 곳(단일 출처). en=true면 영문(ko2en). idmeta=공백, 목록=' · '
function joinDeptRole(dept, role, sep, en){ var d=en?ko2en(dept):dept, r=en?ko2en(role):role; return d + (d&&r?sep:'') + r; }

// ---- 폼(DOM) → 세대 데이터 읽기 ----
function readStats(){   // #stats 행들 → [[이름, 값(문자, 빈칸 가능), 증가(문자)], …]. 값은 여기선 날것(빈칸 판별용)
  var out=[]; document.querySelectorAll('#stats .stat-row').forEach(function(r){
    var name=r.querySelector('.s-name').value.trim(); if(!name) return;
    out.push([name, r.querySelector('.s-val').value, r.querySelector('.s-plus').value]);
  }); return out;
}
function readWard(){
  var out=[]; document.querySelectorAll('#ward .ward-row').forEach(function(r){
    var cap=r.querySelector('.w-cap').value.trim(), img=r.querySelector('.w-img').value.trim(), on=r.querySelector('.w-on').checked;
    var artist=r.querySelector('.w-artist').value.trim();
    if(!cap && !img) return; var w={cap:cap,img:img}; if(artist)w.artist=artist; if(on)w.on=true;
    if(r._sz) WARD_SZ.forEach(function(k){ if(r._sz[k]) w[k]=r._sz[k]; });   // 숨겨둔 위치/크기값 보존
    out.push(w);
  }); return out;
}
function readBlocks(list){ var out=[]; Array.prototype.forEach.call(list.children, function(row){
  if(row.classList.contains('blk-img')) out.push({ type:'img', img:row.querySelector('.blk-imgval').value.trim(), alt:row.querySelector('.blk-alt').value.trim(), artist:row.querySelector('.blk-artist').value.trim() });
  else out.push({ type:'text', body:row.querySelector('.blk-text-v').value }); }); return out; }
function readProses(){ var out=[]; document.querySelectorAll('#proses .prose-card').forEach(function(r){
  out.push({ title:r.querySelector('.p-title').value.trim(), sub:r.querySelector('.p-sub').value.trim(), blocks:readBlocks(r.querySelector('.blk-list')) }); }); return out; }
function readExts(){ var out=[]; document.querySelectorAll('#exts .ext-card').forEach(function(r){
  out.push({ title:r.querySelector('.e-title').value.trim(), sub:r.querySelector('.e-sub').value.trim(), blocks:readBlocks(r.querySelector('.blk-list')),
    classified:r.querySelector('.e-classified').checked }); }); return out; }
// 세대별 항목(대표색·프레임·효과·옷장·신원·사원증·능력치·서술·확장)을 폼에서 읽어 genData 한 벌로
function readGen(){
  var ward=readWard();
  var mainWard=ward.filter(function(w){return w.on;})[0]||{};
  var mainImg=mainWard.img||'';      // 대표 일러 = 옷장 main(기본) 의상 이미지(따로 안 받음, 단일 출처)
  var mainArtist=mainWard.artist||'';   // 대표 일러 작가 = 그 의상의 작가(따로 안 받음, 옷장이 단일 출처)
  return {
    accent:$('#accent').value.trim(), accentLight:$('#accentLight').value.trim(),
    accent2:$('#accent2').value.trim(), accent2Light:$('#accent2Light').value.trim(),
    art:mainImg, artArtist:mainArtist, effect:$('#genEffect').value.trim(),
    eyebrow:$('#b_eyebrow').value.trim(),
    krname:$('#b_krname').value.trim(), krsur:$('#b_krsur').value.trim(),
    enname:$('#b_enname').value.trim(), ensur:$('#b_ensur').value.trim(),
    age:$('#bi_age').value.trim(), height:$('#bi_height').value.trim(), bday:$('#bi_bday').value.trim(),
    sector:$('#bi_sector').value.trim(), dept:$('#bi_dept').value.trim(), role:$('#bi_role').value.trim(),
    quote:$('#b_quote').value.trim(),
    idcardOn:$('#b_idcard_on').checked,
    idimg:$('#b_idimg').value.trim(), idstatus:$('#b_idstatus').value.trim(), idartist:$('#b_idartist').value.trim(),
    statOn:$('#b_stat_on').checked,
    stats:readStats(), wardrobe:ward, proses:readProses(), exts:readExts()
  };
}
// isMain=false 로 명시하면 사원증·능력치를 기본 꺼짐으로(1·2세대처럼 "곁가지" 세대는 보통 그 둘을 안 씀) —
//   인자를 안 주면(기존 호출 다수) 그대로 켜짐이라 동작이 안 바뀐다.
function blankGen(isMain){ var on = isMain!==false;
  return { accent:'#bfc7d4', accentLight:'', accent2:'', accent2Light:'', art:'', effect:'', eyebrow:'', krname:'', krsur:'', enname:'', ensur:'',
  age:'', height:'', bday:'', sector:'', dept:'', role:'', quote:'', idcardOn:on, idimg:'', idstatus:'', idartist:'',
  statOn:on, stats:[], wardrobe:[], proses:[], exts:[] }; }
// ---- 세대 데이터 → 폼(DOM) 쓰기 ----
function writeGen(gd){
  gd = gd || blankGen();
  setVal('#accent', gd.accent||'#bfc7d4'); setVal('#accentLight', gd.accentLight);
  setVal('#accent2', gd.accent2); setVal('#accent2Light', gd.accent2Light);
  renderFxLayers(fxParse(gd.effect||''));   // 효과 문자열 → 레이어 편집기(+숨은 #genEffect 동기화)
  setVal('#b_eyebrow',gd.eyebrow); setVal('#b_krname',gd.krname); setVal('#b_krsur',gd.krsur);
  setVal('#b_enname',gd.enname); setVal('#b_ensur',gd.ensur);
  setVal('#bi_age',gd.age); setVal('#bi_height',gd.height); setVal('#bi_bday',gd.bday);
  setVal('#bi_sector',gd.sector); setVal('#bi_dept',gd.dept); setVal('#bi_role',gd.role);
  setVal('#b_quote',gd.quote);
  $('#b_idcard_on').checked = gd.idcardOn!==false;
  setVal('#b_idimg',gd.idimg); setVal('#b_idstatus',gd.idstatus); setVal('#b_idartist',gd.idartist);
  $('#b_stat_on').checked = gd.statOn!==false;
  var sb=$('#stats'); sb.innerHTML='';
  ((gd.stats&&gd.stats.length)?gd.stats:STAT_NAMES.map(function(n){return [n,'',''];})).forEach(function(s){ sb.appendChild(statRow(s[0], s[1], s.length>2?s[2]:'')); });
  var wb=$('#ward'); wb.innerHTML='';
  ((gd.wardrobe&&gd.wardrobe.length)?gd.wardrobe:[{cap:'후드',img:'',on:true}]).forEach(function(w){ wb.appendChild(wardRow(w.cap, w.img, !!w.on, w)); });
  var pc=$('#proses'); pc.innerHTML=''; ((gd.proses&&gd.proses.length)?gd.proses:[{}]).forEach(function(p){ pc.appendChild(proseRow(p)); });
  var ec=$('#exts'); ec.innerHTML=''; (gd.exts||[]).forEach(function(e){ ec.appendChild(extRow(e)); });
}
// 이 세대에 실제 내용이 있나? (씨앗 라벨=능력치 이름·서술 제목만 있는 건 '미작성'으로 봄)
function isWritten(gd){
  if(!gd) return false;
  if(gd.krname||gd.enname||gd.eyebrow||gd.quote||gd.art||gd.idimg) return true;
  if(gd.age||gd.height||gd.bday||gd.sector||gd.dept||gd.role) return true;
  if(gd.stats && gd.stats.some(function(s){ return s[1]!=='' && s[1]!=null; })) return true;   // 값이 입력된 능력치
  if(gd.wardrobe && gd.wardrobe.some(function(w){ return w.img; })) return true;
  if(gd.proses && gd.proses.some(proseHasContent)) return true;
  if(gd.exts && gd.exts.some(function(e){ return e.title||e.sub||proseHasContent(e); })) return true;
  return false;
}
function genWritten(id){ return id===MAIN_GEN || isWritten(GEN_FORMS[id]); }   // 대표는 항상 작성 취급

// 세대 능력치 날것 → 출력형([이름,값숫자] / [이름,값,증가]). 빈 값은 0.
function statsOut(rows){ return (rows||[]).map(function(s){
  var v=(s[1]===''||s[1]==null)?0:+s[1]; var row=[s[0], v];
  var p=s[2]; if(p!=='' && p!=null && +p>0) row.push(+p); return row;
}); }
// 기록번호(M-04) → 사원 ID(TS-M04). 단일 출처: 사원 ID는 기록번호에서 파생(따로 입력 안 받음).
function recordToId(rec){ rec=(rec||'').trim(); return rec ? 'TS-'+rec.replace(/-/g,'') : ''; }
// 세대 데이터 → 상단바 meta( title/crumb/code=영문이름, sector=소속표기, record=공통, id=기록번호에서 파생 )
function metaOf(gd){ return { title:gd.enname, record:$('#m_record').value.trim(), crumb:gd.enname,
  sector:(SECTOR_NAMES[gd.sector]||''), code:gd.enname, id:recordToId($('#m_record').value.trim()) }; }
// 세대 데이터 → buildBody 가 먹는 본문 객체(이름은 이름+성 합성, idmeta 조립)
function bodyObjOf(gd){ return {
  eyebrow:gd.eyebrow, krname:gd.krname, krsur:gd.krsur, enname:joinName(gd.enname, gd.ensur),
  idmeta:assembleIdmeta({age:gd.age,height:gd.height,bday:gd.bday,sector:gd.sector,dept:gd.dept,role:gd.role}),
  quote:gd.quote, idcardOn:gd.idcardOn, idimg:gd.idimg, idsource:'CENTRAL DATABASE', idstatus:gd.idstatus, idartist:gd.idartist, idrecord:recordToId($('#m_record').value.trim()),
  statOn:gd.statOn, proses:gd.proses, exts:gd.exts }; }

