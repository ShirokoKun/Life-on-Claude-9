"""Blender --background scene.blend --python audit_scene.py -- --output audit.json"""
import argparse
import json
import os
import sys
from pathlib import Path
import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
target = Path(args.output).expanduser().resolve()
if target.exists():
    raise SystemExit('Output already exists; choose a new report path.')
scene = bpy.context.scene
images = []
for image in bpy.data.images:
    if image.source not in {'FILE', 'TILED', 'SEQUENCE', 'MOVIE'}:
        continue
    packed = bool(image.packed_file or image.packed_files)
    raw = image.filepath
    path = bpy.path.abspath(raw, library=image.library)
    # UDIM and sequence existence require per-tile/per-frame inspection.
    exists = None if image.source in {'TILED', 'SEQUENCE'} else os.path.isfile(path)
    images.append({'name': image.name, 'path': raw, 'packed': packed,
                   'exists': exists, 'source': image.source})
report = {
    'blender_version': bpy.app.version_string,
    'scene': scene.name,
    'objects': len(scene.objects),
    'camera': scene.camera.name if scene.camera else None,
    'frames': [scene.frame_start, scene.frame_end],
    'fps': scene.render.fps / scene.render.fps_base,
    'resolution': [scene.render.resolution_x, scene.render.resolution_y],
    'resolution_percent': scene.render.resolution_percentage,
    'engine': scene.render.engine,
    'cycles_samples': scene.cycles.samples,
    'cycles_denoise': scene.cycles.use_denoising,
    'cycles_device': scene.cycles.device,
    'adaptive_sampling': scene.cycles.use_adaptive_sampling,
    'adaptive_threshold': scene.cycles.adaptive_threshold,
    'view_transform': scene.view_settings.view_transform,
    'exposure': scene.view_settings.exposure,
    'view_layers': [{'name': layer.name, 'enabled': layer.use,
                     'cycles_denoise': layer.cycles.use_denoising} for layer in scene.view_layers],
    'images': images,
    'missing_images': [i['name'] for i in images if not i['packed'] and i['exists'] is False],
    'linked_libraries': [{'path': lib.filepath, 'exists': os.path.isfile(bpy.path.abspath(lib.filepath))}
                         for lib in bpy.data.libraries],
    'manual_checks': ['UDIM tiles, image sequences, fonts, simulation caches, compositor output, and rendered appearance'],
}
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, indent=2), encoding='utf-8')
print('Scene audit written:', target)
