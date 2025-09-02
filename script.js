//----------------------------------------
// ゲームの状態管理
//----------------------------------------
const gameState = {
    teams: [
        { name: '先攻チーム', players: [], score: 0 },
        { name: '後攻チーム', players: [], score: 0 }
    ],
    gameStarted: false, inning: 1, isTop: true, outCount: 0,
    strikeCount: 0, ballCount: 0, pitchCountInPA: 0, 
    runners: [false, false, false], currentAttackerIndex: 0,
    batterRotations: [0, 0], currentPitcherChoice: null, chanceTarget: null,
    totalInnings: 9, 
    gameMode: 'pvp',
    cpuTeamIndex: null,
    lastPitcherAction: 0, // ★追加 (0: アクションなし)
    lastBatterAction: 0,  // ★追加 (0: アクションなし)
};
//----------------------------------------
// データ記録＆分析用の定数と変数
//----------------------------------------
let gameLog = [];
const LOG_STORAGE_KEY = 'airceballLog';
const TEAM_DATA_STORAGE_KEY = 'airceballTeamData';
let teamDataStore = {};
const PITCHES = {
    1: { name: 'ストレート', type: 'strike' }, 2: { name: 'スライダー', type: 'ball' },
    3: { name: 'カーブ', type: 'strike' }, 4: { name: 'フォーク', type: 'ball' },
    5: { name: 'チェンジアップ', type: 'strike' },
};
const ABILITIES = { none: 0, sengugan: 1, nebari: 2, chance: 3 };
const RESULTS = {
    strike: 1, foul: 2, ball: 3, goro_out: 4, double_play: 5,
    hit_1: 6, hit_2: 7, hit_3: 8, hit_4: 9
};
const PITCH_NAMES = { ...Object.fromEntries(Object.entries(PITCHES).map(([id, {name}]) => [id, name])), 0: '見送り' };
const ABILITY_NAMES = { 0: 'なし', 1: '選球眼', 2: '粘り', 3: 'チャンス○'};
const RESULT_NAMES = {
    1: 'ストライク', 2: 'ファール', 3: 'ボール', 4: 'ゴロアウト', 5: 'ゲッツー',
    6: '単打', 7: '二塁打', 8: '三塁打', 9: '本塁打'
};

// DOM要素
const mainTitleEl = document.getElementById('main-title');
const setupScreenEl = document.getElementById('setup-screen');
const gameScreenEl = document.getElementById('game-screen');
const analyticsModal = document.getElementById('analytics-modal');
const dataLogModal = document.getElementById('data-log-modal');
const inningEl = document.getElementById('inning');
const outCountEl = document.getElementById('out-count');
const strikeCountEl = document.getElementById('strike-count');
const ballCountEl = document.getElementById('ball-count');
const resultEl = document.getElementById('result');
const firstBaseEl = document.getElementById('first');
const secondBaseEl = document.getElementById('second');
const thirdBaseEl = document.getElementById('third');
const batterInfoEl = document.getElementById('batter-info');
const pitcherControlsEl = document.getElementById('pitcher-controls');
const batterControlsEl = document.getElementById('batter-controls');
const analyticsBtn = document.getElementById('analytics-btn');
const modalBody = document.getElementById('modal-body');
const modalTitle = document.getElementById('modal-title');
const dataLogBody = document.getElementById('data-log-body');
const gameModeSelect = document.getElementById('game-mode');
const cpuSetupEl = document.getElementById('cpu-setup');
const playerTeamChoiceSelect = document.getElementById('player-team-choice');
const logBoxEl = document.getElementById('log-box'); 
const exitButton = document.getElementById('exit-button');

