/* Poker Timer PRO - One-file app
   - settings <> game
   - levels: [{small, increment}]
   - rebuys/addons counters
   - timers: round timer, total time, break timer(s)
   - save/load state to localStorage
*/

// --- Helpers ---
const $ = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));
const formatTime = s => {
  const m = Math.floor(s/60);
  const sec = s%60;
  return `${m}:${String(sec).padStart(2,'0')}`;
};
const pad2 = n => String(n).padStart(2,'0');

// --- Elements ---
const settingsPanel = $('#settingsPanel');
const gamePanel = $('#gamePanel');
const modeLabel = $('#modeLabel');

const inputRoundMin = $('#inputRoundMin');
const inputPlayers = $('#inputPlayers');
const inputStack = $('#inputStack');
const inputRebuy = $('#inputRebuy');
const inputAddon = $('#inputAddon');
const inputInitialSmall = $('#inputInitialSmall');
const inputDefaultIncrement = $('#inputDefaultIncrement');
const inputAddIncrement = $('#inputAddIncrement');
const btnAddLevel = $('#btnAddLevel');
const btnDefaults = $('#btnDefaults');
const btnStartGame = $('#btnStartGame');
const levelsTableBody = $('#levelsTable tbody');

const chipsInGameEl = $('#chipsInGame');
const avgStackEl = $('#avgStack');
const rebuyCountEl = $('#rebuyCount');
const addonCountEl = $('#addonCount');

const rebuyMinus = $('#rebuyMinus'), rebuyPlus = $('#rebuyPlus');
const addonMinus = $('#addonMinus'), addonPlus = $('#addonPlus');

const roundTimerEl = $('#roundTimer');
const currentBlindsEl = $('#currentBlinds');
const btnStart = $('#btnStart');
const btnPause = $('#btnPause');
const btnNext = $('#btnNext');
const btnReset = $('#btnReset');
const btnFullscreen = $('#btnFullscreen');
const totalTimeEl = $('#totalTime');
const sumBreaksEl = $('#sumBreaks');
const lastRoundStartEl = $('#lastRoundStart');

const roundTimerWrap = $('#roundTimerWrap');
const breakTimerWrap = $('#breakTimerWrap');
const breakTimerEl = $('#breakTimer');

// --- State ---
let levels = []; // [{small:number, increment:number}]
let roundIndex = 0;
let roundSeconds = 0;
let timerInterval = null;

let totalSeconds = 0;
let totalTimerInterval = null;

let onBreak = false;
let breakSeconds = 0;
let breakInterval = null;
let sumBreakSeconds = 0;

let rebuyCount = 0;
let addonCount = 0;

let playersCount = 7, stackSize = 200000, rebuySize = 200000, addonSize = 100000;

