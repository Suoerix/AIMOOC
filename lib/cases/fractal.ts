// 分形树生长实验室 —— 递归可视化
export const fractalHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>分形树生长实验室</title>
<style>
  :root { color-scheme: dark; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body {
    background:#070b16; color:#e2e8f0;
    font-family:-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
    min-height:100vh; display:flex; flex-direction:column; gap:12px; padding:16px;
  }
  header { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  header h1 { font-size:19px; font-weight:700; color:#22d3ee; letter-spacing:.5px; }
  header span { font-size:12px; color:#64748b; }
  .stage-wrap { position:relative; border-radius:16px; overflow:hidden; border:1px solid rgba(34,211,238,.2); background:radial-gradient(ellipse at 50% 100%, #0b1526 0%, #050914 70%); }
  canvas { display:block; width:100%; height:auto; }
  .badge {
    position:absolute; top:12px; right:14px; font-size:12px; padding:5px 12px; border-radius:999px;
    background:rgba(5,9,20,.7); border:1px solid rgba(148,163,184,.18); color:#94a3b8;
    font-variant-numeric:tabular-nums; pointer-events:none;
  }
  .controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
  .panel { background:rgba(148,163,184,.07); border:1px solid rgba(148,163,184,.14); border-radius:14px; padding:14px 16px; }
  .row { display:flex; flex-direction:column; gap:7px; margin-bottom:12px; }
  .row:last-child { margin-bottom:0; }
  .row label { display:flex; justify-content:space-between; font-size:12.5px; color:#94a3b8; }
  .row label b { color:#e2e8f0; font-weight:600; }
  input[type=range] { -webkit-appearance:none; appearance:none; width:100%; height:26px; background:transparent; cursor:pointer; }
  input[type=range]::-webkit-slider-runnable-track { height:5px; border-radius:3px; background:linear-gradient(90deg,#0e7490,#155e75); }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance:none; appearance:none; margin-top:-7px; width:19px; height:19px; border-radius:50%;
    background:#22d3ee; border:2px solid #0b1020; box-shadow:0 0 10px rgba(34,211,238,.55);
  }
  input[type=range]::-moz-range-track { height:5px; border-radius:3px; background:#155e75; }
  input[type=range]::-moz-range-thumb { width:17px; height:17px; border-radius:50%; background:#22d3ee; border:2px solid #0b1020; }
  .btns { display:flex; gap:10px; flex-wrap:wrap; }
  button {
    flex:1; min-height:44px; min-width:100px; border:none; border-radius:11px; cursor:pointer;
    font-size:14px; font-weight:600; font-family:inherit; transition:transform .15s ease;
  }
  button:active { transform:scale(.97); }
  .btn-main { background:linear-gradient(135deg,#0891b2,#0e7490); color:#fff; box-shadow:0 4px 18px rgba(8,145,178,.35); }
  .btn-ghost { background:rgba(148,163,184,.1); color:#cbd5e1; border:1px solid rgba(148,163,184,.22); }
  .presets { display:flex; gap:8px; flex-wrap:wrap; }
  .preset {
    flex:1; min-width:84px; padding:9px 6px; border-radius:10px; cursor:pointer; font-size:12.5px; font-weight:600;
    background:rgba(34,211,238,.08); color:#a5f3fc; border:1px solid rgba(34,211,238,.25); font-family:inherit;
  }
  .info { font-size:12px; color:#7dd3fc; background:rgba(14,116,144,.12); border:1px solid rgba(14,116,144,.3); border-radius:10px; padding:10px 12px; line-height:1.8; font-family:ui-monospace,Menlo,Consolas,monospace; }
  .info i { color:#64748b; font-style:normal; }
  @media (max-width:640px){ body{padding:10px} header h1{font-size:16px} }
</style>
</head>
<body>
<header>
  <h1>分形树生长实验室</h1>
  <span>Recursive Fractal Tree · 递归的视觉之美</span>
</header>

<div class="stage-wrap">
  <canvas id="stage" width="960" height="520"></canvas>
  <div class="badge">树枝总数 <span id="vCount">1</span></div>
</div>

<div class="controls">
  <div class="panel">
    <div class="row">
      <label><span>分支角度 θ</span><b><span id="vAngle">25</span>°</b></label>
      <input type="range" id="angleRange" min="5" max="55" value="25" step="1">
    </div>
    <div class="row">
      <label><span>递归深度</span><b><span id="vDepth">9</span> 层</b></label>
      <input type="range" id="depthRange" min="2" max="12" value="9" step="1">
    </div>
    <div class="row">
      <label><span>长度衰减率</span><b><span id="vRatio">0.72</span></b></label>
      <input type="range" id="ratioRange" min="55" max="85" value="72" step="1">
    </div>
    <div class="btns">
      <button class="btn-main" id="btnGrow">🌱 重新生长</button>
      <button class="btn-ghost" id="btnWind">🍃 风：关</button>
    </div>
  </div>
  <div class="panel">
    <div class="row">
      <label><span>经典形态预设</span></label>
      <div class="presets">
        <button class="preset" data-p="25,9,72">经典树</button>
        <button class="preset" data-p="45,10,65">蒲扇形</button>
        <button class="preset" data-p="8,12,82">杉木</button>
        <button class="preset" data-p="36,8,60">枯枝</button>
      </div>
    </div>
    <div class="info">
      <i>// 递归结构</i><br>
      branch(n) = trunk + branch(n−1)·rotate(+θ)<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ branch(n−1)·rotate(−θ)<br>
      <i>// 深度 12 时约有 4096 个末端分支</i><br>
      <i>// 观察参数如何塑造整体形态</i>
    </div>
  </div>
</div>

<script>
(function(){
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var angleRange = document.getElementById('angleRange');
  var depthRange = document.getElementById('depthRange');
  var ratioRange = document.getElementById('ratioRange');
  var vAngle = document.getElementById('vAngle');
  var vDepth = document.getElementById('vDepth');
  var vRatio = document.getElementById('vRatio');
  var vCount = document.getElementById('vCount');

  var growProgress = 0; // 0..1 生长进度
  var growing = false;
  var wind = false;
  var t = 0;
  var lastTs = 0;
  var branches = 0;

  function getParams(){
    return {
      angle: +angleRange.value,
      depth: +depthRange.value,
      ratio: +ratioRange.value/100
    };
  }

  function branch(x, y, len, angle, level, maxDrawLevel){
    if(level <= 0 || len < 0.8) return;
    var p = getParams();
    var windSway = wind ? Math.sin(t*1.7 + level*0.55)*0.05*(13-level)/6 : 0;
    var a = angle + windSway;
    var x2 = x + len*Math.sin(a);
    var y2 = y - len*Math.cos(a);
    var progress = Math.min(1, growProgress*2 - level*0.05);
    if(progress <= 0) return;
    var px = x + (x2-x)*progress;
    var py = y + (y2-y)*progress;

    branches++;
    // 颜色按层级渐变：树干暖棕 → 新芽青色
    var hue = level > 2 ? 190 + (13-level)*8 : 28;
    var color = 'hsl(' + hue + ', ' + (level>2?70:45) + '%, ' + (level>2?58:38) + '%)';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, level*0.62);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(px, py);
    ctx.stroke();

    if(progress < 1) return; // 生长中：子枝等待

    var rad = p.angle*Math.PI/180;
    branch(px, py, len*p.ratio, a - rad, level-1, maxDrawLevel);
    branch(px, py, len*p.ratio, a + rad, level-1, maxDrawLevel);
  }

  function draw(){
    branches = 0;
    ctx.clearRect(0,0,W,H);
    var p = getParams();
    var trunk = Math.min(120, H*0.24);
    branch(W/2, H-40, trunk, 0, p.depth, p.depth);
    vCount.textContent = branches;
    // 地面
    ctx.strokeStyle = 'rgba(34,211,238,.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W/2-90, H-40);
    ctx.lineTo(W/2+90, H-40);
    ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,.4)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('θ=' + p.angle + '° · depth=' + p.depth + ' · ratio=' + p.ratio.toFixed(2), W/2, H-14);
  }

  function grow(){
    growProgress = 0;
    growing = true;
    lastTs = 0;
    requestAnimationFrame(loop);
  }
  function loop(ts){
    if(!growing) return;
    if(!lastTs) lastTs = ts;
    var dt = (ts-lastTs)/1000; lastTs = ts;
    growProgress = Math.min(1, growProgress + dt*0.55);
    draw();
    if(wind){
      t += dt;
      draw();
    }
    if(growProgress >= 1 && !wind){ growing = false; return; }
    if(wind && growProgress >= 1){ requestAnimationFrame(loop); return; }
    requestAnimationFrame(loop);
  }
  function idle(){
    if(wind && !growing){
      requestAnimationFrame(function f(ts){
        if(!lastTs) lastTs = ts;
        var dt = (ts-lastTs)/1000; lastTs = ts;
        t += dt;
        draw();
        if(wind) requestAnimationFrame(f);
      });
    }
  }

  document.getElementById('btnGrow').addEventListener('click', grow);
  document.getElementById('btnWind').addEventListener('click', function(){
    wind = !wind;
    this.textContent = wind ? '🍃 风：开' : '🍃 风：关';
    if(wind){ lastTs = 0; growing = true; requestAnimationFrame(loop); }
  });

  angleRange.addEventListener('input', function(){ vAngle.textContent = this.value; draw(); });
  depthRange.addEventListener('input', function(){ vDepth.textContent = this.value; draw(); });
  ratioRange.addEventListener('input', function(){ vRatio.textContent = (+this.value/100).toFixed(2); draw(); });

  var presets = document.querySelectorAll('.preset');
  for(var i=0;i<presets.length;i++){
    presets[i].addEventListener('click', function(){
      var parts = this.getAttribute('data-p').split(',');
      angleRange.value = parts[0];
      depthRange.value = parts[1];
      ratioRange.value = parts[2];
      vAngle.textContent = parts[0];
      vDepth.textContent = parts[1];
      vRatio.textContent = (+parts[2]/100).toFixed(2);
      grow();
    });
  }

  function resize(){
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio||1;
    canvas.width = Math.round(rect.width*dpr);
    canvas.height = Math.round(rect.width*520/960*dpr);
    W = canvas.width; H = canvas.height;
    draw();
  }
  window.addEventListener('resize', resize);
  resize();
  grow();
})();
</script>
</body>
</html>`
