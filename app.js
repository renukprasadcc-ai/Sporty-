/* ---------------------------------------------------------------------
   Sporty — main application: DOM wiring, pose engine, exercise tracking,
   3D posture viewer, guided flows, voice, readiness, and the LLM coach.
   Imports static config (exercises/flows/constants) from config.js.
--------------------------------------------------------------------- */
import {
  PoseLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
import {
  L, angleAt, avgAngle, singleAngle,
  EXERCISES, FLOW_HINTS, FLOWS, CONNECTIONS,
  BODY_SEGMENTS_3D, DEMO_WORLD_POSE
} from './config.js';

/* ---------------------------------------------------------------------
   DOM
--------------------------------------------------------------------- */
const welcomeTag = document.getElementById('welcomeTag');
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const emptyState = document.getElementById('emptyState');
const startBtn = document.getElementById('startBtn');
const toggleBtn = document.getElementById('toggleBtn');
const finishSetBtn = document.getElementById('finishSetBtn');
const resetBtn = document.getElementById('resetBtn');
const exerciseGrid = document.getElementById('exerciseGrid');
const repCountEl = document.getElementById('repCount');
const repLabelEl = document.getElementById('repLabel');
const formMsgEl = document.getElementById('formMsg');
const setLogEl = document.getElementById('setLog');
const coachLog = document.getElementById('coachLog');
const coachInput = document.getElementById('coachInput');
const coachSend = document.getElementById('coachSend');

const liveFps = document.getElementById('liveFps');
const liveLandmarks = document.getElementById('liveLandmarks');
const liveVisible = document.getElementById('liveVisible');
const liveAngle = document.getElementById('liveAngle');
const livePhase = document.getElementById('livePhase');

const modeToggle = document.getElementById('modeToggle');
const onlinePanel = document.getElementById('onlinePanel');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleKeyVis = document.getElementById('toggleKeyVis');
const modelSelect = document.getElementById('modelSelect');
const testConnBtn = document.getElementById('testConnBtn');
const connStatus = document.getElementById('connStatus');
const pipelineLLM = document.getElementById('pipelineLLM');
const connDot = document.getElementById('connDot');

const sourceToggle = document.getElementById('sourceToggle');
const uploadBtn = document.getElementById('uploadBtn');
const videoFileInput = document.getElementById('videoFileInput');
const emptyStateText = document.getElementById('emptyStateText');
const scoreLbl = document.getElementById('scoreLbl');

const sleepInput = document.getElementById('sleepInput');
const sorenessInput = document.getElementById('sorenessInput');
const hrInput = document.getElementById('hrInput');
const readinessScoreEl = document.getElementById('readinessScore');
const readinessTextEl = document.getElementById('readinessText');

const liveConfidence = document.getElementById('liveConfidence');
const livePosture = document.getElementById('livePosture');
const liveVelocity = document.getElementById('liveVelocity');
const liveSymmetry = document.getElementById('liveSymmetry');
const liveROM = document.getElementById('liveROM');
const holdTargetRow = document.getElementById('holdTargetRow');
const holdTargetInput = document.getElementById('holdTargetInput');
const historyStats = document.getElementById('historyStats');
const canvas3d = document.getElementById('canvas3d');
const ctx3d = canvas3d.getContext('2d');
const calibrateBtn = document.getElementById('calibrateBtn');
const postureBadge = document.getElementById('postureBadge');
const ageInput = document.getElementById('ageInput');
const heightInput = document.getElementById('heightInput');
const hrZoneNote = document.getElementById('hrZoneNote');
const weightInput = document.getElementById('weightInput');
const goodBadLbl = document.getElementById('goodBadLbl');
const liveDuration = document.getElementById('liveDuration');
const liveCalories = document.getElementById('liveCalories');
const streakBadge = document.getElementById('streakBadge');
const pbBadge = document.getElementById('pbBadge');
const historyScope = document.getElementById('historyScope');

const skeletonToggles = document.getElementById('skeletonToggles');
const skeletonShowAll = document.getElementById('skeletonShowAll');
const skeletonHideAll = document.getElementById('skeletonHideAll');

const sectionToggle = document.getElementById('sectionToggle');
const exerciseSection = document.getElementById('exerciseSection');
const yogaSection = document.getElementById('yogaSection');
const yogaPoseGrid = document.getElementById('yogaPoseGrid');
const repsControlsRow = document.getElementById('repsControlsRow');
const flowPicker = document.getElementById('flowPicker');
const flowPlayer = document.getElementById('flowPlayer');
const flowStartRow = document.getElementById('flowStartRow');
const flowStartBtn = document.getElementById('flowStartBtn');
const flowDots = document.getElementById('flowDots');
const flowStepName = document.getElementById('flowStepName');
const flowStepText = document.getElementById('flowStepText');
const flowTimerEl = document.getElementById('flowTimer');
const flowHint = document.getElementById('flowHint');
const flowPrevBtn = document.getElementById('flowPrevBtn');
const flowNextBtn = document.getElementById('flowNextBtn');
const flowPauseBtn = document.getElementById('flowPauseBtn');
const flowEndBtn = document.getElementById('flowEndBtn');
const weekStats = document.getElementById('weekStats');
const monthStats = document.getElementById('monthStats');
const progressChart = document.getElementById('progressChart');
const pcx = progressChart.getContext('2d');
const progressNote = document.getElementById('progressNote');
const progressScope = document.getElementById('progressScope');

/* ---------------------------------------------------------------------
   Exercise definitions — the "geometry + exercise recognition" layer.
   Each exercise names the three landmarks whose angle we track, plus
   the thresholds that define the two ends of a rep.
--------------------------------------------------------------------- */




let currentFlow = null, flowIndex = 0, flowRemaining = 0, flowTimerId = null, flowPausedState = false;



/* ---------------------------------------------------------------------
   State
--------------------------------------------------------------------- */
let poseLandmarker = null;
let running = false;
let currentExercise = 'squat';
let phase = 'high'; // 'high' or 'low' relative to thresholds
let reps = 0;
let angleWindow = [];
let holdStart = null;
let holdSeconds = 0;
let sessionSets = [];
let lastFormOK = true;
let lastFrameTime = performance.now();
let fpsSmoothed = 0;

let sourceMode = 'live';   // 'live' | 'upload'
let trackMode = 'reps';    // 'reps' | 'flow'
let voiceEnabled = false;
let lastSpokenForm = null;
let holdWasBroken = false;
let setGoodFrames = 0;
let setTotalFrames = 0;
let currentFormScore = 100;
let readiness = { score:70, label:'moderate' };

// What gets drawn on screen (2D overlay + 3D viewer) — tracking always
// runs on all 33 landmarks regardless of these toggles; this is purely
// a display preference the user controls from the "Skeleton display" panel.
let skeletonVisibility = { face:false, torso:true, arms:true, hands:false, legs:true, feet:true };

function landmarkGroupOf(i){
  if(i<=10) return 'face';
  if(i===11||i===12||i===23||i===24) return 'torso';
  if(i===13||i===14||i===15||i===16) return 'arms';
  if(i>=17 && i<=22) return 'hands';
  if(i===25||i===26||i===27||i===28) return 'legs';
  if(i>=29 && i<=32) return 'feet';
  return 'other';
}
function isGroupVisible(i){
  const g = landmarkGroupOf(i);
  return skeletonVisibility[g] !== false;
}

/* ---------------------------------------------------------------------
   Duration, calories, good/bad reps, real-time corrective skeleton
--------------------------------------------------------------------- */
let sessionStartTime = null;   // set once, first time tracking begins
let setStartTime = null;       // reset per set
let goodRepsCount = 0, badRepsCount = 0;
let sessionCalories = 0;
let currentFaultyJoints = new Set(); // landmark indices implicated in the current form issue, for green/red skeleton

const MET_TABLE = { squat:5, pushup:8, curl:3, plank:3, lunge:4, overhead:4, surya:3 };
function caloriesForDuration(metKey, durationSec, weightKg){
  const met = MET_TABLE[metKey] || 4;
  return (met * 3.5 * weightKg / 200) * (durationSec / 60);
}
function formatDuration(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec/60), s = sec%60;
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

/* ---------------------------------------------------------------------
   Persistence — personal bests + workout streak. Uses the artifact
   storage API (window.storage) when available, which persists across
   sessions without ever touching localStorage/sessionStorage. Falls
   back to in-memory-only (this tab, this load) if that API isn't
   present — e.g. the file opened directly outside claude.ai.
--------------------------------------------------------------------- */
const hasPersistentStorage = (typeof window !== 'undefined' && !!window.storage);
let personalBestCache = {};

async function loadPersonalBest(exerciseKey){
  if(!hasPersistentStorage) return personalBestCache[exerciseKey] || null;
  try{
    const res = await window.storage.get('pb:' + exerciseKey, false);
    return res ? JSON.parse(res.value) : null;
  }catch(e){ return null; }
}
async function savePersonalBest(exerciseKey, best){
  personalBestCache[exerciseKey] = best;
  if(!hasPersistentStorage) return;
  try{ await window.storage.set('pb:' + exerciseKey, JSON.stringify(best), false); }catch(e){}
}

async function loadStreak(){
  if(!hasPersistentStorage) return { count:0, lastDate:null };
  try{
    const res = await window.storage.get('streak', false);
    return res ? JSON.parse(res.value) : { count:0, lastDate:null };
  }catch(e){ return { count:0, lastDate:null }; }
}
async function saveStreak(streak){
  if(!hasPersistentStorage) return;
  try{ await window.storage.set('streak', JSON.stringify(streak), false); }catch(e){}
}

function todayStr(){ return new Date().toISOString().slice(0,10); }
function yesterdayStr(){
  const d = new Date(); d.setDate(d.getDate()-1);
  return d.toISOString().slice(0,10);
}

let streakUpdatedThisLoad = false;
async function bumpStreakOnce(){
  if(streakUpdatedThisLoad) return;
  streakUpdatedThisLoad = true;
  let streak = await loadStreak();
  const today = todayStr();
  if(streak.lastDate === today){
    // already logged today, no change
  } else if(streak.lastDate === yesterdayStr()){
    streak.count = (streak.count||0) + 1;
    streak.lastDate = today;
  } else {
    streak.count = 1;
    streak.lastDate = today;
  }
  await saveStreak(streak);
  renderStreakBadge(streak);
}

function renderStreakBadge(streak){
  streakBadge.textContent = `🔥 ${streak.count||0} day${streak.count===1?'':'s'} streak`;
  streakBadge.classList.toggle('lit', (streak.count||0) > 0);
}

async function checkPersonalBest(exerciseKey, label, value, unit){
  const prev = await loadPersonalBest(exerciseKey);
  const isNew = !prev || value > prev.value;
  if(isNew){
    await savePersonalBest(exerciseKey, { value, unit, date:new Date().toISOString() });
    pbBadge.textContent = `New PB — ${label}: ${value} ${unit} 🎉`;
    pbBadge.classList.add('new');
    speak('New personal best!');
  } else {
    pbBadge.textContent = `Personal best — ${label}: ${prev.value} ${prev.unit}`;
    pbBadge.classList.remove('new');
  }
  return isNew;
}
async function showPersonalBestFor(exerciseKey, label, unit){
  const prev = await loadPersonalBest(exerciseKey);
  pbBadge.classList.remove('new');
  pbBadge.textContent = prev ? `Personal best — ${label}: ${prev.value} ${unit}` : `Personal best — ${label}: none yet`;
}

if(!hasPersistentStorage){
  historyScope.textContent = 'this browser session only';
  streakBadge.title = 'Streak needs persistent storage (available when viewed as a Claude artifact) — resets each visit here.';
  progressScope.textContent = 'needs persistent storage — not available this session';
} else {
  historyScope.textContent = 'sets: this session · streak & PBs: saved';
  progressScope.textContent = 'week & month totals — saved';
}
loadStreak().then(renderStreakBadge);
showPersonalBestFor('squat', 'Squat', 'reps');

/* ---------------------------------------------------------------------
   Day / week / month data lifecycle:
   - Per-day detail (every finished set, keyed by date) is written so a
     "today" view is possible, then deleted automatically once a new day
     is detected — nothing daily-granular sticks around past its day.
   - Week/month totals are running aggregates that persist indefinitely,
     independent of the daily detail being cleared.
--------------------------------------------------------------------- */
function isoWeekKey(d){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function monthKeyOf(d){ return d.toISOString().slice(0, 7); }

async function cleanupOldDayData(){
  if(!hasPersistentStorage) return;
  try{
    const listResult = await window.storage.list('day:', false);
    const today = todayStr();
    if(listResult && listResult.keys){
      for(const key of listResult.keys){
        const dateStr = key.slice(4); // strip 'day:' prefix
        if(dateStr !== today){
          try{ await window.storage.delete(key, false); }catch(e){}
        }
      }
    }
  }catch(e){ /* listing failed — nothing to clean up */ }
}

async function bumpAggregate(key, entry){
  let agg;
  try{
    const res = await window.storage.get(key, false);
    agg = res ? JSON.parse(res.value) : null;
  }catch(e){ agg = null; }
  if(!agg) agg = { sets:0, reps:0, calories:0, durationSec:0, formSum:0, formCount:0 };
  agg.sets += 1;
  if(entry.unit === 'reps') agg.reps += entry.value;
  if(entry.calories) agg.calories += entry.calories;
  if(entry.durationSec) agg.durationSec += entry.durationSec;
  if(typeof entry.formScore === 'number'){ agg.formSum += entry.formScore; agg.formCount += 1; }
  try{ await window.storage.set(key, JSON.stringify(agg), false); }catch(e){}
  return agg;
}

async function recordProgress(entry){
  if(!hasPersistentStorage) return;
  try{
    const today = todayStr();
    const dayKey = 'day:' + today;
    let dayArr = [];
    try{
      const res = await window.storage.get(dayKey, false);
      dayArr = res ? JSON.parse(res.value) : [];
    }catch(e){ dayArr = []; }
    dayArr.push(entry);
    await window.storage.set(dayKey, JSON.stringify(dayArr), false);

    const now = new Date();
    await bumpAggregate('week:' + isoWeekKey(now), entry);
    await bumpAggregate('month:' + monthKeyOf(now), entry);
    renderProgressPanel();
  }catch(e){ /* storage unavailable mid-session — non-fatal */ }
}

function summarizeAgg(agg){
  if(!agg || !agg.sets) return '—';
  const avgForm = agg.formCount ? Math.round(agg.formSum / agg.formCount) : null;
  const parts = [`<b>${agg.sets}</b> sets`];
  if(agg.reps) parts.push(`<b>${agg.reps}</b> reps`);
  if(agg.calories) parts.push(`<b>${Math.round(agg.calories)}</b> kcal`);
  if(agg.durationSec) parts.push(`<b>${formatDuration(agg.durationSec)}</b> active`);
  if(avgForm!=null) parts.push(`avg form <b>${avgForm}</b>`);
  return parts.join(' · ');
}

async function renderProgressPanel(){
  if(!hasPersistentStorage){
    weekStats.textContent = 'Not available this session';
    monthStats.textContent = 'Not available this session';
    drawProgressChart(null, null);
    return;
  }
  try{
    const now = new Date();
    const wRes = await window.storage.get('week:' + isoWeekKey(now), false).catch(()=>null);
    const mRes = await window.storage.get('month:' + monthKeyOf(now), false).catch(()=>null);
    const wAgg = wRes ? JSON.parse(wRes.value) : null;
    const mAgg = mRes ? JSON.parse(mRes.value) : null;
    weekStats.innerHTML = summarizeAgg(wAgg);
    monthStats.innerHTML = summarizeAgg(mAgg);
    lastChartAgg = { w: wAgg, m: mAgg };
    drawProgressChart(wAgg, mAgg);
  }catch(e){
    weekStats.textContent = '—';
    monthStats.textContent = '—';
    drawProgressChart(null, null);
  }
}

/* Small dependency-free bar chart: sets / reps / calories, week vs month. */
function drawProgressChart(wAgg, mAgg){
  const w = progressChart.width, h = progressChart.height;
  pcx.clearRect(0, 0, w, h);
  const metrics = [
    ['sets', 'Sets'],
    ['reps', 'Reps'],
    ['calories', 'kcal'],
  ];
  const wVals = metrics.map(([k]) => (wAgg && wAgg[k]) || 0);
  const mVals = metrics.map(([k]) => (mAgg && mAgg[k]) || 0);
  const maxVal = Math.max(1, ...wVals, ...mVals);

  const chartTop = 10, chartBottom = h - 22, chartH = chartBottom - chartTop;
  const groupW = w / metrics.length, barW = groupW * 0.28, gap = groupW * 0.06;

  metrics.forEach((m, i) => {
    const groupX = i * groupW;
    const wH = (wVals[i] / maxVal) * chartH, mH = (mVals[i] / maxVal) * chartH;
    const wX = groupX + groupW/2 - barW - gap/2, mX = groupX + groupW/2 + gap/2;

    pcx.fillStyle = '#F2A93B';
    pcx.fillRect(wX, chartBottom - wH, barW, wH);
    pcx.fillStyle = '#57BFB6';
    pcx.fillRect(mX, chartBottom - mH, barW, mH);

    pcx.fillStyle = '#9C927D';
    pcx.font = '10px Inter, sans-serif';
    pcx.textAlign = 'center';
    pcx.fillText(m[1], groupX + groupW/2, h - 8);
  });

  // legend
  pcx.fillStyle = '#F2A93B'; pcx.fillRect(w - 140, 4, 10, 10);
  pcx.fillStyle = '#EFE8D8'; pcx.textAlign = 'left'; pcx.font = '10px Inter, sans-serif';
  pcx.fillText('Week', w - 126, 13);
  pcx.fillStyle = '#57BFB6'; pcx.fillRect(w - 78, 4, 10, 10);
  pcx.fillStyle = '#EFE8D8';
  pcx.fillText('Month', w - 64, 13);
}

let lastChartAgg = { w: null, m: null };
function resizeProgressChart(){
  const rect = progressChart.getBoundingClientRect();
  if(rect.width > 0){
    progressChart.width = rect.width;
    progressChart.height = 130;
    drawProgressChart(lastChartAgg.w, lastChartAgg.m);
  }
}
window.addEventListener('resize', resizeProgressChart);
resizeProgressChart();

cleanupOldDayData();
renderProgressPanel();


let rot3dY = 0.4, rot3dX = -0.15;
let dragging3d = false, dragLastX = 0, dragLastY = 0;
let latestWorldLm = null;

let calibrationBaseline = null; // { leanAngle }
let velocityTrack = { point:null, time:null, mps:0, smoothed:0 };
let setVelocitySamples = [];
let latestNormLm = null;
let symmetrySamples = [];
let romMin = Infinity, romMax = -Infinity;
let holdTargetReached = false;
const VELOCITY_JOINT = { squat:'L_HIP', pushup:'L_SHOULDER', curl:'L_WRIST', plank:'L_HIP', lunge:'L_HIP', overhead:'L_WRIST' };

/* --- LLM connection state (in-memory only, never persisted) --- */
let connMode = 'offline'; // 'offline' | 'online'
let orApiKey = '';
let orModel = '';

const FALLBACK_MODELS = [
  { id:'openai/gpt-4o-mini', name:'OpenAI · GPT-4o mini' },
  { id:'anthropic/claude-3.5-sonnet', name:'Anthropic · Claude 3.5 Sonnet' },
  { id:'google/gemini-flash-1.5', name:'Google · Gemini 1.5 Flash' },
  { id:'meta-llama/llama-3.1-8b-instruct:free', name:'Meta · Llama 3.1 8B (free)' },
  { id:'mistralai/mistral-7b-instruct:free', name:'Mistral · 7B Instruct (free)' }
];

async function loadModelList(){
  modelSelect.innerHTML = '<option>Loading models…</option>';
  let models = FALLBACK_MODELS;
  try{
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if(res.ok){
      const data = await res.json();
      if(Array.isArray(data.data) && data.data.length){
        models = data.data
          .map(m=>({ id:m.id, name:m.name || m.id }))
          .sort((a,b)=>a.name.localeCompare(b.name));
      }
    }
  }catch(e){ /* offline sandbox / no network — use fallback list */ }
  modelSelect.innerHTML = models.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  const preferred = models.find(m=>m.id==='openai/gpt-4o-mini') || models[0];
  if(preferred){ modelSelect.value = preferred.id; orModel = preferred.id; }
}

/* ---------------------------------------------------------------------
   Camera + model bootstrap
--------------------------------------------------------------------- */
async function initModel(){
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  const modelPath = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
  try{
    poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
      baseOptions:{ modelAssetPath:modelPath, delegate:"GPU" },
      runningMode:"VIDEO",
      numPoses:1
    });
  }catch(e){
    // GPU delegate can fail to initialize (or silently drop worldLandmarks)
    // on some browsers/GPUs — CPU is slower but far more reliable.
    poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
      baseOptions:{ modelAssetPath:modelPath, delegate:"CPU" },
      runningMode:"VIDEO",
      numPoses:1
    });
  }
}

