import * as THREE from 'three';

const width=384, height=300, headerHeight=43;
const ink='#282c25', paper='#d5d6ba', selection='#464d3e';
const listFont='bold 26px "Courier New", monospace';
const labels={menu:'Counter Music',playlist:'Playlists',photos:'Photos',extras:'Extras',settings:'Settings'};

function words(ctx,text,x,y,font,color=ink,align='left',maxWidth=width){
  ctx.font=font;
  ctx.fillStyle=color;
  ctx.textAlign=align;
  ctx.textBaseline='middle';
  ctx.fillText(text,x,y,maxWidth);
}

function shading(ctx,top,bottom,x,y,w,h){
  const gradient=ctx.createLinearGradient(0,y,0,y+h);
  gradient.addColorStop(0,top);
  gradient.addColorStop(1,bottom);
  ctx.fillStyle=gradient;
  ctx.fillRect(x,y,w,h);
}

function battery(ctx,color,playing){
  const x=333,y=13;
  ctx.strokeStyle=color;
  ctx.lineWidth=2;
  ctx.strokeRect(x,y,34,15);
  ctx.fillStyle=color;
  ctx.fillRect(x+35,y+4,3,7);
  if(playing) shading(ctx,'#a3d47c','#4c8e44',x+3,y+3,27,9);
  else for(let i=0;i<3;i++)ctx.fillRect(x+4+i*9,y+3,7,9);
}

function cover(ctx,img,x,y,w,h,fit='cover'){
  const ratio=Math[fit==='cover' ? 'max':'min'](w/img.width,h/img.height);
  const drawWidth=img.width*ratio,drawHeight=img.height*ratio;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x,y,w,h);
  ctx.clip();
  ctx.drawImage(img,x+(w-drawWidth)/2,y+(h-drawHeight)/2,drawWidth,drawHeight);
  ctx.restore();
}

function timecode(seconds){
  const hours=Math.floor(seconds/3600);
  const minutes=Math.floor(seconds/60)%60;
  const remainder=String(Math.floor(seconds%60)).padStart(2,'0');
  return hours ? `${hours}:${String(minutes).padStart(2,'0')}:${remainder}` : `${minutes}:${remainder}`;
}

function scrollingTitle(ctx,text,x,y,available,font,color,elapsed){
  ctx.save();
  ctx.font=font;
  ctx.fillStyle=color;
  ctx.textAlign='left';
  ctx.textBaseline='middle';
  ctx.beginPath();
  ctx.rect(x,y-20,available,40);
  ctx.clip();
  const overflow=ctx.measureText(text).width-available;
  if(overflow<=0)ctx.fillText(text,x,y);
  else {
    const speed=34, hold=1.6;
    const time=elapsed%(2*hold+overflow/speed);
    if(time<hold){
      let prefix=text;
      while(prefix && ctx.measureText(prefix+'...').width>available)prefix=prefix.slice(0,-1);
      ctx.fillText(prefix.trimEnd()+'...',x,y);
    } else ctx.fillText(text,x-Math.min(overflow,(time-hold)*speed),y);
  }
  ctx.restore();
}

function drawTrack(ctx,{track,index,count,playing,muted,seconds,duration,artwork,elapsed,message}){
  shading(ctx,'#e8f0f0','#d5e2e3',0,0,width,height);
  shading(ctx,'#edf5f4','#a9bdbb',0,0,width,headerHeight);
  words(ctx,playing?'▶':'Ⅱ',16,22,'bold 22px Arial',ink);
  words(ctx,'Now Playing',width/2,22,'bold 26px Arial',ink,'center');
  battery(ctx,ink,true);
  words(ctx,`${index+1} of ${count}`,16,70,'22px Arial');
  if(muted) words(ctx,'Muted',width-16,70,'17px Arial','#576963','right');
  if(artwork.naturalWidth)cover(ctx,artwork,16,91,125,121);
  scrollingTitle(ctx,track.title,154,137,width-170,'bold 23px Arial',ink,elapsed);
  words(ctx,track.artist,154,166,'20px Arial','#46554e','left',width-170);
  if(message)words(ctx,message,154,195,'17px Arial','#46554e','left',width-170);
  shading(ctx,'#b3c0bf','#eff5f3',16,227,width-32,15);
  const filled=(width-32)*seconds/duration;
  if(filled>0)shading(ctx,'#8ec7d4','#327986',16,227,filled,15);
  words(ctx,timecode(seconds),16,269,'21px Arial');
  words(ctx,timecode(duration),width-16,269,'21px Arial',ink,'right');
}

