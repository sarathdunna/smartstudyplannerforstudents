// Smart Study Planner

// === Utilities ===
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const LS_KEY = 'ssp_tasks_v1';

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function formatDate(d) {
  return new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// === Storage ===
function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}
function saveTasks(tasks) {
  localStorage.setItem(LS_KEY, JSON.stringify(tasks));
}

// === Elements ===
const taskForm = $('#taskForm');
const titleInput = $('#taskTitle');
const dueInput = $('#taskDue');
const priorityInput = $('#taskPriority');
const notesInput = $('#taskNotes');

const taskListEl = $('#taskList');
const totalTasksEl = $('#totalTasks');
const completedTasksEl = $('#completedTasks');
const pendingTasksEl = $('#pendingTasks');
const highPriorityTasksEl = $('#highPriorityTasks');

const timelineGrid = $('#timelineGrid');
const chartCanvas = $('#tasksPerDayChart');

const tabButtons = $$('.tab-btn');
const tasks = loadTasks();

// === Helpers ===
const generateId = () => (crypto?.randomUUID ? crypto.randomUUID() : 't' + Date.now());
const capitalize = s => s ? s[0].toUpperCase() + s.slice(1) : '';
const escapeHtml = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// === KPIs ===
function computeKPIs(list) {
  return {
    total: list.length,
    completed: list.filter(t => t.done).length,
    pending: list.filter(t => !t.done).length,
    highPr: list.filter(t => t.priority === 'high').length
  };
}
function renderKPIs() {
  const k = computeKPIs(tasks);
  totalTasksEl.textContent = k.total;
  completedTasksEl.textContent = k.completed;
  pendingTasksEl.textContent = k.pending;
  highPriorityTasksEl.textContent = k.highPr;
}

// === Task list ===
function renderTasks() {
  tasks.sort((a,b) => new Date(a.due) - new Date(b.due));
  taskListEl.innerHTML = tasks.length ? tasks.map(t => {
    const overdue = !t.done && new Date(t.due) < Date.now();
    return `
      <div class="task" data-id="${t.id}" ${t.done ? 'style="opacity:.6"' : ''}>
        <div>
          <div class="task-top">
            <div class="task-title">${escapeHtml(t.title)}</div>
            <span class="pill ${t.priority}">${capitalize(t.priority)}</span>
            ${overdue ? '<span class="pill high">Overdue</span>' : ''}
          </div>
          <div class="muted" style="margin:6px 0 4px">Due: ${formatDate(t.due)}</div>
        </div>
        <div class="task-actions">
          ${!t.done ? `<button class="btn success" data-action="complete">Complete</button>` : ''}
          <button class="btn" data-action="edit">Edit</button>
          <button class="btn danger" data-action="delete">Delete</button>
        </div>
      </div>`;
  }).join('') : `<div class="muted">No tasks found.</div>`;
  renderKPIs();
  renderTimeline();
  drawTasksPerDayChart();
}

// === Timeline ===
function renderTimeline() {
  const start = new Date(); start.setHours(0,0,0,0);
  const days = Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
  const headerCols = '<div class="col-h"></div>' + days.map(d=>`<div class="col-h">${d.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})}</div>`).join('');
  const rows = ['high','medium','low'].map(pr=>{
    const rowHeader = `<div class="row-h">${capitalize(pr)}</div>`;
    const cells = days.map(day=>{
      const dayTasks = tasks.filter(t=>t.priority===pr && new Date(t.due).toDateString()===day.toDateString());
      const chips = dayTasks.map(t=>`<div class="chip" style="opacity:${t.done?'.5':'1'}">${escapeHtml(t.title)}</div>`).join('');
      return `<div class="cell">${chips}</div>`;
    }).join('');
    return rowHeader+cells;
  }).join('');
  timelineGrid.innerHTML = headerCols+rows;
}

