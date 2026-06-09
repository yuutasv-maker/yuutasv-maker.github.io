const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.querySelector('.canvas-container');

// UI Elements
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const finalScoreElement = document.getElementById('finalScore');
const overlays = {
    start: document.getElementById('startScreen'),
    gameOver: document.getElementById('gameOverScreen'),
    victory: document.getElementById('victoryScreen')
};
const btns = {
    start: document.getElementById('startBtn'),
    restart: document.getElementById('restartBtn'),
    next: document.getElementById('nextLevelBtn')
};

// Game State
let gameState = 'START'; // START, READY, PLAYING, GAMEOVER, VICTORY
let score = 0;
let lives = 3;
let animationId;

// Physics / Sizes
let GAME_WIDTH = 0;
let GAME_HEIGHT = 0;

const ball = {
    x: 0, y: 0,
    radius: 0,
    dx: 0, dy: 0,
    speed: 0,
    color: '#f472b6' // pink
};

const paddle = {
    x: 0, y: 0,
    width: 0, height: 0,
    color: '#38bdf8' // sky
};

const brickConfig = {
    rowCount: 5,
    columnCount: 6,
    padding: 10,
    offsetTop: 50,
    offsetLeft: 15,
    colors: ['#c084fc', '#818cf8', '#38bdf8', '#34d399', '#fcd34d']
};

let bricks = [];

function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    GAME_WIDTH = rect.width;
    GAME_HEIGHT = rect.height;
    
    // Support Retina Displays for crispness
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    
    paddle.width = GAME_WIDTH * 0.25;
    if (paddle.width < 70) paddle.width = 70;
    if (paddle.width > 120) paddle.width = 120;
    paddle.height = Math.max(GAME_HEIGHT * 0.02, 12);
    paddle.y = GAME_HEIGHT - paddle.height - 20;
    
    if (paddle.x + paddle.width > GAME_WIDTH) {
        paddle.x = GAME_WIDTH - paddle.width;
    }
    
    ball.radius = Math.max(GAME_WIDTH * 0.015, 6);
    
    if (gameState === 'START' || gameState === 'READY') {
        resetBall();
    }
    
    if (bricks.length > 0 && bricks[0].length > 0) {
        updateBricksLayout();
    }
}

function initBricks() {
    bricks = [];
    for (let c = 0; c < brickConfig.columnCount; c++) {
        bricks[c] = [];
        for (let r = 0; r < brickConfig.rowCount; r++) {
            bricks[c][r] = { x: 0, y: 0, status: 1 };
        }
    }
    updateBricksLayout();
}

function updateBricksLayout() {
    const totalPadding = brickConfig.padding * (brickConfig.columnCount - 1);
    const availableWidth = GAME_WIDTH - (brickConfig.offsetLeft * 2) - totalPadding;
    const brickWidth = availableWidth / brickConfig.columnCount;
    const brickHeight = Math.max(GAME_HEIGHT * 0.04, 15);
    
    for (let c = 0; c < brickConfig.columnCount; c++) {
        for (let r = 0; r < brickConfig.rowCount; r++) {
            if (bricks[c][r] && bricks[c][r].status === 1) {
                bricks[c][r].x = (c * (brickWidth + brickConfig.padding)) + brickConfig.offsetLeft;
                bricks[c][r].y = (r * (brickHeight + brickConfig.padding)) + brickConfig.offsetTop;
                bricks[c][r].w = brickWidth;
                bricks[c][r].h = brickHeight;
            }
        }
    }
}

function resetBall() {
    paddle.x = (GAME_WIDTH - paddle.width) / 2;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius - 1;
    ball.dx = 0;
    ball.dy = 0;
}

function launchBall() {
    ball.speed = GAME_HEIGHT * 0.012;
    const angle = (Math.random() * Math.PI / 4) + (Math.PI / 8); 
    const dir = Math.random() > 0.5 ? 1 : -1;
    
    ball.dx = ball.speed * Math.sin(angle) * dir;
    ball.dy = -ball.speed * Math.cos(angle);
}

// Input Handling
let isTouching = false;

function handleMove(clientX) {
    if (gameState !== 'PLAYING' && gameState !== 'READY') return;
    const rect = canvas.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    
    if (relativeX > 0 && relativeX < GAME_WIDTH) {
        let newX = relativeX - paddle.width / 2;
        paddle.x = Math.max(0, Math.min(GAME_WIDTH - paddle.width, newX));
    }
}

canvas.addEventListener('mousedown', e => {
    if (gameState === 'READY') {
        gameState = 'PLAYING';
        launchBall();
    }
});

canvas.addEventListener('mousemove', e => handleMove(e.clientX));