/* ---------------------------------------------------------------------
   Voice feedback (Web Speech API) — spoken rep counts + form cues
--------------------------------------------------------------------- */
function speak(text){
  if(!voiceEnabled || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.pitch = 1.0;
  speechSynthesis.speak(u);
}

/* ---------------------------------------------------------------------
   Readiness — manual stand-in for a wearable/biometric feed. Produces
   a 0-100 score and a suggested rep target, and is fed to the coach
   prompts so LLM answers take today's state into account.
--------------------------------------------------------------------- */
function computeReadiness(){
  const sleep = parseFloat(sleepInput.value) || 0;
  const soreness = sorenessInput.value;
  const hr = parseFloat(hrInput.value);

  let score = 70;
  score += (sleep - 7) * 6;
  score += soreness === 'high' ? -25 : soreness === 'medium' ? -10 : 8;
  if(!isNaN(hr) && hr > 0) score -= Math.max(0, hr - 65) * 0.6;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let label, text;
  if(score >= 75){
    label = 'high';
    text = "You're well recovered — push intensity today. Aim for 12–15 reps per set, or add an extra set.";
  } else if(score >= 50){
    label = 'moderate';
    text = 'Moderate recovery — train normally. Aim for 8–12 reps per set and stop a rep early if form slips.';
  } else {
    label = 'low';
    text = 'Recovery is low — go lighter today. Aim for 5–8 reps, prioritize clean form over volume, and consider extra rest.';
  }
  readiness = { score, label, text };
  readinessScoreEl.textContent = score;
  readinessScoreEl.className = 'readiness-score ' + (label==='high' ? 'high' : label==='low' ? 'low' : '');
  readinessTextEl.textContent = text;
}
[sleepInput, sorenessInput, hrInput].forEach(el=> el.addEventListener('change', computeReadiness));
computeReadiness();

/* ---------------------------------------------------------------------
   Body profile — age/height feed an estimated HR zone and give the
   coach demographic context. General formula, not medical guidance.
--------------------------------------------------------------------- */
function updateBodyProfile(){
  const age = parseInt(ageInput.value) || 30;
  const maxHR = 220 - age;
  const zoneLow = Math.round(maxHR*0.50);
  const zoneHigh = Math.round(maxHR*0.85);
  hrZoneNote.textContent = `Est. max heart rate ≈ ${maxHR} bpm. Moderate-intensity training zone ≈ ${zoneLow}–${zoneHigh} bpm (50–85%, general formula — not medical guidance).`;
}
[ageInput, heightInput].forEach(el=> el.addEventListener('change', updateBodyProfile));
updateBodyProfile();


/* ---------------------------------------------------------------------
   Source mode — Live camera vs. Upload video. Both feed the same
   <video> element and the same detection loop below.
--------------------------------------------------------------------- */
let loopStarted = false;

sourceToggle.addEventListener('click', (e)=>{
  const btn = e.target.closest('.mode-btn');
  if(!btn) return;
  [...sourceToggle.querySelectorAll('.mode-btn')].forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  sourceMode = btn.dataset.src;
  running = false;
  emptyState.style.display = 'flex';
  if(sourceMode === 'live'){
    startBtn.style.display = 'inline-block';
    uploadBtn.style.display = 'none';
    emptyStateText.textContent = 'Sporty needs camera access to detect your joints and count reps. Nothing is recorded or sent anywhere — pose tracking runs locally in your browser.';
  } else {
    startBtn.style.display = 'none';
    uploadBtn.style.display = 'inline-block';
    emptyStateText.textContent = 'Upload a clip of a set (squat, push-up, curl, or plank) and Sporty will run the same pose tracking and rep counting over the recording.';
  }
});

videoFileInput.addEventListener('change', ()=>{
  const file = videoFileInput.files[0];
  if(!file) return;
  startFromFile(file);
});

async function startFromFile(file){
  uploadBtn.textContent = 'Loading…';
  try{
    if(video.srcObject){ video.srcObject.getTracks().forEach(t=>t.stop()); video.srcObject = null; }
    video.src = URL.createObjectURL(file);
    video.loop = true;
    video.muted = true;
    await video.play();
    if(!poseLandmarker) await initModel();
    beginProcessing();
  }catch(err){
    emptyStateText.textContent = 'Could not play that video file (' + (err.message || err.name) + '). Try an MP4 recorded on your phone.';
  } finally {
    uploadBtn.textContent = 'Choose video file';
  }
}

async function startCamera(){
  startBtn.disabled = true;
  startBtn.textContent = 'Starting…';
  try{
    if(video.src){ video.removeAttribute('src'); video.load(); }
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:640, height:480 }, audio:false });
    video.srcObject = stream;
    video.loop = false;
    await video.play();
    if(!poseLandmarker) await initModel();
    beginProcessing();
  }catch(err){
    startBtn.disabled = false;
    startBtn.textContent = 'Start camera';
    emptyStateText.textContent =
      'Camera access failed (' + (err.message || err.name) + '). Check your browser/site camera permission and try again.';
  }
}

