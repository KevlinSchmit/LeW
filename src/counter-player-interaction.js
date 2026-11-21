import * as THREE from 'three';
import { createPlayerScreen } from './counter-player-screen.js';
import { tracks } from './counter-playlist.js';

const photos=[
  {art:'sake-still-life',name:'Sake cups in afternoon light'},
  {art:'grilled-octopus',name:'Grilled octopus'},
  {art:'shrimp-tempura',name:'Shrimp tempura'},
];
const sections=['Playlists','Photos','Extras','Settings','Now Playing'];
const pages=['playlist','photos','extras','settings','playing'];
const playlistRows=['Back',...tracks];
const volumeOptions=['Back','Music volume','Sound effects volume','Mute music','Mute sound effects','Mute both'];
const musicVolumeRow=1, effectsVolumeRow=2, musicMuteRow=3, effectsMuteRow=4, bothMuteRow=5;
const percent=value=>`${Math.round(value*100)}%`;
const wrap=(index,count)=>(index+count)%count;
const ease=THREE.MathUtils.smootherstep;
const focusFov=38;

export function createPlayerInteraction(parts,camera,art,status,reducedMotion,sounds,onClose){
  const {player,housing,display,wheel,pressWheel}=parts;
  const screen=createPlayerScreen(art);

  const focus=new THREE.PerspectiveCamera();
  const focusCenter=new THREE.Vector3(), localRay=new THREE.Ray(), point=new THREE.Vector3();
  const facePlane=new THREE.Plane(new THREE.Vector3(0,1,0),-display.position.y);
  const inverse=new THREE.Matrix4();
  const track=tracks[0];
  const view={page:'playing',rows:[],selected:0,index:0,count:tracks.length,track,
    seconds:0,duration:track.duration,playing:false,muted:false,photo:photos[0].art,photoIndex:0,photoCount:photos.length};
  let active, phase, pulse;
  let sectionIndex=0, playlistIndex=1, volumeIndex=1;
  let editingVolume=false;
  const music=new Audio(track.source);
  music.preload='metadata';
  const artwork=new Image();
  artwork.onload=()=>redraw();
  artwork.src=track.artwork;
  view.artwork=artwork;
  let pageSince=0, previousPage='', lastFrame=-1;

  function syncVolume(){
    music.volume=sounds.musicLevel;
    music.muted=sounds.allMuted || sounds.musicMuted;
  }
  const startupEvents=['click','keydown'];
  let pendingStart=true;
  function cancelStartup(){
    pendingStart=false;
    for(const event of startupEvents)document.removeEventListener(event,retryStart,true);
  }
  function retryStart(){
    if(pendingStart)playMusic();
  }
  function playMusic(){
    if(!view.track.source)return;
    syncVolume();
    const requested=view.track;
    void music.play().then(cancelStartup).catch(error=>{
      if(requested!==view.track || error.name==='AbortError')return;
      if(error.name!=='NotAllowedError')view.message='Audio unavailable';
      redraw(true);
    });
  }
  function chooseTrack(index){
    cancelStartup();
    const next=tracks[index];
    music.pause();
    view.index=index;
    view.track=next;
    view.duration=next.duration;
    view.seconds=0;
    view.playing=false;
    view.message=next.source?'':'Audio unavailable';
    artwork.src=next.artwork;
    pageSince=performance.now();
    if(next.source){
      music.src=next.source;
      playMusic();
    }else{
      music.removeAttribute('src');
      music.load();
    }
    redraw(true);
  }
  function nextPlayable(){
    let next=wrap(view.index+1,tracks.length);
    while(!tracks[next].source)next=wrap(next+1,tracks.length);
    chooseTrack(next);
  }
  function playbackChanged(){
    view.playing=!music.paused && !music.ended;
    redraw(true);
  }
  for(const event of ['play','pause'])music.addEventListener(event,playbackChanged);
  music.addEventListener('ended',nextPlayable);
  for(const event of startupEvents)document.addEventListener(event,retryStart,true);
  retryStart();
  function visibilityChanged(){if(document.hidden)music.pause();}
  document.addEventListener('visibilitychange',visibilityChanged);

  function redraw(announce=false){
    if(previousPage!==view.page){
      previousPage=view.page;
      pageSince=performance.now();
    }
    view.elapsed=(performance.now()-pageSince)/1000;
    view.rows={menu:sections,playlist:playlistRows,settings:volumeOptions}[view.page] ?? [];
    view.selected={menu:sectionIndex,playlist:playlistIndex,settings:volumeIndex}[view.page] ?? -1;
    view.muted=sounds.allMuted || sounds.musicMuted;
    view.settingsValues=['',percent(sounds.musicVolume),percent(sounds.volume),
      sounds.musicMuted?'On':'Off',sounds.muted?'On':'Off',sounds.allMuted?'On':'Off'];
    view.editingVolume=editingVolume;
    screen.draw(view);
    if(!announce || !active)return;
    if(view.page==='playing'){
      status.textContent=`${view.message || (view.playing?'Now playing':'Paused')}. ${view.track.title} by ${view.track.artist}${view.muted?'. Muted.':'.'}`;
    } else if(view.page==='photos'){
      status.textContent=`Photo ${view.photoIndex+1} of ${photos.length}. ${photos[view.photoIndex].name}.`;
    } else if(view.page==='extras')status.textContent='Press the center button to play or pause.';
    else {
      const row=view.rows[view.selected];
      const setting=view.page==='settings' ? view.settingsValues[view.selected] : '';
      status.textContent=`${view.page==='menu'?'Counter Music':sections[pages.indexOf(view.page)]}. ${row.title ?? row} selected.${setting ? ` ${setting}.` : ''}${editingVolume ? ' Use the arrow keys to adjust.' : ''}`;
    }
  }

  function cameraPose(){
    return {position:camera.position.clone(),rotation:camera.quaternion.clone(),fov:camera.fov};
  }

  function begin(){
    if(active)return false;
    sounds.play('wheel',.51,.41);
    active={origin:cameraPose(),originPortrait:camera.aspect<1,aspect:camera.aspect,time:0};
    phase='entering';
    previousPage='';
    player.updateWorldMatrix(true,false);
    inverse.copy(player.matrixWorld).invert();
    focusCenter.copy(player.localToWorld(new THREE.Vector3(0,.20,.195)));
    focus.up.set(0,0,-1).transformDirection(player.matrixWorld);
    display.material=screen.material;
    view.page='playing';
    editingVolume=false;
    redraw(true);
    return true;
  }

  function dismiss(){
    if(!active || phase==='leaving')return;
    sounds.play('interface',.53,.31,.88);
    active.from=cameraPose();
    active.time=0;
    phase='leaving';
  }

  function adjustVolume(step){
    const music=volumeIndex===musicVolumeRow;
    const value=music?sounds.musicVolume:sounds.volume;
    const next=(Math.round(value*20)+step)/20;
    if(music){sounds.setMusicVolume(next);syncVolume();}
    else sounds.setVolume(next);
  }

  function selectSetting(index){
    if(index===musicVolumeRow || index===effectsVolumeRow)editingVolume=!editingVolume;
    else if(index===musicMuteRow){sounds.setMusicMuted(!sounds.musicMuted);syncVolume();}
    else if(index===effectsMuteRow){
      sounds.setMuted(!sounds.muted);
    } else if(index===bothMuteRow){
      sounds.toggleAllMute();
      syncVolume();
    }
  }

  function selectRow(index){
    if(view.page==='menu'){
      sectionIndex=index;
      view.page=pages[index];
      if(view.page==='playlist')playlistIndex=view.index+1;
      if(view.page==='settings'){
        volumeIndex=musicVolumeRow;
        editingVolume=false;
      }
    } else if(index===0){
      view.page='menu';
    } else if(view.page==='playlist'){
      view.page='playing';
      chooseTrack(index-1);
    } else if(view.page==='settings')selectSetting(index);
  }

  function moveRow(step){
    if(view.page==='menu')sectionIndex=wrap(sectionIndex+step,sections.length);
    if(view.page==='playlist')playlistIndex=THREE.MathUtils.clamp(playlistIndex+step,0,playlistRows.length-1);
    if(view.page==='settings')volumeIndex=THREE.MathUtils.clamp(volumeIndex+step,0,volumeOptions.length-1);
  }

  function useControl(action){
    sounds.play(action==='select'?'key':'wheel',action==='select'?.57:.63,.21,
      action==='down'?.91:action==='up'?1.06:1);
    pulse={action:action==='back'?'up':action,time:0};
    if(action==='back'){
      editingVolume=false;
      view.page='menu';
    }
    else if(view.page==='playing'){
      if(action==='up')view.page='menu';
      if(action==='left'||action==='right')chooseTrack(wrap(view.index+(action==='left'?-1:1),tracks.length));
      if(action==='down'||action==='select'){
        if(music.paused)playMusic(); else music.pause();
      }
    } else if(view.page==='photos'||view.page==='extras'){
      if(action==='up')view.page='menu';
      if(view.page==='photos'&&(action==='left'||action==='right')){
        view.photoIndex=wrap(view.photoIndex+(action==='left'?-1:1),photos.length);
        view.photo=photos[view.photoIndex].art;
      }
    } else if(view.page==='settings' && (volumeIndex===musicVolumeRow||volumeIndex===effectsVolumeRow)
      && (action==='left'||action==='right'||(editingVolume&&(action==='up'||action==='down')))){
      adjustVolume(action==='left'||action==='down'?-1:1);
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

  function update(dt){
    if(active && phase!=='leaving'){
      view.duration=Number.isFinite(music.duration)?music.duration:view.track.duration;
      view.seconds=music.currentTime;
      const frame=Math.floor(performance.now()/50);
      if((view.page==='playing'||view.page==='playlist') && lastFrame!==frame){
        lastFrame=frame;
        redraw();
      }
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

  return {player,begin,dismiss,click,key,canPoint,update,syncMute(){syncVolume();redraw();},dispose(){cancelStartup();music.pause();document.removeEventListener('visibilitychange',visibilityChanged);}};
}
