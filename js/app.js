// =========================================
//  Tilburg Course Planner — app.js
//  ES Module: state management, rendering,
//  PDF generation via jsPDF
// =========================================

// ── State ────────────────────────────────
const state = {
  courses: [],
  categories: [],
  programme: {},
  selected: new Set(),
  activeFilter: 'all',
};

// ── Boot ─────────────────────────────────
export async function init() {
  const data = await fetch('courses.json').then(r => r.json());
  state.courses    = data.courses;
  state.categories = data.categories;
  state.programme  = data.programme;
  state.recommendations = data.recommendations;

  renderFilterBar();
  renderCourseGrid();
  renderCategoryBreakdown();
  updateProgress();
  renderRecommendations();
  bindPdfButton();
}

// ── Helpers ──────────────────────────────
function getSelected() {
  return state.courses.filter(c => state.selected.has(c.id));
}

function totalEcts(courses) {
  return courses.reduce((sum, c) => sum + c.ects, 0);
}

function ectsByCategory() {
  const map = {};
  for (const cat of state.categories) map[cat.id] = 0;
  for (const c of getSelected()) {
    if (map[c.category] !== undefined) map[c.category] += c.ects;
  }
  return map;
}

function getCatMeta(id) {
  return state.categories.find(c => c.id === id) || { label: id, color: '#999' };
}

// ── Filter bar ───────────────────────────
function renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  bar.innerHTML = '';

  const filters = [
    { id: 'all', label: 'All courses' },
    ...state.categories.map(c => ({ id: c.id, label: c.label })),
  ];

  for (const f of filters) {
    const btn = document.createElement('button');
    btn.className = 'filter-tab' + (f.id === state.activeFilter ? ' active' : '');
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      state.activeFilter = f.id;
      renderFilterBar();
      renderCourseGrid();
    });
    bar.appendChild(btn);
  }
}

// ── Course Grid ──────────────────────────
function renderCourseGrid() {
  const container = document.getElementById('course-container');
  container.innerHTML = '';

  // Group by year
  const years = [...new Set(state.courses.map(c => c.year))].sort();

  for (const year of years) {
    const yearCourses = state.courses
      .filter(c => c.year === year)
      .filter(c => state.activeFilter === 'all' || c.category === state.activeFilter);

    if (yearCourses.length === 0) continue;

    const yearEcts = yearCourses.reduce((s, c) => s + c.ects, 0);

    const section = document.createElement('div');
    section.className = 'course-section';

    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <h3>Year ${year}</h3>
      <span class="year-ects">${yearEcts} ECTS available</span>
    `;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'course-grid';

    for (const course of yearCourses) {
      grid.appendChild(buildCard(course));
    }

    section.appendChild(grid);
    container.appendChild(section);
  }
}

function buildCard(course) {
  const cat = getCatMeta(course.category);
  const isSelected = state.selected.has(course.id);

  const card = document.createElement('div');
  card.className = 'course-card' + (isSelected ? ' selected' : '');
  card.dataset.id = course.id;

  card.innerHTML = `
    <div class="checkmark">✓</div>
    <div class="card-top">
      <span class="course-id">${course.id}</span>
      <span class="ects-badge">${course.ects} ECTS</span>
    </div>
    <div class="course-name">${course.name}</div>
    <div class="course-desc">${course.description}</div>
    <span class="cat-tag" style="background:${cat.color}18; color:${cat.color};">
      <span style="width:6px;height:6px;border-radius:50%;background:${cat.color};display:inline-block;"></span>
      ${cat.label}
    </span>
  `;

  card.addEventListener('click', () => toggleCourse(course.id));
  return card;
}

function toggleCourse(id) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.add(id);
  }
  // Update just this card's UI
  const card = document.querySelector(`.course-card[data-id="${id}"]`);
  if (card) {
    const isSelected = state.selected.has(id);
    card.classList.toggle('selected', isSelected);
  }
  updateProgress();
  renderCategoryBreakdown();
  renderRecommendations();
}

// ── Progress ─────────────────────────────
function updateProgress() {
  const selected = getSelected();
  const earned   = totalEcts(selected);
  const total    = state.programme.totalRequired;
  const milestone = state.programme.milestoneCredits;

  // Header pill
  document.getElementById('header-ects').textContent = earned;
  const pill = document.getElementById('header-pill');
  if (earned >= milestone) pill.classList.add('milestone-reached');
  else pill.classList.remove('milestone-reached');

  // Sidebar big number
  document.getElementById('ects-current').textContent = earned;

  // Progress bar (capped at 100%)
  const pct = Math.min((earned / total) * 100, 100);
  document.getElementById('progress-fill').style.width = pct + '%';

  // Milestone marker
  const mPct = (milestone / total) * 100;
  document.getElementById('milestone-marker').style.left = mPct + '%';

  // Milestone label
  const remaining = Math.max(milestone - earned, 0);
  if (remaining > 0) {
    document.getElementById('milestone-label').innerHTML =
      `<strong>${remaining} ECTS</strong> to reach the 50-credit milestone`;
  } else {
    document.getElementById('milestone-label').innerHTML =
      `Milestone reached — <strong>${earned} / ${total}</strong> ECTS total`;
  }

  // Banner
  const banner = document.getElementById('milestone-banner');
  banner.classList.toggle('show', earned >= milestone);

  // PDF button
  document.getElementById('pdf-btn').disabled = earned === 0;
}

// ── Category breakdown ───────────────────
function renderCategoryBreakdown() {
  const map = ectsByCategory();
  const list = document.getElementById('cat-list');
  list.innerHTML = '';

  for (const cat of state.categories) {
    const ects = map[cat.id] || 0;
    if (ects === 0) continue;

    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <span class="cat-dot" style="background:${cat.color};"></span>
      <span class="cat-name">${cat.label}</span>
      <span class="cat-ects">${ects} ECTS</span>
    `;
    list.appendChild(row);
  }

  if (list.children.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);">No courses selected yet.</div>';
  }
}