function beginProcessing(){
  emptyState.style.display = 'none';
  running = true;
  toggleBtn.disabled = false;
  finishSetBtn.disabled = false;
  resetBtn.disabled = false;
  toggleBtn.textContent = 'Pause tracking';
  resizeCanvas();
  resizeCanvas3D();
  if(!sessionStartTime) sessionStartTime = performance.now();
  if(!setStartTime) setStartTime = performance.now();
  if(!loopStarted){ loopStarted = true; requestAnimationFrame(loop); }
}

function resizeCanvas(){
  const rect = document.getElementById('stage').getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
function resizeCanvas3D(){
  const rect = canvas3d.getBoundingClientRect();
  if(rect.width > 0 && rect.height > 0){
    canvas3d.width = rect.width;
    canvas3d.height = rect.height;
  }
}
window.addEventListener('resize', ()=>{ resizeCanvas(); resizeCanvas3D(); });
resizeCanvas3D(); // set an initial correct size even before tracking starts

/* ---------------------------------------------------------------------
   Main loop: detect -> draw skeleton -> geometry -> exercise logic
--------------------------------------------------------------------- */
function loop(){
  if(!running){ requestAnimationFrame(loop); return; }
  if(video.readyState >= 2){
    const now = performance.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;
    fpsSmoothed = fpsSmoothed ? fpsSmoothed*0.9 + (1000/dt)*0.1 : 1000/dt;

    const result = poseLandmarker.detectForVideo(video, now);
    ctx.clearRect(0,0,canvas.width,canvas.height);

    if(result.landmarks && result.landmarks.length){
      const lm = result.landmarks[0];
      const worldLm = (result.worldLandmarks && result.worldLandmarks[0]) || null;
      latestWorldLm = worldLm;
      latestNormLm = lm;

      drawSkeleton(lm);
      const visibleCount = lm.filter(p=>p.visibility>0.5).length;
      const avgConf = lm.reduce((s,p)=>s+(p.visibility||0),0) / lm.length;
      liveLandmarks.textContent = lm.length;
      liveVisible.textContent = visibleCount + '/' + lm.length + ' visible';
      liveConfidence.textContent = Math.round(avgConf*100) + '%';

      if(trackMode === 'reps') processExercise(lm);
      if(worldLm){
        updateVelocity(worldLm, now);
        updatePosture(worldLm);
      }
    } else {
      liveLandmarks.textContent = '0';
      liveVisible.textContent = 'no person detected';
      liveConfidence.textContent = '—';
      formMsgEl.style.display = 'none';
      latestNormLm = null;
    }
    liveFps.textContent = fpsSmoothed.toFixed(0) + ' fps';
    if(sessionStartTime){
      const elapsedSec = (performance.now()-sessionStartTime)/1000;
      liveDuration.textContent = formatDuration(elapsedSec);
      const weightKg = parseFloat(weightInput.value) || 70;
      const runningCal = sessionCalories + caloriesForDuration(currentExercise, setStartTime?(performance.now()-setStartTime)/1000:0, weightKg);
      liveCalories.textContent = Math.round(runningCal) + ' kcal';
    }
  }
  requestAnimationFrame(loop);
}

function confidenceColor(v){
  if(v>0.8) return '#57BFB6';   // high confidence — teal
  if(v>0.5) return '#F2A93B';   // medium — amber
  return '#E2604F';             // low — red
}

function drawSkeleton(lm){
  const w = canvas.width, h = canvas.height;
  const grading = (trackMode === 'reps');
  ctx.lineWidth = 3;
  CONNECTIONS.forEach(([a,b])=>{
    if(!isGroupVisible(a) || !isGroupVisible(b)) return;
    const pa = lm[a], pb = lm[b];
    if(pa.visibility>0.4 && pb.visibility>0.4){
      if(grading){
        ctx.strokeStyle = (currentFaultyJoints.has(a) || currentFaultyJoints.has(b)) ? '#E2604F' : '#57BF7A';
      } else {
        ctx.strokeStyle = '#F2A93B';
      }
      ctx.beginPath();
      ctx.moveTo(pa.x*w, pa.y*h);
      ctx.lineTo(pb.x*w, pb.y*h);
      ctx.stroke();
    }
  });
  lm.forEach((p,i)=>{
    if(!isGroupVisible(i)) return;
    if(p.visibility>0.4){
      ctx.beginPath();
      ctx.arc(p.x*w, p.y*h, 4, 0, Math.PI*2);
      ctx.fillStyle = grading && currentFaultyJoints.has(i) ? '#E2604F' : confidenceColor(p.visibility);
      ctx.fill();
    }
  });
}

/* ---------------------------------------------------------------------
   Velocity — tracks a key joint's world-space (metric) position frame
   to frame and derives m/s, the way velocity-based-training tools
   gauge bar/limb speed instead of just counting reps.
--------------------------------------------------------------------- */
const WORLD_IDX = { L_HIP:23, R_HIP:24, L_SHOULDER:11, L_WRIST:15 };

function updateVelocity(worldLm, now){
  const jointName = VELOCITY_JOINT[currentExercise] || 'L_HIP';
  const idx = WORLD_IDX[jointName];
  const p = worldLm[idx];
  if(!p){ liveVelocity.textContent = '—'; return; }

  if(velocityTrack.point && velocityTrack.time){
    const dt = (now - velocityTrack.time) / 1000;
    if(dt > 0){
      const dx = p.x - velocityTrack.point.x;
      const dy = p.y - velocityTrack.point.y;
      const dz = p.z - velocityTrack.point.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const mps = dist / dt;
      velocityTrack.smoothed = velocityTrack.smoothed ? velocityTrack.smoothed*0.7 + mps*0.3 : mps;
    }
  }
  velocityTrack.point = { x:p.x, y:p.y, z:p.z };
  velocityTrack.time = now;

  const v = velocityTrack.smoothed;
  setVelocitySamples.push(v);
  if(setVelocitySamples.length>600) setVelocitySamples.shift(); // safety cap
  const tempo = v < 0.12 ? 'grinding' : v < 0.4 ? 'controlled' : 'explosive';
  liveVelocity.textContent = v.toFixed(2) + ' m/s · ' + tempo;
}

/* ---------------------------------------------------------------------
   Posture calibration — capture a neutral standing reference, then
   report forward/back lean drift away from that baseline each frame.
--------------------------------------------------------------------- */
function leanAngleFromWorld(worldLm){
  const shoulder = worldLm[WORLD_IDX.L_SHOULDER];
  const hip = worldLm[WORLD_IDX.L_HIP];
  if(!shoulder || !hip) return null;
  // angle of the torso vector off vertical, using depth (z) vs height (y)
  return Math.atan2(shoulder.z - hip.z, hip.y - shoulder.y) * 180 / Math.PI;
}

calibrateBtn.addEventListener('click', ()=>{
  if(!latestWorldLm){
    postureBadge.textContent = 'no pose detected yet — start tracking first';
    postureBadge.className = 'conn-status err';
    return;
  }
  const lean = leanAngleFromWorld(latestWorldLm);
  calibrationBaseline = { lean };
  postureBadge.textContent = 'calibrated ✓';
  postureBadge.className = 'conn-status ok';
  speak('Posture calibrated.');
});

/* ---------------------------------------------------------------------
   Skeleton display — user-controlled visibility per body-part group.
   Purely cosmetic: tracking/rep-counting always uses all landmarks
   regardless of what's toggled here.
--------------------------------------------------------------------- */
skeletonToggles.addEventListener('click', (e)=>{
  const chip = e.target.closest('.chip');
  if(!chip) return;
  const group = chip.dataset.group;
  skeletonVisibility[group] = !skeletonVisibility[group];
  chip.classList.toggle('active', skeletonVisibility[group]);
});
skeletonShowAll.addEventListener('click', ()=>{
  Object.keys(skeletonVisibility).forEach(g=> skeletonVisibility[g] = true);
  [...skeletonToggles.children].forEach(c=> c.classList.add('active'));
});
skeletonHideAll.addEventListener('click', ()=>{
  Object.keys(skeletonVisibility).forEach(g=> skeletonVisibility[g] = false);
  [...skeletonToggles.children].forEach(c=> c.classList.remove('active'));
});

function updatePosture(worldLm){
  const lean = leanAngleFromWorld(worldLm);
  if(lean==null){ livePosture.textContent = '—'; return; }
  if(!calibrationBaseline){
    livePosture.textContent = lean.toFixed(0) + '° (uncalibrated)';
    return;
  }
  const drift = lean - calibrationBaseline.lean;
  livePosture.textContent = (drift>=0?'+':'') + drift.toFixed(0) + '° vs baseline';
  if(Math.abs(drift) > 15){
    postureBadge.textContent = drift>0 ? 'leaning forward from baseline' : 'leaning back from baseline';
    postureBadge.className = 'conn-status err';
  } else {
    postureBadge.textContent = 'aligned with baseline';
    postureBadge.className = 'conn-status ok';
  }
}

/* ---------------------------------------------------------------------
   3D posture viewer — draws a simplified human body (head, torso,
   limbs as thick rounded segments) instead of a raw dot/wire cloud,
   plus a ground grid so the rotation reads as "a person in space"
   rather than an abstract skeleton.
--------------------------------------------------------------------- */
canvas3d.addEventListener('pointerdown', (e)=>{
  dragging3d = true; dragLastX = e.clientX; dragLastY = e.clientY;
  canvas3d.style.cursor = 'grabbing';
});
window.addEventListener('pointerup', ()=>{ dragging3d = false; canvas3d.style.cursor = 'grab'; });
window.addEventListener('pointermove', (e)=>{
  if(!dragging3d) return;
  rot3dY += (e.clientX - dragLastX) * 0.01;
  rot3dX = Math.max(-1.2, Math.min(1.2, rot3dX + (e.clientY - dragLastY) * 0.01));
  dragLastX = e.clientX; dragLastY = e.clientY;
});

function project3D(p, w, h){
  // rotate around Y then X, then simple orthographic projection
  let x = p.x, y = -p.y, z = p.z;
  let cosY = Math.cos(rot3dY), sinY = Math.sin(rot3dY);
  let x1 = x*cosY - z*sinY;
  let z1 = x*sinY + z*cosY;
  let cosX = Math.cos(rot3dX), sinX = Math.sin(rot3dX);
  let y1 = y*cosX - z1*sinX;
  const scale = Math.min(w,h) * 0.85;
  return { x: w/2 + x1*scale, y: h/2 + y1*scale, depth: z1 };
}



function drawGround3D(worldLm, w, h){
  const feetY = Math.max(worldLm[27]?.y ?? 0.5, worldLm[28]?.y ?? 0.5);
  ctx3d.strokeStyle = 'rgba(155,146,120,0.25)';
  ctx3d.lineWidth = 1;
  const span = 0.4, step = 0.2;
  for(let g=-span; g<=span+1e-6; g+=step){
    const A = project3D({x:g, y:feetY, z:-span}, w, h);
    const B = project3D({x:g, y:feetY, z:span}, w, h);
    ctx3d.beginPath(); ctx3d.moveTo(A.x,A.y); ctx3d.lineTo(B.x,B.y); ctx3d.stroke();
    const C = project3D({x:-span, y:feetY, z:g}, w, h);
    const D = project3D({x:span, y:feetY, z:g}, w, h);
    ctx3d.beginPath(); ctx3d.moveTo(C.x,C.y); ctx3d.lineTo(D.x,D.y); ctx3d.stroke();
  }
}

/* Builds an approximate metric-ish landmark set from the always-available
   2D normalized landmarks (which carry x, y, z, visibility even when the
   true worldLandmarks output is empty on some GPU/browser combinations).
   Not real-world scale, but enough to draw a recognizable, correctly
   posed body when the primary 3D source isn't coming through. */
function approxWorldFromNorm(lm){
  return lm.map(p=>({ x:(p.x-0.5)*1.6, y:(p.y-0.5)*1.6, z:(p.z||0)*1.6, visibility:p.visibility }));
}

function draw3D(worldLm, normLm, now){
  const w = canvas3d.width, h = canvas3d.height;
  if(w<=0 || h<=0) return;
  ctx3d.clearRect(0,0,w,h);
  if(!dragging3d) rot3dY += 0.0015; // gentle idle rotation

  let mode = 'demo';
  let data = worldLm;
  if(data){
    mode = 'live';
  } else if(normLm){
    data = approxWorldFromNorm(normLm);
    mode = 'approx';
  } else {
    data = DEMO_WORLD_POSE;
    mode = 'demo';
  }

  drawGround3D(data, w, h);

  // Painter's algorithm: draw farthest segments first so nearer limbs
  // correctly overlap them, which is what sells the "3D" read.
  const segs = BODY_SEGMENTS_3D
    .map(seg=>{
      if(mode!=='demo' && (!isGroupVisible(seg.a) || !isGroupVisible(seg.b))) return null;
      const pa = data[seg.a], pb = data[seg.b];
      if(!pa || !pb) return null;
      const A = project3D(pa, w, h), B = project3D(pb, w, h);
      return { A, B, seg, avgDepth:(A.depth+B.depth)/2 };
    })
    .filter(Boolean)
    .sort((s1,s2)=> s1.avgDepth - s2.avgDepth);

  segs.forEach(({A,B,seg})=>{
    ctx3d.lineCap = 'round';
    ctx3d.lineWidth = seg.width;
    ctx3d.strokeStyle = mode==='demo' ? 'rgba(155,146,120,0.55)' : seg.color;
    ctx3d.beginPath(); ctx3d.moveTo(A.x,A.y); ctx3d.lineTo(B.x,B.y); ctx3d.stroke();
  });

  // Head — simple sphere near the nose landmark, sized a bit by depth
  const nose = data[0];
  if(nose){
    const headCenter = { x:nose.x, y:nose.y - 0.09, z:nose.z };
    const H = project3D(headCenter, w, h);
    const baseR = Math.min(w,h) * 0.075;
    const r = baseR * (1 + Math.max(-0.4, Math.min(0.4, -H.depth)) * 0.6);
    ctx3d.beginPath();
    ctx3d.arc(H.x, H.y, r, 0, Math.PI*2);
    ctx3d.fillStyle = mode==='demo' ? 'rgba(155,146,120,0.7)' : '#EFE8D8';
    ctx3d.fill();
  }

  ctx3d.fillStyle = 'rgba(239,232,216,0.55)';
  ctx3d.font = '10px Inter, sans-serif';
  if(mode==='demo') ctx3d.fillText('demo pose — start tracking to see yours', 10, h-10);
  else if(mode==='approx') ctx3d.fillText('approximate depth (device fallback)', 10, h-10);
}

/* Runs independently of the camera/tracking loop so the panel always
   shows something — the demo pose when idle, your own body once
   tracking starts — instead of ever being a blank box. */
function draw3DLoop(){
  draw3D(latestWorldLm, latestNormLm, performance.now());
  requestAnimationFrame(draw3DLoop);
}
requestAnimationFrame(draw3DLoop);

function processExercise(lm){
  const cfg = EXERCISES[currentExercise];
  const raw = cfg.angleOf(lm);
  if(raw==null){ liveAngle.textContent='—°'; return; }

  angleWindow.push(raw);
  if(angleWindow.length>5) angleWindow.shift();
  const angle = angleWindow.reduce((s,v)=>s+v,0)/angleWindow.length;
  liveAngle.textContent = angle.toFixed(0) + '°';

  // Range of motion — widest angle spread seen this set
  if(angle < romMin) romMin = angle;
  if(angle > romMax) romMax = angle;
  liveROM.textContent = (romMax > -Infinity && romMin < Infinity) ? Math.round(romMax-romMin) + '°' : '—';

  // Left/right symmetry — only meaningful for bilateral exercises
  let symmetryPct = null;
  if(cfg.sym){
    const leftA = singleAngle(lm, cfg.sym.left[0], cfg.sym.left[1], cfg.sym.left[2]);
    const rightA = singleAngle(lm, cfg.sym.right[0], cfg.sym.right[1], cfg.sym.right[2]);
    if(leftA!=null && rightA!=null){
      symmetryPct = Math.max(0, Math.round(100 - Math.abs(leftA-rightA)*2));
      symmetrySamples.push(symmetryPct);
      liveSymmetry.textContent = symmetryPct + '%';
    } else {
      liveSymmetry.textContent = '—';
    }
  } else {
    liveSymmetry.textContent = 'n/a (single side)';
  }

  let form = cfg.formCheck ? cfg.formCheck(lm, angle) : null;
  if(!form && symmetryPct!=null && symmetryPct < 70){
    form = {warn:true, text:'Left and right sides are uneven — check you\u2019re not favoring one side.', joints:[...cfg.sym.left, ...cfg.sym.right]};
  }
  currentFaultyJoints = new Set((form && form.warn && form.joints) ? form.joints : []);
  showFormMessage(form);
  trackFormScore(form);

  if(cfg.hold){
    const holding = angle>=cfg.holdMin && angle<=cfg.holdMax;
    livePhase.textContent = holding ? 'holding' : 'broken';
    if(holding){
      if(holdStart==null){ holdStart = performance.now(); if(holdWasBroken){ speak('Back holding.'); holdWasBroken = false; } }
      holdSeconds = (performance.now()-holdStart)/1000;
    } else {
      if(holdStart!=null && !holdWasBroken){ speak('Hold broken.'); holdWasBroken = true; }
      holdStart = null;
    }
    const target = parseInt(holdTargetInput.value) || 30;
    if(!holdTargetReached && holdSeconds >= target){
      holdTargetReached = true;
      speak('Target hold reached. Nice work.');
    }
    repCountEl.textContent = holdSeconds.toFixed(1);
    repLabelEl.textContent = holdTargetReached ? `sec held · past ${target}s target` : `sec of ${target}s target`;
    return;
  }

  livePhase.textContent = phase;
  if(phase==='high' && angle < cfg.lowThresh){
    phase = 'low';
  } else if(phase==='low' && angle > cfg.highThresh){
    phase = 'high';
    reps++;
    repCountEl.textContent = reps;
    lastFormOK = !form || !form.warn;
    if(lastFormOK) goodRepsCount++; else badRepsCount++;
    goodBadLbl.textContent = `${goodRepsCount} good · ${badRepsCount} bad`;
    speak(String(reps));
  }
  repLabelEl.textContent = cfg.unit;
}

function trackFormScore(form){
  setTotalFrames++;
  if(!form || !form.warn) setGoodFrames++;
  currentFormScore = setTotalFrames ? Math.round(100*setGoodFrames/setTotalFrames) : 100;
  scoreLbl.textContent = 'form ' + currentFormScore;
  scoreLbl.classList.toggle('warn', currentFormScore < 75);
}

function showFormMessage(form){
  if(form && form.warn){
    formMsgEl.textContent = form.text;
    formMsgEl.classList.add('warn');
    formMsgEl.style.display = 'block';
    if(form.text !== lastSpokenForm){ speak(form.text); lastSpokenForm = form.text; }
  } else {
    formMsgEl.classList.remove('warn');
    formMsgEl.style.display = 'none';
    lastSpokenForm = null;
  }
}

function gradeFor(score){
  if(score>=90) return 'A';
  if(score>=80) return 'B';
  if(score>=70) return 'C';
  if(score>=60) return 'D';
  return 'F';
}

/* ---------------------------------------------------------------------
   Controls
--------------------------------------------------------------------- */
startBtn.addEventListener('click', startCamera);

toggleBtn.addEventListener('click', ()=>{
  running = !running;
  toggleBtn.textContent = running ? 'Pause tracking' : 'Resume tracking';
});

resetBtn.addEventListener('click', ()=>{
  reps = 0; holdSeconds = 0; holdStart = null; phase = 'high';
  setGoodFrames = 0; setTotalFrames = 0; currentFormScore = 100;
  setVelocitySamples = []; symmetrySamples = []; romMin = Infinity; romMax = -Infinity;
  holdTargetReached = false;
  goodRepsCount = 0; badRepsCount = 0; currentFaultyJoints = new Set();
  setStartTime = performance.now();
  scoreLbl.textContent = 'form —'; scoreLbl.classList.remove('warn');
  liveSymmetry.textContent = '—'; liveROM.textContent = '—';
  goodBadLbl.textContent = '0 good · 0 bad';
  repCountEl.textContent = '0';
});

function selectPose(exerciseKey){
  currentExercise = exerciseKey;
  trackMode = 'reps';
  reps = 0; holdSeconds = 0; holdStart = null; phase = 'high'; angleWindow = [];
  setGoodFrames = 0; setTotalFrames = 0; currentFormScore = 100; holdWasBroken = false;
  setVelocitySamples = []; symmetrySamples = []; romMin = Infinity; romMax = -Infinity;
  holdTargetReached = false;
  goodRepsCount = 0; badRepsCount = 0; currentFaultyJoints = new Set();
  setStartTime = performance.now();
  scoreLbl.textContent = 'form —'; scoreLbl.classList.remove('warn');
  liveSymmetry.textContent = '—'; liveROM.textContent = '—';
  goodBadLbl.textContent = '0 good · 0 bad';
  repCountEl.textContent = '0';
  repLabelEl.textContent = EXERCISES[currentExercise].unit;
  formMsgEl.style.display = 'none';
  holdTargetRow.style.display = EXERCISES[currentExercise].hold ? 'flex' : 'none';
  showPersonalBestFor(currentExercise, EXERCISES[currentExercise].label, EXERCISES[currentExercise].unit);
  updateControlsVisibility();
  if(currentFlow) endFlow();
}

function updateControlsVisibility(){
  const showReps = (trackMode === 'reps');
  repsControlsRow.style.display = showReps ? 'flex' : 'none';
  if(!showReps) holdTargetRow.style.display = 'none';
  else holdTargetRow.style.display = EXERCISES[currentExercise] && EXERCISES[currentExercise].hold ? 'flex' : 'none';
}

exerciseGrid.addEventListener('click', (e)=>{
  const btn = e.target.closest('.ex-btn');
  if(!btn) return;
  [...exerciseGrid.children].forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  selectPose(btn.dataset.ex);
});

yogaPoseGrid.addEventListener('click', (e)=>{
  const btn = e.target.closest('.ex-btn');
  if(!btn) return;
  [...yogaPoseGrid.children].forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  selectPose(btn.dataset.ex);
});

/* ---------------------------------------------------------------------
   Exercise vs. Yoga sections — purely which picker grid is visible.
   Both feed the same pose-tracking engine (trackMode 'reps'); only the
   guided flow (Surya Namaskar, inside Yoga) switches trackMode to 'flow'.
--------------------------------------------------------------------- */
sectionToggle.addEventListener('click', (e)=>{
  const btn = e.target.closest('.mode-btn');
  if(!btn) return;
  [...sectionToggle.children].forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const section = btn.dataset.section;
  exerciseSection.style.display = section === 'exercise' ? 'block' : 'none';
  yogaSection.style.display = section === 'yoga' ? 'block' : 'none';
});

/* ---------------------------------------------------------------------
   Flow player — guided, timer + voice-paced sequence (e.g. Surya Namaskar)
--------------------------------------------------------------------- */
flowPicker.addEventListener('click', (e)=>{
  const btn = e.target.closest('.ex-btn');
  if(!btn) return;
  [...flowPicker.children].forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  flowStartBtn.dataset.flow = btn.dataset.flow;
  flowStartBtn.textContent = 'Start ' + FLOWS[btn.dataset.flow].label;
});
flowStartBtn.dataset.flow = 'surya';

let flowStartTime = null;
flowStartBtn.addEventListener('click', ()=>{
  currentFlow = FLOWS[flowStartBtn.dataset.flow];
  flowIndex = 0;
  flowStartTime = performance.now();
  trackMode = 'flow';
  updateControlsVisibility();
  flowStartRow.style.display = 'none';
  flowPicker.style.display = 'none';
  flowPlayer.style.display = 'block';
  renderFlowDots();
  showFlowStep();
});

function renderFlowDots(){
  flowDots.innerHTML = currentFlow.steps.map((s,i)=>
    `<span class="dot${i===flowIndex?' active':(i<flowIndex?' done':'')}"></span>`
  ).join('');
}

function showFlowStep(){
  clearInterval(flowTimerId);
  flowPausedState = false;
  flowPauseBtn.textContent = 'Pause';
  const step = currentFlow.steps[flowIndex];
  flowStepName.textContent = step.name;
  flowStepText.textContent = step.text;
  flowHint.textContent = `step ${flowIndex+1} of ${currentFlow.steps.length}`;
  flowRemaining = step.hold;
  flowTimerEl.textContent = flowRemaining;
  renderFlowDots();
  speak(step.name + '. ' + step.text);

  flowTimerId = setInterval(()=>{
    flowRemaining -= 1;
    flowTimerEl.textContent = Math.max(flowRemaining,0);

    if(latestNormLm && step.check && FLOW_HINTS[step.check]){
      const inPosition = FLOW_HINTS[step.check](latestNormLm);
      flowHint.textContent = inPosition ? `step ${flowIndex+1} of ${currentFlow.steps.length} · in position ✓` : `step ${flowIndex+1} of ${currentFlow.steps.length} · adjust position`;
      flowHint.className = 'conn-status ' + (inPosition ? 'ok' : '');
    }

    if(flowRemaining <= 0) advanceFlow();
  }, 1000);
}

function advanceFlow(){
  flowIndex += 1;
  if(flowIndex >= currentFlow.steps.length){
    finishFlow();
  } else {
    showFlowStep();
  }
}

function finishFlow(){
  clearInterval(flowTimerId);
  speak('Flow complete. Nice work.');
  const durationSec = flowStartTime ? Math.round((performance.now()-flowStartTime)/1000) : null;
  const weightKg = parseFloat(weightInput.value) || 70;
  const calories = durationSec ? Math.round(caloriesForDuration('surya', durationSec, weightKg)) : null;
  if(calories) sessionCalories += calories;
  const entry = { exercise:currentFlow.label, value:1, unit:'round', formOK:true, formScore:100, grade:'✓', avgVelocity:null, goodReps:0, badReps:0, durationSec, calories, time:new Date().toISOString() };
  sessionSets.push(entry);
  renderLog();
  recordProgress(entry);
  bumpStreakOnce();
  addCoachMessage(`Finished a full ${currentFlow.label} round. ${readiness.label==='low' ? 'Given today, readiness is on the lower side — maybe stop here or take it slow on a second round.' : 'Feel free to flow through another round, or move into a Reps set.'}`);
  endFlow();
}

function endFlow(){
  clearInterval(flowTimerId);
  currentFlow = null;
  flowIndex = 0;
  trackMode = 'reps';
  updateControlsVisibility();
  flowPlayer.style.display = 'none';
  flowStartRow.style.display = 'flex';
  flowPicker.style.display = 'grid';
}

flowPrevBtn.addEventListener('click', ()=>{ if(flowIndex>0){ flowIndex--; showFlowStep(); } });
flowNextBtn.addEventListener('click', ()=> advanceFlow());
flowPauseBtn.addEventListener('click', ()=>{
  flowPausedState = !flowPausedState;
  if(flowPausedState){ clearInterval(flowTimerId); flowPauseBtn.textContent = 'Resume'; }
  else {
    flowPauseBtn.textContent = 'Pause';
    flowTimerId = setInterval(()=>{
      flowRemaining -= 1;
      flowTimerEl.textContent = Math.max(flowRemaining,0);
      if(flowRemaining <= 0) advanceFlow();
    }, 1000);
  }
});
flowEndBtn.addEventListener('click', endFlow);

finishSetBtn.addEventListener('click', async ()=>{
  const cfg = EXERCISES[currentExercise];
  const value = cfg.hold ? Number(holdSeconds.toFixed(1)) : reps;
  if(value <= 0) return;
  const grade = gradeFor(currentFormScore);
  const avgVelocity = setVelocitySamples.length
    ? Number((setVelocitySamples.reduce((s,v)=>s+v,0)/setVelocitySamples.length).toFixed(2))
    : null;
  const avgSymmetry = symmetrySamples.length
    ? Math.round(symmetrySamples.reduce((s,v)=>s+v,0)/symmetrySamples.length)
    : null;
  const rom = (romMax > -Infinity && romMin < Infinity) ? Math.round(romMax-romMin) : null;
  const setDurationSec = setStartTime ? (performance.now()-setStartTime)/1000 : 0;
  const weightKg = parseFloat(weightInput.value) || 70;
  const setCalories = Math.round(caloriesForDuration(currentExercise, setDurationSec, weightKg));
  sessionCalories += setCalories;
  const entry = {
    exercise:cfg.label, value, unit:cfg.unit, formOK:lastFormOK, formScore:currentFormScore, grade,
    avgVelocity, symmetry:avgSymmetry, rom,
    goodReps:goodRepsCount, badReps:badRepsCount,
    durationSec:Math.round(setDurationSec), calories:setCalories,
    time:new Date().toISOString()
  };
  sessionSets.push(entry);
  renderLog();
  recordProgress(entry);
  speak(`Set complete. ${value} ${cfg.unit}. Form grade ${grade}.`);
  resetBtn.click();
  const isNewPB = await checkPersonalBest(currentExercise, cfg.label, value, cfg.unit);
  await bumpStreakOnce();
  const summary = await getCoachSummary(entry, isNewPB);
  addCoachMessage(summary);
});

function renderLog(){
  if(!sessionSets.length){
    setLogEl.innerHTML = '<li class="empty">No sets logged yet — finish a set to record it here.</li>';
    historyStats.textContent = 'No sets yet.';
    return;
  }
  setLogEl.innerHTML = sessionSets.slice().reverse().map(s=>{
    const t = new Date(s.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const bits = [];
    if(s.avgVelocity!=null) bits.push(`${s.avgVelocity} m/s`);
    if(s.symmetry!=null) bits.push(`L/R ${s.symmetry}%`);
    if(s.rom!=null) bits.push(`ROM ${s.rom}°`);
    if(s.goodReps!=null && (s.goodReps+s.badReps)>0) bits.push(`${s.goodReps}✓/${s.badReps}✗`);
    if(s.durationSec!=null) bits.push(formatDuration(s.durationSec));
    if(s.calories!=null) bits.push(`${s.calories} kcal`);
    const extra = bits.length ? ' · ' + bits.join(' · ') : '';
    return `<li><span>${t} · ${s.exercise}</span><b>${s.value} ${s.unit} · ${s.grade}${extra}${s.formOK ? '' : ' ⚠'}</b></li>`;
  }).join('');

  const repSets = sessionSets.filter(s=>s.unit==='reps');
  const totalReps = repSets.reduce((sum,s)=>sum+s.value,0);
  const totalGood = sessionSets.reduce((sum,s)=>sum+(s.goodReps||0),0);
  const totalBad = sessionSets.reduce((sum,s)=>sum+(s.badReps||0),0);
  const totalDuration = sessionSets.reduce((sum,s)=>sum+(s.durationSec||0),0);
  const totalCal = sessionSets.reduce((sum,s)=>sum+(s.calories||0),0);
  const scored = sessionSets.filter(s=>typeof s.formScore==='number');
  const avgForm = scored.length ? Math.round(scored.reduce((sum,s)=>sum+s.formScore,0)/scored.length) : null;
  historyStats.innerHTML = `<span><b>${sessionSets.length}</b> sets</span>` +
    (totalReps ? `<span><b>${totalReps}</b> reps</span>` : '') +
    ((totalGood+totalBad)>0 ? `<span><b>${totalGood}</b>✓ / <b>${totalBad}</b>✗</span>` : '') +
    (avgForm!=null ? `<span>avg form <b>${avgForm}</b></span>` : '') +
    (totalDuration>0 ? `<span><b>${formatDuration(totalDuration)}</b> total</span>` : '') +
    (totalCal>0 ? `<span><b>${totalCal}</b> kcal</span>` : '');
}

/* ---------------------------------------------------------------------
   Connection panel — offline rules vs. online OpenRouter
--------------------------------------------------------------------- */
modeToggle.addEventListener('click', (e)=>{
  const btn = e.target.closest('.mode-btn');
  if(!btn) return;
  [...modeToggle.children].forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  connMode = btn.dataset.mode;
  onlinePanel.style.display = connMode==='online' ? 'block' : 'none';
  if(connMode==='online' && !modelSelect.options.length) loadModelList();
  updatePipelineStatus();
});

toggleKeyVis.addEventListener('click', ()=>{
  const showing = apiKeyInput.type === 'text';
  apiKeyInput.type = showing ? 'password' : 'text';
  toggleKeyVis.textContent = showing ? 'Show' : 'Hide';
});

apiKeyInput.addEventListener('input', ()=>{ orApiKey = apiKeyInput.value.trim(); updatePipelineStatus(); });
modelSelect.addEventListener('change', ()=>{ orModel = modelSelect.value; });

testConnBtn.addEventListener('click', async ()=>{
  connStatus.textContent = 'Testing…';
  connStatus.className = 'conn-status';
  if(!orApiKey){
    connStatus.textContent = 'Enter an API key first';
    connStatus.className = 'conn-status err';
    return;
  }
  try{
    await callOpenRouter('Reply with exactly: connection ok');
    connStatus.textContent = 'Connected · ' + orModel;
    connStatus.className = 'conn-status ok';
  }catch(err){
    connStatus.textContent = 'Failed: ' + err.message;
    connStatus.className = 'conn-status err';
  }
  updatePipelineStatus();
});

function updatePipelineStatus(){
  const online = connMode==='online' && orApiKey;
  pipelineLLM.textContent = online ? ('OpenRouter · ' + (orModel || '—')) : 'Offline rules';
  connDot.classList.toggle('online', !!online);
}

/* ---------------------------------------------------------------------
   Coach — routes to OpenRouter when Online mode is configured, or to
   built-in rule-based coaching when Offline (or if the call fails).
--------------------------------------------------------------------- */
function addCoachMessage(text){
  const div = document.createElement('div');
  div.className = 'msg coach';
  div.textContent = text;
  coachLog.appendChild(div);
  coachLog.scrollTop = coachLog.scrollHeight;
}
function addUserMessage(text){
  const div = document.createElement('div');
  div.className = 'msg user';
  div.textContent = text;
  coachLog.appendChild(div);
  coachLog.scrollTop = coachLog.scrollHeight;
}

async function callOpenRouter(prompt){
  if(!orApiKey) throw new Error('no API key set');
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer " + orApiKey,
      "HTTP-Referer":"https://sporty.app",
      "X-Title":"Sporty AI Trainer"
    },
    body: JSON.stringify({
      model: orModel || 'openai/gpt-4o-mini',
      messages:[{ role:"user", content: prompt }],
      max_tokens: 300
    })
  });
  if(!response.ok){
    const body = await response.text().catch(()=> '');
    throw new Error('HTTP ' + response.status + (body ? ' — ' + body.slice(0,120) : ''));
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if(!text) throw new Error('empty response');
  return text;
}

