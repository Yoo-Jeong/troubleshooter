/* ============================================================
   edit-core.js — (개발용) 배치 편집기 공통 코어
   ------------------------------------------------------------
   editor.js(프로필)·list-editor.js(목록) 가 공유하는 알맹이:
   · 무대 위 편집 박스 + 모서리 드래그(이동/크기, 발=하단중앙 앵커)
   · 슬라이더 + 수치 입력칸, 레이어 전환, 박스 표시 토글, 패널 드래그
   · 코드상태 배지, 스니펫, [코드에 적용](File System Access) — 페이지별 세부는 어댑터가 정의
   사용: TSEditCore.create(config) → { resync }
   config: {root, title, note, fileLabel, layers:[{id,name,el(),anchorBottom,fields:[{k,v,min,max,def,kind}]}],
            layerSwitch, targetLabel(), targetHint,
            onChange(s), snippet(s), codeInfo(s)->{synced,label,codeVal(f)}, applyToFile(text,s)->{text}|null, afterApply(s)}
   state s: {get(cssVar), fields, changed, active}
   ============================================================ */
window.TSEditCore = (function(){
  var CSS =
   '#edP{position:fixed;left:14px;bottom:14px;z-index:99999;width:244px;padding:12px 14px;'+
   'background:rgba(16,20,28,.93);border:1px solid rgba(120,200,220,.45);border-radius:8px;'+
   'font-family:"Share Tech Mono",Pretendard,"Malgun Gothic","Gothic A1",monospace;font-size:12px;color:#cfe}'+
   '#edP h5{margin:0 0 8px;font-size:11px;letter-spacing:1px;color:#7cc;cursor:move;user-select:none}'+
   '#edP .who{font-size:10px;color:#6ab;margin-bottom:6px}#edP .who b{color:#bff}'+
   '#edP .lyr{display:flex;gap:6px;margin-bottom:6px}'+
   '#edP .lyr button{flex:1;padding:6px;background:#12202c;color:#8bd;border:1px solid #345;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px}'+
   '#edP .lyr button.act{background:#1d4a58;color:#bff;border-color:#5cd}'+
   '#edP .tog{display:flex;align-items:center;gap:5px;font-size:10px;color:#8ac;margin:2px 0 4px;cursor:pointer;user-select:none}#edP .tog input{accent-color:#5ec8dd}'+
   '#edP .grp{margin:7px 0 3px;font-size:10px;letter-spacing:1px;color:#6ab;border-top:1px solid #244;padding-top:6px}'+
   '#edP .row{display:flex;align-items:center;gap:8px;margin:5px 0}#edP .row label{width:28px;color:#9bd}'+
   '#edP input[type=range]{flex:1;accent-color:#5ec8dd}'+
   '#edP .num{width:48px;background:#0a141c;color:#fff;border:1px solid #356;border-radius:3px;font-family:inherit;font-size:11px;text-align:right;padding:2px 4px;-moz-appearance:textfield;appearance:textfield}'+
   '#edP .num::-webkit-outer-spin-button,#edP .num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}'+
   '#edP .note{margin-top:7px;font-size:9.5px;color:#6a8;line-height:1.5}'+
   '#edP .code{margin-top:8px;font-size:9.5px;line-height:1.6;color:#8aa;word-break:break-all}#edP .code .ok{color:#6d9}#edP .code .warn{color:#f96}'+
   '#edP .snip{margin-top:7px;padding:7px 8px;background:#0a0e14;border:1px solid #244;border-radius:4px;font-size:10.5px;color:#8ec;word-break:break-all;line-height:1.6;user-select:all}'+
   '#edP .btns{display:flex;gap:6px}#edP button{margin-top:8px;padding:6px;background:#1d3540;color:#8ee;border:1px solid #4aa;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px}#edP .btns button{flex:1}'+
   '#edP button.apply{width:100%;padding:9px;background:#12463a;color:#9fe;border-color:#4c9;font-weight:bold;font-size:11.5px}'+
   '#edP button.reset{background:#3a2020;color:#e99;border-color:#a55;flex:0 0 60px}'+
   '.edBox{position:fixed;z-index:99900;border:1px dashed rgba(94,200,221,.5);pointer-events:none;touch-action:none}'+
   '.edBox.l1{border-color:rgba(150,170,255,.5)}'+
   '.edBox.act{z-index:99901;border-width:1.5px;border-color:rgba(94,200,221,1);pointer-events:auto;cursor:move}'+
   '.edBox.l1.act{border-color:rgba(150,170,255,1)}'+
   '.edBox .edlbl{position:absolute;left:-1px;top:-15px;font:10px "Share Tech Mono",monospace;color:#023;background:rgba(94,200,221,.55);padding:0 4px;border-radius:2px}'+
   '.edBox.l1 .edlbl{background:rgba(150,170,255,.55)}.edBox.act .edlbl{background:rgba(94,200,221,1)}.edBox.l1.act .edlbl{background:rgba(150,170,255,1)}'+
   '.edBox .eh{position:absolute;width:13px;height:13px;background:#5ec8dd;border:1px solid #012;border-radius:2px;touch-action:none;display:none}'+
   '.edBox.l1 .eh{background:#9ab0ff}.edBox.act .eh{display:block}'+
   '.edBox .tl{left:-7px;top:-7px;cursor:nwse-resize}.edBox .tr{right:-7px;top:-7px;cursor:nesw-resize}.edBox .bl{left:-7px;bottom:-7px;cursor:nesw-resize}.edBox .br{right:-7px;bottom:-7px;cursor:nwse-resize}'+
   '.edBox .tc{left:50%;top:-7px;margin-left:-6px;cursor:ns-resize}.edBox .bc{left:50%;bottom:-7px;margin-left:-6px;cursor:ns-resize}.edBox .ml{left:-7px;top:50%;margin-top:-6px;cursor:ew-resize}.edBox .mr{right:-7px;top:50%;margin-top:-6px;cursor:ew-resize}'+
   ':root[data-theme="light"] #edP{background:rgba(246,248,250,.96);border-color:rgba(40,120,140,.4);color:#245;box-shadow:0 2px 12px rgba(40,70,90,.15)}'+
   ':root[data-theme="light"] #edP h5{color:#178}:root[data-theme="light"] #edP .who{color:#489}:root[data-theme="light"] #edP .lyr button{background:#e7eef2;color:#367;border-color:#bcd}:root[data-theme="light"] #edP .lyr button.act{background:#cfe8ee;color:#046;border-color:#5ac}'+
   ':root[data-theme="light"] #edP .tog{color:#478}:root[data-theme="light"] #edP .grp{color:#489;border-color:#d3e2e8}:root[data-theme="light"] #edP .row label{color:#478}:root[data-theme="light"] #edP .num{background:#fff;color:#123;border-color:#bcd}'+
   ':root[data-theme="light"] #edP .note{color:#487}:root[data-theme="light"] #edP .code{color:#578}:root[data-theme="light"] #edP .code .ok{color:#292}:root[data-theme="light"] #edP .code .warn{color:#c60}'+
   ':root[data-theme="light"] #edP .snip{background:#eef3f6;border-color:#d3e2e8;color:#268}:root[data-theme="light"] #edP button{background:#deeef0;color:#178;border-color:#9cc}:root[data-theme="light"] #edP button.apply{background:#cceee0;color:#065;border-color:#4b9}:root[data-theme="light"] #edP button.reset{background:#f3dede;color:#a44;border-color:#d99}';

  function create(cfg){
    var root = cfg.root, LAYERS = cfg.layers;
    var fields = [], ctrls = {}, active = LAYERS[0].id, boxShown = true, showBoth = false, drag = null, boxes = {};
    LAYERS.forEach(function(L, i){ L._i = i; L.fields.forEach(function(f){ f._layer = L; fields.push(f); }); });
    function fdef(v){ for(var i=0;i<fields.length;i++) if(fields[i].v===v) return fields[i].def; return 0; }
    function get(v){ var x = parseFloat(getComputedStyle(root).getPropertyValue(v)); return isNaN(x) ? fdef(v) : x; }
    function lf(layerId, kind){ var L=lay(layerId); for(var i=0;i<L.fields.length;i++) if(L.fields[i].kind===kind) return L.fields[i]; }
    function lay(id){ for(var i=0;i<LAYERS.length;i++) if(LAYERS[i].id===id) return LAYERS[i]; }
    function state(){ return { get:get, fields:fields, changed:fields.filter(function(f){ return get(f.v)!==f.def; }), active:active }; }

    // ---- styles ----
    if(!document.getElementById('edCoreCss')){ var st=document.createElement('style'); st.id='edCoreCss'; st.textContent=CSS; document.head.appendChild(st); }

    // ---- panel ----
    var P = document.createElement('div'); P.id = 'edP';
    var html = '<h5 id="edGrip" title="드래그해서 패널 이동">⠿ '+cfg.title+'</h5>';
    if(cfg.targetLabel) html += '<div class="who">편집 대상: <b id="edWho">-</b>'+(cfg.targetHint?' '+cfg.targetHint:'')+'</div>';
    if(cfg.layerSwitch){
      html += '<div class="lyr">'+LAYERS.map(function(L){ return '<button data-l="'+L.id+'"'+(L.id===active?' class="act"':'')+'>'+L.name+'</button>'; }).join('')+'</div>';
      html += '<label class="tog"><input type="checkbox" id="edBoth"> 두 박스 함께 보기</label>';
    }
    html += '<label class="tog"><input type="checkbox" id="edShow" checked> 편집 박스 표시 (끄면 깨끗한 화면)</label>';
    var grp='';
    fields.forEach(function(f){
      if(cfg.layerSwitch && f._layer.id!==grp){ grp=f._layer.id; html+='<div class="grp">'+f._layer.name+'</div>'; }
      html += '<div class="row"><label>'+f.k+'</label><input type="range" data-v="'+f.v+'" min="'+f.min+'" max="'+f.max+'" step="0.5"><input type="number" class="num" data-n="'+f.v+'" min="'+f.min+'" max="'+f.max+'" step="0.5"></div>';
    });
    html += '<div class="note">'+(cfg.note||'<b>편집 박스</b>를 끌어 이동 · <b>박스 모서리</b>를 끌어 크기.')+'</div>'+
      '<button id="edApply" class="apply">💾 코드에 적용</button>'+
      '<div class="code" id="edCode"></div><div class="snip" id="edSnip"></div>'+
      '<div class="btns"><button id="edCopy">복사</button><button class="reset" id="edReset">초기화</button></div>';
    P.innerHTML = html; document.body.appendChild(P);
    fields.forEach(function(f){ ctrls[f.v] = P.querySelector('input[data-v="'+f.v+'"]'); });

    // ---- boxes (레이어별) ----
    var HANDLES = ['tl','tc','tr','ml','mr','bl','bc','br'];
    LAYERS.forEach(function(L){
      var b = document.createElement('div'); b.className = 'edBox'+(L._i?' l1':'');
      b.innerHTML = '<span class="edlbl">'+L.name+'</span>' + HANDLES.map(function(p){ return '<span class="eh '+p+'" data-h="'+p+'"></span>'; }).join('');
      b.addEventListener('pointerdown', function(e){ setActive(L.id); var h=e.target.getAttribute&&e.target.getAttribute('data-h'); if(h) startDrag('resize',e,e.target); else startDrag('move',e); });
      document.body.appendChild(b); boxes[L.id]=b;
    });
    function posOne(L){ var b=boxes[L.id], el=L.el&&L.el();
      var vis = boxShown && (showBoth || L.id===active || !cfg.layerSwitch) && el && el.getBoundingClientRect;
      if(!vis){ b.style.display='none'; return; }
      var r=el.getBoundingClientRect(); if(r.width<2){ b.style.display='none'; return; }
      b.style.display='block'; b.classList.toggle('act', L.id===active || !cfg.layerSwitch);
      b.style.left=r.left+'px'; b.style.top=r.top+'px'; b.style.width=r.width+'px'; b.style.height=r.height+'px';
    }
    function positionBoxes(){ LAYERS.forEach(posOne); }
    window.addEventListener('resize', positionBoxes);
    window.addEventListener('scroll', positionBoxes, true);

    // ---- 값 쓰기 ----
    function setVar(f, val){ val = Math.max(f.min, Math.min(f.max, Math.round(val*10)/10));
      root.style.setProperty(f.v, val+'%');
      var r=ctrls[f.v]; r.value=val; if(r.nextElementSibling) r.nextElementSibling.value=val;
      refresh(); if(cfg.onChange) cfg.onChange(state()); positionBoxes();
    }
    function refresh(){
      var s = state();
      if(cfg.targetLabel){ var el=document.getElementById('edWho'); if(el) el.textContent = cfg.targetLabel()||'-'; }
      document.getElementById('edSnip').textContent = cfg.snippet ? cfg.snippet(s) : '';
      var ci = cfg.codeInfo ? cfg.codeInfo(s) : {synced:true, label:''};
      document.getElementById('edCode').innerHTML =
        '<span class="'+(ci.synced?'ok':'warn')+'">'+(ci.synced?'● 코드에 저장됨 (지금=코드)':'● 미저장 변경 — [코드에 적용] 필요')+'</span><br>코드값: '+(ci.label||'-');
      P._codeVal = ci.codeVal;   // reset 에서 사용
    }
    function resync(){ fields.forEach(function(f){ var r=ctrls[f.v]; r.value=get(f.v); if(r.nextElementSibling) r.nextElementSibling.value=r.value; }); refresh(); positionBoxes(); }

    // ---- 드래그 ----
    function startDrag(mode, e, handle){
      var L=lay(active), el=L.el&&L.el(); if(!el) return; var rect=el.getBoundingClientRect();
      drag={ mode:mode, sx:e.clientX, sy:e.clientY, rect:rect, fH:lf(active,'h'), fX:lf(active,'x'), fY:lf(active,'y') };
      drag.h0 = drag.fH?get(drag.fH.v):0; drag.x0 = drag.fX?get(drag.fX.v):0; drag.y0 = drag.fY?get(drag.fY.v):0;
      if(mode==='resize'){ drag.anchor={ x:rect.left+rect.width/2, y: (L.anchorBottom===false? rect.top+rect.height/2 : rect.bottom) };
        var hr=handle.getBoundingClientRect(); drag.d0=Math.hypot((hr.left+hr.width/2)-drag.anchor.x,(hr.top+hr.height/2)-drag.anchor.y)||1; }
      window.addEventListener('pointermove',onMove); window.addEventListener('pointerup',onUp); e.preventDefault(); e.stopPropagation();
    }
    function onMove(e){ if(!drag) return;
      if(drag.mode==='move'){ if(drag.fX) setVar(drag.fX, drag.x0+(e.clientX-drag.sx)/drag.rect.width*100); if(drag.fY) setVar(drag.fY, drag.y0+(e.clientY-drag.sy)/drag.rect.height*100); }
      else { var d1=Math.hypot(e.clientX-drag.anchor.x,e.clientY-drag.anchor.y); if(drag.fH) setVar(drag.fH, drag.h0*(d1/drag.d0)); }
    }
    function onUp(){ drag=null; window.removeEventListener('pointermove',onMove); window.removeEventListener('pointerup',onUp); }

    // ---- 레이어 전환 ----
    function setActive(id){ active=id; P.querySelectorAll('.lyr button').forEach(function(b){ b.classList.toggle('act', b.getAttribute('data-l')===id); }); positionBoxes(); }
    P.querySelectorAll('.lyr button').forEach(function(b){ b.addEventListener('click', function(){ setActive(b.getAttribute('data-l')); }); });

    // ---- 슬라이더·수치·토글 ----
    fields.forEach(function(f){
      ctrls[f.v].addEventListener('input', function(){ setActive(f._layer.id); setVar(f, parseFloat(this.value)); });
      var n=P.querySelector('input.num[data-n="'+f.v+'"]');
      if(n) n.addEventListener('change', function(){ setActive(f._layer.id); setVar(f, isNaN(parseFloat(this.value))?f.def:parseFloat(this.value)); });
    });
    document.getElementById('edShow').addEventListener('change', function(){ boxShown=this.checked; positionBoxes(); });
    if(cfg.layerSwitch) document.getElementById('edBoth').addEventListener('change', function(){ showBoth=this.checked; positionBoxes(); });

    // ---- 패널 드래그 ----
    (function(){ var g=document.getElementById('edGrip'), pd=null;
      g.addEventListener('pointerdown', function(e){ var r=P.getBoundingClientRect(); pd={ox:e.clientX-r.left,oy:e.clientY-r.top}; P.style.left=r.left+'px'; P.style.top=r.top+'px'; P.style.bottom='auto'; window.addEventListener('pointermove',pm); window.addEventListener('pointerup',pu); e.preventDefault(); });
      function pm(e){ if(!pd)return; P.style.left=Math.max(0,Math.min(innerWidth-60,e.clientX-pd.ox))+'px'; P.style.top=Math.max(0,Math.min(innerHeight-24,e.clientY-pd.oy))+'px'; }
      function pu(){ pd=null; window.removeEventListener('pointermove',pm); window.removeEventListener('pointerup',pu); }
    })();

    // ---- 버튼 ----
    document.getElementById('edCopy').addEventListener('click', function(){ var t=cfg.snippet?cfg.snippet(state()):''; if(navigator.clipboard && t && t.charAt(0)!=='(') navigator.clipboard.writeText(t); var self=this; self.textContent='복사됨 ✓'; setTimeout(function(){ self.textContent='복사'; },1200); });
    document.getElementById('edReset').addEventListener('click', function(){   // 현재 레이어만 코드값으로
      var cv = P._codeVal; lay(active).fields.forEach(function(f){ setVar(f, cv?cv(f):f.def); });
    });
    var fileHandle=null;
    document.getElementById('edApply').addEventListener('click', async function(){
      var self=this, orig='💾 코드에 적용';
      function msg(t,ms){ self.textContent=t; setTimeout(function(){ self.textContent=orig; }, ms||2500); }
      if(!window.showOpenFilePicker){ msg('이 브라우저 미지원 → [복사] 사용',3500); return; }
      try{
        if(!fileHandle){ self.textContent='파일 선택: '+(cfg.fileLabel||'index.html'); var picked=await window.showOpenFilePicker({ id:'tsedit', types:[{description:'HTML',accept:{'text/html':['.html']}}] }); fileHandle=picked[0]; }
        var text=await (await fileHandle.getFile()).text();
        var res=cfg.applyToFile(text, state());
        if(!res){ fileHandle=null; msg('대상을 못 찾음 (파일 맞나요?)',3000); return; }
        var w=await fileHandle.createWritable(); await w.write(res.text); await w.close();
        if(cfg.afterApply) cfg.afterApply(state()); refresh(); msg('✓ 코드에 적용됨! 배포해도 유지',3000);
      }catch(err){ msg('취소됨/오류: '+String(err.message||err).slice(0,20),3000); }
    });

    resync();
    return { resync: resync, setActive: setActive };
  }
  return { create: create };
})();
