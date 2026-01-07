// 游戏变量
let canvas, ctx;
let player;
let bullets = [];
let enemies = [];
let powerUps = []; // 奖励物品数组
let stars = [];
let score = 0;
let lives = 100; // 改为100点生命值
let gameRunning = false;
let gamePaused = false;
let lastTime = 0;
let enemySpawnTimer = 0;
let bulletSpawnTimer = 0;
let powerUpSpawnTimer = 0; // 奖励生成计时器

// 玩家状态
let weaponLevel = 1; // 武器等级，1为单发，2为双发，3为扇形
let weaponDuration = 0; // 武器效果持续时间
let maxWeaponDuration = 300; // 武器效果最大持续时间(帧)
let powerUpEffectTimer = 0; // 奖励效果计时器
let powerUpEffectType = null; // 当前奖励效果类型
let playerHitFlash = 0; // 玩家被击中闪烁计时器

// 键盘状态
const keys = {
  w: false,
  a: false,
  s: false,
  d: false
};

// 虚拟摇杆状态
let virtualJoystick = {
  active: false,
  baseX: 0,
  baseY: 0,
  stickX: 0,
  stickY: 0,
  radius: 50,
  maxDistance: 50
};

// 游戏元素类
class Player {
  constructor() {
    this.width = 50;
    this.height = 40;
    this.x = canvas.width / 2 - this.width / 2;
    this.y = canvas.height - this.height - 20;
    this.speed = 5;
    this.color = '#4fc3f7';
    this.originalColor = '#4fc3f7';
  }

  draw() {
    // 根据奖励效果调整颜色
    if (powerUpEffectTimer > 0 && powerUpEffectType) {
      if (powerUpEffectType === 'health') {
        ctx.fillStyle = '#4caf50'; // 绿色表示治疗效果
      } else if (powerUpEffectType === 'weapon') {
        ctx.fillStyle = '#ff9800'; // 橙色表示武器效果
      }
    } else if (playerHitFlash > 0 && playerHitFlash % 6 < 3) { // 闪烁效果，每6帧闪烁3帧
      ctx.fillStyle = '#ff5252'; // 红色表示受伤
    } else {
      ctx.fillStyle = this.color;
    }

    // 绘制飞船主体
    ctx.beginPath();
    ctx.moveTo(this.x + this.width / 2, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.lineTo(this.x, this.y + this.height);
    ctx.closePath();
    ctx.fill();

    // 绘制驾驶舱
    ctx.fillStyle = '#e3f2fd';
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + 15, 8, 0, Math.PI * 2);
    ctx.fill();

    // 绘制引擎火焰
    if (keys.w || keys.a || keys.s || keys.d || virtualJoystick.active) {
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2 - 5, this.y + this.height);
      ctx.lineTo(this.x + this.width / 2, this.y + this.height + 10);
      ctx.lineTo(this.x + this.width / 2 + 5, this.y + this.height);
      ctx.closePath();
      ctx.fill();
    }

    // 绘制虚拟摇杆
    if (virtualJoystick.active) {
      // 绘制摇杆底座
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(virtualJoystick.baseX, virtualJoystick.baseY, virtualJoystick.radius, 0, Math.PI * 2);
      ctx.stroke();

      // 绘制摇杆杆
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(virtualJoystick.stickX, virtualJoystick.stickY, virtualJoystick.radius / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  update() {
    // 键盘移动控制
    if (keys.a && this.x > 0) this.x -= this.speed;
    if (keys.d && this.x < canvas.width - this.width) this.x += this.speed;
    if (keys.w && this.y > 0) this.y -= this.speed;
    if (keys.s && this.y < canvas.height - this.height) this.y += this.speed;

    // 虚拟摇杆控制
    if (virtualJoystick.active) {
      // 计算摇杆方向和距离
      const dx = virtualJoystick.stickX - virtualJoystick.baseX;
      const dy = virtualJoystick.stickY - virtualJoystick.baseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 根据摇杆偏移量移动玩家
      if (distance > 0) {
        const moveX = (dx / distance) * Math.min(distance, virtualJoystick.maxDistance) * (this.speed / virtualJoystick.maxDistance);
        const moveY = (dy / distance) * Math.min(distance, virtualJoystick.maxDistance) * (this.speed / virtualJoystick.maxDistance);

        this.x += moveX;
        this.y += moveY;

        // 边界检查
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));
      }
    }
  }
}

