// 抛体运动物理实验室 —— 自包含交互 HTML（OpenMAIC simulation 风格）
// 渲染方式：沙箱 iframe srcDoc（allow-scripts，无外部依赖）
export const projectileHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>抛体运动实验室</title>
<style>
  :root { color-scheme: dark; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body {
    background:#070b16; color:#e2e8f0;
    font-family:-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
    min-height:100vh; display:flex; flex-direction:column; gap:12px; padding:16px;
  }
  header { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  header h1 { font-size:19px; font-weight:700; color:#67e8f9; letter-spacing:.5px; }
  header span { font-size:12px; color:#64748b; }
  .stage-wrap { position:relative; border-radius:16px; overflow:hidden; border:1px solid rgba(103,232,249,.18); background:#050914; }
  canvas { display:block; width:100%; height:auto; touch-action:none; }
  .hud {
    position:absolute; top:10px; left:12px; font-size:11.5px; line-height:1.7;
    color:#94a3b8; background:rgba(5,9,20,.62); border:1px solid rgba(148,163,184,.14);
    border-radius:10px; padding:8px 12px; backdrop-filter:blur(6px); pointer-events:none;
  }
  .hud b { color:#67e8f9; font-weight:600; }
  .result {
    position:absolute; top:10px; right:12px; font-size:12px; padding:6px 12px; border-radius:999px;
    background:rgba(34,211,238,.12); border:1px solid rgba(34,211,238,.35); color:#a5f3fc;
    opacity:0; transform:translateY(-4px); transition:all .35s ease; pointer-events:none;
  }
  .result.show { opacity:1; transform:none; }
  .result.hit { background:rgba(74,222,128,.15); border-color:rgba(74,222,128,.45); color:#86efac; }
  .result.miss { background:rgba(248,113,113,.14); border-color:rgba(248,113,113,.4); color:#fca5a5; }
  .controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
  .panel { background:rgba(148,163,184,.07); border:1px solid rgba(148,163,184,.14); border-radius:14px; padding:14px 16px; }
  .row { display:flex; flex-direction:column; gap:7px; margin-bottom:12px; }
  .row:last-child { margin-bottom:0; }
  .row label { display:flex; justify-content:space-between; font-size:12.5px; color:#94a3b8; }
  .row label b { color:#e2e8f0; font-weight:600; font-variant-numeric:tabular-nums; }
  input[type=range] { -webkit-appearance:none; appearance:none; width:100%; height:26px; background:transparent; cursor:pointer; }
  input[type=range]::-webkit-slider-runnable-track { height:5px; border-radius:3px; background:linear-gradient(90deg,#0e7490,#164e63); }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance:none; appearance:none; margin-top:-7px; width:19px; height:19px; border-radius:50%;
    background:#22d3ee; border:2px solid #0b1020; box-shadow:0 0 10px rgba(34,211,238,.55);
  }
  input[type=range]::-moz-range-track { height:5px; border-radius:3px; background:#164e63; }
  input[type=range]::-moz-range-thumb { width:17px; height:17px; border-radius:50%; background:#22d3ee; border:2px solid #0b1020; }
  .btns { display:flex; gap:10px; flex-wrap:wrap; }
  button {
    flex:1; min-height:44px; min-width:110px; border:none; border-radius:11px; cursor:pointer;
    font-size:14px; font-weight:600; letter-spacing:.3px; transition:transform .15s ease, box-shadow .15s ease;
    font-family:inherit;
  }
  button:active { transform:scale(.97); }
  .btn-main { background:linear-gradient(135deg,#0891b2,#0e7490); color:#fff; box-shadow:0 4px 18px rgba(8,145,178,.35); }
  .btn-ghost { background:rgba(148,163,184,.1); color:#cbd5e1; border:1px solid rgba(148,163,184,.22); }
  .btn-ghost.preset { background:rgba(168,85,247,.14); border-color:rgba(168,85,247,.4); color:#d8b4fe; }
  .formula { font-size:12px; color:#7dd3fc; background:rgba(14,116,144,.12); border:1px solid rgba(14,116,144,.3); border-radius:10px; padding:10px 12px; line-height:1.8; font-family:ui-monospace,Menlo,Consolas,monospace; }
  .formula i { color:#64748b; font-style:normal; }
  @media (max-width:640px){ body{padding:10px} header h1{font-size:16px} }
</style>
</head>
<body>
<header>
  <h1>抛体运动实验室</h1>
  <span>Projectile Motion · 忽略空气阻力</span>
</header>

<div class="stage-wrap">
  <canvas id="stage" width="960" height="460"></canvas>
  <div class="hud">
    射程 <b id="hRange">--</b> m<br>
    飞行时间 <b id="hTime">--</b> s<br>
    最大高度 <b id="hHeight">--</b> m
  </div>
  <div class="result" id="result"></div>
</div>

<div class="controls">
  <div class="panel">
    <div class="row">
      <label><span>发射角度 θ</span><b><span id="vAngle">45</span>°</b></label>
      <input type="range" id="angle" min="10" max="80" value="45" step="1">
    </div>
    <div class="row">
      <label><span>初速度 v₀</span><b><span id="vSpeed">25</span> m/s</b></label>
      <input type="range" id="speed" min="5" max="60" value="25" step="1">
    </div>
    <div class="btns">
      <button class="btn-main" id="btnLaunch">🚀 发射</button>
      <button class="btn-ghost" id="btnReset">重置</button>
      <button class="btn-ghost preset" id="btnPreset">🎯 命中目标</button>
    </div>
  </div>
  <div class="panel">
    <div class="formula">
      <i>// 实时运动学计算</i><br>
      x(t) = v₀·cosθ·t<br>
      y(t) = v₀·sinθ·t − ½gt²<br>
      射程 R = v₀²·sin2θ / g<br>
      <i>// 试着调到 45° 以外的角度观察射程变化</i>
    </div>
  </div>
</div>

<script>
(function(){
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var G = 9.8;
  var ground = H - 56;
  var originX = 90;
  var scale = 6.5; // 像素/米

  var angleEl = document.getElementById('angle');
  var speedEl = document.getElementById('speed');
  var vAngle = document.getElementById('vAngle');
  var vSpeed = document.getElementById('vSpeed');
  var hRange = document.getElementById('hRange');
  var hTime = document.getElementById('hTime');
  var hHeight = document.getElementById('hHeight');
  var result = document.getElementById('result');

  var state = {
    flying: false,
    trail: [],
    t: 0,
    target: 200, // 米
    projectiles: [] // 已落地的历史轨迹
  };
  var launch = null;
  var rafId = null;
  var lastTs = 0;

  function getParams(){ return { angle:+angleEl.value, speed:+speedEl.value }; }
  function physics(p){
    var rad = p.angle * Math.PI/180;
    var vx = p.speed * Math.cos(rad);
    var vy = p.speed * Math.sin(rad);
    var T = 2*vy/G;
    var R = vx*T;
    var Hm = vy*vy/(2*G);
    return { vx:vx, vy:vy, T:T, R:R, Hm:Hm };
  }
  function updateReadout(){
    var p = getParams();
    var ph = physics(p);
    hRange.textContent = ph.R.toFixed(1);
    hTime.textContent = ph.T.toFixed(2);
    hHeight.textContent = ph.Hm.toFixed(1);
  }
  function randomTarget(){
    // 目标点落在当前参数可达射程附近：既看得见，又需要调节才能命中
    var base = physics(getParams()).R;
    state.target = Math.round(base * (0.55 + Math.random() * 0.5));
    if(state.target < 25) state.target = 25;
  }

  // 按「射程 / 目标 / 最大高度」自适应缩放，保证轨迹与目标始终在画面内
  function autoScale(){
    var ph = physics(getParams());
    var maxX = Math.max(ph.R, state.target, 30) * 1.08;
    var maxY = Math.max(ph.Hm, 4) * 1.3;
    var sx = (W - originX - 0.04 * W) / maxX;
    var sy = (ground - 0.13 * H) / maxY;
    scale = Math.max(0.5, Math.min(sx, sy));
  }

  function drawScene(){
    autoScale();
    ctx.clearRect(0,0,W,H);
    // 背景网格
    ctx.strokeStyle = 'rgba(148,163,184,0.07)';
    ctx.lineWidth = 1;
    for(var gx=originX; gx<W; gx+=40){ line(gx,40,gx,ground); }
    for(var gy=ground; gy>40; gy-=40){ line(20,gy,W-20,gy); }
    // 地面
    var grd = ctx.createLinearGradient(0,ground,0,H);
    grd.addColorStop(0,'rgba(34,211,238,0.25)');
    grd.addColorStop(1,'rgba(34,211,238,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0,ground,W,H-ground);
    ctx.strokeStyle = 'rgba(103,232,249,0.5)';
    ctx.lineWidth = 2;
    line(0,ground,W,ground);
    // 历史轨迹
    for(var i=0;i<state.projectiles.length;i++){
      trace(state.projectiles[i],'rgba(148,163,184,0.28)');
    }
    // 发射器
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(originX,ground-8,7,0,Math.PI*2);
    ctx.fill();
    var rad = getParams().angle*Math.PI/180;
    ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 4; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(originX,ground-8);
    ctx.lineTo(originX+26*Math.cos(rad),ground-8-26*Math.sin(rad));
    ctx.stroke();
    // 目标
    drawTarget();
    // 当前轨迹
    if(state.trail.length>1) trace(state.trail,'rgba(103,232,249,0.95)');
    if(launch && state.flying){
      var m = posAt(state.t);
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = 'rgba(251,191,36,0.8)'; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(m.x,m.y,8,0,Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  function line(x1,y1,x2,y2){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
  function trace(pts,color){
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath();
    for(var i=0;i<pts.length;i++){
      var p = pts[i];
      if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
  }
  function drawTarget(){
    var tx = originX + state.target*scale;
    ctx.strokeStyle = '#f472b6'; ctx.fillStyle = 'rgba(244,114,182,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx-14,ground); ctx.lineTo(tx,ground-34); ctx.lineTo(tx+14,ground);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f472b6';
    ctx.font = '11px sans-serif'; ctx.textAlign='center';
    ctx.fillText(state.target.toFixed(0)+'m', tx, ground+16);
  }
  function posAt(t){
    var p = getParams();
    var ph = physics(p);
    var x = ph.vx*t, y = ph.vy*t - 0.5*G*t*t;
    return { x: originX + x*scale, y: ground - Math.max(0,y)*scale, mY:y, mX:x };
  }

  function step(ts){
    if(!state.flying){ return; }
    if(!lastTs){ lastTs = ts; rafId = requestAnimationFrame(step); return; }
    var dt = Math.min(0.05,(ts-lastTs)/1000);
    lastTs = ts;
    state.t += dt;
    var m = posAt(state.t);
    state.trail.push({x:m.x,y:m.y});
    // 注意：y(0)=0，必须等离开地面后才判定落地，否则第一帧就结束
    if(m.mY <= 0 && state.t > 0.08){
      // 落地
      state.flying = false;
      state.projectiles.push(state.trail.slice());
      if(state.projectiles.length>4) state.projectiles.shift();
      var dist = Math.abs(m.mX - state.target);
      if(dist < 6){
        show('🎯 命中！偏差 '+dist.toFixed(1)+' m','hit');
      }else{
        show('偏差 '+dist.toFixed(1)+' m，调整角度或速度再试试','miss');
      }
    }
    drawScene();
    if(state.flying) rafId = requestAnimationFrame(step);
  }
  function show(text,type){
    result.textContent = text;
    result.className = 'result show '+type;
    setTimeout(function(){ result.className='result'; }, 2600);
  }

  document.getElementById('btnLaunch').addEventListener('click',function(){
    state.trail = []; state.t = 0; state.flying = true; lastTs = 0;
    result.className = 'result';
    rafId = requestAnimationFrame(step);
  });
  document.getElementById('btnReset').addEventListener('click',function(){
    state.flying = false; state.trail = []; state.projectiles = [];
    randomTarget(); drawScene();
  });
  document.getElementById('btnPreset').addEventListener('click',function(){
    // 理论命中解：固定 45°，反解速度
    var t = state.target;
    var v = Math.sqrt(t*G);
    var a = 45;
    if(v<5) v=5; if(v>60) v=60;
    // 若速度超界，改用固定最大速度反解角度
    if(v>=60){
      v = 60;
      var s = Math.sin(2*Math.atan(0))||0;
      var sin2 = t*G/(v*v);
      if(sin2<=1){
        var rad2 = Math.asin(sin2)/2;
        a = rad2*180/Math.PI;
      }
    }
    angleEl.value = Math.round(a);
    speedEl.value = Math.round(v);
    vAngle.textContent = angleEl.value;
    vSpeed.textContent = speedEl.value;
    updateReadout(); drawScene();
    show('已设定理论命中参数，点击发射','show');
  });

  angleEl.addEventListener('input',function(){ vAngle.textContent = angleEl.value; updateReadout(); drawScene(); });
  speedEl.addEventListener('input',function(){ vSpeed.textContent = speedEl.value; updateReadout(); drawScene(); });

  // 高分屏适配
  function fit(){
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio||1;
    canvas.width = Math.round(rect.width*dpr);
    canvas.height = Math.round(rect.width*460/960*dpr);
    W = canvas.width; H = canvas.height;
    ground = H - 56/960*W;
    scale = 6.5/960*W;
    originX = 90/960*W;
    drawScene();
  }
  window.addEventListener('resize',fit);
  fit();
  updateReadout();
  randomTarget();
  drawScene();
  // 载入后自动演示一次，进入页面即可看到轨迹
  setTimeout(function(){
    if(!state.flying && state.projectiles.length === 0){
      state.trail = []; state.t = 0; state.flying = true; lastTs = 0;
      rafId = requestAnimationFrame(step);
    }
  }, 800);
})();
</script>
</body>
</html>`
