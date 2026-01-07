/**
 * 太空飞机大战逻辑
 * 包含：Web Audio API、碰撞检测、奖励系统
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hpFill = document.getElementById('hp-fill');
const scoreDisplay = document.getElementById('score-display');
const weaponDisplay = document.getElementById('weapon-display');

// 游戏状态
let gameActive = false;
let score = 0;
let lastTime = 0;

// 玩家配置
const player = {
    x: 0, y: 0, w: 40, h: 40,
    speed: 5,
    hp: 100,
    weaponLevel: 1,
    weaponTimer: 0,
    isHurt: false,
    hurtTimer: 0
};

// 资源池
let bullets = [];
let enemies = [];
let items = [];
let particles = [];

// 1. 初始化画布
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
}
window.addEventListener('resize', resize);
resize();

// 2. 音效系统 (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'shoot') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    } else if (type === 'item') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    }

    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.stop(audioCtx.currentTime + 0.2);
}

// 3. 武器逻辑
function shoot() {
    const bSpeed = 7;
    const configurations = {
        1: [{ vx: 0, vy: -bSpeed }],
        2: [{ vx: -1, vy: -bSpeed }, { vx: 1, vy: -bSpeed }],
        3: [{ vx: -2, vy: -bSpeed }, { vx: 0, vy: -bSpeed }, { vx: 2, vy: -bSpeed }],
        4: [{ vx: -2, vy: -bSpeed }, { vx: -0.7, vy: -bSpeed }, { vx: 0.7, vy: -bSpeed }, { vx: 2, vy: -bSpeed }],
        5: [{ vx: -3, vy: -bSpeed }, { vx: -1.5, vy: -bSpeed }, { vx: 0, vy: -bSpeed }, { vx: 1.5, vy: -bSpeed }, { vx: 3, vy: -bSpeed }]
    };

    configurations[player.weaponLevel].forEach(conf => {
        bullets.push({ x: player.x, y: player.y, vx: conf.vx, vy: conf.vy, r: 4 });
    });
    playSound('shoot');
}

// 4. 键盘与触摸控制
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = e.touches[0];
    player.x = touch.clientX;
    player.y = touch.clientY - 30;
});

// 5. 核心循环
function update(time) {
    if (!gameActive) return;
    const dt = time - lastTime;
    lastTime = time;

    // 移动玩家 (PC)
    if (keys['KeyW'] || keys['ArrowUp']) player.y -= player.speed;
    if (keys['KeyS'] || keys['ArrowDown']) player.y += player.speed;
    if (keys['KeyA'] || keys['ArrowLeft']) player.x -= player.speed;
    if (keys['KeyD'] || keys['ArrowRight']) player.x += player.speed;

    // 自动射击
    if (time % 200 < 20) shoot();

    // 武器倒计时
    if (player.weaponLevel > 1) {
        player.weaponTimer -= 16;
        if (player.weaponTimer <= 0) player.weaponLevel = 1;
    }

    // 生成敌人
    if (Math.random() < 0.02 + (score / 10000)) {
        const isMeteo = Math.random() > 0.5;
        enemies.push({
            x: Math.random() * canvas.width,
            y: -50,
            type: isMeteo ? 'meteo' : 'ship',
            hp: isMeteo ? 2 : 1,
            speed: 2 + Math.random() * 3
        });
    }

    // 更新子弹、敌人、道具
    bullets.forEach((b, i) => {
        b.x += b.vx; b.y += b.vy;
        if (b.y < 0) bullets.splice(i, 1);
    });

    enemies.forEach((en, i) => {
        en.y += en.speed;

        // 碰撞玩家
        const dist = Math.hypot(en.x - player.x, en.y - player.y);
        if (dist < 30) {
            const damage = en.type === 'ship' ? 15 : 10;
            takeDamage(damage);
            enemies.splice(i, 1);
        }

        // 被子弹击中
        bullets.forEach((b, bi) => {
            if (Math.hypot(en.x - b.x, en.y - b.y) < 25) {
                en.hp--;
                bullets.splice(bi, 1);
                if (en.hp <= 0) {
                    score += 10;
                    dropItem(en.x, en.y, en.type);
                    enemies.splice(i, 1);
                    playSound('hit');
                }
            }
        });
        if (en.y > canvas.height) enemies.splice(i, 1);
    });

    items.forEach((it, i) => {
        it.y += 2;
        if (Math.hypot(it.x - player.x, it.y - player.y) < 30) {
            if (it.type === 'heal') player.hp = Math.min(100, player.hp + 25);
            if (it.type === 'weapon') {
                player.weaponLevel = Math.min(5, player.weaponLevel + 1);
                player.weaponTimer = 5000;
            }
            playSound('item');
            items.splice(i, 1);
        }
    });

    draw();
    requestAnimationFrame(update);
}

function dropItem(x, y, enemyType) {
    if (Math.random() > 0.3) return;
    let type = 'heal';
    const rand = Math.random();
    if (enemyType === 'ship') type = rand < 0.8 ? 'weapon' : 'heal';
    else type = rand < 0.7 ? 'heal' : 'weapon';
    items.push({ x, y, type });
}

function takeDamage(val) {
    player.hp -= val;
    player.isHurt = true;
    player.hurtTimer = 10;
    if (player.hp <= 0) gameOver();
}

// 6. 绘制
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 玩家
    ctx.fillStyle = player.hurtTimer > 0 ? 'red' : '#00d2ff';
    if (player.hurtTimer > 0) player.hurtTimer--;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 20);
    ctx.lineTo(player.x - 20, player.y + 20);
    ctx.lineTo(player.x + 20, player.y + 20);
    ctx.fill();

    // 敌人
    enemies.forEach(en => {
        ctx.fillStyle = en.type === 'ship' ? '#ff4757' : '#ffa502';
        ctx.fillRect(en.x - 15, en.y - 15, 30, 30);
    });

    // 子弹
    ctx.fillStyle = '#fff200';
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    });

    // 道具
    items.forEach(it => {
        ctx.fillStyle = it.type === 'heal' ? '#2ed573' : '#eccc68';
        ctx.font = '20px Arial';
        ctx.fillText(it.type === 'heal' ? '✚' : '⚡', it.x - 10, it.y);
    });

    // UI更新
    hpFill.style.width = player.hp + '%';
    scoreDisplay.innerText = `分数: ${score}`;
    weaponDisplay.innerText = `武器等级: ${player.weaponLevel} (${player.weaponLevel > 1 ? (player.weaponTimer / 1000).toFixed(1) + 's' : '∞'})`;
}

function gameOver() {
    gameActive = false;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = `最终分数: ${score}`;
}

function startGame() {
    player.hp = 100;
    player.weaponLevel = 1;
    score = 0;
    enemies = [];
    bullets = [];
    items = [];
    gameActive = true;
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    requestAnimationFrame(update);
}

document.getElementById('start-btn').onclick = startGame;
document.getElementById('restart-btn').onclick = startGame;