class Bullet {
  constructor(x, y, angle = 0) {
    this.width = 4;
    this.height = 15;
    this.x = x;
    this.y = y;
    this.speed = 8;
    this.color = '#ffeb3b';
    this.angle = angle; // 子弹飞行角度
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // 添加子弹发光效果
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x + 1, this.y + 2, 2, 4);
  }

  update() {
    // 根据角度更新位置
    this.y -= this.speed * Math.cos(this.angle);
    this.x += this.speed * Math.sin(this.angle);
    return this.y > -this.height && this.x > -this.width && this.x < canvas.width; // 如果子弹超出屏幕边界则返回false
  }
}

class Enemy {
  constructor(type) {
    this.type = type; // 'plane' 或 'asteroid'
    this.width = type === 'plane' ? 40 : 50;
    this.height = type === 'plane' ? 30 : 50;
    this.x = Math.random() * (canvas.width - this.width);
    this.y = -this.height;
    this.speed = type === 'plane' ? 3 : 2;
    this.color = type === 'plane' ? '#f44336' : '#795548';
  }

  draw() {
    if (this.type === 'plane') {
      // 绘制敌机
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, this.y + this.height);
      ctx.lineTo(this.x, this.y);
      ctx.lineTo(this.x + this.width, this.y);
      ctx.closePath();
      ctx.fill();
      
      // 敌机驾驶舱
      ctx.fillStyle = '#ffcdd2';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + 15, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 绘制陨石
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // 添加陨石纹理
      ctx.fillStyle = '#5d4037';
      for (let i = 0; i < 5; i++) {
        const spotX = this.x + Math.random() * this.width;
        const spotY = this.y + Math.random() * this.height;
        const radius = Math.random() * 5;
        ctx.beginPath();
        ctx.arc(spotX, spotY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  update() {
    this.y += this.speed;
    return this.y < canvas.height; // 如果敌人超出屏幕下方则返回false
  }
}

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'health' 或 'weapon'
    this.width = 30;
    this.height = 30;
    this.speed = 2;
    this.color = type === 'health' ? '#4caf50' : '#ff9800'; // 绿色为治疗，橙色为武器
    this.pulse = 0; // 用于脉冲动画
  }

  draw() {
    this.pulse = (this.pulse + 0.05) % (2 * Math.PI); // 脉冲动画
    const pulseSize = Math.sin(this.pulse) * 2;

    ctx.fillStyle = this.color;
    ctx.beginPath();

    if (this.type === 'health') {
      // 绘制治疗药水（十字形）
      ctx.fillRect(
        this.x + this.width/2 - 3 + pulseSize/2,
        this.y + pulseSize,
        6,
        this.height - pulseSize*2
      );
      ctx.fillRect(
        this.x + pulseSize,
        this.y + this.height/2 - 3 + pulseSize/2,
        this.width - pulseSize*2,
        6
      );
    } else {
      // 绘制武器升级（星形）
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;
      const spikes = 5;
      const outerRadius = 15 + pulseSize;
      const innerRadius = 8;

      let rotation = Math.PI / 2;
      let x = centerX;
      let y = centerY;
      ctx.moveTo(x, y - outerRadius);

      for (let i = 0; i < spikes; i++) {
        x = centerX + Math.cos(rotation) * outerRadius;
        y = centerY + Math.sin(rotation) * outerRadius;
        ctx.lineTo(x, y);
        rotation += Math.PI / spikes;

        x = centerX + Math.cos(rotation) * innerRadius;
        y = centerY + Math.sin(rotation) * innerRadius;
        ctx.lineTo(x, y);
        rotation += Math.PI / spikes;
      }

      ctx.lineTo(centerX, centerY - outerRadius);
      ctx.closePath();
      ctx.fill();
    }
  }

  update() {
    this.y += this.speed;
    return this.y < canvas.height; // 如果奖励超出屏幕下方则返回false
  }
}

// Web Audio API 音效生成
let audioContext;

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(frequency, duration, type = 'square', volume = 0.1) {
  if (!audioContext) {
    initAudio();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;

  gainNode.gain.value = volume;

  const now = audioContext.currentTime;
  oscillator.start(now);
  oscillator.stop(now + duration / 1000); // 转换为秒

  // 释放资源
  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
  };
}

// 音频播放函数
function playSound(soundId) {
  // 使用Web Audio API生成音效
  switch(soundId) {
    case 'shoot-sound':
      // 射击音效 - 短促的高频音
      playTone(800, 50, 'square', 0.05);
      break;
    case 'hit-sound':
      // 受伤音效 - 低频短促音
      playTone(200, 200, 'sawtooth', 0.1);
      break;
    case 'powerup-sound':
      // 奖励音效 - 上升音调
      playTone(400, 100, 'sine', 0.08);
      setTimeout(() => playTone(500, 100, 'sine', 0.08), 100);
      setTimeout(() => playTone(600, 100, 'sine', 0.08), 200);
      break;
    case 'explosion-sound':
      // 爆炸音效 - 噪音效果
      playNoise(300, 300);
      break;
    case 'bgm':
      // 使用Web Audio API生成背景音乐
      playBackgroundMusic();
      break;
  }
}

// 播放噪音效果（用于爆炸声）
function playNoise(frequency, duration) {
  if (!audioContext) {
    initAudio();
  }

  const bufferSize = audioContext.sampleRate * (duration / 1000);
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; // 随机噪声
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequency;

  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + (duration / 1000));

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);

  source.start();
  source.stop(audioContext.currentTime + (duration / 1000));
}

