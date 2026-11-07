// 傅里叶级数可视化 —— 方波的谐波叠加
export const fourierHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>傅里叶级数可视化</title>
<style>
  :root { color-scheme: dark; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body {
    background:#070b16; color:#e2e8f0;
    font-family:-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
    min-height:100vh; display:flex; flex-direction:column; gap:12px; padding:16px;
  }
  header { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  header h1 { font-size:19px; font-weight:700; color:#a78bfa; letter-spacing:.5px; }
  header span { font-size:12px; color:#64748b; }
  .stage-wrap { position:relative; border-radius:16px; overflow:hidden; border:1px solid rgba(167,139,250,.22); background:#050914; }
  canvas { display:block; width:100%; height:auto; }
  .badge {
    position:absolute; top:12px; right:14px; font-size:12px; padding:5px 12px; border-radius:999px;
    background:rgba(167,139,250,.12); border:1px solid rgba(167,139,250,.35); color:#c4b5fd;
    font-variant-numeric:tabular-nums; pointer-events:none;
  }
  .controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
  .panel { background:rgba(148,163,184,.07); border:1px solid rgba(148,163,184,.14); border-radius:14px; padding:14px 16px; }
  .row { display:flex; flex-direction:column; gap:7px; margin-bottom:12px; }
  .row:last-child { margin-bottom:0; }
  .row label { display:flex; justify-content:space-between; font-size:12.5px; color:#94a3b8; }
  .row label b { color:#e2e8f0; font-weight:600; font-variant-numeric:tabular-nums; }
  input[type=range] { -webkit-appearance:none; appearance:none; width:100%; height:26px; background:transparent; cursor:pointer; }
  input[type=range]::-webkit-slider-runnable-track { height:5px; border-radius:3px; background:linear-gradient(90deg,#6d28d9,#7c3aed); }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance:none; appearance:none; margin-top:-7px; width:19px; height:19px; border-radius:50%;
    background:#a78bfa; border:2px solid #0b1020; box-shadow:0 0 10px rgba(167,139,250,.55);
  }
  input[type=range]::-moz-range-track { height:5px; border-radius:3px; background:#7c3aed; }
  input[type=range]::-moz-range-thumb { width:17px; height:17px; border-radius:50%; background:#a78bfa; border:2px solid #0b1020; }
  .btns { display:flex; gap:10px; flex-wrap:wrap; }
  button {
    flex:1; min-height:44px; min-width:100px; border:none; border-radius:11px; cursor:pointer;
    font-size:14px; font-weight:600; transition:transform .15s ease; font-family:inherit;
  }
  button:active { transform:scale(.97); }
  .btn-main { background:linear-gradient(135deg,#7c3aed,#6d28d9); color:#fff; box-shadow:0 4px 18px rgba(124,58,237,.35); }
  .btn-ghost { background:rgba(148,163,184,.1); color:#cbd5e1; border:1px solid rgba(148,163,184,.22); }
  .info { font-size:12px; color:#c4b5fd; background:rgba(109,40,217,.12); border:1px solid rgba(109,40,217,.3); border-radius:10px; padding:10px 12px; line-height:1.8; font-family:ui-monospace,Menlo,Consolas,monospace; }
  .info i { color:#64748b; font-style:normal; }
  @media (max-width:640px){ body{padding:10px} header h1{font-size:16px} }
</style>
</head>
<body>
<header>
  <h1>傅里叶级数 · 方波合成</h1>
  <span>Fourier Series · 谐波叠加逼近</span>
</header>

<div class="stage-wrap">
  <canvas id="stage" width="960" height="460"></canvas>
  <div class="badge">N = <span id="vN">3</span> 项谐波</div>
</div>

<div class="controls">
  <div class="panel">
    <div class="row">
      <label><span>谐波项数 N</span><b><span id="vN2">3</span> / 60</b></label>
      <input type="range" id="nRange" min="1" max="60" value="3" step="1">
    </div>
    <div class="row">
      <label><span>动画速度</span><b><span id="vSpeed">1.0</span>×</b></label>
      <input type="range" id="animSpeed" min="0" max="30" value="10" step="1">
    </div>
    <div class="btns">
      <button class="btn-main" id="btnAnim">▶ 播放谐波生长</button>
      <button class="btn-ghost" id="btnTarget">直达 N=60</button>
    </div>
  </div>
  <div class="panel">
    <div class="info">
      <i>// 方波的傅里叶展开</i><br>
      f(t) = 4/π · Σ sin((2k−1)t)/(2k−1)<br>
      <i>// 每增加一项谐波，锯齿就更接近方波</i><br>
      <i>// 观察接近跳变点处的「吉布斯振荡」</i><br>
      <i>// 虚线圆环 = 旋转矢量叠加（Epicycles）</i>
    </div>
  </div>
</div>

<script>
(function(){
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var nRange = document.getElementById('nRange');
  var animSpeed = document.getElementById('animSpeed');
  var vN = document.getElementById('vN');
  var vN2 = document.getElementById('vN2');
  var vSpeed = document.getElementById('vSpeed');
  var animating = false;
  var cx = 170, cy = H/2; // 旋转矢量中心
  var waveX = cx, waveY = cy;
  var trail = [];
  var phase = 0;

  function resize(){
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio||1;
    canvas.width = Math.round(rect.width*dpr);
    canvas.height = Math.round(rect.width*460/960*dpr);
    W = canvas.width; H = canvas.height;
    cx = 170/960*W; cy = H/2;
    trail = [];
    draw();
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    var N = +nRange.value;

    // 坐标区背景
    ctx.strokeStyle = 'rgba(148,163,184,0.07)';
    for(var gy=40;gy<H;gy+=40){ ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }

    // 旋转矢量链（epicycles）
    var x = cx, y = cy;
    var vectors = [];
    for(var k=0;k<N;k++){
      var n = 2*k+1;
      var r = (4/Math.PI)*(1/n)*70/960*W;
      var a = phase*n;
      var nx = x + r*Math.cos(a);
      var ny = y - r*Math.sin(a);
      vectors.push({x1:x,y1:y,x2:nx,y2:ny,r:r});
      x = nx; y = ny;
    }
    // 画圈+矢量
    for(k=0;k<vectors.length;k++){
      var v = vectors[k];
      ctx.strokeStyle = 'rgba(196,181,253,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(v.x1,v.y1,v.r,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(167,139,250,0.75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(v.x1,v.y1); ctx.lineTo(v.x2,v.y2); ctx.stroke();
    }

    // 波形起点
    var px = x, py = y;
    ctx.strokeStyle = 'rgba(167,139,250,0.5)';
    ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(W-40,py); ctx.stroke();
    ctx.setLineDash([]);

    // trail：记录 y
    var waveStart = W-40;
    if(trail.length===0 || Math.abs(trail[trail.length-1].y-py)>0.01){
      // phase 连续推进时记录
    }
    // 由 phase 直接重算整条曲线（保证拖动滑块即时正确）
    trail = [];
    var steps = 420;
    var perStep = 0.028;
    for(var s=steps;s>=1;s--){
      var p2 = phase - s*perStep;
      var yy = cy;
      for(k=0;k<N;k++){
        var n2 = 2*k+1;
        yy -= (4/Math.PI)*(1/n2)*70/960*W*Math.sin(p2*n2);
      }
      trail.push({x: waveStart - (steps-s)*(waveStart-cx-60)/steps, y: yy});
    }
    // 当前点接到最新
    trail.push({x:waveStart, y:py});

    // 目标方波（参考虚线）
    ctx.strokeStyle = 'rgba(244,114,182,0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4,6]);
    ctx.beginPath();
    var squareT0 = phase - steps*perStep;
    for(s=0;s<=steps;s++){
      var t = squareT0 + s*perStep;
      var sign = Math.sin(t)>=0?1:-1;
      var yy2 = cy - sign*90/960*W;
      var xx2 = trail[s]?trail[s].x:waveStart;
      if(s===0) ctx.moveTo(xx2,yy2); else ctx.lineTo(xx2,yy2);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 当前合成波
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth = 2.4;
    ctx.lineJoin='round';
    ctx.beginPath();
    for(s=0;s<trail.length;s++){
      if(s===0) ctx.moveTo(trail[s].x,trail[s].y);
      else ctx.lineTo(trail[s].x,trail[s].y);
    }
    ctx.stroke();

    // 当前点
    ctx.fillStyle='#f0abfc';
    ctx.shadowColor='rgba(240,171,252,0.9)'; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(px,py,6,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;

    // 图例
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(196,181,253,.8)';
    ctx.fillText('— 合成波 f(t)', 20, 26);
    ctx.fillStyle = 'rgba(244,114,182,.7)';
    ctx.fillText('-- 理想方波', 130, 26);
  }

  var lastTs = 0;
  function loop(ts){
    if(!animating) return;
    if(!lastTs) lastTs = ts;
    var dt = (ts-lastTs)/1000; lastTs = ts;
    phase += dt * (+animSpeed.value)/10 * 0.6;
    draw();
    requestAnimationFrame(loop);
  }
  document.getElementById('btnAnim').addEventListener('click',function(){
    animating = !animating; lastTs = 0;
    this.textContent = animating ? '⏸ 暂停' : '▶ 播放谐波生长';
    if(animating) requestAnimationFrame(loop);
  });
  document.getElementById('btnTarget').addEventListener('click',function(){
    nRange.value = 60; syncN(); draw();
  });
  nRange.addEventListener('input',function(){ syncN(); draw(); });
  animSpeed.addEventListener('input',function(){ vSpeed.textContent = ((+animSpeed.value)/10).toFixed(1); });
  function syncN(){ vN.textContent = nRange.value; vN2.textContent = nRange.value; }

  window.addEventListener('resize',resize);
  resize();
  animating = true;
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>`