//----------------------------------------
// データ記録・読み込み関数
//----------------------------------------
function saveLog() {
    try {
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(gameLog));
    } catch (e) { console.error("LocalStorageへの保存に失敗:", e); }
}
function loadLog() {
    const savedData = localStorage.getItem(LOG_STORAGE_KEY);
    if (savedData) {
        gameLog = JSON.parse(savedData);
        console.log(`LocalStorageから${gameLog.length}件のデータを読込`);
    }
}
function saveTeamData() {
    try {
        localStorage.setItem(TEAM_DATA_STORAGE_KEY, JSON.stringify(teamDataStore));
    } catch (e) {
        console.error("LocalStorageへのチームデータの保存に失敗:", e);
    }
}
function loadTeamData() {
    const savedData = localStorage.getItem(TEAM_DATA_STORAGE_KEY);
    if (savedData) {
        teamDataStore = JSON.parse(savedData);
        console.log(`LocalStorageから${Object.keys(teamDataStore).length}件のチームデータを読込`);
    }
}
function recordEvent(pitcherChoice, playerChoice, result) {
    const pitcherTeamIndex = (gameState.currentAttackerIndex + 1) % 2;
    const batterTeamIndex = gameState.currentAttackerIndex;
    const pitcherTeam = gameState.teams[pitcherTeamIndex];
    const batterTeam = gameState.teams[batterTeamIndex];
    const batter = getCurrentBatter();

    const isRLMode = gameState.gameMode === 'pvc_rl' || gameState.gameMode === 'cvc_rl';
    const computerName = isRLMode ? 'AI' : 'CPU';

    const isPitcherCPU = gameState.gameMode === 'cvc_rl' || (gameState.gameMode.startsWith('pvc') && pitcherTeamIndex === gameState.cpuTeamIndex);
    const isBatterCPU = gameState.gameMode === 'cvc_rl' || (gameState.gameMode.startsWith('pvc') && batterTeamIndex === gameState.cpuTeamIndex);

    const pitcherLogName = isPitcherCPU ? computerName : pitcherTeam.name;
    const batterLogName = isBatterCPU ? computerName : batterTeam.name;

    const log = {
        pitcherTeamName: pitcherLogName,
        batterTeamName: batterLogName,
        pitcherScore: pitcherTeam.score,
        batterScore: batterTeam.score,
        batterAbilityId: ABILITIES[batter.ability],
        chanceTargetId: (batter.ability === 'chance') ? batter.chanceTarget : 0,
        pitchCountInPA: gameState.pitchCountInPA,
        outCount: gameState.outCount,
        strikeCount: gameState.strikeCount,
        ballCount: gameState.ballCount,
        runners: gameState.runners.map(r => r ? 1 : 0).join(','),
        pitchId: pitcherChoice,
        swingId: playerChoice === 'noswing' ? 0 : playerChoice,
        resultId: RESULTS[result]
    };
    gameLog.push(log);
    saveLog();
}
//----------------------------------------
// ヘルパー・UI更新関数
//----------------------------------------
function getCurrentBatter() {
    const teamIndex = gameState.currentAttackerIndex;
    return gameState.teams[teamIndex].players[gameState.batterRotations[teamIndex]];
}
function toggleControls(showPitcher) {
    pitcherControlsEl.style.display = showPitcher ? 'block' : 'none';
    batterControlsEl.style.display = showPitcher ? 'none' : 'block';
}
function setButtonsDisabled(disabled) {
    document.querySelectorAll('#game-screen button').forEach(btn => { btn.disabled = disabled; });
}
   function updateDisplay() {
    document.getElementById('team1-score').textContent = gameState.teams[0].score;
    document.getElementById('team2-score').textContent = gameState.teams[1].score;
document.getElementById('team1-display-name').textContent = gameState.teams[0].name;
    document.getElementById('team2-display-name').textContent = gameState.teams[1].name;
    inningEl.textContent = `${gameState.inning}回${gameState.isTop ? '表' : '裏'}`;
    outCountEl.textContent = gameState.outCount;
    strikeCountEl.textContent = gameState.strikeCount;
ballCountEl.textContent = gameState.ballCount;
    firstBaseEl.classList.toggle('runner', gameState.runners[0]);
    secondBaseEl.classList.toggle('runner', gameState.runners[1]);
    thirdBaseEl.classList.toggle('runner', gameState.runners[2]);
    if (gameState.gameStarted) {
        const batter = getCurrentBatter();
const team = gameState.teams[gameState.currentAttackerIndex];
        const abilityName = ABILITY_NAMES[ABILITIES[batter.ability]];
        const chanceTargetName = (batter.ability === 'chance') ? `(${PITCHES[batter.chanceTarget].name}狙い)` : '';
        
        batterInfoEl.innerHTML = `
            <div>
                <span class="batter-details">${team.name} ${gameState.batterRotations[gameState.currentAttackerIndex] + 1}番</span>
                <span class="batter-name">${batter.name}</span>
            </div>
            <div>
                <span class="ability-label">特能</span>
                <span class="ability-name">${abilityName}${chanceTargetName}</span>
            </div>
        `;
    }
}
function showMessage(msg) {
    resultEl.textContent = msg;
}
function logMessage(msg) {
    const p = document.createElement('p');
    p.textContent = msg;
    const logBox = document.getElementById('log-box');
    const ingameLogBody = document.querySelector('#ingame-log-modal #ingame-log-body');
    if (logBox) {
        const p1 = p.cloneNode(true);
        logBox.appendChild(p1);
        logBox.scrollTop = logBox.scrollHeight;
    }
    if (ingameLogBody) {
        const p2 = p.cloneNode(true);
        ingameLogBody.appendChild(p2);
        ingameLogBody.scrollTop = ingameLogBody.scrollHeight;
    }
}