// 播放背景音乐
let bgmSource = null;
let bgmGainNode = null;

function playBackgroundMusic() {
  if (!audioContext) {
    initAudio();
  }

  // 如果已经有背景音乐在播放，先停止它
  if (bgmSource) {
    bgmSource.stop();
    bgmSource = null;
  }

  // 创建一个简单的循环背景音乐
  const now = audioContext.currentTime;
  const noteDuration = 0.5; // 每个音符持续0.5秒

  // 创建增益节点用于控制音量
  bgmGainNode = audioContext.createGain();
  bgmGainNode.gain.value = 0.1; // 背景音乐音量较低
  bgmGainNode.connect(audioContext.destination);

  // 播放一个简单的循环旋律
  const baseFreq = 110; // A1
  const melody = [baseFreq, baseFreq * 1.2, baseFreq * 1.5, baseFreq * 1.4, baseFreq * 1.2, baseFreq * 1.0, baseFreq * 0.8, baseFreq * 1.1];

  // 循环播放旋律
  playMelody(melody, now, noteDuration);
}

function playMelody(notes, startTime, noteDuration) {
  if (!audioContext) return;

  let time = startTime;

  // 重复播放旋律
  for (let i = 0; i < notes.length; i++) {
    playNote(notes[i], time + i * noteDuration, noteDuration * 0.8);
  }

  // 计划下一轮播放
  const nextStartTime = startTime + notes.length * noteDuration;
  setTimeout(() => {
    if (bgmSource) { // 检查是否仍在播放
      playMelody(notes, nextStartTime, noteDuration);
    }
  }, notes.length * noteDuration * 1000);
}

function playNote(frequency, startTime, duration) {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(bgmGainNode);

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  // 使用包络来平滑音符的开始和结束
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.01); // 快速上升
  gainNode.gain.linearRampToValueAtTime(0.05, startTime + duration - 0.05); // 主要音量
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration); // 平滑结束

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// 初始化游戏
function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  // 创建星空背景
  createStars();

  // 初始化玩家
  player = new Player();

  // 绑定事件监听器
  bindEventListeners();

  // 启动游戏循环
  requestAnimationFrame(gameLoop);
}

