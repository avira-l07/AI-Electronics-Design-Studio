/* Project directions only. Browsing does not generate geometry or change plans. */
const StudioProjectTypes=(()=>{
 const types=[
  {id:'car-engine',name:'Car engine',group:'Mechanical',icon:'engine',description:'Explore an engine as a connected assembly of mechanical parts.',parts:['Engine block & cylinder layout','Pistons, connecting rods & crankshaft','Mounts, covers & supporting hardware'],boundary:'Engine timing, combustion, cooling and load analysis need specialist tools and validation.'},
  {id:'ship',name:'Ship & boat',group:'Marine',icon:'ship',description:'Think through a vessel from its hull to the equipment inside.',parts:['Hull & deck arrangement','Cabins, compartments & equipment','Propulsion placement & supporting structure'],boundary:'Accurate hull surfaces, buoyancy, stability and hydrodynamics are specialist work.'},
  {id:'lora',name:'LoRa device',group:'Electronics & IoT',icon:'radio',description:'Plan the physical packaging of a connected sensor or radio device.',parts:['Enclosure, lid & mounting points','PCB, radio, battery & antenna envelopes','Connectors, sensor openings & cable paths'],boundary:'Component envelopes are visual references. Circuit design, PCB routing, firmware and RF performance need separate validation.'},
  {id:'robot-arm',name:'Robotic arm',group:'Robotics',icon:'robot',description:'Arrange a base, moving links and a tool around a clear task.',parts:['Base, brackets & arm links','Motors, bearings & joints','Gripper or end-effector arrangement'],boundary:'Collision-free motion, inverse kinematics, control and structural capacity are not established by a visual assembly.'},
  {id:'drone',name:'Drone',group:'Robotics',icon:'drone',description:'Explore the frame, power system and components of a multirotor.',parts:['Frame, arms & landing supports','Motors, propellers & fasteners','Controller, battery & electronics placement'],boundary:'The existing drone starter is a concept assembly. Flight, structural and electrical acceptance still require testing.'},
  {id:'cnc',name:'CNC & machines',group:'Mechanical',icon:'machine',description:'Organise a machine frame, motion axes and working area.',parts:['Frame, plates & working bed','Rails, carriages & drive components','Motor, tool and electronics placement'],boundary:'Machine accuracy, stiffness, safe control and toolpaths require dedicated engineering and testing.'},
  {id:'enclosure',name:'Electronics enclosure',group:'Electronics & IoT',icon:'box',description:'Give a board and its connections a practical physical home.',parts:['Shell, lid & fastening points','PCB standoffs & internal clearances','Buttons, ports & mounting features'],boundary:'Check actual component dimensions, assembly access, thermal behaviour and the chosen fabrication process.'},
  {id:'electric-vehicle',name:'Electric vehicle',group:'Transport',icon:'car',description:'Explore a small vehicle layout and the systems it carries.',parts:['Chassis & body envelopes','Wheels, motor & drivetrain placement','Battery, controller & supporting mounts'],boundary:'Braking, steering, electrical safety, crashworthiness and road approval are beyond a concept model.'},
  {id:'pump',name:'Pumps & valves',group:'Mechanical',icon:'pump',description:'Break a fluid-handling concept into a housing and moving parts.',parts:['Housing, ports & supporting base','Shaft, rotor & bearing arrangement','Seals, covers & connection envelopes'],boundary:'Pressure containment, sealing, fluid performance and material compatibility need specialist analysis and testing.'},
  {id:'weather-station',name:'Weather station',group:'Electronics & IoT',icon:'weather',description:'Arrange outdoor sensors, power and electronics around a mounting point.',parts:['Sensor housing & protective covers','Mast, bracket & installation layout','Battery, solar and radio envelopes'],boundary:'Weather resistance, measurement accuracy and outdoor electrical performance need real-world acceptance.'},
  {id:'solar',name:'Solar & energy',group:'Energy',icon:'solar',description:'Explore panels, supports and equipment in a small energy installation.',parts:['Panel envelopes & mounting frames','Hinges, brackets & installation layout','Battery and equipment placement'],boundary:'Structural loads, electrical design, energy performance and installation compliance need separate assessment.'},
  {id:'custom',name:'Custom 3D project',group:'General',icon:'cube',description:'Start with your own idea and arrange the parts it needs.',parts:['Custom solids & catalogue parts','Mounting, attachment & assembly layout','Dimensions, materials & planning notes'],boundary:'Choose validation methods appropriate to the design before fabrication or real-world use.'}
 ];
 const drawings={
  engine:'M30 35h58v31H30zM35 35V20h12v15m6 0V20h12v15m6 0V20h12v15M23 66h72M42 47h10m10 0h10M88 42h13v18H88M38 70v7m40-7v7',
  ship:'M14 49h99L95 70H34zM36 49V34h42v15M44 34V23h19v11M78 49V39h18v10M53 23V12m0 0 17 8H53M17 76q10-8 20 0t20 0t20 0t20 0t20 0',
  radio:'M32 30h60v44H32zM39 38h46v28H39zM46 45h16v13H46zM73 43v17M52 30V13m-10 8q10-15 20 0m-27-5q17-25 34 0M69 73v5m10-5v5',
  robot:'M27 73h70M39 73V60h20v13M49 60l19-23M68 37l-18-15M50 22l26-9M76 13l15 10m-5-5 7-5m-2 10 8-2M43 22a7 7 0 1 0 14 0 7 7 0 1 0-14 0M61 37a7 7 0 1 0 14 0 7 7 0 1 0-14 0',
  drone:'M48 35h31v23H48zM48 35 29 21m50 14 20-14M48 58 29 72m50-14 20 25M10 21h38M80 21h38M10 72h38m32 0h38M29 13v16m70-16v16M29 64v16m70-16v16M57 41h13v11H57z',
  machine:'M20 73h89M30 68V18h12v50M91 68V18h12v50M30 18h73v12H30M42 38h49M54 30v22h23V30M62 52v10M31 63h68v10H31',
  box:'M28 33 72 18l31 17-44 15zM28 33v32l31 17V50m0 32 44-17V35M40 28 84 13l20 10M69 59l21-7v8l-21 8zM37 44v9',
  car:'M17 55l9-17h65l17 17v14H17zM35 38l12-16h31l13 16M48 23v15m28-15v15M26 69a9 9 0 1 0 18 0m38 0a9 9 0 1 0 18 0M54 51h22v12H54z',
  pump:'M26 70h79M39 61v9m45-9v9M39 36a25 25 0 1 0 50 0 25 25 0 1 0-50 0M52 36a12 12 0 1 0 24 0 12 12 0 1 0-24 0M83 21h24v15H89M39 36H17v14h26M64 11V3',
  weather:'M62 35v43M42 78h40M62 43H30V31h22v12M36 31l-5-10m10 10V18m6 13 6-11M62 57h29V44H72v13M62 17h30M76 17V8m-8 0h16M55 22h14v13H55z',
  solar:'M20 29 88 15l22 36-68 14zM43 24l22 36m0-41 22 36M31 47l69-14M53 63v13m34-19v19M43 77h53M19 17l-6-7m16 4V4M12 26H3',
  cube:'M30 29 64 12l34 17v39L64 85 30 68zM30 29l34 18 34-18M64 47v38M48 38V22m0 45 16-8 17 8'
 };
 function art(type){return `<svg viewBox="0 0 128 90" aria-hidden="true" focusable="false"><path d="${drawings[type.icon]}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>`;}
 function selected(){return types.find(t=>t.id===new URLSearchParams(location.hash.split('?')[1]||'').get('type')) || types[0];}
 function page(){return accountShell(`<section class="projectTypesHero"><div><span class="eyebrow">A DIRECTION FOR EVERY IDEA</span><h2>What would you<br>like to build?</h2><p>Explore engines, vessels, connected devices and more. Choose a project direction and see the components it could bring together.</p></div><div class="projectTypesHeroArt" aria-hidden="true">${art(types[0])}<span>IDEA → PARTS → ASSEMBLY</span></div></section><p class="projectTypesNotice">Category options only. Category-specific starters are not included yet. Selecting an option does not generate a model or change your current project.</p><div class="projectTypesControls"><label for="projectTypeSearch">Find a project type<input id="projectTypeSearch" type="search" placeholder="Try engine, radio, robot…" maxlength="100"></label><label for="projectTypeGroup">Field<select id="projectTypeGroup"><option value="all">All fields</option>${[...new Set(types.map(t=>t.group))].map(g=>`<option>${esc(g)}</option>`).join('')}</select></label><p id="projectTypeCount" role="status"></p></div><div class="projectTypesLayout"><section><h2 class="srOnly">Project category options</h2><div class="projectTypesGrid" id="projectTypesGrid"></div></section><aside class="projectTypeDetail" id="projectTypeDetail" aria-labelledby="projectTypeTitle"></aside></div>`,'3D project types','EXPLORE YOUR NEXT PROJECT');}
 function bind(){
  const grid=document.getElementById('projectTypesGrid');if(!grid)return;
  const search=document.getElementById('projectTypeSearch'),group=document.getElementById('projectTypeGroup'),detail=document.getElementById('projectTypeDetail');let choice=selected();
  function showDetail(){
   const guest=studioBackend.enabled&&!signedIn;
   detail.innerHTML=`<span class="projectTypeStatus">CATEGORY PREVIEW</span><div class="projectTypeDetailArt">${art(choice)}</div><span class="eyebrow">${esc(choice.group)}</span><h2 id="projectTypeTitle">${esc(choice.name)}</h2><p>${esc(choice.description)}</p><h3>Typical elements</h3><ul>${choice.parts.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><div class="projectTypeBoundary"><b>Specialist work to consider</b><p>${esc(choice.boundary)}</p></div><a class="pbutton primary" href="${guest?'#/login?next=project-types':'#/workspace?tool=3d'}">${guest?'Log in to open the 3D workspace':'Open manual 3D workspace'} ↗</a><p class="projectTypeFootnote">Opens the existing editor. A category-specific model is not created automatically.</p>`;
  }
  function showGrid(){
   const q=search.value.trim().toLowerCase(),matches=types.filter(t=>(group.value==='all'||t.group===group.value)&&[t.name,t.group,t.description,...t.parts].join(' ').toLowerCase().includes(q));
   document.getElementById('projectTypeCount').textContent=`${matches.length} of ${types.length} project types`;
   grid.innerHTML=matches.map(t=>`<button type="button" class="projectTypeCard" data-project-type="${t.id}" aria-pressed="${t.id===choice.id}" aria-controls="projectTypeDetail"><div class="projectTypeArt">${art(t)}<span aria-hidden="true">↗</span></div><span class="eyebrow">${esc(t.group)}</span><strong>${esc(t.name)}</strong><p>${esc(t.description)}</p><span class="projectTypeCardFoot">${t.id===choice.id?'Selected direction':'Explore this direction'} <span aria-hidden="true">${t.id===choice.id?'✓':'→'}</span></span></button>`).join('')||'<div class="projectTypesEmpty"><h3>No matching project types</h3><p>Try another search or explore all fields.</p><button type="button" id="resetProjectTypes">Show all project types</button></div>';
   grid.querySelectorAll('[data-project-type]').forEach(button=>button.onclick=()=>{
    choice=types.find(t=>t.id===button.dataset.projectType);history.replaceState(null,'','#/project-types?type='+choice.id);
    // Keep focus on the chosen card while updating its selected state.
    grid.querySelectorAll('[data-project-type]').forEach(b=>{const active=b.dataset.projectType===choice.id;b.setAttribute('aria-pressed',String(active));b.querySelector('.projectTypeCardFoot').innerHTML=(active?'Selected direction':'Explore this direction')+' <span aria-hidden="true">'+(active?'✓':'→')+'</span>';});
    showDetail();
    if(window.matchMedia('(max-width:760px)').matches){detail.tabIndex=-1;detail.focus({preventScroll:true});detail.scrollIntoView({block:'start',behavior:'instant'});}
   });
   const reset=document.getElementById('resetProjectTypes');if(reset)reset.onclick=()=>{search.value='';group.value='all';showGrid();search.focus();};
  }
  search.oninput=showGrid;group.onchange=showGrid;showGrid();showDetail();
 }
 return {page,bind};
})();
function projectTypesPage(){return StudioProjectTypes.page();}
productRoutes.push('project-types');
accountMenu.splice(3,0,['project-types','cube','3D project types']);
const projectTypesProductBind=bindProduct;
bindProduct=function(){projectTypesProductBind();StudioProjectTypes.bind();};
