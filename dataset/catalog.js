(function () {
  "use strict";

  const catalog = window.PUBLIC_GRID_ASSETS;
  if (!catalog) return;

  const inventoryRoot = document.getElementById("asset-inventory");
  const assetTotal = document.getElementById("asset-total");
  const stackRoot = document.getElementById("stack-flow");
  const tabsRoot = document.getElementById("source-tabs");
  const visualizerRoot = document.getElementById("source-visualizer");

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const formatNumber = (value, digits = 0) => new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
  }).format(value);

  function renderInventory() {
    const assets = catalog.inventory;
    const totalMb = assets.reduce((sum, asset) => sum + asset.size_bytes, 0) / 1024 / 1024;
    assetTotal.innerHTML = `<strong>${assets.length}</strong><span>项 / ${formatNumber(totalMb, 1)} MB</span>`;
    inventoryRoot.innerHTML = `
      <div class="asset-head">
        <span>类别与资产</span><span>本地内容</span><span>体量</span><span>Revision</span><span>位置</span>
      </div>
      ${assets.map((asset) => `
        <article class="asset-row">
          <div><i>第 ${asset.category} 类</i><a href="${escapeHtml(asset.remote)}" target="_blank" rel="noreferrer">${escapeHtml(asset.name)}</a></div>
          <p>${escapeHtml(asset.data_state)}</p>
          <div class="asset-volume"><strong>${formatNumber(asset.file_count)}</strong><span>文件</span><strong>${asset.data_files ? formatNumber(asset.data_files) : "代码"}</strong><span>${asset.data_files ? "数据文件" : "样例内嵌"}</span></div>
          <code>${escapeHtml(asset.commit)}</code>
          <div class="asset-path"><strong>${formatNumber(asset.size_mb, 1)} MB</strong><code>${escapeHtml(asset.local_path)}</code>${asset.data_local_path ? `<code>${escapeHtml(asset.data_local_path)}</code>` : ""}</div>
        </article>
      `).join("")}
    `;
  }

  function renderStack() {
    const stack = catalog.current_stack;
    const steps = [
      ["数据内核", stack.grid_kernel],
      ["建模层", stack.modeling],
      ["数值求解器", {
        name: stack.solver.name,
        version: `HiGHS.jl ${stack.solver.version} / native ${stack.solver.native_version}`,
      }],
      ["冲突后端", stack.conflict_backend],
      ["独立复验", { name: "PTDF / N-1 verifier", version: "项目自研" }],
    ];
    stackRoot.innerHTML = steps.map(([label, item], index) => `
      ${index ? '<span class="stack-arrow" aria-hidden="true">→</span>' : ""}
      <div class="stack-node"><span>${label}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.version || "版本未记录")}</small></div>
    `).join("");
  }

  const sources = [
    { id: "proopf", label: "ProOPF", format: "JSONL", hint: "语言 → 代码" },
    { id: "pglib", label: "PGLib-OPF", format: ".m", hint: "矩阵 → 网架" },
    { id: "rts", label: "RTS-GMLC", format: "CSV", hint: "表格 → 时序" },
    { id: "uc", label: "UnitCommitment", format: "JSON.GZ", hint: "约束 → 调度" },
  ];
  let activeSource = "proopf";
  let activeProopfLevel = 0;

  function renderTabs() {
    tabsRoot.innerHTML = sources.map((source) => `
      <button type="button" data-source="${source.id}" class="${source.id === activeSource ? "is-active" : ""}">
        <code>${source.format}</code><strong>${source.label}</strong><span>${source.hint}</span>
      </button>
    `).join("");
    tabsRoot.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        activeSource = button.dataset.source;
        renderTabs();
        renderSource();
      });
    });
  }

  function modificationLabel(item) {
    const location = item.bus_id != null
      ? `bus ${item.bus_id}`
      : item.fbus != null
        ? `branch ${item.fbus}–${item.tbus}`
        : item.component;
    return `${location} / ${item.target_parameter}: ${item.operation} ${item.value}`;
  }

  function keywordGuide(items) {
    return `
      <aside class="keyword-guide" aria-label="原始文件关键词解释">
        <header><span>原始文件怎么读</span><strong>关键词速查</strong></header>
        <div>${items.map((item) => `
          <dl>
            <dt><code>${escapeHtml(item.term)}</code></dt>
            <dd>${escapeHtml(item.meaning)}</dd>
          </dl>
        `).join("")}</div>
      </aside>
    `;
  }

  function renderProopf() {
    const data = catalog.samples.proopf;
    const sample = data.samples[activeProopfLevel];
    const spec = sample.model_specification;
    const result = sample.results || {};
    const maxCount = Math.max(...data.benchmark_counts);
    visualizerRoot.innerHTML = `
      <div class="lab-summary">
        <div><span>已下载 benchmark</span><strong>${data.benchmark_total}</strong><small>当前仓库实数</small></div>
        <div><span>few-shot</span><strong>${data.fewshot_total}</strong><small>每级 5 条</small></div>
        <div><span>底层系统</span><strong>${escapeHtml(spec.base_system)}</strong><small>MATPOWER case</small></div>
        <div><span>运行结果</span><strong>${result.converged === true ? "收敛" : "见原记录"}</strong><small>objective ${formatNumber(result.objective_value || 0, 2)}</small></div>
      </div>
      <div class="proopf-layout">
        <section class="proopf-levels">
          <header><span>基准难度分布</span><strong>选择评测样例</strong></header>
          ${data.benchmark_counts.map((count, index) => `
            <button type="button" data-level="${index}" class="${index === activeProopfLevel ? "is-active" : ""}">
              <span>L${index + 1}</span><i><b style="width:${(count / maxCount) * 100}%"></b></i><strong>${count}</strong>
            </button>
          `).join("")}
          <small>论文写 121 个专家测试例；当前公开仓库逐行统计为 124，页面保留这个版本差异。</small>
        </section>
        <section class="proopf-request">
          <span>自然语言请求</span>
          <blockquote>${escapeHtml(sample.natural_language)}</blockquote>
          <span>结构化修改</span>
          <ul>${(spec.parameter_modifications || []).map((item) => `<li>${escapeHtml(modificationLabel(item))}</li>`).join("") || "<li>本级为结构或目标函数修改，见原始记录</li>"}</ul>
        </section>
        <section class="code-pane">
          <header><span>模型生成结果</span><code>MATPOWER / MATLAB</code></header>
          <pre><code>${escapeHtml(sample.matpower_code.slice(0, 2200))}${sample.matpower_code.length > 2200 ? "\n% ... preview truncated" : ""}</code></pre>
        </section>
      </div>
      ${keywordGuide([
        { term: "natural_language", meaning: "用户用自然语言提出的电网模型修改要求。" },
        { term: "base_system / case39", meaning: "本次任务采用的基础电网算例；case39 表示 39 母线系统。" },
        { term: "PD / QD", meaning: "母线的有功负荷与无功负荷，可理解为用电需求及电压支撑相关需求。" },
        { term: "PMAX / VMIN", meaning: "发电机最大出力，以及母线允许的最低电压。" },
        { term: "BR_X", meaning: "输电线路的电抗参数，会影响电力在线路间如何分配。" },
        { term: "converged / objective", meaning: "求解是否成功收敛，以及最终成本等优化目标值。" },
      ])}
      <div class="lab-source">本地数据来源：<code>${escapeHtml(data.source_path)}</code></div>
    `;
    visualizerRoot.querySelectorAll("[data-level]").forEach((button) => {
      button.addEventListener("click", () => {
        activeProopfLevel = Number(button.dataset.level);
        renderProopf();
      });
    });
  }

  function canvasContext(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { context, width: rect.width, height: rect.height };
  }

  function drawPglib() {
    const canvas = document.getElementById("pglib-network");
    if (!canvas) return;
    const data = catalog.samples.pglib_opf;
    const { context, width, height } = canvasContext(canvas);
    const nodeMap = new Map(data.nodes.map((node) => [node.id, node]));
    const point = (node) => ({ x: 26 + node.x * (width - 52), y: 24 + node.y * (height - 48) });
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "rgba(69, 89, 80, .25)";
    context.lineWidth = 0.8;
    data.edges.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return;
      const a = point(source);
      const b = point(target);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    });
    data.nodes.forEach((node) => {
      const p = point(node);
      const hasGenerator = node.generator_count > 0;
      const radius = hasGenerator ? 4.2 : Math.max(1.8, Math.min(4, 1.8 + node.load_mw / 90));
      context.beginPath();
      context.arc(p.x, p.y, radius, 0, Math.PI * 2);
      context.fillStyle = hasGenerator ? "#b66a18" : node.load_mw > 0 ? "#356f9a" : "#aebbb4";
      context.fill();
      if (hasGenerator) {
        context.strokeStyle = "#fff";
        context.lineWidth = 1;
        context.stroke();
      }
    });
  }

  function renderPglib() {
    const data = catalog.samples.pglib_opf;
    visualizerRoot.innerHTML = `
      <div class="lab-summary">
        <div><span>母线</span><strong>${data.totals.buses}</strong><small>电网节点</small></div>
        <div><span>发电机</span><strong>${data.totals.generators}</strong><small>供电设备</small></div>
        <div><span>支路</span><strong>${data.totals.branches}</strong><small>线路 / 变压器</small></div>
        <div><span>总负荷</span><strong>${formatNumber(data.totals.load_mw, 0)}</strong><small>MW</small></div>
      </div>
      <div class="network-lab-grid">
        <section class="network-lab-panel">
          <header><div><span>case118 拓扑</span><strong>矩阵自动还原成网架</strong></div><div class="lab-legend"><span><i class="legend-gen"></i>有机组</span><span><i class="legend-load"></i>有负荷</span><span><i class="legend-bus"></i>普通母线</span></div></header>
          <canvas id="pglib-network" aria-label="PGLib OPF case118 网络拓扑"></canvas>
        </section>
        <section class="matrix-panel">
          <header><span>原始 .m 文件</span><strong>MATPOWER 矩阵片段</strong></header>
          <div><span>mpc.bus</span><pre>${escapeHtml(data.matrix_preview.bus.map((row) => row.slice(0, 9).join("  ")).join("\n"))}</pre></div>
          <div><span>mpc.gen</span><pre>${escapeHtml(data.matrix_preview.gen.map((row) => row.slice(0, 10).join("  ")).join("\n"))}</pre></div>
          <div><span>mpc.branch</span><pre>${escapeHtml(data.matrix_preview.branch.map((row) => row.slice(0, 7).join("  ")).join("\n"))}</pre></div>
        </section>
      </div>
      ${keywordGuide([
        { term: "mpc.bus", meaning: "母线表：每一行代表一个电网连接节点。" },
        { term: "mpc.gen", meaning: "发电机表：记录机组接在哪个母线、能发多少电。" },
        { term: "mpc.branch", meaning: "支路表：记录线路或变压器连接的两端及输电参数。" },
        { term: "PD / QD", meaning: "节点的有功与无功负荷；PD 最接近日常理解的用电功率。" },
        { term: "PMIN / PMAX", meaning: "发电机允许的最小与最大出力。" },
        { term: "F_BUS / T_BUS / RATE_A", meaning: "线路起点、终点和正常运行容量上限。" },
      ])}
      <div class="lab-source">本地数据来源：<code>${escapeHtml(data.source_path)}</code> <span>SHA-256 ${escapeHtml(data.source_sha256.slice(0, 16))}…</span></div>
    `;
    requestAnimationFrame(drawPglib);
  }

  function drawRts() {
    const canvas = document.getElementById("rts-series");
    if (!canvas) return;
    const series = catalog.samples.rts_gmlc.series;
    const { context, width, height } = canvasContext(canvas);
    const pad = { left: 48, right: 18, top: 22, bottom: 32 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    const maximum = Math.max(...series.load_mw, ...series.wind_mw, ...series.solar_mw) * 1.08;
    context.clearRect(0, 0, width, height);
    context.font = "10px Segoe UI";
    context.fillStyle = "#66736d";
    context.strokeStyle = "#d4dcd7";
    context.lineWidth = 1;
    for (let line = 0; line <= 4; line += 1) {
      const y = pad.top + chartHeight * line / 4;
      context.beginPath();
      context.moveTo(pad.left, y);
      context.lineTo(width - pad.right, y);
      context.stroke();
      const value = Math.round(maximum * (1 - line / 4));
      context.fillText(String(value), 4, y + 3);
    }
    [0, 6, 12, 18, 23].forEach((hour) => {
      const x = pad.left + chartWidth * hour / 23;
      context.fillText(`${hour}:00`, x - 12, height - 10);
    });
    const drawLine = (values, color) => {
      context.beginPath();
      values.forEach((value, index) => {
        const x = pad.left + chartWidth * index / 23;
        const y = pad.top + chartHeight * (1 - value / maximum);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.stroke();
    };
    drawLine(series.load_mw, "#17211e");
    drawLine(series.wind_mw, "#356f9a");
    drawLine(series.solar_mw, "#b66a18");
  }

  function csvPreview(rows) {
    if (!rows.length) return "";
    const fields = Object.keys(rows[0]);
    return `<table><thead><tr>${fields.map((field) => `<th>${escapeHtml(field)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${fields.map((field) => `<td>${escapeHtml(row[field])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function renderRts() {
    const data = catalog.samples.rts_gmlc;
    const series = data.series;
    const peakLoad = Math.max(...series.load_mw);
    const peakRenewables = Math.max(...series.wind_mw.map((value, index) => value + series.solar_mw[index]));
    visualizerRoot.innerHTML = `
      <div class="lab-summary">
        <div><span>日期</span><strong>${data.date}</strong><small>Day-ahead</small></div>
        <div><span>区域负荷列</span><strong>${data.columns.load}</strong><small>regional columns</small></div>
        <div><span>风 / 光列</span><strong>${data.columns.wind} / ${data.columns.solar}</strong><small>generator columns</small></div>
        <div><span>峰值负荷</span><strong>${formatNumber(peakLoad, 0)}</strong><small>MW</small></div>
      </div>
      <div class="timeseries-layout">
        <section class="timeseries-panel">
          <header><div><span>24 小时运行输入</span><strong>负荷、风电与光伏的差异化时序特征</strong></div><div class="series-legend"><span><i class="line-load"></i>负荷</span><span><i class="line-wind"></i>风电</span><span><i class="line-solar"></i>光伏</span></div></header>
          <canvas id="rts-series" aria-label="RTS-GMLC 负荷风电光伏时序曲线"></canvas>
          <p>当天最大“风电 + 光伏”为 <strong>${formatNumber(peakRenewables, 0)} MW</strong>。这些曲线会被转换成每小时的 UC / SCUC 输入。</p>
        </section>
        <section class="csv-panel">
          <header><span>原始 CSV</span><strong>区域负荷前 4 行</strong></header>
          <div class="csv-scroll">${csvPreview(data.preview.load)}</div>
          <small>RTS-GMLC 采用多表关系结构，按负荷、风电、光伏与机组等主题分别组织 CSV 文件。</small>
        </section>
      </div>
      ${keywordGuide([
        { term: "Year / Month / Day", meaning: "这一行数据对应的自然日期。" },
        { term: "Period", meaning: "一天中的时间段；当前样例 1–24 分别对应 24 个小时。" },
        { term: "1 / 2 / 3", meaning: "三个区域的编号；单元格数值是该区域在该时段的负荷 MW。" },
        { term: "309_WIND_1", meaning: "母线 309 上第 1 台风电机组，该列记录逐时风电出力。" },
        { term: "320_PV_1", meaning: "母线 320 上第 1 套光伏设备，该列记录逐时光伏出力。" },
        { term: "MW", meaning: "功率单位，表示该时刻发电、用电或备用能力的大小。" },
      ])}
      <div class="lab-source">本地数据来源：<code>${escapeHtml(data.source_path)}</code></div>
    `;
    requestAnimationFrame(drawRts);
  }

  function renderUc() {
    const data = catalog.samples.unitcommitment;
    visualizerRoot.innerHTML = `
      <div class="lab-summary">
        <div><span>母线</span><strong>${data.totals.buses}</strong><small>网络节点</small></div>
        <div><span>机组</span><strong>${data.totals.generators}</strong><small>可启停资源</small></div>
        <div><span>线路</span><strong>${data.totals.lines}</strong><small>传输约束</small></div>
        <div><span>N-1 故障</span><strong>${data.totals.contingencies}</strong><small>单元件失效场景</small></div>
      </div>
      <div class="uc-lab-grid">
        <section class="uc-structure">
          <header><span>压缩 JSON.GZ</span><strong>${escapeHtml(data.case)}</strong></header>
          <div class="field-cloud">${data.top_level_fields.map((field) => `<span>${escapeHtml(field)}</span>`).join("")}</div>
          <p>同一个文件把静态网架和逐时调度约束放在一起，适合求解 UC / SCUC，也适合为每条约束生成语义 ID。</p>
          <ol class="uc-process">
            <li><b>1</b><span><strong>读取数据</strong><small>网架、机组、负荷、备用、故障</small></span></li>
            <li><b>2</b><span><strong>构造数学模型</strong><small>JuMP 把字段变成变量与约束</small></span></li>
            <li><b>3</b><span><strong>求解或找冲突</strong><small>HiGHS 判断可行性，MathOptIIS 提取冲突</small></span></li>
            <li><b>4</b><span><strong>独立复验</strong><small>项目 verifier 重算线路与 N-1 安全</small></span></li>
          </ol>
          <a href="#uc-detail">展开 UC/SCUC 字段与约束映射</a>
        </section>
        <section class="contingency-panel">
          <header><span>N-1 故障样例</span><strong>单元件退出场景的数据表示</strong></header>
          <pre><code>${escapeHtml(JSON.stringify(data.contingency_preview, null, 2))}</code></pre>
          <p><code>Affected lines: ["l2"]</code> 的意思是：在该故障场景中，线路 l2 被切除，求解器还要验证剩余网络能否安全运行。</p>
        </section>
      </div>
      ${keywordGuide([
        { term: "JSON.GZ", meaning: "经过 Gzip 压缩的 JSON 文本文件，解压后可以直接查看字段和值。" },
        { term: "Generators / Buses", meaning: "发电机及母线节点，分别描述供电能力和各处用电需求。" },
        { term: "Transmission lines", meaning: "输电线路，包含连接关系、输电参数和容量上限。" },
        { term: "Reserves", meaning: "为突发负荷或设备故障预留、暂时不使用的发电能力。" },
        { term: "Contingencies", meaning: "预先设定的设备故障场景，用来检查 N-1 安全。" },
        { term: "c2 / l2 / Affected lines", meaning: "c2 是故障场景编号，l2 是线路编号；Affected lines 列出该场景中退出运行的线路。" },
      ])}
      <div class="lab-source">本地数据来源：<code>${escapeHtml(data.source_path)}</code> <span>SHA-256 ${escapeHtml(data.source_sha256.slice(0, 16))}…</span></div>
    `;
  }

  function renderSource() {
    const detail = document.getElementById("uc-detail");
    if (detail) detail.hidden = activeSource !== "uc";
    if (activeSource === "proopf") renderProopf();
    if (activeSource === "pglib") renderPglib();
    if (activeSource === "rts") renderRts();
    if (activeSource === "uc") renderUc();
  }

  let activeVizMode = "llm";
  let llmRunLevel = 0;
  let llmRunStage = 0;
  let llmRunPlaying = true;

  function llmStageContent(sample, stage) {
    const specification = sample.model_specification;
    const result = sample.results || {};
    if (stage === 0) {
      return {
        eyebrow: "输入 / Natural language",
        title: "研究人员提出模型修改要求",
        body: `<blockquote>${escapeHtml(sample.natural_language)}</blockquote>`,
      };
    }
    if (stage === 1) {
      const modifications = specification.parameter_modifications || [];
      return {
        eyebrow: "LLM / Structured intent",
        title: `把语言拆成 ${modifications.length || 1} 个可执行修改`,
        body: `<ul class="flow-modifications">${modifications.map((item) => `<li>${escapeHtml(modificationLabel(item))}</li>`).join("") || "<li>结构、约束或目标函数修改</li>"}</ul>`,
      };
    }
    if (stage === 2) {
      return {
        eyebrow: "代码 / Solver-ready model",
        title: "生成 MATPOWER 可以执行的模型代码",
        body: `<pre><code>${escapeHtml(sample.matpower_code.slice(0, 1200))}${sample.matpower_code.length > 1200 ? "\n% ... preview truncated" : ""}</code></pre>`,
      };
    }
    return {
      eyebrow: "验证 / Solver feedback",
      title: result.converged === true ? "MATPOWER 返回收敛结果" : "读取原始运行反馈",
      body: `<div class="solver-verdict"><strong>${result.converged === true ? "✓ 可执行并收敛" : "查看记录"}</strong><dl><div><dt>Objective</dt><dd>${formatNumber(result.objective_value || 0, 3)}</dd></div><div><dt>Runtime</dt><dd>${formatNumber(result.execution_time || 0, 3)} s</dd></div><div><dt>Error</dt><dd>${escapeHtml(result.error_message || "None")}</dd></div></dl><p>求解收敛仅表明生成代码具备可执行性；模型是否完整表达原始需求，仍需通过隐藏反事实测试与电力物理检查器验证。</p></div>`,
    };
  }

  function renderLlmRunner() {
    const root = document.getElementById("llmopt-runner");
    if (!root) return;
    const data = catalog.samples.proopf;
    const sample = data.samples[llmRunLevel];
    const content = llmStageContent(sample, llmRunStage);
    const stages = [
      ["1", "自然语言", "研究需求"],
      ["2", "LLM 解析", "结构化修改"],
      ["3", "生成模型", "MATPOWER 代码"],
      ["4", "求解器复验", "收敛与目标值"],
    ];
    root.innerHTML = `
      <header class="llm-runner-header">
        <div><span>公开基准轨迹</span><strong>ProOPF-B / Level ${llmRunLevel + 1}</strong><small>基于已下载 benchmark 展示输入需求、模型代码与求解结果，不触发在线 LLM 调用。</small></div>
        <div class="llm-runner-controls">
          <div class="level-switch" aria-label="选择 ProOPF 难度">${data.samples.map((_, index) => `<button type="button" data-run-level="${index}" class="${index === llmRunLevel ? "is-active" : ""}">L${index + 1}</button>`).join("")}</div>
          <button class="flow-play" type="button" data-flow-play aria-label="${llmRunPlaying ? "暂停回放" : "继续回放"}"><span>${llmRunPlaying ? "Ⅱ" : "▶"}</span><strong>${llmRunPlaying ? "暂停" : "播放"}</strong></button>
        </div>
      </header>
      <div class="llm-pipeline">${stages.map((stage, index) => `
        ${index ? '<i aria-hidden="true">→</i>' : ""}
        <button type="button" data-run-stage="${index}" class="${index === llmRunStage ? "is-active" : ""} ${index < llmRunStage ? "is-complete" : ""}">
          <b>${stage[0]}</b><span><strong>${stage[1]}</strong><small>${stage[2]}</small></span>
        </button>
      `).join("")}</div>
      <div class="llm-flow-focus">
        <section>
          <span>${content.eyebrow}</span>
          <h3>${content.title}</h3>
          ${content.body}
        </section>
        <aside>
          <span>阶段性验证问题</span>
          <strong>${["自然语言需求指向何种电网模型变更？", "语言需求能否稳定映射为结构化操作？", "结构化操作能否生成求解器可执行代码？", "求解结果能否通过可执行性与语义一致性验证？"][llmRunStage]}</strong>
          <div class="flow-progress"><i style="width:${(llmRunStage + 1) * 25}%"></i></div>
          <small>步骤 ${llmRunStage + 1} / 4</small>
        </aside>
      </div>
    `;
    root.querySelectorAll("[data-run-level]").forEach((button) => button.addEventListener("click", () => {
      llmRunLevel = Number(button.dataset.runLevel);
      llmRunStage = 0;
      renderLlmRunner();
    }));
    root.querySelectorAll("[data-run-stage]").forEach((button) => button.addEventListener("click", () => {
      llmRunStage = Number(button.dataset.runStage);
      renderLlmRunner();
    }));
    root.querySelector("[data-flow-play]").addEventListener("click", () => {
      llmRunPlaying = !llmRunPlaying;
      renderLlmRunner();
    });
  }

  function setVizMode(mode) {
    activeVizMode = mode;
    document.querySelectorAll("[data-viz-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.vizMode === mode);
    });
    const llmRunner = document.getElementById("llmopt-runner");
    const ucRunner = document.getElementById("uc-runner");
    const ucSwitch = document.getElementById("uc-runner-switch");
    if (llmRunner) llmRunner.hidden = mode !== "llm";
    if (ucRunner) ucRunner.hidden = mode !== "uc";
    if (ucSwitch) ucSwitch.hidden = mode !== "uc";
    if (mode === "uc") {
      window.setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    }
  }

  function initializeProcessVisualization() {
    renderLlmRunner();
    document.querySelectorAll("[data-viz-mode]").forEach((button) => {
      button.addEventListener("click", () => setVizMode(button.dataset.vizMode));
    });
    setVizMode("llm");
    window.setInterval(() => {
      if (activeVizMode === "llm" && llmRunPlaying && !document.hidden) {
        llmRunStage = (llmRunStage + 1) % 4;
        renderLlmRunner();
      }
    }, 1800);
  }

  renderInventory();
  renderStack();
  renderTabs();
  renderSource();
  initializeProcessVisualization();

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (activeSource === "pglib") drawPglib();
      if (activeSource === "rts") drawRts();
    }, 120);
  });
}());
