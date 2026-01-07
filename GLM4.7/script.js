// 游戏配置
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const weaponLevelElement = document.getElementById('weapon-level');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');

// 设置画布尺寸
function resizeCanvas() {
    const maxWidth = Math.min(window.innerWidth - 40, 800);
    canvas.width = maxWidth;
    canvas.height = Math.min(window.innerHeight - 250, 600);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// 游戏状态
let gameRunning = false;
let gamePaused = false;
let score = 0;
let lives = 100;
let weaponLevel = 1;
let weaponUpgradeTime = 0;
let difficulty = 1;
let lastTime = 0;

// 游戏对象
const player = {
    x: canvas.width / 2,
    y: canvas.height - 80,
    width: 50,
    height: 50,
    speed: 5,
    hit: false,
    hitTime: 0,
    invulnerable: false,
    invulnerableTime: 0
};

// 子弹数组
const bullets = [];
const enemyBullets = [];

// 敌人数组
const enemies = [];

// 奖励数组
const rewards = [];

// 粒子效果数组
const particles = [];

// 星星背景
const stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 1 + 0.5
    });
}

// 键盘控制
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

// 触摸控制
let touch = null;
canvas.addEventListener('touchstart', e => {
    if (gameRunning && !gamePaused) {
        touch = {
            x: e.touches[0].clientX - canvas.getBoundingClientRect().left,
            y: e.touches[0].clientY - canvas.getBoundingClientRect().top
        };
        e.preventDefault();
    }
});

canvas.addEventListener('touchmove', e => {
    if (gameRunning && !gamePaused && touch) {
        touch = {
            x: e.touches[0].clientX - canvas.getBoundingClientRect().left,
            y: e.touches[0].clientY - canvas.getBoundingClientRect().top
        };
        e.preventDefault();
    }
});

canvas.addEventListener('touchend', () => {
    touch = null;
});

// 音效系统
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine') {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playShootSound() {
    playSound(800, 0.1, 'square');
}

function playExplosionSound() {
    playSound(150, 0.3, 'sawtooth');
}

function playHitSound() {
    playSound(200, 0.2, 'triangle');
}

function playPowerUpSound() {
    playSound(400, 0.2, 'sine');
    setTimeout(() => playSound(600, 0.2, 'sine'), 100);
    setTimeout(() => playSound(800, 0.2, 'sine'), 200);
}

// 背景音乐
let bgMusicInterval;
function playBackgroundMusic() {
    if (bgMusicInterval) clearInterval(bgMusicInterval);

    const notes = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63];
    let noteIndex = 0;

    bgMusicInterval = setInterval(() => {
        if (gameRunning && !gamePaused) {
            playSound(notes[noteIndex], 0.3, 'sine');
            noteIndex = (noteIndex + 1) % notes.length;
        }
    }, 500);
}

// 创建子弹
function createBullet(x, y, angle = 0) {
    bullets.push({
        x: x,
        y: y,
        width: 4,
        height: 10,
        speed: 8,
        angle: angle
    });
}

// 创建敌人
function createEnemy() {
    const isPlane = Math.random() > 0.5;
    enemies.push({
        x: Math.random() * (canvas.width - 40) + 20,
        y: -50,
        width: isPlane ? 40 : 50,
        height: isPlane ? 40 : 50,
        speed: Math.random() * 2 + 1 + difficulty * 0.5,
        type: isPlane ? 'plane' : 'asteroid',
        health: isPlane ? 1 : 2,
        shootTimer: 0,
        shootInterval: isPlane ? 2000 : 0 // 只有飞机会射击
    });
}

// 创建奖励
function createReward(x, y, enemyType) {
    const isWeapon = enemyType === 'plane' ? Math.random() < 0.8 : Math.random() < 0.3;
    rewards.push({
        x: x,
        y: y,
        width: 30,
        height: 30,
        speed: 2,
        type: isWeapon ? 'weapon' : 'health',
        animation: 0
    });
}

// 创建粒子效果
function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * Math.random() * 3,
            vy: Math.sin(angle) * Math.random() * 3,
            size: Math.random() * 3 + 1,
            color: color,
            life: 1
        });
    }
}

