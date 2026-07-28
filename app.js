import { initStore } from './store.js';

/* ===================== Dominio ===================== */
const MACROS = [
  { key:'incomprimibili', label:'Incomprimibili', color:'#4F4A40', tier:'Roccia',  light:false },
  { key:'oggettive',      label:'Oggettive',      color:'#927A45', tier:'Argilla', light:false },
  { key:'superflue',      label:'Superflue',      color:'#C2A36A', tier:'Sabbia',  light:true  }
];
const macro = k => MACROS.find(m=>m.key===k) || MACROS[1];

const DEFAULT_CATEGORIES = {
  spese:{
    incomprimibili:['Mutuo','Bollette','Condominio','Assicurazioni','Tasse e imposte','Telefono e internet','Benzina lavoro','Rate e prestiti'],
    oggettive:['Spesa alimentare','Salute e farmaci','Trasporti','Manutenzione casa','Manutenzione auto','Scuola e figli','Abbigliamento'],
    superflue:['Ristoranti e bar','Tempo libero','Viaggi','Abbonamenti','Shopping','Regali','Hobby']
  },
  entrate:['Stipendio','Aracoeli 20','Vendita vinili','Interessi e rendite','Rimborsi','Buoni pasto','Altro']
};

const KINDS = {
  corrente:    { label:'Conto corrente', color:'#3E6B63' },
  deposito:    { label:'Deposito',       color:'#6E7B4F' },
  investimenti:{ label:'Investimenti',   color:'#927A45' },
  buoni:       { label:'Buoni pasto',    color:'#C2A36A' },
  pensione:    { label:'Pensione',       color:'#5A6473' },
  risparmio:   { label:'Risparmio',      color:'#5C8C82' },
  credito:     { label:'Credito da ricevere', color:'#927A45' },
  carta:       { label:'Carta di credito', color:'#A6533F' },
  altro:       { label:'Altro',          color:'#8A8275' }
};
const TAX_REGIMES = [
  { id:'26',  label:'Ordinaria 26%',        rate:0.26  },
  { id:'125', label:'Titoli di Stato 12,5%', rate:0.125 },
  { id:'0',   label:'Esente 0%',             rate:0     }
];
const taxRate = id => (TAX_REGIMES.find(r=>r.id===id)||TAX_REGIMES[0]).rate;
const INTEREST_FREQS = [
  { id:'annuale',    m:12, label:'Annuale' },
  { id:'semestrale', m:6,  label:'Semestrale' },
  { id:'trimestrale',m:3,  label:'Trimestrale' },
  { id:'mensile',    m:1,  label:'Mensile' }
];
const freqMonths = id => (INTEREST_FREQS.find(f=>f.id===id)||INTEREST_FREQS[0]).m;
function interestEstimate(a, balance){
  const rate=+a.interestRate||0; if(rate<=0) return null;
  const m=freqMonths(a.interestFreq||'annuale'); const tr=taxRate(a.taxRegime||'26');
  const annualGross=Math.round(balance*rate/100*100)/100;
  const periodGross=Math.round(balance*rate/100*(m/12)*100)/100;
  return { rate, months:m, freq:a.interestFreq||'annuale', taxPct:Math.round(tr*100),
    periodGross, periodTax:Math.round(periodGross*tr*100)/100, periodNet:Math.round(periodGross*(1-tr)*100)/100,
    annualGross, annualNet:Math.round(annualGross*(1-tr)*100)/100 };
}
const FC_KINDS = {
  ricorrente:     { label:'Ricorrente',    hint:'Importo fisso su uno o più mesi (mutuo, utenze, condominio…).' },
  rata:           { label:'Rata / finanziamento', hint:'Numero di rate da un mese di partenza, anche a cavallo d\u2019anno. Genera una passività che cala da sola.' },
  accantonamento: { label:'Accantonamento', hint:'Spesa futura (bollo, IMU, assicurazione) ripartita sui mesi fino alla scadenza, su un conto dedicato.' },
  scadenza:       { label:'Scadenza singola', hint:'Importo da pagare in un\u2019unica soluzione a una data, con avviso.' }
};
const fcKindMeta = k => FC_KINDS[k] || FC_KINDS.ricorrente;
const kindMeta = k => KINDS[k] || KINDS.altro;

const DEFAULT_ACCOUNTS = [
  { name:'Conto famiglia',            kind:'corrente' },
  { name:'Conto investimento',        kind:'investimenti', taxRegime:'26' },
  { name:'Conto deposito',            kind:'deposito', taxRegime:'26' },
  { name:'Buoni Pasto',               kind:'buoni' },
  { name:'Conto pensione Domenico',   kind:'pensione', locked:true },
  { name:'Conto pensione Maria Cristina', kind:'pensione', locked:true },
  { name:'Conto emergenza',           kind:'risparmio' },
  { name:'Conto Samuele',             kind:'risparmio' },
  { name:'Conto vacanze',             kind:'risparmio' }
];

const DEFAULT_FORECAST = ['Mutuo','Utenze (luce/gas/acqua)','Condominio','Tasse e imposte','Auto (bollo/assicurazione)','Finanziamenti'];

const ASSET_SUGG = { attivo:['Immobili','Investimenti','Beni durevoli','Collezione','Crediti'], passivo:['Mutuo residuo','Prestiti','Debiti'] };
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MESI_AB = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

/* ===================== Helpers ===================== */
const el = id => document.getElementById(id);
const eur = n => (Math.round((+n||0)*100)/100).toLocaleString('it-IT',{ style:'currency', currency:'EUR' });
const eur0 = n => (Math.round(+n||0)).toLocaleString('it-IT',{ style:'currency', currency:'EUR', maximumFractionDigits:0 });
function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const curMonth = () => periodOf(todayISO());
const curYear = () => new Date().getFullYear();
function shiftMonth(ym,delta){ let [y,m]=ym.split('-').map(Number); m+=delta; while(m<1){m+=12;y--;} while(m>12){m-=12;y++;} return `${y}-${String(m).padStart(2,'0')}`; }
const monthName = ym => { const [y,m]=ym.split('-'); return `${MESI[+m-1]} ${y}`; };
const monthAbbr = ym => MESI_AB[+ym.slice(5,7)-1];
const p2 = n => String(n).padStart(2,'0');
function cycleDay(){ return Math.max(1, Math.min(28, parseInt(BUDGET.cycleDay,10)||1)); }
function periodOf(iso){
  const d=cycleDay(); const s=iso||''; if(d<=1) return s.slice(0,7);
  const p=s.split('-'); if(p.length<3) return s.slice(0,7);
  let y=+p[0], m=+p[1]; const day=+p[2];
  if(day>=d){ m++; if(m>12){ m=1; y++; } }
  return `${y}-${p2(m)}`;
}
function periodRange(ym){
  const d=cycleDay(); const Y=+ym.slice(0,4), M=+ym.slice(5,7);
  if(d<=1){ const last=new Date(Y,M,0).getDate(); return { startISO:`${Y}-${p2(M)}-01`, endISO:`${Y}-${p2(M)}-${p2(last)}` }; }
  const endDay=Math.min(d-1, new Date(Y,M,0).getDate());
  let sY=Y, sM=M-1; if(sM<1){ sM=12; sY=Y-1; }
  const startDay=Math.min(d, new Date(sY,sM,0).getDate());
  return { startISO:`${sY}-${p2(sM)}-${p2(startDay)}`, endISO:`${Y}-${p2(M)}-${p2(endDay)}` };
}
const periodLabel = ym => { const r=periodRange(ym); return `${dayShort(r.startISO)} – ${dayShort(r.endISO)}`; };
const dayLabel = iso => { const [y,m,d]=iso.split('-'); return `${+d} ${MESI[+m-1].toLowerCase()} ${y}`; };
const dayShort = iso => { const p=(iso||'').split('-'); return p.length===3?`${+p[2]}/${+p[1]}`:''; };
const dueLabel = days => days<0?`scaduta ${-days}g fa`:(days===0?'oggi':(days===1?'domani':`tra ${days} giorni`));
const dayShort2 = iso => { const p=(iso||'').split('-'); return p.length===3?`${+p[2]}/${+p[1]}/${p[0]}`:''; };
const escapeHtml = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const firstName = n => String(n||'').trim().split(/\s+/)[0] || 'Utente';
const parseAmount = v => { const n=parseFloat(String(v==null?'':v).replace(/\s/g,'').replace(',','.')); return isNaN(n)?NaN:n; };
const sum = a => a.reduce((s,x)=>s+(+x||0),0);
const memberById = id => DATA.members.find(m=>m.uid===id);
const accountById = id => DATA.accounts.find(a=>a.id===id);
const txMonth = ym => DATA.transactions.filter(t=>periodOf(t.date)===ym);
const signed = n => (n<0?'−':'') + eur(Math.abs(n));
const isPL = t => (t.type==='uscita' || t.type==='entrata');
const isMemoAcc = id => { const a=accountById(id); return !!(a && a.excludeNetWorth); };
const countsIncome = t => t.type==='entrata' && !t.excludeFromTotals && !t.credit && !isMemoAcc(t.account);
const countsExpense = t => t.type==='uscita' && !t.credit && !isMemoAcc(t.account);
const isFuelSub = name => !!name && /benzin|carburant|riforniment|gasolio|diesel|metano|\bgpl\b/i.test(name);
function vehicleList(){ const used=[...new Set(DATA.transactions.map(t=>t.vehicle).filter(Boolean))]; return [...new Set([...used,'Auto','Moto','Furgone','Scooter'])]; }

/* ===================== Icone ===================== */
const P = {
  home:'<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/>',
  list:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  delta:'<path d="M12 5l7 13H5z"/>',
  columns:'<path d="M3 20h18"/><path d="M6 20V9M12 20V5M18 20V12"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  sliders:'<path d="M4 7h9M4 12h3M4 17h9"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="16" cy="17" r="2"/><path d="M18 12h2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"/>',
  camera:'<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.2"/><path d="M8.5 7L10 5h4l1.5 2"/>',
  chevL:'<path d="M14 6l-6 6 6 6"/>',
  chevR:'<path d="M10 6l6 6-6 6"/>',
  check:'<path d="M5 12l4 4 10-10"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  logout:'<path d="M9 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/><path d="M13 12H8"/><path d="M11 9l3 3-3 3"/>',
  download:'<path d="M12 4v10M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  transfer:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  plusc:'<circle cx="12" cy="12" r="8"/><path d="M12 9v6M9 12h6"/>',
  minusc:'<circle cx="12" cy="12" r="8"/><path d="M9 12h6"/>',
  scale:'<path d="M12 4v16M6 8h12M6 8l-2 6h4zM18 8l-2 6h4z"/>',
  pencil:'<path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  bell:'<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  percent:'<circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/><path d="M19 5L5 19"/>',
  card:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  upload:'<path d="M12 3v13"/><path d="M7 8l5-5 5 5"/><path d="M5 21h14"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'
};
const svg = (k,cls='ic') => `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[k]||''}</svg>`;

/* ===================== Stato ===================== */
let store=null, me=null, deferredPrompt=null;
const DATA = { transactions:[], assets:[], snapshots:[], members:[], accounts:[], forecast:[], goals:[], categories:DEFAULT_CATEGORIES };
let BUDGET = { needs:50, wants:30, save:20, startDate:'', cycleDay:1, level:0 };
let budgetSource='preventivo';
const NEEDS_MACROS = ['incomprimibili','oggettive'];
let catSeeded=false, accountsSeeded=false, fcSeeded=false, budgetSeeded=false;
const subs={};
let view='cruscotto';
let fMonth=curMonth(), fPerson='all', fType='all', fAccount='all', fYear=curYear();
let modalOpen=false, pendingRender=false;
let sheetType='uscita', movEditId=null, assetEditId=null, accEditId=null, fcEditId=null, goalEditId=null;
let fixedDetailYm=null; let fxDate=null; const fxInFlight=new Set(); let backupRan=false; let creditPageId=null; let txLoaded=false, autoPostRan=false;
let opAccId=null, opMode='debit', gateTab='login';

/* ===================== Boot ===================== */
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; });
document.addEventListener('click', onClick);
document.addEventListener('change', onChange);
init();

async function init(){
  el('root').innerHTML = '<div class="boot">Carico…</div>';
  store = await initStore();
  store.onAuth(u=>{
    me = u;
    if(u){
      if(!DATA.members.length) DATA.members = [{ uid:u.uid, name:u.name, color:u.color, email:u.email||'' }];
      ensureData(); render();
    } else { teardownData(); renderGate(); }
  });
}
function ensureData(){
  if(subs.tx) return;
  subs.tx = store.subscribe('transactions', a=>{ DATA.transactions=a; txLoaded=true; softRender(); });
  subs.as = store.subscribe('assets',       a=>{ DATA.assets=a; softRender(); });
  subs.sn = store.subscribe('snapshots',     a=>{ DATA.snapshots=a; softRender(); });
  subs.mb = store.subscribe('members',       a=>{ DATA.members=a; softRender(); });
  subs.ac = store.subscribe('accounts',      a=>{
    DATA.accounts = [...a].sort((x,y)=>(x.order||0)-(y.order||0));
    if(!a.length && !accountsSeeded){ accountsSeeded=true; seedAccounts(); }
    softRender();
  });
  subs.fc = store.subscribe('forecast',      a=>{
    DATA.forecast = a;
    if(!a.length && !fcSeeded){ fcSeeded=true; seedForecast(); }
    softRender();
  });
  subs.gl = store.subscribe('goals', a=>{ DATA.goals=[...a].sort((x,y)=>(x.order||0)-(y.order||0)); softRender(); });
  subs.bd = store.subscribeConfig ? store.subscribeConfig('budget', o=>{
    if(o && isFinite(+o.needs)){ BUDGET={ needs:+o.needs, wants:+o.wants, save:+o.save, startDate:o.startDate||'', cycleDay:+o.cycleDay||1, level:+o.level||0 }; }
    else if(!budgetSeeded){ budgetSeeded=true; store.saveConfig && store.saveConfig('budget', BUDGET); }
    softRender();
  }) : null;
  subs.ct = store.subscribeCategories(c=>{
    if(c){ DATA.categories = normalizeCats(c); }
    else if(!catSeeded){ catSeeded=true; DATA.categories=DEFAULT_CATEGORIES; store.saveCategories(DEFAULT_CATEGORIES); }
    softRender();
  });
}
async function seedAccounts(){ for(let i=0;i<DEFAULT_ACCOUNTS.length;i++){ const a=DEFAULT_ACCOUNTS[i]; await store.add('accounts',{ name:a.name, kind:a.kind, opening:0, order:i, excludeNetWorth:false, locked:!!a.locked, taxRegime:a.taxRegime||'26', billingDay:null, linkedAccount:'', note:'' }); } }
async function seedForecast(){ const y=curYear(); for(let i=0;i<DEFAULT_FORECAST.length;i++){ await store.add('forecast',{ name:DEFAULT_FORECAST[i], kind:'ricorrente', group:'', macro:'incomprimibili', sub:'', account:'', year:y, amounts:Array(12).fill(0), cells:{}, order:i }); } }
function teardownData(){ Object.values(subs).forEach(u=>{ try{ u&&u(); }catch{} }); for(const k in subs) delete subs[k]; }
function normalizeCats(c){ return { spese:{ incomprimibili:(c&&c.spese&&c.spese.incomprimibili)||[], oggettive:(c&&c.spese&&c.spese.oggettive)||[], superflue:(c&&c.spese&&c.spese.superflue)||[] }, entrate:(c&&c.entrate)||[] }; }
function softRender(){ if(!me) return; if(!backupRan && (DATA.accounts.length||DATA.transactions.length)){ backupRan=true; autoBackup(); } if(!autoPostRan && txLoaded && DATA.forecast.length){ autoPostRan=true; autoMaterializeDue(); } if(modalOpen){ pendingRender=true; if(fixedDetailYm){ try{ openFixedDetail(fixedDetailYm); }catch(e){} } if(creditPageId){ try{ openCreditPage(creditPageId); }catch(e){} } return; } render(); }

/* ===================== Calcoli conti / patrimonio ===================== */
function computeBalances(){
  const bal={}; DATA.accounts.forEach(a=>bal[a.id]=+a.opening||0);
  DATA.transactions.forEach(t=>{
    if(t.reimbursed) return; // crediti rimborsati: fuori dal saldo residuo
    const amt=+t.amount||0;
    if(t.type==='uscita'){ if(t.account&&bal[t.account]!=null) bal[t.account]-=amt; }
    else if(t.type==='entrata'){ if(t.account&&bal[t.account]!=null) bal[t.account]+=amt; }
    else if(t.type==='giroconto'){ if(t.fromAccount&&bal[t.fromAccount]!=null) bal[t.fromAccount]-=amt; if(t.toAccount&&bal[t.toAccount]!=null) bal[t.toAccount]+=amt; }
    else if(t.type==='rettifica'){ if(t.account&&bal[t.account]!=null) bal[t.account]+=(t.dir==='-'?-amt:amt); }
  });
  return bal;
}
function netWorthParts(){
  const bal=computeBalances();
  const isCard = a => a.kind==='carta';
  const inNW = a => !a.excludeNetWorth;
  const liquidAll = DATA.accounts.reduce((s,a)=>s+(bal[a.id]||0),0);
  const liquid = DATA.accounts.filter(inNW).reduce((s,a)=>s+(bal[a.id]||0),0);
  const dispo = DATA.accounts.filter(a=>!isCard(a)&&!a.locked&&inNW(a)).reduce((s,a)=>s+(bal[a.id]||0),0);
  const vinc  = DATA.accounts.filter(a=>!isCard(a)&&a.locked&&inNW(a)).reduce((s,a)=>s+(bal[a.id]||0),0);
  const memo  = DATA.accounts.filter(a=>!isCard(a)&&!inNW(a)).reduce((s,a)=>s+(bal[a.id]||0),0); // promemoria, fuori totale
  const cards = DATA.accounts.filter(isCard).reduce((s,a)=>s+(bal[a.id]||0),0); // ≤ 0 di norma
  const otherA = sum(DATA.assets.filter(a=>a.type!=='passivo').map(a=>a.value));
  const passManual = sum(DATA.assets.filter(a=>a.type==='passivo').map(a=>a.value));
  const passRate = sum(rataPassivita().map(x=>x.residuo));
  const pass = Math.round((passManual+passRate)*100)/100;
  return { bal, liquid, liquidAll, dispo, vinc, memo, cards, otherA, passManual, passRate, pass, netto: Math.round((liquid+otherA-pass)*100)/100 };
}

/* ===================== Calcoli previsionale ===================== */
const ymOf = (y,mi) => `${y}-${String(mi+1).padStart(2,'0')}`;
function fcMonthly(it, y, mi){
  const k = it.kind || 'ricorrente';
  if(k==='rata'){
    const sY=+it.startYear||curYear(), sM=+it.startMonth||0, n=+it.nRate||0, rata=+it.rataAmount||0;
    const idx=(y-sY)*12+(mi-sM);
    return (idx>=0 && idx<n) ? rata : 0;
  }
  if(k==='accantonamento'){
    const sY=(it.accStartYear!=null?+it.accStartYear:curYear()), sM=(it.accStartMonth!=null?+it.accStartMonth:0);
    const dY=+it.dueYear||curYear(), dM=+it.dueMonth||0, target=+it.target||0;
    const span=(dY-sY)*12+(dM-sM); if(span<0) return 0;
    const idx=(y-sY)*12+(mi-sM);
    return (idx>=0 && idx<=span) ? Math.round((target/(span+1))*100)/100 : 0;
  }
  if(k==='scadenza'){
    return (y===(+it.dueYear||curYear()) && mi===(+it.dueMonth||0)) ? (+it.amount||0) : 0;
  }
  const cells=it.cells||{}; const key=ymOf(y,mi);
  if(Object.prototype.hasOwnProperty.call(cells,key)) return +cells[key]||0;
  const arr=it.amounts||[]; return +arr[mi]||0;
}
function fcSpreadQuota(it, y, mi){
  const pays=[]; for(let m=0;m<12;m++){ const a=fcMonthly(it,y,m); if(a>0) pays.push({m,a}); }
  if(!pays.length) return 0;
  pays.sort((x,z)=>x.m-z.m); const n=pays.length; const K={};
  for(let i=0;i<n;i++){ const prev = i>0 ? pays[i-1].m : pays[n-1].m-12; K[pays[i].m]=pays[i].m-prev; }
  const targetAbs=y*12+mi; const sd=BUDGET.startDate;
  const startAbs=(sd&&sd.length>=7)?(+sd.slice(0,4))*12+(+sd.slice(5,7)-1):-1e9;
  let q=0;
  for(const dy of [-1,0,1]) for(const pay of pays){
    const P=(y+dy)*12+pay.m; const k=K[pay.m];
    let ws=P-k+1; if(ws<startAbs) ws=startAbs; if(ws>P) continue;
    if(targetAbs>=ws && targetAbs<=P) q+=pay.a/(P-ws+1);
  }
  return Math.round(q*100)/100;
}
function fcMonthlyPlan(it, y, mi){
  if(it.spread && (it.kind||'ricorrente')==='ricorrente' && it.flow!=='entrata') return fcSpreadQuota(it, y, mi);
  return fcMonthly(it, y, mi);
}
function fcActiveInYear(it,y){
  if((it.kind||'ricorrente')==='ricorrente') return true;
  for(let mi=0;mi<12;mi++) if(fcMonthly(it,y,mi)>0) return true;
  return false;
}
const fcAllItems = () => [...DATA.forecast].sort((a,b)=>(a.order||0)-(b.order||0));
function fcItemsForYear(y){
  return fcAllItems().filter(it=>fcActiveInYear(it,y))
    .sort((a,b)=>{ const ga=(a.group||''), gb=(b.group||''); if(ga!==gb) return ga<gb?-1:1; return (a.order||0)-(b.order||0); });
}
const fcItemAnnual = (it,y) => { let s=0; for(let mi=0;mi<12;mi++) s+=fcMonthlyPlan(it,y,mi); return Math.round(s*100)/100; };
const fcMonthTotal = (items,y,mi) => Math.round(sum(items.map(i=>fcMonthlyPlan(i,y,mi)))*100)/100;
function fcGrouped(items){ const out=[], map={}; items.forEach(it=>{ const g=it.group||''; if(!map[g]){ map[g]={group:g,items:[]}; out.push(map[g]); } map[g].items.push(it); }); return out; }

