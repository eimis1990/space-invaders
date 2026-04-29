// Space Invaders Game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
    const container = document.querySelector('.game-container');
    const maxWidth = Math.min(800, window.innerWidth - 40);
    const maxHeight = Math.min(600, window.innerHeight - 150);

    canvas.width = maxWidth;
    canvas.height = maxHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state
let gameState = 'start'; // start, playing, paused, gameOver, win
let score = 0;
let lives = 3;
let level = 1;
let highScore = localStorage.getItem('spaceInvadersHighScore') || 0;

// Player
const player = {
    width: 50,
    height: 30,
    x: 0,
    y: 0,
    speed: 7,
    color: '#7c3aed',
    dx: 0
};

// Bullets
let playerBullets = [];
let alienBullets = [];
const bulletSpeed = 10;
const alienBulletSpeed = 4;

// Aliens
let aliens = [];
const alienRows = 5;
const alienCols = 11;
let alienDirection = 1;
let alienSpeed = 1;
let alienDropAmount = 20;
let alienMoveTimer = 0;
let alienMoveInterval = 30;
let alienShootTimer = 0;
let alienShootInterval = 60;

// Barriers
let barriers = [];

// Particles for explosions
let particles = [];

// Stars background
let stars = [];

// Audio context for sound effects
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    switch(type) {
        case 'shoot':
            oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.1);
            break;
        case 'explosion':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(100, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.3);
            break;
        case 'hit':
            oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.2);
            break;
        case 'powerup':
            oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.1);
            break;
    }
}

// Initialize stars
const STAR_COLORS = [
    '192, 132, 252',  // purple
    '244, 63, 142',   // pink
    '251, 191, 36',   // yellow
    '6, 182, 212',    // cyan
    '34, 197, 94',    // green
    '168, 85, 247',   // violet
];

function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 0.5 + 0.1,
            brightness: Math.random(),
            colorIdx: Math.floor(Math.random() * STAR_COLORS.length)
        });
    }
}

// Initialize player position
function initPlayer() {
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - player.height - 20;
}

// Initialize aliens
function initAliens() {
    aliens = [];
    const alienWidth = 40;
    const alienHeight = 30;
    const padding = 10;
    const startX = (canvas.width - (alienCols * (alienWidth + padding))) / 2;
    const startY = 60;

    const types = [
        { points: 30, color: '#f43f8e' },  // Top row - most points (hot pink)
        { points: 20, color: '#f97316' },  // Second row (vivid orange)
        { points: 20, color: '#eab308' },  // Third row (vivid yellow)
        { points: 10, color: '#06b6d4' },  // Fourth row (cyan)
        { points: 10, color: '#22c55e' }   // Bottom row - least points (vivid green)
    ];

    for (let row = 0; row < alienRows; row++) {
        for (let col = 0; col < alienCols; col++) {
            aliens.push({
                x: startX + col * (alienWidth + padding),
                y: startY + row * (alienHeight + padding),
                width: alienWidth,
                height: alienHeight,
                type: row,
                points: types[row].points,
                color: types[row].color,
                alive: true,
                frame: 0
            });
        }
    }

    // Adjust speed based on level
    alienSpeed = 1 + (level - 1) * 0.3;
    alienMoveInterval = Math.max(10, 30 - (level - 1) * 5);
    alienShootInterval = Math.max(30, 60 - (level - 1) * 10);
}

// Initialize barriers
function initBarriers() {
    barriers = [];
    const barrierWidth = 60;
    const barrierHeight = 40;
    const numBarriers = 4;
    const spacing = canvas.width / (numBarriers + 1);

    for (let i = 0; i < numBarriers; i++) {
        const barrierX = spacing * (i + 1) - barrierWidth / 2;
        const barrierY = canvas.height - 120;

        // Create barrier blocks
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 6; col++) {
                // Skip corners for curved look
                if ((row === 0 && (col === 0 || col === 5)) ||
                    (row === 3 && col >= 2 && col <= 3)) {
                    continue;
                }

                barriers.push({
                    x: barrierX + col * 10,
                    y: barrierY + row * 10,
                    width: 10,
                    height: 10,
                    health: 3
                });
            }
        }
    }
}

// Create explosion particles
function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        const angle = (Math.PI * 2 / 15) * i;
        const speed = Math.random() * 3 + 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

