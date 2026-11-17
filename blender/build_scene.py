"""Build the sushi atelier as separate, named, editable Blender objects.
Run: blender -b --python blender/build_scene.py
Axes: Z up, -Y toward the seated visitor. Units are intentionally art directed.
"""
import bpy, math, random, os
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi
random.seed(47)
ROOT=Path(__file__).resolve().parents[1]
TEX=ROOT/'blender'/'textures'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials):bpy.data.materials.remove(d)

def mat(name,color,metal=0,rough=.4,texture=None,emission=0,surface=None):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    if texture:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(TEX/(texture+'.png')),check_existing=True);m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    if surface:
        norm=m.node_tree.nodes.new('ShaderNodeTexImage');norm.image=bpy.data.images.load(str(TEX/(surface+'_normal.png')),check_existing=True);norm.image.colorspace_settings.name='Non-Color'
        normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=1.0
        m.node_tree.links.new(norm.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
        rm=m.node_tree.nodes.new('ShaderNodeTexImage');rm.image=bpy.data.images.load(str(TEX/(surface+'_roughness.png')),check_existing=True);rm.image.colorspace_settings.name='Non-Color'
        m.node_tree.links.new(rm.outputs['Color'],bs.inputs['Roughness'])
    if surface in ['glaze','wood','fish']:
        bs.inputs['Coat Weight'].default_value=.08;bs.inputs['Coat Roughness'].default_value=.18
    if emission:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    return m
wood=mat('Honey oak · fine grain',(.48,.23,.08),rough=.29,texture='wood',surface='wood')
darkwood=mat('Smoked walnut',(.038,.013,.004),rough=.82,texture='darkwood')
edgewood=mat('End-grain & bamboo',(.35,.155,.045),rough=.72,texture='bamboo')
gold=mat('Warm polished brass',(.73,.43,.12),metal=.62,rough=.42,texture='brass',surface='metal')
steel=mat('Brushed champagne steel',(.39,.33,.26),metal=.45,rough=.56,texture='steel',surface='metal')
black=mat('Blackened iron',(.025,.028,.025),metal=.55,rough=.32)
cream=mat('Ivory glazed ceramic',(.79,.67,.46),rough=.65,texture='ceramic',surface='glaze')
olive=mat('Celadon glaze',(.43,.53,.32),rough=.62,surface='glaze')
floral=mat('Hand-painted celadon · sakura',(.38,.43,.19),rough=.25,texture='blossom',surface='glaze')
lidPaint=mat('Painted celadon lid · floral medallion',(.43,.53,.32),rough=.65,texture='tea_lid',surface='glaze')
red=mat('Vermilion lacquer',(.57,.035,.019),rough=.24,surface='glaze')
navy=mat('Indigo lacquer',(.10,.16,.27),rough=.28,surface='glaze')
green=mat('Olive lacquer',(.35,.38,.075),rough=.25,surface='glaze')
yellow=mat('Mustard yellow lacquer',(.64,.45,.12),rough=.8,surface='glaze')
rice=mat('Pearl rice',(.78,.71,.56),rough=.82,texture='rice',surface='rice')
nori=mat('Nori seaweed',(.032,.047,.025),rough=.47,texture='nori',surface='nori')
omelet=mat('Tamagoyaki · golden egg',(.97,.63,.045),rough=.33,texture='egg',surface='rice')
roe=mat('Ikura · orange pearl',(.98,.235,.008),rough=.42,texture='roe')
bs=roe.node_tree.nodes.get('Principled BSDF');bs.inputs['Subsurface Weight'].default_value=.12;bs.inputs['Coat Weight'].default_value=.4
salmon=mat('Salmon · cut striations',(.94,.35,.10),rough=.26,texture='salmon',surface='fish')
tuna=mat('Tuna · cut striations',(.75,.07,.05),rough=.26,texture='tuna',surface='fish')
glass=mat('GLASS · cloche',(.99,.98,.96),rough=.035,surface='plastic')
bs=glass.node_tree.nodes.get('Principled BSDF');bs.inputs['Transmission Weight'].default_value=1;bs.inputs['IOR'].default_value=1.47
ink=mat('Ink · selective hand-drawn contours',(.065,.073,.049),rough=1)
highlight=mat('PET · painted highlight',(.86,.87,.73),rough=.75,emission=.12)
highlight.diffuse_color=(.86,.87,.73,.60)
highlight.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.60
tea=mat('Fresh green tea',(.07,.13,.008),rough=.4,texture='tea')
soy=mat('Dark soy sauce',(.035,.009,.003),rough=.17)
pink=mat('Pickled ginger',(.74,.43,.31),rough=.8)
menuMat=mat('Woven indigo menu',(.10,.12,.20),rough=.72,texture='menu',surface='cloth')
paper=mat('Warm cotton paper',(.91,.79,.61),rough=.8)
curtain=mat('Indigo noren fabric',(.07,.1,.19),rough=.9,texture='curtain')
blueglass=mat('Night beyond the shoji',(.026,.058,.09),rough=.5,emission=.18)
plaster=mat('Warm lime plaster',(.068,.032,.012),rough=.9,texture='plaster')

dishSide=mat('Porcelain · cut side faces',(.46,.43,.35),rough=.95)
dishRim=mat('Porcelain · flat chamfer',(.74,.70,.57),rough=.95)

current=None

def group(name,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;return o

def finish(o,name,material,parent=None,smooth=True):
    o.name=name
    if material:o.data.materials.append(material)
    if parent:o.parent=parent
    if smooth and o.type=='MESH':
        for f in o.data.polygons:f.use_smooth=True
    return o

def bevel(o,w=.06,seg=3):
    mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=w;mod.segments=min(seg,2)
    mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def box(name,loc,scale,material,parent=None,b=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,material,parent,False)
    if b:bevel(o,b)
    return o

def sphere(name,loc,scale,material,parent=None,seg=16,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=loc);o=bpy.context.object;o.scale=scale;return finish(o,name,material,parent)

def cylinder(name,loc,radius,depth,material,parent=None,vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc);o=bpy.context.object;finish(o,name,material,parent);bevel(o,.025,2);return o

def torus(name,loc,major,minor,material,parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=32,minor_segments=6,location=loc);return finish(bpy.context.object,name,material,parent)

def mesh(name,verts,faces,material,parent=None,uv=None):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,name,material,parent)
    if uv:
        layer=me.uv_layers.new(name='Painted UV')
        for face in me.polygons:
            for li,vi in zip(face.loop_indices,face.vertices):layer.data[li].uv=uv[vi]
    return o

def lathe(name,profile,material,parent=None,loc=(0,0,0),n=32):
    verts=[];uv=[]
    zmin=min(z for r,z in profile);zmax=max(z for r,z in profile)
    for i,(r,z) in enumerate(profile):
        for j in range(n+1):
            a=2*pi*j/n;verts.append((loc[0]+r*cos(a),loc[1]+r*sin(a),loc[2]+z));uv.append((j/n,(z-zmin)/(zmax-zmin or 1)))
    faces=[]
    for i in range(len(profile)-1):
        for j in range(n):a=i*(n+1)+j;faces.append((a,a+1,a+n+2,a+n+1))
    return mesh(name,verts,faces,material,parent,uv)

def path(name,points,radius,material,parent=None,cyclic=False):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=4;cu.bevel_depth=radius;cu.bevel_resolution=1
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    sp.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    if parent:o.parent=parent
    return o

def plane(name,verts,material,parent=None,uv=None):return mesh(name,verts,[(0,1,2,3)],material,parent,uv or [(0,0),(1,0),(1,1),(0,1)])

def angular_dish(name,width,depth,height,parent,loc=(0,0,0)):
    """Closed octagonal tray: planar cut corners, flat rim and sloping basin."""
    def ring(w,d,z):
        c=min(w,d)*.15
        return [(loc[0]+x,loc[1]+y,loc[2]+z) for x,y in [(-w+c,-d),(w-c,-d),(w,-d+c),(w,d-c),(w-c,d),(-w+c,d),(-w,d-c),(-w,-d+c)]]
    w=width/2;d=depth/2
    rings=[ring(w*.84,d*.84,0),ring(w,d,height*.64),ring(w,d,height),ring(w-.07,d-.07,height),ring(w-.17,d-.17,height*.32)]
    vertices=[v for r in rings for v in r];faces=[tuple(reversed(range(8)))]
    for j in range(4):
        for i in range(8):faces.append((j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i))
    faces.append(tuple(range(32,40)))
    o=mesh(name,vertices,faces,cream,parent)
    o.data.materials.append(dishSide);o.data.materials.append(dishRim)
    for f in o.data.polygons:
        f.use_smooth=False
        f.material_index=1 if f.index<=16 else 2 if f.index<=24 else 0
    # Authored ink seams expose the manufactured planes even under dim light.
    path(name+' · outer ink edge',rings[2],.009,ink,parent,True)
    path(name+' · basin ink edge',rings[4],.007,ink,parent,True)
    return o

def join(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=name;return objects[0]

# Counter: individual joined planks, rounded front apron, and seams.
room=group('RESTAURANT · architecture')
for i in range(14):
    box('Oak counter plank %02d'%i,(0,-12.60+i*1.05,-.18),(25,1.045,.35),wood,room,b=.055)
box('Counter front edge',(0,-13.23,-.43),(25,.17,.45),edgewood,room,b=.08)
# Conveyor is a shallow racetrack. Front and rear lanes are independent meshes.
conveyor=group('CONVEYOR · belt and rail')
box('Conveyor brushed front',(0,1.08,.82),(25,.28,1.62),steel,conveyor,b=.09)
box('Conveyor black shadow line',(0,.91,1.53),(25,.06,.075),black,conveyor,b=.01)
box('Conveyor lower oak trim',(0,.88,.08),(25,.18,.18),darkwood,conveyor,b=.025)
box('Conveyor upper rim',(0,.95,1.73),(25,.18,.11),steel,conveyor,b=.025)
box('Conveyor bed',(0,2.12,1.60),(25,2.45,.22),black,conveyor,b=.1)
beltmat=mat('Warm conveyor tiles',(.38,.34,.27),metal=.15,rough=.72,texture='belt')
for i in range(50):box('Belt tile %02d'%i,(-12.25+i*.50,2.05,1.76),(.487,2.10,.05),beltmat,conveyor,b=.08)
box('Conveyor rear rim',(0,3.18,1.75),(25,.13,.14),steel,conveyor,b=.02)
# Back service counter, walls, and timber framing. No people.
box('Dark timber ceiling',(0,5,14.0),(55,36,.40),darkwood,room)
for x in [-19,19]:box('Restaurant side wall',(x,7,3),(1,30,14),plaster,room)
box('Back service counter',(0,7,1.18),(25,2.0,.28),wood,room,b=.08)
box('Back service frontage',(0,7,0),(25,1.7,2.2),darkwood,room,b=.03)
box('Rear plaster wall',(0,12,4.5),(55,.3,14),plaster,room)
for x in [-12,-8,-4,0,4,8,12]:
    box('Timber pillar',(x,11.72,4.2),(.32,.42,9),darkwood,room,b=.03)
    box('Ceiling joist',(x,4,13.2),(.27,16,.35),darkwood,room,b=.03)
for z in [2.2,6.5,8.4]:box('Horizontal timber',(0,11.60,z),(27,.4,.32),darkwood,room)
# Shoji grid with blue night behind it.
for x in [-9,-5,-1,3]:
    box('Shoji evening blue',(x,11.53,4.4),(3.45,.08,3.55),blueglass,room,b=0)
    for j in range(5):box('Shoji fine vertical',(x-1.7+j*.85,11.38,4.4),(.075,.10,3.6),edgewood,room,b=.01)
    for j in range(5):box('Shoji fine horizontal',(x,11.35,2.65+j*.88),(3.5,.1,.075),edgewood,room,b=.01)
# Noren on right side.
for i in range(4):
    x=7.1+i*1.3
    plane('Noren · separate fabric panel',[(x-.61,10.94,4.8),(x+.61,10.94,4.8),(x+.61,10.94,7.3),(x-.61,10.94,7.3)],curtain,room)
    box('Noren top tab',(x,10.94,7.38),(.14,.12,.34),darkwood,room,b=.03)
box('Noren bamboo rail',(9,11.02,7.45),(6,.13,.13),edgewood,room)
# The background intentionally has no light fixtures, shades or hanging stems.
# Soft background details: dishes and stools.
for x in [-8,-3,2,6,10]:
    cylinder('Distant stool seat',(x,5.5,-.20),.62,.18,darkwood,room)
    for dx in [-.4,.4]:box('Distant stool leg',(x+dx,5.5,-.8),(.09,.09,1.2),black,room)
    cylinder('Back counter saucer',(x,6.7,1.37),.63,.08,cream,room)
    sphere('Distant salmon',(x,6.7,1.55),(.42,.23,.13),salmon,room)
    cylinder('Distant tea cup',(x+1,7.2,1.58),.22,.5,cream,room)

# Stacks at left, each dish is its own mesh.
stack=group('DISHES · two lacquer stacks',(0,4.2,.75))
box('Plate stack rear service ledge',(-10.2,6.0,2.39),(5.5,4.3,.24),wood,room,b=.08)
plate_profile=[(0,0),(.68,0),(.78,.06),(.95,.15),(1.0,.23),(1.0,.29),(.95,.31),(.86,.22),(.70,.14),(0,.14)]
for col,(x,y,count,r) in enumerate([(-10.3,1.0,15,1.6),(-8.6,3.0,10,1.5)]):
    column=group('Plate column %d'%col,(x,y,1.8 if col==0 else 2.15));column.parent=stack
    for i in range(count):
        m=[cream,navy,yellow,red,green][i%5]
        o=lathe('Stack %d · dish %02d'%(col,i),[(a*r,b*.65) for a,b in plate_profile],m,column,loc=(0,0,i*.25))

# Tea pot: hollow, wheel-thrown body, separate lid, spout, handle and wicker wraps.
g=group('TEAPOT · sakura celadon',(-7.7,-2.55,.16))
lathe('Teapot foot',[(0,0),(.75,0),(.85,.10),(.85,.20),(.7,.25),(0,.25)],olive,g)
lathe('Teapot hand-painted body',[(.72,.15),(1.03,.22),(1.28,.45),(1.34,.85),(1.24,1.35),(.99,1.65),(.81,1.73),(.75,1.67)],floral,g,n=32)
lid=lathe('Teapot lid',[(0,1.80),(.5,1.79),(.83,1.67),(.88,1.68),(.87,1.76),(.6,1.9),(.25,1.95),(0,1.95)],lidPaint,g,n=32)
# Radial UVs keep the illustrated crown undistorted.
for polygon in lid.data.polygons:
    for li,vi in zip(polygon.loop_indices,polygon.vertices):
        v=lid.data.vertices[vi].co;lid.data.uv_layers.active.data[li].uv=(v.x/1.8+.5,v.y/1.8+.5)
torus('Teapot lid rim',(0,0,1.76),.85,.035,cream,g)
cylinder('Teapot lid knob',(0,0,2.03),.20,.20,olive,g)
sphere('Teapot lid knob cap',(0,0,2.14),(.25,.25,.08),olive,g)
torus('Teapot ink foot seam',(0,0,.21),.84,.017,ink,g)
torus('Teapot ink lid contour',(0,0,1.72),.87,.015,ink,g)
# Tapered upturned spout using cross-section rings.
vs=[];faces=[]
for i in range(13):
    t=i/12;cx=1.0+t*.90;cz=.55+t*1.12;r=.39*(1-t)+.20*t
    for j in range(33):
        a=2*pi*j/32;vs.append((cx+r*.63*cos(a),r*sin(a),cz-r*.60*cos(a)))
for i in range(12):
    for j in range(32):a=i*33+j;faces.append((a,a+1,a+34,a+33))
sp=mesh('Teapot hollow pouring spout',vs,faces,olive,g);so=sp.modifiers.new('Ceramic wall','SOLIDIFY');so.thickness=.05
# Handle arches in XZ plane, in front of its attachments.
pts=[(-1.22*cos(t),.06,1.43+1.75*sin(t)) for t in [i*pi/80 for i in range(81)]]
path('Teapot bamboo carrying arch',pts,.12,edgewood,g)
for i in range(26):
    t=(i+.5)*pi/26;x=-1.22*cos(t);z=1.43+1.75*sin(t)
    tangent=Vector((1.22*sin(t),0,1.75*cos(t))).normalized();basis=Vector((0,1,0));other=tangent.cross(basis)
    coils=[]
    for j in range(17):
        a=j*pi*2/16;p=Vector((x,.06,z))+.134*(basis*cos(a)+other*sin(a));coils.append(tuple(p))
    path('Wicker handle binding %02d'%i,coils,.027,edgewood,g,True)
for x in [-1.22,1.22]:
    o=torus('Handle attachment',(x,0,1.35),.18,.055,gold,g);o.rotation_euler[0]=pi/2
# Teapot coaster under the group.
cylinder('Teapot wooden coaster',(-7.7,-2.55,.10),1.64,.20,edgewood)
torus('Teapot coaster lip',(-7.7,-2.55,.21),1.51,.055,darkwood)

# Tea cup, hollow with visible interior and drink surface.
g=group('TEACUP · sakura celadon',(-4.9,-4.0,.12))
lathe('Tea cup painted exterior',[(.48,.05),(.62,.09),(.72,.27),(.78,1.27),(.80,1.40),(.75,1.46),(.69,1.40),(.66,.37),(.48,.26)],floral,g,n=32)
torus('Tea cup cream lip',(0,0,1.42),.746,.055,cream,g)
cylinder('Green tea surface',(0,0,1.24),.688,.018,tea,g)
torus('Tea meniscus',(0,0,1.25),.668,.012,olive,g)
cylinder('Tea cup foot',(0,0,.10),.50,.16,olive,g)
torus('Tea cup drawn rim',(0,0,1.423),.79,.012,ink,g)
cylinder('Tea cup wooden coaster',(-4.9,-4.0,.09),.95,.18,edgewood)
torus('Tea coaster lip',(-4.9,-4,.18),.84,.026,darkwood)
# Sauce dish left of the book.
g=group('SAUCE DISH · porcelain',(-3.95,-1.35,.09))
angular_dish('Soy dish · cut porcelain tray',1.42,1.10,.33,g)
# Flat clipped-corner liquid surface inside the distinctly faceted basin.
v=[(-.44,-.34,.145),(.44,-.34,.145),(.53,-.25,.145),(.53,.25,.145),(.44,.34,.145),(-.44,.34,.145),(-.53,.25,.145),(-.53,-.25,.145)]
mesh('Soy sauce pool',v,[tuple(range(8))],soy,g)

# Indigo bound menu with true paper block, string loops and textured top cover.
g=group('MENU · indigo portfolio book',(-.5,-3.1,.10))
g.rotation_euler[2]=-.14
g.scale=(.68,.68,.68)
box('Menu lower fabric cover',(0,0,.05),(4.65,3.65,.13),navy,g,b=.075)
box('Menu cotton paper block',(0,0,.19),(4.45,3.43,.18),paper,g,b=.025)
for z in [.13,.17,.21,.25]:box('Visible paper page edge',(0,-1.72,z),(4.40,.015,.008),cream,g,b=0)
box('Menu upper cloth cover',(0,0,.33),(4.65,3.65,.13),navy,g,b=.06)
# UV top: width x, length y; texture v=1 at back.
plane('Menu painted cover',[(-2.29,-1.79,.402),(2.29,-1.79,.402),(2.29,1.79,.402),(-2.29,1.79,.402)],menuMat,g)
for i in range(5):
    y=-1.5+i*.73
    path('Menu hand-stitched cord',[(-2.10,y,.44),(-2.23,y+.04,.48),(-2.38,y+.02,.4),(-2.45,y,0),(-2.35,y-.05,-.02),(-2.09,y-.04,.02)],.034,edgewood,g)
    sphere('Menu binding knot',(-2.11,y,.45),(.067,.061,.05),edgewood,g)
# Chopsticks on a blue striped ceramic rest.
g=group('CHOPSTICKS · bamboo and porcelain',(-.1,-5.65,.12))
angular_dish('Chopstick dish · cut porcelain',.82,1.16,.20,g,loc=(-2.10,0,0))
for x in [-2.23,-2.11]:box('Rest indigo inlay',(x,0,.069),(.045,.78,.008),navy,g,b=0)
for y in [-.14,.13]:
    # subtly tapered rectangular sticks, pointing toward left
    verts=[(-2.8,y-.038,.24),(-2.8,y+.038,.24),(-2.8,y+.038,.31),(-2.8,y-.038,.31),(3.0,y-.075,.22),(3.0,y+.075,.22),(3.0,y+.075,.37),(3.0,y-.075,.37)]
    ob=mesh('Separate tapered bamboo chopstick',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(1,2,6,5),(0,4,7,3)],edgewood,g);bevel(ob,.018)

# Brass service bell: foot, raised dome and independent push button.
g=group('BELL · brass service bell',(3.7,-2.95,.09))
cylinder('Bell walnut plinth',(0,0,.13),.96,.26,darkwood,g)
cylinder('Bell brass base',(0,0,.31),.82,.13,gold,g)
lathe('Bell polished brass dome',[(.77,.36),(.79,.43),(.75,.63),(.62,.86),(.39,1.03),(.14,1.10),(0,1.10)],gold,g,n=32)
torus('Bell lip',(0,0,.41),.78,.03,gold,g)
cylinder('Bell button stem',(0,0,1.20),.055,.23,gold,g,vertices=32)
cylinder('Bell button cap',(0,0,1.33),.14,.07,gold,g,vertices=24)

# Compact counter POS: cream wedge body, tilted display, tactile keys; no paper.
posBody=mat('POS · painted ivory ABS',(.8,.76,.63),rough=.7,texture='pos_body')
posScreen=mat('POS · olive LCD',(.2,.3,.22),rough=.82,texture='pos_screen',emission=.12)
labelMat=mat('Glass bottle · painted label',(.9,.8,.6),rough=.9,texture='bottle_label')
g=group('POS · counter terminal',(6.65,-2.9,.09))
g.rotation_euler[2]=-.13
box('POS charcoal rubber foot',(0,0,.12),(2.65,2.3,.22),black,g,b=.08)
# Wedge sides slope upward toward the back.
v=[(-1.32,-1.12,.22),(1.32,-1.12,.22),(1.32,1.12,.22),(-1.32,1.12,.22),(-1.32,-1.12,.61),(1.32,-1.12,.61),(1.32,1.12,1.08),(-1.32,1.12,1.08)]
o=mesh('POS sculpted wedge case',v,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],posBody,g);bevel(o,.10,2)
box('POS front dark seam',(0,-1.135,.31),(2.42,.025,.055),black,g,b=.01)
# Screen face is tilted toward the seated visitor.
display=group('POS display');display.parent=g;display.location=(0,.46,1.35);display.rotation_euler[0]=math.radians(25)
box('POS screen ivory surround',(0,0,0),(2.43,.24,1.63),posBody,display,b=.10)
box('POS inset charcoal bezel',(0,-.142,.02),(2.16,.045,1.34),black,display,b=.06)
plane('POS illustrated LCD',[(-.97,-.171,-.51),(.97,-.171,-.51),(.97,-.171,.57),(-.97,-.171,.57)],posScreen,display)
# Keypad sits on the sloped front deck.
for row in range(3):
    for col in range(3):
        x=-.59+col*.40;y=-.90+row*.32;z=.69+row*.065
        box('POS tactile key %d %d'%(row,col),(x,y,z),(.31,.24,.09),cream,g,b=.025)
        box('POS key ink mark',(x,y-.015,z+.05),(.065,.032,.005),black,g,b=0)
