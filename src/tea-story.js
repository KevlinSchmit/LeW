import * as THREE from 'three';
import { createTeaWater } from './tea-water.js';
import { drawMenuInk, menuInkWidth } from './menu-lettering.js';
import { applyTeaPaperStock } from './tea-paper.js';

const titleLines = ['Every cup', 'has a story.'];
const { clamp, lerp, smootherstep } = THREE.MathUtils;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const pourStart = 2.29;
const pourEnd = 4.53;
const exitDuration = 1.12;
const titleWidth = 304;
const titleHeight = 89;
const titleScale = 1.26;

export function createTeaStory(model, scene, camera, onClose) {
  const teapot = model.children.find(part => part.name.startsWith('TEAPOT'));
  const cup = model.children.find(part => part.name.startsWith('TEACUP'));
  const water = createTeaWater(cup, scene);

  const title = document.querySelector('#tea-title');
  const titleContext = title.getContext('2d');
  const chapter = document.querySelector('#tea-story');
  applyTeaPaperStock(chapter.querySelector('.tea-paper'));
  const headingSlot = document.querySelector('#tea-heading-slot');
  const exit = document.querySelector('#tea-exit');
  const exitText = exit.querySelector('canvas');
  const exitContext = exitText.getContext('2d');
  const exitLabel = 'Back to Explore';
  exitText.width = Math.ceil((menuInkWidth(exitLabel) + 14) * 2);
  exitText.height = 76;
  exitText.style.width = `${exitText.width/2}px`;
  exitContext.scale(2, 2);
  exitContext.strokeStyle = '#47301c';
  drawMenuInk(exitContext, exitLabel, 7, 6, 1);

  const rest = {position: teapot.position.clone(), rotation: teapot.quaternion.clone()};
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -.45, -.99, 'YXZ'));
  const surfacePoint = v(0, 0, 0), rimPoint = v(0, 0, 0);
  // Lower inner lip of the modeled outlet, rather than the center of its air gap.
  const spoutTip = v(1.925, 1.532, 0);
  const streamOrigin = v(0, 0, 0);
  const mix = v(0, 0, 0), look = v(0, 0, 0);
  const pouringPot = v(-5.56, 3.17, 3.704).sub(spoutTip.clone().applyQuaternion(tilt));
  const firstShot = {position: v(-4.92, 4.92, 9.48), look: v(-6.17, 1.31, 3.42)};
  const overhead = {position: v(-4.35, 6.70, 5.97), look: v(-5.88, 1.24, 3.68)};
  const readingShot = {position: v(-4.63, 5.60, 4.76), look: v(-4.92, 1.30, 3.98)};
  const startLook = v(0, 0, 0);
  let phase = 'idle', time = 0, elapsed = 0, fill = 0, startCamera, exitCamera, exitPot, exitFill;
  let titleDensity;

  const snapshot = () => ({position: camera.position.clone(), rotation: camera.quaternion.clone(), fov: camera.fov});
  function begin() {
    if (phase !== 'idle') return false;
    startCamera = snapshot();
    camera.getWorldDirection(startLook).multiplyScalar(startCamera.position.distanceTo(firstShot.look)).add(camera.position);
    time = elapsed = fill = 0;
    phase = 'pouring';
    return true;
  }

  function dismiss() {
    if (phase === 'idle' || phase === 'returning') return;
    exitCamera = snapshot();
    exitPot = {position: teapot.position.clone(), rotation: teapot.quaternion.clone()};
    exitFill = fill;
    phase = 'returning';
    elapsed = 0;
    chapter.hidden = title.hidden = true;
    water.pour(streamOrigin, 0, 0);
  }
  exit.addEventListener('click', dismiss);
  chapter.addEventListener('click', event => { if (event.target === chapter) dismiss(); });

  function composeCamera(t) {
    const approach = smootherstep(t, 0, 1.57);
    const high = smootherstep(t, 1.65, 4.67);
    const nearCup = smootherstep(t, 4.63, 5.68);
    camera.position.copy(firstShot.position).lerp(overhead.position, high).lerp(readingShot.position, nearCup);
    look.copy(firstShot.look).lerp(overhead.look, high).lerp(readingShot.look, nearCup);
    if (camera.aspect < 1) {
      const narrow = clamp((1 - camera.aspect) / .56, 0, 1);
      camera.position.addScaledVector(mix.subVectors(camera.position, look), narrow*.19*(1-nearCup));
      look.x += .22 * narrow * (1-nearCup);
    }
    camera.position.lerp(startCamera.position, 1-approach);
    look.lerp(startLook, 1-approach);
    const closeFov = lerp(38, 66, clamp((1.22-camera.aspect)/.76, 0, 1));
    camera.fov = lerp(startCamera.fov, closeFov - 13*nearCup* (camera.aspect<1 ? 1 : .42), approach);
    camera.lookAt(look);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function composePot(t) {
    const lift = smootherstep(t, 1.25, 2.26);
    const lower = smootherstep(t, 4.74, 5.59);
    const raised = lift*(1-lower);
    teapot.position.copy(rest.position).lerp(pouringPot, raised);
    teapot.position.y += .38*Math.sin(raised*Math.PI);
    teapot.quaternion.copy(rest.rotation).slerp(tilt, smootherstep(t, 1.55, 2.25)*(1-smootherstep(t,4.66,5.25)));
    teapot.updateWorldMatrix(true, false);
  }

  function paintTitle(t) {
    const density = Math.min(devicePixelRatio, 2);
    if (density !== titleDensity) {
      titleDensity = density;
      title.width = titleWidth*density;
      title.height = titleHeight*density;
      titleContext.setTransform(density, 0, 0, density, 0, 0);
    }
    titleContext.clearRect(0, 0, titleWidth, titleHeight);
    titleContext.strokeStyle = '#fff';
    const ripple = 1 - smootherstep(t, 6.21, 7.0);
    for (const [i, line] of titleLines.entries()) {
      const x = (titleWidth-menuInkWidth(line)*titleScale)/2;
      drawMenuInk(titleContext, line, x, 3 + i*36, titleScale,
        j => Math.sin(t*3.6 - j*.64 + i)*1.6*ripple);
    }
    surfacePoint.set(0, water.surface.position.y, 0);
    cup.localToWorld(surfacePoint);
    rimPoint.copy(surfacePoint).x += .65;
    surfacePoint.project(camera);
    rimPoint.project(camera);
    const width = Math.abs(rimPoint.x-surfacePoint.x)*innerWidth *.79;
    const height = width/titleWidth*titleHeight;
    const fromX = (surfacePoint.x+1)*innerWidth/2-width/2;
    const fromY = (1-surfacePoint.y)*innerHeight/2-height/2;
    const growth = smootherstep(t, 6.16, 7.02);
    const target = headingSlot.getBoundingClientRect();
    const toWidth = Math.min(306, target.width);
    const toHeight = toWidth/titleWidth*titleHeight;
    title.style.width = `${lerp(width,toWidth,growth)}px`;
    title.style.height = `${lerp(height,toHeight,growth)}px`;
    title.style.transform = `translate(${lerp(fromX,target.left+(target.width-toWidth)/2,growth)}px,${lerp(fromY,target.top+(target.height-toHeight)/2,growth)}px)`;
    title.style.opacity = smootherstep(t, 4.87, 5.26);
    title.hidden = false;
  }

  function update(dt) {
    if (phase === 'idle') return false;
    if (phase === 'reading') {
      // Keep the settled composition responsive when the viewport changes.
      composeCamera(time);
      paintTitle(time);
      return false;
    }
    if (phase === 'returning') {
      elapsed += dt;
      const progress = smootherstep(elapsed, 0, exitDuration);
      camera.position.copy(exitCamera.position).lerp(startCamera.position, progress);
      camera.quaternion.copy(exitCamera.rotation).slerp(startCamera.rotation, progress);
      camera.fov = lerp(exitCamera.fov, startCamera.fov, progress);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      teapot.position.copy(exitPot.position).lerp(rest.position, progress);
      teapot.quaternion.copy(exitPot.rotation).slerp(rest.rotation, progress);
      water.fillSurface(exitFill*(1-smootherstep(elapsed,.49,exitDuration)), time+elapsed, 0);
      if (elapsed >= exitDuration) {
        water.stop();
        phase = 'idle';
        onClose();
      }
      return true;
    }
    time += dt;
    composeCamera(time);
    composePot(time);
    fill = clamp((time-pourStart-.13)/(pourEnd-pourStart),0,1);
    const agitation = smootherstep(time,pourStart+.14,pourStart+.4)*(1-smootherstep(time,pourEnd,pourEnd+.83));
    water.fillSurface(fill,time,agitation);
    teapot.localToWorld(streamOrigin.copy(spoutTip));
    water.pour(streamOrigin, clamp((time-pourStart)/.16,0,1), clamp((time-pourEnd)/.17,0,1));
    if (time > 6.15) {
      chapter.hidden = false;
      chapter.style.setProperty('--paper-progress', smootherstep(time,6.19,6.96));
      chapter.style.setProperty('--copy-progress', smootherstep(time,6.69,7.28));
    }
    if (time > 4.87) paintTitle(time);
    if (time >= 7.31) {
      phase = 'reading';
      headingSlot.closest('article').focus({preventScroll:true});
    }
    return true;
  }
  return {teapot, begin, dismiss, update,
    get pouring() {return phase==='pouring' && water.flowingFromLip && time<=pourEnd;},
    outlet: streamOrigin, lipEnd:water.lipEnd};
}