/* Single entry point every coach message goes through. */
async function getLLMResponse(prompt, fallbackFn){
  if(connMode === 'online' && orApiKey){
    try{
      return await callOpenRouter(prompt);
    }catch(e){
      return fallbackFn() + '  [online request failed: ' + e.message + ']';
    }
  }
  return fallbackFn();
}

function localFallback(kind, entry){
  if(kind==='summary'){
    const q = entry.formOK ? 'clean form throughout' : 'a form cue worth tightening up';
    return `Logged: ${entry.value} ${entry.unit} of ${entry.exercise}, with ${q}. Rest 60–90s, then go again when ready.`;
  }
  return "I couldn't reach the coaching model from this file, but generally: focus on control through the full range of motion, keep your core braced, and stop a movement early if form breaks down rather than grinding out bad reps.";
}

async function getCoachSummary(entry, isNewPB){
  const velLine = entry.avgVelocity!=null ? `Average rep velocity: ${entry.avgVelocity} m/s. ` : '';
  const symLine = entry.symmetry!=null ? `Left/right symmetry: ${entry.symmetry}%. ` : '';
  const romLine = entry.rom!=null ? `Range of motion: ${entry.rom}°. ` : '';
  const gbLine = (entry.goodReps+entry.badReps)>0 ? `Of those reps, ${entry.goodReps} had good form and ${entry.badReps} were flagged. ` : '';
  const capLine = entry.calories!=null ? `Estimated ${entry.calories} kcal burned over ${formatDuration(entry.durationSec)}. ` : '';
  const pbLine = isNewPB ? `This was a new personal best for this exercise — acknowledge it! ` : '';
  const prompt = `You are Sporty, a concise, encouraging AI fitness coach embedded in a workout app. `
    + `The user just finished a set: exercise=${entry.exercise}, result=${entry.value} ${entry.unit}, form score=${entry.formScore}/100 (grade ${entry.grade}), form flagged as ${entry.formOK ? 'good' : 'needing correction'}. `
    + velLine + symLine + romLine + gbLine + capLine + pbLine
    + `User is ${ageInput.value} years old. Today's readiness check-in: score ${readiness.score}/100 (${readiness.label} recovery). `
    + `Give one short (max 2 sentences) personalized, encouraging comment and a concrete next-set suggestion that accounts for today's readiness, rep speed, and symmetry if it's below 85%. No preamble.`;
  return getLLMResponse(prompt, ()=>localFallback('summary', entry));
}

