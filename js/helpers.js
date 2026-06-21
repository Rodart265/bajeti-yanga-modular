// ===============================================
// helpers.js
// ===============================================
// Small functions used all over the app: formatting money, working
// out which budget period we're in, finding DOM elements, showing a
// toast, etc. None of these decide what to draw on screen — they just
// answer questions ("how much was spent this month?") or do tiny
// repetitive jobs (find an element by id). That's what makes them
// safe to group together here.

import { State } from './state.js';
import { TX, ITEM_ICONS, ITEM_CATS } from './constants.js';

// ---- money + date formatting ----
export const fmt = new Intl.NumberFormat('en-MW',{style:'currency',currency:'MWK',minimumFractionDigits:0,maximumFractionDigits:0});
export const MK  = n => fmt.format(Math.round(n||0)).replace('MWK','MK');
export const MKs = n => { n=Math.round(n||0); if(n>=1e6)return 'MK '+(n/1e6).toFixed(1)+'M'; if(n>=1000)return 'MK '+(n/1e3).toFixed(0)+'K'; return MK(n); };

// tx() always looks up the CURRENT language from State, so callers never
// have to worry about it going stale when the user switches English/Chichewa.
export function tx(){ return TX[State.lang]; }

export const today   = () => new Date().toISOString().split('T')[0];
export const nowTime = () => { const d=new Date(); return d.toTimeString().slice(0,5); };

// Format ISO date string to DD/MM/YYYY for display (Malawian locale convention)
export function fmtDate(s){ if(!s)return ''; const p=String(s).split('T')[0].split('-'); return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s; }

// Returns true if the stored item name is a reserved category label (data quality flag)
export function isBadItemName(n){ return ['other','ena','food','transport','household','personal','unknown','other income','zina'].includes(String(n||'').toLowerCase().trim()); }

export const ico = name => ITEM_ICONS[name] || '<i data-lucide="shopping-cart" style="margin-right:5px;vertical-align:middle;color:var(--p1)"></i>';

export const catOf = (name, explicitCat) => {
  // 1. Highest priority: the transaction's own stored category (set by the user
  //    when creating a custom item, or by Magic Log/receipt scan extraction).
  if(explicitCat && ['Food','Household','Personal','Transport','Other'].includes(explicitCat) && explicitCat!=='Other'){
    return explicitCat;
  }
  // 2. State.lCfg.items definition (budget item's own assigned category)
  const item = State.lCfg && State.lCfg.items ? State.lCfg.items.find(it=>it.name===name) : null;
  if(item&&item.cat&&['Food','Household','Personal','Transport','Other'].includes(item.cat)) return item.cat;
  // 3. Built-in category map
  for(const[c,a] of Object.entries(ITEM_CATS)){ if(a.includes(name)) return c; }
  // 4. Keyword-based fallback for custom/AI-extracted items
  const n=(name||'').toLowerCase();
  if(['plug','socket','cable','wire','switch','extension','bulb','battery','torch','charger','adaptor','adapter','power bank','powerbank'].some(k=>n.includes(k))) return 'Household';
  if(['airtime','bundles','bundle','recharge','data','wifi','internet','dstv','gotv','prepaid','electricity token','token'].some(k=>n.includes(k))) return 'Household';
  if(['rent','water bill','electricity bill','refuse','garbage','rates'].some(k=>n.includes(k))) return 'Household';
  if(['fertilizer','fertiliser','npk','urea','dap','can','seeds','maize seed','hybrid seed','pesticide','herbicide','insecticide','chemicals'].some(k=>n.includes(k))) return 'Food';
  if(['vegetables','veggies','tomatoes','onions','rape','mustard','cabbage','pumpkin','sweet potato','cassava','groundnuts','soya'].some(k=>n.includes(k))) return 'Food';
  if(['tablets','syrup','medicine','panadol','amoxicillin','antibiotic','malaria','ors','deworming','clinic fee','hospital fee','consultation'].some(k=>n.includes(k))) return 'Personal';
  if(['chitenje','chitengi','wrapper','blouse','dress','shirt','trousers','skirt','uniform','shoes','sandals','slippers','clothes','clothing'].some(k=>n.includes(k))) return 'Personal';
  if(['haircut','salon','barbing','braiding','weave','makeup','lotion','cream','vaseline','perfume','deodorant'].some(k=>n.includes(k))) return 'Personal';
  if(['minibus','motor bike','boda','bicycle','tyre','tube','fuel','petrol','diesel','oil change','vehicle','car wash','parking'].some(k=>n.includes(k))) return 'Transport';
  return explicitCat || 'Other';
};

// ---- budget period (the "salary day aware month") ----
export function curM(){ const d=new Date(); return {m:d.getMonth(),y:d.getFullYear()}; }
export function vmObj(){ return State.viewMonth||curM(); }