// 更新游戏状态
function update(deltaTime) {
    if (!gameRunning || gamePaused) return;

    // 更新武器升级时间
    if (weaponLevel > 1) {
        weaponUpgradeTime -= deltaTime;
        if (weaponUpgradeTime <= 0) {
            weaponLevel = 1;
            weaponLevelElement.textContent = weaponLevel;
        }
    }

    // 更新玩家位置
    if (keys['a'] && player.x > player.width / 2) {
        player.x -= player.speed;
    }
    if (keys['d'] && player.x < canvas.width - player.width / 2) {
        player.x += player.speed;
    }
    if (keys['w'] && player.y > player.height / 2) {
        player.y -= player.speed;
    }
    if (keys['s'] && player.y < canvas.height - player.height / 2) {
        player.y += player.speed;
    }

    // 触摸控制
    if (touch) {
        const dx = touch.x - player.x;
        const dy = touch.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) {
            const moveX = (dx / distance) * player.speed;
            const moveY = (dy / distance) * player.speed;

            player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x + moveX));
            player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y + moveY));
        }
    }

    // 更新无敌状态
    if (player.invulnerable) {
        player.invulnerableTime -= deltaTime;
        if (player.invulnerableTime <= 0) {
            player.invulnerable = false;
        }
    }

    // 更新被击中闪烁状态
    if (player.hit) {
        player.hitTime -= deltaTime;
        if (player.hitTime <= 0) {
            player.hit = false;
        }
    }

    // 自动射击
    if (!player.shootTimer) player.shootTimer = 0;
    player.shootTimer += deltaTime;
    if (player.shootTimer > 200) {
        player.shootTimer = 0;

        switch (weaponLevel) {
            case 1:
                createBullet(player.x, player.y - player.height / 2);
                break;
            case 2:
                createBullet(player.x - 10, player.y - player.height / 2);
                createBullet(player.x + 10, player.y - player.height / 2);
                break;
            case 3:
                createBullet(player.x, player.y - player.height / 2, 0);
                createBullet(player.x, player.y - player.height / 2, -0.2);
                createBullet(player.x, player.y - player.height / 2, 0.2);
                break;
            case 4:
                createBullet(player.x - 15, player.y - player.height / 2);
                createBullet(player.x - 5, player.y - player.height / 2);
                createBullet(player.x + 5, player.y - player.height / 2);
                createBullet(player.x + 15, player.y - player.height / 2);
                break;
            case 5:
                createBullet(player.x, player.y - player.height / 2, 0);
                createBullet(player.x, player.y - player.height / 2, -0.15);
                createBullet(player.x, player.y - player.height / 2, -0.3);
                createBullet(player.x, player.y - player.height / 2, 0.15);
                createBullet(player.x, player.y - player.height / 2, 0.3);
                break;
        }

        playShootSound();
    }

    // 更新子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.y -= bullet.speed;
        bullet.x += Math.sin(bullet.angle) * bullet.speed;

        if (bullet.y < -10) {
            bullets.splice(i, 1);
        }
    }

    // 更新敌人子弹
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.y += bullet.speed;

        if (bullet.y > canvas.height + 10) {
            enemyBullets.splice(i, 1);
        }
    }

    // 更新敌人
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.y += enemy.speed;

        // 敌人射击
        if (enemy.type === 'plane') {
            enemy.shootTimer += deltaTime;
            if (enemy.shootTimer > enemy.shootInterval) {
                enemy.shootTimer = 0;
                enemyBullets.push({
                    x: enemy.x,
                    y: enemy.y + enemy.height / 2,
                    width: 4,
                    height: 10,
                    speed: 4
                });
            }
        }

        // 移除超出屏幕的敌人
        if (enemy.y > canvas.height + 50) {
            enemies.splice(i, 1);
        }
    }

    // 更新奖励
    for (let i = rewards.length - 1; i >= 0; i--) {
        const reward = rewards[i];
        reward.y += reward.speed;
        reward.animation += deltaTime * 0.005;

        if (reward.y > canvas.height + 30) {
            rewards.splice(i, 1);
        }
    }

    // 更新粒子
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= deltaTime * 0.002;

        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // 更新星星背景
    for (const star of stars) {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    }

    // 碰撞检测：玩家子弹与敌人
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];

            if (
                bullet.x > enemy.x - enemy.width / 2 &&
                bullet.x < enemy.x + enemy.width / 2 &&
                bullet.y > enemy.y - enemy.height / 2 &&
                bullet.y < enemy.y + enemy.height / 2
            ) {
                bullets.splice(i, 1);
                enemy.health--;

                if (enemy.health <= 0) {
                    enemies.splice(j, 1);
                    score += enemy.type === 'plane' ? 10 : 15;
                    scoreElement.textContent = score;

                    // 创建爆炸效果
                    createParticles(enemy.x, enemy.y, enemy.type === 'plane' ? '#ff6600' : '#999999', 15);
                    playExplosionSound();

                    // 随机掉落奖励
                    if (Math.random() < 0.3) {
                        createReward(enemy.x, enemy.y, enemy.type);
                    }

                    // 增加难度
                    if (score % 100 === 0) {
                        difficulty += 0.2;
                    }
                }

                break;
            }
        }
    }

    // 碰撞检测：敌人子弹与玩家
    if (!player.invulnerable) {
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const bullet = enemyBullets[i];

            if (
                bullet.x > player.x - player.width / 2 &&
                bullet.x < player.x + player.width / 2 &&
                bullet.y > player.y - player.height / 2 &&
                bullet.y < player.y + player.height / 2
            ) {
                enemyBullets.splice(i, 1);
                takeDamage(5);
                break;
            }
        }
    }

    // 碰撞检测：玩家与敌人
    if (!player.invulnerable) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];

            if (
                Math.abs(player.x - enemy.x) < (player.width + enemy.width) / 2 &&
                Math.abs(player.y - enemy.y) < (player.height + enemy.height) / 2
            ) {
                enemies.splice(i, 1);
                const damage = enemy.type === 'plane' ? 15 : 10;
                takeDamage(damage);

                // 创建爆炸效果
                createParticles(enemy.x, enemy.y, enemy.type === 'plane' ? '#ff6600' : '#999999', 15);
                playExplosionSound();
            }
        }
    }

    // 碰撞检测：玩家与奖励
    for (let i = rewards.length - 1; i >= 0; i--) {
        const reward = rewards[i];

        if (
            Math.abs(player.x - reward.x) < (player.width + reward.width) / 2 &&
            Math.abs(player.y - reward.y) < (player.height + reward.height) / 2
        ) {
            rewards.splice(i, 1);

            if (reward.type === 'health') {
                lives = Math.min(100, lives + 25);
                livesElement.textContent = lives;
            } else {
                weaponLevel = Math.min(5, weaponLevel + 1);
                weaponUpgradeTime = 5000; // 5秒
                weaponLevelElement.textContent = weaponLevel;
            }

            playPowerUpSound();
            createParticles(reward.x, reward.y, reward.type === 'health' ? '#00ff00' : '#ffff00', 10);
        }
    }
}