// 生成奖励物品
function spawnPowerUp(x, y, type) {
  powerUps.push(new PowerUp(x, y, type));
}

// 创建星空背景
function createStars() {
  stars = [];
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2,
      opacity: Math.random() * 0.5 + 0.1
    });
  }
}

// 绘制星空背景
function drawStars() {
  for (let star of stars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 绑定事件监听器
function bindEventListeners() {
  // 键盘事件
  document.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') keys.w = true;
    if (e.key === 'a' || e.key === 'A') keys.a = true;
    if (e.key === 's' || e.key === 'S') keys.s = true;
    if (e.key === 'd' || e.key === 'D') keys.d = true;
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W') keys.w = false;
    if (e.key === 'a' || e.key === 'A') keys.a = false;
    if (e.key === 's' || e.key === 'S') keys.s = false;
    if (e.key === 'd' || e.key === 'D') keys.d = false;
  });

  // 触摸事件
  canvas.addEventListener('touchstart', handleTouchStart, false);
  canvas.addEventListener('touchmove', handleTouchMove, false);
  canvas.addEventListener('touchend', handleTouchEnd, false);

  // 鼠标事件（用于PC端模拟摇杆）
  canvas.addEventListener('mousedown', handleMouseDown, false);
  canvas.addEventListener('mousemove', handleMouseMove, false);
  canvas.addEventListener('mouseup', handleMouseUp, false);
  canvas.addEventListener('mouseleave', handleMouseUp, false); // 鼠标离开画布时也视为释放

  // 防止触摸时的默认行为（如页面滚动）
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  // 按钮事件
  document.getElementById('start-btn').addEventListener('click', () => {
    // 在用户交互后初始化音频上下文（解决浏览器自动播放策略）
    initAudio();
    startGame();
  });
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('restart-btn').addEventListener('click', restartGame);
}

// 触摸开始事件
function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const touchX = touch.clientX - rect.left;
  const touchY = touch.clientY - rect.top;

  // 检查触摸是否在左半边屏幕（控制区域）
  if (touchX < canvas.width / 2) {
    // 初始化虚拟摇杆
    virtualJoystick.active = true;
    virtualJoystick.baseX = touchX;
    virtualJoystick.baseY = touchY;
    virtualJoystick.stickX = touchX;
    virtualJoystick.stickY = touchY;
  }
}

// 触摸移动事件
function handleTouchMove(e) {
  e.preventDefault();
  if (virtualJoystick.active) {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    // 计算摇杆偏移
    const dx = touchX - virtualJoystick.baseX;
    const dy = touchY - virtualJoystick.baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= virtualJoystick.radius) {
      // 摇杆在范围内，直接设置位置
      virtualJoystick.stickX = touchX;
      virtualJoystick.stickY = touchY;
    } else {
      // 摇杆超出范围，限制在范围内
      const angle = Math.atan2(dy, dx);
      virtualJoystick.stickX = virtualJoystick.baseX + Math.cos(angle) * virtualJoystick.radius;
      virtualJoystick.stickY = virtualJoystick.baseY + Math.sin(angle) * virtualJoystick.radius;
    }
  }
}

// 触摸结束事件
function handleTouchEnd(e) {
  e.preventDefault();
  virtualJoystick.active = false;
}

// 鼠标按下事件
function handleMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // 检查鼠标点击是否在左半边屏幕（控制区域）
  if (mouseX < canvas.width / 2) {
    // 初始化虚拟摇杆
    virtualJoystick.active = true;
    virtualJoystick.baseX = mouseX;
    virtualJoystick.baseY = mouseY;
    virtualJoystick.stickX = mouseX;
    virtualJoystick.stickY = mouseY;
  }
}

