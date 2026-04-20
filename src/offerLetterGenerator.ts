import { PDFDocument, rgb, PDFPage, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export interface SalaryComponent {
  label: string;
  monthly: number;
  annual: number;
}

export interface OfferLetterData {
  firstName: string;
  fullName: string;
  position: string;
  date: string;
  joiningDate: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: string;
  salaryComponents: SalaryComponent[];
  commissionPercent: string;
  probationMonths: string;
  noticeProbation: string;
  noticeConfirmed: string;
  leaveDays: string;
  signatoryName: string;
  signatoryTitle: string;
}

// ── Layout — measured pixel-precisely from reference PDF ────────────────────
const PW         = 595.4;
const LEFT       = 56.0;
const RIGHT      = 536.0;
const CW         = RIGHT - LEFT;

// Safe content zone (measured from letterhead template)
const CONTENT_TOP = 645.0;   // first content line y (from bottom), was 718 — WRONG
const CONTENT_BOT = 162.0;   // last content line y (footer begins below)

// Colors
const DARK = rgb(0.102, 0.102, 0.118);
const GRAY = rgb(0.45,  0.45,  0.45);

// Font sizes — legible, up from original 9pt
const FS_TITLE = 10.0;
const FS_HEAD  = 10.0;
const FS_BODY  = 11.5;
const FS_SMALL = 10.5;

// Line heights — measured from reference: body mid-to-mid = 18pt, para gap = 18pt extra
const LH_BODY  = 19.5;
const LH_SMALL = 19.5;
const LH_PARA  = 16.5;

// ── Text utilities ──────────────────────────────────────────────────────────

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawJustified(
  page: PDFPage, text: string, x: number, y: number,
  font: PDFFont, size: number, maxW: number, lh: number, color = DARK
): number {
  const lines = wrap(text, font, size, maxW);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    if (!isLast && line.includes(" ")) {
      const ws = line.split(" ");
      const tw = ws.reduce((s, w) => s + font.widthOfTextAtSize(w, size), 0);
      const sp = (maxW - tw) / (ws.length - 1);
      let cx = x;
      for (const w of ws) {
        page.drawText(w, { x: cx, y, size, font, color });
        cx += font.widthOfTextAtSize(w, size) + sp;
      }
    } else {
      page.drawText(line, { x, y, size, font, color });
    }
    y -= lh;
  }
  return y;
}

// Mixed bold/regular justified paragraph
function drawJustifiedMixed(
  page: PDFPage,
  parts: [string, PDFFont, number][],
  x: number, y: number, maxW: number, lh: number, color = DARK
): number {
  interface WD { text: string; font: PDFFont; size: number; w: number; }
  const allWords: WD[] = [];
  const SPACE = parts[0][1].widthOfTextAtSize(" ", parts[0][2]);

  for (const [text, font, size] of parts) {
    for (const rw of text.split(" ").filter(w => w.length > 0))
      allWords.push({ text: rw, font, size, w: font.widthOfTextAtSize(rw, size) });
  }

  const lines: WD[][] = [];
  let cur: WD[] = [], curW = 0;
  for (const wd of allWords) {
    const needed = cur.length ? SPACE + wd.w : wd.w;
    if (cur.length && curW + needed > maxW) { lines.push(cur); cur = [wd]; curW = wd.w; }
    else { cur.push(wd); curW += needed; }
  }
  if (cur.length) lines.push(cur);

  for (let li = 0; li < lines.length; li++) {
    const ln = lines[li];
    const isLast = li === lines.length - 1;
    const totalW = ln.reduce((s, w) => s + w.w, 0);
    const sp = (isLast || ln.length === 1) ? SPACE : (maxW - totalW) / (ln.length - 1);
    let cx = x;
    for (let wi = 0; wi < ln.length; wi++) {
      page.drawText(ln[wi].text, { x: cx, y, size: ln[wi].size, font: ln[wi].font, color });
      cx += ln[wi].w + (wi < ln.length - 1 ? sp : 0);
    }
    y -= lh;
  }
  return y;
}

