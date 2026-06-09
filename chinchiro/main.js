document.addEventListener('DOMContentLoaded', () => {
    const diceElements = [
        document.getElementById('dice-1'),
        document.getElementById('dice-2'),
        document.getElementById('dice-3')
    ];
    const rollButton = document.getElementById('roll-button');
    const nextTurnButton = document.getElementById('next-turn');
    const handNameDisplay = document.getElementById('hand-name');
    const turnIndicator = document.getElementById('current-player');
    const playerScoreDisplay = document.getElementById('player-score');
    const dealerScoreDisplay = document.getElementById('dealer-score');
    const resultOverlay = document.getElementById('result-overlay');
    const winnerText = document.getElementById('winner-text');
    const restartButton = document.getElementById('restart-button');

    let gameState = {
        playerScore: 1000,
        dealerScore: 1000,
        currentTurn: 'player', // 'player' or 'dealer'
        playerHand: null,
        dealerHand: null,
        rollsLeft: 3,
        isRolling: false
    };

    // Sound effects using Web Audio API
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === 'roll') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(100 + Math.random() * 200, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'win') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.5); // C6
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } else if (type === 'loss') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(261.63, audioCtx.currentTime); // C4
            oscillator.frequency.linearRampToValueAtTime(130.81, audioCtx.currentTime + 0.5); // C3
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } else if (type === 'kyuin') {
            // Pachinko Kyuin! Sound
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(1800, audioCtx.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.15);
            oscillator.frequency.linearRampToValueAtTime(1800, audioCtx.currentTime + 0.25);
            
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.25);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } else if (type === 'dosun') {
            // Pachinko Dosun... Sound
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.8);
            
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.8);
        }
    }

    // Dice face rotations for each number
    const rotations = {
        1: { x: 0, y: 0 },
        2: { x: 90, y: 0 },
        3: { x: 0, y: -90 },
        4: { x: 0, y: 90 },
        5: { x: -90, y: 0 },
        6: { x: 180, y: 0 }
    };

    function init() {
        updateUI();
    }

    function updateUI() {
        playerScoreDisplay.textContent = gameState.playerScore;
        dealerScoreDisplay.textContent = gameState.dealerScore;
        
        if (gameState.currentTurn === 'player') {
            turnIndicator.textContent = "あなたの番です (子)";
            rollButton.textContent = `ダイスを振る (${gameState.rollsLeft})`;
        } else {
            turnIndicator.textContent = "ディーラーの番です (親)";
            rollButton.textContent = "ディーラーが振る";
        }
    }

    async function rollDice() {
        if (gameState.isRolling) return;
        gameState.isRolling = true;
        rollButton.disabled = true;

        // Add rolling animation class
        diceElements.forEach(dice => dice.classList.add('rolling'));

        // Shaking effect on the bowl
        document.getElementById('bowl').style.animation = 'shake 0.5s infinite';

        // Play rolling sounds
        const rollInterval = setInterval(() => {
            if (gameState.isRolling) playSound('roll');
            else clearInterval(rollInterval);
        }, 100);

        const diceResults = [
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1
        ];

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Stop animations
        diceElements.forEach(dice => dice.classList.remove('rolling'));
        document.getElementById('bowl').style.animation = 'none';

        // Set final rotations
        diceResults.forEach((val, i) => {
            const rot = rotations[val];
            // Add extra spins for realism
            const extraX = Math.floor(Math.random() * 2) * 360;
            const extraY = Math.floor(Math.random() * 2) * 360;
            diceElements[i].style.transform = `rotateX(${rot.x + extraX}deg) rotateY(${rot.y + extraY}deg)`;
        });

        const hand = evaluateHand(diceResults);
        displayHandEffect(hand);

        if (gameState.currentTurn === 'player') {
            gameState.playerHand = hand;
            gameState.rollsLeft--;

            if (hand.rank > 0 || gameState.rollsLeft === 0) {
                // Hand found or ran out of rolls
                rollButton.classList.add('hidden');
                nextTurnButton.classList.remove('hidden');
            } else {
                rollButton.disabled = false;
            }
        } else {
            gameState.dealerHand = hand;
            rollButton.classList.add('hidden');
            setTimeout(triggerPachinkoEffect, 1000); // 1秒遅らせてパチンコ演出開始
        }

        gameState.isRolling = false;
        updateUI();
    }

    function evaluateHand(dice) {
        dice.sort((a, b) => a - b);
        const [d1, d2, d3] = dice;

        // 1. Pinzo (1,1,1)
        if (d1 === 1 && d2 === 1 && d3 === 1) return { name: "ピンゾロ！", rank: 100, multiplier: 5 };

        // 2. Zorome (other triples)
        if (d1 === d2 && d2 === d3) return { name: `${d1}のゾロ目！`, rank: 90 + d1, multiplier: 3 };

        // 3. Shigoro (4,5,6)
        if (d1 === 4 && d2 === 5 && d3 === 6) return { name: "シゴロ！", rank: 80, multiplier: 2 };

        // 4. Hifumi (1,2,3)
        if (d1 === 1 && d2 === 2 && d3 === 3) return { name: "ヒフミ...", rank: -1, multiplier: -2 };

        // 5. Normal Hand (Two match)
        if (d1 === d2) return { name: `${d3}の目`, rank: d3, multiplier: 1 };
        if (d2 === d3) return { name: `${d1}の目`, rank: d1, multiplier: 1 };
        if (d1 === d3) return { name: `${d2}の目`, rank: d2, multiplier: 1 };

        // 6. No hand
        return { name: "目なし", rank: 0, multiplier: 1 };
    }

    function displayHandEffect(hand) {
        handNameDisplay.textContent = hand.name;
        handNameDisplay.classList.add('pop');
        setTimeout(() => handNameDisplay.classList.remove('pop'), 500);
    }

    function triggerPachinkoEffect() {
        const p = gameState.playerHand;
        const d = gameState.dealerHand;
        const pachinkoOverlay = document.getElementById('pachinko-overlay');
        const pachinkoText = document.getElementById('pachinko-text');
        
        // Reset classes
        pachinkoText.className = 'pachinko-text';
        
        let isWin = false;
        if (p.rank > d.rank) {
            isWin = true;
            pachinkoText.textContent = "キュイン！";
            playSound('kyuin');
            // Play kyuin sound repeatedly for 2 seconds
            const kyuinInterval = setInterval(() => playSound('kyuin'), 600);
            setTimeout(() => clearInterval(kyuinInterval), 2500);
        } else if (p.rank < d.rank) {
            pachinkoText.textContent = "ドスーン...";
            pachinkoText.classList.add('loss');
            playSound('dosun');
        } else {
            pachinkoText.textContent = "引き分け";
            pachinkoText.classList.add('draw');
        }

        pachinkoOverlay.classList.remove('hidden');

        // Show actual result after 3 seconds of Pachinko effect
        setTimeout(() => {
            pachinkoOverlay.classList.add('hidden');
            showResult();
        }, 3000);
    }

    function showResult() {
        const p = gameState.playerHand;
        const d = gameState.dealerHand;
        let winner = '';
        let baseBet = 100;
        let diff = 0;

        if (p.rank > d.rank) {
            winner = 'あなたの勝ち！';
            diff = baseBet * p.multiplier;
            playSound('win');
        } else if (p.rank < d.rank) {
            winner = 'ディーラーの勝ち...';
            diff = -(baseBet * d.multiplier);
            playSound('loss');
        } else {
            winner = '引き分け';
            diff = 0;
        }

        gameState.playerScore += diff;
        gameState.dealerScore -= diff;

        winnerText.textContent = winner;
        resultOverlay.classList.remove('hidden');
        updateUI();
    }

    rollButton.addEventListener('click', rollDice);

    nextTurnButton.addEventListener('click', () => {
        gameState.currentTurn = 'dealer';
        nextTurnButton.classList.add('hidden');
        rollButton.classList.remove('hidden');
        rollButton.disabled = false;
        handNameDisplay.textContent = "-";
        updateUI();
        
        // Auto roll for dealer after a short delay
        setTimeout(rollDice, 1000);
    });

    restartButton.addEventListener('click', () => {
        gameState.currentTurn = 'player';
        gameState.playerHand = null;
        gameState.dealerHand = null;
        gameState.rollsLeft = 3;
        resultOverlay.classList.add('hidden');
        rollButton.classList.remove('hidden');
        rollButton.disabled = false;
        handNameDisplay.textContent = "-";
        updateUI();
    });

    init();
});