// 玩家受到伤害
function takeDamage(damage) {
    lives -= damage;
    livesElement.textContent = lives;

    player.hit = true;
    player.hitTime = 500; // 闪烁0.5秒
    player.invulnerable = true;
    player.invulnerableTime = 1000; // 无敌1秒

    playHitSound();

    if (lives <= 0) {
        gameOver();
    }
}

// 游戏结束
function gameOver() {
    gameRunning = false;
    clearInterval(bgMusicInterval);

    finalScoreElement.textContent = score;
    gameOverElement.style.display = 'block';

    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('resumeBtn').style.display = 'none';
    document.getElementById('restartBtn').style.display = 'inline-block';
}

// 绘制游戏画面
function draw() {
    // 清空画布
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制星星背景
    ctx.fillStyle = '#ffffff';
    for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // 绘制玩家
    ctx.save();
    ctx.translate(player.x, player.y);

    // 闪烁效果
    if (player.hit && Math.floor(player.hitTime / 100) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    // 绘制飞机形状
    ctx.fillStyle = '#4a90e2';
    ctx.beginPath();
    ctx.moveTo(0, -player.height / 2);
    ctx.lineTo(-player.width / 2, player.height / 2);
    ctx.lineTo(-player.width / 4, player.height / 3);
    ctx.lineTo(0, player.height / 4);
    ctx.lineTo(player.width / 4, player.height / 3);
    ctx.lineTo(player.width / 2, player.height / 2);
    ctx.closePath();
    ctx.fill();

    // 绘制驾驶舱
    ctx.fillStyle = '#2c5aa0';
    ctx.beginPath();
    ctx.arc(0, 0, player.width / 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 绘制子弹
    ctx.fillStyle = '#ffff00';
    for (const bullet of bullets) {
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    }

    // 绘制敌人子弹
    ctx.fillStyle = '#ff0000';
    for (const bullet of enemyBullets) {
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    }

    // 绘制敌人
    for (const enemy of enemies) {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);

        if (enemy.type === 'plane') {
            // 绘制敌机
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.moveTo(0, enemy.height / 2);
            ctx.lineTo(-enemy.width / 2, -enemy.height / 2);
            ctx.lineTo(-enemy.width / 4, -enemy.height / 3);
            ctx.lineTo(0, -enemy.height / 4);
            ctx.lineTo(enemy.width / 4, -enemy.height / 3);
            ctx.lineTo(enemy.width / 2, -enemy.height / 2);
            ctx.closePath();
            ctx.fill();

            // 绘制驾驶舱
            ctx.fillStyle = '#cc3300';
            ctx.beginPath();
            ctx.arc(0, 0, enemy.width / 6, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 绘制陨石
            ctx.fillStyle = '#999999';
            ctx.beginPath();
            ctx.arc(0, 0, enemy.width / 2, 0, Math.PI * 2);
            ctx.fill();

            // 添加陨石纹理
            ctx.fillStyle = '#666666';
            ctx.beginPath();
            ctx.arc(-enemy.width / 4, -enemy.width / 4, enemy.width / 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(enemy.width / 5, enemy.width / 5, enemy.width / 8, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // 绘制奖励
    for (const reward of rewards) {
        ctx.save();
        ctx.translate(reward.x, reward.y);
        ctx.rotate(reward.animation);

        if (reward.type === 'health') {
            // 绘制治疗奖励
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(-reward.width / 2, -reward.height / 6, reward.width, reward.height / 3);
            ctx.fillRect(-reward.width / 6, -reward.height / 2, reward.width / 3, reward.height);

            // 绘制十字
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-reward.width / 6, -reward.height / 2, reward.width / 3, reward.height);
            ctx.fillRect(-reward.width / 2, -reward.height / 6, reward.width, reward.height / 3);
        } else {
            // 绘制武器奖励
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.moveTo(0, -reward.height / 2);
            ctx.lineTo(-reward.width / 2, reward.height / 2);
            ctx.lineTo(-reward.width / 4, reward.height / 3);
            ctx.lineTo(0, reward.height / 4);
            ctx.lineTo(reward.width / 4, reward.height / 3);
            ctx.lineTo(reward.width / 2, reward.height / 2);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    // 绘制粒子效果
    for (const particle of particles) {
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;

    // 绘制触摸指示器
    if (touch) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(touch.x, touch.y, 20, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制指示线
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(touch.x, touch.y);
        ctx.stroke();
    }
}

// 游戏循环
function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// 开始游戏
function startGame() {
    gameRunning = true;
    gamePaused = false;
    score = 0;
    lives = 100;
    weaponLevel = 1;
    difficulty = 1;

    scoreElement.textContent = score;
    livesElement.textContent = lives;
    weaponLevelElement.textContent = weaponLevel;

    // 重置玩家位置
    player.x = canvas.width / 2;
    player.y = canvas.height - 80;
    player.hit = false;
    player.invulnerable = false;

    // 清空数组
    bullets.length = 0;
    enemyBullets.length = 0;
    enemies.length = 0;
    rewards.length = 0;
    particles.length = 0;

    // 隐藏游戏结束界面
    gameOverElement.style.display = 'none';

    // 更新按钮状态
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('restartBtn').style.display = 'none';

    // 开始背景音乐
    playBackgroundMusic();

    // 开始生成敌人
    if (window.enemyInterval) clearInterval(window.enemyInterval);
    window.enemyInterval = setInterval(() => {
        if (gameRunning && !gamePaused) {
            createEnemy();
        }
    }, 2000 - difficulty * 100);
}

// 暂停游戏
function pauseGame() {
    if (!gameRunning || gamePaused) return;

    gamePaused = true;

    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('resumeBtn').style.display = 'inline-block';
}

// 继续游戏
function resumeGame() {
    if (!gameRunning || !gamePaused) return;

    gamePaused = false;

    document.getElementById('pauseBtn').style.display = 'inline-block';
    document.getElementById('resumeBtn').style.display = 'none';
}

// 重新开始游戏
function restartGame() {
    startGame();
}

// 按钮事件绑定
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('pauseBtn').addEventListener('click', pauseGame);
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('gameOverRestartBtn').addEventListener('click', restartGame);

// 启动游戏循环
requestAnimationFrame(gameLoop);
