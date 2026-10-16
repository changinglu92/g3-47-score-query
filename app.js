(() => {
  "use strict";

  let STUDENTS = [];
  let scoreTrendChart = null;
  let rankTrendChart = null;

  const $ = (id) => document.getElementById(id);

  const els = {
    form: $("query-form"),
    name: $("name-input"),
    id: $("id-input"),
    btn: $("query-btn"),
    error: $("error-msg"),
    querySection: $("query-section"),
    resultSection: $("result-section"),
    backBtn: $("back-btn"),
    downloadBtn: $("download-btn"),
    studentName: $("student-name"),
    studentClass: $("student-class"),
    electives: $("electives"),
    totalBlock: $("total-block"),
    subjects: $("subjects"),
    historyBody: $("history-body"),
    examCount: $("exam-count"),
    langCol: $("lang-col"),
    capture: $("capture-area"),
    trendCanvas: $("trend-chart"),
    trendEmpty: $("trend-empty"),
    rankTrendCanvas: $("rank-trend-chart"),
    rankTrendEmpty: $("rank-trend-empty"),
    progressBoard: $("progress-board"),
    parentTips: $("parent-tips"),
  };

  function showError(msg) {
    els.error.hidden = false;
    els.error.textContent = msg;
  }

  function clearError() {
    els.error.hidden = true;
    els.error.textContent = "";
  }

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text.trim());
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function isEmpty(v) {
    return v === null || v === undefined || v === "" || v === "-" || v === "—";
  }

  function numOrNull(v) {
    if (isEmpty(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(v, digits) {
    if (isEmpty(v)) return "—";
    const n = Number(v);
    if (Number.isFinite(n)) {
      if (digits === 0 || Number.isInteger(n)) return String(Math.round(n));
      return String(Math.round(n * 100) / 100);
    }
    return String(v);
  }

  function fmtDelta(v) {
    if (isEmpty(v)) return { text: "—", cls: "flat", dir: "flat", n: null };
    const n = Number(v);
    if (!Number.isFinite(n)) return { text: "—", cls: "flat", dir: "flat", n: null };
    if (n > 0) return { text: `进步 ${Math.abs(Math.round(n))} 名`, cls: "up", dir: "up", n };
    if (n < 0) return { text: `退步 ${Math.abs(Math.round(n))} 名`, cls: "down", dir: "down", n };
    return { text: "持平", cls: "flat", dir: "flat", n: 0 };
  }

  function cell(v, kind) {
    if (isEmpty(v)) return `<td class="empty">—</td>`;
    const cls = kind === "rank" ? "rank-cell" : "num";
    return `<td class="${cls}">${fmt(v)}</td>`;
  }

  function renderHistory(student) {
    const exams = student.exams || [];
    els.examCount.textContent = String(exams.length);
    els.langCol.textContent = student.langLabel === "日语" ? "日语" : "英语";
    els.historyBody.innerHTML = exams
      .map((e) => {
        return `<tr>
          <td>${e["阶段"] || "—"}</td>
          ${cell(e["总分"])}
          ${cell(e["级排"], "rank")}
          ${cell(e["语文"])}
          ${cell(e["语文级排"], "rank")}
          ${cell(e["数学"])}
          ${cell(e["数学级排"], "rank")}
          ${cell(e["外语"])}
          ${cell(e["外语级排"], "rank")}
          ${cell(e["历史"])}
          ${cell(e["历史级排"], "rank")}
          ${cell(e["政治"])}
          ${cell(e["政治级排"], "rank")}
          ${cell(e["生物"])}
          ${cell(e["生物级排"], "rank")}
        </tr>`;
      })
      .join("");
  }

  function miniLine(label, score, rank, delta) {
    const d = fmtDelta(delta);
    return `<div class="eng-mini">
      <div class="eng-mini-top"><span class="eng-mini-name">${label}</span><span class="eng-mini-score">${isEmpty(score) ? "—" : fmt(score)}</span></div>
      <div class="eng-mini-meta">级排 ${isEmpty(rank) ? "—" : fmt(rank, 0)}</div>
      <div class="delta ${d.cls}"><span class="delta-label">校方向进退步：</span><span class="delta-value">${d.text}</span></div>
    </div>`;
  }

  function englishCard(L) {
    const d = fmtDelta(L["英语总分进退步"]);
    const empty = isEmpty(L["英语总分"]);
    const dirCls = empty ? "" : d.dir === "up" || d.dir === "down" ? d.dir : "";
    return `<div class="subject subject-eng ${dirCls}">
      <div class="name">英语总分</div>
      <div class="score">${empty ? "—" : fmt(L["英语总分"])}</div>
      <div class="rank">级排 ${isEmpty(L["英语总分级排"]) ? "—" : fmt(L["英语总分级排"], 0)}</div>
      <div class="delta ${d.cls}"><span class="delta-label">校方向进退步：</span><span class="delta-value">${d.text}</span></div>
      <div class="eng-split">
        ${miniLine("听说", L["听说"], L["听说级排"], L["听说进退步"])}
        ${miniLine("英语笔试", L["英语笔试"], L["英语笔试级排"], L["英语笔试进退步"])}
      </div>
    </div>`;
  }

  function subjectCard(name, score, rank, delta) {
    const d = fmtDelta(delta);
    const empty = isEmpty(score);
    const dirCls = empty ? "" : d.dir === "up" || d.dir === "down" ? d.dir : "";
    return `<div class="subject ${dirCls}">
      <div class="name">${name}</div>
      <div class="score">${empty ? "—" : fmt(score)}</div>
      <div class="rank">级排 ${isEmpty(rank) ? "—" : fmt(rank, 0)}</div>
      <div class="delta ${d.cls}"><span class="delta-label">校方向进退步：</span><span class="delta-value">${d.text}</span></div>
    </div>`;
  }

  function renderLatest(student) {
    const L = student.latest;
    if (!L) {
      els.electives.textContent = "";
      els.totalBlock.innerHTML =
        '<div class="stat"><div class="label">提示</div><div class="value" style="font-size:1.1rem">暂无第二次综合成绩</div></div>';
      els.subjects.innerHTML = "";
      return;
    }

    els.electives.textContent = L["选考科目"] ? `选考：${L["选考科目"]}` : "";

    const totalDelta = fmtDelta(L["总分进退步"]);
    els.totalBlock.innerHTML = `
      <div class="stat ${totalDelta.dir}">
        <div class="label">总分</div>
        <div class="value">${fmt(L["总分"])}</div>
        <div class="sub delta ${totalDelta.cls}">${totalDelta.text}</div>
      </div>
      <div class="stat rank-stat">
        <div class="label">总分级排</div>
        <div class="value">${fmt(L["总分级排"], 0)}</div>
        <div class="sub">校方向名次</div>
      </div>
      <div class="stat">
        <div class="label">班级</div>
        <div class="value" style="font-size:1.15rem">${L["班级"] || "—"}</div>
        <div class="sub">准考证 ${L["准考证号"] || "—"}</div>
      </div>
    `;

    const isJp = student.langLabel === "日语";
    const langCard = isJp
      ? subjectCard("日语", L["日语"], L["日语级排"], L["日语进退步"])
      : englishCard(L);

    const row1 = [
      subjectCard("语文", L["语文"], L["语文级排"], L["语文进退步"]),
      subjectCard("数学", L["数学"], L["数学级排"], L["数学进退步"]),
      langCard,
    ].join("");
    const row2 = [
      subjectCard("历史", L["历史"], L["历史级排"], L["历史进退步"]),
      subjectCard("政治", L["政治"], L["政治级排"], L["政治进退步"]),
      subjectCard("生物", L["生物学"] ?? L["生物"], L["生物级排"], L["生物进退步"]),
    ].join("");

    els.subjects.innerHTML = `<div class="subject-row">${row1}</div><div class="subject-row">${row2}</div>`;
  }

  /** Collect up to 10 exams with valid 总分 (skip empties). */
  function scoreSeries(student) {
    const exams = student.exams || [];
    const points = [];
    for (const e of exams) {
      const score = numOrNull(e["总分"]);
      if (score === null) continue;
      points.push({
        label: e["阶段"] || "—",
        score,
        rank: numOrNull(e["级排"]),
      });
    }
    return points.slice(-10);
  }

  /** Narrow phone (iPhone-class) — smaller chart fonts / padding. */
  function isNarrowScreen() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
  }

  function chartUiScale() {
    const narrow = isNarrowScreen();
    return {
      narrow,
      labelFontPx: narrow ? 10 : 11,
      tickFont: narrow ? 9 : 11,
      titleFont: narrow ? 10 : 12,
      layoutPad: narrow ? { top: 14, right: 4, left: 2, bottom: 2 } : { top: 18, right: 8 },
      labelOffset: narrow ? 6 : 8,
      pointLast: narrow ? 5 : 7,
      pointNormal: narrow ? 3 : 4,
      pointHover: narrow ? 6 : 8,
      borderWidth: narrow ? 2 : 2.5,
    };
  }

  /** Draw numeric labels above each point (no extra CDN plugin). */
  const valueLabelPlugin = {
    id: "valueLabels",
    afterDatasetsDraw(chart, _args, pluginOpts) {
      const { ctx } = chart;
      const color = (pluginOpts && pluginOpts.color) || "#1a2332";
      const ui = chartUiScale();
      const offset = (pluginOpts && pluginOpts.offset) || ui.labelOffset;
      const fontPx = (pluginOpts && pluginOpts.fontSize) || ui.labelFontPx;
      chart.data.datasets.forEach((dataset, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((el, index) => {
          const raw = dataset.data[index];
          if (raw === null || raw === undefined || Number.isNaN(Number(raw))) return;
          if (!el || typeof el.x !== "number" || typeof el.y !== "number") return;
          const text = String(Math.round(Number(raw)));
          ctx.save();
          ctx.font = `600 ${fontPx}px PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif`;
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(text, el.x, el.y - offset);
          ctx.restore();
        });
      });
    },
  };

  function destroyTrendCharts() {
    if (scoreTrendChart) {
      scoreTrendChart.destroy();
      scoreTrendChart = null;
    }
    if (rankTrendChart) {
      rankTrendChart.destroy();
      rankTrendChart = null;
    }
  }

  function baseLineOptions(yTitle, extraY) {
    const ui = chartUiScale();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: ui.layoutPad },
      plugins: {
        legend: { display: false },
        valueLabels: { color: "#1a2332", offset: ui.labelOffset, fontSize: ui.labelFontPx },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: ui.narrow ? 6 : 10,
            font: { size: ui.tickFont },
            color: "#6b7a90",
          },
          grid: { display: false },
        },
        y: Object.assign(
          {
            ticks: {
              font: { size: ui.tickFont },
              color: "#6b7a90",
              maxTicksLimit: ui.narrow ? 5 : 8,
            },
            grid: { color: "#e6ecf5" },
            title: {
              display: true,
              text: yTitle,
              color: "#6b7a90",
              font: { size: ui.titleFont },
            },
          },
          extraY || {}
        ),
      },
    };
  }

  function renderScoreTrend(points) {
    if (!points.length) {
      els.trendCanvas.hidden = true;
      els.trendEmpty.hidden = false;
      els.trendEmpty.textContent = "暂无足够的总分数据绘制趋势图。";
      return;
    }

    els.trendCanvas.hidden = false;
    els.trendEmpty.hidden = true;

    if (typeof Chart !== "function") {
      els.trendEmpty.hidden = false;
      els.trendEmpty.textContent = "图表组件加载中，请刷新后再试。";
      return;
    }

    const labels = points.map((p) => p.label);
    const scores = points.map((p) => p.score);
    const lastIdx = points.length - 1;
    const ui = chartUiScale();
    const pointRadius = points.map((_, i) => (i === lastIdx ? ui.pointLast : ui.pointNormal));
    const pointBg = points.map((_, i) => (i === lastIdx ? "#2563eb" : "#93c5fd"));
    const pointBorder = points.map((_, i) => (i === lastIdx ? "#1d4ed8" : "#60a5fa"));

    const opts = baseLineOptions("总分");
    opts.plugins.tooltip = {
      callbacks: {
        label(ctx) {
          const p = points[ctx.dataIndex];
          const rank =
            p && p.rank !== null ? `，级排 ${Math.round(p.rank)}` : "";
          return `总分 ${ctx.parsed.y}${rank}`;
        },
      },
    };

    const ctx = els.trendCanvas.getContext("2d");
    scoreTrendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "总分",
            data: scores,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.12)",
            borderWidth: ui.borderWidth,
            fill: true,
            tension: 0.25,
            pointRadius,
            pointHoverRadius: ui.pointHover,
            pointBackgroundColor: pointBg,
            pointBorderColor: pointBorder,
            pointBorderWidth: 2,
          },
        ],
      },
      options: opts,
      plugins: [valueLabelPlugin],
    });
  }

  function renderRankTrend(points) {
    // Prefer aligned labels with score series; null gaps for missing ranks.
    const hasAnyRank = points.some((p) => p.rank !== null);

    if (!hasAnyRank) {
      els.rankTrendCanvas.hidden = true;
      els.rankTrendEmpty.hidden = false;
      els.rankTrendEmpty.textContent = "暂无足够的级排数据绘制趋势图。";
      return;
    }

    els.rankTrendCanvas.hidden = false;
    els.rankTrendEmpty.hidden = true;

    if (typeof Chart !== "function") {
      els.rankTrendEmpty.hidden = false;
      els.rankTrendEmpty.textContent = "图表组件加载中，请刷新后再试。";
      return;
    }

    const labels = points.map((p) => p.label);
    const ranks = points.map((p) => p.rank);
    const lastIdx = points.length - 1;
    const ui = chartUiScale();
    const pointRadius = points.map((p, i) => {
      if (p.rank === null) return 0;
      return i === lastIdx ? ui.pointLast : ui.pointNormal;
    });
    const pointBg = points.map((p, i) => {
      if (p.rank === null) return "transparent";
      return i === lastIdx ? "#c2410c" : "#fdba74";
    });
    const pointBorder = points.map((p, i) => {
      if (p.rank === null) return "transparent";
      return i === lastIdx ? "#9a3412" : "#fb923c";
    });

    const opts = baseLineOptions("级排（越小越好）", { reverse: true });
    opts.plugins.valueLabels = { color: "#9a3412", offset: ui.labelOffset, fontSize: ui.labelFontPx };
    opts.plugins.tooltip = {
      callbacks: {
        label(ctx) {
          if (ctx.parsed.y === null || ctx.parsed.y === undefined) return "级排 —";
          return `级排 ${Math.round(ctx.parsed.y)}`;
        },
      },
    };

    const ctx = els.rankTrendCanvas.getContext("2d");
    rankTrendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "级排",
            data: ranks,
            borderColor: "#ea580c",
            backgroundColor: "rgba(234, 88, 12, 0.10)",
            borderWidth: ui.borderWidth,
            fill: true,
            tension: 0.25,
            spanGaps: true,
            pointRadius,
            pointHoverRadius: ui.pointHover,
            pointBackgroundColor: pointBg,
            pointBorderColor: pointBorder,
            pointBorderWidth: 2,
          },
        ],
      },
      options: opts,
      plugins: [valueLabelPlugin],
    });
  }

  function renderTrend(student) {
    const points = scoreSeries(student);
    destroyTrendCharts();
    renderScoreTrend(points);
    renderRankTrend(points);
  }

  /** Subject deltas for progress board / tips. */
  function collectDeltas(student) {
    const L = student.latest || {};
    const isJp = student.langLabel === "日语";
    const items = [
      { name: "总分", delta: L["总分进退步"], kind: "total" },
      { name: "语文", delta: L["语文进退步"], kind: "subject" },
      { name: "数学", delta: L["数学进退步"], kind: "subject" },
      { name: "历史", delta: L["历史进退步"], kind: "subject" },
      { name: "政治", delta: L["政治进退步"], kind: "subject" },
      { name: "生物", delta: L["生物进退步"], kind: "subject" },
    ];
    if (isJp) {
      items.push({ name: "日语", delta: L["日语进退步"], kind: "lang" });
    } else {
      items.push({ name: "英语总分", delta: L["英语总分进退步"], kind: "lang" });
      items.push({ name: "听说", delta: L["听说进退步"], kind: "eng-part" });
      items.push({ name: "英语笔试", delta: L["英语笔试进退步"], kind: "eng-part" });
    }
    return items.map((it) => {
      const d = fmtDelta(it.delta);
      return { ...it, ...d };
    });
  }

  function renderProgressBoard(student) {
    if (!student.latest) {
      els.progressBoard.innerHTML =
        '<p class="empty-hint">暂无第二次综合进退步数据。</p>';
      return;
    }

    const items = collectDeltas(student);
    const up = items.filter((i) => i.dir === "up").sort((a, b) => b.n - a.n);
    const down = items.filter((i) => i.dir === "down").sort((a, b) => a.n - b.n);
    const flat = items.filter((i) => i.dir === "flat" && i.n === 0);
    const unknown = items.filter((i) => i.n === null);

    const barItem = (it, tone) => {
      const abs = Math.abs(Math.round(it.n));
      const maxAbs = Math.max(
        1,
        ...items.filter((x) => x.n !== null).map((x) => Math.abs(x.n))
      );
      const pct = Math.min(100, Math.round((abs / maxAbs) * 100));
      return `<div class="prog-item ${tone}">
        <div class="prog-head">
          <span class="prog-name">${it.name}</span>
          <span class="prog-delta">${it.text}</span>
        </div>
        <div class="prog-bar-track"><div class="prog-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
    };

    const col = (title, list, tone, emptyText) => {
      const body =
        list.length > 0
          ? list.map((it) => barItem(it, tone)).join("")
          : `<p class="prog-empty">${emptyText}</p>`;
      return `<div class="prog-col ${tone}">
        <div class="prog-col-title">${title}</div>
        <div class="prog-list">${body}</div>
      </div>`;
    };

    let notes = "";
    if (flat.length) {
      notes += `<p class="prog-note">持平：${flat.map((i) => i.name).join("、")}</p>`;
    }
    if (unknown.length) {
      notes += `<p class="prog-note muted">暂无进退步数据：${unknown.map((i) => i.name).join("、")}</p>`;
    }
    if (!up.length && !down.length && !flat.length) {
      notes =
        '<p class="prog-note">本次各科暂无可用的校方向进退步数据，可结合履历表查看分数变化。</p>';
    }

    els.progressBoard.innerHTML = `
      <div class="prog-grid">
        ${col("进步科目", up, "up", "本次暂无明显进步科目")}
        ${col("需关注（退步）科目", down, "down", "本次暂无明显退步科目，继续保持！")}
      </div>
      ${notes}
    `;
  }

  function describeTrend(points) {
    if (points.length < 2) {
      return points.length === 1
        ? `目前只有 1 次有效总分记录（${points[0].label}：${fmt(points[0].score)} 分），后续考试会把曲线画得更完整。`
        : null;
    }
    const scores = points.map((p) => p.score);
    const last = scores[scores.length - 1];
    const prev = scores[scores.length - 2];
    const first = scores[0];
    const diffs = [];
    for (let i = 1; i < scores.length; i++) diffs.push(scores[i] - scores[i - 1]);
    const allUp = diffs.every((d) => d > 0);
    const allDown = diffs.every((d) => d < 0);
    const swing = Math.max(...scores) - Math.min(...scores);
    const recentUp = last > prev;
    const recentDown = last < prev;

    if (allUp) {
      return `总分曲线呈连续上升：从 ${fmt(first)} 分提到 ${fmt(last)} 分，说明这段时间的学习状态在稳步向好，值得肯定。`;
    }
    if (allDown) {
      return `总分曲线近期偏弱，从 ${fmt(first)} 分到 ${fmt(last)} 分。不必慌，先和孩子一起复盘薄弱环节，把下一阶段目标定具体一点。`;
    }
    if (swing >= 40 && recentUp) {
      return `总分波动较大（高低相差约 ${fmt(Math.round(swing))} 分），但最近一次已回升到 ${fmt(last)} 分。稳住节奏、减少起伏，比单纯追分更重要。`;
    }
    if (swing >= 40 && recentDown) {
      return `总分波动较大（高低相差约 ${fmt(Math.round(swing))} 分），最近一次略有回落。建议家长陪孩子看一眼哪几科拉分，避免一次性加压。`;
    }
    if (recentUp) {
      return `最近一次总分较上场回升（${fmt(prev)} → ${fmt(last)}），曲线有抬头迹象，鼓励孩子把好的方法坚持下去。`;
    }
    if (recentDown) {
      return `最近一次总分较上场略有回落（${fmt(prev)} → ${fmt(last)}）。波动很常见，重点是对照错题找原因，而不是只盯着数字。`;
    }
    return `总分整体在 ${fmt(Math.min(...scores))}–${fmt(Math.max(...scores))} 分区间波动，近期相对平稳。保持复盘习惯，小步前进即可。`;
  }

  function buildParentTips(student) {
    const tips = [];
    const name = student.name || "孩子";
    const L = student.latest;
    const points = scoreSeries(student);
    const isJp = student.langLabel === "日语";
    const items = collectDeltas(student);
    const subjectsOnly = items.filter(
      (i) => i.kind === "subject" || i.kind === "lang" || i.kind === "eng-part"
    );

    const trendTip = describeTrend(points);
    if (trendTip) tips.push(trendTip);

    if (L) {
      const totalD = fmtDelta(L["总分进退步"]);
      const rank = fmt(L["总分级排"], 0);
      if (totalD.dir === "up") {
        tips.push(
          `第二次综合总分级排第 ${rank} 名，校方向进步 ${Math.abs(Math.round(totalD.n))} 名。请当面表扬具体努力（如错题本、定时练），比空泛夸「真棒」更有力量。`
        );
      } else if (totalD.dir === "down") {
        tips.push(
          `第二次综合总分级排第 ${rank} 名，校方向退步 ${Math.abs(Math.round(totalD.n))} 名。先倾听孩子感受，再一起挑 1–2 个可改进点，避免翻旧账。`
        );
      } else if (totalD.n === 0) {
        tips.push(
          `第二次综合总分级排第 ${rank} 名，较上场持平。稳住现有节奏的同时，可给自己定一个小目标（比如薄弱科周练）。`
        );
      } else {
        tips.push(`第二次综合总分级排第 ${rank} 名。结合下方科目变化，和孩子一起看优势科与待加强科即可。`);
      }
    }

    const upSubs = subjectsOnly
      .filter((i) => i.dir === "up")
      .sort((a, b) => b.n - a.n);
    const downSubs = subjectsOnly
      .filter((i) => i.dir === "down")
      .sort((a, b) => a.n - b.n);

    if (upSubs.length) {
      const top = upSubs.slice(0, 2);
      const desc = top
        .map((i) => `${i.name}（进步 ${Math.abs(Math.round(i.n))} 名）`)
        .join("、");
      tips.push(`进步最明显的是 ${desc}。可请孩子分享这科怎么学的，把成功经验迁移到其他科目。`);
    }

    if (downSubs.length) {
      const worst = downSubs.slice(0, 2);
      const desc = worst
        .map((i) => `${i.name}（退步 ${Math.abs(Math.round(i.n))} 名）`)
        .join("、");
      tips.push(`需优先关注：${desc}。建议本周各安排一次短复盘（错因分类 + 同类题重做），比盲目加时更有效。`);
    }

    if (!isJp) {
      const written = items.find((i) => i.name === "英语笔试");
      const listen = items.find((i) => i.name === "听说");
      if (
        written &&
        written.dir === "down" &&
        Math.abs(written.n) >= 10 &&
        listen &&
        (listen.dir === "flat" || listen.n === null || Math.abs(listen.n || 0) <= 5)
      ) {
        tips.push(
          "英语方面：笔试名次回落较明显，听说基本持平。近期可把重心放在笔试（阅读精读、完形/改错错因、词汇滚动），听说维持日常即可。"
        );
      } else if (written && written.dir === "down" && Math.abs(written.n) >= 15) {
        tips.push(
          "英语笔试进退步幅度较大，建议对照最近两次卷面，把失分集中在 1–2 类题型上突破。"
        );
      }
    } else {
      const jp = items.find((i) => i.name === "日语");
      if (jp && jp.dir === "down" && Math.abs(jp.n) >= 5) {
        tips.push(
          `日语本次校方向退步 ${Math.abs(Math.round(jp.n))} 名，建议和日语老师沟通薄弱板块（词汇/语法/阅读），制定一周小目标。`
        );
      } else if (jp && jp.dir === "up") {
        tips.push(
          `日语本次进步 ${Math.abs(Math.round(jp.n))} 名，继续保持听力与阅读的每日输入，巩固优势。`
        );
      } else if (jp && jp.n !== null) {
        tips.push("日语作为选考外语，请继续关注日常听说与阅读输入，保持稳定输出。");
      }
    }

    tips.push(
      `建议亲子复盘：选一个轻松时段，让${name}自己讲「哪科最有把握、哪科最想突破」，家长只做提问与记录，共同定下周 1–2 个小行动。另请留意：10 月 29 日高三家长会（具体时间地点另行通知），欢迎到场交流。`
    );

    // Keep 3–6 tips
    let out = tips.filter(Boolean);
    if (out.length > 6) out = out.slice(0, 5).concat(out[out.length - 1]);
    while (out.length < 3) {
      out.push(
        "成绩只是阶段性反馈。保持作息与情绪稳定，比单次名次更重要；有需要随时和班主任沟通。"
      );
    }
    return out.slice(0, 6);
  }

  function renderParentTips(student) {
    const tips = buildParentTips(student);
    els.parentTips.innerHTML = tips.map((t) => `<li>${t}</li>`).join("");
  }

  function renderStudent(student) {
    els.studentName.textContent = student.name;
    const klass = (student.latest && student.latest["班级"]) || "高三年级47班";
    els.studentClass.textContent = klass;
    renderLatest(student);
    renderTrend(student);
    renderProgressBoard(student);
    renderParentTips(student);
    renderHistory(student);
    els.querySection.hidden = true;
    els.resultSection.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetView() {
    destroyTrendCharts();
    els.resultSection.hidden = true;
    els.querySection.hidden = false;
    clearError();
    els.id.value = "";
    els.name.focus();
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    clearError();

    const name = els.name.value.trim();
    const id = els.id.value.trim().toUpperCase();

    if (!name) {
      showError("请输入姓名。");
      return;
    }
    if (!/^\d{17}[\dX]$/.test(id)) {
      showError("请输入正确的18位身份证号。");
      return;
    }

    els.btn.disabled = true;
    els.btn.textContent = "查询中…";

    try {
      if (!STUDENTS.length) {
        showError("成绩数据尚未加载完成，请稍后再试。");
        return;
      }

      const hash = await sha256Hex(id);
      const student = STUDENTS.find((s) => s.name === name && s.idHash === hash);

      if (!student) {
        const nameHit = STUDENTS.some((s) => s.name === name);
        if (nameHit) {
          showError("姓名与身份证号不匹配，请核对后重试。");
        } else {
          showError("未找到该学生，请确认姓名拼写是否正确。");
        }
        return;
      }

      renderStudent(student);
    } catch (err) {
      console.error(err);
      showError("查询失败，请刷新页面后重试。");
    } finally {
      els.btn.disabled = false;
      els.btn.textContent = "查询成绩";
    }
  }

  async function downloadPng() {
    if (typeof html2canvas !== "function") {
      alert("图片组件加载中，请稍后再试。");
      return;
    }
    const name = els.studentName.textContent || "成绩";
    els.downloadBtn.disabled = true;
    els.downloadBtn.textContent = "生成中…";
    try {
      const canvas = await html2canvas(els.capture, {
        backgroundColor: "#f3f6fb",
        scale: Math.min(2, window.devicePixelRatio || 2),
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${name}-第二次综合成绩单.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error(err);
      alert("生成图片失败，请换个浏览器再试。");
    } finally {
      els.downloadBtn.disabled = false;
      els.downloadBtn.textContent = "下载整页成绩图";
    }
  }

  async function loadData() {
    const res = await fetch("data.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("load failed");
    STUDENTS = await res.json();
  }

  els.form.addEventListener("submit", onSubmit);
  els.backBtn.addEventListener("click", resetView);
  els.downloadBtn.addEventListener("click", downloadPng);

  loadData().catch(() => {
    showError("无法加载成绩数据（data.json），请确认文件与页面在同一目录。");
  });
})();
