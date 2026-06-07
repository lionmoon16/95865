/*
Name: 手指保衛戰：極限炫彩版 (Keep It Up: Neon Edition) - UI/UX 視覺優化版
Features: 科技感起使畫面、手勢狀態指示燈、賽博朋克 HUD、碰撞火花
*/

// --- ml5.js 變數 ---
let handPose;
let video;
let hands = [];

// --- Matter.js 變數 ---
const { Engine, World, Bodies, Body, Events } = Matter;
let engine;
let fingerBody;

// --- 遊戲邏輯與 UI 變數 ---
let gameState = "START"; // 遊戲狀態：START (開始畫面), PLAY (遊戲中)
let balls = [];          
let particles = [];      
let maxBalls = 5;        
let score = 0;
let lastSpawnTime = 0;   
let startHoverTimer = 0; // 開始按鈕的懸停計時器
let colorPalette = ["#abcd5e", "#14976b", "#2b67af", "#62b6de", "#f589a3", "#ef562f", "#fc8405", "#f9d531"];

function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  createCanvas(640, 480);
  
  // 1. 設定攝影機
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, gotHands);

  // 2. 設定物理引擎
  engine = Engine.create();
  
  // 建立代表手指的物理碰撞體
  fingerBody = Bodies.circle(width / 2, height / 2, 35, { isStatic: true });
  World.add(engine.world, [fingerBody]);
  
  // 3. 監聽 Matter.js 的碰撞事件
  Events.on(engine, 'collisionStart', function(event) {
    if (gameState !== "PLAY") return; // 只有遊戲中才觸發粒子
    let pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      let pair = pairs[i];
      if (pair.bodyA === fingerBody || pair.bodyB === fingerBody) {
        let ballBody = (pair.bodyA === fingerBody) ? pair.bodyB : pair.bodyA;
        createSparks(ballBody.position.x, ballBody.position.y, ballBody.renderColor);
      }
    }
  });
}

function draw() {
  // 基礎科技感暗背景
  background(20, 20, 30);
  
  // 繪製視訊背景（降低透明度讓 UI 更明顯）
  push();
  tint(255, 80); 
  image(video, 0, 0, width, height);
  pop();

  // 根據遊戲狀態切換畫面
  if (gameState === "START") {
    drawStartScreen();
  } else if (gameState === "PLAY") {
    drawPlayScreen();
  }
  
  // 無論在哪個畫面，都繪製右上角的手勢偵測狀態燈
  drawConnectionStatus();
}

// --- 畫面 1：科技感開始畫面 ---
function drawStartScreen() {
  // 畫面上方大標題
  textAlign(CENTER, CENTER);
  textFont('Courier New'); // 使用科技感的等寬字體
  
  // 霓虹文字發光效果
  fill(0, 255, 200, 50);
  textSize(48);
  text("NEON SHIELD", width / 2 + 2, height / 2 - 100 + 2);
  fill(0, 255, 200);
  text("NEON SHIELD", width / 2, height / 2 - 100);
  
  textSize(16);
  fill(200);
  text("手指保衛戰：極限炫彩版", width / 2, height / 2 - 50);

  let btnX = width / 2;
  let btnY = height / 2 + 60;
  let btnR = 60;

  // 偵測手部是否懸停在「START」按鈕上
  let isHovered = false;
  if (hands.length > 0) {
    let indexTip = hands[0].keypoints[8];
    // 繪製玩家的食指
    fill(0, 255, 200, 150);
    circle(indexTip.x, indexTip.y, 20);
    
    // 計算食指到按鈕中心的距離
    let d = dist(indexTip.x, indexTip.y, btnX, btnY);
    if (d < btnR) {
      isHovered = true;
    }
  }

  // 處理按鈕動畫與倒數邏輯
  if (isHovered) {
    startHoverTimer += 2; // 懸停時累積能量條
    fill(0, 255, 200, 80);
    stroke(0, 255, 200);
    strokeWeight(3);
    
    if (startHoverTimer >= 100) {
      // 能量蓄滿，初始化遊戲並開始
      gameState = "PLAY";
      score = 0;
      balls = [];
      spawnBall();
    }
  } else {
    startHoverTimer = max(0, startHoverTimer - 4); // 離開時能量消退
    fill(30, 40, 60, 200);
    stroke(100, 150, 200);
    strokeWeight(1);
  }

  // 繪製圓形啟動按鈕
  circle(btnX, btnY, btnR * 2);
  
  // 繪製進度條（外圈環形進度效果）
  if (startHoverTimer > 0) {
    noFill();
    stroke(255, 255, 0);
    strokeWeight(4);
    let endAngle = map(startHoverTimer, 0, 100, -HALF_PI, TWO_PI - HALF_PI);
    arc(btnX, btnY, btnR * 2 + 10, btnR * 2 + 10, -HALF_PI, endAngle);
  }

  // 按鈕內文字
  noStroke();
  fill(255);
  textSize(18);
  text(isHovered ? "蓄能中..." : "食指懸停", btnX, btnY - 10);
  textSize(12);
  fill(isHovered ? "#fff" : "#00ffc8");
  text(isHovered ? floor(startHoverTimer) + "%" : "START", btnX, btnY + 15);

  // 提示語
  fill(150);
  textSize(14);
  text("請將食指指尖移至按鈕上以啟動盾牌", width / 2, height - 50);
}

