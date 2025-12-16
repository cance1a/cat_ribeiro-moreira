// Full CMS logic (adapted from root cms.js)
(() => {
  'use strict';
  // Use the same folders as the public catalog
  const CATEGORIES = [
    { id: 'aluminio', label: 'Alumínio', folder: 'img/img_al' },
    { id: 'construcoes', label: 'Construções', folder: 'img/img_cm_fe' },
    { id: 'servicos', label: 'Serviços', folder: 'img/img_ms' }
  ];

  // state
  let jsonData = { aluminio: [], construcoes: [], servicos: [] };
  let projectRootHandle = null; // directory handle for project root
  let jsonHandle = null; // file handle for data/projectsData.json (if obtained)

  // UI refs
  const cmsStatus = document.getElementById('cms-status');
  const enableFsBtn = document.getElementById('enableFsBtn');
  const reloadJsonBtn = document.getElementById('reloadJsonBtn');
  const saveCmsBtn = document.getElementById('saveCmsBtn');
  const tabs = document.querySelectorAll('.cms-tab');
  const cmsContent = document.getElementById('cms-content');

  function setStatus(txt){ if(cmsStatus) cmsStatus.textContent = txt; }

  tabs.forEach(t=> t.addEventListener('click', (e)=>{ tabs.forEach(b=>b.classList.remove('active')); e.currentTarget.classList.add('active'); renderActiveTab(); }));
  tabs[0].classList.add('active');

  enableFsBtn.addEventListener('click', async ()=>{
    try{
      if(!window.showDirectoryPicker) return setStatus('File System Access API não disponível no seu navegador.');
      projectRootHandle = await window.showDirectoryPicker();
      setStatus('Pasta do projeto selecionada: ' + projectRootHandle.name);
      try{
        const dataDir = await getOrCreateDir(projectRootHandle, 'data');
        jsonHandle = await getOrCreateFile(dataDir, 'projectsData.json');
        await loadJsonFromHandle();
      }catch(err){ console.warn(err); setStatus('Pasta escolhida, não foi possível abrir projectsData.json automaticamente.'); }
    }catch(e){ console.error(e); setStatus('Seleção de pasta cancelada.'); }
  });

  reloadJsonBtn.addEventListener('click', async ()=>{ await loadJson(); renderActiveTab(); });
  saveCmsBtn.addEventListener('click', async ()=>{ await saveJson(); });

  async function loadJson(){
    setStatus('Carregando JSON...');
    try{
      const resp = await fetch('../data/projectsData.json', {cache:'no-store'});
      if(resp.ok){ const j = await resp.json(); if(j.aluminio||j.construcoes||j.servicos) jsonData = j; else jsonData = adaptFromLegacy(j); setStatus('JSON carregado via fetch.'); return; }
    }catch(e){}
    if(window.projectsData){ jsonData = adaptFromLegacy(window.projectsData); setStatus('JSON carregado do conteúdo da página.'); return; }
    if(jsonHandle){ await loadJsonFromHandle(); return; }
    setStatus('Nenhum JSON encontrado — usando estrutura vazia.');
  }

  function adaptFromLegacy(legacy){
    const out = { aluminio: [], construcoes: [], servicos: [] };
    try{
      Object.values(legacy).forEach(entry=>{ if(!entry||!entry.images) return; entry.images.forEach(imgPath=>{ const src = imgPath; const s=(src||'').toLowerCase(); let cat=null; if(s.includes('/img_al/')||s.includes('/alum')||s.includes('aluminio')||s.includes('/img/img_al')) cat='aluminio'; else if(s.includes('/img_cm')||s.includes('/estrutura')||s.includes('constru')) cat='construcoes'; else if(s.includes('/img_ms')||s.includes('/remates')||s.includes('sol-')) cat='servicos'; else cat='aluminio'; out[cat].push({ src, descriptions: entry.descriptions||{pt:'',en:'',es:'',fr:''} }); }); });
    }catch(e){ console.warn('adaptFromLegacy failed', e); }
    return out;
  }

  async function loadJsonFromHandle(){ try{ const file = await jsonHandle.getFile(); const txt = await file.text(); const j = txt.trim() ? JSON.parse(txt) : {}; if(j.aluminio||j.construcoes||j.servicos) jsonData = j; else jsonData = adaptFromLegacy(j); setStatus('projectsData.json carregado via handle.'); }catch(e){ console.error(e); setStatus('Falha ao ler handle do JSON.'); } }

  function ensureDescriptions(item){
    item.descriptions = item.descriptions || {};
    ['pt','en','es','fr'].forEach(l=>{ if(typeof item.descriptions[l] === 'undefined') item.descriptions[l] = ''; });
  }

  function removeDuplicates(){
    Object.keys(jsonData).forEach(cat=>{
      const seen = new Set();
      jsonData[cat] = (jsonData[cat]||[]).filter(it=>{
        if(!it || !it.src) return false;
        if(seen.has(it.src)) return false;
        seen.add(it.src); return true;
      });
    });
  }

  function validatePaths(){
    const problems = [];
    CATEGORIES.forEach(catDef=>{
      const list = jsonData[catDef.id] || [];
      list.forEach(it=>{
        if(!it || !it.src) return;
        if(!it.src.startsWith(catDef.folder)) problems.push({cat:catDef.id, src: it.src, expectedPrefix: catDef.folder});
      });
    });
    return problems;
  }

  async function saveJson(){
    // normalize descriptions and remove duplicates first
    Object.keys(jsonData).forEach(cat=> (jsonData[cat]||[]).forEach(ensureDescriptions));
    removeDuplicates();

    // validate paths
    const problems = validatePaths();
    if(problems.length){
      const msg = `Encontradas ${problems.length} imagens com paths inesperados. Deseja continuar a guardar?\n(Ver console para detalhes)`;
      console.warn('Path validation issues:', problems);
      if(!confirm(msg)){ setStatus('Salvar cancelado — corrija os paths.'); return; }
    }

    const content = JSON.stringify(jsonData, null, 2);
    if(jsonHandle && jsonHandle.createWritable){ try{ const writable = await jsonHandle.createWritable(); await writable.write(content); await writable.close(); setStatus('projectsData.json salvo com sucesso.'); return; }catch(e){ console.error(e); setStatus('Erro ao salvar via handle: '+e.message); } }
    if(projectRootHandle && window.showDirectoryPicker){ try{ const dataDir = await getOrCreateDir(projectRootHandle, 'data'); const fHandle = await getOrCreateFile(dataDir, 'projectsData.json'); const writable = await fHandle.createWritable(); await writable.write(content); await writable.close(); jsonHandle = fHandle; setStatus('projectsData.json salvo em ' + dataDir.name + '/projectsData.json'); return; }catch(e){ console.warn(e); } }
    const blob = new Blob([content], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'projectsData.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); setStatus('JSON preparado para download (substitua manualmente data/projectsData.json).');
  }

  async function getOrCreateDir(root, name){ try{ return await root.getDirectoryHandle(name, { create: true }); } catch(e){ throw e; } }
  async function getOrCreateFile(dirHandle, fileName){ try{ return await dirHandle.getFileHandle(fileName, { create: true }); } catch(e){ throw e; } }

  function renderActiveTab(){ const active = document.querySelector('.cms-tab.active'); const cat = active ? active.dataset.cat : 'aluminio'; renderCategory(cat); }

  function renderCategory(catId){ const catDef = CATEGORIES.find(c=>c.id===catId); if(!catDef) return; cmsContent.innerHTML=''; const header = document.createElement('div'); header.style.display='flex'; header.style.justifyContent='space-between'; header.style.alignItems='center'; const h = document.createElement('h3'); h.textContent = catDef.label; header.appendChild(h); const addBtn = document.createElement('button'); addBtn.textContent = 'Adicionar foto'; addBtn.style.padding='8px 10px'; addBtn.onclick = ()=> triggerAdd(catDef.id); header.appendChild(addBtn); cmsContent.appendChild(header);

    const grid = document.createElement('div'); grid.style.display='flex'; grid.style.flexWrap='wrap'; grid.style.gap='12px'; grid.style.marginTop='12px'; const list = jsonData[catDef.id] || [];
    if(list.length===0){ const empty = document.createElement('div'); empty.textContent='Nenhuma foto nesta subsecção.'; empty.style.color='#666'; cmsContent.appendChild(empty); }
    list.forEach((item, idx)=>{ const card = document.createElement('div'); card.className='card'; const img = document.createElement('img'); img.src = item.src; img.className='thumb'; card.appendChild(img); const btns = document.createElement('div'); btns.style.display='flex'; btns.style.gap='6px'; btns.style.marginTop='8px'; const rem = document.createElement('button'); rem.textContent='Remover'; rem.onclick = ()=>{ if(confirm('Remover esta foto do JSON?')){ jsonData[catDef.id].splice(idx,1); renderCategory(catDef.id); } }; const edit = document.createElement('button'); edit.textContent='Editar descrições'; edit.onclick = ()=> openEditDescriptions(catDef.id, idx); btns.appendChild(rem); btns.appendChild(edit); card.appendChild(btns); grid.appendChild(card); });
    cmsContent.appendChild(grid);
  }

  function triggerAdd(catId){
    const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange = async ()=>{
      const f = inp.files[0]; if(!f) return;
      try{
        const name = Date.now() + '_' + sanitizeFileName(f.name);
        const catDef = CATEGORIES.find(c=>c.id===catId);
        if(!catDef) throw new Error('Categoria desconhecida');
        if(projectRootHandle && window.showDirectoryPicker){
          // create nested dir for the catalog layout (ex: img/img_al)
          const firstDir = catDef.folder.split('/')[0];
          const rest = catDef.folder.split('/').slice(1);
          let dir = await getOrCreateDir(projectRootHandle, firstDir);
          for(const part of rest) dir = await getOrCreateDir(dir, part);
          const fh = await dir.getFileHandle(name, { create: true });
          const writable = await fh.createWritable();
          await writable.write(await f.arrayBuffer());
          await writable.close();
          const src = catDef.folder + '/' + name;
          jsonData[catId] = jsonData[catId] || [];
          // avoid duplicate
          if(!(jsonData[catId]||[]).some(it=>it && it.src === src)) jsonData[catId].push({ src, descriptions: { pt:'',en:'',es:'',fr:'' } });
          setStatus('Imagem copiada para ' + src);
          renderCategory(catId);
        } else {
          const src = catDef.folder + '/' + name;
          jsonData[catId] = jsonData[catId] || [];
          if(!(jsonData[catId]||[]).some(it=>it && it.src === src)) jsonData[catId].push({ src, descriptions: { pt:'',en:'',es:'',fr:'' } });
          const blobUrl = URL.createObjectURL(f);
          const a = document.createElement('a'); a.href = blobUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(blobUrl);
          setStatus('Imagem preparada para download. Coloque manualmente em ' + src);
          renderCategory(catId);
        }
      }catch(e){ console.error(e); setStatus('Erro ao adicionar imagem: '+e.message); }
    };
    inp.click();
  }

  function sanitizeFileName(n){ return n.replace(/[^a-z0-9_.-]/gi,'_'); }

  function openEditDescriptions(catId, idx){ const item = jsonData[catId][idx]; const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.inset='0'; modal.style.background='rgba(0,0,0,0.5)'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.zIndex='11000'; const box = document.createElement('div'); box.style.background='#fff'; box.style.color='#111'; box.style.padding='12px'; box.style.borderRadius='8px'; box.style.width='480px'; const h = document.createElement('h3'); h.textContent='Editar descrições'; box.appendChild(h); ['pt','en','es','fr'].forEach(lang=>{ const lab = document.createElement('div'); lab.textContent = lang; lab.style.marginTop='8px'; box.appendChild(lab); const ta = document.createElement('textarea'); ta.style.width='100%'; ta.style.minHeight='48px'; ta.value = (item.descriptions && item.descriptions[lang]) || ''; ta.oninput = ()=>{}; box.appendChild(ta); ta.dataset.lang = lang; }); const actions = document.createElement('div'); actions.style.display='flex'; actions.style.justifyContent='flex-end'; actions.style.gap='8px'; actions.style.marginTop='10px'; const cancel = document.createElement('button'); cancel.textContent='Cancelar'; cancel.onclick = ()=>{ modal.remove(); }; const save = document.createElement('button'); save.textContent='Salvar'; save.style.background='#2c752c'; save.style.color='#fff'; save.onclick = ()=>{ const taList = box.querySelectorAll('textarea'); taList.forEach(ta => { const l = ta.dataset.lang; item.descriptions = item.descriptions || {}; item.descriptions[l] = ta.value; }); modal.remove(); renderCategory(catId); }; actions.appendChild(cancel); actions.appendChild(save); box.appendChild(actions); modal.appendChild(box); document.body.appendChild(modal); }

  (async ()=>{ await loadJson(); renderActiveTab(); })();

})();


