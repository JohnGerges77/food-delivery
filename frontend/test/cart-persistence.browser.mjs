import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { once } from 'node:events';
const root=resolve(import.meta.dirname,'..');
const profile=await mkdtemp(resolve(tmpdir(),'savora-cart-browser-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(check,label){for(let i=0;i<150;i++){try{if(await check())return;}catch{}await delay(200);}throw Error('Timeout: '+label);}
let fixture=await readFile(resolve(root,'test/phase101-visual-api.mjs'),'utf8');
fixture=fixture.replace('const restaurant = {',`products[0].variants=[{id:'507f1f77bcf86cd799439051',name:'Large',price:220,isAvailable:true,sortOrder:0},{id:'507f1f77bcf86cd799439052',name:'Unavailable',price:240,isAvailable:false,sortOrder:1}];\nconst restaurant = {`).replace('.listen(5179,','.listen(5187,');
const api=spawn(process.execPath,['--input-type=module','-e',fixture],{stdio:'ignore'});
const app=spawn(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--port','3115'],{cwd:root,env:{...process.env,NEXT_PUBLIC_SAVORA_API_BASE_URL:'http://127.0.0.1:5187',SAVORA_INTERNAL_API_URL:'http://127.0.0.1:5187'},stdio:'ignore'});
let chrome,socket,send,evaluate;let orderAttempts=0;
async function browser(){ console.log('Launching isolated Chrome profile');
 chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9467','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await wait(async()=>{const r=await fetch('http://127.0.0.1:9467/json/list');return r.ok;},'Chrome');
 let target; await wait(async()=>{target=(await fetch('http://127.0.0.1:9467/json/list').then(r=>r.json())).find(t=>t.type==='page');return target;},'page target');
 socket=new WebSocket(target.webSocketDebuggerUrl);await once(socket,'open');let seq=0;const pending=new Map();
 send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},30000);timer.unref();pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Fetch.requestPaused'){
 const p=m.params;const preflight=p.request.method==='OPTIONS';if(!preflight)orderAttempts++;
 const success=orderAttempts>1;const body=success?{order:{orderNumber:'SV-8341302408423A218E893F82',status:'pending',submissionMethod:'direct',currency:'EGP',subtotal:220,deliveryFee:15,total:235,savedInSavora:true}}:{error:'Synthetic checkout failure'};
 void send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:preflight?204:success?201:503,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'POST, OPTIONS'},{name:'Access-Control-Allow-Headers',value:'Content-Type, Idempotency-Key'}],body:preflight?'':Buffer.from(JSON.stringify(body)).toString('base64')});return;}
 const p=pending.get(m.id);if(!p)return;pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);});
 evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Fetch.enable',{patterns:[{urlPattern:'*/api/public/restaurants/*/orders',requestStage:'Request'}]});
}
async function close(){ console.log('Closing Chrome fully');const exited=once(chrome,'exit');await send('Browser.close').catch(()=>{});await exited;socket.close();await delay(400);assert.equal(chrome.exitCode,0,'browser exits completely');}
async function visit(path){console.log('Visiting '+path);await send('Page.navigate',{url:'http://localhost:3115'+path});await wait(()=>evaluate(`location.pathname===${JSON.stringify(path)} && document.readyState==='complete' && !!document.querySelector('main')`),'route '+path);await delay(600);}
const key='savora-cart-v2:phase101-classic';
try{
 await wait(async()=>{const r=await fetch('http://localhost:3115/en/r/phase101-classic/menu');return r.ok;},'Next');
 await browser();await visit('/en/r/phase101-classic/menu/507f1f77bcf86cd799439021');
 await wait(()=>evaluate("!!document.querySelector('input[value=\"507f1f77bcf86cd799439051\"]')"),'variant');
 assert.equal(await evaluate("document.querySelector('input[value=\"507f1f77bcf86cd799439052\"]').disabled"),true);
 await evaluate("document.querySelector('input[value=\"507f1f77bcf86cd799439051\"]').click()");await delay(100);
 await evaluate("[...document.querySelectorAll('main button')].find(b=>b.textContent==='Add to cart').click()");
 await wait(()=>evaluate(`!!localStorage.getItem('${key}')`),'cart saved');
 const saved=await evaluate(`JSON.parse(localStorage.getItem('${key}')).items`);assert.equal(saved[0].variantName,'Large');
 await close();await browser();await visit('/en/r/phase101-classic/cart');
 assert.match(await evaluate('document.querySelector("main").textContent'),/House beef burger/);
 assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('${key}')).items`),saved);
 await visit('/ar/r/phase101-classic/cart');assert.match(await evaluate('document.querySelector("main").textContent'),/Large/);
 await visit('/en/r/phase102-aqua/menu/507f1f77bcf86cd799439022');await evaluate("[...document.querySelectorAll('main button')].find(b=>b.textContent==='Add to cart').click()");
 await wait(()=>evaluate("!!localStorage.getItem('savora-cart-v2:phase102-aqua')"),'second cart');
 await visit('/en/r/phase102-aqua/cart');assert.doesNotMatch(await evaluate('document.querySelector("main").textContent'),/House beef burger/);
 await visit('/en/r/phase101-classic/checkout');await wait(()=>evaluate("!!document.querySelector('input[name=fullName]')"),'checkout');
 for(const [name,value] of [['fullName','Synthetic Tester'],['phone','+201001234567'],['address','Synthetic street'],['city','Cairo']]){await evaluate(`document.querySelector('[name=${name}]').focus()`);await send('Input.insertText',{text:value});}
 for(let i=0;i<2;i++){await evaluate("document.querySelector('form button[type=submit]').click()");await delay(200);}
 await evaluate("document.querySelector('input[value=direct]').click()");await delay(100);await evaluate("document.querySelector('form button[type=submit]').click()");
 await wait(()=>evaluate("!!document.querySelector('[role=alert]')"),'failure');assert.ok(await evaluate(`localStorage.getItem('${key}')`));
 await evaluate("document.querySelector('form button[type=submit]').click()");await wait(()=>evaluate("!!document.querySelector('[data-testid=checkout-confirmation]')"),'confirmation');
 assert.equal(await evaluate(`localStorage.getItem('${key}')`),null);assert.ok(await evaluate("localStorage.getItem('savora-cart-v2:phase102-aqua')"));
 await evaluate(`localStorage.setItem('${key}','{broken')`);await visit('/en/r/phase101-classic/cart');assert.doesNotMatch(await evaluate('document.querySelector("main").textContent'),/House beef burger/);
 console.log('PASS real Chrome full process restart with same profile; variant restoration; EN/AR; two tenant carts; intercepted failure retention and success cleanup; corruption. No order reached a database. Profile: '+profile);
 await close();
}finally{socket?.close();chrome?.kill();app.kill();api.kill();}
