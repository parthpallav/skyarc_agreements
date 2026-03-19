import { useState, useCallback } from 'react';
import {
  generateAgreementPDF,
  ANNEXURE_CLAUSES,
  LOCATIONS,
  generateAgreementNumber,
  AgreementData,
} from './pdfGenerator';
import './App.css';

function getNextSeq(locationCode: string, year: number): number {
  const key = `skyarc_seq_${locationCode}_${year}`;
  const current = parseInt(localStorage.getItem(key) || '0', 10);
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return next;
}

function peekNextSeq(locationCode: string, year: number): number {
  const key = `skyarc_seq_${locationCode}_${year}`;
  return parseInt(localStorage.getItem(key) || '0', 10) + 1;
}

function toDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function App() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [form, setForm] = useState({
    brandName: '',
    clientName: '',
    addressLine1: '',
    addressLine2: '',
    date: todayStr,
    totalSlots: '',
    startDate: '',
    endDate: '',
    campaignDuration: '',
    campaignValue: '',
    locationCode: 'HUB',
    locationFullName: LOCATIONS.HUB.fullName,
    includeGST: true,
  });

  const [enabledClauses, setEnabledClauses] = useState<number[]>(
    ANNEXURE_CLAUSES.map((_, i) => i)
  );
  const [generating, setGenerating] = useState(false);
  const [showClauses, setShowClauses] = useState(false);

  const currentYear = today.getFullYear();
  const previewNum = generateAgreementNumber(
    form.locationCode, currentYear, peekNextSeq(form.locationCode, currentYear)
  );

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (code: string) => {
    const loc = LOCATIONS[code];
    if (loc) setForm((prev) => ({ ...prev, locationCode: code, locationFullName: loc.fullName }));
  };

  const toggleClause = (i: number) => {
    setEnabledClauses((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()
    );
  };

  const handleGenerate = useCallback(async () => {
    const required = ['brandName', 'clientName', 'totalSlots', 'startDate', 'endDate', 'campaignDuration', 'campaignValue'];
    const missing = required.filter((f) => !form[f as keyof typeof form]);
    if (missing.length > 0) {
      alert('Please fill in all required fields.');
      return;
    }

    setGenerating(true);
    try {
      const seq = getNextSeq(form.locationCode, currentYear);
      const agreementNumber = generateAgreementNumber(form.locationCode, currentYear, seq);

      const valueDisplay = form.includeGST
        ? `${form.campaignValue} + GST`
        : form.campaignValue;

      const data: AgreementData = {
        brandName: form.brandName,
        clientName: form.clientName,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        date: toDisplayDate(form.date),
        totalSlots: form.totalSlots,
        startDate: toDisplayDate(form.startDate),
        endDate: toDisplayDate(form.endDate),
        campaignDuration: form.campaignDuration,
        campaignValue: valueDisplay,
        agreementNumber,
        locationName: form.locationFullName,
        enabledClauses,
      };

      const pdfBytes = await generateAgreementPDF(data);
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Skyarc_Agreement_${form.brandName.replace(/\s+/g, '_')}_${agreementNumber.replace(/\//g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Error generating PDF. Check console for details.');
    } finally {
      setGenerating(false);
    }
  }, [form, enabledClauses, currentYear]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            <img src="/skyarc_logo_white.png" alt="Skyarc" className="logo-img" />
            <div className="header-divider" />
            <div className="header-labels">
              <h1 className="app-title">Agreement Generator</h1>
              <p className="app-subtitle">DOOH Slot Booking</p>
            </div>
          </div>
          <div className="agreement-num-preview">{previewNum}</div>
        </div>
      </header>

      <main className="main-content">
        {/* Client Details */}
        <section className="form-section">
          <h2 className="section-title">
            <span className="section-number">01</span>Client Details
          </h2>
          <div className="fields-grid">
            <div className="field">
              <label>Brand / Company Name *</label>
              <input type="text" value={form.brandName} onChange={(e) => updateField('brandName', e.target.value)} placeholder="e.g. Amul, Parle, Havmor" />
            </div>
            <div className="field">
              <label>Client Name (Signatory) *</label>
              <input type="text" value={form.clientName} onChange={(e) => updateField('clientName', e.target.value)} placeholder="e.g. Mr. Rajesh Patel" />
            </div>
            <div className="field full-width">
              <label>Address Line 1</label>
              <input type="text" value={form.addressLine1} onChange={(e) => updateField('addressLine1', e.target.value)} placeholder="Street / Building" />
            </div>
            <div className="field full-width">
              <label>Address Line 2</label>
              <input type="text" value={form.addressLine2} onChange={(e) => updateField('addressLine2', e.target.value)} placeholder="City, State, PIN" />
            </div>
          </div>
        </section>

        {/* Campaign Details */}
        <section className="form-section">
          <h2 className="section-title">
            <span className="section-number">02</span>Campaign Details
          </h2>
          <div className="fields-grid">
            <div className="field">
              <label>Agreement Date *</label>
              <input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} />
            </div>
            <div className="field">
              <label>Location</label>
              <select value={form.locationCode} onChange={(e) => handleLocationChange(e.target.value)}>
                {Object.entries(LOCATIONS).map(([code, loc]) => (
                  <option key={code} value={code}>{code} — {loc.fullName}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Total Slots Booked *</label>
              <input type="text" value={form.totalSlots} onChange={(e) => updateField('totalSlots', e.target.value)} placeholder="e.g. 4" />
            </div>
            <div className="field">
              <label>Campaign Duration *</label>
              <input type="text" value={form.campaignDuration} onChange={(e) => updateField('campaignDuration', e.target.value)} placeholder="e.g. 30 Days" />
            </div>
            <div className="field">
              <label>Start Date *</label>
              <input type="date" value={form.startDate} onChange={(e) => updateField('startDate', e.target.value)} />
            </div>
            <div className="field">
              <label>End Date *</label>
              <input type="date" value={form.endDate} onChange={(e) => updateField('endDate', e.target.value)} />
            </div>
            <div className="field full-width">
              <label>Campaign Value (₹) *</label>
              <div className="gst-row">
                <div className="field">
                  <input type="text" value={form.campaignValue} onChange={(e) => updateField('campaignValue', e.target.value)} placeholder="e.g. 50,000" />
                </div>
                <label className="gst-toggle">
                  <input type="checkbox" checked={form.includeGST} onChange={(e) => updateField('includeGST', e.target.checked)} />
                  <span>+ GST</span>
                </label>
              </div>
            </div>
            <div className="field full-width">
              <label>Location Full Name (editable)</label>
              <input type="text" value={form.locationFullName} onChange={(e) => updateField('locationFullName', e.target.value)} />
            </div>
          </div>
        </section>

        {/* Annexure A */}
        <section className="form-section">
          <h2 className="section-title">
            <span className="section-number">03</span>Annexure A — Terms & Conditions
            <button className="toggle-clauses-btn" onClick={() => setShowClauses(!showClauses)}>
              {showClauses ? 'Hide' : 'Show'} ({enabledClauses.length}/{ANNEXURE_CLAUSES.length})
            </button>
          </h2>
          {showClauses && (
            <div className="clauses-list">
              {ANNEXURE_CLAUSES.map((clause, i) => (
                <label key={i} className={`clause-item ${enabledClauses.includes(i) ? 'active' : 'inactive'}`}>
                  <div className="clause-toggle">
                    <input type="checkbox" checked={enabledClauses.includes(i)} onChange={() => toggleClause(i)} />
                    <span className="clause-num">Clause {i + 1}</span>
                  </div>
                  <p className="clause-preview">{clause.substring(0, 120)}{clause.length > 120 ? '...' : ''}</p>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Generate */}
        <div className="generate-area">
          <button className="generate-btn" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <><span className="spinner" />Generating...</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 3v9m0 0l-3-3m3 3l3-3M3.5 15h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Generate & Download
              </>
            )}
          </button>
          <p className="generate-hint">Agreement #{previewNum}</p>
        </div>
      </main>
    </div>
  );
}

export default App;