export function createPlayerScreen(art){
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d');
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=4;
  const material=new THREE.MeshBasicMaterial({name:'MP3 backlit LCD',map,toneMapped:false});

  function draw(view){
    const {page,rows,selected,settingsValues,editingVolume,photo,photoIndex,photoCount}=view;
    if(page==='playing')drawTrack(ctx,view);
    else {
      if(page==='photos'){
        ctx.fillStyle='#22271f';
        ctx.fillRect(0,0,width,height);
        cover(ctx,art[photo],6,headerHeight+5,width-12,height-headerHeight-11,'contain');
      } else {
        shading(ctx,'#e2e2c7','#c5c9ab',0,0,width,height);
        if(page==='extras'){
          words(ctx,'Playback controls',18,89,'bold 24px Arial',ink);
          words(ctx,'Center · Play / pause',18,127,'21px Arial');
        }
        const rowHeight=page==='settings' ? 36 : page==='playlist' ? 42 : 45;
        const visibleRows=Math.floor((height-headerHeight)/rowHeight);
        const start=Math.min(Math.max(0,selected-Math.floor(visibleRows/2)),Math.max(0,rows.length-visibleRows));
        rows.slice(start,start+visibleRows).forEach((entry,offset)=>{
          const index=start+offset;
          const y=headerHeight+rowHeight*offset;
          if(index===selected){
            ctx.fillStyle=selection;
            ctx.fillRect(0,y,width,rowHeight);
          }
          const color=index===selected ? '#f3f1d6':ink;
          const label=entry.title ?? entry;
          if(entry.title)scrollingTitle(ctx,label,17,y+rowHeight/2,width-107,listFont,color,view.elapsed);
          else words(ctx,label,17,y+rowHeight/2,listFont,color,'left',width-(page==='settings'?111:entry.title?107:82));
          if(entry.title)words(ctx,entry.source?timecode(Math.round(entry.duration)):'—',width-19,y+rowHeight/2,'20px Arial',color,'right');
          if(page==='settings' && index>0){
            const value=settingsValues[index];
            words(ctx,editingVolume&&index===selected ? `‹ ${value} ›` : value,width-19,y+rowHeight/2,'bold 19px Arial',color,'right');
          } else if(page==='menu' || label==='Back'){
            const symbol=label==='Back' ? '‹' : '›';
            words(ctx,symbol,width-19,y+rowHeight/2,'bold 29px Arial',color,'right');
          }
        });
        if(page==='settings'){
          words(ctx,editingVolume ? 'Arrows adjust · Center done' : '‹ / › Adjust volume · Center select',16,279,'17px Arial');
        }
      }
      ctx.fillStyle=paper;
      ctx.fillRect(0,0,width,headerHeight);
      ctx.fillStyle='#828870';
      ctx.fillRect(0,headerHeight-2,width,2);
      words(ctx,labels[page],width/2,21,'bold 23px "Courier New", monospace',ink,'center');
      if(page==='photos') words(ctx,`${photoIndex+1}/${photoCount}`,width-14,21,'bold 19px "Courier New", monospace',ink,'right');
      else battery(ctx,ink,false);
    }
    // A fine LCD grid stays part of the screen texture at any camera angle.
    ctx.fillStyle='rgba(40,47,37,.06)';
    for(let y=2;y<height;y+=3)ctx.fillRect(0,y,width,1);
    for(let x=2;x<width;x+=3)ctx.fillRect(x,0,1,height);
    map.needsUpdate=true;
  }

  return {material,draw};
}
