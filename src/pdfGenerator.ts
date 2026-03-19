import { PDFDocument, rgb, PDFPage, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export interface AgreementData {
  brandName: string;
  clientName: string;
  addressLine1: string;
  addressLine2: string;
  date: string;
  totalSlots: string;
  startDate: string;
  endDate: string;
  campaignDuration: string;
  campaignValue: string;
  agreementNumber: string;
  locationName: string;
  enabledClauses: number[];
}

export const ANNEXURE_CLAUSES = [
  "The campaign will run as per the booking details agreed in the main document, and the display schedule will be maintained to provide the intended exposure to the Client\u2019s brand.",
  "In case of operational requirements, maintenance, or regulatory directions, minor adjustments in slot timings or sequence may be made, while ensuring the overall visibility commitment is met.",
  "All bookings are confirmed on a non-refundable basis. In case of unavoidable schedule changes, equivalent display time will be provided within the booking period.",
  "Creative material for the campaign should be shared at least five (5) working days before the start date in the format requested. Timely submission will help ensure smooth campaign delivery.",
  "All content must meet applicable legal, ethical, and brand safety standards. Skymurals may request alternate material if the submitted content does not meet these standards.",
  "The Client confirms that they hold the necessary rights to use the provided content and permits Skymurals to display it for the duration of the booking.",
  "All campaign-related information shared between the parties will remain confidential and will not be disclosed to third parties without consent, except where required by law.",
  "Payment terms: The Client shall make the entire payment for the booking in full and in advance before the campaign start date. No campaign will commence until the full advance payment has been received and cleared.",
  "In the event of unforeseen circumstances such as natural calamities, technical breakdowns, government-mandated campaigns, or any other events beyond the reasonable control of Skymurals, the company will make reasonable efforts to resume or adjust the advertising schedule to meet the agreed exposure levels. However, under no circumstances shall Skymurals be liable to provide any financial compensation, refunds, or monetary adjustments for such interruptions.",
  "This Agreement shall be governed by the laws of India, and any disputes shall be subject to the jurisdiction of the courts in Mumbai, Maharashtra.",
];

const CLAUSE_8_SUBS = [
  "a. The Client shall provide Post-Dated Cheques (PDCs) in advance, covering the entire contract period at the time of signing this Agreement if the contract period exceeds 3 months.",
  "b. Each PDC will be dated in accordance with the agreed-upon campaign schedule and will be deposited on or after its respective date.",
  "c. All payments are subject to applicable taxes, which will be invoiced at the prevailing rate.",
  "d. In the event of a dishonoured cheque, the Client shall replace it within three (3) working days to avoid disruption of the campaign.",
];

const PW = 595.44;
const LEFT = 56;
const RIGHT = 540;
const CW = RIGHT - LEFT;
const TOP = 650;
const DARK = rgb(0.102, 0.102, 0.118);
const GRAY = rgb(0.4, 0.4, 0.4);
const FS = 9.0; // body font size
const FS_B = 8.5; // bullet font size
const LH = 13.5; // body line height
const LH_B = 12.5; // bullet line height

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxW: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawJustified(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  maxW: number,
  lh: number,
): number {
  const lines = wrap(text, font, size, maxW);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    if (!isLast && line.includes(" ")) {
      const words = line.split(" ");
      if (words.length > 1) {
        const tw = words.reduce(
          (s, w) => s + font.widthOfTextAtSize(w, size),
          0,
        );
        const sp = (maxW - tw) / (words.length - 1);
        let cx = x;
        for (const w of words) {
          page.drawText(w, { x: cx, y, size, font, color: DARK });
          cx += font.widthOfTextAtSize(w, size) + sp;
        }
      } else {
        page.drawText(line, { x, y, size, font, color: DARK });
      }
    } else {
      page.drawText(line, { x, y, size, font, color: DARK });
    }
    y -= lh;
  }
  return y;
}

// Draw mixed regular + bold text on one line
function drawMixed(
  page: PDFPage,
  parts: [string, PDFFont, number][],
  x: number,
  y: number,
) {
  let cx = x;
  for (const [text, font, size] of parts) {
    page.drawText(text, { x: cx, y, size, font, color: DARK });
    cx += font.widthOfTextAtSize(text, size);
  }
}