// --- Persistence ---
const STORAGE_KEY = "poker_timer_pro_v1";
function saveState(){
  const s = {
    levels, roundIndex,
    inputRoundMin: inputRoundMin.value,
    playersCount, stackSize, rebuySize, addonSize,
    rebuyCount, addonCount,
    sumBreakSeconds, totalSeconds
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return false;
  try{
    const s = JSON.parse(raw);
    if(Array.isArray(s.levels) && s.levels.length>0){
      levels = s.levels;
      roundIndex = s.roundIndex || 0;
      inputRoundMin.value = s.inputRoundMin || inputRoundMin.value;
      inputPlayers.value = s.playersCount || inputPlayers.value;
      inputStack.value = s.stackSize || inputStack.value;
      inputRebuy.value = s.rebuySize || inputRebuy.value;
      inputAddon.value = s.addonSize || inputAddon.value;
      rebuyCount = s.rebuyCount || 0;
      addonCount = s.addonCount || 0;
      sumBreakSeconds = s.sumBreakSeconds || 0;
      totalSeconds = s.totalSeconds || 0;
      // sync settings variables
      playersCount = parseInt(inputPlayers.value,10)||playersCount;
      stackSize = parseInt(inputStack.value,10)||stackSize;
      rebuySize = parseInt(inputRebuy.value,10)||rebuySize;
      addonSize = parseInt(inputAddon.value,10)||addonSize;
      return true;
    }
  }catch(e){console.warn(e)}
  return false;
}

// --- UI functions ---
function renderLevels(){
  levelsTableBody.innerHTML = '';
  levels.forEach((lvl,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td contenteditable="false">${lvl.small}</td>
      <td>${lvl.small*2}</td>
      <td><input type="number" data-idx="${i}" class="inc-input" value="${lvl.increment}" style="width:80px;padding:6px;border-radius:6px;background:transparent;border:1px solid rgba(255,255,255,0.04);color:#fff"></td>
      <td class="levels-actions">
        <button class="btn-ghost level-del" data-idx="${i}" title="Usuń">🗑️</button>
        <button class="btn-ghost level-up" data-idx="${i}" title="Przenieś w górę">↑</button>
        <button class="btn-ghost level-down" data-idx="${i}" title="Przenieś w dół">↓</button>
      </td>
    `;
    levelsTableBody.appendChild(tr);
  });
  // attach listeners
  $all('.inc-input').forEach(inp=>{
    inp.onchange = e=>{
      const idx = parseInt(e.target.dataset.idx,10);
      levels[idx].increment = parseInt(e.target.value,10) || 0;
      // recompute subsequent smalls
      for(let j=idx+1;j<levels.length;j++){
        levels[j].small = levels[j-1].small + (levels[j-1].increment||0);
      }
      saveState();
      renderLevels();
    };
  });
  $all('.level-del').forEach(btn=>{
    btn.onclick = e=>{
      const idx = parseInt(btn.dataset.idx,10);
      if(!confirm('Usunąć ten poziom?')) return;
      levels.splice(idx,1);
      if(roundIndex >= levels.length) roundIndex = Math.max(0, levels.length-1);
      saveState();
      renderLevels();
      updateCurrentBlinds();
    };
  });
  $all('.level-up').forEach(btn=>{
    btn.onclick = e=>{
      const idx = parseInt(btn.dataset.idx,10);
      if(idx<=0) return;
      [levels[idx-1], levels[idx]] = [levels[idx], levels[idx-1]];
      if(roundIndex===idx) roundIndex = idx-1;
      else if(roundIndex===idx-1) roundIndex = idx;
      saveState();
      renderLevels();
    };
  });
  $all('.level-down').forEach(btn=>{
    btn.onclick = e=>{
      const idx = parseInt(btn.dataset.idx,10);
      if(idx>=levels.length-1) return;
      [levels[idx], levels[idx+1]] = [levels[idx+1], levels[idx]];
      if(roundIndex===idx) roundIndex = idx+1;
      else if(roundIndex===idx+1) roundIndex = idx;
      saveState();
      renderLevels();
    };
  });
}

function updateStatsUI(){
  const total = playersCount * stackSize + rebuyCount * rebuySize + addonCount * addonSize;
  chipsInGameEl.textContent = total.toLocaleString('pl-PL');
  const avg = Math.floor(total / Math.max(1, playersCount));
  avgStackEl.textContent = avg.toLocaleString('pl-PL');
  rebuyCountEl.textContent = rebuyCount;
  addonCountEl.textContent = addonCount;
}

function updateCurrentBlinds(){
  if(levels.length===0){
    currentBlindsEl.textContent = 'Brak zdefiniowanych poziomów';
    return;
  }
  const lvl = levels[roundIndex];
  currentBlindsEl.textContent = `Blindy: ${lvl.small} / ${lvl.small*2} — Poziom ${roundIndex+1} / ${levels.length}`;
}

function computeLastRoundStart(){
  // Estimate start time of the last round from now:
  // sum remaining seconds for current round + remaining full rounds after current + sumBreakSeconds
  const roundLen = parseInt(inputRoundMin.value,10) * 60;
  // remaining seconds in current round = roundSeconds
  // if in break, current round remains paused; but we'll approximate: last round start = now + roundSeconds + (levelsLeft-1)*roundLen + sumBreakSeconds
  const levelsLeft = Math.max(0, levels.length - (roundIndex+1)); // rounds after current
  const secondsToLastStart = (roundSeconds) + (levelsLeft * roundLen) + sumBreakSeconds;
  const est = new Date(Date.now() + secondsToLastStart*1000);
  return `${pad2(est.getHours())}:${pad2(est.getMinutes())}`;
}

function updateTimeDisplays(){
  // round timer
  roundTimerEl.textContent = formatTime(roundSeconds);
  // total time
  totalTimeEl.textContent = formatTime(totalSeconds);
  // sum breaks
  sumBreaksEl.textContent = formatTime(sumBreakSeconds + (onBreak?breakSeconds:0));
  // last round start
  lastRoundStartEl.textContent = computeLastRoundStart();
}

// --- Actions: add level, defaults, start ---
btnAddLevel.onclick = ()=>{
  const last = levels.length?levels[levels.length-1]:null;
  const addInc = parseInt(inputAddIncrement.value,10);
  const inc = (Number.isFinite(addInc) && addInc>0) ? addInc : (parseInt(inputDefaultIncrement.value,10)||0);
  const newSmall = last ? (last.small + (last.increment||0)) : (parseInt(inputInitialSmall.value,10)||500);
  levels.push({small:newSmall, increment:inc});
  // recompute subsequent just in case
  for(let i=1;i<levels.length;i++){
    levels[i].small = levels[i-1].small + (levels[i-1].increment||0);
  }
  inputAddIncrement.value = '';
  saveState();
  renderLevels();
};

btnDefaults.onclick = ()=>{
  if(!confirm('Przywrócić domyślne ustawienia?')) return;
  inputRoundMin.value = 10;
  inputPlayers.value = 7;
  inputStack.value = 200000;
  inputRebuy.value = 200000;
  inputAddon.value = 100000;
  inputInitialSmall.value = 500;
  inputDefaultIncrement.value = 500;
  levels = [{small:500, increment:500}];
  roundIndex = 0;
  rebuyCount = 0; addonCount = 0;
  sumBreakSeconds = 0; totalSeconds = 0;
  saveState();
  renderLevels();
  updateStatsUI();
  updateCurrentBlinds();
};

btnStartGame.onclick = ()=>{
  // sync settings
  playersCount = parseInt(inputPlayers.value,10) || 1;
  stackSize = parseInt(inputStack.value,10) || 0;
  rebuySize = parseInt(inputRebuy.value,10) || 0;
  addonSize = parseInt(inputAddon.value,10) || 0;
  // ensure at least one level
  if(levels.length===0){
    levels.push({small: parseInt(inputInitialSmall.value,10)||500, increment: parseInt(inputDefaultIncrement.value,10)||500});
  } else {
    // update first small if user changed it
    levels[0].small = parseInt(inputInitialSmall.value,10) || levels[0].small;
    // recompute subsequent
    for(let i=1;i<levels.length;i++){
      levels[i].small = levels[i-1].small + (levels[i-1].increment||0);
    }
  }
  roundIndex = 0;
  roundSeconds = parseInt(inputRoundMin.value,10) * 60;
  // reset counters
  rebuyCount = 0; addonCount = 0; sumBreakSeconds = 0; totalSeconds = 0; breakSeconds = 0;
  saveState();
  // switch to game view
  settingsPanel.style.display = 'none';
  gamePanel.style.display = '';
  modeLabel.textContent = 'Gra';
  updateStatsUI();
  renderLevels();
  updateCurrentBlinds();
  updateTimeDisplays();
  startTotalTimer();
};

// --- Timer logic ---
function startRoundTimer(){
  if(timerInterval) return;
  timerInterval = setInterval(()=>{
    if(!onBreak){
      if(roundSeconds>0){
        roundSeconds--;
        updateTimeDisplays();
      } else {
        // round ended -> go next level or stop
        if(roundIndex < levels.length - 1){
          roundIndex++;
          roundSeconds = parseInt(inputRoundMin.value,10)*60;
          saveState();
          updateCurrentBlinds();
          updateTimeDisplays();
        } else {
          clearInterval(timerInterval);
          timerInterval = null;
          alert('Koniec harmonogramu poziomów!');
        }
      }
    }
  },1000);
}

function stopRoundTimer(){
  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// total time since start
function startTotalTimer(){
  if(totalTimerInterval) return;
  totalTimerInterval = setInterval(()=>{
    totalSeconds++;
    updateTimeDisplays();
  },1000);
}
function stopTotalTimer(){
  if(totalTimerInterval){ clearInterval(totalTimerInterval); totalTimerInterval=null;}
}

// break handling
function startBreak(){
  onBreak = true;
  breakSeconds = 0;
  roundTimerWrap.classList.add('hidden');
  breakTimerWrap.classList.remove('hidden');
  // break interval
  if(breakInterval) clearInterval(breakInterval);
  breakInterval = setInterval(()=>{
    breakSeconds++;
    breakTimerEl.textContent = `PRZERWA ${formatTime(breakSeconds)}`;
    updateTimeDisplays();
  },1000);
}
function endBreak(){
  onBreak = false;
  // accumulate break into sum
  sumBreakSeconds += breakSeconds;
  breakSeconds = 0;
  if(breakInterval){ clearInterval(breakInterval); breakInterval = null;}
  breakTimerWrap.classList.add('hidden');
  roundTimerWrap.classList.remove('hidden');
  updateTimeDisplays();
  saveState();
}

// Pause/wznów button
btnPause.onclick = ()=>{
  if(!timerInterval) {
    // if timer not running, start it
    btnStart.click();
    return;
  }
  if(!onBreak){
    // start break (pause round timer)
    startBreak();
    btnPause.textContent = '▶️ Wznów';
  } else {
    // end break -> resume
    endBreak();
    btnPause.textContent = '⏸️ Pauza';
  }
};

// Start button
btnStart.onclick = ()=>{
  // if timer not running, start round timer
  if(!timerInterval) {
    // ensure roundSeconds is set
    if(!roundSeconds || roundSeconds<=0) roundSeconds = parseInt(inputRoundMin.value,10)*60;
    startRoundTimer();
    startTotalTimer();
  }
};

// Next level
btnNext.onclick = ()=>{
  if(roundIndex < levels.length - 1){
    roundIndex++;
    roundSeconds = parseInt(inputRoundMin.value,10)*60;
    updateCurrentBlinds();
    saveState();
    updateTimeDisplays();
  } else {
    alert('Brak kolejnych poziomów.');
  }
};

// Reset -> confirm and go back to settings
btnReset.onclick = ()=>{
  if(!confirm('Czy na pewno zresetować grę i wrócić do ustawień?')) return;
  // stop timers
  stopRoundTimer();
  stopTotalTimer();
  if(breakInterval) { clearInterval(breakInterval); breakInterval = null; }
  onBreak = false; breakSeconds = 0;
  // keep levels but reset round index and counters
  roundIndex = 0;
  roundSeconds = parseInt(inputRoundMin.value,10)*60;
  rebuyCount = 0; addonCount = 0; sumBreakSeconds = 0; totalSeconds = 0;
  saveState();
  // show settings panel
  settingsPanel.style.display = '';
  gamePanel.style.display = 'none';
  modeLabel.textContent = 'Ustawienia';
  updateStatsUI();
  renderLevels();
  updateCurrentBlinds();
  updateTimeDisplays();
  btnPause.textContent = '⏸️ Pauza';
};

// full screen
btnFullscreen.onclick = ()=>{
  if(!document.fullscreenElement){
    document.documentElement.requestFullscreen().catch(()=>{});
  } else {
    document.exitFullscreen();
  }
};

// rebuys/addons controls
rebuyPlus.onclick = ()=>{ rebuyCount++; updateStatsUI(); saveState(); };
rebuyMinus.onclick = ()=>{ rebuyCount = Math.max(0, rebuyCount-1); updateStatsUI(); saveState(); };
addonPlus.onclick = ()=>{ addonCount++; updateStatsUI(); saveState(); };
addonMinus.onclick = ()=>{ addonCount = Math.max(0, addonCount-1); updateStatsUI(); saveState(); };

// --- Initialization ---
(function init(){
  const loaded = loadState();
  if(!loaded){
    // defaults
    levels = [{small:500, increment:500}];
    roundIndex = 0;
  }
  // populate settings inputs with state
  inputPlayers.value = playersCount;
  inputStack.value = stackSize;
  inputRebuy.value = rebuySize;
  inputAddon.value = addonSize;
  inputInitialSmall.value = levels[0].small;
  inputDefaultIncrement.value = levels[0].increment || inputDefaultIncrement.value;

  // initial timers
  roundSeconds = parseInt(inputRoundMin.value,10) * 60;

  renderLevels();
  updateStatsUI();
  updateCurrentBlinds();
  updateTimeDisplays();

  // If there was ongoing totalSeconds in saved state, resume total timer
  if(totalSeconds>0) startTotalTimer();
  // show settings by default
  settingsPanel.style.display = '';
  gamePanel.style.display = 'none';
})();

window.addEventListener('beforeunload', ()=>{ saveState(); });

