const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname + '/rynok.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = Object.fromEntries(['content','refresh-btn','last-update','status-text'].map(id =>
  [id, {innerHTML:'',textContent:'',disabled:false,replaceChildren(x){this.innerHTML=x.textContent;}}]));
let responses = [], calls = [], timers = new Map(), timerId = 0;
const context = vm.createContext({
  document:{getElementById:id=>elements[id],createElement:()=>({})},
  window:{addEventListener(){}}, Date, AbortSignal,
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId;}, clearTimeout:id=>timers.delete(id),
  fetch:async (url,opts)=>{calls.push({url,...opts});const r=responses.shift();if(r instanceof Error)throw r;return {ok:true,...r,json:async()=>r.data};}
});
vm.runInContext(script,context);
const data = {positions:[{site:'example.test',variant:'18mm',days:{'2026-10-21':{price:100}}}],refreshing:false};
(async()=>{
  responses.push({data}); await context.loadData();
  assert.equal(calls[0].method,'GET'); assert.ok(calls[0].url.endsWith('/api/competitor-prices'));
  assert.match(elements.content.innerHTML,/100₽/); assert.equal(elements['refresh-btn'].disabled,false);
  responses.push({data:{...data,refreshing:true}}); await context.loadData(true);
  assert.equal(calls[1].method,'POST'); assert.equal(elements['refresh-btn'].disabled,true); assert.equal(timers.size,1);
  responses.push({data}); await [...timers.values()][0]();
  assert.equal(timers.size,0); assert.equal(elements['refresh-btn'].disabled,false);
  const table = elements.content.innerHTML;
  responses.push(new Error('offline')); await context.loadData(true);
  assert.equal(elements.content.innerHTML,table); assert.equal(elements['refresh-btn'].disabled,false);
  responses.push({ok:false,status:504,data:{}}); await context.loadData();
  assert.equal(elements.content.innerHTML,table);
  context.render({positions:[{site:'fanera-msk.ru',variant:'Фанера <test> & "name"',
    url:'https://fanera-msk.ru/catalog/item/',days:{'2026-10-22':{price:2612,price_is_from:true,in_stock:0}}}]});
  assert.match(elements.content.innerHTML,/от 2612₽/);
  assert.match(elements.content.innerHTML,/Фанера &lt;test&gt; &amp; &quot;name&quot;/);
  assert.match(elements.content.innerHTML,/href="https:\/\/fanera-msk.ru\/catalog\/item\/"/);
  assert.match(elements.content.innerHTML,/нет в наличии/);
  const catalogTable = elements.content.innerHTML;
  responses.push({data:{error:'bad payload'}}); await context.loadData();
  assert.equal(elements.content.innerHTML,catalogTable);
  console.log('PASS: saved history, refresh/poll, failure recovery, minimum prices, product links and escaped catalog titles');
})().catch(e=>{console.error(e);process.exitCode=1;});