canvas.addEventListener('touchstart', e => {
    if (gameState === 'READY') {
        gameState = 'PLAYING';
        launchBall();
    }
    isTouching = true;
    handleMove(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    if(isTouching) {
        e.preventDefault(); 
        handleMove(e.touches[0].clientX);
    }
}, { passive: false });

canvas.addEventListener('touchend', () => isTouching = false);

// UI Actions
function showScreen(screenId) {
    Object.values(overlays).forEach(el => el.classList.add('hidden'));
    if (screenId) {
        overlays[screenId].classList.remove('hidden');
    }
}

function startGame() {
    score = 0;
    lives = 3;
    scoreElement.textContent = score;
    livesElement.textContent = lives;
    initBricks();
    resetBall();
    gameState = 'READY';
    showScreen(null);
    if (!animationId) draw();
}

function loseLife() {
    lives--;
    livesElement.textContent = lives;
    
    // UI Shake Effect
    container.style.transform = 'translate(-10px, 0)';
    setTimeout(() => container.style.transform = 'translate(10px, 0)', 50);
    setTimeout(() => container.style.transform = 'translate(-10px, 0)', 100);
    setTimeout(() => container.style.transform = 'translate(0, 0)', 150);
    
    // Red Flash Effect
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(239, 68, 68, 0.6)'; // Red flash
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 0.6s ease-out';
    flash.style.zIndex = '100';
    container.appendChild(flash);
    
    requestAnimationFrame(() => {
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 600);
    });
    
    if (lives === 0) {
        gameState = 'GAMEOVER';
        finalScoreElement.textContent = score;
        showScreen('gameOver');
    } else {
        gameState = 'READY';
        resetBall();
    }
}

function winGame() {
    gameState = 'VICTORY';
    showScreen('victory');
}

btns.start.addEventListener('click', startGame);
btns.restart.addEventListener('click', startGame);
btns.next.addEventListener('click', startGame);

// Draw Functions
function drawRoundRect(x, y, w, h, radius, fill, glow) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    
    if (glow) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = fill;
    } else {
        ctx.shadowBlur = 0;
    }
    
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = ball.color;
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;
}

function drawPaddle() {
    drawRoundRect(paddle.x, paddle.y, paddle.width, paddle.height, paddle.height/2, paddle.color, true);
}

function drawBricks() {
    let activeBricks = 0;
    for (let c = 0; c < brickConfig.columnCount; c++) {
        for (let r = 0; r < brickConfig.rowCount; r++) {
            let b = bricks[c][r];
            if (b.status === 1) {
                activeBricks++;
                drawRoundRect(b.x, b.y, b.w, b.h, 4, brickConfig.colors[r % brickConfig.colors.length], false);
            }
        }
    }
    
    if (activeBricks === 0 && (gameState === 'PLAYING' || gameState === 'READY')) {
        winGame();
    }
}

// Collision Logic
function collisionDetection() {
    for (let c = 0; c < brickConfig.columnCount; c++) {
        for (let r = 0; r < brickConfig.rowCount; r++) {
            let b = bricks[c][r];
            if (b.status === 1) {
                const testX = ball.x < b.x ? b.x : (ball.x > b.x + b.w ? b.x + b.w : ball.x);
                const testY = ball.y < b.y ? b.y : (ball.y > b.y + b.h ? b.y + b.h : ball.y);
                
                const distX = ball.x - testX;
                const distY = ball.y - testY;
                const distance = Math.sqrt((distX*distX) + (distY*distY));
                
                if (distance <= ball.radius) {
                    b.status = 0;
                    score += 10 * (brickConfig.rowCount - r);
                    scoreElement.textContent = score;
                    
                    if (Math.abs(distX) > Math.abs(distY)) {
                        ball.dx = -ball.dx;
                    } else {
                        ball.dy = -ball.dy;
                    }
                    
                    if (ball.speed < GAME_HEIGHT * 0.02) {
                        ball.speed *= 1.02; // gradual speed up
                        const angle = Math.atan2(ball.dy, ball.dx);
                        ball.dx = ball.speed * Math.cos(angle);
                        ball.dy = ball.speed * Math.sin(angle);
                    }
                    return; // prevent multi-brick hit bug in one frame
                }
            }
        }
    }
}

// Main Loop
function draw() {
    if (gameState !== 'PLAYING' && gameState !== 'READY') {
        animationId = requestAnimationFrame(draw);
        return;
    }

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    if (gameState === 'READY') {
        // Keep ball explicitly locked to the paddle center
        ball.x = paddle.x + paddle.width / 2;
        ball.y = paddle.y - ball.radius - 1;
    }
    
    drawBricks();
    drawBall();
    drawPaddle();
    
    if (gameState === 'READY') {
        const alpha = 0.4 + Math.sin(Date.now() / 200) * 0.4;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = '700 24px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText('TAP TO LAUNCH', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
        ctx.shadowBlur = 0; // reset
    }
    
    if (gameState === 'PLAYING') {
        collisionDetection();
        
        // Bounds
        if (ball.x + ball.dx > GAME_WIDTH - ball.radius || ball.x + ball.dx < ball.radius) {
            ball.dx = -ball.dx;
        }
        if (ball.y + ball.dy < ball.radius) {
            ball.dy = -ball.dy;
        } else if (ball.dy > 0 && ball.y + ball.dy >= paddle.y - ball.radius && ball.y < paddle.y) {
            if (ball.x + ball.radius > paddle.x && ball.x - ball.radius < paddle.x + paddle.width) {
                ball.y = paddle.y - ball.radius;
                
                let hitPoint = ball.x - (paddle.x + paddle.width / 2);
                let normalizedHit = hitPoint / (paddle.width / 2);
                let bounceAngle = normalizedHit * (Math.PI / 2.5);
                
                ball.dx = ball.speed * Math.sin(bounceAngle);
                ball.dy = -Math.abs(ball.speed * Math.cos(bounceAngle));
            }
        } else if (ball.y > GAME_HEIGHT + ball.radius) {
            loseLife();
        }
        
        ball.x += ball.dx;
        ball.y += ball.dy;
    }
    
    animationId = requestAnimationFrame(draw);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
initBricks();
draw();
