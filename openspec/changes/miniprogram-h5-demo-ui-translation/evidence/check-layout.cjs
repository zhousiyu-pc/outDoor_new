const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {wcc,wcsc}=require('/Applications/wechatwebdevtools.app/Contents/Resources/package.nw/node_modules/wcc');
const {chromium}=require('/Users/zhousiyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const project=path.resolve(__dirname, '../../../..');
const scratch=process.env.MINIPROGRAM_UI_BASELINE_ROOT || '/private/tmp/miniprogram-ui-regression';
const output=project+'/openspec/changes/miniprogram-h5-demo-ui-translation/evidence';
fs.mkdirSync(output,{recursive:true});
const names=['index','results','plan-detail','feedback'];
function load(root,name){
  const file=root+'/pages/'+name+'/'+name+'.js';let definition;
  const ctx={console,require:createRequire(file),Page:d=>definition=d,wx:{getStorageSync(){},setStorageSync(){}},module:{exports:{}}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8'),ctx);return {definition,ctx};
}
async function compile(root){
  const xml=await wcc({cwd:root,files:names.map(n=>'./pages/'+n+'/'+n+'.wxml')});
  const ctx={console,window:{}};vm.createContext(ctx);vm.runInContext(xml,ctx);
  const css=await wcsc({cwd:root,files:[...names.map(n=>'./pages/'+n+'/'+n+'.wxss'),'./app.wxss'],pageCount:4});
  const decode=s=>vm.runInNewContext('"'+s+'"');
  const loaded=Object.fromEntries(names.map(n=>[n,load(root,n)]));
  const home=JSON.parse(JSON.stringify(loaded.index.definition.data));home.form.query='亲子绿道';home.originDisplayName='当前位置附近';
  const fallback=require(root+'/utils/recommendationPlans.js').buildRecommendationPlans(home.form)[0];
  const plan={...fallback,rank:1,sourceLabel:'路线信息',collectedAt:'时间待核验',warningText:fallback.uncertainties[0],
    decisionFacts:[{key:'drive',label:'车程',value:fallback.driveTime},{key:'difficulty',label:'难度',value:fallback.difficulty}],
    mapAction:{available:true,lat:22,lng:114,name:'路线入口'}};
  const results={...loaded.results.definition.data,plans:[plan],message:'布局测试使用项目既有 fallback 数据'};
  const detail={...loaded['plan-detail'].definition.data,plan,...loaded['plan-detail'].ctx.buildDetailViewModel(plan)};
  const feedback={...loaded.feedback.definition.data,planTitle:plan.title};
  const states={home:['index',home],advanced:['index',{...home,showAdvancedFilters:true}],
    'home-active':['index',{...home,quickSearchOptions:home.quickSearchOptions.map((p,i)=>({...p,active:i===0}))}],
    'home-sheet':['index',{...home,showDeparturePicker:true}],results:['results',results],
    'results-adopted':['results',{...results,plans:[{...plan,isAdopted:true,isFavorited:true}]}],
    'results-empty':['results',{...results,plans:[],nextActions:['试试其他条件']}],detail:['plan-detail',detail],
    'detail-sheet':['plan-detail',{...detail,showDeparturePicker:true}],
    'detail-saved':['plan-detail',{...detail,plan:{...plan,isFavorited:true},favoriteText:'已收藏'}],
    'detail-missing':['plan-detail',{...detail,plan:null,notFound:true,errorMessageText:'请先返回路线列表，选择一条路线查看详情。'}],feedback:['feedback',feedback],
    'feedback-selected':['feedback',{...feedback,feedbackTags:feedback.feedbackTags.map((p,i)=>({...p,active:i===0}))}],
    upload:['feedback',{...feedback,isUploadMode:true}]};
  return {states:Object.keys(states),render(state){const [n,data]=states[state];return {
    tree:ctx.$gwx('./pages/'+n+'/'+n+'.wxml')(data),
    css:decode(css.comm)+'\n'+decode(css['./app.wxss'])+'();\n'+decode(css['./pages/'+n+'/'+n+'.wxss'])+'();'};}};
}
const base='html,body{margin:0;padding:0}wx-page,wx-view,wx-picker{display:block}wx-text{display:inline}'+
 'wx-button{display:block;position:relative;box-sizing:border-box;text-align:center;border:0;border-radius:4px;font-size:17px;font-weight:700;line-height:1.41176471;padding:8px 24px}'+
 'wx-textarea{display:block;box-sizing:border-box;white-space:pre-wrap}wx-input{display:block;box-sizing:border-box}wx-button:after{display:none}';
const nativeRule=fs.readFileSync(path.join(__dirname,'native-v2-button.css'),'utf8');
async function mount(page,compiled,state,nativeLast){
 await page.goto('about:blank');
 await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>');
 await page.addStyleTag({content:base+(nativeLast?'':nativeRule)});
 const bundle=compiled.render(state);
 await page.evaluate(tree=>{
   function build(n){
     if(typeof n!=='object'||n===null)return document.createTextNode(String(n??''));
     const el=n.tag==='virtual'?document.createDocumentFragment():document.createElement(n.tag);
     for(const [k,v]of Object.entries(n.attr||{}))if(!k.startsWith('bind')&&!k.startsWith('catch'))el.setAttribute(k,String(v));
     if(n.tag==='wx-textarea'||n.tag==='wx-input')el.textContent=n.attr?.value||'';
     for(const child of n.children||[])el.append(build(child));return el;
   }
   document.body.replaceChildren(build(tree));
 },bundle.tree);
 await page.addScriptTag({content:bundle.css});
 if(nativeLast)await page.addStyleTag({content:nativeRule});
 return page.evaluate(()=>{
   const boxes=s=>[...document.querySelectorAll(s)].map(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);
     return {text:el.textContent.trim(),x:r.x,y:r.y,width:r.width,height:r.height,marginLeft:c.marginLeft,marginRight:c.marginRight,background:c.backgroundColor,color:c.color,fontSize:c.fontSize};});
   const p=document.querySelector('.intent-panel'),c=p&&getComputedStyle(p);
   return {scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,prompts:boxes('.prompt-chip'),search:boxes('.search-button'),
     buttons:boxes('wx-button'),tags:boxes('.tag'),sheets:boxes('.departure-sheet'),title:boxes('.hero-title'),titleLines:boxes('.hero-title > wx-view'),
     activePrompts:boxes('.prompt-chip.active'),activeTags:boxes('.tag.active'),adopted:boxes('.adopt-button.done'),saved:boxes('.favorite-action.active'),
     orientation:screen.orientation?.type,screenWidth:screen.width,
     innerWidth:p?p.clientWidth-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight):null};
 });
}
(async()=>{
 const before=await compile(scratch+'/before'),after=await compile(project+'/miniprogram');
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const report={nativeRule,validation:'WeChat compiler output + actual v2 width/margin CSS in Chromium; native textarea/keyboard/capsule and API flows are not emulated.',sources:{},cases:[]};
 for(const n of names)for(const ext of ['wxml','wxss','js']){const f='pages/'+n+'/'+n+'.'+ext;report.sources[f]=crypto.createHash('sha256').update(fs.readFileSync(project+'/miniprogram/'+f)).digest('hex');}
 try{
  for(const width of [320,390,430]){
   const page=await browser.newPage({viewport:{width,height:844},screen:{width,height:844},deviceScaleFactor:2,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'});
   await page.route('**/*',route=>route.abort());
   const old=await mount(page,before,'home',false);
   assert.equal(old.search[0].width,184,'must reproduce native width bug');
   assert.equal(new Set(old.prompts.map(p=>p.y)).size,old.prompts.length,'must reproduce stacked chips');
   report.cases.push({width,state:'before-home',...old});
   if(width===390)await page.locator('.intent-panel').screenshot({path:output+'/button-layout-before.png'});
   for(const nativeLast of [false,true])for(const state of after.states){
    const m=await mount(page,after,state,nativeLast);
    assert.equal(m.screenWidth,width,'rpx must use configured portrait width');
    assert.ok(m.orientation.startsWith('portrait'),'test must not use desktop landscape rpx conversion');
    if(m.scrollWidth>width){
     console.error(JSON.stringify({width,state,nativeLast,...m},null,2));
     console.error(await page.evaluate(()=>[...document.querySelectorAll('*')].map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,cls:e.className,x:r.x,width:r.width,html:e.innerHTML.slice(0,250)};}).filter(e=>e.x+e.width>innerWidth)));
     await page.screenshot({path:scratch+'/failure.png',fullPage:true});
    }
    assert.ok(m.scrollWidth<=width,state+' horizontal overflow at '+width);
    if(['home','advanced','home-sheet','home-active'].includes(state)){
     assert.ok(Math.abs(m.search[0].width-m.innerWidth)<=1,state+' search must fill card');
     assert.ok(new Set(m.prompts.map(p=>p.y)).size<m.prompts.length,'chips must share rows');
     assert.ok(m.prompts.every(p=>p.width<140),'chips must have intrinsic widths');
     assert.ok(m.titleLines[1].y>m.titleLines[0].y,'title must use native block line break');
    }
    if(state==='home-active')assert.equal(m.activePrompts[0].background,'rgb(220, 238, 224)');
    if(state==='feedback-selected')assert.equal(m.activeTags[0].background,'rgb(23, 107, 78)');
    if(state==='results-adopted')assert.equal(m.adopted[0].background,'rgb(14, 56, 43)');
    if(state==='detail-saved')assert.equal(m.saved[0].background,'rgb(251, 240, 233)');
    if(state.includes('sheet')){
     assert.ok(m.sheets[0].width<=width,'sheet overflow');
     for(const b of m.buttons.filter(b=>['今天下午','明天上午'].includes(b.text)))assert.ok(b.x>=0&&b.x+b.width<=width,'sheet button overflow');
    }
    if(['feedback','upload'].includes(state))assert.ok(m.tags.every(b=>b.width<140),'feedback chips too wide');
    report.cases.push({width,state,nativeLast,...m});
    if(width===390&&!nativeLast&&state==='home'){
     await page.locator('.intent-panel').screenshot({path:output+'/button-layout-after.png'});
     await page.screenshot({path:output+'/home-after-width-fix.png',fullPage:true});
    }
   }
   await page.close();
  }
  fs.writeFileSync(output+'/button-layout-regression.json',JSON.stringify(report,null,2));
  console.log('PASS: reproduced 184px bug; '+(after.states.length*6)+' post-fix layouts across 3 widths and 2 stylesheet orders, including selected colors and title line break.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