function rataPaidCount(it, asOfY, asOfMi){
  const sY=+it.startYear||curYear(), sM=+it.startMonth||0, n=+it.nRate||0;
  const paid=(asOfY*12+asOfMi)-(sY*12+sM)+1;
  return Math.max(0, Math.min(n, paid));
}
function rataResiduo(it){
  const n=+it.nRate||0, rata=+it.rataAmount||0;
  const paid=rataPaidCount(it, curYear(), new Date().getMonth());
  return Math.round((n-paid)*rata*100)/100;
}
function rataPassivita(){
  return DATA.forecast.filter(i=>i.kind==='rata' && i.linkPass!==false)
    .map(i=>({ item:i, name:i.name, residuo:rataResiduo(i), paid:rataPaidCount(i,curYear(),new Date().getMonth()), n:+i.nRate||0 }))
    .filter(x=>x.residuo>0);
}

/* ===================== Obiettivi di risparmio ===================== */
function avgIncomeRecent(n){
  n=n||6; const now=curMonth(); const vals=[];
  for(let i=1;i<=n;i++){ const ym=shiftMonth(now,-i); if(beforeStart(ym)) break; const v=sum(txMonth(ym).filter(countsIncome).map(t=>t.amount)); if(v>0) vals.push(v); }
  return vals.length ? Math.round(sum(vals)/vals.length*100)/100 : 0;
}
function levelingInfo(ym){
  const level=+BUDGET.level||0; if(level<=0) return null;
  const prev=shiftMonth(ym,-1); if(beforeStart(prev)) return null;
  const inc=Math.round(sum(txMonth(prev).filter(countsIncome).map(t=>t.amount))*100)/100;
  if(inc<=0) return null;
  return { prev, inc, level, move:Math.round((inc-level)*100)/100 };
}
function avgIncomeMonthly(){
  const now=curMonth(); const vals=[];
  for(let i=0;i<3;i++){ const ym=shiftMonth(now,-i); const v=sum(txMonth(ym).filter(countsIncome).map(t=>t.amount)); if(v>0) vals.push(v); }
  return vals.length ? Math.round(sum(vals)/vals.length*100)/100 : 0;
}
function goalStats(g){
  const bal=computeBalances()[g.account]||0;
  const target=+g.target||0;
  const remaining=Math.max(0, Math.round((target-bal)*100)/100);
  const pct=target>0?Math.max(0,Math.min(100,bal/target*100)):0;
  const now=new Date(); const nowIdx=now.getFullYear()*12+now.getMonth();
  let monthsToDue=null, quotaFromDue=null, duePast=false;
  if(g.dueYear!=null&&g.dueYear!==''&&g.dueMonth!=null&&g.dueMonth!==''){
    const dueIdx=(+g.dueYear)*12+(+g.dueMonth);
    monthsToDue=dueIdx-nowIdx+1;
    if(monthsToDue<1){ duePast=remaining>0; monthsToDue=Math.max(monthsToDue,0); quotaFromDue=remaining; }
    else quotaFromDue=Math.round(remaining/monthsToDue*100)/100;
  }
  let monthsFromMonthly=null, etaY=null, etaM=null;
  const monthly=+g.monthly||0;
  if(monthly>0&&remaining>0){
    monthsFromMonthly=Math.ceil(remaining/monthly);
    const etaIdx=nowIdx+monthsFromMonthly-1; etaY=Math.floor(etaIdx/12); etaM=etaIdx%12;
  }
  return { bal, target, remaining, pct, monthsToDue, quotaFromDue, duePast, monthly, monthsFromMonthly, etaY, etaM };
}
function snapBridge(){
  const s=[...DATA.snapshots].filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date));
  if(s.length<2) return null;
  const prev=s[s.length-2], last=s[s.length-1];
  const inWin = t => t.date && t.date>prev.date && t.date<=last.date && !isMemoAcc(t.account);
  const win = DATA.transactions.filter(inWin);
  const pl = Math.round((sum(win.filter(countsIncome).map(t=>t.amount)) - sum(win.filter(countsExpense).map(t=>t.amount)))*100)/100;
  const rett = Math.round(sum(win.filter(t=>t.type==='rettifica').map(t=>(t.dir==='-'?-1:1)*(+t.amount||0)))*100)/100;
  const dNW = Math.round(((+last.netto||0)-(+prev.netto||0))*100)/100;
  const other = Math.round((dNW - pl - rett)*100)/100;
  const days=Math.max(1, Math.round((new Date(last.date+'T00:00:00')-new Date(prev.date+'T00:00:00'))/86400000));
  const perMonth=Math.round(dNW/days*(365/12)*100)/100;
  const noise=Math.abs(rett)+Math.abs(other);
  const coherent = noise <= Math.max(15, Math.abs(dNW)*0.02);
  return { prev, last, days, dNW, pl, rett, other, perMonth, coherent };
}

function carryStatus(ym){
  const y=+ym.slice(0,4), mi=+ym.slice(5,7)-1;
  const items=fcItemsForYear(y).filter(it=>fcMonthly(it,y,mi)>0);
  let plannedTot=0, carried=0, carriedTot=0;
  items.forEach(it=>{ const amt=fcMonthly(it,y,mi); plannedTot+=amt; const key=`${it.id}:${ym}`; if(DATA.transactions.some(t=>t.planKey===key)){ carried++; carriedTot+=amt; } });
  return { plannedCount:items.length, plannedTot:Math.round(plannedTot*100)/100, carried, carriedTot:Math.round(carriedTot*100)/100, todo:items.length-carried, year:y, mi };
}
function defaultMaterializeDate(ym){
  const today=todayISO();
  if(periodOf(today)===ym) return today;
  return periodRange(ym).startISO;
}
async function autoMaterializeDue(){
  if(!me) return;
  const ym=curMonth(); const y=+ym.slice(0,4), mi=+ym.slice(5,7)-1; const today=todayISO();
  const items=fcItemsForYear(y).filter(it=> it.autoPost && (+it.payDay>0) && fcMonthly(it,y,mi)>0);
  let n=0;
  for(const it of items){
    const key=`${it.id}:${ym}`;
    if(DATA.transactions.some(t=>t.planKey===key)) continue;
    const ed=itemMaterializeDate(it, ym);
    if(ed>today) continue;
    const r=await materializeItem(it,y,mi,ed);
    if(r==='created') n++;
  }
  if(n) toast(`${n==1?'1 voce fissa registrata':n+' voci fisse registrate'} in automatico`);
}
function dateForDayInPeriod(ym, day){
  const D=cycleDay(); const Y=+ym.slice(0,4), M=+ym.slice(5,7);
  const clampDay=(yy,mm,dd)=>Math.min(Math.max(1,dd), new Date(yy,mm,0).getDate());
  if(D<=1 || day<D) return `${Y}-${p2(M)}-${p2(clampDay(Y,M,day))}`;
  let sY=Y, sM=M-1; if(sM<1){ sM=12; sY=Y-1; }
  return `${sY}-${p2(sM)}-${p2(clampDay(sY,sM,day))}`;
}
function itemPayDay(it){
  if(it.kind==='scadenza'||it.kind==='accantonamento') return parseInt(it.dueDay,10)||0;
  return parseInt(it.payDay,10)||0;
}
function itemMaterializeDate(it, ym, fallback){
  const day=itemPayDay(it);
  return day>0 ? dateForDayInPeriod(ym, day) : (fallback || defaultMaterializeDate(ym));
}
async function materializeItem(it, y, mi, dateISO){
  const ym=ymOf(y,mi); const amt=Math.round(fcMonthly(it,y,mi)*100)/100;
  if(amt<=0) return 'skip';
  const key=`${it.id}:${ym}`;
  if(DATA.transactions.some(t=>t.planKey===key)) return 'skip';
  const dISO = itemMaterializeDate(it, ym, dateISO);
  if(it.flow==='entrata'){
    await store.add('transactions',{ type:'entrata', amount:amt, date:dISO, macro:null, sub:it.sub||it.name, account:it.account||'', paidBy:me.uid, enteredBy:me.uid, note:'Entrata prevista (previsionale)', fixed:true, origin:'previsionale', planKey:key });
  } else if((it.kind||'ricorrente')==='accantonamento'){
    const from=it.account||'', to=it.fundAccount||'';
    if(!from||!to) return 'problem';
    await store.add('transactions',{ type:'giroconto', amount:amt, date:dISO, fromAccount:from, toAccount:to, note:`Accantonamento · ${it.name}`, enteredBy:me.uid, origin:'previsionale', fixed:true, planKey:key });
  } else {
    await store.add('transactions',{ type:'uscita', amount:amt, date:dISO, macro:it.macro||'incomprimibili', sub:it.sub||it.name, account:it.account||'', paidBy:me.uid, enteredBy:me.uid, note:'Spesa fissa (previsionale)', fixed:true, origin:'previsionale', planKey:key });
  }
  return 'created';
}
async function unmaterializeItem(itemId, ym){
  const key=`${itemId}:${ym}`; const tx=DATA.transactions.find(t=>t.planKey===key);
  if(tx){ try{ await store.remove('transactions', tx.id); }catch(e){ console.warn(e); } }
}
async function materializeMonth(y,mi,dateISO){
  const items=fcItemsForYear(y).filter(it=>fcMonthly(it,y,mi)>0);
  let created=0, skipped=0, problems=0;
  for(const it of items){ const r=await materializeItem(it,y,mi,dateISO); if(r==='created')created++; else if(r==='problem')problems++; else skipped++; }
  if(modalOpen && !fixedDetailYm) closeSheet();
  let msg = created ? `${created} voci portate nel rendiconto` : 'Niente da portare';
  if(skipped) msg += created ? `, ${skipped} già presenti` : ` (${skipped} già presenti)`;
  if(problems) msg += ` · ${problems} accantonamenti senza conto`;
  toast(msg);
}

/* ----- Scadenzario ----- */
function nextBillingISO(day){
  const now=new Date(); let y=now.getFullYear(), m=now.getMonth();
  const mk=(yy,mm)=>{ const dim=new Date(yy,mm+1,0).getDate(); const d=Math.min(day,dim); return `${yy}-${String(mm+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; };
  let iso=mk(y,m);
  if(iso < todayISO()){ m++; if(m>11){m=0;y++;} iso=mk(y,m); }
  return iso;
}
function daysUntil(iso){ const a=new Date(todayISO()+'T00:00:00'), b=new Date(iso+'T00:00:00'); return Math.round((b-a)/86400000); }
function upcomingDeadlines(withinDays){
  const out=[]; const bal=computeBalances();
  DATA.forecast.forEach(it=>{
    const k=it.kind||'ricorrente';
    if(k==='scadenza' || k==='accantonamento'){
      const dY=+it.dueYear||curYear(), dM=+it.dueMonth||0, dim=new Date(dY,dM+1,0).getDate();
      const dd=Math.min(+it.dueDay||dim, dim);
      const iso=`${dY}-${String(dM+1).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
      const amount = k==='scadenza' ? (+it.amount||0) : (+it.target||0);
      out.push({ id:it.id, name:it.name, dateISO:iso, amount, kind:k, item:it, days:daysUntil(iso) });
    }
  });
  DATA.accounts.filter(a=>a.kind==='carta'&&a.billingDay).forEach(a=>{
    const b=bal[a.id]||0; if(b>=0) return;
    const iso=nextBillingISO(+a.billingDay);
    out.push({ id:'card:'+a.id, name:`Saldo ${a.name}`, dateISO:iso, amount:Math.abs(b), kind:'carta', account:a, days:daysUntil(iso) });
  });
  return out.filter(d=>d.days>=-3 && (withinDays==null || d.days<=withinDays)).sort((a,b)=>a.dateISO.localeCompare(b.dateISO));
}

/* ===================== Shell ===================== */
function render(){ el('root').innerHTML = shell(viewHtml()); }
function shell(content){
  return `
  <div class="app">
    <header class="topbar">
      <div class="brand"><span class="brandmark"></span><span class="brand-name">Conti di Famiglia</span></div>
      <button class="chip" data-act="goto" data-view="impostazioni" aria-label="Profilo e impostazioni">
        <span class="dot" style="--c:${me.color||'#3E6B63'}"></span>${escapeHtml(firstName(me.name))}
      </button>
    </header>
    <main class="content" id="content">${content}</main>
    <nav class="tabbar" role="tablist">
      ${tab('cruscotto','Home','home')}
      ${tab('movimenti','Movimenti','list')}
      ${tab('previsionale','Previsionale','calendar')}
      ${tab('delta','Delta','delta')}
      ${tab('patrimonio','Patrimonio','columns')}
    </nav>
  </div>`;
}
const tab = (k,label,icon) => `<button class="tab${view===k?' active':''}" data-act="goto" data-view="${k}" role="tab" aria-selected="${view===k}">${svg(icon)}<span>${label}</span></button>`;
const viewHtml = () => ({ movimenti:viewMovimenti, previsionale:viewPrevisionale, delta:viewDelta, patrimonio:viewPatrimonio, impostazioni:viewImpostazioni }[view] || viewCruscotto)();
const monthNav = () => `<div class="monthnav"><button class="iconbtn" data-act="month" data-dir="-1" aria-label="Mese precedente">${svg('chevL')}</button><span class="m">${monthName(fMonth)}${cycleDay()>1?`<span class="m-range">${periodLabel(fMonth)}</span>`:''}</span><button class="iconbtn" data-act="month" data-dir="1" aria-label="Mese successivo">${svg('chevR')}</button></div>`;
const yearNav = () => `<div class="monthnav"><button class="iconbtn" data-act="year" data-dir="-1" aria-label="Anno precedente">${svg('chevL')}</button><span class="m">${fYear}</span><button class="iconbtn" data-act="year" data-dir="1" aria-label="Anno successivo">${svg('chevR')}</button></div>`;
const emptyState = msg => `<div class="empty">${escapeHtml(msg)}</div>`;

/* ===================== Vista: Cruscotto ===================== */
function viewCruscotto(){
  const np = netWorthParts();
  const cs = carryStatus(fMonth);
  const recent = DATA.transactions.filter(t=>!t.credit).slice(0,5);
  const y=+fMonth.slice(0,4), mi=+fMonth.slice(5,7)-1;
  // Conto Tasse = quote mensili delle voci fiscali spalmate
  const tmap={}; DATA.forecast.forEach(it=>{ if(it.spread && it.flow!=='entrata'){ const q=fcSpreadQuota(it,y,mi); if(q>0) tmap[it.name]=(tmap[it.name]||0)+q; } });
  const tasseItems=Object.entries(tmap).map(([name,q])=>({name,q:Math.round(q*100)/100})).sort((a,b)=>b.q-a.q);
  const tasseTotal=Math.round(sum(tasseItems.map(x=>x.q))*100)/100;
  // Accantonamenti = obiettivi di risparmio (quota mensile) verso i loro conti
  const goals=DATA.goals.map(g=>{ const m=(+g.monthly>0)?+g.monthly:(goalStats(g).quotaFromDue||0); return { name:(accountById(g.account)||{}).name||g.name, m:Math.round(m*100)/100 }; }).filter(g=>g.m>0);
  const goalsTotal=Math.round(sum(goals.map(g=>g.m))*100)/100;
  const total=Math.round((tasseTotal+goalsTotal)*100)/100;
  const plan=plannedBudgetMonth(fMonth);
  const resto=Math.round((plan.inc - plan.needs - plan.wants - goalsTotal)*100)/100;
  const scad = upcomingDeadlines(30);
  const scadCard = scad.length ? `
    <section class="card">
      <div class="card-h"><h3 class="card-title">${svg('bell','ic-xs')} In scadenza</h3><button class="btn ghost sm" data-act="goto" data-view="previsionale">Tutte</button></div>
      <div class="scad-list">${scad.slice(0,3).map(scadenzaRow).join('')}</div>
    </section>` : '';
  const fixedCard = cs.plannedCount>0 ? `
    <button class="card nudge nudge-btn" data-act="fixed-detail" data-ym="${fMonth}">
      <div class="nudge-row"><div>
        <div class="nudge-k">Voci fisse di ${monthName(fMonth).split(' ')[0].toLowerCase()}</div>
        <div class="nudge-v">${cs.carried} di ${cs.plannedCount} inserite <span class="muted sm">· ${eur(cs.plannedTot)} previste</span></div>
      </div>
      ${cs.todo>0 ? `<span class="nudge-cta">${cs.todo} da inserire ${svg('chevR','ic-xs')}</span>` : `<span class="done-tag">${svg('check','ic-xs')} tutte</span>`}
      </div>
    </button>` : '';
  return `
  ${monthNav()}
  <section class="card dep-card">
    <div class="card-h"><h3 class="card-title">Da mettere da parte</h3><span class="muted sm">${monthName(fMonth)}</span></div>
    <div class="dep-line"><span class="dep-k">${svg('download','ic-xs')} Conto Tasse</span><b class="dep-v">${eur(tasseTotal)}</b></div>
    ${tasseItems.length?`<div class="dep-break">${tasseItems.map(x=>`<span>${escapeHtml(x.name)} ${eur(x.q)}</span>`).join('')}</div>`:`<div class="dep-break muted">niente da accantonare per le tasse questo mese</div>`}
    <div class="dep-sep"></div>
    ${goals.length?goals.map(g=>`<div class="dep-line"><span class="dep-k">${svg('target','ic-xs')} ${escapeHtml(g.name)}</span><b class="dep-v">${eur(g.m)}</b></div>`).join(''):`<div class="dep-break muted">nessun obiettivo di risparmio attivo</div>`}
    <div class="dep-line total"><span class="dep-k">Totale da accantonare</span><b class="dep-v">${eur(total)}</b></div>
    <p class="hint" style="margin-top:8px">Entrate previste ${eur(plan.inc)}. Dopo spese fisse, tasse e accantonamenti restano <b class="${resto>=0?'pos':'neg'}">${eur(resto)}</b> per le spese variabili del mese.</p>
  </section>
  ${(()=>{ const L=levelingInfo(fMonth); if(!L) return ''; const pos=L.move>=0;
    return `<section class="card">
    <div class="card-h"><h3 class="card-title">Livellamento</h3><span class="muted sm">da ${monthName(L.prev)}</span></div>
    <p class="hint" style="margin-top:0">Il mese scorso sono entrati ${eur(L.inc)}. Per tenere ogni mese sul livello di ${eur(L.level)}:</p>
    <div class="dep-line total"><span class="dep-k">${pos?'Metti in riserva':'Preleva dalla riserva'}</span><b class="dep-v ${pos?'pos':'neg'}">${eur(Math.abs(L.move))}</b></div>
  </section>`; })()}
  <button class="card liq-card" data-act="goto" data-view="patrimonio">
    <span><span class="nudge-k">Liquidità disponibile</span><span class="muted sm">${np.vinc?` · ${eur(np.vinc)} vincolata`:''}</span></span>
    <span class="liq-v">${eur(np.dispo)}</span>
  </button>
  <button class="btn primary block" data-act="mov-new">${svg('plus')} Aggiungi movimento</button>
  ${fixedCard}
  ${scadCard}
  <section class="card">
    <div class="card-h"><h3 class="card-title">Ultimi movimenti</h3></div>
    ${recent.length ? `<div class="list">${recent.map(rowTx).join('')}</div>` : emptyState('Nessun movimento ancora. Tocca "Aggiungi movimento" per iniziare.')}
  </section>`;
}
function strata(per,total){
  if(total<=0) return `<div class="empty-strata">Nessuna uscita in ${monthName(fMonth).toLowerCase()}.</div>`;
  const order = ['superflue','oggettive','incomprimibili'];
  const bands = order.filter(k=>per[k]>0).map(k=>{
    const m=macro(k), amt=per[k], h=Math.max(36, Math.round(amt/total*200)), pct=Math.round(amt/total*100);
    return `<div class="band${m.light?' light':''}" style="height:${h}px;background:${m.color}">
      <span class="band-l"><span class="band-tier">${m.tier}</span><span class="band-name">${m.label}</span></span>
      <span class="band-r"><span class="band-amt">${eur(amt)}</span><span class="band-pct">${pct}%</span></span>
    </div>`;
  }).join('');
  return `<div class="strata">${bands}</div>`;
}
function falda(delta){
  const neg = delta<0;
  return `<div class="falda${neg?' neg':''}"><span class="falda-l">${neg?'Disavanzo del mese':'Risparmio del mese'}</span><span class="falda-r">${eur(Math.abs(delta))}</span></div>`;
}

/* ---- righe movimenti ---- */
function rowTx(t){
  if(t.type==='giroconto') return rowTransfer(t);
  if(t.type==='rettifica') return rowRettifica(t);
  return rowMov(t,true);
}
function accTag(id){ const a=accountById(id); return a?escapeHtml(a.name):''; }
function rowMov(t,showDate){
  const isU = t.type==='uscita';
  const m = isU ? macro(t.macro) : null;
  const who = memberById(t.paidBy);
  const title = t.sub || (isU ? m.label : 'Entrata');
  const acc = t.account ? ' · '+accTag(t.account) : '';
  const veh = (isU && t.vehicle) ? ' · '+escapeHtml(t.vehicle) : '';
  const noInc = (!isU && t.excludeFromTotals) ? ' · fuori entrate' : '';
  const meta = `${showDate?dayShort(t.date)+' · ':''}${isU?m.label:'Entrata'}${veh}${acc}${noInc}${t.note?' · '+escapeHtml(t.note):''}`;
  return `<button class="row" data-act="mov-edit" data-id="${t.id}">
    <span class="row-dot" style="--c:${isU?m.color:'#3E6B63'}"></span>
    <span class="row-main"><span class="row-cat">${escapeHtml(title)}</span><span class="row-meta">${meta}</span></span>
    <span class="row-side"><span class="row-amt ${isU?'':(t.excludeFromTotals?'muted':'pos')}">${isU?'−':'+'}${eur(t.amount)}</span>
      <span class="row-who"><span class="dot sm" style="--c:${who?who.color:'#aaa'}"></span>${escapeHtml(who?firstName(who.name):'—')}</span></span>
  </button>`;
}
function rowTransfer(t){
  return `<button class="row" data-act="mov-edit" data-id="${t.id}">
    <span class="row-ic">${svg('transfer','ic-xs')}</span>
    <span class="row-main"><span class="row-cat">Giroconto</span><span class="row-meta">${dayShort(t.date)} · ${escapeHtml(accTag(t.fromAccount)||'—')} → ${escapeHtml(accTag(t.toAccount)||'—')}${t.note?' · '+escapeHtml(t.note):''}</span></span>
    <span class="row-side"><span class="row-amt muted">${eur(t.amount)}</span></span>
  </button>`;
}
function rowRettifica(t){
  const plus = t.dir!=='-';
  return `<button class="row" data-act="mov-edit" data-id="${t.id}">
    <span class="row-ic">${svg('scale','ic-xs')}</span>
    <span class="row-main"><span class="row-cat">Rettifica saldo</span><span class="row-meta">${dayShort(t.date)} · ${escapeHtml(accTag(t.account)||'—')}${t.note?' · '+escapeHtml(t.note):''}</span></span>
    <span class="row-side"><span class="row-amt muted">${plus?'+':'−'}${eur(t.amount)}</span></span>
  </button>`;
}

