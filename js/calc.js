// 交互式小部件：复利 / 资产负债表 / FCF / 杜邦 / DCF

window.WIDGETS = {

  compound(el) {
    el.innerHTML = `
      <div class="grid grid-cols-2 gap-4 mb-4">
        <label class="text-sm">本金（元）
          <input type="number" id="c-pv" value="10000" class="mt-1 w-full px-3 py-2 border border-stone-300 rounded" /></label>
        <label class="text-sm">年化收益率 %
          <input type="number" id="c-rate" value="10" step="0.5" class="mt-1 w-full px-3 py-2 border border-stone-300 rounded" /></label>
        <label class="text-sm">年数
          <input type="number" id="c-years" value="30" class="mt-1 w-full px-3 py-2 border border-stone-300 rounded" /></label>
        <label class="text-sm">每年追加投入（元）
          <input type="number" id="c-add" value="0" class="mt-1 w-full px-3 py-2 border border-stone-300 rounded" /></label>
      </div>
      <button id="c-calc" class="px-4 py-2 bg-stone-900 text-white rounded text-sm">计算</button>
      <div id="c-result" class="mt-4 text-sm"></div>
      <canvas id="c-chart" class="mt-4 w-full" height="220"></canvas>
    `;
    const calc = () => {
      const pv = +el.querySelector('#c-pv').value;
      const r = +el.querySelector('#c-rate').value / 100;
      const years = +el.querySelector('#c-years').value;
      const add = +el.querySelector('#c-add').value;
      const series = [];
      let v = pv;
      for (let y = 0; y <= years; y++) { series.push(v); v = v * (1 + r) + add; }
      const fv = series[series.length - 1];
      const totalIn = pv + add * years;
      // volatility drag demo
      const geoAvg = r > 0 ? (Math.pow(fv / (pv || 1), 1 / years) - 1) * 100 : 0;
      el.querySelector('#c-result').innerHTML = `
        <div class="p-4 bg-emerald-50 rounded">
          <div>本金累计投入：<b>${totalIn.toLocaleString('zh-CN',{maximumFractionDigits:0})}</b> 元</div>
          <div>${years} 年后总额：<b class="text-emerald-700 text-lg">${fv.toLocaleString('zh-CN',{maximumFractionDigits:0})}</b> 元</div>
          <div>净增长倍数：<b>${(fv/totalIn).toFixed(2)}x</b>，纯复利贡献：<b>${(fv-totalIn).toLocaleString('zh-CN',{maximumFractionDigits:0})}</b> 元</div>
          <div class="mt-2 text-xs text-stone-500">几何年化 ≈ ${geoAvg.toFixed(2)}%（对比输入的 ${(r*100).toFixed(2)}% 算术年化）</div>
        </div>`;
      drawLineChart(el.querySelector('#c-chart'), series, '#059669');
    };
    el.querySelector('#c-calc').onclick = calc;
    calc();
  },

  balancesheet(el) {
    el.innerHTML = `
      <div class="text-sm mb-3">拖动滑块改变公司的资产结构，观察 ROE / 杠杆率变化。</div>
      <div class="space-y-3 mb-4">
        <label class="block text-sm">总资产 <span id="bs-a-val" class="font-mono text-emerald-700"></span> 亿
          <input type="range" id="bs-a" min="50" max="500" value="100" class="w-full" /></label>
        <label class="block text-sm">负债占比 <span id="bs-l-val" class="font-mono text-emerald-700"></span> %
          <input type="range" id="bs-l" min="0" max="90" value="40" class="w-full" /></label>
        <label class="block text-sm">净利润 <span id="bs-p-val" class="font-mono text-emerald-700"></span> 亿
          <input type="range" id="bs-p" min="1" max="100" value="10" class="w-full" /></label>
      </div>
      <div id="bs-result"></div>
    `;
    const update = () => {
      const A = +el.querySelector('#bs-a').value;
      const Lpct = +el.querySelector('#bs-l').value;
      const P = +el.querySelector('#bs-p').value;
      const L = A * Lpct / 100;
      const E = A - L;
      const ROE = P / E * 100;
      const ROA = P / A * 100;
      const lev = A / E;
      el.querySelector('#bs-a-val').textContent = A;
      el.querySelector('#bs-l-val').textContent = Lpct;
      el.querySelector('#bs-p-val').textContent = P;
      el.querySelector('#bs-result').innerHTML = `
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="p-3 bg-sky-50 rounded"><div class="text-xs text-stone-500">ROA</div><div class="text-lg font-bold">${ROA.toFixed(2)}%</div></div>
          <div class="p-3 bg-emerald-50 rounded"><div class="text-xs text-stone-500">ROE</div><div class="text-lg font-bold text-emerald-700">${ROE.toFixed(2)}%</div></div>
          <div class="p-3 bg-amber-50 rounded"><div class="text-xs text-stone-500">权益乘数</div><div class="text-lg font-bold">${lev.toFixed(2)}x</div></div>
        </div>
        <div class="mt-3 flex h-10 rounded overflow-hidden text-xs text-white font-semibold">
          <div class="bg-red-500 flex items-center justify-center" style="width:${Lpct}%">负债 ${L.toFixed(0)}亿</div>
          <div class="bg-emerald-600 flex items-center justify-center" style="width:${100-Lpct}%">权益 ${E.toFixed(0)}亿</div>
        </div>
        <div class="mt-3 text-xs text-stone-600">💡 净利润不变，加杠杆会放大 ROE。但杠杆是双刃剑——盈利为负时损失也被放大。</div>`;
    };
    ['bs-a','bs-l','bs-p'].forEach(id => el.querySelector('#'+id).oninput = update);
    update();
  },

  fcf(el) {
    el.innerHTML = `
      <div class="text-sm mb-3">输入公司的经营现金流和资本开支，计算自由现金流。</div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        <label class="text-sm">经营现金流 CFO（亿元）
          <input type="number" id="f-cfo" value="2220" class="mt-1 w-full px-3 py-2 border rounded" /></label>
        <label class="text-sm">资本开支 CapEx（亿元）
          <input type="number" id="f-capex" value="263" class="mt-1 w-full px-3 py-2 border rounded" /></label>
        <label class="text-sm">净利润（亿元）
          <input type="number" id="f-np" value="1152" class="mt-1 w-full px-3 py-2 border rounded" /></label>
        <label class="text-sm">当前市值（亿元）
          <input type="number" id="f-mcap" value="35000" class="mt-1 w-full px-3 py-2 border rounded" /></label>
      </div>
      <button id="f-calc" class="px-4 py-2 bg-stone-900 text-white rounded text-sm">计算 FCF</button>
      <div id="f-result" class="mt-4"></div>
    `;
    const calc = () => {
      const cfo = +el.querySelector('#f-cfo').value;
      const capex = +el.querySelector('#f-capex').value;
      const np = +el.querySelector('#f-np').value;
      const mcap = +el.querySelector('#f-mcap').value;
      const fcf = cfo - capex;
      const fcfYield = mcap > 0 ? (fcf / mcap * 100) : 0;
      const netCashRatio = np > 0 ? (cfo / np) : 0;
      el.querySelector('#f-result').innerHTML = `
        <div class="grid grid-cols-3 gap-3 text-center mb-3">
          <div class="p-3 bg-emerald-50 rounded"><div class="text-xs text-stone-500">自由现金流</div><div class="text-lg font-bold text-emerald-700">${fcf.toFixed(0)} 亿</div></div>
          <div class="p-3 bg-sky-50 rounded"><div class="text-xs text-stone-500">FCF 收益率</div><div class="text-lg font-bold">${fcfYield.toFixed(2)}%</div></div>
          <div class="p-3 ${netCashRatio > 0.8 ? 'bg-emerald-50' : 'bg-red-50'} rounded"><div class="text-xs text-stone-500">净现比</div><div class="text-lg font-bold">${netCashRatio.toFixed(2)}</div></div>
        </div>
        <div class="text-xs text-stone-600">
          ${netCashRatio > 1 ? '✅ 净现比 > 1，利润含金量高，真金白银落袋' : netCashRatio > 0.7 ? '⚠️ 净现比 0.7-1.0，尚可但需关注应收/存货' : '🚨 净现比 < 0.7，利润可能虚胖，警惕！'}
          <br/>FCF 收益率 = FCF/市值，类似「现金版的 PE 倒数」。>5% 通常被认为有吸引力。
        </div>`;
    };
    el.querySelector('#f-calc').onclick = calc;
    calc();
  },

  dupont(el) {
    el.innerHTML = `
      <div class="text-sm mb-3">调整三个杜邦因子，看 ROE 如何变化。右侧是三家真实公司的杜邦数据对照。</div>
      <div class="grid grid-cols-2 gap-6">
        <div class="space-y-3">
          <label class="block text-sm">净利率 <span id="dp-m-val" class="font-mono text-emerald-700"></span> %
            <input type="range" id="dp-m" min="1" max="60" value="20" step="1" class="w-full" /></label>
          <label class="block text-sm">资产周转率 <span id="dp-t-val" class="font-mono text-emerald-700"></span> 次
            <input type="range" id="dp-t" min="5" max="300" value="55" step="5" class="w-full" /></label>
          <label class="block text-sm">权益乘数 <span id="dp-l-val" class="font-mono text-emerald-700"></span> x
            <input type="range" id="dp-l" min="10" max="150" value="20" step="5" class="w-full" /></label>
          <div id="dp-result"></div>
        </div>
        <div class="text-xs">
          <table class="w-full border-collapse">
            <tr class="bg-stone-100"><th class="p-2 text-left">公司</th><th>净利率</th><th>周转率</th><th>杠杆</th><th>ROE</th></tr>
            <tr class="border-b"><td class="p-2 font-medium">贵州茅台</td><td class="p-2">52%</td><td>0.55</td><td>1.2</td><td class="p-2 font-bold text-emerald-700">~30%</td></tr>
            <tr class="border-b"><td class="p-2 font-medium">宁德时代</td><td class="p-2">10%</td><td>0.55</td><td>4.0</td><td class="p-2 font-bold text-emerald-700">~22%</td></tr>
            <tr class="border-b"><td class="p-2 font-medium">招商银行</td><td class="p-2">42%</td><td>0.035</td><td>13</td><td class="p-2 font-bold text-emerald-700">~15%</td></tr>
            <tr class="border-b"><td class="p-2 font-medium">沃尔玛</td><td class="p-2">2%</td><td>2.5</td><td>4</td><td class="p-2 font-bold text-emerald-700">~20%</td></tr>
          </table>
          <div class="mt-2 text-stone-500">试着调滑块匹配这些公司的数值，看 ROE 是否吻合。</div>
        </div>
      </div>
    `;
    const update = () => {
      const m = +el.querySelector('#dp-m').value;
      const t = +el.querySelector('#dp-t').value / 100;
      const l = +el.querySelector('#dp-l').value / 10;
      const roe = (m / 100) * t * l * 100;
      el.querySelector('#dp-m-val').textContent = m;
      el.querySelector('#dp-t-val').textContent = t.toFixed(2);
      el.querySelector('#dp-l-val').textContent = l.toFixed(1);
      el.querySelector('#dp-result').innerHTML = `
        <div class="p-4 bg-emerald-50 rounded mt-4">
          <div class="text-center">
            <div class="text-xs text-stone-500">ROE = ${m}% × ${t.toFixed(2)} × ${l.toFixed(1)}</div>
            <div class="text-3xl font-bold text-emerald-700 mt-1">${roe.toFixed(1)}%</div>
          </div>
          <div class="mt-3 flex gap-2 h-8 rounded overflow-hidden text-xs text-white font-semibold">
            <div class="bg-sky-500 flex items-center justify-center" style="width:${Math.min(m/60*100,100)}%">净利率</div>
            <div class="bg-violet-500 flex items-center justify-center" style="width:${Math.min(t/3*100,100)}%">周转</div>
            <div class="bg-amber-500 flex items-center justify-center" style="width:${Math.min(l/15*100,100)}%">杠杆</div>
          </div>
        </div>`;
    };
    ['dp-m','dp-t','dp-l'].forEach(id => el.querySelector('#'+id).oninput = update);
    update();
  },

  dcf(el) {
    el.innerHTML = `
      <div class="text-sm mb-3">用简化两阶段 DCF 为一家公司估值。</div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        <label class="text-sm">当前自由现金流 FCF（亿元）
          <input type="number" id="d-fcf" value="650" class="mt-1 w-full px-3 py-2 border rounded" /></label>
        <label class="text-sm">显性期增速 g1 %
          <input type="number" id="d-g1" value="8" step="0.5" class="mt-1 w-full px-3 py-2 border rounded" /></label>
        <label class="text-sm">显性期年数
          <input type="number" id="d-n" value="10" class="mt-1 w-full px-3 py-2 border rounded" /></label>
        <label class="text-sm">永续增速 g %
          <input type="number" id="d-g" value="3" step="0.5" class="mt-1 w-full px-3 py-2 border rounded" /></label>
        <label class="text-sm">折现率 r %
          <input type="number" id="d-r" value="9" step="0.5" class="mt-1 w-full px-3 py-2 border rounded" /></label>
        <label class="text-sm">当前市值（亿元，用于对比）
          <input type="number" id="d-mcap" value="21000" class="mt-1 w-full px-3 py-2 border rounded" /></label>
      </div>
      <button id="d-calc" class="px-4 py-2 bg-stone-900 text-white rounded text-sm">计算内在价值</button>
      <div id="d-result" class="mt-4"></div>
    `;
    const calc = () => {
      const fcf0 = +el.querySelector('#d-fcf').value;
      const g1 = +el.querySelector('#d-g1').value / 100;
      const n = +el.querySelector('#d-n').value;
      const g = +el.querySelector('#d-g').value / 100;
      const r = +el.querySelector('#d-r').value / 100;
      const mcap = +el.querySelector('#d-mcap').value;
      if (r <= g) {
        el.querySelector('#d-result').innerHTML = '<div class="p-3 bg-red-100 text-red-700 rounded text-sm">折现率必须大于永续增速，否则模型发散。</div>';
        return;
      }
      let pv = 0, fcf = fcf0;
      for (let t = 1; t <= n; t++) { fcf = fcf * (1 + g1); pv += fcf / Math.pow(1 + r, t); }
      const terminalFCF = fcf * (1 + g);
      const terminalValue = terminalFCF / (r - g);
      const terminalPV = terminalValue / Math.pow(1 + r, n);
      const intrinsic = pv + terminalPV;
      const safety = ((intrinsic - mcap) / mcap * 100);
      // sensitivity matrix
      const sens = [];
      for (let dr = -2; dr <= 2; dr++) {
        const row = [];
        for (let dg = -1; dg <= 1; dg++) {
          const rr = (r + dr/100), gg = (g + dg/100);
          if (rr <= gg) { row.push(null); continue; }
          let spv = 0, sf = fcf0;
          for (let t = 1; t <= n; t++) { sf = sf * (1 + g1); spv += sf / Math.pow(1 + rr, t); }
          const stv = sf * (1 + gg) / (rr - gg) / Math.pow(1 + rr, n);
          row.push(Math.round((spv + stv)));
        }
        sens.push({ rLabel: ((r+dr/100)*100).toFixed(0)+'%', vals: row });
      }
      el.querySelector('#d-result').innerHTML = `
        <div class="p-4 bg-emerald-50 rounded mb-3">
          <div>显性期 ${n} 年折现值：<b>${pv.toFixed(0)}</b> 亿</div>
          <div>永续期终值折现：<b>${terminalPV.toFixed(0)}</b> 亿（占 ${(terminalPV/intrinsic*100).toFixed(0)}%）</div>
          <div class="mt-2 text-lg">内在价值估算：<b class="text-emerald-700">${intrinsic.toFixed(0)}</b> 亿</div>
          <div class="mt-2">当前市值：<b>${mcap.toFixed(0)}</b> 亿</div>
          <div class="mt-1 ${safety > 0 ? 'text-emerald-700' : 'text-red-700'}">
            <b>${safety > 0 ? '低估' : '高估'} ${Math.abs(safety).toFixed(1)}%</b>
            ${safety > 30 ? '（有明显安全边际）' : safety > 0 ? '（价格接近价值）' : '（市场定价已透支）'}
          </div>
        </div>
        <div class="text-xs font-semibold mb-1">敏感性矩阵（单位：亿元）</div>
        <div class="text-xs text-stone-500 mb-1">行=折现率 r，列=永续增速 g</div>
        <table class="w-full border-collapse text-xs mb-2">
          <tr class="bg-stone-100"><th class="p-1">r \\ g</th>
            ${[-1,0,1].map(dg => `<th class="p-1">${((g+dg/100)*100).toFixed(1)}%</th>`).join('')}
          </tr>
          ${sens.map(row => `<tr class="border-b">
            <td class="p-1 font-mono">${row.rLabel}</td>
            ${row.vals.map(v => `<td class="p-1 text-center ${v && Math.abs(v-mcap)/mcap<0.1 ? 'bg-emerald-100 font-bold' : ''}">${v || '—'}</td>`).join('')}
          </tr>`).join('')}
        </table>
        <div class="text-xs text-stone-500">高亮格 = 最接近当前市值的参数组合 → 市场隐含的预期。</div>
      `;
    };
    el.querySelector('#d-calc').onclick = calc;
    calc();
  }
};

function drawLineChart(canvas, data, color) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...data);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * (w - 40) + 30;
    const y = h - 20 - v / max * (h - 40);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#78716c';
  ctx.font = '11px sans-serif';
  ctx.fillText(max.toLocaleString('zh-CN',{maximumFractionDigits:0}), 2, 15);
  ctx.fillText('0', 2, h - 5);
  ctx.fillText('Y0', 30, h - 2);
  ctx.fillText('Y' + (data.length - 1), w - 25, h - 2);
}