// ── Recommendations ───────────────────────
function renderRecommendations() {
  const panel = document.getElementById('rec-panel');
  const earned = totalEcts(getSelected());
  const map    = ectsByCategory();
  const milestone = state.programme.milestoneCredits;
  const remaining = Math.max(milestone - earned, 0);

  const groups = [];

  for (const rec of state.recommendations) {
    if (rec.condition === 'nearMilestone') {
      if (remaining > 0 && remaining <= rec.threshold) {
        groups.push({
          label: `Only ${remaining} ECTS left to hit 50 — almost there!`,
          courses: state.courses
            .filter(c => !state.selected.has(c.id))
            .sort((a, b) => a.ects - b.ects)
            .slice(0, 4),
        });
      }
      continue;
    }

    const catEcts = map[rec.category] || 0;
    if (catEcts < rec.threshold) {
      const recCourses = rec.courseIds
        .map(id => state.courses.find(c => c.id === id))
        .filter(c => c && !state.selected.has(c.id));

      if (recCourses.length > 0) {
        groups.push({ label: rec.message, courses: recCourses });
      }
    }
  }

  if (groups.length === 0) {
    panel.innerHTML = `
      <h2>Recommendations</h2>
      <div class="empty-rec">
        ✓ Your selection looks well-balanced — no gaps to flag.
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <h2>Recommendations</h2>
    <p class="rec-subtitle">Based on your current selection and the 50 ECTS milestone.</p>
  `;

  for (const group of groups) {
    const div = document.createElement('div');
    div.className = 'rec-group';

    const label = document.createElement('div');
    label.className = 'rec-group-label';
    label.textContent = '⚑ ' + group.label;
    div.appendChild(label);

    const chips = document.createElement('div');
    chips.className = 'rec-chips';

    for (const course of group.courses) {
      const chip = document.createElement('button');
      chip.className = 'rec-chip';
      chip.textContent = `${course.name} (${course.ects} ECTS)`;
      chip.title = course.description;
      chip.addEventListener('click', () => {
        state.selected.add(course.id);
        // Scroll to and update card
        const card = document.querySelector(`.course-card[data-id="${course.id}"]`);
        if (card) {
          card.classList.add('selected');
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Card might be filtered out — reset filter and re-render
          state.activeFilter = 'all';
          renderFilterBar();
          renderCourseGrid();
          setTimeout(() => {
            document.querySelector(`.course-card[data-id="${course.id}"]`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
        updateProgress();
        renderCategoryBreakdown();
        renderRecommendations();
      });
      chips.appendChild(chip);
    }

    div.appendChild(chips);
    panel.appendChild(div);
  }
}

// ── PDF Generation ────────────────────────
function bindPdfButton() {
  document.getElementById('pdf-btn').addEventListener('click', generatePdf);
}

async function generatePdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const selected  = getSelected();
  const earned    = totalEcts(selected);
  const total     = state.programme.totalRequired;
  const milestone = state.programme.milestoneCredits;
  const remaining = Math.max(total - earned, 0);
  const map       = ectsByCategory();
  const date      = new Date().toLocaleDateString('en-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Colours ──
  const BLACK  = [26, 23, 20];
  const GREY   = [122, 116, 110];
  const ACCENT = [212, 72, 26];
  const BG     = [247, 245, 240];
  const BORDER = [226, 221, 214];
  const GREEN  = [46, 125, 80];
  const WARN   = [181, 116, 10];

  const W = 210; // A4 width mm
  let y = 0;

  // ── Header bar ──
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, W, 22, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, 22, W, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('Tilburg University', 14, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 175, 170);
  doc.text('Course Credit Planner — Generated ' + date, 14, 16.5);

  y = 34;

  // ── Programme title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BLACK);
  doc.text(state.programme.name, 14, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(state.programme.school, 14, y);
  y += 12;

  // ── Credit summary boxes ──
  const boxes = [
    { label: 'ECTS Earned',  value: `${earned}`,   sub: `of ${total} required`, color: ACCENT },
    { label: 'Still Needed', value: `${remaining}`, sub: `to complete degree`,   color: remaining > 0 ? WARN : GREEN },
    { label: 'Milestone',    value: earned >= milestone ? '✓ Reached' : `${Math.max(milestone - earned, 0)} left`,
      sub: `50 ECTS target`, color: earned >= milestone ? GREEN : GREY },
  ];

  const boxW = (W - 28 - 8) / 3;
  for (let i = 0; i < boxes.length; i++) {
    const bx = 14 + i * (boxW + 4);
    doc.setFillColor(...BG);
    doc.roundedRect(bx, y, boxW, 22, 2, 2, 'F');
    doc.setDrawColor(...BORDER);
    doc.roundedRect(bx, y, boxW, 22, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...boxes[i].color);
    doc.text(String(boxes[i].value), bx + 6, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(boxes[i].label.toUpperCase(), bx + 6, y + 17);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(boxes[i].sub, bx + 6, y + 21);
  }
  y += 30;

  // ── Category breakdown ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text('CREDITS BY CATEGORY', 14, y);
  y += 5;

  const catData = state.categories
    .map(c => ({ ...c, ects: map[c.id] || 0 }))
    .filter(c => c.ects > 0);

  // Mini bar chart
  const maxEcts = Math.max(...catData.map(c => c.ects), 1);
  const barAreaW = W - 28;

  for (const cat of catData) {
    const barW = (cat.ects / maxEcts) * (barAreaW - 60);
    const hex = cat.color;
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(cat.label, 14, y + 3);

    doc.setFillColor(r, g, b);
    doc.rect(80, y - 1, Math.max(barW, 1), 5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(r, g, b);
    doc.text(`${cat.ects} ECTS`, 80 + Math.max(barW, 1) + 3, y + 3);

    y += 8;
  }
  y += 6;

  // ── Course list ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text('SELECTED COURSES', 14, y);
  y += 6;

  const byYear = {};
  for (const c of selected) {
    if (!byYear[c.year]) byYear[c.year] = [];
    byYear[c.year].push(c);
  }

  for (const year of Object.keys(byYear).sort()) {
    // Year header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    doc.text(`Year ${year}`, 14, y);
    y += 5;

    for (const course of byYear[year]) {
      // Page break check
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const cat = getCatMeta(course.category);
      const cr = parseInt(cat.color.slice(1,3),16);
      const cg = parseInt(cat.color.slice(3,5),16);
      const cb = parseInt(cat.color.slice(5,7),16);

      // Course row
      doc.setFillColor(247, 245, 240);
      doc.rect(14, y - 3.5, W - 28, 10, 'F');
      doc.setDrawColor(...BORDER);
      doc.rect(14, y - 3.5, W - 28, 10, 'S');

      // Cat indicator strip
      doc.setFillColor(cr, cg, cb);
      doc.rect(14, y - 3.5, 2.5, 10, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BLACK);
      doc.text(course.name, 21, y + 1.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GREY);
      doc.text(course.id, 21, y + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(cr, cg, cb);
      doc.text(`${course.ects}`, W - 14 - 16, y + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...GREY);
      doc.text('ECTS', W - 14 - 10, y + 5.5);

      y += 13;
    }
    y += 3;
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(...BLACK);
    doc.rect(0, 287, W, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 135, 130);
    doc.text(`Tilburg University · Course Credit Planner · ${date}`, 14, 293);
    doc.text(`Page ${p} of ${pageCount}`, W - 14, 293, { align: 'right' });
  }

  doc.save(`tilburg-course-plan-${Date.now()}.pdf`);
}
