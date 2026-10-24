/* Project trust boundary and non-destructive browser-storage reads. */
const StudioProjectData = (() => {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  const number = v => typeof v === 'number' && Number.isFinite(v);
  function validate(p, depth = 0) {
    if (!object(p) || depth > 1 || !text(p.name, 200) || !p.name.trim() || !text(p.material, 200)) return false;
    if (p.kind !== undefined && !text(p.kind, 100)) return false;
    if (p.designType !== undefined && !['slider-crank', 'electronics', 'sketch'].includes(p.designType)) return false;
    if (p.currency !== undefined && !['INR', 'USD', 'EUR', 'GBP', 'JPY'].includes(p.currency)) return false;
    if (!['stroke', 'rod', 'rpm'].every(k => number(p[k]) && p[k] > 0 && p[k] < 1e8)) return false;
    for (const [key, max] of [['parts',1000], ['notes',1000], ['revisions',50], ['sketch',1000], ['buildTasks',1000]]) {
      if (p[key] !== undefined && (!Array.isArray(p[key]) || p[key].length > max)) return false;
    }
    if (!Array.isArray(p.parts) || !Array.isArray(p.notes) || (depth === 0 && !Array.isArray(p.revisions))) return false;
    if (!p.parts.every(a => object(a) && text(a.name,200) && text(a.material,200) && Number.isInteger(a.qty) && a.qty >= 1 && a.qty <= 100000 && number(a.price) && a.price >= 0 && a.price < 1e12)) return false;
    if(p.parts.some(a=>a.source3dKey!==undefined&&!text(a.source3dKey,1000)))return false;
    if(p.assembly3d!==undefined&&(typeof StudioAssembly==='undefined'||!StudioAssembly.validate(p.assembly3d)))return false;
    if (!p.notes.every(n => object(n) && ['title','body','type','date'].every(k => text(n[k],10000)) && (n.signature === undefined || text(n.signature,100000)))) return false;
    for (const s of p.sketch || []) {
      if (!object(s) || !['rect','circle','line','text','dimension'].includes(s.type)) return false;
      if (Object.keys(s).some(k => !['type','text','layer','x','y','x2','y2','w','h','r'].includes(k))) return false;
      if (Object.entries(s).some(([k,v]) => !['type','text','layer'].includes(k) && (!number(v) || Math.abs(v) > 10000))) return false;
      if ((s.text !== undefined && !text(s.text,200)) || (s.layer !== undefined && !text(s.layer,50))) return false;
      if (!({rect:['x','y','w','h'],circle:['x','y','r'],line:['x','y','x2','y2'],dimension:['x','y','x2','y2'],text:['x','y','text']}[s.type]).every(k => k in s)) return false;
      if (['w','h','r'].some(k => s[k] !== undefined && s[k] < 0)) return false;
    }
    if (p.buildTasks && !p.buildTasks.every(t => object(t) && text(t.name,500) && typeof t.done === 'boolean')) return false;
    if (p.electrical !== undefined && !text(p.electrical,10000)) return false;
    if (p.circuit && (!object(p.circuit) || !['voltage','resistance','rating'].every(k => number(p.circuit[k]) && p.circuit[k] > 0) || !Number.isFinite(p.circuit.voltage / p.circuit.resistance) || !Number.isFinite(p.circuit.voltage * (p.circuit.voltage / p.circuit.resistance)))) return false;
    if (p.costSettings && (!object(p.costSettings) || !Number.isInteger(p.costSettings.quantity) || p.costSettings.quantity < 1 || !['labor','tooling','overhead'].every(k => number(p.costSettings[k]) && p.costSettings[k] >= 0))) return false;
    if (p.resistorNetwork) {
      const n = p.resistorNetwork;
      if (!object(n) || !['series','parallel'].includes(n.mode) || !number(n.voltage) || n.voltage <= 0 || n.voltage > 100000 || !Array.isArray(n.resistors) || n.resistors.length < 1 || n.resistors.length > 20 || !n.resistors.every(r => number(r) && r > 0 && r <= 1e12)) return false;
    }
    if (depth && p.revisions?.length) return false;
    return (p.revisions || []).every(r => object(r) && text(r.label,200) && text(r.date,100) && validate(r.snapshot,depth + 1));
  }
  function parse(raw) {
    return JSON.parse(raw, (k,v) => ['__proto__','constructor','prototype'].includes(k) ? undefined : v);
  }
  // Spreadsheet programs interpret formula prefixes even inside quoted CSV cells.
  function csvCell(value) {
    let s = String(value);
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"','""') + '"';
  }
  function downloadFilename(value) {
    // Browser download hints are not filesystem paths. Still remove ambiguous
    // separators, control/bidi characters and Windows reserved basenames.
    let s=String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/[<>:"/\\|?*]/g,'_').replace(/^[. ]+|[. ]+$/g,'');
    if(!s)s='export';
    if(/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(s))s='_'+s;
    const extension=s.match(/\.[a-z0-9]{1,12}$/i)?.[0] || '',base=extension?s.slice(0,-extension.length):s;
    let short='',bytes=extension.length;
    for(const char of base){const size=new TextEncoder().encode(char).length;if(bytes+size>180)break;short+=char;bytes+=size;}
    return (short.replace(/[. ]+$/g,'') || 'export')+extension;
  }
  return {validate,parse,csvCell,downloadFilename};
})();

const studioStorage = {
  problems: new Map(),
  read(key) {
    try { return localStorage.getItem(key); }
    catch { this.problems.set(key,{message:'Browser storage is blocked.',raw:null}); return null; }
  },
  json(key, fallback, check) {
    const raw = this.read(key);
    if (raw === null) return fallback;
    try {
      const value = StudioProjectData.parse(raw);
      if (!check(value)) throw Error('Unexpected data format');
      return value;
    } catch {
      this.problems.set(key,{message:'Saved data could not be read safely. The original is preserved.',raw});
      return fallback;
    }
  },
  projects(fallback) {
    const rows=this.json('engineering-studio-v1',fallback,rows => Array.isArray(rows) && rows.length <= 1000 && rows.every(p => StudioProjectData.validate(p) && typeof p.id === 'string' && p.id.length > 0) && new Set(rows.map(p=>p.id)).size === rows.length);
    return this.problems.has('engineering-studio-v1')?[]:rows;
  }
};