//----------------------------------------
// ゲームロジック
//----------------------------------------
function nextBatter() {
    gameState.strikeCount = 0; gameState.ballCount = 0; gameState.pitchCountInPA = 0;
	    // ★追加: 打者交代時に記憶をリセット
    gameState.lastPitcherAction = 0;
    gameState.lastBatterAction = 0;
    const teamIndex = gameState.currentAttackerIndex;
    gameState.batterRotations[teamIndex] = (gameState.batterRotations[teamIndex] + 1) % gameState.teams[teamIndex].players.length;
    updateDisplay();
}
function changeInning() {
    if (gameState.isTop && gameState.inning >= gameState.totalInnings && gameState.teams[1].score > gameState.teams[0].score) {
        setTimeout(endGame, 1500);
        return;
    }
    if (!gameState.isTop && gameState.inning >= gameState.totalInnings && gameState.teams[0].score !== gameState.teams[1].score) {
        setTimeout(endGame, 1500);
        return;
    }
    gameState.outCount = 0; gameState.strikeCount = 0; gameState.ballCount = 0;
    gameState.pitchCountInPA = 0; gameState.runners = [false, false, false];
    if (!gameState.isTop) gameState.inning++;
    gameState.isTop = !gameState.isTop;
    gameState.currentAttackerIndex = (gameState.currentAttackerIndex + 1) % 2;
    logMessage('*** 攻守交代！ ***');
    updateDisplay();
    setTimeout(startTurn, 2000);
}

function endGame() {
    let message = "ゲームセット！ ";
    const score1 = gameState.teams[0].score;
    const score2 = gameState.teams[1].score;
    if (score1 > score2) message += `${gameState.teams[0].name}の勝利！`;
    else if (score2 > score1) message += `${gameState.teams[1].name}の勝利！`;
    else message += "引き分け！";
    showMessage(message);
    logMessage(`*** ${message} ***`);
    setButtonsDisabled(true);
    analyticsBtn.disabled = false;
}
function handleOut(count = 1) {
    gameState.outCount += count;
    if (gameState.outCount >= 3) {
        setTimeout(changeInning, 1500);
    } else {
        nextBatter();
        setTimeout(startTurn, 1500);
    }
    updateDisplay();
}
 function handleStrike() {
    gameState.strikeCount++;
    updateDisplay();
    if (gameState.strikeCount >= 3) {
        const message = gameState.currentPitcherChoice === 'noswing' ? '見逃し三振！' : '空振り三振！';
        showMessage(message);
        logMessage(message);
        handleOut();
    } else {
        setTimeout(startTurn, 1500);
    }
}

function handleBall() {
    gameState.ballCount++;
    updateDisplay();
    if (gameState.ballCount >= 4) {
        showMessage('フォアボール！');
        logMessage(`フォアボール！`);
        if (gameState.runners[0] && gameState.runners[1] && gameState.runners[2]) {
            const oldHomeScore = gameState.teams[1].score;
            gameState.teams[gameState.currentAttackerIndex].score++;
            const newHomeScore = gameState.teams[1].score;
            showMessage('押し出しで1点！');
            logMessage('押し出しで1点！'); 
            if (!gameState.isTop && gameState.inning >= gameState.totalInnings && oldHomeScore <= gameState.teams[0].score && newHomeScore > gameState.teams[0].score) {
                updateDisplay();
                const sayonaraMessage = 'サヨナラ押し出し！';
                showMessage(sayonaraMessage);
                logMessage(sayonaraMessage); 
                setTimeout(endGame, 1500);
                return;
            }
        } else if (gameState.runners[0] && gameState.runners[1]) {
            gameState.runners[2] = true;
        } else if (gameState.runners[0]) {
            gameState.runners[1] = true;
        }
        gameState.runners[0] = true;
        nextBatter();
        setTimeout(startTurn, 1500);
    } else {
        setTimeout(startTurn, 1500);
    }
}