export function getBudgetPeriod(){
  let sd = State.lCfg && State.lCfg.salaryDay ? parseInt(State.lCfg.salaryDay,10) : 0;
  sd = Math.min(Math.max(sd, 0), 28);
  const v = vmObj();
  if(!sd || sd<1){
    return { startY:v.y, startM:v.m, startD:1,
             endY:v.y, endM:v.m, endD:new Date(v.y, v.m+1, 0).getDate() };
  }
  let startM=v.m-1, startY=v.y;
  if(startM<0){ startM=11; startY=v.y-1; }
  const endD = sd===1 ? new Date(v.y, v.m, 0).getDate() : sd-1;
  const endM = sd===1 ? (v.m-1<0?11:v.m-1) : v.m;
  const endY = sd===1 && v.m===0 ? v.y-1 : v.y;
  return { startY, startM, startD:sd, endY, endM, endD };
}

export function budgetPeriodLabel(){
  const p=getBudgetPeriod(), mn=tx().months;
  if(!State.lCfg||!State.lCfg.salaryDay) return mn[p.startM]+' '+p.startY;
  return p.startD+' '+mn[p.startM]+' \u2013 '+p.endD+' '+mn[p.endM]+' '+p.endY;
}

export function isTM(s){
  if(!s)return false;
  try{
    const clean=String(s).split('T')[0].trim();
    const parts=clean.split('-');
    if(parts.length<3) return false;
    const dy=parseInt(parts[0],10), dm=parseInt(parts[1],10)-1, dd=parseInt(parts[2],10);
    if(isNaN(dy)||isNaN(dm)||isNaN(dd)) return false;
    const date =new Date(dy, dm, dd);
    const p    =getBudgetPeriod();
    const start=new Date(p.startY, p.startM, p.startD);
    const end  =new Date(p.endY,   p.endM,   p.endD);
    return date>=start && date<=end;
  }catch(e){ return false; }
}

export function isCurM(){ const v=vmObj(),c=curM(); return v.m===c.m&&v.y===c.y; }
export function mName(){ const v=vmObj(); return tx().months[v.m]+' '+v.y; }

// ---- per-item / monthly totals, cached so re-rendering doesn't recompute every time ----
// These four lines are deliberately NOT in State. Only this file ever reads or
// writes them, so there's no reason for every other file to see them too —
// a private variable that lives in one file is simpler than a shared one.
let _memoKey = '', _memoSp = 0, _memoIn = 0, _memoByItem = {};

// Call this whenever lPx or viewMonth changes, so the next totals lookup recalculates.
export function _invalidateMemo(){ _memoKey = ''; }

function _ensureMemo(){
  const key = (State.hhId||'')+'|'+(State.viewMonth?State.viewMonth.m+'-'+State.viewMonth.y:'')+State.lPx.length;
  if(key === _memoKey) return;
  _memoKey = key;
  _memoSp = 0; _memoIn = 0; _memoByItem = {};
  State.lPx.forEach(p=>{
    if(p.deleted) return;
    if(!isTM(p.date)) return;
    const a = Number(p.amount)||0;
    if(p.type==='income'){ _memoIn+=a; }
    else { _memoSp+=a; _memoByItem[p.item]=(_memoByItem[p.item]||0)+a; }
  });
}

export function iSpent(name){ _ensureMemo(); return _memoByItem[name]||0; }
export function totSp(){ _ensureMemo(); return _memoSp; }
export function totIn(){ _ensureMemo(); return _memoIn; }

export function actU(){ return State.lCfg.users.find(u=>u.id===localStorage.getItem('nb_uid'))||State.lCfg.users[0]; }
export function uById(id){ return State.lCfg.users.find(u=>u.id===id)||State.lCfg.users[0]; }
export function statOf(sp,bg){ if(!sp)return'none'; const r=sp/bg; return r>=1?'over':r>=.8?'near':'ok'; }

export function randCode(){
  const chars='abcdefghjkmnpqrstuvwxyz23456789';
  const bytes=crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes).map(b=>chars[b%chars.length]).join('');
}

// ---- tiny DOM helpers ----
export const g   = id => document.getElementById(id);
export const val = id => (g(id)||{}).value||'';
export function esc(s){ const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; }
export function show(id){ const el=g(id); if(el)el.classList.remove('hide'); }
export function hide(id){ const el=g(id); if(el)el.classList.add('hide'); }
export function toast(msg,type){ const el=g('toast'); if(!el)return; el.className='toast '+(type||'s'); el.textContent=msg; el.classList.add('on'); setTimeout(()=>el.classList.remove('on'),2400); }
export function setDot(s){ const d=g('sync-dot'); if(!d)return; d.className='sync-dot'+(s==='off'?' off':s==='spin'?' spin':''); }
export function tgPW(id,btn){ const el=g(id); if(!el)return; const sh=el.type==='text'; el.type=sh?'password':'text'; btn.innerHTML=sh?'<i data-lucide="eye"></i>':'<i data-lucide="eye-off"></i>'; if(window.lucide)lucide.createIcons({nodes:[btn]}); }

// ---- making functions visible to onclick="" in your HTML ----
// Your index.html has a real button written as:
//   <button onclick="tgPW('a-pw',this)">
// The browser reads that as "go find a global variable called tgPW and
// call it" — but a function exported from a module is NOT global, it
// only exists inside this file (and wherever it's imported). So for
// any function that gets called this way from plain HTML, you have to
// explicitly hang a copy of it on `window`. tgPW is the only one in
// this batch of files that's called like that — everything else here
// is only ever called from other JS files, which can just `import` it
// normally.
window.tgPW = tgPW;

