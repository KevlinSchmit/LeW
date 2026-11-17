import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Test the actual self-contained deliverable, offline, with a real WebGL browser.
const browser = await chromium.launch({
  executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless:true,
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const errors = [];
const network = [];
try {
  const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await context.setOffline(true);
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(/^https?:/.test(r.url()) && !r.isNavigationRequest())network.push(r.url());});
  await page.route('http://127.0.0.1:4173/',route=>route.fulfill({path:resolve('dist/index.html'),contentType:'text/html'}));
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});
  await page.locator('#loading').waitFor({state:'hidden'});
  const assets = await page.evaluate(()=>{
    const app=window.__sushi;
    let meshes=0, vertices=0;
    app.model.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;}});
    return {meshes,vertices,plates:app.plates.length,names:app.model.children.map(o=>o.name),moving:app.motion};
  });
  assert.equal(assets.plates,6,'Four main sushi assemblies plus two off-screen loop assemblies');
  assert.ok(assets.meshes>100 && assets.vertices>10000,'Actual 3D geometry loaded');
  for(const name of ['TEAPOT','TEACUP','MENU','BELL','RESUME'])
    assert.ok(assets.names.some(n=>n.startsWith(name)),name+' is a separate named assembly');
  assert.equal(assets.moving,true);
  const x=await page.evaluate(()=>window.__sushi.plates[0].position.x);
  await page.waitForFunction(before=>window.__sushi.plates[0].position.x<before-.005,x);
  await page.getByRole('button',{name:'Conveyor on'}).click();
  assert.equal(await page.evaluate(()=>window.__sushi.motion),false);
  const paused=await page.evaluate(()=>window.__sushi.plates[0].position.x);
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>window.__sushi.plates[0].position.x),paused,'Pausing stops the conveyor');
  await page.getByRole('button',{name:'Look around'}).click();
  assert.equal(await page.evaluate(()=>window.__sushi.controls.enabled),true);
  await page.mouse.move(650,360);await page.mouse.down();await page.mouse.move(750,370,{steps:5});await page.mouse.up();
  await page.getByRole('button',{name:'Reset view'}).click();
  assert.equal(await page.evaluate(()=>window.__sushi.controls.enabled),false);
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(()=>window.__sushi.motion),true,'Space on the canvas resumes motion');
  await page.keyboard.press('Space');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,'No mobile horizontal overflow');
  assert.equal(await page.locator('#motion').isVisible(),true);
  await page.screenshot({path:'artifacts/scene-mobile.png',timeout:120000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});
  assert.equal(await page.evaluate(()=>window.__sushi.motion),false,'Reduced motion starts with conveyor paused');
  assert.equal(network.length,0,'Standalone HTML uses no network requests');
  assert.deepEqual(errors,[],'No JavaScript or WebGL errors');
  console.log('PASS: offline standalone HTML, 3D assemblies, moving conveyor, pause, keyboard, camera controls, mobile layout, reduced motion.');
  console.log(JSON.stringify(assets,null,2));
} finally {await browser.close();}
