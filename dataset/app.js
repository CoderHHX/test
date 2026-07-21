(function () {
  "use strict";

  const guide = window.GRID_DATASET_GUIDE;
  if (!guide) {
    document.body.innerHTML = "<main style='padding:32px;font-family:sans-serif'>数据文件未生成，请先运行 scripts/build_dataset_guide.py。</main>";
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
  const state = {
    datasetId: guide.datasets[0].id,
    fieldKey: "Buses",
    hour: 0,
    playing: true,
  };

  function dataset() {
    return guide.datasets.find((item) => item.id === state.datasetId);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderDatasetCards() {
    const grid = $("#dataset-grid");
    if (!grid) return;
    grid.innerHTML = guide.datasets.map((item) => `
      <article class="dataset-card${item.id === state.datasetId ? " is-selected" : ""}" style="--dataset-color:${item.color}">
        <div class="dataset-main">
          <div class="dataset-name"><h2>${escapeHtml(item.name)}</h2><span>${escapeHtml(item.chinese_name)}</span></div>
          <p class="dataset-full-name">${escapeHtml(item.full_name)}</p>
          <p class="dataset-origin">${escapeHtml(item.origin)}</p>
        </div>
        <div class="dataset-facts">
          <div><span>当前接入</span><strong>${item.systems}套网架</strong></div>
          <div><span>数据格式</span><strong>${escapeHtml(item.format_note)}</strong></div>
        </div>
        <div class="task-block"><span>主要任务</span><strong>${escapeHtml(item.task)}</strong></div>
        <div class="paper-block">
          <div>
            <span>${escapeHtml(item.paper.paper_role)}</span>
            <a href="${item.paper.url}" target="_blank" rel="noreferrer">${escapeHtml(item.paper.title)}</a>
            <small class="paper-meta">${escapeHtml(item.paper.venue)} · ${item.paper.year}</small>
          </div>
          <a class="citation-count" href="${item.paper.citation_url}" target="_blank" rel="noreferrer" title="在 OpenAlex 查看">
            <strong>${integer.format(item.paper.citations)}</strong><small>OpenAlex引用</small>
          </a>
        </div>
        <div class="card-actions">
          <a class="source-link" href="${item.source_url}" target="_blank" rel="noreferrer">出处：${escapeHtml(item.source_label)}</a>
          <button class="select-button" type="button" data-select-dataset="${item.id}">${item.id === state.datasetId ? "当前数据" : "查看JSON和样例"}</button>
        </div>
      </article>`).join("");
    $$('[data-select-dataset]', grid).forEach((button) => button.addEventListener("click", () => {
      selectDataset(button.dataset.selectDataset);
      $(".source-lab-section").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    const citationNote = $("#citation-note");
    if (citationNote) citationNote.textContent = `引用量采用 ${guide.citation_source}`;
  }

  function renderDatasetSwitches() {
    $$('[data-dataset-switch]').forEach((container) => {
      container.innerHTML = guide.datasets.map((item) => `
        <button type="button" data-switch-dataset="${item.id}" class="${item.id === state.datasetId ? "is-active" : ""}">${escapeHtml(item.name)}</button>`).join("");
      $$('[data-switch-dataset]', container).forEach((button) => button.addEventListener("click", () => selectDataset(button.dataset.switchDataset)));
    });
  }

  function renderFormat() {
    const sections = dataset().example.format_sections;
    if (!sections.some((section) => section.key === state.fieldKey)) state.fieldKey = sections[0].key;
    $("#field-list").innerHTML = sections.map((section) => `
      <button type="button" data-field="${escapeHtml(section.key)}" class="${section.key === state.fieldKey ? "is-active" : ""}">${escapeHtml(section.key)}</button>`).join("");
    $$('[data-field]', $("#field-list")).forEach((button) => button.addEventListener("click", () => {
      state.fieldKey = button.dataset.field;
      renderFormat();
    }));
    const section = sections.find((item) => item.key === state.fieldKey);
    $("#field-key").textContent = section.key;
    $("#field-label").textContent = section.label;
    $("#field-description").textContent = section.description;
    const guideText = explainSection(section);
    $("#plain-summary").textContent = guideText.summary;
    $("#plain-points").innerHTML = guideText.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
    $("#json-preview").textContent = typeof section.example === "string"
      ? section.example
      : JSON.stringify(section.example, null, 2);
  }

  function firstEntry(value) {
    return Object.entries(value)[0];
  }

  function explainSection(section) {
    if (section.key === "Parameters") {
      const hours = section.example["Time horizon (h)"] ?? section.example["Time (h)"];
      return {
        summary: `这组参数说明该实例要连续安排${hours}小时的电力运行。`,
        points: [
          `Version：JSON数据规范的版本号。`,
          `Time：一次优化覆盖${hours}个小时。`,
          `Power balance penalty：每缺少1 MW供电时施加的高额惩罚。`,
        ],
      };
    }
    if (section.key === "Buses") {
      const [id, bus] = firstEntry(section.example);
      const loads = Array.isArray(bus["Load (MW)"]) ? bus["Load (MW)"] : [bus["Load (MW)"]];
      return {
        summary: `${id}是一座母线；第1小时的用电需求是${number.format(loads[0])} MW。`,
        points: [
          `${id}：母线的唯一编号，可以理解为电网中的一个连接点。`,
          `Load (MW)：该母线每小时需要多少电。`,
          `数组第1、2、3个数字分别对应第1、2、3小时。`,
        ],
      };
    }
    if (section.key === "Generators") {
      const [id, generator] = firstEntry(section.example);
      const output = generator["Production cost curve (MW)"];
      const flattened = output.flat ? output.flat(Infinity).filter((value) => typeof value === "number") : [];
      const maximum = flattened.length ? Math.max(...flattened) : 0;
      return {
        summary: `${id}是接在${generator.Bus}上的发电机组，样例中的最大出力约为${number.format(maximum)} MW。`,
        points: [
          `Production cost curve：发多少电以及对应成本。`,
          `Ramp up / down limit：一小时内最多能增加或降低多少出力。`,
          `Initial status / power：开始计算前机组是否开机、正在发多少电。`,
        ],
      };
    }
    if (section.key === "Transmission lines") {
      const [id, line] = firstEntry(section.example);
      return {
        summary: `${id}连接${line["Source bus"]}和${line["Target bus"]}，正常情况下最多传输${number.format(line["Normal flow limit (MW)"])} MW。`,
        points: [
          `Source bus / Target bus：线路连接的两个母线。`,
          `Normal flow limit：日常运行时的容量上限。`,
          `Emergency flow limit：故障等紧急情况下允许的短时上限。`,
        ],
      };
    }
    if (section.key === "Contingencies") {
      const [id, contingency] = firstEntry(section.example);
      const affected = contingency["Affected lines"].join("、");
      return {
        summary: `${id}是一个假设故障场景：让线路${affected}退出运行，再检查剩余电网是否仍然安全。`,
        points: [
          `${id}：故障场景编号，本身没有物理含义。`,
          `Affected lines：在这个场景中被假设停运的线路清单。`,
          `${affected}：线路ID，可以回到“Transmission lines”中查它连接哪里。`,
        ],
      };
    }
    if (section.key === "Reserves") {
      const [id, reserve] = firstEntry(section.example);
      const amounts = Array.isArray(reserve["Amount (MW)"]) ? reserve["Amount (MW)"] : [reserve["Amount (MW)"]];
      return {
        summary: `${id}要求第1小时额外保留${number.format(amounts[0])} MW的${reserve.Type || "运行"}备用。`,
        points: [
          `${id}：备用产品编号。`,
          `Type：备用类型；Spinning表示已经在线、可快速增加出力的旋转备用。`,
          `Amount (MW)：每小时必须留出的备用容量。`,
        ],
      };
    }
    return {
      summary: "这段文字记录数据从哪里来、应引用哪些论文，便于复现和审计。",
      points: [
        "SOURCE不是电网约束，不参与优化计算。",
        "论文、项目和访问地址用于说明数据血统。",
        "发表研究时应同时引用数据来源和使用的工具。",
      ],
    };
  }

  function selectDataset(id) {
    if (!guide.datasets.some((item) => item.id === id)) return;
    state.datasetId = id;
    state.fieldKey = "Buses";
    state.hour = 0;
    renderDatasetCards();
    renderDatasetSwitches();
    renderFormat();
    renderRunner();
  }

  function renderRunner() {
    const item = dataset();
    const example = item.example;
    const totals = example.totals;
    $("#runner-dataset").textContent = `${item.name} · ${item.chinese_name}`;
    $("#runner-example").textContent = item.representative;
    $("#hour-slider").max = String(example.horizon - 1);
    $("#hour-slider").value = String(state.hour);
    $("#horizon-label").textContent = `${example.horizon}小时`;
    $("#system-counts").innerHTML = `
      <div><span>完整系统母线</span><strong>${integer.format(totals.buses)}</strong></div>
      <div><span>机组</span><strong>${integer.format(totals.generators)}</strong></div>
      <div><span>线路</span><strong>${integer.format(totals.lines)}</strong></div>
      <div><span>N-1场景</span><strong>${integer.format(totals.contingencies)}</strong></div>`;
    const sample = example.network_sample;
    $("#network-note").textContent = sample.is_full_network
      ? `图中显示完整网络：${sample.node_count}个母线、${sample.edge_count}条线路。节点颜色随该小时的负荷输入变化。`
      : `完整系统较大；为保证清晰，图中抽取${sample.node_count}个相连母线的局部。右侧数字仍来自完整系统。`;
    updateHour();
  }

  function setHour(hour) {
    const length = dataset().example.horizon;
    state.hour = ((hour % length) + length) % length;
    updateHour();
  }

  function updateHour() {
    const example = dataset().example;
    const hour = Math.min(state.hour, example.horizon - 1);
    state.hour = hour;
    $("#hour-label").textContent = `第 ${hour + 1} 小时`;
    $("#hour-slider").value = String(hour);
    $("#metric-load").textContent = `${number.format(example.time_series.load_mw[hour])} MW`;
    $("#metric-reserve").textContent = `${number.format(example.time_series.reserve_mw[hour])} MW`;
    $("#metric-capacity").textContent = `${number.format(example.totals.generation_capacity_mw)} MW`;
    drawNetwork();
    drawLoadChart();
  }

  function canvasContext(canvas) {
    const rectangle = canvas.getBoundingClientRect();
    const width = Math.max(280, rectangle.width);
    const height = Math.max(180, rectangle.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    return { context, width, height };
  }

  function drawNetwork() {
    const canvas = $("#network-canvas");
    if (!canvas || canvas.clientWidth === 0) return;
    const item = dataset();
    const sample = item.example.network_sample;
    const { context, width, height } = canvasContext(canvas);
    const padding = 18;
    const coordinates = new Map(sample.nodes.map((node) => [node.id, {
      x: padding + node.x * (width - padding * 2),
      y: padding + node.y * (height - padding * 2),
    }]));

    context.fillStyle = "#fbfcfb";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#d4dcd7";
    context.lineWidth = 0.8;
    context.globalAlpha = 0.8;
    for (const edge of sample.edges) {
      const source = coordinates.get(edge.source);
      const target = coordinates.get(edge.target);
      if (!source || !target) continue;
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
      context.stroke();
    }
    context.globalAlpha = 1;

    const currentLoads = sample.nodes.map((node) => node.load[state.hour] || 0);
    const maxLoad = Math.max(...currentLoads, 1);
    for (const node of sample.nodes) {
      const point = coordinates.get(node.id);
      const load = node.load[state.hour] || 0;
      const intensity = Math.sqrt(load / maxLoad);
      const radius = 2.2 + intensity * 5.2 + (node.generator_count > 0 ? 1.2 : 0);
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fillStyle = load > 0
        ? `rgba(182, 106, 24, ${0.30 + intensity * 0.68})`
        : "#d2dad5";
      context.fill();
      if (node.generator_count > 0) {
        context.strokeStyle = item.color;
        context.lineWidth = 1.8;
        context.stroke();
      } else {
        context.strokeStyle = "#ffffff";
        context.lineWidth = 0.8;
        context.stroke();
      }
    }
  }

  function drawLoadChart() {
    const canvas = $("#load-chart");
    if (!canvas || canvas.clientWidth === 0) return;
    const item = dataset();
    const values = item.example.time_series.load_mw;
    const { context, width, height } = canvasContext(canvas);
    const margin = { left: 52, right: 14, top: 14, bottom: 28 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const minimum = Math.min(...values) * 0.92;
    const maximum = Math.max(...values) * 1.05;
    const span = Math.max(maximum - minimum, 1);
    const x = (index) => margin.left + index / Math.max(values.length - 1, 1) * plotWidth;
    const y = (value) => margin.top + (maximum - value) / span * plotHeight;

    context.fillStyle = "#fbfcfb";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#d9e0dc";
    context.fillStyle = "#718078";
    context.font = '9px "Segoe UI", "Microsoft YaHei UI", sans-serif';
    context.textAlign = "right";
    for (let step = 0; step <= 3; step += 1) {
      const value = minimum + span * step / 3;
      const lineY = y(value);
      context.beginPath(); context.moveTo(margin.left, lineY); context.lineTo(width - margin.right, lineY); context.stroke();
      context.fillText(integer.format(value), margin.left - 7, lineY + 3);
    }

    context.beginPath();
    context.moveTo(x(0), y(values[0]));
    values.forEach((value, index) => context.lineTo(x(index), y(value)));
    context.lineTo(x(values.length - 1), margin.top + plotHeight);
    context.lineTo(x(0), margin.top + plotHeight);
    context.closePath();
    context.fillStyle = `${item.color}18`;
    context.fill();

    context.beginPath();
    values.forEach((value, index) => {
      if (index === 0) context.moveTo(x(index), y(value));
      else context.lineTo(x(index), y(value));
    });
    context.strokeStyle = item.color;
    context.lineWidth = 2;
    context.stroke();

    const cursorX = x(state.hour);
    const cursorY = y(values[state.hour]);
    context.beginPath(); context.moveTo(cursorX, margin.top); context.lineTo(cursorX, margin.top + plotHeight);
    context.strokeStyle = "#17211e"; context.lineWidth = 1; context.stroke();
    context.beginPath(); context.arc(cursorX, cursorY, 4.5, 0, Math.PI * 2);
    context.fillStyle = "#ffffff"; context.fill();
    context.strokeStyle = item.color; context.lineWidth = 2.5; context.stroke();

    context.fillStyle = "#718078";
    context.textAlign = "center";
    const ticks = [0, Math.floor((values.length - 1) / 2), values.length - 1];
    ticks.forEach((tick) => context.fillText(`${tick + 1}h`, x(tick), height - 8));
  }

  function togglePlayback() {
    state.playing = !state.playing;
    const button = $("#play-button");
    $("span", button).textContent = state.playing ? "Ⅱ" : "▶";
    $("strong", button).textContent = state.playing ? "暂停" : "播放";
    button.setAttribute("aria-label", state.playing ? "暂停播放" : "开始播放");
  }

  function initialize() {
    renderDatasetCards();
    renderDatasetSwitches();
    renderFormat();
    renderRunner();
    $("#play-button").addEventListener("click", togglePlayback);
    $("#hour-slider").addEventListener("input", (event) => {
      state.hour = Number(event.target.value);
      updateHour();
    });
    window.addEventListener("resize", () => {
      drawNetwork();
      drawLoadChart();
    });
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        drawNetwork();
        drawLoadChart();
      });
      observer.observe($("#network-canvas"));
      observer.observe($("#load-chart"));
    }
    window.setInterval(() => {
      if (state.playing && !document.hidden) setHour(state.hour + 1);
    }, 900);
  }

  initialize();
})();
