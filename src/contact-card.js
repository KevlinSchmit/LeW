import * as THREE from 'three';
import { createChefContact, offerTime, pickupTime } from './characters/chef-contact.js';
import { paintLabel } from './counter-paper.js';
import { drawMenuInk, menuInkWidth } from './menu-lettering.js';

const width=1.98, height=1.17, thickness=.036;
const vec=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const ease=THREE.MathUtils.smootherstep;
const grip=vec(width/2-.22,height/2-.145,0);

function printFace() {
  const canvas=document.createElement('canvas');
  canvas.width=1024;
  canvas.height=Math.round(canvas.width*height/width);
  const {width:w,height:h}=canvas;
  const ink=canvas.getContext('2d');
  const light=ink.createLinearGradient(0,0,w,h);
  light.addColorStop(0,'#f7ebcf');
  light.addColorStop(.56,'#eaddbf');
  light.addColorStop(1,'#e2cfab');
  ink.fillStyle=light;
  ink.fillRect(0,0,w,h);
  let seed=453;
  const grain=ink.getImageData(0,0,w,h);
  for(let i=0;i<grain.data.length;i+=4){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const tone=(seed>>>29)-4;
    grain.data[i]+=tone;
    grain.data[i+1]+=tone;
    grain.data[i+2]+=tone;
  }
  ink.putImageData(grain,0,0);
  ink.strokeStyle='#6d4a36';
  ink.lineWidth=3;
  ink.strokeRect(21,21,w-42,h-42);
  ink.strokeStyle='#994934';
  ink.lineCap='round';
  ink.lineWidth=5;
  for(const radius of [33,25,17]){
    ink.beginPath();
    ink.arc(w/2,h*.34,radius,Math.PI,2*Math.PI);
    ink.stroke();
  }
  const title='Contact Me', scale=3.50;
  ink.strokeStyle='#37281e';
  drawMenuInk(ink,title,(w-menuInkWidth(title)*scale)/2,h*.43,scale,undefined,.06);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  return texture;
}

function buildCard() {
  const card=new THREE.Group();
  card.name='Contact card';
  const stock=new THREE.Mesh(new THREE.BoxGeometry(width,height,thickness),
    new THREE.MeshStandardMaterial({color:0xd3bd99,roughness:.94}));
  stock.castShadow=stock.receiveShadow=true;
  const print=printFace();
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({
    map:print,roughness:.93,emissive:0xffffff,emissiveMap:print,emissiveIntensity:.58,
  }));
  face.position.z=thickness/2+.001;
  face.receiveShadow=true;
  const rect=(path,w,h)=>path.moveTo(-w/2,-h/2).lineTo(w/2,-h/2).lineTo(w/2,h/2).lineTo(-w/2,h/2).closePath();
  const contour=rect(new THREE.Shape(),width+.17,height+.17);
  contour.holes.push(rect(new THREE.Path(),width+.048,height+.048));
  const outline=new THREE.Mesh(new THREE.ShapeGeometry(contour),new THREE.MeshBasicMaterial({
    color:0xfff6e7,transparent:true,depthWrite:false,toneMapped:false,fog:false,
  }));
  outline.name='Contact card highlight';
  outline.position.z=face.position.z;
  outline.visible=false;
  outline.raycast=()=>{};
  card.add(stock,face,outline);
  card.visible=false;
  return {card,face,outline};
}

