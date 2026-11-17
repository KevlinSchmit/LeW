"""Deterministic, original painted textures for the editable Blender scene."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import random, math
random.seed(23)
OUT = Path(__file__).resolve().parents[1] / 'blender' / 'textures'
OUT.mkdir(parents=True, exist_ok=True)
def save(im,name): im.save(OUT / (name+'.png'))
def font(size,serif=False):
    return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf' if serif else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',size)
# Fine, long wood grain; geometry supplies the seams and rounded edges.
im=Image.new('RGB',(2048,1024)); p=im.load()
for y in range(1024):
    band=3*math.sin(y*.058)+2*math.sin(y*.23)+math.sin(y*.59)
    for x in range(2048):
        g=band+1.5*math.sin(y*.42+math.sin(x*.003)*2)+random.uniform(-2,2)
        p[x,y]=(int(144+g),int(78+g*.72),int(33+g*.4))
d=ImageDraw.Draw(im)
for i in range(220):
    y=random.randrange(1024); x=random.randrange(2048); length=random.randrange(40,1600)
    points=[(x+j,y+2*math.sin(j*.004+i)) for j in range(0,length,12)]
    if len(points)>1:d.line(points, fill=random.choice([(133,70,30),(151,84,35),(158,87,38)]),width=1)
save(im,'wood')
# Navy linen book cover, with hand-drawn overlapping seigaiha waves.
im=Image.new('RGB',(1024,1536),(45,53,76)); d=ImageDraw.Draw(im)
for i in range(42000):
    x=random.randrange(1024);y=random.randrange(1536);c=random.randrange(43,66)
    d.point((x,y),fill=(c,c+5,c+18))
for row in range(3):
    for col in range(-1,5):
        cx=col*310+(155 if row%2 else 0);cy=1536-row*130+90
        for r in [63,96,129,162,195]:d.arc((cx-r,cy-r,cx+r,cy+r),180,360,fill=(228,208,167),width=13)
d.rounded_rectangle((665,105,914,790),radius=6,fill=(231,196,147),outline=(171,115,63),width=5)
d.rectangle((679,119,900,775),outline=(121,75,40),width=2)
label=Image.new('RGBA',(600,190)); ld=ImageDraw.Draw(label);ld.text((15,-6),'Menu',font=font(133,True),fill=(46,39,35))
label=label.rotate(-90,expand=True)
im.paste(label,(700,180),label)
d.text((699,660),'お品書き',font=font(25),fill=(86,61,42))
save(im,'menu')
# Painted cherry blossom wrapping the front of each ceramic vessel.
im=Image.new('RGBA',(2048,1024),(0,0,0,0)); d=ImageDraw.Draw(im)
# lathe UV front is at u=.75 (negative Y)
cx,cy=1536,560
for x,y,ang in [(cx+120,cy+40,-30),(cx-130,cy+80,30),(cx+75,cy-125,-45),(cx-140,cy-60,20)]:
    leaf=Image.new('RGBA',(180,80));ld=ImageDraw.Draw(leaf);ld.ellipse((0,5,180,75),fill=(128,141,71,220));ld.line((8,40,170,40),fill=(173,169,90),width=3)
    leaf=leaf.rotate(ang,expand=True); im.alpha_composite(leaf,(x-90,y-40))
d=ImageDraw.Draw(im)
for a in range(5):
    ang=a*2*math.pi/5-math.pi/2;x=cx+math.cos(ang)*75;y=cy+math.sin(ang)*75
    d.ellipse((x-48,y-58,x+48,y+58),fill=(247,218,187),outline=(233,189,155),width=2)
d.ellipse((cx-29,cy-29,cx+29,cy+29),fill=(237,159,34))
for a in range(13):
    t=a*2*math.pi/13; x=cx+35*math.cos(t);y=cy+35*math.sin(t);d.line((cx,cy,x,y),fill=(217,142,35),width=2);d.ellipse((x-3,y-3,x+3,y+3),fill=(255,197,54))
im=im.transform(im.size,Image.Transform.AFFINE,(1,0,0,0,1/2.3,cy*(1-1/2.3)),resample=Image.Resampling.BICUBIC)
bg=Image.new('RGBA',im.size,(137,145,82,255)); bg.alpha_composite(im); save(bg.convert('RGB'),'blossom')
# Nigiri fish: colored striations follow the curved mesh, not a flat image prop.
for name,base,stripe in [('salmon',(244,115,49),(255,204,142)),('tuna',(203,51,46),(239,102,88))]:
    im=Image.new('RGB',(1024,512),base);d=ImageDraw.Draw(im)
    for i in range(-12,24):
        pts=[(i*82+j*.40+8*math.sin(j/100),j) for j in range(0,513,6)]
        d.line(pts,fill=stripe,width=9 if name=='salmon' else 4)
        d.line([(x+16,y) for x,y in pts],fill=tuple(min(255,c+8) for c in base),width=3)
    save(im,name)
# Receipt: a curved mesh will use this paper texture.
im=Image.new('RGB',(512,1024),(247,226,194));d=ImageDraw.Draw(im)
d.text((62,280),'Resume',font=font(64,True),fill=(49,41,31))
d.text((106,385),'FRESH IDEAS, DAILY',font=font(15),fill=(112,92,69))
for i in range(7):
    y=470+i*55;d.ellipse((65,y,75,y+10),fill=(58,49,36));d.line((94,y+5,366,y+5),fill=(154,129,97),width=2);d.text((390,y-5),'••',font=font(19),fill=(58,49,36))
d.line((65,865,445,865),fill=(150,116,83),width=2);d.text((143,909),'THANK YOU',font=font(19),fill=(107,83,55))
save(im,'receipt')
# Four painted little plate signs.
for kind in ['roe','egg','salmon','tuna']:
    im=Image.new('RGB',(256,256),(244,227,197)); d=ImageDraw.Draw(im)
    if kind=='roe':
        for x,y in [(86,77),(151,129),(80,153)]:d.rectangle((x-25,y-25,x+25,y+25),fill=(187,43,35))
    elif kind=='egg':
        d.rounded_rectangle((14,14,242,242),radius=5,fill=(80,121,91));cx=128;cy=130
        for a in range(5):
            t=a*math.pi*2/5; x=cx+math.cos(t)*43;y=cy+math.sin(t)*43;d.ellipse((x-27,y-28,x+27,y+28),fill=(248,222,179))
        d.ellipse((108,110,148,150),fill=(233,167,48))
    elif kind=='salmon':
        for cx,cy in [(70,155),(185,155),(128,235)]:
            for r in [34,59,84,109]:d.arc((cx-r,cy-r,cx+r,cy+r),180,360,fill=(61,106,149),width=10)
    else:
        d.ellipse((52,90,182,165),fill=(201,51,41));d.polygon([(167,126),(220,86),(217,167)],fill=(201,51,41));d.polygon([(100,93),(122,70),(145,99)],fill=(201,51,41));d.ellipse((65,113,73,121),fill=(250,225,186))
    save(im,'sign_'+kind)
# Curtain waves.
im=Image.new('RGB',(1024,1024),(31,44,75)); d=ImageDraw.Draw(im)
for row in range(2):
    for col in range(-1,5):
        cx=col*280+(140 if row%2 else 0);cy=1050-row*130
        for r in [32,59,86,113,140,167]:d.arc((cx-r,cy-r,cx+r,cy+r),180,360,fill=(197,194,176),width=8)
save(im,'curtain')
print('Original textures written to',OUT)
