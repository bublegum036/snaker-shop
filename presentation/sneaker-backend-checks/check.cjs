const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[], external=[], overflows=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  const url=pathToFileURL(resolve(__dirname,'../sneaker-backend.html')).href;
  const previews='/tmp/sneaker-backend-preview';fs.mkdirSync(previews,{recursive:true});
  await page.goto(url);await page.waitForFunction(()=>window.sneakerDeck);
  const meta=await page.evaluate(()=>({ids:SNEAKER.slides.map(s=>s.id),notes:SNEAKER.slides.every(s=>s.notes.length>=3&&s.question&&s.answer&&s.sources.length)}));
  assert.deepEqual(meta.ids,Array.from({length:192},(_,i)=>i+1));assert(meta.notes);
  for(const viewport of [{width:1366,height:768},{width:1920,height:1080},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(let id=1;id<=192;id++){
      await page.evaluate(id=>sneakerDeck.go(id),id);
      const issues=await page.evaluate(({mobile})=>{
        const slide=document.querySelector('.slide:not([hidden])'),frame=slide.getBoundingClientRect();
        const issues=[];
        if(document.documentElement.scrollWidth>innerWidth+1)issues.push({kind:'page-width',width:document.documentElement.scrollWidth});
        if(!mobile&&document.documentElement.scrollHeight>innerHeight+1)issues.push({kind:'page-height',height:document.documentElement.scrollHeight,limit:innerHeight});
        for(const el of slide.querySelectorAll('h1,h3,p,pre,td,th,.request-strip,.url-piece b,.flow-node')){
          if(!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue;
          const r=el.getBoundingClientRect();
          if(r.left<frame.left-1||r.right>frame.right+1)issues.push({kind:'outside-slide',tag:el.tagName,text:el.textContent.slice(0,50)});
          if(el.clientWidth&&el.scrollWidth>el.clientWidth+2&&!(mobile&&el.matches('.m01-code pre')&&getComputedStyle(el).overflowX==='auto'))issues.push({kind:'text-width',tag:el.tagName,text:el.textContent.slice(0,50),width:el.clientWidth,scroll:el.scrollWidth});
        }
        return issues;
      },{mobile:viewport.width<700});
      if(issues.length)overflows.push({viewport,id,issues});
      if(viewport.width===1366&&(id>=23||[1,6,10,13,22].includes(id)))await page.screenshot({path:resolve(previews,`slide-${String(id).padStart(2,'0')}.png`),fullPage:true});
      if(viewport.width===390&&[67,98,100,104,108,109,114,119,120,122,124,126,129,131,133,135,136,138,141,145,147,151,152,155,156,158,160,162,165,168,170,171,172,174,176,177,178,179,180,182,184,185,187,188,189,190,191,192].includes(id))await page.screenshot({path:resolve(previews,`mobile-${id}.png`),fullPage:true});
    }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>sneakerDeck.go(1));await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),2);
  await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),1);
  await page.keyboard.press('End');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),192);
  await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),1);
  await page.evaluate(()=>{sneakerDeck.go(6);sneakerDeck.setSteps(true);});
  assert.equal(await page.locator('#slide-6 .pending').count(),4);
  await page.click('#next');assert.equal(await page.evaluate(()=>sneakerDeck.getState().revealed),1);
  await page.click('#previous');assert.equal(await page.evaluate(()=>sneakerDeck.getState().revealed),0);
  for(let i=0;i<4;i++)await page.click('#next');
  assert.equal(await page.locator('#slide-6 .pending').count(),0);
  await page.click('#next');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),7);
  await page.click('#steps');assert.equal(await page.evaluate(()=>sneakerDeck.getState().stepping),false);
  await page.click('#contents');await page.click('#toc-list a[href="#s-010"]');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),10);
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.click('#notes');assert(await page.locator('#notes-content').innerText().then(t=>t.includes('quantity=2')));
  await page.locator('#notes-content summary').click();assert(await page.locator('#notes-content details').getAttribute('open')!==null);
  await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),10);
  await page.screenshot({path:resolve(previews,'notes.png')});await page.keyboard.press('Escape');
  await page.evaluate(()=>sneakerDeck.go(13));
  await page.selectOption('#filter-brand','2');assert.match(await page.locator('#filter-result').innerText(),/подходящих товаров нет/);
  await page.selectOption('#filter-size','41');assert.match(await page.locator('#filter-result').innerText(),/City Walk/);
  assert.equal(await page.locator('#filter-url').innerText(),'/products?brand_id=2&size=41');
  await page.selectOption('#filter-brand','1');await page.selectOption('#filter-size','43');assert.match(await page.locator('#filter-result').innerText(),/нет в наличии/);
  for(const brand of ['', '1', '2'])for(const size of ['', '42', '43', '41']){
    await page.selectOption('#filter-brand',brand);await page.selectOption('#filter-size',size);
    const dimensions=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth}));
    if(dimensions.height>768||dimensions.width>1366)overflows.push({variant:'filter',brand,size,...dimensions});
  }
  await page.evaluate(()=>sneakerDeck.resetFilters());
  await page.evaluate(()=>sneakerDeck.go(22));await page.click('#slide-22 .reveal-answer');assert(await page.locator('#quiz-answer').isVisible());assert(!(await page.locator('#slide-22 .quiz-questions').isVisible()));
  assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
  await page.screenshot({path:resolve(previews,'quiz-answer.png')});
  await page.click('#slide-22 .reveal-answer');assert(!(await page.locator('#quiz-answer').isVisible()));
  await page.evaluate(()=>sneakerDeck.go(30));
  await page.click('#slide-30 .reveal-answer');
  assert.match(await page.locator('#python-answer').innerText(),/True\nFalse\nFalse/);
  assert(!(await page.locator('#slide-30 .quiz-questions').isVisible()));
  const quizHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
  if(quizHeight>768)overflows.push({variant:'python-quiz-answer',height:quizHeight});
  await page.screenshot({path:resolve(previews,'python-quiz-answer.png'),fullPage:true});
  await page.click('#slide-30 .reveal-answer');
  await page.evaluate(()=>{sneakerDeck.go(34);sneakerDeck.setSteps(true);});
  assert.equal(await page.locator('#slide-34 .pending').count(),4);
  await page.click('#next');assert.equal(await page.locator('#slide-34 .pending').count(),3);
  await page.evaluate(()=>{sneakerDeck.setSteps(false);sneakerDeck.go(37);});
  for(const [key,status,called] of [['zero',422,false],['good',200,true],['negative',422,false],['text',422,false],['boolean',422,false]]){
    await page.selectOption('#quantity-case',key);
    assert.equal(await page.locator('#quantity-result .status').innerText(),String(status));
    assert.match(await page.locator('#quantity-result').innerText(),called?/Тело обработчика: вызвано/:/Тело обработчика: не вызвано/);
    const height=await page.evaluate(()=>document.documentElement.scrollHeight);
    if(height>768)overflows.push({variant:'quantity',key,height});
  }
  await page.evaluate(()=>sneakerDeck.resetQuantity());
  await page.click('#contents');assert.equal(await page.locator('.toc-chapter').count(),18);
  await page.click('#toc-list a[href="#s-023"]');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),23);
  await page.goto(url+'#s-040');await page.reload();assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),40);
  await page.goto(url+'#s-014');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),14);await page.reload();assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),14);
  for(const [id,selector,values] of [[49,'#network-case',['host','container']],[67,'#er-domain',['all','catalog','cart','orders']],[69,'#sql-case',['cheap','north','first']],[71,'#mutation-case',['0','1','2']]]){
    await page.evaluate(id=>sneakerDeck.go(id),id);
    for(const value of values){
      await page.selectOption(selector,value);
      const variantHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
      if(variantHeight>768)overflows.push({id,selector,value,height:variantHeight});
      if(id===49)assert.match(await page.locator('#network-result').innerText(),value==='host'?/127.0.0.1:55432/:/db:5432/);
      if(id===67)assert.equal(await page.locator('.er-muted').count()>0,value!=='all');
      if(id===69)assert.equal(await page.locator('#sql-result tbody tr').count(),value==='first'?1:2);
      if(id===71)assert.equal(await page.locator('#mutation-result tbody tr').count(),value==='2'?0:1);
    }
    await page.selectOption(selector,values[0]);
  }
  await page.evaluate(()=>sneakerDeck.go(72));await page.click('#slide-72 .reveal-answer');
  assert.match(await page.locator('#db-answer').innerText(),/anya@example.com/);
  assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
  await page.screenshot({path:resolve(previews,'db-answer.png'),fullPage:true});
  await page.click('#slide-72 .reveal-answer');
  await page.goto(url+'#s-067');await page.reload();assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),67);
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const [id,selector,values] of [[77,'#orm-product',['10','999']],[79,'#orm-write',['0','1','2','3']],[97,'#auth-case',['none','expired','signature','missing_user','valid','not_admin','admin']]]){
      await page.evaluate(id=>sneakerDeck.go(id),id);
      for(const value of values){
        await page.selectOption(selector,value);
        const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
        if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id,value,viewport,...dim});
        if(id===77)assert.match(await page.locator('#orm-product-result').innerText(),value==='10'?/North Runner/:/None/);
        if(id===79)assert.match(await page.locator('#orm-write-result').innerText(),value==='3'?/видит строку: да/:/видит строку: нет/);
        if(id===97)assert.equal(Number(await page.locator('#auth-case-result .status').innerText()),['valid','admin'].includes(value)?200:value==='not_admin'?403:401);
      }
      await page.selectOption(selector,values[0]);
    }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>sneakerDeck.go(98));await page.click('#slide-98 .reveal-answer');
  assert.match(await page.locator('#auth-answer').innerText(),/require_admin/);
  const authAnswerHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
  if(authAnswerHeight>768)overflows.push({variant:'auth-answer',height:authAnswerHeight});
  await page.screenshot({path:resolve(previews,'auth-answer.png'),fullPage:true});
  await page.click('#slide-98 .reveal-answer');
  await page.evaluate(()=>{sneakerDeck.go(91);sneakerDeck.setSteps(true);});
  assert.equal(await page.locator('#slide-91 .pending').count(),4);
  await page.click('#next');assert.equal(await page.locator('#slide-91 .pending').count(),3);
  await page.evaluate(()=>sneakerDeck.setSteps(false));
  await page.goto(url+'#s-092');await page.reload();assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),92);
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const [id,selector,values] of [[107,'#rollback-point',['after_order','after_first_stock','after_cart_delete']],[110,'#checkout-case',['empty','second_item_short','same_user','cart_write']]]){
      await page.evaluate(id=>sneakerDeck.go(id),id);
      for(const value of values){
        await page.selectOption(selector,value);
        const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
        if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id,value,viewport,...dim});
        if(id===107)assert.match(await page.locator('#rollback-result').innerText(),/Снимок данных совпал/);
        if(id===110&&value==='cart_write')assert.match(await page.locator('#checkout-case-result').innerText(),/301/);
      }
      await page.selectOption(selector,values[0]);
    }
    for(const [id,key] of [[114,'health'],[118,'debug'],[119,'review'],[124,'m01_compose'],[126,'m01_health'],[130,'m01_catalog'],[131,'m01_users'],[132,'m01_orders'],[133,'m01_migration'],[134,'m01_seed'],[135,'m01_accept'],[138,'m2_read'],[139,'m2_schema'],[140,'m2_filters'],[143,'m2_write'],[144,'m2_delete'],[146,'m2_review'],[148,'m3_register'],[149,'m3_hash'],[150,'m3_login'],[151,'m3_current'],[153,'m3_admin'],[154,'m3_protect'],[156,'m3_review'],[158,'m4_add'],[159,'m4_read'],[160,'m4_owner'],[161,'m4_edit'],[162,'m4_repeat'],[164,'m4_review'],[167,'m5_checks'],[168,'m5_snapshot'],[169,'m5_atomic'],[170,'m5_session'],[171,'m5_locks'],[172,'m5_same_user'],[173,'m5_history'],[174,'m5_status'],[176,'m5_rollback'],[177,'m5_races'],[178,'m5_review'],[180,'m6_refactor'],[181,'m6_errors'],[182,'m6_config'],[183,'m6_readme'],[184,'m6_clean'],[185,'m6_trace'],[186,'m6_review'],[187,'final_demo'],[189,'final_audit'],[190,'final_concept'],[191,'final_submit']]){
      await page.evaluate(id=>sneakerDeck.go(id),id);await page.click(`#slide-${id} [data-prompt]`);
      assert(await page.locator('#prompt-dialog').isVisible());
      assert.equal(await page.locator('#prompt-text').inputValue(),await page.evaluate(key=>SNEAKER_PRACTICE_PROMPTS[key].text,key));
      await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),id);
      const dialogFits=await page.locator('#prompt-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1);
      assert(dialogFits);
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.testCopiedPrompt=text;}}}));
      await page.click('#copy-prompt');assert.match(await page.locator('#prompt-status').innerText(),/скопирован/);
      assert.equal(await page.evaluate(()=>window.testCopiedPrompt),await page.locator('#prompt-text').inputValue());
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Test clipboard unavailable');}}}));
      await page.click('#copy-prompt');assert.match(await page.locator('#prompt-status').innerText(),/Текст выделен/);
      assert(await page.locator('#prompt-text').evaluate(el=>el.selectionEnd-el.selectionStart===el.value.length));
      await page.locator('#prompt-dialog [data-close]').click();assert(!(await page.locator('#prompt-dialog').isVisible()));
    }
  }
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>sneakerDeck.go(119));await page.click('#slide-119 .reveal-answer');
  assert.match(await page.locator('#review-answer').innerText(),/Order.user_id == user.id/);
  const reviewHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
  if(reviewHeight>768)overflows.push({variant:'review-answer',height:reviewHeight});
  await page.screenshot({path:resolve(previews,'review-answer.png'),fullPage:true});
  await page.click('#slide-119 .reveal-answer');
  await page.evaluate(()=>{sneakerDeck.go(109);sneakerDeck.setSteps(true);});
  assert.equal(await page.locator('#slide-109 .pending').count(),3);
  await page.click('#next');assert.equal(await page.locator('#slide-109 .pending').count(),2);
  await page.evaluate(()=>sneakerDeck.setSteps(false));
  await page.goto(url+'#s-114');await page.reload();assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),114);
  await page.click('#slide-114 [data-prompt]');await page.screenshot({path:resolve(previews,'health-prompt.png')});await page.keyboard.press('Escape');
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const [id,selector,values] of [[122,'#m01-os',['unix','windows']],[128,'#m01-health',['up','stopped','recovered']]]){
      await page.evaluate(id=>sneakerDeck.go(id),id);
      for(const value of values){
        await page.selectOption(selector,value);
        const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
        if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id,value,viewport,...dim});
        if(id===122)assert.match(await page.locator('#m01-env-result').innerText(),value==='windows'?/Activate.ps1/:/source .venv/);
        if(id===128)assert.match(await page.locator('#m01-health-result').innerText(),value==='stopped'?/HTTP 503/:/HTTP 200/);
      }
      await page.selectOption(selector,values[0]);
    }
    await page.evaluate(()=>sneakerDeck.go(136));await page.click('#slide-136 .reveal-answer');
    assert.match(await page.locator('#m01-answer').innerText(),/Правка класса сама не меняет БД/);
    const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
    if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id:136,variant:'answer',viewport,...dim});
    await page.click('#slide-136 .reveal-answer');
  }
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>{sneakerDeck.go(133);sneakerDeck.setSteps(true);});
  assert.equal(await page.locator('#slide-133 .pending').count(),3);
  await page.click('#next');assert.equal(await page.locator('#slide-133 .pending').count(),2);
  await page.evaluate(()=>sneakerDeck.setSteps(false));
  await page.goto(url+'#s-129');await page.reload();assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),129);
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const [id,selector,values] of [[145,'#m23-query',['all','brand','price','size','sold_out','combined','empty','page2']],[155,'#m23-identity',['none','invalid','user','admin']]]){
      await page.evaluate(id=>sneakerDeck.go(id),id);
      for(const value of values){
        await page.selectOption(selector,value);
        const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
        if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id,value,viewport,...dim});
        if(id===145){
          const ids=await page.evaluate(key=>SNEAKER_M23.filters.find(x=>x.key===key).ids,value);
          assert((await page.locator('#m23-query-result').innerText()).includes(ids.length?ids.join(', '):'[]'));
        }
        if(id===155)assert.match(await page.locator('#m23-access-result').innerText(),value==='admin'?/201/:value==='user'?/403/:/401/);
      }
      await page.selectOption(selector,values[0]);
    }
    await page.evaluate(()=>sneakerDeck.go(156));await page.click('#slide-156 .reveal-answer');
    assert.match(await page.locator('#m23-review-answer').innerText(),/403/);
    const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
    if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id:156,variant:'answer',viewport,...dim});
    await page.click('#slide-156 .reveal-answer');
  }
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>{sneakerDeck.go(152);sneakerDeck.setSteps(true);});
  assert.equal(await page.locator('#slide-152 .pending').count(),3);
  await page.click('#next');assert.equal(await page.locator('#slide-152 .pending').count(),2);
  await page.evaluate(()=>sneakerDeck.setSteps(false));
  await page.goto(url+'#s-145');await page.reload();assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),145);
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const [id,selector,values] of [[160,'#m45-owner',['boris','admin']],[176,'#m45-fault',['after_order','after_first_stock','after_cart_delete']],[177,'#m45-race',['last_pair','same_user','cart_write']]]){
      await page.evaluate(id=>sneakerDeck.go(id),id);
      for(const value of values){
        await page.selectOption(selector,value);
        const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
        if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id,value,viewport,...dim});
        if(id===160)assert.match(await page.locator('#m45-owner-result').innerText(),/404/);
        if(id===176)assert.match(await page.locator('#m45-fault-result').innerText(),/Снимок данных совпал/);
        if(id===177)assert.match(await page.locator('#m45-race-result').innerText(),value==='cart_write'?/301/:/409/);
      }
      await page.selectOption(selector,values[0]);
    }
    await page.evaluate(()=>sneakerDeck.go(178));await page.click('#slide-178 .reveal-answer');
    assert.match(await page.locator('#m45-review-answer').innerText(),/Idempotency-Key/);
    const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
    if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id:178,variant:'answer',viewport,...dim});
    await page.click('#slide-178 .reveal-answer');
  }
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>{sneakerDeck.go(166);sneakerDeck.setSteps(true);});
  assert.equal(await page.locator('#slide-166 .pending').count(),3);
  await page.click('#next');assert.equal(await page.locator('#slide-166 .pending').count(),2);
  await page.evaluate(()=>sneakerDeck.setSteps(false));
  await page.goto(url+'#s-157');await page.reload();assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),157);
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const [id,selector,values] of [[184,'#final-clean',['environment','database','application']],[187,'#final-journey',['0','1','2','3','4']],[188,'#final-error',['no_token','not_admin','foreign_cart','quantity_zero','negative_price','empty_email','short_second_item','foreign_order','status_forbidden']],[189,'#final-domain',['catalog','auth','cart','orders','health']]]){
      await page.evaluate(id=>sneakerDeck.go(id),id);
      for(const value of values){
        await page.selectOption(selector,value);
        const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
        if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id,value,viewport,...dim});
        if(id===184)assert.match(await page.locator('#final-clean-result').innerText(),/verify_final.py/);
        if(id===187){const expected=await page.evaluate(i=>SNEAKER_FINAL.journey[Number(i)].result,value);assert((await page.locator('#final-journey-result').innerText()).includes(expected));}
        if(id===188){const expected=await page.evaluate(k=>SNEAKER_FINAL.errors.find(x=>x.key===k).status,value);assert((await page.locator('#final-error-result').innerText()).includes('HTTP '+expected));}
        if(id===189)assert.equal(await page.locator('#final-domain-result tbody tr').count(),await page.evaluate(k=>SNEAKER_FINAL.operations[k].length,value));
      }
      await page.selectOption(selector,values[0]);
    }
    await page.evaluate(()=>sneakerDeck.go(192));await page.click('#slide-192 .reveal-answer');
    assert.match(await page.locator('#final-answer').innerText(),/409/);
    const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
    if(dim.width>viewport.width+1||(viewport.width>700&&dim.height>viewport.height+1))overflows.push({id:192,variant:'answer',viewport,...dim});
    await page.click('#slide-192 .reveal-answer');
  }
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>{sneakerDeck.go(185);sneakerDeck.setSteps(true);});
  assert.equal(await page.locator('#slide-185 .pending').count(),4);
  await page.click('#next');assert.equal(await page.locator('#slide-185 .pending').count(),3);
  await page.evaluate(()=>sneakerDeck.setSteps(false));
  await page.goto(url+'#s-179');await page.reload();assert.equal(await page.evaluate(()=>sneakerDeck.getState().id),179);
  await page.emulateMedia({media:'print'});
  const printIssues=await page.evaluate(()=>[...document.querySelectorAll('.slide')].flatMap(slide=>{
    const frame=slide.getBoundingClientRect();
    const defects=[...slide.querySelectorAll('h1,p,pre,td,th,svg,.takeaway')].filter(el=>el.getClientRects().length).flatMap(el=>{
      const r=el.getBoundingClientRect();return r.bottom>frame.bottom-34||r.right>frame.right-30||r.left<frame.left+25?[{tag:el.tagName,text:el.textContent.slice(0,50)}]:[];
    });return defects.length?[{id:slide.dataset.id,defects}]:[];
  }));
  await page.pdf({path:resolve(__dirname,'../sneaker-backend-chapters-1-18.pdf'),preferCSSPageSize:true,printBackground:true,tagged:true,outline:true});
  await page.pdf({path:resolve(__dirname,'../sneaker-backend-chapters-17-18.pdf'),pageRanges:'179-192',preferCSSPageSize:true,printBackground:true,tagged:true});
  const result={slides:192,viewports:['1366×768','1920×1080','390×844'],notes:meta.notes,checks:['keyboard navigation','step reveal and reverse','table of contents','notes and answer','modal keyboard isolation','interactive query and results','quiz reveal','deep link and reload','offline assets','Python quiz', 'validation examples: five cases', 'chapter 4 steps', 'eighteen chapters', 'print layout', 'network topology toggle', 'ER highlighting', 'SQL query variants', 'SQL mutation sequence', 'database quiz', 'ORM select variants', 'flush and commit states', 'seven auth variants on desktop and mobile', 'auth quiz', 'login sequence step reveal', 'rollback variants', 'checkout boundaries', '52 complete prompts on desktop and mobile', 'clipboard success and fallback', 'review quiz', 'lock timeline step reveal', 'OS instructions', 'M0 HTTP states', 'M1 acceptance quiz', 'migration step reveal', 'M2 query results', 'M3 access matrix', 'M3 review quiz', 'Swagger step reveal','M4 ownership variants','M5 rollback and race variants','M5 review quiz','M5 transaction steps','clean run stages','final buyer journey','nine final error cases','API domain matrix','final explanation quiz','request trace step reveal'],overflows,printIssues,errors,externalRequests:external,previewDirectory:previews};
  fs.writeFileSync(resolve(__dirname,'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));await browser.close();
  if(overflows.length||printIssues.length||errors.length||external.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
