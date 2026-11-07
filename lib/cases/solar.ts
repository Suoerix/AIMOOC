// 太阳系 3D 探索 —— three.js（CDN importmap）
export const solarHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>太阳系 3D 探索</title>
<style>
  :root { color-scheme: dark; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body {
    background:#03060f; color:#e2e8f0;
    font-family:-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
    min-height:100vh; display:flex; flex-direction:column; gap:12px; padding:16px; overflow-x:hidden;
  }
  header { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  header h1 { font-size:19px; font-weight:700; color:#fbbf24; letter-spacing:.5px; }
  header span { font-size:12px; color:#64748b; }
  .stage-wrap {
    position:relative; border-radius:16px; overflow:hidden; border:1px solid rgba(251,191,36,.22);
    background:#02040c; height:min(62vh,480px); min-height:320px;
  }
  #three { width:100%; height:100%; display:block; cursor:grab; }
  #three:active { cursor:grabbing; }
  .label {
    position:absolute; bottom:12px; left:14px; font-size:12px; padding:7px 14px; border-radius:999px;
    background:rgba(2,4,12,.72); border:1px solid rgba(148,163,184,.2); color:#fde68a;
    backdrop-filter:blur(6px); pointer-events:none; transition:all .3s ease;
  }
  .controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
  .panel { background:rgba(148,163,184,.07); border:1px solid rgba(148,163,184,.14); border-radius:14px; padding:14px 16px; }
  .row { display:flex; flex-direction:column; gap:7px; margin-bottom:12px; }
  .row:last-child { margin-bottom:0; }
  .row label { display:flex; justify-content:space-between; font-size:12.5px; color:#94a3b8; }
  .row label b { color:#e2e8f0; font-weight:600; }
  input[type=range] { -webkit-appearance:none; appearance:none; width:100%; height:26px; background:transparent; cursor:pointer; }
  input[type=range]::-webkit-slider-runnable-track { height:5px; border-radius:3px; background:linear-gradient(90deg,#b45309,#92400e); }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance:none; appearance:none; margin-top:-7px; width:19px; height:19px; border-radius:50%;
    background:#fbbf24; border:2px solid #0b1020; box-shadow:0 0 10px rgba(251,191,36,.55);
  }
  input[type=range]::-moz-range-track { height:5px; border-radius:3px; background:#92400e; }
  input[type=range]::-moz-range-thumb { width:17px; height:17px; border-radius:50%; background:#fbbf24; border:2px solid #0b1020; }
  .btns { display:flex; gap:10px; flex-wrap:wrap; }
  button {
    flex:1; min-height:44px; min-width:100px; border:none; border-radius:11px; cursor:pointer;
    font-size:14px; font-weight:600; font-family:inherit; transition:transform .15s ease;
  }
  button:active { transform:scale(.97); }
  .btn-main { background:linear-gradient(135deg,#d97706,#b45309); color:#fff; box-shadow:0 4px 18px rgba(217,119,6,.35); }
  .btn-ghost { background:rgba(148,163,184,.1); color:#cbd5e1; border:1px solid rgba(148,163,184,.22); }
  .facts { font-size:12px; color:#fde68a; background:rgba(120,53,15,.18); border:1px solid rgba(120,53,15,.4); border-radius:10px; padding:10px 12px; line-height:1.9; font-family:ui-monospace,Menlo,Consolas,monospace; }
  .facts i { color:#64748b; font-style:normal; }
  .loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:13px; color:#fbbf24; background:#02040c; }
  @media (max-width:640px){ body{padding:10px} header h1{font-size:16px} .stage-wrap{height:48vh} }
</style>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
}}
</script>
</head>
<body>
<header>
  <h1>太阳系 3D 探索</h1>
  <span>Solar System · 拖拽旋转 / 滚轮缩放</span>
</header>

<div class="stage-wrap">
  <div id="three"></div>
  <div class="label" id="label">加载三维场景中…</div>
  <div class="loading" id="loading">☀ 正在加载三维引擎…</div>
</div>

<div class="controls">
  <div class="panel">
    <div class="row">
      <label><span>公转速度</span><b><span id="vSpeed">1.0</span>×</b></label>
      <input type="range" id="speedRange" min="0" max="30" value="10" step="1">
    </div>
    <div class="row">
      <label><span>轨道可见性</span><b id="vOrbit">显示</b></label>
    </div>
    <div class="btns">
      <button class="btn-ghost" id="btnOrbit">隐藏轨道</button>
      <button class="btn-main" id="btnFocus">🔭 聚焦地球</button>
    </div>
  </div>
  <div class="panel">
    <div class="facts">
      <i>// 行星数据（相对值）</i><br>
      地球公转周期 = 1 年 (演示基准)<br>
      水星 0.24 · 金星 0.62<br>
      火星 1.88 · 木星 11.86<br>
      <i>// 点击行星可查看信息</i><br>
      <i>// 距离与大小经过艺术化压缩</i>
    </div>
  </div>
</div>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

var el = document.getElementById('three');
var label = document.getElementById('label');
var loading = document.getElementById('loading');

var renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
el.appendChild(renderer.domElement);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2000);
camera.position.set(0, 42, 90);

var controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 14;
controls.maxDistance = 400;

// 光照：太阳自发光 + 环境光
scene.add(new THREE.AmbientLight(0x334455, 0.9));
var sunLight = new THREE.PointLight(0xffdd88, 2200, 0, 1.6);
scene.add(sunLight);

// 星空
(function stars(){
  var geo = new THREE.BufferGeometry();
  var N = 1400;
  var pos = new Float32Array(N*3);
  for(var i=0;i<N;i++){
    var r = 500 + Math.random()*500;
    var th = Math.random()*Math.PI*2;
    var ph = Math.acos(2*Math.random()-1);
    pos[i*3] = r*Math.sin(ph)*Math.cos(th);
    pos[i*3+1] = r*Math.cos(ph);
    pos[i*3+2] = r*Math.sin(ph)*Math.sin(th);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color:0xbfd4ff, size:1.4, sizeAttenuation:true })));
})();

// 太阳
var sun = new THREE.Mesh(
  new THREE.SphereGeometry(5.5, 40, 40),
  new THREE.MeshBasicMaterial({ color:0xffcc33 })
);
scene.add(sun);
var sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(6.8, 40, 40),
  new THREE.MeshBasicMaterial({ color:0xff8822, transparent:true, opacity:0.28 })
);
scene.add(sunGlow);

// 行星定义
var PLANETS = [
  { name:'水星 Mercury', color:0x9ca3af, size:0.9, dist:12, period:0.24, fact:'距太阳最近，一年仅 88 天' },
  { name:'金星 Venus',   color:0xfbbf24, size:1.7, dist:18, period:0.62, fact:'最热行星，表面约 465°C' },
  { name:'地球 Earth',   color:0x38bdf8, size:1.8, dist:25, period:1,    fact:'目前已知唯一存在生命的行星' },
  { name:'火星 Mars',    color:0xf87171, size:1.2, dist:32, period:1.88, fact:'红色来自表面的氧化铁' },
  { name:'木星 Jupiter', color:0xd6a077, size:4.6, dist:48, period:11.86, fact:'质量是其他行星总和的 2.5 倍' },
  { name:'土星 Saturn',  color:0xe7cf9a, size:3.9, dist:64, period:29.4,  fact:'拥有由冰与岩石构成的环', ring:true },
];

var planets = [];
var orbits = [];

PLANETS.forEach(function(p){
  var group = new THREE.Group();
  var mesh = new THREE.Mesh(
    new THREE.SphereGeometry(p.size, 32, 32),
    new THREE.MeshStandardMaterial({ color:p.color, roughness:0.75, metalness:0.1 })
  );
  mesh.userData = p;
  group.add(mesh);
  if(p.ring){
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(p.size*1.4, p.size*2.1, 48),
      new THREE.MeshBasicMaterial({ color:0xd9c9a3, side:THREE.DoubleSide, transparent:true, opacity:0.6 })
    );
    ring.rotation.x = Math.PI/2.35;
    group.add(ring);
  }
  group.position.x = p.dist;
  scene.add(group);
  planets.push({ def:p, group:group, mesh:mesh, angle:Math.random()*Math.PI*2 });

  var orbit = new THREE.Mesh(
    new THREE.RingGeometry(p.dist-0.06, p.dist+0.06, 128),
    new THREE.MeshBasicMaterial({ color:0x475569, side:THREE.DoubleSide, transparent:true, opacity:0.5 })
  );
  orbit.rotation.x = Math.PI/2;
  scene.add(orbit);
  orbits.push(orbit);
});

// 交互：点击行星
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();
renderer.domElement.addEventListener('pointerup', function(e){
  var rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX-rect.left)/rect.width)*2-1;
  pointer.y = -((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer, camera);
  var hits = raycaster.intersectObjects(planets.map(function(p){return p.mesh;}));
  if(hits.length){
    var p = hits[0].object.userData;
    label.textContent = '🪐 ' + p.name + ' — ' + p.fact;
  }
});

var speed = 1.0;
var focusMode = false;
var followTarget = null;

document.getElementById('speedRange').addEventListener('input', function(){
  speed = (+this.value)/10;
  document.getElementById('vSpeed').textContent = speed.toFixed(1);
});
document.getElementById('btnOrbit').addEventListener('click', function(){
  var visible = orbits[0].visible;
  orbits.forEach(function(o){ o.visible = !visible; });
  this.textContent = visible ? '显示轨道' : '隐藏轨道';
  document.getElementById('vOrbit').textContent = visible ? '隐藏' : '显示';
});
document.getElementById('btnFocus').addEventListener('click', function(){
  focusMode = !focusMode;
  this.textContent = focusMode ? '🌍 回到全局视角' : '🔭 聚焦地球';
  if(focusMode){
    followTarget = planets[2]; // 地球
    controls.minDistance = 4;
  }else{
    followTarget = null;
    controls.minDistance = 14;
    camera.position.set(0, 42, 90);
  }
});

function resize(){
  var rect = el.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width/rect.height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// 基准：地球 20 秒一圈
var clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  var dt = clock.getDelta();
  var t = clock.elapsedTime;
  planets.forEach(function(p){
    var w = (Math.PI*2) / (p.def.period*20);
    p.angle += w * dt * speed;
    p.group.position.x = Math.cos(p.angle)*p.def.dist;
    p.group.position.z = Math.sin(p.angle)*p.def.dist;
  });
  sunGlow.scale.setScalar(1 + Math.sin(t*2.2)*0.03);
  if(followTarget){
    var pos = followTarget.group.position;
    camera.position.lerp(new THREE.Vector3(pos.x+8, pos.y+6, pos.z+8), 0.05);
    controls.target.lerp(pos, 0.1);
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();

loading.remove();
label.textContent = '☀ 太阳系模型 · 点击行星查看信息';
</script>
</body>
</html>`
