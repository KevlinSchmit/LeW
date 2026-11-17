"""Original hand-painted game-asset textures. Seeded, deliberately 256–512px.
Painted contours, brushwork and ambient shading carry detail on simple meshes.
No photographs, external art or model downloads are used.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import random, math
OUT=Path(__file__).resolve().parents[1]/'blender'/'textures'
OUT.mkdir(parents=True,exist_ok=True)
random.seed(23)
INK=(65,58,41); CREAM=(235,222,175)
def font(size,serif=False):
    return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/'+('DejaVuSerif.ttf' if serif else 'DejaVuSans.ttf'),size)
def save(im,name): im.convert('RGB').save(OUT/(name+'.png'))
def ground(size,base,variation=6):
    im=Image.new('RGB',size);p=im.load()
    for y in range(size[1]):
        for x in range(size[0]):
            v=random.uniform(-variation,variation)+2*math.sin(x*.08+y*.06)
            p[x,y]=tuple(max(0,min(255,int(c+v))) for c in base)
    return im

def flower(d,cx,cy,r,aspect=1):
    for i in range(5):
        a=i*math.tau/5-.6;x=cx+math.cos(a)*r*.63*aspect;y=cy+math.sin(a)*r*.63
        d.ellipse((x-r*.44*aspect,y-r*.47,x+r*.44*aspect,y+r*.47),fill=(235,216,172),outline=(172,147,105),width=1)
        d.line((cx,cy,x,y),fill=(203,173,119),width=1)
    d.ellipse((cx-r*.17*aspect,cy-r*.17,cx+r*.17*aspect,cy+r*.17),fill=(183,122,48))
    for i in range(7):
        a=i*math.tau/7;x=cx+math.cos(a)*r*.24*aspect;y=cy+math.sin(a)*r*.24
        d.line((cx,cy,x,y),fill=(163,103,47),width=1)
        d.ellipse((x-1,y-1,x+1,y+1),fill=(249,213,118))

def waves(d,w,y,color,spacing=64):
    for row in range(2):
        for x in range(-spacing,w+spacing,spacing):
            cx=x+(spacing//2 if row%2 else 0);cy=y-row*spacing*.35
            for r in [spacing*.22,spacing*.34,spacing*.46,spacing*.58]:
                d.arc((cx-r,cy-r,cx+r,cy+r),180,355,fill=color,width=2)

# Wrapping ceramic: branches and blossoms across the entire circumference,
# with separate ink and cream borders and seigaiha bands.
im=ground((512,512),(129,151,103),5);d=ImageDraw.Draw(im)
for y in [20,43,439,468,489]:
    d.line((0,y,512,y),fill=(52,76,57),width=3)
    d.line((0,y+4,512,y+4),fill=(204,205,146),width=2)
waves(d,512,478,(203,200,145),48)
for x in range(-10,560,118):
    points=[(x-35,430),(x+3,352),(x-10,290),(x+28,220),(x+9,143),(x+42,64)]
    d.line(points,fill=(61,83,57),width=5)
    d.line([(a+2,b) for a,b in points],fill=(172,176,116),width=1)
    for i,y in enumerate([117,183,271,355]):
        xx=x+(17 if i%2 else -7)
        d.line((xx,y,xx+31,y-17),fill=(65,90,61),width=2)
        d.ellipse((xx+17,y-37,xx+47,y-18),fill=(77,107,66),outline=(61,82,54),width=1)
        d.line((xx+21,y-25,xx+44,y-29),fill=(172,180,113),width=1)
        flower(d,xx-7,y-10,random.choice([34,40,43]),aspect=.28)
for i in range(90):
    x=random.randrange(512);y=random.randrange(65,430)
    if i%3==0:d.ellipse((x,y,x+3,y+6),fill=(220,196,144))
save(im,'blossom')

# Planar lid painting uses its own UVs, so flowers do not stretch over the crown.
im=ground((256,256),(129,151,103),4);d=ImageDraw.Draw(im)
for r in [83,88,113,118]:d.ellipse((128-r,128-r,128+r,128+r),outline=(65,85,57),width=2)
for i in range(10):
    a=i*math.tau/10;x=128+math.cos(a)*99;y=128+math.sin(a)*99
    flower(d,x,y,10)
for i in range(6):
    a=i*math.tau/6;x=128+math.cos(a)*61;y=128+math.sin(a)*61
    flower(d,x,y,17)
    d.line((x,y,128+math.cos(a+.24)*37,128+math.sin(a+.24)*37),fill=(66,90,59),width=2)
save(im,'tea_lid')

# Plank paint: broad, uneven grain rather than photographic fine noise.
for name,base in [('wood',(171,120,67)),('darkwood',(70,66,48)),('bamboo',(179,142,84))]:
    im=ground((512,256),base,4);d=ImageDraw.Draw(im)
    for i in range(60):
        y=random.randrange(256);x=random.randrange(-100,250);length=random.randrange(70,650)
        pts=[(x+t,y+2*math.sin(t*.02+i)+math.sin(t*.07)) for t in range(0,length,5)]
        color=tuple(max(0,c-random.choice([10,17,22])) for c in base)
        d.line(pts,fill=color,width=random.choice([1,1,2]))
        if i%4==0:d.line([(a,b+3) for a,b in pts],fill=tuple(min(255,c+17) for c in base),width=1)
    for x,y in [(110,75),(384,198)]:
        for r in range(3,18,4):d.ellipse((x-r*2,y-r*.4,x+r*2,y+r*.4),outline=tuple(max(0,c-19) for c in base),width=1)
    save(im,name)

# Painted fish: irregular fat ribbons, layered muscle fibers, warm edge shading.
for name,base,stripe in [('salmon',(219,111,67),(245,209,151)),('tuna',(167,65,67),(213,133,121))]:
    im=ground((512,256),base,7);p=im.load()
    for y in range(256):
        for x in range(512):
            shade=1-.22*(abs(y-128)/128)**4-.07*math.sin(x*.012)**2
            p[x,y]=tuple(int(c*shade) for c in p[x,y])
    d=ImageDraw.Draw(im)
    for i in range(-6,13):
        pts=[(i*50+abs(y-125)*.64+4*math.sin(y*.039+i),y) for y in range(0,258,2)]
        d.line([(x-3,y) for x,y in pts],fill=tuple(int(c*.72) for c in base),width=9 if name=='salmon' else 5)
        d.line(pts,fill=stripe,width=5 if name=='salmon' else 2)
        for shift in [12,23,34]:
            d.line([(x+shift,y) for x,y in pts],fill=tuple(int(c*.87+s*.13) for c,s in zip(base,stripe)),width=1)
    d.line((0,3,512,3),fill=tuple(int(c*.71) for c in base),width=3)
    d.line((0,250,512,250),fill=tuple(int(c*.75) for c in base),width=3)
    for i in range(130):
        x=random.randrange(512);y=random.randrange(256)
        d.line((x,y,x+random.randrange(3,15),y+1),fill=tuple(min(255,c+12) for c in base),width=1)
    save(im,name)

im=ground((256,256),(48,62,39),7);d=ImageDraw.Draw(im)
for i in range(2600):
    x=random.randrange(256);y=random.randrange(256);v=random.randrange(30,90)
    d.line((x,y,x+random.randrange(2,9),y+random.randrange(-3,4)),fill=(int(v*.76),v,int(v*.57)),width=random.choice([1,2]))
for i in range(20):
    y=random.randrange(256);d.line([(x,y+4*math.sin(x*.05+i)) for x in range(256)],fill=(34,43,28),width=1)
save(im,'nori')

# Rice is illustrated into the base texture, with a few silhouette grains in mesh.
im=ground((256,256),(215,208,170),4);d=ImageDraw.Draw(im)
for row in range(16):
    for col in range(15):
        x=col*19+(9 if row%2 else 0)+random.randrange(-3,4);y=row*17+random.randrange(-3,4)
        d.ellipse((x-8,y-4,x+8,y+4),fill=(235,228,191),outline=(167,160,126),width=1)
        d.line((x-5,y-2,x+4,y-2),fill=(252,244,206),width=1)
save(im,'rice')
im=ground((256,256),(228,183,65),5);d=ImageDraw.Draw(im)
for y in range(0,256,12):
    d.line([(x,y+2*math.sin(x*.05+y)) for x in range(256)],fill=(191,138,44),width=2)
    d.line([(x,y+3+2*math.sin(x*.05+y)) for x in range(256)],fill=(245,209,100),width=2)
for i in range(650):
    x=random.randrange(256);y=random.randrange(256);r=random.choice([1,1,2]);d.ellipse((x,y,x+r,y+r),fill=random.choice([(172,127,40),(248,215,115),(216,161,46)]))
save(im,'egg')
im=ground((128,128),(218,106,31),7);d=ImageDraw.Draw(im)
d.ellipse((36,23,91,95),fill=(232,126,38));d.ellipse((59,52,77,76),fill=(172,63,25));d.arc((24,13,101,110),190,280,fill=(250,180,74),width=7);save(im,'roe')

# Matte and metal finishes have small painted nicks and firm edge highlights.
for name,base in [('ceramic',(224,219,186)),('brass',(185,151,76)),('steel',(146,151,137)),('pos_body',(219,220,193)),('belt',(158,157,132)),('plaster',(150,145,117))]:
    im=ground((256,256),base,4);d=ImageDraw.Draw(im)
    for i in range(70):
        x=random.randrange(256);y=random.randrange(256);v=random.choice([-20,12])
        d.line((x,y,x+random.randrange(1,12),y),fill=tuple(max(0,min(255,c+v)) for c in base),width=1)
    if name in ['brass','steel','pos_body']:
        d.line((4,0,4,256),fill=tuple(min(255,c+25) for c in base),width=2)
        d.line((252,0,252,256),fill=tuple(max(0,c-25) for c in base),width=2)
    save(im,name)

im=ground((256,256),(80,99,43),4);d=ImageDraw.Draw(im)
for r in [111,116,121]:d.ellipse((128-r,128-r,128+r,128+r),outline=(131,143,65),width=1)
d.arc((25,31,228,223),195,256,fill=(186,180,102),width=3);save(im,'tea')

# Small embroidered menu, original labels and blocky POS UI.
im=ground((512,512),(58,79,83),6);d=ImageDraw.Draw(im)
d.rectangle((10,10,502,502),outline=(185,172,125),width=3);d.rectangle((17,17,495,495),outline=(106,126,115),width=1)
waves(d,512,505,(202,196,153),80)
d.rounded_rectangle((165,60,390,302),radius=3,fill=(225,209,164),outline=INK,width=3)
d.rectangle((175,70,380,292),outline=(153,128,79),width=1)
d.text((195,105),'MENU',font=font(33,True),fill=INK);d.line((193,156,362,156),fill=INK,width=2)
d.text((197,177),'THE SUSHI',font=font(16),fill=INK);d.text((205,202),'COUNTER',font=font(17),fill=INK);d.text((217,248),'01 / 2026',font=font(12),fill=INK)
save(im,'menu')
im=ground((512,320),(87,110,85),2);d=ImageDraw.Draw(im)
d.rectangle((12,12,500,308),outline=(178,193,146),width=3)
d.text((30,25),'SUSHI COUNTER',font=font(25),fill=(218,225,176));d.line((30,67,480,67),fill=(170,186,141),width=2)
for i,(name,price) in enumerate([('SALMON x 1','8.00'),('TAMAGO x 1','6.00'),('GREEN TEA','3.00')]):
    y=87+i*39;d.text((30,y),name,font=font(19),fill=(192,210,166));d.text((393,y),price,font=font(19),fill=(207,222,178))
d.line((30,211,480,211),fill=(170,186,141),width=2);d.text((30,230),'TOTAL',font=font(23),fill=(219,225,176));d.text((341,225),'17.00',font=font(32),fill=(224,233,187));d.text((33,282),'READY  >  TAP TO PAY',font=font(12),fill=(175,194,149));save(im,'pos_screen')
im=ground((256,256),(229,218,175),4);d=ImageDraw.Draw(im)
d.rectangle((8,8,248,248),outline=(101,88,60),width=3);d.rectangle((15,15,241,241),outline=(151,134,89),width=1)
d.rectangle((19,20,237,73),fill=(151,65,47));d.text((50,29),'HOUSE',font=font(29,True),fill=CREAM)
d.text((43,91),'SHOYU',font=font(34,True),fill=INK);d.text((32,142),'NATURALLY',font=font(20),fill=INK);d.text((42,170),'BREWED',font=font(22),fill=INK)
for x in range(47,211,5):d.line((x,211,x,236),fill=INK,width=random.choice([1,2,3]))
save(im,'bottle_label')
for kind in ['roe','egg','salmon','tuna']:
    im=ground((128,128),(229,218,179),3);d=ImageDraw.Draw(im);d.rectangle((3,3,124,124),outline=(79,88,65),width=2)
    if kind=='roe':
        for x,y in [(41,40),(79,66),(41,91)]:d.rectangle((x-12,y-12,x+12,y+12),fill=(163,66,42),outline=INK,width=1)
    elif kind=='egg':
        d.rectangle((8,8,120,120),fill=(89,119,85));flower(d,64,62,38)
    elif kind=='salmon':waves(d,128,100,(64,99,113),52);waves(d,128,57,(64,99,113),52)
    else:
        d.ellipse((25,47,89,81),fill=(171,67,51),outline=INK,width=1);d.polygon([(82,64),(108,44),(108,84)],fill=(171,67,51));d.ellipse((31,57,36,62),fill=CREAM)
    save(im,'sign_'+kind)
im=ground((256,256),(51,75,83),6);d=ImageDraw.Draw(im);waves(d,256,261,(185,184,145),64);save(im,'curtain')

# Small tangent normals; broad, quiet roughness avoids soft CGI reflections.
for name,rough,strength in [('glaze',.62,.12),('wood',.83,.20),('cloth',.94,.24),('fish',.66,.09),('rice',.86,.12),('nori',.84,.20),('metal',.52,.08),('plastic',.16,.015)]:
    size=128;normal=Image.new('RGB',(size,size));roughness=Image.new('L',(size,size));np=normal.load();rp=roughness.load()
    for y in range(size):
        for x in range(size):
            v=random.uniform(-1,1);np[x,y]=(int(128+v*strength*22),int(128+math.sin(x*.7+y*.4)*strength*20),254)
            rp[x,y]=int(255*max(.01,min(1,rough+v*.025)))
    save(normal,name+'_normal');roughness.save(OUT/(name+'_roughness.png'))
print('Painted game textures generated: 128–512px, seeded brushwork and wraparound ornament.')

# Character texture generation is isolated so existing prop artwork stays deterministic.
import runpy
runpy.run_path(str(Path(__file__).with_name('chef_textures.py')))