// 鼠标移动事件
function handleMouseMove(e) {
  if (virtualJoystick.active) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 计算摇杆偏移
    const dx = mouseX - virtualJoystick.baseX;
    const dy = mouseY - virtualJoystick.baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= virtualJoystick.radius) {
      // 摇杆在范围内，直接设置位置
      virtualJoystick.stickX = mouseX;
      virtualJoystick.stickY = mouseY;
    } else {
      // 摇杆超出范围，限制在范围内
      const angle = Math.atan2(dy, dx);
      virtualJoystick.stickX = virtualJoystick.baseX + Math.cos(angle) * virtualJoystick.radius;
      virtualJoystick.stickY = virtualJoystick.baseY + Math.sin(angle) * virtualJoystick.radius;
    }
  }
}

// 鼠标释放事件
function handleMouseUp(e) {
  virtualJoystick.active = false;
}

// 开始游戏
function startGame() {
  gameRunning = true;
  gamePaused = false;
  score = 0;
  lives = 100; // 初始生命值为100
  bullets = [];
  enemies = [];
  powerUps = []; // 重置奖励物品数组
  weaponLevel = 1; // 重置武器等级
  weaponDuration = 0; // 重置武器持续时间
  powerUpEffectTimer = 0; // 重置奖励效果计时器
  powerUpEffectType = null; // 重置奖励效果类型
  playerHitFlash = 0; // 重置玩家被击中闪烁计时器
  updateScore();
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');

  // 播放背景音乐
  playSound('bgm');
}

// 暂停游戏
function pauseGame() {
  gamePaused = true;
  document.getElementById('pause-screen').classList.remove('hidden');

  // 暂停背景音乐
  if (bgmSource) {
    bgmSource.stop();
    bgmSource = null;
  }
  if (bgmGainNode) {
    bgmGainNode.disconnect();
    bgmGainNode = null;
  }
}

// 继续游戏
function resumeGame() {
  gamePaused = false;
  document.getElementById('pause-screen').classList.add('hidden');

  // 重新播放背景音乐
  playSound('bgm');
}

// 重新开始游戏
function restartGame() {
  gameRunning = true;
  gamePaused = false;
  score = 0;
  lives = 100; // 初始生命值为100
  bullets = [];
  enemies = [];
  powerUps = []; // 重置奖励物品数组
  player = new Player();
  weaponLevel = 1; // 重置武器等级
  weaponDuration = 0; // 重置武器持续时间
  powerUpEffectTimer = 0; // 重置奖励效果计时器
  powerUpEffectType = null; // 重置奖励效果类型
  playerHitFlash = 0; // 重置玩家被击中闪烁计时器
  updateScore();
  document.getElementById('game-over-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');

  // 停止之前的背景音乐
  if (bgmSource) {
    bgmSource.stop();
    bgmSource = null;
  }
  if (bgmGainNode) {
    bgmGainNode.disconnect();
    bgmGainNode = null;
  }

  // 重新播放背景音乐
  playSound('bgm');
}

// 更新分数显示
function updateScore() {
  document.getElementById('score-value').textContent = score;
  document.getElementById('lives-value').textContent = lives;
  document.getElementById('weapon-level-value').textContent = weaponLevel;
  document.getElementById('weapon-timer-value').textContent = Math.ceil(weaponDuration / 60); // 显示秒数
}

