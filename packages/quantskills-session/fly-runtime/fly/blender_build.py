"""Trusted Blender builder; the model supplies data, never executable Python."""
import bpy
import json
import math
import random
from pathlib import Path
import sys
from mathutils import Vector

root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
plan=json.loads((root/'plan.json').read_text(encoding='utf-8'));home=json.loads((root/'interactions.json').read_text(encoding='utf-8'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,color):
    def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
    m=bpy.data.materials.new(name);m.diffuse_color=tuple(linear(int(color[i:i+2],16)/255) for i in (1,3,5))+(1,);m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=m.diffuse_color;shader.inputs['Roughness'].default_value=.7
    return m

def cube(name,location,scale,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
    bevel=o.modifiers.new('Soft edges','BEVEL');bevel.width=.08;bevel.segments=3;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o

def ball(name,location,scale,mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=location);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);return o

def cylinder(name,location,radius,depth,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=radius,depth=depth,location=location)
    o=bpy.context.object;o.name=name;o.data.materials.append(mat)
    bevel=o.modifiers.new('Rim softness','BEVEL');bevel.width=min(.025,radius*.15);bevel.segments=3
    o.modifiers.new('Normals','WEIGHTED_NORMAL');return o

floor=material('Sage floor',plan['floor']);accent=material('Warm trim',plan['accent']);dark=material('Midnight green','#25453e');wood=material('Oak','#b79a72')
soil=material('Rich earth','#594c38');moss=material('Soft moss','#839d69');stone=material('Path limestone','#d8d1b7')
cube('Home island',(0,0,-.12),(7,5,.24),floor)
cube('Rear rail',(0,2.5,.15),(7,.08,.3),accent)
cube('Left rail',(-3.5,0,.15),(.08,5,.3),accent)
rng=random.Random(923)
for i in range(65):
    x=rng.uniform(-3.25,3.25);y=rng.uniform(-2.2,2.2)
    if abs(x)<.75 or abs(y)<.35:continue
    ball('Moss cushion',(x,y,.015),(rng.uniform(.07,.16),rng.uniform(.06,.14),.018),moss)
for i in range(9):
    cube('Garden stepping stone',((i%3-1)*.35,-1.0+(i//3)*.65,.012),(.25,.36,.025),stone)
for index,d in enumerate(plan['decorations']):
    x,z,s=d['x'],-d['z'],d['size'];mat=material('Object '+str(index),d['color']);kind=d['kind']
    if kind=='plant':
        cylinder('Planter',(x,z,s*.16),s*.30,s*.32,wood)
        cylinder('Potting soil',(x,z,s*.33),s*.26,s*.018,soil)
        cylinder('Plant stem',(x,z,s*.67),s*.035,s*.70,dark)
        for j in range(7):
            angle=j*2.4
            leaf=ball('Leaf',(x+math.cos(angle)*s*.13,z+math.sin(angle)*s*.13,s*(.5+j*.085)),(s*.12,s*.24,s*.065),mat);leaf.rotation_euler[2]=angle
    elif kind=='table':
        cube('Desk',(x,z,s),(s*.8,s*.7,s*.15),mat)
        for dx,dy in [(-.28,-.25),(.28,.25),(-.28,.25),(.28,-.25)]:cube('Leg',(x+dx*s,z+dy*s,s*.5),(s*.06,s*.06,s),wood)
        cube('Notebook',(x-s*.12,z,s*1.085),(s*.22,s*.26,s*.035),accent)
    elif kind=='lamp':
        cylinder('Lamp base',(x,z,s*.04),s*.18,s*.08,wood)
        cylinder('Stem',(x,z,s*.7),s*.025,s*1.4,wood);ball('Lantern',(x,z,s*1.4),(s*.16,s*.16,s*.20),accent)
    elif kind=='water':
        cylinder('Pond rim',(x,z,.025),s*.4,.05,stone)
        mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.18
        cylinder('Water',(x,z,.052),s*.34,.009,mat)
    elif kind=='bed':
        leaf=ball('Leaf bed',(x,z,s*.1),(s*.4,s*.34,s*.13),mat)
        cube('Leaf vein',(x,z,s*.22),(s*.035,s*.45,s*.015),dark)
        ball('Pillow',(x,z+s*.17,s*.16),(s*.18,s*.1,s*.075),accent)
    elif kind=='fruit':
        cylinder('Fruit plate',(x,z,.025),s*.38,.035,wood)
        for j in range(3):
            ball('Fruit',(x+(j-1)*s*.16,z,s*.15),(s*.13,s*.13,s*.15),mat)
            cube('Fruit stem',(x+(j-1)*s*.16,z,s*.29),(s*.02,s*.02,s*.06),dark)
    else:ball('Stone',(x,z,s*.2),(s*.4,s*.4,s*.25),mat)
for item in home['objects']:
    if not item['id'].startswith('pad_'):continue
    x,y,z=item['position']
    cube(item['id']+'_landing',(x,-z,y-.17),(.24,.24,.035),accent)

bpy.ops.object.light_add(type='AREA',location=(-3,-4,8));bpy.context.object.data.energy=1600;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=8
bpy.ops.object.camera_add(location=(9,-11,10));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=10
scene=bpy.context.scene;scene.camera=camera;scene.world.color=(.2,.25,.22);scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(root/'preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'home.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'home.glb'),export_format='GLB',export_apply=True,export_yup=True)
bpy.ops.render.render(write_still=True)
# Import the generated asset in a clean scene before publication.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'home.glb'))
(root/'validation.json').write_text(json.dumps({'imported_meshes':sum(o.type=='MESH' for o in bpy.context.scene.objects)}))
