/**
 * Acoustic Attacker - Core Game Logic
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const stageEl = document.getElementById('stage');
const livesEl = document.getElementById('lives');
const healthBar = document.getElementById('health-bar');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const continueScreen = document.getElementById('continue-screen');
const livesLeftEl = document.getElementById('lives-left');
const clearScreen = document.getElementById('clear-screen');
const allClearScreen = document.getElementById('all-clear-screen');

const hiScoreEl = document.getElementById('hi-score');

// Game Constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 450;
let scale = 1;

// Game State
let gameState = 'START'; // START, PLAYING, STAGE_CLEAR, GAME_OVER, ALL_CLEAR
let score = 0;
let highScore = parseInt(localStorage.getItem('acousticAttackerHiScore')) || 0;
let stage = 1;
let lives = 3;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let particles = [];
let items = [];
let boss = null;
let frameCount = 0;
let stageTimer = 0;

// Player Object
const player = {
    x: 100,
    y: GAME_HEIGHT / 2,
    width: 40,
    height: 40,
    speed: 5,
    health: 100,
    maxHealth: 100,
    fireTimer: 0,
    fireRate: 15, // frames between shots
    targetX: 100,
    targetY: GAME_HEIGHT / 2,
    damageTimer: 0,
    healTimer: 0
};

const bossImages = [new Image(), new Image(), new Image()];
bossImages[0].src = 'assets/boss1.png';
bossImages[1].src = 'assets/boss2.png';
bossImages[2].src = 'assets/boss3.png';

// --- Initialization ---

function init() {
    resize();
    window.addEventListener('resize', resize);
    setupInputs();
    
    document.getElementById('start-btn').onclick = startGame;
    document.getElementById('restart-btn').onclick = resetGame;
    document.getElementById('continue-btn').onclick = continueGame;
    document.getElementById('back-btn').onclick = () => {
        allClearScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
        gameState = 'START';
        resetGame();
    };

    requestAnimationFrame(gameLoop);
}

function resize() {
    const container = document.getElementById('game-container');
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    scale = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT);
    canvas.width = GAME_WIDTH * scale;
    canvas.height = GAME_HEIGHT * scale;
    ctx.scale(scale, scale);
}

function startGame() {
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    resetStage();
}

function resetGame() {
    score = 0;
    stage = 1;
    lives = 3;
    player.health = 100;
    scoreEl.innerText = score;
    stageEl.innerText = stage;
    gameOverScreen.classList.add('hidden');
    startGame();
}

function continueGame() {
    if (lives > 0) {
        lives--;
        player.health = 100;
        enemyBullets = [];
        enemies = [];
        gameState = 'PLAYING';
        continueScreen.classList.add('hidden');
        updateUI();
    }
}

function resetStage() {
    enemyBullets = [];
    enemies = [];
    items = [];
    boss = null;
    stageTimer = 0;
    // Health refill removed for challenge
    updateUI();
}

// --- Input Handling ---

function setupInputs() {
    // Mouse/Touch Direct Follow
    const handleMove = (e) => {
        if (gameState !== 'PLAYING') return;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // If not using joystick area
        if (!e.touches || clientX > 200 || clientY < window.innerHeight - 200) {
            player.targetX = (clientX - rect.left) / scale;
            player.targetY = (clientY - rect.top) / scale;
        }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', (e) => {
        handleMove(e);
        e.preventDefault();
    }, { passive: false });

    // Virtual Joystick Logic
    const jContainer = document.getElementById('joystick-container');
    const jStick = document.getElementById('joystick-stick');
    const jBase = document.getElementById('joystick-base');
    let jActive = false;

    jContainer.addEventListener('touchstart', (e) => {
        jActive = true;
    });

    jContainer.addEventListener('touchmove', (e) => {
        if (!jActive) return;
        const touch = e.touches[0];
        const rect = jBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const dist = Math.hypot(dx, dy);
        const maxDist = rect.width / 2;
        
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        
        jStick.style.transform = `translate(${dx}px, ${dy}px)`;
        
        // Move player based on joystick
        player.targetX += dx * 0.2;
        player.targetY += dy * 0.2;
        
        // Constrain to screen
        player.targetX = Math.max(20, Math.min(GAME_WIDTH - 20, player.targetX));
        player.targetY = Math.max(20, Math.min(GAME_HEIGHT - 20, player.targetY));
    });

    jContainer.addEventListener('touchend', () => {
        jActive = false;
        jStick.style.transform = `translate(0, 0)`;
    });
}

// --- Classes ---

class Bullet {
    constructor(x, y, vx, vy, color, size = 5) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.active = true;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < -50 || this.x > GAME_WIDTH + 50 || this.y < -50 || this.y > GAME_HEIGHT + 50) {
            this.active = false;
        }
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
    }
}

class Enemy {
    constructor(type) {
        this.x = GAME_WIDTH + 50;
        this.y = Math.random() * (GAME_HEIGHT - 60) + 30;
        this.active = true;
        this.type = type || '4TH'; // 16TH, 8TH, 4TH, 2ND, WHOLE
        
        switch(this.type) {
            case '16TH':
                this.hp = 1; this.vx = -10; this.score = 500; this.color = '#f472b6'; break;
            case '8TH':
                this.hp = 2; this.vx = -7; this.score = 150; this.color = '#38bdf8'; break;
            case '2ND':
                this.hp = 4; this.vx = -2; this.score = 150; this.color = '#fbbf24'; break;
            case 'WHOLE':
                this.hp = 6; this.vx = -1; this.score = 500; this.color = '#94a3b8'; break;
            default: // 4TH
                this.hp = 3; this.vx = -4; this.score = 150; this.color = '#fbbf24'; break;
        }
    }
    update() {
        this.x += this.vx;
        if (this.x < -100) this.active = false;
        
        // Auto-shoot for some types
        if (frameCount % 60 === 0 && Math.random() < 0.3) {
            enemyBullets.push(new Bullet(this.x, this.y, -5, 0, '#ff00ff', 4));
        }
    }
    draw() {
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        
        // Draw Musical Note based on type
        if (this.type === 'WHOLE') {
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, 15, 10, 0, 0, Math.PI * 2);
            ctx.stroke(); // Hollow head, no stem
        } else {
            // Note Head
            ctx.beginPath();
            if (this.type === '2ND') {
                ctx.ellipse(this.x, this.y + 10, 10, 7, Math.PI / 4, 0, Math.PI * 2);
                ctx.stroke(); // Hollow head
            } else {
                ctx.ellipse(this.x, this.y + 10, 10, 7, Math.PI / 4, 0, Math.PI * 2);
                ctx.fill(); // Filled head
            }
            // Stem
            ctx.fillRect(this.x + 8, this.y - 15, 3, 25);
            // Flags
            if (this.type === '8TH') {
                ctx.fillRect(this.x + 8, this.y - 15, 12, 4);
            } else if (this.type === '16TH') {
                ctx.fillRect(this.x + 8, this.y - 15, 12, 4);
                ctx.fillRect(this.x + 8, this.y - 7, 12, 4);
            }
        }
    }
}

class Item {
    constructor(type) {
        this.x = Math.random() * (GAME_WIDTH - 60) + 30;
        this.y = -50;
        this.active = true;
        this.type = type || '4TH';
        this.vy = 2; // Move down
        
        switch(this.type) {
            case '16TH': this.heal = 10; this.color = '#4ade80'; break;
            case '8TH': this.heal = 20; this.color = '#4ade80'; break;
            case '2ND': this.heal = 60; this.color = '#4ade80'; break;
            case 'WHOLE': this.heal = 100; this.color = '#4ade80'; break;
            default: this.heal = 40; this.color = '#4ade80'; break;
        }
    }
    update() {
        this.y += this.vy;
        if (this.y > GAME_HEIGHT + 100) this.active = false;
    }
    draw() {
        // Blinking effect
        if (frameCount % 20 < 10) return;

        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;

        // Draw Musical Rest based on type
        ctx.beginPath();
        if (this.type === 'WHOLE') {
            // Whole rest (Hanging rectangle)
            ctx.moveTo(this.x - 15, this.y); ctx.lineTo(this.x + 15, this.y);
            ctx.fillRect(this.x - 10, this.y, 20, 10);
            ctx.stroke();
        } else if (this.type === '2ND') {
            // Half rest (Sitting rectangle)
            ctx.moveTo(this.x - 15, this.y); ctx.lineTo(this.x + 15, this.y);
            ctx.fillRect(this.x - 10, this.y - 10, 20, 10);
            ctx.stroke();
        } else if (this.type === '4TH') {
            // Quarter rest (Squiggle)
            ctx.beginPath();
            ctx.moveTo(this.x - 5, this.y - 15);
            ctx.lineTo(this.x + 5, this.y - 5);
            ctx.lineTo(this.x - 5, this.y + 5);
            ctx.lineTo(this.x + 5, this.y + 15);
            ctx.stroke();
        } else {
            // 8th/16th rest (Line with hooks)
            ctx.moveTo(this.x, this.y - 15); ctx.lineTo(this.x - 10, this.y + 15);
            ctx.stroke();
            ctx.beginPath(); ctx.arc(this.x, this.y - 10, 4, 0, Math.PI * 2); ctx.fill();
            if (this.type === '16TH') {
                ctx.beginPath(); ctx.arc(this.x - 4, this.y, 4, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
}
class Boss {
    constructor(stage) {
        this.x = GAME_WIDTH + 200;
        this.y = GAME_HEIGHT / 2;
        this.targetX = GAME_WIDTH - 150;
        this.hp = 50 * stage;
        this.maxHp = this.hp;
        this.active = true;
        this.state = 'ENTERING'; // ENTERING, PATTERN_A, PATTERN_B
        this.color = stage === 1 ? '#ef4444' : (stage === 2 ? '#ff00ff' : '#fbbf24');
    }
    update() {
        if (this.state === 'ENTERING') {
            this.x += (this.targetX - this.x) * 0.05;
            if (Math.abs(this.x - this.targetX) < 1) this.state = 'PATTERN_A';
        } else {
            // Hover movement
            this.y = GAME_HEIGHT / 2 + Math.sin(frameCount * 0.05) * 100;
            
            // Shooting patterns
            if (frameCount % 40 === 0) {
                for(let i=0; i<8; i++) {
                    const angle = (Math.PI * 2 / 8) * i + (frameCount * 0.01);
                    enemyBullets.push(new Bullet(this.x, this.y, Math.cos(angle)*4, Math.sin(angle)*4, this.color, 6));
                }
            }
        }
    }
    draw() {
        ctx.shadowBlur = 30;
        ctx.shadowColor = this.color;
        
        // Draw Boss Image
        const img = bossImages[stage - 1];
        if (img.complete && img.naturalWidth !== 0) {
            ctx.drawImage(img, this.x - 60, this.y - 60, 120, 120);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - 40, this.y - 60, 80, 120);
        }
        
        // Boss HP Bar
        const barWidth = 200;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - 100, this.y - 80, barWidth, 10);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(this.x - 100, this.y - 80, barWidth * (this.hp / this.maxHp), 10);
    }
}

// --- Main Loop ---

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (gameState !== 'PLAYING') return;
    frameCount++;
    stageTimer++;

    // Player Movement (Smooth lerp to target)
    player.x += (player.targetX - player.x) * 0.1;
    player.y += (player.targetY - player.y) * 0.1;

    // VFX Timers
    if (player.damageTimer > 0) player.damageTimer--;
    if (player.healTimer > 0) player.healTimer--;

    // Player Shooting
    if (player.fireTimer > 0) player.fireTimer--;
    if (player.fireTimer === 0) {
        playerBullets.push(new Bullet(player.x + 20, player.y, 10, 0, '#38bdf8', 6));
        player.fireTimer = player.fireRate;
    }

    // Spawn Enemies
    if (!boss && stageTimer < 1500) {
        if (frameCount % 40 === 0) {
            const r = Math.random();
            if (r < 0.1) enemies.push(new Enemy('16TH'));
            else if (r < 0.3) enemies.push(new Enemy('8TH'));
            else if (r < 0.7) enemies.push(new Enemy('4TH'));
            else if (r < 0.9) enemies.push(new Enemy('2ND'));
            else enemies.push(new Enemy('WHOLE'));
        }
    } else if (!boss && stageTimer >= 1500) {
        boss = new Boss(stage);
    }

    // Update Entities
    playerBullets.forEach(b => b.update());
    enemyBullets.forEach(b => b.update());
    enemies.forEach(e => e.update());
    items.forEach(i => i.update());
    if (boss) boss.update();

    // Spawn Items
    if (frameCount % 400 === 0) {
        const r = Math.random();
        if (r < 0.05) items.push(new Item('WHOLE'));
        else if (r < 0.15) items.push(new Item('2ND'));
        else if (r < 0.4) items.push(new Item('4TH'));
        else if (r < 0.7) items.push(new Item('8TH'));
        else items.push(new Item('16TH'));
    }

    // Collisions
    checkCollisions();

    // Clean up
    playerBullets = playerBullets.filter(b => b.active);
    enemyBullets = enemyBullets.filter(b => b.active);
    enemies = enemies.filter(e => e.active);
    items = items.filter(i => i.active);
    
    // Check Death
    if (player.health <= 0) {
        if (lives > 0) {
            gameState = 'CONTINUE';
            continueScreen.classList.remove('hidden');
            livesLeftEl.innerText = `REMAINING LIVES: ${lives}`;
        } else {
            gameState = 'GAME_OVER';
            gameOverScreen.classList.remove('hidden');
            document.getElementById('final-score').innerText = `SCORE: ${score}`;
        }
    }
}

function addScore(pts) {
    score += pts;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('acousticAttackerHiScore', highScore);
    }
    updateUI();
}

function damagePlayer(amt) {
    player.health -= amt;
    player.damageTimer = 60; // Start blinking
    updateUI();
    createExplosion(player.x, player.y, '#fff');
}

function bossNextStep() {
    addScore(5000); // Use addScore
    createExplosion(boss.x, boss.y, boss.color, 50);
    boss = null;
    
    if (stage < 3) {
        gameState = 'STAGE_CLEAR';
        clearScreen.classList.remove('hidden');
        setTimeout(() => {
            stage++;
            clearScreen.classList.add('hidden');
            gameState = 'PLAYING';
            resetStage();
        }, 3000);
    } else {
        gameState = 'ALL_CLEAR';
        allClearScreen.classList.remove('hidden');
    }
}

function updateUI() {
    scoreEl.innerText = score;
    hiScoreEl.innerText = highScore;
    stageEl.innerText = stage;
    livesEl.innerText = lives;
    healthBar.style.width = `${Math.max(0, player.health)}%`;
}

function checkCollisions() {
    // Player bullets vs Enemies
    playerBullets.forEach(b => {
        enemies.forEach(e => {
            const dist = Math.hypot(b.x - e.x, b.y - e.y);
            if (dist < 25) {
                b.active = false;
                e.hp--;
                if (e.hp <= 0) {
                    e.active = false;
                    addScore(e.score); // Use enemy-specific score
                    createExplosion(e.x, e.y, e.color);
                }
            }
        });
        
        if (boss) {
            const dist = Math.hypot(b.x - boss.x, b.y - boss.y);
            if (dist < 60) {
                b.active = false;
                boss.hp--;
                if (boss.hp <= 0) {
                    bossNextStep();
                }
            }
        }
    });

    // Enemy bullets vs Player
    const bulletHitRadius = 15 + (stage * 5); // Stage 1: 20, Stage 2: 25, Stage 3: 30
    enemyBullets.forEach(b => {
        const dist = Math.hypot(b.x - player.x, b.y - player.y);
        if (dist < bulletHitRadius) {
            b.active = false;
            damagePlayer(10);
        }
    });

    // Enemies vs Player
    const enemyHitRadius = 25 + (stage * 5); // Stage 1: 30, Stage 2: 35, Stage 3: 40
    enemies.forEach(e => {
        const dist = Math.hypot(e.x - player.x, e.y - player.y);
        if (dist < enemyHitRadius) {
            e.active = false;
            // Explicitly NO score for colliding
            damagePlayer(20);
            createExplosion(e.x, e.y, e.color);
        }
    });

    // Player vs Items
    const itemHitRadius = 25 + (stage * 5);
    items.forEach(i => {
        const dist = Math.hypot(i.x - player.x, i.y - player.y);
        if (dist < itemHitRadius) {
            i.active = false;
            player.health = Math.min(100, player.health + i.heal);
            player.healTimer = 45; // Start aura
            updateUI();
        }
    });
}

// --- Effects ---

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 30,
            color
        });
    }
}

function drawBackground() {
    ctx.fillStyle = stage === 1 ? '#fefce8' : (stage === 2 ? '#0f172a' : '#1e1b4b');
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (stage === 1) {
        // Classical: Musical Staves
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = 150 + i * 20;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(GAME_WIDTH, y);
            ctx.stroke();
        }
    } else if (stage === 2) {
        // Rock: Neon Grid/Pulse
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 2;
        const offset = (frameCount * 2) % 100;
        for (let x = -offset; x < GAME_WIDTH; x += 100) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, GAME_HEIGHT);
            ctx.stroke();
        }
    } else {
        // Jazz: Smoky Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
}

function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawBackground();

    // Draw Particles
    particles.forEach((p, i) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
    });
    particles = particles.filter(p => p.life > 0);
    ctx.globalAlpha = 1;

    // Draw Entities
    if (gameState === 'PLAYING' || gameState === 'STAGE_CLEAR' || gameState === 'ALL_CLEAR') {
        const pColor = stage === 1 ? '#000' : '#fff';
        
        // --- Damage Blinking ---
        if (player.damageTimer > 0 && frameCount % 4 < 2) {
            // Skip drawing player this frame
        } else {
            // --- Heal Aura ---
            if (player.healTimer > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = 3;
                ctx.globalAlpha = player.healTimer / 45;
                const auraSize = 30 + (45 - player.healTimer);
                ctx.arc(player.x, player.y, auraSize, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            ctx.strokeStyle = pColor;
            ctx.fillStyle = pColor;
            ctx.lineWidth = 2;
            ctx.shadowBlur = stage > 1 ? 15 : 0;
            ctx.shadowColor = '#38bdf8';

            // --- Stick Human ---
            // Head
            ctx.beginPath();
            ctx.arc(player.x, player.y - 15, 6, 0, Math.PI * 2);
            ctx.stroke();
            // Body
            ctx.beginPath();
            ctx.moveTo(player.x, player.y - 9);
            ctx.lineTo(player.x, player.y + 5);
            ctx.stroke();
            // Arms
            ctx.beginPath();
            ctx.moveTo(player.x - 8, player.y - 5);
            ctx.lineTo(player.x + 8, player.y - 5);
            ctx.stroke();
            // Legs
            ctx.beginPath();
            ctx.moveTo(player.x, player.y + 5);
            ctx.lineTo(player.x - 5, player.y + 15);
            ctx.moveTo(player.x, player.y + 5);
            ctx.lineTo(player.x + 5, player.y + 15);
            ctx.stroke();

            // --- Stage 2+: Microphone ---
            if (stage >= 2) {
                ctx.fillStyle = stage === 1 ? '#475569' : '#cbd5e1';
                // Mic Handle
                ctx.fillRect(player.x + 5, player.y - 12, 3, 15);
                // Mic Head
                ctx.beginPath();
                ctx.arc(player.x + 6.5, player.y - 14, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // --- Stage 3: Guitar ---
            if (stage >= 3) {
                ctx.fillStyle = '#92400e'; // Brown/Wood
                // Guitar Body (Triangle-ish)
                ctx.beginPath();
                ctx.moveTo(player.x - 5, player.y - 5);
                ctx.lineTo(player.x - 15, player.y + 10);
                ctx.lineTo(player.x - 2, player.y + 12);
                ctx.closePath();
                ctx.fill();
                // Guitar Neck
                ctx.strokeStyle = '#92400e';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(player.x - 10, player.y + 2);
                ctx.lineTo(player.x - 20, player.y - 10);
                ctx.stroke();
            }
        }
        
        playerBullets.forEach(b => b.draw());
        enemyBullets.forEach(b => b.draw());
        enemies.forEach(e => e.draw());
        if (boss) boss.draw();
        items.forEach(i => i.draw());
    }
}

init();
