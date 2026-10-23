/* ═══════════════════════════════════════════════════════════════
   Studio 3D Editor – visual engineering workbench (v14.0)
   Parts library · Dimension inspector · Assembly tools · STL/OBJ export
   Procedural geometry — no external mesh files required.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let libraryPromise;
  async function ensureThree(){
    if(!libraryPromise)libraryPromise=Promise.all([import('./vendor/three/three.module.js'),import('./vendor/three/OrbitControls.js'),import('./vendor/three/TransformControls.js')]).then(([three,controls,transforms])=>{window.THREE={...three,OrbitControls:controls.OrbitControls,TransformControls:transforms.TransformControls};}).catch(error=>{libraryPromise=null;throw error});
    return libraryPromise;
  }
  async function ensureSolids(){await ensureThree();await StudioSolidModel.init();}

  /* ─── Helpers ────────────────────────────────────────────────── */
  function _toast(msg) {
    if (typeof toast === 'function') toast(msg);
    else console.log('[3D Editor]', msg);
  }

  function _download(name, data, type) {
    if (typeof download === 'function') {
      download(name, data, type);
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ─── Parts catalogue ────────────────────────────────────────── */
  const CATALOGUE = StudioAssembly.catalogue;

  const ALL_PARTS = CATALOGUE.flatMap(c => c.parts);

  const ICONS = {
    bracket:  'M4 20V4h8v16M4 12h8', plate: 'M3 6h18v12H3zM3 10h18M3 14h18',
    extrusion:'M4 4h6v16H4zM10 4h6v16h-6', beam: 'M2 8h20v8H2zM6 8v8M18 8v8',
    shaft:    'M5 12h14M12 5v14', gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2',
    pulley:   'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    coupler:  'M8 7h8v10H8zM6 9h2M14 9h2M6 15h2M14 15h2',
    bearing:  'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    linear:   'M7 6h10v12H7zM9 6v12M15 6v12',
    bolt:     'M12 3v14M9 6l3-3 3 3M8 17h8M7 20h10', nut: 'M12 5l5 3v8l-5 3-5-3V8zM12 9v6',
    standoff: 'M9 4h6v16H9zM9 8h6M9 16h6',
    motor:    'M4 7h16v10H4zM8 7v10M16 7v10M10 12h4',
    motor_dc: 'M8 4a8 8 0 0 0 0 16M8 8a4 4 0 0 0 0 8M16 12h6',
    servo:    'M3 8h14v10H3zM17 11h4M17 14h4M7 8V5M12 8V5',
    enclosure:'M3 7h18v14H3zM3 11h18M7 7V3M17 7V3',
    din:      'M5 5h14v18H5zM2 10h3M19 10h3M8 5v18M16 5v18',
    pcb:      'M3 5h18v14H3zM7 9h10M7 12h10M7 15h4',
  };

  function icon(k, sz = 18) {
    return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[k] || 'M12 2l10 10-10 10L2 12z'}"/></svg>`;
  }

  const MAT_COLORS = {
    'Steel': 0x7a8880,
    'Aluminium 6061': 0xa8b8c8,
    'ABS polymer': 0x3a4040,
    'Brass': 0xc8a840,
    'FR4': 0x1a4a28,
    'Aluminium / Steel': 0x606868,
    'Carbon fibre': 0x4c5e63,
  };

  const DIM_LABELS = {
    width: 'Width mm', height: 'Height mm', depth: 'Depth mm', length: 'Length mm',
    thickness: 'Thickness mm', wallThickness: 'Wall mm', diameter: 'Diameter mm',
    outerDiameter: 'Outer ⌀ mm', innerDiameter: 'Inner ⌀ mm', boreDiameter: 'Bore ⌀ mm',
    flangeDiameter: 'Flange ⌀ mm', shaftDiameter: 'Shaft ⌀ mm', shaftLength: 'Shaft L mm',
    teeth: 'Teeth', acrossFlats: 'Across Flats mm', headDiameter: 'Head ⌀ mm',
  };

  /* ─── State ──────────────────────────────────────────────────── */
  let renderer = null, scene = null, camera = null, controls = null, raf = null;
  let objects = [];          // placed scene objects
  let selId = null;          // selected id
  let selectedIds=new Set(),assemblyGroups=[],assemblyJoints=[],multiPivot=null,measurePoints=[],measureMode=false,measureLine=null;
  let facePicking=false,attachment=null,attachmentGhost=null,attachmentMarkers=null,attachmentGhosts=new Map(),skipPick=false,isolationIds=null,dragPlane=null,dragGrab=null,dragThrottle=0,focusMode=false;
  const thumbnailCache=new Map();let thumbnailTicket=0;
  let mode = 'orbit';        // 'orbit' | 'select'
  let gridHelper = null, raycaster = null, vpObserver = null;
  let editorReady = false;
  let transformControls=null,dragStart=null,snapTransforms=true;
  let ctxController=null;
  let exploded = false,keyHandler=null,pointerStart=null,dragged=false;

  function uid() { return 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

  // Every part has a transform root; mesh offsets stay local to its definition.
  function build(p){
    if(!StudioAssembly.dimensions(p.id,p.dims))throw Error('Invalid dimensions for this part. Check bore, wall thickness and size limits.');
    if(p.id==='custom_solid'&&!StudioSolidModel.validate(p.model,p.dims.depth))throw Error('Invalid custom solid recipe.');
    if(p.id==='imported_mesh'&&!StudioMeshParts.validate(p.mesh))throw Error('Invalid imported mesh.');
    const root=new window.THREE.Group();root.add(buildGeometry(p));return root;
  }
  window.Studio3DAssets={ready:ensureThree,build:record=>build({...structuredClone(record),id:record.partId,mat:record.material})};
  function ring(outer,inner,length,mat,sides=48){
    const T=window.THREE,shape=new T.Shape();
    if(sides===6){for(let i=0;i<6;i++){const a=i*Math.PI/3,x=outer*Math.cos(a),y=outer*Math.sin(a);i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();}
    else shape.absarc(0,0,outer,0,Math.PI*2,false);
    if(inner>0){const hole=new T.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);}
    const geometry=new T.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,steps:1,curveSegments:24});geometry.rotateX(-Math.PI/2);return new T.Mesh(geometry,mat);
  }

  /* ─── Geometry builders ──────────────────────────────────────── */
  function buildGeometry(p) {
    const T = window.THREE;
    const d = p.dims;
    if(p.id==='imported_mesh')return new T.Mesh(StudioMeshParts.geometry(T,p.mesh,p.dims.scale),new T.MeshStandardMaterial({color:MAT_COLORS[p.mat]||0xa8b8c8,metalness:.3,roughness:.5,side:T.DoubleSide}));
    const col = p.col !== undefined ? p.col : (MAT_COLORS[p.mat] || 0x8a9a8a);
    const mat = (c = col) => new T.MeshStandardMaterial({color:c,metalness:['Steel','Brass','Aluminium 6061','Aluminium / Steel'].includes(p.mat)?0.7:0.05,roughness:p.mat==='ABS polymer'?0.7:0.36});
    const box = (w, h, l, x = 0, y = 0, z = 0, c) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, l), mat(c));
      m.position.set(x, y, z);
      return m;
    };
    const cyl = (r, l, segs = 24, x = 0, y = 0, z = 0, c) => {
      const m = new T.Mesh(new T.CylinderGeometry(r, r, l, segs), mat(c));
      m.position.set(x, y, z);
      return m;
    };
    const grp = (...meshes) => {
      const g = new T.Group();
      meshes.forEach(m => g.add(m));
      return g;
    };
    const s = 0.1; // 1 mm = 0.1 scene unit (1 unit = 10 mm)

    switch (p.id) {
      case 'custom_solid':return new T.Mesh(StudioSolidModel.geometry(T,p.model,d.depth),mat());
      case 'quad_plate': {
        const W=d.width*s,H=d.height*s,shape=new T.Shape();
        shape.moveTo(-W/2,-H/2);shape.lineTo(W/2,-H/2);shape.lineTo(W/2,H/2);shape.lineTo(-W/2,H/2);shape.closePath();
        const holes=[[-30,0],[30,0],[0,-24],[0,24],[-15,-15],[-15,15],[15,-15],[15,15]];
        for(const sx of [-1,1])for(const sz of [-1,1])for(const offset of [0,8])holes.push([sx*(30+offset*60/Math.hypot(60,72)),sz*(18+offset*72/Math.hypot(60,72))]);
        holes.forEach(([x,z])=>{const h=new T.Path();h.absarc(x/80*W,z/60*H,Math.min(W,H)*.02,0,Math.PI*2,true);shape.holes.push(h);});
        const geo=new T.ExtrudeGeometry(shape,{depth:d.thickness*s,bevelEnabled:false,curveSegments:12});geo.rotateX(Math.PI/2);geo.translate(0,d.thickness*s,0);return new T.Mesh(geo,mat());
      }
      case 'quad_arm': {
        const W=d.width*s,L=d.length*s,shape=new T.Shape();
        [[-W/2,-L/2],[W/2,-L/2],[W*.36,0],[W/2,L*.3],[W/2,L/2],[-W/2,L/2],[-W/2,L*.3],[-W*.36,0]].forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
        const radius=Math.min(W*.073,L*.014),end=L*.41207;
        const holes=[[0,-end],[0,-end+L*.070345]];
        for(const x of [-W*8/22,W*8/22])for(const z of [-L*8/113.723,L*8/113.723])holes.push([x,end+z]);
        holes.forEach(([x,z])=>{const h=new T.Path();h.absarc(x,z,radius,0,Math.PI*2,true);shape.holes.push(h);});
        const geo=new T.ExtrudeGeometry(shape,{depth:d.thickness*s,bevelEnabled:false,curveSegments:12});geo.rotateX(Math.PI/2);geo.translate(0,d.thickness*s,0);return new T.Mesh(geo,mat());
      }
      case 'washer':return ring(d.outerDiameter*s/2,d.innerDiameter*s/2,d.thickness*s,mat());
      case 'screw_cap': {
        const H=d.diameter*s*.65;
        return grp(cyl(d.diameter*s/2,d.length*s,16,0,-d.length*s/2,0),ring(d.headDiameter*s/2,d.diameter*s*.28,H,mat(),6));
      }
      case 'motor_brushless': {
        const R=d.diameter*s/2,L=d.length*s;
        const g=grp(cyl(R*.93,L*.12,32,0,L*.06,0,0x899397),ring(R*.9,R*.38,L*.78,mat(0x262e32)),ring(R,R*.85,L*.68,mat(0xa86039)),ring(R,d.shaftDiameter*s/2,L*.1,mat(0x9fa9ad)),cyl(d.shaftDiameter*s/2,d.shaftLength*s,24,0,L+d.shaftLength*s/2,0,0xb6c0c0));
        g.children[1].position.y=L*.12;g.children[2].position.y=L*.22;g.children[3].position.y=L*.9;
        for(let i=0;i<12;i++){const a=i*Math.PI/6;g.add(cyl(R*.12,L*.56,8,Math.cos(a)*R*.64,L*.46,Math.sin(a)*R*.64,0xb37446));}
        return g;
      }
      case 'propeller_cw':
      case 'propeller_ccw': {
        const R=d.diameter*s/2,bore=d.boreDiameter*s/2,H=d.thickness*s,hub=Math.max(R*.14,bore+(R-bore)*.04),start=Math.max(hub*.75,bore+(hub-bore)*.5);
        const propMat=()=>mat(p.mat==='ABS polymer'?(p.id==='propeller_cw'?0x88b887:0x688eaa):col);
        const g=grp(ring(hub,bore,H,propMat()));
        for(let i=0;i<2;i++){
          const sh=new T.Shape();sh.moveTo(start,0);sh.bezierCurveTo(R*.4,-R*.09,R*.88,-R*.14,R,0);sh.bezierCurveTo(R*.86,R*.07,R*.5,R*.12,start,R*.025);sh.closePath();
          const geo=new T.ExtrudeGeometry(sh,{depth:H*.4,bevelEnabled:false,curveSegments:18});geo.rotateX(-Math.PI/2);geo.rotateX((p.id==='propeller_cw'?1:-1)*.2);geo.rotateY(i*Math.PI);geo.translate(0,H*.3,0);g.add(new T.Mesh(geo,propMat()));
        }
        return g;
      }
      case 'battery_pack': {
        const W=d.width*s,H=d.height*s,D=d.depth*s;
        return grp(box(W,H,D,0,H/2,0,0x384e47),box(W*.9,H*.025,D*.66,0,H*1.013,0,0xb5bd8b),box(W*.12,H*.3,D*.06,W*.3,H*.65,-D*.53,0xdfb941));
      }
      case 'battery_strap': {
        const W=d.width*s,H=d.height*s,D=d.depth*s,t=d.wallThickness*s;
        return grp(box(W,t,D,0,t/2,0),box(W,t,D,0,H-t/2,0),box(t,H,D,-W/2+t/2,H/2,0),box(t,H,D,W/2-t/2,H/2,0),box(W*.35,t*2,D*1.15,W*.2,H+t,0,0x8b9c78));
      }
      case 'flight_controller':
      case 'esc_board': {
        const W=d.width*s,H=d.height*s,th=d.thickness*s,shape=new T.Shape();
        shape.moveTo(-W/2,-H/2);shape.lineTo(W/2,-H/2);shape.lineTo(W/2,H/2);shape.lineTo(-W/2,H/2);shape.closePath();
        for(const x of [-W*5/12,W*5/12])for(const z of [-H*5/12,H*5/12]){const h=new T.Path();h.absarc(x,z,Math.min(W,H)*.045,0,Math.PI*2,true);shape.holes.push(h);}
        const geo=new T.ExtrudeGeometry(shape,{depth:th,bevelEnabled:false,curveSegments:12});geo.rotateX(-Math.PI/2);const g=grp(new T.Mesh(geo,mat()));
        if(p.id==='flight_controller'){g.add(box(W*.32,th*2.2,H*.32,0,th*2.1,0,0x22282b));g.add(box(W*.28,th*1.4,H*.15,0,th*1.7,-H*.36,0xb4b9b9));}
        else for(const x of [-W*.2,W*.2])for(const z of [-H*.2,H*.2])g.add(box(W*.25,th*1.7,H*.25,x,th*1.85,z,0x272b2c));
        for(let i=0;i<6;i++)for(const side of [-1,1])g.add(box(W*.06,th*.3,H*.08,side*W*.45,th*1.15,(i-2.5)*H*.1,0xbfa355));
        return g;
      }
      case 'bracket_l':
        return grp(
          box(d.width * s, d.thickness * s, d.height * s, 0, d.thickness * s / 2, 0),
          box(d.thickness * s, d.height * s, d.height * s, -(d.width * s) / 2 + (d.thickness * s) / 2, (d.height * s) / 2, 0)
        );
      case 'plate_flat':
        return box(d.width * s, d.thickness * s, d.height * s, 0, (d.thickness * s) / 2, 0);
      case 'angle_extrusion':
        return grp(
          box(d.width * s, 2 * s, d.length * s, 0, 1 * s, 0),
          box(2 * s, d.height * s, d.length * s, -(d.width * s) / 2 + 1 * s, (d.height * s) / 2, 0)
        );
      case 'beam_box': {
        const W=d.width*s,H=d.height*s,L=d.length*s,t=d.thickness*s,shape=new T.Shape();shape.moveTo(-W/2,0);shape.lineTo(W/2,0);shape.lineTo(W/2,H);shape.lineTo(-W/2,H);shape.closePath();
        const hole=new T.Path();hole.moveTo(-W/2+t,t);hole.lineTo(-W/2+t,H-t);hole.lineTo(W/2-t,H-t);hole.lineTo(W/2-t,t);hole.closePath();shape.holes.push(hole);
        const geometry=new T.ExtrudeGeometry(shape,{depth:L,bevelEnabled:false,steps:1});geometry.translate(0,0,-L/2);return new T.Mesh(geometry,mat());
      }


      case 'shaft_round': {
        const c = cyl(d.diameter * s / 2, d.length * s, 24);
        c.position.y = (d.length * s) / 2;
        return c;
      }
      case 'gear_spur': {
        const radius=d.diameter*s/2,shape=new T.Shape();
        for(let i=0;i<d.teeth*4;i++){const a=i/(d.teeth*4)*Math.PI*2,r=(i%4===0||i%4===3)?radius*.85:radius;const x=r*Math.cos(a),y=r*Math.sin(a);i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();
        const hole=new T.Path();hole.absarc(0,0,radius*.22,0,Math.PI*2,true);shape.holes.push(hole);
        const geometry=new T.ExtrudeGeometry(shape,{depth:d.thickness*s,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);return new T.Mesh(geometry,mat());
      }


      case 'pulley': {
        const R=d.diameter*s/2,W=d.width*s,bore=d.boreDiameter*s/2;
        const body=ring(R,bore,W,mat());const low=ring(R*1.15,bore,.08,mat());const high=ring(R*1.15,bore,.08,mat());high.position.y=W-.08;return grp(body,low,high);
      }
      case 'flange_coupler': {
        return grp(ring(d.diameter*s/2,d.boreDiameter*s/2,d.length*s,mat()),ring(d.diameter*s*.7,d.boreDiameter*s/2,.12,mat()));
      }
      case 'bearing_ball':
      case 'bearing_flange': {
        const body=ring(d.outerDiameter*s/2,d.innerDiameter*s/2,d.width*s,mat());
        return p.id==='bearing_flange'?grp(body,ring(d.flangeDiameter*s/2,d.innerDiameter*s/2,.1,mat())):body;
      }
      case 'linear_bush':return ring(d.diameter*s/2,d.innerDiameter*s/2,d.length*s,mat());


      case 'bolt_hex':
        return grp(
          cyl(d.headDiameter * s / 2, 0.4, 6, 0, d.length * s + 0.2, 0),
          cyl(d.diameter * s / 2, d.length * s, 16, 0, (d.length * s) / 2, 0)
        );
      case 'nut_hex':
        return ring(d.acrossFlats*s/Math.sqrt(3),d.diameter*s/2,d.thickness*s,mat(),6);
      case 'standoff':
        return cyl(d.diameter * s / 2, d.length * s, 8, 0, (d.length * s) / 2, 0);
      case 'motor_nema17': {
        const W = d.width * s, H = d.height * s, L = d.length * s;
        const body = box(W, H, L, 0, H / 2, 0);
        const face = new T.Mesh(new T.BoxGeometry(W, H, 0.08), new T.MeshPhongMaterial({ color: 0x556058 }));
        face.position.set(0, H / 2, L / 2 + 0.04);
        const shaft = cyl(d.shaftDiameter * s / 2, d.shaftLength * s, 16, 0, H / 2, L / 2 + d.shaftLength * s / 2);
        shaft.rotation.x = Math.PI / 2;
        return grp(body, face, shaft);
      }
      case 'motor_dc': {
        const body = cyl(d.diameter * s / 2, d.length * s, 32, 0, (d.length * s) / 2, 0);
        const shaft = cyl(d.shaftDiameter * s / 2, d.shaftLength * s, 16, 0, d.length * s + (d.shaftLength * s) / 2, 0, 0x888888);
        return grp(body, shaft);
      }
      case 'servo_std': {
        const W = d.width * s, L = d.length * s, H = d.height * s;
        const body = box(W, H, L, 0, H / 2, 0);
        const horn = cyl(0.14, 0.12, 16, 0, H + 0.06, 0, 0xd0d0d0);
        return grp(body, horn);
      }
      case 'enclosure_box':
      case 'enclosure_din': {
        const W = d.width * s, H = (d.height || d.depth) * s, D = d.depth * s, T2 = (d.wallThickness || 2) * s;
        const m = () => new T.MeshPhongMaterial({ color: col, transparent: true, opacity: 0.85 });
        return grp(
          ...[
            [W, T2, D, 0, T2 / 2, 0],
            [W, T2, D, 0, H - T2 / 2, 0],
            [T2, H, D, (W - T2) / 2, H / 2, 0],
            [T2, H, D, -(W - T2) / 2, H / 2, 0],
            [W, H, T2, 0, H / 2, -(D - T2) / 2]
          ].map(([w, h, dd, x, y, z]) => {
            const mesh = new T.Mesh(new T.BoxGeometry(w, h, dd), m());
            mesh.position.set(x, y, z);
            return mesh;
          })
        );
      }
      case 'pcb_board': {
        const W = d.width * s, H = d.height * s, Th = d.thickness * s;
        const board = box(W, Th, H, 0, Th / 2, 0);
        const compMat = new T.MeshPhongMaterial({ color: 0x225528 });
        const g = grp(board);
        [[-0.3, 0, -0.2], [0.1, 0, 0.15], [0.4, 0, -0.1]].forEach(([x, , z]) => {
          const c = new T.Mesh(new T.BoxGeometry(0.18, 0.08, 0.14), compMat.clone());
          c.position.set(x, Th + 0.04, z);
          g.add(c);
        });
        return g;
      }
      default:
        return new T.Mesh(new T.BoxGeometry(0.8, 0.8, 0.8), mat());
    }
  }

  /* ─── Tab HTML ───────────────────────────────────────────────── */
  let assemblyStage=6;
  function assemblyGuide(){return `<section class="droneAssemblyGuide" id="droneAssemblyGuide" hidden aria-label="Drone assembly sequence"><div><span class="eyebrow">QUADCOPTER · ASSEMBLY SEQUENCE</span><h3>Small parts. Complete assembly.</h3><p id="droneStageDescription" role="status"></p></div><div class="droneStepControls"><button id="dronePrevious" aria-label="Previous assembly step">←</button><label for="droneStage" class="srOnly">Assembly step</label><select id="droneStage">${StudioDrone.stages.map(([name],i)=>`<option value="${i+1}">${i+1} / 6 · ${name}</option>`).join('')}</select><button id="droneNext" aria-label="Next assembly step">→</button><button id="droneComplete">Complete drone</button></div><small>Preview only · saved visibility stays unchanged. Exports restore all assembly steps. Custom added parts appear in every step.</small></section>`;}
  function refreshAssemblyGuide(){
    const guide=document.getElementById('droneAssemblyGuide');if(!guide)return;
    guide.hidden=!objects.some(o=>StudioDrone.stage(o.id));
    const select=document.getElementById('droneStage');if(select)select.value=String(assemblyStage);
    const info=document.getElementById('droneStageDescription');if(info)info.textContent=StudioDrone.stages[assemblyStage-1][1]+' '+objects.filter(o=>o.obj3d.visible).length+' of '+objects.length+' components visible.';
    const previous=document.getElementById('dronePrevious'),next=document.getElementById('droneNext');if(previous)previous.disabled=assemblyStage===1;if(next)next.disabled=assemblyStage===6;
  }
  function setAssemblyStage(value,frame=true){
    if(!Number.isInteger(value)||value<1||value>6)return;
    if(exploded)toggleExplode();assemblyStage=value;
    objects.forEach(o=>o.obj3d.visible=o.visible&&StudioDrone.stage(o.id)<=value);
    if(selId&&!objects.find(o=>o.id===selId)?.obj3d.visible)select(null);
    refreshAssemblyGuide();if(frame)fitAssembly();
  }
  function tabHTML() {
    const partsPanel = CATALOGUE.map(c => `
      <div class="catalogueCategory" data-part-category="${c.cat}"><div class="parts-category">${c.cat}</div>
      ${c.parts.map(p => `
        <div class="catalogueCard"><button type="button" class="part-item" draggable="${p.id!=='custom_solid'}" data-insert="${p.id}" title="${p.name} · ${p.desc}">
          <div class="part-icon" style="color:${hex(p.col)}">${icon(p.icon)}</div>
          <div class="part-item-info"><strong>${p.name}</strong><small>${p.desc}</small></div>
        </button><button class="partPreviewButton" type="button" data-preview-part="${p.id}" aria-label="Preview and customize ${p.name}">Preview & size</button></div>`).join('')}</div>`).join('');

    const tbBtn = (id, label, svgPath, active = '') =>
      `<button id="${id}" class="${active}" title="${label}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${svgPath}"/></svg> ${label}</button>`;

    const companionTools = `<div class="v3dCreateBar"><button id="workspaceFocus">Expand workspace ↗</button><button class="primary" id="startCustomSolid">＋ Draw your own 3D part</button><button id="openMeshImport">Import STL / OBJ</button><button id="openPersonalParts">My reusable parts</button><button id="inspectManufacturing">Inspect & mass</button><button id="manufacturingTools">Fit & mesh tools</button><button id="faceWorkPlane">Model on a face</button><button id="engineeringLab">Calculation lab</button><button id="projectServices">AI & team</button><a href="#/templates">Browse assembly starters →</a></div><p class="v3dDisclaimer">Custom solids retain editable modelling recipes. Catalogue and imported parts are concept meshes. Reference exports: visible parts, mm, Z-up. Use Inspect & mass for topology checks and density-based estimates; external manufacturing review is still required.</p>`;
    return `
${assemblyGuide()}<div class="editor3d" id="editor3d" data-mobile-panel="parts">

  <div class="workbenchHeader"><div class="workbenchIdentity"><span class="workbenchMark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10L3 7m9 5 9-5m-9 5v10"/></svg></span><div><span class="workbenchEyebrow">3D DESIGN STUDIO</span><strong>${esc(current.name)}</strong></div><span class="workbenchStorage">${studioBackend.enabled?'Connected account':'Local device'}</span></div><div class="workbenchHeaderActions"><button id="findWorkbenchTool" title="Find a 3D tool (Ctrl or Command + /)"><span aria-hidden="true">⌕</span> Find a tool <kbd>Ctrl /</kbd></button><button id="workbenchHelp" aria-label="Workspace controls and help">?</button><button id="focusWorkbench" title="Expand or restore workspace">⤢ <span>Expand</span></button></div></div>
  <!-- Tools stay visible in named groups; the finder also reaches advanced tools. -->
  <div class="editor3d-toolbar">
    <div class="workbenchToolGroup" role="group" aria-label="History"><span class="tb-label">HISTORY</span><div><button id="tb-undo" title="Undo 3D edit">↶ Undo</button><button id="tb-redo" title="Redo 3D edit">↷ Redo</button></div></div>
    <div class="workbenchToolGroup" role="group" aria-label="Camera"><span class="tb-label">NAVIGATE</span><div>
    ${tbBtn('tb-orbit','Orbit','M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3','active')}
    ${tbBtn('tb-top','Top','M3 3h18v18H3zM3 9h18M9 3v18')}
    ${tbBtn('tb-front','Front','M3 3h18v18H3zM3 12h18M12 3v18')}
    ${tbBtn('tb-iso','Iso','M2 16 12 4l10 12M2 16l10 4 10-4M12 4v16')}<button id="tb-fit" title="Frame all visible parts">Fit assembly</button>
    </div></div><div class="workbenchToolGroup" role="group" aria-label="Transform"><span class="tb-label">TRANSFORM</span><div><button id="tb-move">Move</button><button id="tb-rotate">Rotate</button><label class="tbSnap"><input id="tb-snap" type="checkbox" ${snapTransforms?'checked':''}> Snap 1 mm / 15°</label>
    ${tbBtn('tb-select','Select','m4 4 7 18 3-7 7-3z')}
    </div></div><div class="workbenchToolGroup" role="group" aria-label="Model and inspect"><span class="tb-label">MODEL & VIEW</span><div><button id="tb-model">＋ Create solid</button><button id="tb-edit-model">Edit solid</button>${tbBtn('tb-explode','Explode','M5 9 2 12l3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3')}
    ${tbBtn('tb-wireframe','Wireframe','M2 16 12 4l10 12M2 16l10 4 10-4M12 4v16')}
    ${tbBtn('tb-extrude2d','Extrude 2D','M12 2v20M2 12h20M4 4l16 16')}
    </div></div><div class="workbenchToolGroup" role="group" aria-label="Part actions"><span class="tb-label">PARTS</span><div>
    ${tbBtn('tb-dup','Duplicate','M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1')}
    ${tbBtn('tb-del','Delete','M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6')}
    ${tbBtn('tb-clear','Clear','M3 3l18 18M9 9v6M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6')}
    </div></div><div class="workbenchToolGroup" role="group" aria-label="Export"><span class="tb-label">EXPORT</span><div>
    ${tbBtn('tb-stl','STL','M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3')}
    ${tbBtn('tb-obj','OBJ','M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3')}
    ${tbBtn('tb-syncbom','Sync BOM','M4 6h16M4 12h16M4 18h7m7-3 3 3 4-4')}
    </div></div>
  </div>

  <div class="assemblyCoach" id="assemblyCoach"><div class="assemblyCoachActions"><button id="attachFaces">Attach faces</button><button id="dragSnap">Drag & snap</button><button id="focusSelected">Focus selected</button><button id="isolateSelected">Isolate selected</button><button id="showAllParts">Show all</button><button id="leaveWorkspaceFocus" hidden>Exit expanded view</button></div><p id="assemblyHint" role="status">Click a part to edit it. Drag empty space to orbit. Use Attach faces or Drag & snap to connect parts.</p><div id="attachmentOptions" hidden><label><input id="attachmentCentres" type="checkbox" checked> Use face centres</label><label>Gap mm<input id="attachmentGap" type="number" value="0" min="-1000" max="1000" step="0.1"></label><label>Turn °<input id="attachmentSpin" type="number" value="0" min="-3600" max="3600" step="15"></label><label><input id="attachmentAlign" type="checkbox" checked> Align faces</label><label><input id="attachmentLock" type="checkbox" checked> Keep attached</label><button id="applyAttachment" disabled>Attach now</button><button id="retryAttachment">Pick again</button><button id="cancelAttachment">Cancel</button></div></div>
  <div class="mobileWorkspacePanels"><button data-workspace-panel="parts">Parts library</button><button data-workspace-panel="edit">Edit & assembly</button></div>
  <!-- Parts library -->
  <div class="editor3d-parts">
    <div class="editor3d-parts-head">
      <div><span class="workbenchEyebrow">BUILDING BLOCKS</span><strong>Parts library</strong></div>
      <div class="libraryLayoutControls" role="group" aria-label="Library layout"><button id="libraryGrid" title="Card view" aria-label="Card view" aria-pressed="true">▦</button><button id="libraryList" title="List view" aria-label="List view" aria-pressed="false">☷</button></div>
    </div>
    <label class="partsCategoryLabel" for="partsCategory">Category</label><select id="partsCategory"><option value="all">All parts</option>${CATALOGUE.map(c=>`<option>${c.cat}</option>`).join('')}</select><input aria-label="Search 3D parts" class="parts-search" id="partsSearch" placeholder="Filter library…" autocomplete="off">
    <p id="partsFilterCount" role="status">${ALL_PARTS.length} parts · click to add, or preview first</p><div id="partsList">${partsPanel}</div><p id="noPartsFound" hidden>No matching parts. Try another category or search.</p>
  </div>

  <!-- Three.js viewport -->
  <div class="editor3d-viewport" id="vp3d">
    <div class="v3d-loading" id="v3dLoad"><div class="v3d-spinner"></div><p>Loading 3D workspace…</p></div>
    <canvas aria-label="3D assembly viewport" id="v3dCanvas" style="width:100%;height:100%;display:block;outline:none"></canvas>

    <div class="viewport3d-overlay v3d-top-left">
      <div class="v3d-badge"><span class="viewportLiveDot"></span> PERSPECTIVE <strong>mm</strong></div>
      <div class="v3d-badge" id="v3dSel" style="display:none">◈ <strong id="v3dSelName"></strong></div>
    </div>
    <div class="viewportCameraDock" role="group" aria-label="Quick camera views"><button data-camera="iso" title="Isometric view (3)">Iso</button><button data-camera="top" title="Top view (1)">Top</button><button data-camera="front" title="Front view (2)">Front</button><button data-camera="fit" title="Fit all visible parts">Fit</button></div>
    <div class="viewport3d-overlay v3d-top-right">
      <button class="v3d-btn" id="v3dResetCam" title="Reset camera view">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5M21 21v-5h-5"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L3 8m18 8-2.64 2.36A9 9 0 0 1 3.51 15"/></svg>
      </button>
      <button class="v3d-btn" id="v3dGridBtn" title="Toggle ground grid">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
      </button>
    </div>
    <div class="viewport3d-overlay v3d-bottom-left">
      <div class="v3d-badge" id="v3dCount">0 objects · Click a part to place it</div>
    </div>
    <div class="viewport3d-overlay v3d-bottom-right">
      <div class="v3d-badge" id="v3dModeLabel">● ORBIT</div>
    </div>

    <div class="v3d-empty" id="v3dEmpty">
      <div class="v3d-empty-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>
      <p>Your next assembly starts here.</p>
      <small>Choose a part from the library.<br>Preview its size, then make it yours.</small>
    </div>
  </div>

  <!-- Inspector -->
  <div class="editor3d-inspector"><div class="inspectorJump"><button id="jumpCustomize">Customize</button><button id="jumpAssembly">Assembly list</button></div>
    <div class="inspector-head">CUSTOMIZE SELECTED PART</div>
    <div id="insp3d"><div class="inspector-none">Click a visible part to edit dimensions. Preview & size lets you customize a library part before adding it.</div></div>
    <div class="inspector-head">ASSEMBLY TREE</div><label class="assemblySearchLabel">Find in assembly<input id="assemblySearch" type="search" placeholder="Search placed parts…"></label>
    <div class="assembly-list" id="asmList"></div>
    <div id="assemblyTools"></div>

    <div class="asm-bom">
      <h4>Quick BOM</h4>
      <div id="bomRows"><div style="font-size:10px;color:#3a5045">No parts placed.</div></div>
    </div>

    <div class="export-btns">
      <button id="ispStl">↓ STL</button>
      <button id="ispObj">↓ OBJ</button>
      <button id="ispSync">Sync BOM</button>
    </div>
  </div>
  <div class="workbenchStatus"><span><i aria-hidden="true"></i> Millimetres · reference meshes</span><span class="tb-coords" id="v3dCoords">X — · Y — · Z — mm</span><button id="workbenchShortcuts">Mouse & keyboard controls ↗</button></div>

</div><div class="workbenchCompanion"><h3>More engineering tools</h3><p>Import, validate and extend your project. These tools are also available in Find a tool.</p>${companionTools}</div>`;
  }

  /* ─── Scene Persistence Per Project ──────────────────────────── */
  function sceneData(){return {version:1,units:'mm',...(assemblyGroups.length?{groups:structuredClone(assemblyGroups)}:{}),...(assemblyJoints.length?{joints:structuredClone(assemblyJoints)}:{}),objects:objects.map(o=>({id:o.id,partId:o.def.id,name:o.name,dims:structuredClone(o.def.dims),...(o.def.model?{model:structuredClone(o.def.model)}:{}),...(o.def.mesh?{mesh:structuredClone(o.def.mesh)}:{}),material:o.def.mat,position:(o._prePos&&exploded?o._prePos:o.obj3d.position).toArray().map(v=>v*10),rotation:[o.obj3d.rotation.x,o.obj3d.rotation.y,o.obj3d.rotation.z].map(v=>v*180/Math.PI),visible:o.visible,wireframe:o.wireframe}))};}
  let loadedProjectId=null,loadedSignature=null,entrySequence=0,sceneBlocked=false;
  function saveScene(){
    if(attachment)stopAttachment(false);
    if(sceneBlocked||!current?.id||current.id!==loadedProjectId)return false;
    const data=sceneData();
    try{solveJoints(data);}catch(e){_toast(e.message);return false;}
    if(!StudioAssembly.validate(data)){_toast('Invalid assembly values. Correct the edit before saving.');return false;}
    current.assembly3d=data;loadedSignature=JSON.stringify(data);
    for(const item of data.objects){const o=objects.find(o=>o.id===item.id);if(!exploded){o.obj3d.position.fromArray(item.position.map(v=>v/10));o.obj3d.rotation.set(...item.rotation.map(v=>v*Math.PI/180));}}
    const result=persist();
    refreshAssemblyGuide();
    refreshUndoButtons();
    renderAssemblyTools();
    return result!==false;
  }
  function disposeObject(object){
    const geometries=new Set(),materials=new Set();
    object.traverse(c=>{if(c.geometry)geometries.add(c.geometry);if(c.material)(Array.isArray(c.material)?c.material:[c.material]).forEach(m=>materials.add(m));});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  function loadScene(){
    if(!current?.id||!scene)return;
    sceneBlocked=false;let data=current.assembly3d||{version:1,units:'mm',objects:[]};
    let migrated=false;
    // Old per-project browser keys are read only in device mode and are retained.
    if(!current.assembly3d&&!studioBackend.enabled){
      const raw=studioStorage.read('studio-3d-'+current.id);
      if(raw!==null){try{data=StudioAssembly.legacy(StudioProjectData.parse(raw));migrated=true;}catch(error){
        clearSceneObjects();sceneBlocked=true;loadedProjectId=current.id;loadedSignature=null;
        const parent=document.getElementById('v3dLoad');
        if(parent){parent.style.display='flex';parent.innerHTML='<h3>Saved 3D data needs recovery</h3><p>The original has been preserved.</p><button id="downloadLegacy3d">Download original 3D data</button>';document.getElementById('downloadLegacy3d').onclick=()=>_download('original-3d-scene.json',raw,'application/json');}
        throw error;
      }}
    }
    if(!StudioAssembly.validate(data))throw Error('Invalid 3D assembly. Export the project before recovery.');
    data=structuredClone(data);solveJoints(data);if(!StudioAssembly.validate(data))throw Error('Joint positions exceed the supported assembly limits.');
    const signature=JSON.stringify(data);
    if(loadedProjectId===current.id&&loadedSignature===signature){setAssemblyStage(6,false);return;}
    const next=[];
    try{for(const item of data.objects){
      const base=ALL_PARTS.find(p=>p.id===item.partId)||{id:'imported_mesh',name:'Imported mesh',icon:'enclosure'},def={...structuredClone(base),dims:structuredClone(item.dims),...(item.model?{model:structuredClone(item.model)}:{}),...(item.mesh?{mesh:structuredClone(item.mesh)}:{}),mat:item.material,col:MAT_COLORS[item.material]};
      const obj3d=build(def);obj3d.position.fromArray(item.position.map(v=>v/10));obj3d.rotation.set(...item.rotation.map(v=>v*Math.PI/180));
      const record={id:item.id,name:item.name,def,obj3d,visible:item.visible,wireframe:item.wireframe};applyRecordAppearance(record);next.push(record);
    }}catch(error){next.forEach(o=>disposeObject(o.obj3d));throw error;}
    clearSceneObjects();objects=next;assemblyGroups=structuredClone(data.groups||[]);assemblyJoints=structuredClone(data.joints||[]);objects.forEach(o=>scene.add(o.obj3d));loadedProjectId=current.id;loadedSignature=signature;
    select(null);updateEmpty();refreshAsm();refreshBom();refreshAssemblyGuide();
    if(migrated){current.assembly3d=data;persist();_toast('Legacy 3D scene added to the project. Its original browser copy is retained.');}
  }
  function clearSceneObjects(){stopAttachment(false);isolationIds=null;loadedProjectId=null;loadedSignature=null;objects.forEach(o=>{scene.remove(o.obj3d);disposeObject(o.obj3d)});objects=[];selId=null;selectedIds.clear();assemblyGroups=[];assemblyJoints=[];clearMeasurement();exploded=false;assemblyStage=6;transformControls?.detach();if(multiPivot){scene.remove(multiPivot);multiPivot=null;}}
  function assembledView(){if(exploded)toggleExplode();if(assemblyStage!==6)setAssemblyStage(6,false);}
  function applyRecordAppearance(rec){
    rec.obj3d.visible=rec.visible;
    rec.obj3d.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;if(c.material)c.material.wireframe=rec.wireframe;}});
  }
  function refreshUndoButtons(){const h=typeof historyState==='function'?historyState():null;if(document.getElementById('tb-undo'))document.getElementById('tb-undo').disabled=!h?.undo.length;if(document.getElementById('tb-redo'))document.getElementById('tb-redo').disabled=!h?.redo.length;}


  /* ─── Canvas Attachment & Resize ─────────────────────────────── */
  function attachCanvas() {
    const vp = document.getElementById('vp3d');
    if (!vp || !renderer) return;
    const existing = document.getElementById('v3dCanvas');
    if (existing && existing !== renderer.domElement) {
      existing.replaceWith(renderer.domElement);
    } else if (!existing) {
      vp.appendChild(renderer.domElement);
    }
    renderer.domElement.id = 'v3dCanvas';
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;outline:none;cursor:grab;';
  }

  function observeViewport(vp) {
    if (vpObserver) vpObserver.disconnect();
    vpObserver = new ResizeObserver(() => {
      if (!renderer || !camera || !vp) return;
      const w = vp.clientWidth, h = vp.clientHeight;
      if (w > 0 && h > 0) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    vpObserver.observe(vp);
  }

  /* ─── Scene Initialization ───────────────────────────────────── */
  function initScene() {
    if(renderer){controls?.dispose();transformControls?.dispose();renderer.dispose();vpObserver?.disconnect();}
    renderer=null;controls=null;clearSceneObjectsSafe();
    const T = window.THREE;
    const vp = document.getElementById('vp3d');
    if (!vp) return;
    const W = vp.clientWidth || 800, H = vp.clientHeight || 500;

    renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x1c282f);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    attachCanvas();

    scene = new T.Scene();
    scene.fog = new T.Fog(0x1c282f, 90, 220);

    camera = new T.PerspectiveCamera(45, W / H, 0.01, 100000);
    camera.position.set(8, 6, 10);
    camera.lookAt(0, 0, 0);

    // Lights
    scene.add(new T.AmbientLight(0xe5ebed, 0.95));
    scene.add(new T.HemisphereLight(0xf3f6ff,0x7f9097,1.1));
    const sun = new T.DirectionalLight(0xffffff, 1.25);
    sun.position.set(12, 22, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    ['left', 'right', 'top', 'bottom'].forEach((k, i) => { sun.shadow.camera[k] = [-20, 20, 20, -20][i]; });
    scene.add(sun);

    const fill = new T.DirectionalLight(0xb4c9e0, 0.75);
    fill.position.set(-10, 6, -10);
    scene.add(fill);

    // Ground plane & grid
    gridHelper = new T.GridHelper(40, 40, 0x526570, 0x354951);
    gridHelper.position.y = -0.005;
    scene.add(gridHelper);

    const ground = new T.Mesh(
      new T.PlaneGeometry(2000, 2000),
      new T.MeshStandardMaterial({ color: 0x293b45, roughness: 1.0, metalness: 0.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    scene.add(new T.AxesHelper(2));

    controls = new T.OrbitControls(camera, renderer.domElement);
    controls.minDistance=.5;controls.maxDistance=50000;controls.maxPolarAngle=Math.PI*.95;
    transformControls=new T.TransformControls(camera,renderer.domElement);transformControls.setSize(.8);scene.add(transformControls);
    transformControls.addEventListener('mouseDown',()=>{const rec=objects.find(o=>o.id===selId);if(rec){const target=selectedIds.size>1?multiPivot:rec.obj3d;target.updateMatrixWorld(true);dragStart={id:rec.id,data:sceneData(),matrix:target.matrixWorld.clone(),position:rec.obj3d.position.clone(),rotation:rec.obj3d.rotation.clone()};}});
    transformControls.addEventListener('objectChange',()=>{if(!dragStart||selectedIds.size<2)return;multiPivot.updateMatrixWorld(true);const delta=new window.THREE.Matrix4().multiplyMatrices(multiPivot.matrixWorld,dragStart.matrix.clone().invert());for(const item of dragStart.data.objects.filter(o=>selectedIds.has(o.id))){const record=objects.find(o=>o.id===item.id),next={};setMatrixRecord(next,delta.clone().multiply(matrixOf(item.position.map(v=>v/10),item.rotation)));record.obj3d.position.fromArray(next.position);record.obj3d.rotation.set(...next.rotation.map(v=>v*Math.PI/180));}});
    transformControls.addEventListener('dragging-changed',e=>{controls.enabled=!e.value&&mode!=='attach-drag';});
    transformControls.addEventListener('mouseUp',()=>{if(!dragStart)return;const before=dragStart.data,ids=[...selectedIds];try{const candidate=sceneData();solveJoints(candidate);if(!StudioAssembly.validate(candidate))throw Error('Transform exceeds the assembly limits.');saveScene();}catch(e){current.assembly3d=before;loadedSignature=null;loadScene();for(const id of ids)select(id,true,true);_toast(e.message+' Previous assembly restored.');}dragStart=null;renderInsp();renderAssemblyTools();syncTransformHandles();});
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();editorReady=false;pauseEditor();const load=document.getElementById('v3dLoad');if(load){load.style.display='flex';load.textContent='Graphics context lost. Waiting for the browser to restore it…';}});
    renderer.domElement.addEventListener('webglcontextrestored',()=>{editorReady=true;if(isActive())enterEditor();});
    raycaster = new T.Raycaster();

    observeViewport(vp);

    const loadEl = document.getElementById('v3dLoad');
    if (loadEl) loadEl.style.display = 'none';

    editorReady = true;
    loadScene();
    updateEmpty();
    refreshAsm();
    refreshBom();
  }

  function loop() {
    if(!isActive()||!editorReady){pauseEditor();return;}
    raf = requestAnimationFrame(loop);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  /* ─── Object Placement ───────────────────────────────────────── */
  async function modelPart(id,frame){
    if(sceneBlocked||!editorReady||current?.id!==loadedProjectId)return _toast('Open a project in the 3D editor first.');
    const rec=id?objects.find(o=>o.id===id):null,project=current.id;
    if(id&&!rec?.def.model)return _toast('Select a custom solid to edit its profile and features.');
    if(!rec&&objects.length>=200)return _toast('Assemblies support up to 200 parts.');
    try{await ensureSolids();if(current.id!==project||!isActive())return;
      StudioSolidEditor.open({model:frame?{...StudioSolidModel.defaultModel(),frame}:rec?.def.model,isNew:!!frame,depth:rec?.def.dims.depth,name:rec?.name,onCommit:draft=>{
        if(current.id!==project||sceneBlocked)throw Error('The active project changed. Reopen the modeller.');
        const def={...structuredClone(rec?.def||ALL_PARTS.find(p=>p.id==='custom_solid')),model:draft.model,dims:{depth:draft.depth}},obj3d=build(def);
        assembledView();
        if(rec){obj3d.position.copy(rec.obj3d.position);obj3d.rotation.copy(rec.obj3d.rotation);scene.remove(rec.obj3d);disposeObject(rec.obj3d);rec.obj3d=obj3d;rec.def=def;rec.name=draft.name;applyRecordAppearance(rec);scene.add(obj3d);select(rec.id);}
        else{const T=window.THREE,bounds=new T.Box3().setFromObject(obj3d);if(!draft.model.frame)obj3d.position.y=-bounds.min.y;if(objects.length&&!draft.model.frame){const occupied=new T.Box3();objects.forEach(o=>occupied.union(new T.Box3().setFromObject(o.obj3d)));obj3d.position.x=occupied.max.x-bounds.min.x+1;}const record={id:uid(),name:draft.name,def,obj3d,visible:true,wireframe:false};applyRecordAppearance(record);objects.push(record);scene.add(obj3d);select(record.id);}
        updateEmpty();refreshAsm();refreshBom();saveScene();fitAssembly();_toast('Custom solid saved with editable profile and feature history.');
      }});
    }catch(e){_toast(e.message);}
  }
  function place(partId,overrides={}) {
    if(partId==='custom_solid')return modelPart();
    if(sceneBlocked||!editorReady)return _toast('Resolve the 3D loading error first.');
    if(objects.length>=200)return _toast('Assemblies support up to 200 parts.');
    assembledView();
    const original=ALL_PARTS.find(p=>p.id===partId);const def=original?{...structuredClone(original),...(overrides.dims?{dims:structuredClone(overrides.dims)}:{}),...(overrides.mat?{mat:overrides.mat,col:MAT_COLORS[overrides.mat]}:{})}:null;
    if (!def || !editorReady) {
      if (!editorReady) _toast('3D engine is loading…');
      return;
    }
    if(!StudioAssembly.dimensions(def.id,def.dims)||!StudioAssembly.materials.includes(def.mat))return _toast('Choose valid dimensions and material.');
    const obj3d = build(structuredClone(def));
    const n = objects.length;
    const T=window.THREE,localBounds=new T.Box3().setFromObject(obj3d);
    if(n){
      const occupied=new T.Box3();objects.forEach(o=>occupied.union(new T.Box3().setFromObject(o.obj3d)));
      const x=occupied.max.x+1-localBounds.min.x;
      obj3d.position.set(x>50?0:x,0,x>50?occupied.max.z+1-localBounds.min.z:0);
      if(obj3d.position.toArray().some(v=>Math.abs(v)>10000)){disposeObject(obj3d);return _toast('Arrange existing parts closer to the origin before inserting another part.');}
    }
    obj3d.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(obj3d);

    const rec = {
      id: uid(),
      name: def.name + (n ? ` #${n + 1}` : ''),
      def: structuredClone(def),
      obj3d,
      visible: true,
      wireframe: false
    };
    objects.push(rec);
    select(rec.id);
    updateEmpty();
    refreshAsm();
    refreshBom();
    saveScene();
    fitAssembly();
    _toast('Placed: ' + rec.name);
  }

  /* Guided interaction: previews never change saved geometry before confirmation. */
  function hint(message){const el=document.getElementById('assemblyHint');if(el)el.textContent=message;}
  function filterCatalogue(){const query=(document.getElementById('partsSearch')?.value||'').toLowerCase().trim(),category=document.getElementById('partsCategory')?.value||'all';let total=0;document.querySelectorAll('[data-part-category]').forEach(group=>{let count=0;group.querySelectorAll('.catalogueCard').forEach(card=>{const part=ALL_PARTS.find(p=>p.id===card.querySelector('[data-insert]').dataset.insert),match=(category==='all'||category===group.dataset.partCategory)&&(!query||(part.name+' '+part.desc+' '+part.id+' '+group.dataset.partCategory).toLowerCase().includes(query));card.hidden=!match;if(match)count++;});group.hidden=!count;total+=count;});const output=document.getElementById('partsFilterCount');if(output)output.textContent=total+' matching parts · preview or click to add';const empty=document.getElementById('noPartsFound');if(empty)empty.hidden=!!total;}
  function filterAssembly(){const query=(document.getElementById('assemblySearch')?.value||'').toLowerCase().trim();document.querySelectorAll('#asmList [data-asm]').forEach(row=>{const record=objects.find(o=>o.id===row.dataset.asm);row.hidden=!!query&&!(record&&(record.name+' '+record.def.id+' '+(record.def.desc||'')+' '+record.def.mat).toLowerCase().includes(query));});document.querySelectorAll('#asmList .asm-group').forEach(group=>{group.hidden=!!query&&![...group.querySelectorAll('[data-asm]')].some(row=>!row.hidden);if(query&&!group.hidden)group.open=true;});}
  async function renderCatalogueThumbnails(){
    if(!document.getElementById('partsList')||!window.THREE)return;const ticket=++thumbnailTicket,T=window.THREE;if(ALL_PARTS.every(p=>p.id==='custom_solid'||thumbnailCache.has(p.id))){for(const def of ALL_PARTS){if(ticket!==thumbnailTicket)break;const host=document.querySelector(`[data-insert="${def.id}"] .part-icon`);if(host&&thumbnailCache.has(def.id))host.innerHTML=`<img src="${thumbnailCache.get(def.id)}" alt="" width="72" height="54">`;}return;}let r;try{r=new T.WebGLRenderer({antialias:true,alpha:true});r.setSize(120,90);r.setPixelRatio(1);const s=new T.Scene(),c=new T.PerspectiveCamera(36,4/3,.01,10000);s.add(new T.HemisphereLight(0xffffff,0x526958,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(8,14,10);s.add(light);
      for(const def of ALL_PARTS){if(ticket!==thumbnailTicket)break;const host=document.querySelector(`[data-insert="${def.id}"] .part-icon`);if(!host?.isConnected)break;if(def.id==='custom_solid')continue;if(!thumbnailCache.has(def.id)){const mesh=build(structuredClone(def));s.add(mesh);const b=new T.Box3().setFromObject(mesh),centre=b.getCenter(new T.Vector3()),distance=Math.max(.1,b.getSize(new T.Vector3()).length()*1.8);c.position.copy(centre).add(new T.Vector3(.75,.65,1).normalize().multiplyScalar(distance));c.lookAt(centre);r.render(s,c);thumbnailCache.set(def.id,r.domElement.toDataURL('image/png'));s.remove(mesh);disposeObject(mesh);}host.innerHTML=`<img src="${thumbnailCache.get(def.id)}" alt="" width="72" height="54">`;await new Promise(resolve=>setTimeout(resolve,0));}
    }catch{}finally{r?.dispose();}
  }
  function frameBounds(bounds){if(!camera||!controls||bounds.isEmpty())return;const T=window.THREE,centre=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),distance=Math.max(.5,Math.max(size.x,size.y,size.z)/(2*Math.tan(camera.fov*Math.PI/360))*1.5/Math.min(1,camera.aspect)),direction=camera.position.clone().sub(controls.target);if(direction.length()<.001)direction.set(.7,.65,.7);controls.target.copy(centre);camera.position.copy(centre).addScaledVector(direction.normalize(),distance);controls.update();}
  function focusSelected(){if(!selectedIds.size)return _toast('Click a part to focus it.');const bounds=new window.THREE.Box3();objects.filter(o=>selectedIds.has(o.id)).forEach(o=>{if(o.visible)o.obj3d.visible=true;bounds.union(new window.THREE.Box3().setFromObject(o.obj3d));});frameBounds(bounds);hint('Focused on '+(selectedIds.size===1?objects.find(o=>selectedIds.has(o.id))?.name:selectedIds.size+' parts')+'. Wheel or pinch to zoom.');}
  function isolateSelected(){if(!selectedIds.size)return _toast('Select a part or group to isolate.');stopAttachment(false);assembledView();isolationIds=new Set(selectedIds);objects.forEach(o=>o.obj3d.visible=o.visible&&isolationIds.has(o.id));focusSelected();hint('Only your selection is shown. Show all restores the assembly; exports still use saved visibility.');}
  function showAllParts(){stopAttachment(false);isolationIds=null;assembledView();const changed=objects.some(o=>!o.visible);objects.forEach(o=>{o.visible=true;o.obj3d.visible=true;});if(changed)saveScene();refreshAsm();renderInsp();fitAssembly();hint('All parts are visible. Click a part to customize it.');}
  function toggleWorkspaceFocus(force){focusMode=typeof force==='boolean'?force:!focusMode;document.body.classList.toggle('studioFocus',focusMode);const exit=document.getElementById('leaveWorkspaceFocus');if(exit)exit.hidden=!focusMode;const button=document.getElementById('focusWorkbench');if(button){button.innerHTML=focusMode?'⤡ <span>Restore</span>':'⤢ <span>Expand</span>';button.setAttribute('aria-pressed',String(focusMode));}requestAnimationFrame(()=>{const vp=document.getElementById('vp3d');if(vp&&renderer&&camera){renderer.setSize(vp.clientWidth,vp.clientHeight,false);camera.aspect=vp.clientWidth/vp.clientHeight;camera.updateProjectionMatrix();if(focusMode&&!attachment&&objects.length){const bounds=new window.THREE.Box3();objects.filter(o=>o.obj3d.visible).forEach(o=>bounds.union(new window.THREE.Box3().setFromObject(o.obj3d)));frameBounds(bounds);}}});}
  function detachSelected(){try{stopAttachment(false);const data=sceneData(),ids=new Set(selectedIds),removed=(data.joints||[]).filter(j=>ids.has(j.child)&&!ids.has(j.parent));if(!removed.length)throw Error('The selected parts have no incoming attachment to detach.');data.joints=data.joints.filter(j=>!removed.includes(j));commitAssembly(data,[...ids]);hint('Detached. You can drag this part or attach it to another face.');}catch(e){_toast(e.message);}}
  function surfacePick(event,excluded=new Set()){
    if(!raycaster||!camera)return null;const canvas=document.getElementById('v3dCanvas'),rect=canvas?.getBoundingClientRect();if(!rect?.width||event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return null;raycaster.setFromCamera({x:(event.clientX-rect.left)/rect.width*2-1,y:-(event.clientY-rect.top)/rect.height*2+1},camera);
    const meshes=[],owners=new Map();for(const record of objects.filter(o=>o.visible&&o.obj3d.visible&&!excluded.has(o.id)))record.obj3d.traverse(mesh=>{if(mesh.isMesh){meshes.push(mesh);owners.set(mesh,record);}});const hit=raycaster.intersectObjects(meshes,false)[0];if(!hit?.face)return null;const T=window.THREE,record=owners.get(hit.object),normal=hit.face.normal.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize(),point=hit.point.clone().multiplyScalar(10);return {id:record.id,name:record.name,point:point.toArray(),normal:normal.toArray(),centre:null};
  }
  function faceCentre(pick){if(pick.centre)return pick.centre;const T=window.THREE,record=objects.find(o=>o.id===pick.id);if(!record)return pick.point;const normal=new T.Vector3(...pick.normal),origin=new T.Vector3(...pick.point),sum=new T.Vector3();let area=0;
    record.obj3d.updateMatrixWorld(true);record.obj3d.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?index.count:p.count;for(let i=0;i<count;i+=3){const v=[0,1,2].map(k=>{const n=index?index.getX(i+k):i+k;return new T.Vector3(p.getX(n),p.getY(n),p.getZ(n)).applyMatrix4(mesh.matrixWorld).multiplyScalar(10);}),cross=new T.Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0])),twice=cross.length();if(twice<1e-8||cross.clone().normalize().dot(normal)<.9999||v.some(p=>Math.abs(normal.dot(p.clone().sub(origin)))>.01))continue;sum.addScaledVector(v[0].clone().add(v[1]).add(v[2]).divideScalar(3),twice);area+=twice;}});pick.centre=area?sum.divideScalar(area).toArray():pick.point;return pick.centre;
  }
  function attachmentOptions(){return {gapMm:Number(document.getElementById('attachmentGap')?.value||0),spinDegrees:Number(document.getElementById('attachmentSpin')?.value||0),align:document.getElementById('attachmentAlign')?.checked!==false,lock:document.getElementById('attachmentLock')?.checked!==false};}
  function drawAttachmentMarkers(){if(attachmentMarkers){scene.remove(attachmentMarkers);disposeObject(attachmentMarkers);}attachmentMarkers=new window.THREE.Group();scene.add(attachmentMarkers);const T=window.THREE;for(const [pick,color] of [[attachment?.source,0xf3ca77],[attachment?.target,0x88d3ff]]){if(!pick)continue;const point=new T.Vector3(...(document.getElementById('attachmentCentres').checked&&pick.id?faceCentre(pick):pick.point)).multiplyScalar(.1),end=point.clone().addScaledVector(new T.Vector3(...pick.normal),1.2),line=new T.Line(new T.BufferGeometry().setFromPoints([point,end]),new T.LineBasicMaterial({color,depthTest:false})),dot=new T.Mesh(new T.SphereGeometry(.075,12,8),new T.MeshBasicMaterial({color,depthTest:false}));dot.position.copy(point);line.renderOrder=dot.renderOrder=100;attachmentMarkers.add(line,dot);}}
  function clearAttachmentGhost(){if(attachmentGhost){scene?.remove(attachmentGhost);attachmentGhost.traverse(o=>{if(o.isMesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});attachmentGhost=null;}attachmentGhosts.clear();if(attachmentMarkers){scene?.remove(attachmentMarkers);disposeObject(attachmentMarkers);attachmentMarkers=null;}}
  function stopAttachment(message=true){if(!attachment&&!attachmentGhost)return;const old=attachment;attachment=null;clearAttachmentGhost();for(const [id,visible] of old?.originalVisibility||[])objects.find(o=>o.id===id)?.obj3d&&(objects.find(o=>o.id===id).obj3d.visible=visible);const options=document.getElementById('attachmentOptions');if(options)options.hidden=true;document.getElementById('attachFaces')?.classList.remove('active');document.getElementById('dragSnap')?.classList.remove('active');if(mode==='attach-drag')setMode('orbit');if(message)hint('Attachment cancelled. Your original assembly is unchanged.');}
  function beginAttachment(kind){try{stopAttachment(false);facePicking=false;measureMode=false;assembledView();if(objects.filter(o=>o.visible).length<2&&kind==='faces')throw Error('Add two parts first. Preview & size helps you customize each one.');attachment={kind,phase:'source',projectId:current.id,before:null,source:null,target:null,movingIds:[],draft:null,originalVisibility:new Map()};document.getElementById('attachmentOptions').hidden=false;document.getElementById('applyAttachment').disabled=true;document.getElementById(kind==='drag'?'dragSnap':'attachFaces').classList.add('active');setMode(kind==='drag'?'attach-drag':'orbit');hint(kind==='drag'?'Drag a part onto another surface. Its bottom snaps to that surface. Drop on empty space to move freely.':'Step 1 of 3 · Click the face of the part you want to move.');}catch(e){_toast(e.message);}}
  function captureAttachmentSource(pick,bottom=false){const data=sceneData();if(!selectedIds.has(pick.id))select(pick.id);const ids=StudioPlacement.moving(data,[...selectedIds]);attachment.before=data;attachment.signature=JSON.stringify(data);attachment.movingIds=[...ids];attachment.source=pick;attachment.phase='target';attachment.originalVisibility=new Map(objects.filter(o=>ids.has(o.id)).map(o=>[o.id,o.obj3d.visible]));if(bottom){const bounds=new window.THREE.Box3();objects.filter(o=>ids.has(o.id)).forEach(o=>bounds.union(new window.THREE.Box3().setFromObject(o.obj3d)));const centre=bounds.getCenter(new window.THREE.Vector3());attachment.source={...pick,point:[centre.x*10,bounds.min.y*10,centre.z*10],normal:[0,-1,0],centre:[centre.x*10,bounds.min.y*10,centre.z*10]};}}
  function previewAttachment(){if(!attachment?.source||!attachment.target)return false;try{if(attachment.projectId!==current.id||attachment.signature!==JSON.stringify(sceneData()))throw Error('Assembly changed. Cancel and pick the faces again.');const options=attachmentOptions(),centres=document.getElementById('attachmentCentres').checked,sourcePoint=centres?faceCentre(attachment.source):attachment.source.point,targetPoint=centres&&attachment.target.id?faceCentre(attachment.target):attachment.target.point,draft=StudioPlacement.mate(window.THREE,attachment.before,{...options,movingIds:attachment.movingIds,sourceId:attachment.source.id,targetId:attachment.target.id,sourcePoint,sourceNormal:attachment.source.normal,targetPoint,targetNormal:attachment.target.normal,...(attachment.freeMove?{align:false,lock:false,gapMm:0}:{})});attachment.draft=draft;
      if(!attachmentGhost){attachmentGhost=new window.THREE.Group();scene.add(attachmentGhost);for(const record of objects.filter(o=>attachment.movingIds.includes(o.id))){const ghost=record.obj3d.clone(true);ghost.traverse(mesh=>{if(mesh.isMesh){mesh.material=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>{const material=m.clone();material.transparent=true;material.opacity=.65;material.depthWrite=false;material.color.setHex(0xb7df83);return material;});if(mesh.material.length===1)mesh.material=mesh.material[0];}});attachmentGhost.add(ghost);attachmentGhosts.set(record.id,ghost);record.obj3d.visible=false;}}
      for(const item of draft.objects){const ghost=attachmentGhosts.get(item.id);if(ghost){ghost.position.fromArray(item.position.map(v=>v/10));ghost.rotation.set(...item.rotation.map(v=>v*Math.PI/180));}}drawAttachmentMarkers();document.getElementById('applyAttachment').disabled=false;hint(attachment.kind==='faces'?'Step 3 of 3 · Preview ready. Adjust gap or turn, then choose Attach now.':'Release to '+(attachment.freeMove?'move freely.':'snap onto '+attachment.target.name+'.'));return true;
    }catch(e){attachment.draft=null;document.getElementById('applyAttachment').disabled=true;hint(e.message);return false;}}
  function attachmentPick(event){if(attachment.kind!=='faces')return;try{const pick=surfacePick(event,new Set(attachment.phase==='source'?[]:attachment.movingIds));if(!pick)return hint('Click a visible mesh face. You can orbit between picks.');if(attachment.phase==='source'){captureAttachmentSource(pick);drawAttachmentMarkers();hint('Step 2 of 3 · Moving '+pick.name+'. Click a face on the stationary target. You can orbit to reach it.');}else{attachment.target=pick;previewAttachment();}}catch(e){hint(e.message);}}
  function applyAttachment(){if(!attachment?.draft)return;try{if(attachment.signature!==JSON.stringify(sceneData())||current.id!==attachment.projectId)throw Error('The assembly changed. Pick the faces again.');const draft=attachment.draft,ids=attachment.movingIds,free=attachment.freeMove;stopAttachment(false);commitAssembly(draft,ids);hint(free?'Part moved. Undo is available.':'Parts attached. Choose Detach to reposition them; Undo restores the previous assembly.');_toast(free?'Part moved':'Attachment applied');}catch(e){hint(e.message);}}
  function dragAttachmentStart(event){if(event.button!==0)return;const pick=surfacePick(event);if(!pick)return;try{captureAttachmentSource(pick,true);attachment.dragging=true;dragGrab=new window.THREE.Vector3(...pick.point).multiplyScalar(.1);dragPlane=new window.THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new window.THREE.Vector3()),dragGrab);document.getElementById('vp3d').setPointerCapture(event.pointerId);}catch(e){hint(e.message);}}
  function dragAttachmentMove(event,force=false){if(!attachment?.dragging)return;if(!force&&performance.now()-dragThrottle<60)return;dragThrottle=performance.now();const target=surfacePick(event,new Set(attachment.movingIds));if(target){attachment.target=target;attachment.freeMove=false;}else{const point=raycaster.ray.intersectPlane(dragPlane,new window.THREE.Vector3());if(!point){attachment.draft=null;return;}const offset=point.sub(dragGrab).multiplyScalar(10);attachment.target={id:null,name:'free space',point:attachment.source.point.map((v,k)=>v+offset.getComponent(k)),normal:[0,1,0]};attachment.freeMove=true;}previewAttachment();}
  function dragAttachmentEnd(event){if(!dragged){stopAttachment(false);skipPick=true;hint('No move applied. Choose Drag & snap, then hold and drag a part.');return;}const rect=document.getElementById('v3dCanvas').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom){stopAttachment();skipPick=!dragged;return;}dragAttachmentMove(event,true);if(attachment)attachment.dragging=false;skipPick=!dragged;if(attachment?.draft)applyAttachment();else stopAttachment();}
  function dropLibraryPart(event){event.preventDefault();try{stopAttachment(false);const id=event.dataTransfer.getData('application/x-studio-part'),def=ALL_PARTS.find(p=>p.id===id);if(!def||id==='custom_solid')return;if(objects.length>=200)throw Error('Assemblies support up to 200 parts.');assembledView();const hit=surfacePick(event),T=window.THREE,mesh=build(structuredClone(def)),bounds=new T.Box3().setFromObject(mesh),centre=bounds.getCenter(new T.Vector3());disposeObject(mesh);let target=hit;if(!target){const ground=raycaster.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());if(!ground)throw Error('Drop onto a visible surface or the ground plane.');target={id:null,point:ground.multiplyScalar(10).toArray(),normal:[0,1,0]};}const record={id:uid(),partId:def.id,name:def.name,dims:structuredClone(def.dims),material:def.mat,position:[0,0,0],rotation:[0,0,0],visible:true,wireframe:false},data=sceneData();data.objects.push(record);const draft=StudioPlacement.mate(T,data,{movingIds:[record.id],sourceId:record.id,targetId:target.id,sourcePoint:[centre.x*10,bounds.min.y*10,centre.z*10],sourceNormal:[0,-1,0],targetPoint:target.point,targetNormal:target.normal,lock:target.id!==null});commitAssembly(draft,[record.id]);hint('Part placed on the drop surface. Change its dimensions in Customize selected part, or Undo.');}catch(e){_toast(e.message);}}
  function bindUsability(){if(!document.getElementById('assemblyCoach'))return;const bind=(id,fn)=>{const node=document.getElementById(id);if(node)node.onclick=fn;};bind('jumpCustomize',()=>{document.querySelector('.editor3d-inspector').scrollTop=0;});bind('jumpAssembly',()=>{const panel=document.querySelector('.editor3d-inspector'),target=document.getElementById('assemblySearch');if(getComputedStyle(panel).overflowY==='visible')target.scrollIntoView({block:'nearest'});else panel.scrollTop+=target.getBoundingClientRect().top-panel.getBoundingClientRect().top-55;});bind('attachFaces',()=>beginAttachment('faces'));bind('dragSnap',()=>beginAttachment('drag'));bind('focusSelected',focusSelected);bind('isolateSelected',isolateSelected);bind('showAllParts',showAllParts);bind('workspaceFocus',()=>toggleWorkspaceFocus());bind('leaveWorkspaceFocus',()=>toggleWorkspaceFocus(false));bind('applyAttachment',applyAttachment);bind('cancelAttachment',()=>stopAttachment());bind('retryAttachment',()=>beginAttachment(attachment?.kind||'faces'));for(const id of ['attachmentCentres','attachmentGap','attachmentSpin','attachmentAlign','attachmentLock'])document.getElementById(id).onchange=previewAttachment;document.getElementById('assemblySearch').oninput=filterAssembly;
    document.querySelectorAll('[data-workspace-panel]').forEach(b=>b.onclick=()=>{document.getElementById('editor3d').dataset.mobilePanel=b.dataset.workspacePanel;if(!focusMode)document.querySelector(b.dataset.workspacePanel==='parts'?'.editor3d-parts':'.editor3d-inspector').scrollIntoView({block:'nearest'});});
    document.querySelectorAll('[data-preview-part]').forEach(button=>button.onclick=()=>{const def=ALL_PARTS.find(p=>p.id===button.dataset.previewPart);if(def.id==='custom_solid')return modelPart();const project=current.id;StudioPartPreview.open(def,async draft=>{if(current.id!==project||!isActive())throw Error('The active project changed. Reopen the preview.');const count=objects.length;place(def.id,{dims:draft.dims,mat:draft.mat});if(objects.length!==count+1)throw Error('The part could not be inserted. Resolve the assembly limit first.');}).catch(e=>_toast(e.message));});
    document.querySelectorAll('[data-insert]').forEach(button=>{button.ondragstart=event=>{if(button.dataset.insert==='custom_solid'){event.preventDefault();return;}event.dataTransfer.setData('application/x-studio-part',button.dataset.insert);event.dataTransfer.effectAllowed='copy';hint('Drop onto a part to attach, or onto the ground to place.');};});const vp=document.getElementById('vp3d');vp.ondragover=event=>{if(event.dataTransfer.types.includes('application/x-studio-part')){event.preventDefault();event.dataTransfer.dropEffect='copy';}};vp.ondrop=dropLibraryPart;
  }

  /* Persistent assembly operations. All mutations pass the same project validator. */
  const workbenchCommands=[
    ['tb-model','Create a custom solid','Model','Draw a sketch, extrude and edit features'],
    ['tb-edit-model','Edit selected solid','Model','Profile, depth and feature history'],
    ['openMeshImport','Import STL / OBJ','Library','Bring an existing mesh into this assembly'],
    ['openPersonalParts','My reusable parts','Library','Save and reuse your personal components'],
    ['attachFaces','Attach two faces','Assembly','Pick moving and stationary faces; preview then apply'],
    ['dragSnap','Drag & snap','Assembly','Drag a placed part onto another surface'],
    ['tb-move','Move selected parts','Transform','Position with the 3D arrows or numeric inspector'],
    ['tb-rotate','Rotate selected parts','Transform','Rotate with the 3D rings or numeric inspector'],
    ['tb-dup','Duplicate selected parts','Assembly','Create editable copies of the selection'],
    ['selectAllParts','Select all parts','Assembly','Build a multiple selection for shared edits'],
    ['groupParts','Group selected parts','Assembly','Keep a set of components together'],
    ['ungroupParts','Ungroup selected parts','Assembly','Release an assembly group'],
    ['alignParts','Align selected parts','Assembly','Use the axis and edge set in Assembly tools'],
    ['pickMeasure','Measure two surface points','Validate','Pick mesh points and read their distance'],
    ['savePersonalPart','Save part to personal library','Library','Reuse the active part in another project'],
    ['jumpCustomize','Customize selected part','Inspect','Jump to dimensions, position and materials'],
    ['jumpAssembly','Find a placed part','Inspect','Jump to the searchable assembly tree'],
    ['focusSelected','Focus selected parts','View','Frame the selection without changing the model'],
    ['isolateSelected','Isolate selected parts','View','Temporarily hide the rest of the assembly'],
    ['showAllParts','Show all parts','View','Exit temporary isolation'],
    ['tb-fit','Fit assembly','View','Frame every visible part'],
    ['tb-top','Top camera','View','Look down on the assembly'],
    ['tb-front','Front camera','View','Look at the front of the assembly'],
    ['tb-iso','Isometric camera','View','See the assembly in three dimensions'],
    ['tb-explode','Exploded view','View','Separate components for inspection'],
    ['tb-wireframe','Wireframe display','View','Toggle mesh edges for all parts'],
    ['faceWorkPlane','Model on a face','Model','Create a sketch plane from a mesh face'],
    ['tb-extrude2d','Extrude the project sketch','Model','Turn supported 2D shapes into 3D parts'],
    ['inspectManufacturing','Inspect mesh & mass','Validate','Topology and physical property estimates'],
    ['manufacturingTools','Fit & mesh tools','Validate','Clearance, walls, repair and tolerances'],
    ['engineeringLab','Engineering calculation lab','Calculate','Loads, circuits, thermal and flight estimates'],
    ['projectServices','AI & team services','Services','Configured backend required for cloud features'],
    ['tb-stl','Export STL','Export','Visible parts, millimetres, Z-up'],
    ['tb-obj','Export OBJ','Export','Grouped visible part meshes'],
    ['tb-syncbom','Sync bill of materials','Export','Update the project component list'],
    ['tb-undo','Undo 3D edit','History','Restore the previous project state'],
    ['tb-redo','Redo 3D edit','History','Reapply an undone edit']
  ];
  function findWorkbenchTool(){
    const project=current.id;
    modal('Find a workspace tool',`<div class="workbenchFinder"><label for="workbenchToolQuery">What would you like to do?</label><input id="workbenchToolQuery" type="search" placeholder="Try attach, import or export…" autocomplete="off"><p class="finderHint">↑ ↓ to navigate · Enter to run · Esc to close</p><div id="workbenchToolResults" aria-label="Matching workspace tools"></div><p id="workbenchToolCount" role="status"></p></div>`,()=>false);
    document.querySelector('#modalForm>button[type=submit]').style.display='none';
    const dialog=document.getElementById('dialog'),query=document.getElementById('workbenchToolQuery'),results=document.getElementById('workbenchToolResults');
    const show=()=>{const q=query.value.trim().toLowerCase(),entries=workbenchCommands.filter(row=>row.join(' ').toLowerCase().includes(q));results.innerHTML=entries.map(([id,label,group,detail])=>`<button type="button" data-run-workbench="${id}" ${document.getElementById(id)?.disabled?'disabled':''}><span class="finderGroup">${group}</span><span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span><span aria-hidden="true">↵</span></button>`).join('')||'<div class="finderEmpty">No matching tool. Try “attach”, “solid” or “export”.</div>';document.getElementById('workbenchToolCount').textContent=entries.length+' matching tools';results.querySelectorAll('[data-run-workbench]').forEach(button=>button.onclick=()=>{if(!isActive()||current.id!==project)return _toast('The active project changed. Reopen the tool finder.');const target=document.getElementById(button.dataset.runWorkbench);dialog.close();target?.click();});};
    query.oninput=show;
    const keys=e=>{const buttons=[...results.querySelectorAll('button:not(:disabled)')];if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const index=buttons.indexOf(document.activeElement),next=e.key==='ArrowDown'?(index+1)%buttons.length:(index<0?buttons.length-1:(index-1+buttons.length)%buttons.length);buttons[next]?.focus();}else if(e.key==='Enter'&&document.activeElement===query){e.preventDefault();buttons[0]?.click();}};
    query.onkeydown=keys;results.onkeydown=keys;show();query.focus();
  }
  function workbenchHelp(){
    modal('Make yourself at home',`<div class="workbenchHelp"><p>Start with a library part or draw a custom solid. Click a part in the canvas to edit its size, position and material.</p><div class="helpSteps"><article><span>01</span><strong>Choose & customize</strong><p>Use Preview & size to inspect a part before adding it. Switch between card and list views in the library.</p></article><article><span>02</span><strong>Connect your parts</strong><p>Attach faces guides you through two face picks and a preview. Drag & snap places a part on another surface. Detach a locked part before moving it.</p></article><article><span>03</span><strong>Review & export</strong><p>Use Inspect & mass and Fit & mesh tools, then export STL or OBJ. Reference meshes need external manufacturing review.</p></article></div><dl><dt>Orbit</dt><dd>Drag empty canvas space</dd><dt>Pan</dt><dd>Right drag or Shift + drag</dd><dt>Zoom</dt><dd>Mouse wheel / two-finger pinch</dd><dt>Multiple selection</dt><dd>Shift / Ctrl / Command + click a part</dd><dt>Top / Front / Iso</dt><dd><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dd><dt>Focus selection / assembly</dt><dd><kbd>F</kbd></dd><dt>Find a tool</dt><dd><kbd>Ctrl /</kbd> or <kbd>⌘ /</kbd></dd><dt>Cancel attachment / exit expanded view</dt><dd><kbd>Esc</kbd></dd></dl></div>`,()=>false);
    document.querySelector('#modalForm>button[type=submit]').style.display='none';
  }
  function reflectMobilePanel(){const root=document.getElementById('editor3d');if(root)document.querySelectorAll('[data-workspace-panel]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workspacePanel===root.dataset.mobilePanel)));}
  function bindWorkbench(){
    if(!document.getElementById('findWorkbenchTool'))return;
    document.getElementById('findWorkbenchTool').onclick=findWorkbenchTool;
    document.getElementById('workbenchHelp').onclick=workbenchHelp;
    document.getElementById('workbenchShortcuts').onclick=workbenchHelp;
    document.getElementById('focusWorkbench').onclick=()=>toggleWorkspaceFocus();
    document.getElementById('focusWorkbench').setAttribute('aria-pressed',String(focusMode));
    for(const id of ['jumpCustomize','jumpAssembly']){const button=document.getElementById(id),action=button.onclick;button.setAttribute('aria-pressed',String(id==='jumpCustomize'));button.onclick=()=>{document.getElementById('editor3d').dataset.mobilePanel='edit';reflectMobilePanel();action?.();for(const other of ['jumpCustomize','jumpAssembly'])document.getElementById(other).setAttribute('aria-pressed',String(id===other));};}
    const root=document.getElementById('editor3d');
    const layout=value=>{root.dataset.libraryLayout=value==='list'?'list':'cards';document.getElementById('libraryGrid').setAttribute('aria-pressed',String(value!=='list'));document.getElementById('libraryList').setAttribute('aria-pressed',String(value==='list'));};
    let savedLayout='cards';try{savedLayout=localStorage.getItem('studio-library-layout-v1')||'cards';}catch{}layout(savedLayout);
    for(const [id,value] of [['libraryGrid','cards'],['libraryList','list']])document.getElementById(id).onclick=()=>{layout(value);try{localStorage.setItem('studio-library-layout-v1',value);}catch{_toast('View changed for this session. Browser storage is unavailable.');}};
    document.querySelectorAll('[data-camera]').forEach(button=>button.onclick=()=>{if(button.dataset.camera==='fit')fitAssembly();else setCam(button.dataset.camera);});
    document.querySelectorAll('[data-workspace-panel]').forEach(button=>{const action=button.onclick;button.onclick=()=>{action?.();reflectMobilePanel();};});reflectMobilePanel();
    const grid=document.getElementById('v3dGridBtn');grid.setAttribute('aria-pressed',String(gridHelper?.visible!==false));
  }
  function matrixOf(position,rotation){const T=window.THREE;return new T.Matrix4().compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(...rotation.map(v=>v*Math.PI/180))),new T.Vector3(1,1,1));}
  function setMatrixRecord(record,matrix){const T=window.THREE,p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();matrix.decompose(p,q,s);const e=new T.Euler().setFromQuaternion(q);record.position=p.toArray();record.rotation=[e.x,e.y,e.z].map(v=>v*180/Math.PI);}
  function solveJoints(data){
    const T=window.THREE,map=new Map(data.objects.map(o=>[o.id,o])),done=new Set(),visiting=new Set(),parents=new Map((data.joints||[]).map(j=>[j.child,j]));
    function visit(id){if(done.has(id))return;if(visiting.has(id))throw Error('Cyclic joints are not supported.');visiting.add(id);const joint=parents.get(id);if(joint){visit(joint.parent);const parent=map.get(joint.parent),child=map.get(id);if(!parent||!child)throw Error('A joint references a missing part.');const axis=new T.Vector3(...['X','Y','Z'].map(a=>a===joint.axis?1:0)),motion=new T.Matrix4();if(joint.type==='hinge')motion.makeRotationAxis(axis,joint.value*Math.PI/180);if(joint.type==='slider')motion.makeTranslation(...axis.multiplyScalar(joint.value).toArray());setMatrixRecord(child,matrixOf(parent.position,parent.rotation).multiply(motion).multiply(matrixOf(joint.offset,joint.orientation)));}visiting.delete(id);done.add(id);}
    for(const id of map.keys())visit(id);return data;
  }
  function commitAssembly(data,selection=[]){
    if(sceneBlocked||current?.id!==loadedProjectId)throw Error('Reopen the active 3D project first.');
    solveJoints(data);if(!StudioAssembly.validate(data))throw Error('The edit exceeds assembly, transform or geometry limits.');
    stopAttachment(false);
    const previous=current.assembly3d;try{current.assembly3d=data;loadedSignature=null;loadScene();select(null);for(const id of selection)select(id,true,true);saveScene();}catch(e){current.assembly3d=previous;loadedSignature=null;loadScene();throw e;}
  }
  function editableSelection(data){if(!selectedIds.size)throw Error('Select parts using the tree checkboxes or Ctrl-click.');if((data.joints||[]).some(j=>selectedIds.has(j.child)&&!selectedIds.has(j.parent)))throw Error('This part is joint-driven. Adjust or remove its joint before moving or aligning it.');return data.objects.filter(o=>selectedIds.has(o.id));}
  function groupSelection(){const data=sceneData(),ids=[...selectedIds];if(ids.length<2)throw Error('Select at least two parts to group.');if((data.groups||[]).some(g=>g.members.some(id=>selectedIds.has(id))))throw Error('Ungroup existing members before making a new group.');data.groups=[...(data.groups||[]),{id:uid(),name:'Group '+((data.groups||[]).length+1),members:ids}];commitAssembly(data,ids);}
  function ungroupSelection(){const data=sceneData();data.groups=(data.groups||[]).filter(g=>!g.members.some(id=>selectedIds.has(id)));commitAssembly(data,[...selectedIds]);}
  function translateSelection(delta){const data=sceneData();if(delta.some(n=>!Number.isFinite(n)||Math.abs(n)>100000))throw Error('Use finite millimetre offsets within ±100000.');for(const o of editableSelection(data))o.position=o.position.map((v,i)=>v+delta[i]);commitAssembly(data,[...selectedIds]);}
  function alignSelection(axis,edge){const data=sceneData(),items=editableSelection(data);if((data.joints||[]).some(j=>selectedIds.has(j.child)))throw Error('Detach joint-driven parts before aligning individual component bounds.');if(items.length<2)throw Error('Select two or more parts; the last selected part is the alignment reference.');const reference=objects.find(o=>o.id===selId),bounds=o=>new window.THREE.Box3().setFromObject(o.obj3d),value=b=>edge==='min'?b.min[axis]:edge==='max'?b.max[axis]:(b.min[axis]+b.max[axis])/2;const target=value(bounds(reference));for(const item of items){if(item.id===reference.id)continue;item.position['xyz'.indexOf(axis)]+=(target-value(bounds(objects.find(o=>o.id===item.id))))*10;}commitAssembly(data,[...selectedIds]);}
  function createJoint(type,axis,min,max){const data=sceneData(),ids=[...selectedIds];if(ids.length!==2)throw Error('Select exactly two parts: parent first, child second.');const [parent,child]=ids.map(id=>data.objects.find(o=>o.id===id));if((data.joints||[]).some(j=>j.child===child.id))throw Error('Remove the child’s existing joint first.');if(!Number.isFinite(min)||!Number.isFinite(max)||min>0||max<0||min>max)throw Error('Joint limits must include the initial value 0.');const local=matrixOf(parent.position,parent.rotation).invert().multiply(matrixOf(child.position,child.rotation)),relative={};setMatrixRecord(relative,local);data.joints=[...(data.joints||[]),{id:uid(),parent:parent.id,child:child.id,type,axis,offset:relative.position,orientation:relative.rotation,value:0,min:type==='fixed'?0:min,max:type==='fixed'?0:max}];commitAssembly(data,ids);}
  function clearMeasurement(){measurePoints=[];if(measureLine){scene?.remove(measureLine);measureLine.geometry.dispose();measureLine.material.dispose();measureLine=null;}}
  function drawMeasurement(){if(measureLine){scene.remove(measureLine);measureLine.geometry.dispose();measureLine.material.dispose();measureLine=null;}if(measurePoints.length===2){const T=window.THREE;measureLine=new T.Line(new T.BufferGeometry().setFromPoints(measurePoints),new T.LineBasicMaterial({color:0xf3cc78,depthTest:false}));measureLine.renderOrder=100;scene.add(measureLine);}}
  function renderAssemblyTools(){
    const host=document.getElementById('assemblyTools');if(!host)return;const selected=objects.filter(o=>selectedIds.has(o.id)),T=window.THREE;
    let measure='Select a part to inspect its world bounding dimensions.';
    if(selected.length){const b=new T.Box3();selected.forEach(o=>b.union(new T.Box3().setFromObject(o.obj3d)));const size=b.getSize(new T.Vector3()).multiplyScalar(10);measure=`World bounds: X ${size.x.toFixed(2)} · Y ${size.y.toFixed(2)} · Z ${size.z.toFixed(2)} mm`;if(selected.length===2){const boxes=selected.map(o=>new T.Box3().setFromObject(o.obj3d)),centres=boxes.map(b=>b.getCenter(new T.Vector3()));measure+=`<br>Centre distance: ${(centres[0].distanceTo(centres[1])*10).toFixed(2)} mm`;const gap=['x','y','z'].map(a=>Math.max(0,boxes[0].min[a]-boxes[1].max[a],boxes[1].min[a]-boxes[0].max[a]));measure+=`<br>Bounding-box separation: ${(Math.hypot(...gap)*10).toFixed(2)} mm (not surface clearance)`;}}
    if(measurePoints.length===2)measure+=`<br>Picked surface points: ${(measurePoints[0].distanceTo(measurePoints[1])*10).toFixed(3)} mm`;
    host.innerHTML=`<details class="assemblyTools" open><summary>ASSEMBLY TOOLS · ${selectedIds.size} selected</summary><p class="toolHint">Checkboxes select individual parts. Ctrl-click adds; Alt-click selects one group member. Last selected = alignment reference.</p><div class="toolButtons"><button id="selectAllParts">Select all</button><button id="clearPartSelection">Clear selection</button><button id="groupParts">Group</button><button id="ungroupParts">Ungroup</button><button id="savePersonalPart">Save part to library</button></div><div class="toolFields">${['X','Y','Z'].map(a=>`<label>Δ${a} mm<input id="batch${a}" type="number" value="0" step="0.1"></label>`).join('')}</div><button id="moveSelectedParts">Move selected</button><div class="toolFields"><label>Axis<select id="alignAxis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label><label>Align by<select id="alignEdge"><option value="center">Centre</option><option value="min">Minimum</option><option value="max">Maximum</option></select></label><button id="alignParts">Align</button></div><output id="assemblyMeasurements">${measure}</output><button id="pickMeasure">${measureMode?'Stop picking points':'Measure two surface points'}</button><button id="clearMeasure">Clear measure</button>${measureMode?'<p class="toolHint">Click two visible mesh surfaces. This is a temporary straight-line measurement.</p>':''}</details>
      <details class="assemblyTools"><summary>JOINTS · ${assemblyJoints.length}</summary><p class="toolHint">Select parent first, child second. Hinge pivots at the parent origin; slider follows its local axis. Kinematic positioning only.</p><div class="toolFields"><label>Type<select id="jointType"><option value="fixed">Fixed</option><option value="hinge">Hinge</option><option value="slider">Slider</option></select></label><label>Local axis<select id="jointAxis"><option>X</option><option>Y</option><option>Z</option></select></label></div><div class="toolFields"><label>Minimum (° / mm)<input type="number" id="jointMin" value="-90"></label><label>Maximum (° / mm)<input type="number" id="jointMax" value="90"></label></div><button id="addJoint">Create joint</button>${assemblyJoints.map(j=>`<div class="jointRow"><b>${esc(objects.find(o=>o.id===j.child)?.name)} · ${esc(j.type)}</b><label>Value ${j.type==='slider'?'mm':'°'}<input data-joint-value="${j.id}" type="number" value="${j.value}" min="${j.min}" max="${j.max}" step="1" ${j.type==='fixed'?'disabled':''}></label><button data-joint-remove="${j.id}">Remove joint</button></div>`).join('')}</details>`;
    const bind=(id,fn)=>{document.getElementById(id).onclick=()=>{try{assembledView();fn();}catch(e){_toast(e.message);}}};
    bind('selectAllParts',()=>{select(null);objects.forEach(o=>select(o.id,true,true))});bind('clearPartSelection',()=>select(null));bind('groupParts',groupSelection);bind('ungroupParts',ungroupSelection);bind('moveSelectedParts',()=>translateSelection(['X','Y','Z'].map(a=>Number(document.getElementById('batch'+a).value))));bind('alignParts',()=>alignSelection(document.getElementById('alignAxis').value,document.getElementById('alignEdge').value));bind('savePersonalPart',savePersonalPart);bind('pickMeasure',()=>{measureMode=!measureMode;setMode('select');renderAssemblyTools()});bind('clearMeasure',()=>{clearMeasurement();renderAssemblyTools()});bind('addJoint',()=>createJoint(document.getElementById('jointType').value,document.getElementById('jointAxis').value,Number(document.getElementById('jointMin').value),Number(document.getElementById('jointMax').value)));
    host.querySelectorAll('[data-joint-value]').forEach(input=>input.onchange=()=>{try{const data=sceneData(),j=data.joints.find(j=>j.id===input.dataset.jointValue);j.value=Number(input.value);commitAssembly(data,[...selectedIds]);}catch(e){_toast(e.message);renderAssemblyTools()}});
    host.querySelectorAll('[data-joint-remove]').forEach(button=>button.onclick=()=>{try{const data=sceneData();data.joints=data.joints.filter(j=>j.id!==button.dataset.jointRemove);commitAssembly(data,[...selectedIds]);}catch(e){_toast(e.message)}});
  }

  function personalParts(){const raw=studioStorage.read('studio-personal-parts-v1');if(raw===null)return [];let rows;try{rows=JSON.parse(raw);}catch{throw Error('Personal library data needs recovery. Export the original from My reusable parts before replacing it.');}if(!Array.isArray(rows)||rows.length>24||!rows.every(o=>StudioAssembly.validate({version:1,units:'mm',objects:[o]})))throw Error('Personal library data needs recovery; its original is preserved.');return rows;}
  function writePersonalParts(rows){if(JSON.stringify(rows).length>2000000||rows.reduce((n,o)=>n+(o.mesh?.positions.length||0)/9,0)>12000)throw Error('The personal library exceeds its 2 MB / 12,000 triangle limit. Export and remove an older part first.');try{localStorage.setItem('studio-personal-parts-v1',JSON.stringify(rows));}catch{throw Error('Browser storage is full or unavailable. Export your projects and free storage before saving a library part.');}}
  function savePersonalPart(){if(selectedIds.size!==1)throw Error('Select one individual part to save to the reusable library.');const rows=personalParts();if(rows.length>=24)throw Error('Keep up to 24 personal parts; remove an older entry first.');const record=sceneData().objects.find(o=>o.id===selId);rows.push({...structuredClone(record),id:uid(),position:[0,0,0],rotation:[0,0,0],visible:true,wireframe:false});writePersonalParts(rows);_toast('Part saved to My reusable parts on this device. Export that library for a portable backup.');}
  async function insertRecord(record){const project=current.id;if(record.model)await StudioSolidModel.prepare(record.model,record.dims.depth);if(current.id!==project||!isActive())throw Error('The active project changed. Reopen the library.');assembledView();const data=sceneData(),copy={...structuredClone(record),id:uid(),position:[0,0,0],rotation:[0,0,0],visible:true,wireframe:false};let right=0;objects.forEach(o=>{right=Math.max(right,new window.THREE.Box3().setFromObject(o.obj3d).max.x*10)});copy.position[0]=right+60;data.objects.push(copy);commitAssembly(data,[copy.id]);fitAssembly();}
  function openPersonalParts(){
    let rows,error='';try{rows=personalParts();}catch(e){error=e.message;rows=[];}
    modal('My reusable parts',`<p>Personal parts are stored on this device, separately from project backups. Export this library to move it to another device. Imported meshes have no editable CAD history.</p><p role="alert">${esc(error)}</p><div class="personalParts">${rows.map((o,i)=>`<article><b>${esc(o.name)}</b><small>${esc(o.partId)} · ${esc(o.material)}</small><button type="button" data-personal-place="${i}">Insert</button><button type="button" data-personal-remove="${i}">Remove</button></article>`).join('')||'<p>No saved parts yet. Select one part in the assembly and choose Save part to library.</p>'}</div><button type="button" id="exportPersonal">Export library / original</button><label>Import library JSON (replaces this library)<input id="importPersonal" type="file" accept=".json"></label><p id="personalError" role="alert"></p>`,()=>{});
    document.querySelector('#modalForm>button[type=submit]').hidden=true;const dialog=document.getElementById('dialog');dialog.addEventListener('close',()=>document.querySelector('#modalForm>button[type=submit]').hidden=false,{once:true});
    document.getElementById('exportPersonal').onclick=()=>_download('engineering-personal-parts.json',studioStorage.read('studio-personal-parts-v1')||'[]','application/json');
    document.querySelectorAll('[data-personal-place]').forEach(b=>b.onclick=async()=>{try{b.disabled=true;await insertRecord(rows[+b.dataset.personalPlace]);dialog.close();}catch(e){document.getElementById('personalError').textContent=e.message;}finally{b.disabled=false;}});
    document.querySelectorAll('[data-personal-remove]').forEach(b=>b.onclick=()=>{try{rows.splice(+b.dataset.personalRemove,1);writePersonalParts(rows);dialog.close();openPersonalParts();}catch(e){document.getElementById('personalError').textContent=e.message;}});
    document.getElementById('importPersonal').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2000000)throw Error('Use a library JSON below 2 MB.');const next=JSON.parse(await file.text());if(!Array.isArray(next)||next.length>24||new Set(next.map(o=>o?.id)).size!==next.length||!next.every(o=>StudioAssembly.validate({version:1,units:'mm',objects:[o]})))throw Error('Invalid personal parts library.');modal('Replace personal library?',`<p>Replace the current library with ${next.length} imported parts? Project parts are unaffected. Export your current library first if you need it.</p>`,()=>{writePersonalParts(next);return true;});document.querySelector('#modalForm>button[type=submit]').hidden=false;}catch(e){document.getElementById('personalError').textContent=e.message;}};
  }
  function openMeshImport(){
    const project=current.id;
    modal('Import STL / OBJ',`<p>Up to 2 MiB and 6,000 triangles per part; 12,000 imported triangles per assembly. OBJ faces must already be triangulated. Materials and external links are ignored.</p><label>Mesh file<input type="file" id="meshFile" accept=".stl,.obj" required></label><label>Source units<select id="meshUnits"><option value="mm">Millimetres</option><option value="cm">Centimetres</option><option value="m">Metres</option><option value="in">Inches</option></select></label><label>Source up axis<select id="meshUp"><option value="Z">Z up (STL / studio export)</option><option value="Y">Y up</option></select></label><p>The imported part is centred horizontally and placed on its base. It remains a triangle mesh; watertightness and manufacturing suitability are not guaranteed.</p><p id="meshError" role="alert"></p>`,async()=>{try{const file=document.getElementById('meshFile').files[0];if(!file)return false;if(current.id!==project)throw Error('The active project changed. Reopen import.');if(file.size>StudioMeshParts.MAX_BYTES)throw Error('Use a mesh file below 2 MiB.');const format=file.name.split('.').pop().toLowerCase(),mesh=StudioMeshParts.parse(await file.arrayBuffer(),format,{units:document.getElementById('meshUnits').value,up:document.getElementById('meshUp').value});await insertRecord({id:uid(),partId:'imported_mesh',name:file.name.slice(0,80)||'Imported mesh',dims:{scale:1},mesh,material:'Aluminium 6061',position:[0,0,0],rotation:[0,0,0],visible:true,wireframe:false});return true;}catch(e){document.getElementById('meshError').textContent=e.message;return false;}});
    document.querySelector('#modalForm>button[type=submit]').textContent='Import mesh';
  }

  /* ─── Selection & Picking ────────────────────────────────────── */
  function select(id,additive=false,individual=false) {
    if(!additive)selectedIds.clear();
    if(id){const group=individual?null:assemblyGroups.find(g=>g.members.includes(id));const ids=group?group.members:[id];const remove=additive&&ids.every(i=>selectedIds.has(i));ids.forEach(i=>remove?selectedIds.delete(i):selectedIds.add(i));}
    if(id&&!attachment&&document.getElementById('editor3d')){document.getElementById('editor3d').dataset.mobilePanel='edit';reflectMobilePanel();}
    const target=objects.find(o=>o.id===id);if(target?.visible&&!target.obj3d.visible)setAssemblyStage(6,false);
    objects.forEach(o => o.obj3d.traverse(c => {
      if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0);
    }));
    selId = selectedIds.has(id)?id:[...selectedIds].at(-1)||null;
    const rec = objects.find(o => o.id === id);
    if (selectedIds.size) {
      objects.filter(o=>selectedIds.has(o.id)).forEach(o=>o.obj3d.traverse(c => {
        if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x1e4e2a);
      }));
      const badge = document.getElementById('v3dSel');
      if (badge) {
        badge.style.display = '';
        document.getElementById('v3dSelName').textContent = selectedIds.size>1?selectedIds.size+' parts selected':rec?.name||'';
      }
    } else {
      const badge = document.getElementById('v3dSel');
      if (badge) badge.style.display = 'none';
    }
    refreshAsm();
    renderInsp();
    syncTransformHandles();
    renderAssemblyTools();
  }
  function syncTransformHandles(){
    if(!transformControls)return;
    const rec=objects.find(o=>o.id===selId),locked=assemblyJoints.some(j=>selectedIds.has(j.child)&&!selectedIds.has(j.parent)),active=['move','rotate'].includes(mode)&&!!rec?.obj3d.visible&&!exploded&&!locked;
    transformControls.enabled=active;transformControls.setTranslationSnap(snapTransforms?0.1:null);transformControls.setRotationSnap(snapTransforms?Math.PI/12:null);
    if(active){transformControls.setMode(mode==='move'?'translate':'rotate');if(selectedIds.size>1){if(!multiPivot){multiPivot=new window.THREE.Group();scene.add(multiPivot);}const centre=new window.THREE.Vector3();objects.filter(o=>selectedIds.has(o.id)).forEach(o=>centre.add(o.obj3d.position));multiPivot.position.copy(centre.divideScalar(selectedIds.size));multiPivot.quaternion.identity();multiPivot.updateMatrixWorld(true);transformControls.attach(multiPivot);}else transformControls.attach(rec.obj3d);}else transformControls.detach();
  }

  function pick(e) {
    if(skipPick){skipPick=false;return;}if(attachment){attachmentPick(e);return;}if(transformControls?.dragging||['move','rotate'].includes(mode)&&transformControls?.axis||!raycaster||!camera)return;
    const canvas = document.getElementById('v3dCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: mx, y: my }, camera);

    const meshes = [];
    objects.forEach(o => {
      if (o.obj3d.visible) o.obj3d.traverse(c => { if (c.isMesh) meshes.push(c); });
    });
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      if(facePicking){facePicking=false;const T=window.THREE,hit=hits[0],normal=hit.face.normal.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize(),helper=Math.abs(normal.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0),u=new T.Vector3().crossVectors(helper,normal).normalize(),v=new T.Vector3().crossVectors(normal,u).normalize();modelPart(null,{origin:hit.point.clone().multiplyScalar(10).toArray(),u:u.toArray(),v:v.toArray()});return;}
      if(measureMode){measurePoints.push(hits[0].point.clone());if(measurePoints.length>2)measurePoints.shift();drawMeasurement();renderAssemblyTools();return;}
      const hit = hits[0].object;
      const rec = objects.find(o => {
        let match = false;
        o.obj3d.traverse(c => { if (c === hit) match = true; });
        return match;
      });
      if (rec) { select(rec.id,e.ctrlKey||e.metaKey||e.shiftKey,e.altKey); return; }
    }
    select(null);
  }

  /* ─── Inspector ──────────────────────────────────────────────── */
  function renderInsp() {
    const el = document.getElementById('insp3d');
    if (!el) return;
    const rec = objects.find(o => o.id === selId);
    if (!rec) {
      el.innerHTML = `<div class="inspector-none"><span class="inspectorEmptyMark" aria-hidden="true">◇</span><strong>Every detail, in your control.</strong><p>Select a part in the canvas or assembly list to edit its dimensions, transforms and material.</p><ol><li>Add a part from the library</li><li>Click it to customize</li><li>Attach it to your assembly</li></ol></div>`;
      return;
    }
    const d = rec.def.dims;
    const dimRows = Object.entries(d).map(([k, v]) =>
      `<div class="dim-field"><label for="dim_${k}">${DIM_LABELS[k] || k}</label><input type="number" id="dim_${k}" value="${v}" min="${k==='teeth'?6:0.1}" max="${k==='teeth'?120:5000}" step="${k==='teeth'?1:0.1}"></div>`
    ).join('');
    const matBtns = Object.keys(MAT_COLORS).map(m =>
      `<button class="mat-btn${rec.def.mat === m ? ' active' : ''}" aria-pressed="${rec.def.mat===m}" data-mat="${m}"><i style="background:${hex(MAT_COLORS[m])}" aria-hidden="true"></i>${m}</button>`
    ).join('');
    const pos = rec.obj3d.position;
    const rot = rec.obj3d.rotation;

    el.innerHTML = `
      <div class="selectedPartTitle"><span class="workbenchEyebrow">${selectedIds.size>1?selectedIds.size+' SELECTED · ACTIVE PART':'SELECTED PART'}</span><strong>${esc(rec.name)}</strong><small>${esc(rec.def.mat)} · ${rec.def.mesh?'Imported mesh':rec.def.model?'Editable solid':'Parametric concept part'}</small></div>
      <div class="inspector-section">${assemblyJoints.some(j=>j.child===rec.id)?'<p class="attachedPartNote">Attached: Detach before moving. After resizing, recheck the contact.</p>':''}<div class="selectionShortcuts"><button id="insp-focus">Focus</button><button id="insp-attach">Attach</button><button id="insp-detach" ${assemblyJoints.some(j=>j.child===rec.id)?'':'disabled'}>Detach</button></div><h4>Dimensions · mm</h4>
        <div class="dim-grid">${dimRows}</div>
        <button class="dim-apply" id="applyDims">↻ Rebuild geometry</button>
        ${rec.def.model?'<button class="dim-apply" id="insp-model">Edit profile & features</button>':''}
      </div>
      <div class="inspector-section"><h4>Part Label</h4>
        <div class="dim-field"><label for="insp-name">Name</label><input type="text" id="insp-name" value="${esc(rec.name)}" maxlength="80"></div>
      </div>
      <div class="inspector-section"><h4>Position · mm</h4>
        <div class="dim-grid">
          ${['x', 'y', 'z'].map(a => `<div class="dim-field"><label for="pos_${a}">${a.toUpperCase()}</label><input type="number" id="pos_${a}" value="${(pos[a]*10).toFixed(2)}" min="-100000" max="100000" step="0.1"></div>`).join('')}
        </div>
        <button class="dim-apply" id="applyPos">Apply position</button>
      </div>
      <div class="inspector-section"><h4>Rotation · °</h4>
        <div class="dim-grid">
          ${['x', 'y', 'z'].map(a => `<div class="dim-field"><label for="rot_${a}">${a.toUpperCase()}</label><input type="number" id="rot_${a}" value="${(rot[a] * 180 / Math.PI).toFixed(2)}" min="-3600" max="3600" step="0.1"></div>`).join('')}
        </div>
        <button class="dim-apply" id="applyRot">Apply rotation</button>
      </div>
      <div class="inspector-section"><h4>Material</h4>
        <div class="mat-grid">${matBtns}</div>
      </div>
      <div class="inspector-section"><h4>Part Actions</h4>
        <div class="transform-grid">
          <button id="insp-hide">${rec.visible ? '○ Hide' : '● Show'}</button>
          <button id="insp-wire">${rec.wireframe ? 'Solid' : 'Wire'}</button>
          <button id="insp-del" style="color:#e07878;border-color:#4a2c2c;background:#241818">Delete</button>
        </div>
      </div>`;
    bindInsp(rec);if(selectedIds.size===1)document.querySelector('.editor3d-inspector').scrollTop=0;
    document.getElementById('applyPos').disabled=exploded;document.getElementById('applyRot').disabled=exploded;
    if(assemblyJoints.some(j=>j.child===rec.id)){document.getElementById('applyPos').disabled=true;document.getElementById('applyRot').disabled=true;}
  }

  function bindInsp(rec) {
    document.getElementById('insp-focus').onclick=focusSelected;document.getElementById('insp-attach').onclick=()=>beginAttachment('faces');document.getElementById('insp-detach').onclick=detachSelected;
    const modelButton=document.getElementById('insp-model');if(modelButton)modelButton.onclick=()=>modelPart(rec.id);
    document.getElementById('insp-name').onchange = e => {
      rec.name = e.target.value.trim().slice(0, 80) || rec.name;
      refreshAsm();
      refreshBom();
      saveScene();
    };

    document.getElementById('applyDims').onclick=async()=>{
      const projectId=current.id;
      const dims=Object.fromEntries(Object.keys(rec.def.dims).map(k=>[k,Number(document.getElementById('dim_'+k).value)]));
      if(!StudioAssembly.dimensions(rec.def.id,dims)){_toast('Use valid finite dimensions, whole teeth (6–120), and bores/walls that fit inside the part.');return;}
      assembledView();const nextDef={...rec.def,dims};let replacement;try{if(nextDef.model)await StudioSolidModel.prepare(nextDef.model,dims.depth);if(current.id!==projectId||!objects.includes(rec)||!isActive())return;replacement=build(nextDef)}catch(e){_toast(e.message);return;}replacement.position.copy(rec.obj3d.position);replacement.rotation.copy(rec.obj3d.rotation);
      scene.remove(rec.obj3d);disposeObject(rec.obj3d);rec.def=nextDef;rec.obj3d=replacement;applyRecordAppearance(rec);scene.add(replacement);select(rec.id);refreshBom();saveScene();_toast('Dimensions rebuilt');
    };


    document.getElementById('applyPos').onclick=()=>{
      const values=['x','y','z'].map(a=>Number(document.getElementById('pos_'+a).value));
      if(values.some(v=>!Number.isFinite(v)||Math.abs(v)>100000))return _toast('Position must be finite and within ±100000 mm.');
      assembledView();rec.obj3d.position.fromArray(values.map(v=>Math.round(v*10)/100));saveScene();renderInsp();
    };
    document.getElementById('applyRot').onclick=()=>{
      const values=['x','y','z'].map(a=>Number(document.getElementById('rot_'+a).value));
      if(values.some(v=>!Number.isFinite(v)||Math.abs(v)>3600))return _toast('Use finite rotations within ±3600 degrees.');
      assembledView();rec.obj3d.rotation.set(...values.map(v=>Math.round(v*10)/10*Math.PI/180));saveScene();renderInsp();
    };


    document.querySelectorAll('[data-mat]').forEach(btn => {
      btn.onclick = () => {
        rec.def.mat = btn.dataset.mat;
        const col = MAT_COLORS[btn.dataset.mat] || rec.def.col;
        rec.def.col = col;
        rec.obj3d.traverse(c => { if (c.isMesh && c.material?.color) {c.material.color.setHex(col);c.material.metalness=['Steel','Brass','Aluminium 6061','Aluminium / Steel'].includes(rec.def.mat)?0.7:0.05;c.material.roughness=rec.def.mat==='ABS polymer'?0.7:0.36;} });
        document.querySelectorAll('[data-mat]').forEach(b => b.classList.toggle('active', b === btn));
        refreshBom();
        saveScene();
      };
    });

    document.getElementById('insp-hide').onclick = () => {
      assembledView();
      rec.visible = !rec.visible;
      rec.obj3d.visible = rec.visible;
      document.getElementById('insp-hide').textContent = rec.visible ? '○ Hide' : '● Show';
      refreshAsm();
      saveScene();
    };

    document.getElementById('insp-wire').onclick = () => {
      rec.wireframe = !rec.wireframe;
      rec.obj3d.traverse(c => { if (c.isMesh && c.material) c.material.wireframe = rec.wireframe; });
      document.getElementById('insp-wire').textContent = rec.wireframe ? 'Solid' : 'Wire';
      saveScene();
    };

    document.getElementById('insp-del').onclick = delSelected;
  }

  /* ─── Assembly List ──────────────────────────────────────────── */
  function refreshAsm() {
    const el = document.getElementById('asmList');
    if (!el) return;
    if (!objects.length) {
      el.innerHTML = `<div style="padding:10px 14px;font-size:10px;color:#3a5045">No parts in scene</div>`;
      return;
    }
    const row=o=>`
      <div class="asm-item${selectedIds.has(o.id) ? ' selected' : ''}" data-asm="${esc(o.id)}">
        <input type="checkbox" aria-label="Select ${esc(o.name)}" data-multi="${esc(o.id)}" ${selectedIds.has(o.id)?'checked':''}>
        ${icon(o.def.icon || 'shaft', 12)}
        <button type="button" class="asm-name" data-select-asm="${esc(o.id)}">${esc(o.name)}</button>
        <button class="asm-vis" aria-label="${o.visible?'Hide':'Show'} ${esc(o.name)}" data-vis="${esc(o.id)}">${o.visible ? '●' : '○'}</button>
      </div>`;
    if(objects.some(o=>StudioDrone.stage(o.id))){
      const existing=[...el.querySelectorAll('details[data-stage]')],open=new Set(existing.filter(e=>e.open).map(e=>Number(e.dataset.stage)));
      el.innerHTML=[...StudioDrone.stages.map(([name],i)=>[i+1,name]),[0,'Custom parts']].map(([step,name])=>{
        const rows=objects.filter(o=>StudioDrone.stage(o.id)===step);if(!rows.length)return '';
        return `<details class="asm-group" data-stage="${step}" ${(existing.length?open.has(step):step===2)?'open':''}><summary>${step?step+' · ':''}${name}<span>${rows.length}</span></summary>${rows.map(row).join('')}</details>`;
      }).join('');
    }else el.innerHTML=assemblyGroups.map(g=>`<details class="asm-group" open><summary>${esc(g.name)} · ${g.members.length}</summary>${objects.filter(o=>g.members.includes(o.id)).map(row).join('')}</details>`).join('')+objects.filter(o=>!assemblyGroups.some(g=>g.members.includes(o.id))).map(row).join('');

    el.querySelectorAll('[data-asm]').forEach(item => item.onclick = e => {
      if (e.target.closest('[data-vis],[data-multi]')) return;
      select(item.dataset.asm,e.ctrlKey||e.metaKey||e.shiftKey,e.altKey);
    });
    el.querySelectorAll('[data-multi]').forEach(input=>input.onclick=e=>{e.stopPropagation();select(input.dataset.multi,true,true)});

    filterAssembly();
    el.querySelectorAll('[data-vis]').forEach(btn => btn.onclick = () => {
      const r = objects.find(o => o.id === btn.dataset.vis);
      if (r) {
        assembledView();
        r.visible = !r.visible;
        r.obj3d.visible = r.visible;
        refreshAsm();
        renderInsp();
        saveScene();
      }
    });
  }

  /* ─── Quick BOM ──────────────────────────────────────────────── */
  function refreshBom() {
    const el = document.getElementById('bomRows');
    if (!el) return;
    if (!objects.length) {
      el.innerHTML = `<div style="font-size:10px;color:#3a5045">No parts placed.</div>`;
      return;
    }
    const groups=StudioAssembly.bom(sceneData(),[]);
    el.innerHTML=groups.map(g=>`<div class="bom-row"><span>${esc(g.name)}</span><span>×${g.qty} · ${esc(g.material)}</span></div>`).join('')+`<div class="bom-row"><strong>Total Parts</strong><strong>${objects.length}</strong></div>`;
  }

  /* ─── Sync BOM to Project ────────────────────────────────────── */
  function syncBOM(){
    if(current?.id!==loadedProjectId)return;
    current.parts=StudioAssembly.bom(sceneData(),current.parts);persist();_toast('BOM synchronized. Manual entries and matching entered prices are preserved.');
  }


  /* ─── Sketch-to-3D Extrusion ─────────────────────────────────── */
  function extrude2DSketch(){
    if(sceneBlocked||!editorReady||current?.id!==loadedProjectId)return;
    const shapes=(current.sketch||[]).filter(s=>s.type==='rect'&&s.w>0&&s.h>0||s.type==='circle'&&s.r>0);
    if(!shapes.length)return _toast('Draw positive-size rectangles or circles in Sketch first.');
    if(objects.length+shapes.length>200)return _toast('Assemblies support up to 200 parts.');
    const created=[];try{for(const [i,shape] of shapes.entries()){
      const plate=shape.type==='rect',base=ALL_PARTS.find(p=>p.id===(plate?'plate_flat':'shaft_round'));
      const def={...structuredClone(base),dims:plate?{width:shape.w,height:shape.h,thickness:8}:{diameter:shape.r*2,length:25}};
      const obj3d=build(def);obj3d.position.set((shape.x+(plate?shape.w/2:0)-400)*.1,0,(shape.y+(plate?shape.h/2:0)-220)*.1);
      created.push({id:uid(),name:(plate?'Extruded plate ':'Extruded pin ')+(i+1),def,obj3d,visible:true,wireframe:false});
    }}catch(error){created.forEach(o=>disposeObject(o.obj3d));return _toast(error.message);}
    assembledView();created.forEach(o=>{applyRecordAppearance(o);scene.add(o.obj3d);objects.push(o);});select(created[0].id);updateEmpty();refreshAsm();refreshBom();saveScene();_toast('Sketch shapes extruded using millimetres; default plate depth 8 mm, pin depth 25 mm.');
  }


  /* ─── Actions: Duplicate, Delete, Clear, Explode ─────────────── */
  function delSelected() {
    if(selectedIds.size){try{assembledView();const ids=new Set(selectedIds),data=sceneData();data.objects=data.objects.filter(o=>!ids.has(o.id));data.groups=(data.groups||[]).map(g=>({...g,members:g.members.filter(id=>!ids.has(id))})).filter(g=>g.members.length>=2);data.joints=(data.joints||[]).filter(j=>!ids.has(j.parent)&&!ids.has(j.child));commitAssembly(data);_toast('Selected parts removed.');}catch(e){_toast(e.message);}return;}
    assembledView();
    const i = objects.findIndex(o => o.id === selId);
    if (i < 0) { _toast('Select an object first'); return; }
    const rec = objects[i];
    scene.remove(rec.obj3d);
    rec.obj3d.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    objects.splice(i, 1);
    selId = null;
    select(null);
    updateEmpty();
    refreshAsm();
    refreshBom();
    saveScene();
    _toast('Part removed');
  }

  function dupSelected() {
    if(selectedIds.size){try{assembledView();const data=sceneData(),copies=data.objects.filter(o=>selectedIds.has(o.id)),map=new Map(copies.map(o=>[o.id,uid()]));for(const o of copies)data.objects.push({...structuredClone(o),id:map.get(o.id),name:o.name.slice(0,73)+' (copy)',position:o.position.map((v,i)=>v+(i===0?15:0))});for(const g of [...data.groups||[]])if(g.members.every(id=>map.has(id)))(data.groups||=[]).push({...g,id:uid(),name:g.name.slice(0,73)+' (copy)',members:g.members.map(id=>map.get(id))});for(const j of [...data.joints||[]])if(map.has(j.parent)&&map.has(j.child))data.joints.push({...structuredClone(j),id:uid(),parent:map.get(j.parent),child:map.get(j.child)});commitAssembly(data,[...map.values()]);}catch(e){_toast(e.message);}return;}
    if(sceneBlocked||!editorReady)return _toast('Resolve the 3D loading error first.');
    if(objects.length>=200)return _toast('Assemblies support up to 200 parts.');
    assembledView();
    const rec = objects.find(o => o.id === selId);
    if (!rec) { _toast('Select an object first'); return; }
    const newDef = structuredClone(rec.def);
    const newObj = build(newDef);
    newObj.position.copy(rec.obj3d.position);
    newObj.position.x += 1.5;
    newObj.rotation.copy(rec.obj3d.rotation);
    newObj.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(newObj);
    const newRec = {
      id: uid(),
      name: rec.name.slice(0,73) + ' (copy)',
      def: newDef,
      obj3d: newObj,
      visible: true,
      wireframe: false
    };
    objects.push(newRec);
    select(newRec.id);
    updateEmpty();
    refreshAsm();
    refreshBom();
    saveScene();
    _toast('Part duplicated');
  }

  function toggleExplode() {
    if (!window.THREE || !objects.length) return;
    exploded = !exploded;
    document.getElementById('tb-explode')?.classList.toggle('active', exploded);
    const center = new window.THREE.Vector3();
    objects.forEach(o => center.add(o.obj3d.position));
    center.divideScalar(objects.length || 1);

    objects.forEach(o => {
      const dir = new window.THREE.Vector3().subVectors(o.obj3d.position, center).normalize();
      if (dir.lengthSq() < 0.001) dir.set(0, 1, 0);
      if (exploded) {
        o._prePos = o.obj3d.position.clone();
        o.obj3d.position.addScaledVector(dir, 2.5);
      } else if (o._prePos) {
        o.obj3d.position.copy(o._prePos);
      }
    });
    syncTransformHandles();renderInsp();_toast(exploded?'Exploded view · display only; export uses assembled positions':'Assembled view restored');
  }

  function clearAll() {
    if (!objects.length) return;
    assembledView();
    objects.forEach(r => {
      scene.remove(r.obj3d);
      r.obj3d.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    });
    objects = [];
    assemblyGroups=[];assemblyJoints=[];selectedIds.clear();clearMeasurement();
    selId = null;
    select(null);
    updateEmpty();
    refreshAsm();
    refreshBom();
    saveScene();
    _toast('Scene cleared');
  }

  function updateEmpty() {
    refreshAssemblyGuide();
    const el = document.getElementById('v3dEmpty');
    if (el) el.style.display = objects.length ? 'none' : 'flex';
    const cnt = document.getElementById('v3dCount');
    if (cnt) {
      cnt.textContent = objects.length
        ? `${objects.length} object${objects.length !== 1 ? 's' : ''} · Click to select`
        : '0 objects · Click a part to place it';
    }
  }

  function setMode(m) {
    if(attachment&&((attachment.kind==='drag'&&m!=='attach-drag')||['move','rotate','select'].includes(m)))stopAttachment(false);
    if(['move','rotate'].includes(m))assembledView();
    mode = m;
    if (controls) controls.enabled = m!=='attach-drag';
    const modeEl = document.getElementById('v3dModeLabel');
    if (modeEl) modeEl.textContent = '● ' + m.toUpperCase();
    ['tb-orbit','tb-select','tb-move','tb-rotate'].forEach(id=>document.getElementById(id)?.classList.toggle('active',id==='tb-'+m));syncTransformHandles();
  }

  function setCam(view) {
    if (!camera) return;
    if(objects.some(o=>o.obj3d.visible)&&controls){fitAssembly(view);return;}
    const r = 12;
    if (view === 'top') camera.position.set(0, r, 0.001);
    else if (view === 'front') camera.position.set(0, 0, r);
    else if (view === 'iso') camera.position.set(r * 0.7, r * 0.5, r * 0.7);
    else camera.position.set(8, 6, 10);

    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    } else {
      camera.lookAt(0, 0, 0);
    }
  }

  function fitAssembly(view='iso'){
    if(!camera||!controls||!objects.some(o=>o.obj3d.visible))return;
    const T=window.THREE,bounds=new T.Box3();objects.filter(o=>o.obj3d.visible).forEach(o=>{o.obj3d.updateMatrixWorld(true);bounds.union(new T.Box3().setFromObject(o.obj3d));});
    const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
    const distance=Math.max(.5,Math.max(size.x,size.y,size.z)/(2*Math.tan(camera.fov*Math.PI/360))*1.6/Math.min(1,camera.aspect));
    const direction=view==='top'?new T.Vector3(0,1,.001):view==='front'?new T.Vector3(0,0,1):new T.Vector3(.7,.65,.7);
    controls.target.copy(center);camera.position.copy(center).addScaledVector(direction.normalize(),distance);if(scene.fog){scene.fog.near=Math.max(90,distance*2);scene.fog.far=Math.max(220,distance*6);}controls.update();
  }

  function manufacturingRecords(){
    assembledView();const T=window.THREE,rows=[];let total=0;
    for(const rec of objects.filter(o=>o.visible)){const positions=[];let meshCount=0;rec.obj3d.updateMatrixWorld(true);rec.obj3d.traverse(child=>{if(!child.isMesh)return;meshCount++;const p=child.geometry.attributes.position,index=child.geometry.index,count=index?index.count:p.count;if(total+count/3>300000||positions.length+count*3>900000)throw Error('Inspection is limited to 100,000 triangles per part and 300,000 per assembly.');total+=count/3;for(let i=0;i<count;i++){const n=index?index.getX(i):i,v=new T.Vector3(p.getX(n),p.getY(n),p.getZ(n)).applyMatrix4(child.matrixWorld).multiplyScalar(10);positions.push(v.x,v.y,v.z);}});rows.push({id:rec.id,name:rec.name,material:rec.def.mat,positions,meshCount});}if(!rows.length)throw Error('Add a visible part before inspecting.');return rows;
  }
  function inspectManufacturing(){
    let records;try{records=manufacturingRecords();}catch(e){return _toast(e.message);}
    modal('Mesh inspection & physical estimates',`<p>Visible assembled parts · millimetres. Density values are editable assumptions, not certified material data. Overrides apply to this report; export it to preserve them. Open, inconsistent, degenerate or composite meshes do not receive a mass estimate.</p><div class="tableWrap"><table><thead><tr><th>Part</th><th>Density kg/m³</th><th>Topology / estimates</th></tr></thead><tbody>${records.map((r,i)=>`<tr><td>${esc(r.name)}</td><td><input id="density_${i}" aria-label="Density for ${esc(r.name)}" type="number" min="1" max="50000" value="${StudioManufacturing.densities[r.material]||''}" placeholder="Required"></td><td id="meshStats_${i}"></td></tr>`).join('')}</tbody></table></div><p id="massTotals" role="status"></p><p id="meshWarnings"></p><p id="meshInspectError" role="alert"></p><button type="button" id="downloadInspection">Export inspection JSON</button><button type="button" id="checkedSTL">Export checked STL</button><p class="tiny">Topology checks weld at 0.00001 mm. They do not detect every self-intersection, internal overlap, thin wall, tolerance or process problem. Centre of mass assumes homogeneous density. Checked STL still needs external slicer/CAD review. Existing toolbar STL/OBJ remain reference exports.</p>`,()=>false);
    let report;const update=()=>{try{const results=records.map((r,i)=>{const value=document.getElementById('density_'+i).value,density=value===''?null:Number(value),stats=StudioManufacturing.inspect(r.positions,density);if(r.meshCount>1)stats.massKg=null;document.getElementById('meshStats_'+i).textContent=`${stats.closed?'Closed, consistently oriented':'Mesh issues'} · ${stats.triangles} triangles · boundary ${stats.boundaryEdges}, nonmanifold ${stats.nonmanifoldEdges}, degenerate ${stats.degenerateTriangles}, duplicate ${stats.duplicateTriangles}${stats.massKg!==null?' · '+stats.massKg.toFixed(6)+' kg':''}${r.meshCount>1?' · composite: volume/mass requires union review':''}`;return {id:r.id,name:r.name,material:r.material,meshCount:r.meshCount,...stats};});const overlaps=[];for(let i=0;i<results.length;i++)for(let j=i+1;j<results.length;j++)if([0,1,2].every(k=>Math.min(results[i].boundsMm.max[k],results[j].boundsMm.max[k])-Math.max(results[i].boundsMm.min[k],results[j].boundsMm.min[k])>1e-5))overlaps.push([results[i].name,results[j].name]);report={units:'mm',coordinateSystem:'Y-up editor; STL/OBJ exports are Z-up',densityUnits:'kg/m3',parts:results,aggregate:StudioManufacturing.aggregate(results),possibleOverlaps:overlaps,manufacturingCertified:false,limits:'Topological screening only; no general self-intersection, wall thickness, tolerance or process validation.'};document.getElementById('massTotals').textContent=report.aggregate.massKg===null?'Assembly mass unavailable: resolve mesh/density/composite issues.':`Sum of part mass estimates: ${report.aggregate.massKg.toFixed(6)} kg · Centre of mass X/Y/Z: ${report.aggregate.centreOfMassMm.map(v=>v.toFixed(3)).join(' / ')} mm`;document.getElementById('meshWarnings').textContent=overlaps.length?`${overlaps.length} overlapping bounding-box pairs require review. Part-volume sums can double-count overlap; this is not a union volume.`:'No overlapping world bounding boxes detected. This does not certify fit or fabrication.';document.getElementById('meshInspectError').textContent='';document.getElementById('checkedSTL').disabled=results.some(r=>!r.closed||r.globallyReversed||r.meshCount>1)||overlaps.length>0;}catch(e){report=null;document.getElementById('meshInspectError').textContent=e.message;document.getElementById('checkedSTL').disabled=true;}};
    document.querySelector('#modalForm>button[type=submit]').textContent='Recalculate';document.getElementById('modalForm').onsubmit=e=>{e.preventDefault();update();};records.forEach((r,i)=>document.getElementById('density_'+i).onchange=update);document.getElementById('downloadInspection').onclick=()=>{if(report)_download('mesh-inspection.json',JSON.stringify(report,null,2),'application/json');};document.getElementById('checkedSTL').onclick=()=>{if(!report||document.getElementById('checkedSTL').disabled)return;exportSTL();};update();
  }

  /* ─── STL & OBJ Exporters ─────────────────────────────────────── */
  function exportSTL() {
    if(attachment)return _toast('Apply or cancel the attachment preview before exporting.');
    if (!objects.some(o=>o.visible)) { _toast('No visible parts to export'); return; }
    assembledView();
    const T = window.THREE;
    let stl = 'solid assembly_mm_z_up\n';
    objects.forEach(rec => {
      if (!rec.visible) return;
      rec.obj3d.updateMatrixWorld(true);
      rec.obj3d.traverse(child => {
        if (!child.isMesh) return;
        const geo = child.geometry, mat = child.matrixWorld, pos = geo.attributes.position, idx = geo.index;
        const vert = i => new T.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mat).multiplyScalar(10).applyAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
        const tri = (a, b, c) => {
          const va = vert(a), vb = vert(b), vc = vert(c);
          const n = new T.Vector3().subVectors(vb, va).cross(new T.Vector3().subVectors(vc, va)).normalize();
          stl += `facet normal ${n.x.toFixed(6)} ${n.y.toFixed(6)} ${n.z.toFixed(6)}\n outer loop\n  vertex ${va.x.toFixed(6)} ${va.y.toFixed(6)} ${va.z.toFixed(6)}\n  vertex ${vb.x.toFixed(6)} ${vb.y.toFixed(6)} ${vb.z.toFixed(6)}\n  vertex ${vc.x.toFixed(6)} ${vc.y.toFixed(6)} ${vc.z.toFixed(6)}\n endloop\nendfacet\n`;
        };
        if (idx) { for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)); }
        else { for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2); }
      });
    });
    stl += 'endsolid assembly_mm_z_up\n';
    _download('assembly.stl', stl, 'model/stl');
    _toast('STL exported');
  }

  function exportOBJ() {
    if(attachment)return _toast('Apply or cancel the attachment preview before exporting.');
    if (!objects.some(o=>o.visible)) { _toast('No visible parts to export'); return; }
    assembledView();
    const T = window.THREE;
    let obj = '# AI Engineering Design Studio – reference mesh; units mm; Z up; visible parts only\n', vo = 1;
    objects.forEach(rec => {
      if (!rec.visible) return;
      obj += `o ${rec.name.replace(/[^a-zA-Z0-9_-]/g,'_')}\n`;
      rec.obj3d.updateMatrixWorld(true);
      const faces = [];
      rec.obj3d.traverse(child => {
        if (!child.isMesh) return;
        const geo = child.geometry, mat = child.matrixWorld, pos = geo.attributes.position, idx = geo.index;
        for (let i = 0; i < pos.count; i++) {
          const v = new T.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mat).multiplyScalar(10).applyAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
          obj += `v ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}\n`;
        }
        const cnt = idx ? idx.count : pos.count;
        for (let i = 0; i < cnt; i += 3) {
          const a = (idx ? idx.getX(i) : i) + vo;
          const b = (idx ? idx.getX(i + 1) : i + 1) + vo;
          const c = (idx ? idx.getX(i + 2) : i + 2) + vo;
          faces.push(`f ${a} ${b} ${c}`);
        }
        vo += pos.count;
      });
      obj += faces.join('\n') + '\n';
    });
    _download('assembly.obj', obj, 'model/obj');
    _toast('OBJ exported');
  }

  /* ─── Context Menu ───────────────────────────────────────────── */
  function showCtx(x, y) {
    document.getElementById('v3dCtx')?.remove();ctxController?.abort();ctxController=new AbortController();
    const m = document.createElement('div');
    m.className = 'v3d-ctx';
    m.id = 'v3dCtx';
    m.style.cssText = `left:${x}px;top:${y}px`;
    const rec = objects.find(o => o.id === selId);
    m.innerHTML = rec
      ? `<button data-a="dup">Duplicate</button><button data-a="hide">${rec.visible ? 'Hide' : 'Show'}</button><button data-a="wire">${rec.wireframe ? 'Solid' : 'Wireframe'}</button><hr><button data-a="del" style="color:#e07878">Delete</button>`
      : `<button data-a="clear">Clear Scene</button>`;
    document.body.appendChild(m);

    m.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      m.remove();ctxController?.abort();
      const a = b.dataset.a;
      if (a === 'dup') dupSelected();
      else if (a === 'del') delSelected();
      else if (a === 'clear') clearAll();
      else if (a === 'hide') {
        assembledView();
        const r = objects.find(o => o.id === selId);
        if (r) { r.visible = !r.visible; r.obj3d.visible = r.visible; refreshAsm(); renderInsp(); saveScene(); }
      } else if (a === 'wire') {
        const r = objects.find(o => o.id === selId);
        if (r) {
          r.wireframe = !r.wireframe;
          r.obj3d.traverse(c => { if (c.isMesh && c.material) c.material.wireframe = r.wireframe; });
          renderInsp();
          saveScene();
        }
      }
    });

    const close = e => {
      if (!m.contains(e.target)) {
        m.remove();
        document.removeEventListener('mousedown', close);
      }
    };
    setTimeout(()=>{if(m.isConnected)document.addEventListener('mousedown',close,{signal:ctxController.signal});},0);
  }

  /* ─── Event Binding ──────────────────────────────────── */
  function bindEditor() {
    const on = (id, fn) => { const el = document.getElementById(id); if(el)el.onclick=fn; };
    on('openMeshImport',openMeshImport);on('openPersonalParts',openPersonalParts);renderAssemblyTools();
    on('inspectManufacturing',inspectManufacturing);on('engineeringLab',()=>StudioEngineering.open());on('projectServices',()=>StudioServices.open({modelPart: draft=>insertRecord({id:uid(),partId:'custom_solid',name:draft.name,dims:{depth:draft.depth},model:draft.model,material:'Aluminium 6061',position:[0,0,0],rotation:[0,0,0],visible:true,wireframe:false})}));
    on('tb-model',()=>modelPart());on('startCustomSolid',()=>modelPart());on('faceWorkPlane',()=>{facePicking=true;measureMode=false;assembledView();setMode('select');_toast('Click a mesh face. The picked triangle normal defines a saved, independent work plane.');});on('manufacturingTools',()=>{try{StudioManufacturingTools.open(manufacturingRecords(),async part=>insertRecord({id:uid(),partId:'imported_mesh',name:part.name,dims:{scale:1},mesh:part.mesh,material:part.material,position:[0,0,0],rotation:[0,0,0],visible:true,wireframe:false}));}catch(e){_toast(e.message);}});on('tb-edit-model',()=>selId?modelPart(selId):_toast('Select a custom solid first.'));
    on('tb-move',()=>setMode('move'));on('tb-rotate',()=>setMode('rotate'));const snap=document.getElementById('tb-snap');if(snap)snap.onchange=e=>{snapTransforms=e.target.checked;syncTransformHandles()};
    const stage=document.getElementById('droneStage');if(stage)stage.onchange=e=>setAssemblyStage(Number(e.target.value));
    on('dronePrevious',()=>setAssemblyStage(assemblyStage-1));on('droneNext',()=>setAssemblyStage(assemblyStage+1));on('droneComplete',()=>setAssemblyStage(6));refreshAssemblyGuide();

    // Modes & camera
    on('tb-orbit', () => setMode('orbit'));
    on('tb-select', () => setMode('select'));
    on('tb-top', () => setCam('top'));
    on('tb-front', () => setCam('front'));
    on('tb-iso', () => setCam('iso'));on('tb-fit',fitAssembly);

    // Actions
    on('tb-dup', dupSelected);
    on('tb-del', delSelected);
    on('tb-clear', clearAll);
    on('tb-explode', toggleExplode);
    on('tb-wireframe', () => {
      objects.forEach(o => {
        o.wireframe = !o.wireframe;
        o.obj3d.traverse(c => { if (c.isMesh && c.material) c.material.wireframe = o.wireframe; });
      });
      _toast('Toggled wireframe');
      saveScene();
    });
    on('tb-extrude2d', extrude2DSketch);

    // Export
    on('tb-stl', exportSTL);
    on('tb-obj', exportOBJ);
    on('tb-syncbom', syncBOM);on('tb-undo',()=>undoStudio());on('tb-redo',()=>undoStudio(true));
    on('ispStl', exportSTL);
    on('ispObj', exportOBJ);
    on('ispSync', syncBOM);

    // Viewport controls
    on('v3dResetCam', () => {
      setCam('iso');
    });
    on('v3dGridBtn', () => {
      if (gridHelper) gridHelper.visible = !gridHelper.visible;
      document.getElementById('v3dGridBtn').setAttribute('aria-pressed',String(gridHelper?.visible!==false));
    });

    bindUsability();bindWorkbench();
    // Parts catalogue insertion
    document.querySelectorAll('[data-insert]').forEach(el =>
      el.onclick=()=>place(el.dataset.insert)
    );

    // Filter catalogue
    const search=document.getElementById('partsSearch');if(search)search.oninput=filterCatalogue;const categoryFilter=document.getElementById('partsCategory');if(categoryFilter)categoryFilter.onchange=filterCatalogue;filterCatalogue();


    // Viewport click & raycaster tracking
    const vp = document.getElementById('vp3d');
    if (vp) {
      vp.onclick=e=>{if(!e.target.closest('button')&&!dragged)pick(e)};vp.onpointerdown=e=>{pointerStart=[e.clientX,e.clientY];dragged=false;if(attachment?.kind==='drag')dragAttachmentStart(e);};vp.onpointermove=e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)dragged=true;if(attachment?.dragging)dragAttachmentMove(e);};vp.onpointerup=e=>{if(attachment?.dragging)dragAttachmentEnd(e);};vp.onpointercancel=()=>stopAttachment();vp.ondblclick=e=>{if(!attachment){pick(e);focusSelected();}};
      vp.oncontextmenu=e=>{
        e.preventDefault();
        if (mode === 'select') showCtx(e.clientX, e.clientY);
      };
      vp.onmousemove=e=>{
        if (!raycaster || !camera || !window.THREE) return;
        const canvas = document.getElementById('v3dCanvas');
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const my = -((e.clientY - r.top) / r.height) * 2 + 1;
        raycaster.setFromCamera({ x: mx, y: my }, camera);
        const plane = new window.THREE.Plane(new window.THREE.Vector3(0, 1, 0), 0);
        const hit = new window.THREE.Vector3();
        const intersection=raycaster.ray.intersectPlane(plane, hit);
        const el = document.getElementById('v3dCoords');
        if (el && intersection && Math.abs(camera.position.y)>1e-6) {
          el.textContent = `X ${(hit.x * 10).toFixed(0)} · Y ${(hit.y * 10).toFixed(0)} · Z ${(hit.z * 10).toFixed(0)} mm`;
        }else if(el)el.textContent='Ground plane outside view';
      };
    }

    // Keyboard shortcuts
    const onKey = e => {
      if(!isActive()||!editorReady||document.getElementById('dialog')?.open||e.target.isContentEditable)return;
      if(e.key==='Escape'&&(attachment||focusMode)){e.preventDefault();if(attachment)stopAttachment();else toggleWorkspaceFocus(false);return;}
      if (e.target.closest('input, textarea, select')) return;
      if((e.ctrlKey||e.metaKey)&&e.key==='/'){e.preventDefault();findWorkbenchTool();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();dupSelected();return;}
      // Preserve browser find, save, print and tab shortcuts. Plain tool keys are local.
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSelected(); }
      else if (e.key === 'Escape') { facePicking=false;if(attachment)stopAttachment();else if(focusMode)toggleWorkspaceFocus(false);else select(null); }
      else if (e.key === '1') { setCam('top'); }
      else if (e.key === '2') { setCam('front'); }
      else if (e.key === '3') { setCam('iso'); }
      else if(e.key.toLowerCase()==='f'){if(selectedIds.size)focusSelected();else fitAssembly();}
      else if (e.key.toLowerCase() === 'o') { setMode('orbit'); }
      else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) { setMode('select'); }
      else if (e.key.toLowerCase() === 'w') {
        objects.forEach(o => {
          o.wireframe = !o.wireframe;
          o.obj3d.traverse(c => { if (c.isMesh && c.material) c.material.wireframe = o.wireframe; });
        });saveScene();
      }
    };
    if(keyHandler)window.removeEventListener('keydown',keyHandler);keyHandler=onKey;window.addEventListener('keydown',keyHandler);
  }

  /* ─── Enter / Re-enter Tab ───────────────────────────────────── */
  function clearSceneObjectsSafe(){if(scene)clearSceneObjects();}
  function pauseEditor(){stopAttachment(false);if(focusMode)toggleWorkspaceFocus(false);if(raf!==null){cancelAnimationFrame(raf);raf=null;}vpObserver?.disconnect();if(controls)controls.enabled=false;if(transformControls)transformControls.enabled=false;document.getElementById('v3dCtx')?.remove();ctxController?.abort();}
  function isActive(){return page==='3d'&&!document.body.classList.contains('productMode')&&!!document.getElementById('vp3d')?.isConnected&&projects.length>0;}
  async function enterEditor(){
    const ticket=++entrySequence,project=current?.id;
    try{
      await ensureThree();
      if(current.assembly3d?.objects.some(o=>o.partId==='custom_solid')){await ensureSolids();for(const part of current.assembly3d.objects)if(part.model)await StudioSolidModel.prepare(part.model,part.dims.depth);}
      if(ticket!==entrySequence||project!==current?.id||!isActive())return;
      const changed=!editorReady||!renderer||loadedProjectId!==current.id;
      if(!editorReady||!renderer)initScene();else attachCanvas();
      loadScene();
      const vp=document.getElementById('vp3d');observeViewport(vp);
      camera.aspect=Math.max(1,vp.clientWidth)/Math.max(1,vp.clientHeight);camera.updateProjectionMatrix();renderer.setSize(Math.max(1,vp.clientWidth),Math.max(1,vp.clientHeight),false);
      if(changed)fitAssembly();
      bindEditor();setMode(mode);select(selId);renderCatalogueThumbnails();refreshBom();updateEmpty();refreshUndoButtons();
      const loading=document.getElementById('v3dLoad');if(loading)loading.style.display='none';
      if(raf===null)loop();
    }catch(error){
      pauseEditor();
      const loading=document.getElementById('v3dLoad');
      if(document.getElementById('downloadLegacy3d'))return;
      if(loading&&ticket===entrySequence){loading.style.display='flex';loading.innerHTML='<h3>Unable to open the 3D workspace</h3><p id="v3dError" role="alert"></p><button id="retry3dBtn">Retry 3D workspace</button>';document.getElementById('v3dError').textContent=error.message;document.getElementById('retry3dBtn').onclick=enterEditor;}
    }
  }
  function registerAndRender(){
    if(!tabs.some(([id])=>id==='3d'))tabs.push(['3d','3D Editor']);
    if(!quickActions.some(([name])=>name==='Open 3D Editor'))quickActions.push(['Open 3D Editor',()=>location.hash='/workspace?tool=3d']);
    if(!render._3dPatched){const previous=render;render=function(){pauseEditor();previous();const active=page==='3d'&&projects.length&&!document.body.classList.contains('productMode');document.body.classList.toggle('studio3dActive',!!active);if(active){document.getElementById('content').innerHTML=tabHTML();enterEditor();}};render._3dPatched=true;}

  }
  if(!studioGuides.some(([name])=>name==='3D parts & assemblies'))studioGuides.push(['3D parts & assemblies','Preview & size changes a concept part before insertion. Click a mesh to select it in Orbit mode. Attach faces picks a moving face and target face, previews gap/turn and applies a fixed connection. Drag & snap moves a placed part onto a surface; desktop users can also drag library parts onto the canvas. Expand workspace, Focus selected, Isolate and assembly search help with larger scenes. Detach before repositioning an attached part; recheck contact after resizing. Undo/redo, backups and JSON exports include the assembly. STL/OBJ export visible assembled parts in millimetres, Z-up. These are simplified meshes; threads, fits, exact manufacturer specifications and fabrication readiness are not validated.','3d']);
  registerAndRender();


})();