function dt(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = DARK) {
  page.drawText(text, { x, y, size, font, color });
}

function fmt(n: number): string { return n.toLocaleString("en-IN"); }

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function b100(x: number): string { return x < 20 ? ones[x] : tens[Math.floor(x/10)] + (x%10 ? " "+ones[x%10] : ""); }
  function b1k(x: number): string  { return x < 100 ? b100(x) : ones[Math.floor(x/100)]+" Hundred"+(x%100 ? " "+b100(x%100) : ""); }
  let r = "";
  if (n >= 100000) { r += b1k(Math.floor(n/100000))+" Lakh ";  n %= 100000; }
  if (n >= 1000)   { r += b100(Math.floor(n/1000))+" Thousand "; n %= 1000; }
  if (n > 0) r += b1k(n);
  return r.trim();
}

// ── PAGE 1: Offer Letter Body ───────────────────────────────────────────────
function page1(page: PDFPage, d: OfferLetterData, fr: PDFFont, fb: PDFFont, fsb: PDFFont) {
  let y = CONTENT_TOP;                          // 665 — safely inside header
  const totalMonthly = d.salaryComponents.reduce((s, c) => s + c.monthly, 0);

  // Title — centered bold
  const title = "OFFER LETTER";
  dt(page, title, (PW - fb.widthOfTextAtSize(title, FS_TITLE)) / 2, y, fb, FS_TITLE);
  y -= 26;

  // Date — right aligned
  dt(page, "Date:", 418, y, fsb, FS_BODY);
  dt(page, " " + d.date,  445, y, fb,  FS_BODY);
  y -= 22;

  // Salutation
  dt(page, `Dear ${d.firstName},`, LEFT, y, fr, FS_BODY);
  y -= 20;

  // Para 1
  y = drawJustifiedMixed(page, [
    ["We are pleased to extend an offer to you for the position of ", fr, FS_BODY],
    [d.position, fb, FS_BODY],
    [" at Skymurals Advertisement Private Limited. We believe your experience and mindset align well with our vision to build the future of Digital Out-of-Home (DOOH) advertising in Rajkot.", fr, FS_BODY],
  ], LEFT, y, CW, LH_BODY);
  y -= LH_PARA;

  // Para 2
  y = drawJustifiedMixed(page, [
    ["Your appointment will commence on ", fr, FS_BODY],
    [d.joiningDate + ".", fb, FS_BODY],
    [" You will report directly to the ", fr, FS_BODY],
    ["Co-Founder/Business Developer", fb, FS_BODY],
    [" and be based out of our Rajkot office, with travel as required. The official working hours will be from ", fr, FS_BODY],
    [d.workingHoursStart + " to " + d.workingHoursEnd + ",", fb, FS_BODY],
    [" " + d.workingDays + ".", fr, FS_BODY],
  ], LEFT, y, CW, LH_BODY);
  y -= LH_PARA;

  // Para 3 — CTC
  const commissionClause = Number(d.commissionPercent) > 0
    ? [
        [", the structure of which is detailed in Annexure A. In addition to your fixed compensation, you will be eligible for a ", fr, FS_BODY] as [string, PDFFont, number],
        ["sales commission of " + d.commissionPercent + "%", fb, FS_BODY] as [string, PDFFont, number],
        [" on net revenue collected from closures directly executed by you, subject to company billing and realization policies.", fr, FS_BODY] as [string, PDFFont, number],
      ]
    : [
        [", the structure of which is detailed in Annexure A. This role carries a fixed compensation package with no variable sales commission component.", fr, FS_BODY] as [string, PDFFont, number],
      ];
  y = drawJustifiedMixed(page, [
    ["Your monthly cost-to-company (CTC) will be ", fr, FS_BODY],
    ["\u20b9" + fmt(totalMonthly) + " (Rupees " + numberToWords(totalMonthly) + " only)", fb, FS_BODY],
    ...commissionClause,
  ], LEFT, y, CW, LH_BODY);
  y -= LH_PARA;

  // Para 4
  y = drawJustified(page,
    "The detailed commission structure, eligibility conditions, and payout terms are outlined in Annexure B.",
    LEFT, y, fr, FS_BODY, CW, LH_BODY);
  y -= LH_PARA;

  // Para 5 — Probation
  y = drawJustifiedMixed(page, [
    ["You will initially be on a ", fr, FS_BODY],
    [d.probationMonths + "-month probationary period,", fb, FS_BODY],
    [" during which your performance, cultural alignment, and business impact will be evaluated. Upon satisfactory completion, your position will be confirmed with a written notice from management.", fr, FS_BODY],
  ], LEFT, y, CW, LH_BODY);
  y -= LH_PARA;

  // Para 6 — Leave
  y = drawJustifiedMixed(page, [
    ["Leave entitlements at Skymurals follow a lean and efficient policy, designed to support productivity while balancing personal needs. You will be entitled to ", fr, FS_BODY],
    [d.leaveDays + " days of paid leave per year,", fb, FS_BODY],
    [" accrued monthly, as outlined in Annexure C.", fr, FS_BODY],
  ], LEFT, y, CW, LH_BODY);
}