/* ===================== Vista: Movimenti ===================== */
function viewMovimenti(){
  let list = txMonth(fMonth).filter(t=>!t.credit);
  if(fType!=='all') list = list.filter(t=>t.type===fType);
  if(fAccount!=='all') list = list.filter(t=> t.account===fAccount || t.fromAccount===fAccount || t.toAccount===fAccount);
  if(fPerson!=='all') list = list.filter(t=> t.paidBy===fPerson && isPL(t));
  const ent = sum(list.filter(countsIncome).map(t=>t.amount));
  const usc = sum(list.filter(countsExpense).map(t=>t.amount));
  const byDay={};
  list.forEach(t=>{ (byDay[t.date]=byDay[t.date]||[]).push(t); });
  const days = Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
  const memberOpts = `<option value="all">Tutti</option>` + DATA.members.map(m=>`<option value="${m.uid}" ${fPerson===m.uid?'selected':''}>${escapeHtml(firstName(m.name))}</option>`).join('');
  const accOpts = `<option value="all">Tutti i conti</option>` + DATA.accounts.map(a=>`<option value="${a.id}" ${fAccount===a.id?'selected':''}>${escapeHtml(a.name)}</option>`).join('');
  return `
  ${monthNav()}
  <div class="filters three">
    <label class="field"><span>Tipo</span><select data-act="filter-type">
      <option value="all" ${fType==='all'?'selected':''}>Tutte</option>
      <option value="uscita" ${fType==='uscita'?'selected':''}>Uscite</option>
      <option value="entrata" ${fType==='entrata'?'selected':''}>Entrate</option>
    </select></label>
    <label class="field"><span>Persona</span><select data-act="filter-person">${memberOpts}</select></label>
    <label class="field"><span>Conto</span><select data-act="filter-account">${accOpts}</select></label>
  </div>
  <div class="totbar"><span>Entrate <b class="pos">${eur(ent)}</b></span><span>Uscite <b>${eur(usc)}</b></span><span>Delta <b class="${ent-usc>=0?'pos':'neg'}">${signed(ent-usc)}</b></span></div>
  <button class="btn primary block" data-act="mov-new">${svg('plus')} Aggiungi movimento</button>
  ${days.length ? days.map(d=>`<div class="day-h">${dayLabel(d)}</div><div class="list">${byDay[d].map(rowTx).join('')}</div>`).join('') : emptyState('Nessun movimento con questi filtri.')}
  `;
}

/* ===================== Vista: Previsionale ===================== */
function scadenzaRow(d){
  const urgent = d.days<=7;
  const right = d.kind==='carta'
    ? `<button class="btn ghost sm" data-act="card-settle" data-id="${d.account.id}">${svg('scale','ic-xs')} Salda</button>`
    : `<button class="btn ghost sm" data-act="fc-renew" data-id="${d.id}">Rinnova ${(+ (d.dateISO.slice(0,4)))+1}</button>`;
  const km = (d.item&&d.item.flow==='entrata') ? 'Entrata attesa' : (d.kind==='accantonamento' ? 'Accantonamento' : (d.kind==='carta' ? 'Carta' : 'Scadenza'));
  return `<div class="scad-row${urgent?' urgent':''}">
    <span class="scad-ic">${svg(d.kind==='carta'?'card':'bell','ic-xs')}</span>
    <span class="row-main"><span class="row-cat">${escapeHtml(d.name)}</span><span class="row-meta">${km} · ${dueLabel(d.days)} · ${dayShort(d.dateISO)}</span></span>
    <span class="row-side"><span class="row-amt">${eur(d.amount)}</span>${right}</span>
  </div>`;
}
function viewPrevisionale(){
  const all = fcItemsForYear(fYear);
  const incItems = all.filter(i=>i.flow==='entrata');
  const expItems = all.filter(i=>i.flow!=='entrata');
  const head = MESI_AB.map(m=>`<th>${m}</th>`).join('');
  const itemRow = (it, child) => {
    const km=fcKindMeta(it.kind);
    const cells = MESI_AB.map((_,i)=>{ const v=fcMonthlyPlan(it,fYear,i); return `<td class="fc-cell${v>0?'':' zero'}">${v>0?eur0(v):'·'}</td>`; }).join('');
    const tag = it.spread ? `<span class="fc-ktag">spalm.</span>` : ((it.kind&&it.kind!=='ricorrente') ? `<span class="fc-ktag">${km.label.split(' ')[0]}</span>` : '');
    const dot = it.flow==='entrata' ? '#3E6B63' : macro(it.macro).color;
    return `<tr class="fc-row${child?' fc-child':''}"><td class="fc-name"><button class="fc-name-btn" data-act="fc-edit" data-id="${it.id}"><span class="tier-dot" style="--c:${dot}"></span><span class="fc-nm">${escapeHtml(it.name)}</span>${tag}</button></td>${cells}<td class="fc-cell fc-total">${eur0(fcItemAnnual(it,fYear))}</td></tr>`;
  };
  const groupRows = (items, childAll) => {
    let out='';
    fcGrouped(items).forEach(g=>{
      if(g.group){
        const gc = MESI_AB.map((_,i)=>{ const v=fcMonthTotal(g.items,fYear,i); return `<td class="fc-cell fc-sub">${v>0?eur0(v):'·'}</td>`; }).join('');
        const gtot = Math.round(sum(g.items.map(it=>fcItemAnnual(it,fYear)))*100)/100;
        out += `<tr class="fc-grp"><td class="fc-name fc-grp-name">${svg('layers','ic-xs')} ${escapeHtml(g.group)}</td>${gc}<td class="fc-cell fc-total">${eur0(gtot)}</td></tr>`;
      }
      g.items.forEach(it=>{ out += itemRow(it, childAll||!!g.group); });
    });
    return out;
  };
  let body='';
  if(incItems.length){
    const ic = MESI_AB.map((_,i)=>{ const v=fcMonthTotal(incItems,fYear,i); return `<td class="fc-cell fc-sub">${v>0?eur0(v):'·'}</td>`; }).join('');
    const itot = Math.round(sum(incItems.map(it=>fcItemAnnual(it,fYear)))*100)/100;
    body += `<tr class="fc-grp fc-inc"><td class="fc-name fc-grp-name">${svg('plusc','ic-xs')} Entrate</td>${ic}<td class="fc-cell fc-total">${eur0(itot)}</td></tr>`;
    body += groupRows(incItems, true);
  }
  body += groupRows(expItems, false);
  const expTotals = MESI_AB.map((_,i)=>`<td>${eur0(fcMonthTotal(expItems,fYear,i))}</td>`).join('');
  const grandExp = Math.round(sum(expItems.map(it=>fcItemAnnual(it,fYear)))*100)/100;
  const grandInc = Math.round(sum(incItems.map(it=>fcItemAnnual(it,fYear)))*100)/100;
  const saldoRow = incItems.length ? (()=>{
    const cells = MESI_AB.map((_,i)=>{ const v=Math.round((fcMonthTotal(incItems,fYear,i)-fcMonthTotal(expItems,fYear,i))*100)/100; return `<td><span class="${v>=0?'pos':'neg'}">${eur0(v)}</span></td>`; }).join('');
    const y=Math.round((grandInc-grandExp)*100)/100;
    return `<tr class="fc-foot fc-saldo"><td class="fc-name">Saldo previsto</td>${cells}<td><span class="${y>=0?'pos':'neg'}">${eur0(y)}</span></td></tr>`;
  })() : '';
  const table = all.length ? `
    <div class="fc-wrap"><table class="fc-table">
      <thead><tr><th class="fc-name">Voce</th>${head}<th>Anno</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr class="fc-foot"><td class="fc-name">${incItems.length?'Uscite':'Totale'}</td>${expTotals}<td>${eur0(grandExp)}</td></tr>${saldoRow}</tfoot>
    </table></div>` : emptyState('Nessuna voce. Aggiungi entrate previste, spese ricorrenti, rate, accantonamenti.');
  const monthOpts = MESI.map((m,i)=>`<option value="${i}" ${i===(new Date().getMonth())?'selected':''}>${m}</option>`).join('');
  const scad = upcomingDeadlines(75);
  const scadCard = scad.length ? `
  <section class="card">
    <div class="card-h"><h3 class="card-title">${svg('bell','ic-xs')} In scadenza</h3><span class="muted sm">prossimi 75 giorni</span></div>
    <div class="scad-list">${scad.map(scadenzaRow).join('')}</div>
  </section>` : '';
  const headRight = incItems.length ? `saldo ${eur0(Math.round((grandInc-grandExp)*100)/100)}/anno` : `${eur0(grandExp)}/anno`;
  return `
  ${yearNav()}
  ${scadCard}
  <button class="btn primary block" data-act="fc-new">${svg('plus')} Aggiungi voce</button>
  <section class="card">
    <div class="card-h"><h3 class="card-title">Piano ${fYear}</h3><span class="muted sm">${headRight}</span></div>
    ${table}
    <p class="hint">Tocca una voce per modificarla. Le rate scorrono da sole oltre fine anno; gli accantonamenti si ripartiscono fino alla scadenza.</p>
  </section>
  <section class="card">
    <div class="card-h"><h3 class="card-title">Porta nel rendiconto</h3></div>
    <p class="hint" style="margin-top:0">Crea nel registro le voci fisse del mese scelto (una sola volta): uscite, entrate previste e accantonamenti (giroconti sul conto dedicato).</p>
    <div class="carry">
      <label class="field grow"><span>Mese</span><select id="carry-month">${monthOpts}</select></label>
      <button class="btn primary" data-act="fc-carry-pick" data-year="${fYear}">${svg('download')} Porta</button>
    </div>
  </section>`;
}

const startYM = () => (BUDGET.startDate && BUDGET.startDate.length>=10) ? periodOf(BUDGET.startDate) : null;
const beforeStart = ym => { const s=startYM(); return s ? ym < s : false; };
const isStartMonth = ym => { const s=startYM(); return !!s && ym===s && BUDGET.startDate > periodRange(ym).startISO; };
function plannedBudgetMonth(ym){
  const yy=+ym.slice(0,4), mi=+ym.slice(5,7)-1; let inc=0, needs=0, wants=0;
  DATA.forecast.forEach(it=>{ const v=fcMonthlyPlan(it,yy,mi); if(v<=0) return;
    if(it.flow==='entrata') inc+=v; else if(it.macro==='superflue') wants+=v; else needs+=v; });
  return { inc:Math.round(inc*100)/100, needs:Math.round(needs*100)/100, wants:Math.round(wants*100)/100 };
}
function budgetCard(list, entReal, uscReal){
  const p=BUDGET; const sumP=Math.round((+p.needs||0)+(+p.wants||0)+(+p.save||0));
  const realNeeds=Math.round(sum(list.filter(t=>countsExpense(t)&&NEEDS_MACROS.includes(t.macro)).map(t=>t.amount))*100)/100;
  const realWants=Math.round(sum(list.filter(t=>countsExpense(t)&&t.macro==='superflue').map(t=>t.amount))*100)/100;
  const plan=plannedBudgetMonth(fMonth);
  const usePrev = budgetSource==='preventivo';
  const ent = usePrev ? plan.inc : entReal;
  const needsA = usePrev ? plan.needs : realNeeds;
  const wantsA = usePrev ? plan.wants : realWants;
  const saveA = Math.round((ent-needsA-wantsA)*100)/100;
  const tN=Math.round(ent*(+p.needs||0))/100, tW=Math.round(ent*(+p.wants||0))/100, tS=Math.round(ent*(+p.save||0))/100;
  const pctIn=(id,val,lab)=>`<label class="b532-in"><span>${lab}</span><span class="b532-box"><input id="${id}" data-act="budget-set" type="number" inputmode="numeric" min="0" max="100" value="${Math.round(+val||0)}"><span class="b532-pc">%</span></span></label>`;
  const row=(lab,color,target,actual,isSave)=>{
    const w = target>0 ? Math.min(100, Math.max(0,actual)/target*100) : (actual>0?100:0);
    const d=Math.round((actual-target)*100)/100;
    const tag = isSave
      ? (d>=0?`<span class="pos">centrato (+${eur(d)})</span>`:`<span class="neg">mancano ${eur(-d)}</span>`)
      : (d<=0?`<span class="pos">margine ${eur(-d)}</span>`:`<span class="neg">oltre di ${eur(d)}</span>`);
    const bad = isSave ? actual<target : actual>target;
    return `<div class="b532-row">
      <div class="b532-top"><span>${lab} <span class="muted sm">· obiettivo ${eur(target)}</span></span><b>${eur(Math.round(actual*100)/100)}</b></div>
      <span class="goal-bar"><span class="goal-fill${bad?' over':''}" style="width:${w.toFixed(1)}%;--gc:${color}"></span></span>
      <div class="b532-sub">${tag}</div>
    </div>`;
  };
  let advice='';
  if(ent>0){
    const deficit=Math.round((tS-saveA)*100)/100;
    if(deficit>0){
      const overW=Math.max(0,Math.round((wantsA-tW)*100)/100), overN=Math.max(0,Math.round((needsA-tN)*100)/100);
      const parts=[];
      if(overW>0) parts.push(`lo svago supera la sua quota di ${eur(overW)}`);
      if(overN>0) parts.push(`le necessità di ${eur(overN)}`);
      advice=`Margine di risparmio ${eur(saveA)} — sotto l'obiettivo di ${eur(deficit)}${parts.length?` (${parts.join(' e ')})`:''}.`;
    } else advice=`Margine di risparmio ${eur(saveA)} — obiettivo centrato${(-deficit)>0?` (${eur(-deficit)} oltre)`:''}.`;
  }
  const seg=(id,lab)=>`<button class="seg-btn${budgetSource===id?' on':''}" data-act="budget-src" data-src="${id}">${lab}</button>`;
  const srcNote = usePrev
    ? 'Entrate e spese dal Previsionale del mese: è il margine di risparmio pianificato.'
    : 'Entrate e spese realmente registrate nel mese.';
  return `
  <section class="card">
    <div class="card-h"><h3 class="card-title">Regola ${Math.round(+p.needs||0)}/${Math.round(+p.wants||0)}/${Math.round(+p.save||0)}</h3><span class="muted sm">${usePrev?'preventivo':'reale'} · entrate ${eur(ent)}</span></div>
    <div class="seg" style="margin:2px 0 10px">${seg('preventivo','Preventivo')}${seg('reale','Reale')}</div>
    ${ent>0?`
    <div class="b532-ins">${pctIn('bg-needs',p.needs,'Necessità')}${pctIn('bg-wants',p.wants,'Svago')}${pctIn('bg-save',p.save,'Risparmio')}</div>
    ${sumP!==100?`<div class="calc-row warn" style="margin:2px 0 6px"><span>Le percentuali sommano a ${sumP}, non a 100.</span></div>`:''}
    ${row('Necessità','#927A45',tN,needsA,false)}
    ${row('Svago e hobby','#C2A36A',tW,wantsA,false)}
    ${row('Risparmio','#3E6B63',tS,saveA,true)}
    ${advice?`<p class="hint" style="margin-top:8px">${advice}</p>`:''}
    <p class="hint">${srcNote} Necessità = Incomprimibili+Oggettive · Svago = Superflue. Cambia le percentuali e le quote si ricalcolano.</p>
    `:emptyState(usePrev?'Nel Previsionale non ci sono entrate per questo mese: aggiungile come voci "Entrata".':'Nessuna entrata registrata nel mese.')}
  </section>`;
}