// Draw functions
function drawStars() {
    stars.forEach(star => {
        const brightness = 0.15 + star.brightness * 0.35 * (0.5 + Math.sin(Date.now() * 0.001 * star.speed) * 0.5);
        ctx.fillStyle = `rgba(${STAR_COLORS[star.colorIdx]}, ${brightness})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPlayer() {
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    const w = player.width;
    const h = player.height;
    const t = Date.now();

    ctx.save();

    // --- Engine exhaust glow (animated) ---
    const thrustFlicker = 0.7 + Math.sin(t * 0.03) * 0.3;
    const exhaustGrad = ctx.createRadialGradient(cx, player.y + h + 4, 1, cx, player.y + h + 10, 14 * thrustFlicker);
    exhaustGrad.addColorStop(0, 'rgba(255,200,80,0.95)');
    exhaustGrad.addColorStop(0.4, 'rgba(255,80,20,0.6)');
    exhaustGrad.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = exhaustGrad;
    ctx.beginPath();
    ctx.ellipse(cx, player.y + h + 6, 7, 14 * thrustFlicker, 0, 0, Math.PI * 2);
    ctx.fill();

    // Small secondary exhausts
    const exhaustGrad2 = ctx.createRadialGradient(cx - 14, player.y + h + 2, 1, cx - 14, player.y + h + 6, 8 * thrustFlicker);
    exhaustGrad2.addColorStop(0, 'rgba(180,120,255,0.9)');
    exhaustGrad2.addColorStop(1, 'rgba(100,20,255,0)');
    ctx.fillStyle = exhaustGrad2;
    ctx.beginPath();
    ctx.ellipse(cx - 14, player.y + h + 4, 4, 9 * thrustFlicker, 0, 0, Math.PI * 2);
    ctx.fill();

    const exhaustGrad3 = ctx.createRadialGradient(cx + 14, player.y + h + 2, 1, cx + 14, player.y + h + 6, 8 * thrustFlicker);
    exhaustGrad3.addColorStop(0, 'rgba(180,120,255,0.9)');
    exhaustGrad3.addColorStop(1, 'rgba(100,20,255,0)');
    ctx.fillStyle = exhaustGrad3;
    ctx.beginPath();
    ctx.ellipse(cx + 14, player.y + h + 4, 4, 9 * thrustFlicker, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Outer glow aura ---
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 18;

    // --- Left wing ---
    const wingGrad = ctx.createLinearGradient(player.x, player.y + h * 0.4, cx - 4, player.y + h);
    wingGrad.addColorStop(0, '#e9d5ff');
    wingGrad.addColorStop(0.5, '#c084fc');
    wingGrad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 4, player.y + h * 0.35);   // root top
    ctx.lineTo(player.x, player.y + h * 0.55);  // tip mid
    ctx.lineTo(player.x + 2, player.y + h);      // tip bottom
    ctx.lineTo(cx - 5, player.y + h - 4);        // body bottom-left
    ctx.closePath();
    ctx.fill();

    // Left wing accent stripe
    ctx.strokeStyle = 'rgba(192,132,252,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 6, player.y + h * 0.4);
    ctx.lineTo(player.x + 4, player.y + h * 0.7);
    ctx.stroke();

    // --- Right wing ---
    const wingGradR = ctx.createLinearGradient(cx + 4, player.y + h * 0.4, player.x + w, player.y + h);
    wingGradR.addColorStop(0, '#e9d5ff');
    wingGradR.addColorStop(0.5, '#c084fc');
    wingGradR.addColorStop(1, '#7c3aed');
    ctx.fillStyle = wingGradR;
    ctx.beginPath();
    ctx.moveTo(cx + 4, player.y + h * 0.35);
    ctx.lineTo(player.x + w, player.y + h * 0.55);
    ctx.lineTo(player.x + w - 2, player.y + h);
    ctx.lineTo(cx + 5, player.y + h - 4);
    ctx.closePath();
    ctx.fill();

    // Right wing accent stripe
    ctx.strokeStyle = 'rgba(192,132,252,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 6, player.y + h * 0.4);
    ctx.lineTo(player.x + w - 4, player.y + h * 0.7);
    ctx.stroke();

    // --- Main fuselage body ---
    const bodyGrad = ctx.createLinearGradient(cx - 10, player.y, cx + 10, player.y + h);
    bodyGrad.addColorStop(0, '#f9a8d4');
    bodyGrad.addColorStop(0.3, '#e879a0');
    bodyGrad.addColorStop(0.7, '#be185d');
    bodyGrad.addColorStop(1, '#7c1040');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(cx, player.y);                          // nose tip
    ctx.bezierCurveTo(cx + 8, player.y + h * 0.3, cx + 10, player.y + h * 0.55, cx + 5, player.y + h - 4);
    ctx.lineTo(cx, player.y + h - 2);
    ctx.lineTo(cx - 5, player.y + h - 4);
    ctx.bezierCurveTo(cx - 10, player.y + h * 0.55, cx - 8, player.y + h * 0.3, cx, player.y);
    ctx.closePath();
    ctx.fill();

    // Fuselage edge highlight
    ctx.strokeStyle = 'rgba(253,204,230,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, player.y + 1);
    ctx.bezierCurveTo(cx + 5, player.y + h * 0.3, cx + 7, player.y + h * 0.5, cx + 4, player.y + h - 5);
    ctx.stroke();

    // --- Engine pod (center bottom) ---
    const podGrad = ctx.createLinearGradient(cx - 6, player.y + h - 10, cx + 6, player.y + h);
    podGrad.addColorStop(0, '#f9a8d4');
    podGrad.addColorStop(1, '#9d174d');
    ctx.fillStyle = podGrad;
    ctx.beginPath();
    ctx.roundRect(cx - 5, player.y + h - 10, 10, 10, 3);
    ctx.fill();

    // --- Side engine pods ---
    ctx.fillStyle = '#c026d3';
    ctx.strokeStyle = '#f0abfc';
    ctx.lineWidth = 1;
    // Left pod
    ctx.beginPath();
    ctx.roundRect(cx - 16, player.y + h * 0.5, 8, 10, 2);
    ctx.fill();
    ctx.stroke();
    // Right pod
    ctx.beginPath();
    ctx.roundRect(cx + 8, player.y + h * 0.5, 8, 10, 2);
    ctx.fill();
    ctx.stroke();

    // --- Cockpit canopy ---
    const canopyGrad = ctx.createRadialGradient(cx - 1, player.y + 10, 1, cx, player.y + 13, 7);
    canopyGrad.addColorStop(0, 'rgba(253,230,255,0.98)');
    canopyGrad.addColorStop(0.5, 'rgba(232,121,249,0.8)');
    canopyGrad.addColorStop(1, 'rgba(134,25,143,0.5)');
    ctx.fillStyle = canopyGrad;
    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(cx, player.y + 13, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Canopy glint
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(cx - 1, player.y + 9, 1.5, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // --- Hull panel lines ---
    ctx.strokeStyle = 'rgba(192,132,252,0.3)';
    ctx.lineWidth = 0.8;
    // Left panel
    ctx.beginPath();
    ctx.moveTo(cx - 2, player.y + 20);
    ctx.lineTo(cx - 4, player.y + h - 6);
    ctx.stroke();
    // Right panel
    ctx.beginPath();
    ctx.moveTo(cx + 2, player.y + 20);
    ctx.lineTo(cx + 4, player.y + h - 6);
    ctx.stroke();

    // --- Wing tip lights (animated pulse) ---
    const pulse = 0.5 + Math.sin(t * 0.008) * 0.5;
    ctx.fillStyle = `rgba(255, 50, 50, ${pulse})`;
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(player.x + 2, player.y + h * 0.6, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(player.x + w - 2, player.y + h * 0.6, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawAlien(alien) {
    if (!alien.alive) return;

    const { x, y, width, height, color, type } = alien;
    const frame = Math.floor(Date.now() / 500) % 2;

    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;

    // Different alien shapes based on type
    ctx.beginPath();

    if (type === 0) {
        // Top row - UFO shape
        ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2 - 5, width / 4, height / 4, 0, 0, Math.PI * 2);
    } else if (type === 1 || type === 2) {
        // Middle rows - squid shape
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width, y + height / 2);
        ctx.lineTo(x + width - 5, y + height);
        ctx.lineTo(x + width / 2 + 5, y + height - 5);
        ctx.lineTo(x + width / 2, y + height);
        ctx.lineTo(x + width / 2 - 5, y + height - 5);
        ctx.lineTo(x + 5, y + height);
        ctx.lineTo(x, y + height / 2);
        ctx.closePath();
    } else {
        // Bottom rows - crab shape
        const legOffset = frame * 5;
        ctx.rect(x + 5, y, width - 10, height - 10);
        ctx.fill();
        // Legs
        ctx.beginPath();
        ctx.moveTo(x, y + height - 10 + legOffset);
        ctx.lineTo(x + 10, y + height - 10);
        ctx.moveTo(x + width, y + height - 10 + legOffset);
        ctx.lineTo(x + width - 10, y + height - 10);
    }

    ctx.fill();

    // Eyes
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x + width / 3, y + height / 2, 3, 0, Math.PI * 2);
    ctx.arc(x + width * 2 / 3, y + height / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
}

function drawBullet(bullet, isAlien = false) {
    ctx.shadowColor = isAlien ? '#f97316' : '#7c3aed';
    ctx.shadowBlur = 10;
    ctx.fillStyle = isAlien ? '#f97316' : '#a855f7';

    if (isAlien) {
        // Alien bullet - zigzag shape
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x + 3, bullet.y + 5);
        ctx.lineTo(bullet.x, bullet.y + 10);
        ctx.lineTo(bullet.x + 3, bullet.y + 15);
        ctx.lineTo(bullet.x - 3, bullet.y + 15);
        ctx.lineTo(bullet.x, bullet.y + 10);
        ctx.lineTo(bullet.x - 3, bullet.y + 5);
        ctx.closePath();
        ctx.fill();
    } else {
        // Player bullet - laser beam
        ctx.fillRect(bullet.x - 2, bullet.y, 4, 15);
    }

    ctx.shadowBlur = 0;
}

function drawBarriers() {
    barriers.forEach(block => {
        const alpha = block.health / 3;
        ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
        ctx.fillRect(block.x, block.y, block.width, block.height);
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// Update functions
function updateStars() {
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
}

function updatePlayer() {
    player.x += player.dx;

    // Keep player in bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
}

function updateBullets() {
    // Player bullets
    playerBullets = playerBullets.filter(bullet => {
        bullet.y -= bulletSpeed;
        return bullet.y > -20;
    });

    // Alien bullets
    alienBullets = alienBullets.filter(bullet => {
        bullet.y += alienBulletSpeed + (level - 1) * 0.5;
        return bullet.y < canvas.height + 20;
    });
}

function updateAliens() {
    alienMoveTimer++;

    if (alienMoveTimer >= alienMoveInterval) {
        alienMoveTimer = 0;

        let shouldDrop = false;
        let minX = canvas.width;
        let maxX = 0;

        // Find alien bounds
        aliens.forEach(alien => {
            if (alien.alive) {
                minX = Math.min(minX, alien.x);
                maxX = Math.max(maxX, alien.x + alien.width);
            }
        });

        // Check if should change direction
        if ((alienDirection > 0 && maxX + alienSpeed * 5 > canvas.width - 10) ||
            (alienDirection < 0 && minX - alienSpeed * 5 < 10)) {
            shouldDrop = true;
            alienDirection *= -1;
        }

        // Move aliens
        aliens.forEach(alien => {
            if (alien.alive) {
                if (shouldDrop) {
                    alien.y += alienDropAmount;
                }
                alien.x += alienDirection * alienSpeed * 5;
            }
        });

        // Speed up as fewer aliens remain
        const aliveCount = aliens.filter(a => a.alive).length;
        const speedMultiplier = 1 + (alienRows * alienCols - aliveCount) * 0.02;
        alienMoveInterval = Math.max(5, (30 - (level - 1) * 5) / speedMultiplier);
    }

    // Alien shooting
    alienShootTimer++;
    if (alienShootTimer >= alienShootInterval) {
        alienShootTimer = 0;

        // Find bottom-most aliens in each column
        const bottomAliens = [];
        for (let col = 0; col < alienCols; col++) {
            for (let row = alienRows - 1; row >= 0; row--) {
                const alien = aliens[row * alienCols + col];
                if (alien && alien.alive) {
                    bottomAliens.push(alien);
                    break;
                }
            }
        }

        // Random alien shoots
        if (bottomAliens.length > 0) {
            const shooter = bottomAliens[Math.floor(Math.random() * bottomAliens.length)];
            alienBullets.push({
                x: shooter.x + shooter.width / 2,
                y: shooter.y + shooter.height
            });
            playSound('shoot');
        }
    }
}

function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life -= 0.02;
        return p.life > 0;
    });
}

// Collision detection
function checkCollisions() {
    // Player bullets vs aliens
    playerBullets.forEach((bullet, bulletIndex) => {
        aliens.forEach(alien => {
            if (alien.alive &&
                bullet.x > alien.x && bullet.x < alien.x + alien.width &&
                bullet.y > alien.y && bullet.y < alien.y + alien.height) {

                alien.alive = false;
                playerBullets.splice(bulletIndex, 1);
                score += alien.points * level;
                updateScore();
                createExplosion(alien.x + alien.width / 2, alien.y + alien.height / 2, alien.color);
                playSound('explosion');
            }
        });
    });

    // Player bullets vs barriers
    playerBullets.forEach((bullet, bulletIndex) => {
        barriers.forEach((block, blockIndex) => {
            if (bullet.x > block.x && bullet.x < block.x + block.width &&
                bullet.y > block.y && bullet.y < block.y + block.height) {

                playerBullets.splice(bulletIndex, 1);
                block.health--;
                if (block.health <= 0) {
                    barriers.splice(blockIndex, 1);
                }
            }
        });
    });

    // Alien bullets vs player
    alienBullets.forEach((bullet, bulletIndex) => {
        if (bullet.x > player.x && bullet.x < player.x + player.width &&
            bullet.y > player.y && bullet.y < player.y + player.height) {

            alienBullets.splice(bulletIndex, 1);
            lives--;
            updateLives();
            createExplosion(player.x + player.width / 2, player.y + player.height / 2, '#f43f8e');
            playSound('hit');

            if (lives <= 0) {
                gameOver();
            }
        }
    });

    // Alien bullets vs barriers
    alienBullets.forEach((bullet, bulletIndex) => {
        barriers.forEach((block, blockIndex) => {
            if (bullet.x > block.x && bullet.x < block.x + block.width &&
                bullet.y > block.y && bullet.y < block.y + block.height) {

                alienBullets.splice(bulletIndex, 1);
                block.health--;
                if (block.health <= 0) {
                    barriers.splice(blockIndex, 1);
                }
            }
        });
    });

    // Aliens reaching bottom or hitting player
    aliens.forEach(alien => {
        if (alien.alive) {
            if (alien.y + alien.height >= player.y) {
                gameOver();
            }
        }
    });

    // Check win condition
    if (aliens.filter(a => a.alive).length === 0) {
        win();
    }
}

// UI Updates
function updateScore() {
    document.getElementById('score').textContent = score;
}

function updateLives() {
    document.getElementById('lives').textContent = '♥'.repeat(Math.max(0, lives));
}

// Game state functions
function startGame() {
    initAudio();
    gameState = 'playing';
    score = 0;
    lives = 3;
    level = 1;

    initStars();
    initPlayer();
    initAliens();
    initBarriers();

    playerBullets = [];
    alienBullets = [];
    particles = [];

    updateScore();
    updateLives();

    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('winScreen').classList.add('hidden');
}

function gameOver() {
    gameState = 'gameOver';

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('spaceInvadersHighScore', highScore);
    }

    document.getElementById('finalScore').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function win() {
    gameState = 'win';
    document.getElementById('winScore').textContent = score;
    document.getElementById('winScreen').classList.remove('hidden');
    playSound('powerup');
}

function nextLevel() {
    level++;
    gameState = 'playing';

    initAliens();
    initBarriers();

    playerBullets = [];
    alienBullets = [];

    initPlayer();

    document.getElementById('winScreen').classList.add('hidden');
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        document.getElementById('pauseScreen').classList.remove('hidden');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        document.getElementById('pauseScreen').classList.add('hidden');
    }
}

// Input handling
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (e.key === ' ' && gameState === 'playing') {
        e.preventDefault();
        shoot();
    }

    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') &&
        (gameState === 'playing' || gameState === 'paused')) {
        togglePause();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function handleInput() {
    player.dx = 0;

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        player.dx = -player.speed;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        player.dx = player.speed;
    }
}

let lastShot = 0;
const shootCooldown = 200;

function shoot() {
    const now = Date.now();
    if (now - lastShot < shootCooldown) return;

    lastShot = now;
    playerBullets.push({
        x: player.x + player.width / 2,
        y: player.y
    });
    playSound('shoot');
}

// Touch controls for mobile
let touchX = null;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchX = touch.clientX - rect.left;

    // Tap center to shoot
    if (touchX > canvas.width * 0.3 && touchX < canvas.width * 0.7) {
        if (gameState === 'playing') shoot();
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchX = touch.clientX - rect.left;
});

canvas.addEventListener('touchend', () => {
    touchX = null;
});

function handleTouchInput() {
    if (touchX === null) return;

    const playerCenter = player.x + player.width / 2;

    if (touchX < canvas.width * 0.3) {
        player.dx = -player.speed;
    } else if (touchX > canvas.width * 0.7) {
        player.dx = player.speed;
    }
}

// Button event listeners
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('nextLevelBtn').addEventListener('click', nextLevel);

// Main game loop
function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#f5f0ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Always draw stars
    drawStars();
    updateStars();

    if (gameState === 'playing') {
        handleInput();
        handleTouchInput();

        updatePlayer();
        updateBullets();
        updateAliens();
        updateParticles();

        checkCollisions();
    }

    // Draw game objects
    if (gameState !== 'start') {
        drawBarriers();
        drawPlayer();

        aliens.forEach(alien => drawAlien(alien));

        playerBullets.forEach(bullet => drawBullet(bullet, false));
        alienBullets.forEach(bullet => drawBullet(bullet, true));

        drawParticles();
    }

    requestAnimationFrame(gameLoop);
}

// Initialize and start
initStars();
gameLoop();
