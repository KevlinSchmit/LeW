import * as THREE from 'three';
import { createCounterPaper } from './counter-paper.js';
import { createCounterReceipt } from './counter-receipt.js';
import { illustrateServing } from './sushi/illustration.js';
import { isFrontDish } from './conveyor.js';
import { isSushiCover, matchesTableware } from './sushi/servings.js';
import { createDiningChopsticks } from './sushi/dining.js';

const ease = THREE.MathUtils.smootherstep;
const vector = (x,y,z) => new THREE.Vector3(x,y,z);
const servingSpot = vector(.10,.052,3.58);
const coverAwayAt = 2.78;
const returnTime = 1.17;

export function createCounterStories(model, camera, renderer, menu, onClose) {
  const terminal = model.children.find(part => part.name.startsWith('POS'));
  const chopsticks = model.children.find(part => part.name.startsWith('CHOPSTICKS'));
  const bamboo = chopsticks.children.find(part => part.material?.name.includes('End-grain & bamboo'));
  const china = chopsticks.children.filter(part => part !== bamboo);
  const dining = createDiningChopsticks(model,bamboo);
  const usedPlates = new THREE.Group();
  usedPlates.name = 'Guest used plate stack';
  model.add(usedPlates);
  let stackTop = .008;
  const receipt = createCounterReceipt(terminal);
  const resumeSheet = createCounterPaper('resume-story','Resume',dismiss);
  const sushiSheet = createCounterPaper('sushi-story','Sushi at the counter',dismiss);
  const sushiPicture = sushiSheet.paper.querySelector('img');
  const art = new Map();
  const aim = new THREE.Vector3();
  const focusRotation = new THREE.Quaternion(), cameraAim = new THREE.PerspectiveCamera();
  let active;

  function cameraState() {
    return {position:camera.position.clone(), rotation:camera.quaternion.clone(), fov:camera.fov};
  }

  function begin(kind, source) {
    if (active || (kind==='sushi' && (!source.visible || !isFrontDish(source)))) return false;
    const sheet = kind==='resume' ? resumeSheet : sushiSheet;
    active = {kind, sheet, origin:cameraState(), time:0, revealed:false};
    if (kind === 'resume') return true;

    const dish = source.clone(true);
    dish.name = 'Selected serving on the guest counter';
    model.add(dish);
    // Use the actual belt materials so custom PET transparency, plate glazes
    // and the individual food textures survive the trip to the table.
    const covers = dish.children.filter(isSushiCover).map(part => ({part, position:part.position.clone()}));
    const kindName = source.userData.sushiKind;
    if (!art.has(kindName)) art.set(kindName, illustrateServing(dish,renderer));
    sushiPicture.src = art.get(kindName);
    sushiPicture.alt = source.userData.sushiDescription || `${kindName} sushi`;
    const props = [menu, bamboo, ...china].map(part => ({part,start:part.position.clone()}));
    Object.assign(active,{dish,covers,props,dishStart:dish.position.clone(),yaw:dish.rotation.y});
    return true;
  }

  function dismiss() {
    if (!active || active.returning || active.meal) return;
    active.sheet.hide();
    receipt.hide();
    if (active.dish) {
      active.skipPaper=true;
      if (active.time>=coverAwayAt) beginMeal(active);
    } else active.returning = {time:0,camera:cameraState()};
  }

  function beginMeal(state) {
    state.covers.forEach(({part})=>part.removeFromParent());
    state.meal={time:0, take:dining.prepare(state.dish)};
    for (const prop of state.props) prop.from=prop.part.position.clone();
  }

  function setFocus(origin, center, offset, fov, t) {
    cameraAim.position.copy(center).add(offset);
    cameraAim.lookAt(center);
    focusRotation.copy(cameraAim.quaternion);
    camera.position.copy(origin.position).lerp(cameraAim.position,t);
    camera.quaternion.copy(origin.rotation).slerp(focusRotation,t);
    camera.fov = THREE.MathUtils.lerp(origin.fov,fov,t);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function showSheet(state, progress) {
    if (progress<=0) return;
    if (!state.revealed) {
      state.revealed=true;
      state.sheet.open();
    }
    state.sheet.show(progress);
    if (progress>=1 && !state.focused) {
      state.sheet.focus();
      state.focused=true;
    }
  }

  function playPrint(state) {
    const t = state.time, mobile = camera.aspect<1;
    aim.copy(receipt.outlet).add(vector(0,.38,.46));
    setFocus(state.origin,aim,vector(.38,3.25,mobile?4.50:3.66),
      mobile?56:37,ease(t,0,1.22));
    const feed = ease(t,1.0,3.35);
    const lift = ease(t,3.45,4.31);
    const reveal = ease(t,3.88,4.55);
    receipt.update(feed,lift,reveal,camera);
    showSheet(state,reveal);
  }

  function playServing(state) {
    const {time:t,dish,props,covers,dishStart,yaw} = state;
    const clear = ease(t,.02,.93);
    const place = ease(t,.19,1.48);
    dish.position.copy(dishStart).lerp(servingSpot,place);
    dish.position.y += .94 * Math.sin(Math.PI*place);
    dish.rotation.y = THREE.MathUtils.lerp(yaw,.23,place);
    props.forEach(({part,start},index) => {
      part.position.copy(start);
      if (index===0) part.position.z += clear*3.75;
      else if (index===1) {
        part.position.x += clear*4.7;
        part.position.z += clear*3.95;
        part.position.y += .58*Math.sin(Math.PI*clear);
        part.visible = clear<.999;
      } else part.position.x -= clear*1.05;
    });
    const lift = ease(t,1.45,2.33);
    const offscreen = ease(t,1.74,coverAwayAt);
    for (const {part,position} of covers) {
      part.position.copy(position);
      part.position.x += offscreen*7.9;
      part.position.y += lift*1.74;
      part.position.z += offscreen*.63;
      part.visible = t<coverAwayAt;
    }
    const mobile = camera.aspect<1;
    aim.copy(servingSpot).add(vector(0,.42,0));
    setFocus(state.origin,aim,vector(.48,2.84,mobile?4.64:4.18),mobile?49:35,ease(t,1.46,2.85));
    if (state.skipPaper) {
      if (t>=coverAwayAt) beginMeal(state);
    } else showSheet(state,ease(t,2.85,3.58));
  }

  function returnCamera(origin, from, t) {
    camera.position.copy(from.position).lerp(origin.position,t);
    camera.quaternion.copy(from.rotation).slerp(origin.rotation,t);
    camera.fov = THREE.MathUtils.lerp(from.fov,origin.fov,t);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function closeStory() {
    active=null;
    onClose();
  }

  function finishReturn(state,dt) {
    const back = state.returning;
    back.time += dt;
    returnCamera(state.origin,back.camera,ease(back.time,0,returnTime));
    if (back.time>=returnTime) closeStory();
  }

  function playMeal(state,dt) {
    const {meal,dish}=state;
    meal.time+=dt;
    if (meal.time<meal.take.duration) {
      dining.update(meal.take,meal.time,camera);
      return;
    }
    if (!meal.route) {
      dining.finish(meal.take);
      for (const part of [...dish.children]) {
        if (!matchesTableware(part)) part.removeFromParent();
      }
      const plateBounds=new THREE.Box3().setFromObject(dish,true);
      const rise=plateBounds.max.y-plateBounds.min.y;
      const layer=usedPlates.children.length;
      const target=vector(-8.20+(layer%3-1)*.024,stackTop+dish.position.y-plateBounds.min.y,5.96);
      meal.route=new THREE.QuadraticBezierCurve3(dish.position.clone(),
        vector(-3.95,Math.max(.96,target.y+.58),7.18),target);
      meal.camera=cameraState();
      meal.yaw=dish.rotation.y;
      stackTop+=Math.max(.10,rise-.047);
    }
    const time=meal.time-meal.take.duration;
    const slide=ease(time,.10,1.37);
    meal.route.getPoint(slide,dish.position);
    dish.rotation.y=THREE.MathUtils.lerp(meal.yaw,.10+usedPlates.children.length%3*.06,slide);
    const clear=ease(time,.56,1.55);
    for (const {part,start,from} of state.props) part.position.copy(from).lerp(start,clear);
    bamboo.visible=clear>.98;
    returnCamera(state.origin,meal.camera,ease(time,.23,1.58));
    if (time<1.58) return;
    dish.name='Used sushi plate';
    usedPlates.attach(dish);
    closeStory();
  }

  return {
    terminal, begin, dismiss,
    update(dt) {
      if (!active) return false;
      if (active.meal) playMeal(active,dt);
      else if (active.returning) finishReturn(active,dt);
      else {
        if (active.focused && active.aspect===camera.aspect) return false;
        if (!active.focused) active.time += dt;
        active.aspect=camera.aspect;
        if (active.kind==='resume') playPrint(active);
        else playServing(active);
        return true;
      }
      return true;
    },
  };
}