function page1(
  page: PDFPage,
  data: AgreementData,
  fr: PDFFont,
  fb: PDFFont,
  fsb: PDFFont,
) {
  let y = TOP;

  // Title
  const title = "DOOH ADVERTISING SLOT BOOKING AGREEMENT";
  const tw = fb.widthOfTextAtSize(title, 11);
  page.drawText(title, {
    x: (PW - tw) / 2,
    y,
    size: 11,
    font: fb,
    color: DARK,
  });
  y -= 28;

  // To + DATE
  page.drawText("To,", { x: LEFT, y, size: FS, font: fr, color: DARK });
  page.drawText("DATE:", { x: 420, y, size: FS, font: fsb, color: DARK });
  page.drawText(data.date, { x: 452, y, size: FS, font: fb, color: DARK });
  y -= 15;
  page.drawText(`${data.brandName},`, {
    x: LEFT,
    y,
    size: FS,
    font: fr,
    color: DARK,
  });
  y -= 15;
  page.drawText(data.addressLine1, {
    x: LEFT,
    y,
    size: FS,
    font: fr,
    color: DARK,
  });
  y -= 15;
  page.drawText(data.addressLine2, {
    x: LEFT,
    y,
    size: FS,
    font: fr,
    color: DARK,
  });
  y -= 24;

  // Subject
  page.drawText(
    "Subject: Agreement & Confirmation of DOOH Advertising Slot Booking with Skyarc",
    { x: LEFT, y, size: FS, font: fb, color: DARK },
  );
  y -= 22;

  page.drawText(`Dear ${data.clientName},`, {
    x: LEFT,
    y,
    size: FS,
    font: fr,
    color: DARK,
  });
  y -= 20;

  // Intro
  y = drawJustified(
    page,
    "This Agreement and Letter of Intent (\u201cAgreement\u201d) constitute the formal and binding confirmation of the Client\u2019s booking of advertising slots on the Skyarc Digital Out-of-Home (DOOH) media network, operated by Skymurals Advertisement Private Limited.",
    LEFT,
    y,
    fr,
    FS,
    CW,
    LH,
  );
  y -= 8;

  page.drawText("Agreement Overview", {
    x: LEFT,
    y,
    size: 9.5,
    font: fb,
    color: DARK,
  });
  y -= 18;

  // Bullets with bold values
  const bx = LEFT + 16;
  const tx = LEFT + 28;
  const bullets: [string, string][] = [
    ["Slot Duration per billboard: ", "10 seconds"],
    ["Total Number of Slots Booked: ", data.totalSlots],
    ["Billboard visible size: ", "~500 sqft"],
    ["Start Date of Campaign: ", data.startDate],
    ["End Date of Campaign: ", data.endDate],
    ["Location: ", data.locationName],
    ["Total Campaign Duration: ", data.campaignDuration],
    ["Display Frequency: ", "510+ plays per day per slot per billboard"],
    ["Total Campaign Value: ", `\u20b9 ${data.campaignValue}`],
  ];

  for (const [label, value] of bullets) {
    page.drawText("\u2022", { x: bx, y, size: FS_B, font: fr, color: DARK });
    drawMixed(
      page,
      [
        [label, fr, FS_B],
        [value, fb, FS_B],
      ],
      tx,
      y,
    );
    y -= LH_B;
  }
  y -= 6;

  // Body paragraphs
  const paras = [
    "By signing this Agreement, both parties confirm that the above terms and the Terms & Conditions in Annexure A (attached) shall govern the campaign in full, without the requirement of any additional contract.",
    "As part of this Agreement, the Price mentioned above is solely for providing Digital Space (slots on the billboard) for Outdoor Advertising. It does not include any Content Creation, Creative Development, or Production costs. Any such services, if availed, will be charged separately.",
    "We appreciate your trust in partnering with us on Gujarat\u2019s 1st commercial digital billboard initiative journey. We look forward to amplifying your brand\u2019s visibility through our premium DOOH network.",
    "Please sign below to acknowledge and confirm acceptance of this Agreement and its annexed Terms & Conditions.",
  ];
  for (const p of paras) {
    y = drawJustified(page, p, LEFT, y, fr, FS, CW, LH);
    y -= 5;
  }
  y -= 14;

  // Signature
  const sy = y;
  page.drawText("Warm Regards,", {
    x: LEFT,
    y: sy,
    size: FS,
    font: fr,
    color: DARK,
  });
  page.drawText("For Skymurals Advertisement Private Limited,", {
    x: LEFT,
    y: sy - 14,
    size: FS,
    font: fr,
    color: DARK,
  });
  page.drawText("Director", {
    x: LEFT,
    y: sy - 48,
    size: FS,
    font: fr,
    color: DARK,
  });

  const rc = 325;
  page.drawText("Accepted & Confirmed by Client:", {
    x: rc,
    y: sy,
    size: FS,
    font: fb,
    color: DARK,
  });
  page.drawText("Authorized Signatory: ____________", {
    x: rc,
    y: sy - 17,
    size: FS,
    font: fr,
    color: DARK,
  });
  page.drawText(`Name: ${data.clientName}`, {
    x: rc,
    y: sy - 31,
    size: FS,
    font: fr,
    color: DARK,
  });
  page.drawText(`Company Name: ${data.brandName}`, {
    x: rc,
    y: sy - 45,
    size: FS,
    font: fr,
    color: DARK,
  });

  page.drawText(`Agreement No: ${data.agreementNumber}`, {
    x: LEFT,
    y: 72,
    size: 6.5,
    font: fr,
    color: GRAY,
  });
}