// 游戏主循环
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  if (gameRunning && !gamePaused) {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制星空背景
    drawStars();

    // 更新和绘制玩家
    player.update();
    player.draw();

    // 自动发射子弹（根据武器等级）
    if (timestamp - bulletSpawnTimer > 200) { // 每200ms发射一次子弹
      if (weaponLevel === 1) {
        // 单发子弹
        bullets.push(new Bullet(player.x + player.width / 2 - 2, player.y));
        playSound('shoot-sound'); // 播放射击音效
      } else if (weaponLevel === 2) {
        // 双发子弹
        bullets.push(new Bullet(player.x + player.width / 4 - 2, player.y));
        bullets.push(new Bullet(player.x + 3 * player.width / 4 - 2, player.y));
        playSound('shoot-sound'); // 播放射击音效
      } else if (weaponLevel === 3) {
        // 扇形三发子弹 - 中间垂直，两边有角度
        bullets.push(new Bullet(player.x + player.width / 2 - 2, player.y, 0)); // 中间子弹
        bullets.push(new Bullet(player.x + player.width / 4 - 2, player.y, -0.3)); // 左子弹
        bullets.push(new Bullet(player.x + 3 * player.width / 4 - 2, player.y, 0.3)); // 右子弹
        playSound('shoot-sound'); // 播放射击音效
      } else if (weaponLevel === 4) {
        // 四发子弹 - 两边再加两发
        bullets.push(new Bullet(player.x + player.width / 2 - 6, player.y));
        bullets.push(new Bullet(player.x + player.width / 2 + 2, player.y));
        bullets.push(new Bullet(player.x + player.width / 4 - 2, player.y, -0.3));
        bullets.push(new Bullet(player.x + 3 * player.width / 4 - 2, player.y, 0.3));
        playSound('shoot-sound'); // 播放射击音效
      } else if (weaponLevel >= 5) {
        // 五发扇形子弹 - 更广的扇形
        bullets.push(new Bullet(player.x + player.width / 2 - 2, player.y, 0)); // 中间
        bullets.push(new Bullet(player.x + player.width / 3 - 4, player.y, -0.2)); // 左1
        bullets.push(new Bullet(player.x + 2 * player.width / 3, player.y, 0.2)); // 右1
        bullets.push(new Bullet(player.x + player.width / 4 - 6, player.y, -0.4)); // 左2
        bullets.push(new Bullet(player.x + 3 * player.width / 4 + 2, player.y, 0.4)); // 右2
        playSound('shoot-sound'); // 播放射击音效
      }
      bulletSpawnTimer = timestamp;
    }

    // 更新和绘制子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (!bullets[i].update()) {
        bullets.splice(i, 1);
      } else {
        bullets[i].draw();
      }
    }

    // 生成敌人 - 随着分数增加，生成频率提高
    const baseSpawnRate = Math.max(300, 1000 - Math.floor(score / 10)); // 最快300ms生成一个
    if (timestamp - enemySpawnTimer > baseSpawnRate) {
      const enemyType = Math.random() > 0.7 ? 'plane' : 'asteroid'; // 增加飞机比例到30%
      enemies.push(new Enemy(enemyType));
      enemySpawnTimer = timestamp;
    }

    // 更新和绘制敌人
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].update()) {
        enemies.splice(i, 1);
      } else {
        enemies[i].draw();
      }
    }

    // 生成奖励物品（击杀敌人后随机生成）
    // 检测碰撞
    checkCollisions();

    // 更新和绘制奖励物品
    for (let i = powerUps.length - 1; i >= 0; i--) {
      if (!powerUps[i].update()) {
        powerUps.splice(i, 1);
      } else {
        powerUps[i].draw();
      }
    }

    // 更新武器效果持续时间
    if (weaponDuration > 0) {
      weaponDuration--;
      if (weaponDuration === 0) {
        weaponLevel = 1; // 恢复普通武器
      }
    }

    // 更新奖励效果计时器
    if (powerUpEffectTimer > 0) {
      powerUpEffectTimer--;
      if (powerUpEffectTimer === 0) {
        powerUpEffectType = null; // 清除效果类型
      }
    }

    // 更新玩家被击中闪烁计时器
    if (playerHitFlash > 0) {
      playerHitFlash--;
    }
  }

  requestAnimationFrame(gameLoop);
}