export function createContactInteraction(model,camera,chef,kitchen,idles,reducedMotion,sounds,onClose) {
  const bell=model.children.find(node=>node.name.startsWith('BELL'));
  const cap=['Bell_button_stem','Bell_button_cap'].map(name=>
    bell.children.find(part=>part.name.replaceAll(' ','_')===name)).filter(Boolean);
  const terminal=model.children.find(node=>node.name.startsWith('POS'));
  const {card,face,outline}=buildCard();
  model.add(card);
  // Keep the previous copy on the counter when the bell asks for a fresh one.
  const previousCard=card.clone();
  previousCard.name='Previous contact card';
  previousCard.remove(previousCard.getObjectByName(outline.name));
  model.add(previousCard);
  const gesture=createChefContact(chef,kitchen,idles,grip);
  const accept=document.querySelector('#contact-accept');
  const view=document.querySelector('#contact-view');
  const panel=view.querySelector('article');
  const close=panel.querySelector('button');
  paintLabel(close.querySelector('canvas'),'Back to Explore',1,'#432e21',0);
  const desk=vec(terminal.position.x-1.32,.056,new THREE.Box3().setFromObject(terminal).max.z+.57);
  const flat=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,.18,0,'YXZ'));
  const from=vec(), fromRotation=new THREE.Quaternion();
  const seat=vec(), seatRotation=new THREE.Quaternion();
  const focus=vec(), focusRotation=new THREE.Quaternion();
  const midpoint=vec(), goal=vec(), corner=vec();
  const aim=new THREE.Matrix4();
  const bellTop=cap.map(part=>part.position.y);
  let phase='idle', elapsed=0, aspect, rang;

  function setPhase(next) {
    phase=next;
    elapsed=0;
  }
  function captureCard() {
    from.copy(card.position);
    fromRotation.copy(card.quaternion);
  }
  function restoreBell(amount) {
    cap.forEach((part,i)=>{part.position.y=bellTop[i]-.052*amount;});
    if(amount>.81 && !rang){
      sounds.play('bell',.83,.28,1);
      rang=true;
    }
  }
  function begin(fromTable) {
    if(phase!=='idle')return false;
    aspect=camera.aspect;
    seat.copy(camera.position);
    seatRotation.copy(camera.quaternion);
    if(fromTable) {
      sounds.play('cardstock',.67,.48);
      captureCard();
      setPhase('opening');
    } else {
      rang=false;
      if(card.visible){
        previousCard.position.copy(card.position);
        previousCard.position.y-=thickness+.002;
        previousCard.quaternion.copy(card.quaternion);
        previousCard.visible=true;
        card.visible=false;
      }
      focus.copy(seat).addScaledVector(camera.getWorldDirection(vec()),reducedMotion ? .42 : 1.3);
      focusRotation.setFromRotationMatrix(aim.lookAt(focus,vec(1.68,4.11,-.4),camera.up));
      setPhase('waiting');
    }
    return true;
  }
  function guide() {
    camera.updateMatrixWorld();
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const x of [-width/2,width/2])for(const y of [-height/2,height/2]){
      card.localToWorld(corner.set(x,y,thickness/2)).project(camera);
      const sx=(.5+.5*corner.x)*innerWidth, sy=(.5-.5*corner.y)*innerHeight;
      left=Math.min(left,sx);
      right=Math.max(right,sx);
      top=Math.min(top,sy);
      bottom=Math.max(bottom,sy);
    }
    const w=Math.max(44,right-left),h=Math.max(44,bottom-top);
    Object.assign(accept.style,{
      left:`${(left+right-w)/2}px`,top:`${(top+bottom-h)/2}px`,width:`${w}px`,height:`${h}px`,
    });
    outline.material.opacity=reducedMotion ? 1 : .78+.2*Math.sin(elapsed*3.8);
  }
  function take() {
    if(phase!=='offered')return;
    sounds.play('cardstock',.80,.19,1.03);
    outline.visible=false;
    accept.hidden=true;
    gesture.release();
    captureCard();
    setPhase('opening');
  }
  function dismiss() {
    if(phase!=='reading' && phase!=='offered')return;
    sounds.play('cardstock',.42,.20,.88);
    accept.hidden=true;
    outline.visible=false;
    view.hidden=true;
    gesture.release();
    captureCard();
    setPhase('closing');
  }
  function frameCard() {
    const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
    const fraction=Math.min(camera.aspect<1 ? .88 : .70,.76*width/(height*camera.aspect));
    const distance=width/(2*fraction*tangent*camera.aspect)+thickness/2;
    goal.set(0,0,-distance).applyQuaternion(camera.quaternion).add(camera.position);
    panel.style.width=`${fraction*100}vw`;
    panel.style.height=`${fraction*camera.aspect*height/width*100}vh`;
  }
  accept.addEventListener('click',take);
  close.addEventListener('click',dismiss);
  view.addEventListener('click',event=>{if(event.target===view)dismiss();});
  view.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    event.preventDefault();
    close.focus({preventScroll:true});
  });

  return {bell,card,begin,dismiss,
    get ownsChef(){return gesture.active;},
    update(dt,canOffer){
      const moved=gesture.update(dt);
      if(phase==='idle')return moved;
      const previous=elapsed;
      elapsed+=dt;
      if(phase==='waiting'){
        restoreBell(Math.sin(Math.PI*ease(elapsed,0,.27)));
        if(canOffer && elapsed>=.13){
          gesture.start();
          setPhase('offering');
        }
      } else if(phase==='offering'){
        restoreBell(Math.sin(Math.PI*ease(elapsed+.13,0,.27)));
        const u=ease(elapsed,.74,offerTime);
        camera.position.copy(seat).lerp(focus,u);
        camera.quaternion.copy(seatRotation).slerp(focusRotation,u);
        card.visible=elapsed>=pickupTime;
        if(previous<pickupTime && card.visible)sounds.play('cardstock',.48,.18,.94);
        if(card.visible)gesture.placeCard(card);
        if(elapsed>=offerTime) {
          setPhase('offered');
          outline.visible=true;
          guide();
          accept.hidden=false;
          accept.focus({preventScroll:true});
        }
      } else if(phase==='offered'){
        guide();
      } else if(phase==='opening' || phase==='reading'){
        const u=phase==='reading' ? 1 : ease(elapsed,0,reducedMotion ? .26 : 1.0);
        frameCard();
        card.position.copy(from).lerp(goal,u);
        card.quaternion.copy(fromRotation).slerp(camera.quaternion,u);
        face.material.emissiveIntensity=.58+.23*u;
        if(phase==='opening' && u===1){
          setPhase('reading');
          view.hidden=false;
          panel.focus({preventScroll:true});
        }
      } else if(phase==='closing'){
        const u=ease(elapsed,0,reducedMotion ? .30 : 1.20);
        midpoint.copy(from).lerp(desk,.54).add(vec(.24,.83,.66));
        card.position.copy(from).lerp(midpoint,u).lerp(goal.copy(midpoint).lerp(desk,u),u);
        card.quaternion.copy(fromRotation).slerp(flat,u);
        camera.position.lerp(seat,1-Math.exp(-dt*8));
        camera.quaternion.slerp(seatRotation,1-Math.exp(-dt*8));
        face.material.emissiveIntensity=THREE.MathUtils.lerp(face.material.emissiveIntensity,.58,1-Math.exp(-dt*8));
        if(u===1){
          sounds.play('paperSlide',.57,.47,1.13);
          card.userData.parked=true;
          previousCard.visible=false;
          face.material.emissiveIntensity=.58;
          camera.position.copy(seat);
          camera.quaternion.copy(seatRotation);
          setPhase('idle');
          onClose(aspect!==camera.aspect);
        }
      }
      return moved || phase!=='offered' && phase!=='reading';
    },
  };
}