for row,m in enumerate([red,olive]):box('POS cancel confirm key',(.89,-.85+row*.42,.72+row*.08),(.34,.32,.10),m,g,b=.025)
box('POS side card slot',(1.335,-.12,.68),(.025,.82,.085),black,g,b=.01)
for i in range(4):box('POS side vent',(1.335,.49+i*.12,.48),(.025,.05,.17),black,g,b=.006)
box('POS power indicator',(-1.02,-1.14,.48),(.09,.018,.045),olive,g,b=.005)
# Glass is separate from the molded PET covers, with a cool green wall tint.
bottleGlass=glass.copy();bottleGlass.name='BOTTLE GLASS · green edged soda glass'
# Dark soy dispenser and ginger jar.
g=group('CONDIMENTS · soy and pickled ginger',(9.2,-1.9,.12))
lathe('Soy bottle glass',[(0,0),(.47,0),(.52,.12),(.5,.72),(.30,1.3),(.26,1.9),(.29,1.96)],bottleGlass,g)
lathe('Soy inside bottle',[(0,.03),(.45,.03),(.46,.7),(.29,1.2),(0,1.2)],soy,g)
lathe('Soy red cap',[(0,1.88),(.39,1.88),(.4,2.32),(.49,2.34),(.49,2.47),(0,2.47)],red,g)
lathe('Ginger glass jar',[(0,0),(.60,0),(.64,.10),(.64,1.24),(.60,1.30)],bottleGlass,g,loc=(1.1,-.40,0))
cylinder('Ginger wooden tray',(1.1,-.40,.06),.72,.12,edgewood,g)
for i in range(55):
    a=random.uniform(0,pi*2);r=random.uniform(0,.48);z=random.uniform(.18,.92)
    o=sphere('Individual ginger curl',(1.1+r*cos(a),-.40+r*sin(a),z),(.16,.10,.13),pink,g,seg=8,rings=6);o.rotation_euler=(random.random()*2,random.random()*2,random.random()*2)
