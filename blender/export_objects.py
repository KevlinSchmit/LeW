"""Export individual primary props from the packed native scene, at local origin."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public'/'models'/'objects';OUT.mkdir(parents=True,exist_ok=True)
assets={'TEAPOT':'teapot','TEACUP':'tea-cup','MENU':'menu','BELL':'service-bell','RESUME':'receipt-printer','CHOPSTICKS':'chopsticks','SAUCE DISH':'soy-dish','CONDIMENTS':'condiments','SUSHI_roe':'ikura','SUSHI_egg':'tamagoyaki','SUSHI_salmon':'salmon-nigiri','SUSHI_tuna':'tuna-nigiri'}
for prefix,filename in assets.items():
    root=next(o for o in bpy.data.objects if o.type=='EMPTY' and o.name.startswith(prefix))
    location=root.location.copy();root.location=(0,0,0)
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for o in root.children_recursive:o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(OUT/(filename+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
    root.location=location
print('Exported',len(assets),'standalone prop models')