// ── PAGE 2: Confidentiality / Termination / Signatory ──────────────────────
function page2(page: PDFPage, d: OfferLetterData, fr: PDFFont, fb: PDFFont) {
  let y = CONTENT_TOP;

  const paras = [
    "You are expected to maintain the highest standards of professionalism, confidentiality, and integrity during your association with Skymurals. All work produced and all information you access will remain the intellectual property of the company, and you must not share or disclose sensitive business information during or after your employment.",
    "If any company assets\u2014such as electronic devices, documents, or tools\u2014are issued to you during your employment, you are expected to maintain them in good condition. Any loss, damage, or misuse of such company property due to negligence or intentional actions may result in recovery of costs or disciplinary action as deemed appropriate by management.",
    `Should either party wish to terminate the employment, a ${d.noticeProbation}-day notice period during probation or a ${d.noticeConfirmed}-day notice period post-confirmation will apply, or salary in lieu of notice. Termination for misconduct, breach of trust, or policy violations may be enforced with immediate effect.`,
    "We look forward to your contributions to this exciting growth phase. Please review the attached annexures carefully and sign the acknowledgment on the last page to confirm your acceptance of this offer.",
  ];

  for (const p of paras) {
    y = drawJustified(page, p, LEFT, y, fr, FS_BODY, CW, LH_BODY);
    y -= LH_PARA;
  }

  y -= 20;
  dt(page, "Warm regards,",                                    LEFT, y, fr, FS_BODY);          y -= LH_BODY;
  dt(page, "For Skymurals Advertisement Private Limited",      LEFT, y, fr, FS_BODY);          y -= 40;
  dt(page, d.signatoryName,                                    LEFT, y, fb, FS_BODY);          y -= LH_BODY;
  dt(page, d.signatoryTitle,                                   LEFT, y, fr, FS_BODY);          y -= LH_BODY;
  dt(page, "contact@skyarcads.com | +918849611341",            LEFT, y, fr, FS_SMALL, GRAY);
}

