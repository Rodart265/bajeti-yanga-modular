// ===============================================
// views/home.js
// ===============================================
// Draws the Home tab: the purple "hero" balance card, the 6-month
// trend chart, the four stat chips, and the Recent Transactions list.
//
// prevM()/nextM() (the month arrows) live here for now since Home is
// the only migrated view that uses them. Once History/Summary get
// migrated they'll probably move to helpers.js so everyone can share
// them — for now they just redraw Home directly, which keeps this
// file testable on its own.
//
// getTrialBanner() is a stub returning '' until premium.js exists.
// Swap it for the real thing once that file is built.

import { State } from '../state.js';
import {
  tx, MK, MKs, isTM, iSpent, isCurM, mName, vmObj, budgetPeriodLabel,
  totSp, totIn, uById, ico, catOf, isBadItemName, fmtDate, esc, g,
  _invalidateMemo
} from '../helpers.js';

// ---- private helpers used only by rHome ----

function getSpendingStreak(){
  const bg = State.lCfg.overallBudget;
  if(!bg || !State.lPx.length) return 0;
  const weeklyBudget = bg / 4.33;
  let streak = 0;
  const now = new Date();
  for(let w = 0; w < 12; w++){
    const wEnd = new Date(now); wEnd.setDate(now.getDate() - w * 7);
    const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 7);
    const wStr1 = wStart.toISOString().split('T')[0];
    const wStr2 = wEnd.toISOString().split('T')[0];
    const wSpent = State.lPx.filter(function(p){
      return p.date && p.date >= wStr1 && p.date <= wStr2 && p.type !== 'income' && !p.deleted;
    }).reduce(function(s,p){ return s + Number(p.amount||0); }, 0);
    if(wSpent < weeklyBudget && wSpent > 0) streak++;
    else if(w > 0) break;
    else if(wSpent === 0 && w === 0) continue;
  }
  return streak;
}

function getLast6MonthsData(){
  const now = new Date();
  const months = [];
  for(let i = 5; i >= 0; i--){
    let m = now.getMonth() - i, y = now.getFullYear();
    if(m < 0){ m += 12; y--; }
    const prefix = y + '-' + String(m+1).padStart(2,'0');
    const monthPx = State.lPx.filter(p => p.date && p.date.startsWith(prefix) && !p.deleted);
    const sp = monthPx.filter(p => p.type !== 'income').reduce((s,p) => s + Number(p.amount||0), 0);
    const inc = monthPx.filter(p => p.type === 'income').reduce((s,p) => s + Number(p.amount||0), 0);
    months.push({ label: tx().months[m], month: m, year: y, spent: sp, income: inc, prefix });
  }
  return months;
}