/* ===================== Vista: Delta ===================== */
function barsH(items){
  const max = Math.max(...items.map(i=>i.value), 1);
  return `<div class="bars">${items.map(i=>`<div class="bar-row"><div class="bar-label">${escapeHtml(i.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,(i.value/max*100)).toFixed(1)}%;background:${i.color||'#3E6B63'}"></div></div><div class="bar-val">${eur(i.value)}</div></div>`).join('')}</div>`;
}
function lineChart(series,{ color='#3E6B63' }={}){
  if(!series || series.length<2) return emptyState('Dati insufficienti per il grafico.');
  const w=320,h=130,pl=6,pr=6,pt=12,pb=20;
  const vals=series.map(s=>s.value);
  let min=Math.min(...vals,0), max=Math.max(...vals,0); if(min===max){ min-=1; max+=1; }
  const X=i=>pl+(w-pl-pr)*(i/(series.length-1));
  const Y=v=>pt+(h-pt-pb)*(1-(v-min)/(max-min));
  const pts=series.map((s,i)=>`${X(i).toFixed(1)},${Y(s.value).toFixed(1)}`).join(' ');
  const area=`${pl},${Y(0).toFixed(1)} ${pts} ${(w-pr).toFixed(1)},${Y(0).toFixed(1)}`;
  const dots=series.map((s,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(s.value).toFixed(1)}" r="2.4"/>`).join('');
  const labels=series.map((s,i)=>`<text x="${X(i).toFixed(1)}" y="${h-6}" text-anchor="middle" class="cl">${escapeHtml(s.label)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Grafico andamento">
    <line x1="${pl}" y1="${Y(0).toFixed(1)}" x2="${w-pr}" y2="${Y(0).toFixed(1)}" class="axis"/>
    <polygon points="${area}" fill="${color}" opacity="0.10"/>
    <polyline fill="none" stroke="${color}" stroke-width="2" points="${pts}"/>
    <g fill="${color}">${dots}</g><g>${labels}</g>
  </svg>`;
}
function groupedBars(series){
  if(!series || !series.length) return emptyState('Dati insufficienti per il grafico.');
  const w=320,h=152,pl=6,pr=6,pt=10,pb=22;
  const max=Math.max(1,...series.flatMap(s=>[s.entrate,s.uscite]));
  const n=series.length, slot=(w-pl-pr)/n, bw=Math.max(5,Math.min(13, slot/2-3));
  const base=h-pb; const Y=v=>pt+(base-pt)*(1-v/max);
  let bars='';
  series.forEach((s,i)=>{
    const cx=pl+slot*i+slot/2, x1=cx-bw-1, x2=cx+1;
    bars+=`<rect x="${x1.toFixed(1)}" y="${Y(s.entrate).toFixed(1)}" width="${bw}" height="${Math.max(0,base-Y(s.entrate)).toFixed(1)}" rx="2" fill="#3E6B63"/>`;
    bars+=`<rect x="${x2.toFixed(1)}" y="${Y(s.uscite).toFixed(1)}" width="${bw}" height="${Math.max(0,base-Y(s.uscite)).toFixed(1)}" rx="2" fill="#A6533F"/>`;
    bars+=`<text x="${cx.toFixed(1)}" y="${h-7}" text-anchor="middle" class="cl">${escapeHtml(s.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Entrate contro uscite">
    <line x1="${pl}" y1="${base.toFixed(1)}" x2="${w-pr}" y2="${base.toFixed(1)}" class="axis"/>${bars}
  </svg>
  <div class="chart-legend"><span><span class="lg-dot" style="background:#3E6B63"></span>Entrate</span><span><span class="lg-dot" style="background:#A6533F"></span>Uscite</span></div>`;
}
function viewDelta(){
  const list = txMonth(fMonth);
  const ent = sum(list.filter(countsIncome).map(t=>t.amount));
  const usc = sum(list.filter(countsExpense).map(t=>t.amount));
  const delta = ent - usc;
  const per={}; MACROS.forEach(m=>per[m.key]=0);
  list.filter(countsExpense).forEach(t=>{ per[t.macro]=(per[t.macro]||0)+(+t.amount||0); });
  const macroBars = MACROS.map(m=>({ label:`${m.label}${usc>0?' · '+Math.round(per[m.key]/usc*100)+'%':''}`, value:per[m.key], color:m.color }));
  const pp={}; list.filter(countsExpense).forEach(t=>{ pp[t.paidBy]=(pp[t.paidBy]||0)+(+t.amount||0); });
  const personBars = Object.keys(pp).map(uid=>{ const mm=memberById(uid); return { label:mm?firstName(mm.name):'—', value:pp[uid], color:mm?mm.color:'#999' }; }).sort((a,b)=>b.value-a.value);
  const months=[]; for(let i=7;i>=0;i--){ const ym=shiftMonth(curMonth(),-i); if(!beforeStart(ym)) months.push(ym); }
  const series = months.map(ym=>{ const l=txMonth(ym); const e=sum(l.filter(countsIncome).map(t=>t.amount)); const u=sum(l.filter(countsExpense).map(t=>t.amount)); return { label:monthAbbr(ym), value:e-u }; });
  const euSeries = months.map(ym=>{ const l=txMonth(ym); return { label:monthAbbr(ym), entrate:sum(l.filter(countsIncome).map(t=>t.amount)), uscite:sum(l.filter(countsExpense).map(t=>t.amount)) }; });
  const hasEU = euSeries.some(s=>s.entrate>0||s.uscite>0);
  const pre = beforeStart(fMonth);
  const partial = isStartMonth(fMonth);
  const startNote = pre
    ? `<div class="daynote warn">Mese precedente all'inizio del monitoraggio (${dayShort2(BUDGET.startDate)}): i dati potrebbero essere incompleti.</div>`
    : (partial ? `<div class="daynote">Mese parziale: monitoraggio iniziato il ${dayShort2(BUDGET.startDate)}. Il risparmio del mese può risultare falsato (es. stipendio accreditato con poche spese registrate).</div>` : '');
  return `
  ${monthNav()}
  <section class="card center">
    <div class="big-k">Delta di ${monthName(fMonth)}</div>
    <div class="big-v ${delta>=0?'pos':'neg'}">${signed(delta)}</div>
    <div class="muted">${delta>=0?'Risparmio del mese':'Avete speso più di quanto entrato'}</div>
  </section>
  ${startNote}
  ${budgetCard(list, ent, usc)}
  <section class="card"><div class="card-h"><h3 class="card-title">Entrate e uscite</h3><span class="muted sm">${months.length} mesi</span></div>${hasEU?groupedBars(euSeries):emptyState('Dati insufficienti per il grafico.')}</section>
  <section class="card"><div class="card-h"><h3 class="card-title">Per macroarea</h3></div>${usc>0?barsH(macroBars):emptyState('Nessuna uscita nel mese.')}</section>
  <section class="card"><div class="card-h"><h3 class="card-title">Chi ha speso</h3></div>${personBars.length?barsH(personBars):emptyState('Nessuna uscita nel mese.')}</section>
  <section class="card"><div class="card-h"><h3 class="card-title">Andamento del delta</h3><span class="muted sm">${months.length} mesi</span></div>${lineChart(series)}</section>
  `;
}

/* ===================== Vista: Patrimonio ===================== */
function cardUsageMonth(id){ return sum(txMonth(curMonth()).filter(t=>t.type==='uscita'&&t.account===id).map(t=>t.amount)); }
function accRow(a, bal){
  const km=kindMeta(a.kind); const b=bal[a.id]||0; const isCard=a.kind==='carta';
  const tags = `<span class="kind-tag">${km.label}</span>${a.locked&&!isCard?' · vincolato':''}${a.excludeNetWorth?' · promemoria':''}${isCard&&a.billingDay?` · addebito il ${a.billingDay}`:''}`;
  const extra = isCard ? `<span class="muted sm"> · utilizzo mese ${eur0(cardUsageMonth(a.id))}</span>` : '';
  return `<button class="row" data-act="acc-open" data-id="${a.id}">
    <span class="row-dot" style="--c:${km.color}"></span>
    <span class="row-main"><span class="row-cat">${escapeHtml(a.name)}</span><span class="row-meta">${tags}${extra}</span></span>
    <span class="row-side"><span class="row-amt ${b<0?'neg':''}">${eur(b)}</span></span>
  </button>`;
}
function viewPatrimonio(){
  const np = netWorthParts(); const bal=np.bal;
  const dispoAcc = DATA.accounts.filter(a=>a.kind!=='carta'&&!a.locked&&!a.excludeNetWorth);
  const vincAcc  = DATA.accounts.filter(a=>a.kind!=='carta'&&a.locked&&!a.excludeNetWorth);
  const memoAcc  = DATA.accounts.filter(a=>a.kind!=='carta'&&a.excludeNetWorth);
  const cardAcc  = DATA.accounts.filter(a=>a.kind==='carta');
  const accSub = (title,arr,tot,cls) => arr.length ? `
    <div class="card-h" style="margin:12px 0 6px"><h4 class="card-title" style="font-size:1.02rem">${title}</h4><b class="${cls||''}">${eur(tot)}</b></div>
    <div class="list">${arr.map(a=>accRow(a,bal)).join('')}</div>` : '';
  const noAcc = !DATA.accounts.length ? emptyState('Nessun conto. Aggiungi i conti correnti.') : '';
  const manualA = DATA.assets.filter(a=>a.type!=='passivo');
  const manualP = DATA.assets.filter(a=>a.type==='passivo');
  const rataP = rataPassivita();
  const assetGroup = (items,isP) => items.length ? `<div class="list">${items.map(a=>`
      <button class="row" data-act="asset-edit" data-id="${a.id}">
        <span class="row-dot" style="--c:${isP?'#A6533F':'#927A45'}"></span>
        <span class="row-main"><span class="row-cat">${escapeHtml(a.name)}</span><span class="row-meta">${escapeHtml(a.category||'')}${a.note?' · '+escapeHtml(a.note):''}</span></span>
        <span class="row-side"><span class="row-amt">${eur(a.value)}</span></span>
      </button>`).join('')}</div>` : '';
  const rataRows = rataP.length ? `<div class="list">${rataP.map(x=>`
      <button class="row" data-act="fc-open-pass" data-id="${x.item.id}">
        <span class="row-dot" style="--c:#A6533F"></span>
        <span class="row-main"><span class="row-cat">${escapeHtml(x.name)}</span><span class="row-meta">da piano rate · ${x.n-x.paid} rate residue su ${x.n}</span></span>
        <span class="row-side"><span class="row-amt">${eur(x.residuo)}</span></span>
      </button>`).join('')}</div>` : '';
  const passEmpty = (!manualP.length && !rataP.length) ? emptyState('Nessun debito registrato.') : '';
  const snaps = [...DATA.snapshots].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const series = snaps.map(s=>({ label:dayShort(s.date), value:+s.netto||0 }));
  const cardTot = np.cards;
  return `
  <section class="card center net">
    <div class="big-k">Patrimonio netto</div>
    <div class="big-v ${np.netto>=0?'pos':'neg'}">${signed(np.netto)}</div>
    <div class="net-split"><span>Disponibile ${eur(np.dispo)}</span><span>Vincolata ${eur(np.vinc)}</span><span>Beni ${eur(np.otherA)}</span><span>Debiti <span class="neg">${eur(np.pass)}</span></span></div>
  </section>

  <section class="card">
    <div class="card-h"><h3 class="card-title">Conti · Liquidità</h3><b>${eur(np.liquid)}</b></div>
    ${noAcc}
    ${accSub('Disponibile', dispoAcc, dispoAcc.reduce((s,a)=>s+(bal[a.id]||0),0))}
    ${accSub('Vincolata', vincAcc, np.vinc)}
    ${accSub('Carte di credito', cardAcc, cardTot, cardTot<0?'neg':'')}
    ${memoAcc.length ? `
    <div class="card-h" style="margin:12px 0 6px"><h4 class="card-title" style="font-size:1.02rem">Promemoria · fuori totale</h4><b class="muted">${eur(np.memo)}</b></div>
    <div class="list">${memoAcc.map(a=>accRow(a,bal)).join('')}</div>
    <p class="hint" style="margin-top:6px">Non conteggiati in liquidità né nel patrimonio: soldi già presenti in un altro conto (es. la quota di Samuele investita nel conto investimento).</p>` : ''}
    <button class="btn ghost block" data-act="acc-new" style="margin-top:12px">${svg('plus')} Aggiungi conto o carta</button>
  </section>

  ${(()=>{ const avg=avgIncomeMonthly();
    const rows = DATA.goals.map(g=>{
      const s=goalStats(g); const a=accountById(g.account);
      let plan='';
      if(s.remaining<=0) plan='Obiettivo raggiunto';
      else {
        const bits=[];
        if(s.quotaFromDue!=null && !s.duePast) bits.push(`${eur(s.quotaFromDue)}/mese per ${s.monthsToDue} mesi${avg>0?` · ≈${Math.round(s.quotaFromDue/avg*100)}% delle entrate`:''}`);
        if(s.duePast) bits.push(`scadenza passata · mancano ${eur(s.remaining)}`);
        if(s.monthsFromMonthly!=null) bits.push(`a ${eur(s.monthly)}/mese: pronti a ${MESI_AB[s.etaM]} ${s.etaY}`);
        if(!bits.length) bits.push(`mancano ${eur(s.remaining)}`);
        plan=bits.join(' · ');
      }
      return `<button class="row goal-row" data-act="goal-edit" data-id="${g.id}">
        <span class="row-main">
          <span class="row-cat">${escapeHtml(g.name)} <span class="muted sm">· ${a?escapeHtml(a.name):'—'}</span></span>
          <span class="goal-bar"><span class="goal-fill" style="width:${s.pct.toFixed(1)}%"></span></span>
          <span class="row-meta">${eur(s.bal)} di ${eur(s.target)} (${Math.round(s.pct)}%) · ${plan}</span>
        </span>
      </button>`;
    }).join('');
    return `<section class="card">
    <div class="card-h"><h3 class="card-title">${svg('target','ic-xs')} Obiettivi di risparmio</h3></div>
    ${rows?`<div class="list">${rows}</div>`:emptyState('Nessun obiettivo. Es.: Fondo emergenza, 10.000 € entro luglio 2028 → l\u2019app calcola la quota mensile.')}
    <button class="btn ghost block" data-act="goal-new" style="margin-top:10px">${svg('plus')} Aggiungi obiettivo</button>
    ${rows?`<p class="hint" style="margin-top:8px">Il progresso è il saldo del conto collegato: versa con un giroconto. Se vuoi la quota anche nel piano mensile, crea un Accantonamento nel Previsionale verso lo stesso conto.</p>`:''}
  </section>`; })()}

  <section class="card">
    <div class="card-h"><h3 class="card-title">Altri beni</h3><b>${eur(np.otherA)}</b></div>
    ${assetGroup(manualA,false)||emptyState('Nessun altro bene registrato.')}
    <button class="btn ghost block" data-act="asset-new" style="margin-top:10px">${svg('plus')} Aggiungi bene (immobili, vinili…)</button>
  </section>

  <section class="card">
    <div class="card-h"><h3 class="card-title">Passività</h3><b class="neg">${eur(np.pass)}</b></div>
    ${rataP.length?`<div class="card-h" style="margin:4px 0 6px"><h4 class="card-title" style="font-size:1.02rem">Finanziamenti (residuo a oggi)</h4><b class="neg">${eur(np.passRate)}</b></div>${rataRows}`:''}
    ${manualP.length?`<div class="card-h" style="margin:12px 0 6px"><h4 class="card-title" style="font-size:1.02rem">Altri debiti</h4><b class="neg">${eur(np.passManual)}</b></div>${assetGroup(manualP,true)}`:''}
    ${passEmpty}
    <button class="btn ghost block" data-act="asset-new-p" style="margin-top:10px">${svg('plus')} Aggiungi debito</button>
    ${rataP.length?`<p class="hint" style="margin-top:8px">I finanziamenti vengono dal Previsionale: il residuo cala da sé a ogni rata. Toccali per modificarli.</p>`:''}
  </section>

  <section class="card">
    <div class="card-h"><h3 class="card-title">Andamento e coerenza</h3><button class="btn ghost sm" data-act="snapshot">${svg('camera')} Fotografia</button></div>
    ${(()=>{ const b=snapBridge(); if(!b) return '';
      const line=(lab,val,strong)=>`<div class="calc-row"><span>${lab}</span><b class="${val>=0?'':'neg'}${strong?' big':''}">${signed(val)}</b></div>`;
      return `<div class="snap-delta">
        <div class="snap-k">Variazione patrimonio · ultime due fotografie</div>
        <div class="snap-v ${b.dNW>=0?'pos':'neg'}">${signed(b.dNW)}</div>
        <div class="muted sm">${dayShort2(b.prev.date)} → ${dayShort2(b.last.date)} · ${b.days} giorni · ≈ ${eur(b.perMonth)}/mese</div>
      </div>
      <div class="fc-calc" style="margin-top:8px">
        ${line('Risparmio registrato (entrate − uscite)', b.pl)}
        ${line('Conciliazioni (scostamenti dalla banca)', b.rett)}
        ${line('Rivalutazioni / altro', b.other)}
      </div>
      <div class="verdict ${b.coherent?'ok':'warn'}">${b.coherent
        ? svg('check','ic-xs')+' Registro coerente col patrimonio: la variazione è spiegata dai movimenti registrati.'
        : svg('bell','ic-xs')+` Scostamenti da verificare: ${eur(Math.abs(b.rett))} corretti con conciliazione${Math.abs(b.other)>1?`, ${signed(b.other)} da rivalutazioni o movimenti non registrati`:''}.`}</div>
      <p class="hint" style="margin-top:8px">Perché il controllo sia affidabile, prima di salvare la fotografia <b>concilia i conti con la banca</b> (tocca il conto → Concilia): così la fotografia riflette i saldi reali e i movimenti dimenticati emergono nella riga "Conciliazioni".</p>`; })()}
    ${series.length>=2?lineChart(series,{color:'#3E6B63'}):emptyState('Salva una "Fotografia" a ogni busta paga (dopo aver conciliato i conti): la differenza tra due fotografie è il risparmio reale del periodo, e l\u2019app controlla che il registro sia coerente.')}
    ${(cycleDay()>1 && (+todayISO().slice(8,10))===cycleDay() && !DATA.snapshots.some(s=>s.date===todayISO())) ? `<p class="hint" style="margin-top:8px"><b>È il giorno della busta paga:</b> concilia i conti e salva una fotografia per fissare il risparmio del periodo appena chiuso.</p>` : ''}
  </section>`;
}

/* ===================== Vista: Altro / Impostazioni ===================== */
function catSection(group,label,items,color){
  return `<div class="cat-sec">
    <h4><span class="tier-dot" style="--c:${color}"></span>${label}</h4>
    <div class="chips">${(items||[]).map(name=>`<span class="chip-c">${escapeHtml(name)}<button class="chip-x" data-act="cat-del" data-group="${group}" data-name="${escapeHtml(name)}" aria-label="Rimuovi ${escapeHtml(name)}">${svg('x','ic-xs')}</button></span>`).join('') || '<span class="muted sm">Vuota</span>'}</div>
    <div class="cat-add"><input id="catin-${group}" placeholder="Aggiungi voce" maxlength="28"><button class="btn ghost sm" data-act="cat-add" data-group="${group}">${svg('plus')} Aggiungi</button></div>
  </div>`;
}
function viewImpostazioni(){
  const isLocal = store.mode==='local';
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const c = DATA.categories;
  return `
  <section class="card">
    <div class="card-h"><h3 class="card-title">Profilo</h3></div>
    <div class="member"><span class="dot" style="--c:${me.color}"></span>
      <div class="grow"><div class="m-name">${escapeHtml(me.name)}</div>${me.email?`<div class="muted sm">${escapeHtml(me.email)}</div>`:''}</div>
      <button class="btn ghost sm" data-act="logout">${svg('logout')} ${isLocal?'Cambia':'Esci'}</button>
    </div>
    <div class="badge ${isLocal?'local':'cloud'}">${isLocal?'Modalità locale · dati solo su questo dispositivo':'Sincronizzato con Firebase'}</div>
    ${isLocal?`<p class="hint">Per sincronizzare tra più dispositivi e utenti, compila <code>firebase-config.js</code> e ripubblica (vedi README).</p>`:''}
  </section>

  <section class="card">
    <div class="card-h"><h3 class="card-title">Famiglia</h3></div>
    <div class="list-plain">${DATA.members.map(m=>`<div class="member"><span class="dot" style="--c:${m.color}"></span><div class="grow"><div class="m-name">${escapeHtml(m.name)}${m.uid===me.uid?' <span class="muted sm">(tu)</span>':''}</div>${m.email?`<div class="muted sm">${escapeHtml(m.email)}</div>`:''}</div>${m.uid!==me.uid?`<button class="btn ghost sm" data-act="member-del" data-id="${m.id||m.uid}" data-uid="${m.uid}" aria-label="Rimuovi ${escapeHtml(m.name)}">${svg('trash')}</button>`:''}</div>`).join('') || '<div class="muted">Nessun membro.</div>'}</div>
    ${isLocal
      ? `<div class="cat-add" style="margin-top:8px"><input id="newprofile" placeholder="Nome nuovo profilo" maxlength="24"><button class="btn ghost sm" data-act="local-create">${svg('plus')} Aggiungi</button></div>`
      : `<div class="cat-add" style="margin-top:8px"><input id="newmember" placeholder="Nome nuovo membro (es. Samuele)" maxlength="24"><button class="btn ghost sm" data-act="member-add">${svg('plus')} Aggiungi</button></div>
         <p class="hint">I membri aggiunti qui compaiono in "chi ha speso" senza bisogno di un accesso. Chi invece deve entrare nell'app crea il proprio accesso (email + password) dal login.</p>`}
  </section>

  <section class="card">
    <div class="card-h"><h3 class="card-title">Categorie</h3></div>
    ${MACROS.map(m=>catSection(m.key, m.label, c.spese[m.key], m.color)).join('')}
    ${catSection('entrate','Entrate', c.entrate, '#3E6B63')}
  </section>

  <section class="card">
    <div class="card-h"><h3 class="card-title">Dati e backup</h3></div>
    ${(()=>{ const bi=lastBackupInfo(), ei=lastExportInfo();
      const bLine = bi ? `Copia automatica: ${bi.days===0?'oggi':(bi.days===1?'ieri':bi.days+' giorni fa')} · ${bi.count} copie sul dispositivo` : 'Copia automatica: si crea al primo avvio con dati';
      const eStale = !ei || ei.days>14;
      const eLine = ei ? `Ultima copia scaricata (file): ${ei.days===0?'oggi':ei.days+' giorni fa'}` : 'Nessuna copia scaricata fuori dal telefono';
      return `<div class="bk-status"><div class="calc-row"><span>${bLine}</span></div><div class="calc-row ${eStale?'warn':''}"><span>${eLine}</span></div></div>
      ${eStale?`<p class="hint" style="margin-top:2px;color:var(--terra)">Consiglio: scarica ogni tanto una copia e mandala su mail/Drive — è l'unica al sicuro se perdi il telefono.</p>`:''}`; })()}
    <button class="btn ghost block" data-act="backups" style="margin-top:8px">${svg('camera')} Copie di sicurezza · ripristina</button>
    <button class="btn ghost block" data-act="export" style="margin-top:8px">${svg('download')} Scarica copia ora (JSON)</button>
    <label class="field" style="margin-top:12px"><span>Inizio monitoraggio (giorno 0)</span><input id="cfg-start" type="date" data-act="startdate-set" value="${BUDGET.startDate||''}"></label>
    <label class="field" style="margin-top:8px"><span>Giorno di inizio ciclo (busta paga)</span><input id="cfg-cycle" type="number" inputmode="numeric" min="1" max="28" data-act="cycle-set" value="${cycleDay()}"></label>
    <label class="field" style="margin-top:8px"><span>Livello mensile (livellamento entrate)</span><input id="cfg-level" type="number" inputmode="decimal" data-act="level-set" value="${+BUDGET.level||''}" placeholder="es. 3000 · 0 per disattivare"></label>
    <p class="hint" style="margin-top:2px">Se lo imposti, la home ti dice quanto spostare da/verso una riserva per rendere i mesi uguali nonostante entrate irregolari (13ª, 730, B&B). ${avgIncomeRecent()>0?`Media entrate recenti: ${eur(avgIncomeRecent())}.`:''}</p>
    <p class="hint" style="margin-top:2px">Metti il giorno in cui arriva lo stipendio (es. 27): il "mese" diventa il tuo ciclo di paga (27→26), così ogni periodo contiene una busta all'inizio e chiude con un risparmio certo. Lascia 1 per il mese solare. Il giorno 0 esclude i periodi precedenti dai grafici e segnala come parziale quello iniziale.</p>
    <button class="btn ghost block" data-act="import" style="margin-top:8px">${svg('upload')} Importa / Ripristina (JSON)</button>
    <button class="btn ghost block" data-act="dedup" style="margin-top:8px">${svg('check')} Rimuovi duplicati (ripara import)</button>
    <p class="hint" style="margin-top:8px">L'importazione aggiunge i dati del file a quelli presenti; gli elementi con lo stesso identificativo vengono aggiornati, non duplicati. Utile per recuperare i dati da una vecchia installazione: esporta là, importa qui.</p>
    ${!standalone ? (iOS
      ? `<p class="hint">Per installare l'app: tocca <b>Condividi</b> e poi <b>Aggiungi a Home</b>.</p>`
      : (deferredPrompt?`<button class="btn ghost block" data-act="install" style="margin-top:8px">${svg('download')} Installa app</button>`:'')) : ''}
    <p class="hint">Conti di Famiglia · v3</p>
  </section>
  `;
}

/* ===================== Schermata di accesso ===================== */
function renderGate(){ return store.mode==='local' ? renderLocalGate() : renderAuthGate(); }
function renderAuthGate(){
  el('root').innerHTML = `
  <div class="auth"><div class="auth-card">
    <div class="auth-logo"></div>
    <h1 class="auth-title">Conti di Famiglia</h1>
    <p class="auth-sub">Entrate, uscite, delta e patrimonio — insieme.</p>
    <div class="tabs">
      <button class="${gateTab==='login'?'active':''}" data-act="gate-tab" data-tab="login">Accedi</button>
      <button class="${gateTab==='register'?'active':''}" data-act="gate-tab" data-tab="register">Registrati</button>
    </div>
    <div class="auth-form">
      ${gateTab==='register'?`<label class="field"><span>Nome</span><input id="au-name" placeholder="Es. Domenico" autocomplete="name"></label>`:''}
      <label class="field"><span>Email</span><input id="au-email" type="email" inputmode="email" placeholder="nome@esempio.it" autocomplete="email"></label>
      <label class="field"><span>Password</span><input id="au-pass" type="password" placeholder="Almeno 6 caratteri" autocomplete="${gateTab==='register'?'new-password':'current-password'}"></label>
      <div class="sheet-error" id="au-err"></div>
      <button class="btn primary block" data-act="${gateTab==='login'?'do-login':'do-register'}">${gateTab==='login'?'Accedi':'Crea account'}</button>
    </div>
  </div></div>`;
}
function renderLocalGate(){
  const members = store.local.members();
  el('root').innerHTML = `
  <div class="auth"><div class="auth-card">
    <div class="auth-logo"></div>
    <h1 class="auth-title">Conti di Famiglia</h1>
    <p class="auth-sub">Modalità locale · i dati restano su questo dispositivo.</p>
    ${members.length?`<div class="profile-pick">${members.map(m=>`<button class="profile-btn" data-act="local-select" data-id="${m.uid}"><span class="dot" style="--c:${m.color}"></span>${escapeHtml(m.name)}</button>`).join('')}</div><div class="or">oppure</div>`:''}
    <div class="auth-form">
      <label class="field"><span>Nuovo profilo</span><input id="lg-name" placeholder="Il tuo nome" maxlength="24"></label>
      <div class="sheet-error" id="au-err"></div>
      <button class="btn primary block" data-act="local-create-gate">${svg('plus')} Crea profilo</button>
    </div>
    <p class="hint center">Per sincronizzare tra dispositivi, configura Firebase (vedi README).</p>
  </div></div>`;
}

/* ===================== Modale generica ===================== */
function openSheet(html){
  modalOpen=true;
  const m=el('modal-root');
  m.innerHTML=`<div class="overlay" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  requestAnimationFrame(()=>{ m.querySelector('.overlay')?.classList.add('show'); m.querySelector('.sheet')?.classList.add('open'); });
  const first=m.querySelector('input,select'); if(first) setTimeout(()=>first.focus(),140);
}
function closeSheet(){
  modalOpen=false; movEditId=null; assetEditId=null; accEditId=null; fcEditId=null; goalEditId=null; fixedDetailYm=null; fxDate=null; creditPageId=null;
  el('modal-root').innerHTML='';
  if(pendingRender){ pendingRender=false; render(); }
}

/* ---- option builders ---- */
function memberOptions(sel){ return DATA.members.map(m=>`<option value="${m.uid}" ${m.uid===sel?'selected':''}>${escapeHtml(m.name)}</option>`).join(''); }
function subOptions(mk,sel){ const arr=[...(DATA.categories.spese[mk]||[])]; if(sel&&!arr.includes(sel)) arr.unshift(sel); return arr.map(s=>`<option ${s===sel?'selected':''}>${escapeHtml(s)}</option>`).join(''); }
function srcOptions(sel){ const arr=[...(DATA.categories.entrate||[])]; if(sel&&!arr.includes(sel)) arr.unshift(sel); return arr.map(s=>`<option ${s===sel?'selected':''}>${escapeHtml(s)}</option>`).join(''); }
function accountOptions(sel,includeEmpty){ let o=includeEmpty?`<option value="">— nessun conto —</option>`:''; return o+DATA.accounts.map(a=>`<option value="${a.id}" ${a.id===sel?'selected':''}>${escapeHtml(a.name)}</option>`).join(''); }

/* ===================== Modale: Movimento ===================== */
function openMovSheet(tx){
  movEditId = tx?tx.id:null;
  const def = DATA.accounts[0]?DATA.accounts[0].id:'';
  const d = tx
    ? { type:tx.type, amount:tx.amount, date:tx.date, macro:tx.macro, sub:tx.sub, cat:(tx.type==='entrata'?tx.sub:''), account:tx.account||'', who:tx.paidBy, note:tx.note, vehicle:tx.vehicle||'', excludeTotals:!!tx.excludeFromTotals }
    : { type:'uscita', amount:'', date:todayISO(), macro:'incomprimibili', sub:'', cat:'', account:def, who:me.uid, note:'', vehicle:'', excludeTotals:false };
  renderMovSheet(d);
}
function renderMovSheet(d){
  sheetType=d.type;
  const isU = d.type==='uscita';
  const catArea = isU
    ? `<label class="field"><span>Macroarea</span><select id="mov-macro" data-act="mov-macro">${MACROS.map(m=>`<option value="${m.key}" ${m.key===d.macro?'selected':''}>${m.label}</option>`).join('')}</select></label>
       <label class="field"><span>Sottocategoria</span><select id="mov-sub" data-act="mov-sub">${subOptions(d.macro, d.sub)}</select></label>
       <label class="field" id="mov-vehicle-wrap" style="${isFuelSub(d.sub)?'':'display:none'}"><span>Veicolo</span><input id="mov-vehicle" list="veh-list" placeholder="Es. Auto, Moto" value="${escapeHtml(d.vehicle||'')}"><datalist id="veh-list">${vehicleList().map(v=>`<option value="${escapeHtml(v)}"></option>`).join('')}</datalist></label>`
    : `<label class="field"><span>Categoria</span><select id="mov-cat">${srcOptions(d.cat)}</select></label>`;
  const amountVal = (d.amount!==''&&d.amount!=null) ? String(d.amount).replace('.',',') : '';
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">${movEditId?'Modifica movimento':'Nuovo movimento'}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <div class="seg">
        <button class="${isU?'active':''}" data-act="seg-type" data-type="uscita">Uscita</button>
        <button class="${!isU?'active':''}" data-act="seg-type" data-type="entrata">Entrata</button>
      </div>
      <label class="field"><span>Importo (€)</span><input id="mov-amount" inputmode="decimal" placeholder="0,00" value="${amountVal}"></label>
      <label class="field"><span>Data</span><input id="mov-date" type="date" value="${d.date||todayISO()}"></label>
      ${catArea}
      <label class="field"><span>Conto</span><select id="mov-account">${accountOptions(d.account,true)}</select></label>
      <label class="field"><span>${isU?'Chi ha speso':'Chi ha incassato'}</span><select id="mov-who">${memberOptions(d.who||me.uid)}</select></label>
      <label class="field"><span>Nota (facoltativa)</span><input id="mov-note" placeholder="Dettaglio" value="${escapeHtml(d.note||'')}"></label>
      ${!isU?`<label class="check"><input type="checkbox" id="mov-counts" ${d.excludeTotals?'':'checked'}><span>Conteggia nelle entrate totali (e nel delta)</span></label>`:''}
      <div class="sheet-error" id="mov-err"></div>
      <div class="sheet-actions">
        ${movEditId?`<button class="btn danger" data-act="mov-delete" data-id="${movEditId}">${svg('trash')} Elimina</button>`:''}
        <button class="btn primary grow" data-act="mov-save">${svg('check')} Salva</button>
      </div>
    </div>`);
}
function toggleVehicle(){ const wrap=el('mov-vehicle-wrap'); const sub=el('mov-sub'); if(wrap&&sub) wrap.style.display = isFuelSub(sub.value)?'':'none'; }
function readMov(){
  const v=id=>{ const e=el(id); return e?e.value:''; };
  const d={ type:sheetType, amount:v('mov-amount'), date:v('mov-date'), account:v('mov-account'), who:v('mov-who'), note:v('mov-note') };
  if(sheetType==='uscita'){ d.macro=v('mov-macro'); d.sub=v('mov-sub'); d.vehicle=v('mov-vehicle'); }
  else { d.cat=v('mov-cat'); d.excludeTotals = el('mov-counts')?!el('mov-counts').checked:false; }
  return d;
}
async function saveMov(){
  const d=readMov(); const err=el('mov-err');
  const amt=parseAmount(d.amount);
  if(!(amt>0)){ if(err) err.textContent='Inserisci un importo maggiore di zero.'; return; }
  if(!d.date){ if(err) err.textContent='Scegli una data.'; return; }
  const rec={ type:d.type, amount:Math.round(amt*100)/100, date:d.date, account:d.account||'', paidBy:d.who||me.uid, enteredBy:me.uid, note:(d.note||'').trim() };
  if(d.type==='uscita'){ rec.macro=d.macro||'oggettive'; rec.sub=d.sub||''; rec.vehicle = (isFuelSub(d.sub) && d.vehicle) ? d.vehicle.trim() : ''; }
  else { rec.macro=null; rec.sub=d.cat||''; rec.excludeFromTotals = !!d.excludeTotals; }
  try{
    if(movEditId) await store.update('transactions', movEditId, rec); else await store.add('transactions', rec);
    const edited=!!movEditId; closeSheet(); toast(edited?'Movimento aggiornato':'Movimento aggiunto');
  }catch(e){ if(err) err.textContent='Errore nel salvataggio. Riprova.'; console.warn(e); }
}
async function deleteMov(id){
  if(!confirm('Eliminare questo movimento?')) return;
  try{ await store.remove('transactions', id); closeSheet(); toast('Movimento eliminato'); }catch(e){ console.warn(e); }
}

/* ===================== Modale: Conto (riepilogo + azioni) ===================== */
function openAccountSheet(id){
  const a=accountById(id); if(!a) return;
  const bal=computeBalances()[id]||0; const km=kindMeta(a.kind);
  const isCard=a.kind==='carta';
  const recent = DATA.transactions.filter(t=>t.account===id||t.fromAccount===id||t.toAccount===id).slice(0,6);
  const cardInfo = isCard ? `<div class="net-split" style="margin:-4px 0 10px"><span>Utilizzo mese ${eur(cardUsageMonth(id))}</span>${a.billingDay?`<span>Addebito il ${a.billingDay}</span>`:''}${a.linkedAccount&&accountById(a.linkedAccount)?`<span>Salda da ${escapeHtml(accountById(a.linkedAccount).name)}</span>`:''}</div>` : '';
  const iEst = !isCard ? interestEstimate(a, bal) : null;
  const interestInfo = iEst ? `<div class="fc-calc" style="margin:-2px 0 10px">
      <div class="calc-row"><span>Interessi ${iEst.freq} (stima su ${eur(bal)})</span><b>${eur(iEst.periodGross)} lordi</b></div>
      <div class="calc-row"><span>Ritenuta ${iEst.taxPct}% → netto</span><b>${eur(iEst.periodNet)}</b></div>
      <div class="calc-row"><span>Stima annua netta</span><b>${eur(iEst.annualNet)}</b></div>
    </div>` : '';
  const balLabel = isCard ? '<span class="kind-tag">Da saldare</span>' : `<span class="kind-tag">${km.label}</span>${a.locked?' · vincolato':''}`;
  const actions = isCard
    ? `<div class="acc-actions">
        <button class="btn ghost" data-act="acc-debit" data-id="${id}">${svg('minusc')} Spesa carta</button>
        <button class="btn ghost" data-act="card-settle" data-id="${id}">${svg('scale')} Salda carta</button>
        <button class="btn ghost" data-act="acc-recon" data-id="${id}">${svg('scale')} Concilia</button>
        <button class="btn ghost" data-act="acc-transfer" data-id="${id}">${svg('transfer')} Giroconto</button>
      </div>`
    : `<div class="acc-actions">
        <button class="btn ghost" data-act="acc-credit" data-id="${id}">${svg('plusc')} Accredita</button>
        <button class="btn ghost" data-act="acc-debit" data-id="${id}">${svg('minusc')} Addebita</button>
        <button class="btn ghost" data-act="acc-transfer" data-id="${id}">${svg('transfer')} Giroconto</button>
        <button class="btn ghost" data-act="acc-recon" data-id="${id}">${svg('scale')} Concilia</button>
      </div>
      <button class="btn ghost block" data-act="acc-interest" data-id="${id}" style="margin-top:8px">${svg('percent')} ${iEst?'Registra interessi maturati':'Registra interessi'}</button>`;
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">${escapeHtml(a.name)}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <div class="acc-balance">${balLabel}<div class="acc-bal-v ${bal<0?'neg':''}">${eur(bal)}</div></div>
      ${cardInfo}
      ${interestInfo}
      ${actions}
      <button class="btn ghost block" data-act="acc-edit" data-id="${id}" style="margin-top:8px">${svg('pencil')} Modifica conto</button>
      ${recent.length?`<div class="card-h" style="margin:14px 0 8px"><h3 class="card-title" style="font-size:1.1rem">Ultimi movimenti</h3></div><div class="list">${recent.map(rowTx).join('')}</div>`:''}
    </div>`);
}

/* ===================== Modale: Interessi (tassazione) ===================== */
function openInterest(id){
  const a=accountById(id); if(!a) return; opAccId=id;
  const reg=a.taxRegime||'26';
  const bal=computeBalances()[id]||0; const est=interestEstimate(a,bal);
  const preGross = est ? String(est.periodGross).replace('.',',') : '';
  const preHint = est ? `Precompilato con la stima ${est.freq} sul saldo attuale (${eur(bal)} × ${String(est.rate).replace('.',',')}%). Correggi con l'importo reale della banca.` : `L'app accredita il <b>netto</b> sul conto come entrata "Interessi e rendite". BOT/BTP: 12,5%. Conti e depositi: 26%.`;
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">Interessi · ${escapeHtml(a.name)}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <label class="field"><span>Interesse lordo (€)</span><input id="int-gross" data-act="int-calc" inputmode="decimal" placeholder="0,00" value="${preGross}"></label>
      <label class="field"><span>Tassazione</span><select id="int-reg" data-act="int-calc">${TAX_REGIMES.map(r=>`<option value="${r.id}" ${r.id===reg?'selected':''}>${r.label}</option>`).join('')}</select></label>
      <div id="int-calc-box" class="fc-calc"></div>
      <label class="field"><span>Data</span><input id="int-date" type="date" value="${todayISO()}"></label>
      <div class="sheet-error" id="int-err"></div>
      <div class="sheet-actions"><button class="btn primary grow" data-act="int-save" data-id="${id}">${svg('check')} Accredita netto</button></div>
      <p class="hint" style="margin-top:0">${preHint}</p>
    </div>`);
  updateInterestCalc();
}
function updateInterestCalc(){
  const box=el('int-calc-box'); if(!box) return;
  const gross=parseAmount(el('int-gross')?el('int-gross').value:'')||0;
  const reg=el('int-reg')?el('int-reg').value:'26'; const rate=taxRate(reg);
  if(gross>0){ const tax=Math.round(gross*rate*100)/100, net=Math.round((gross-tax)*100)/100;
    box.innerHTML=`<div class="calc-row"><span>Ritenuta (${Math.round(rate*100)}%)</span><b>−${eur(tax)}</b></div><div class="calc-row"><span>Netto accreditato</span><b>${eur(net)}</b></div>`;
  } else box.innerHTML='';
}
async function saveInterest(id){
  const gross=parseAmount(el('int-gross')?el('int-gross').value:''); const err=el('int-err');
  if(!(gross>0)){ if(err) err.textContent='Inserisci l\u2019interesse lordo.'; return; }
  const reg=el('int-reg')?el('int-reg').value:'26'; const rate=taxRate(reg);
  const tax=Math.round(gross*rate*100)/100, net=Math.round((gross-tax)*100)/100;
  const date=el('int-date')?el('int-date').value||todayISO():todayISO();
  try{
    await store.add('transactions',{ type:'entrata', amount:net, date, account:id, macro:null, sub:'Interessi e rendite', paidBy:me.uid, enteredBy:me.uid, note:`Interessi lordi ${eur(gross)} · ritenuta ${Math.round(rate*100)}%`, interest:true, grossAmount:Math.round(gross*100)/100, taxAmount:tax, taxRegime:reg });
    closeSheet(); toast(`Accreditati ${eur(net)} netti`);
  }catch(e){ if(err) err.textContent='Errore nel salvataggio. Riprova.'; console.warn(e); }
}
async function settleCard(id){
  const a=accountById(id); if(!a) return;
  const bal=computeBalances()[id]||0;
  if(bal>=0){ toast('La carta non ha nulla da saldare'); return; }
  const amount=Math.round(-bal*100)/100;
  const from=a.linkedAccount && accountById(a.linkedAccount) ? a.linkedAccount : (DATA.accounts.find(x=>x.kind!=='carta'&&!x.locked)||{}).id;
  if(!from){ toast('Imposta un conto collegato alla carta'); return; }
  if(!confirm(`Saldare ${eur(amount)} da ${escapeHtml(accountById(from).name)} verso ${escapeHtml(a.name)}?`)) return;
  try{ await store.add('transactions',{ type:'giroconto', amount, date:todayISO(), fromAccount:from, toAccount:id, note:`Saldo ${a.name}`, enteredBy:me.uid }); if(modalOpen) closeSheet(); toast('Carta saldata'); }
  catch(e){ console.warn(e); toast('Errore nel salvataggio'); }
}

/* ===================== Modale: Accredita / Addebita ===================== */
function openAccountOp(id, mode){
  opAccId=id; opMode=mode;
  const isDebit = mode==='debit';
  const a=accountById(id);
  const catArea = isDebit
    ? `<label class="field"><span>Macroarea</span><select id="mov-macro" data-act="mov-macro">${MACROS.map(m=>`<option value="${m.key}" ${m.key==='incomprimibili'?'selected':''}>${m.label}</option>`).join('')}</select></label>
       <label class="field"><span>Sottocategoria</span><select id="mov-sub" data-act="mov-sub">${subOptions('incomprimibili','')}</select></label>
       <label class="field" id="mov-vehicle-wrap" style="display:none"><span>Veicolo</span><input id="mov-vehicle" list="veh-list" placeholder="Es. Auto, Moto"><datalist id="veh-list">${vehicleList().map(v=>`<option value="${escapeHtml(v)}"></option>`).join('')}</datalist></label>`
    : `<label class="field"><span>Categoria</span><select id="op-src">${srcOptions('')}</select></label>`;
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">${isDebit?'Addebita':'Accredita'} · ${escapeHtml(a?a.name:'')}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <label class="field"><span>Importo (€)</span><input id="op-amount" inputmode="decimal" placeholder="0,00"></label>
      <label class="field"><span>Data</span><input id="op-date" type="date" value="${todayISO()}"></label>
      <label class="check"><input type="checkbox" id="op-count" checked><span>Conteggia nel delta come ${isDebit?'uscita':'entrata'}</span></label>
      ${catArea}
      <label class="field"><span>${isDebit?'Chi ha speso':'Chi ha incassato'}</span><select id="op-who">${memberOptions(me.uid)}</select></label>
      <label class="field"><span>Nota (facoltativa)</span><input id="op-note" placeholder="Dettaglio"></label>
      <div class="sheet-error" id="op-err"></div>
      <div class="sheet-actions"><button class="btn primary grow" data-act="op-save">${svg('check')} Salva</button></div>
      <p class="hint" style="margin-top:0">${isDebit?'Togli la spunta per una semplice rettifica di saldo (non entra nel delta né nelle uscite).':'Togli la spunta per accreditare il conto senza conteggiarlo nelle entrate totali (es. rimborso, regalo, giroconto dall\u2019esterno): aumenta il saldo ma non il delta.'}</p>
    </div>`);
}
async function saveAccountOp(){
  const v=id=>{ const e=el(id); return e?e.value:''; };
  const err=el('op-err'); const isDebit=opMode==='debit';
  const amt=parseAmount(v('op-amount'));
  if(!(amt>0)){ if(err) err.textContent='Inserisci un importo maggiore di zero.'; return; }
  const date=v('op-date')||todayISO();
  const count=el('op-count')?el('op-count').checked:true;
  const note=(v('op-note')||'').trim();
  let rec;
  if(isDebit){
    if(!count){ rec={ type:'rettifica', dir:'-', amount:Math.round(amt*100)/100, account:opAccId, date, note:note||'Addebito', enteredBy:me.uid }; }
    else {
      const sub=v('mov-sub')||'';
      rec={ type:'uscita', amount:Math.round(amt*100)/100, date, account:opAccId, macro:v('mov-macro')||'incomprimibili', sub, paidBy:v('op-who')||me.uid, enteredBy:me.uid, note };
      if(isFuelSub(sub) && v('mov-vehicle')) rec.vehicle=v('mov-vehicle').trim();
    }
  } else {
    rec={ type:'entrata', amount:Math.round(amt*100)/100, date, account:opAccId, macro:null, sub:v('op-src')||'', paidBy:v('op-who')||me.uid, enteredBy:me.uid, note, excludeFromTotals:!count };
  }
  try{ await store.add('transactions', rec); closeSheet(); toast(isDebit?'Addebito registrato':'Accredito registrato'); }
  catch(e){ if(err) err.textContent='Errore nel salvataggio. Riprova.'; console.warn(e); }
}

/* ===================== Modale: Giroconto ===================== */
function openTransfer(fromId){
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">Giroconto</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <label class="field"><span>Da</span><select id="gc-from">${accountOptions(fromId,false)}</select></label>
      <label class="field"><span>A</span><select id="gc-to">${accountOptions(fromId&&DATA.accounts[1]&&DATA.accounts[0].id===fromId?DATA.accounts[1].id:(DATA.accounts.find(a=>a.id!==fromId)||{}).id,false)}</select></label>
      <label class="field"><span>Importo (€)</span><input id="gc-amount" inputmode="decimal" placeholder="0,00"></label>
      <label class="field"><span>Data</span><input id="gc-date" type="date" value="${todayISO()}"></label>
      <label class="field"><span>Nota (facoltativa)</span><input id="gc-note" placeholder="Dettaglio"></label>
      <div class="sheet-error" id="gc-err"></div>
      <div class="sheet-actions"><button class="btn primary grow" data-act="gc-save">${svg('check')} Trasferisci</button></div>
      <p class="hint" style="margin-top:0">Il giroconto sposta denaro tra conti: non è entrata né uscita e non incide sul delta.</p>
    </div>`);
}
async function saveTransfer(){
  const v=id=>{ const e=el(id); return e?e.value:''; };
  const err=el('gc-err');
  const from=v('gc-from'), to=v('gc-to'); const amt=parseAmount(v('gc-amount'));
  if(from===to){ if(err) err.textContent='Scegli due conti diversi.'; return; }
  if(!(amt>0)){ if(err) err.textContent='Inserisci un importo maggiore di zero.'; return; }
  try{ await store.add('transactions',{ type:'giroconto', amount:Math.round(amt*100)/100, date:v('gc-date')||todayISO(), fromAccount:from, toAccount:to, note:(v('gc-note')||'').trim(), enteredBy:me.uid }); closeSheet(); toast('Giroconto registrato'); }
  catch(e){ if(err) err.textContent='Errore nel salvataggio. Riprova.'; console.warn(e); }
}

/* ===================== Modale: Concilia saldo ===================== */
function openRecon(id){
  const a=accountById(id); const bal=computeBalances()[id]||0;
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">Concilia · ${escapeHtml(a?a.name:'')}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <p class="hint" style="margin-top:0">Saldo attuale nell'app: <b>${eur(bal)}</b>. Inserisci il saldo reale della banca: l'app registra la rettifica della differenza (non incide sul delta).</p>
      <label class="field"><span>Saldo reale (€)</span><input id="cn-real" inputmode="decimal" placeholder="0,00" value="${String(Math.round(bal*100)/100).replace('.',',')}"></label>
      <label class="field"><span>Nota (facoltativa)</span><input id="cn-note" placeholder="Conciliazione"></label>
      <div class="sheet-error" id="cn-err"></div>
      <div class="sheet-actions"><button class="btn primary grow" data-act="cn-save" data-id="${id}">${svg('check')} Concilia</button></div>
    </div>`);
}
async function saveRecon(id){
  const real=parseAmount(el('cn-real')?el('cn-real').value:''); const err=el('cn-err');
  if(isNaN(real)){ if(err) err.textContent='Inserisci il saldo reale.'; return; }
  const bal=computeBalances()[id]||0; const diff=Math.round((real-bal)*100)/100;
  if(diff===0){ closeSheet(); toast('Saldo già allineato'); return; }
  try{ await store.add('transactions',{ type:'rettifica', dir:diff>0?'+':'-', amount:Math.abs(diff), account:id, date:todayISO(), note:(el('cn-note')&&el('cn-note').value.trim())||'Conciliazione', enteredBy:me.uid }); closeSheet(); toast('Saldo conciliato'); }
  catch(e){ if(err) err.textContent='Errore nel salvataggio. Riprova.'; console.warn(e); }
}

/* ===================== Modale: Conto (nuovo / modifica) ===================== */
function openAccountEdit(a){
  accEditId = a?a.id:null;
  const d = a ? { name:a.name, kind:a.kind||'corrente', opening:a.opening, exclude:!!a.excludeNetWorth, locked:!!a.locked, taxRegime:a.taxRegime||'26', interestRate:(a.interestRate!=null?a.interestRate:''), interestFreq:a.interestFreq||'annuale', billingDay:a.billingDay||'', linkedAccount:a.linkedAccount||'', note:a.note||'' }
              : { name:'', kind:'corrente', opening:'', exclude:false, locked:false, taxRegime:'26', interestRate:'', interestFreq:'annuale', billingDay:'', linkedAccount:'', note:'' };
  renderAccountSheet(d);
}
function readAccountDraft(){
  const v=id=>{ const e=el(id); return e?e.value:''; };
  return { name:v('ae-name'), kind:v('ae-kind')||'corrente', opening:v('ae-opening'),
    exclude: el('ae-exclude')?el('ae-exclude').checked:false, locked: el('ae-locked')?el('ae-locked').checked:false,
    taxRegime:v('ae-tax')||'26', interestRate:v('ae-irate'), interestFreq:v('ae-ifreq')||'annuale',
    billingDay:v('ae-billday'), linkedAccount:v('ae-linked'), note:v('ae-note') };
}
function renderAccountSheet(d){
  const openingVal = (d.opening!==''&&d.opening!=null) ? String(d.opening).replace('.',',') : '';
  const isCard = d.kind==='carta';
  const cardBlock = isCard ? `
      <div class="filters">
        <label class="field"><span>Giorno di addebito</span><input id="ae-billday" inputmode="numeric" value="${d.billingDay||''}" placeholder="es. 15 (Nexi), 21 (Amex)"></label>
        <label class="field"><span>Conto di pagamento</span><select id="ae-linked">${accountOptions(d.linkedAccount,true)}</select></label>
      </div>
      <p class="hint" style="margin-top:0">Le spese sulla carta sono uscite normali sul conto-carta; "Salda" gira il dovuto dal conto di pagamento. L'utilizzo del mese si azzera il 1°.</p>` : '';
  const taxBlock = (!isCard) ? `<div class="filters three">
        <label class="field"><span>Tasso creditore % annuo</span><input id="ae-irate" inputmode="decimal" value="${(d.interestRate!==''&&d.interestRate!=null)?String(d.interestRate).replace('.',','):''}" placeholder="es. 2,5"></label>
        <label class="field"><span>Liquidazione</span><select id="ae-ifreq">${INTEREST_FREQS.map(fr=>`<option value="${fr.id}" ${fr.id===(d.interestFreq||'annuale')?'selected':''}>${fr.label}</option>`).join('')}</select></label>
        <label class="field"><span>Ritenuta</span><select id="ae-tax">${TAX_REGIMES.map(r=>`<option value="${r.id}" ${r.id===d.taxRegime?'selected':''}>${r.id==='125'?'12,5%':(r.id==='26'?'26%':'0%')}</option>`).join('')}</select></label>
      </div>` : '';
  const lockBlock = (!isCard) ? `<label class="check"><input type="checkbox" id="ae-locked" ${d.locked?'checked':''}><span>Conto vincolato (es. pensione) — non conta nella liquidità disponibile</span></label>` : '';
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">${accEditId?'Modifica conto':'Nuovo conto'}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <label class="field"><span>Nome</span><input id="ae-name" placeholder="Es. Conto vacanze, Carta Nexi" value="${escapeHtml(d.name||'')}"></label>
      <label class="field"><span>Tipo</span><select id="ae-kind" data-act="ae-kind">${Object.keys(KINDS).map(k=>`<option value="${k}" ${k===d.kind?'selected':''}>${KINDS[k].label}</option>`).join('')}</select></label>
      <label class="field"><span>Saldo ${accEditId?'iniziale':'attuale'} (€)</span><input id="ae-opening" inputmode="decimal" placeholder="0,00" value="${openingVal}"></label>
      ${cardBlock}
      ${lockBlock}
      ${taxBlock}
      <label class="check"><input type="checkbox" id="ae-exclude" ${d.exclude?'checked':''}><span>Promemoria: escludi da liquidità e patrimonio (soldi già contati in un altro conto)</span></label>
      <label class="field"><span>Nota (facoltativa)</span><input id="ae-note" placeholder="Dettaglio" value="${escapeHtml(d.note||'')}"></label>
      <div class="sheet-error" id="ae-err"></div>
      <div class="sheet-actions">
        ${accEditId?`<button class="btn danger" data-act="acc-delete" data-id="${accEditId}">${svg('trash')} Elimina</button>`:''}
        <button class="btn primary grow" data-act="acc-save">${svg('check')} Salva</button>
      </div>
      ${accEditId&&!isCard?`<p class="hint" style="margin-top:0">Il "saldo iniziale" è il punto di partenza; accrediti, addebiti e giroconti lo modificano. Per allinearlo alla banca usa "Concilia".</p>`:''}
    </div>`);
}
async function saveAccount(){
  const d=readAccountDraft(); const err=el('ae-err');
  const name=(d.name||'').trim();
  if(!name){ if(err) err.textContent='Dai un nome al conto.'; return; }
  const opening=parseAmount(d.opening);
  const isCard=d.kind==='carta';
  const rec={ name, kind:d.kind, opening:isNaN(opening)?0:Math.round(opening*100)/100, excludeNetWorth:!!d.exclude,
    locked: isCard?false:!!d.locked, taxRegime: isCard?'0':(d.taxRegime||'26'),
    interestRate: isCard?0:(parseAmount(d.interestRate)>0?Math.round(parseAmount(d.interestRate)*1000)/1000:0),
    interestFreq: isCard?'annuale':(d.interestFreq||'annuale'),
    billingDay: isCard?(d.billingDay?Math.max(1,Math.min(28,parseInt(d.billingDay,10)||1)):null):null,
    linkedAccount: isCard?(d.linkedAccount||''):'', note:(d.note||'').trim() };
  try{
    if(accEditId){ await store.update('accounts', accEditId, rec); }
    else { rec.order = DATA.accounts.length; await store.add('accounts', rec); }
    const edited=!!accEditId; closeSheet(); toast(edited?'Conto aggiornato':'Conto aggiunto');
  }catch(e){ if(err) err.textContent='Errore nel salvataggio. Riprova.'; console.warn(e); }
}
async function deleteAccount(id){
  const used = DATA.transactions.some(t=>t.account===id||t.fromAccount===id||t.toAccount===id);
  if(!confirm(used?'Questo conto ha movimenti collegati. Eliminandolo i movimenti restano ma senza conto. Procedere?':'Eliminare questo conto?')) return;
  try{ await store.remove('accounts', id); closeSheet(); toast('Conto eliminato'); }catch(e){ console.warn(e); }
}

/* ===================== Modale: Voce patrimonio (beni/debiti) ===================== */
function openAssetSheet(a, forcePassivo){
  assetEditId = a?a.id:null;
  const d = a
    ? { name:a.name, type:a.type==='passivo'?'passivo':'attivo', category:a.category||'', value:a.value, note:a.note }
    : { name:'', type:forcePassivo?'passivo':'attivo', category:'', value:'', note:'' };
  renderAssetSheet(d);
}
function renderAssetSheet(d){
  const sugg = ASSET_SUGG[d.type] || [];
  const valueVal = (d.value!==''&&d.value!=null) ? String(d.value).replace('.',',') : '';
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">${assetEditId?'Modifica voce':'Nuova voce'}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <div class="seg">
        <button class="${d.type==='attivo'?'active':''}" data-act="seg-asset" data-type="attivo">Bene</button>
        <button class="${d.type==='passivo'?'active':''}" data-act="seg-asset" data-type="passivo">Debito</button>
      </div>
      <label class="field"><span>Nome</span><input id="as-name" placeholder="${d.type==='passivo'?'Es. Mutuo casa':'Es. Casa, Collezione vinili'}" value="${escapeHtml(d.name||'')}"></label>
      <label class="field"><span>Categoria</span><input id="as-cat" list="as-sugg" placeholder="${d.type==='passivo'?'Es. Mutuo residuo':'Es. Immobili'}" value="${escapeHtml(d.category||'')}">
        <datalist id="as-sugg">${sugg.map(s=>`<option value="${escapeHtml(s)}"></option>`).join('')}</datalist></label>
      <label class="field"><span>Valore (€)</span><input id="as-value" inputmode="decimal" placeholder="0,00" value="${valueVal}"></label>
      <label class="field"><span>Nota (facoltativa)</span><input id="as-note" placeholder="Dettaglio" value="${escapeHtml(d.note||'')}"></label>
      <div class="sheet-error" id="as-err"></div>
      <div class="sheet-actions">
        ${assetEditId?`<button class="btn danger" data-act="asset-delete" data-id="${assetEditId}">${svg('trash')} Elimina</button>`:''}
        <button class="btn primary grow" data-act="asset-save">${svg('check')} Salva</button>
      </div>
    </div>`);
}
function readAsset(){
  const v=id=>{ const e=el(id); return e?e.value:''; };
  const seg=document.querySelector('.seg button.active[data-act="seg-asset"]');
  return { name:v('as-name'), type:seg?seg.dataset.type:'attivo', category:v('as-cat'), value:v('as-value'), note:v('as-note') };
}
async function saveAsset(){
  const d=readAsset(); const err=el('as-err');
  if(!d.name.trim()){ if(err) err.textContent='Dai un nome alla voce.'; return; }
  const val=parseAmount(d.value);
  if(!(val>=0)){ if(err) err.textContent='Inserisci un valore valido.'; return; }
  const rec={ name:d.name.trim(), type:d.type, category:d.category.trim(), value:Math.round(val*100)/100, note:(d.note||'').trim() };
  try{
    if(assetEditId) await store.update('assets', assetEditId, rec); else await store.add('assets', rec);
    const edited=!!assetEditId; closeSheet(); toast(edited?'Voce aggiornata':'Voce aggiunta');
  }catch(e){ if(err) err.textContent='Errore nel salvataggio. Riprova.'; console.warn(e); }
}
async function deleteAsset(id){
  if(!confirm('Eliminare questa voce?')) return;
  try{ await store.remove('assets', id); closeSheet(); toast('Voce eliminata'); }catch(e){ console.warn(e); }
}

/* ===================== Modale: Voce previsionale ===================== */
const fcYearOptions = sel => { const b=curYear(); let o=''; for(let y=b-1;y<=b+6;y++) o+=`<option value="${y}" ${y===+sel?'selected':''}>${y}</option>`; return o; };
const fcMonthOptions = sel => MESI.map((m,i)=>`<option value="${i}" ${i===+sel?'selected':''}>${m}</option>`).join('');
const groupDatalist = () => [...new Set(DATA.forecast.map(i=>i.group).filter(Boolean))].map(g=>`<option value="${escapeHtml(g)}"></option>`).join('');

function openFcItem(it){
  fcEditId = it?it.id:null;
  const now=new Date(), Y=curYear(), M=now.getMonth();
  const d = it ? {
    kind:it.kind||'ricorrente', flow:it.flow==='entrata'?'entrata':'uscita', name:it.name||'', group:it.group||'', macro:it.macro||'incomprimibili', sub:(it.flow==='entrata'?'':(it.sub||'')), cat:(it.flow==='entrata'?(it.sub||''):''), account:it.account||'', payDay:(it.payDay!=null?it.payDay:''), autoPost:!!it.autoPost, spread:!!it.spread,
    amounts:(it.amounts||Array(12).fill(0)).slice(0,12),
    rataAmount:it.rataAmount, nRate:it.nRate, startYear:it.startYear!=null?it.startYear:Y, startMonth:it.startMonth!=null?it.startMonth:M, linkPass:it.linkPass!==false,
    target:it.target, dueYear:it.dueYear!=null?it.dueYear:Y, dueMonth:it.dueMonth!=null?it.dueMonth:M, dueDay:it.dueDay||'', accStartYear:it.accStartYear!=null?it.accStartYear:Y, accStartMonth:it.accStartMonth!=null?it.accStartMonth:M, fundAccount:it.fundAccount||'',
    amount:it.amount
  } : {
    kind:'ricorrente', flow:'uscita', name:'', group:'', macro:'incomprimibili', sub:'', cat:'', account:'', payDay:'', autoPost:false, spread:false,
    amounts:Array(12).fill(0),
    rataAmount:'', nRate:'', startYear:Y, startMonth:M, linkPass:true,
    target:'', dueYear:Y, dueMonth:M, dueDay:'', accStartYear:Y, accStartMonth:M, fundAccount:'',
    amount:''
  };
  while(d.amounts.length<12) d.amounts.push(0);
  renderFcSheet(d);
}
function renderFcSheet(d){
  const num = v => (v!==''&&v!=null) ? String(v).replace('.',',') : '';
  let block='';
  if(d.kind==='ricorrente'){
    const cells = d.amounts.map((v,i)=>`<label class="mcell"><span>${MESI_AB[i]}</span><input class="fc-in" data-mi="${i}" inputmode="decimal" value="${(+v>0)?String(v).replace('.',','):''}" placeholder="0"></label>`).join('');
    block=`
      <div class="fc-pattern">
        <div class="card-h" style="margin:4px 0 8px"><h3 class="card-title" style="font-size:1.05rem">Distribuzione rapida</h3></div>
        <div class="filters three">
          <label class="field"><span>Importo</span><input id="fc-pamt" inputmode="decimal" placeholder="0,00"></label>
          <label class="field"><span>Frequenza</span><select id="fc-freq"><option value="1">Ogni mese</option><option value="2">Ogni 2 mesi</option><option value="3">Ogni 3 mesi</option><option value="6">Ogni 6 mesi</option><option value="12">Una volta l'anno</option></select></label>
          <label class="field"><span>Dal mese</span><select id="fc-start">${fcMonthOptions(0)}</select></label>
        </div>
        <button class="btn ghost block" data-act="fc-apply" style="margin-top:8px">Applica ai mesi</button>
      </div>
      <div class="card-h" style="margin:6px 0 8px"><h3 class="card-title" style="font-size:1.05rem">Importi per mese (€)</h3></div>
      <div class="mgrid">${cells}</div>
      <p class="hint">Vale per ogni anno. Per una spesa una tantum usa "Scadenza singola".</p>`;
  } else if(d.kind==='rata'){
    block=`
      <div class="filters three">
        <label class="field"><span>Importo rata (€)</span><input id="fc-rata" data-act="fc-recalc" inputmode="decimal" value="${num(d.rataAmount)}" placeholder="0,00"></label>
        <label class="field"><span>N° rate</span><input id="fc-nrate" data-act="fc-recalc" inputmode="numeric" value="${d.nRate!=null&&d.nRate!==''?d.nRate:''}" placeholder="es. 24"></label>
        <label class="field"><span>Prima rata</span><select id="fc-smonth" data-act="fc-recalc">${fcMonthOptions(d.startMonth)}</select></label>
      </div>
      <label class="field"><span>Anno prima rata</span><select id="fc-syear" data-act="fc-recalc">${fcYearOptions(d.startYear)}</select></label>
      <label class="check"><input type="checkbox" id="fc-linkpass" ${d.linkPass?'checked':''}><span>Mostra il debito residuo nelle passività (cala a ogni rata)</span></label>
      <div id="fc-calc" class="fc-calc"></div>`;
  } else if(d.kind==='accantonamento'){
    block=`
      <div class="filters">
        <label class="field"><span>Importo totale (€)</span><input id="fc-target" data-act="fc-recalc" inputmode="decimal" value="${num(d.target)}" placeholder="0,00"></label>
        <label class="field"><span>Conto dedicato (fondo)</span><select id="fc-fund">${accountOptions(d.fundAccount,true)}</select></label>
      </div>
      <div class="filters three">
        <label class="field"><span>Scadenza (mese)</span><select id="fc-duemonth" data-act="fc-recalc">${fcMonthOptions(d.dueMonth)}</select></label>
        <label class="field"><span>Anno</span><select id="fc-dueyear" data-act="fc-recalc">${fcYearOptions(d.dueYear)}</select></label>
        <label class="field"><span>Giorno (opz.)</span><input id="fc-dueday" inputmode="numeric" value="${d.dueDay||''}" placeholder="—"></label>
      </div>
      <label class="field"><span>Inizia ad accantonare da</span><select id="fc-accmonth" data-act="fc-recalc">${fcMonthOptions(d.accStartMonth)}</select></label>
      <div id="fc-calc" class="fc-calc"></div>
      <p class="hint">Ogni mese "Porta nel rendiconto" sposta la quota sul conto dedicato (giroconto). Alla scadenza paghi dal fondo già pieno.</p>`;
  } else {
    block=`
      <div class="filters three">
        <label class="field"><span>Importo (€)</span><input id="fc-amount" inputmode="decimal" value="${num(d.amount)}" placeholder="0,00"></label>
        <label class="field"><span>Scadenza (mese)</span><select id="fc-duemonth">${fcMonthOptions(d.dueMonth)}</select></label>
        <label class="field"><span>Anno</span><select id="fc-dueyear">${fcYearOptions(d.dueYear)}</select></label>
      </div>
      <label class="field"><span>Giorno (opzionale)</span><input id="fc-dueday" inputmode="numeric" value="${d.dueDay||''}" placeholder="—"></label>
      <p class="hint">Comparirà in "In scadenza". Rinnovabile all'anno successivo.</p>`;
  }
  const isInc = d.flow==='entrata';
  if(isInc && (d.kind==='rata'||d.kind==='accantonamento')) d.kind='ricorrente';
  const kindKeys = isInc ? ['ricorrente','scadenza'] : Object.keys(FC_KINDS);
  const hintText = isInc
    ? (d.kind==='scadenza' ? 'Entrata attesa in un\u2019unica soluzione a una data, con avviso.' : 'Importo fisso su uno o più mesi (stipendio, affitto, pensione…).')
    : fcKindMeta(d.kind).hint;
  const catRow = isInc
    ? `<label class="field"><span>Categoria</span><select id="fc-cat">${srcOptions(d.cat)}</select></label>`
    : `<label class="field"><span>Fascia</span><select id="fc-macro">${MACROS.map(m=>`<option value="${m.key}" ${m.key===d.macro?'selected':''}>${m.label}</option>`).join('')}</select></label>`;
  const acctLabel = isInc ? 'Conto di accredito' : (d.kind==='accantonamento' ? 'Conto di origine' : (d.kind==='rata' ? 'Conto di addebito rata' : (d.kind==='scadenza' ? 'Conto di pagamento' : 'Conto predefinito')));
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">${fcEditId?'Modifica voce':'Nuova voce'}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <label class="field"><span>Direzione</span><select id="fc-flow" data-act="fc-kind">
        <option value="uscita" ${!isInc?'selected':''}>Uscita (spesa)</option>
        <option value="entrata" ${isInc?'selected':''}>Entrata (stipendio, affitto…)</option>
      </select></label>
      <label class="field"><span>Tipo voce</span><select id="fc-kind" data-act="fc-kind">${kindKeys.map(k=>`<option value="${k}" ${k===d.kind?'selected':''}>${FC_KINDS[k].label}</option>`).join('')}</select></label>
      <p class="hint" style="margin-top:-2px">${hintText}</p>
      <label class="field"><span>Nome</span><input id="fc-name" placeholder="${isInc?'Es. Stipendio, Affitto casa':'Es. Mutuo, Bollo auto, Prestito'}" value="${escapeHtml(d.name||'')}"></label>
      <div class="filters">
        ${catRow}
        <label class="field"><span>Gruppo (opz.)</span><input id="fc-group" list="fc-grp-list" placeholder="${isInc?'Es. Affitti':'Es. Bollo Veicoli'}" value="${escapeHtml(d.group||'')}"><datalist id="fc-grp-list">${groupDatalist()}</datalist></label>
      </div>
      ${isInc?'':`<label class="field"><span>Sottocategoria (opz.)</span><input id="fc-sub" placeholder="Lascia vuoto per usare il nome" value="${escapeHtml(d.sub||'')}"></label>`}
      <label class="field"><span>${acctLabel}</span><select id="fc-account">${accountOptions(d.account,true)}</select></label>
      ${(d.kind==='ricorrente'||d.kind==='rata') ? `<label class="field"><span>Giorno abituale del mese (facoltativo)</span><input id="fc-payday" inputmode="numeric" min="1" max="31" value="${d.payDay!=null&&d.payDay!==''?d.payDay:''}" placeholder="es. 5 · lascia vuoto per la data odierna"></label>
      <label class="check"><input type="checkbox" id="fc-auto" ${d.autoPost?'checked':''}><span>Registra il movimento da solo alla data (quando apri l\u2019app)</span></label>
      <p class="hint" style="margin-top:-2px">Serve il giorno abituale. A telefono spento non è possibile: registra alla prima apertura dal giorno indicato.</p>` : ''}
      ${(!isInc && d.kind==='ricorrente') ? `<label class="check"><input type="checkbox" id="fc-spread" ${d.spread?'checked':''}><span>Accantona: spalma il totale annuo in quote mensili uguali${(()=>{const s=(d.amounts||[]).reduce((a,b)=>a+(+b||0),0); return s>0?` (≈ ${eur(Math.round(s/12*100)/100)}/mese · ${eur(Math.round(s*100)/100)}/anno)`:'';})()}</span></label>
      <p class="hint" style="margin-top:-2px">La spesa appare come quota mensile distribuita sui mesi che mancano a ogni scadenza (a partire dal giorno 0, non sui mesi già passati). Il pagamento reale resta alla sua data: "voci fisse" e rendiconto non cambiano.</p>` : ''}
      ${block}
      <div class="sheet-error" id="fc-err"></div>
      <div class="sheet-actions">
        ${fcEditId?`<button class="btn danger" data-act="fc-delete" data-id="${fcEditId}">${svg('trash')} Elimina</button>`:''}
        <button class="btn primary grow" data-act="fc-save">${svg('check')} Salva</button>
      </div>
    </div>`);
  updateFcCalc();
}
function updateFcCalc(){
  const box=el('fc-calc'); if(!box) return;
  const v=id=>{ const e=el(id); return e?e.value:''; };
  const kind=v('fc-kind');
  if(kind==='rata'){
    const rata=parseAmount(v('fc-rata'))||0, n=parseInt(v('fc-nrate'),10)||0, sM=parseInt(v('fc-smonth'),10)||0, sY=parseInt(v('fc-syear'),10)||curYear();
    if(rata>0&&n>0){
      const endIdx=sM+n-1, eY=sY+Math.floor(endIdx/12), eM=((endIdx%12)+12)%12;
      const tot=Math.round(rata*n*100)/100;
      const paid=rataPaidCount({startYear:sY,startMonth:sM,nRate:n}, curYear(), new Date().getMonth());
      box.innerHTML=`<div class="calc-row"><span>Durata</span><b>${n} rate · fino a ${MESI_AB[eM]} ${eY}</b></div><div class="calc-row"><span>Totale piano</span><b>${eur(tot)}</b></div><div class="calc-row"><span>Residuo a oggi</span><b>${eur(Math.round((n-paid)*rata*100)/100)}</b></div>`;
    } else box.innerHTML='';
  } else if(kind==='accantonamento'){
    const target=parseAmount(v('fc-target'))||0, dM=parseInt(v('fc-duemonth'),10)||0, dY=parseInt(v('fc-dueyear'),10)||curYear(), aM=parseInt(v('fc-accmonth'),10)||0, aY=curYear();
    const span=(dY-aY)*12+(dM-aM);
    if(target>0&&span>=0){ const months=span+1; box.innerHTML=`<div class="calc-row"><span>Quota mensile</span><b>${eur(Math.round((target/months)*100)/100)}</b></div><div class="calc-row"><span>Mesi</span><b>${months} (fino a ${MESI_AB[dM]} ${dY})</b></div>`; }
    else if(target>0&&span<0){ box.innerHTML=`<div class="calc-row warn"><span>La scadenza è prima del mese d'inizio.</span></div>`; }
    else box.innerHTML='';
  } else box.innerHTML='';
}
function applyFcPattern(){
  const amt=parseAmount(el('fc-pamt')?el('fc-pamt').value:''); if(!(amt>0)) return;
  const freq=parseInt(el('fc-freq').value,10)||1; const start=parseInt(el('fc-start').value,10)||0;
  document.querySelectorAll('.fc-in').forEach(inp=>{
    const i=+inp.dataset.mi;
    const hit = freq===12 ? (i===start) : (((i-start)%freq+freq)%freq===0 && i>=start);
    inp.value = hit ? String(amt).replace('.',',') : '';
  });
}
function readFcAmounts(){ const arr=Array(12).fill(0); document.querySelectorAll('.fc-in').forEach(inp=>{ const i=+inp.dataset.mi; const n=parseAmount(inp.value); arr[i]=isNaN(n)?0:Math.round(n*100)/100; }); return arr; }
function readFcDraft(){
  const v=id=>{ const e=el(id); return e?e.value:''; };
  const d={ kind:v('fc-kind')||'ricorrente', flow:(v('fc-flow')==='entrata'?'entrata':'uscita'), name:v('fc-name'), group:v('fc-group'), macro:v('fc-macro')||'incomprimibili', sub:v('fc-sub'), cat:v('fc-cat'), account:v('fc-account'), payDay:v('fc-payday'), autoPost: el('fc-auto')?el('fc-auto').checked:false, spread: el('fc-spread')?el('fc-spread').checked:false,
    amounts:readFcAmounts(),
    rataAmount:v('fc-rata'), nRate:v('fc-nrate'), startMonth:v('fc-smonth'), startYear:v('fc-syear'), linkPass: el('fc-linkpass')?el('fc-linkpass').checked:true,
    target:v('fc-target'), dueMonth:v('fc-duemonth'), dueYear:v('fc-dueyear'), dueDay:v('fc-dueday'), accStartMonth:v('fc-accmonth'), accStartYear:curYear(), fundAccount:v('fc-fund'),
    amount:v('fc-amount') };
  ['startMonth','startYear','dueMonth','dueYear','accStartMonth'].forEach(k=>{ if(d[k]!==''&&d[k]!=null) d[k]=parseInt(d[k],10); });
  return d;
}
async function saveFcItem(){
  const d=readFcDraft(); const err=el('fc-err'); const name=(d.name||'').trim();
  if(!name){ if(err) err.textContent='Dai un nome alla voce.'; return; }
  const isInc = d.flow==='entrata';
  if(isInc && (d.kind==='rata'||d.kind==='accantonamento')){ if(err) err.textContent='Per le entrate usa Ricorrente o Scadenza singola.'; return; }
  const isRec = (d.kind==='ricorrente'||d.kind==='rata');
  const pd = parseInt(d.payDay,10);
  const payDay = (isRec && pd>0) ? Math.max(1,Math.min(31,pd)) : null;
  const autoPost = (isRec && payDay) ? !!d.autoPost : false;
  const base = isInc
    ? { name, kind:d.kind, flow:'entrata', group:(d.group||'').trim(), macro:null, sub:(d.cat||'Altro'), account:d.account||'', payDay, autoPost, spread:false }
    : { name, kind:d.kind, flow:'uscita', group:(d.group||'').trim(), macro:d.macro||'incomprimibili', sub:(d.sub||'').trim(), account:d.account||'', payDay, autoPost, spread:(d.kind==='ricorrente')?!!d.spread:false };
  let rec;
  if(d.kind==='rata'){
    const rata=parseAmount(d.rataAmount), n=parseInt(d.nRate,10);
    if(!(rata>0)){ if(err) err.textContent='Inserisci l\u2019importo della rata.'; return; }
    if(!(n>0)){ if(err) err.textContent='Inserisci il numero di rate.'; return; }
    rec={ ...base, rataAmount:Math.round(rata*100)/100, nRate:n, startMonth:+d.startMonth||0, startYear:+d.startYear||curYear(), linkPass:!!d.linkPass };
  } else if(d.kind==='accantonamento'){
    const target=parseAmount(d.target);
    if(!(target>0)){ if(err) err.textContent='Inserisci l\u2019importo totale.'; return; }
    if(!d.fundAccount){ if(err) err.textContent='Scegli il conto dedicato (fondo).'; return; }
    rec={ ...base, target:Math.round(target*100)/100, dueMonth:+d.dueMonth||0, dueYear:+d.dueYear||curYear(), dueDay:d.dueDay?parseInt(d.dueDay,10):null, accStartMonth:+d.accStartMonth||0, accStartYear:+d.accStartYear||curYear(), fundAccount:d.fundAccount };
  } else if(d.kind==='scadenza'){
    const amount=parseAmount(d.amount);
    if(!(amount>0)){ if(err) err.textContent='Inserisci l\u2019importo.'; return; }
    rec={ ...base, amount:Math.round(amount*100)/100, dueMonth:+d.dueMonth||0, dueYear:+d.dueYear||curYear(), dueDay:d.dueDay?parseInt(d.dueDay,10):null };
  } else {
    rec={ ...base, year:fYear, amounts:readFcAmounts(), cells:{} };
  }
  try{
    if(fcEditId) await store.update('forecast', fcEditId, rec);
    else { rec.order = DATA.forecast.length; await store.add('forecast', rec); }
    const edited=!!fcEditId; closeSheet(); toast(edited?'Voce aggiornata':'Voce aggiunta');
  }catch(e){ if(err) err.textContent='Errore nel salvataggio. Riprova.'; console.warn(e); }
}
async function renewFc(id){
  const it=DATA.forecast.find(x=>x.id===id); if(!it) return;
  const patch={};
  if(it.kind==='scadenza'||it.kind==='accantonamento') patch.dueYear=(+it.dueYear||curYear())+1;
  if(it.kind==='accantonamento') patch.accStartYear=(+it.accStartYear||curYear())+1;
  if(!Object.keys(patch).length) return;
  try{ await store.update('forecast', id, patch); toast('Scadenza rinnovata all\u2019anno successivo'); }catch(e){ console.warn(e); }
}
async function deleteFcItem(id){
  if(!confirm('Eliminare questa voce del previsionale?')) return;
  try{ await store.remove('forecast', id); closeSheet(); toast('Voce eliminata'); }catch(e){ console.warn(e); }
}

/* ===================== Azioni varie ===================== */
async function saveSnapshot(){
  const np=netWorthParts();
  const rec={ date:todayISO(), attivi:Math.round((np.liquid+np.otherA)*100)/100, passivi:Math.round(np.pass*100)/100, netto:Math.round(np.netto*100)/100,
    liquid:Math.round(np.liquid*100)/100, otherA:Math.round(np.otherA*100)/100, pass:Math.round(np.pass*100)/100 };
  const existing=DATA.snapshots.find(s=>s.date===rec.date);
  try{ if(existing) await store.update('snapshots', existing.id, rec); else await store.add('snapshots', rec); toast('Fotografia del patrimonio salvata'); }
  catch(e){ console.warn(e); toast('Errore nel salvataggio'); }
}
/* ===================== Modale: Obiettivo di risparmio ===================== */
function openGoal(g){
  goalEditId = g?g.id:null;
  const Y=curYear();
  const d = g ? { name:g.name||'', account:g.account||'', target:g.target, dueYear:(g.dueYear!=null?g.dueYear:''), dueMonth:(g.dueMonth!=null?g.dueMonth:''), monthly:g.monthly }
              : { name:'', account:'', target:'', dueYear:'', dueMonth:'', monthly:'' };
  const num=v=>(v!==''&&v!=null)?String(v).replace('.',','):'';
  const monthOpts=`<option value="">—</option>`+MESI.map((m,i)=>`<option value="${i}" ${String(i)===String(d.dueMonth)?'selected':''}>${m}</option>`).join('');
  const yearOpts=(()=>{ let o=`<option value="">—</option>`; for(let y=Y;y<=Y+10;y++) o+=`<option value="${y}" ${String(y)===String(d.dueYear)?'selected':''}>${y}</option>`; return o; })();
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">${goalEditId?'Modifica obiettivo':'Nuovo obiettivo'}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <label class="field"><span>Nome</span><input id="gl-name" placeholder="Es. Fondo emergenza" value="${escapeHtml(d.name)}"></label>
      <div class="filters">
        <label class="field"><span>Conto collegato</span><select id="gl-account" data-act="goal-recalc">${accountOptions(d.account,true)}</select></label>
        <label class="field"><span>Importo obiettivo (€)</span><input id="gl-target" data-act="goal-recalc" inputmode="decimal" placeholder="es. 10000" value="${num(d.target)}"></label>
      </div>
      <div class="filters three">
        <label class="field"><span>Entro (mese)</span><select id="gl-duemonth" data-act="goal-recalc">${monthOpts}</select></label>
        <label class="field"><span>Anno</span><select id="gl-dueyear" data-act="goal-recalc">${yearOpts}</select></label>
        <label class="field"><span>oppure €/mese</span><input id="gl-monthly" data-act="goal-recalc" inputmode="decimal" placeholder="es. 400" value="${num(d.monthly)}"></label>
      </div>
      <div id="gl-calc" class="fc-calc"></div>
      <div class="sheet-error" id="gl-err"></div>
      <div class="sheet-actions">
        ${goalEditId?`<button class="btn danger" data-act="goal-delete" data-id="${goalEditId}">${svg('trash')} Elimina</button>`:''}
        <button class="btn primary grow" data-act="goal-save">${svg('check')} Salva</button>
      </div>
      <p class="hint" style="margin-top:0">Metti la scadenza per sapere quanto serve al mese, oppure la quota mensile per sapere quando arrivi (vanno bene anche entrambe). Il saldo attuale del conto conta già come progresso.</p>
    </div>`);
  updateGoalCalc();
}
function updateGoalCalc(){
  const box=el('gl-calc'); if(!box) return;
  const v=id=>{ const e=el(id); return e?e.value:''; };
  const g={ account:v('gl-account'), target:parseAmount(v('gl-target'))||0,
    dueMonth:v('gl-duemonth')===''?'':parseInt(v('gl-duemonth'),10), dueYear:v('gl-dueyear')===''?'':parseInt(v('gl-dueyear'),10),
    monthly:parseAmount(v('gl-monthly'))||0 };
  if(!(g.target>0)){ box.innerHTML=''; return; }
  const s=goalStats(g); const avg=avgIncomeMonthly(); let h='';
  h+=`<div class="calc-row"><span>Già sul conto</span><b>${eur(s.bal)} · mancano ${eur(s.remaining)}</b></div>`;
  if(s.remaining<=0) h+=`<div class="calc-row"><span>Stato</span><b>Obiettivo già raggiunto</b></div>`;
  else{
    if(s.quotaFromDue!=null&&!s.duePast) h+=`<div class="calc-row"><span>Servono</span><b>${eur(s.quotaFromDue)}/mese per ${s.monthsToDue} mesi${avg>0?` · ≈${Math.round(s.quotaFromDue/avg*100)}% delle entrate`:''}</b></div>`;
    if(s.quotaFromDue!=null&&s.duePast) h+=`<div class="calc-row warn"><span>La scadenza scelta è già passata.</span></div>`;
    if(s.monthsFromMonthly!=null) h+=`<div class="calc-row"><span>A ${eur(s.monthly)}/mese</span><b>${s.monthsFromMonthly} mesi · pronti a ${MESI_AB[s.etaM]} ${s.etaY}</b></div>`;
  }
  box.innerHTML=h;
}
async function saveGoal(){
  const v=id=>{ const e=el(id); return e?e.value:''; }; const err=el('gl-err');
  const name=v('gl-name').trim(); if(!name){ if(err) err.textContent='Dai un nome all\u2019obiettivo.'; return; }
  const account=v('gl-account'); if(!account){ if(err) err.textContent='Scegli il conto collegato.'; return; }
  const target=parseAmount(v('gl-target')); if(!(target>0)){ if(err) err.textContent='Inserisci l\u2019importo obiettivo.'; return; }
  const dm=v('gl-duemonth'), dy=v('gl-dueyear'); const monthly=parseAmount(v('gl-monthly'));
  if((dm==='')!==(dy==='')){ if(err) err.textContent='Per la scadenza servono sia mese sia anno.'; return; }
  const rec={ name, account, target:Math.round(target*100)/100,
    dueMonth: dm===''?null:parseInt(dm,10), dueYear: dy===''?null:parseInt(dy,10),
    monthly: (monthly>0)?Math.round(monthly*100)/100:null };
  try{
    if(goalEditId) await store.update('goals', goalEditId, rec);
    else { rec.order=DATA.goals.length; await store.add('goals', rec); }
    const ed=!!goalEditId; closeSheet(); toast(ed?'Obiettivo aggiornato':'Obiettivo aggiunto');
  }catch(e){ if(err) err.textContent='Errore nel salvataggio. Hai pubblicato la regola Firestore per "goals"?'; console.warn(e); }
}
async function deleteGoal(id){
  if(!confirm('Eliminare questo obiettivo? Il conto e i soldi non vengono toccati.')) return;
  try{ await store.remove('goals', id); closeSheet(); toast('Obiettivo eliminato'); }catch(e){ console.warn(e); }
}

const MEMBER_PALETTE = ['#3E6B63','#B07D3F','#9A5640','#6E7B4F','#5A6473','#7A5566'];
async function addMember(name){
  const nm=(name||'').trim(); if(!nm) return;
  if(DATA.members.some(m=>m.name.trim().toLowerCase()===nm.toLowerCase())){ toast('Esiste già un membro con questo nome'); return; }
  const color=MEMBER_PALETTE[DATA.members.length % MEMBER_PALETTE.length];
  const uid='m'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  try{ await store.add('members',{ uid, name:nm, color, email:'', manual:true }); toast('Membro aggiunto'); }
  catch(e){ console.warn(e); toast('Errore nel salvataggio'); }
}
async function deleteMember(id, uid){
  if(uid===me.uid){ toast('Non puoi rimuovere il tuo profilo'); return; }
  const m=DATA.members.find(x=>x.uid===uid); const nm=m?m.name:'questo membro';
  let msg=`Rimuovere ${nm}?\nI movimenti già registrati restano, ma senza nome accanto.`;
  if(m&&m.email) msg+=`\nNota: se ${nm} accede di nuovo con la sua email, il profilo ricompare.`;
  if(!confirm(msg)) return;
  try{
    if(store.mode==='local' && store.local && store.local.removeMember) store.local.removeMember(uid);
    else await store.remove('members', id||uid);
    toast('Membro rimosso');
  }catch(e){ console.warn(e); toast('Errore nella rimozione'); }
}
/* ===================== Riparazione duplicati (post-import) ===================== */
function txFingerprint(t){
  return [ t.type, t.date, Math.round((+t.amount||0)*100), t.account||'', t.fromAccount||'', t.toAccount||'', t.dir||'',
    t.macro||'', (t.sub||'').trim().toLowerCase(), (t.note||'').trim().toLowerCase(), (t.vehicle||'').trim().toLowerCase(),
    t.excludeFromTotals?'x':'' ].join('|');
}
async function repairDuplicates(){
  const norm=s=>(s||'').trim().toLowerCase();
  const members=[...DATA.members], accounts=[...DATA.accounts], forecast=[...DATA.forecast], txs=[...DATA.transactions];

  // 1) Membri con lo stesso nome → tengo il profilo "vero" (io / con email), ricollego chi-ha-speso
  const mGroups={}; members.forEach(m=>{ (mGroups[norm(m.name)]=mGroups[norm(m.name)]||[]).push(m); });
  const memberRemap={}; const mDel=[];
  Object.values(mGroups).forEach(g=>{
    if(g.length<2) return;
    g.sort((a,b)=>((b.uid===me.uid?4:0)+(b.email?2:0)) - ((a.uid===me.uid?4:0)+(a.email?2:0)));
    const keep=g[0]; g.slice(1).forEach(m=>{ memberRemap[m.uid]=keep.uid; mDel.push(m); });
  });
  const keptUids=new Set(members.filter(m=>!mDel.includes(m)).map(m=>m.uid));

  // 2) Conti con lo stesso nome → tengo il più referenziato, ricollego i movimenti
  const refCount={}; txs.forEach(t=>{ [t.account,t.fromAccount,t.toAccount].forEach(id=>{ if(id) refCount[id]=(refCount[id]||0)+1; }); });
  const aGroups={}; accounts.forEach(a=>{ (aGroups[norm(a.name)]=aGroups[norm(a.name)]||[]).push(a); });
  const accRemap={}; const aDel=[];
  Object.values(aGroups).forEach(g=>{
    if(g.length<2) return;
    g.sort((a,b)=>(refCount[b.id]||0)-(refCount[a.id]||0) || (a.order||0)-(b.order||0));
    const keep=g[0]; g.slice(1).forEach(a=>{ accRemap[a.id]=keep.id; aDel.push(a); });
  });

  // 3) Voci previsionale uguali (nome+gruppo+tipo+direzione) → tengo la prima, ricollego i planKey
  const fGroups={}; forecast.forEach(f=>{ const k=[norm(f.name),norm(f.group),f.kind||'ricorrente',f.flow||'uscita'].join('|'); (fGroups[k]=fGroups[k]||[]).push(f); });
  const planRemap={}; const fDel=[];
  Object.values(fGroups).forEach(g=>{
    if(g.length<2) return;
    g.sort((a,b)=>(a.order||0)-(b.order||0));
    const keep=g[0]; g.slice(1).forEach(f=>{ planRemap[f.id]=keep.id; fDel.push(f); });
  });

  // 4) Movimenti: applico i ricollegamenti "virtualmente", poi deduplica per impronta
  const patched = txs.map(t=>{
    const p={};
    if(t.account&&accRemap[t.account]) p.account=accRemap[t.account];
    if(t.fromAccount&&accRemap[t.fromAccount]) p.fromAccount=accRemap[t.fromAccount];
    if(t.toAccount&&accRemap[t.toAccount]) p.toAccount=accRemap[t.toAccount];
    if(t.paidBy&&memberRemap[t.paidBy]) p.paidBy=memberRemap[t.paidBy];
    if(t.enteredBy&&memberRemap[t.enteredBy]) p.enteredBy=memberRemap[t.enteredBy];
    if(t.planKey){ const i=t.planKey.indexOf(':'); if(i>0){ const fid=t.planKey.slice(0,i); if(planRemap[fid]) p.planKey=planRemap[fid]+t.planKey.slice(i); } }
    return { t, p, v:{ ...t, ...p } };
  });
  const byFp={}; patched.forEach(x=>{ const fp=txFingerprint(x.v); (byFp[fp]=byFp[fp]||[]).push(x); });
  const score=v=>(v.planKey?2:0)+(keptUids.has(v.paidBy)?1:0);
  const tDel=[], tUpd=[];
  Object.values(byFp).forEach(g=>{
    g.sort((a,b)=>score(b.v)-score(a.v));
    const keep=g[0]; if(Object.keys(keep.p).length) tUpd.push(keep);
    g.slice(1).forEach(x=>tDel.push(x.t));
  });

  // Ricollegamenti residui su conti/voci tenuti (carta→conto pagamento, voce→conto/fondo)
  const aUpd=accounts.filter(a=>!aDel.includes(a)&&a.linkedAccount&&accRemap[a.linkedAccount]).map(a=>({ id:a.id, p:{ linkedAccount:accRemap[a.linkedAccount] } }));
  const fUpd=forecast.filter(f=>!fDel.includes(f)).map(f=>{ const p={}; if(f.account&&accRemap[f.account])p.account=accRemap[f.account]; if(f.fundAccount&&accRemap[f.fundAccount])p.fundAccount=accRemap[f.fundAccount]; return Object.keys(p).length?{ id:f.id, p }:null; }).filter(Boolean);

  const tot=mDel.length+aDel.length+fDel.length+tDel.length;
  if(!tot){ toast('Nessun duplicato trovato'); return; }
  if(!confirm(`Trovati duplicati:\n· ${tDel.length} movimenti\n· ${aDel.length} conti\n· ${fDel.length} voci del previsionale\n· ${mDel.length} membri\n\nNe viene conservata una copia sola e i riferimenti vengono ricollegati.\nConsiglio: fai prima "Esporta tutto (JSON)" come copia di sicurezza.\n\nProcedere?`)) return;
  toast('Riparazione in corso…');
  try{
    for(const x of tUpd) await store.update('transactions', x.t.id, x.p);
    for(const u of fUpd) await store.update('forecast', u.id, u.p);
    for(const u of aUpd) await store.update('accounts', u.id, u.p);
    for(const t of tDel) await store.remove('transactions', t.id);
    for(const f of fDel) await store.remove('forecast', f.id);
    for(const a of aDel) await store.remove('accounts', a.id);
    for(const m of mDel){ if(store.mode==='local'&&store.local&&store.local.removeMember) store.local.removeMember(m.uid); else await store.remove('members', m.id||m.uid); }
    toast(`Fatto: rimossi ${tDel.length} movimenti, ${aDel.length} conti, ${fDel.length} voci, ${mDel.length} membri doppi`);
  }catch(e){ console.warn('repair',e); toast('Errore durante la riparazione. Riprova.'); }
}

function openFixedDetail(ym){
  fixedDetailYm=ym;
  if(fxDate===null) fxDate=defaultMaterializeDate(ym);
  const y=+ym.slice(0,4), mi=+ym.slice(5,7)-1;
  const items=fcItemsForYear(y).filter(it=>fcMonthly(it,y,mi)>0);
  const rows=items.map(it=>{
    const amt=Math.round(fcMonthly(it,y,mi)*100)/100; const key=`${it.id}:${ym}`;
    const done=DATA.transactions.some(t=>t.planKey===key);
    const busy=fxInFlight.has(key);
    const day=itemPayDay(it);
    const rowDate = itemMaterializeDate(it, ym, fxDate);
    const kindTag = it.flow==='entrata'?'entrata':((it.kind==='accantonamento')?'accant.':(it.kind==='rata'?'rata':''));
    const right = done
      ? `<span class="fx-done">${svg('check','ic-xs')} inserita</span><button class="btn ghost xs" data-act="fx-undo" data-id="${it.id}" data-ym="${ym}">annulla</button>`
      : `<button class="btn primary xs" data-act="fx-add" data-id="${it.id}" data-ym="${ym}" ${busy?'disabled':''}>${busy?'…':'Inserisci'}</button>`;
    const dot = it.flow==='entrata'?'#3E6B63':macro(it.macro).color;
    return `<div class="fx-row"><span class="row-dot" style="--c:${dot}"></span>
      <span class="row-main"><span class="row-cat">${escapeHtml(it.name)}${kindTag?` <span class="fc-ktag">${kindTag}</span>`:''}</span><span class="row-meta">${eur(amt)} · ${dayShort(rowDate)}${day>0?'':' <span class="muted">(data odierna)</span>'}</span></span>
      <span class="row-side">${right}</span></div>`;
  }).join('');
  const cs=carryStatus(ym);
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">Voci fisse · ${monthName(ym)}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <p class="hint" style="margin-top:0">"Inserisci nel rendiconto" crea il movimento vero nel registro del mese, una volta sola. Qui vedi quali sono già inserite e quali no; puoi inserirle una a una o tutte insieme, e annullare.</p>
      <label class="field"><span>Data per le voci senza giorno abituale</span><input id="fx-date" type="date" data-act="fxdate-set" value="${fxDate}"></label>
      <div class="fx-list">${rows||emptyState('Nessuna voce fissa per questo mese.')}</div>
      ${cs.todo>0?`<button class="btn primary block" data-act="fixed-carry" data-year="${cs.year}" data-mi="${cs.mi}" style="margin-top:12px">${svg('download')} Inserisci tutte le mancanti (${cs.todo})</button>`:(items.length?`<div class="done-tag" style="justify-content:center;margin-top:12px">${svg('check','ic-xs')} Tutte inserite</div>`:'')}
    </div>`);
}
/* ===================== Registro credito (es. Aracoeli 20) ===================== */
function creditEntries(accId){ return DATA.transactions.filter(t=>t.credit && t.account===accId).sort((a,b)=>(b.date||'').localeCompare(a.date||'')); }
function openCreditPage(accId){
  creditPageId=accId; const a=accountById(accId); if(!a) return;
  const entries=creditEntries(accId);
  const open=entries.filter(e=>!e.reimbursed), done=entries.filter(e=>e.reimbursed);
  const outstanding=Math.round(sum(open.map(e=>+e.amount||0))*100)/100;
  const doneTot=Math.round(sum(done.map(e=>+e.amount||0))*100)/100;
  const row=(e)=>`<div class="cr-row${e.reimbursed?' done':''}">
      <button class="cr-check" data-act="credit-toggle" data-id="${e.id}" aria-label="Segna rimborsato">${e.reimbursed?svg('check','ic-xs'):''}</button>
      <div class="cr-main"><div class="cr-note">${escapeHtml(e.note||'Credito')}</div><div class="cr-date muted sm">${dayShort2(e.date)}${e.reimbursed?' · rimborsato':''}</div></div>
      <div class="cr-amt">${eur(+e.amount||0)}</div>
      <button class="iconbtn cr-del" data-act="credit-del" data-id="${e.id}" aria-label="Elimina">${svg('trash')}</button>
    </div>`;
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">${escapeHtml(a.name)}</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <div class="cr-total"><div class="cr-total-k">Credito da recuperare</div><div class="cr-total-v">${eur(outstanding)}</div>${doneTot>0?`<div class="muted sm">${eur(doneTot)} già rimborsati</div>`:''}</div>
      <button class="btn primary block" data-act="credit-add" data-id="${accId}">${svg('plus')} Aggiungi credito</button>
      <p class="hint">Segna la spunta quando il B&B ti rimborsa: la voce esce dal totale. Non serve registrare l'incasso sui tuoi conti — è un dare/avere che si azzera.</p>
      ${open.length?`<div class="cr-list">${open.map(row).join('')}</div>`:emptyState('Nessun credito in sospeso.')}
      ${done.length?`<div class="card-h" style="margin:14px 0 4px"><h4 class="card-title" style="font-size:1rem">Rimborsati</h4></div><div class="cr-list">${done.map(row).join('')}</div>`:''}
    </div>`);
}
function openCreditAdd(accId){
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">Nuovo credito</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <label class="field"><span>Importo (€)</span><input id="cr-amount" inputmode="decimal" placeholder="0,00"></label>
      <label class="field"><span>Descrizione</span><input id="cr-note" placeholder="Es. spesa lenzuola, anticipo utenze"></label>
      <label class="field"><span>Data</span><input id="cr-date" type="date" value="${todayISO()}"></label>
      <div class="sheet-error" id="cr-err"></div>
      <div class="sheet-actions"><button class="btn primary grow" data-act="credit-save" data-id="${accId}">${svg('check')} Salva</button></div>
    </div>`);
}
async function saveCreditEntry(accId){
  const v=id=>{ const e=el(id); return e?e.value:''; }; const err=el('cr-err');
  const amt=parseAmount(v('cr-amount')); if(!(amt>0)){ if(err) err.textContent='Inserisci un importo.'; return; }
  const rec={ type:'entrata', account:accId, amount:Math.round(amt*100)/100, date:v('cr-date')||todayISO(), note:(v('cr-note')||'Credito').trim(), credit:true, reimbursed:false, enteredBy:me.uid };
  try{ await store.add('transactions', rec); creditPageId=accId; openCreditPage(accId); }
  catch(e){ console.warn(e); if(err) err.textContent='Errore nel salvataggio.'; }
}
async function toggleCreditReimbursed(txId){
  const t=DATA.transactions.find(x=>x.id===txId); if(!t) return;
  try{ await store.update('transactions', txId, { reimbursed: !t.reimbursed }); if(creditPageId) openCreditPage(creditPageId); }
  catch(e){ console.warn(e); }
}
async function deleteCreditEntry(txId){
  if(!confirm('Eliminare questa voce di credito?')) return;
  try{ await store.remove('transactions', txId); if(creditPageId) openCreditPage(creditPageId); }
  catch(e){ console.warn(e); }
}
function openImport(){
  let inp=el('import-file');
  if(!inp){
    inp=document.createElement('input'); inp.type='file'; inp.accept='application/json,.json'; inp.id='import-file'; inp.style.display='none';
    document.body.appendChild(inp); inp.addEventListener('change', handleImportFile);
  }
  inp.value=''; inp.click();
}
async function handleImportFile(e){
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  let data;
  try{ data=JSON.parse(await file.text()); }
  catch(err){ toast('File non leggibile o non in formato JSON'); return; }
  if(!data || typeof data!=='object'){ toast('File non valido'); return; }
  if(data.app!=='conti-famiglia'){ if(!confirm('Il file non sembra un backup di Conti di Famiglia. Importarlo comunque?')) return; }
  const cols=['members','accounts','transactions','assets','snapshots','forecast','goals'];
  const total=cols.reduce((s,c)=>s+(Array.isArray(data[c])?data[c].length:0),0);
  if(!total && !data.categories){ toast('Nel file non ci sono dati da importare'); return; }
  if(!confirm(`Importare ${total} elementi nel database attuale?\nVengono aggiunti a quelli presenti; gli stessi identificativi vengono aggiornati, non duplicati.`)) return;
  toast('Importazione in corso…');
  try{
    const counts=await importData(data);
    if(modalOpen) closeSheet();
    const summary=Object.entries(counts).map(([k,v])=>`${v} ${k}`).join(', ');
    toast(summary?`Importati: ${summary}`:'Categorie importate');
  }catch(err){ console.warn('import',err); toast('Errore durante l\u2019importazione. Riprova.'); }
}
async function importData(data){
  const cols=['members','accounts','transactions','assets','snapshots','forecast','goals'];
  const counts={};
  for(const c of cols){
    if(!Array.isArray(data[c])) continue;
    for(const rec of data[c]){
      if(!rec || typeof rec!=='object') continue;
      const { id, ...rest }=rec;
      if(id!=null && store.set) await store.set(c, id, rest); else await store.add(c, rest);
      counts[c]=(counts[c]||0)+1;
    }
  }
  if(data.categories && store.saveCategories) await store.saveCategories(data.categories);
  if(data.budget && store.saveConfig){ const b={ needs:+data.budget.needs||50, wants:+data.budget.wants||30, save:+data.budget.save||20, startDate:data.budget.startDate||'', cycleDay:+data.budget.cycleDay||1, level:+data.budget.level||0 }; BUDGET=b; await store.saveConfig('budget', b); }
  return counts;
}
function buildBackup(){
  return { app:'conti-famiglia', version:3, exportedAt:new Date().toISOString(),
    members:DATA.members, accounts:DATA.accounts, transactions:DATA.transactions,
    assets:DATA.assets, snapshots:DATA.snapshots, forecast:DATA.forecast, goals:DATA.goals,
    budget:BUDGET, categories:DATA.categories };
}

