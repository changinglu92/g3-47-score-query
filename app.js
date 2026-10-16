(() => {
  "use strict";

  let STUDENTS = [];

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
    studentLang: $("student-lang"),
    electives: $("electives"),
    totalBlock: $("total-block"),
    subjects: $("subjects"),
    historyBody: $("history-body"),
    examCount: $("exam-count"),
    langCol: $("lang-col"),
    capture: $("capture-area"),
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
    if (isEmpty(v)) return { text: "—", cls: "flat", dir: "flat" };
    const n = Number(v);
    if (!Number.isFinite(n)) return { text: "—", cls: "flat", dir: "flat" };
    if (n > 0) return { text: `进步 ${Math.abs(Math.round(n))} 名`, cls: "up", dir: "up" };
    if (n < 0) return { text: `退步 ${Math.abs(Math.round(n))} 名`, cls: "down", dir: "down" };
    return { text: "持平", cls: "flat", dir: "flat" };
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
        ${miniLine("英语", L["英语笔试"], L["英语笔试级排"], L["英语笔试进退步"])}
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

  function renderStudent(student) {
    els.studentName.textContent = student.name;
    const klass = (student.latest && student.latest["班级"]) || "高三年级47班";
    els.studentClass.textContent = klass;
    renderLatest(student);
    renderHistory(student);
    els.querySection.hidden = true;
    els.resultSection.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetView() {
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