lathe('Jar glass lid',[(0,1.32),(.67,1.32),(.69,1.37),(.65,1.42),(0,1.43)],bottleGlass,g,loc=(1.1,-.40,0))
sphere('Jar lid knob',(1.1,-.40,1.51),(.14,.14,.12),steel,g)

# Paper labels and dark glass edge rings give each vessel a readable material.
plane('Soy bottle label',[(-.37,-.475,.36),(.37,-.475,.36),(.37,-.475,.97),(-.37,-.475,.97)],labelMat,g)
plane('Ginger jar label',[(.64,-1.04,.29),(1.56,-1.04,.29),(1.56,-1.04,.75),(.64,-1.04,.75)],labelMat,g)
for z in [.10,1.26]:torus('Ginger glass heavy edge',(1.1,-.40,z),.62,.024,bottleGlass,g)
plane('Soy bottle hard glass glint',[(-.34,-.39,.35),(-.30,-.42,.35),(-.19,-.27,1.48),(-.23,-.25,1.48)],highlight,g)
plane('Ginger jar hard glass glint',[(.61,-.82,.21),(.65,-.86,.21),(.65,-.86,1.12),(.61,-.82,1.12)],highlight,g)

# Four named traveling plate assemblies. Local coordinates allow independent animation.
for idx,(kind,x,pm) in enumerate([('roe',-6.55,red),('egg',-2.18,cream),('salmon',2.18,navy),('tuna',6.55,yellow)]):
    g=group('SUSHI_'+kind,(x,2.05,1.79))
    lathe(kind+' · lacquer plate',[(0,0),(.75,0),(1.45,.07),(1.88,.20),(1.92,.26),(1.89,.32),(1.76,.29),(1.54,.22),(0,.21)],pm,g,n=32)
    torus(kind+' · plate rim',(0,0,.28),1.85,.035,pm,g)
    for r in [1.42,1.52]:torus(kind+' · inset glaze line',(0,0,.24),r,.012,cream if kind!='egg' else olive,g)
    # glass bell jar is a separate mesh, never part of the food
    control=[(1.79,.33),(1.78,.55),(1.73,1.02),(1.61,1.52),(1.39,1.90),(1.02,2.12),(.53,2.21),(0,2.23)]
    profile=[]
    for k in range(len(control)-1):
        p0=Vector(control[max(0,k-1)]);p1=Vector(control[k]);p2=Vector(control[k+1]);p3=Vector(control[min(len(control)-1,k+2)])
        for sub in range(2):
            t=sub/2
            v=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
            profile.append((max(0,v.x),v.y))
    profile.append(control[-1])
    cloche=lathe(kind+' · GLASS cloche',profile,glass,g,n=40)
    shell=cloche.modifiers.new('Thin molded plastic wall','SOLIDIFY');shell.thickness=.022;shell.offset=-1
    lathe(kind+' · GLASS molded foot',[(1.79,.30),(1.83,.30),(1.84,.32),(1.83,.36),(1.79,.36)],glass,g,n=40)
    torus(kind+' · glass lower rolled rim',(0,0,.32),1.77,.025,glass,g)
    # Angular painted strokes on opposite sides of the PET cover.
    for a,top in [(-2.25,8),(-.92,6)]:
        vertices=[]
        for k in range(2,top+1):
            r,z=profile[k];width=.014+.014*sin((k-1)/(top-1)*pi)
            for theta in [a-width,a+width]:vertices.append((r*cos(theta),r*sin(theta),z+.012))
        mesh(kind+' · PET hard highlight',vertices,[(i,i+1,i+3,i+2) for i in range(0,len(vertices)-2,2)],highlight,g)
    torus(kind+' · ink plate edge',(0,0,.225),1.91,.014,ink,g)
    cylinder(kind+' · sign clip',(0,.10,2.31),.095,.20,steel,g,vertices=24)
    # sign: a small ceramic rounded square with original painted art.
    sg=group(kind+' · ceramic identification sign');sg.parent=g;sg.location=(0,.1,2.72);sg.rotation_euler=(math.radians(-10),math.radians(-9 if idx%2==0 else 8),0)
    box(kind+' · sign porcelain',(0,0,0),(.78,.10,.72),cream,sg,b=.055)
    sm=mat('Painted sign · '+kind,(1,1,1),rough=.45,texture='sign_'+kind)
    plane(kind+' · painted sign face',[(-.36,-.057,-.33),(.36,-.057,-.33),(.36,-.057,.33),(-.36,-.057,.33)],sm,sg)
    if kind=='roe':
        for ix in [-.48,.47]:
            # Each gunkan has a rice base, wavy dark seaweed collar and translucent roe.
            sphere('Gunkan rice base',(ix,0,.45),(.44,.44,.22),rice,g)
            wrap=lathe('Gunkan nori wrap',[(.48,.25),(.50,.40),(.50,.86),(.48,.90),(.45,.87),(.46,.40)],nori,g,loc=(ix,0,0),n=32)
            for vertex in wrap.data.vertices:
                a=math.atan2(vertex.co.y,vertex.co.x-ix);wave=.012*sin(a*13)+.008*cos(a*23+vertex.co.z*8)
                vertex.co.x+=cos(a)*wave;vertex.co.y+=sin(a)*wave;vertex.co.z+=.010*sin(a*9)
            for j in range(34):
                a=random.random()*2*pi;r=.40*math.sqrt(random.random());z=.88+.16*(1-r/.5)+random.uniform(-.03,.06)
                sphere('Ikura individual roe',(ix+r*cos(a),r*sin(a),z),(.09,.09,.09),roe,g,seg=10,rings=6)
    else:
        sphere(kind+' · rice body',(0,0,.50),(.98,.53,.30),rice,g,seg=20,rings=10)
        grains=[]
        for j in range(48):
            a=random.uniform(0,2*pi);v=random.uniform(-.85,.85);fac=math.sqrt(1-v*v)
            xx=.98*fac*cos(a);yy=.53*fac*sin(a);zz=.50+.29*v
            o=sphere('Rice grain',(xx,yy,zz),(.105+random.uniform(-.012,.012),.051,.061),rice,g,seg=8,rings=6);o.rotation_euler=(random.uniform(-.5,.5),random.uniform(-.5,.5),random.uniform(0,pi));grains.append(o)
        join(grains,kind+' · sculpted individual rice grains')
        if kind=='egg':
            ob=box('Tamagoyaki folded egg',(0,0,.99),(2.15,1.03,.38),omelet,g,b=.07);ob.rotation_euler[2]=-.07
            # Nori belt follows the top and both visible sides of the rice.
            path('Tamagoyaki nori belt left',[(-.05,-.52,.35),(-.05,-.59,.78),(-.05,-.56,1.17),(-.05,.54,1.17),(-.05,.57,.70),(-.05,.48,.32)],.01,nori,g)
            verts=[(-.18,-.59,.32),(.18,-.59,.32),(-.18,-.59,1.20),(.18,-.59,1.20),(-.18,.56,1.20),(.18,.56,1.20),(-.18,.56,.32),(.18,.56,.32)]
            mesh('Tamagoyaki wide seaweed ribbon',verts,[(0,1,3,2),(2,3,5,4),(4,5,7,6)],nori,g)
        else:
            vs=[];uv=[];faces=[]
            for i in range(13):
                u=i/12;x=(u-.5)*2.52
                for j in range(7):
                    v=j/6;y=(v-.5)*1.22
                    z=.65+.47*max(0,cos(x/1.38*pi/2))+.085*cos(y/.65*pi/2)+.01*sin(x*9+y*4)
                    vs.append((x,y,z));uv.append((u,v))
            for i in range(12):
                for j in range(6):a=i*7+j;faces.append((a,a+7,a+8,a+1))
            o=mesh(kind+' · curved fish fillet',vs,faces,salmon if kind=='salmon' else tuna,g,uv)
            so=o.modifiers.new('Thick hand-cut fish','SOLIDIFY');so.thickness=.19;bevel(o,.045,4)

