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
  for(const name of ['TEAPOT','TEACUP','MENU','BELL','POS'])
    assert.ok(assets.names.some(n=>n.startsWith(name)),name+' is a separate named assembly');
  const artDirection=await page.evaluate(()=>{
    const model=window.__sushi.model;
    const root=prefix=>model.children.find(o=>o.name.startsWith(prefix));
    const box=object=>{
      // Reuse the already-loaded Three.js math types without another network import.
      const points=[];
      object.updateWorldMatrix(true,true);
      object.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,V=window.__sushi.camera.position.constructor;
        for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])points.push(new V(x,y,z).applyMatrix4(o.matrixWorld));
      }});
      return {width:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),front:Math.max(...points.map(p=>p.z)),top:Math.max(...points.map(p=>p.y))};
    };
    const textures=[],glass=[],palette=new Set();let receipt=false,lcd=false;
    const columns=window.__sushi.plateStack.children.filter(o=>o.name.startsWith('Plate_column')).map(box);
    model.traverse(o=>{if(!o.isMesh)return;
      if(/receipt|resume|paper slot/i.test(o.name))receipt=true;
      if(o.material.name.includes('olive LCD'))lcd=true;
      palette.add(o.material.name);
      if(o.material.map)textures.push({name:o.material.name,width:o.material.map.image.width,height:o.material.map.image.height});
      if(/Bottle glass|Clear molded/.test(o.material.name))glass.push(o.material.name);
    });
    return {menu:box(root('MENU')),table:box(root('RESTAURANT')),receipt,lcd,textures,glass:[...new Set(glass)],columns,palette:[...palette],camera:{fov:window.__sushi.camera.fov,position:window.__sushi.camera.position.toArray(),target:window.__sushi.controls.target.toArray()}};
  });
  assert.ok(assets.vertices<250000,'Simple game-asset geometry stays below 250k scene vertices');
  assert.ok(artDirection.menu.width<3.8,'Menu is smaller than the original oversized book');
  assert.ok(artDirection.table.front>13,'Counter extends toward the visitor');
  assert.equal(artDirection.receipt,false,'POS has no paper receipt assembly');
  assert.equal(artDirection.lcd,true,'POS has an illustrated LCD');
  assert.equal(artDirection.glass.length,2,'Glass vessels and PET covers use distinct materials');
  assert.ok(artDirection.textures.every(t=>t.width<=512 && t.height<=512),'Painted textures retain deliberate low texel density');
  assert.ok(artDirection.textures.some(t=>t.name.includes('sakura')),'Wraparound painted tea ceramics loaded');
  assert.equal(artDirection.camera.fov,38,'Restore the original seated composition');
  assert.deepEqual(artDirection.camera.position,[0,8,17.2],'Restore original camera distance and height');
  assert.deepEqual(artDirection.camera.target,[0,2.25,-1],'Restore original view target');
  assert.equal(artDirection.columns.length,2,'Both rear plate columns remain independent');
  assert.ok(artDirection.columns.every(c=>c.top>5.3 && c.front<-3.3),'Both plate stacks rise above the sushi while remaining behind the conveyor');
  assert.ok(artDirection.palette.includes('Mustard yellow lacquer'),'Yellow joins the plate palette');
  // Find a visible plate surface by casting through the complete scene, so a
  // hidden or occluded collection cannot pass this click-through check.
  const stackTarget = await page.evaluate(()=>{
    const app=window.__sushi, V=app.camera.position.constructor;
    const points=[];
    app.plateStack.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])
        points.push(new V(x,y,z).applyMatrix4(mesh.matrixWorld));
    });
    if(Math.max(...points.map(p=>p.z))>=-3.3)throw Error('Stack extends into the conveyor instead of behind it');
    const projected=points.map(p=>p.project(app.camera));
    const left=Math.max(8,(Math.min(...projected.map(p=>p.x))*.5+.5)*innerWidth);
    const right=Math.min(innerWidth-8,(Math.max(...projected.map(p=>p.x))*.5+.5)*innerWidth);
    const top=Math.max(100,(-Math.max(...projected.map(p=>p.y))*.5+.5)*innerHeight);
    const bottom=Math.min(innerHeight-100,(-Math.min(...projected.map(p=>p.y))*.5+.5)*innerHeight);
    for(let row=0;row<12;row++)for(let col=0;col<12;col++){
      const x=left+(col+.5)/12*(right-left),y=top+(row+.5)/12*(bottom-top);
      if(document.elementFromPoint(x,y)?.id==='scene' && app.pickAt(x,y)===app.plateStack)return {x,y};
    }
    return null;
  });
  assert.ok(stackTarget,'Plate stack has an unobstructed clickable surface');
  await page.mouse.click(stackTarget.x,stackTarget.y);
  assert.equal(await page.evaluate(()=>window.__sushi.plateStack.userData.selected),true,'Clicking the visible 3D stack selects it');
  await page.getByRole('button',{name:'Select plate collection'}).click();
  assert.equal(await page.evaluate(()=>window.__sushi.plateStack.userData.selected),false,'Accessible collection button toggles the same object');
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
  console.log('PASS: visible 3D plate stack selection, offline standalone HTML, 3D assemblies, moving conveyor, pause, keyboard, camera controls, mobile layout, reduced motion, painted low-poly assets, compact menu, extended table, receipt-free POS, distinct glass/PET, original seated composition, two raised plate columns, yellow palette.');
  console.log(JSON.stringify(assets,null,2));
} finally {await browser.close();}
