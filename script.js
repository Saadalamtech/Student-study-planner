/* ==============================================
   BLOOM — Study Planner  |  script.js
   ============================================== */
'use strict';

// ==============================
// STATE
// ==============================
let S = {
  tasks: [], events: [], reminders: [],
  filter: 'all', subjectFilter: null, search: '', sort: 'created',
  editId: null, subtasks: [], repeat: 'none',
  selectedDate: new Date(),
  calMonth: new Date().getMonth(), calYear: new Date().getFullYear(),
  eventColor: '#f9a8d4',
  timer: {
    mode:'pomodoro', total:1500, remaining:1500,
    running:false, interval:null, sessions:0, taskId:null,
  },
  streak: 0, pomosToday: 0, darkMode: false,
  currentView: 'tasks',
};

// ==============================
// PERSIST
// ==============================
const KEY = 'bloom_app_v1';
function persist() {
  localStorage.setItem(KEY, JSON.stringify({
    tasks:S.tasks, events:S.events, reminders:S.reminders,
    streak:S.streak, pomosToday:S.pomosToday,
    timer:{sessions:S.timer.sessions}, darkMode:S.darkMode,
  }));
}
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)||'{}');
    if (d.tasks)     S.tasks     = d.tasks;
    if (d.events)    S.events    = d.events;
    if (d.reminders) S.reminders = d.reminders;
    if (d.streak !== undefined) S.streak = d.streak;
    if (d.pomosToday) S.pomosToday = d.pomosToday;
    if (d.timer) S.timer.sessions = d.timer.sessions||0;
    if (d.darkMode !== undefined) S.darkMode = d.darkMode;
  } catch(e){}
}

// ==============================
// UTILS
// ==============================
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function todayStr() { return new Date().toISOString().split('T')[0]; }
function isOverdue(t) {
  if (!t.due||t.status==='completed') return false;
  return new Date(t.due+'T23:59:59') < new Date();
}
function isToday(t) {
  if (!t.due) return false;
  return t.due === todayStr();
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d+'T00:00:00');
  return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
function priorityColor(p) {
  return {urgent:'#ff4757', high:'#ffa502', normal:'#f472b6', low:'#2ed573'}[p]||'#f472b6';
}
function makeTask(d) {
  return {
    id:uid(), title:d.title||'', desc:d.desc||'',
    subject:d.subject||'General', priority:d.priority||'normal',
    status:'pending', due:d.due||'', dueTime:d.dueTime||'',
    duration:d.duration||60, pomos:d.pomos||1, pomosCompleted:0,
    tags:d.tags||[], reminder:d.reminder||false,
    reminderBefore:d.reminderBefore||60,
    repeat:d.repeat||'none', subtasks:d.subtasks||[],
    created:Date.now(),
  };
}

// ==============================
// TOAST
// ==============================
function toast(msg, icon='🌸') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-ico">${icon}</span><span class="toast-msg">${msg}</span>`;
  c.appendChild(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),300);},3200);
}

// ==============================
// AMBIENT CANVAS — Fluid Aurora
// ==============================
function initCanvas() {
  const cv = document.getElementById('ambientCanvas');
  const ctx = cv.getContext('2d');
  function resize() { cv.width=window.innerWidth; cv.height=window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  // Large slow aurora layers
  const aurora = [
    {ox:0.15,oy:0.25,ax:240,ay:180,sx:0.00015,sy:0.00018,px:0.0,py:0.8,r:350,rA:60,rSx:0.00042,rPx:0.0,hue:338,sat:72,lgt:78,a:0.12},
    {ox:0.58,oy:0.68,ax:200,ay:200,sx:0.00020,sy:0.00016,px:1.3,py:2.1,r:310,rA:55,rSx:0.00052,rPx:1.1,hue:348,sat:68,lgt:81,a:0.10},
    {ox:0.82,oy:0.28,ax:180,ay:220,sx:0.00013,sy:0.00023,px:2.6,py:0.4,r:360,rA:65,rSx:0.00038,rPx:2.2,hue:342,sat:65,lgt:83,a:0.09},
    {ox:0.28,oy:0.82,ax:260,ay:150,sx:0.00018,sy:0.00014,px:4.0,py:3.3,r:280,rA:48,rSx:0.00058,rPx:3.5,hue:355,sat:62,lgt:85,a:0.08},
    {ox:0.65,oy:0.12,ax:220,ay:185,sx:0.00016,sy:0.00019,px:5.2,py:1.7,r:320,rA:54,rSx:0.00048,rPx:4.8,hue:318,sat:58,lgt:86,a:0.08},
  ].map(b=>({...b,ox:b.ox*window.innerWidth,oy:b.oy*window.innerHeight,x:0,y:0}));

  // Smaller vivid accent blobs
  const accents = [
    {ox:0.18,oy:0.52,ax:110,ay:90, sx:0.00052,sy:0.00062,px:0.5,py:1.2,r:130,rA:24,rSx:0.0011,rPx:0.3,hue:335,sat:88,lgt:79,a:0.09},
    {ox:0.78,oy:0.42,ax:95, ay:110,sx:0.00068,sy:0.00048,px:2.0,py:0.7,r:110,rA:20,rSx:0.0013,rPx:1.8,hue:350,sat:82,lgt:81,a:0.08},
    {ox:0.42,oy:0.18,ax:130,ay:75, sx:0.00042,sy:0.00072,px:3.5,py:2.9,r:140,rA:28,rSx:0.0009,rPx:3.0,hue:10, sat:78,lgt:83,a:0.07},
    {ox:0.88,oy:0.78,ax:85, ay:120,sx:0.00063,sy:0.00043,px:1.1,py:4.2,r:120,rA:22,rSx:0.0012,rPx:2.5,hue:325,sat:80,lgt:82,a:0.08},
    {ox:0.08,oy:0.88,ax:115,ay:88, sx:0.00058,sy:0.00053,px:4.8,py:0.9,r:100,rA:18,rSx:0.0014,rPx:4.0,hue:345,sat:84,lgt:80,a:0.075},
    {ox:0.50,oy:0.50,ax:140,ay:100,sx:0.00038,sy:0.00068,px:2.4,py:3.6,r:155,rA:30,rSx:0.0008,rPx:1.5,hue:358,sat:78,lgt:78,a:0.09},
    // Extra: warm cream/peachy accent for light mode richness
    {ox:0.35,oy:0.35,ax:180,ay:130,sx:0.00025,sy:0.00028,px:1.7,py:2.3,r:200,rA:40,rSx:0.0007,rPx:0.8,hue:15, sat:60,lgt:88,a:0.07},
    {ox:0.70,oy:0.60,ax:160,ay:140,sx:0.00022,sy:0.00030,px:3.2,py:4.1,r:230,rA:45,rSx:0.0006,rPx:2.7,hue:330,sat:55,lgt:90,a:0.06},
  ].map(b=>({...b,ox:b.ox*window.innerWidth,oy:b.oy*window.innerHeight,x:0,y:0}));

  let t = 0;
  function drawBlob(b) {
    b.x = b.ox + Math.sin(t*b.sx+b.px)*b.ax + Math.sin(t*b.sx*1.618+b.px*0.7)*b.ax*0.28;
    b.y = b.oy + Math.sin(t*b.sy+b.py)*b.ay + Math.cos(t*b.sy*1.414+b.py*0.9)*b.ay*0.22;
    b.ox += Math.sin(t*0.000052+b.px)*0.22;
    b.oy += Math.cos(t*0.000060+b.py)*0.18;
    if(b.ox<-280) b.ox=cv.width+280;
    if(b.ox>cv.width+280) b.ox=-280;
    if(b.oy<-280) b.oy=cv.height+280;
    if(b.oy>cv.height+280) b.oy=-280;
    const r = b.r + Math.sin(t*b.rSx+b.rPx)*b.rA;
    const g = ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,r);
    g.addColorStop(0,   `hsla(${b.hue},${b.sat}%,${b.lgt}%,${b.a})`);
    g.addColorStop(0.28,`hsla(${b.hue},${b.sat}%,${b.lgt}%,${b.a*0.72})`);
    g.addColorStop(0.62,`hsla(${b.hue},${b.sat}%,${b.lgt}%,${b.a*0.22})`);
    g.addColorStop(1,   'transparent');
    ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
  }
  function draw() {
    t++;
    ctx.clearRect(0,0,cv.width,cv.height);
    aurora.forEach(drawBlob);
    accents.forEach(drawBlob);
    requestAnimationFrame(draw);
  }
  draw();
}

