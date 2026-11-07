// 元素周期表交互实验室 —— 化学可视化
// 数据: [符号, 中文名, 类别, 相对原子质量(近似)]
export const periodicHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>元素周期表实验室</title>
<style>
  :root { color-scheme: dark; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body {
    background:#070b16; color:#e2e8f0;
    font-family:-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
    min-height:100vh; display:flex; flex-direction:column; gap:12px; padding:16px;
  }
  header { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  header h1 { font-size:19px; font-weight:700; color:#f87171; letter-spacing:.5px; }
  header span { font-size:12px; color:#64748b; }
  .legend { display:flex; gap:6px 14px; flex-wrap:wrap; padding:10px 14px; border-radius:12px; background:rgba(148,163,184,.06); border:1px solid rgba(148,163,184,.12); font-size:11.5px; color:#94a3b8; }
  .legend span { display:flex; align-items:center; gap:5px; cursor:pointer; padding:2px 6px; border-radius:6px; transition:background .2s; }
  .legend span.active { background:rgba(248,113,113,.15); }
  .legend i { width:10px; height:10px; border-radius:3px; display:inline-block; font-style:normal; }
  .board-wrap { position:relative; border-radius:16px; overflow:auto; border:1px solid rgba(248,113,113,.2); background:#050914; padding:14px; }
  .grid { display:grid; grid-template-columns:repeat(18, minmax(34px, 1fr)); gap:3px; min-width:760px; }
  .el {
    position:relative; border-radius:6px; padding:3px 2px 2px; cursor:pointer; user-select:none;
    aspect-ratio:1/1.08; display:flex; flex-direction:column; align-items:center; justify-content:center;
    border:1px solid transparent; transition:transform .12s ease, box-shadow .12s ease, opacity .2s;
  }
  .el:hover, .el.sel { transform:scale(1.12); z-index:2; box-shadow:0 4px 16px rgba(0,0,0,.5); border-color:#fff; }
  .el.dim { opacity:0.12; pointer-events:none; }
  .el .num { position:absolute; top:2px; left:4px; font-size:8.5px; color:rgba(255,255,255,.55); }
  .el .sym { font-size:15px; font-weight:700; line-height:1.1; }
  .el .name { font-size:8.5px; color:rgba(255,255,255,.75); margin-top:1px; }
  .detail {
    display:flex; gap:14px; flex-wrap:wrap; align-items:center; padding:14px 18px; border-radius:14px;
    background:rgba(148,163,184,.07); border:1px solid rgba(148,163,184,.14); min-height:64px;
  }
  .detail .big { font-size:34px; font-weight:800; line-height:1; }
  .detail .meta { font-size:12.5px; color:#94a3b8; line-height:1.8; }
  .detail .meta b { color:#e2e8f0; font-weight:600; }
  .quiz { margin-left:auto; text-align:right; }
  .quiz .q { font-size:13px; color:#fca5a5; margin-bottom:6px; }
  .quiz .opts { display:flex; gap:6px; flex-wrap:wrap; }
  .quiz button {
    border:none; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; font-family:inherit;
    padding:7px 12px; background:rgba(148,163,184,.12); color:#cbd5e1; border:1px solid rgba(148,163,184,.2);
    transition:all .15s ease; min-height:34px;
  }
  .quiz button:hover { background:rgba(248,113,113,.15); }
  .quiz button.right { background:rgba(74,222,128,.2); border-color:rgba(74,222,128,.5); color:#86efac; }
  .quiz button.wrong { background:rgba(248,113,113,.2); border-color:rgba(248,113,113,.5); color:#fca5a5; }
  @media (max-width:640px){ body{padding:10px} header h1{font-size:16px} }
</style>
</head>
<body>
<header>
  <h1>元素周期表实验室</h1>
  <span>Interactive Periodic Table · 点击元素 / 按类别筛选 / 元素问答</span>
</header>

<div class="legend" id="legend"></div>

<div class="board-wrap"><div class="grid" id="grid"></div></div>

<div class="detail" id="detail">
  <div class="big" id="dSym">H</div>
  <div class="meta" id="dMeta">点击任意元素查看详情</div>
  <div class="quiz" id="quizBox">
    <div class="q" id="qText">🔬 小测验：哪种元素密度最小？</div>
    <div class="opts" id="qOpts"></div>
  </div>
</div>

<script>
(function(){
  var CATS = [
    { name:'碱金属', c:'#f87171' },
    { name:'碱土金属', c:'#fb923c' },
    { name:'过渡金属', c:'#fbbf24' },
    { name:'主族金属', c:'#a3e635' },
    { name:'类金属', c:'#34d399' },
    { name:'非金属', c:'#22d3ee' },
    { name:'卤素', c:'#818cf8' },
    { name:'稀有气体', c:'#c084fc' },
    { name:'镧系', c:'#f472b6' },
    { name:'锕系', c:'#e879f9' },
  ];
  // [符号, 中文名, 类别, 质量, 周期, 族/位置]
  var DATA = [
    ['H','氢',5,1.008,1,1],['He','氦',7,4.003,1,18],
    ['Li','锂',0,6.94,2,1],['Be','铍',1,9.012,2,2],['B','硼',4,10.81,2,13],['C','碳',5,12.011,2,14],['N','氮',5,14.007,2,15],['O','氧',5,15.999,2,16],['F','氟',6,18.998,2,17],['Ne','氖',7,20.180,2,18],
    ['Na','钠',0,22.990,3,1],['Mg','镁',1,24.305,3,2],['Al','铝',3,26.982,3,13],['Si','硅',4,28.086,3,14],['P','磷',5,30.974,3,15],['S','硫',5,32.06,3,16],['Cl','氯',6,35.45,3,17],['Ar','氩',7,39.948,3,18],
    ['K','钾',0,39.098,4,1],['Ca','钙',1,40.078,4,2],['Sc','钪',2,44.956,4,3],['Ti','钛',2,47.867,4,4],['V','钒',2,50.942,4,5],['Cr','铬',2,51.996,4,6],['Mn','锰',2,54.938,4,7],['Fe','铁',2,55.845,4,8],['Co','钴',2,58.933,4,9],['Ni','镍',2,58.693,4,10],['Cu','铜',2,63.546,4,11],['Zn','锌',2,65.38,4,12],['Ga','镓',3,69.723,4,13],['Ge','锗',4,72.630,4,14],['As','砷',4,74.922,4,15],['Se','硒',5,78.971,4,16],['Br','溴',6,79.904,4,17],['Kr','氪',7,83.798,4,18],
    ['Rb','铷',0,85.468,5,1],['Sr','锶',1,87.62,5,2],['Y','钇',2,88.906,5,3],['Zr','锆',2,91.224,5,4],['Nb','铌',2,92.906,5,5],['Mo','钼',2,95.95,5,6],['Tc','锝',2,98,5,7],['Ru','钌',2,101.07,5,8],['Rh','铑',2,102.91,5,9],['Pd','钯',2,106.42,5,10],['Ag','银',2,107.87,5,11],['Cd','镓',2,112.41,5,12],['In','铟',3,114.82,5,13],['Sn','锡',3,118.71,5,14],['Sb','锑',4,121.76,5,15],['Te','碲',4,127.60,5,16],['I','碘',6,126.90,5,17],['Xe','氙',7,131.29,5,18],
    ['Cs','铯',0,132.91,6,1],['Ba','钡',1,137.33,6,2],['La','镧',8,138.91,6,3],['Hf','铪',2,178.49,6,4],['Ta','钽',2,180.95,6,5],['W','钨',2,183.84,6,6],['Re','铼',2,186.21,6,7],['Os','锇',2,190.23,6,8],['Ir','铱',2,192.22,6,9],['Pt','铂',2,195.08,6,10],['Au','金',2,196.97,6,11],['Hg','汞',2,200.59,6,12],['Tl','铊',3,204.38,6,13],['Pb','铅',3,207.2,6,14],['Bi','铋',3,208.98,6,15],['Po','钋',3,209,6,16],['At','砹',6,210,6,17],['Rn','氡',7,222,6,18],
    ['Fr','钫',0,223,7,1],['Ra','镭',1,226,7,2],['Ac','锕',9,227,7,3],['Rf','钅卢',2,267,7,4],['Db','钅杜',2,268,7,5],['Sg','钅喜',2,269,7,6],['Bh','钅波',2,270,7,7],['Hs','钅黑',2,269,7,8],['Mt','鿏',2,278,7,9],['Ds','鿏',2,281,7,10],['Rg','鿔',2,282,7,11],['Cn','鿭',2,285,7,12],['Nh','鉨',3,286,7,13],['Fl','鈇',3,289,7,14],['Mc','镆',3,290,7,15],['Lv','鉝',3,293,7,16],['Ts','鿬',6,294,7,17],['Og','鿫',7,294,7,18]
  ];
  // 镧系 (57-71) 与锕系 (89-103) 放在主表下方两行
  var LAN = [
    ['Ce','铈',8,140.12],['Pr','镨',8,140.91],['Nd','钕',8,144.24],['Pm','钷',8,145],['Sm','钐',8,150.36],['Eu','铕',8,151.96],['Gd','钆',8,157.25],['Tb','铽',8,158.93],['Dy','镝',8,162.50],['Ho','钬',8,164.93],['Er','铒',8,167.26],['Tm','铥',8,168.93],['Yb','镱',8,173.05],['Lu','镥',8,174.97]
  ];
  var ACT = [
    ['Th','钍',9,232.04],['Pa','镤',9,231.04],['U','铀',9,238.03],['Np','镎',9,237],['Pu','钚',9,244],['Am','镅',9,243],['Cm','锔',9,247],['Bk','锫',9,247],['Cf','锎',9,251],['Es','锿',9,252],['Fm','镄',9,257],['Md','钔',9,258],['No','锘',9,259],['Lr','铹',9,266]
  ];

  var grid = document.getElementById('grid');
  var legend = document.getElementById('legend');
  var dSym = document.getElementById('dSym');
  var dMeta = document.getElementById('dMeta');
  var selectedCat = -1;
  var selectedEl = null;

  function cell(d, num){
    var cat = CATS[d[2]];
    var div = document.createElement('div');
    div.className = 'el';
    div.style.background = cat.c + '30';
    div.style.borderColor = cat.c + '55';
    div.innerHTML = '<span class="num">' + num + '</span><span class="sym">' + d[0] + '</span><span class="name">' + d[1] + '</span>';
    div.addEventListener('click', function(){
      if(selectedEl) selectedEl.classList.remove('sel');
      selectedEl = div;
      div.classList.add('sel');
      dSym.textContent = d[0];
      dSym.style.color = cat.c;
      dMeta.innerHTML = '<b>' + d[1] + '</b> · 第 ' + num + ' 号元素 · ' + cat.name +
        '<br>相对原子质量 ≈ <b>' + d[3] + '</b>' +
        (d.length > 5 ? ' · 第 ' + d[4] + ' 周期' : ' · 镧系/锕系元素');
    });
    return div;
  }

  // 主表
  var placed = {};
  DATA.forEach(function(d, i){
    if(d[2]===8 || d[2]===9) return; // 镧锕系单独处理
    var num = DATA.indexOf(d)+1;
    var idx = (d[4]-1)*18 + (d[5]-1);
    var div = cell(d, num);
    grid.appendChild(div);
    placed[idx] = true;
  });
  // 占位补齐
  (function fill(){
    var children = grid.children;
    // 通过 style.order 实现绝对定位到 grid 位置
    var childIdx = 0;
    DATA.forEach(function(d){
      if(d[2]===8 || d[2]===9) return;
      var idx = (d[4]-1)*18 + (d[5]-1);
      children[childIdx].style.gridRow = Math.floor(idx/18)+1;
      children[childIdx].style.gridColumn = (idx%18)+1;
      childIdx++;
    });
  })();
  // 镧系锕系两行
  LAN.forEach(function(d, i){
    var num = 58+i;
    var div = cell(d, num);
    div.style.gridRow = 9; div.style.gridColumn = (i+4 <= 17 ? i+4 : i+4);
    grid.appendChild(div);
  });
  ACT.forEach(function(d, i){
    var num = 90+i;
    var div = cell(d, num);
    div.style.gridRow = 10; div.style.gridColumn = i+4;
    grid.appendChild(div);
  });
  // 镧锕系标记
  var mark1 = document.createElement('div');
  mark1.style.cssText = 'grid-row:8;grid-column:3;display:flex;align-items:center;justify-content:center;font-size:10px;color:#f472b6';
  mark1.textContent = '57-71 ↘';
  grid.appendChild(mark1);
  var mark2 = document.createElement('div');
  mark2.style.cssText = 'grid-row:8;grid-column:3;grid-row:8;display:none';
  var mark2b = document.createElement('div');
  mark2b.style.cssText = 'grid-row:8;grid-column:3;grid-row:8;display:none';

  // 图例 + 筛选
  CATS.forEach(function(c, i){
    var s = document.createElement('span');
    s.innerHTML = '<i style="background:' + c.c + '55"></i>' + c.name;
    s.addEventListener('click', function(){
      if(selectedCat === i){
        selectedCat = -1;
        s.classList.remove('active');
      }else{
        selectedCat = i;
        var all = legend.querySelectorAll('span');
        for(var j=0;j<all.length;j++) all[j].classList.remove('active');
        s.classList.add('active');
      }
      var els = grid.querySelectorAll('.el');
      for(var k=0;k<els.length;k++){
        var isDim = false;
        els[k].classList.remove('dim');
      }
      applyFilter();
    });
    legend.appendChild(s);
  });
  function applyFilter(){
    var els = grid.querySelectorAll('.el');
    for(var k=0;k<els.length;k++){
      var bg = els[k].style.background;
      var target = CATS[selectedCat];
      if(selectedCat >= 0 && bg !== target.c + '30'){
        els[k].classList.add('dim');
      }else{
        els[k].classList.remove('dim');
      }
    }
  }

  // 小测验
  var QUESTIONS = [
    { q: '🔬 小测验：哪种元素密度最小？', opts: ['H 氢', 'O 氧', 'Li 锂', 'He 氦'], a: 3, tip: '氢的密度最小，但氦是唯一常温下不会凝固的元素！' },
    { q: '🔬 小测验：人体中含量最多的元素是？', opts: ['C 碳', 'O 氧', 'H 氢', 'Ca 钙'], a: 1, tip: '按质量计，氧约占人体 65%（大部分在水中）。' },
    { q: '🔬 小测验：黄金（Au）属于哪一类？', opts: ['碱金属', '卤素', '过渡金属', '类金属'], a: 2, tip: '金是第 11 族的过渡金属，第 79 号元素。' },
  ];
  var qi = 0;
  function renderQuiz(){
    var Q = QUESTIONS[qi % QUESTIONS.length];
    document.getElementById('qText').textContent = Q.q;
    var box = document.getElementById('qOpts');
    box.innerHTML = '';
    Q.opts.forEach(function(o, i){
      var b = document.createElement('button');
      b.textContent = o;
      b.addEventListener('click', function(){
        if(box.dataset.done) return;
        box.dataset.done = '1';
        if(i === Q.a){
          b.classList.add('right');
          document.getElementById('qText').textContent = '✔ 答对了！' + Q.tip;
        }else{
          b.classList.add('wrong');
          box.children[Q.a].classList.add('right');
          document.getElementById('qText').textContent = '✘ 正确答案：' + Q.opts[Q.a] + '。' + Q.tip;
        }
        setTimeout(function(){
          delete box.dataset.done;
          qi++;
          renderQuiz();
        }, 2800);
      });
      box.appendChild(b);
    });
  }
  renderQuiz();
})();
</script>
</body>
</html>`