function handleFoul() {
    showMessage('ファール！');
    logMessage('ファール！');
    if (gameState.strikeCount < 2) gameState.strikeCount++;
    updateDisplay();
    setTimeout(startTurn, 1500);
}

    function advanceRunners(bases) {
    let newRunners = [false, false, false];
    let scoredRuns = 0;
    for (let i = 2; i >= 0; i--) {
        if (gameState.runners[i]) {
            if (i + bases >= 3) {
                scoredRuns++;
            } else {
                newRunners[i + bases] = true;
            }
        }
    }
    if (bases >= 4) {
        scoredRuns++;
    } else {
        newRunners[bases - 1] = true;
    }
    gameState.runners = newRunners;
    if (scoredRuns > 0) {
        gameState.teams[gameState.currentAttackerIndex].score += scoredRuns;
        logMessage(`${scoredRuns}点入りました！`);
    }
}
function handleHit(bases) {
    const hitTypes = { 1: 'ヒット！', 2: 'ツーベース！', 3: 'スリーベース！', 4: 'ホームラン！' };
    const oldHomeScore = gameState.teams[1].score;
    const message = hitTypes[bases];
    showMessage(message);
    logMessage(message); 
    advanceRunners(bases);
    const newHomeScore = gameState.teams[1].score;
    if (!gameState.isTop && gameState.inning >= gameState.totalInnings && oldHomeScore <= gameState.teams[0].score && newHomeScore > gameState.teams[0].score) {
        updateDisplay();
        const sayonaraMessage = bases === 4 ? 'サヨナラホームラン！' : 'サヨナラヒット！';
        showMessage(sayonaraMessage);
        logMessage(sayonaraMessage); 
        setTimeout(endGame, 1500);
        return;
    }
    nextBatter();
    setTimeout(startTurn, 1500);
}

    function pitchAndSwing(pitcherChoice, playerChoice) {
	    // ★追加: 現在のアクションを gameState に記憶する
    gameState.lastPitcherAction = parseInt(pitcherChoice, 10);
    if (playerChoice === 'noswing') {
        gameState.lastBatterAction = 6; // Pythonのコードに合わせて「見送り」は6とする
    } else {
        gameState.lastBatterAction = parseInt(playerChoice, 10);
    }
    gameState.pitchCountInPA++;
    setButtonsDisabled(true);
    const pitcherPitch = PITCHES[pitcherChoice];
    const batter = getCurrentBatter();
    let message = `投手: ${pitcherPitch.name} |`;
    if (playerChoice !== 'noswing') message += ` 打者: ${PITCHES[playerChoice].name}狙い`;
    else message += ` 打者: 見送り`;
    logMessage(message);
    setTimeout(() => {
        if (playerChoice === 'noswing') {
            let isStrike = pitcherPitch.type === 'strike';
            if (pitcherChoice == '3' && batter.ability === 'sengugan') isStrike = false;
            recordEvent(pitcherChoice, playerChoice, isStrike ? 'strike' : 'ball');
            const resultMessage = isStrike ? 'ストライク！' : 'ボール！';
            showMessage(resultMessage);
            logMessage(resultMessage); 
            isStrike ? handleStrike() : handleBall();
            return;
        }
        const isGoro = (pitcherChoice == '5' && playerChoice == '3') || (pitcherChoice == '3' && playerChoice == '5');
 
        if (isGoro) {
            if (gameState.runners[0] && gameState.outCount < 2) {
                recordEvent(pitcherChoice, playerChoice, 'double_play');
                showMessage('ゲッツー！');
                logMessage('ゲッツー！'); gameState.runners[0] = false; handleOut(2); 
            } else {
                recordEvent(pitcherChoice, playerChoice, 'goro_out');
                showMessage('ゴロアウト！');
                logMessage('ゴロアウト！');
                handleOut(1); 
            }
            return;
        }
        if (pitcherChoice === playerChoice) {
            let bases = 1;
            const isChance = gameState.runners[1] || gameState.runners[2];
            if (batter.ability === 'chance' && isChance && playerChoice === batter.chanceTarget) bases = 2;
            else if (playerChoice == '5') bases = 2;
            else if (playerChoice == '3') bases = 4;
            recordEvent(pitcherChoice, playerChoice, `hit_${bases}`);
            handleHit(bases);
            return;
        }
        const foulA = ['1', '2'], foulB = ['3', '4'];
        let isFoul = (batter.ability === 'nebari' && gameState.strikeCount === 2 && [...foulA, ...foulB].includes(pitcherChoice) && [...foulA, ...foulB].includes(playerChoice)) ||
        (foulA.includes(pitcherChoice) && foulA.includes(playerChoice)) || (foulB.includes(pitcherChoice) && foulB.includes(playerChoice));
        if (isFoul) {
            recordEvent(pitcherChoice, playerChoice, 'foul');
            handleFoul();
            return;
        }
        recordEvent(pitcherChoice, playerChoice, 'strike');
        showMessage('空振り！');
        logMessage('空振り！');
        handleStrike();
    }, 1200);
}

//----------------------------------------
// ゲームフロー制御
//----------------------------------------
function startTurn() {
    const pitcherTeamIndex = (gameState.currentAttackerIndex + 1) % 2;
    const isPitcherCPU = gameState.gameMode === 'cvc_rl' || (gameState.gameMode.startsWith('pvc') && pitcherTeamIndex === gameState.cpuTeamIndex);

    if (isPitcherCPU) {
        toggleControls(true);
        setButtonsDisabled(true);
        const isRLMode = gameState.gameMode === 'pvc_rl' || gameState.gameMode === 'cvc_rl';
        const thinkingMessage = isRLMode ? "AIが投球を考えています..." : "CPUが投球を考えています...";
        showMessage(thinkingMessage);
        const delay = 1500 + Math.random() * 1000;
        if (isRLMode) setTimeout(cpuPitchAI, delay);
        else setTimeout(classicCpuPitchAI, delay);
    } else {
        showMessage(`${gameState.teams[pitcherTeamIndex].name}、投球を選択してください。`);
        setButtonsDisabled(false);
        toggleControls(true);
    }
    updateDisplay();
}
function selectPitch(pitch) {
    gameState.currentPitcherChoice = pitch;
    const batterTeamIndex = gameState.currentAttackerIndex;
    const isBatterCPU = gameState.gameMode === 'cvc_rl' || (gameState.gameMode.startsWith('pvc') && batterTeamIndex === gameState.cpuTeamIndex);

    if (isBatterCPU) {
        toggleControls(false);
        setButtonsDisabled(true);
        const isRLMode = gameState.gameMode === 'pvc_rl' || gameState.gameMode === 'cvc_rl';
        const thinkingMessage = isRLMode ? "AIが打撃を考えています..." : "CPUが打撃を考えています...";
        showMessage(thinkingMessage);
        const delay = 1500 + Math.random() * 1000;
        if (isRLMode) setTimeout(cpuBatAI, delay);
        else setTimeout(classicCpuBatAI, delay);
    } else {
        showMessage(`${gameState.teams[batterTeamIndex].name}、打撃を選択してください。`);
        toggleControls(false);
        setButtonsDisabled(false);
    }
}
function selectBatterAction(action, pitch = null) {
    setButtonsDisabled(true);
    pitchAndSwing(gameState.currentPitcherChoice, action === 'swing' ? pitch : 'noswing');
}