function renderTrendChart(months){
  if(!months || !months.length) return '';
  const isCW = State.lang === 'cw';
  const maxVal = Math.max.apply(null, months.map(m => Math.max(m.spent, m.income||0)));
  if(maxVal <= 0) return '';
  const now = new Date();
  const bg = State.lCfg.overallBudget || 0;
  const BAR_H = 104;
  let h = '<div class="card" style="overflow:hidden">';
  h += '<div class="ch">';
  h += '<h2><i data-lucide="trending-up" style="width:16px;height:16px;margin-right:6px;color:var(--p1)"></i>';
  h += (isCW ? 'Kuona kwa Miyezi 6' : '6-Month Overview') + '</h2>';
  h += '<div style="display:flex;gap:8px;align-items:center">';
  h += '<span style="display:inline-flex;align-items:center;gap:3px;font-size:.58rem;font-weight:700;color:var(--mid)">';
  h += '<span style="width:8px;height:8px;border-radius:2px;background:var(--p1);display:inline-block"></span>' + (isCW?'Zogula':'Spent') + '</span>';
  h += '<span style="display:inline-flex;align-items:center;gap:3px;font-size:.58rem;font-weight:700;color:var(--mid)">';
  h += '<span style="width:8px;height:8px;border-radius:2px;background:#2E7D32;display:inline-block"></span>' + (isCW?'Malipiro':'Income') + '</span>';
  h += '</div></div>';
  h += '<div style="padding:12px 14px 10px">';
  h += '<div style="position:relative;height:' + BAR_H + 'px;margin-bottom:8px">';
  if(bg > 0){
    const budgetLineH = Math.min(Math.round(bg/maxVal*BAR_H), BAR_H-4);
    h += '<div style="position:absolute;left:0;right:0;bottom:'+budgetLineH+'px;border-top:1.5px dashed rgba(123,31,162,.35);z-index:1;pointer-events:none">';
    h += '<span style="position:absolute;right:0;top:-9px;font-size:.5rem;font-weight:800;color:var(--p1);opacity:.7;background:var(--surface);padding:0 3px;border-radius:3px">'+(isCW?'Bajeti':'Budget')+'</span>';
    h += '</div>';
  }
  h += '<div style="display:flex;align-items:flex-end;gap:3px;height:'+BAR_H+'px;position:relative;z-index:2">';
  months.forEach(function(m){
    const isThis = m.month === now.getMonth() && m.year === now.getFullYear();
    const isOver = bg > 0 && m.spent > bg;
    const spH = maxVal > 0 ? Math.max(Math.round(m.spent/maxVal*BAR_H), m.spent>0?3:0) : 0;
    const incH = maxVal > 0 ? Math.max(Math.round((m.income||0)/maxVal*BAR_H), (m.income||0)>0?3:0) : 0;
    const spColor = isThis ? (isOver?'linear-gradient(180deg,#FF5252,#C62828)':'linear-gradient(180deg,var(--p2),var(--p1))') : (isOver?'rgba(198,40,40,.4)':'rgba(123,31,162,.22)');
    const spShadow = isThis && !isOver ? ';box-shadow:0 2px 8px rgba(123,31,162,.35)' : '';
    const incColor = isThis ? '#2E7D32' : 'rgba(46,125,50,.3)';
    const monthLabel = tx().months[m.month];
    h += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer" onclick="window.__homeJumpToMonth('+m.month+','+m.year+')">';
    h += '<div style="flex:1;width:100%;display:flex;align-items:flex-end;gap:1px;position:relative">';
    if(isThis && m.spent > 0){
      h += '<div style="position:absolute;bottom:calc(100% + 2px);left:0;right:0;text-align:center;font-size:.5rem;font-weight:800;color:var(--p1);white-space:nowrap">'+MKs(m.spent)+'</div>';
    }
    h += '<div style="flex:3;height:'+spH+'px;background:'+spColor+';border-radius:4px 4px 2px 2px'+spShadow+'"></div>';
    if(m.income > 0){
      h += '<div style="flex:2;height:'+incH+'px;background:'+incColor+';border-radius:4px 4px 2px 2px"></div>';
    } else {
      h += '<div style="flex:2"></div>';
    }
    h += '</div>';
    h += '<div style="font-size:.58rem;font-weight:700;color:'+(isThis?'var(--p1)':'var(--mid)')+'">'+(isThis?'<strong>':'')+monthLabel+(isThis?'</strong>':'')+'</div>';
    h += '</div>';
  });
  h += '</div></div>';
  h += '<div style="display:flex;justify-content:space-between;align-items:center">';
  const last = months[5], prev = months[4];
  if(last && prev && prev.spent > 0){
    const chg = Math.round((last.spent-prev.spent)/prev.spent*100);
    const up = chg > 0;
    h += '<div class="bdiff-badge '+(up?'bdiff-dn':'bdiff-up')+'">'+(up?'&uarr;':'&darr;')+Math.abs(chg)+'% vs last mo</div>';
  } else {
    h += '<div style="font-size:.63rem;color:var(--mid)"><i data-lucide="bar-chart-2" style="width:11px;height:11px;margin-right:3px;vertical-align:middle;color:var(--p1)"></i>'+(isCW?'Gawani pa mwezi':'Monthly trend')+'</div>';
  }
  if(last && last.spent > 0 && bg > 0){
    const todayD = new Date();
    const daysInMonth = new Date(todayD.getFullYear(), todayD.getMonth()+1, 0).getDate();
    const daysPassed = todayD.getDate();
    if(daysPassed < daysInMonth && daysPassed > 0){
      const projected = Math.round(last.spent/daysPassed*daysInMonth);
      const projOver = projected > bg;
      h += '<div style="font-size:.6rem;font-weight:800;color:'+(projOver?'#C62828':'#2E7D32')+'">&#8594; '+MKs(projected)+' proj.</div>';
    }
  }
  h += '</div></div></div>';
  return h;
}

// Stub — see file header. Returns nothing until premium.js exists.
function getTrialBanner(){
  return '';
}

