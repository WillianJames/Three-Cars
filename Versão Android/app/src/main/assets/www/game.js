(() => {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Constantes                                                          */
  /* ------------------------------------------------------------------ */

  const WORLD_W = 540;
  let WORLD_H = 1080;
  const ROAD_POSITIONS = [0.25, 0.75];
  const CAR_BASE_RATIO = 0.8;
  let CAR_BASE_Y = Math.round(WORLD_H * CAR_BASE_RATIO);
  const CAR_W = 40;
  const CAR_H = 68;
  const BASE_FALL_SPEED = 248;
  const MAX_LEVEL = 15;
  const STORAGE_BEST_LEGACY = "threecars.best.v1";
  const STORAGE_BEST_TWO = "threecars.best.two.v1";
  const STORAGE_BEST_THREE = "threecars.best.three.v1";
  const STORAGE_MUTED = "threecars.muted.v1";
  const STORAGE_CAR_COUNT = "threecars.carcount.v1";
  const STORAGE_SPEED = "threecars.speed.v1";
  const DEFAULT_SPEED_SETTINGS = Object.freeze({
    mode: "progressive",
    fixed: 1.5,
    max: null,
  });
  const SPEED_MIN = 1;
  const SPEED_MAX = 4;
  const MAX_SPEED_MIN = 1.5;

  const CARS = [
    {
      name: "Vermelho",
      label: "Carro 01",
      hex: "#ff5573",
      rgb: "255, 85, 115",
      dark: "#4b1327",
      glass: "#ffc0cb",
      phase: 0.3,
    },
    {
      name: "Ciano",
      label: "Carro 02",
      hex: "#2ed9f6",
      rgb: "46, 217, 246",
      dark: "#073a4a",
      glass: "#b9f6ff",
      phase: 2.4,
    },
    {
      name: "Âmbar",
      label: "Carro 03",
      hex: "#ffc24f",
      rgb: "255, 194, 79",
      dark: "#4d3509",
      glass: "#ffe6b3",
      phase: 4.5,
    },
  ];

  /* ------------------------------------------------------------------ */
  /* Referências do DOM                                                  */
  /* ------------------------------------------------------------------ */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const dom = {
    shell: $("#gameShell"),
    canvas: $("#gameCanvas"),
    hud: $("#hud"),
    scoreValue: $("#scoreValue"),
    speedValue: $("#speedValue"),
    speedFill: $("#speedFill"),
    hudBest: $("#hudBest"),
    hudBestLabel: $("#hudBestLabel"),
    pauseButton: $("#pauseButton"),
    levelFlash: $("#levelFlash"),
    countdown: $("#countdown"),
    countdownValue: $("#countdownValue"),
    countdownHint: $(".countdown__hint"),
    startScreen: $("#startScreen"),
    playButton: $("#playButton"),
    startSoundButton: $("#startSoundButton"),
    aboutButton: $("#aboutButton"),
    aboutScreen: $("#aboutScreen"),
    aboutCloseButton: $("#aboutCloseButton"),
    aboutDoneButton: $("#aboutDoneButton"),
    speedSettingsButton: $("#speedSettingsButton"),
    speedScreen: $("#speedScreen"),
    speedCloseButton: $("#speedCloseButton"),
    speedDoneButton: $("#speedDoneButton"),
    speedDefaultButton: $("#speedDefaultButton"),
    speedModeButtons: $$("[data-speed-mode]"),
    fixedSpeedControl: $("#fixedSpeedControl"),
    fixedSpeedRange: $("#fixedSpeedRange"),
    fixedSpeedValue: $("#fixedSpeedValue"),
    progressiveSpeedControl: $("#progressiveSpeedControl"),
    maxSpeedSlider: $("#maxSpeedSlider"),
    maxSpeedRange: $("#maxSpeedRange"),
    maxSpeedValue: $("#maxSpeedValue"),
    unlimitedSpeed: $("#unlimitedSpeed"),
    speedStatus: $("#speedStatus"),
    pauseScreen: $("#pauseScreen"),
    pauseScore: $("#pauseScore"),
    pauseSpeed: $("#pauseSpeed"),
    pauseBest: $("#pauseBest"),
    pauseBestLabel: $("#pauseBestLabel"),
    resumeButton: $("#resumeButton"),
    pauseSoundButton: $("#pauseSoundButton"),
    restartButton: $("#restartButton"),
    pauseMenuButton: $("#pauseMenuButton"),
    gameOverScreen: $("#gameOverScreen"),
    gameOverTitle: $("#gameOverTitle"),
    gameOverReason: $("#gameOverReason"),
    finalScore: $("#finalScore"),
    finalBest: $("#finalBest"),
    finalBestLabel: $("#finalBestLabel"),
    finalSpeed: $("#finalSpeed"),
    finalCars: $("#finalCars"),
    newRecordBadge: $("#newRecordBadge"),
    playAgainButton: $("#playAgainButton"),
    gameOverMenuButton: $("#gameOverMenuButton"),
    menuBest: $("#menuBest"),
    menuBestLabel: $("#menuBestLabel"),
    gameTitleCount: $("#gameTitleCount"),
    startSubtitle: $("#startSubtitle"),
    carCountButtons: $$("[data-car-count]"),
  };

  const ctx = dom.canvas.getContext("2d");

  /* ------------------------------------------------------------------ */
  /* Estado                                                              */
  /* ------------------------------------------------------------------ */

  let carCount = loadCarCount();
  let bestScores = loadBestScores(carCount);
  let best = bestScores[carCount];
  let muted = loadMuted();
  let speedSettings = loadSpeedSettings();
  let mode = "menu";
  let sceneTime = 0;
  let roadOffset = 0;
  let countdownClock = 0;
  let countdownLabel = "";
  let levelFlashTimer = 0;
  let scorePulseTimer = 0;
  let lastFrame = performance.now();
  let scaleX = 1;
  let scaleY = 1;
  let viewportW = 0;
  let viewportH = 0;

  const game = {
    cars: [],
    objects: [],
    particles: [],
    shockwaves: [],
    popups: [],
    score: 0,
    bestAtStart: best,
    elapsed: 0,
    level: 1,
    speed: 1,
    targetSpeed: 1,
    spawnTimer: 0,
    waveCount: 0,
    collectChain: 0,
    lastCollectAt: -10,
    cameraShake: 0,
    flash: 0,
    crash: null,
    laneJitter: 0,
  };

  // Elementos puramente decorativos do fundo. Fixos para não piscarem.
  const roadSpecks = Array.from({ length: 46 }, () => ({
    x: 8 + Math.random() * (WORLD_W - 16),
    y: Math.random() * WORLD_H,
    r: 0.5 + Math.random() * 1.2,
    a: 0.025 + Math.random() * 0.07,
  }));

  const speedStreaks = Array.from({ length: 18 }, (_, index) => ({
    x:
      index % 2 === 0
        ? 8 + Math.random() * 74
        : WORLD_W - 8 - Math.random() * 74,
    y: Math.random() * WORLD_H,
    len: 18 + Math.random() * 55,
    drift: 0.4 + Math.random() * 0.8,
    alpha: 0.4 + Math.random() * 0.6,
  }));

  /* ------------------------------------------------------------------ */
  /* Persistência                                                        */
  /* ------------------------------------------------------------------ */

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* A origem pode ter armazenamento bloqueado (file://, modo privado). */
    }
  }

  function parseBestValue(value) {
    const parsed = Number.parseInt(value || "0", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function bestStorageKey(count) {
    return count === 2 ? STORAGE_BEST_TWO : STORAGE_BEST_THREE;
  }

  function loadBestScores(initialMode) {
    const twoRaw = safeGet(STORAGE_BEST_TWO);
    const threeRaw = safeGet(STORAGE_BEST_THREE);
    const scores = {
      2: parseBestValue(twoRaw),
      3: parseBestValue(threeRaw),
    };

    // Migra o recorde antigo (compartilhado) para o modo que estava ativo.
    if (twoRaw === null && threeRaw === null) {
      const legacyBest = parseBestValue(safeGet(STORAGE_BEST_LEGACY));
      if (legacyBest > 0) {
        scores[initialMode] = legacyBest;
        safeSet(bestStorageKey(initialMode), String(legacyBest));
      }
    }

    return scores;
  }

  function saveCurrentBest() {
    bestScores[carCount] = best;
    safeSet(bestStorageKey(carCount), String(best));
  }

  function loadMuted() {
    return safeGet(STORAGE_MUTED) === "1";
  }

  function saveMuted() {
    safeSet(STORAGE_MUTED, muted ? "1" : "0");
  }

  function loadCarCount() {
    const stored = Number.parseInt(safeGet(STORAGE_CAR_COUNT) || "", 10);
    return stored === 2 ? 2 : 3;
  }

  function saveCarCount() {
    safeSet(STORAGE_CAR_COUNT, String(carCount));
  }

  function normalizeSpeed(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.round(clamp(parsed, min, max) * 10) / 10;
  }

  function loadSpeedSettings() {
    let stored = null;
    try {
      stored = JSON.parse(safeGet(STORAGE_SPEED) || "null");
    } catch (error) {
      stored = null;
    }

    if (!stored || typeof stored !== "object") {
      return { ...DEFAULT_SPEED_SETTINGS };
    }

    const loadedMode = stored.mode === "fixed" ? "fixed" : "progressive";
    const loadedFixed = normalizeSpeed(
      stored.fixed,
      SPEED_MIN,
      SPEED_MAX,
      DEFAULT_SPEED_SETTINGS.fixed,
    );
    const loadedMax =
      stored.max === null || stored.max === undefined
        ? null
        : normalizeSpeed(
            stored.max,
            MAX_SPEED_MIN,
            SPEED_MAX,
            DEFAULT_SPEED_SETTINGS.max ?? 2.5,
          );

    return {
      mode: loadedMode,
      fixed: loadedFixed,
      max: loadedMax,
    };
  }

  function saveSpeedSettings() {
    safeSet(STORAGE_SPEED, JSON.stringify(speedSettings));
  }

  function isDefaultDifficulty() {
    return speedSettings.mode === "progressive" && speedSettings.max === null;
  }

  function formatSpeed(value) {
    return `${value.toFixed(1)}×`;
  }

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function formatScore(value) {
    return String(Math.max(0, Math.floor(value)));
  }

  function roadWidth() {
    return WORLD_W / carCount;
  }

  function slotX(road, side) {
    const width = roadWidth();
    return road * width + width * ROAD_POSITIONS[side];
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  /* ------------------------------------------------------------------ */
  /* Áudio                                                               */
  /* ------------------------------------------------------------------ */

  const audio = {
    context: null,

    ensure() {
      if (muted) {
        return;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      if (!this.context) {
        try {
          this.context = new AudioContextClass();
        } catch (error) {
          this.context = null;
          return;
        }
      }

      if (this.context.state === "suspended") {
        this.context.resume().catch(() => {});
      }
    },

    tone(frequency, duration, options = {}) {
      if (muted) {
        return;
      }
      this.ensure();
      if (!this.context) {
        return;
      }

      const {
        type = "sine",
        volume = 0.035,
        delay = 0,
        endFrequency = null,
      } = options;

      const context = this.context;
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(30, frequency), start);

      if (endFrequency !== null) {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(30, endFrequency),
          start + duration,
        );
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    },

    ui() {
      this.tone(480, 0.055, { type: "sine", volume: 0.022 });
    },

    switchCar(carIndex) {
      const base = 390 + carIndex * 105;
      this.tone(base, 0.045, { type: "triangle", volume: 0.017 });
      this.tone(base * 1.45, 0.075, {
        type: "sine",
        volume: 0.012,
        delay: 0.025,
      });
    },

    countdownTick(go = false) {
      if (go) {
        this.tone(560, 0.12, { volume: 0.04 });
        this.tone(840, 0.2, { volume: 0.035, delay: 0.09 });
      } else {
        this.tone(330, 0.07, { type: "square", volume: 0.018 });
      }
    },

    collect(chain = 0) {
      const step = Math.min(chain, 5);
      this.tone(620 + step * 52, 0.09, { volume: 0.03 });
      this.tone(930 + step * 58, 0.12, {
        volume: 0.021,
        delay: 0.045,
      });
    },

    levelUp() {
      this.tone(430, 0.09, { type: "triangle", volume: 0.025 });
      this.tone(645, 0.16, {
        type: "triangle",
        volume: 0.025,
        delay: 0.08,
      });
    },

    miss() {
      this.tone(420, 0.16, {
        type: "triangle",
        volume: 0.03,
        endFrequency: 170,
      });
      this.tone(190, 0.28, {
        type: "sine",
        volume: 0.023,
        delay: 0.07,
        endFrequency: 92,
      });
    },

    crash() {
      if (muted) {
        return;
      }
      this.ensure();
      if (!this.context) {
        return;
      }

      this.tone(170, 0.55, {
        type: "sawtooth",
        volume: 0.065,
        endFrequency: 34,
      });
      this.tone(88, 0.5, {
        type: "square",
        volume: 0.028,
        endFrequency: 28,
      });

      const context = this.context;
      const duration = 0.34;
      const buffer = context.createBuffer(
        1,
        Math.floor(context.sampleRate * duration),
        context.sampleRate,
      );
      const channel = buffer.getChannelData(0);

      for (let index = 0; index < channel.length; index += 1) {
        const fade = 1 - index / channel.length;
        channel[index] = (Math.random() * 2 - 1) * fade * fade;
      }

      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100, context.currentTime);
      filter.frequency.exponentialRampToValueAtTime(
        180,
        context.currentTime + duration,
      );
      gain.gain.setValueAtTime(0.06, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + duration,
      );

      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start();
      source.stop(context.currentTime + duration);
    },
  };

  /* ------------------------------------------------------------------ */
  /* Interface e som                                                     */
  /* ------------------------------------------------------------------ */

  function syncSoundUI() {
    document.body.classList.toggle("is-muted", muted);
    $$("[data-sound-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(!muted));
      button.setAttribute("aria-label", muted ? "Ativar som" : "Desativar som");
    });
    $$("[data-sound-label]").forEach((label) => {
      label.textContent = muted ? "SOM DESLIGADO" : "SOM LIGADO";
    });
  }

  function toggleSound() {
    audio.ensure();
    muted = !muted;
    saveMuted();
    syncSoundUI();
    if (!muted) {
      audio.ui();
    }
  }

  function syncCarModeUI() {
    const twoCars = carCount === 2;

    dom.gameTitleCount.textContent = twoCars ? "TWO" : "THREE";
    dom.startSubtitle.textContent = twoCars
      ? "Dois carros. Duas estradas."
      : "Três carros. Três estradas.";
    dom.carCountButtons.forEach((button) => {
      const active = Number(button.dataset.carCount) === carCount;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setCarCount(nextCount) {
    if (![2, 3].includes(nextCount) || nextCount === carCount || mode !== "menu") {
      return;
    }

    carCount = nextCount;
    best = bestScores[carCount];
    saveCarCount();
    syncCarModeUI();
    resetRoundState();
    updateMenuBest();
    audio.ui();
  }

  function syncSpeedUI() {
    const fixedMode = speedSettings.mode === "fixed";
    const defaultMode = isDefaultDifficulty();
    const maxSliderValue = Number(dom.maxSpeedRange.value) || 2.5;

    dom.speedModeButtons.forEach((button) => {
      const active = button.dataset.speedMode === speedSettings.mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });

    dom.fixedSpeedControl.hidden = !fixedMode;
    dom.progressiveSpeedControl.hidden = fixedMode;
    dom.fixedSpeedRange.value = String(speedSettings.fixed);
    dom.fixedSpeedValue.textContent = formatSpeed(speedSettings.fixed);

    const maxValue = speedSettings.max ?? maxSliderValue;
    dom.maxSpeedRange.value = String(maxValue);
    dom.maxSpeedRange.disabled = speedSettings.max === null;
    dom.maxSpeedSlider.hidden = speedSettings.max === null;
    dom.maxSpeedValue.textContent =
      speedSettings.max === null ? "Sem limite" : formatSpeed(speedSettings.max);
    dom.unlimitedSpeed.checked = speedSettings.max === null;

    dom.speedStatus.textContent = defaultMode
      ? "MODO PADRÃO · RECORDES ATIVOS"
      : "MODO PERSONALIZADO · RECORDES NÃO CONTABILIZADOS";
    dom.speedStatus.classList.toggle("is-custom", !defaultMode);

    dom.speedSettingsButton.classList.toggle("is-custom", !defaultMode);
    dom.speedSettingsButton.setAttribute(
      "aria-label",
      defaultMode
        ? "Configurações de velocidade — modo padrão"
        : "Configurações de velocidade — modo personalizado",
    );
  }

  function saveAndSyncSpeed() {
    saveSpeedSettings();
    syncSpeedUI();
  }

  function setSpeedMode(nextMode) {
    if (!["fixed", "progressive"].includes(nextMode) || nextMode === speedSettings.mode) {
      return;
    }
    speedSettings.mode = nextMode;
    saveAndSyncSpeed();
    audio.ui();
  }

  function setFixedSpeed(value) {
    speedSettings.fixed = normalizeSpeed(value, SPEED_MIN, SPEED_MAX, 1.5);
    saveAndSyncSpeed();
  }

  function setMaxSpeed(value) {
    if (speedSettings.max === null) {
      return;
    }
    speedSettings.max = normalizeSpeed(value, MAX_SPEED_MIN, SPEED_MAX, 2.5);
    saveAndSyncSpeed();
  }

  function setUnlimitedSpeed(enabled) {
    speedSettings.max = enabled
      ? null
      : normalizeSpeed(dom.maxSpeedRange.value, MAX_SPEED_MIN, SPEED_MAX, 2.5);
    saveAndSyncSpeed();
    audio.ui();
  }

  function resetSpeedSettings() {
    speedSettings = { ...DEFAULT_SPEED_SETTINGS };
    saveAndSyncSpeed();
    audio.ui();
  }

  /* ------------------------------------------------------------------ */
  /* Telas e estado do jogo                                              */
  /* ------------------------------------------------------------------ */

  function makeCars() {
    return CARS.slice(0, carCount).map((car, index) => ({
      index,
      road: index,
      side: 0,
      x: slotX(index, 0),
      visualX: slotX(index, 0),
      slideFrom: slotX(index, 0),
      slideProgress: 1,
      slideDirection: 1,
      togglePulse: 0,
      tilt: 0,
      pulse: 0,
      phase: car.phase,
      hit: false,
    }));
  }

  function resetRoundState() {
    game.cars = makeCars();
    game.objects = [];
    game.particles = [];
    game.shockwaves = [];
    game.popups = [];
    game.score = 0;
    game.bestAtStart = best;
    game.elapsed = 0;
    game.level = 1;
    const startSpeed = initialSpeed();
    game.speed = startSpeed;
    game.targetSpeed = startSpeed;
    game.spawnTimer = 0.45;
    game.waveCount = 0;
    game.collectChain = 0;
    game.lastCollectAt = -10;
    game.cameraShake = 0;
    game.flash = 0;
    game.crash = null;
    window.clearTimeout(levelFlashTimer);
    dom.levelFlash.classList.remove("is-visible");
    updateScoreHUD();
    updateSpeedHUD(true);
    updateBestHUD();
    dom.hud.classList.remove("is-visible");
    dom.hud.setAttribute("aria-hidden", "true");
  }

  function resetToMenu() {
    mode = "menu";
    window.clearTimeout(levelFlashTimer);
    dom.levelFlash.classList.remove("is-visible");
    dom.countdown.hidden = true;
    hideScreens();
    dom.startScreen.hidden = false;
    dom.hud.classList.remove("is-visible");
    dom.hud.setAttribute("aria-hidden", "true");
    resetRoundState();
    updateMenuBest();
    sceneTime = 0;
    roadOffset = 0;
  }

  function hideScreens() {
    dom.startScreen.hidden = true;
    dom.pauseScreen.hidden = true;
    dom.gameOverScreen.hidden = true;
    dom.aboutScreen.hidden = true;
    dom.speedScreen.hidden = true;
  }

  function openAbout() {
    if (mode !== "menu") {
      return;
    }
    dom.aboutScreen.hidden = false;
    audio.ui();
  }

  function closeAbout() {
    dom.aboutScreen.hidden = true;
    audio.ui();
  }

  function openSpeedSettings() {
    if (mode !== "menu") {
      return;
    }
    syncSpeedUI();
    dom.speedScreen.hidden = false;
    audio.ui();
  }

  function closeSpeedSettings() {
    dom.speedScreen.hidden = true;
    audio.ui();
  }

  function startRound() {
    if (!["menu", "paused", "gameover"].includes(mode)) {
      return;
    }

    audio.ensure();
    hideScreens();
    resetRoundState();
    dom.hud.classList.add("is-visible");
    dom.hud.setAttribute("aria-hidden", "false");
    dom.countdown.hidden = false;
    dom.countdownHint.textContent = "PREPARE OS DEDOS";
    countdownClock = 0;
    countdownLabel = "";
    setCountdownLabel("3", false);
    mode = "countdown";
    roadOffset = 0;
    sceneTime = 0;
  }

  function pauseGame() {
    if (mode !== "playing") {
      return;
    }

    mode = "paused";
    updatePauseStats();
    hideScreens();
    dom.pauseScreen.hidden = false;
    audio.ui();
  }

  function resumeGame() {
    if (mode !== "paused") {
      return;
    }

    hideScreens();
    mode = "playing";
    audio.ui();
  }

  function returnToMenu() {
    resetToMenu();
    audio.ui();
  }

  function setCountdownLabel(label, playSound = true) {
    if (label === countdownLabel) {
      return;
    }

    countdownLabel = label;
    dom.countdownValue.textContent = label;
    dom.countdownValue.classList.toggle("is-go", label === "VAI!");
    dom.countdownValue.classList.remove("is-beat");
    void dom.countdownValue.offsetWidth;
    dom.countdownValue.classList.add("is-beat");

    if (playSound) {
      audio.countdownTick(label === "VAI!");
    }
  }

  function beginPlaying() {
    mode = "playing";
    dom.countdown.hidden = true;
    game.spawnTimer = 0.38;
    game.elapsed = 0;
    audio.tone(680, 0.14, { type: "triangle", volume: 0.03 });
  }

  function finishCrash() {
    if (mode !== "crashing") {
      return;
    }

    mode = "gameover";
    const crash = game.crash;
    const reason = crash?.reason || "block";
    game.crash = null;
    dom.hud.classList.remove("is-visible");
    dom.hud.setAttribute("aria-hidden", "true");

    recordBestIfNeeded();

    const crashedIndex = crash?.carIndex ?? game.crashCarIndex ?? 0;
    const crashedCar = CARS[crashedIndex] || CARS[0];
    const missedCircle = reason === "miss";

    dom.gameOverTitle.classList.toggle("is-miss-title", missedCircle);
    dom.gameOverTitle.innerHTML = missedCircle
      ? 'CÍRCULO<br>PERDIDO<span>.</span>'
      : 'BATIDA<span>.</span>';
    dom.finalScore.textContent = formatScore(game.score);
    dom.finalBest.textContent = formatScore(best);
    dom.finalSpeed.textContent = game.speed.toFixed(1);
    dom.finalCars.textContent = missedCircle
      ? "CÍRCULO PERDIDO"
      : `${crashedCar.label.toUpperCase()} ATINGIDO`;
    dom.gameOverReason.textContent = missedCircle
      ? `Um círculo passou pela estrada do ${crashedCar.label}. Colete todos para continuar.`
      : `${crashedCar.label} (${crashedCar.name.toLowerCase()}) encontrou um bloco.`;
    dom.newRecordBadge.hidden = !(
      isDefaultDifficulty() &&
      game.score > game.bestAtStart &&
      game.score > 0
    );

    updateBestHUD();
    updateMenuBest();
    hideScreens();
    dom.gameOverScreen.hidden = false;
  }

  function updateMenuBest() {
    dom.menuBest.textContent = formatScore(best);
  }

  function updateBestHUD() {
    dom.hudBest.textContent = formatScore(best);
    dom.pauseBest.textContent = formatScore(best);
    dom.menuBest.textContent = formatScore(best);
    dom.hudBestLabel.textContent = `RECORDE ${carCount}C`;
    dom.pauseBestLabel.textContent = `RECORDE ${carCount}C`;
    dom.finalBestLabel.textContent = `RECORDE ${carCount}C`;
    dom.menuBestLabel.textContent = `RECORDE · ${carCount} CARROS`;
  }

  function recordBestIfNeeded() {
    if (!isDefaultDifficulty() || game.score <= best) {
      return;
    }

    best = game.score;
    saveCurrentBest();
    updateBestHUD();
  }

  function updatePauseStats() {
    dom.pauseScore.textContent = formatScore(game.score);
    dom.pauseSpeed.textContent = game.speed.toFixed(1);
    dom.pauseBest.textContent = formatScore(best);
  }

  function updateScoreHUD() {
    dom.scoreValue.textContent = formatScore(game.score);
    dom.scoreValue.classList.remove("is-pulsing");
    void dom.scoreValue.offsetWidth;
    dom.scoreValue.classList.add("is-pulsing");
    window.clearTimeout(scorePulseTimer);
    scorePulseTimer = window.setTimeout(() => {
      dom.scoreValue.classList.remove("is-pulsing");
    }, 130);
  }

  function updateSpeedHUD(force = false) {
    const shown = game.speed.toFixed(1);
    if (force || dom.speedValue.textContent !== shown) {
      dom.speedValue.textContent = shown;
    }
    const progress = clamp((game.speed - 1) / 3, 0, 1);
    const fill = 4 + progress * 96;
    dom.speedFill.style.width = `${fill.toFixed(1)}%`;
    dom.pauseSpeed.textContent = shown;
  }

  function showLevelFlash(level, speed) {
    window.clearTimeout(levelFlashTimer);
    const speedSuffix =
      speedSettings.mode === "fixed" ? "" : ` · ${speed.toFixed(1)}×`;
    dom.levelFlash.textContent = `NÍVEL ${String(level).padStart(2, "0")}${speedSuffix}`;
    dom.levelFlash.classList.add("is-visible");
    levelFlashTimer = window.setTimeout(() => {
      dom.levelFlash.classList.remove("is-visible");
    }, 1500);
  }

  /* ------------------------------------------------------------------ */
  /* Entrada                                                             */
  /* ------------------------------------------------------------------ */

  function toggleCar(carIndex) {
    if (mode !== "playing") {
      return;
    }

    const car = game.cars[carIndex];
    if (!car || car.hit) {
      return;
    }

    const previousX = Number.isFinite(car.visualX) ? car.visualX : car.x;
    car.side = car.side === 0 ? 1 : 0;
    car.x = slotX(car.road, car.side);
    car.slideFrom = previousX;
    car.slideProgress = 0;
    car.slideDirection = car.x >= previousX ? 1 : -1;
    car.togglePulse = 1;
    car.tilt = 0;
    audio.switchCar(carIndex);
  }

  function handleRoadPointerDown(event) {
    if (mode !== "playing") {
      return;
    }

    const rect = dom.canvas.getBoundingClientRect();
    if (!rect.width) {
      return;
    }

    const relativeX = (event.clientX - rect.left) / rect.width;
    if (relativeX < 0 || relativeX > 1) {
      return;
    }

    event.preventDefault();
    const carIndex = Math.min(
      carCount - 1,
      Math.floor(relativeX * carCount),
    );
    toggleCar(carIndex);
  }

  function handlePointerDown() {
    audio.ensure();
  }

  function togglePauseFromButton() {
    if (mode === "playing") {
      pauseGame();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Efeitos e colisões                                                  */
  /* ------------------------------------------------------------------ */

  function emitCollect(car, object) {
    const color = CARS[object.colorIndex] || CARS[0];
    game.shockwaves.push({
      x: object.x,
      y: object.y,
      life: 0.42,
      maxLife: 0.42,
      color: color.rgb,
      size: 8,
    });

    for (let index = 0; index < 11; index += 1) {
      const angle = (Math.PI * 2 * index) / 11 + Math.random() * 0.4;
      const velocity = randomBetween(55, 160);
      game.particles.push({
        x: object.x + Math.cos(angle) * 8,
        y: object.y + Math.sin(angle) * 8,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 15,
        life: randomBetween(0.32, 0.62),
        maxLife: 0.62,
        size: randomBetween(1.4, 3),
        color: color.rgb,
        gravity: 100,
        square: false,
      });
    }

    game.popups.push({
      x: object.x,
      y: object.y - 12,
      text: "+1",
      life: 0.7,
      maxLife: 0.7,
      color: color.hex,
    });

    car.pulse = 1;
  }

  function emitCrash(x, y, car) {
    const color = CARS[car.index];

    for (let index = 0; index < 42; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = randomBetween(30, 360);
      game.particles.push({
        x: x + randomBetween(-8, 8),
        y: y + randomBetween(-10, 10),
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 80,
        life: randomBetween(0.35, 1.05),
        maxLife: 1.05,
        size: randomBetween(1.5, 5),
        color: Math.random() < 0.3 ? "255, 235, 207" : color.rgb,
        gravity: 300,
        square: Math.random() < 0.45,
      });
    }

    game.shockwaves.push({
      x,
      y,
      life: 0.65,
      maxLife: 0.65,
      color: color.rgb,
      size: 18,
    });
    game.shockwaves.push({
      x,
      y,
      life: 0.9,
      maxLife: 0.9,
      color: "255, 112, 127",
      size: 42,
    });
  }

  function vibrate(pattern) {
    if (!navigator.vibrate) {
      return;
    }
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      /* Vibração é opcional. */
    }
  }

  function crash(car, object) {
    if (mode !== "playing") {
      return;
    }

    mode = "crashing";
    car.hit = true;
    game.crash = {
      reason: "block",
      carIndex: car.index,
      time: 0,
      spin: randomBetween(-0.09, 0.09),
    };
    game.crashCarIndex = car.index;
    game.cameraShake = 21;
    game.flash = 0.8;

    emitCrash(car.x, CAR_BASE_Y - 6, car);
    game.objects = game.objects.filter((item) => item !== object);
    audio.crash();
    vibrate([35, 26, 70]);
  }

  function missCircle(car, object) {
    if (mode !== "playing") {
      return;
    }

    mode = "crashing";
    game.crash = {
      reason: "miss",
      carIndex: car.index,
      time: 0,
      spin: 0,
    };
    game.crashCarIndex = car.index;
    game.cameraShake = 8;
    game.flash = 0.62;
    car.pulse = 1;

    game.objects = game.objects.filter((item) => item !== object);
    game.shockwaves.push({
      x: object.x,
      y: CAR_BASE_Y + 44,
      life: 0.72,
      maxLife: 0.72,
      color: CARS[car.index].rgb,
      size: 14,
    });
    game.popups.push({
      x: object.x,
      y: CAR_BASE_Y - 54,
      text: "PERDIDO",
      life: 0.92,
      maxLife: 0.92,
      color: CARS[car.index].hex,
    });
    audio.miss();
    vibrate([18, 24, 45]);
  }

  function updateEffects(delta) {
    for (let index = game.particles.length - 1; index >= 0; index -= 1) {
      const particle = game.particles[index];
      particle.life -= delta;
      if (particle.life <= 0) {
        game.particles.splice(index, 1);
        continue;
      }
      particle.vy += particle.gravity * delta;
      particle.vx *= Math.pow(0.12, delta);
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
    }

    for (let index = game.shockwaves.length - 1; index >= 0; index -= 1) {
      const wave = game.shockwaves[index];
      wave.life -= delta;
      if (wave.life <= 0) {
        game.shockwaves.splice(index, 1);
      }
    }

    for (let index = game.popups.length - 1; index >= 0; index -= 1) {
      const popup = game.popups[index];
      popup.life -= delta;
      popup.y -= 36 * delta;
      if (popup.life <= 0) {
        game.popups.splice(index, 1);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Geração de obstáculos e atualização da partida                      */
  /* ------------------------------------------------------------------ */

  function spawnWave() {
    const progress = (game.level - 1) / (MAX_LEVEL - 1);
    const tutorial = game.waveCount < 2;
    const hazardChance = 0.33 + progress * 0.17;

    // Uma escolha por estrada: sempre há uma das duas posições livre.
    for (let road = 0; road < carCount; road += 1) {
      const side = Math.random() < 0.5 ? 0 : 1;
      const isHazard = tutorial ? false : Math.random() < hazardChance;
      const y = -58 - randomBetween(0, 90);

      game.objects.push({
        type: isHazard ? "block" : "ring",
        x: slotX(road, side),
        y,
        road,
        side,
        colorIndex: road,
        phase: Math.random() * Math.PI * 2,
        spin: randomBetween(-0.08, 0.08),
        dead: false,
      });
    }

    game.waveCount += 1;
  }

  function updateCars(delta) {
    const slideDuration = 0.2;

    for (const car of game.cars) {
      const progress = Math.min(1, car.slideProgress + delta / slideDuration);
      car.slideProgress = progress;
      const eased = 1 - Math.pow(1 - progress, 3);
      car.visualX = lerp(car.slideFrom, car.x, eased);

      if (progress < 1) {
        car.tilt = car.slideDirection * 0.14 * Math.sin(progress * Math.PI);
      } else {
        car.tilt = lerp(car.tilt, 0, clamp(delta * 16, 0, 1));
      }

      car.togglePulse = Math.max(0, car.togglePulse - delta * 4.4);
      car.pulse = Math.max(0, car.pulse - delta * 3.2);
    }
  }

  function initialSpeed() {
    return speedSettings.mode === "fixed" ? speedSettings.fixed : 1;
  }

  function updateDifficulty(delta) {
    const progression = game.score / 5 + game.elapsed / 15;
    const nextLevel = Math.min(MAX_LEVEL, 1 + Math.floor(progression));
    let targetSpeed;

    if (speedSettings.mode === "fixed") {
      targetSpeed = speedSettings.fixed;
    } else {
      // A progressão continua depois do nível 15 no modo sem limite.
      targetSpeed = 1 + Math.floor(progression) * 0.09;
      if (speedSettings.max !== null) {
        targetSpeed = Math.min(targetSpeed, speedSettings.max);
      }
    }

    if (nextLevel !== game.level) {
      game.level = nextLevel;
      audio.levelUp();
      showLevelFlash(game.level, targetSpeed);
    }

    game.targetSpeed = targetSpeed;
    game.speed = lerp(
      game.speed,
      game.targetSpeed,
      clamp(delta * 1.45, 0, 1),
    );
  }

  function updateSpawn(delta) {
    game.spawnTimer -= delta;
    if (game.spawnTimer > 0) {
      return;
    }

    spawnWave();

    const progress = (game.level - 1) / (MAX_LEVEL - 1);
    const baseInterval = lerp(1.02, 0.56, progress);
    game.spawnTimer = baseInterval * randomBetween(0.9, 1.12);
  }

  function updateObjects(delta) {
    const fallSpeed = BASE_FALL_SPEED * game.speed;

    for (let index = game.objects.length - 1; index >= 0; index -= 1) {
      const object = game.objects[index];
      object.y += fallSpeed * delta;
      object.phase += delta;

      if (object.y > WORLD_H + 72) {
        game.objects.splice(index, 1);
        continue;
      }

      if (object.dead) {
        continue;
      }

      for (const car of game.cars) {
        if (car.hit) {
          continue;
        }

        const radius = object.type === "ring" ? 15 : 13.5;
        const hit =
          Math.abs(object.x - car.x) < 16 + radius &&
          Math.abs(object.y - (CAR_BASE_Y - 2)) < 26 + radius;

        if (!hit) {
          continue;
        }

        if (object.type === "ring") {
          object.dead = true;
          game.objects.splice(index, 1);
          game.score += 1;
          const now = game.elapsed;
          game.collectChain = now - game.lastCollectAt < 1.15 ? game.collectChain + 1 : 0;
          game.lastCollectAt = now;
          car.pulse = 1;
          emitCollect(car, object);
          updateScoreHUD();

          recordBestIfNeeded();

          audio.collect(game.collectChain);
          break;
        }

        if (object.type === "block") {
          crash(car, object);
          break;
        }
      }

      if (mode !== "playing") {
        break;
      }

      // O círculo já passou da linha dos carros: não há mais como coletá-lo.
      if (
        !object.dead &&
        object.type === "ring" &&
        object.y > CAR_BASE_Y + 46
      ) {
        const roadCar = game.cars[object.road] || game.cars[0];
        missCircle(roadCar, object);
        break;
      }
    }
  }

  function updatePlaying(delta) {
    game.elapsed += delta;
    roadOffset += (72 + game.speed * 72) * delta;

    updateDifficulty(delta);
    updateSpawn(delta);
    updateCars(delta);
    updateObjects(delta);
    updateEffects(delta);

    game.cameraShake = Math.max(0, game.cameraShake - 65 * delta);
    game.flash = Math.max(0, game.flash - 2.1 * delta);
    updateSpeedHUD();
  }

  function updateCrashState(delta) {
    if (!game.crash) {
      return;
    }

    game.crash.time += delta;
    game.cameraShake = Math.max(0, game.cameraShake - 38 * delta);
    game.flash = Math.max(0, game.flash - 1.8 * delta);
    updateEffects(delta);

    if (game.crash.time >= 0.98) {
      finishCrash();
    }
  }

  function updateCountdown(delta) {
    countdownClock += delta;
    sceneTime += delta;
    roadOffset += 22 * delta;

    if (countdownClock < 0.48) {
      setCountdownLabel("3");
    } else if (countdownClock < 0.96) {
      setCountdownLabel("2");
    } else if (countdownClock < 1.44) {
      setCountdownLabel("1");
    } else if (countdownClock < 1.82) {
      if (countdownLabel !== "VAI!") {
        dom.countdownHint.textContent = "BOA SORTE";
      }
      setCountdownLabel("VAI!");
    } else {
      beginPlaying();
    }
  }

  function updateMenu(delta) {
    sceneTime += delta;
    roadOffset += 31 * delta;

    for (const car of game.cars) {
      car.side = 0;
      car.x = slotX(car.road, 0);
      car.visualX = car.x;
      car.slideFrom = car.x;
      car.slideProgress = 1;
      car.togglePulse = 0;
      car.tilt = lerp(car.tilt, 0, clamp(delta * 6, 0, 1));
      car.pulse = 0;
    }
  }

  function update(delta) {
    switch (mode) {
      case "menu":
        updateMenu(delta);
        break;
      case "countdown":
        updateCountdown(delta);
        break;
      case "playing":
        sceneTime += delta;
        updatePlaying(delta);
        break;
      case "crashing":
        sceneTime += delta;
        updateCrashState(delta);
        break;
      case "gameover":
        updateEffects(delta);
        game.cameraShake = Math.max(0, game.cameraShake - 38 * delta);
        game.flash = Math.max(0, game.flash - 1.8 * delta);
        break;
      case "paused":
      default:
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Desenho                                                             */
  /* ------------------------------------------------------------------ */

  function resizeCanvas() {
    const rect = dom.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    const nextWorldH = clamp(
      Math.round(WORLD_W * (rect.height / rect.width)),
      720,
      1600,
    );

    if (nextWorldH !== WORLD_H) {
      const ratio = nextWorldH / WORLD_H;
      for (const speck of roadSpecks) {
        speck.y *= ratio;
      }
      for (const streak of speedStreaks) {
        streak.y *= ratio;
      }
      for (const object of game.objects) {
        object.y *= ratio;
      }
      WORLD_H = nextWorldH;
      CAR_BASE_Y = Math.round(WORLD_H * CAR_BASE_RATIO);
    }

    if (dom.canvas.width !== targetW || dom.canvas.height !== targetH) {
      dom.canvas.width = targetW;
      dom.canvas.height = targetH;
    }

    viewportW = targetW;
    viewportH = targetH;
    scaleX = targetW / WORLD_W;
    scaleY = targetH / WORLD_H;
  }

  function drawBackground() {
    const background = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    background.addColorStop(0, "#070d25");
    background.addColorStop(0.32, "#0b1538");
    background.addColorStop(0.66, "#0c1942");
    background.addColorStop(1, "#081027");
    ctx.fillStyle = background;
    ctx.fillRect(-30, -30, WORLD_W + 60, WORLD_H + 60);

    const topHaze = ctx.createRadialGradient(
      WORLD_W * 0.5,
      -110,
      20,
      WORLD_W * 0.5,
      -30,
      390,
    );
    topHaze.addColorStop(0, "rgba(76, 120, 255, 0.2)");
    topHaze.addColorStop(0.55, "rgba(37, 67, 157, 0.07)");
    topHaze.addColorStop(1, "rgba(8, 16, 40, 0)");
    ctx.fillStyle = topHaze;
    ctx.fillRect(0, 0, WORLD_W, 430);

    // Faixas laterais, como um acostamento escuro.
    const leftEdge = ctx.createLinearGradient(0, 0, 80, 0);
    leftEdge.addColorStop(0, "rgba(2, 5, 17, 0.72)");
    leftEdge.addColorStop(0.55, "rgba(4, 9, 26, 0.21)");
    leftEdge.addColorStop(1, "rgba(4, 9, 26, 0)");
    ctx.fillStyle = leftEdge;
    ctx.fillRect(0, 0, 80, WORLD_H);

    const rightEdge = ctx.createLinearGradient(WORLD_W, 0, WORLD_W - 80, 0);
    rightEdge.addColorStop(0, "rgba(2, 5, 17, 0.72)");
    rightEdge.addColorStop(0.55, "rgba(4, 9, 26, 0.21)");
    rightEdge.addColorStop(1, "rgba(4, 9, 26, 0)");
    ctx.fillStyle = rightEdge;
    ctx.fillRect(WORLD_W - 80, 0, 80, WORLD_H);

    ctx.save();

    // Pequenos pontos fixos dão textura ao asfalto.
    for (const speck of roadSpecks) {
      ctx.fillStyle = `rgba(159, 183, 255, ${speck.a})`;
      ctx.beginPath();
      ctx.arc(speck.x, speck.y, speck.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const width = roadWidth();
    const dividers = Array.from(
      { length: carCount },
      (_, road) => (road + 0.5) * width,
    );
    const boundaries = Array.from(
      { length: carCount - 1 },
      (_, road) => (road + 1) * width,
    );
    const allLines = [...dividers, ...boundaries].sort(
      (left, right) => left - right,
    );

    // Cada estrada recebe uma presença sutil da cor do seu carro.
    for (let road = 0; road < carCount; road += 1) {
      const config = CARS[road];
      const left = road * width;
      const roadTint = ctx.createLinearGradient(0, WORLD_H * 0.12, 0, WORLD_H);
      roadTint.addColorStop(0, `rgba(${config.rgb}, 0)`);
      roadTint.addColorStop(0.55, `rgba(${config.rgb}, 0.012)`);
      roadTint.addColorStop(1, `rgba(${config.rgb}, 0.042)`);
      ctx.fillStyle = roadTint;
      ctx.fillRect(left, 0, width, WORLD_H);
    }

    // Linhas internas separam as duas posições; as bordas separam as estradas.
    for (const x of dividers) {
      ctx.strokeStyle = "rgba(120, 149, 255, 0.045)";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
      ctx.stroke();

      ctx.strokeStyle = "rgba(137, 164, 255, 0.13)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, WORLD_H);
      ctx.stroke();
    }

    for (const x of boundaries) {
      // Um pequeno vão escuro separa fisicamente as estradas.
      const gutter = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
      gutter.addColorStop(0, "rgba(3, 7, 19, 0)");
      gutter.addColorStop(0.5, "rgba(2, 5, 14, 0.5)");
      gutter.addColorStop(1, "rgba(3, 7, 19, 0)");
      ctx.fillStyle = gutter;
      ctx.fillRect(x - 8, 0, 16, WORLD_H);

      ctx.strokeStyle = "rgba(102, 145, 255, 0.1)";
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
      ctx.stroke();

      // Linha dupla: o limite da estrada fica evidente mesmo em movimento.
      for (const offset of [-3, 3]) {
        ctx.strokeStyle = "rgba(180, 203, 255, 0.42)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + offset + 0.5, 0);
        ctx.lineTo(x + offset + 0.5, WORLD_H);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(136, 172, 255, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, WORLD_H);
      ctx.stroke();
    }

    // Brilhos que correm pelas linhas e reforçam a sensação de velocidade.
    const glintSpacing = 248;
    const glintOffset = roadOffset % glintSpacing;
    for (const x of allLines) {
      const isBoundary = boundaries.includes(x);
      for (let row = -1; row < 5; row += 1) {
        const y = row * glintSpacing + glintOffset;
        const glow = ctx.createLinearGradient(0, y - 44, 0, y + 44);
        glow.addColorStop(0, "rgba(114, 164, 255, 0)");
        glow.addColorStop(
          0.5,
          isBoundary ? "rgba(138, 187, 255, 0.3)" : "rgba(126, 181, 255, 0.17)",
        );
        glow.addColorStop(1, "rgba(114, 164, 255, 0)");
        ctx.strokeStyle = glow;
        ctx.lineWidth = isBoundary ? 1.7 : 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y - 44);
        ctx.lineTo(x + 0.5, y + 44);
        ctx.stroke();
      }
    }

    // Linhas de velocidade nos acostamentos.
    const intensity = clamp((game.speed - 1) / 1.3, 0, 1);
    ctx.lineCap = "round";
    for (const streak of speedStreaks) {
      const travel = roadOffset * (0.8 + streak.drift) * (1 + intensity);
      const y = (streak.y + travel) % (WORLD_H + 140) - 70;
      ctx.strokeStyle = `rgba(120, 168, 255, ${0.035 + intensity * 0.075})`;
      ctx.lineWidth = 1;
      ctx.globalAlpha = streak.alpha;
      ctx.beginPath();
      ctx.moveTo(streak.x, y);
      ctx.lineTo(streak.x, y + streak.len * (0.65 + intensity * 0.8));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Vinheta e profundidade.
    const vignette = ctx.createRadialGradient(
      WORLD_W * 0.5,
      WORLD_H * 0.45,
      WORLD_W * 0.14,
      WORLD_W * 0.5,
      WORLD_H * 0.48,
      WORLD_H * 0.73,
    );
    vignette.addColorStop(0, "rgba(3, 6, 19, 0)");
    vignette.addColorStop(0.7, "rgba(3, 6, 19, 0.16)");
    vignette.addColorStop(1, "rgba(3, 6, 19, 0.62)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    const topShade = ctx.createLinearGradient(0, 0, 0, 205);
    topShade.addColorStop(0, "rgba(4, 8, 22, 0.68)");
    topShade.addColorStop(1, "rgba(4, 8, 22, 0)");
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, WORLD_W, 205);

    const bottomShade = ctx.createLinearGradient(0, WORLD_H - 205, 0, WORLD_H);
    bottomShade.addColorStop(0, "rgba(3, 7, 19, 0)");
    bottomShade.addColorStop(1, "rgba(3, 7, 19, 0.7)");
    ctx.fillStyle = bottomShade;
    ctx.fillRect(0, WORLD_H - 205, WORLD_W, 205);

    ctx.restore();
  }

  function drawSpeedStreaksForeground() {
    const intensity = clamp((game.speed - 1) / 1.3, 0, 1);
    if (intensity <= 0.01) {
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let index = 0; index < 9; index += 1) {
      const x = 18 + ((index * 73 + roadOffset * 0.12) % (WORLD_W - 36));
      const y = (index * 167 + roadOffset * 1.8) % WORLD_H;
      const alpha = 0.015 + intensity * 0.03;
      ctx.strokeStyle = `rgba(134, 181, 255, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 40 + intensity * 90);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawObject(object) {
    const color = CARS[object.colorIndex] || CARS[0];
    const bob = Math.sin(sceneTime * 2.7 + object.phase) * 1.2;

    ctx.save();
    ctx.translate(object.x, object.y + bob);

    if (object.type === "ring") {
      const pulse = 1 + Math.sin(sceneTime * 4.2 + object.phase) * 0.055;
      ctx.scale(pulse, pulse);

      const halo = ctx.createRadialGradient(0, 0, 3, 0, 0, 34);
      halo.addColorStop(0, `rgba(${color.rgb}, 0.2)`);
      halo.addColorStop(0.6, `rgba(${color.rgb}, 0.06)`);
      halo.addColorStop(1, `rgba(${color.rgb}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = color.hex;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = color.hex;
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.arc(0, 0, 15.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.26;
      ctx.strokeStyle = color.glass;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 20.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.74;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 15.5, -2.6, -1.85);
      ctx.stroke();
    } else {
      const wobble = Math.sin(sceneTime * 1.9 + object.phase) * 0.045;
      ctx.rotate(wobble);

      const halo = ctx.createRadialGradient(0, 0, 5, 0, 0, 31);
      halo.addColorStop(0, `rgba(${color.rgb}, 0.13)`);
      halo.addColorStop(1, `rgba(${color.rgb}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 31, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = color.hex;
      ctx.shadowBlur = 17;

      const blockFill = ctx.createLinearGradient(0, -14, 0, 14);
      blockFill.addColorStop(0, color.glass);
      blockFill.addColorStop(0.42, color.hex);
      blockFill.addColorStop(1, color.hex);
      roundedRectPath(ctx, -14, -14, 28, 28, 5.5);
      ctx.fillStyle = blockFill;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.48)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = "#ffffff";
      roundedRectPath(ctx, -9, -10.5, 18, 3, 1.5);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCar(car) {
    const config = CARS[car.index];
    const bob = Math.sin(sceneTime * 2.15 + car.phase) * 1.6;
    const menuDrift =
      mode === "menu" ? Math.sin(sceneTime * 0.7 + car.phase) * 3 : 0;
    const crashTime = game.crash && game.crash.carIndex === car.index ? game.crash.time : 0;
    const crashTilt = crashTime ? crashTime * 2.2 * (game.crash.spin > 0 ? 1 : -1) : 0;
    const x = car.visualX + menuDrift;
    const parkedY = mode === "menu" ? CAR_BASE_Y - 150 : CAR_BASE_Y;
    const y = parkedY + bob;

    // Rastro curto deixando claro o salto entre as duas posições da estrada.
    if (car.togglePulse > 0 && mode !== "menu" && !car.hit) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(${config.rgb}, ${car.togglePulse * 0.45})`;
      ctx.lineWidth = 2 + car.togglePulse * 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(car.slideFrom, y + CAR_H * 0.22);
      ctx.lineTo(x, y + CAR_H * 0.22);
      ctx.stroke();

      ctx.fillStyle = `rgba(${config.rgb}, ${car.togglePulse * 0.35})`;
      ctx.beginPath();
      ctx.arc(car.slideFrom, y + CAR_H * 0.22, 2 + car.togglePulse * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.tilt + crashTilt);

    if (mode === "menu") {
      ctx.globalAlpha = 0.86;
    }

    if (car.hit) {
      ctx.globalAlpha = 0.38 + Math.sin(sceneTime * 38) * 0.17;
    }

    // Brilho no chão.
    ctx.save();
    ctx.translate(0, CAR_H * 0.48);
    ctx.globalCompositeOperation = "lighter";
    const groundGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 37);
    groundGlow.addColorStop(0, `rgba(${config.rgb}, 0.18)`);
    groundGlow.addColorStop(0.52, `rgba(${config.rgb}, 0.08)`);
    groundGlow.addColorStop(1, `rgba(${config.rgb}, 0)`);
    ctx.fillStyle = groundGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 37, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Feixes dos faróis.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const beam = ctx.createLinearGradient(0, -CAR_H * 0.5, 0, -CAR_H * 0.5 - 120);
    beam.addColorStop(0, `rgba(${config.rgb}, 0.11)`);
    beam.addColorStop(0.45, `rgba(${config.rgb}, 0.045)`);
    beam.addColorStop(1, `rgba(${config.rgb}, 0)`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-CAR_W * 0.32, -CAR_H * 0.46);
    ctx.lineTo(-CAR_W * 0.76, -CAR_H * 0.5 - 118);
    ctx.lineTo(CAR_W * 0.76, -CAR_H * 0.5 - 118);
    ctx.lineTo(CAR_W * 0.32, -CAR_H * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Rodas laterais.
    ctx.fillStyle = "#020713";
    roundedRectPath(ctx, -CAR_W * 0.5 - 2.4, -CAR_H * 0.25, 5, 17, 2.2);
    ctx.fill();
    roundedRectPath(ctx, CAR_W * 0.5 - 2.6, -CAR_H * 0.25, 5, 17, 2.2);
    ctx.fill();
    roundedRectPath(ctx, -CAR_W * 0.5 - 2.4, CAR_H * 0.08, 5, 17, 2.2);
    ctx.fill();
    roundedRectPath(ctx, CAR_W * 0.5 - 2.6, CAR_H * 0.08, 5, 17, 2.2);
    ctx.fill();

    // Carroceria.
    const body = ctx.createLinearGradient(0, -CAR_H * 0.5, 0, CAR_H * 0.5);
    body.addColorStop(0, "#0b1733");
    body.addColorStop(0.5, "#071023");
    body.addColorStop(1, "#040a19");
    ctx.shadowColor = config.hex;
    ctx.shadowBlur = car.hit ? 24 : 14;
    roundedRectPath(ctx, -CAR_W * 0.5, -CAR_H * 0.5, CAR_W, CAR_H, 11);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = config.hex;
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Recorte interno para dar volume à carroceria.
    ctx.shadowBlur = 0;
    ctx.save();
    roundedRectPath(ctx, -CAR_W * 0.5 + 3.2, -CAR_H * 0.5 + 3.2, CAR_W - 6.4, CAR_H - 6.4, 8.5);
    ctx.clip();

    const nose = ctx.createLinearGradient(0, -CAR_H * 0.42, 0, CAR_H * 0.08);
    nose.addColorStop(0, `rgba(${config.rgb}, 0.2)`);
    nose.addColorStop(1, `rgba(${config.rgb}, 0.025)`);
    ctx.fillStyle = nose;
    ctx.fillRect(-CAR_W, -CAR_H * 0.5, CAR_W * 2, CAR_H * 0.63);

    ctx.fillStyle = `rgba(${config.rgb}, 0.22)`;
    ctx.fillRect(-CAR_W * 0.5 + 4, -CAR_H * 0.1, CAR_W - 8, 2);

    // Para-brisa dianteiro.
    const frontGlass = ctx.createLinearGradient(0, -CAR_H * 0.34, 0, -CAR_H * 0.1);
    frontGlass.addColorStop(0, "rgba(171, 218, 255, 0.32)");
    frontGlass.addColorStop(1, "rgba(35, 75, 114, 0.28)");
    roundedRectPath(ctx, -CAR_W * 0.3, -CAR_H * 0.33, CAR_W * 0.6, CAR_H * 0.21, 4.5);
    ctx.fillStyle = frontGlass;
    ctx.fill();
    ctx.strokeStyle = "rgba(220, 243, 255, 0.22)";
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Vidro traseiro.
    const rearGlass = ctx.createLinearGradient(0, CAR_H * 0.12, 0, CAR_H * 0.31);
    rearGlass.addColorStop(0, "rgba(48, 92, 134, 0.28)");
    rearGlass.addColorStop(1, "rgba(166, 214, 255, 0.2)");
    roundedRectPath(ctx, -CAR_W * 0.28, CAR_H * 0.12, CAR_W * 0.56, CAR_H * 0.18, 4);
    ctx.fillStyle = rearGlass;
    ctx.fill();
    ctx.strokeStyle = "rgba(220, 243, 255, 0.14)";
    ctx.stroke();

    // Coluna central da cabine.
    ctx.fillStyle = `rgba(${config.rgb}, 0.33)`;
    ctx.fillRect(-CAR_W * 0.035, -CAR_H * 0.34, CAR_W * 0.07, CAR_H * 0.64);

    ctx.restore();

    // Número da frota, discreto no capô.
    ctx.fillStyle = `rgba(${config.rgb}, 0.82)`;
    ctx.font = '700 7px "Cascadia Mono", Consolas, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(car.index + 1).padStart(2, "0"), 0, -CAR_H * 0.43);

    // Faróis.
    ctx.shadowColor = "#fff4ca";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#fff3c7";
    roundedRectPath(ctx, -CAR_W * 0.32, -CAR_H * 0.48, 7, 3.6, 2);
    ctx.fill();
    roundedRectPath(ctx, CAR_W * 0.32 - 7, -CAR_H * 0.48, 7, 3.6, 2);
    ctx.fill();

    // Lanternas.
    ctx.shadowColor = config.hex;
    ctx.shadowBlur = 13;
    ctx.fillStyle = config.hex;
    roundedRectPath(ctx, -CAR_W * 0.32, CAR_H * 0.42, 8, 3.5, 2);
    ctx.fill();
    roundedRectPath(ctx, CAR_W * 0.32 - 8, CAR_H * 0.42, 8, 3.5, 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    if (car.pulse > 0) {
      ctx.globalAlpha = car.pulse * 0.48;
      ctx.strokeStyle = config.hex;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 34 + (1 - car.pulse) * 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const particle of game.particles) {
      const ratio = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = `rgba(${particle.color}, ${ratio})`;
      if (particle.square) {
        const size = particle.size * (0.6 + ratio * 0.7);
        ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * ratio + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const wave of game.shockwaves) {
      const progress = 1 - wave.life / wave.maxLife;
      const radius = wave.size + progress * 44;
      ctx.strokeStyle = `rgba(${wave.color}, ${(1 - progress) * 0.52})`;
      ctx.lineWidth = 2.2 * (1 - progress) + 0.4;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPopups() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '700 17px "Cascadia Mono", Consolas, monospace';

    for (const popup of game.popups) {
      const ratio = clamp(popup.life / popup.maxLife, 0, 1);
      ctx.globalAlpha = ratio;
      ctx.shadowColor = popup.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, popup.x, popup.y);
    }

    ctx.restore();
  }

  function drawFlash() {
    if (game.flash <= 0) {
      return;
    }

    const gradient = ctx.createRadialGradient(
      WORLD_W * 0.5,
      WORLD_H * 0.72,
      30,
      WORLD_W * 0.5,
      WORLD_H * 0.6,
      WORLD_H * 0.7,
    );
    gradient.addColorStop(0, `rgba(255, 86, 112, ${game.flash * 0.21})`);
    gradient.addColorStop(1, `rgba(255, 40, 80, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  function drawScene() {
    const shake = mode === "crashing" || mode === "playing" ? game.cameraShake : 0;
    const shakeX = shake ? randomBetween(-shake, shake) : 0;
    const shakeY = shake ? randomBetween(-shake, shake) : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground();
    drawSpeedStreaksForeground();

    for (const object of game.objects) {
      drawObject(object);
    }

    for (const car of game.cars) {
      drawCar(car);
    }

    drawParticles();
    drawPopups();
    ctx.restore();

    drawFlash();
  }

  function render() {
    if (!viewportW || !viewportH) {
      resizeCanvas();
    }

    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);
    drawScene();
  }

  /* ------------------------------------------------------------------ */
  /* Loop principal                                                      */
  /* ------------------------------------------------------------------ */

  function frame(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.035);
    lastFrame = now;
    update(delta);
    render();
    window.requestAnimationFrame(frame);
  }

  function boot() {
    document.body.classList.toggle("is-muted", muted);
    syncSoundUI();
    syncCarModeUI();
    syncSpeedUI();
    updateBestHUD();
    resetToMenu();
    resizeCanvas();

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(resizeCanvas);
      observer.observe(dom.shell);
    } else {
      window.addEventListener("resize", resizeCanvas);
    }

    window.requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* Eventos                                                             */
  /* ------------------------------------------------------------------ */

  dom.aboutButton.addEventListener("click", openAbout);
  dom.aboutCloseButton.addEventListener("click", closeAbout);
  dom.aboutDoneButton.addEventListener("click", closeAbout);
  dom.aboutScreen.addEventListener("click", (event) => {
    if (event.target === dom.aboutScreen) {
      closeAbout();
    }
  });

  dom.speedSettingsButton.addEventListener("click", openSpeedSettings);
  dom.speedCloseButton.addEventListener("click", closeSpeedSettings);
  dom.speedDoneButton.addEventListener("click", closeSpeedSettings);
  dom.speedScreen.addEventListener("click", (event) => {
    if (event.target === dom.speedScreen) {
      closeSpeedSettings();
    }
  });
  dom.speedModeButtons.forEach((button) => {
    button.addEventListener("click", () => setSpeedMode(button.dataset.speedMode));
  });
  dom.fixedSpeedRange.addEventListener("input", () => setFixedSpeed(dom.fixedSpeedRange.value));
  dom.maxSpeedRange.addEventListener("input", () => setMaxSpeed(dom.maxSpeedRange.value));
  dom.unlimitedSpeed.addEventListener("change", () => setUnlimitedSpeed(dom.unlimitedSpeed.checked));
  dom.speedDefaultButton.addEventListener("click", resetSpeedSettings);

  dom.playButton.addEventListener("click", () => {
    audio.ensure();
    startRound();
  });

  dom.playAgainButton.addEventListener("click", () => {
    audio.ensure();
    startRound();
  });

  dom.carCountButtons.forEach((button) => {
    button.addEventListener("click", () => setCarCount(Number(button.dataset.carCount)));
  });

  dom.pauseButton.addEventListener("click", togglePauseFromButton);
  dom.resumeButton.addEventListener("click", resumeGame);
  dom.restartButton.addEventListener("click", () => {
    startRound();
  });
  dom.pauseMenuButton.addEventListener("click", returnToMenu);
  dom.gameOverMenuButton.addEventListener("click", returnToMenu);

  $$("[data-sound-toggle]").forEach((button) => {
    button.addEventListener("click", toggleSound);
  });

  dom.canvas.addEventListener("pointerdown", handleRoadPointerDown, {
    passive: false,
  });
  dom.shell.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("blur", () => {
    if (mode === "playing") {
      pauseGame();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "playing") {
      pauseGame();
    }
  });

  document.addEventListener("pointerdown", handlePointerDown, { passive: true });

  window.threeCarsPause = function handleAndroidPause() {
    if (mode === "playing") {
      pauseGame();
      return true;
    }
    return false;
  };

  // Usado pelo botão Voltar do Android via evaluateJavascript().
  window.threeCarsBack = function handleAndroidBack() {
    if (!dom.speedScreen.hidden) {
      closeSpeedSettings();
      return true;
    }
    if (!dom.aboutScreen.hidden) {
      closeAbout();
      return true;
    }
    if (mode === "playing") {
      pauseGame();
      return true;
    }
    if (mode === "paused" || mode === "gameover" || mode === "countdown") {
      returnToMenu();
      return true;
    }
    if (mode === "crashing") {
      return true;
    }
    return false;
  };

  boot();
})();