// ── PAGE 3: Annexure A + Annexure B ────────────────────────────────────────
function page3(page: PDFPage, d: OfferLetterData, fr: PDFFont, fb: PDFFont) {
  let y = CONTENT_TOP;

  // ── Annexure A header ──
  dt(page, "Annexure A - Salary Structure", LEFT, y, fb, FS_HEAD);
  y -= 22;

  // Table geometry — columns match reference vertical borders: 56, 240, 388, 536
  const COL2   = 240.0;
  const COL3   = 388.0;
  const ROW_H  = 17.0;
  const PAD    =  6.0;
  const rows   = d.salaryComponents.length;
  const tableTop = y + 4;
  const tableBot = tableTop - (rows + 2) * ROW_H;  // header row + data rows + total row

  // Horizontal rules
  const hrule = (yy: number, t = 0.45) =>
    page.drawLine({ start: { x: LEFT, y: yy }, end: { x: RIGHT, y: yy }, thickness: t, color: rgb(0.2, 0.2, 0.2) });
  // Vertical rules — full table height
  const vrule = (xx: number) =>
    page.drawLine({ start: { x: xx, y: tableTop }, end: { x: xx, y: tableBot }, thickness: 0.45, color: rgb(0.2, 0.2, 0.2) });

  for (let i = 0; i <= rows + 2; i++) {
    hrule(tableTop - i * ROW_H, (i === 0 || i === 1 || i === rows + 2) ? 0.8 : 0.4);
  }
  [LEFT, COL2, COL3, RIGHT].forEach(vrule);

  // Header row — blue-tinted bg matching Skymurals brand
  page.drawRectangle({ x: LEFT, y: tableTop - ROW_H, width: CW, height: ROW_H, color: rgb(0.863, 0.902, 0.961) });
  const hy = tableTop - ROW_H + PAD;
  dt(page, "Component",         LEFT + PAD, hy, fb, FS_SMALL);
  dt(page, "Monthly (\u20b9)",  COL2 + PAD, hy, fb, FS_SMALL);
  dt(page, "Annual (\u20b9)",   COL3 + PAD, hy, fb, FS_SMALL);

  // Data rows
  let totM = 0, totA = 0;
  d.salaryComponents.forEach((c, i) => {
    const ry = tableTop - (i + 2) * ROW_H + PAD;
    dt(page, c.label,         LEFT + PAD, ry, fr, FS_SMALL);
    dt(page, fmt(c.monthly),  COL2 + PAD, ry, fr, FS_SMALL);
    dt(page, fmt(c.annual),   COL3 + PAD, ry, fr, FS_SMALL);
    totM += c.monthly;
    totA += c.annual;
  });

  // Total row — shaded
  const totRowY = tableBot;
  page.drawRectangle({ x: LEFT, y: totRowY, width: CW, height: ROW_H, color: rgb(0.863, 0.902, 0.961) });
  const ty = totRowY + PAD;
  dt(page, "Total (CTC)",  LEFT + PAD, ty, fb, FS_SMALL);
  dt(page, fmt(totM),      COL2 + PAD, ty, fb, FS_SMALL);
  dt(page, fmt(totA),      COL3 + PAD, ty, fb, FS_SMALL);

  y = tableBot - 24;

  // ── Annexure B ──
  dt(page, "Annexure B \u2013 Incentives & Variable Pay Structure", LEFT, y, fb, FS_HEAD);
  y -= 18;

  y = drawJustified(page,
    "After completing the probation, you will be eligible for performance-linked variable pay, structured as follows,",
    LEFT, y, fr, FS_BODY, CW, LH_BODY);
  y -= 6;

  for (const b of [
    `A ${d.commissionPercent}% commission on net revenue collected from direct sales closures personally executed by you. The commission shall be calculated monthly and disbursed only after the company has fully realized and verified payment collections.`,
    "An annual performance bonus may be considered upon completion of one full year of continuous service, subject to a formal year-end performance review. The grant and quantum of such bonus shall be variable in nature and dependent on overall company performance, individual contribution, and management evaluation.",
  ]) {
    page.drawText("\u2022", { x: LEFT + 8, y, size: FS_BODY, font: fr, color: DARK });
    y = drawJustified(page, b, LEFT + 22, y, fr, FS_SMALL, CW - 22, LH_SMALL);
    y -= 6;
  }

  y -= 4;
  drawJustified(page,
    "All variable pay, including sales commission and annual bonuses, shall be purely discretionary and subject to company policies. The management reserves the right to revise, withhold, defer, or withdraw any variable payout in case of non-performance, policy violations, client disputes, or adverse business conditions.",
    LEFT, y, fr, FS_SMALL, CW, LH_SMALL);
}

