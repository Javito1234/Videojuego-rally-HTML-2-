// ============================================================================
// RETRO RALLY 3D - ENGINE TOTALMENTE REPARADO V5.2 STABLE (PODIUM FIX)
// ============================================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

// Definición fija de resolución virtual interna
const WIDTH = 800;
const HEIGHT = 450;
canvas.width = WIDTH;
canvas.height = HEIGHT;

const FPS = 60;
const STEP = 1 / FPS;
const ROAD_WIDTH = 2000;       
const SEGMENT_LENGTH = 65;     
const DRAW_DISTANCE = 200;     
const BASE_CAMERA_DEPTH = 0.85;
const CAMERA_HEIGHT_DEFAULT = 1000; 

// VEHÍCULOS Y CONFIGURACIONES
const VEHICLE_PRESETS = [
    { name: "VW Escarabajo", maxSpeed: 240, accel: 220, brake: -400, handling: 3.2 },
    { name: "Coupé GT", maxSpeed: 280, accel: 260, brake: -450, handling: 3.5 },
    { name: "V12 Hypercar", maxSpeed: 330, accel: 310, brake: -550, handling: 3.9 }
];

const DIFFICULTY_PRESETS = [
    { name: "Fácil", minSpeed: 130, maxSpeedDelta: 40, curveSlowdown: 0.15 },
    { name: "Media", minSpeed: 165, maxSpeedDelta: 55, curveSlowdown: 0.05 },
    { name: "Difícil", minSpeed: 210, maxSpeedDelta: 50, curveSlowdown: 0.01 }
];

// VARIABLES DE JUEGO MÁXIMAS
let selectedDifficultyIdx = 1; 
let selectedVehicleIdx = 0;
let MAX_SPEED = 240;         
let ACCEL = 220;             
let BRAKE = -400;            
let DECEL = -100;             
const OFF_ROAD_ACCEL_FACTOR = 0.4; 

let gameState = 'START';
let totalTime = 0;
let timeLeft = 60;
let currentLap = 1;
let TOTAL_LAPS = 3;
let score = 0;
let damage = 0;

let playerX = 0;               
let position = 0;              
let speed = 0;
let playerRpm = 1000;
let steerInput = 0;

let camX = 0;
let camY = CAMERA_HEIGHT_DEFAULT;
let skyScrollX = 0;

let trackSegments = [];
let trackLength = 0;

let countdownTime = 3.5; 
let countdownText = "3";
let opponents = [];
const TOTAL_OPPONENTS = 5;

const MOUNTAIN_PEAKS_LAYER1 = [50, 35, 60, 40, 55, 30, 45, 60, 35, 50, 40, 55, 30, 60];
const MOUNTAIN_PEAKS_LAYER2 = [75, 50, 90, 60, 85, 45, 70, 95, 55, 80, 65, 90, 50, 85];

let particles = [];
const keys = { left: false, right: false, up: false, down: false };

// ============================================================================
// INICIALIZACIÓN DE ENTRADAS DEL TECLADO
// ============================================================================
function initInputSystem() {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'a') keys.left = true;
        if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.right = true;
        if (e.key === 'ArrowUp'    || e.key.toLowerCase() === 'w') keys.up = true;
        if (e.key === 'ArrowDown'  || e.key.toLowerCase() === 's') keys.down = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'a') keys.left = false;
        if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.right = false;
        if (e.key === 'ArrowUp'    || e.key.toLowerCase() === 'w') keys.up = false;
        if (e.key === 'ArrowDown'  || e.key.toLowerCase() === 's') keys.down = false;
    });

    const btnStart = document.getElementById('btnStartRace');
    if (btnStart) {
        btnStart.onclick = function () {
            const trackSelect = document.getElementById('selectTrack');
            const vehicleSelect = document.getElementById('selectVehicle');
            const difficultySelect = document.getElementById('selectDifficulty');
            
            let trackIdx = trackSelect ? parseInt(trackSelect.value) : 0;
            selectedVehicleIdx = vehicleSelect ? parseInt(vehicleSelect.value) : 0;
            selectedDifficultyIdx = difficultySelect ? parseInt(difficultySelect.value) : 1;

            let vp = VEHICLE_PRESETS[selectedVehicleIdx];
            MAX_SPEED = vp.maxSpeed;
            ACCEL = vp.accel;
            BRAKE = vp.brake;

            buildSelectedChampionshipTrack(trackIdx);
            spawnOpponentsIA();
            startCountdownSequence();
        };
    }
}

