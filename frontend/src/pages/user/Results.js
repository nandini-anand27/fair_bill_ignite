import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billAPI } from '../../services/api';
import BillingCounterScript from '../../components/BillingCounterScript';

const printStyles = `
@media print {
  .navbar, .btn, .alert-info, .card:last-child { display: none !important; }
  body { background: white !important; color: black !important; }
  .card { box-shadow: none !important; border: 1px solid #ccc !important; }
  .results-action-bar { display: none !important; }
  .results-bottom-nav { display: none !important; }
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtRs = p => p != null
  ? `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  : '—';

const CATEGORY_ICONS = {
  room: '🛏️', doctor_fees: '👨‍⚕️', diagnostic_tests: '🔬',
  medicines: '💊', nursing: '🩺', icu: '❤️‍🔥',
  procedures: '⚕️', consumables: '🩹', registration: '📋',
  baby_charges: '👶', tests: '🧪', other: '📌',
};

function ConfidenceBlock({ confidence }) {
  if (!confidence || !confidence.level) return null;

  const level     = confidence.level;
  const cls       = level === 'HIGH' ? 'confidence-high'
                  : level === 'LOW'  ? 'confidence-low'
                  :                    'confidence-moderate';
  const icon      = level === 'HIGH' ? '🟢' : level === 'LOW' ? '🔴' : '🟡';
  const f         = confidence.factors || {};

  return (
    <div className={`confidence-block ${cls}`}>
      <div className="confidence-label">{icon} {level} CONFIDENCE</div>
      <p style={{ fontSize: '.9rem', marginBottom: '1rem', marginTop: '.25rem' }}>
        {confidence.explanation}
      </p>
      {confidence.is_synthetic_only && (
        <div style={{
          background: 'rgba(255,255,255,.65)',
          border: '1.5px solid rgba(0,0,0,.08)',
          borderRadius: 10,
          padding: '.6rem 1rem',
          fontSize: '.82rem',
          color: 'var(--text-mid)',
          marginBottom: '.75rem',
          display: 'flex',
          gap: '.5rem',
          alignItems: 'flex-start',
        }}>
          <span>⚠️</span>
          <span>
            <strong>Demo Data Label:</strong> The comparison reference data for this bill
            includes synthetic demonstration records. These are labelled
            "SYNTHETIC DEMO DATA — NOT VERIFIED MARKET PRICING" and should not be
            treated as confirmed hospital pricing.
          </span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.5rem', fontSize: '.82rem' }}>
        {[
          { label: 'Sample size',         val: f.sample_size ?? '—' },
          { label: 'Location match',      val: f.location_match ? '✓ Yes' : '✗ No' },
          { label: 'Room category match', val: f.room_category_match ? '✓ Yes' : '✗ No' },
          { label: 'Item category match', val: f.item_category_match ? '✓ Yes' : '✗ Partial' },
          { label: 'Synthetic records',   val: f.synthetic_count ?? 0 },
          { label: 'Verified records',    val: f.verified_count ?? 0 },
        ].map(r => (
          <div key={r.label} style={{
            background: 'rgba(255,255,255,.55)',
            borderRadius: 8,
            padding: '.4rem .75rem',
          }}>
            <div style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '.73rem', textTransform: 'uppercase', letterSpacing: '.4px' }}>
              {r.label}
            </div>
            <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{r.value || r.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemComparisonRow({ item }) {
  const icon = CATEGORY_ICONS[item.category] || '📌';

  if (!item.has_comparison) {
    return (
      <div className="item-comparison-row" style={{ opacity: .8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="item-cmp-name">{icon} {item.raw_description || item.item_key}</div>
            <div className="item-cmp-category">{(item.category || 'other').replace(/_/g, ' ')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--text-dark)' }}>
              {fmtRs(item.uploaded_amount_paise)}
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>your bill</div>
          </div>
        </div>
        <div style={{
          marginTop: '.6rem',
          fontSize: '.82rem',
          color: 'var(--text-muted)',
          background: 'var(--gray-50)',
          borderRadius: 8,
          padding: '.5rem .75rem',
          fontStyle: 'italic',
        }}>
          ℹ️ {item.insufficient_note || 'No comparable records found in the reference dataset for this item.'}
        </div>
      </div>
    );
  }

  const pct  = item.percentage_difference;
  const absP = Math.abs(pct).toFixed(1);
  const cls  = item.comparison_status === 'higher' ? 'status-higher'
             : item.comparison_status === 'lower'  ? 'status-lower'
             :                                       'status-within';
  const diffBadgeCls = item.comparison_status === 'higher' ? 'diff-higher'
                     : item.comparison_status === 'lower'  ? 'diff-lower'
                     :                                       'diff-within';

  return (
    <div className={`item-comparison-row ${cls}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.75rem' }}>
        <div>
          <div className="item-cmp-name">
            {icon} {item.raw_description || item.item_key}
            <span className={`item-cmp-diff-badge ${diffBadgeCls}`}>
              {item.comparison_status === 'higher' ? `▲ ${absP}% above avg`
               : item.comparison_status === 'lower' ? `▼ ${absP}% below avg`
               : `≈ Within range`}
            </span>
          </div>
          <div className="item-cmp-category">{(item.category || 'other').replace(/_/g, ' ')}</div>
        </div>
      </div>

      <div className="item-cmp-grid">
        <div className="cmp-cell">
          <div className="cmp-value" style={{ color: 'var(--accent)' }}>{fmtRs(item.uploaded_amount_paise)}</div>
          <div className="cmp-label">Your Bill</div>
        </div>
        <div className="cmp-cell">
          <div className="cmp-value">{fmtRs(item.peer_average_paise)}</div>
          <div className="cmp-label">Peer Average</div>
        </div>
        <div className="cmp-cell">
          <div className="cmp-value" style={{ fontSize: '.88rem' }}>
            {fmtRs(item.peer_min_paise)} – {fmtRs(item.peer_max_paise)}
          </div>
          <div className="cmp-label">Min – Max</div>
        </div>
      </div>

      {/* ── Visual range bar ── */}
      {(() => {
        const min  = item.peer_min_paise  || 0;
        const max  = item.peer_max_paise  || 1;
        const p25  = item.percentiles?.[25] ?? min;
        const p75  = item.percentiles?.[75] ?? max;
        const avg  = item.peer_average_paise ?? min;
        const you  = item.uploaded_amount_paise ?? min;
        const span = max - min || 1;

        const pct = v => `${Math.min(100, Math.max(0, ((v - min) / span) * 100)).toFixed(2)}%`;

        const labels = [
          { v: min, text: 'Min',  color: 'var(--gray-500)' },
          { v: p25, text: '25th', color: 'var(--sage-dark)' },
          { v: avg, text: 'Avg',  color: 'var(--primary)' },
          { v: p75, text: '75th', color: 'var(--sage-dark)' },
          { v: max, text: 'Max',  color: 'var(--gray-500)' },
        ];

        return (
          <div style={{ marginTop: '1rem', userSelect: 'none' }}>
            {/* Track */}
            <div style={{ position: 'relative', height: 10, background: 'var(--gray-200)', borderRadius: 999 }}>
              {/* Interquartile shaded band */}
              <div style={{
                position: 'absolute',
                left:  pct(p25),
                width: pct(p75 - p25 + min),
                height: '100%',
                background: 'linear-gradient(90deg, var(--sage-light), var(--sage))',
                borderRadius: 999,
                opacity: .85,
              }} />
              {/* Peer average marker */}
              <div title={`Peer avg: ${fmtRs(avg)}`} style={{
                position: 'absolute',
                left: pct(avg),
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--primary)',
                border: '2px solid var(--white)',
                boxShadow: '0 1px 4px rgba(0,0,0,.25)',
                zIndex: 2,
              }} />
              {/* Your bill marker */}
              <div title={`Your bill: ${fmtRs(you)}`} style={{
                position: 'absolute',
                left: pct(you),
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'var(--accent)',
                border: '2px solid var(--white)',
                boxShadow: '0 1px 6px rgba(0,0,0,.3)',
                zIndex: 3,
              }} />
            </div>

            {/* Labels row */}
            <div style={{ position: 'relative', height: 32, marginTop: 4 }}>
              {labels.map(({ v, text, color }, i) => {
                const left = pct(v);
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    left,
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                    fontSize: '.68rem',
                    fontWeight: 700,
                    color,
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}>
                    <div style={{ marginBottom: 1 }}>{text}</div>
                    <div style={{ fontWeight: 600, fontSize: '.64rem', color: 'var(--text-muted)' }}>
                      {fmtRs(v)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '.25rem', fontSize: '.72rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', border: '1.5px solid var(--white)', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                Your bill
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', border: '1.5px solid var(--white)', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                Peer avg
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                <span style={{ display: 'inline-block', width: 24, height: 8, borderRadius: 4, background: 'var(--sage)', opacity: .85 }} />
                25th–75th %ile
              </span>
            </div>
          </div>
        );
      })()}

      <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.6rem' }}>
        {item.comparison_status_label} · Based on {item.peer_count} comparable record{item.peer_count !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bill, setBill]               = useState(null);
  const [comparison, setComparison]   = useState({});
  const [flags, setFlags]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [consent, setConsent]         = useState(false);
  const [consentResult, setConsentResult] = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [showScript, setShowScript]   = useState(false);
  const [reRunning, setReRunning]     = useState(false);

  useEffect(() => { loadBill(); }, [id]);

  const loadBill = async () => {
    try {
      const res = await billAPI.detail(id);
      let b = res.data;
      if (!b.comparison_result) {
        const cmpRes = await billAPI.compare(id, {});
        b = cmpRes.data.bill;
        setComparison(cmpRes.data.comparison || {});
        setFlags(cmpRes.data.flags || []);
      } else {
        setComparison(b.comparison_result || {});
        setFlags(b.flags || []);
      }
      setBill(b);
    } catch (err) {
      setError('Failed to load bill results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConsent = async () => {
    if (!consent) return;
    setSubmitting(true);
    try {
      const res = await billAPI.consent({ bill_id: parseInt(id), consent: true, consent_version: '1.0' });
      setConsentResult(res.data);
    } catch (err) {
      setError('Failed to submit consent.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReRun = async () => {
    setReRunning(true);
    setError('');
    try {
      const cmpRes = await billAPI.compare(id, {});
      setBill(cmpRes.data.bill);
      setComparison(cmpRes.data.comparison || {});
      setFlags(cmpRes.data.flags || []);
    } catch (err) {
      setError('Re-run failed. Please try again.');
    } finally {
      setReRunning(false);
    }
  };

  if (loading) return (
    <div className="loading-overlay">
      <div className="spinner" />
      <p>Running peer comparison…</p>
    </div>
  );

  if (!bill) return <div className="alert alert-danger">{error || 'Bill not found.'}</div>;

  const sufficiency     = comparison.sufficiency;
  const confidence      = comparison.confidence || {};
  const itemComparisons = comparison.item_comparisons || [];
  const totalData       = comparison.total || {};
  const isSyntheticOnly = comparison.synthetic_count > 0 && comparison.real_verified_count === 0;

  const sufficiencyInfo = {
    insufficient_data: { cls: 'alert-warning', text: `Only ${comparison.peer_count || 0} comparable reference bill(s) found. At least 5 are needed to show price ranges. The comparison below shows your bill items without peer statistics.` },
    limited_data:      { cls: 'alert-warning', text: `Comparison is based on ${comparison.peer_count} bills — a limited sample. Treat ranges as indicative only.` },
    normal:            { cls: 'alert-info',    text: `Comparison is based on ${comparison.peer_count} comparable reference bills.` },
    no_data:           { cls: 'alert-warning', text: 'No comparable reference data found. Upload your bill and check back when more peer bills are available.' },
  };
  const suf = sufficiencyInfo[sufficiency] || sufficiencyInfo.no_data;

  const comparedCount = itemComparisons.filter(i => i.has_comparison).length;
  const higherCount   = itemComparisons.filter(i => i.has_comparison && i.comparison_status === 'higher').length;
  const lowerCount    = itemComparisons.filter(i => i.has_comparison && i.comparison_status === 'lower').length;

  return (
    <div>

      {/* ── Print style injection ── */}
      <style>{printStyles}</style>

      {/* ── Page header ── */}
      <div className="flex-between mb-2 results-action-bar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Bill Comparison Results</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {bill.hospital_name || 'Hospital'} · {bill.bill_date || '—'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleReRun}
            disabled={reRunning}
            title="Re-fetch and recalculate the comparison"
          >
            {reRunning ? '⏳ Re-running…' : '🔄 Re-run comparison'}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => window.print()}
            title="Print or save as PDF"
          >
            🖨️ Download Summary
          </button>
          {/* Billing Counter Script button — only show if there are flags or comparisons */}
          {(flags.length > 0 || comparedCount > 0) && (
            <button
              className="btn btn-accent btn-lg"
              onClick={() => setShowScript(true)}
            >
              🏥 Prepare for Billing Desk
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Price-only notice */}
      <div className="alert alert-info" style={{ fontSize: '.88rem' }}>
        📋 <strong>Note:</strong> This comparison is about price only and is not medical or legal advice.
        Charges can differ between hospitals for many legitimate reasons including facilities and room type.
      </div>

      {/* Synthetic data warning */}
      {isSyntheticOnly && (
        <div className="alert alert-warning" style={{ fontSize: '.88rem', display: 'flex', gap: '.75rem' }}>
          <span>🧪</span>
          <span>
            <strong>Demo Dataset:</strong> The peer comparison below is based entirely on
            synthetic demonstration data. These figures are illustrative and do not represent
            verified real-world hospital pricing in Bengaluru.
          </span>
        </div>
      )}

      {/* ── 1. Summary card ── */}
      <div className="card-raised">
        <div className="card-header">📊 Comparison Summary</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '📋', label: 'Peer bills used',   val: comparison.peer_count ?? 0 },
            { icon: '🏥', label: 'Hospital tier',     val: (bill.hospital_tier || '—').replace(/_/g, ' ') },
            { icon: '🛏️', label: 'Room category',     val: (bill.room_category || '—').replace(/_/g, '-') },
            { icon: '📍', label: 'City',               val: bill.city || comparison.city || '—' },
            { icon: '🔬', label: 'Items compared',    val: `${comparedCount} / ${itemComparisons.length}` },
            { icon: '🚩', label: 'Flagged items',     val: flags.length },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-cream)',
              borderRadius: 'var(--r-organic-sm)',
              border: '1.5px solid var(--gray-200)',
              padding: '1rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '.3rem' }}>{s.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>{s.val}</div>
              <div style={{ fontSize: '.73rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700, marginTop: '.2rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className={`alert ${suf.cls}`} style={{ marginBottom: 0, fontSize: '.88rem' }}>
          {suf.text}
        </div>
      </div>

      {/* ── 2. Confidence indicator ── */}
      {confidence.level && (
        <div className="card">
          <div className="card-header">🎯 Comparison Confidence</div>
          <ConfidenceBlock confidence={confidence} />
        </div>
      )}

      {/* ── 3. Total bill range ── */}
      {sufficiency === 'normal' || sufficiency === 'limited_data' ? (
        totalData.average_paise > 0 && (
          <div className="card">
            <div className="card-header">💰 Total Bill Range</div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--accent)' }}>
                  {fmtRs(bill.total_paise)}
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Your bill</div>
              </div>
              <div style={{ color: 'var(--gray-300)', fontSize: '1.5rem' }}>↔</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.6rem', color: 'var(--primary)' }}>
                  {fmtRs(totalData.percentiles?.[25])} – {fmtRs(totalData.percentiles?.[75])}
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Peer 25th–75th percentile · {totalData.count} bills
                </div>
              </div>
            </div>
            {sufficiency === 'limited_data' && (
              <p style={{ marginTop: '.75rem', fontSize: '.8rem', color: 'var(--warning)', fontStyle: 'italic', fontWeight: 600 }}>
                ⚠️ Limited data — fewer than 10 comparable bills. Treat these ranges as indicative.
              </p>
            )}
          </div>
        )
      ) : null}

      {/* ── 4. Item-by-item comparison ── */}
      <div className="card">
        <div className="card-header">
          🔍 Item-by-Item Comparison
          {comparedCount > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-body)' }}>
              {higherCount > 0 && <span style={{ color: 'var(--warning)', marginRight: '.5rem' }}>▲ {higherCount} higher</span>}
              {lowerCount  > 0 && <span style={{ color: 'var(--success)', marginRight: '.5rem' }}>▼ {lowerCount} lower</span>}
            </span>
          )}
        </div>

        {itemComparisons.length === 0 ? (
          <div className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>📭</div>
            <p>No line items to compare. Add items on the Review page.</p>
          </div>
        ) : (
          itemComparisons.map((item, i) => (
            <ItemComparisonRow key={i} item={item} />
          ))
        )}
      </div>

      {/* ── 5. Flagged items ── */}
      <div className="card">
        <div className="card-header">🚩 Items to Review ({flags.length})</div>
        {flags.length === 0 ? (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '.5rem 0' }}>
            <span style={{ fontSize: '2rem' }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--success)' }}>No unusual charges detected</div>
              <div style={{ fontSize: '.88rem', color: 'var(--text-muted)' }}>
                Your bill looks typical based on the available reference data.
              </div>
            </div>
          </div>
        ) : (
          flags.map((flag, i) => {
            const isHigh = flag.rule_name === 'high_amount';
            const titleMap = {
              duplicate_item:   '🔁 Duplicate Line Item',
              high_amount:      '📈 Higher Than Peer Average',
              unusual_item:     '❓ Unfamiliar Charge',
              sum_mismatch:     '⚠️ Sum Mismatch',
              package_inclusion:'📦 Possible Package Overlap',
            };
            return (
              <div key={i} className={`flag-item ${isHigh ? 'high' : ''}`}>
                <div className="flag-title">
                  {titleMap[flag.rule_name] || '🚩 Review Item'}
                </div>
                <p style={{ fontSize: '.9rem' }}>{flag.message}</p>
                {flag.questions?.map((q, j) => (
                  <p key={j} className="flag-question">→ {q}</p>
                ))}
                {flag.observed != null && flag.reference != null && (
                  <div style={{
                    marginTop: '.75rem',
                    display: 'flex',
                    gap: '.75rem',
                    fontSize: '.82rem',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ background: 'rgba(255,255,255,.7)', padding: '.2rem .6rem', borderRadius: 8 }}>
                      Your charge: <strong>{fmtRs(flag.observed)}</strong>
                    </span>
                    {flag.bills_used && (
                      <span style={{ background: 'rgba(255,255,255,.7)', padding: '.2rem .6rem', borderRadius: 8 }}>
                        Based on {flag.bills_used} bills
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── 6. Contribute consent ── */}
      {!consentResult ? (
        <div className="card" style={{ borderStyle: 'dashed', borderColor: 'var(--sage)' }}>
          <div className="card-header">🌿 Help Other Families (Optional)</div>
          <p style={{ fontSize: '.9rem', color: 'var(--text-mid)', marginBottom: '1.25rem' }}>
            By contributing your anonymised bill to our benchmark, you help other families understand
            what comparable deliveries typically cost. We remove all personal details before storing,
            and you can delete your contribution any time using the reference code we'll give you.
          </p>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', cursor: 'pointer', marginBottom: '1.25rem' }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              style={{ marginTop: '.2rem', width: 'auto', accentColor: 'var(--primary)' }}
            />
            <span style={{ fontSize: '.9rem' }}>
              I consent to contributing my anonymised bill to the Fair Bill benchmark.
              I understand all personal identifiers will be removed and my bill will only be used in aggregate comparisons.
            </span>
          </label>
          <button
            className="btn btn-primary"
            onClick={handleConsent}
            disabled={!consent || submitting}
          >
            {submitting ? '⏳ Submitting…' : '🌿 Contribute My Bill'}
          </button>
        </div>
      ) : (
        <div className="alert alert-success" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.5rem' }}>🎉</span>
          <div>
            <strong>{consentResult.message}</strong>
            {consentResult.reference_code && (
              <div style={{ marginTop: '.75rem', background: 'rgba(255,255,255,.7)', borderRadius: 10, padding: '.75rem 1rem', display: 'inline-block' }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--success)', marginBottom: '.2rem' }}>
                  Your Reference Code (save this)
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.4rem', letterSpacing: '3px', color: 'var(--primary)' }}>
                  {consentResult.reference_code}
                </div>
              </div>
            )}
            {consentResult.note && (
              <p style={{ marginTop: '.5rem', fontSize: '.82rem', color: 'var(--success)', fontStyle: 'italic' }}>
                {consentResult.note}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <div className="results-bottom-nav" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem', paddingBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        {(flags.length > 0 || comparedCount > 0) && (
          <button className="btn btn-accent" onClick={() => setShowScript(true)}>
            🏥 Prepare for Billing Desk
          </button>
        )}
      </div>

      {/* ── Billing Counter Script Modal ── */}
      {showScript && (
        <BillingCounterScript
          bill={bill}
          flags={flags}
          comparisonResult={comparison}
          onClose={() => setShowScript(false)}
        />
      )}

    </div>
  );
}
