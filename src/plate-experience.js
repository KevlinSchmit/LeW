import * as THREE from 'three';
import { paintLabel } from './counter-paper.js';

const chapters = [
  ['Small scenes','I build interactive scenes around familiar places and the small things people do there.'],
  ['A place to sit','A steady viewpoint and a few details can make a digital room feel like somewhere worth staying.'],
  ['Scenes in motion','I use movement to show how objects fit together, from a turning page to a plate on a conveyor.'],
  ['Stories in texture','Painted surfaces, fine outlines, and warm light give simple shapes a sense of wear and history.'],
  ['An open counter','I like building spaces people can explore at their own pace, with something new in each corner.'],
];
const ease=THREE.MathUtils.smootherstep;
const cameraTime=1.65, turnTime=1.37, rockTime=.46;

function preparePlates(column) {
  return [...column.children].sort((a,b)=>b.position.y-a.position.y).map((mesh,index)=>{
    mesh.name=`Experience plate ${index+1}`;
    const proxy=new THREE.Mesh(mesh.geometry,mesh.material);
    mesh.updateWorldMatrix(true,false);
    proxy.matrixWorld.copy(mesh.matrixWorld);
    return {mesh,proxy,index,rest:mesh.position.clone(),rotation:mesh.quaternion.clone(),slide:0,shake:0};
  });
}

