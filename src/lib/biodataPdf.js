// Turning the biodata sheet on screen into a PDF file.
//
// The sheet is rasterised rather than re-typeset. It is Bangla-first, and a PDF
// text engine without OpenType shaping renders Bangla conjuncts and reordered
// vowels wrongly — বিয়ে comes out as separate glyphs in the wrong order. The
// browser has already shaped and laid out the sheet correctly, so what it drew
// is what the file carries. The cost is that the text is an image: not
// selectable, not searchable. For a sheet whose whole purpose is to be printed
// or forwarded, that is the right trade.

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const A4 = { width: 210, height: 297 }; // mm
const MARGIN = 10;
const FOOT = 8; // room under the sheet for the stamp line

const PRINT_W = A4.width - MARGIN * 2;
const PRINT_H = A4.height - MARGIN * 2 - FOOT;

// How many A4 pages a sheet of these on-screen proportions comes to. The
// preview bar reads this so it counts pages the way the file does, rather than
// guessing from how many sections are switched on.
export const pageCountFor = (widthPx, heightPx) =>
  (widthPx > 0 ? Math.max(1, Math.ceil(((heightPx / widthPx) * PRINT_W) / PRINT_H)) : 1);

// Both a faint diagonal across the page and a line along the foot: the first
// survives a photograph of a printout, the second stays legible. Either one
// traces a forwarded sheet back to the manager who released it.
function stamp(pdf, text, page, pages) {
  pdf.setFont('helvetica', 'normal');

  pdf.saveGraphicsState();
  pdf.setGState(new pdf.GState({ opacity: 0.07 }));
  pdf.setTextColor(27, 50, 32);
  pdf.setFontSize(46);
  pdf.text(text, A4.width / 2, A4.height / 2, { align: 'center', angle: 30 });
  pdf.restoreGraphicsState();

  pdf.setFontSize(7.5);
  pdf.setTextColor(130, 130, 130);
  pdf.text(text, MARGIN, A4.height - MARGIN + 1);
  pdf.text(`Page ${page} of ${pages}`, A4.width - MARGIN, A4.height - MARGIN + 1, { align: 'right' });
}

// Turn a file name fragment into something a filesystem will accept.
const slug = (s) => String(s || '').trim().replace(/[^\wঀ-৿-]+/g, '-').replace(/^-+|-+$/g, '');

// Rasterise `el`, page it onto A4, stamp each page, and hand the file to the
// browser. Returns how many pages it came to, so the caller can say.
export async function downloadBiodataPdf(el, { name, prn, watermark }) {
  const canvas = await html2canvas(el, {
    scale: 2, // legible at print size without a file nobody can email
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    // html2canvas draws a clone of the node, and the clone re-runs any CSS
    // animation from its first frame. The sheet fades in from opacity 0
    // (ss-fade in global.css), so without this the captured page is blank
    // white — a valid PDF of nothing, which is worse than an error.
    onclone: (_doc, clone) => {
      clone.style.animation = 'none';
      clone.style.opacity = '1';
      clone.style.transform = 'none';
      clone.querySelectorAll('*').forEach((node) => { node.style.animation = 'none'; });
    },
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pxPerMm = canvas.width / PRINT_W;
  const pageHeightPx = Math.floor(PRINT_H * pxPerMm);
  const pages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  for (let page = 0; page < pages; page += 1) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - page * pageHeightPx);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext('2d');
    // The sheet's own background stops at its edge; the page around it is white.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, page * pageHeightPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN, MARGIN, PRINT_W, sliceHeight / pxPerMm);
    stamp(pdf, watermark, page + 1, pages);
  }

  pdf.save([slug(name), slug(prn), 'biodata'].filter(Boolean).join('-') + '.pdf');
  return { pages };
}
