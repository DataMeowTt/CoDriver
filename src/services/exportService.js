/**
 * Export service for generating PDF, DOCX, TXT, and JSON files
 */
import { formatDate, formatDurationText, formatTimestamp } from '../utils/formatTime';

/**
 * Export meeting as TXT
 */
export function exportTXT(meeting, segments) {
  let content = `Cuộc họp: ${meeting.title}\n`;
  content += `Ngày: ${formatDate(meeting.date)}\n`;
  content += `Thời lượng: ${formatDurationText(meeting.duration)}\n`;
  content += `${'='.repeat(50)}\n\n`;
  content += `TRANSCRIPT\n${'─'.repeat(30)}\n\n`;

  for (const seg of segments) {
    const ts = formatTimestamp(seg.startTime);
    const speaker = seg.speaker ? ` — ${seg.speaker}` : '';
    content += `${ts}${speaker}: ${seg.text}\n`;
  }

  downloadFile(content, `${meeting.title || 'meeting'}.txt`, 'text/plain');
}

/**
 * Export meeting as JSON
 */
export function exportJSON(meeting, segments, summary) {
  const data = {
    meeting: {
      title: meeting.title,
      date: meeting.date,
      duration: meeting.duration,
      status: meeting.status,
    },
    transcript: segments.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      speaker: s.speaker,
      text: s.text,
    })),
    summary: summary || null,
  };

  const content = JSON.stringify(data, null, 2);
  downloadFile(content, `${meeting.title || 'meeting'}.json`, 'application/json');
}

/**
 * Export meeting as PDF
 */
export async function exportPDF(meeting, segments, summary) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.text(meeting.title || 'Meeting Report', 14, y);
  y += 10;

  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Date: ${formatDate(meeting.date)} | Duration: ${formatDurationText(meeting.duration)}`, 14, y);
  y += 10;

  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 10;

  // Summary section
  if (summary) {
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Summary', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(60);

    if (summary.brief) {
      const lines = doc.splitTextToSize(summary.brief, 170);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 5;
    }

    if (summary.keyPoints?.length) {
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text('Key Points:', 14, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(60);
      for (const point of summary.keyPoints) {
        const lines = doc.splitTextToSize(`• ${point}`, 165);
        doc.text(lines, 18, y);
        y += lines.length * 5 + 2;
        if (y > 270) { doc.addPage(); y = 20; }
      }
      y += 5;
    }

    if (summary.tasks?.length) {
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text('Action Items:', 14, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [['Task', 'Assignee', 'Deadline']],
        body: summary.tasks.map((t) => [t.task, t.assignee || '-', t.deadline || '-']),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 211, 238] },
        margin: { left: 14 },
      });

      y = doc.lastAutoTable.finalY + 10;
    }
  }

  // Transcript section
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Transcript', 14, y);
  y += 8;

  doc.setFontSize(9);
  for (const seg of segments) {
    const ts = formatTimestamp(seg.startTime);
    const speaker = seg.speaker ? ` - ${seg.speaker}` : '';
    const line = `[${ts}]${speaker}: ${seg.text}`;
    const lines = doc.splitTextToSize(line, 170);
    doc.setTextColor(100);
    doc.text(lines, 14, y);
    y += lines.length * 4.5 + 2;
    if (y > 275) { doc.addPage(); y = 20; }
  }

  doc.save(`${meeting.title || 'meeting'}.pdf`);
}

/**
 * Export meeting as DOCX
 */
export async function exportDOCX(meeting, segments, summary) {
  const docx = await import('docx');
  const { saveAs } = await import('file-saver');

  const children = [];

  // Title
  children.push(
    new docx.Paragraph({
      children: [new docx.TextRun({ text: meeting.title || 'Meeting Report', bold: true, size: 32 })],
      heading: docx.HeadingLevel.TITLE,
    })
  );

  // Metadata
  children.push(
    new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: `Ngày: ${formatDate(meeting.date)} | Thời lượng: ${formatDurationText(meeting.duration)}`,
          color: '888888',
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Summary
  if (summary?.brief) {
    children.push(
      new docx.Paragraph({
        children: [new docx.TextRun({ text: 'Tóm tắt', bold: true, size: 26 })],
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 300 },
      })
    );
    children.push(
      new docx.Paragraph({
        children: [new docx.TextRun({ text: summary.brief, size: 22 })],
        spacing: { after: 200 },
      })
    );
  }

  // Key Points
  if (summary?.keyPoints?.length) {
    children.push(
      new docx.Paragraph({
        children: [new docx.TextRun({ text: 'Ý chính', bold: true, size: 24 })],
        heading: docx.HeadingLevel.HEADING_2,
      })
    );
    for (const point of summary.keyPoints) {
      children.push(
        new docx.Paragraph({
          children: [new docx.TextRun({ text: point, size: 22 })],
          bullet: { level: 0 },
        })
      );
    }
  }

  // Transcript
  children.push(
    new docx.Paragraph({
      children: [new docx.TextRun({ text: 'Transcript', bold: true, size: 26 })],
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 400 },
    })
  );

  for (const seg of segments) {
    const ts = formatTimestamp(seg.startTime);
    const speaker = seg.speaker ? ` — ${seg.speaker}` : '';
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({ text: `${ts}${speaker}: `, bold: true, size: 20, color: '22D3EE' }),
          new docx.TextRun({ text: seg.text, size: 20 }),
        ],
        spacing: { after: 80 },
      })
    );
  }

  const doc = new docx.Document({
    sections: [{ children }],
    creator: 'Local AI Meeting Recorder',
  });

  const blob = await docx.Packer.toBlob(doc);
  saveAs(blob, `${meeting.title || 'meeting'}.docx`);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

// Helper to download a file
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
