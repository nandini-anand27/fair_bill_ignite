import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { billAPI } from '../../services/api';

// ── Accepted file types ────────────────────────────────────────────────────
const ACCEPTED = '.jpg,.jpeg,.png,.webp,.pdf';
const MAX_MB   = 15;

// ── Category options for the item rows ────────────────────────────────────
const CATEGORIES = [
  { value: 'room',             label: '🛏️  Room Charges' },
  { value: 'doctor_fees',      label: '👨‍⚕️  Doctor Fees' },
  { value: 'diagnostic_tests', label: '🔬  Diagnostic Tests' },
  { value: 'medicines',        label: '💊  Medicines' },
  { value: 'nursing',          label: '🩺  Nursing' },
  { value: 'procedures',       label: '⚕️  Procedures' },
  { value: 'consumables',      label: '🩹  Consumables' },
  { value: 'baby_charges',     label: '👶  Baby Charges' },
  { value: 'registration',     label: '📋  Registration' },
  { value: 'other',            label: '📌  Other' },
];

// ── Utility ────────────────────────────────────────────────────────────────
const emptyItem = () => ({ description: '', amount: '', quantity: 1, category: 'other' });

export default function UploadBill() {
  const navigate = useNavigate();

  // Tab: 'photo' | 'manual'
  const [tab, setTab] = useState('photo');

  // Photo upload state
  const [file, setFile]             = useState(null);
  const [preview, setPreview]       = useState(null);  // data-url for image preview
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef                = useRef(null);

  // Bill information
  const [billInfo, setBillInfo] = useState({
    hospital_name: '',
    bill_date: '',
    room_category: 'general',
    printed_total: '',
    city: 'Bengaluru',
  });

  // Line items
  const [items, setItems] = useState([emptyItem()]);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  // ── File handling ──────────────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Maximum is ${MAX_MB} MB.`);
      return;
    }
    setError('');
    setFile(f);
    setExtractMsg('');

    // Show image preview
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }

    // Auto-extract immediately
    await runExtraction(f);
  }, []);

  const runExtraction = async (f) => {
    setExtracting(true);
    setExtractMsg('');
    try {
      const fd = new FormData();
      fd.append('bill_image', f);
      const res  = await billAPI.extractImage(fd);
      const data = res.data;

      if (data.message) {
        // OCR unavailable — show friendly message
        setExtractMsg(data.message);
      } else if (data.item_count > 0) {
        // Populate items from extraction
        setItems(data.items.map(it => ({
          description: it.description || '',
          amount:      (it.amount || 0).toString(),
          quantity:    it.quantity || 1,
          category:    it.category || 'other',
        })));
        setExtractMsg(
          `✅ ${data.item_count} line item${data.item_count > 1 ? 's' : ''} extracted automatically. ` +
          `Please review and correct any errors.`
        );
      } else {
        setExtractMsg(
          'The bill image was read, but no line items could be extracted automatically. ' +
          'Please add them manually below.'
        );
      }
      // Switch to manual tab so user can review/edit
      setTab('manual');
    } catch (err) {
      setExtractMsg(
        err.response?.data?.error ||
        'Could not extract items from the image. Please add them manually.'
      );
      setTab('manual');
    } finally {
      setExtracting(false);
    }
  };

  const handleInputChange = (e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Item row helpers ───────────────────────────────────────────────────
  const addItem    = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const computedTotal = items.reduce(
    (sum, it) => sum + (parseFloat(it.amount) || 0) * (parseInt(it.quantity) || 1), 0
  );

  // ── Form submit ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const printedTotalPaise = Math.round(parseFloat(billInfo.printed_total || 0) * 100);

      const payload = {
        hospital_name:       billInfo.hospital_name,
        bill_date:           billInfo.bill_date || null,
        room_category:       billInfo.room_category,
        city:                billInfo.city,
        printed_total_paise: printedTotalPaise || Math.round(computedTotal * 100),
        items: items
          .filter(it => it.description.trim() && parseFloat(it.amount) > 0)
          .map(it => ({
            description: it.description.trim(),
            amount:      parseFloat(it.amount) || 0,
            quantity:    parseInt(it.quantity) || 1,
            category:    it.category,
          })),
      };

      if (payload.items.length === 0) {
        setError('Please add at least one line item with a description and amount.');
        setSubmitting(false);
        return;
      }

      const res = await billAPI.upload(payload);
      navigate(`/review/${res.data.bill.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      <h1 className="page-title">Upload Your Hospital Bill</h1>
      <p className="page-subtitle">
        Take a photo, upload a scan, or type the items manually — then compare with peer hospitals.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* ── Mode tabs ── */}
      <div style={{
        display: 'flex',
        background: 'var(--card-bg)',
        borderRadius: 50,
        padding: 4,
        gap: 4,
        border: '2px solid rgba(30,63,32,.08)',
        marginBottom: '2rem',
        width: 'fit-content',
      }}>
        {[
          { id: 'photo',  label: '📸 Upload Photo / PDF' },
          { id: 'manual', label: '✏️  Enter Manually' },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '.55rem 1.5rem',
              borderRadius: 50,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '.9rem',
              transition: 'all .2s',
              background: tab === t.id ? 'var(--primary)' : 'transparent',
              color:      tab === t.id ? '#fff' : 'var(--text-mid)',
              boxShadow:  tab === t.id ? '0 2px 8px rgba(30,63,32,.2)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>

        {/* ══════════════════════════════════════════════
            TAB A: Photo / PDF upload
        ══════════════════════════════════════════════ */}
        {tab === 'photo' && (
          <div>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2.5px dashed ${isDragOver ? 'var(--primary)' : 'var(--gray-300)'}`,
                borderRadius: '24px 28px 24px 20px',
                background: isDragOver ? 'var(--primary-light)' : 'var(--white)',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all .2s',
                marginBottom: '1.5rem',
                boxShadow: isDragOver ? '0 0 0 4px rgba(30,63,32,.1)' : 'none',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                onChange={handleInputChange}
                style={{ display: 'none' }}
              />

              {extracting ? (
                <div>
                  <div className="spinner" />
                  <p style={{ color: 'var(--primary)', fontWeight: 700, marginTop: '.5rem' }}>
                    Reading your bill…
                  </p>
                </div>
              ) : preview ? (
                <div>
                  <img
                    src={preview}
                    alt="Bill preview"
                    style={{
                      maxHeight: 300,
                      maxWidth: '100%',
                      borderRadius: 16,
                      boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                      marginBottom: '1rem',
                    }}
                  />
                  <p style={{ color: 'var(--text-muted)', fontSize: '.88rem' }}>
                    Click or drop to replace
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📸</div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--primary)',
                    fontWeight: 800,
                    marginBottom: '.5rem',
                  }}>
                    Drop your bill here
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', marginBottom: '1rem' }}>
                    JPG, PNG, or PDF up to 15 MB
                  </p>
                  <div className="btn btn-primary" style={{ pointerEvents: 'none' }}>
                    Browse Files
                  </div>
                </div>
              )}
            </div>

            {/* File name indicator */}
            {file && !extracting && (
              <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                <span style={{ fontSize: '1.2rem' }}>
                  {file.type === 'application/pdf' ? '📄' : '🖼️'}
                </span>
                <div>
                  <strong>{file.name}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.82rem', marginLeft: '.5rem' }}>
                    ({(file.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
              </div>
            )}

            {/* Extraction result message */}
            {extractMsg && (
              <div className={`alert ${extractMsg.startsWith('✅') ? 'alert-success' : 'alert-warning'}`}>
                {extractMsg}
              </div>
            )}

            {/* How it works */}
            {!file && (
              <div className="card" style={{ background: 'var(--primary-light)', border: '1.5px solid rgba(30,63,32,.12)' }}>
                <div className="card-header" style={{ marginBottom: '.75rem' }}>How photo upload works</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', fontSize: '.88rem' }}>
                  {[
                    { icon: '📸', text: 'Take a clear, well-lit photo of your hospital bill' },
                    { icon: '🔍', text: 'We scan the bill and extract line items automatically' },
                    { icon: '✏️', text: 'Review and correct any items before submitting' },
                    { icon: '📊', text: 'Compare your bill with peer hospitals' },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: '.75rem' }}>
                      <div style={{ fontSize: '1.75rem', marginBottom: '.4rem' }}>{s.icon}</div>
                      <div style={{ color: 'var(--text-mid)', fontWeight: 500 }}>{s.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Re-extract button */}
            {file && !extracting && (
              <div style={{ marginTop: '.75rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => runExtraction(file)}
                >
                  🔄 Re-extract items
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setTab('manual')}
                >
                  ✏️ Review & edit items →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB B: Bill info + line items (manual / post-extraction)
        ══════════════════════════════════════════════ */}
        {tab === 'manual' && (
          <div>
            {/* Show thumbnail if a file was uploaded */}
            {preview && (
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <img
                  src={preview}
                  alt="Bill"
                  style={{
                    width: 100,
                    borderRadius: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,.1)',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '.25rem' }}>
                    📸 Photo uploaded
                  </p>
                  <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                    Keep your bill open to verify each item below.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '.5rem' }}
                    onClick={() => setTab('photo')}
                  >
                    ← Back to photo
                  </button>
                </div>
              </div>
            )}

            {extractMsg && (
              <div className={`alert ${extractMsg.startsWith('✅') ? 'alert-success' : 'alert-warning'}`} style={{ marginBottom: '1.5rem' }}>
                {extractMsg}
              </div>
            )}

            {/* Bill details card */}
            <div className="card">
              <div className="card-header">📋 Bill Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Hospital Name</label>
                  <input
                    type="text"
                    value={billInfo.hospital_name}
                    onChange={e => setBillInfo({ ...billInfo, hospital_name: e.target.value })}
                    placeholder="e.g. Cloudnine Hospital"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Bill Date</label>
                  <input
                    type="date"
                    value={billInfo.bill_date}
                    onChange={e => setBillInfo({ ...billInfo, bill_date: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>City</label>
                  <select
                    value={billInfo.city}
                    onChange={e => setBillInfo({ ...billInfo, city: e.target.value })}
                  >
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Mysuru">Mysuru</option>
                    <option value="Hubballi">Hubballi</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Room Category</label>
                  <select
                    value={billInfo.room_category}
                    onChange={e => setBillInfo({ ...billInfo, room_category: e.target.value })}
                  >
                    <option value="general">General Ward</option>
                    <option value="semi_private">Semi-Private</option>
                    <option value="private">Private Room</option>
                    <option value="premium">Premium Suite</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Printed Total (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={billInfo.printed_total}
                    onChange={e => setBillInfo({ ...billInfo, printed_total: e.target.value })}
                    placeholder="Total as shown on bill"
                  />
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div className="card-header" style={{ margin: 0 }}>💰 Line Items</div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  color: 'var(--primary)',
                  fontSize: '1.1rem',
                }}>
                  ₹{computedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="bill-items-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ width: 130 }}>Amount (₹)</th>
                      <th style={{ width: 70 }}>Qty</th>
                      <th style={{ width: 160 }}>Category</th>
                      <th style={{ width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => updateItem(i, 'description', e.target.value)}
                            placeholder="e.g. Room charges, CBC test…"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount}
                            onChange={e => updateItem(i, 'amount', e.target.value)}
                            placeholder="0.00"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.quantity}
                            min="1"
                            onChange={e => updateItem(i, 'quantity', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            value={item.category}
                            onChange={e => updateItem(i, 'category', e.target.value)}
                          >
                            {CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {items.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => removeItem(i)}
                              title="Remove item"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={addItem}>
                + Add Item
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-accent btn-block btn-lg"
              disabled={submitting}
            >
              {submitting ? '⏳ Saving…' : '📊 Save & Compare with Peers →'}
            </button>
          </div>
        )}

      </form>

      {/* Tips */}
      <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--card-bg)', borderRadius: 'var(--r-organic)', border: '1.5px dashed var(--gray-300)' }}>
        <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '.75rem', fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
          💡 Tips for a good photo
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '.5rem', fontSize: '.88rem', color: 'var(--text-mid)' }}>
          {[
            '📷 Lay the bill flat before photographing',
            '☀️ Use good lighting — avoid shadows',
            '🔍 Capture the full bill in one shot',
            '📄 PDF uploads give the best results',
            '🔄 You can always edit items manually',
            '🔒 Your bill data is kept private',
          ].map((tip, i) => (
            <li key={i} style={{ display: 'flex', gap: '.4rem', alignItems: 'flex-start' }}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
