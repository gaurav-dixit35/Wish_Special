import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { launch, open, navigate, evaluate, click as rawClick, waitFor, screenshot } from '../.phase1-checks/cdp.mjs';

const base = 'http://127.0.0.1:4173/';
const dir = new URL('./', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const results = [];
const browser = await launch();
let activePage;
const mediaProbe = `window.__playedMedia=[]; const nativePlay=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){ window.__playedMedia.push({src:this.currentSrc||this.src,loop:this.loop,muted:this.muted}); return nativePlay.apply(this,arguments); };`;
async function click(page, selector) {
  await evaluate(page, async query => {
    const element=document.querySelector(query);
    if(!element) throw new Error(`Missing click target ${query}`);
    element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }, selector);
  await waitFor(page, query=>{
    const element=document.querySelector(query); const r=element.getBoundingClientRect();
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return hit && element.contains(hit);
  },{args:[selector],timeout:3000,label:`unobscured ${selector}`});
  await rawClick(page,selector);
}
async function scene(page, name, chapter, readySelector) {
  await navigate(page, `${base}?preview=1&scene=${name}`);
  await waitFor(page, (id, selector) => document.querySelector('.chapter')?.dataset.chapter === String(id) && document.querySelector(selector)?.disabled === false, {args:[chapter,readySelector],timeout:30000,label:`${name} ready`});
}
async function layout(page, label) {
  const check = await evaluate(page, () => ({width:innerWidth,scroll:document.documentElement.scrollWidth,error:!!document.querySelector('.chapter-error'),heading:document.querySelector('.chapter h1')?.textContent}));
  assert.ok(check.scroll <= check.width + 1, `${label}: horizontal overflow ${JSON.stringify(check)}`);
  assert.equal(check.error,false);
  assert.deepEqual(page.exceptions,[],`${label}: uncaught errors`);
  results.push({label,...check});
}
try {
  const page = activePage = await open(browser,{width:390,height:844,scripts:[mediaProbe]});
  await scene(page,'memories',8,'[data-testid="memory-next"]');
  await waitFor(page,()=>document.querySelector('.memory-card.is-current .memory-photo img')?.naturalWidth>0);
  const memoryText = await evaluate(page,()=>[...document.querySelectorAll('.memory-caption h2')].map(x=>x.textContent));
  assert.equal(memoryText[7],'Symposium'); assert.equal(memoryText[8],'Matheran Trip'); assert.equal(memoryText[9],'Our Trip to Ganpati Visit');
  assert.ok(memoryText.every(text=>!/[\p{Extended_Pictographic}]/u.test(text)));
  await screenshot(page,`${dir}memories-390.png`);
  await layout(page,'Memory photos / 390px');
  await click(page,'#sound-toggle');
  await waitFor(page,()=>document.querySelector('#sound-toggle').getAttribute('aria-pressed')==='true');
  assert.ok(await evaluate(page,()=>window.__playedMedia.some(item=>item.loop)),'Music file requested on user gesture');
  for(let index=0;index<9;index++) {
    console.log('Advance memory',index+1);
    await click(page,'[data-testid="memory-next"]');
    await waitFor(page,(i)=>document.querySelector('.memory-card.is-current')?.dataset.memory===String(i)&&!document.querySelector('[data-testid="memory-next"]').disabled,{args:[index+1]});
  }
  await screenshot(page,`${dir}ganpati-390.png`);
  await layout(page,'Ganpati photo / 390px');
  await scene(page,'secrets',11,'[data-testid="eggs-next"]');
  for(const kind of ['moon','star','dog','name','heart']) {
    console.log('Follow clue',kind);
    await click(page,`.egg-clue-look[data-target="${kind}"]`);
    await waitFor(page,(k)=>document.querySelector(`[data-egg="${k}"]`)?.classList.contains('is-clue-target'),{args:[kind]});
    const geometry=await evaluate(page,()=>{const r=document.querySelector('.egg-clue-guide').getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};});
    assert.ok(geometry.left>=0&&geometry.right<=geometry.width+1&&geometry.top>=0&&geometry.bottom<=geometry.height+1,`clue ${kind} stays visible`);
    if(kind==='moon') await screenshot(page,`${dir}clue-moon-390.png`);
    const target=kind==='dog'?'.chapter [data-egg="dog"]':`[data-egg="${kind}"]`;
    for(let tap=0;tap<(kind==='name'?5:1);tap++) await click(page,target);
    if(kind==='star') {
      await waitFor(page,()=>!!document.querySelector('.secret-wish-dialog[open]'));
      await click(page,'.secret-wish-close');
      await waitFor(page,()=>!document.querySelector('.secret-wish-dialog[open]'));
    }
    await click(page,'.egg-clue-return');
  }
  assert.equal(await evaluate(page,()=>document.querySelector('.eggs-progress').textContent),'5 of 5 secrets found');
  await screenshot(page,`${dir}secrets-390.png`);
  await layout(page,'All five clues / 390px');
  await click(page,'[data-testid="eggs-next"]');
  await waitFor(page,()=>document.querySelector('.chapter')?.dataset.chapter==='12'&&!document.querySelector('[data-testid="voice-next"]').disabled);
  assert.equal(await evaluate(page,()=>document.querySelector('.egg-clue-guide')),null);
  await click(page,'[data-testid="voice-next"]');
  await waitFor(page,()=>document.querySelector('.chapter')?.dataset.chapter==='13'&&!document.querySelector('[data-testid="letter-finish"]').disabled);
  await click(page,'[data-testid="letter-finish"]');
  await waitFor(page,()=>document.querySelector('.chapter')?.dataset.letterComplete==='true');
  const letter = await evaluate(page,()=>({lines:[...document.querySelectorAll('.letter-line-copy')].map(x=>x.textContent),signature:[...document.querySelectorAll('.letter-line.is-signature')].map(x=>x.textContent),ps:document.querySelector('.letter-line.is-postscript .letter-line-copy').textContent}));
  assert.equal(letter.lines[0],'To my Miss Barbie 💙'); assert.equal(letter.lines[15],'Bandar 🐒💙'); assert.ok(letter.ps.startsWith('P.S.'));
  await waitFor(page,()=>[...document.querySelectorAll('.is-signature .letter-line-copy')].every(line=>Number(getComputedStyle(line).opacity)>.99));
  await screenshot(page,`${dir}letter-390.png`,{fullPage:true});
  await layout(page,'Updated full letter / 390px');
  await click(page,'[data-testid="letter-next"]');
  await waitFor(page,()=>document.querySelector('.chapter')?.dataset.chapter==='14'&&!document.querySelector('[data-testid="certificate-download"]').disabled);
  assert.ok(await evaluate(page,()=>document.querySelector('.certificate-copy').textContent.includes('Your Bandar 🐒')));
  await click(page,'[data-testid="certificate-download"]');
  await waitFor(page,()=>!document.querySelector('.certificate-open').hidden);
  const png=await evaluate(page,async()=>{const blob=await fetch(document.querySelector('.certificate-open').href).then(r=>r.blob()); const bitmap=await createImageBitmap(blob);return {type:blob.type,width:bitmap.width,height:bitmap.height,size:blob.size};});
  assert.deepEqual([png.type,png.width,png.height],['image/png',2400,1800]);
  results.push({label:'Certificate PNG',...png});
  await screenshot(page,`${dir}certificate-390.png`,{fullPage:true});
  await click(page,'[data-testid="finale-next"]');
  await waitFor(page,()=>document.querySelector('.chapter')?.dataset.chapter==='15'&&!document.querySelector('[data-testid="happiness-light"]').disabled);
  await screenshot(page,`${dir}candle-unlit-390.png`,{fullPage:true});
  await click(page,'[data-testid="happiness-light"]');
  await waitFor(page,()=>document.querySelector('.happiness-world')?.classList.contains('is-lit'));
  await waitFor(page,()=>document.querySelector('.happiness-world')?.classList.contains('is-finished'),{timeout:11000});
  assert.equal(await evaluate(page,()=>document.querySelector('#happiness-heading').textContent),'Happy Birthday, Miss Barbie!');
  assert.equal(await evaluate(page,()=>document.querySelectorAll('.happiness-small-flight').length),14);
  await waitFor(page,()=>Number(getComputedStyle(document.querySelector('.happiness-signoff')).opacity)>.99);
  await screenshot(page,`${dir}birthday-390.png`,{fullPage:true});
  await layout(page,'Candle ending / 390px');
  await page.close();
  for (const width of [320,1440]) {
    const other=await open(browser,{width,height:width===320?740:1000,mobile:width===320,reducedMotion:width===320});
    await scene(other,'happiness',15,'[data-testid="happiness-light"]');
    await click(other,'[data-testid="happiness-light"]');
    await waitFor(other,()=>document.querySelector('.happiness-world')?.classList.contains('is-finished'),{timeout:11000});
    await waitFor(other,()=>Number(getComputedStyle(document.querySelector('.happiness-signoff')).opacity)>.99);
    await screenshot(other,`${dir}birthday-${width}.png`,{fullPage:true});
    await layout(other,`Candle ending / ${width}px${width===320?' reduced motion':''}`);
    await other.close();
  }
  console.log(JSON.stringify({passed:true,results},null,2));
  await writeFile(`${dir}results.json`,JSON.stringify({passed:true,results},null,2));
} catch(error) {
  console.error(error);
  if(activePage) {
    console.log(await evaluate(activePage,()=>({heading:document.querySelector('.chapter h1')?.textContent, chapter:document.querySelector('.chapter')?.dataset.chapter, current:document.querySelector('.memory-card.is-current')?.dataset.memory, button:document.querySelector('[data-testid="memory-next"]')?.outerHTML, error:document.querySelector('.chapter-error')?.textContent, progress:document.querySelector('.memories-progress')?.textContent})));
    console.log({exceptions:activePage.exceptions,warnings:activePage.warnings});
    await screenshot(activePage,`${dir}failure.png`,{fullPage:true});
  }
  process.exitCode=1;
} finally { await browser.close(); }
