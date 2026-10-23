"""Independent third-party parser validation of actual application exports.
Install tests/mesh-validation-requirements.txt into tmp/mesh-validator first.
Generate fixtures with STUDIO_EXPORT_FIXTURES=1 node tests/assembly.cjs.
"""
import sys,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'tmp/mesh-validator'))
import trimesh,numpy as np
expected=json.loads((root/'tmp/manufacturing/expected.json').read_text())
for extension in ['stl','obj']:
    mesh=trimesh.load(root/f'tmp/manufacturing/solid.{extension}',force='mesh',process=True)
    assert mesh.is_watertight,extension+' has boundary/nonmanifold edges'
    assert mesh.is_winding_consistent,extension+' has inconsistent face winding'
    assert mesh.is_volume,extension+' does not represent an outward closed volume'
    assert abs(mesh.volume-expected['volumeMm3'])<max(.1,expected['volumeMm3']*1e-5)
    assert np.allclose(mesh.bounds,expected['bounds'],atol=1e-4)
    assert np.isfinite(mesh.vertices).all()
    print(extension.upper(),'passed: watertight, consistent winding, volume and transformed mm/Z-up bounds.')
print('Independent parser:',trimesh.__version__,'; slicer/printer/process acceptance remains unverified.')