function page2(
  page: PDFPage,
  data: AgreementData,
  fr: PDFFont,
  fb: PDFFont,
  fm: PDFFont,
) {
  let y = TOP;
  page.drawText("Annexure A: Terms & Conditions", {
    x: LEFT,
    y,
    size: 10.5,
    font: fb,
    color: DARK,
  });
  y -= 24;

  let num = 1;
  const indent = LEFT + 14;
  for (const idx of data.enabledClauses) {
    const text = ANNEXURE_CLAUSES[idx];
    const prefix = `${num}.`;
    const pw = fr.widthOfTextAtSize(prefix, FS_B) + 5;
    const lines = wrap(text, fr, FS_B, CW - 14 - pw);

    for (let j = 0; j < lines.length; j++) {
      if (j === 0) {
        page.drawText(prefix, {
          x: indent,
          y,
          size: FS_B,
          font: fm,
          color: DARK,
        });
        page.drawText(lines[j], {
          x: indent + pw,
          y,
          size: FS_B,
          font: fr,
          color: DARK,
        });
      } else {
        page.drawText(lines[j], {
          x: indent + pw,
          y,
          size: FS_B,
          font: fr,
          color: DARK,
        });
      }
      y -= LH_B;
    }

    if (idx === 7) {
      y -= 2;
      const si = indent + pw + 8;
      for (const sub of CLAUSE_8_SUBS) {
        const sl = wrap(sub, fr, FS_B, CW - 56);
        for (const s of sl) {
          page.drawText(s, { x: si, y, size: FS_B, font: fr, color: DARK });
          y -= LH_B;
        }
        y -= 1;
      }
    }
    y -= 6;
    num++;
  }
}

export async function generateAgreementPDF(
  data: AgreementData,
): Promise<Uint8Array> {
  const lhBytes = await fetch("/Skymurals_Letterhead.pdf").then((r) =>
    r.arrayBuffer(),
  );
  const frBytes = await fetch("/fonts/PlusJakartaSans-Regular.ttf").then((r) =>
    r.arrayBuffer(),
  );
  const fbBytes = await fetch("/fonts/PlusJakartaSans-Bold.ttf").then((r) =>
    r.arrayBuffer(),
  );
  const fsbBytes = await fetch("/fonts/PlusJakartaSans-SemiBold.ttf").then(
    (r) => r.arrayBuffer(),
  );
  const fmBytes = await fetch("/fonts/PlusJakartaSans-Medium.ttf").then((r) =>
    r.arrayBuffer(),
  );

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fr = await doc.embedFont(frBytes);
  const fb = await doc.embedFont(fbBytes);
  const fsb = await doc.embedFont(fsbBytes);
  const fm = await doc.embedFont(fmBytes);

  // Page 1
  const d1 = await PDFDocument.load(lhBytes);
  const [p1] = await doc.copyPages(d1, [0]);
  doc.addPage(p1);

  // Page 2
  const d2 = await PDFDocument.load(lhBytes);
  const [p2] = await doc.copyPages(d2, [0]);
  doc.addPage(p2);

  page1(doc.getPage(0), data, fr, fb, fsb);
  page2(doc.getPage(1), data, fr, fb, fm);

  return await doc.save();
}

export const LOCATIONS: Record<string, { code: string; fullName: string }> = {
  HUB: {
    code: "HUB",
    fullName: "Classic Hub, New 150 Feet Ring Road, Motamava, Rajkot.",
  },
};

export function generateAgreementNumber(
  locationCode: string,
  year: number,
  seq: number,
): string {
  return `SA/${locationCode}/${year}/${String(seq).padStart(3, "0")}`;
}
