"use strict";
(() => {
  const { slides, esc } = window.SNEAKER;
  const $ = selector => document.querySelector(selector);
  const chapterNames = {1:'Что мы собираем', 2:'Как читать запросы и ответы', 3:'Python для чтения бэкенда', 4:'FastAPI и Pydantic', 5:'Окружение и Docker', 6:'PostgreSQL: таблицы и связи', 7:'SQLAlchemy и Alembic', 8:'Пользователь и доступ', 9:'Оформление заказа', 10:'Практика с нейросетью', 11:'Практика M0 · окружение', 12:'Практика M1 · модели и миграции', 13:'Практика M2 · каталог', 14:'Практика M3 · вход и права', 15:'Практика M4 · корзина', 16:'Практика M5 · заказ и транзакция', 17:'Практика M6 · структура и запуск', 18:'Финальная проверка и сдача'};
  let index=0, stepping=false, revealed=0;
  const hashFor = id => '#s-'+String(id).padStart(3,'0');
  $('#deck').innerHTML=slides.map(s=>`<section class="slide" id="slide-${s.id}" data-id="${s.id}" data-chapter="${s.chapter}" data-page="${String(s.id).padStart(2,'0')} / ${slides.length}" aria-label="Слайд ${s.id}: ${esc(s.title)}" hidden><div class="eyebrow"><span class="chapter-index">${String(s.chapter).padStart(2,'0')}</span><span>${chapterNames[s.chapter]}</span></div>${s.id===1?'':`<h1 class="slide-title">${esc(s.title)}</h1>`}${s.lead?`<p class="lead">${esc(s.lead)}</p>`:''}<div class="scene">${s.html}</div><p class="takeaway">${esc(s.takeaway)}</p></section>`).join('');
  $('#toc-list').innerHTML=[...new Set(slides.map(s=>s.chapter))].map(ch=>`<h3 class="toc-chapter">${String(ch).padStart(2,'0')} · ${chapterNames[ch]}</h3><div class="toc-links">${slides.filter(s=>s.chapter===ch).map(s=>`<a href="${hashFor(s.id)}"><span>${String(s.id).padStart(2,'0')}</span>${esc(s.title)}</a>`).join('')}</div>`).join('');
  const sections=[...document.querySelectorAll('.slide')];
  const getMax = () => Math.max(0,...[...sections[index].querySelectorAll('[data-step]')].map(el=>Number(el.dataset.step)));
  function applySteps() {
    sections.forEach((section,i)=>section.querySelectorAll('[data-step]').forEach(el=>{
      const pending=i===index && stepping && Number(el.dataset.step)>revealed;
      el.classList.toggle('pending',pending);
      if(pending)el.setAttribute('aria-hidden','true');else el.removeAttribute('aria-hidden');
      el.inert=pending;
    }));
    const max=getMax();
    $('#steps').setAttribute('aria-pressed',String(stepping));
    $('#step-count').textContent=stepping?(max?`Шаг ${revealed+1} / ${max+1}`:'Слайд целиком'):'';
    $('#previous').disabled=index===0 && (!stepping||revealed===0);
    $('#next').disabled=index===slides.length-1 && (!stepping||revealed>=max);
    $('#next').innerHTML=stepping&&revealed<max?'Следующий шаг <span aria-hidden="true">→</span>':index===slides.length-1?'Конец главы <span aria-hidden="true">✓</span>':'Дальше <span aria-hidden="true">→</span>';
  }
  function notes() {
    const s=slides[index];
    $('#notes-title').textContent=String(s.id).padStart(2,'0')+' · '+s.title;
    $('#notes-content').innerHTML=s.notes.map(n=>`<p>${esc(n)}</p>`).join('')+`<div class="note-question"><h3>Вопрос ученику</h3><p>${esc(s.question)}</p><details><summary>Показать ответ</summary><p>${esc(s.answer)}</p></details></div><div class="sources">${s.sources.map(([name,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}</a>`).join('')}</div>`;
  }
  function navigate(id, updateHash=true) {
    const wanted=slides.findIndex(s=>s.id===Number(id));
    index=wanted<0?0:wanted;
    revealed=0;
    sections.forEach((s,i)=>s.hidden=i!==index);
    $('#slide-number').textContent=`${String(slides[index].id).padStart(2,'0')} / ${slides.length}`;
    $('#progress-fill').style.width=((index+1)/slides.length*100)+'%';
    $('#toc-list').querySelectorAll('a').forEach(a=>{
      if(a.hash===hashFor(slides[index].id))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    });
    if(updateHash&&location.hash!==hashFor(slides[index].id))history.pushState(null,'',hashFor(slides[index].id));
    document.title=`${String(slides[index].id).padStart(2,'0')} · ${slides[index].title} — Бэкенд магазина`;
    notes();applySteps();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function next(){if(stepping&&revealed<getMax()){revealed++;applySteps();}else if(index<slides.length-1)navigate(slides[index+1].id);}
  function previous(){if(stepping&&revealed>0){revealed--;applySteps();}else if(index>0)navigate(slides[index-1].id);}
  function setSteps(value){stepping=Boolean(value);revealed=0;applySteps();}
  function openDialog(id){const dialog=$(id);if(!dialog.open)dialog.showModal();}
  async function fullScreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('#fullscreen').textContent='Полный экран недоступен';}}
  $('#next').addEventListener('click',next);
  $('#previous').addEventListener('click',previous);
  $('#steps').addEventListener('click',()=>setSteps(!stepping));
  $('#contents').addEventListener('click',()=>openDialog('#toc-dialog'));
  $('#notes').addEventListener('click',()=>openDialog('#notes-dialog'));
  $('#fullscreen').addEventListener('click',fullScreen);
  $('#print').addEventListener('click',()=>window.print());
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  }));
  $('#toc-list').addEventListener('click',event=>{
    const a=event.target.closest('a');if(!a)return;
    event.preventDefault();navigate(Number(a.hash.slice(3)));$('#toc-dialog').close();$('#deck').focus({preventScroll:true});
  });
  window.addEventListener('hashchange',()=>navigate(Number(location.hash.slice(3)),false));
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||document.querySelector('dialog[open]')||event.target.closest('select,input,textarea'))return;
    const key=event.key.toLowerCase();
    if(['arrowright','pagedown'].includes(key)){event.preventDefault();next();}
    else if(['arrowleft','pageup'].includes(key)){event.preventDefault();previous();}
    else if(key===' '&&!event.target.closest('button,a,summary')){event.preventDefault();next();}
    else if(key==='home'){event.preventDefault();navigate(1);}
    else if(key==='end'){event.preventDefault();navigate(slides.at(-1).id);}
    else if(key==='n'){event.preventDefault();openDialog('#notes-dialog');}
    else if(key==='t'){event.preventDefault();openDialog('#toc-dialog');}
    else if(key==='s'){event.preventDefault();setSteps(!stepping);}
    else if(key==='f'){event.preventDefault();fullScreen();}
  });
  const products=[{id:10,name:'North Runner',brand:1,price:7990,sizes:{42:3,43:0}},{id:20,name:'City Walk',brand:2,price:5990,sizes:{41:5}}];
  function updateFilters(){
    const brand=$('#filter-brand').value,size=$('#filter-size').value;
    const params=new URLSearchParams();if(brand)params.set('brand_id',brand);if(size)params.set('size',size);
    $('#filter-url').textContent='/products'+(params.size?'?'+params.toString():'');
    const found=products.filter(p=>(!brand||p.brand===Number(brand))&&(!size||Object.hasOwn(p.sizes,size)));
    $('#filter-result').innerHTML=`<h3>Ожидаемый ответ: <span class="pill mint">200</span> · ${found.length} ${found.length===1?'товар':'товара'}</h3>`+(found.length?`<table class="small-table"><thead><tr><th>Товар</th><th>Цена</th><th>${size?'Размер · остаток':'Размеры · остатки'}</th></tr></thead><tbody>${found.map(p=>`<tr><td>${p.name}</td><td>${p.price.toLocaleString('ru-RU')} ₽</td><td>${Object.entries(p.sizes).filter(([s])=>!size||s===size).map(([s,q])=>`${s} · ${q} ${q===1?'пара':q>=2&&q<=4?'пары':'пар'}${q===0?' (нет в наличии)':''}`).join('; ')}</td></tr>`).join('')}</tbody></table>`:'<p class="empty-state"><code>[]</code> — подходящих товаров нет.</p>');
  }
  $('#filter-brand').addEventListener('change',updateFilters);$('#filter-size').addEventListener('change',updateFilters);updateFilters();
  document.querySelectorAll('.reveal-answer').forEach(button=>button.addEventListener('click',event=>{
    const button=event.currentTarget, expanded=button.getAttribute('aria-expanded')==='true';
    const section=button.closest('.slide');
    button.setAttribute('aria-expanded',String(!expanded));button.textContent=expanded?'Показать разбор →':'Вернуться к вопросам ↺';
    document.getElementById(button.getAttribute('aria-controls')).hidden=expanded;
    section.querySelector('.quiz-questions').hidden=!expanded;
  }));
  function updateQuantity(){
    const example=window.SNEAKER_EXAMPLES.results['37'].cases[$('#quantity-case').value];
    $('#quantity-input').textContent=JSON.stringify(example.input,null,2);
    const error=example.body.detail?.[0];
    const body=error?{loc:error.loc,type:error.type,...(error.ctx?{ctx:error.ctx}:{})}:example.body;
    const displayed=error?'{\n  \"loc\": '+JSON.stringify(error.loc)+',\n  \"type\": '+JSON.stringify(error.type)+(error.ctx?',\n  \"ctx\": '+JSON.stringify(error.ctx):'')+'\n}':JSON.stringify(body,null,2);
    $('#quantity-result').innerHTML=`<div class="validation-result"><span class="status ${error?'error':''}">${example.status}</span><pre>${esc(displayed)}</pre><p>Тело обработчика: <b>${example.handler_calls?'вызвано':'не вызвано'}</b></p>${error?`<p class="mini">${error.type==='greater_than'?'quantity должно быть больше 0.':'quantity должно быть целым числом.'}</p>`:''}</div>`;
  }
  $('#quantity-case').addEventListener('change',updateQuantity);updateQuantity();
  window.SNEAKER.initChapter56?.();
  window.SNEAKER.initChapter78?.();
  window.SNEAKER.initChapter910?.();
  window.SNEAKER.initChapter1112?.();
  window.SNEAKER.initChapter1314?.();
  window.SNEAKER.initChapter1516?.();
  window.SNEAKER.initChapter1718?.();
  if(window.rough){
    document.querySelectorAll('svg [data-rough]').forEach(rect=>{
      const svg=rect.ownerSVGElement, artist=rough.svg(svg);
      const sketch=artist.rectangle(Number(rect.getAttribute('x')),Number(rect.getAttribute('y')),Number(rect.getAttribute('width')),Number(rect.getAttribute('height')),{seed:Number(rect.dataset.rough)*127,roughness:.65,bowing:.6,stroke:'#202333',strokeWidth:1.4});
      sketch.setAttribute('aria-hidden','true');rect.after(sketch);rect.setAttribute('stroke','none');
    });
  }
  window.sneakerDeck={
    slides,go:navigate,setSteps,next,previous,
    getState:()=>({id:slides[index].id,total:slides.length,stepping,revealed,max:getMax()}),
    resetFilters:()=>{$('#filter-brand').value='1';$('#filter-size').value='42';updateFilters();},
    resetQuantity:()=>{$('#quantity-case').value='zero';updateQuantity();}
  };
  navigate(Number(location.hash.slice(3))||1,false);
})();