// Used by the onclick="" inside renderTrendChart() above — tapping a
// month bar jumps to that month in History. Will do nothing until
// main.js defines window.go(), and that's fine for now.
window.__homeJumpToMonth = function(m, y){
  State.viewMonth = { m, y };
  State.insTab = 'hist';
  if(typeof window.go === 'function') window.go('insights');
};

// Same deal for the "View All" button on the Recent Transactions card.
window.__homeGoInsights = function(){
  State.insTab = 'hist';
  if(typeof window.go === 'function') window.go('insights');
};

export function rHome(){
  const t = tx(), sp = totSp(), inc = totIn(), bg = State.lCfg.overallBudget,
        rem = bg - sp, pct = Math.min(sp/bg, 1);
  const circ = 2*Math.PI*32, off = circ*(1-pct),
        stroke = pct>=1 ? '#FF5252' : pct>=.8 ? '#FFD54F' : '#69F0AE';
  const recent = State.lPx.filter(p => isTM(p.date) && !p.deleted).slice(0,5);
  const over = State.lCfg.items.filter(it => iSpent(it.name) > it.budget).length;
  const near = State.lCfg.items.filter(it => { const r = iSpent(it.name)/it.budget; return r>=.8 && r<1; }).length;
  const ok = State.lCfg.items.filter(it => { const s = iSpent(it.name); return s>0 && s<it.budget*.8; }).length;
  const cnt = State.lPx.filter(p => isTM(p.date) && p.type!=='income' && !p.deleted).length;
  const streak = getSpendingStreak();
  const isCW = State.lang === 'cw';

  let h = '<div class="page">';
  h += getTrialBanner();
  h += '<div class="mnav"><button class="mnbtn" aria-label="Previous month" onclick="prevM()">&#9664;</button><span class="mnlbl"><i data-lucide="calendar" style="width:14px;height:14px;margin-right:4px;vertical-align:middle"></i>'+mName()+'</span><button class="mnbtn" aria-label="Next month" onclick="nextM()" style="opacity:'+(isCurM()?'.3':'1')+'">&#9654;</button></div>';
  if(State.lCfg && State.lCfg.salaryDay) h += '<div style="text-align:center;margin:-4px 0 8px"><span style="display:inline-flex;align-items:center;gap:4px;font-size:.66rem;font-weight:700;color:var(--p1);background:rgba(123,31,162,.1);padding:3px 10px;border-radius:20px;letter-spacing:.1px"><i data-lucide="calendar-check" style="width:11px;height:11px"></i>'+budgetPeriodLabel()+'</span></div>';

  h += '<div class="hero2">';
  h += '<div class="h2-top">';
  h += '<div class="h2-ring"><svg viewBox="0 0 80 80" width="78" height="78" style="transform:rotate(-90deg)"><circle fill="none" stroke="rgba(255,255,255,.14)" stroke-width="8" cx="40" cy="40" r="32"/><circle fill="none" stroke="'+stroke+'" stroke-width="8" stroke-linecap="round" cx="40" cy="40" r="32" stroke-dasharray="'+circ.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/></svg>';
  h += '<div class="h2-rlbl"><b>'+Math.round(pct*100)+'%</b><span>used</span></div></div>';
  h += '<div class="h2-main">';
  h += '<div class="h2-lbl">'+t.left+' this month</div>';
  h += '<div class="h2-bal'+(rem<0?' danger':'')+'">'+( rem<0?'- '+MKs(-rem):MKs(rem))+'</div>';
  h += '<div class="h2-sub">of '+MKs(bg)+' monthly budget</div>';
  h += '</div></div>';
  h += '<div class="h2-cols">';
  h += '<div class="h2-col"><div class="h2-cl">Income</div><div class="h2-cv gc">'+MKs(inc)+'</div></div>';
  h += '<div class="h2-div"></div>';
  h += '<div class="h2-col"><div class="h2-cl">Spent</div><div class="h2-cv rc">'+MKs(sp)+'</div></div>';
  h += '<div class="h2-div"></div>';
  h += '<div class="h2-col"><div class="h2-cl">Entries</div><div class="h2-cv">'+cnt+'</div></div>';
  h += '</div></div>';

  if(streak >= 2){
    const streakIcon = streak>=8?'flame':streak>=4?'star':'check-circle';
    const streakColor = streak>=8?'#E65100':streak>=4?'#F57F17':'#2E7D32';
    const streakMsg = streak>=8 ? (isCW?'Masabata '+streak+' opitilira bajeti!':streak+' weeks strong!')
      : streak>=4 ? (isCW?'Bwino kwambiri! Masabata '+streak:('Great work! '+streak+' wks under budget'))
      : (isCW?'Masabata 2 opitilira bajeti!':'2 weeks under budget!');
    h += '<div class="streak-chip"><div class="streak-ico" style="width:36px;height:36px;border-radius:10px;background:'+streakColor+'1A;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide="'+streakIcon+'" style="width:18px;height:18px;color:'+streakColor+'"></i></div><div class="streak-main"><div class="streak-ttl">'+(isCW?'Cholowetsa Bajeti':'Budget Streak')+'</div><div class="streak-sub">'+streakMsg+'</div></div></div>';
  }

  h += '<div class="chips"><div class="chip cP"><div class="chip-lbl">'+(isCW?'Zogulidwa':'Purchases')+'</div><div class="chip-val">'+cnt+'</div><div class="chip-sub">'+(isCW?'mwezi uno':'this month')+'</div></div>';
  h += '<div class="chip '+(over>0?'cR':'cG')+'"><div class="chip-lbl">'+(isCW?'Yavuka':'Over Budget')+'</div><div class="chip-val">'+over+'</div><div class="chip-sub">items</div></div>';
  h += '<div class="chip cO"><div class="chip-lbl">'+(isCW?'Pafupi':'Near Limit')+'</div><div class="chip-val">'+near+'</div><div class="chip-sub">items</div></div>';
  h += '<div class="chip cG"><div class="chip-lbl">'+(isCW?'Zabwino':'On Track')+'</div><div class="chip-val">'+ok+'</div><div class="chip-sub">items</div></div></div>';

  h += renderTrendChart(getLast6MonthsData());

  h += '<div class="card"><div class="ch"><h2>'+t.recent+'</h2><button class="btnG" onclick="window.__homeGoInsights()" style="padding:5px 10px;font-size:.72rem">'+t.viewAll+'</button></div><div class="cb" style="padding:4px 15px 12px">';
  if(recent.length){
    recent.forEach(p => {
      const u = uById(p.userId), isI = p.type === 'income';
      const cc = isI ? '#1B5E20' : (({Food:'#2E7D32',Household:'#1565C0',Personal:'#E91E63',Transport:'#E65100',Other:'#6D4C41'})[catOf(p.item,p.cat)] || '#7B1FA2');
      h += '<div class="pri">';
      h += '<div class="prico2" style="background:'+cc+'1A;border-radius:14px">'+ico(p.item)+'</div>';
      h += '<div class="prinfo"><div class="prname">'+esc(p.item)+(isBadItemName(p.item)?' <span title="This entry needs a proper name" style="color:#E65100;font-size:.8em">⚠️</span>':'')+(p.recurring?' <i data-lucide="refresh-cw" style="width:12px;height:12px;margin-right:3px;vertical-align:middle"></i>':'')+'</div>';
      h += (p.notes?'<div class="prnote">'+esc(p.notes)+'</div>':'');
      h += '<div class="prmeta"><span class="prdate">'+fmtDate(p.date)+'</span>';
      h += '<span class="prwho" style="background:'+u.color+'">'+esc(u.name)+'</span></div></div>';
      h += '<div class="pramt '+(isI?'inc':'exp')+'">'+(isI?'+ ':'- ')+MK(p.amount)+'</div></div>';
    });
  } else {
    h += '<div class="empty"><div class="ei"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>';
    h += '<p><strong>'+(isCW?'Palibe cholemba.':'No transactions yet.')+'</strong><br><span style="font-size:.75rem;color:var(--mid)">'+(isCW?'Dinani + kuti mulowetse.':'Tap + to log your first expense.')+'</span></p></div>';
  }
  h += '</div></div></div>';

  g('view').innerHTML = h;
}

export function prevM(){
  const v = vmObj();
  State.viewMonth = v.m === 0 ? { m:11, y:v.y-1 } : { m:v.m-1, y:v.y };
  _invalidateMemo();
  rHome();
  if(window.lucide) window.lucide.createIcons();
}
export function nextM(){
  if(isCurM()) return;
  const v = vmObj();
  State.viewMonth = v.m === 11 ? { m:0, y:v.y+1 } : { m:v.m+1, y:v.y };
  _invalidateMemo();
  rHome();
  if(window.lucide) window.lucide.createIcons();
}

// onclick="" needs these on window — see Rule 1 in the conventions doc.
window.prevM = prevM;
window.nextM = nextM;
