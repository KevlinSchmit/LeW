"""Static original low-poly sushi chef. Runs inside build_scene.py's helpers."""
cloth=mat('CHEF · indigo woven cotton',(.08,.12,.28),rough=1,texture='chef_cloth')
trousers=mat('CHEF · dark work trousers',(.04,.05,.08),rough=1,texture='chef_trousers')
skin=mat('CHEF · painted skin',(.64,.43,.28),rough=.9,texture='chef_skin')
face=mat('CHEF · painted adult face',(.64,.43,.28),rough=.95,texture='chef_face')
hair=mat('CHEF · brushed dark hair',(.06,.04,.025),rough=1,texture='chef_hair')
headband=mat('CHEF · indigo dotted tenugui',(.8,.8,.7),rough=1,texture='chef_headband')
chefInk=mat('CHEF · black seams',(.006,.005,.004),rough=1)
chef=group('CHEF · static sushi craftsman',(0,9.6,-1.25))
chef['static_character']=True;chef['pose']='relaxed standing; chin at upper frame edge'

def chef_loft(name,rings,material,n=8,face_uv=False):
    vertices=[];uv=[];faces=[];z0=rings[0][0];z1=rings[-1][0]
    for z,rx,ry,cy in rings:
        for j in range(n+1):
            a=j*2*pi/n;x=rx*cos(a);y=cy+ry*sin(a)
            vertices.append((x,y,z))
            uv.append(((x+.78)/1.56,(z-9.4)/1.9) if face_uv else (j/n,(z-z0)/(z1-z0)))
    for i in range(len(rings)-1):
        for j in range(n):
            k=i*(n+1)+j;faces.append((k,k+1,k+n+2,k+n+1))
    faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*(n+1)+j for j in range(n))])
    obj=mesh(name,vertices,faces,material,chef,uv)
    for f in obj.data.polygons:f.use_smooth=False
    return obj

def limb(name,start,end,r0,r1,material,n=8):
    start=Vector(start);end=Vector(end);axis=(end-start).normalized();basis=axis.cross(Vector((0,1,0))).normalized();other=axis.cross(basis)
    v=[];uv=[]
    for i,r in enumerate([r0,r1]):
        for j in range(n+1):
            a=j*2*pi/n;p=(start if i==0 else end)+r*(basis*cos(a)+other*sin(a));v.append(tuple(p));uv.append((j/n,i))
    faces=[(j,j+1,j+n+2,j+n+1) for j in range(n)]+[tuple(reversed(range(n))),tuple(n+1+j for j in range(n))]
    obj=mesh(name,v,faces,material,chef,uv)
    for f in obj.data.polygons:f.use_smooth=False
    return obj

# Full body exists for editing; the seated camera crops at the chin.
for side in [-1,1]:
    x=side*.61
    limb('Chef trouser leg',(x,0,.32),(x,.02,4.65),.36,.48,trousers)
    shoe=box('Chef work shoe',(x,-.28,.19),(.83,1.42,.40),trousers,chef,b=.035)
chef_loft('Chef wrap jacket',[(4.5,1.28,.57,0),(5.1,1.40,.63,0),(6.7,1.67,.69,0),(7.6,1.95,.64,0),(8.05,1.70,.53,0)],cloth)
# Visible V-shaped neck opening, angular overlaid lapels, waist tie and stitching.
plane('Chef neck opening',[(-.58,-.61,7.94),(.58,-.61,7.94),(0,-.72,6.95),(0,-.72,6.95)],skin,chef)
left=[(-1.23,-.66,8.04),(-.55,-.72,8.18),(.57,-.78,5.42),(.24,-.78,5.30)]
right=[(.65,-.73,8.18),(1.24,-.65,8.02),(-.15,-.79,6.70),(-.48,-.79,6.85)]
plane('Chef broad cross collar',list(reversed(left)),cloth,chef)
plane('Chef upper cross collar',list(reversed(right)),cloth,chef)
for points in [[left[0],left[3],left[2]],[right[1],right[2],right[3]],[(-1.30,-.66,4.86),(1.30,-.66,4.86)]]:
    path('Chef drawn tailoring seam',points,.019,chefInk,chef)