//----------------------------------------
// RL AI ロジック (API Call)
//----------------------------------------
async function callAIApi() {
    const batter = getCurrentBatter();
    const statePayload = {
        inning: gameState.inning, totalInnings: gameState.totalInnings,
        isTop: gameState.isTop, outCount: gameState.outCount,
        strikeCount: gameState.strikeCount, ballCount: gameState.ballCount,
        runners: gameState.runners, scores: [gameState.teams[0].score, gameState.teams[1].score],
        currentAttackerIndex: gameState.currentAttackerIndex,
        batterAbility: batter.ability, chanceTarget: batter.chanceTarget,
		 lastPitcherAction: gameState.lastPitcherAction, // ★追加
        lastBatterAction: gameState.lastBatterAction   // ★追加
    };
    try {
        const response = await fetch('https://tasmanianpasta-airceball-hf-space.hf.space/get-ai-move', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(statePayload)
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json();
        return data.move;
    } catch (error) {
        console.error("Failed to get AI move:", error);
        return Math.floor(Math.random() * 6); // Fallback
    }
}
async function cpuPitchAI() {
    const action = await callAIApi();
    const pitchChoice = (action % 5) + 1;
    console.log(`AI Pitcher chose action ${action}, resulting in pitch ${pitchChoice}`);
    selectPitch(String(pitchChoice));
}
async function cpuBatAI() {
    const action = await callAIApi();
    if (action === 5) {
        console.log(`AI Batter chose action ${action}, resulting in NO SWING`);
        selectBatterAction('noswing');
    } else {
        const swingChoice = (action % 5) + 1;
        console.log(`AI Batter chose action ${action}, resulting in SWING at ${swingChoice}`);
        selectBatterAction('swing', String(swingChoice));
    }
}

//----------------------------------------
// Classic CPU ロジック
//----------------------------------------
function getWeightedRandom(choices) {
    const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
    let random = Math.random() * totalWeight;
    for (const choice of choices) {
        if (random < choice.weight) return choice.value;
        random -= choice.weight;
    }
    return choices[choices.length - 1].value;
}
function classicCpuPitchAI() {
    let tendencyData = getTendencyData('batter', { matchOutCount: true, matchRunners: true });
    if (tendencyData.total === 0) tendencyData = getTendencyData('batter', { matchOutCount: false, matchRunners: false });
    let pitchChoices = Object.keys(PITCHES).map(id => ({ value: id, weight: 10 }));
    if (tendencyData.total > 0) {
        let maxSwingCount = 0, preferredSwing = null;
        for (const [swingId, count] of Object.entries(tendencyData.counts)) {
            if (swingId !== '0' && count > maxSwingCount) {
                maxSwingCount = count; preferredSwing = swingId;
            }
        }
        if (preferredSwing) {
            const targetChoice = pitchChoices.find(c => c.value === preferredSwing);
            if (targetChoice) targetChoice.weight = 2;
        }
    }
    selectPitch(getWeightedRandom(pitchChoices));
}
function classicCpuBatAI() {
    if (Math.random() < 0.25) { selectBatterAction('noswing'); return; }
    let tendencyData = getTendencyData('pitcher', { matchOutCount: true, matchRunners: true });
    if (tendencyData.total === 0) tendencyData = getTendencyData('pitcher', { matchOutCount: false, matchRunners: false });
    let swingChoices = Object.keys(PITCHES).map(id => ({ value: id, weight: 1 }));
    if (tendencyData.total > 0) {
        swingChoices = Object.keys(PITCHES).map(id => ({ value: id, weight: (tendencyData.counts[id] || 0) + 1 }));
    }
    selectBatterAction('swing', getWeightedRandom(swingChoices));
}

//----------------------------------------
// データ分析機能
//----------------------------------------
function getTendencyData(type, conditions) {
    const pitcherTeamIndex = (gameState.currentAttackerIndex + 1) % 2;
    const batterTeamIndex = gameState.currentAttackerIndex;
    
    const isRLMode = gameState.gameMode === 'pvc_rl' || gameState.gameMode === 'cvc_rl';
    const computerName = isRLMode ? 'AI' : 'CPU';

    const isCpuPitching = gameState.gameMode === 'cvc_rl' || (gameState.gameMode.startsWith('pvc') && pitcherTeamIndex === gameState.cpuTeamIndex);
    const isCpuBatting = gameState.gameMode === 'cvc_rl' || (gameState.gameMode.startsWith('pvc') && batterTeamIndex === gameState.cpuTeamIndex);

    const targetPitcherName = isCpuPitching ? computerName : gameState.teams[pitcherTeamIndex].name;
    const targetBatterName = isCpuBatting ? computerName : gameState.teams[batterTeamIndex].name;

    const runners = gameState.runners.map(r => r ? 1 : 0).join(',');

    const logs = gameLog.filter(log => {
        const teamToAnalyze = (type === 'pitcher') ? targetPitcherName : targetBatterName;
        const teamMatch = (type === 'pitcher') ? (log.pitcherTeamName === teamToAnalyze) : (log.batterTeamName === teamToAnalyze);
        if (!teamMatch) return false;
        if (conditions.matchOutCount && log.outCount !== gameState.outCount) return false;
        if (conditions.matchRunners && log.runners !== runners) return false;
        if (conditions.matchAbilityId !== undefined && log.batterAbilityId !== conditions.matchAbilityId) return false;
        return true;
    });

    const counts = logs.reduce((acc, log) => {
        let countKey = (type === 'pitcher') ? log.pitchId : log.swingId;
        if (type === 'batter' && log.batterAbilityId === 3 && log.swingId == log.chanceTargetId) countKey = `chance_${log.swingId}`;
        acc[countKey] = (acc[countKey] || 0) + 1;
        return acc;
    }, {});
    return { counts, total: logs.length };
}

function showAnalytics() {
    const isPitcherTurn = pitcherControlsEl.style.display === 'block';
    const type = isPitcherTurn ? 'batter' : 'pitcher';
    const opponentTeamIndex = isPitcherTurn ? gameState.currentAttackerIndex : (gameState.currentAttackerIndex + 1) % 2;
    const isOpponentCPU = gameState.gameMode === 'cvc_rl' || (gameState.gameMode.startsWith('pvc') && opponentTeamIndex === gameState.cpuTeamIndex);

    const isRLMode = gameState.gameMode === 'pvc_rl' || gameState.gameMode === 'cvc_rl';
    const computerName = isRLMode ? 'AI' : 'CPU';
    
    const opponentTeamName = isOpponentCPU ? computerName : gameState.teams[opponentTeamIndex].name;
    
    const currentBatter = getCurrentBatter();
    const currentAbilityId = ABILITIES[currentBatter.ability];
    const currentAbilityName = ABILITY_NAMES[currentAbilityId];

    modalTitle.textContent = isPitcherTurn ? `【${opponentTeamName}】の打撃傾向` : `【${opponentTeamName}】の投球傾向`;
    
    let modalHtml = "<h3>現在の状況と完全一致</h3>" + analyzeTendency(type, { matchOutCount: true, matchRunners: true }) +
                    "<h3>ランナー状況のみ一致</h3>" + analyzeTendency(type, { matchOutCount: false, matchRunners: true }) +
                    "<h3>アウトカウントのみ一致</h3>" + analyzeTendency(type, { matchOutCount: true, matchRunners: false }) +
                    "<h3>全体の傾向</h3>" + analyzeTendency(type, { matchOutCount: false, matchRunners: false });

    if (currentAbilityId !== ABILITIES.none) {
        const analysisTitle = isPitcherTurn ? `vs 特能「${currentAbilityName}」持ち打者` : `自特能「${currentAbilityName}」の場合`;
        modalHtml += `<h3>${analysisTitle}の傾向</h3>` + analyzeTendency(type, { matchOutCount: false, matchRunners: false, matchAbilityId: currentAbilityId });
    }
    modalBody.innerHTML = modalHtml;
    analyticsModal.style.display = 'flex';
}

function analyzeTendency(type, conditions) {
    const { counts, total } = getTendencyData(type, conditions);
    if (total === 0) return '<p>該当データなし</p>';
    let html = '<ul>';
    Object.entries(counts).sort(([, a], [, b]) => b - a).forEach(([k, count]) => {
        let name;
        if (type === 'pitcher') {
            name = PITCH_NAMES[k];
        } else { 
            if (String(k).startsWith('chance_')) {
                const pitchId = k.split('_')[1];
                name = `${PITCH_NAMES[pitchId]}狙い (チャンス○)`;
            } else {
                name = (k == '0') ? '見送り' : `${PITCH_NAMES[k]}狙い`;
            }
        }
        html += `<li><strong>${name}</strong>: ${((count / total) * 100).toFixed(1)}% (${count}/${total}回)</li>`;
    });
    return html + '</ul>';
}

//----------------------------------------
// 全データ表示機能
//----------------------------------------
function showAllData() {
    if (gameLog.length === 0) {
        dataLogBody.innerHTML = '<p>記録されたデータがありません。</p>';
        dataLogModal.style.display = 'flex';
        return;
    }
    let tableHtml = '<table id="data-log-table"><thead><tr>' +
        '<th>投手</th><th>打者</th><th>特能</th><th>スコア</th><th>アウト</th>' +
        '<th>カウント</th><th>走者</th><th>投球</th><th>打撃</th><th>結果</th>' +
        '</tr></thead><tbody>';
    
    [...gameLog].reverse().forEach(log => {
        let abilityStr = ABILITY_NAMES[log.batterAbilityId];
        if (log.batterAbilityId === 3 && log.chanceTargetId) abilityStr += `(${PITCH_NAMES[log.chanceTargetId]})`;
        tableHtml += `<tr>
            <td>${log.pitcherTeamName}</td> <td>${log.batterTeamName}</td>
            <td>${abilityStr}</td> <td>${log.pitcherScore} - ${log.batterScore}</td>
            <td>${log.outCount}</td> <td>S:${log.strikeCount} B:${log.ballCount}</td>
            <td>${log.runners.replace(/1/g, '●').replace(/0/g, '-')}</td>
            <td>${PITCH_NAMES[log.pitchId]}</td> <td>${PITCH_NAMES[log.swingId]}</td>
            <td>${RESULT_NAMES[log.resultId]}</td>
        </tr>`;
    });
    tableHtml += '</tbody></table>';
    dataLogBody.innerHTML = tableHtml;
    dataLogModal.style.display = 'flex';
}

//----------------------------------------
// データ入出力機能
//----------------------------------------
function exportData() {
    if (gameLog.length === 0) { alert('エクスポートするデータがありません。'); return; }
    const dataStr = JSON.stringify(gameLog, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `airceball_log_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert(`${gameLog.length}件のデータをエクスポートしました。`);
}
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) throw new Error('データ形式が正しくありません。');
            const choice = prompt(`インポートモードを選択してください:\n1: 既存のデータに追加する\n2: 既存のデータを置き換える`, '1');
            if (choice === '1') {
                gameLog = gameLog.concat(importedData);
                alert(`${importedData.length}件のデータを追加しました。合計: ${gameLog.length}件`);
            } else if (choice === '2') {
                gameLog = importedData;
                alert(`${importedData.length}件のデータに置き換えました。`);
            } else {
                alert('インポートをキャンセルしました。');
                return;
            }
            saveLog();
        } catch (error) {
            alert('ファイルの読み込みに失敗しました。有効なJSONデータではありません。\n' + error.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

//----------------------------------------
// セットアップと初期化
//----------------------------------------
function applyTeamDataToForm(teamIndex, teamData) {
    if (!teamData || !teamData.players) return;
    teamData.players.forEach((player, i) => {
        document.getElementById(`t${teamIndex}-p${i}-name`).value = player.name;
        const abilitySelect = document.getElementById(`t${teamIndex}-p${i}-ability`);
        abilitySelect.value = player.ability;
        if (player.ability === 'chance') {
            document.getElementById(`t${teamIndex}-p${i}-chance-target`).value = player.chanceTarget;
        }
        abilitySelect.dispatchEvent(new Event('change'));
    });
}
function handleTeamNameInput(event) {
    const inputId = event.target.id;
    const teamIndex = (inputId === 'team1-name') ? 1 : 2;
    const teamName = event.target.value;
    if (teamDataStore[teamName]) {
        applyTeamDataToForm(teamIndex, teamDataStore[teamName]);
    }
}
function createPlayerSetupHTML(teamIndex) {
    let html = '';
    const defaultNames = teamIndex === 1 ? ['選手A', '選手B', '選手C'] : ['選手X', '選手Y', '選手Z'];
    for (let i = 0; i < 3; i++) {
        html += `<div class="player-setup">
                ${i+1}番: <input type="text" id="t${teamIndex}-p${i}-name" value="${defaultNames[i]}" size="8">
                特能: <select id="t${teamIndex}-p${i}-ability" data-team="${teamIndex}" data-player="${i}">
                        <option value="none">なし</option> <option value="sengugan">選球眼</option>
                        <option value="nebari">粘り</option> <option value="chance">チャンス○</option>
                     </select><br>
                <span id="t${teamIndex}-p${i}-chance-options" style="display:none;">
                    狙い: <select id="t${teamIndex}-p${i}-chance-target">
                        <option value="2">スライダー</option> <option value="4">フォーク</option>
                    </select>
                </span></div>`;
    }
    return html;
}
function initSetup() {
    document.getElementById('team1-players').innerHTML = createPlayerSetupHTML(1);
    document.getElementById('team2-players').innerHTML = createPlayerSetupHTML(2);
    document.querySelectorAll('select[id$="-ability"]').forEach(select => {
        select.addEventListener('change', (e) => {
            const team = e.target.dataset.team, player = e.target.dataset.player;
            document.getElementById(`t${team}-p${player}-chance-options`).style.display = e.target.value === 'chance' ? 'inline' : 'none';
        });
    });
    gameModeSelect.addEventListener('change', (e) => {
        cpuSetupEl.style.display = e.target.value.startsWith('pvc') ? 'block' : 'none';
    });

    loadLog();
    loadTeamData();
    const datalist = document.getElementById('team-suggestions');
    if (datalist) {
        const teamNames = Object.keys(teamDataStore);
        datalist.innerHTML = teamNames.map(name => `<option value="${name}"></option>`).join('');
    }
    document.getElementById('team1-name').addEventListener('input', handleTeamNameInput);
    document.getElementById('team2-name').addEventListener('input', handleTeamNameInput);
}

function startGame() {
    gameState.totalInnings = parseInt(document.getElementById('inning-select').value, 10);
    gameState.gameMode = gameModeSelect.value;
    
    if (gameState.gameMode.startsWith('pvc')) {
        gameState.cpuTeamIndex = parseInt(playerTeamChoiceSelect.value) === 0 ? 1 : 0;
        const cpuTeamNameInput = document.getElementById(`team${gameState.cpuTeamIndex + 1}-name`);
        const suffix = gameState.gameMode === 'pvc_rl' ? ' [AI]' : ' [CPU]';
        if (!cpuTeamNameInput.value.includes('[AI]') && !cpuTeamNameInput.value.includes('[CPU]')) {
            cpuTeamNameInput.value += suffix;
        }
    } else if (gameState.gameMode === 'cvc_rl') {
        gameState.cpuTeamIndex = null; // プレイヤーはいない
        const team1NameInput = document.getElementById('team1-name');
        const team2NameInput = document.getElementById('team2-name');
        if (!team1NameInput.value.includes('[AI]')) team1NameInput.value += ' [AI]';
        if (!team2NameInput.value.includes('[AI]')) team2NameInput.value += ' [AI]';
    } else {
        gameState.cpuTeamIndex = null;
    }

    gameState.teams[0].name = document.getElementById('team1-name').value;
    gameState.teams[1].name = document.getElementById('team2-name').value;
    if(!gameState.teams[0].name.trim() || !gameState.teams[1].name.trim()){
        alert("チーム名を入力してください");
        return; // ゲーム開始を中止
    } else if(gameState.teams[0].name.trim() === gameState.teams[1].name.trim()) {
        alert("警告: チーム名が同じです。データ分析が正しく機能しない可能性があります。");
    }

    for (let t = 1; t <= 2; t++) {
        gameState.teams[t-1].players = [];
        for (let p = 0; p < 3; p++) {
            gameState.teams[t-1].players.push({
                name: document.getElementById(`t${t}-p${p}-name`).value,
                ability: document.getElementById(`t${t}-p${p}-ability`).value,
                chanceTarget: document.getElementById(`t${t}-p${p}-chance-target`).value
            });
        }
    }

    [0, 1].forEach(i => {
        const team = gameState.teams[i];
        if (team.name.trim()) {
            teamDataStore[team.name] = {
                name: team.name,
                players: JSON.parse(JSON.stringify(team.players))
            };
        }
    });
    saveTeamData();
    
    gameState.gameStarted = true;
    setupScreenEl.style.display = 'none';
    gameScreenEl.style.display = 'block';
    logMessage('*** ゲーム開始！ ***');
    startTurn();
}
// ----------------------------------------
// 初期化とイベントリスナー
// ----------------------------------------
function showIngameLog() {
    const modal = document.getElementById('ingame-log-modal');
    if (modal) modal.style.display = 'flex';
}

function showRules() {
    const modal = document.getElementById('rules-modal');
    if (modal) modal.style.display = 'flex';
}

document.getElementById('start-game-btn').addEventListener('click', startGame);
analyticsBtn.addEventListener('click', showAnalytics);
document.querySelectorAll('.pitch-btn').forEach(b => b.addEventListener('click', () => selectPitch(b.dataset.pitch)));
document.querySelectorAll('.swing-btn').forEach(b => b.addEventListener('click', () => selectBatterAction('swing', b.dataset.pitch)));
document.getElementById('no-swing-btn').addEventListener('click', () => selectBatterAction('noswing'));
document.getElementById('show-all-data-btn').addEventListener('click', showAllData);
document.getElementById('reset-data-btn').addEventListener('click', () => {
    if (confirm('本当に全プレイデータを削除しますか？\nこの操作は元に戻せません。')) {
        localStorage.removeItem(LOG_STORAGE_KEY);
        gameLog = [];
        alert('全データをリセットしました。');
    }
});
document.getElementById('export-data-btn').addEventListener('click', exportData);
document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-file-input').click());
document.getElementById('import-file-input').addEventListener('change', importData);

document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
});

initSetup();

function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

exitButton.addEventListener('click', () => {
    const result = window.confirm('ゲームを終了して設定画面に戻りますか？');
    if (result) {
        window.location.reload(); 
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const firstTab = document.querySelector('.tab-link');
    if (firstTab) {
        firstTab.click();
    }
});
