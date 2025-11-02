const inputSelect = document.getElementById("inputSelect");
const virtualOutputSelect = document.getElementById("virtualOutputSelect");
const monitorOutputSelect = document.getElementById("monitorOutputSelect");
const toggleMonitorBtn = document.getElementById("toggleMonitor");
const fileInput = document.getElementById("fileInput");
const buttonsDiv = document.getElementById("buttons");
const startMicBtn = document.getElementById("startMic");
const stopMicBtn = document.getElementById("stopMic");
const masterVol = document.getElementById("masterVol");
const pitchSlider = document.getElementById("pitchSlider");
const pitchValue = document.getElementById("pitchValue");
const distSlider = document.getElementById("distSlider");
const distValue = document.getElementById("distValue");

let audioCtx, mixGain, mixDestination;
let micStream, micSource;
let virtualAudio, monitorAudio;
let monitoringEnabled = false;
let distortionNode;
let soundList = []; // store multiple sounds

// --- Audio context ---
async function ensureAudioContext() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  mixDestination = audioCtx.createMediaStreamDestination();
  mixGain = audioCtx.createGain();
  mixGain.gain.value = parseFloat(masterVol.value) / 100;
  mixGain.connect(mixDestination);
}

// --- Device listing ---
async function listDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const ins = devices.filter((d) => d.kind === "audioinput");
  const outs = devices.filter((d) => d.kind === "audiooutput");

  function fill(select, arr, savedId) {
    select.innerHTML = "";
    arr.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Device ${i + 1}`;
      select.appendChild(opt);
    });
    if (savedId && arr.some((d) => d.deviceId === savedId))
      select.value = savedId;
  }

  const savedInput = localStorage.getItem("selectedInput");
  const savedVirtual = localStorage.getItem("selectedVirtualOutput");
  const savedMonitor = localStorage.getItem("selectedMonitorOutput");

  fill(inputSelect, ins, savedInput);
  fill(virtualOutputSelect, outs, savedVirtual);
  fill(monitorOutputSelect, outs, savedMonitor);
}

// --- Start/stop mic ---
async function startMic() {
  await ensureAudioContext();
  const dev = inputSelect.value;
  localStorage.setItem("selectedInput", dev);

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: dev ? { deviceId: { exact: dev } } : true,
  });
  micSource = audioCtx.createMediaStreamSource(micStream);

  if (distortionNode) {
    micSource.connect(mixGain);
    mixGain.disconnect();
    mixGain.connect(distortionNode).connect(mixDestination);
  } else {
    micSource.connect(mixGain);
  }

  startMicBtn.disabled = true;
  stopMicBtn.disabled = false;
  setupVirtualOutput();
  if (monitoringEnabled) setupMonitoringOutput();
}

function stopMic() {
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  if (micSource) micSource.disconnect();
  micStream = null;
  micSource = null;

  startMicBtn.disabled = false;
  stopMicBtn.disabled = true;
}

// --- Load MP3 files ---
async function loadFiles(files) {
  await ensureAudioContext();
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result;
      soundList.push({
        name: file.name,
        buffer: audioBuffer,
        data: base64Data,
      });
      saveSoundsToStorage();
      renderSoundButtons();
    };
    reader.readAsDataURL(file);
  }
}

async function loadSavedSounds() {
  const saved = JSON.parse(localStorage.getItem("savedSounds") || "[]");
  await ensureAudioContext();
  for (const s of saved) {
    const arrayBuffer = await (await fetch(s.data)).arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    soundList.push({ name: s.name, buffer: audioBuffer, data: s.data });
  }
  renderSoundButtons();
}

function removeSound(idx) {
  soundList.splice(idx, 1);
  saveSoundsToStorage();
  renderSoundButtons();
}

function saveSoundsToStorage() {
  const saved = soundList.map((s) => ({ name: s.name, data: s.data }));
  localStorage.setItem("savedSounds", JSON.stringify(saved));
}

// --- Render buttons ---
function renderSoundButtons() {
  buttonsDiv.innerHTML = "";

  soundList.forEach((sound, idx) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.alignItems = "center";
    row.style.marginBottom = "5px";

    let currentSource = null;

    const stopBtn = document.createElement("button");
    stopBtn.className = "stop-btn";
    stopBtn.textContent = "■";
    stopBtn.onclick = () => {
      if (currentSource) {
        currentSource.stop();
        currentSource = null;
      }
    };

    const playBtn = document.createElement("button");
    playBtn.className = "sound-btn";
    playBtn.textContent = sound.name;
    playBtn.style.flex = "1";
    playBtn.style.whiteSpace = "nowrap";
    playBtn.style.overflow = "hidden";
    playBtn.style.textOverflow = "ellipsis";
    playBtn.onclick = () => {
      currentSource = audioCtx.createBufferSource();
      currentSource.buffer = sound.buffer;
      currentSource.playbackRate.value = parseFloat(pitchSlider.value);
      currentSource.connect(mixGain);
      currentSource.start();
    };

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "X";
    removeBtn.style.backgroundColor = "#cc0000";
    removeBtn.onclick = () => removeSound(idx);

    row.appendChild(stopBtn);
    row.appendChild(playBtn);
    row.appendChild(removeBtn);
    buttonsDiv.appendChild(row);
  });
}

const highFreqBtn = document.getElementById("highFreqBtn");
let highOsc;

// --- High-frequency tone control ---
highFreqBtn.addEventListener("mousedown", startHighTone);
highFreqBtn.addEventListener("mouseup", stopHighTone);
highFreqBtn.addEventListener("mouseleave", stopHighTone);
highFreqBtn.addEventListener("touchstart", startHighTone);
highFreqBtn.addEventListener("touchend", stopHighTone);

function startHighTone() {
  if (!audioCtx) return;
  if (highOsc) return;
  highOsc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  highOsc.type = "sine";
  highOsc.frequency.value = 12000; // 10 kHz
  gain.gain.value = 0.5; // safe level
  highOsc.connect(gain).connect(mixGain);
  highOsc.start();
}

function stopHighTone() {
  if (highOsc) {
    highOsc.stop();
    highOsc.disconnect();
    highOsc = null;
  }
}

const bassBtn = document.getElementById("bassBtn");

// --- High-frequency tone control ---
bassBtn.addEventListener("mousedown", startBass);
bassBtn.addEventListener("mouseup", stopBass);
bassBtn.addEventListener("mouseleave", stopBass);
bassBtn.addEventListener("touchstart", startBass);
bassBtn.addEventListener("touchend", stopBass);

function startBass() {
  if (!audioCtx) return;
  if (highOsc) return;
  highOsc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  highOsc.type = "sine";
  highOsc.frequency.value = 40; // 10 kHz
  gain.gain.value = 100; // safe level
  highOsc.connect(gain).connect(mixGain);
  highOsc.start();
}

function stopBass() {
  if (highOsc) {
    highOsc.stop();
    highOsc.disconnect();
    highOsc = null;
  }
}

const censorBtn = document.getElementById("censorBtn");

// --- High-frequency tone control ---
censorBtn.addEventListener("mousedown", startCensor);
censorBtn.addEventListener("mouseup", stopCensor);
censorBtn.addEventListener("mouseleave", stopCensor);
censorBtn.addEventListener("touchstart", startCensor);
censorBtn.addEventListener("touchend", stopCensor);

function startCensor() {
  if (!audioCtx) return;
  if (highOsc) return;
  highOsc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  highOsc.type = "sine";
  highOsc.frequency.value = 900; // 10 kHz
  gain.gain.value = 1; // safe level
  highOsc.connect(gain).connect(mixGain);
  highOsc.start();
}

function stopCensor() {
  if (highOsc) {
    highOsc.stop();
    highOsc.disconnect();
    highOsc = null;
  }
}

const volValue = document.getElementById("volValue");

masterVol.addEventListener("input", () => {
  const vol = parseFloat(masterVol.value);
  volValue.textContent = `${vol}%`;
  if (mixGain) mixGain.gain.value = vol / 100; // scale 0–500%
});

// --- Play buffer with pitch ---
function playBuffer(audioBuffer) {
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.playbackRate.value = parseFloat(pitchSlider.value);
  src.connect(mixGain);
  src.start();
}

// --- Virtual output ---
async function setupVirtualOutput() {
  if (!mixDestination) return;
  if (virtualAudio) virtualAudio.pause();
  virtualAudio = new Audio();
  virtualAudio.autoplay = true;
  virtualAudio.srcObject = mixDestination.stream;
  const id = virtualOutputSelect.value;
  localStorage.setItem("selectedVirtualOutput", id);
  if (id && virtualAudio.setSinkId) {
    try {
      await virtualAudio.setSinkId(id);
    } catch (e) {
      console.warn(e);
    }
  }
  await virtualAudio.play();
}

// --- Monitoring output ---
async function setupMonitoringOutput() {
  if (!mixDestination) return;
  if (monitorAudio) {
    monitorAudio.pause();
    monitorAudio.srcObject = null;
  }

  const monitorDest = audioCtx.createMediaStreamDestination();
  if (distortionNode) {
    distortionNode.connect(monitorDest);
  } else {
    mixGain.connect(monitorDest);
  }

  monitorAudio = new Audio();
  monitorAudio.autoplay = true;
  monitorAudio.srcObject = monitorDest.stream;

  const id = monitorOutputSelect.value;
  localStorage.setItem("selectedMonitorOutput", id);
  if (id && monitorAudio.setSinkId) {
    try {
      await monitorAudio.setSinkId(id);
    } catch (e) {
      console.warn(e);
    }
  }

  try {
    await monitorAudio.play();
  } catch (e) {
    console.warn(e);
  }
}

// --- Monitor toggle ---
toggleMonitorBtn.addEventListener("click", () => {
  monitoringEnabled = !monitoringEnabled;
  if (monitoringEnabled) setupMonitoringOutput();
  else if (monitorAudio) monitorAudio.pause();
});

// --- Slider events ---
masterVol.addEventListener("input", () => {
  if (mixGain) mixGain.gain.value = parseFloat(masterVol.value) / 100;
});

pitchSlider.addEventListener("input", () => {
  pitchValue.textContent = parseFloat(pitchSlider.value).toFixed(2);
});

distSlider.addEventListener("input", () => {
  distValue.textContent = distSlider.value;
  if (!mixGain) return;
  if (distortionNode) mixGain.disconnect(distortionNode);
  distortionNode = createDistortion(parseFloat(distSlider.value));
  mixGain.connect(distortionNode).connect(mixDestination);
  if (monitoringEnabled && monitorAudio) {
    const monitorDest = audioCtx.createMediaStreamDestination();
    distortionNode.connect(monitorDest);
    monitorAudio.srcObject = monitorDest.stream;
  }
});

// --- Distortion function ---
function createDistortion(amount) {
  const wave = audioCtx.createWaveShaper();
  const n = 44100;
  const curve = new Float32Array(n);
  const k = amount;
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  wave.curve = curve;
  wave.oversample = "4x";
  return wave;
}

// --- Event listeners ---
startMicBtn.addEventListener("click", startMic);
stopMicBtn.addEventListener("click", stopMic);
fileInput.addEventListener("change", (e) =>
  loadFiles(Array.from(e.target.files))
);
navigator.mediaDevices.addEventListener("devicechange", listDevices);

// --- Init ---
listDevices();
(async () => {
  await ensureAudioContext();
  await loadSavedSounds();
})();
