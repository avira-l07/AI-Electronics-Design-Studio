/* Independent, portable quadcopter concept. Y up; all dimensions in millimetres.
   Stable object IDs encode preview stages only; saved visibility stays independent. */
const StudioDrone=(()=>{
  const stages=[
    ['Hardware','Screws, washers, nuts and spacers, shown at their assembly positions.'],
    ['Frame','Add the lower and upper plates, four arms and landing feet.'],
    ['Motors','Four generic brushless outrunners mount at the arm tips.'],
    ['Electronics','Reveal the ESC, flight controller and receiver board.'],
    ['Power','Add the battery envelope and two retaining straps.'],
    ['Complete drone','Add alternating CW / CCW propellers and retaining nuts.']
  ];
  function stage(id){return Number(/^quad_s([1-6])_/.exec(id)?.[1])||0;}
  function assembly(){
    const objects=[];
    function add(step,partId,name,position,dims={},rotation=[0,0,0],material){
      const base=StudioAssembly.parts.find(p=>p.id===partId);
      objects.push({id:`quad_s${step}_${objects.length+1}`,partId,name,dims:{...base.dims,...dims},material:material||base.mat,position,rotation,visible:true,wireframe:false});
    }
    function screw(name,x,y,z,length=10,up=false){add(1,'screw_cap',name,[x,y,z],{length},up?[180,0,0]:[0,0,0]);}
    function washer(name,x,y,z){add(1,'washer',name,[x,y,z]);}
    function nut(name,x,y,z,diameter=3){add(diameter===5?6:1,'nut_hex',name,[x,y,z],{diameter,acrossFlats:diameter===5?8:5.5,thickness:diameter===5?4:2.4});}
    add(2,'quad_plate','Frame · lower centre plate',[0,16,0]);
    add(2,'quad_plate','Frame · upper battery deck',[0,43,0]);
    const corners=[[-1,-1,'Front left'],[1,-1,'Front right'],[1,1,'Rear right'],[-1,1,'Rear left']];
    const reach=Math.hypot(60,72),armLength=reach+20;
    corners.forEach(([sx,sz,label],i)=>{
      const angle=Math.atan2(sx*60,sz*72)*180/Math.PI;
      add(2,'quad_arm',label+' · arm',[sx*60,18.5,sz*54],{length:armLength},[0,angle,0]);
      add(2,'shaft_round',label+' · landing foot',[sx*60,0,sz*54],{diameter:12,length:18.5},[0,0,0],'ABS polymer');
      // Two arm screws follow the same local hole pattern as the arm geometry.
      for(const offset of [0,8]){
        const x=sx*(30+offset*60/reach),z=sz*(18+offset*72/reach);
        washer(label+' · arm washer',x,22.5,z);
        screw(label+' · arm screw',x,23.1,z);
        nut(label+' · arm nut',x,13.6,z);
      }
      add(3,'motor_brushless',label+' · brushless motor',[sx*90,22.5,sz*90]);
      // M3 motor screws enter from below the arm, on a 16 × 16 mm pattern.
      for(const dx of [-8,8])for(const dz of [-8,8]){
        const a=angle*Math.PI/180;
        const x=sx*90+dx*Math.cos(a)+dz*Math.sin(a),z=sz*90-dx*Math.sin(a)+dz*Math.cos(a);
        washer(label+' · motor washer',x,17.9,z);
        screw(label+' · motor screw',x,17.9,z,6,true);
      }
      add(6,i%2?'propeller_ccw':'propeller_cw',label+(i%2?' · CCW propeller':' · CW propeller'),[sx*90,44.5,sz*90],{},[0,i%2?45:-45,0]);
      nut(label+' · propeller nut',sx*90,47,sz*90,5);
    });
    for(const [x,z] of [[-30,0],[30,0],[0,-24],[0,24]]){
      add(1,'standoff','Frame · deck spacer',[x,18.5,z],{diameter:6,length:24.5});
      washer('Frame · lower deck washer',x,15.4,z);screw('Frame · lower deck screw',x,15.4,z,6,true);
      washer('Frame · upper deck washer',x,45.5,z);screw('Frame · upper deck screw',x,46.1,z,6);
    }
    for(const x of [-15,15])for(const z of [-15,15]){
      add(1,'standoff','Electronics · lower stack spacer',[x,18.5,z],{diameter:5,length:6.5},[0,0,0],'ABS polymer');
      add(1,'standoff','Electronics · upper stack spacer',[x,26.6,z],{diameter:5,length:7.4},[0,0,0],'ABS polymer');
      washer('Electronics · stack washer',x,35.6,z);screw('Electronics · stack screw',x,36.2,z,10);
    }
    add(4,'esc_board','Electronics · four-in-one ESC',[0,25,0]);
    add(4,'flight_controller','Electronics · flight controller',[0,34,0]);
    add(4,'pcb_board','Electronics · receiver envelope',[0,23,-23],{width:18,height:10,thickness:1.6});
    add(5,'battery_pack','Power · battery envelope',[0,45.5,0]);
    for(const z of [-22,22])add(5,'battery_strap','Power · battery strap',[0,44.5,z]);
    // Sort by assembly stage for a useful tree while preserving stable IDs.
    objects.sort((a,b)=>stage(a.id)-stage(b.id));
    const result={version:1,units:'mm',objects};
    if(!StudioAssembly.validate(result))throw Error('Invalid drone starter assembly');
    return result;
  }
  function projectData(){const assembly3d=assembly();return {kind:'Electromechanical prototype',designType:'sketch',currency:'INR',assembly3d,parts:StudioAssembly.bom(assembly3d,[]),electrical:'Generic quadcopter packaging study. Motor KV, thrust, ESC current, battery chemistry/cell count, connector ratings, wiring and controller configuration are unspecified. No electrical connectivity or flight simulation is provided.'};}
  const brief='Editable generic quadcopter packaging concept: 254.6 mm diagonal motor spacing, 127 mm propeller envelopes, and a 30 mm electronics mounting pattern. Each screw, washer, nut, spacer and major component is independently editable. The six assembly previews do not change saved visibility. Dimensions are illustrative; no flight performance, structural strength, fastener engagement or manufacturer fit is verified. CW/CCW blade pitch is illustrative. Prices start unquoted. Review hardware against actual supplier drawings before making a physical build.';
  return {stages,stage,assembly,projectData,brief};
})();