// ── PAGE 4: Annexure C + Acknowledgment ────────────────────────────────────
function page4(page: PDFPage, d: OfferLetterData, fr: PDFFont, fb: PDFFont) {
  let y = CONTENT_TOP;

  dt(page, "Annexure C \u2013 Leave Policy", LEFT, y, fb, FS_HEAD);
  y -= 18;

  y = drawJustified(page,
    "Skymurals maintains a streamlined and minimal leave policy to ensure business continuity, operating with a small, high-responsibility team.",
    LEFT, y, fr, FS_BODY, CW, LH_BODY);
  y -= 6;

  for (const b of [
    `You are entitled to ${d.leaveDays} days of paid leave annually, accruing at 1 day per completed month of service. These leaves are combined for casual and medical use and require pre-approval from your reporting manager. Unused leaves cannot be carried forward or encashed.`,
    "Leave requests must be submitted in advance. For absences exceeding 2 days due to illness, a medical certificate is required. The leave policy applies only after the probation period. The company observes public holidays according to the calendar year, and these will be communicated in advance.",
  ]) {
    page.drawText("\u2022", { x: LEFT + 8, y, size: FS_BODY, font: fr, color: DARK });
    y = drawJustified(page, b, LEFT + 22, y, fr, FS_SMALL, CW - 22, LH_SMALL);
    y -= 6;
  }

  y = drawJustified(page,
    "Uninformed or frequent leave without coordination may affect performance evaluation and eligibility for bonuses.",
    LEFT, y, fr, FS_SMALL, CW, LH_SMALL);
  y -= 28;

  dt(page, "Acknowledgment and Acceptance", LEFT, y, fb, FS_HEAD);
  y -= 18;

  y = drawJustified(page,
    `I, ${d.fullName}, hereby accept the offer for the position of ${d.position} at Skymurals Advertisement Private Limited. I confirm that I have read and understood all the terms and annexures of this offer. I agree to abide by the responsibilities, expectations, and policies outlined herein.`,
    LEFT, y, fr, FS_BODY, CW, LH_BODY);
  y -= 36;

  dt(page, "Signature:", LEFT, y, fb, FS_BODY);
  page.drawLine({ start: { x: LEFT + 64, y: y - 2 }, end: { x: LEFT + 240, y: y - 2 }, thickness: 0.7, color: DARK });
  y -= 20;
  dt(page, "Name:", LEFT, y, fb, FS_BODY);
  dt(page, d.fullName.toUpperCase(), LEFT + 42, y, fr, FS_BODY);
  y -= 20;
  dt(page, "Date:", LEFT, y, fb, FS_BODY);
  page.drawLine({ start: { x: LEFT + 40, y: y - 2 }, end: { x: LEFT + 240, y: y - 2 }, thickness: 0.7, color: DARK });
}

// ── Main export ─────────────────────────────────────────────────────────────
export async function generateOfferLetterPDF(data: OfferLetterData): Promise<Uint8Array> {
  const [lhBytes, frBytes, fbBytes, fsbBytes] = await Promise.all([
    fetch("/Skymurals_Letterhead.pdf").then(r => r.arrayBuffer()),
    fetch("/fonts/PlusJakartaSans-Regular.ttf").then(r => r.arrayBuffer()),
    fetch("/fonts/PlusJakartaSans-Bold.ttf").then(r => r.arrayBuffer()),
    fetch("/fonts/PlusJakartaSans-SemiBold.ttf").then(r => r.arrayBuffer()),
  ]);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fr  = await doc.embedFont(frBytes);
  const fb  = await doc.embedFont(fbBytes);
  const fsb = await doc.embedFont(fsbBytes);

  for (let i = 0; i < 4; i++) {
    const d = await PDFDocument.load(lhBytes);
    const [p] = await doc.copyPages(d, [0]);
    doc.addPage(p);
  }

  page1(doc.getPage(0), data, fr, fb, fsb);
  page2(doc.getPage(1), data, fr, fb);
  page3(doc.getPage(2), data, fr, fb);
  page4(doc.getPage(3), data, fr, fb);

  return await doc.save();
}