coachSend.addEventListener('click', sendCoachQuestion);
coachInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendCoachQuestion(); });

async function sendCoachQuestion(){
  const text = coachInput.value.trim();
  if(!text) return;
  addUserMessage(text);
  coachInput.value = '';
  const cfg = EXERCISES[currentExercise];
  const value = cfg.hold ? holdSeconds.toFixed(1) + 's held' : reps + ' reps';
  const priorSets = sessionSets.slice(-5).map(s=>`${s.exercise}: ${s.value} ${s.unit}, grade ${s.grade}${s.avgVelocity!=null ? ', '+s.avgVelocity+' m/s' : ''}`).join('; ') || 'none yet';
  const prompt = `You are Sporty, a concise AI fitness coach inside a live workout app. `
    + `User is ${ageInput.value} years old, ${heightInput.value} cm tall. `
    + `Current exercise: ${cfg.label}. Current set so far: ${value}, live form score ${currentFormScore}/100, joint tracking confidence ${liveConfidence.textContent}. Recent sets this session: ${priorSets}. `
    + `Today's readiness check-in: score ${readiness.score}/100 (${readiness.label} recovery, sleep ${sleepInput.value}h, soreness ${sorenessInput.value}). `
    + `Answer the user's question in under 80 words, practical and specific, no medical diagnoses — recommend seeing a professional for injuries or pain. `
    + `User question: "${text}"`;
  addCoachMessage(await getLLMResponse(prompt, ()=>localFallback('question')));
}

