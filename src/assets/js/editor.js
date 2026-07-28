/* ============================================================
   editor.js — 프로필 페이지 배치 편집기 (어댑터)
   공통 코어 edit-core.js 를 쓰고, "프로필에서 무엇을 편집할지"만 정의.
   · 레이어 = 일러(#stageArt) / 고스트(#stageGhost)
   · 저장 = 의상 슬롯의 data-* (자동저장은 profile.js 의 localStorage)
   · [코드에 적용] = 이 index.html 의 그 의상 슬롯 태그에 data-* 써넣기
   profile.js 가 ?edit 일 때 edit-core.js 와 함께 로드함.
   ============================================================ */
(function(){
  'use strict';
  var P = window.TSProfile; if(!P || !P.art || !window.TSEditCore) return;
  var curSlot = P.onSlot();
  var fname = (location.pathname.match(/[^\/]+\/[^\/]+$/) || ['index.html'])[0];

  // 필드 : {k 라벨, v CSS변수, min,max, def 기본값, kind, a 슬롯속성}
  var cfg = {
    root: P.root, title: '배치 편집기 · DEV', fileLabel: fname, layerSwitch: true,
    layers: [
      { id:'art', name:'▤ 일러', anchorBottom:true, el:function(){ return P.art; }, fields:[
        {k:'크기(세로)',v:'--art-h', min:30,max:220,def:118,kind:'h',a:'data-arth'},
        {k:'폭(가로한계)',v:'--art-w', min:60,max:260,def:124,kind:'w',a:'data-artw'},
        {k:'이동가로',v:'--art-x', min:-45,max:45,def:0,kind:'x',a:'data-shiftx'},
        {k:'이동세로',v:'--art-shift',min:-45,max:45,def:0,kind:'y',a:'data-shift'} ] },
      { id:'ghost', name:'▨ 고스트', anchorBottom:true, el:function(){ return P.ghost; }, fields:[
        {k:'크기',v:'--ghost-h', min:50,max:190,def:128,kind:'h',a:'data-ghosth'},
        {k:'가로',v:'--ghost-x', min:-45,max:45,def:0,kind:'x',a:'data-ghostx'},
        {k:'세로',v:'--ghost-y', min:-45,max:45,def:0,kind:'y',a:'data-ghosty'},
        {k:'투명',v:'--ghost-op',min:0,max:45,def:9,kind:'op',a:'data-ghostop'} ] }
    ],
    onChange: function(){ if(curSlot) P.saveCurrent(curSlot); },
    // key 헬퍼 : data-arth → arth (YAML wardrobe 항목의 키와 동일)
    snippet: function(s){ return s.changed.map(function(f){ return f.a.replace('data-','')+': "'+s.get(f.v)+'%"'; }).join(', ') || '(기본값 그대로)'; },
    codeInfo: function(s){
      function codeVal(f){ return (curSlot && curSlot.hasAttribute(f.a)) ? parseFloat(curSlot.getAttribute(f.a)) : f.def; }
      var label = curSlot ? (s.fields.filter(function(f){ return curSlot.hasAttribute(f.a); })
                              .map(function(f){ return f.a.replace('data-','')+': "'+curSlot.getAttribute(f.a)+'"'; }).join(', ') || '(기본값)') : '-';
      return { synced: s.fields.every(function(f){ return s.get(f.v)===codeVal(f); }), label: label, codeVal: codeVal };
    },
    // ★지킬 front matter(YAML)의 wardrobe 항목(cap:… img:"…" 한 줄)의 크기·위치 키를 갱신
    applyToFile: function(text, s){
      if(!curSlot) return null;
      var img = curSlot.getAttribute('data-img');
      var lines = text.split('\n'), idx = -1;
      for(var i=0;i<lines.length;i++){
        if(lines[i].indexOf('cap:') >= 0 && lines[i].indexOf('img: "'+img+'"') >= 0){ idx = i; break; }
      }
      if(idx < 0) return null;   // 못 찾음(이 파일의 wardrobe 항목 아님)
      var line = lines[idx].replace(/,?\s*(arth|artw|shift|shiftx|ghosth|ghostx|ghosty|ghostop):\s*"[^"]*"/g, '');
      var add = s.changed.map(function(f){ return f.a.replace('data-','')+': "'+s.get(f.v)+'%"'; }).join(', ');
      line = add ? line.replace(/\s*\}\s*$/, ', ' + add + ' }') : line.replace(/\s*\}\s*$/, ' }');
      lines[idx] = line;
      return { text: lines.join('\n') };
    },
    afterApply: function(s){
      if(!curSlot) return; P.clearSaved(curSlot);
      s.fields.forEach(function(f){ curSlot.removeAttribute(f.a); });
      s.changed.forEach(function(f){ curSlot.setAttribute(f.a, s.get(f.v)+'%'); });
    }
  };

  var core = window.TSEditCore.create(cfg);
  // 의상 바꾸면 그 의상 값으로 재동기화
  document.querySelectorAll('.slot[data-img]').forEach(function(sl){
    sl.addEventListener('click', function(){ setTimeout(function(){ curSlot = P.onSlot(); core.resync(); }, 0); });
  });
})();
