/* Bounded, portable assembly model. Distances mm; rotations degrees. */
const StudioAssembly=(()=>{
  const CATALOGUE = [
    {cat:'Create your own',parts:[{id:'custom_solid',name:'Custom solid',desc:'Draw · extrude · cut · join',icon:'enclosure',dims:{depth:12},model:{version:1,plane:'XZ',outline:[[-40,-25],[40,-25],[40,25],[-40,25]],features:[]},mat:'Aluminium 6061',col:0xa8b8c8}]},
    { cat: 'Drone & Multirotor', parts: [
      {id:'quad_plate',name:'Quadcopter frame plate',desc:'Drilled concept centre plate',icon:'plate',dims:{width:80,height:60,thickness:2.5},mat:'Carbon fibre',col:0x303c40},
      {id:'quad_arm',name:'Quadcopter arm',desc:'Tapered arm with mounting holes',icon:'beam',dims:{width:22,length:113.723,thickness:4},mat:'Carbon fibre',col:0x303c40},
      {id:'motor_brushless',name:'Brushless outrunner',desc:'Generic motor envelope',icon:'motor_dc',dims:{diameter:28,length:20,shaftDiameter:5,shaftLength:9},mat:'Aluminium / Steel',col:0xa45b32},
      {id:'propeller_cw',name:'Two-blade propeller · CW',desc:'Illustrative clockwise blade pitch',icon:'shaft',dims:{diameter:127,thickness:2.5,boreDiameter:5},mat:'ABS polymer',col:0x3a4040},
      {id:'propeller_ccw',name:'Two-blade propeller · CCW',desc:'Illustrative counterclockwise pitch',icon:'shaft',dims:{diameter:127,thickness:2.5,boreDiameter:5},mat:'ABS polymer',col:0x3a4040},
      {id:'battery_pack',name:'Drone battery pack',desc:'Envelope only · ratings unspecified',icon:'enclosure',dims:{width:36,height:25,depth:76},mat:'ABS polymer',col:0x35473c},
      {id:'battery_strap',name:'Battery retaining strap',desc:'Rectangular strap envelope',icon:'bracket',dims:{width:40,height:29,depth:12,wallThickness:1},mat:'ABS polymer',col:0x343638},
      {id:'flight_controller',name:'Flight controller board',desc:'30 mm hole pattern · concept',icon:'pcb',dims:{width:36,height:36,thickness:1.6},mat:'FR4',col:0x1a4a28},
      {id:'esc_board',name:'Four-in-one ESC board',desc:'30 mm hole pattern · concept',icon:'pcb',dims:{width:36,height:36,thickness:1.6},mat:'FR4',col:0x1a4a28},
      {id:'screw_cap',name:'Socket cap screw',desc:'Unthreaded M3 concept',icon:'bolt',dims:{diameter:3,length:10,headDiameter:5.5},mat:'Steel',col:0x88948d},
      {id:'washer',name:'Flat washer',desc:'M3 clearance concept',icon:'bearing',dims:{outerDiameter:6,innerDiameter:3.2,thickness:0.6},mat:'Steel',col:0x88948d},
    ]},
    { cat: 'Structural', parts: [
      { id: 'bracket_l',      name: 'L-Bracket',        desc: '90° mount',       icon: 'bracket',   dims: { width: 40, height: 40, thickness: 4 },                 mat: 'Steel',          col: 0x8a9a8a },
      { id: 'plate_flat',     name: 'Flat Plate',       desc: 'Base plate',      icon: 'plate',     dims: { width: 80, height: 60, thickness: 3 },                 mat: 'Aluminium 6061', col: 0xa8b8c8 },
      { id: 'angle_extrusion',name: 'Angle Extrusion',  desc: '20×20 mm profile',icon: 'extrusion', dims: { width: 20, height: 20, length: 100 },                  mat: 'Aluminium 6061', col: 0xb0c0c8 },
      { id: 'beam_box',       name: 'Box Beam',         desc: 'Hollow section',  icon: 'beam',      dims: { width: 30, height: 30, length: 120, thickness: 2 },     mat: 'Steel',          col: 0x909898 },
    ]},
    { cat: 'Rotating', parts: [
      { id: 'shaft_round',    name: 'Round Shaft',      desc: 'Solid cylinder',  icon: 'shaft',     dims: { diameter: 12, length: 100 },                         mat: 'Steel',          col: 0x788888 },
      { id: 'gear_spur',      name: 'Spur Gear',        desc: 'Illustrative teeth',         icon: 'gear',      dims: { diameter: 40, thickness: 10, teeth: 20 },              mat: 'Steel',          col: 0x7a8878 },
      { id: 'pulley',         name: 'Pulley',           desc: 'Belt drive',      icon: 'pulley',    dims: { diameter: 50, width: 15, boreDiameter: 10 },           mat: 'Aluminium 6061', col: 0xa0aab4 },
      { id: 'flange_coupler', name: 'Flange Coupler',   desc: 'Shaft coupling',  icon: 'coupler',   dims: { diameter: 30, length: 25, boreDiameter: 8 },           mat: 'Steel',          col: 0x7a8a88 },
    ]},
    { cat: 'Bearings', parts: [
      { id: 'bearing_ball',   name: 'Ball Bearing',     desc: 'Envelope example',       icon: 'bearing',   dims: { outerDiameter: 52, innerDiameter: 25, width: 15 },     mat: 'Steel',          col: 0x6a7878 },
      { id: 'bearing_flange', name: 'Flange Bearing',   desc: 'Envelope example',     icon: 'bearing',   dims: { outerDiameter: 47, innerDiameter: 25, width: 12, flangeDiameter: 58 }, mat: 'Steel', col: 0x707880 },
      { id: 'linear_bush',    name: 'Linear Bush',      desc: 'Guide example',    icon: 'linear',    dims: { diameter: 21, innerDiameter: 12, length: 30 },         mat: 'Steel',          col: 0x6a7888 },
    ]},
    { cat: 'Fasteners', parts: [
      { id: 'bolt_hex',       name: 'Hex Bolt',         desc: 'M8 × 30 mm',      icon: 'bolt',      dims: { diameter: 8, length: 30, headDiameter: 13 },           mat: 'Steel',          col: 0x7a7a70 },
      { id: 'nut_hex',        name: 'Hex Nut',          desc: 'Unthreaded example',     icon: 'nut',       dims: { diameter: 8, acrossFlats: 13, thickness: 6.5 },        mat: 'Steel',          col: 0x787870 },
      { id: 'standoff',       name: 'Standoff',         desc: 'M3 × 20 mm',      icon: 'standoff',  dims: { diameter: 6, length: 20 },                            mat: 'Brass',          col: 0xc8a840 },
    ]},
    { cat: 'Motors & Actuators', parts: [
      { id: 'motor_nema17',   name: 'NEMA 17 Stepper',  desc: '42 mm frame',     icon: 'motor',     dims: { width: 42, height: 42, length: 40, shaftDiameter: 5, shaftLength: 22 }, mat: 'Aluminium / Steel', col: 0x404a44 },
      { id: 'motor_dc',       name: 'DC Motor',         desc: '12V 37 mm',       icon: 'motor_dc',  dims: { diameter: 37, length: 52, shaftDiameter: 4, shaftLength: 18 }, mat: 'Steel', col: 0x3a3a3a },
      { id: 'servo_std',      name: 'Standard Servo',   desc: 'Servo envelope',       icon: 'servo',     dims: { width: 23, height: 29, length: 12.5 },                 mat: 'ABS polymer',    col: 0x2a2a38 },
    ]},
    { cat: 'Enclosures & PCB', parts: [
      { id: 'enclosure_box',  name: 'Project Enclosure',desc: 'Rectangular shell',icon: 'enclosure',dims: { width: 100, height: 60, depth: 40, wallThickness: 3 },  mat: 'ABS polymer',    col: 0x3a4040 },
      { id: 'enclosure_din',  name: 'DIN Rail Module',  desc: 'TS35 mount',      icon: 'din',       dims: { width: 45, height: 90, depth: 65, wallThickness: 2 },   mat: 'ABS polymer',    col: 0x383838 },
      { id: 'pcb_board',      name: 'PCB Board',        desc: 'Custom substrate',icon: 'pcb',       dims: { width: 80, height: 60, thickness: 1.6 },               mat: 'FR4',            col: 0x1a4a28 },
    ]},
  ];

  const materials=['Steel','Aluminium 6061','ABS polymer','Brass','FR4','Aluminium / Steel','Carbon fibre'];
  const parts=CATALOGUE.flatMap(c=>c.parts);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  function dimensions(id,d){
    const p=parts.find(p=>p.id===id);if(!p||!object(d))return false;
    if(Object.keys(d).length!==Object.keys(p.dims).length||Object.keys(p.dims).some(k=>!finite(d[k])||d[k]<0.1||d[k]>5000))return false;
    if('teeth' in d&&(!Number.isInteger(d.teeth)||d.teeth<6||d.teeth>120))return false;
    if(d.thickness&&d.width&&d.height&&d.thickness>=Math.min(d.width,d.height)/2)return false;
    if(d.wallThickness&&d.wallThickness>=Math.min(d.width,d.height,d.depth)/2)return false;
    if(d.innerDiameter&&d.innerDiameter>=(d.outerDiameter||d.diameter))return false;
    if(d.boreDiameter&&d.boreDiameter>=d.diameter)return false;
    if(d.headDiameter&&d.headDiameter<=d.diameter)return false;
    if(d.acrossFlats&&d.acrossFlats<=d.diameter)return false;
    if(d.flangeDiameter&&d.flangeDiameter<d.outerDiameter)return false;
    return true;
  }
  function validate(a){
    if(!object(a)||a.version!==1||a.units!=='mm'||Object.keys(a).some(k=>!['version','units','objects'].includes(k))||!Array.isArray(a.objects)||a.objects.length>200)return false;
    const ids=new Set();
    return a.objects.every(o=>{
      if(!object(o)||Object.keys(o).some(k=>!['id','partId','name','dims','material','position','rotation','visible','wireframe','model'].includes(k))||typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(o.id)||ids.has(o.id))return false;
      if(o.partId==='custom_solid'?!StudioSolidModel.validate(o.model,o.dims?.depth):o.model!==undefined)return false;
      ids.add(o.id);
      return typeof o.name==='string'&&o.name.length>0&&o.name.length<=80&&materials.includes(o.material)&&dimensions(o.partId,o.dims)&&typeof o.visible==='boolean'&&typeof o.wireframe==='boolean'&&Array.isArray(o.position)&&o.position.length===3&&o.position.every(v=>finite(v)&&Math.abs(v)<=100000)&&Array.isArray(o.rotation)&&o.rotation.length===3&&o.rotation.every(v=>finite(v)&&Math.abs(v)<=3600);
    });
  }
  function legacy(rows){
    if(!Array.isArray(rows))throw Error('Invalid legacy 3D scene');
    const a={version:1,units:'mm',objects:rows.map(o=>{
      const p=parts.find(p=>p.id===o?.def?.id);if(!p)throw Error('Unknown part in legacy scene');
      return {id:o.id,partId:p.id,name:o.name||p.name,dims:{...p.dims,...o.def.dims},material:o.def.mat,position:(o.pos||[0,0,0]).map(v=>v*10),rotation:(o.rot||[0,0,0]).map(v=>v*180/Math.PI),visible:o.visible!==false,wireframe:!!o.wireframe};
    })};
    if(!validate(a))throw Error('Legacy 3D data failed validation. Export the original before recovery.');
    return a;
  }
  function bom(a,existing){
    if(!validate(a))throw Error('Invalid 3D assembly');
    const groups=new Map();
    for(const o of a.objects){
      const dims=Object.fromEntries(Object.entries(o.dims).sort(([a],[b])=>a.localeCompare(b)));
      const key=JSON.stringify(o.model?[o.partId,o.material,dims,StudioSolidModel.signature(o.model)]:[o.partId,o.material,dims]);
      const previous=existing.find(p=>p.source3dKey===key);
      if(!groups.has(key))groups.set(key,{name:((o.model?o.name:parts.find(p=>p.id===o.partId).name)+' · '+Object.entries(dims).map(([k,v])=>k+' '+Number(v.toFixed(3))).join(' / ')).slice(0,200),material:o.material,qty:0,price:previous?.price||0,source3dKey:key});
      groups.get(key).qty++;
    }
    return [...existing.filter(p=>!p.source3dKey),...groups.values()];
  }
  return {catalogue:CATALOGUE,parts,materials,dimensions,validate,legacy,bom};
})();