// ============================================================================
// CONSTRUCCIÓN SEGURA DE CIRCUITOS
// ============================================================================
function buildSelectedChampionshipTrack(type) {
    trackSegments = [];
    
    if (type === 0) {
        timeLeft = 90; TOTAL_LAPS = 2;
        addRoadSegment(80, 0, 0);
        addRoadSegment(60, 3, 2);
        addRoadSegment(80, -2, -2);
        addRoadSegment(100, 0, 0);
        addRoadSegment(60, -4, 4);
        addRoadSegment(80, 4, -4);
        addRoadSegment(100, 0, 0);
    } else if (type === 1) {
        timeLeft = 120; TOTAL_LAPS = 3;
        addRoadSegment(80, 0, 0);
        addRoadSegment(100, 4, 12);  
        addRoadSegment(80, -3, 0);
        addRoadSegment(90, 5, -10);  
        addRoadSegment(100, -4, 8);
        addRoadSegment(80, 0, 0);
    } else {
        timeLeft = 150; TOTAL_LAPS = 3;
        addRoadSegment(80, 0, 0);
        addRoadSegment(70, 5, 5);
        addRoadSegment(70, -5, -5);
        addRoadSegment(80, 6, 0);
        addRoadSegment(100, 0, 10);
        addRoadSegment(90, -4, -10);
        addRoadSegment(80, 0, 0);
    }

    trackLength = trackSegments.length * SEGMENT_LENGTH;
    
    // Compilación de alturas relativas por nodo geométrico
    let currentX = 0;
    let currentY = 0;
    for (let i = 0; i < trackSegments.length; i++) {
        let seg = trackSegments[i];
        seg.p1.world.x = currentX;
        seg.p1.world.y = currentY;
        currentX += seg.curve * 2.5;
        currentY += seg.hill * 2.0;
        seg.p2.world.x = currentX;
        seg.p2.world.y = currentY;
    }
}

function addRoadSegment(num, curve, hill) {
    for (let i = 0; i < num; i++) {
        let isAlternate = Math.floor(trackSegments.length / 4) % 2;
        trackSegments.push({
            index: trackSegments.length,
            p1: { world: { x: 0, y: 0, z: trackSegments.length * SEGMENT_LENGTH }, screen: { x: 0, y: 0, w: 0 } },
            p2: { world: { x: 0, y: 0, z: (trackSegments.length + 1) * SEGMENT_LENGTH }, screen: { x: 0, y: 0, w: 0 } },
            curve: curve,
            hill: hill,
            color: isAlternate ? { grass: '#1a5220', road: '#38383a', rumble: '#ffffff' } 
                               : { grass: '#113d16', road: '#303032', rumble: '#d60000' }
        });
    }
}

function findSegment(z) {
    if (trackSegments.length === 0) return null;
    let index = Math.floor(z / SEGMENT_LENGTH) % trackSegments.length;
    if (index < 0) index += trackSegments.length;
    return trackSegments[index];
}

function spawnOpponentsIA() {
    opponents = [];
    const colors = ['#00ffcc', '#ff00ff', '#ffff00', '#ff3333', '#3388ff'];
    let diff = DIFFICULTY_PRESETS[selectedDifficultyIdx];

    for (let i = 0; i < TOTAL_OPPONENTS; i++) {
        opponents.push({
            id: i,
            position: 500 + (i * 600), 
            lapsCompleted: 0, 
            playerX: (i % 2 === 0) ? -0.5 : 0.5,
            speed: diff.minSpeed + (Math.random() * diff.maxSpeedDelta),
            color: colors[i % colors.length]
        });
    }
}

function startCountdownSequence() {
    gameState = 'COUNTDOWN';
    countdownTime = 3.5;
    countdownText = "3";
    document.getElementById('menuStart').classList.add('hidden');
    document.getElementById('menuGameOver').classList.add('hidden');
}