# Camera for the editable native scene, matching Three.js startup view.
bpy.ops.object.camera_add(location=(0,-17.2,8.0));cam=bpy.context.object;cam.name='CAMERA · seated at the sushi bar';direction=Vector((0,1.0,2.25))-cam.location;cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.lens=30;bpy.context.scene.camera=cam
# Game-style native rig: firm sun shadow, quiet ambient world, no softbox studio.
bpy.ops.object.light_add(type='SUN',location=(-9,-6,7));o=bpy.context.object;o.name='LIGHT · directional game key';o.data.energy=3.2;o.data.angle=math.radians(2);o.data.color=(1,.60,.29);o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(8,-2,7));o=bpy.context.object;o.name='LIGHT · quiet cool fill';o.data.energy=70;o.data.size=3;o.data.color=(.80,.87,.84);o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
# The only ceiling light is a rendering source, without a visible fixture.
bpy.ops.object.light_add(type='SPOT',location=(0,.65,12.75));o=bpy.context.object;o.name='LIGHT · central warm yellow top light';o.data.energy=1470;o.data.spot_size=.94;o.data.spot_blend=.70;o.data.shadow_soft_size=.03;o.data.color=(1,.332,.032);o.rotation_euler=(Vector((0,.15,.2))-o.location).to_track_quat('-Z','Y').to_euler()
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.19,.15,.12,1);world.node_tree.nodes['Background'].inputs[1].default_value=.2
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.view_settings.view_transform='Standard';scene.render.resolution_x=1680;scene.render.resolution_y=960;scene.render.resolution_percentage=100
# Native source packs all textures; web export omits cameras and studio lights.
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'sushi-bar.blend'))
exec(compile((ROOT/'blender'/'optimize_export.py').read_text(),str(ROOT/'blender'/'optimize_export.py'),'exec'))
print('Built',len(bpy.data.objects),'independent Blender objects')