export function createPlateExperience(stack, scene, camera, sounds, onClose) {
  const column=stack.children.reduce((left,node)=>node.position.x<left.position.x ? node : left);
  const plates=preparePlates(column);
  const proxyList=plates.map(p=>p.proxy);
  const proxyToPlate=new Map(plates.map(p=>[p.proxy,p]));
  const overlay=document.querySelector('#experience');
  const sceneCanvas=document.querySelector('#scene');
  const copy=overlay.querySelector('article');
  const heading=copy.querySelector('h2');
  const exit=overlay.querySelector('button');
  const query=new THREE.Raycaster();
  const aim=new THREE.PerspectiveCamera();
  const stackBounds=new THREE.Box3().setFromObject(stack).expandByScalar(.13);
  const stackCenter=new THREE.Box3().setFromObject(column).getCenter(new THREE.Vector3());
  const right=new THREE.Vector3(), viewPoint=new THREE.Vector3();
  const parentRotation=new THREE.Quaternion();
  const facing=new THREE.Quaternion(), faceUp=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  const turnOffset=new THREE.Vector3();
  const fill=new THREE.SpotLight(0xffe8cc,0,20,.51,.65,2);
  fill.position.copy(stackCenter).add(new THREE.Vector3(-1.3,3.4,6.4));
  fill.target.position.copy(stackCenter).add(new THREE.Vector3(.5,.25,0));
  scene.add(fill,fill.target);
  const readingLight=new THREE.SpotLight(0xffefd8,0,8,.70,.62,2);
  scene.add(readingLight,readingLight.target);

  let stage='idle', time=0, origin, departure, picked, hovered, keyboardPlate, turnFrom=0;
  const cameraState=()=>({position:camera.position.clone(),rotation:camera.quaternion.clone(),fov:camera.fov});
  function setStage(next){
    stage=next;
    time=0;
    overlay.dataset.view=next;
  }
  function setExit(label) {
    exit.setAttribute('aria-label',label);
    paintLabel(exit.querySelector('canvas'),label,1,'#f6e6c9',0);
  }
  function placeCamera(from,to,t){
    camera.position.copy(from.position).lerp(to.position,t);
    camera.quaternion.copy(from.rotation).slerp(to.rotation,t);
    camera.fov=THREE.MathUtils.lerp(from.fov,to.fov,t);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  function focusStack(t){
    const narrow=camera.aspect<.95;
    aim.fov=narrow?53:36;
    const distance=Math.max(2.10,2.55/camera.aspect)/Math.tan(THREE.MathUtils.degToRad(aim.fov/2))+(narrow?.80:1.92);
    viewPoint.copy(stackCenter);
    viewPoint.x+=.68;
    aim.position.copy(viewPoint).add(right.set(.28,.53,distance));
    aim.lookAt(viewPoint);
    placeCamera(origin,{position:aim.position,rotation:aim.quaternion,fov:aim.fov},t);
  }
  function facePlate(t){
    const {plate,start}=picked;
    const slide=ease(t,0,.57);
    const flip=ease(t,.53,turnTime);
    // Bring the plate out past the front conveyor before the reading view settles.
    camera.translateZ(4.75*flip);
    camera.updateMatrixWorld();
    column.getWorldQuaternion(parentRotation).invert();
    right.set(1,0,0).applyQuaternion(camera.quaternion).applyQuaternion(parentRotation);
    turnOffset.copy(plate.rest).addScaledVector(right,3.43);
    turnOffset.y+=.02;
    turnOffset.z+=.22;
    plate.mesh.position.copy(start).lerp(turnOffset,slide);

    const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const distance=1.60/(tangent*Math.min(1,camera.aspect)*.78);
    viewPoint.set(0,-.01,-distance).applyQuaternion(camera.quaternion).add(camera.position);
    column.worldToLocal(viewPoint);
    // Put the ceramic face toward the viewer regardless of the display aspect.
    facing.copy(parentRotation).multiply(camera.quaternion).multiply(faceUp);
    plate.mesh.quaternion.copy(plate.rotation).slerp(facing,flip);
    plate.mesh.position.lerp(viewPoint,flip);
    plate.mesh.position.z+=.72*Math.sin(Math.PI*flip);
    plate.mesh.getWorldPosition(readingLight.target.position);
    readingLight.position.set(-.28,.61,2.60).applyQuaternion(camera.quaternion)
      .add(readingLight.target.position);
    readingLight.intensity=22*ease(flip,.30,1);
  }
  function pick(pointer){
    if(!pointer)return null;
    query.setFromCamera(pointer,camera);
    const hit=query.intersectObjects(proxyList,false)[0];
    if(hit)return proxyToPlate.get(hit.object);
    if(hovered?.slide>.02 && query.intersectObject(hovered.mesh,false).length)return hovered;
    return null;
  }
  function showReading(opacity){
    copy.hidden=opacity<=0;
    copy.style.setProperty('--plate-copy',opacity);
  }
  function reveal(plate){
    sounds.play('plateSlide',plate.slide>.6?.46:.69,-.32);
    picked={plate,start:plate.mesh.position.clone()};
    hovered=null;
    const [title,body]=chapters[plate.index];
    heading.querySelector('span').textContent=title;
    paintLabel(heading.querySelector('canvas'),title,1.13,getComputedStyle(copy).color,0);
    copy.querySelector('p').textContent=body;
    setExit('Back to stack');
    setStage('turning');
  }
  function activate(plate){
    if(stage!=='browsing' || !plate)return;
    if(plate.index<chapters.length) reveal(plate);
    else if(!plate.shake){
      plate.shake=rockTime;
      sounds.play('plateRock',.55,-.44,.97);
    }
  }
  function slidePlates(dt){
    let moving=false;
    for(const plate of plates){
      if(plate===picked?.plate)continue;
      const goal=plate===hovered && plate.index<chapters.length ? 1 : 0;
      const next=goal+(plate.slide-goal)*Math.exp(-13*dt);
      plate.slide=Math.abs(goal-next)<.001 ? goal : next;
      // One tilt outward and back.
      const rock=plate.shake>0 ? Math.sin(Math.PI*plate.shake/rockTime)**2 : 0;
      const x=plate.rest.x+1.57*plate.slide+.051*rock;
      const z=plate.rest.z+.19*plate.slide;
      moving ||= x!==plate.mesh.position.x || z!==plate.mesh.position.z || plate.shake>0;
      plate.mesh.position.set(x,plate.rest.y,z);
      plate.mesh.rotation.z=.015*rock;
      plate.mesh.updateMatrixWorld();
      plate.shake=Math.max(0,plate.shake-dt);
    }
    return moving;
  }
  function begin() {
    if(stage!=='idle')return false;
    sounds.play('interface',.51,-.45);
    origin=cameraState();
    overlay.hidden=false;
    setExit('Back to Explore');
    setStage('entering');
    return true;
  }
  function dismiss() {
    if(stage==='turning'||stage==='reading'){
      sounds.play('plateLift',.42,-.19,.92);
      turnFrom=stage==='reading'?turnTime:time;
      keyboardPlate=null;
      showReading(0);
      setStage('storing');
      exit.focus({preventScroll:true});
    }else if(stage==='browsing'||stage==='entering'){
      sounds.play('interface',.51,-.42,.92);
      departure=cameraState();
      hovered=keyboardPlate=null;
      setStage('leaving');
    }
  }
  exit.addEventListener('click',dismiss);
  function update(dt,pointer){
    time+=dt;
    if(stage==='leaving'){
      const t=ease(time,0,1.29);
      placeCamera(departure,origin,t);
      fill.intensity=66*(1-t);
      slidePlates(dt);
      if(time>=1.29){
        overlay.hidden=true;
        setStage('idle');
        onClose();
      }
      return true;
    }
    if(stage==='entering'){
      const t=ease(time,0,cameraTime);
      focusStack(t);
      fill.intensity=66*t;
      if(time>=cameraTime)setStage('browsing');
      return true;
    }
    focusStack(1);
    if(stage==='browsing'){
      hovered=keyboardPlate || pick(pointer);
      return slidePlates(dt);
    }
    if(stage==='storing'){
      facePlate(turnFrom*(1-ease(time,0,.96)));
      if(time>=.96){
        sounds.play('plateStack',.50,-.43);
        // Continue the ease from the amount that was already pulled out at the click.
        picked=null;
        setExit('Back to Explore');
        setStage('browsing');
        sceneCanvas.focus({preventScroll:true});
      }
      return true;
    }
    if(stage==='turning'){
      facePlate(time);
      showReading(ease(time,1.04,turnTime));
      slidePlates(dt);
      if(time>=turnTime){
        setStage('reading');
        copy.focus({preventScroll:true});
      }
      return true;
    }
    facePlate(turnTime);
    return true;
  }

  return {
    column,
    get canPoint(){return stage==='browsing' && !!hovered;},
    hitsStack(pointer){return !!pick(pointer);},
    begin,dismiss,update,
    pointerMoved(){keyboardPlate=null;},
    click(pointer){
      if(stage==='browsing'){
        const plate=pick(pointer);
        if(plate)activate(plate);
        else if(!query.ray.intersectsBox(stackBounds))dismiss();
      }else if(stage==='reading'){
        query.setFromCamera(pointer,camera);
        if(!query.intersectObject(picked.plate.mesh,false).length)dismiss();
      }
    },
    key(event){
      if(event.code==='Escape'){
        dismiss();
      }else if(stage==='browsing' && ['ArrowUp','ArrowDown'].includes(event.code)){
        const at=(keyboardPlate || hovered)?.index;
        keyboardPlate=plates[at===undefined?0:THREE.MathUtils.clamp(at+(event.code==='ArrowUp'?-1:1),0,plates.length-1)];
      }else if(stage==='browsing' && ['Enter','Space'].includes(event.code)){
        activate(keyboardPlate || hovered || plates[0]);
      }else return;
      event.preventDefault();
    },
  };
}
