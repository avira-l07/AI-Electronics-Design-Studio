/* Bounded triangle assets. Serialized data only; no materials, URLs or scripts. */
const StudioMeshParts=(()=>{
  const MAX_TRIANGLES=6000,MAX_TOTAL=12000,MAX_BYTES=2*1024*1024;
  function validate(mesh){
    if(!mesh||Object.keys(mesh).sort().join(',')!=='positions,version'||mesh.version!==1||!Array.isArray(mesh.positions)||mesh.positions.length<9||mesh.positions.length>MAX_TRIANGLES*9||mesh.positions.length%9||mesh.positions.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>5000))return false;
    for(let i=0;i<mesh.positions.length;i+=9){const p=mesh.positions,a=[p[i+3]-p[i],p[i+4]-p[i+1],p[i+5]-p[i+2]],b=[p[i+6]-p[i],p[i+7]-p[i+1],p[i+8]-p[i+2]];if(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])<1e-9)return false;}
    return true;
  }
  function parse(buffer,format,{units='mm',up='Z'}={}){
    if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>MAX_BYTES)throw Error('Import a file no larger than 2 MiB.');
    if(!['mm','cm','m','in'].includes(units)||!['Y','Z'].includes(up))throw Error('Choose valid units and an up axis.');
    const p=[],add=(...values)=>{if(p.length+values.length>MAX_TRIANGLES*9)throw Error('Imported parts support up to 6,000 triangles. Simplify the mesh first.');p.push(...values);};
    const view=new DataView(buffer),text=()=>new TextDecoder().decode(buffer);
    if(format==='stl'){
      const count=buffer.byteLength>=84?view.getUint32(80,true):0;
      if(count>0&&84+count*50===buffer.byteLength){if(count>MAX_TRIANGLES)throw Error('Imported parts support up to 6,000 triangles.');for(let t=0;t<count;t++)for(let v=0;v<3;v++){const at=84+t*50+12+v*12;add(view.getFloat32(at,true),view.getFloat32(at+4,true),view.getFloat32(at+8,true));}}
      else{const raw=text();if(!/^\s*solid\b/i.test(raw)||!(/endsolid\b/i.test(raw)))throw Error('Invalid STL: expected binary triangles or an ASCII solid.');const facets=raw.match(/facet\s+normal\s+[\s\S]*?endfacet/gi)||[];if(!facets.length||facets.length>MAX_TRIANGLES)throw Error('Invalid STL or too many triangles.');for(const f of facets){const vertices=[...f.matchAll(/\bvertex\s+(\S+)\s+(\S+)\s+(\S+)/gi)];if(vertices.length!==3)throw Error('Every STL facet needs three vertices.');for(const v of vertices)add(...v.slice(1).map(Number));}}
    }else if(format==='obj'){
      const vertices=[];for(const line of text().split(/\r?\n/)){const fields=line.split('#')[0].trim().split(/\s+/),kind=fields.shift();if(kind==='v'){if(fields.length!==3||vertices.length>=MAX_TRIANGLES*3)throw Error('OBJ vertices must be three coordinates within the import limits.');vertices.push(fields.map(Number));}else if(kind==='f'){if(fields.length!==3)throw Error('OBJ faces must be triangulated before import.');for(const field of fields){const token=field.split('/')[0];if(!/^-?\d+$/.test(token))throw Error('Invalid OBJ vertex index.');const n=Number(token),index=n<0?vertices.length+n:n-1;if(!n||!vertices[index])throw Error('OBJ face references a missing vertex.');add(...vertices[index]);}}}
    }else throw Error('Choose an STL or OBJ file.');
    const factor={mm:1,cm:10,m:1000,in:25.4}[units];
    for(let i=0;i<p.length;i+=3){const [x,y,z]=p.slice(i,i+3).map(n=>n*factor);p[i]=x;p[i+1]=up==='Z'?z:y;p[i+2]=up==='Z'?-y:z;}
    if(p.some(n=>!Number.isFinite(n)||Math.abs(n)>1000000))throw Error('Invalid or excessive mesh coordinates.');
    if(!p.length)throw Error('No triangles found in the file.');
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++) {const a=i%3;min[a]=Math.min(min[a],p[i]);max[a]=Math.max(max[a],p[i]);}
    const centre=[(min[0]+max[0])/2,min[1],(min[2]+max[2])/2];for(let i=0;i<p.length;i++)p[i]=+(p[i]-centre[i%3]).toFixed(6);
    const mesh={version:1,positions:p};if(!validate(mesh))throw Error('The mesh contains degenerate triangles, non-finite values or geometry outside ±5000 mm.');return mesh;
  }
  function signature(mesh){let h=2166136261;for(const c of JSON.stringify(mesh.positions)){h=Math.imul(h^c.charCodeAt(0),16777619);}return (h>>>0).toString(16);}
  function geometry(T,mesh,scale=1){if(!validate(mesh))throw Error('Invalid imported mesh.');const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(mesh.positions,3));g.scale(scale/10,scale/10,scale/10);g.computeVertexNormals();return g;}
  return {MAX_TRIANGLES,MAX_TOTAL,MAX_BYTES,validate,parse,signature,geometry};
})();