// 检测碰撞
function checkCollisions() {
  // 子弹与敌人的碰撞
  for (let i = bullets.length - 1; i >= 0; i--) {
    for (let j = enemies.length - 1; j >= 0; j--) {
      if (
        bullets[i].x < enemies[j].x + enemies[j].width &&
        bullets[i].x + bullets[i].width > enemies[j].x &&
        bullets[i].y < enemies[j].y + enemies[j].height &&
        bullets[i].y + bullets[i].height > enemies[j].y
      ) {
        // 碰撞发生
        bullets.splice(i, 1);
        const enemy = enemies[j];
        const points = enemy.type === 'plane' ? 10 : 5; // 飞机10分，陨石5分
        score += points;
        enemies.splice(j, 1);
        updateScore();

        // 随机生成奖励物品（30%概率）
        if (Math.random() < 0.3) {
          // 根据敌人类型决定奖励类型
          let powerUpType;
          if (enemy.type === 'plane') {
            // 飞机敌人更可能掉落武器
            powerUpType = Math.random() < 0.8 ? 'weapon' : 'health'; // 80%武器，20%治疗
          } else {
            // 陨石敌人更可能掉落治疗
            powerUpType = Math.random() < 0.7 ? 'health' : 'weapon'; // 70%治疗，30%武器
          }
          spawnPowerUp(enemy.x + enemy.width / 2 - 15, enemy.y + enemy.height / 2 - 15, powerUpType);
        }

        // 播放爆炸音效
        playSound('explosion-sound');

        break;
      }
    }
  }

  // 玩家与敌人的碰撞
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (
      player.x < enemies[i].x + enemies[i].width &&
      player.x + player.width > enemies[i].x &&
      player.y < enemies[i].y + enemies[i].height &&
      player.y + player.height > enemies[i].y
    ) {
      // 碰撞发生 - 击中我方，扣除生命值
      const damage = enemies[i].type === 'plane' ? 15 : 10; // 飞机敌人造成15点伤害，陨石造成10点伤害
      lives -= damage;
      enemies.splice(i, 1); // 移除碰撞的敌人
      updateScore();

      // 设置闪烁效果
      playerHitFlash = 30; // 闪烁半秒(以60fps计算)

      // 播放受伤音效
      playSound('hit-sound');

      if (lives <= 0) {
        lives = 0; // 确保生命值不为负数
        gameOver();
      }
    }
  }

  // 玩家与奖励物品的碰撞
  for (let i = powerUps.length - 1; i >= 0; i--) {
    if (
      player.x < powerUps[i].x + powerUps[i].width &&
      player.x + player.width > powerUps[i].x &&
      player.y < powerUps[i].y + powerUps[i].height &&
      player.y + player.height > powerUps[i].y
    ) {
      // 拾取奖励
      if (powerUps[i].type === 'health') {
        // 治疗奖励：增加生命值，最多100点
        if (lives < 100) {
          lives = Math.min(lives + 25, 100); // 治疗奖励增加25点生命值
          updateScore();
        }
        // 添加拾取治疗的视觉反馈
        powerUpEffectType = 'health';
        powerUpEffectTimer = 30; // 0.5秒(以60fps计算)
        // 播放拾取治疗音效
        playSound('powerup-sound');
      } else if (powerUps[i].type === 'weapon') {
        // 武器升级
        weaponLevel = Math.min(weaponLevel + 1, 5); // 最大武器等级为5
        weaponDuration = maxWeaponDuration; // 重置武器持续时间
        // 添加拾取武器的视觉反馈
        powerUpEffectType = 'weapon';
        powerUpEffectTimer = 30; // 0.5秒(以60fps计算)
        // 播放拾取武器音效
        playSound('powerup-sound');
      }

      powerUps.splice(i, 1); // 移除已拾取的奖励
    }
  }
}

// 游戏结束
function gameOver() {
  gameRunning = false;
  document.getElementById('final-score').textContent = score;
  document.getElementById('game-over-screen').classList.remove('hidden');

  // 停止背景音乐
  if (bgmSource) {
    bgmSource.stop();
    bgmSource = null;
  }
  if (bgmGainNode) {
    bgmGainNode.disconnect();
    bgmGainNode = null;
  }
}

// 初始化游戏
window.onload = init;