// ============================================================================
// NÚCLEO DE FÍSICAS (LOOP PRINCIPAL)
// ============================================================================
function updatePhysicsEngine(dt) {
    if (trackSegments.length === 0) return;

    if (gameState === 'COUNTDOWN') {
        countdownTime -= dt;
        if (countdownTime > 2.5) countdownText = "3";
        else if (countdownTime > 1.5) countdownText = "2";
        else if (countdownTime > 0.5) countdownText = "1";
        else if (countdownTime > -0.5) countdownText = "¡YA!";
        else gameState = 'RUNNING';
        
        updateOpponentsIA(dt);
        return;
    }

    if (gameState !== 'RUNNING') return;

    totalTime += dt;
    timeLeft -= dt;

    if (timeLeft <= 0) {
        timeLeft = 0; 
        gameState = 'GAME_OVER';
        showEndScreen("TIEMPO AGOTADO\nNo lograste llegar a la meta.", false);
        return;
    }

    updateOpponentsIA(dt);

    let currentSegment = findSegment(position);
    if (!currentSegment) return;
    
    let isOffRoad = Math.abs(playerX) > 1.0;

    // Aceleración / Frenado
    if (keys.up) {
        let maxLimit = isOffRoad ? MAX_SPEED * 0.5 : MAX_SPEED;
        let accelRate = isOffRoad ? ACCEL * OFF_ROAD_ACCEL_FACTOR : ACCEL;
        if (speed < maxLimit) speed += (accelRate * dt * 1.5);
        else speed += (DECEL * dt);
    } else if (keys.down) {
        speed += (BRAKE * dt);
    } else {
        speed += (DECEL * dt * 2.0);
    }

    speed = Math.max(0, Math.min(speed, MAX_SPEED));
    
    let targetRpm = 1000 + (speed / MAX_SPEED) * 6500;
    playerRpm = playerRpm * 0.8 + targetRpm * 0.2;

    // Control de dirección (Giro)
    if (speed > 0) {
        let steerSpeed = VEHICLE_PRESETS[selectedVehicleIdx].handling * (isOffRoad ? 0.6 : 1.0) * (speed / MAX_SPEED);
        if (keys.left) {
            steerInput = Math.max(-1, steerInput - dt * 6);
            playerX -= (steerSpeed * dt * 1.5);
        } else if (keys.right) {
            steerInput = Math.min(1, steerInput + dt * 6);
            playerX += (steerSpeed * dt * 1.5);
        } else {
            steerInput *= 0.8;
        }
    }

    // Fuerza centrífuga en curvas
    if (speed > 0) {
        playerX -= (dt * (speed / MAX_SPEED) * currentSegment.curve * 0.5);
        skyScrollX -= (currentSegment.curve * (speed / MAX_SPEED) * 0.002);
    }

    // Colisión de bordes y penalización
    if (Math.abs(playerX) > 1.9) {
        playerX = Math.sign(playerX) * 1.9;
        speed = Math.max(speed * 0.4, 20);
        damage = Math.min(100, damage + 4);
        if (damage >= 100) {
            gameState = 'GAME_OVER';
            showEndScreen("VEHÍCULO DESTRUIDO\nDaño estructural del 100%.", false);
            return;
        }
    }

    position += (speed * 24 * dt);
    
    // Vuelta completada / Meta
    if (position >= trackLength) {
        if (currentLap < TOTAL_LAPS) {
            position -= trackLength;
            currentLap++; 
            timeLeft += 35; 
            score += 3000;
        } else {
            let finalRank = calculateRealRacePosition(true); 
            gameState = 'GAME_OVER';
            speed = 0;
            
            // Condición solicitada: Podio (P1, P2, P3) es victoria, el resto es pérdida.
            let reachedPodium = (finalRank <= 3);
            let messageText = `¡CARRERA FINALIZADA!\nPosición: P${finalRank}\nPuntuación Total: ${score + Math.floor(timeLeft * 100)}`;
            
            showEndScreen(messageText, reachedPodium);
            return;
        }
    }

    if (speed > 10) {
        score += Math.floor((speed / 80));
        if (isOffRoad && Math.random() < 0.4) {
            particles.push({ x: playerX * (WIDTH * 0.25) + (Math.random() * 20 - 10), y: HEIGHT - 40, size: Math.random() * 3 + 2, alpha: 0.6, color: '#9e7a44' });
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].y -= 2; 
        particles[i].alpha -= 0.05;
        if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
}

function updateOpponentsIA(dt) {
    let diff = DIFFICULTY_PRESETS[selectedDifficultyIdx];
    for (let cp of opponents) {
        let seg = findSegment(cp.position);
        if (!seg) continue;
        let factor = 1.0 - (Math.abs(seg.curve) * diff.curveSlowdown);
        cp.position += (cp.speed * factor * 24 * dt);
        
        if (cp.position >= trackLength) {
            cp.position -= trackLength;
            cp.lapsCompleted++;
        }
        cp.playerX += Math.sin(totalTime * 2 + cp.id) * 0.01;
    }
}

function calculateRealRacePosition(raceFinished = false) {
    let playerDist = raceFinished ? (TOTAL_LAPS * trackLength) : ((currentLap - 1) * trackLength + position);
    let rank = 1;
    for (let cp of opponents) {
        let cpDist = cp.lapsCompleted * trackLength + cp.position;
        if (cpDist > playerDist) rank++;
    }
    return rank;
}

// LÓGICA DE GANAR/PERDER CORREGIDA
function showEndScreen(text, isVictory) {
    const titleElement = document.getElementById('goTitle');
    
    if (isVictory) {
        titleElement.innerText = "¡VICTORIA!";
        titleElement.style.textShadow = "0 0 10px #00ffcc";
        titleElement.style.color = "#00ffcc"; // Verde neón para el podio
    } else {
        titleElement.innerText = "HAS PERDIDO";
        titleElement.style.textShadow = "0 0 10px #ff0055";
        titleElement.style.color = "#ff0055"; // Rojo neón para derrotas o fallos
    }

    document.getElementById('goReason').innerText = text;
    document.getElementById('menuGameOver').classList.remove('hidden');
}

// ============================================================================
// PROYECCIÓN 3D Y DIBUJO DE PISTA / OBJETOS
// ============================================================================
function project3D(point, cameraX, cameraY, cameraZ, depth) {
    let transX = point.world.x - cameraX;
    let transY = point.world.y - cameraY;
    let transZ = point.world.z - cameraZ;
    
    if (transZ < 0) transZ += trackLength;
    
    let scale = depth / transZ;
    point.screen.x = Math.round((WIDTH / 2) + (scale * transX * WIDTH / 2));
    point.screen.y = Math.round((HEIGHT / 2) - (scale * transY * HEIGHT / 2));
    point.screen.w = Math.round(scale * ROAD_WIDTH * WIDTH / 2);
    return scale;
}

function drawChampionshipHorizon(horizonY) {
    ctx.fillStyle = '#1c1026';
    ctx.beginPath(); ctx.moveTo(0, HEIGHT); ctx.lineTo(0, horizonY);
    for (let i = 0; i <= WIDTH; i += 40) {
        let idx = Math.abs(Math.floor(i / 40 + skyScrollX * 10)) % MOUNTAIN_PEAKS_LAYER1.length;
        ctx.lineTo(i, horizonY - MOUNTAIN_PEAKS_LAYER1[idx]);
    }
    ctx.lineTo(WIDTH, HEIGHT); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#2d163d';
    ctx.beginPath(); ctx.moveTo(0, HEIGHT); ctx.lineTo(0, horizonY);
    for (let i = 0; i <= WIDTH; i += 50) {
        let idx = Math.abs(Math.floor(i / 50 + skyScrollX * 18)) % MOUNTAIN_PEAKS_LAYER2.length;
        ctx.lineTo(i, horizonY - MOUNTAIN_PEAKS_LAYER2[idx]);
    }
    ctx.lineTo(WIDTH, HEIGHT); ctx.closePath(); ctx.fill();
}

function executeGraphicsRender() {
    if (trackSegments.length === 0) return;

    let shakeX = 0, shakeY = 0;
    if (gameState === 'RUNNING' && speed > 20) {
        let shk = (speed / MAX_SPEED) * (Math.abs(playerX) > 1.0 ? 3.0 : 0.6);
        shakeX = (Math.random() - 0.5) * shk;
        shakeY = (Math.random() - 0.5) * shk;
    }

    let skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT / 2);
    skyGrad.addColorStop(0, '#04020a'); skyGrad.addColorStop(0.6, '#8a1f00'); skyGrad.addColorStop(1, '#e57c00');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, WIDTH, HEIGHT);

    let horizonY = Math.round(HEIGHT / 2);
    drawChampionshipHorizon(horizonY);

    let playerSegment = findSegment(position);
    let playerPercent = (position % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    
    let baseWorldY = playerSegment.p1.world.y + (playerSegment.p2.world.y - playerSegment.p1.world.y) * playerPercent;
    camY = camY * 0.8 + (baseWorldY + CAMERA_HEIGHT_DEFAULT) * 0.2;

    let baseWorldX = playerSegment.p1.world.x + (playerSegment.p2.world.x - playerSegment.p1.world.x) * playerPercent;
    camX = camX * 0.8 + (baseWorldX + playerX * ROAD_WIDTH) * 0.2;

    let maxy = HEIGHT;
    let startIdx = Math.floor(position / SEGMENT_LENGTH);
    let spritesToRender = [];

    let dx = -(playerSegment.curve * playerPercent);
    let xAccum = 0;

    for (let i = 0; i < DRAW_DISTANCE; i++) {
        let currentIdx = (startIdx + i) % trackSegments.length;
        let seg = trackSegments[currentIdx];
        
        let camZOffset = position;
        if (startIdx + i >= trackSegments.length) camZOffset -= trackLength;

        let pt1 = { world: { x: seg.p1.world.x + xAccum, y: seg.p1.world.y, z: seg.p1.world.z }, screen: {} };
        let pt2 = { world: { x: seg.p2.world.x + xAccum + dx + seg.curve, y: seg.p2.world.y, z: seg.p2.world.z }, screen: {} };

        let scale = project3D(pt1, camX + shakeX * 3, camY + shakeY * 3, camZOffset, BASE_CAMERA_DEPTH);
        project3D(pt2, camX + shakeX * 3, camY + shakeY * 3, camZOffset, BASE_CAMERA_DEPTH);

        xAccum += dx; 
        dx += seg.curve;

        if (pt1.screen.y >= maxy || pt2.screen.y >= maxy || scale <= 0) continue;

        ctx.fillStyle = seg.color.grass; 
        ctx.fillRect(0, pt2.screen.y, WIDTH, (pt1.screen.y + 1) - pt2.screen.y);
        
        let r1 = pt1.screen.w * 0.12, r2 = pt2.screen.w * 0.12;
        ctx.fillStyle = seg.color.rumble;
        ctx.beginPath(); ctx.moveTo(pt1.screen.x - pt1.screen.w - r1, pt1.screen.y + 1); ctx.lineTo(pt1.screen.x - pt1.screen.w, pt1.screen.y + 1); ctx.lineTo(pt2.screen.x - pt2.screen.w, pt2.screen.y); ctx.lineTo(pt2.screen.x - pt2.screen.w - r2, pt2.screen.y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(pt1.screen.x + pt1.screen.w + r1, pt1.screen.y + 1); ctx.lineTo(pt1.screen.x + pt1.screen.w, pt1.screen.y + 1); ctx.lineTo(pt2.screen.x + pt2.screen.w, pt2.screen.y); ctx.lineTo(pt2.screen.x + pt2.screen.w + r2, pt2.screen.y); ctx.closePath(); ctx.fill();
        
        ctx.fillStyle = seg.color.road;
        ctx.beginPath(); ctx.moveTo(pt1.screen.x - pt1.screen.w, pt1.screen.y + 1); ctx.lineTo(pt1.screen.x + pt1.screen.w, pt1.screen.y + 1); ctx.lineTo(pt2.screen.x + pt2.screen.w, pt2.screen.y); ctx.lineTo(pt2.screen.x - pt2.screen.w, pt2.screen.y); ctx.closePath(); ctx.fill();
        
        if (seg.index === 0) { 
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(pt1.screen.x - pt1.screen.w, pt2.screen.y, pt1.screen.w * 2, (pt1.screen.y - pt2.screen.y) * 0.4);
        }

        maxy = pt1.screen.y;

        for (let cp of opponents) {
            let cpSeg = Math.floor(cp.position / SEGMENT_LENGTH) % trackSegments.length;
            if (cpSeg === seg.index) {
                spritesToRender.push({ sx: pt1.screen.x + shakeX, sy: pt1.screen.y + shakeY, cp: cp, scale: scale });
            }
        }
    }

    for (let p of particles) {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha; ctx.beginPath();
        ctx.arc(WIDTH / 2 + p.x + shakeX, p.y + shakeY, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    for (let i = spritesToRender.length - 1; i >= 0; i--) {
        let s = spritesToRender[i];
        let spriteX = Math.round(s.sx + (s.scale * s.cp.playerX * ROAD_WIDTH * WIDTH / 2));
        let w = Math.round(155 * s.scale * WIDTH / 2);
        let h = Math.round(80 * s.scale * WIDTH / 2);
        if (spriteX + w/2 > 0 && spriteX - w/2 < WIDTH) {
            ctx.fillStyle = s.cp.color; ctx.fillRect(spriteX - w / 2, s.sy - h, w, h);
            ctx.fillStyle = '#111111'; ctx.fillRect(spriteX - w / 2 + (w * 0.1), s.sy - h + (h * 0.15), w * 0.8, h * 0.3);
            ctx.fillStyle = '#ff1111'; ctx.fillRect(spriteX - w / 2 + 3, s.sy - 12, w * 0.15, 6); ctx.fillRect(spriteX + w / 2 - (w * 0.15) - 3, s.sy - 12, w * 0.15, 6);
        }
    }

    if (gameState === 'RUNNING' || gameState === 'COUNTDOWN') {
        const cW = 190, cH = 130;
        const cX = (WIDTH / 2) - (cW / 2) + (steerInput * 35) + shakeX;
        const cY = HEIGHT - cH - 20 + shakeY;
        let isBraking = keys.down || !keys.up;

        let colBody = (selectedVehicleIdx === 0) ? '#ff2a00' : (selectedVehicleIdx === 1) ? '#0066ff' : '#ccaa00';
        ctx.fillStyle = '#0f0f14'; ctx.fillRect(cX + 6, cY + cH - 35, 24, 35); ctx.fillRect(cX + cW - 30, cY + cH - 35, 24, 35); 
        ctx.fillStyle = colBody; ctx.fillRect(cX, cY + 25, cW, cH - 40); 
        ctx.fillStyle = '#14161f'; ctx.fillRect(cX + 16, cY + 35, cW - 32, 25); 
        ctx.fillStyle = isBraking ? '#ff1111' : '#660000'; ctx.fillRect(cX + 8, cY + cH - 28, 22, 10); ctx.fillRect(cX + cW - 30, cY + cH - 28, 22, 10); 
    }

    drawHUD();
}

function drawHUD() {
    if (gameState === 'START') return;

    if (gameState === 'COUNTDOWN') {
        ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 55px monospace'; ctx.textAlign = 'center';
        ctx.fillText(countdownText, WIDTH / 2, HEIGHT / 2 - 30); ctx.textAlign = 'left';
        return;
    }

    ctx.fillStyle = timeLeft < 15 ? '#ff3333' : '#ffffff'; ctx.font = 'bold 24px monospace';
    ctx.fillText(`TIEMPO: ${Math.ceil(timeLeft)}s`, 25, 45);

    ctx.fillStyle = '#ffffff'; ctx.font = '22px monospace';
    ctx.fillText(`${Math.floor(speed)} KM/H`, 25, 75);

    ctx.fillStyle = '#222533'; ctx.fillRect(25, 88, 140, 6);
    ctx.fillStyle = playerRpm > 6000 ? '#ff3333' : '#00ffcc';
    ctx.fillRect(25, 88, (playerRpm / 7500) * 140, 6);

    ctx.fillStyle = '#8a9ab0'; ctx.font = '15px monospace';
    ctx.fillText(`DAÑO: ${damage}%`, 25, 120);

    ctx.fillStyle = '#ffff00'; ctx.font = 'bold 22px monospace';
    ctx.fillText(`PUNTOS: ${score}`, WIDTH - 220, 45);
    
    ctx.fillStyle = '#ffffff'; ctx.font = '18px monospace';
    ctx.fillText(`VUELTA: ${currentLap}/${TOTAL_LAPS}`, WIDTH - 220, 75);

    let rank = calculateRealRacePosition(gameState === 'GAME_OVER');
    ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 18px monospace';
    ctx.fillText(`POSICIÓN: P${rank}`, WIDTH - 220, 105);
}

function runMasterGameLoop() {
    updatePhysicsEngine(STEP);
    executeGraphicsRender();
    requestAnimationFrame(runMasterGameLoop);
}

function resetRaceState() {
    position = 0; speed = 0; totalTime = 0; currentLap = 1; score = 0; damage = 0; playerX = 0;
    particles = []; steerInput = 0; camX = 0; camY = CAMERA_HEIGHT_DEFAULT; skyScrollX = 0;
    gameState = 'START';
    document.getElementById('menuGameOver').classList.add('hidden');
    document.getElementById('menuStart').classList.remove('hidden');
}

window.resetRaceState = resetRaceState;

window.onload = function() {
    initInputSystem();
    buildSelectedChampionshipTrack(0); 
    runMasterGameLoop();
};