// --- 畫面 2：主遊戲畫面 ---
function drawPlayScreen() {
  Engine.update(engine);

  // --- 手部追蹤與動態回饋 ---
  if (hands.length > 0) {
    let indexTip = hands[0].keypoints[8];
    Body.setPosition(fingerBody, { x: indexTip.x, y: indexTip.y });
    
    // 手指外圍的極光呼吸效果
    noFill();
    stroke(0, 255, 200, 150);
    strokeWeight(3);
    circle(indexTip.x, indexTip.y, 70 + sin(frameCount * 0.1) * 5); 
    fill(0, 255, 200, 30);
    noStroke();
    circle(indexTip.x, indexTip.y, 70);
  } else {
    Body.setPosition(fingerBody, { x: -100, y: -100 });
  }

  // --- 動態增加難度 ---
  if (millis() - lastSpawnTime > 8000 && balls.length < maxBalls) {
    spawnBall();
  }

  // --- 更新與繪製所有的球 ---
  for (let i = balls.length - 1; i >= 0; i--) {
    let ball = balls[i];
    fill(ball.renderColor);
    stroke(255);
    strokeWeight(2);
    circle(ball.position.x, ball.position.y, ball.circleRadius * 2);

    if (ball.position.y > height + 30) {
      score = max(0, score - 5);
      Body.setPosition(ball, { x: random(100, width - 100), y: -30 });
      Body.setVelocity(ball, { x: random(-2, 2), y: 0 });
    }
  }

  // --- 更新與繪製粒子 ---
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // --- 賽博朋克風 HUD UI 渲染 ---
  // 1. 分數看板背景 (毛玻璃感半透明矩形)
  rectMode(CENTER);
  fill(20, 20, 35, 180);
  stroke(0, 255, 200, 100);
  strokeWeight(2);
  rect(width / 2, 50, 160, 65, 10); // 帶圓角的矩形
  
  // 2. 分數文字
  noStroke();
  textAlign(CENTER, CENTER);
  textFont('Courier New');
  fill(150);
  textSize(12);
  text("SCORE", width / 2, 32);
  fill(255);
  textSize(32);
  text(score, width / 2, 58);
  
  // 3. 左上角動態球數儀表
  fill(20, 20, 35, 180);
  stroke(100, 150, 200, 100);
  rect(80, 35, 120, 35, 5);
  
  noStroke();
  fill(200);
  textSize(12);
  textAlign(LEFT, CENTER);
  text("BALLS: " + balls.length + " / " + maxBalls, 32, 35);
  
  // 每秒穩定加分
  if (frameCount % 60 === 0 && hands.length > 0) {
    score++; 
  }
}

// --- 右上角手勢偵測狀態指示燈 ---
function drawConnectionStatus() {
  rectMode(CORNER);
  let isTracking = hands.length > 0;
  
  // 繪製狀態膠囊背景
  fill(20, 20, 35, 220);
  stroke(isTracking ? "rgba(0, 255, 100, 0.3)" : "rgba(255, 50, 50, 0.3)");
  strokeWeight(1);
  rect(width - 140, 18, 120, 30, 15);
  
  // 繪製閃爍燈號
  if (isTracking) {
    fill(0, 255, 100); // 綠燈
  } else {
    // 利用 frameCount 做出每半秒閃爍一次的紅燈
    fill(255, 50, 50, frameCount % 30 < 15 ? 255 : 50); 
  }
  noStroke();
  circle(width - 125, 33, 10);
  
  // 狀態文字
  fill(255);
  textFont('Courier New');
  textSize(11);
  textAlign(LEFT, CENTER);
  text(isTracking ? "AI: TRACKING" : "AI: SEARCHING", width - 110, 33);
}

// --- 輔助函式與物件類別（維持不變） ---
function spawnBall() {
  let r = random(15, 25); 
  let newBall = Bodies.circle(random(100, width - 100), -20, r, { restitution: 0.95, friction: 0.01 });
  newBall.renderColor = random(colorPalette);
  balls.push(newBall);
  World.add(engine.world, newBall);
  lastSpawnTime = millis();
}

function createSparks(x, y, col) {
  for (let i = 0; i < 15; i++) { particles.push(new Particle(x, y, col)); }
}

function gotHands(results) { hands = results; }

class Particle {
  constructor(x, y, col) {
    this.x = x; this.y = y;
    this.vx = random(-4, 4); this.vy = random(-6, -1);
    this.alpha = 255; this.color = col; this.size = random(4, 8);
  }
  update() { this.x += this.vx; this.y += this.vy; this.vy += 0.1; this.alpha -= 8; }
  display() {
    push();
    let c = color(this.color); c.setAlpha(this.alpha);
    fill(c); noStroke(); circle(this.x, this.y, this.size);
    pop();
  }
  isDead() { return this.alpha <= 0; }
}