import assert from 'node:assert/strict';

/** Observe actual shadow draw callbacks, so a stale map cannot pass as moving. */
export async function checkShadowMotion(page, {frames=9,shadowLights=2}={}) {
  const samples=await page.evaluate(({frames})=>new Promise((resolve,reject)=>{
    const app=window.__sushi,plate=app.plates[1],hooks=[];
    const afterRender=app.scene.onAfterRender;
    let draws=[],samples=[],previousX=plate.position.x;
    const cleanup=()=>{
      clearTimeout(timer);app.scene.onAfterRender=afterRender;
      for(const [mesh,callback] of hooks)mesh.onBeforeShadow=callback;
    };
    const timer=setTimeout(()=>{cleanup();reject(new Error('Moving shadow check did not complete'));},120000);
    plate.traverse(mesh=>{
      if(!mesh.isMesh || !mesh.castShadow)return;
      const original=mesh.onBeforeShadow;hooks.push([mesh,original]);
      mesh.onBeforeShadow=function(...args){
        original.apply(this,args);
        draws.push({camera:args[3].uuid,x:plate.position.x});
      };
    });
    app.scene.onAfterRender=function(...args){
      afterRender.apply(this,args);
      const x=plate.position.x;
      if(x!==previousX){
        const cameras=new Set(draws.filter(d=>Math.abs(d.x-x)<1e-9).map(d=>d.camera));
        samples.push({x,shadowLights:cameras.size});
        previousX=x;
      }
      draws=[];
      if(samples.length===frames){cleanup();resolve(samples);}
    };
  }),{frames});
  assert.equal(samples.length,frames,'Observe consecutive moving frames');
  assert.ok(Math.abs(samples.at(-1).x-samples[0].x)>.001,'The sushi actually moved during the check');
  assert.ok(samples.every(frame=>frame.shadowLights===shadowLights),
    `Every moving pose must render all ${shadowLights} shadows; observed ${samples.map(s=>s.shadowLights).join(',')}`);
  return {movingFrames:samples.length,shadowLightsPerFrame:samples.map(s=>s.shadowLights)};
}
