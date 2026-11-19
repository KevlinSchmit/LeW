import * as THREE from 'three';
import { createPlayerScreen } from './counter-player-screen.js';

const tracks=[
  {title:'Last Train Home',artist:'Side Street Trio',album:'Late Hours',duration:216,art:'sake-still-life'},
  {title:'Paper Lanterns',artist:'Nori & The Keys',album:'Window Seat',duration:185,art:'mount-fuji'},
  {title:'After the Rain',artist:'June Harbor',album:'Blue Evening',duration:204,art:'mackerel'},
  {title:'Soft City Lights',artist:'Kissa Club',album:'Slow Service',duration:237,art:'grilled-octopus'},
  {title:'One More Cup',artist:'Mika Lane',album:'Night Tea',duration:162,art:'shrimp-tempura'},
];
const photos=[
  {art:'sake-still-life',name:'Sake cups in afternoon light'},
  {art:'grilled-octopus',name:'Grilled octopus'},
  {art:'shrimp-tempura',name:'Shrimp tempura'},
];
const sections=['Playlists','Photos','Extras','Settings','Now Playing'];
const pages=['playlist','photos','extras','settings','playing'];
const playlistRows=['Back',...tracks.map(track=>track.title)];
const volumeOptions=['Back','Mute','Unmute'];
const wrap=(index,count)=>(index+count)%count;
const ease=THREE.MathUtils.smootherstep;
const focusFov=38;

