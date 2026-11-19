import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { checkShadowMotion } from './shadow-check.mjs';

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
  await page.addInitScript(()=>{
    const observed=window.__menuPageTurns={opening:false,placing:false};
    function sample(){
      const phase=document.querySelector('#app')?.dataset.intro;
      const book=window.__sushi?.model.children.find(part=>part.name.startsWith('MENU'));
      if(book && phase in observed && !observed[phase]){
        const angles=[1,2,3].map(i=>book.getObjectByName('Page hinge '+i).rotation.z);
        const curls=[1,2,3].map(i=>Math.abs(book.getObjectByName('Flexible paper sheet '+i).morphTargetInfluences[0]));
        observed[phase]=Math.min(Math.abs(angles[0]-angles[1]),Math.abs(angles[1]-angles[2]))>.16
          && Math.max(...curls)>.45 && document.querySelector('#start-exploring').hidden;
      }
      if(!book || phase)requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});
  const explore=page.getByRole('button',{name:'START EXPLORING →'});
  await explore.waitFor({state:'visible'});
  const intro=await page.evaluate(()=>{
    const {model,camera,controls}=window.__sushi;
    const menu=model.children.find(part=>part.name.startsWith('MENU'));
    const {left,top,right,bottom}=document.querySelector('#start-exploring').getBoundingClientRect();
    document.querySelector('#look').click();
    return {uuid:menu.uuid, open:menu.getObjectByName('Front cover hinge').rotation.z,
      framed:left>0 && top>0 && right<innerWidth && bottom<innerHeight,
      locked:!controls.enabled && document.querySelector('#scene').inert,
      camera:camera.position.toArray()};
  });
  assert.ok(intro.open>3 && intro.framed && intro.locked,'The original book opens in frame before the scene unlocks');
  await explore.click();
  await page.waitForFunction(()=>!document.querySelector('#app').hasAttribute('data-intro'));
  assert.deepEqual(await page.evaluate(()=>{
    const {model,camera}=window.__sushi;
    const menu=model.children.find(part=>part.name.startsWith('MENU'));
    return {uuid:menu.uuid, position:menu.position.toArray(), scale:menu.scale.toArray(), rotation:menu.quaternion.toArray(),
      closed:menu.getObjectByName('Front cover hinge').rotation.z,
      camera:camera.position.toArray(), unlocked:!document.querySelector('#scene').inert};
  }),{uuid:intro.uuid,position:[-.5,.10000000149011612,3.0999999046325684],
    scale:[.6800000071525574,.6800000071525574,.6800000071525574],
    rotation:[0,-.06994284689426422,0,.9975510239601135],closed:0,camera:intro.camera,unlocked:true},
    'The same closed menu settles back on the counter at its authored transform');
  assert.deepEqual(await page.evaluate(()=>window.__menuPageTurns),{opening:true,placing:true},
    'Three independently hinged sheets bend in sequence while opening and closing');
  const deskClick=await page.evaluate(()=>{
    const {model,camera}=window.__sushi;
    const book=model.children.find(part=>part.name.startsWith('MENU'));
    const point=book.localToWorld(book.position.clone().set(0,.402,0)).project(camera);
    return {x:(point.x+1)*innerWidth/2,y:(1-point.y)*innerHeight/2};
  });
  await page.mouse.click(deskClick.x,deskClick.y);
  const back=page.getByRole('button',{name:'BACK TO EXPLORE →'});
  await back.waitFor({state:'visible'});
  assert.ok(await page.evaluate(uuid=>{
    const {model,controls}=window.__sushi;
    const books=model.children.filter(part=>part.name.startsWith('MENU'));
    return books.length===1 && books[0].uuid===uuid && books[0].getObjectByName('Front cover hinge').rotation.z>3
      && document.querySelector('#scene').inert && !controls.enabled;
  },intro.uuid),'Clicking the tabletop lifts and reopens the same book with counter controls locked');
  const paperClick=await page.evaluate(()=>{
    const {model,camera}=window.__sushi;
    const page=model.getObjectByName('Right warm paper leaf');
    const point=page.localToWorld(page.position.clone().set(0,0,0)).project(camera);
    return {x:(point.x+1)*innerWidth/2,y:(1-point.y)*innerHeight/2};
  });
  await page.mouse.click(paperClick.x,paperClick.y);
  assert.equal(await back.isVisible(),true,'Clicking the paper keeps the reopened menu open');
  await page.mouse.click(8,8);
  await page.waitForFunction(()=>!document.querySelector('#app').hasAttribute('data-intro'));
  assert.ok(await page.evaluate(()=>{
    const menu=window.__sushi.model.children.find(part=>part.name.startsWith('MENU'));
    return menu.position.x===-.5 && menu.getObjectByName('Front cover hinge').rotation.z===0
      && !document.querySelector('#scene').inert;
  }),'Clicking outside the reopened menu returns it to the table and releases scene controls');
  const tea = await page.evaluate(()=>{
    const {model,camera}=window.__sushi;
    const pot=model.children.find(part=>part.name.startsWith('TEAPOT'));
    const point=pot.localToWorld(pot.position.clone().set(.14,.92,.5)).project(camera);
    return {empty:!model.getObjectByName('Rising tea surface').visible,
      camera:camera.position.toArray(),x:(point.x+1)*innerWidth/2,y:(1-point.y)*innerHeight/2};
  });
  assert.ok(tea.empty,'The teacup is empty before it is used');
  await page.mouse.click(tea.x,tea.y);
  await page.waitForFunction(()=>{
    const {model,scene}=window.__sushi;
    const water=model.getObjectByName('Rising tea surface');
    return scene.getObjectByName('Tea stream from spout').visible
      && water.visible && water.getObjectByName('Ballistic tea droplets').visible;
  });
  const teaExit=page.getByRole('button',{name:'Back to Explore',exact:true});
  await page.waitForFunction(()=>document.activeElement?.matches('#tea-story [role="dialog"]'));
  assert.ok(await page.evaluate(()=>document.fonts.check("24px 'Tea Story Handwriting'")));
  await teaExit.click();
  await page.waitForFunction(()=>!document.querySelector('#app').hasAttribute('data-tea'));
  assert.deepEqual(await page.evaluate(()=>{
    const {model,camera}=window.__sushi;
    return {empty:!model.getObjectByName('Rising tea surface').visible,camera:camera.position.toArray()};
  }),{empty:true,camera:tea.camera},'Closing the story returns the camera and empties the cup');
  const assets = await page.evaluate(()=>{
    const app=window.__sushi;
    let meshes=0, vertices=0;
    const geometry=new Set();
    app.model.traverse(o=>{if(o.isMesh){meshes++;geometry.add(o.geometry);}});
    for (const g of geometry) vertices+=g.attributes.position.count;
    return {meshes,vertices,plates:app.plates.length,varieties:new Set(app.plates.map(p=>p.userData.sushiKind)).size,names:app.model.children.map(o=>o.name),moving:app.motion};
  });
  assert.equal(assets.plates,40,'Dishes retain their spacing around the longer loop');
  assert.equal(assets.varieties,19,'The four original dishes and fifteen new sushi varieties all circulate');
  assert.ok(assets.meshes>100 && assets.vertices>10000,'Actual 3D geometry loaded');
  for(const name of ['TEAPOT','TEACUP','MENU','BELL','POS','CHEF'])
    assert.ok(assets.names.some(n=>n.startsWith(name)),name+' is a separate named assembly');
  assert.ok(await page.evaluate(()=>{
    const wall=window.__sushi.model.getObjectByName('Izakaya rear wall');
    const bulbs=wall?.children.filter(o=>o.name==='Amber string bulb') ?? [];
    const heights=bulbs.map(b=>b.position.y);
    const gaps=bulbs.slice(1).map((b,i)=>b.position.x-bulbs[i].position.x);
    return document.fonts.check('24px "Yuji Boku"','寿司酒場')
      && wall?.getObjectByName('Framed sushi tavern sign')
      && wall.getObjectByName('Red octopus shop print')
      && wall.children.filter(o=>o.name.startsWith('Menu ·')).length>=14
      && bulbs.length>=18 && Math.max(...heights)-Math.min(...heights)>.9
      && Math.max(...gaps)-Math.min(...gaps)>1.5;
  }),'The izakaya wall has brush lettering, illustrated prints and staggered string bulbs');
  const runs=await page.evaluate(()=>{
    const {plates,model,camera}=window.__sushi;
    const returns=model.getObjectByName('Conveyor returns');
    const leftWall=model.getObjectByName('RoomLeft');
    const rightWall=model.getObjectByName('RoomRight');
    const renderCamera=camera.clone();
    const V=camera.position.constructor;
    const aspectRatios=[16/9,21/9,.99,390/844];
    const endsOutOfFrame=aspectRatios.every(aspect=>{
      renderCamera.aspect=aspect;
      renderCamera.position.z=aspect<1 ? 26 : 17.2;
      renderCamera.fov=aspect<1 ? 69 : 38;
      renderCamera.lookAt(window.__sushi.controls.target);
      renderCamera.updateProjectionMatrix();
      renderCamera.updateMatrixWorld();
      return returns.children.every(mesh=>{
        const side=Math.sign(mesh.position.x), position=mesh.geometry.attributes.position;
        for(let i=0;i<position.count;i++){
          const point=new V().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
          if(side*point.project(renderCamera).x<=1) return false;
        }
        return true;
      });
    });
    return {front:Math.max(...plates.map(p=>p.position.z)),
      rear:Math.min(...plates.map(p=>p.position.z)),
      heights:[...new Set(plates.map(p=>p.position.y))],
      wall:model.getObjectByName('RoomBack').localToWorld(plates[0].position.clone().set(0,4.5,-12)).z,
      endsOutOfFrame,
      wallsClear:rightWall.getObjectByName('Izakaya side wall').getWorldPosition(new V()).x
        -leftWall.getObjectByName('Izakaya side wall').getWorldPosition(new V()).x>88,
      slats:['Belt straight tiles','Belt curved tiles'].reduce((n,name)=>n+model.getObjectByName(name).count,0)};
  });
  assert.ok(Math.abs(runs.front+2.05)<1e-5 && runs.front-runs.rear>19.5,'Front stays seated while the rear lane is set back across the prep aisle');
  assert.ok(runs.rear-runs.wall>4.7 && runs.heights.length===1,'Both runs share one serving height, with clearance behind the rear lane');
  assert.equal(runs.slats,400,'Slats cover both extended lanes and four corners');
  assert.ok(runs.endsOutOfFrame && runs.wallsClear,'Both returns are out of the seated view and inside the room');
  const topLight=await page.evaluate(()=>{
    const app=window.__sushi,light=app.scene.getObjectByName('Central warm yellow top light');
    if(!light)return null;
    const V=app.camera.position.constructor,axis=light.target.position.clone().sub(light.position);
    const lit=(x,y,z)=>new V(x,y,z).sub(light.position).angleTo(axis)<light.angle;
    return {spot:light.isSpotLight,angle:light.angle,color:light.color.toArray(),shadows:light.castShadow,
      shadowMapReady:!!light.shadow.map,menu:lit(-.5,.4,3.1),sushi:lit(0,2.8,-2.05),side:lit(8,.5,2)};
  });
  assert.ok(topLight?.spot && topLight.angle<.6,'A single focused overhead light is present');
  assert.ok(topLight.color[0]>topLight.color[1] && topLight.color[1]>topLight.color[2],'Overhead light is warm yellow');
  assert.ok(topLight.menu && topLight.sushi && !topLight.side,'The overhead pool covers the menu and central sushi, not the side props');
  assert.ok(topLight.shadows && topLight.shadowMapReady,'The spotlight has a rendered shadow map');
  const chefInfo=await page.evaluate(()=>{
    const app=window.__sushi,chef=app.model.children.find(o=>o.name.startsWith('CHEF'));
    let triangles=0,skinned=false;const paints=new Set(),names=[],materials=new Set();
    chef.traverse(o=>{if(!o.isMesh || !o.visible || !o.userData.componentId)return;
      triangles+=(o.geometry.index?.count ?? o.geometry.attributes.position.count)/3;
      skinned ||= !!o.isSkinnedMesh;
      if(o.material.map)paints.add(o.material.name);
      names.push(o.name);materials.add(o.material.name);
    });
    const V=app.camera.position.constructor;
    const landmarks=Object.fromEntries(Object.entries(chef.userData.landmarks).map(([key,position])=>{
      const p=new V(...position).applyMatrix4(chef.matrixWorld).project(app.camera);
      const x=(p.x+1)/2*innerWidth,y=(1-p.y)/2*innerHeight;
      return [key,{y:y/innerHeight,visible:app.pickAt(x,y)===chef}];
    }));
    return {triangles,skinned,paints:paints.size,position:chef.position.toArray(),landmarks,names,materials:[...materials],
      procedural:chef.userData.procedural,chefCount:app.model.children.filter(o=>o.name.startsWith('CHEF')).length};
  });
  assert.ok(chefInfo.triangles <= 30000,'Skinned upper body with open, layered sleeves stays under 30k triangles');
  assert.ok(chefInfo.paints>=5,'Separate skin, cotton, apron, cap and hair maps loaded');
  assert.equal(chefInfo.procedural,true,'Character is built with Three.js');
  assert.equal(chefInfo.chefCount,1,'The original indigo chef is replaced, not overlaid');
  assert.ok(!chefInfo.materials.some(n=>/indigo|tenugui|headband/i.test(n)),'No original blue costume remains');
  for(const detail of ['cap','torso','sash','head','sleeve-l','sleeve-r'])
    assert.ok(chefInfo.names.includes(detail+' surface'),detail+' matches the reference');
  assert.ok(!chefInfo.names.some(name=>/^(apron|trousers|leg-|shoe-)/.test(name)),'The counter displays only the upper-body assembly');
  assert.equal(chefInfo.skinned,true,'Sleeves, forearms and hands use skeletal skinning');
  const articulation=await page.evaluate(()=>{
    const {chefMixer:liveMixer,model}=window.__sushi;
    const chef=model.children.find(o=>o.name.startsWith('CHEF'));
    const arms=chef.userData.sculptRuntime.arms;
    // Exercise the original recipe even if the live idle shuffle is slicing.
    const mixer=new liveMixer.constructor(chef), poses=[];
    chef.traverse(o=>poses.push([o,o.position.clone(),o.quaternion.clone()]));
    const stance=chef.userData.sculptRuntime.stance;
    stance.hips.position.copy(stance.rest);stance.hips.quaternion.identity();
    stance.chest.quaternion.identity();stance.neck.quaternion.identity();
    mixer.clipAction(chef.animations[0]).play();
    const vertical=chef.position.clone().set(0,1,0);
    const worktop=model.children.find(o=>o.name==='Chef prep table');
    if(!worktop)throw new Error('A separate rear preparation table is required');
    function snapshot(time) {
      mixer.setTime(time); model.updateMatrixWorld(true);
      return arms.map(a=>({
        shoulder:a.upperBone.getWorldPosition(a.shoulder.clone()),
        elbow:a.elbowBone.getWorldPosition(a.shoulder.clone()),
        wrist:a.wristBone.getWorldPosition(a.shoulder.clone()),
        fingers:a.digits.flatMap(d=>d.bones.map(b=>b.quaternion.clone())),
      }));
    }
    try {
      const open=snapshot(0), press=snapshot(3.2), laidDown=snapshot(5.8), release=snapshot(6.9);
      const samples=Array.from({length:73},(_,i)=>snapshot(i/10));
      return open.map((arm,i)=>({
        largestTilt:Math.max(...samples.map(p=>p[i].shoulder.clone().sub(p[i].elbow).angleTo(vertical))),
        releaseDrift:laidDown[i].elbow.distanceTo(release[i].elbow),
        wristTravel:Math.max(...samples.map(p=>p[i].wrist.distanceTo(arm.wrist))),
        movingFingerJoints:arm.fingers.filter((q,k)=>q.angleTo(press[i].fingers[k])>.02).length,
      }));
    } finally {
      mixer.stopAllAction();
      poses.forEach(([o,p,q])=>{o.position.copy(p);o.quaternion.copy(q);});
      model.updateMatrixWorld(true);
    }
  });
  for(const arm of articulation){
    assert.ok(arm.largestTilt<24*Math.PI/180,'Elbows stay low and near the sides throughout the take');
    assert.ok(arm.releaseDrift<.01,'Opening the fingers does not pull the elbow backward');
    assert.ok(arm.wristTravel>.1,'The forearm carries the wrist to and from the work surface');
    assert.equal(arm.movingFingerJoints,15,'Each digit flexes through its own anatomical chain');
  }
  const slicing=await page.evaluate(()=>{
    const {chefMixer:live,model}=window.__sushi;
    const chef=model.children.find(o=>o.name.startsWith('CHEF'));
    const {stance,arms}=chef.userData.sculptRuntime;
    const mixer=new live.constructor(chef);
    const previousHeading=stance.hips.quaternion.clone();
    stance.hips.quaternion.identity();
    const clip=chef.animations.find(c=>c.name==='Slice salmon at the board');
    mixer.clipAction(clip).play();
    const world=o=>o.getWorldPosition(o.position.clone());
    mixer.setTime(0);model.updateMatrixWorld(true);
    const feet=stance.legs.map(l=>world(l.foot)), stand=world(stance.hips);
    let depth=0,slide=0,drift=0,cutGap=0,minReach=180;
    const fabric=arms.map(a=>chef.getObjectByName('sleeve-'+(a.side===1?'l':'r')+' surface'));
    const lowFold=[],cutFold=[];
    for(const sleeve of fabric){
      const ink=sleeve.children.find(o=>o.userData.chefOutline);
      if(ink?.morphTargetInfluences!==sleeve.morphTargetInfluences)throw Error('Detached cuff outline');
    }
    const tool=chef.getObjectByName('ChefKitchenKnife');
    for(let i=0;i<clip.duration*30;i++){
      const t=i/30;
      mixer.setTime(t); model.updateMatrixWorld(true);
      depth=Math.max(depth,stand.y-world(stance.hips).y);
      stance.legs.forEach((l,k)=>slide=Math.max(slide,feet[k].distanceTo(world(l.foot))));
      if(t>=4.43 && t<=10.35){
        const socket=arms[1].wristBone.localToWorld(tool.position.clone().set(1,-36,-11).divideScalar(570));
        drift=Math.max(drift,socket.distanceTo(world(tool)));
      }
      if((t>=1.94 && t<=2.19)||(t>=12.85 && t<=13.04)){
        for(const arm of arms){
          const e=world(arm.elbowBone);
          const angle=world(arm.upperBone).sub(e).angleTo(world(arm.wristBone).sub(e));
          minReach=Math.min(minReach,angle*180/Math.PI);
        }
        lowFold.push(...fabric.map(o=>o.morphTargetInfluences[0]));
      }
      if(t>=5.6 && t<=8.9)cutFold.push(...fabric.map(o=>o.morphTargetInfluences[0]));
      cutGap=Math.max(cutGap,-chef.getObjectByName('SalmonPortion0').position.x);
    }
    mixer.stopAllAction();stance.hips.quaternion.copy(previousHeading);model.updateMatrixWorld(true);
    return {depth,slide,drift,cutGap,minReach,reachFold:Math.max(...lowFold),workFold:Math.min(...cutFold)};
  });
  assert.ok(slicing.minReach>130,'Both arms extend when holding the low board');
  assert.ok(slicing.reachFold+.30<slicing.workFold,'Elbow tucks release on extension and gather during the cuts');
  assert.ok(slicing.depth>2.6 && slicing.slide<.001,'Hips descend while the feet stay planted');
  assert.ok(slicing.drift<.002 && slicing.cutGap>.2,'The grip tracks the handle and three fish portions separate');
  const cleaning=await page.evaluate(()=>{
    const {model,chefMixer}=window.__sushi;
    const chef=chefMixer.getRoot(), rig=chef.userData.sculptRuntime.stance;
    const cloth=chef.getObjectByName('CounterWashcloth'), table=model.getObjectByName('Chef prep table');
    const mixer=new chefMixer.constructor(chef);
    const clip=chef.animations.find(c=>c.name==='Cleaning Counter');
    mixer.clipAction(clip).play();
    const world=o=>o.getWorldPosition(o.position.clone());
    const at=t=>{mixer.setTime(t);model.updateMatrixWorld(true);};
    try {
      at(0);
      const parked=world(cloth), stand=rig.chest.quaternion.clone(), feet=rig.legs.map(l=>world(l.foot));
      const bench=world(table).y, samples=[];
      at(1.48);
      const lifted=world(cloth).y-parked.y;
      let footSlide=0;
      for(let i=0;i<=130;i++){
        at(2.22+i/30);
        samples.push({p:world(cloth),pressure:cloth.morphTargetInfluences[1]});
        rig.legs.forEach((l,k)=>footSlide=Math.max(footSlide,world(l.foot).distanceTo(feet[k])));
      }
      const pressed=samples.filter(p=>p.pressure>.82);
      const lean=rig.chest.quaternion.angleTo(stand);
      const travel=samples.slice(1).reduce((d,s,i)=>d+s.p.distanceTo(samples[i].p),0);
      const onSurface=samples.every(s=>Math.abs(s.p.y-bench)<.001);
      at(clip.duration-.01);
      return {lifted,travel,onSurface,footSlide,presses:pressed.length,lean,
        home:world(cloth).distanceTo(parked),rest:rig.chest.quaternion.angleTo(stand),
        folded:cloth.morphTargetInfluences.every(n=>n<.001)};
    } finally {mixer.stopAllAction();model.updateMatrixWorld(true);}
  });
  assert.ok(cleaning.lifted>.4 && cleaning.onSurface,'Cloth lifts clear and lies on the worktop on every wipe');
  assert.ok(cleaning.travel>6 && cleaning.presses>20 && cleaning.lean>.14 && cleaning.footSlide<.002,
    'Short loaded strokes use a forward lean over planted feet');
  assert.ok(cleaning.home<.001 && cleaning.rest<.001 && cleaning.folded,'Cloth and body return to their starting poses');
  const adjusting=await page.evaluate(()=>{
    const {model,chefMixer}=window.__sushi;
    const chef=chefMixer.getRoot();
    const mixer=new chefMixer.constructor(chef);
    const cuff=chef.getObjectByName('sleeve-l surface');
    const roll=cuff.morphTargetDictionary.cuffRoll;
    const clip=chef.animations.find(c=>c.name==='Adjust Sleeves and Brush Sash');
    const wrists=chef.userData.sculptRuntime.arms.map(a=>a.wristBone);
    mixer.clipAction(clip).play();
    const at=t=>{mixer.setTime(t);model.updateMatrixWorld(true);};
    const world=o=>o.getWorldPosition(o.position.clone());
    try{
      at(0);
      const ready=wrists.map(world);
      at(2.3);
      const raised=cuff.morphTargetInfluences[roll]>.99;
      at(3.65);
      const waiting=wrists.map(world);
      at(4.02);
      const left=world(wrists[0]).distanceTo(waiting[0]);
      at(4.64);
      const right=world(wrists[1]).distanceTo(waiting[1]);
      at(clip.duration-.01);
      return {raised,left,right,rest:cuff.morphTargetInfluences[roll]===0
        && wrists.every((w,k)=>world(w).distanceTo(ready[k])<.001),
        clips:chef.animations.map(c=>c.name)};
    }finally{mixer.stopAllAction();model.updateMatrixWorld(true);}
  });
  assert.ok(adjusting.raised && adjusting.left>.55 && adjusting.right>.55 && adjusting.rest,
    'The cuff rises, each hand brushes the sash, and the shared starting pose is restored');
  assert.deepEqual(adjusting.clips,['Shape and serve nigiri','Slice salmon at the board','Cleaning Counter',
    'Adjust Sleeves and Brush Sash'],'The chef uses all four idles');
  assert.ok(chefInfo.position[2]<-6,'Chef stands back from the kitchen edge of the belt');
  assert.ok(chefInfo.landmarks.hat.y<0 && chefInfo.landmarks.chin.y>=0 && chefInfo.landmarks.chin.y<.04,'The seated desktop camera crops at the chin');
  assert.ok(chefInfo.landmarks.chest.visible,'Upper body is visible');
  console.log('Procedural chef:',JSON.stringify({triangles:chefInfo.triangles,landmarks:chefInfo.landmarks}));
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
    const textures=[],glass=[],palette=new Set();let visibleReceipt=false,lcd=false;
    const columns=window.__sushi.plateStack.children.filter(o=>o.name.startsWith('Plate_column')).map(box);
    model.traverse(o=>{if(!o.isMesh)return;
      if(/receipt|resume|paper slot/i.test(o.name) && o.visible)visibleReceipt=true;
      for(const material of [o.material].flat()){
        if(material.name==='POS · painted LCD deck' && material.map && material.bumpMap)lcd=true;
        palette.add(material.name);
        if(material.map)textures.push({name:material.name,width:material.map.image.width,height:material.map.image.height});
        if(/Bottle glass|Clear molded/.test(material.name))glass.push(material.name);
      }
    });
    return {menu:box(root('MENU')),table:box(root('RESTAURANT')),visibleReceipt,lcd,textures,glass:[...new Set(glass)],columns,palette:[...palette],camera:{fov:window.__sushi.camera.fov,position:window.__sushi.camera.position.toArray(),target:window.__sushi.controls.target.toArray()}};
  });
  assert.ok(assets.vertices<250000,'Simple game-asset geometry stays below 250k scene vertices');
  assert.ok(artDirection.menu.width<3.8,'Menu is smaller than the original oversized book');
  assert.ok(artDirection.table.front>13,'Counter extends toward the visitor');
  assert.equal(artDirection.visibleReceipt,false,'POS only shows paper while printing');
  assert.equal(artDirection.lcd,true,'POS has an illustrated LCD');
  assert.equal(artDirection.glass.length,2,'Glass vessels and PET covers use distinct materials');
  assert.ok(artDirection.textures.every(t=>t.width<=512 && t.height<=512),'Painted textures retain deliberate low texel density');
  assert.ok(artDirection.textures.some(t=>t.name.includes('sakura')),'Wraparound painted tea ceramics loaded');
  assert.equal(artDirection.camera.fov,38,'Restore the original seated composition');
  assert.deepEqual(artDirection.camera.position,[0,8,17.2],'Restore original camera distance and height');
  assert.deepEqual(artDirection.camera.target,[0,2.25,-1],'Restore original view target');
  assert.equal(artDirection.columns.length,2,'Both rear plate columns remain independent');
  assert.ok(artDirection.columns.every(c=>c.top>4.98 && c.front<-3.3),'Both plate stacks rise above the sushi while remaining behind the conveyor');
  assert.ok(artDirection.palette.includes('Marigold waves · glazed porcelain'),'Wave transfers join the porcelain palette');
  const counterService=await page.evaluate(()=>{
    const {model,plates}=window.__sushi;
    const signs=plates.some(plate=>{
      let found=false;
      plate.traverse(part=>{found ||= /identification_sign|sign_clip|painted sign/i.test(part.name);});
      return found;
    });
    const jar=model.getObjectByName('Wasabi jar');
    const soy=model.getObjectByName('Soy dispenser');
    const soyGap=jar && soy ? jar.position.distanceTo(soy.position) : Infinity;
    return {signs, jar:jar?.position.toArray(), soy:soy?.position.toArray(), soyGap,
      bucket:!!model.getObjectByName('Chopstick bucket') || !!model.getObjectByName('Upright bamboo chopsticks'),
      lid:model.getObjectByName('Black wasabi screw cap')?.material.name,
      ginger:model.children.some(o=>/pickled_ginger/i.test(o.name))};
  });
  assert.ok(!counterService.signs && !counterService.bucket && !counterService.ginger
    && /black/i.test(counterService.lid) && counterService.jar[0]===7.81 && counterService.jar[2]===.16
    && counterService.soy[0]===9.04 && counterService.soy[2]===.31
    && counterService.soyGap>1.12 && counterService.soyGap<1.38,
    'The soy dispenser and black-lidded wasabi jar sit together to the right of the POS');

  const player=await page.evaluate(()=>{
    const {model,camera}=window.__sushi;
    const player=model.getObjectByName('Counter MP3 player');
    const plug=player.getObjectByName('Plugged headphone jack');
    const cable=player.getObjectByName('Headphone cable across tabletop');
    const path=cable.geometry.parameters.path;
    const endpoint=player.localToWorld(path.getPoint(1)).project(camera);
    const start=path.getPoint(0);
    const connected=start.distanceTo(plug.position)<.126;
    const placement=player.getWorldPosition(player.position.clone());
    const terminal=model.children.find(part=>part.name.startsWith('POS'));
    return {connected,playerXZ:[placement.x,placement.z],terminalXZ:[terminal.position.x,terminal.position.z],endpoint};
  });
  assert.deepEqual(player.playerXZ,[5.42,3.04],'The player occupies the former POS spot');
  assert.deepEqual(player.terminalXZ,[6.98,3.94],'The POS occupies the former player spot');
  assert.ok(player.connected && player.endpoint.x>1,'The player cord stays connected and exits to the right');

  const tracking=await page.evaluate(async()=>{
    const {camera}=window.__sushi;
    const canvas=document.querySelector('#scene');
    const base=camera.quaternion.clone(), eye=camera.position.clone();
    const delta=()=>base.angleTo(camera.quaternion)*180/Math.PI;
    const settle=async until=>{
      const end=performance.now()+1600;
      while(!until() && performance.now()<end)await new Promise(requestAnimationFrame);
    };
    const send=(type,x,y,pointerType='mouse')=>canvas.dispatchEvent(new PointerEvent(type,{
      clientX:innerWidth*x,clientY:innerHeight*y,pointerType,bubbles:false,
    }));
    send('pointermove',.98,.03);
    await settle(()=>delta()>6.7);
    const first=delta();
    const direction=camera.position.clone().set(0,0,-1).applyQuaternion(camera.quaternion)
      .applyQuaternion(base.clone().invert());
    send('pointerleave',0,0);
    await settle(()=>delta()<.08);
    return {fixed:camera.position.equals(eye), first, returnAngle:delta(), right:direction.x, up:direction.y};
  });
  assert.ok(tracking.fixed && tracking.first>6.6 && tracking.first<8 && tracking.right>0
    && tracking.up>0 && tracking.returnAngle<.1,'Seated mouse following turns gently and centers again without moving the camera');
  const hover = await page.evaluate(async()=>{
    const app=window.__sushi;
    const canvas=document.querySelector('#scene');
    const label=document.querySelector('#object-hover-label');
    const look=document.querySelector('#look');
    const motion=document.querySelector('#motion');
    const wasMoving=app.motion;
    const frame=()=>new Promise(requestAnimationFrame);
    const point=app.camera.position.clone();
    const moveTo=async (object,y,z=0)=>{
      object.localToWorld(point.set(0,y,z)).project(app.camera);
      canvas.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',
        clientX:(point.x*.5+.5)*innerWidth,clientY:(.5-point.y*.5)*innerHeight}));
      await frame();
      return app.hoveredObject===object;
    };
    if(wasMoving)motion.click();
    look.click();
    try {
      const bell=app.model.children.find(part=>part.name.startsWith('BELL'));
      const dish=app.plates.filter(part=>part.position.z>-3)
        .reduce((a,b)=>Math.abs(a.position.x)<Math.abs(b.position.x)?a:b);
      const bellResponds=await moveTo(bell,.54);
      const bellLabel=!label.hidden && label.getAttribute('aria-label')==='Contact';
      const coverResponds=await moveTo(dish,1.64,.38);
      const sushiHasNoLabel=label.hidden;
      canvas.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));
      await frame();
      return {bellResponds,bellLabel,coverResponds,sushiHasNoLabel,
        clears:app.hoveredObject===null && label.hidden, noNativeTooltip:!canvas.title};
    } finally {
      look.click();
      if(wasMoving)motion.click();
    }
  });
  assert.ok(hover.bellResponds && hover.coverResponds && hover.clears,
    'Counter props and covered sushi highlight on hover and clear when the pointer leaves');
  assert.ok(hover.bellLabel && hover.sushiHasNoLabel && hover.noNativeTooltip,
    'Only assigned objects show the handwritten label, and native tooltips are gone');
  // Find a visible plate surface by casting through the complete scene, so a
  // hidden or occluded collection cannot pass this click-through check.
  const stackTarget = await page.evaluate(()=>{
    const app=window.__sushi, V=app.camera.position.constructor;
    const leftStack=[...app.plateStack.children].sort((a,b)=>a.position.x-b.position.x)[0];
    const points=[];
    leftStack.traverse(mesh=>{
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
      if(document.elementFromPoint(x,y)?.id==='scene' && app.pickAt(x,y)===leftStack)return {x,y};
    }
    return null;
  });
  assert.ok(stackTarget,'Plate stack has an unobstructed clickable surface');
  await page.mouse.click(stackTarget.x,stackTarget.y);
  await page.locator('#experience[data-view="browsing"]').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('#experience[data-view="reading"]').waitFor();
  assert.equal(await page.locator('#experience-copy').textContent().then(text=>text.includes('Small scenes')),true);
  await page.getByRole('button',{name:'Back to stack',exact:true}).click();
  await page.locator('#experience[data-view="browsing"]').waitFor();
  await page.getByRole('button',{name:'Back to Explore',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#app').hasAttribute('data-experience'));
  assert.equal(await page.getByRole('button',{name:'Select plate collection',exact:true}).count(),0);
  assert.equal(assets.moving,true);
  const x=await page.evaluate(()=>window.__sushi.plates[0].position.x);
  await page.waitForFunction(before=>window.__sushi.plates[0].position.x<before-.005,x);
  assert.deepEqual(await page.evaluate(()=>window.__sushi.model.children.find(o=>o.name.startsWith('CHEF')).position.toArray()),chefInfo.position,'Chef stays stationary while the sushi moves');
  console.log('Shadow synchronization:',await checkShadowMotion(page));
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
  await page.getByRole('button',{name:'360° view'}).click();
  assert.ok(await page.evaluate(()=>window.__sushi.overview && window.__sushi.controls.maxAzimuthAngle===Infinity));
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button',{name:'Back to seat'}).click();
  assert.deepEqual(await page.evaluate(()=>window.__sushi.camera.position.toArray()),[0,8,17.2]);
  await page.locator('#scene').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(()=>window.__sushi.motion),true,'Space on the canvas resumes motion');
  await page.keyboard.press('Space');
  await page.setViewportSize({width:390,height:844});
  // Software WebGL can delay the resize event; wait for the canvas layout.
  await page.waitForFunction(()=>document.querySelector('#scene').clientWidth===innerWidth);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,'No mobile horizontal overflow');
  assert.equal(await page.locator('#motion').isVisible(),true);
  const portraitChef=await page.evaluate(()=>{
    const app=window.__sushi,chef=app.model.children.find(o=>o.name.startsWith('CHEF')),V=app.camera.position.constructor;
    const project=point=>new V(...point).applyMatrix4(chef.matrixWorld).project(app.camera);
    const hat=project(chef.userData.landmarks.hat),chest=project(chef.userData.landmarks.chest),feet=project(chef.userData.landmarks.feet);
    return {hatInFrame:Math.abs(hat.x)<1 && Math.abs(hat.y)<1,
      chestVisible:app.pickAt((chest.x+1)/2*innerWidth,(1-chest.y)/2*innerHeight)===chef,
      feetVisible:app.pickAt((feet.x+1)/2*innerWidth,(1-feet.y)/2*innerHeight)===chef};
  });
  assert.ok(portraitChef.hatInFrame && portraitChef.chestVisible,'The existing portrait camera still shows the chef');
  await page.screenshot({path:'artifacts/scene-mobile.png',timeout:120000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});
  await explore.waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__sushi.motion),false,'Reduced motion starts with conveyor paused');
  assert.equal(network.length,0,'Standalone HTML uses no network requests');
  assert.deepEqual(errors,[],'No JavaScript or WebGL errors');
  console.log('PASS: visible 3D plate stack selection, offline standalone HTML, 3D assemblies, moving conveyor, pause, keyboard, camera controls, mobile layout, reduced motion, painted low-poly assets, compact menu, extended table, receipt-free POS, distinct glass/PET, original seated composition, two raised plate columns, yellow palette, central warm spotlight, removed background fixtures, per-frame synchronized shadows, procedural white-uniform chef, reference costume details, unobstructed head and upper-body framing.');
  console.log(JSON.stringify(assets,null,2));
} finally {await browser.close();}
