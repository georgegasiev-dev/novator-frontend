const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function helper(source, name) {
  const start=source.indexOf('function '+name+'(');
  assert(start>=0,'Missing helper '+name);
  const end=source.indexOf('\n}',start)+2;
  return source.slice(start,end);
}
for (const filename of ['index.html','eovr.html','rynok.html']) {
  const source=fs.readFileSync(path.join(__dirname,filename),'utf8');
  for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(!/\bsrc\s*=/.test(match[1])&&match[2].trim())new vm.Script(match[2]);
  }
  const scope={};vm.createContext(scope);
  vm.runInContext(helper(source,'escapeHtml'),scope);
  for(const payload of ['<img src=x onerror=alert(1)>',`"'><svg/onload=alert(1)>`,'&quot;']){
    const escaped=scope.escapeHtml(payload);
    assert(!/[<>"']/.test(escaped),'Unsafe text escaped in '+filename);
    assert(escaped.includes('&'),'Expected encoded text in '+filename);
  }
  if(filename==='index.html'){
    for(const name of ['STD','MAY_FACT','STATIC_CONTRACTORS','AN_CLIENT_COLORS'])assert(source.includes('const '+name+' = Object.create(null)'), 'Private defaults embedded: '+name);
    assert(!source.includes('onclick="showClientOpsCard(\'${'));
    assert(!source.includes("esc(op.contractor).replace(/'/g"));
    assert(source.includes('this.dataset.clientName'));
    assert(source.includes('this.dataset.current'));
    scope.URLSearchParams=URLSearchParams;
    let redirected=null;scope.location={search:'?next=https://untrusted.example',replace:value=>{redirected=value}};
    vm.runInContext(helper(source,'redirectToRequestedCalendarPage'),scope);
    assert.equal(scope.redirectToRequestedCalendarPage(),false);assert.equal(redirected,null);
    scope.location.search='?next=eovr.html';assert.equal(scope.redirectToRequestedCalendarPage(),true);assert.equal(redirected,'/eovr.html');
  }
  if(filename==='eovr.html'){
    assert(!source.includes('API_KEY'));
    assert(!source.includes('sheets.googleapis.com'));
    assert(source.includes('/api/eovr/sheets'));
  }
  if(filename==='rynok.html'){
    scope.URL=URL;vm.runInContext(helper(source,'safeExternalUrl'),scope);
    for(const url of ['javascript:alert(1)','data:text/html,probe','\njavascript:alert(1)'])assert.equal(scope.safeExternalUrl(url),'');
    assert.equal(scope.safeExternalUrl('https://fanera-msk.ru/'),'https://fanera-msk.ru/');
  }
}
console.log('XSS encoding, safe links, inline script syntax and private-default regression checks passed.');
