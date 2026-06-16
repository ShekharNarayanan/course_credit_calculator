// ── pdf.js ────────────────────────────────
// Generates a LOGO certificate readiness report PDF

import { getEisen, getTracks } from './data.js';
import { calcProgress, calcTrackSummary, courseKey } from './progress.js';

function cleanName(naam) {
  return naam.replace(/\s*=\s*$/, '').replace(/\s+/g, ' ').replace(/^[●\s]+/, '').trim();
}

export function generatePdf(selectedTracks, selectedCourses) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W    = 210;
  const eisen  = getEisen();
  const tracks = getTracks().filter(t => selectedTracks.has(t.id));
  const progressMap = calcProgress(selectedCourses);
  const summary     = calcTrackSummary(selectedCourses, selectedTracks, progressMap);
  const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Palette ──
  const BLACK  = [17, 24, 39];
  const GREY   = [107, 114, 128];
  const ACCENT = [37, 99, 235];
  const BG     = [244, 246, 250];
  const BORDER = [228, 232, 240];
  const GOOD   = [5, 150, 105];
  const WARN   = [217, 119, 6];
  const DANGER = [220, 38, 38];

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return [r, g, b];
  }

  let y = 0;

  function newPageIfNeeded(needed = 20) {
    if (y + needed > 275) {
      doc.addPage();
      y = 16;
    }
  }

  // ── Cover header ──
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, W, 26, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, 26, W, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('Tilburg University – TSB', 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 185, 200);
  doc.text('LOGO Certificaat Voortgangsrapport', 14, 18);
  doc.text(date, W - 14, 18, { align: 'right' });

  y = 38;

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...BLACK);
  doc.text('LOGO-certificering', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text('Overzicht per geselecteerd track', 14, y);
  y += 12;

  // ── Track summary boxes ──
  const boxW = Math.min((W - 28 - (tracks.length - 1) * 4) / tracks.length, 55);
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const s = summary[track.id];
    const bx = 14 + i * (boxW + 4);
    const rgb = hexToRgb(track.kleur);

    doc.setFillColor(...BG);
    doc.roundedRect(bx, y, boxW, 24, 2, 2, 'F');
    doc.setDrawColor(...rgb);
    doc.roundedRect(bx, y, boxW, 24, 2, 2, 'S');
    doc.setFillColor(...rgb);
    doc.rect(bx, y, 2.5, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...rgb);
    doc.text(`${s?.eisMet ?? 0}/${s?.eisTotal ?? 0}`, bx + 6, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...GREY);
    const shortName = track.naam.length > 28 ? track.naam.slice(0, 26) + '…' : track.naam;
    doc.text(shortName, bx + 6, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.text('eisen behaald', bx + 6, y + 21);
  }
  y += 32;

  // ── Per-eis table per track ──
  for (const track of tracks) {
    newPageIfNeeded(30);
    const rgb = hexToRgb(track.kleur);

    // Track heading
    doc.setFillColor(...BLACK);
    doc.rect(14, y, W - 28, 10, 'F');
    doc.setFillColor(...rgb);
    doc.rect(14, y, 3, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(track.naam, 21, y + 6.5);
    y += 14;

    for (const eis of eisen) {
      const p = progressMap[eis.id]?.[track.id];
      if (!p || p.required === 0) continue;

      const trackData  = eis.tracks[track.id];
      const done       = trackData?.vakken.filter(vak => selectedCourses.has(courseKey(eis.id, track.id, vak.code))) ?? [];
      const missing    = trackData?.vakken.filter(vak => !selectedCourses.has(courseKey(eis.id, track.id, vak.code))) ?? [];

      // Row height: base + done line (if any) + missing line (if incomplete)
      const hasDone    = done.length > 0;
      const hasMissing = !p.complete && missing.length > 0;
      const rowH       = 11 + (hasDone ? 7 : 0) + (hasMissing ? 7 : 0);

      newPageIfNeeded(rowH + 4);

      const statusColor = p.complete ? GOOD : p.earned > 0 ? WARN : DANGER;

      // Row bg
      doc.setFillColor(...BG);
      doc.rect(14, y - 3, W - 28, rowH, 'F');
      doc.setDrawColor(...BORDER);
      doc.rect(14, y - 3, W - 28, rowH, 'S');

      // Status strip
      doc.setFillColor(...statusColor);
      doc.rect(14, y - 3, 2.5, rowH, 'F');

      // Eis name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BLACK);
      const eisShort = eis.omschrijving.length > 60 ? eis.omschrijving.slice(0, 58) + '…' : eis.omschrijving;
      doc.text(eisShort, 21, y + 2);

      // EC progress
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...statusColor);
      doc.text(`${p.earned} / ${p.required} EC`, W - 14, y + 2, { align: 'right' });

      let lineY = y + 7;

      // Completed courses
      if (hasDone) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...GREY);
        doc.text('✓', 21, lineY);
        const doneStr = done.map(v => cleanName(v.naam || v.code)).join(', ');
        const doneTrunc = doneStr.length > 105 ? doneStr.slice(0, 103) + '…' : doneStr;
        doc.text(doneTrunc, 26, lineY);
        lineY += 7;
      }

      // Missing courses (recommendation)
      if (hasMissing) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(...WARN);
        doc.text('Nog nodig:', 21, lineY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...BLACK);
        const misStr = missing.map(v => `${cleanName(v.naam || v.code)} (+${v.ec_bijdrage ?? '?'} EC)`).join(', ');
        const misTrunc = misStr.length > 95 ? misStr.slice(0, 93) + '…' : misStr;
        doc.text(misTrunc, 40, lineY);
        lineY += 7;
      }

      y += rowH + 3;
    }
    y += 6;
  }

  // ── Footer on all pages ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(...BLACK);
    doc.rect(0, 288, W, 9, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 125, 140);
    doc.text(`Tilburg University · LOGO Certificaat Checker · ${date}`, 14, 293.5);
    doc.text(`Pagina ${p} van ${pageCount}`, W - 14, 293.5, { align: 'right' });
  }

  doc.save(`LOGO-rapport-${Date.now()}.pdf`);
}