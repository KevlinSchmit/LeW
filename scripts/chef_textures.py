"""Original low-resolution painted skin, workwear and cloth for the static chef."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import random, math
random.seed(9187)
OUT=Path(__file__).resolve().parents[1]/'blender'/'textures';OUT.mkdir(exist_ok=True)
def base(size,color):
 im=Image.new('RGB',size);p=im.load()
 for y in range(size[1]):
  for x in range(size[0]):
   n=random.uniform(-5,5)+2*math.sin(x*.13+y*.08)
   p[x,y]=tuple(max(0,min(255,int(v+n))) for v in color)
 return im
def save(im,name):im.save(OUT/('chef_'+name+'.png'))
im=base((512,512),(35,50,105));d=ImageDraw.Draw(im)
# Broad painted folds plus woven grain and worn stitched hems.
for i in range(28):
 x=random.randrange(512);y=random.randrange(512);length=random.randrange(35,140)
 d.polygon([(x,y),(x+random.randrange(-18,19),y+length),(x+18,y+length*.6)],fill=random.choice([(24,33,68),(42,60,117),(31,43,87)]))
 d.line((x+3,y+8,x+12,y+length*.7),fill=(56,73,126),width=2)
for y in [15,26,481,492]:
 d.line((0,y,512,y),fill=(19,25,48),width=3)
 for x in range(3,512,9):d.line((x,y+4,x+4,y+4),fill=(91,103,146),width=1)
for i in range(6000):
 x=random.randrange(512);y=random.randrange(512);d.line((x,y,x+2,y),fill=random.choice([(43,58,109),(30,42,88),(47,59,104)]))
save(im,'cloth')
im=base((256,256),(21,29,48));d=ImageDraw.Draw(im)
for y in range(0,256,23):d.line([(x,y+4*math.sin(x*.03+y)) for x in range(256)],fill=(36,45,66),width=3)
save(im,'trousers')
im=base((256,128),(222,217,192));d=ImageDraw.Draw(im)
for y in [7,119]:d.line((0,y,256,y),fill=(119,125,115),width=2)
for row in range(4):
 for col in range(15):
  x=col*19+(8 if row%2 else 0);y=21+row*27
  d.ellipse((x-2,y-3,x+3,y+3),fill=(30,45,81));d.point((x-1,y-2),fill=(68,81,110))
save(im,'headband')
im=base((256,256),(47,36,29));d=ImageDraw.Draw(im)
for i in range(230):
 x=random.randrange(256);y=random.randrange(256)
 d.line([(x,y),(x+5,y+20),(x+16,y+42)],fill=random.choice([(24,22,21),(65,48,34),(83,59,40),(104,76,49)]),width=random.choice([1,2,3]))
save(im,'hair')
im=base((512,512),(185,136,100));p=im.load()
for y in range(512):
 for x in range(512):
  edge=(abs(x-256)/256)**2
  shade=1-.18*edge-.08*(y/512)
  p[x,y]=tuple(int(c*shade) for c in p[x,y])
d=ImageDraw.Draw(im)
# Adult face: angular brows, recessed almond eyes, painted nose planes and lips.
for cx in [155,357]:
 d.polygon([(cx-55,170),(cx-26,151),(cx+34,156),(cx+57,174),(cx+28,182),(cx-31,180)],fill=(148,100,75))
 d.polygon([(cx-49,187),(cx-23,177),(cx+24,178),(cx+49,188),(cx+20,198),(cx-23,197)],fill=(204,191,155))
 d.ellipse((cx-10,177,cx+10,198),fill=(52,43,34));d.ellipse((cx-5,179,cx+5,197),fill=(24,25,24));d.point((cx-3,181),fill=(221,209,169))
 d.line([(cx-49,187),(cx-22,177),(cx+25,178),(cx+49,188)],fill=(67,47,36),width=4)
 d.line([(cx-44,207),(cx-10,213),(cx+34,207)],fill=(154,105,79),width=2)
 d.polygon([(cx-53,146),(cx-30,133),(cx+28,138),(cx+51,149),(cx+22,147),(cx-26,144)],fill=(48,38,31))
d.polygon([(238,183),(230,276),(213,295),(242,304),(259,299),(267,210)],fill=(158,105,74))
d.polygon([(250,203),(275,274),(294,294),(262,299)],fill=(199,145,103))
d.line([(214,297),(233,302),(246,298)],fill=(91,59,45),width=3);d.line([(270,298),(287,298)],fill=(91,59,45),width=3)
d.polygon([(217,353),(244,344),(258,350),(273,344),(302,355),(270,363),(243,361)],fill=(139,79,62))
d.line([(216,354),(249,356),(274,356),(300,355)],fill=(91,55,46),width=3)
d.line([(236,373),(272,376),(291,371)],fill=(199,142,106),width=4)
d.polygon([(221,410),(258,418),(296,408),(286,442),(245,450)],fill=(191,139,101))
# Short stubble remains painted, not thousands of extra hair meshes.
for i in range(560):
 x=random.randrange(145,376);y=random.randrange(320,487)
 if (x-260)**2/130**2+(y-393)**2/110**2<1 and not (210<x<306 and 335<y<387):
  d.line((x,y,x+1,y+2),fill=(132,100,76),width=1)
save(im,'face')
save(base((256,256),(185,136,100)),'skin')
print('Chef painted textures generated (128–512px).')