renderLog();
updatePipelineStatus();

/* ---------------------------------------------------------------------
   Onboarding handoff — reads optional URL params from onboarding.html
   (?name=&age=&height=&weight=&exercise=&section=) and pre-fills the
   matching Sporty controls. Entirely additive: if no params are present
   (i.e. sporty.html opened directly, same as always), none of this runs
   and the app behaves exactly as before.
--------------------------------------------------------------------- */
(function applyOnboardingHandoff(){
  try{
    const params = new URLSearchParams(window.location.search);
    if(![...params.keys()].length) return; // opened directly — no handoff, no change

    const name = params.get('name');
    if(name){
      welcomeTag.textContent = `Welcome back, ${name} 👋`;
      welcomeTag.style.display = 'block';
    }

    const age = params.get('age'), height = params.get('height'), weight = params.get('weight');
    let touchedProfile = false;
    if(age){ ageInput.value = age; touchedProfile = true; }
    if(height){ heightInput.value = height; touchedProfile = true; }
    if(weight){ weightInput.value = weight; touchedProfile = true; }
    if(touchedProfile) updateBodyProfile();

    const exerciseKeyMap = {
      squat:'squat', pushup:'pushup', 'push-up':'pushup', curl:'curl', 'bicep curl':'curl',
      plank:'plank', lunge:'lunge', overhead:'overhead', 'overhead press':'overhead',
      tree:'tree', 'tree pose':'tree', warrior2:'warrior2', 'warrior ii':'warrior2'
    };
    const exerciseParam = (params.get('exercise') || '').toLowerCase().trim();
    const key = exerciseKeyMap[exerciseParam];
    if(key && EXERCISES[key]){
      const isYoga = EXERCISES[key].category === 'yoga';
      const targetGrid = isYoga ? yogaPoseGrid : exerciseGrid;
      const btn = targetGrid.querySelector(`[data-ex="${key}"]`);
      if(btn){
        // switch to the right section (Exercise vs Yoga) to match
        const sectionBtn = sectionToggle.querySelector(`[data-section="${isYoga ? 'yoga' : 'exercise'}"]`);
        if(sectionBtn) sectionBtn.click();
        btn.click(); // reuses the existing click handler (selectPose + active state)
      }
    }
  }catch(e){
    // Handoff is a nice-to-have, never let it break the app if params are malformed.
    console.warn('Onboarding handoff skipped:', e);
  }
})();
