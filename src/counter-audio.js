import recordings from './foley/counter.wav?inline';
import clips from './foley/clips.json';

const soundVolumeKey='sushi-counter-sound-control-v2';
const musicMuteKey='sushi-counter-music-muted';
const musicVolumeKey='sushi-counter-music-control-v2';
const defaultVolume=.50;
const effectsOutput=.56;
const musicOutput=.14;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function readPreference(key,fallback){
  try {
    const value=localStorage.getItem(key);
    return value===null ? fallback : JSON.parse(value);
  } catch { return fallback; }
}

function savePreference(key,value){
  try { localStorage.setItem(key,JSON.stringify(value)); } catch {}
}

function readVolume(key,fallback){
  const value=readPreference(key,fallback);
  return Number.isFinite(value) ? clamp(value,0,1) : fallback;
}

export function createCounterAudio() {
  const Context=window.AudioContext || window.webkitAudioContext;
  let context, master, buffer;
  let muted=false, allMuted=false;
  let musicMuted=readPreference(musicMuteKey,false)===true;
  // Anchor the new midpoint to the mix this listener heard before the update.
  const effectsMidpoint=readVolume('sushi-counter-sound-volume',.50)*effectsOutput;
  const musicMidpoint=readVolume('sushi-counter-music-volume',.936)*musicOutput;
  const level=(control,midpoint,oldMaximum)=>{
    if(control<=defaultVolume)return 2*control*midpoint;
    const maximum=Math.min(1,Math.max(oldMaximum,2*midpoint));
    return midpoint+(2*control-1)*(maximum-midpoint);
  };
  let volume=readVolume(soundVolumeKey,defaultVolume);
  let musicVolume=readVolume(musicVolumeKey,defaultVolume);
  const voices=new Set(), loops=new Map();

  function unlock() {
    if(!Context || document.hidden)return;
    try {
      if(!context){
        context=new Context();
        master=context.createGain();
        master.gain.value=level(volume,effectsMidpoint,effectsOutput);
        master.connect(context.destination);
        const audioContext=context;
        // Vite inlines the recording into both the hosted page and the offline export.
        void fetch(recordings).then(response=>response.arrayBuffer())
          .then(bytes=>audioContext.decodeAudioData(bytes))
          .then(decoded=>{buffer=decoded;})
          .catch(error=>{if(audioContext.state!=='closed')console.warn('Counter sound effects could not load',error);});
      }
      if(context.state!=='running')void context.resume().catch(()=>{});
    } catch {} // Browsers without working audio can still use the restaurant.
  }

  function launch(name,volume,pan,rate,repeat) {
    const [start,length]=clips[name];
    const source=context.createBufferSource();
    const level=context.createGain();
    const stereo=context.createStereoPanner?.();
    source.buffer=buffer;
    source.loop=repeat;
    source.playbackRate.value=rate;
    level.gain.value=repeat?0:volume;
    source.connect(level);
    if(stereo){
      stereo.pan.value=clamp(pan,-.58,.58);
      level.connect(stereo);
    }
    (stereo||level).connect(master);
    const voice={name,source,level,volume:0,rate,stopping:false};
    voices.add(voice);
    source.onended=()=>{
      voices.delete(voice);
      if(loops.get(name)===voice)loops.delete(name);
      source.disconnect();
      level.disconnect();
      stereo?.disconnect();
    };
    if(repeat){
      source.loopStart=start;
      source.loopEnd=start+length;
      source.start(0,start);
    } else source.start(0,start,length);
    return voice;
  }

  function play(name,volume=1,pan=0,rate=1) {
    if(!master || !buffer || muted || allMuted || document.hidden || voices.size>=12)return;
    launch(name,volume,pan,rate,false);
  }

  function fadeOut(voice,fade) {
    if(voice.stopping)return;
    voice.stopping=true;
    const now=context.currentTime;
    const gain=voice.level.gain;
    if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(now);
    else gain.cancelScheduledValues(now);
    gain.setTargetAtTime(0,now,fade/4);
    voice.source.stop(now+fade);
  }

  function stop(name,fade=.055) {
    loops.delete(name);
    for(const voice of voices)if(voice.name===name)fadeOut(voice,fade);
  }

  function sustain(name,volume,pan=0,rate=1) {
    if(!master || !buffer || muted || allMuted || document.hidden || volume<=.001){
      stop(name);
      return;
    }
    let voice=loops.get(name);
    if(!voice){
      voice=launch(name,volume,pan,rate,true);
      loops.set(name,voice);
    }
    const now=context.currentTime;
    if(Math.abs(volume-voice.volume)>.005){
      voice.volume=volume;
      voice.level.gain.setTargetAtTime(volume,now,.05);
    }
    if(Math.abs(rate-voice.rate)>.007){
      voice.rate=rate;
      voice.source.playbackRate.setTargetAtTime(rate,now,.07);
    }
  }

  function silence() {
    loops.clear();
    for(const voice of voices)fadeOut(voice,.03);
  }

  function setMuted(next) {
    muted=next;
    if(muted && master)silence();
    if(!muted)unlock();
  }

  function setVolume(next){
    volume=clamp(next,0,1);
    savePreference(soundVolumeKey,volume);
    if(master)master.gain.setTargetAtTime(level(volume,effectsMidpoint,effectsOutput),context.currentTime,.025);
  }

  function setMusicVolume(next){
    musicVolume=clamp(next,0,1);
    savePreference(musicVolumeKey,musicVolume);
  }

  function setMusicMuted(next){
    musicMuted=next;
    savePreference(musicMuteKey,next);
  }

  function cues(before,after,marks) {
    for(const [time,name,volume,pan,rate] of marks){
      if(before<time && time<=after)play(name,volume,pan,rate);
    }
  }

  return {
    get allMuted(){return allMuted;},
    toggleAllMute(){
      allMuted=!allMuted;
      if(allMuted)silence();
      else unlock();
    },
    supported:Boolean(Context), get muted(){return muted;}, get volume(){return volume;},
    get musicMuted(){return musicMuted;}, get musicVolume(){return musicVolume;},
    get musicLevel(){return level(musicVolume,musicMidpoint,musicOutput);},
    unlock, play, cues, sustain, stop, setMuted, setVolume, setMusicMuted, setMusicVolume,
    visibility(){if(document.hidden && master)silence();},
    dispose(){if(context)void context.close().catch(()=>{}); master=null;},
  };
}