/* ===================== Backup automatico locale ===================== */
const BK_PREFIX='conti:bk:'; const BK_KEEP=6;
function localBackups(){
  const out=[]; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf(BK_PREFIX)===0) out.push(k); } }catch(e){}
  return out.sort().reverse();
}
function autoBackup(){
  try{
    if(!(DATA.accounts.length||DATA.transactions.length)) return;
    const keys=localBackups(); const lastKey=keys[0];
    if(lastKey){ const t=Date.parse(lastKey.slice(BK_PREFIX.length)); if(isFinite(t) && (Date.now()-t)<20*3600*1000) return; }
    localStorage.setItem(BK_PREFIX+new Date().toISOString(), JSON.stringify(buildBackup()));
    for(const k of localBackups().slice(BK_KEEP)){ try{ localStorage.removeItem(k); }catch(e){} }
  }catch(e){ console.warn('autobackup',e); }
}
function lastBackupInfo(){ const k=localBackups()[0]; if(!k) return null; const iso=k.slice(BK_PREFIX.length); return { iso, count:localBackups().length, days:Math.floor((Date.now()-Date.parse(iso))/86400000) }; }
function lastExportInfo(){ try{ const iso=localStorage.getItem('conti:lastexport'); if(!iso) return null; return { iso, days:Math.floor((Date.now()-Date.parse(iso))/86400000) }; }catch(e){ return null; } }
async function restoreLocalBackup(key){
  let data; try{ data=JSON.parse(localStorage.getItem(key)||'null'); }catch(e){ toast('Copia illeggibile'); return; }
  if(!data){ toast('Copia non trovata'); return; }
  const cols=['members','accounts','transactions','assets','snapshots','forecast','goals'];
  const total=cols.reduce((s,c)=>s+(Array.isArray(data[c])?data[c].length:0),0);
  const iso=key.slice(BK_PREFIX.length);
  if(!confirm(`Ripristinare la copia del ${dayShort2(iso.slice(0,10))} (${total} elementi)?\nViene riscritta sui dati attuali per identificativo (aggiunge/aggiorna, non cancella il resto).`)) return;
  toast('Ripristino in corso…');
  try{ await importData(data); if(modalOpen) closeSheet(); toast('Copia ripristinata'); }
  catch(e){ console.warn('restore',e); toast('Errore nel ripristino'); }
}
function openBackups(){
  const keys=localBackups();
  const rows = keys.length ? keys.map(k=>{ const iso=k.slice(BK_PREFIX.length); let kb=0; try{ kb=Math.round((localStorage.getItem(k)||'').length/1024); }catch(e){}
    return `<button class="row" data-act="bk-restore" data-key="${escapeHtml(k)}"><span class="row-main"><span class="row-cat">${dayShort2(iso.slice(0,10))} · ${iso.slice(11,16)}</span><span class="row-meta">copia automatica · ${kb} KB</span></span><span class="row-side">${svg('upload')}</span></button>`;
  }).join('') : emptyState('Ancora nessuna copia automatica: si crea da sola all\u2019avvio, una volta al giorno.');
  openSheet(`
    <div class="sheet-h"><h3 class="sheet-title">Copie di sicurezza</h3><button class="iconbtn" data-act="sheet-close" aria-label="Chiudi">${svg('x')}</button></div>
    <div class="sheet-body">
      <p class="hint" style="margin-top:0">Copie automatiche salvate su <b>questo dispositivo</b> (le ultime ${BK_KEEP}). Toccane una per ripristinarla. Per una copia al sicuro <b>fuori dal telefono</b>, usa "Scarica copia" e mandala su mail/Drive.</p>
      <div class="list">${rows}</div>
      <button class="btn ghost block" data-act="export" style="margin-top:12px">${svg('download')} Scarica copia (file)</button>
    </div>`);
}
function exportJSON(){
  const data=buildBackup();
  const blob=new Blob([JSON.stringify(data,null,2)],{ type:'application/json' });
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`conti-famiglia-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  try{ localStorage.setItem('conti:lastexport', new Date().toISOString()); }catch(e){}
}
async function catAdd(group){
  const inp=el('catin-'+group); if(!inp) return; const name=inp.value.trim(); if(!name) return;
  const c=JSON.parse(JSON.stringify(DATA.categories));
  const arr = group==='entrate' ? c.entrate : c.spese[group];
  if(arr.some(x=>x.toLowerCase()===name.toLowerCase())){ inp.value=''; return; }
  arr.push(name); DATA.categories=c; await store.saveCategories(c); softRender();
}
async function catDel(group,name){
  const c=JSON.parse(JSON.stringify(DATA.categories));
  if(group==='entrate') c.entrate=c.entrate.filter(x=>x!==name); else c.spese[group]=c.spese[group].filter(x=>x!==name);
  DATA.categories=c; await store.saveCategories(c); softRender();
}
function doInstall(){ if(!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt.userChoice.finally(()=>{ deferredPrompt=null; if(me) render(); }); }

/* ===================== Auth handlers ===================== */
async function doLogin(){
  const email=el('au-email')?.value||'', pass=el('au-pass')?.value||'', err=el('au-err');
  if(!email||!pass){ if(err) err.textContent='Inserisci email e password.'; return; }
  try{ await store.login({ email, password:pass }); }catch(e){ if(err) err.textContent=authError(e); }
}
async function doRegister(){
  const name=el('au-name')?.value||'', email=el('au-email')?.value||'', pass=el('au-pass')?.value||'', err=el('au-err');
  if(!email||!pass){ if(err) err.textContent='Inserisci email e password.'; return; }
  if(pass.length<6){ if(err) err.textContent='La password deve avere almeno 6 caratteri.'; return; }
  try{ await store.register({ name, email, password:pass }); }catch(e){ if(err) err.textContent=authError(e); }
}
function authError(e){
  const c=(e&&e.code)||'';
  if(c.includes('invalid-email')) return 'Email non valida.';
  if(c.includes('email-already-in-use')) return 'Questa email è già registrata. Prova ad accedere.';
  if(c.includes('weak-password')) return 'La password deve avere almeno 6 caratteri.';
  if(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')) return 'Email o password non corretti.';
  if(c.includes('too-many-requests')) return 'Troppi tentativi. Riprova tra poco.';
  if(c.includes('network')) return 'Connessione assente. Controlla la rete.';
  if(c.includes('operation-not-allowed')) return 'Abilita Email/Password in Firebase (Authentication → Sign-in method).';
  if(c.includes('configuration-not-found')||c.includes('api-key')) return 'Configurazione Firebase non valida. Controlla firebase-config.js.';
  return (e&&e.message)||'Errore. Riprova.';
}

/* ===================== Toast ===================== */
let toastT=null;
function toast(msg){
  let t=el('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2400);
}

/* ===================== Eventi (delegati) ===================== */
function onClick(e){
  const t=e.target.closest('[data-act]'); if(!t) return;
  const act=t.dataset.act, ds=t.dataset;
  switch(act){
    case 'goto': view=ds.view; if(modalOpen) closeSheet(); window.scrollTo(0,0); render(); break;
    case 'month': fMonth=shiftMonth(fMonth, parseInt(ds.dir,10)); render(); break;
    case 'year': fYear += parseInt(ds.dir,10); render(); break;
    case 'mov-new': openMovSheet(null); break;
    case 'mov-edit': { const tx=DATA.transactions.find(x=>x.id===ds.id); if(tx){ if(tx.type==='giroconto'||tx.type==='rettifica'){ if(confirm('Eliminare questo movimento?')) store.remove('transactions',tx.id).then(()=>toast('Eliminato')); } else openMovSheet(tx); } break; }
    case 'mov-save': saveMov(); break;
    case 'mov-delete': deleteMov(ds.id); break;
    case 'seg-type': { const d=readMov(); d.type=ds.type; renderMovSheet(d); break; }
    case 'acc-open': { const a=accountById(ds.id); if(a && a.kind==='credito') openCreditPage(ds.id); else openAccountSheet(ds.id); break; }
    case 'credit-add': openCreditAdd(ds.id); break;
    case 'credit-save': saveCreditEntry(ds.id); break;
    case 'credit-toggle': toggleCreditReimbursed(ds.id); break;
    case 'credit-del': deleteCreditEntry(ds.id); break;
    case 'acc-credit': openAccountOp(ds.id,'credit'); break;
    case 'acc-debit': openAccountOp(ds.id,'debit'); break;
    case 'acc-transfer': openTransfer(ds.id); break;
    case 'acc-recon': openRecon(ds.id); break;
    case 'acc-interest': openInterest(ds.id); break;
    case 'int-save': saveInterest(ds.id); break;
    case 'card-settle': settleCard(ds.id); break;
    case 'acc-edit': { const a=DATA.accounts.find(x=>x.id===ds.id); openAccountEdit(a); break; }
    case 'acc-new': openAccountEdit(null); break;
    case 'acc-save': saveAccount(); break;
    case 'acc-delete': deleteAccount(ds.id); break;
    case 'op-save': saveAccountOp(); break;
    case 'gc-save': saveTransfer(); break;
    case 'cn-save': saveRecon(ds.id); break;
    case 'asset-new': openAssetSheet(null,false); break;
    case 'asset-new-p': openAssetSheet(null,true); break;
    case 'asset-edit': { const a=DATA.assets.find(x=>x.id===ds.id); if(a) openAssetSheet(a); break; }
    case 'asset-save': saveAsset(); break;
    case 'asset-delete': deleteAsset(ds.id); break;
    case 'snapshot': saveSnapshot(); break;
    case 'fc-new': openFcItem(null); break;
    case 'fc-edit': { const i=DATA.forecast.find(x=>x.id===ds.id); if(i) openFcItem(i); break; }
    case 'fc-open-pass': { const i=DATA.forecast.find(x=>x.id===ds.id); if(i) openFcItem(i); break; }
    case 'fc-renew': renewFc(ds.id); break;
    case 'fc-apply': applyFcPattern(); break;
    case 'fc-save': saveFcItem(); break;
    case 'fc-delete': deleteFcItem(ds.id); break;
    case 'fc-carry-pick': { const mi=parseInt(el('carry-month')?el('carry-month').value:'0',10)||0; const yy=parseInt(ds.year,10); materializeMonth(yy, mi, defaultMaterializeDate(ymOf(yy,mi))); break; }
    case 'fixed-carry': materializeMonth(parseInt(ds.year,10), parseInt(ds.mi,10), (el('fx-date')&&el('fx-date').value)||fxDate||undefined); break;
    case 'fixed-detail': openFixedDetail(ds.ym); break;
    case 'fx-add': {
      const key=ds.id+':'+ds.ym; if(fxInFlight.has(key)) break;
      const it=DATA.forecast.find(x=>x.id===ds.id); if(!it) break;
      const dISO=(el('fx-date')&&el('fx-date').value)||fxDate||undefined;
      fxInFlight.add(key); if(fixedDetailYm) openFixedDetail(fixedDetailYm);
      const y=+ds.ym.slice(0,4), mi=+ds.ym.slice(5,7)-1;
      materializeItem(it,y,mi,dISO).then(r=>{ fxInFlight.delete(key); if(r==='problem') toast('Manca il conto per l\u2019accantonamento'); if(fixedDetailYm) openFixedDetail(fixedDetailYm); }).catch(()=>{ fxInFlight.delete(key); });
      break;
    }
    case 'fx-undo': {
      const it=DATA.forecast.find(x=>x.id===ds.id);
      unmaterializeItem(ds.id, ds.ym).then(()=>{ if(fixedDetailYm) openFixedDetail(fixedDetailYm); });
      break;
    }
    case 'backups': openBackups(); break;
    case 'bk-restore': restoreLocalBackup(ds.key); break;
    case 'sheet-close': closeSheet(); break;
    case 'logout': if(modalOpen) closeSheet(); store.logout(); break;
    case 'export': exportJSON(); break;
    case 'import': openImport(); break;
    case 'dedup': repairDuplicates(); break;
    case 'member-add': { const inp=el('newmember'); if(inp&&inp.value.trim()){ addMember(inp.value.trim()); inp.value=''; } break; }
    case 'member-del': deleteMember(ds.id, ds.uid); break;
    case 'goal-new': openGoal(null); break;
    case 'goal-edit': { const g=DATA.goals.find(x=>x.id===ds.id); if(g) openGoal(g); break; }
    case 'goal-save': saveGoal(); break;
    case 'goal-delete': deleteGoal(ds.id); break;
    case 'budget-src': budgetSource = (ds.src==='reale'?'reale':'preventivo'); render(); break;
    case 'install': doInstall(); break;
    case 'cat-add': catAdd(ds.group); break;
    case 'cat-del': catDel(ds.group, ds.name); break;
    case 'local-create': { const inp=el('newprofile'); if(inp&&inp.value.trim()) store.local.create(inp.value.trim()); break; }
    case 'local-create-gate': { const inp=el('lg-name'); const err=el('au-err'); if(!inp||!inp.value.trim()){ if(err) err.textContent='Inserisci un nome.'; return; } store.local.create(inp.value.trim()); break; }
    case 'local-select': store.local.select(ds.id); break;
    case 'gate-tab': gateTab=ds.tab; renderAuthGate(); break;
    case 'do-login': doLogin(); break;
    case 'do-register': doRegister(); break;
  }
}
function onChange(e){
  const t=e.target.closest('[data-act]'); if(!t) return;
  const act=t.dataset.act;
  if(act==='filter-type'){ fType=t.value; render(); }
  else if(act==='filter-person'){ fPerson=t.value; render(); }
  else if(act==='filter-account'){ fAccount=t.value; render(); }
  else if(act==='mov-macro'){ const sub=el('mov-sub'); if(sub) sub.innerHTML=subOptions(t.value,''); toggleVehicle(); }
  else if(act==='mov-sub'){ toggleVehicle(); }
  else if(act==='fc-kind'){ const d=readFcDraft(); renderFcSheet(d); }
  else if(act==='fc-recalc'){ updateFcCalc(); }
  else if(act==='ae-kind'){ const d=readAccountDraft(); renderAccountSheet(d); }
  else if(act==='int-calc'){ updateInterestCalc(); }
  else if(act==='goal-recalc'){ updateGoalCalc(); }
  else if(act==='fxdate-set'){ fxDate=e.target.value||fxDate; }
  else if(act==='budget-set'){
    const n=Math.max(0,Math.min(100,+((el('bg-needs')||{}).value)||0));
    const w=Math.max(0,Math.min(100,+((el('bg-wants')||{}).value)||0));
    const s=Math.max(0,Math.min(100,+((el('bg-save')||{}).value)||0));
    BUDGET={ ...BUDGET, needs:n, wants:w, save:s };
    if(store.saveConfig) store.saveConfig('budget', BUDGET);
    render();
  }
  else if(act==='startdate-set'){
    BUDGET={ ...BUDGET, startDate:e.target.value||'' };
    if(store.saveConfig) store.saveConfig('budget', BUDGET);
    render();
  }
  else if(act==='cycle-set'){
    let d=parseInt(e.target.value,10); if(!isFinite(d)) d=1; d=Math.max(1,Math.min(28,d));
    BUDGET={ ...BUDGET, cycleDay:d };
    fMonth=periodOf(todayISO()); // re-sync current period with the new cycle
    if(store.saveConfig) store.saveConfig('budget', BUDGET);
    render();
  }
  else if(act==='level-set'){
    BUDGET={ ...BUDGET, level:parseAmount(e.target.value)||0 };
    if(store.saveConfig) store.saveConfig('budget', BUDGET);
    render();
  }
}