// ==============================
// FALLING PETALS
// ==============================
function initPetals() {
  const layer = document.getElementById('petalsLayer');
  const colors = ['#fda4af','#f9a8d4','#fbcfe8','#fce7f3','#fb7185'];
  for(let i=0;i<18;i++) {
    const p = document.createElement('div');
    p.className = 'petal';
    const size = 8+Math.random()*10;
    p.style.cssText = [
      `left:${Math.random()*100}%`,
      `--ps:${size}px`,
      `--pc:${colors[Math.floor(Math.random()*colors.length)]}`,
      `--po:${0.2+Math.random()*0.45}`,
      `--pd:${7+Math.random()*8}s`,
      `--delay:${-Math.random()*12}s`,
    ].join(';');
    layer.appendChild(p);
  }
}

// ==============================
// CUSTOM CURSOR
// ==============================
function initCursor() {
  const cur = document.getElementById('cursor');
  const trail = document.getElementById('cursorTrail');
  const petal = document.getElementById('cursorPetal');
  let mx=0,my=0,tx=0,ty=0;
  document.addEventListener('mousemove',e=>{
    mx=e.clientX; my=e.clientY;
    cur.style.left=mx+'px'; cur.style.top=my+'px';
    petal.style.left=mx+'px'; petal.style.top=my+'px';
    petal.style.setProperty('--petal-rot',Math.random()*360+'deg');
  });
  (function lerpTrail(){
    tx += (mx-tx)*0.12; ty += (my-ty)*0.12;
    trail.style.left=tx+'px'; trail.style.top=ty+'px';
    requestAnimationFrame(lerpTrail);
  })();
  document.querySelectorAll('button,a,.task-card,.cal-day,.filter-tab').forEach(el=>{
    el.addEventListener('mouseenter',()=>document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave',()=>document.body.classList.remove('cursor-hover'));
  });
}

// ==============================
// GREETING
// ==============================
function initGreeting() {
  const h = new Date().getHours();
  const greet = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  const el = document.getElementById('greetingText');
  if(el) el.textContent = greet;
  const dt = document.getElementById('greetingDate');
  if(dt) dt.textContent = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
}

// ==============================
// QUOTES
// ==============================
const QUOTES = [
  {t:'"Almost everything will work again if you unplug it for a few minutes, including you."',a:'— Anne Lamott'},
  {t:'"The beautiful thing about learning is that nobody can take it away from you."',a:'— B.B. King'},
  {t:'"An investment in knowledge pays the best interest."',a:'— Benjamin Franklin'},
  {t:'"The secret of getting ahead is getting started."',a:'— Mark Twain'},
  {t:'"It always seems impossible until it\'s done."',a:'— Nelson Mandela'},
  {t:'"You don\'t have to be great to start, but you have to start to be great."',a:'— Zig Ziglar'},
  {t:'"The expert in anything was once a beginner."',a:'— Helen Hayes'},
  {t:'"Education is the most powerful weapon which you can use to change the world."',a:'— Nelson Mandela'},
  {t:'"Strive for progress, not perfection."',a:'— Unknown'},
  {t:'"The only way to do great work is to love what you do."',a:'— Steve Jobs'},
  {t:'"Your limitation—it\'s only your imagination."',a:'— Unknown'},
  {t:'"Push yourself, because no one else is going to do it for you."',a:'— Unknown'},
];
let qIdx = 0;
function initQuotes() {
  qIdx = Math.floor(Math.random()*QUOTES.length);
  showQuote();
  document.getElementById('quoteNext')?.addEventListener('click',()=>{
    qIdx = (qIdx+1)%QUOTES.length;
    const el = document.getElementById('quoteText');
    if(el){el.style.opacity='0'; setTimeout(()=>{showQuote();el.style.opacity='1';},300);}
  });
}
function showQuote() {
  const q = QUOTES[qIdx];
  const t = document.getElementById('quoteText');
  const b = document.getElementById('quoteBy');
  if(t) t.textContent = q.t;
  if(b) b.textContent = q.a;
}

// ==============================
// CALENDAR
// ==============================
function initCalendar() {
  document.getElementById('calPrev')?.addEventListener('click',()=>{ S.calMonth--; if(S.calMonth<0){S.calMonth=11;S.calYear--;} renderCalendar(); });
  document.getElementById('calNext')?.addEventListener('click',()=>{ S.calMonth++; if(S.calMonth>11){S.calMonth=0;S.calYear++;} renderCalendar(); });
}
function renderCalendar() {
  const label = document.getElementById('calMonthLabel');
  const grid  = document.getElementById('calDays');
  if(!label||!grid) return;
  label.textContent = new Date(S.calYear,S.calMonth).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const first = new Date(S.calYear,S.calMonth,1).getDay();
  const days  = new Date(S.calYear,S.calMonth+1,0).getDate();
  const today = todayStr();
  const selStr = S.selectedDate.toISOString().split('T')[0];
  const taskDates = new Set(S.tasks.map(t=>t.due).filter(Boolean));
  const evtDates  = new Set(S.events.map(e=>e.date).filter(Boolean));
  let html='';
  for(let i=0;i<first;i++) html+=`<div class="cal-day cal-empty"></div>`;
  for(let d=1;d<=days;d++){
    const ds = `${S.calYear}-${String(S.calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const classes=['cal-day'];
    if(ds===today) classes.push('today');
    if(ds===selStr) classes.push('selected');
    if(taskDates.has(ds)||evtDates.has(ds)) classes.push('has-dot');
    html+=`<div class="${classes.join(' ')}" data-date="${ds}">${d}</div>`;
  }
  grid.innerHTML=html;
  grid.querySelectorAll('.cal-day:not(.cal-empty)').forEach(el=>{
    el.addEventListener('click',()=>{
      S.selectedDate=new Date(el.dataset.date+'T00:00:00');
      renderCalendar(); renderDayPanel();
    });
  });
}
function renderDayPanel() {
  const ds = S.selectedDate.toISOString().split('T')[0];
  const title = document.getElementById('selectedDayTitle');
  if(title) title.textContent = ds===todayStr()?'Today':S.selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const list = document.getElementById('dayEventsList');
  if(!list) return;
  const items = [
    ...S.tasks.filter(t=>t.due===ds).map(t=>({id:t.id,type:'task',title:t.title,time:t.dueTime,color:priorityColor(t.priority)})),
    ...S.events.filter(e=>e.date===ds).map(e=>({id:e.id,type:'event',title:e.title,time:e.time,color:e.color})),
  ].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if(!items.length){list.innerHTML='<div class="day-empty">No tasks for this day</div>';return;}
  list.innerHTML=items.map(i=>`
    <div class="day-event-item">
      <div class="day-event-dot" style="background:${i.color}"></div>
      <span class="day-event-title">${esc(i.title)}</span>
      ${i.time?`<span class="day-event-time">${i.time}</span>`:''}
      ${i.type==='event'?`<button class="day-event-del" data-eid="${i.id}">✕</button>`:''}
    </div>`).join('');
  list.querySelectorAll('.day-event-del').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      S.events=S.events.filter(ev=>ev.id!==btn.dataset.eid);
      persist(); renderDayPanel(); renderCalendar();
    });
  });
}

// ==============================
// EVENT MODAL
// ==============================
function initEventModal() {
  document.getElementById('addEventBtn')?.addEventListener('click',()=>{
    const ds=S.selectedDate.toISOString().split('T')[0];
    document.getElementById('evDate').value=ds;
    document.getElementById('evTime').value='';
    document.getElementById('evTitle').value='';
    document.getElementById('eventModal').classList.add('open');
  });
  document.getElementById('eventModalClose')?.addEventListener('click',()=>document.getElementById('eventModal').classList.remove('open'));
  document.getElementById('eventModalCancel')?.addEventListener('click',()=>document.getElementById('eventModal').classList.remove('open'));
  document.getElementById('eventModal')?.addEventListener('click',e=>{if(e.target===document.getElementById('eventModal'))document.getElementById('eventModal').classList.remove('open');});
  document.getElementById('colorRow')?.querySelectorAll('.color-dot').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.color-dot').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); S.eventColor=btn.dataset.c;
    });
  });
  document.getElementById('eventModalSave')?.addEventListener('click',()=>{
    const title=document.getElementById('evTitle').value.trim();
    if(!title){toast('Please enter an event name','⚠️');return;}
    S.events.push({id:uid(),title,date:document.getElementById('evDate').value,time:document.getElementById('evTime').value,color:S.eventColor});
    persist(); renderCalendar(); renderDayPanel();
    document.getElementById('eventModal').classList.remove('open');
    toast('Event added 🌿','📅');
  });
}

// ==============================
// REMINDER MODAL
// ==============================
function initReminderModal() {
  document.getElementById('addReminderBtn')?.addEventListener('click',()=>{
    document.getElementById('remText').value='';
    document.getElementById('remDate').value=todayStr();
    document.getElementById('remTime').value='';
    document.getElementById('reminderModal').classList.add('open');
  });
  ['remModalClose','remModalCancel'].forEach(id=>{
    document.getElementById(id)?.addEventListener('click',()=>document.getElementById('reminderModal').classList.remove('open'));
  });
  document.getElementById('reminderModal')?.addEventListener('click',e=>{if(e.target===document.getElementById('reminderModal'))document.getElementById('reminderModal').classList.remove('open');});
  document.getElementById('remModalSave')?.addEventListener('click',()=>{
    const text=document.getElementById('remText').value.trim();
    if(!text){toast('Please enter a reminder text','⚠️');return;}
    S.reminders.push({id:uid(),text,date:document.getElementById('remDate').value,time:document.getElementById('remTime').value,fired:false});
    persist(); renderReminders();
    document.getElementById('reminderModal').classList.remove('open');
    toast('Reminder set 🌸','🔔');
  });
}
function renderReminders() {
  const c=document.getElementById('remindersList');
  if(!c) return;
  if(!S.reminders.length){c.innerHTML='<div class="day-empty">No reminders set</div>';return;}
  c.innerHTML=S.reminders.map(r=>`
    <div class="reminder-chip${r.fired?' fired':''}">
      <span class="reminder-chip-icon">🔔</span>
      <span class="reminder-chip-text">${esc(r.text)}</span>
      <span class="reminder-chip-time">${r.date?fmtDate(r.date):''}${r.time?' '+r.time:''}</span>
      <button class="reminder-chip-del" data-id="${r.id}"><i class="fas fa-times"></i></button>
    </div>`).join('');
  c.querySelectorAll('.reminder-chip-del').forEach(btn=>{
    btn.addEventListener('click',()=>{S.reminders=S.reminders.filter(r=>r.id!==btn.dataset.id);persist();renderReminders();});
  });
}
function checkReminders() {
  const now=new Date();
  S.reminders.forEach(r=>{
    if(r.fired||!r.date||!r.time) return;
    const rt=new Date(r.date+'T'+r.time);
    if(now>=rt){r.fired=true;toast(`Reminder: ${r.text}`,'🔔');persist();renderReminders();}
  });
}

// ==============================
// POMODORO
// ==============================
function initPomodoro() {
  // Sidebar pomo
  document.querySelectorAll('.pomo-chip:not(.pv-chip)').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.pomo-chip:not(.pv-chip)').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      setPomoMode(parseInt(btn.dataset.time), btn.dataset.label);
    });
  });
  document.getElementById('pomoToggle')?.addEventListener('click', togglePomo);
  document.getElementById('pomoReset')?.addEventListener('click', resetPomo);
  document.getElementById('pomoSkip')?.addEventListener('click', skipPomo);

  // Big pomo view
  document.querySelectorAll('.pv-chip').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.pv-chip').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      setPomoMode(parseInt(btn.dataset.pvTime), btn.dataset.pvLabel);
    });
  });
  document.getElementById('pomoToggleBig')?.addEventListener('click', togglePomo);
  document.getElementById('pomoResetBig')?.addEventListener('click', resetPomo);
  document.getElementById('pomoSkipBig')?.addEventListener('click', skipPomo);

  updatePomoUI();
}
function setPomoMode(seconds, label) {
  if(S.timer.running) clearInterval(S.timer.interval);
  S.timer.running=false; S.timer.mode=label.toLowerCase();
  S.timer.total=seconds; S.timer.remaining=seconds;
  updatePomoUI();
}
function togglePomo() {
  if(S.timer.running) {
    clearInterval(S.timer.interval);
    S.timer.running=false;
    document.getElementById('pomoIcon').className='fas fa-play';
    document.getElementById('pomoIconBig') && (document.getElementById('pomoIconBig').className='fas fa-play');
    document.getElementById('pomoTime')?.classList.remove('running');
    document.getElementById('pomoTimeBig')?.classList.remove('running');
  } else {
    S.timer.running=true;
    document.getElementById('pomoIcon').className='fas fa-pause';
    document.getElementById('pomoIconBig') && (document.getElementById('pomoIconBig').className='fas fa-pause');
    document.getElementById('pomoTime')?.classList.add('running');
    document.getElementById('pomoTimeBig')?.classList.add('running');
    S.timer.interval=setInterval(()=>{
      S.timer.remaining--;
      updatePomoUI();
      if(S.timer.remaining<=0) {
        clearInterval(S.timer.interval);
        S.timer.running=false;
        S.timer.sessions++;
        S.pomosToday++;
        persist(); renderAll();
        toast('Focus session complete! 🌸','🍃');
        document.getElementById('pomoIcon').className='fas fa-play';
        document.getElementById('pomoIconBig') && (document.getElementById('pomoIconBig').className='fas fa-play');
        document.getElementById('pomoTime')?.classList.remove('running');
        document.getElementById('pomoTimeBig')?.classList.remove('running');
      }
    },1000);
  }
}
function resetPomo() {
  if(S.timer.running){clearInterval(S.timer.interval); S.timer.running=false;}
  S.timer.remaining=S.timer.total;
  document.getElementById('pomoIcon').className='fas fa-play';
  document.getElementById('pomoIconBig') && (document.getElementById('pomoIconBig').className='fas fa-play');
  document.getElementById('pomoTime')?.classList.remove('running');
  document.getElementById('pomoTimeBig')?.classList.remove('running');
  updatePomoUI();
}
function skipPomo() { S.timer.remaining=0; updatePomoUI(); }
function updatePomoUI() {
  const m=Math.floor(S.timer.remaining/60);
  const s=String(S.timer.remaining%60).padStart(2,'0');
  const str=`${m}:${s}`;
  const el1=document.getElementById('pomoTime');
  const el2=document.getElementById('pomoTimeBig');
  if(el1) el1.textContent=str;
  if(el2) el2.textContent=str;
  const pct=S.timer.remaining/S.timer.total;
  const circ=364.4;
  const el3=document.getElementById('pomoCircle');
  if(el3) el3.style.strokeDashoffset=String(circ*(1-pct));
  const circ2=534;
  const el4=document.getElementById('pomoCircleBig');
  if(el4) el4.style.strokeDashoffset=String(circ2*(1-pct));
  const mn=S.timer.mode.charAt(0).toUpperCase()+S.timer.mode.slice(1);
  const n1=document.getElementById('pomoModeName');
  const n2=document.getElementById('pomoModeNameBig');
  if(n1) n1.textContent=mn;
  if(n2) n2.textContent=mn;
  const cnt=`Session ${S.timer.sessions+1} · <span id="pomoCount">${S.pomosToday}</span> done today`;
  const si1=document.getElementById('pomoSessionInfo');
  const si2=document.getElementById('pomoSessionInfoBig');
  if(si1) si1.innerHTML=cnt;
  if(si2) si2.innerHTML=cnt.replace('pomoCount','pomoCountBig');
}

// ==============================
// TASK CRUD
// ==============================
function addTask(data) {
  const t=makeTask(data);
  S.tasks.push(t);
  persist(); renderAll();
  toast(`Task added 🌱`,'✨');
  updateBloomFlower();
  const card=document.querySelector(`[data-id="${t.id}"]`);
  if(card) card.classList.add('new-card');
}
function updateTask(id,data) {
  const idx=S.tasks.findIndex(t=>t.id===id);
  if(idx<0) return;
  S.tasks[idx]={...S.tasks[idx],...data};
  persist(); renderAll();
  updateBloomFlower();
}
function deleteTask(id) {
  S.tasks=S.tasks.filter(t=>t.id!==id);
  persist(); renderAll(); updateBloomFlower();
  toast('Task removed','🗑️');
}
function toggleComplete(id) {
  const t=S.tasks.find(t=>t.id===id);
  if(!t) return;
  t.status=t.status==='completed'?'pending':'completed';
  persist(); renderAll(); updateBloomFlower();
  if(t.status==='completed') toast('Task bloomed! 🌸','✅');
}
function postponeTask(id) {
  const t=S.tasks.find(t=>t.id===id);
  if(!t) return;
  t.status=t.status==='postponed'?'pending':'postponed';
  persist(); renderAll();
  toast(t.status==='postponed'?'Task deferred 🕐':'Task resumed 🌱',t.status==='postponed'?'⏰':'🌿');
}
function clearCompleted() {
  S.tasks=S.tasks.filter(t=>t.status!=='completed');
  persist(); renderAll(); updateBloomFlower();
  toast('Completed tasks cleared 🧹','🌿');
}

// ==============================
// FILTERS
// ==============================
function filtered() {
  let ts=[...S.tasks];
  if(S.filter==='today')     ts=ts.filter(isToday);
  else if(S.filter==='pending')   ts=ts.filter(t=>t.status==='pending');
  else if(S.filter==='completed') ts=ts.filter(t=>t.status==='completed');
  else if(S.filter==='postponed') ts=ts.filter(t=>t.status==='postponed');
  else if(S.filter==='overdue')   ts=ts.filter(isOverdue);
  if(S.subjectFilter) ts=ts.filter(t=>t.subject===S.subjectFilter);
  if(S.search) {
    const q=S.search.toLowerCase();
    ts=ts.filter(t=>t.title.toLowerCase().includes(q)||t.subject.toLowerCase().includes(q)||(t.tags||[]).some(tag=>tag.toLowerCase().includes(q)));
  }
  const w={urgent:4,high:3,normal:2,low:1};
  if(S.sort==='priority') ts.sort((a,b)=>(w[b.priority]||0)-(w[a.priority]||0));
  else if(S.sort==='due')  ts.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
  else if(S.sort==='subject') ts.sort((a,b)=>a.subject.localeCompare(b.subject));
  else ts.sort((a,b)=>b.created-a.created);
  return ts;
}

// ==============================
// RENDER ALL
// ==============================
function renderAll() {
  const ts=filtered();
  const groups={urgent:[],high:[],normal:[],low:[]};
  ts.forEach(t=>{if(groups[t.priority]) groups[t.priority].push(t);});
  ['urgent','high','normal','low'].forEach(p=>{
    const list=document.getElementById(`list-${p}`);
    const cnt=document.getElementById(`cnt-${p}`);
    if(!list||!cnt) return;
    cnt.textContent=groups[p].length;
    list.innerHTML='';
    groups[p].forEach(t=>list.appendChild(buildCard(t)));
  });
  const empty=document.getElementById('emptyState');
  const cols=document.getElementById('taskColumns');
  const hasAny=ts.length>0;
  if(empty) empty.style.display=hasAny?'none':'block';
  if(cols)  cols.style.display=hasAny?'grid':'none';
  document.getElementById('statTotal').textContent  = S.tasks.length;
  document.getElementById('statDone').textContent   = S.tasks.filter(t=>t.status==='completed').length;
  document.getElementById('statStreak').textContent = S.streak;
  document.getElementById('statPomos').textContent  = S.timer.sessions;
  const total=S.tasks.length;
  const done=S.tasks.filter(t=>t.status==='completed').length;
  const pct=total?Math.round(done/total*100):0;
  document.getElementById('progressPillFill').style.width=pct+'%';
  document.getElementById('progressPillText').textContent=pct+'%';
  renderSubjectFilters();
  renderCalendar();
  renderDayPanel();
  renderStatsView();
  updateBloomFlower();
}

// ==============================
// STATS VIEW
// ==============================
function renderStatsView() {
  const total=S.tasks.length;
  const done=S.tasks.filter(t=>t.status==='completed').length;
  const pct=total?Math.round(done/total*100):0;
  const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  sv('sv-total',total); sv('sv-done',done); sv('sv-streak',S.streak); sv('sv-pomos',S.timer.sessions);
  sv('sv-pct',pct+'%');
  const bar=document.getElementById('sv-bar');
  if(bar) bar.style.width=pct+'%';

  // By subject
  const subjects={};
  S.tasks.forEach(t=>{subjects[t.subject]=(subjects[t.subject]||0)+1;});
  const maxS=Math.max(1,...Object.values(subjects));
  const slist=document.getElementById('svSubjectList');
  if(slist) slist.innerHTML=Object.entries(subjects).sort((a,b)=>b[1]-a[1]).map(([s,c])=>`
    <div class="sv-subject-row">
      <span class="sv-subject-name">${esc(s)}</span>
      <div class="sv-subject-bar-wrap"><div class="sv-subject-bar" style="width:${(c/maxS*100)}%"></div></div>
      <span class="sv-subject-count">${c}</span>
    </div>`).join('');

  // By priority
  const pris={urgent:0,high:0,normal:0,low:0};
  S.tasks.forEach(t=>{if(pris[t.priority]!==undefined)pris[t.priority]++;});
  const maxP=Math.max(1,...Object.values(pris));
  const pbars=document.getElementById('svPriorityBars');
  if(pbars) pbars.innerHTML=Object.entries(pris).map(([p,c])=>`
    <div class="sv-pri-row">
      <span class="sv-pri-name">${p.charAt(0).toUpperCase()+p.slice(1)}</span>
      <div class="sv-pri-bar-wrap"><div class="sv-pri-bar ${p}" style="width:${(c/maxP*100)}%"></div></div>
      <span class="sv-pri-count">${c}</span>
    </div>`).join('');
}

// ==============================
// BUILD TASK CARD
// ==============================
function buildCard(task) {
  const div=document.createElement('div');
  const color=priorityColor(task.priority);
  const overdueClass=isOverdue(task)?' overdue':'';
  const postClass=task.status==='postponed'?' postponed':'';
  div.className=`task-card${task.status==='completed'?' completed':''}${overdueClass}${postClass}`;
  div.style.setProperty('--c',color);
  div.dataset.id=task.id; div.draggable=true;
  const sdone=task.subtasks.filter(s=>s.done).length;
  const stotal=task.subtasks.length;
  div.innerHTML=`
    <div class="task-card-top">
      <button class="task-check-btn${task.status==='completed'?' checked':''}" data-action="complete">
        ${task.status==='completed'?'<i class="fas fa-check"></i>':''}
      </button>
      <div class="task-card-title">${esc(task.title)}</div>
    </div>
    <div class="task-card-meta">
      <span class="task-chip subject">${esc(task.subject)}</span>
      ${task.due?`<span class="task-chip due${isOverdue(task)?' overdue-chip':''}">${fmtDate(task.due)}</span>`:''}
      <span class="task-chip pomo-chip">⏱ ${task.pomosCompleted||0}/${task.pomos}</span>
      ${task.tags.length?`<div class="task-tags-row">${task.tags.map(t=>`<span class="task-tag">#${esc(t)}</span>`).join('')}</div>`:''}
    </div>
    ${stotal>0?`<div class="task-subtask-row">
      <div class="task-subtask-bar"><div class="task-subtask-bar-fill" style="width:${stotal?sdone/stotal*100:0}%"></div></div>
      <span class="task-subtask-label">${sdone}/${stotal}</span>
    </div>`:''}
    <div class="task-card-actions">
      <button class="task-act-btn focus" data-action="focus" title="Focus"><i class="fas fa-crosshairs"></i></button>
      <button class="task-act-btn" data-action="edit" title="Edit"><i class="fas fa-pen"></i></button>
      <button class="task-act-btn" data-action="postpone" title="${task.status==='postponed'?'Resume':'Defer'}"><i class="fas fa-clock"></i></button>
      <button class="task-act-btn del" data-action="delete" title="Delete"><i class="fas fa-trash"></i></button>
    </div>`;
  div.addEventListener('click',e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(!action) return;
    if(action==='complete') toggleComplete(task.id);
    else if(action==='edit') openEditModal(task.id);
    else if(action==='delete') deleteTask(task.id);
    else if(action==='postpone') postponeTask(task.id);
    else if(action==='focus'){
      S.timer.taskId=task.id;
      toast(`Focusing on "${task.title}" 🎯`,'⏱');
    }
  });
  div.addEventListener('dragstart',e=>{e.dataTransfer.setData('taskId',task.id);div.classList.add('dragging');});
  div.addEventListener('dragend',()=>div.classList.remove('dragging'));
  return div;
}

// ==============================
// DRAG AND DROP
// ==============================
function initDragDrop() {
  document.addEventListener('dragover',e=>{
    const list=e.target.closest('.task-list');
    if(list){e.preventDefault();list.classList.add('drag-over');}
  });
  document.addEventListener('dragleave',e=>{
    const list=e.target.closest('.task-list');
    if(list) list.classList.remove('drag-over');
  });
  document.addEventListener('drop',e=>{
    const list=e.target.closest('.task-list');
    if(!list) return;
    list.classList.remove('drag-over');
    const id=e.dataTransfer.getData('taskId');
    const newPriority=list.dataset.priority;
    if(id&&newPriority){updateTask(id,{priority:newPriority});toast(`Priority updated to ${newPriority}`,'🌸');}
  });
}

// ==============================
// SUBJECT FILTER CHIPS
// ==============================
function renderSubjectFilters() {
  const subjects=[...new Set(S.tasks.map(t=>t.subject))];
  const c=document.getElementById('subjectFilters');
  if(!c) return;
  c.innerHTML=subjects.map(s=>`<button class="subject-chip${S.subjectFilter===s?' active':''}" data-s="${esc(s)}">${esc(s)}</button>`).join('');
  c.querySelectorAll('.subject-chip').forEach(btn=>{
    btn.addEventListener('click',()=>{
      S.subjectFilter=S.subjectFilter===btn.dataset.s?null:btn.dataset.s;
      renderAll();
    });
  });
}

// ==============================
// CONTROLS
// ==============================
function initControls() {
  document.querySelectorAll('.filter-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      S.filter=btn.dataset.filter;
      renderAll();
    });
  });
  document.getElementById('sortSelect')?.addEventListener('change',e=>{S.sort=e.target.value;renderAll();});
  document.getElementById('searchInput')?.addEventListener('input',e=>{S.search=e.target.value.trim();renderAll();});
  document.getElementById('clearDoneBtn')?.addEventListener('click',clearCompleted);
}

// ==============================
// TASK MODAL
// ==============================
function initTaskModal() {
  document.getElementById('fabBtn')?.addEventListener('click',openAddModal);
  document.getElementById('navFab')?.addEventListener('click',openAddModal);
  document.getElementById('taskModalClose')?.addEventListener('click',closeTaskModal);
  document.getElementById('taskModalCancel')?.addEventListener('click',closeTaskModal);
  document.getElementById('taskModal')?.addEventListener('click',e=>{if(e.target===document.getElementById('taskModal'))closeTaskModal();});
  document.getElementById('taskModalSave')?.addEventListener('click',saveTask);
  document.getElementById('tReminder')?.addEventListener('change',e=>{
    document.getElementById('reminderBeforeRow')?.classList.toggle('visible',e.target.checked);
  });
  document.querySelectorAll('.repeat-pill').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.repeat-pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); S.repeat=btn.dataset.r;
    });
  });
  document.getElementById('subtaskAddBtn')?.addEventListener('click',addSubtask);
  document.getElementById('subtaskInp')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addSubtask();}});
}
function openAddModal() {
  S.editId=null; S.subtasks=[]; S.repeat='none';
  document.getElementById('taskModalTitle').textContent='New Task';
  ['tTitle','tDesc','tDue','tTime','tTags'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('tSubject').value='General';
  document.getElementById('tPriority').value='normal';
  document.getElementById('tDuration').value='60';
  document.getElementById('tPomos').value='1';
  document.getElementById('tReminder').checked=false;
  document.getElementById('reminderBeforeRow')?.classList.remove('visible');
  document.querySelectorAll('.repeat-pill').forEach(b=>b.classList.toggle('active',b.dataset.r==='none'));
  renderSubtaskModal();
  document.getElementById('taskModal').classList.add('open');
  setTimeout(()=>document.getElementById('tTitle')?.focus(),350);
}
function openEditModal(id) {
  const t=S.tasks.find(t=>t.id===id);
  if(!t) return;
  S.editId=id; S.subtasks=JSON.parse(JSON.stringify(t.subtasks)); S.repeat=t.repeat||'none';
  document.getElementById('taskModalTitle').textContent='Edit Task';
  document.getElementById('tTitle').value=t.title;
  document.getElementById('tDesc').value=t.desc;
  document.getElementById('tSubject').value=t.subject;
  document.getElementById('tPriority').value=t.priority;
  document.getElementById('tDue').value=t.due;
  document.getElementById('tTime').value=t.dueTime;
  document.getElementById('tDuration').value=t.duration;
  document.getElementById('tPomos').value=t.pomos;
  document.getElementById('tTags').value=t.tags.join(', ');
  document.getElementById('tReminder').checked=t.reminder;
  document.getElementById('reminderBeforeRow')?.classList.toggle('visible',t.reminder);
  document.querySelectorAll('.repeat-pill').forEach(b=>b.classList.toggle('active',b.dataset.r===S.repeat));
  renderSubtaskModal();
  document.getElementById('taskModal').classList.add('open');
}
function closeTaskModal() { document.getElementById('taskModal').classList.remove('open'); }
function saveTask() {
  const title=document.getElementById('tTitle').value.trim();
  if(!title){toast('Please enter a task name','⚠️');return;}
  const data={
    title, desc:document.getElementById('tDesc').value.trim(),
    subject:document.getElementById('tSubject').value,
    priority:document.getElementById('tPriority').value,
    due:document.getElementById('tDue').value,
    dueTime:document.getElementById('tTime').value,
    duration:parseInt(document.getElementById('tDuration').value)||60,
    pomos:parseInt(document.getElementById('tPomos').value)||1,
    tags:document.getElementById('tTags').value.split(',').map(t=>t.trim()).filter(Boolean),
    reminder:document.getElementById('tReminder').checked,
    reminderBefore:parseInt(document.getElementById('tReminderBefore')?.value)||60,
    repeat:S.repeat, subtasks:S.subtasks,
  };
  if(S.editId){updateTask(S.editId,data);toast('Task updated 🌿','✏️');}
  else addTask(data);
  closeTaskModal();
}

// ==============================
// SUBTASKS
// ==============================
function addSubtask() {
  const inp=document.getElementById('subtaskInp');
  const v=inp.value.trim();
  if(!v) return;
  S.subtasks.push({id:uid(),text:v,done:false});
  inp.value=''; renderSubtaskModal();
}
function renderSubtaskModal() {
  const c=document.getElementById('subtaskList');
  if(!c) return;
  c.innerHTML='';
  S.subtasks.forEach((s,i)=>{
    const div=document.createElement('div');
    div.className='st-item';
    div.innerHTML=`<div class="st-check${s.done?' done':''}" data-i="${i}">${s.done?'<i class="fas fa-check"></i>':''}</div><span class="st-text${s.done?' done':''}">${esc(s.text)}</span><button class="st-rm" data-i="${i}"><i class="fas fa-times"></i></button>`;
    div.querySelector('.st-check').addEventListener('click',()=>{S.subtasks[i].done=!S.subtasks[i].done;renderSubtaskModal();});
    div.querySelector('.st-rm').addEventListener('click',()=>{S.subtasks.splice(i,1);renderSubtaskModal();});
    c.appendChild(div);
  });
}

// ==============================
// THEME
// ==============================
function initTheme() {
  applyTheme();
  document.getElementById('themeBtn')?.addEventListener('click',()=>{
    S.darkMode=!S.darkMode; applyTheme(); persist();
  });
}
function applyTheme() {
  document.body.classList.toggle('dark',S.darkMode);
  const icon=document.querySelector('#themeBtn i');
  if(icon) icon.className=S.darkMode?'fas fa-sun':'fas fa-moon';
}

// ==============================
// BLOOM FLOWER PROGRESS
// ==============================
function updateBloomFlower() {
  const total=S.tasks.length;
  const done=S.tasks.filter(t=>t.status==='completed').length;
  const pct=total?Math.round(done/total*100):0;
  const levels=[0,25,50,75,100];
  const level=levels.reduce((prev,cur)=>Math.abs(cur-pct)<Math.abs(prev-pct)?cur:prev);
  document.body.setAttribute('data-bloom',String(level));
  const label=document.getElementById('bloomPctLabel');
  if(label) label.textContent=pct+'%';
  if(pct===100&&total>0) {
    toast('🌸 All tasks complete! Your garden is in full bloom!','🌺');
  }
}

// ==============================
// NAVIGATION
// ==============================
function initNavigation() {
  function switchView(view) {
    S.currentView=view;
    // Show/hide view panels
    document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));
    const panel=document.getElementById('view'+view.charAt(0).toUpperCase()+view.slice(1));
    if(panel) panel.classList.add('active');
    // Update topbar nav
    document.querySelectorAll('.tnav-btn').forEach(b=>{
      b.classList.toggle('active',b.dataset.view===view);
    });
    // Update bottom nav
    document.querySelectorAll('.bnav-btn:not(.bnav-fab)').forEach(b=>{
      b.classList.toggle('active',b.dataset.view===view);
    });
    // Update sidebar nav
    document.querySelectorAll('.snav-btn').forEach(b=>{
      b.classList.toggle('active',b.dataset.snav===view);
    });
    // On mobile: for calendar/pomodoro/stats show sidebar or main view
    if(window.innerWidth<=700 && (view==='calendar'||view==='pomodoro'||view==='stats')) {
      if(view==='calendar') {
        // open sidebar
        document.getElementById('calendarPanel')?.classList.add('sidebar-open');
        document.getElementById('sidebarBackdrop')?.classList.add('visible');
        document.getElementById('mobileMenuBtn')?.classList.add('open');
      }
    }
    if(window.innerWidth<=700 && view==='tasks') {
      closeSidebar();
    }
  }

  // Topbar nav
  document.querySelectorAll('.tnav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>switchView(btn.dataset.view));
  });
  // Bottom nav
  document.querySelectorAll('.bnav-btn:not(.bnav-fab)').forEach(btn=>{
    btn.addEventListener('click',()=>switchView(btn.dataset.view));
  });
  // Sidebar nav
  document.querySelectorAll('.snav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      switchView(btn.dataset.snav);
      if(window.innerWidth<=700) closeSidebar();
    });
  });
}

// ==============================
// MOBILE HAMBURGER
// ==============================
function closeSidebar() {
  document.getElementById('calendarPanel')?.classList.remove('sidebar-open');
  document.getElementById('sidebarBackdrop')?.classList.remove('visible');
  document.getElementById('mobileMenuBtn')?.classList.remove('open');
  document.body.style.overflow='';
}
function initMobileMenu() {
  const btn=document.getElementById('mobileMenuBtn');
  const backdrop=document.getElementById('sidebarBackdrop');
  const sidebar=document.getElementById('calendarPanel');
  if(!btn||!backdrop||!sidebar) return;
  function openSidebar(){
    sidebar.classList.add('sidebar-open');
    backdrop.classList.add('visible');
    btn.classList.add('open');
    document.body.style.overflow='hidden';
  }
  btn.addEventListener('click',()=>btn.classList.contains('open')?closeSidebar():openSidebar());
  backdrop.addEventListener('click',closeSidebar);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar();});
}

// ==============================
// STREAK
// ==============================
function updateStreak() {
  const today=todayStr();
  const last=localStorage.getItem('bloom_last');
  const yest=new Date(Date.now()-86400000).toISOString().split('T')[0];
  if(!last){S.streak=1;}
  else if(last===yest){S.streak++;}
  else if(last!==today){S.streak=1;}
  localStorage.setItem('bloom_last',today);
  persist();
}

// ==============================
// KEYBOARD
// ==============================
function initKeyboard() {
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape') document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
    if((e.ctrlKey||e.metaKey)&&e.key==='n'){e.preventDefault();openAddModal();}
    if((e.ctrlKey||e.metaKey)&&e.key==='f'){e.preventDefault();document.getElementById('searchInput')?.focus();}
  });
}

// ==============================
// INIT
// ==============================
function init() {
  restore();
  // No seedDemo — start clean
  updateStreak();
  initCanvas();
  initPetals();
  initCursor();
  initMobileMenu();
  initNavigation();
  initGreeting();
  initQuotes();
  initCalendar();
  initEventModal();
  initReminderModal();
  initPomodoro();
  initControls();
  initTaskModal();
  initDragDrop();
  initTheme();
  initKeyboard();
  renderAll();
  renderReminders();
  renderDayPanel();
  S.selectedDate=new Date();
  renderCalendar();
  renderDayPanel();
  updateBloomFlower();
  setInterval(checkReminders,30000);
  checkReminders();
  setInterval(initGreeting,60000);
  console.log('%c🌸 Bloom — Study Planner Loaded','font-size:14px;color:#f472b6;font-family:serif;padding:6px;');
}

document.addEventListener('DOMContentLoaded', init);