// === Chart ===
function getLast7Dates() {
  const now = new Date(); now.setHours(0,0,0,0);
  return Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(now.getDate()-6+i);return d;});
}
function drawTasksPerDayChart() {
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  const w = chartCanvas.width = chartCanvas.clientWidth * (window.devicePixelRatio || 1);
  const h = chartCanvas.height = 160 * (window.devicePixelRatio || 1);
  ctx.clearRect(0,0,w,h);

  const dates = getLast7Dates();
  const counts = dates.map(d=>tasks.filter(t=>new Date(t.due).toDateString()===d.toDateString()).length);
  const maxCount = Math.max(1,...counts);
  const padding = 24*(window.devicePixelRatio||1);
  const chartW = w - padding*2;
  const chartH = h - padding*2;
  const barWidth = chartW/dates.length*0.6;
  const gap = (chartW/dates.length)-barWidth;

  ctx.font = `${12*(window.devicePixelRatio||1)}px sans-serif`;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted');
  ctx.textAlign='center';
  dates.forEach((d,i)=>{
    const x = padding + i*(barWidth+gap)+(barWidth+gap)/2;
    ctx.fillText(d.toLocaleDateString([], {weekday:'short'}).slice(0,3), x, h-padding/2);
  });

  for (let i=0;i<counts.length;i++){
    const count = counts[i];
    const x = padding + i*(barWidth+gap);
    const barH = (count/maxCount)*(chartH-20);
    const y = padding+(chartH-barH);
    const grad = ctx.createLinearGradient(x,y,x+barWidth,y+barH);
    grad.addColorStop(0,getComputedStyle(document.documentElement).getPropertyValue('--accent-2'));
    grad.addColorStop(1,getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    ctx.fillStyle=grad;
    roundRect(ctx,x,y,barWidth,barH,6*(window.devicePixelRatio||1),true,false);
    ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text');
    ctx.font=`${11*(window.devicePixelRatio||1)}px sans-serif`;
    ctx.fillText(String(count), x+barWidth/2, y-6*(window.devicePixelRatio||1));
  }
}
function roundRect(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// === Form ===
function resetForm() {
  titleInput.value=''; dueInput.value=todayISO(); priorityInput.value='medium'; notesInput.value='';
  $('#editingId').value='';
}
function startEdit(id){
  const t=tasks.find(x=>x.id===id); if(!t)return;
  titleInput.value=t.title||'';
  const d=new Date(t.due); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); dueInput.value=d.toISOString().slice(0,16);
  priorityInput.value=t.priority||'medium';
  notesInput.value=t.notes||'';
  $('#editingId').value=t.id;
  window.scrollTo({top:0,behavior:'smooth'});
}
function upsertTaskFromForm(e){
  e.preventDefault();
  const title=titleInput.value.trim(), dueVal=dueInput.value, priority=priorityInput.value, notes=notesInput.value.trim();
  if(!title||!dueVal){alert('Please fill all required fields');return;}
  let id=$('#editingId').value||generateId();
  const idx=tasks.findIndex(t=>t.id===id);
  const task={id,title,due:new Date(dueVal).toISOString(),priority,notes,done:idx>=0?tasks[idx].done:false,createdAt:idx>=0?tasks[idx].createdAt:new Date().toISOString()};
  if(idx>=0)tasks[idx]=task;else tasks.push(task);
  saveTasks(tasks);resetForm();renderTasks();
}

// === Actions ===
function onTaskListClick(e){
  const btn=e.target.closest('button'); if(!btn)return;
  const action=btn.dataset.action; const id=btn.closest('.task').dataset.id;
  const idx=tasks.findIndex(t=>t.id===id); if(idx<0)return;
  if(action==='complete'){tasks[idx].done=true;saveTasks(tasks);renderTasks();}
  if(action==='edit'){startEdit(id);}
  if(action==='delete'){if(confirm('Delete this task?')){tasks.splice(idx,1);saveTasks(tasks);renderTasks();}}
}

// === Tabs ===
function setTab(tabKey){
  tabButtons.forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tabKey?'true':'false'));
  document.querySelectorAll('.card.view').forEach(el=>{
    el.hidden=el.dataset.view!==tabKey;
  });
  if(tabKey==='stats')drawTasksPerDayChart();
  if(tabKey==='timeline')renderTimeline();
}
tabButtons.forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
setTab('tasks');

// === Stopwatch ===
let stopwatchInterval=null, stopwatchSeconds=0;
const display=$('#stopwatchDisplay');
const startBtn=$('#startStopwatch'), pauseBtn=$('#pauseStopwatch'), resetBtn=$('#resetStopwatch');
function formatTime(sec){const h=String(Math.floor(sec/3600)).padStart(2,'0'),m=String(Math.floor((sec%3600)/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');return`${h}:${m}:${s}`;}
function updateStopwatchDisplay(){display.textContent=formatTime(stopwatchSeconds);}
startBtn.addEventListener('click',()=>{if(stopwatchInterval)return;stopwatchInterval=setInterval(()=>{stopwatchSeconds++;updateStopwatchDisplay();},1000);});
pauseBtn.addEventListener('click',()=>{clearInterval(stopwatchInterval);stopwatchInterval=null;});
resetBtn.addEventListener('click',()=>{clearInterval(stopwatchInterval);stopwatchInterval=null;stopwatchSeconds=0;updateStopwatchDisplay();});
updateStopwatchDisplay();

// === Init ===
(function init(){
  dueInput.value=todayISO();
  renderTasks();
  taskForm.addEventListener('submit',upsertTaskFromForm);
  taskListEl.addEventListener('click',onTaskListClick);
  window.addEventListener('resize',drawTasksPerDayChart);
  const tipsEl=$('#tips');
  if(tipsEl){
    const tips=[
      "Use the Pomodoro technique: 25 min study, 5 min break.",
      "Review notes within 24 hours to boost retention.",
      "Attack hardest tasks first when you're fresh.",
      "Break big topics into smaller tasks."
    ];
    tipsEl.innerHTML=`<strong>💡 Tip:</strong> ${tips[Math.floor(Math.random()*tips.length)]}`;
  }
})();
