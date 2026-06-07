/*
Name: 手指保衛戰：極限炫彩版 (Keep It Up: Neon Edition) - UI/UX 視覺優化版
Features: 科技感起使畫面、手勢狀態指示燈、賽博朋克 HUD、碰撞火花
*/

// --- ml5.js 變數 ---
let handPose;
let video;
let hands = [];
let isModelReady = false; // 追蹤模型是否準備就緒

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
let highScore = 0;
let lives = 3;
let lastSpawnTime = 0;   
let startHoverTimer = 0; // 開始按鈕的懸停計時器
let restartHoverTimer = 0; // 重新開始按鈕的懸停計時器
let colorPalette = ["#abcd5e", "#14976b", "#2b67af", "#62b6de", "#f589a3", "#ef562f", "#fc8405", "#f9d531"];

function preload() {
  // 增加偵測設定，提高靈敏度
  const options = {
    flipped: true, 
    maxHands: 1,
    modelType: "full", // 使用完整模型提高準確度
    detectionConfidence: 0.5
  };
  handPose = ml5.handPose(options, () => {
    isModelReady = true; // 模型載入完成即標記為就緒
  });
}

function setup() {
  createCanvas(640, 480);
  
  // 1. 設定攝影機
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // 從瀏覽器快取讀取最高分數
  highScore = parseInt(localStorage.getItem("neonShieldHighScore")) || 0;

  // 確保攝影機元數據載入後再開始偵測
  video.elt.onloadedmetadata = () => {
    handPose.detectStart(video, gotHands);
  };

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

  // 如果 AI 還沒準備好，顯示載入狀態並停止後續邏輯
  if (!isModelReady) {
    fill(0, 255, 200);
    textAlign(CENTER, CENTER);
    textSize(20);
    text("系統啟動中... 請允許攝影機權限", width / 2, height / 2);
    return;
  }
  
  // 繪製視訊背景（降低透明度讓 UI 更明顯）
  push();
  translate(width, 0);
  scale(-1, 1); // 必須鏡像顯示影像，才能與 flipped: true 的 AI 座標對齊
  tint(255, 80);
  image(video, 0, 0, width, height);
  pop();

  // 根據遊戲狀態切換畫面
  if (gameState === "START") {
    drawStartScreen();
  } else if (gameState === "PLAY") {
    drawPlayScreen();
  } else if (gameState === "GAMEOVER") {
    drawGameOverScreen();
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
    drawHandSkeleton(); // 顯示手部骨架幫助校正
    
    let hand = hands[0];
    // 安全取得食指座標
    let indexTip = hand.index_finger_tip || (hand.keypoints && hand.keypoints[8]);
    
    if (indexTip) {
      fill(255, 255, 0);
      circle(indexTip.x, indexTip.y, 15);

      let d = dist(indexTip.x, indexTip.y, btnX, btnY);
      if (d < btnR) isHovered = true;
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
      resetGame();
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
  textAlign(CENTER, CENTER);
  textSize(18);
  fill(255);
  text(isHovered ? "蓄能中..." : "START", btnX, btnY - 5);
  
  textSize(12);
  fill(isHovered ? "#fff" : "rgba(0, 255, 200, 0.8)");
  if (isHovered) text(floor(startHoverTimer) + "%", btnX, btnY + 15);
  else text("食指懸停於此", btnX, btnY + 15);

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
    drawHandSkeleton();
    let hand = hands[0];
    let indexTip = hand.index_finger_tip || (hand.keypoints && hand.keypoints[8]);
    
    if (indexTip) {
      Body.setPosition(fingerBody, { x: indexTip.x, y: indexTip.y });
      
      // 手指外圍的極光呼吸效果
      noFill();
      stroke(0, 255, 200, 150);
      strokeWeight(3);
      circle(indexTip.x, indexTip.y, 70 + sin(frameCount * 0.1) * 5); 
      fill(0, 255, 200, 30);
      noStroke();
      circle(indexTip.x, indexTip.y, 70);
    }
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
      score = max(0, score - 10);
      lives--;
      
      // 檢查遊戲結束條件
      if (lives <= 0) {
        endGame();
      }

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
  
  // 4. 右側生命值儀表
  drawLivesHUD();

  // 每秒穩定加分
  if (frameCount % 60 === 0 && hands.length > 0) {
    score++; 
  }
}

// --- 畫面 3：遊戲結束畫面 ---
function drawGameOverScreen() {
  textAlign(CENTER, CENTER);
  textFont('Courier New');

  // 標題
  fill(255, 50, 50);
  textSize(50);
  text("GAME OVER", width / 2, height / 2 - 100);

  // 分數統計
  fill(200);
  textSize(20);
  text("FINAL SCORE: " + score, width / 2, height / 2 - 40);
  fill(0, 255, 200);
  text("HIGH SCORE: " + highScore, width / 2, height / 2 - 10);

  let btnX = width / 2;
  let btnY = height / 2 + 80;
  let btnR = 50;

  // 偵測重新開始按鈕懸停
  let isHovered = false;
  if (hands.length > 0 && hands[0].keypoints) {
    let indexTip = hands[0].keypoints[8];
    fill(255, 255, 0);
    circle(indexTip.x, indexTip.y, 15);
    if (dist(indexTip.x, indexTip.y, btnX, btnY) < btnR) isHovered = true;
  }

  if (isHovered) {
    restartHoverTimer += 3;
    if (restartHoverTimer >= 100) {
      gameState = "START"; // 回到首頁
      restartHoverTimer = 0;
    }
    fill(255, 255, 255, 50);
  } else {
    restartHoverTimer = max(0, restartHoverTimer - 5);
    fill(0, 0, 0, 100);
  }

  // 繪製重新開始按鈕
  stroke(255);
  circle(btnX, btnY, btnR * 2);
  noStroke();
  fill(255);
  textSize(16);
  text(isHovered ? "返回中..." : "RESTART", btnX, btnY);

  // 進度環
  if (restartHoverTimer > 0) {
    noFill();
    stroke(0, 255, 200);
    strokeWeight(4);
    let endAngle = map(restartHoverTimer, 0, 100, -HALF_PI, TWO_PI - HALF_PI);
    arc(btnX, btnY, btnR * 2 + 10, btnR * 2 + 10, -HALF_PI, endAngle);
  }
}

// --- 功能輔助函式 ---

function resetGame() {
  // 清除現有的物理球體
  for (let ball of balls) {
    World.remove(engine.world, ball);
  }
  balls = [];
  score = 0;
  lives = 3;
  startHoverTimer = 0;
  spawnBall();
}

function endGame() {
  gameState = "GAMEOVER";
  // 更新最高分數
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("neonShieldHighScore", highScore);
  }
}

function drawLivesHUD() {
  let startX = width - 150;
  let startY = 35;
  fill(20, 20, 35, 180);
  stroke(255, 50, 50, 100);
  rectMode(CENTER);
  rect(startX + 60, startY, 120, 35, 5);
  
  noStroke();
  textAlign(LEFT, CENTER);
  fill(255, 100, 100);
  let heartStr = "";
  for(let i=0; i<lives; i++) heartStr += "❤";
  text("HP: " + heartStr, startX + 15, startY);
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

// --- 繪製手部骨架幫助視覺輔助 ---
function drawHandSkeleton() {
  if (hands.length > 0) {
    let hand = hands[0];
    if (hand.keypoints) {
      stroke(0, 255, 200, 50); // 淡淡的青色線條
      strokeWeight(2);
      // 繪製關節點
      for (let kp of hand.keypoints) {
        fill(0, 255, 200, 100);
        noStroke();
        circle(kp.x, kp.y, 4);
      }
    }
  }
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

function gotHands(results) { 
  hands = results; 
}

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

// --- 新增：簡單的替代操作方式 ---
function mousePressed() {
  if (gameState === "START") {
    gameState = "PLAY";
    resetGame();
  } else if (gameState === "GAMEOVER") {
    gameState = "START";
  }
}

function keyPressed() {
  // 按下空白鍵也可以開始或重玩
  if (key === ' ' || keyCode === 32) {
    if (gameState === "START") {
      gameState = "PLAY";
      resetGame();
    } else if (gameState === "GAMEOVER") {
      gameState = "START";
    }
  }
}