export function createPlayerInteraction(parts,camera,art,status,reducedMotion,onClose){
  const {player,housing,display,wheel,pressWheel}=parts;
  const screen=createPlayerScreen(art);
  const audio=new Audio();
  audio.preload='none';
  const focus=new THREE.PerspectiveCamera();
  const focusCenter=new THREE.Vector3(), localRay=new THREE.Ray(), point=new THREE.Vector3();
  const facePlane=new THREE.Plane(new THREE.Vector3(0,1,0),-display.position.y);
  const inverse=new THREE.Matrix4();
  const view={page:'playing',rows:[],selected:0,checked:-1,index:0,count:tracks.length,track:tracks[0],
    seconds:0,playing:true,muted:false,photo:photos[0].art,photoIndex:0,photoCount:photos.length};
  let active, phase, pulse;
  let sectionIndex=0, playlistIndex=1, volumeIndex=2, lastSecond=-1;

  function redraw(announce=false){
    view.rows={menu:sections,playlist:playlistRows,settings:volumeOptions}[view.page] ?? [];
    view.selected={menu:sectionIndex,playlist:playlistIndex,settings:volumeIndex}[view.page] ?? -1;
    view.checked=view.page==='settings' ? Number(!view.muted)+1 : -1;
    lastSecond=Math.floor(view.seconds);
    screen.draw(view);
    if(!announce || !active)return;
    if(view.page==='playing'){
      status.textContent=`${view.playing?'Now playing':'Paused'}. ${view.track.title} by ${view.track.artist}${view.muted?'. Muted.':'.'}`;
    } else if(view.page==='photos'){
      status.textContent=`Photo ${view.photoIndex+1} of ${photos.length}. ${photos[view.photoIndex].name}.`;
    } else if(view.page==='extras')status.textContent='Extras. Empty.';
    else status.textContent=`${view.page==='menu'?'Counter Music':sections[pages.indexOf(view.page)]}. ${view.rows[view.selected]} selected.`;
  }

  function cameraPose(){
    return {position:camera.position.clone(),rotation:camera.quaternion.clone(),fov:camera.fov};
  }

  function begin(){
    if(active)return false;
    active={origin:cameraPose(),originPortrait:camera.aspect<1,aspect:camera.aspect,time:0};
    phase='entering';
    player.updateWorldMatrix(true,false);
    inverse.copy(player.matrixWorld).invert();
    focusCenter.copy(player.localToWorld(new THREE.Vector3(0,.20,.195)));
    focus.up.set(0,0,-1).transformDirection(player.matrixWorld);
    if(display.material!==screen.material && view.track.src)chooseTrack(view.index);
    display.material=screen.material;
    view.page='playing';
    redraw(true);
    return true;
  }

  function dismiss(){
    if(!active || phase==='leaving')return;
    active.from=cameraPose();
    active.time=0;
    phase='leaving';
  }

  function chooseTrack(index){
    view.index=wrap(index,tracks.length);
    view.track=tracks[view.index];
    view.seconds=0;
    view.playing=true;
    audio.pause();
    // The demo tracks leave src empty. Adding a source enables actual playback.
    if(view.track.src){
      audio.src=view.track.src;
      audio.play().catch(()=>{if(audio.paused){view.playing=false;redraw(true);}});
    } else if(audio.hasAttribute('src')){
      audio.removeAttribute('src');
      audio.load();
    }
  }

  function togglePlayback(){
    view.playing=!view.playing;
    if(!view.track.src)return;
    if(view.playing)audio.play().catch(()=>{if(audio.paused){view.playing=false;redraw(true);}});
    else audio.pause();
  }

  function selectRow(index){
    if(view.page==='menu'){
      sectionIndex=index;
      view.page=pages[index];
      if(view.page==='playlist')playlistIndex=view.index+1;
      if(view.page==='settings')volumeIndex=Number(!view.muted)+1;
    } else if(index===0){
      view.page='menu';
    } else if(view.page==='playlist'){
      chooseTrack(index-1);
      view.page='playing';
    } else if(view.page==='settings'){
      volumeIndex=index;
      audio.muted=view.muted=index===1;
    }
  }

  function moveRow(step){
    if(view.page==='menu')sectionIndex=wrap(sectionIndex+step,sections.length);
    if(view.page==='playlist')playlistIndex=THREE.MathUtils.clamp(playlistIndex+step,0,playlistRows.length-1);
    if(view.page==='settings')volumeIndex=THREE.MathUtils.clamp(volumeIndex+step,0,volumeOptions.length-1);
  }

  function useControl(action){
    pulse={action:action==='back'?'up':action,time:0};
    if(action==='back')view.page='menu';
    else if(view.page==='playing'){
      if(action==='up')view.page='menu';
      if(action==='down')togglePlayback();
      if(action==='left'||action==='right')chooseTrack(view.index+(action==='left'?-1:1));
    } else if(view.page==='photos'||view.page==='extras'){
      if(action==='up')view.page='menu';
      if(view.page==='photos'&&(action==='left'||action==='right')){
        view.photoIndex=wrap(view.photoIndex+(action==='left'?-1:1),photos.length);
        view.photo=photos[view.photoIndex].art;
      }
    } else if(action==='up'||action==='down')moveRow(action==='up'?-1:1);
    else if(action==='select')selectRow(view.selected);
    else if(action==='left'&&view.page!=='menu')view.page='menu';
    redraw(true);
  }

  function hit(raycaster){
    localRay.copy(raycaster.ray).applyMatrix4(inverse);
    if(localRay.intersectPlane(facePlane,point)){
      const {width,height}=display.geometry.parameters;
      const x=point.x/width+.5, y=(point.z-display.position.z)/height+.5;
      if(x>=0&&x<=1&&y>=0&&y<=1)return 'body';
      const z=point.z-wheel.position.z;
      const radius=Math.hypot(point.x,z);
      if(radius<.153)return 'select';
      if(radius<.43){
        if(Math.abs(point.x)>Math.abs(z))return point.x<0?'left':'right';
        return z<0?'up':'down';
      }
    }
    return raycaster.intersectObject(housing,false).length ? 'body' : undefined;
  }

  function click(raycaster){
    if(phase!=='ready')return;
    const target=hit(raycaster);
    if(target===undefined)dismiss();
    else if(target!=='body')useControl(target);
  }

  function canPoint(raycaster){
    if(phase!=='ready')return false;
    const target=hit(raycaster);
    return target!==undefined&&target!=='body';
  }

  function key(event){
    if(event.code==='Escape'){
      event.preventDefault();
      dismiss();
      return;
    }
    const action={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',
      Enter:'select',Space:'down',Backspace:'back',KeyM:'up'}[event.code];
    if(phase!=='ready'||!action)return;
    event.preventDefault();
    if(!event.repeat)useControl(action);
  }

  function moveCamera(from,to,amount){
    camera.position.copy(from.position).lerp(to.position,amount);
    camera.quaternion.copy(from.rotation).slerp(to.rotation,amount);
    camera.fov=THREE.MathUtils.lerp(from.fov,to.fov,amount);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function update(dt,seconds){
    if(view.playing && display.material===screen.material){
      view.seconds=Math.min(view.track.duration,view.track.src ? audio.currentTime : view.seconds+seconds);
      if(view.track.src ? audio.ended : view.seconds===view.track.duration)chooseTrack(view.index+1);
      if(view.page==='playing' && lastSecond!==Math.floor(view.seconds))redraw();
    }
    let shadowChanged=false;
    if(pulse){
      pulse.time+=dt;
      const weight=ease(pulse.time,0,.045)*(1-ease(pulse.time,.045,.22));
      pressWheel(pulse.action,weight);
      if(pulse.time>=.22)pulse=null;
      shadowChanged=true;
    }
    if(!active)return shadowChanged;
    active.time+=dt;
    if(phase==='leaving'){
      const amount=reducedMotion?1:ease(active.time,0,.85);
      moveCamera(active.from,active.origin,amount);
      if(amount===1){
        const resized=active.originPortrait!==(camera.aspect<1);
        active=null;
        phase=null;
        status.textContent='';
        onClose(resized);
      }
    } else if(phase!=='ready'||active.aspect!==camera.aspect){
      const distance=Math.max(4.21,.94/(Math.tan(THREE.MathUtils.degToRad(focusFov*.5))*camera.aspect));
      player.localToWorld(focus.position.set(.045,.21+distance*.975,distance*.222));
      focus.lookAt(focusCenter);
      const amount=reducedMotion?1:ease(active.time,0,1.20);
      moveCamera(active.origin,{position:focus.position,rotation:focus.quaternion,fov:focusFov},amount);
      if(amount===1){
        phase='ready';
        active.aspect=camera.aspect;
      }
    }
    return shadowChanged;
  }

  audio.addEventListener('loadedmetadata',()=>{
    if(Number.isFinite(audio.duration)&&audio.duration>0)view.track.duration=audio.duration;
    redraw();
  });
  return {player,begin,dismiss,click,key,canPoint,update};
}
