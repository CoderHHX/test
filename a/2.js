(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const navToggle = $("[data-nav-toggle]");
  const nav = $("[data-nav]");
  const backTop = $("[data-back-top]");

  function closeNavigation() {
    if (!navToggle || !nav) return;
    navToggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("open");
    document.body.classList.remove("nav-open");
  }

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("open", !open);
      document.body.classList.toggle("nav-open", !open);
    });
    $$('a[href^="#"]', nav).forEach((link) => link.addEventListener("click", closeNavigation));
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeNavigation();
    });
  }

  if (backTop) {
    window.addEventListener("scroll", () => {
      backTop.classList.toggle("visible", window.scrollY > 700);
    }, { passive: true });
    backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  const observedSections = ["start", "map", "frontier", "grid", "directions", "library"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navLinks = $$('[data-nav] a[href^="#"]');
  if ("IntersectionObserver" in window && observedSections.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        const active = link.getAttribute("href") === `#${visible.target.id}`;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-20% 0px -66% 0px", threshold: [0, 0.1, 0.3] });
    observedSections.forEach((section) => sectionObserver.observe(section));
  }

  $$('[data-tabs]').forEach((tabsRoot) => {
    const tabs = $$('[role="tab"]', tabsRoot);
    const panels = $$('[role="tabpanel"]', tabsRoot);
    function activateTab(tab, focus = false) {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel) => {
        panel.hidden = panel.id !== tab.getAttribute("aria-controls");
      });
      if (focus) tab.focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        activateTab(tabs[next], true);
      });
    });
  });

  const papers = Array.isArray(window.PAPER_DATA) ? window.PAPER_DATA : [];
  const libraryForm = $("[data-library-form]");
  const paperGrid = $("[data-paper-grid]");
  const resultCount = $("[data-result-count]");
  const loadMore = $("[data-load-more]");
  if (!libraryForm || !paperGrid) return;

  const searchInput = $("[data-paper-search]", libraryForm);
  const sortSelect = $("[data-sort]", libraryForm);
  const filterSelects = Object.fromEntries(
    $$('[data-filter]', libraryForm).map((select) => [select.dataset.filter, select])
  );
  const presetButtons = $$('[data-preset]', libraryForm);
  const PAGE_SIZE = 12;
  let visibleCount = PAGE_SIZE;
  let activePreset = "";

  const trackOrder = [
    "学习增强精确求解器",
    "LLM 建模与智能体",
    "神经/生成式组合优化",
    "可微优化与 DFL",
    "L2O/学习型数值算法",
    "LLM 算法发现",
    "GPU/开放求解底座",
    "电网专项",
    "基准与理论",
    "其他",
  ];

  const trackSelect = filterSelects.track;
  if (trackSelect) {
    const available = new Set(papers.map((paper) => paper.track));
    trackOrder.filter((track) => available.has(track)).forEach((track) => {
      const option = document.createElement("option");
      option.value = track;
      option.textContent = track;
      trackSelect.append(option);
    });
  }

  const specificSummaries = [
    ["lista", "把经典稀疏编码迭代展开成固定深度网络，是“把算法变成可训练模型”的早期代表。"],
    ["pointer networks", "让神经网络能输出随输入长度变化的排列，为神经组合优化建立了基本输出方式。"],
    ["learning to branch in mixed", "最早系统展示用机器学习模仿强分支决策，为 learned branching 奠定方向。"],
    ["exact combinatorial optimization with graph", "把 MILP 表示成变量—约束二部图，用 GNN 学习分支变量选择。"],
    ["hybrid models for learning to branch", "把昂贵 GNN 与低开销模型结合，直接回应生产环境的推理成本问题。"],
    ["optnet", "把二次规划作为神经网络层，使模型能通过优化问题反向传播。"],
    ["differentiable convex optimization layers", "把一类参数化凸优化问题统一做成可微层，是 CVXPYlayers 的核心基础。"],
    ["smart predict, then optimize", "训练预测模型时直接考虑最终决策损失，而不是只追求预测误差最小。"],
    ["dc3", "通过 completion 与 correction 让神经代理更好地满足硬约束，并在 ACOPF 等任务验证。"],
    ["difusco", "用 diffusion 生成组合优化解的结构或热图，是生成式 CO 的代表工作。"],
    ["funsearch", "让 LLM 生成可执行程序并由 evaluator 筛选，展示了算法发现的新范式。"],
    ["evolution of heuristics", "用 LLM 演化启发式算法，为自动算法设计提供通用框架。"],
    ["reevo", "在 LLM 演化搜索中加入反思机制，但仍需防止对有限 benchmark 过拟合。"],
    ["orlm", "面向运筹建模训练专用语言模型，是 OR foundation model 的代表链条。"],
    ["optimus", "自动把自然语言需求转成优化模型并迭代修正，是建模智能体的代表。"],
    ["sirl", "把 solver 的语法、可行性和目标反馈变成强化学习奖励，训练 OR 推理模型。"],
    ["fmip", "联合生成连续和整数变量的 MILP warm start，再交给求解器修复和认证。"],
    ["llm4branch", "让 LLM 生成轻量、可执行的 branching 代码骨架，避免每个节点调用大模型。"],
    ["pglearn", "为 OPF 学习提供标准数据生成、残差、修复和模型接口，是电网研究的重要底座。"],
    ["rapid concurrent gpu-cpu", "并行运行 CPU/GPU UC 求解器，实证 presolve 配置会改变赢家。"],
    ["unitcommitment.jl", "成熟开放的机组组合模型与独立 checker，适合建立可信 SCUC 基线。"],
    ["powermodels", "统一表达多种 OPF 与凸松弛，配合 PGLib 构成最常用的开放电网基座之一。"],
    ["grid2op", "模拟连续运行、故障和拓扑控制，用于检验静态优化方案在闭环中的安全表现。"],
  ];

  const trackSummaries = {
    "学习增强精确求解器": "让 AI 帮助传统求解器做局部决策，同时尽量保留精确求解与安全回退。",
    "LLM 建模与智能体": "把自然语言需求变成优化模型、代码或审计过程，重点风险是语义是否真的正确。",
    "LLM 算法发现": "让语言模型生成和改进可执行算法，再用 evaluator 进行筛选与演化。",
    "神经/生成式组合优化": "直接构造一个或多个候选解，适合窄任务和批量推理，但通常需要修复或认证。",
    "可微优化与 DFL": "把优化问题放入训练闭环，让模型按最终决策质量而不是单纯预测误差学习。",
    "L2O/学习型数值算法": "学习迭代更新、初始化或预条件器，为重复出现的一族数值问题加速。",
    "GPU/开放求解底座": "提供批量或大规模数值求解能力，是 AI-in-the-loop 实验的重要计算底座。",
    "电网专项": "直接面向 OPF、SCUC、数据生成、warm start 或闭环电网运行。",
    "基准与理论": "提供评测协议、理论界或可复现实验底座，帮助判断方法是否真的可靠。",
    "其他": "与 AI-Native 优化系统相关的基础工作或研究资产。",
  };

  const openSourceLabels = {
    licensed: "许可证明确",
    research: "研究资产需核查",
    unclear: "许可证不清",
    closed: "闭源或无实现",
  };

  const statusLabels = {
    published: "已发表/明确接收",
    preprint: "预印本/Workshop",
    artifact: "软件/基准项目",
  };

  function beginnerSummary(paper) {
    const title = paper.title.toLowerCase();
    const specific = specificSummaries.find(([fragment]) => title.includes(fragment));
    return specific ? specific[1] : (trackSummaries[paper.track] || trackSummaries.其他);
  }

  function safeUrl(value) {
    try {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "#";
    } catch (_) {
      return "#";
    }
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function evidenceClass(level) {
    if (level.startsWith("A")) return "evidence-a";
    if (level.startsWith("B")) return "evidence-b";
    return "evidence-c";
  }

  function sourceLabel(type) {
    if (type === "repository") return "打开仓库 ↗";
    if (type === "project") return "打开项目 ↗";
    return "查看原始来源 ↗";
  }

  function getState() {
    return {
      query: searchInput.value.trim().toLowerCase(),
      track: filterSelects.track.value,
      year: filterSelects.year.value,
      evidence: filterSelects.evidence.value,
      openSource: filterSelects.openSource.value,
      grid: filterSelects.grid.value,
      sort: sortSelect.value,
      preset: activePreset,
    };
  }

  function matchesYear(paper, filter) {
    if (filter === "all") return true;
    if (filter === "2025+") return paper.year >= 2025;
    if (filter === "2021-2024") return paper.year >= 2021 && paper.year <= 2024;
    if (filter === "-2020") return paper.year <= 2020;
    return true;
  }

  function matchesPaper(paper, state) {
    const haystack = [
      paper.title, paper.track, paper.trackRaw, paper.venue, paper.contribution,
      paper.code, paper.gridRelevance, beginnerSummary(paper),
    ].join(" ").toLowerCase();
    if (state.query && !haystack.includes(state.query)) return false;
    if (state.track !== "all" && paper.track !== state.track) return false;
    if (!matchesYear(paper, state.year)) return false;
    if (state.evidence !== "all" && !paper.evidence.startsWith(state.evidence)) return false;
    if (state.openSource !== "all" && paper.openSource !== state.openSource) return false;
    if (state.grid === "direct" && !paper.gridDirect) return false;
    if (state.grid === "transfer" && paper.gridDirect) return false;
    if (state.preset === "featured" && !paper.featured) return false;
    return true;
  }

  function sortPapers(items, method) {
    const copy = [...items];
    if (method === "newest") return copy.sort((a, b) => b.year - a.year || b.evidenceRank - a.evidenceRank || a.id - b.id);
    if (method === "evidence") return copy.sort((a, b) => b.evidenceRank - a.evidenceRank || b.year - a.year || a.id - b.id);
    if (method === "title") return copy.sort((a, b) => a.title.localeCompare(b.title, "en"));
    return copy.sort((a, b) => Number(b.featured) - Number(a.featured) || b.evidenceRank - a.evidenceRank || b.year - a.year || a.id - b.id);
  }

  function paperCard(paper) {
    const badges = [];
    if (paper.gridDirect) badges.push('<span class="paper-badge grid">直接电网</span>');
    if (paper.frontier) badges.push('<span class="paper-badge frontier">2025–2026</span>');
    if (paper.openSource === "licensed") badges.push('<span class="paper-badge license">许可明确</span>');
    const url = safeUrl(paper.url);
    return `
      <article class="paper-card" id="paper-${paper.id}">
        <div class="paper-card-head">
          <span class="paper-card-id">#${String(paper.id).padStart(3, "0")}</span>
          <div class="paper-card-badges">
            <span class="evidence ${evidenceClass(paper.evidence)}" title="证据等级按报告标准保守归一化">${escapeHTML(paper.evidenceLabel)}</span>
            ${badges.join("")}
          </div>
        </div>
        <h3>${escapeHTML(paper.title)}</h3>
        <p class="paper-meta">${paper.year} · ${escapeHTML(paper.venue)} · ${escapeHTML(statusLabels[paper.status] || paper.status)}</p>
        <p class="paper-plain"><strong>初学者一句话：</strong>${escapeHTML(beginnerSummary(paper))}</p>
        <p class="paper-contribution"><strong>原始贡献摘要：</strong>${escapeHTML(paper.contribution)}</p>
        <details>
          <summary>展开复现、许可与电网价值</summary>
          <div class="paper-details">
            <p><strong>原始分类：</strong>${escapeHTML(paper.trackRaw)}</p>
            <p><strong>代码与许可证：</strong>${escapeHTML(paper.code)}（网页归类：${escapeHTML(openSourceLabels[paper.openSource])}）</p>
            <p><strong>电网相关性：</strong>${escapeHTML(paper.gridRelevance)}</p>
            <p><strong>证据备注：</strong>原始等级 ${escapeHTML(paper.evidenceRaw)}；复合等级按较弱项保守归一化。</p>
          </div>
        </details>
        <div class="paper-actions">
          <span class="paper-track">${escapeHTML(paper.track)}</span>
          <a href="${escapeHTML(url)}" target="_blank" rel="noopener">${sourceLabel(paper.sourceType)}</a>
        </div>
      </article>`;
  }

  function updateUrl(state) {
    if (!window.history || !window.history.replaceState) return;
    const params = new URLSearchParams();
    if (state.query) params.set("q", searchInput.value.trim());
    ["track", "year", "evidence", "openSource", "grid"].forEach((key) => {
      if (state[key] && state[key] !== "all") params.set(key, state[key]);
    });
    if (state.sort !== "recommended") params.set("sort", state.sort);
    if (state.preset) params.set("preset", state.preset);
    const suffix = params.toString() ? `?${params.toString()}#library` : window.location.hash === "#library" ? "#library" : window.location.pathname;
    try { window.history.replaceState(null, "", suffix); } catch (_) { /* file:// may restrict history in some browsers */ }
  }

  function updatePresetButtons() {
    presetButtons.forEach((button) => button.classList.toggle("active", button.dataset.preset === activePreset));
  }

  function render(resetVisible = true) {
    if (resetVisible) visibleCount = PAGE_SIZE;
    const state = getState();
    const filtered = sortPapers(papers.filter((paper) => matchesPaper(paper, state)), state.sort);
    const visible = filtered.slice(0, visibleCount);
    paperGrid.innerHTML = visible.length
      ? visible.map(paperCard).join("")
      : '<div class="empty-state"><strong>没有找到匹配条目</strong><p>试试减少筛选条件，或清除关键词。</p></div>';
    if (resultCount) resultCount.textContent = `当前显示 ${Math.min(visible.length, filtered.length)} / ${filtered.length} 项（证据库共 ${papers.length} 项）`;
    if (loadMore) {
      loadMore.hidden = visible.length >= filtered.length;
      loadMore.textContent = `显示更多（还剩 ${Math.max(0, filtered.length - visible.length)} 项）`;
    }
    updatePresetButtons();
    updateUrl(state);
  }

  function clearPreset() {
    activePreset = "";
    updatePresetButtons();
  }

  libraryForm.addEventListener("input", () => {
    clearPreset();
    render();
  });
  libraryForm.addEventListener("change", () => {
    clearPreset();
    render();
  });
  libraryForm.addEventListener("reset", () => {
    window.setTimeout(() => {
      clearPreset();
      render();
    }, 0);
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      searchInput.value = "";
      Object.values(filterSelects).forEach((select) => { select.selectedIndex = 0; });
      sortSelect.selectedIndex = 0;
      activePreset = button.dataset.preset;
      if (activePreset === "frontier") filterSelects.year.value = "2025+";
      if (activePreset === "grid") filterSelects.grid.value = "direct";
      if (activePreset === "licensed") filterSelects.openSource.value = "licensed";
      if (activePreset !== "featured") activePreset = "";
      render();
    });
  });

  if (loadMore) {
    loadMore.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      render(false);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    event.preventDefault();
    searchInput.focus();
  });

  function restoreStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) searchInput.value = params.get("q");
    ["track", "year", "evidence", "openSource", "grid"].forEach((key) => {
      if (params.has(key) && filterSelects[key]) filterSelects[key].value = params.get(key);
    });
    if (params.has("sort")) sortSelect.value = params.get("sort");
    if (params.get("preset") === "featured") activePreset = "featured";
  }

  restoreStateFromUrl();
  render();
})();
