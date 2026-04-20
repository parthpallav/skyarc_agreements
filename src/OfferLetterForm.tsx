import { useState, useCallback } from 'react';
import { generateOfferLetterPDF, OfferLetterData, SalaryComponent } from './offerLetterGenerator';

// ── Date helpers ─────────────────────────────────────────────────────────────
function toDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ── Time helpers ─────────────────────────────────────────────────────────────
// Convert "HH:MM" (24h) → "H:MM AM/PM"
function to12h(val: string): string {
  if (!val) return '';
  const [hStr, mStr] = val.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
// Convert "H:MM AM/PM" → "HH:MM" for <input type="time">
function to24h(display: string): string {
  if (!display) return '';
  const match = display.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '';
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

// ── Indian Labour Law: reverse-calculate salary structure from total CTC ─────
// Rules (as per current Indian labour law guidance):
//   Basic     = 50% of total CTC (minimum, per Code on Wages)
//   HRA       = 50% of Basic (metro) — we use 50%
//   Travel    = fixed ₹2,000 (tax-exempt limit)
//   Special   = remainder
function reverseCalculate(totalMonthly: number): SalaryComponent[] {
  const basic    = Math.round(totalMonthly * 0.50);
  const hra      = Math.round(basic * 0.50);
  const travel   = Math.min(2000, Math.round(totalMonthly * 0.05));
  const special  = totalMonthly - basic - hra - travel;
  return [
    { label: 'Basic Salary',          monthly: basic,   annual: basic   * 12 },
    { label: 'House Rent Allowance',  monthly: hra,     annual: hra     * 12 },
    { label: 'Travel/Conveyance',     monthly: travel,  annual: travel  * 12 },
    { label: 'Special Allowance',     monthly: special, annual: special * 12 },
  ];
}

// ── Default components ────────────────────────────────────────────────────────
const DEFAULT_COMPONENTS: SalaryComponent[] = reverseCalculate(22000);

export default function OfferLetterForm() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [form, setForm] = useState({
    firstName:        '',
    fullName:         '',
    position:         'Sales Executive',
    date:             todayStr,
    joiningDate:      '',
    workingHoursStart: '10:30',   // stored as 24h "HH:MM" for input[type=time]
    workingHoursEnd:   '19:30',
    workingDays:      'Monday through Saturday (6 days a week)',
    commissionPercent: '2',
    probationMonths:  '3',
    noticeProbation:  '15',
    noticeConfirmed:  '30',
    leaveDays:        '12',
    signatoryName:    'Raj Gor',
    signatoryTitle:   'Co-Founder',
  });

  const [components, setComponents] = useState<SalaryComponent[]>(DEFAULT_COMPONENTS);
  const [ctcInput, setCtcInput] = useState('22000');   // controlled CTC input for reverse-calc
  const [generating, setGenerating] = useState(false);

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Salary component handlers ────────────────────────────────────────────
  const updateComponent = (i: number, field: keyof SalaryComponent, value: string) => {
    setComponents((prev) => {
      const next = [...prev];
      const num = Number(value) || 0;
      next[i] = { ...next[i], [field]: num };
      if (field === 'monthly') next[i].annual = num * 12;
      if (field === 'annual')  next[i].monthly = Math.round(num / 12);
      return next;
    });
  };

  // Reverse-calculate from total CTC
  const handleCtcChange = (val: string) => {
    setCtcInput(val);
    const total = Number(val.replace(/,/g, '')) || 0;
    if (total > 0) setComponents(reverseCalculate(total));
  };

  const addComponent = () =>
    setComponents((prev) => [...prev, { label: '', monthly: 0, annual: 0 }]);

  const removeComponent = (i: number) =>
    setComponents((prev) => prev.filter((_, idx) => idx !== i));

  const totalMonthly = components.reduce((s, c) => s + (Number(c.monthly) || 0), 0);
  const totalAnnual  = components.reduce((s, c) => s + (Number(c.annual)  || 0), 0);

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const required = ['firstName', 'fullName', 'position', 'joiningDate'];
    const missing = required.filter((f) => !form[f as keyof typeof form]);
    if (missing.length > 0) { alert('Please fill in: ' + missing.join(', ')); return; }
    if (components.length === 0) { alert('Add at least one salary component.'); return; }

    setGenerating(true);
    try {
      const data: OfferLetterData = {
        ...form,
        date:              toDisplayDate(form.date),
        joiningDate:       toDisplayDate(form.joiningDate),
        workingHoursStart: to12h(form.workingHoursStart),
        workingHoursEnd:   to12h(form.workingHoursEnd),
        salaryComponents:  components.map((c) => ({
          label:   c.label,
          monthly: Number(c.monthly) || 0,
          annual:  Number(c.annual)  || 0,
        })),
      };
      const pdfBytes = await generateOfferLetterPDF(data);
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Skymurals_OfferLetter_${form.fullName.replace(/\s+/g, '_')}_${form.date}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Offer letter generation error:', err);
      alert('Error generating PDF. Check console for details.');
    } finally {
      setGenerating(false);
    }
  }, [form, components]);

  return (
    <main className="main-content">

      {/* 01 — Candidate Details */}
      <section className="form-section">
        <h2 className="section-title"><span className="section-number">01</span>Candidate Details</h2>
        <div className="fields-grid">
          <div className="field">
            <label>First Name *</label>
            <input type="text" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} placeholder="e.g. Parth" />
          </div>
          <div className="field">
            <label>Full Name *</label>
            <input type="text" value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} placeholder="e.g. Parth Raval" />
          </div>
          <div className="field">
            <label>Position / Role *</label>
            <input type="text" value={form.position} onChange={(e) => updateField('position', e.target.value)} placeholder="e.g. Sales Executive" />
          </div>
          <div className="field">
            <label>Offer Date</label>
            <input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} />
          </div>
          <div className="field">
            <label>Joining Date *</label>
            <input type="date" value={form.joiningDate} onChange={(e) => updateField('joiningDate', e.target.value)} />
          </div>
        </div>
      </section>

      {/* 02 — Work Schedule */}
      <section className="form-section">
        <h2 className="section-title"><span className="section-number">02</span>Work Schedule</h2>
        <div className="fields-grid">
          <div className="field">
            <label>Start Time</label>
            <input
              type="time"
              value={form.workingHoursStart}
              onChange={(e) => updateField('workingHoursStart', e.target.value)}
            />
            <span className="field-hint">{to12h(form.workingHoursStart)}</span>
          </div>
          <div className="field">
            <label>End Time</label>
            <input
              type="time"
              value={form.workingHoursEnd}
              onChange={(e) => updateField('workingHoursEnd', e.target.value)}
            />
            <span className="field-hint">{to12h(form.workingHoursEnd)}</span>
          </div>
          <div className="field full-width">
            <label>Working Days</label>
            <input type="text" value={form.workingDays} onChange={(e) => updateField('workingDays', e.target.value)} placeholder="Monday through Saturday (6 days a week)" />
          </div>
        </div>
      </section>

      {/* 03 — Salary Structure */}
      <section className="form-section">
        <h2 className="section-title"><span className="section-number">03</span>Salary Structure</h2>

        {/* CTC quick-fill */}
        <div className="ctc-quickfill">
          <label>Enter Total Monthly CTC (₹) — auto-splits per Indian Labour Law</label>
          <div className="ctc-input-row">
            <input
              type="number"
              value={ctcInput}
              onChange={(e) => handleCtcChange(e.target.value)}
              placeholder="e.g. 22000"
              className="ctc-input"
            />
            <span className="ctc-rule-badge">50% Basic · 25% HRA · Max ₹2K Travel · Remainder Special</span>
          </div>
        </div>

        <div className="salary-table">
          <div className="salary-header">
            <span>Component</span>
            <span>Monthly (₹)</span>
            <span>Annual (₹)</span>
            <span></span>
          </div>
          {components.map((comp, i) => (
            <div className="salary-row" key={i}>
              <input
                type="text"
                value={comp.label}
                onChange={(e) => updateComponent(i, 'label', e.target.value)}
                placeholder="e.g. Basic Salary"
                className="salary-input-label"
              />
              <input
                type="number"
                value={comp.monthly || ''}
                onChange={(e) => updateComponent(i, 'monthly', e.target.value)}
                placeholder="0"
                className="salary-input-num"
              />
              <input
                type="number"
                value={comp.annual || ''}
                onChange={(e) => updateComponent(i, 'annual', e.target.value)}
                placeholder="0"
                className="salary-input-num"
              />
              <button className="remove-row-btn" onClick={() => removeComponent(i)} title="Remove">×</button>
            </div>
          ))}
          <div className="salary-total">
            <span>Total CTC</span>
            <span>₹{totalMonthly.toLocaleString('en-IN')}</span>
            <span>₹{totalAnnual.toLocaleString('en-IN')}</span>
            <span></span>
          </div>
          <button className="add-row-btn" onClick={addComponent}>+ Add Component</button>
        </div>
      </section>

      {/* 04 — Incentives & Policy */}
      <section className="form-section">
        <h2 className="section-title"><span className="section-number">04</span>Incentives & Policy</h2>
        <div className="fields-grid">
          <div className="field">
            <label>Sales Commission %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.commissionPercent}
              onChange={(e) => updateField('commissionPercent', e.target.value)}
              placeholder="0 = no commission"
            />
            {Number(form.commissionPercent) === 0 && (
              <span className="field-hint">No commission clause will be included</span>
            )}
          </div>
          <div className="field">
            <label>Probation Period (months)</label>
            <input type="number" value={form.probationMonths} onChange={(e) => updateField('probationMonths', e.target.value)} placeholder="3" />
          </div>
          <div className="field">
            <label>Notice Period — Probation (days)</label>
            <input type="number" value={form.noticeProbation} onChange={(e) => updateField('noticeProbation', e.target.value)} placeholder="15" />
          </div>
          <div className="field">
            <label>Notice Period — Confirmed (days)</label>
            <input type="number" value={form.noticeConfirmed} onChange={(e) => updateField('noticeConfirmed', e.target.value)} placeholder="30" />
          </div>
          <div className="field">
            <label>Paid Leave Days / Year</label>
            <input type="number" value={form.leaveDays} onChange={(e) => updateField('leaveDays', e.target.value)} placeholder="12" />
          </div>
        </div>
      </section>

      {/* 05 — Signatory */}
      <section className="form-section">
        <h2 className="section-title"><span className="section-number">05</span>Signatory</h2>
        <div className="fields-grid">
          <div className="field">
            <label>Signatory Name</label>
            <input type="text" value={form.signatoryName} onChange={(e) => updateField('signatoryName', e.target.value)} placeholder="Raj Gor" />
          </div>
          <div className="field">
            <label>Signatory Title</label>
            <input type="text" value={form.signatoryTitle} onChange={(e) => updateField('signatoryTitle', e.target.value)} placeholder="Co-Founder" />
          </div>
        </div>
      </section>

      {/* Generate */}
      <div className="generate-area">
        <button className="generate-btn" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <><span className="spinner" />Generating...</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 3v9m0 0l-3-3m3 3l3-3M3.5 15h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Generate Offer Letter
            </>
          )}
        </button>
      </div>
    </main>
  );
}
