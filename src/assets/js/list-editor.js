/* ============================================================
   list-editor.js — 캐릭터 목록(characters.html) 상세 일러 편집기 (어댑터)
   공통 코어 edit-core.js 를 쓰고, "목록에서 무엇을 편집할지"만 정의.
   · 대상 = 선택된 캐릭터의 상세 일러(#dpic), 캐릭터마다 따로 저장
   · 저장 = characters.html 의 LINEUP_POS 객체 / 자동저장 = localStorage(캐릭터별)
   characters.html 이 ?edit 일 때 edit-core.js 와 함께 로드함.
   ============================================================ */
(function(){
  'use strict';
  var L = window.TSList; if(!L || !L.img || !window.TSEditCore) return;

  function chObj(s){ var m={}; s.changed.forEach(function(f){ m[f.kind]=s.get(f.v); }); return m; }

  var cfg = {
    root: L.root, title: '목록 일러 편집 · DEV', fileLabel: 'characters.html', layerSwitch: false,
    targetLabel: function(){ return L.curK() || '-'; }, targetHint: '(목록에서 캐릭터 선택)',
    note: '<b>편집 박스</b>를 끌어 이동 · <b>박스 모서리</b>를 끌어 크기. 캐릭터마다 저장.<br>※ 키 비율 정규화 이미지라 과한 이동은 6명 정렬이 흐트러질 수 있음.',
    layers: [
      { id:'img', name:'일러', anchorBottom:true, el:function(){ return L.img; }, fields:[
        {k:'크기',v:'--l-h',min:40,max:180,def:100,kind:'h'},
        {k:'가로',v:'--l-x',min:-80,max:80,def:0,kind:'x'},
        {k:'세로',v:'--l-y',min:-80,max:80,def:0,kind:'y'} ] }
    ],
    onChange: function(s){ var k=L.curK(); if(!k) return; var m=chObj(s);
      try{ if(Object.keys(m).length) localStorage.setItem(L.saveKey(k), JSON.stringify(m)); else localStorage.removeItem(L.saveKey(k)); }catch(e){} },
    snippet: function(s){ var k=L.curK(), m=chObj(s); return Object.keys(m).length ? ('"'+k+'": '+JSON.stringify(m)) : '(기본값)'; },
    codeInfo: function(s){ var k=L.curK(), base=(k&&L.pos[k])||{};
      function codeVal(f){ return base[f.kind]!=null ? base[f.kind] : f.def; }
      return { synced: s.fields.every(function(f){ return s.get(f.v)===codeVal(f); }),
               label: (base && Object.keys(base).length) ? JSON.stringify(base) : '(기본값)', codeVal: codeVal }; },
    applyToFile: function(text, s){
      if(!/var LINEUP_POS\s*=/.test(text)) return null;
      var k=L.curK(), m=chObj(s); if(Object.keys(m).length) L.pos[k]=m; else delete L.pos[k];
      return { text: text.replace(/var LINEUP_POS\s*=\s*\{[\s\S]*?\};/, 'var LINEUP_POS = '+JSON.stringify(L.pos)+';') }; },
    afterApply: function(){ var k=L.curK(); if(k){ try{ localStorage.removeItem(L.saveKey(k)); }catch(e){} } }
  };

  var core = window.TSEditCore.create(cfg);
  window._listEd = core.resync;   // characters.html 의 select() 가 캐릭터 바뀔 때 호출
})();
