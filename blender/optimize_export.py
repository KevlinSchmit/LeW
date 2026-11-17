"""Merge only the web copy by material within each semantic object.
The saved .blend retains every original editable component.
"""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
# Curves must become evaluated meshes for a portable glTF export.
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type in {'MESH','CURVE'}:obj.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
# Keep one mesh for each material in each independent assembly.
for parent in [o for o in bpy.data.objects if o.type=='EMPTY']:
    buckets={}
    for obj in list(parent.children):
        if obj.type!='MESH' or len(obj.data.materials)!=1:continue
        if obj.name.startswith('Belt tile'):continue
        key=obj.data.materials[0].name
        buckets.setdefault(key,[]).append(obj)
    for key,objs in buckets.items():
        if len(objs)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objs:obj.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        bpy.ops.object.join();objs[0].name=parent.name+' · '+key
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public'/'models'/'sushi-bar.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_apply=True,export_yup=True)
print('Web export optimized to',sum(o.type=='MESH' for o in bpy.data.objects),'meshes')