box('Chef waist wrap',(0,-.02,4.72),(2.85,1.32,.28),cloth,chef,b=.018)
box('Chef side waist knot',(1.33,-.50,4.70),(.32,.35,.27),cloth,chef,b=.025)
plane('Chef breast pocket',[(-1.35,-.697,7.14),(-.78,-.735,7.14),(-.79,-.74,6.53),(-1.32,-.70,6.53)],cloth,chef)
path('Chef pocket ink',[(-1.35,-.71,7.14),(-1.32,-.72,6.53),(-.79,-.76,6.53),(-.78,-.75,7.14)],.014,chefInk,chef)
for side in [-1,1]:
    limb('Chef broad elbow sleeve',(side*1.63,0,7.65),(side*2.60,-.03,5.85),.71,.66,cloth)
    limb('Chef sleeve cuff',(side*2.53,-.03,6.03),(side*2.64,-.04,5.77),.68,.67,cloth)
    limb('Chef bare forearm',(side*2.64,-.03,5.78),(side*2.61,-.36,4.23),.37,.28,skin)
    hand=sphere('Chef relaxed palm',(side*2.60,-.42,3.95),(.32,.23,.48),skin,chef,seg=8,rings=4)
    for f in hand.data.polygons:f.use_smooth=False
    # Four low-poly fingers, each a tapered eight-sided segment.
    for finger in range(4):
        x=side*(2.37+finger*.14)
        limb('Chef resting finger',(x,-.44,3.90),(x+side*.025,-.48,3.47+abs(finger-1.5)*.06),.085,.065,skin,n=6)
    limb('Chef thumb',(side*2.38,-.43,4.12),(side*2.25,-.65,3.80),.12,.085,skin,n=6)
    path('Chef cuff ink',[(side*2.04,-.26,5.87),(side*2.6,-.71,5.77),(side*3.20,-.20,5.87)],.018,chefInk,chef)
# Adult proportions: bring the shoulders and collar close to the jaw.
bpy.context.view_layer.update()
for obj in list(chef.children):
    if obj.type=='MESH':
        matrix=obj.matrix_local.copy();inverse=matrix.inverted()
        for vertex in obj.data.vertices:
            point=matrix@vertex.co
            if point.z>5:point.z=5+(point.z-5)*1.2833
            vertex.co=inverse@point
    elif obj.type=='CURVE':
        for spline in obj.data.splines:
            for point in spline.points:
                if point.co.z>5:point.co.z=5+(point.co.z-5)*1.2833
# Neck and a modestly faceted adult face, not an oversized cartoon head.
chef_loft('Chef neck',[(8.65,.38,.36,0),(9.65,.43,.40,0)],skin,n=10)
chef_loft('Chef angular face',[(9.4,.35,.36,-.06),(9.58,.52,.49,-.01),(9.95,.65,.58,0),(10.45,.76,.62,.015),(10.92,.70,.57,.025),(11.28,.57,.48,.04)],face,n=16,face_uv=True)
# Small modeled nose and ears; facial detail is predominantly in the painted map.
nose=mesh('Chef nose planes',[(-.10,-.595,10.54),(.10,-.595,10.54),(-.14,-.63,10.13),(.14,-.63,10.13),(0,-.84,10.20)],[(0,2,4),(0,4,1),(1,4,3),(2,3,4)],skin,chef)
for f in nose.data.polygons:f.use_smooth=False
for side in [-1,1]:
    ear=sphere('Chef ear',(side*.74,.015,10.28),(.16,.22,.34),skin,chef,seg=8,rings=4)
    path('Chef ear crease',[(side*.79,-.16,10.44),(side*.82,-.19,10.22),(side*.77,-.15,10.10)],.014,chefInk,chef)
chef_loft('Chef swept dark hair',[(10.95,.72,.59,.04),(11.23,.76,.62,.045),(11.55,.61,.52,.08),(11.68,.20,.23,.11)],hair,n=12)
# White dotted headband follows the forehead; separate tied cloth tails at the side.
chef_loft('Chef dotted headband',[(10.93,.729,.605,.035),(11.15,.75,.615,.04)],headband,n=16)
for side,verts in enumerate([
 [(-.73,-.10,11.06),(-.83,-.26,11.22),(-1.13,-.15,11.52),(-1.04,-.02,11.04)],
 [(-.76,-.09,11.05),(-1.04,-.15,11.04),(-.99,-.16,10.44),(-.78,-.15,10.62)]
]):
    o=plane('Chef tied tenugui tail',verts,headband,chef);solid=o.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.025
    path('Chef headband ink',verts,.012,chefInk,chef,True)
# No rig, animation action, keyframes or motion controller is created.
