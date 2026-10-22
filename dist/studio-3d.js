/* ═══════════════════════════════════════════════════════════════
   Studio 3D Editor  –  Three.js visual workspace  (v8.0)
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
    const root=new window.THREE.Group();root.add(buildGeometry(p));return root;
  }
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
      <div class="parts-category">${c.cat}</div>
      ${c.parts.map(p => `
        <button type="button" class="part-item" data-insert="${p.id}" title="${p.name} · ${p.desc}">
          <div class="part-icon" style="color:${hex(p.col)}">${icon(p.icon)}</div>
          <div class="part-item-info"><strong>${p.name}</strong><small>${p.desc}</small></div>
        </button>`).join('')}`).join('');

    const tbBtn = (id, label, svgPath, active = '') =>
      `<button id="${id}" class="${active}" title="${label}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${svgPath}"/></svg> ${label}</button>`;

    return `
<div class="v3dCreateBar"><button class="primary" id="startCustomSolid">＋ Draw your own 3D part</button><span>Profile → extrude → cut / join → edit → save</span><a href="#/templates">Browse assembly starters →</a></div><p class="v3dDisclaimer">Custom solids retain editable modelling recipes. Catalogue parts remain simplified concept meshes. Exports: visible parts, mm, Z-up; physical fits and manufacturing readiness require review.</p>${assemblyGuide()}<div class="editor3d" id="editor3d">

  <!-- Toolbar -->
  <div class="editor3d-toolbar">
    <span class="tb-label">VIEW</span><button id="tb-undo" title="Undo 3D edit">↶ Undo</button><button id="tb-redo" title="Redo 3D edit">↷ Redo</button>
    ${tbBtn('tb-orbit','Orbit','M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3','active')}
    ${tbBtn('tb-top','Top','M3 3h18v18H3zM3 9h18M9 3v18')}
    ${tbBtn('tb-front','Front','M3 3h18v18H3zM3 12h18M12 3v18')}
    ${tbBtn('tb-iso','Iso','M2 16 12 4l10 12M2 16l10 4 10-4M12 4v16')}<button id="tb-fit" title="Frame all visible parts">Fit assembly</button>
    <div class="tb-sep"></div>
    <span class="tb-label">TOOLS</span><button id="tb-model">＋ Create solid</button><button id="tb-edit-model">Edit solid</button><button id="tb-move">Move</button><button id="tb-rotate">Rotate</button><label class="tbSnap"><input id="tb-snap" type="checkbox" ${snapTransforms?'checked':''}> Snap 1 mm / 15°</label>
    ${tbBtn('tb-select','Select','m4 4 7 18 3-7 7-3z')}
    ${tbBtn('tb-explode','Explode','M5 9 2 12l3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3')}
    ${tbBtn('tb-wireframe','Wireframe','M2 16 12 4l10 12M2 16l10 4 10-4M12 4v16')}
    ${tbBtn('tb-extrude2d','Extrude 2D','M12 2v20M2 12h20M4 4l16 16')}
    <div class="tb-sep"></div>
    <span class="tb-label">PARTS</span>
    ${tbBtn('tb-dup','Duplicate','M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1')}
    ${tbBtn('tb-del','Delete','M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6')}
    ${tbBtn('tb-clear','Clear','M3 3l18 18M9 9v6M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6')}
    <div class="tb-sep"></div>
    <span class="tb-label">EXPORT</span>
    ${tbBtn('tb-stl','STL','M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3')}
    ${tbBtn('tb-obj','OBJ','M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3')}
    ${tbBtn('tb-syncbom','Sync BOM','M4 6h16M4 12h16M4 18h7m7-3 3 3 4-4')}
    <div class="tb-coords" id="v3dCoords">X — · Y — · Z — mm</div>
  </div>

  <!-- Parts library -->
  <div class="editor3d-parts">
    <div class="editor3d-parts-head">
      <span>CONCEPT PARTS LIBRARY</span>
      <span style="color:#5a8a68">${ALL_PARTS.length} parts</span>
    </div>
    <input aria-label="Search 3D parts" class="parts-search" id="partsSearch" placeholder="Filter library…" autocomplete="off">
    <div id="partsList">${partsPanel}</div>
  </div>

  <!-- Three.js viewport -->
  <div class="editor3d-viewport" id="vp3d">
    <div class="v3d-loading" id="v3dLoad"><div class="v3d-spinner"></div><p>Loading 3D workspace…</p></div>
    <canvas aria-label="3D assembly viewport" id="v3dCanvas" style="width:100%;height:100%;display:block;outline:none"></canvas>

    <div class="viewport3d-overlay v3d-top-left">
      <div class="v3d-badge">3D WORKSPACE <strong>WebGL</strong></div>
      <div class="v3d-badge" id="v3dSel" style="display:none">◈ <strong id="v3dSelName"></strong></div>
    </div>
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
      <p>Click any part in the library to place it</p>
      <small>Rotate: left-drag · Pan: right-drag / shift+drag · Zoom: wheel</small>
    </div>
  </div>

  <!-- Inspector -->
  <div class="editor3d-inspector">
    <div class="inspector-head">INSPECTOR</div>
    <div id="insp3d"><div class="inspector-none">Select an object to inspect its dimensions, position and material.</div></div>

    <div style="padding:10px 14px 4px;font-size:9px;letter-spacing:1.4px;color:#4a7060;border-top:1px solid #1e2e28">ASSEMBLY TREE</div>
    <div class="assembly-list" id="asmList"></div>

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

</div>`;
  }

  /* ─── Scene Persistence Per Project ──────────────────────────── */
  function sceneData(){return {version:1,units:'mm',objects:objects.map(o=>({id:o.id,partId:o.def.id,name:o.name,dims:structuredClone(o.def.dims),...(o.def.model?{model:structuredClone(o.def.model)}:{}),material:o.def.mat,position:(o._prePos&&exploded?o._prePos:o.obj3d.position).toArray().map(v=>v*10),rotation:[o.obj3d.rotation.x,o.obj3d.rotation.y,o.obj3d.rotation.z].map(v=>v*180/Math.PI),visible:o.visible,wireframe:o.wireframe}))};}
  let loadedProjectId=null,loadedSignature=null,entrySequence=0,sceneBlocked=false;
  function saveScene(){
    if(sceneBlocked||!current?.id||current.id!==loadedProjectId)return false;
    const data=sceneData();
    if(!StudioAssembly.validate(data)){_toast('Invalid assembly values. Correct the edit before saving.');return false;}
    current.assembly3d=data;loadedSignature=JSON.stringify(data);
    const result=persist();
    refreshAssemblyGuide();
    refreshUndoButtons();
    return result;
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
    const signature=JSON.stringify(data);
    if(loadedProjectId===current.id&&loadedSignature===signature){setAssemblyStage(6,false);return;}
    const next=[];
    try{for(const item of data.objects){
      const base=ALL_PARTS.find(p=>p.id===item.partId),def={...structuredClone(base),dims:structuredClone(item.dims),...(item.model?{model:structuredClone(item.model)}:{}),mat:item.material,col:MAT_COLORS[item.material]};
      const obj3d=build(def);obj3d.position.fromArray(item.position.map(v=>v/10));obj3d.rotation.set(...item.rotation.map(v=>v*Math.PI/180));
      const record={id:item.id,name:item.name,def,obj3d,visible:item.visible,wireframe:item.wireframe};applyRecordAppearance(record);next.push(record);
    }}catch(error){next.forEach(o=>disposeObject(o.obj3d));throw error;}
    clearSceneObjects();objects=next;objects.forEach(o=>scene.add(o.obj3d));loadedProjectId=current.id;loadedSignature=signature;
    select(null);updateEmpty();refreshAsm();refreshBom();refreshAssemblyGuide();
    if(migrated){current.assembly3d=data;persist();_toast('Legacy 3D scene added to the project. Its original browser copy is retained.');}
  }
  function clearSceneObjects(){loadedProjectId=null;loadedSignature=null;objects.forEach(o=>{scene.remove(o.obj3d);disposeObject(o.obj3d)});objects=[];selId=null;exploded=false;assemblyStage=6;}
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
    renderer.setClearColor(0x141c18);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    attachCanvas();

    scene = new T.Scene();
    scene.fog = new T.Fog(0x141c18, 90, 220);

    camera = new T.PerspectiveCamera(45, W / H, 0.01, 100000);
    camera.position.set(8, 6, 10);
    camera.lookAt(0, 0, 0);

    // Lights
    scene.add(new T.AmbientLight(0xd4eade, 0.95));
    scene.add(new T.HemisphereLight(0xe4f0eb,0x75917d,1.1));
    const sun = new T.DirectionalLight(0xffffff, 1.25);
    sun.position.set(12, 22, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    ['left', 'right', 'top', 'bottom'].forEach((k, i) => { sun.shadow.camera[k] = [-20, 20, 20, -20][i]; });
    scene.add(sun);

    const fill = new T.DirectionalLight(0x8daea5, 0.75);
    fill.position.set(-10, 6, -10);
    scene.add(fill);

    // Ground plane & grid
    gridHelper = new T.GridHelper(40, 40, 0x22382e, 0x182820);
    gridHelper.position.y = -0.005;
    scene.add(gridHelper);

    const ground = new T.Mesh(
      new T.PlaneGeometry(80, 80),
      new T.MeshStandardMaterial({ color: 0x24372b, roughness: 1.0, metalness: 0.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    scene.add(new T.AxesHelper(2));

    controls = new T.OrbitControls(camera, renderer.domElement);
    controls.minDistance=.5;controls.maxDistance=50000;controls.maxPolarAngle=Math.PI*.95;
    transformControls=new T.TransformControls(camera,renderer.domElement);transformControls.setSize(.8);scene.add(transformControls);
    transformControls.addEventListener('mouseDown',()=>{const rec=objects.find(o=>o.id===selId);if(rec)dragStart={id:rec.id,position:rec.obj3d.position.clone(),rotation:rec.obj3d.rotation.clone()};});
    transformControls.addEventListener('dragging-changed',e=>{controls.enabled=!e.value&&mode==='orbit';});
    transformControls.addEventListener('mouseUp',()=>{const rec=objects.find(o=>o.id===dragStart?.id);if(!rec)return;const position=rec.obj3d.position.toArray(),rotation=[rec.obj3d.rotation.x,rec.obj3d.rotation.y,rec.obj3d.rotation.z];if(position.some(v=>!Number.isFinite(v)||Math.abs(v)>10000)||rotation.some(v=>!Number.isFinite(v)||Math.abs(v)>Math.PI*20)){rec.obj3d.position.copy(dragStart.position);rec.obj3d.rotation.copy(dragStart.rotation);_toast('Transform exceeds the supported position or rotation limits.');}else saveScene();dragStart=null;renderInsp();});
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
  async function modelPart(id){
    if(sceneBlocked||!editorReady||current?.id!==loadedProjectId)return _toast('Open a project in the 3D editor first.');
    const rec=id?objects.find(o=>o.id===id):null,project=current.id;
    if(id&&!rec?.def.model)return _toast('Select a custom solid to edit its profile and features.');
    if(!rec&&objects.length>=200)return _toast('Assemblies support up to 200 parts.');
    try{await ensureSolids();if(current.id!==project||!isActive())return;
      StudioSolidEditor.open({model:rec?.def.model,depth:rec?.def.dims.depth,name:rec?.name,onCommit:draft=>{
        if(current.id!==project||sceneBlocked)throw Error('The active project changed. Reopen the modeller.');
        const def={...structuredClone(rec?.def||ALL_PARTS.find(p=>p.id==='custom_solid')),model:draft.model,dims:{depth:draft.depth}},obj3d=build(def);
        assembledView();
        if(rec){obj3d.position.copy(rec.obj3d.position);obj3d.rotation.copy(rec.obj3d.rotation);scene.remove(rec.obj3d);disposeObject(rec.obj3d);rec.obj3d=obj3d;rec.def=def;rec.name=draft.name;applyRecordAppearance(rec);scene.add(obj3d);select(rec.id);}
        else{const T=window.THREE,bounds=new T.Box3().setFromObject(obj3d);obj3d.position.y=-bounds.min.y;if(objects.length){const occupied=new T.Box3();objects.forEach(o=>occupied.union(new T.Box3().setFromObject(o.obj3d)));obj3d.position.x=occupied.max.x-bounds.min.x+1;}const record={id:uid(),name:draft.name,def,obj3d,visible:true,wireframe:false};applyRecordAppearance(record);objects.push(record);scene.add(obj3d);select(record.id);}
        updateEmpty();refreshAsm();refreshBom();saveScene();fitAssembly();_toast('Custom solid saved with editable profile and feature history.');
      }});
    }catch(e){_toast(e.message);}
  }
  function place(partId) {
    if(partId==='custom_solid')return modelPart();
    if(sceneBlocked||!editorReady)return _toast('Resolve the 3D loading error first.');
    if(objects.length>=200)return _toast('Assemblies support up to 200 parts.');
    assembledView();
    const def = ALL_PARTS.find(p => p.id === partId);
    if (!def || !editorReady) {
      if (!editorReady) _toast('3D engine is loading…');
      return;
    }
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

  /* ─── Selection & Picking ────────────────────────────────────── */
  function select(id) {
    const target=objects.find(o=>o.id===id);if(target?.visible&&!target.obj3d.visible)setAssemblyStage(6,false);
    objects.forEach(o => o.obj3d.traverse(c => {
      if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0);
    }));
    selId = id;
    const rec = objects.find(o => o.id === id);
    if (rec) {
      rec.obj3d.traverse(c => {
        if (c.isMesh && c.material?.emissive) c.material.emissive.setHex(0x1e4e2a);
      });
      const badge = document.getElementById('v3dSel');
      if (badge) {
        badge.style.display = '';
        document.getElementById('v3dSelName').textContent = rec.name;
      }
    } else {
      const badge = document.getElementById('v3dSel');
      if (badge) badge.style.display = 'none';
    }
    refreshAsm();
    renderInsp();
    syncTransformHandles();
  }
  function syncTransformHandles(){
    if(!transformControls)return;
    const rec=objects.find(o=>o.id===selId),active=['move','rotate'].includes(mode)&&!!rec?.obj3d.visible&&!exploded;
    transformControls.enabled=active;transformControls.setTranslationSnap(snapTransforms?0.1:null);transformControls.setRotationSnap(snapTransforms?Math.PI/12:null);
    if(active){transformControls.setMode(mode==='move'?'translate':'rotate');transformControls.attach(rec.obj3d);}else transformControls.detach();
  }

  function pick(e) {
    if(mode==='orbit'||transformControls?.dragging||['move','rotate'].includes(mode)&&transformControls?.axis||!raycaster||!camera)return;
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
      const hit = hits[0].object;
      const rec = objects.find(o => {
        let match = false;
        o.obj3d.traverse(c => { if (c === hit) match = true; });
        return match;
      });
      if (rec) { select(rec.id); return; }
    }
    select(null);
  }

  /* ─── Inspector ──────────────────────────────────────────────── */
  function renderInsp() {
    const el = document.getElementById('insp3d');
    if (!el) return;
    const rec = objects.find(o => o.id === selId);
    if (!rec) {
      el.innerHTML = `<div class="inspector-none">Select an object to inspect its dimensions, position and material.</div>`;
      return;
    }
    const d = rec.def.dims;
    const dimRows = Object.entries(d).map(([k, v]) =>
      `<div class="dim-field"><label for="dim_${k}">${DIM_LABELS[k] || k}</label><input type="number" id="dim_${k}" value="${v}" min="${k==='teeth'?6:0.1}" max="${k==='teeth'?120:5000}" step="${k==='teeth'?1:0.1}"></div>`
    ).join('');
    const matBtns = Object.keys(MAT_COLORS).map(m =>
      `<button class="mat-btn${rec.def.mat === m ? ' active' : ''}" data-mat="${m}">${m}</button>`
    ).join('');
    const pos = rec.obj3d.position;
    const rot = rec.obj3d.rotation;

    el.innerHTML = `
      <div class="inspector-section"><h4>Part Label</h4>
        <div class="dim-field"><label for="insp-name">Name</label><input type="text" id="insp-name" value="${esc(rec.name)}" maxlength="80"></div>
      </div>
      <div class="inspector-section"><h4>Dimensions · mm</h4>
        <div class="dim-grid">${dimRows}</div>
        <button class="dim-apply" id="applyDims">↻ Rebuild geometry</button>
        ${rec.def.model?'<button class="dim-apply" id="insp-model">Edit profile & features</button>':''}
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
    bindInsp(rec);
    document.getElementById('applyPos').disabled=exploded;document.getElementById('applyRot').disabled=exploded;
  }

  function bindInsp(rec) {
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
      <div class="asm-item${o.id === selId ? ' selected' : ''}" data-asm="${esc(o.id)}">
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
    }else el.innerHTML=objects.map(row).join('');

    el.querySelectorAll('[data-asm]').forEach(item => item.onclick = e => {
      if (e.target.closest('[data-vis]')) return;
      select(item.dataset.asm);
    });

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
    if(['move','rotate'].includes(m))assembledView();
    mode = m;
    if (controls) controls.enabled = (m === 'orbit');
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

  /* ─── STL & OBJ Exporters ─────────────────────────────────────── */
  function exportSTL() {
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
    on('tb-model',()=>modelPart());on('startCustomSolid',()=>modelPart());on('tb-edit-model',()=>selId?modelPart(selId):_toast('Select a custom solid first.'));
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
    });

    // Parts catalogue insertion
    document.querySelectorAll('[data-insert]').forEach(el =>
      el.onclick=()=>place(el.dataset.insert)
    );

    // Filter catalogue
    const search=document.getElementById('partsSearch');if(search)search.oninput=e=>{
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.part-item').forEach(el => {
        const strong = el.querySelector('strong')?.textContent.toLowerCase() || '';
        const small = el.querySelector('small')?.textContent.toLowerCase() || '';
        el.style.display = (strong.includes(q) || small.includes(q)) ? '' : 'none';
      });
    };

    // Viewport click & raycaster tracking
    const vp = document.getElementById('vp3d');
    if (vp) {
      vp.onclick=e=>{if(!e.target.closest('button')&&!dragged)pick(e)};vp.onpointerdown=e=>{pointerStart=[e.clientX,e.clientY];dragged=false};vp.onpointermove=e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)dragged=true};
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
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSelected(); }
      else if (e.key === 'Escape') { select(null); }
      else if (e.key === '1') { setCam('top'); }
      else if (e.key === '2') { setCam('front'); }
      else if (e.key === '3') { setCam('iso'); }
      else if(e.key.toLowerCase()==='f')fitAssembly();
      else if (e.key.toLowerCase() === 'o') { setMode('orbit'); }
      else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) { setMode('select'); }
      else if (e.key.toLowerCase() === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); dupSelected(); }
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
  function pauseEditor(){if(raf!==null){cancelAnimationFrame(raf);raf=null;}vpObserver?.disconnect();if(controls)controls.enabled=false;if(transformControls)transformControls.enabled=false;document.getElementById('v3dCtx')?.remove();ctxController?.abort();}
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
      bindEditor();setMode(mode);select(selId);refreshBom();updateEmpty();refreshUndoButtons();
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
  if(!studioGuides.some(([name])=>name==='3D parts & assemblies'))studioGuides.push(['3D parts & assemblies','Insert a concept part, set dimensions and millimetre positions, and save a project checkpoint. Undo/redo, backups and JSON exports include the assembly. STL/OBJ export visible assembled parts in millimetres, Z-up. These are simplified meshes; threads, fits, exact manufacturer specifications and fabrication readiness are not validated.','3d']);
  registerAndRender();


})();
