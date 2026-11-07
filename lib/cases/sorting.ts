// 排序算法可视化 —— 柱状图 + 步进动画
export const sortingHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>排序算法可视化</title>
<style>
  :root { color-scheme: dark; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body {
    background:#070b16; color:#e2e8f0;
    font-family:-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
    min-height:100vh; display:flex; flex-direction:column; gap:12px; padding:16px;
  }
  header { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  header h1 { font-size:19px; font-weight:700; color:#34d399; letter-spacing:.5px; }
  header span { font-size:12px; color:#64748b; }
  .stage-wrap { position:relative; border-radius:16px; overflow:hidden; border:1px solid rgba(52,211,153,.2); background:#050914; }
  canvas { display:block; width:100%; height:auto; }
  .hud {
    position:absolute; top:12px; left:14px; font-size:12px; padding:6px 14px; border-radius:999px;
    background:rgba(5,9,20,.66); border:1px solid rgba(148,163,184,.16); color:#a7f3d0;
    backdrop-filter:blur(6px); font-variant-numeric:tabular-nums;
  }
  .controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
  .panel { background:rgba(148,163,184,.07); border:1px solid rgba(148,163,184,.14); border-radius:14px; padding:14px 16px; }
  .algo-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr)); gap:8px; margin-bottom:12px; }
  .algo {
    min-height:44px; border-radius:10px; border:1px solid rgba(148,163,184,.2);
    background:rgba(148,163,184,.07); color:#cbd5e1; font-size:13px; font-weight:600; cursor:pointer;
    display:flex; align-items:center; justify-content:center; font-family:inherit; transition:all .2s ease;
  }
  .algo.active { background:rgba(52,211,153,.14); border-color:rgba(52,211,153,.5); color:#6ee7b7; }
  .row { display:flex; flex-direction:column; gap:7px; margin-bottom:12px; }
  .row label { display:flex; justify-content:space-between; font-size:12.5px; color:#94a3b8; }
  .row label b { color:#e2e8f0; font-weight:600; }
  input[type=range] { -webkit-appearance:none; appearance:none; width:100%; height:26px; background:transparent; cursor:pointer; }
  input[type=range]::-webkit-slider-runnable-track { height:5px; border-radius:3px; background:#064e3b; }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance:none; appearance:none; margin-top:-7px; width:19px; height:19px; border-radius:50%;
    background:#34d399; border:2px solid #0b1020; box-shadow:0 0 10px rgba(52,211,153,.55);
  }
  .btns { display:flex; gap:10px; flex-wrap:wrap; }
  button { font-family:inherit; }
  .btn-main {
    flex:1; min-height:44px; min-width:110px; border:none; border-radius:11px; cursor:pointer;
    font-size:14px; font-weight:600; background:linear-gradient(135deg,#059669,#047857); color:#fff;
    box-shadow:0 4px 18px rgba(5,150,105,.35); transition:transform .15s ease;
  }
  .btn-main:active { transform:scale(.97); }
  .btn-ghost {
    flex:1; min-height:44px; min-width:90px; border-radius:11px; cursor:pointer; font-size:14px; font-weight:600;
    background:rgba(148,163,184,.1); color:#cbd5e1; border:1px solid rgba(148,163,184,.22); transition:transform .15s ease;
  }
  .btn-ghost:active { transform:scale(.97); }
  .stats { font-size:12px; color:#a7f3d0; background:rgba(6,78,59,.25); border:1px solid rgba(6,78,59,.5); border-radius:10px; padding:10px 12px; line-height:1.9; font-family:ui-monospace,Menlo,Consolas,monospace; font-variant-numeric:tabular-nums; }
  .stats i { color:#64748b; font-style:normal; }
  @media (max-width:640px){ body{padding:10px} header h1{font-size:16px} }
</style>
</head>
<body>
<header>
  <h1>排序算法可视化</h1>
  <span>Sorting Visualizer · 交换 / 比较 / 指针实时呈现</span>
</header>

<div class="stage-wrap">
  <canvas id="stage" width="960" height="420"></canvas>
  <div class="hud" id="hud">就绪</div>
</div>

<div class="controls">
  <div class="panel">
    <div class="algo-grid">
      <button class="algo active" data-algo="bubble">冒泡排序</button>
      <button class="algo" data-algo="selection">选择排序</button>
      <button class="algo" data-algo="insertion">插入排序</button>
      <button class="algo" data-algo="quick">快速排序</button>
    </div>
    <div class="row">
      <label><span>数组规模</span><b><span id="vSize">40</span> 个元素</b></label>
      <input type="range" id="sizeRange" min="10" max="90" value="40" step="1">
    </div>
    <div class="row">
      <label><span>动画速度</span><b><span id="vSpeed">中</span></b></label>
      <input type="range" id="speedRange" min="1" max="3" value="2" step="1">
    </div>
    <div class="btns">
      <button class="btn-main" id="btnPlay">▶ 开始排序</button>
      <button class="btn-ghost" id="btnShuffle">🔀 打乱</button>
    </div>
  </div>
  <div class="panel">
    <div class="stats">
      <i>// 实时统计</i><br>
      比较次数 <span id="sComp">0</span><br>
      交换次数 <span id="sSwap">0</span><br>
      时间复杂度 <span id="sComplex">O(n²)</span><br>
      <i>// 绿色=已就位 蓝色=当前比较<br>// 紫色=指针/基准 灰色=未处理</i>
    </div>
  </div>
</div>

<script>
(function(){
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var hud = document.getElementById('hud');
  var arr = [];
  var highlights = { compare:[], swap:[], sorted:[], pivot:-1 };
  var stats = { comp:0, swap:0 };
  var running = false;
  var algo = 'bubble';
  var speedTable = {1:70, 2:22, 3:2}; // 每步延时 ms
  var speed = 2;
  var COMPLEXITY = { bubble:'O(n²)', selection:'O(n²)', insertion:'O(n²)', quick:'O(n log n)' };
  var NAMES = { bubble:'冒泡排序', selection:'选择排序', insertion:'插入排序', quick:'快速排序' };

  function shuffle(){
    var n = +document.getElementById('sizeRange').value;
    arr = [];
    for(var i=1;i<=n;i++) arr.push(i);
    for(i=n-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=arr[i];arr[i]=arr[j];arr[j]=t; }
    highlights = { compare:[], swap:[], sorted:[], pivot:-1 };
    stats = { comp:0, swap:0 };
    syncStats();
    draw();
    hud.textContent = '已打乱 · ' + n + ' 个元素';
  }
  function syncStats(){
    document.getElementById('sComp').textContent = stats.comp;
    document.getElementById('sSwap').textContent = stats.swap;
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    var n = arr.length;
    if(!n) return;
    var pad = 16;
    var bw = (W-pad*2)/n;
    var maxV = n;
    var baseY = H-30;
    for(var i=0;i<n;i++){
      var h = (arr[i]/maxV)*(baseY-46);
      var color = '#475569';
      if(highlights.sorted.indexOf(i)>=0) color = '#34d399';
      if(highlights.compare.indexOf(i)>=0) color = '#38bdf8';
      if(highlights.swap.indexOf(i)>=0) color = '#fbbf24';
      if(i===highlights.pivot) color = '#c084fc';
      var x = pad + i*bw;
      var w = Math.max(1,bw-2.5);
      ctx.fillStyle = color;
      roundRect(x, baseY-h, w, h, Math.min(3,w/3));
    }
    // 基线
    ctx.strokeStyle='rgba(52,211,153,.35)';
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(pad,baseY); ctx.lineTo(W-pad,baseY); ctx.stroke();
  }
  function roundRect(x,y,w,h,r){
    ctx.beginPath();
    r = Math.min(r, h/2, w/2);
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    ctx.fill();
  }

  // 生成器驱动动画
  function* bubbleSort(a){
    var n=a.length;
    for(var i=0;i<n-1;i++){
      for(var j=0;j<n-1-i;j++){
        stats.comp++;
        highlights.compare=[j,j+1];
        yield;
        if(a[j]>a[j+1]){
          var t=a[j];a[j]=a[j+1];a[j+1]=t;
          stats.swap++;
          highlights.swap=[j,j+1];
          yield;
          highlights.swap=[];
        }
      }
      highlights.sorted.push(n-1-i);
    }
    highlights.sorted.push(0);
  }
  function* selectionSort(a){
    var n=a.length;
    for(var i=0;i<n-1;i++){
      var min=i;
      for(var j=i+1;j<n;j++){
        stats.comp++;
        highlights.compare=[j,min];
        yield;
        if(a[j]<a[min]) min=j;
      }
      if(min!==i){
        var t=a[i];a[i]=a[min];a[min]=t;
        stats.swap++;
        highlights.swap=[i,min];
        yield; highlights.swap=[];
      }
      highlights.sorted.push(i);
    }
    highlights.sorted.push(n-1);
  }
  function* insertionSort(a){
    var n=a.length;
    for(var i=1;i<n;i++){
      var key=a[i], j=i-1;
      highlights.compare=[i];
      yield;
      while(j>=0 && a[j]>key){
        stats.comp++;
        a[j+1]=a[j];
        stats.swap++;
        highlights.compare=[j,j+1];
        yield;
        j--;
      }
      a[j+1]=key;
      highlights.sorted.push(i-0);
    }
    for(var k=0;k<n;k++) if(highlights.sorted.indexOf(k)<0) highlights.sorted.push(k);
  }
  function* quickSort(a,lo,hi){
    if(lo>=hi){ if(lo>=0&&lo<a.length) highlights.sorted.push(lo); return; }
    var pivot=a[hi];
    highlights.pivot=hi;
    var i=lo;
    for(var j=lo;j<hi;j++){
      stats.comp++;
      highlights.compare=[j,hi];
      yield;
      if(a[j]<pivot){
        if(i!==j){
          var t=a[i];a[i]=a[j];a[j]=t;
          stats.swap++;
          highlights.swap=[i,j];
          yield; highlights.swap=[];
        }
        i++;
      }
    }
    var t2=a[i];a[i]=a[hi];a[hi]=t2;
    stats.swap++;
    highlights.pivot=-1;
    highlights.sorted.push(i);
    yield;
    yield* quickSort(a,lo,i-1);
    yield* quickSort(a,i+1,hi);
    for(var k=lo;k<=hi;k++) if(highlights.sorted.indexOf(k)<0) highlights.sorted.push(k);
  }

  var timer = null;
  function run(){
    var gen;
    if(algo==='bubble') gen = bubbleSort(arr);
    else if(algo==='selection') gen = selectionSort(arr);
    else if(algo==='insertion') gen = insertionSort(arr);
    else gen = quickSort(arr,0,arr.length-1);

    running = true;
    hud.textContent = NAMES[algo] + ' 进行中…';
    document.getElementById('btnPlay').textContent = '⏸ 暂停';
    var delay = speedTable[speed];
    function step(){
      var r = gen.next();
      if(r.done){
        running = false;
        highlights = { compare:[], swap:[], sorted:Array.from({length:arr.length},function(_,i){return i;}), pivot:-1 };
        draw();
        hud.textContent = '✔ 完成 · ' + NAMES[algo];
        document.getElementById('btnPlay').textContent = '▶ 开始排序';
        celebrate();
        return;
      }
      draw();
      syncStats();
      timer = setTimeout(step, delay);
    }
    step();
  }
  function celebrate(){
    // 波浪高亮动画
    var wave = 0;
    var id = setInterval(function(){
      wave++;
      for(var i=0;i<arr.length;i++){
        var phase = (i/arr.length*2 + wave*0.06) % 1;
        var intensity = Math.sin(phase*Math.PI);
        // 简单闪烁效果
      }
      draw();
      if(wave>30) clearInterval(id);
    }, 40);
  }

  document.getElementById('btnPlay').addEventListener('click',function(){
    if(running){
      clearTimeout(timer);
      running = false;
      this.textContent = '▶ 继续';
      hud.textContent = '已暂停';
    }else{
      run();
    }
  });
  document.getElementById('btnShuffle').addEventListener('click',function(){
    if(running){ clearTimeout(timer); running=false; document.getElementById('btnPlay').textContent='▶ 开始排序'; }
    shuffle();
  });
  var algos = document.querySelectorAll('.algo');
  for(var i=0;i<algos.length;i++){
    algos[i].addEventListener('click',function(){
      if(running) return;
      for(var j=0;j<algos.length;j++) algos[j].classList.remove('active');
      this.classList.add('active');
      algo = this.getAttribute('data-algo');
      document.getElementById('sComplex').textContent = COMPLEXITY[algo];
      hud.textContent = NAMES[algo] + ' 就绪';
    });
  }
  document.getElementById('sizeRange').addEventListener('input',function(){
    document.getElementById('vSize').textContent = this.value;
    if(!running) shuffle();
  });
  document.getElementById('speedRange').addEventListener('input',function(){
    speed = +this.value;
    document.getElementById('vSpeed').textContent = ['慢','中','快'][speed-1];
  });

  function resize(){
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio||1;
    canvas.width = Math.round(rect.width*dpr);
    canvas.height = Math.round(rect.width*420/960*dpr);
    W = canvas.width; H = canvas.height;
    draw();
  }
  window.addEventListener('resize',resize);
  resize();
  shuffle();
})();
</script>
</body>
</html>`
