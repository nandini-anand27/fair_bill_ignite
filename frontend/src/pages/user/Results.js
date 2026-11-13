import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billAPI } from '../../services/api';

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [consentResult, setConsentResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBill();
  }, [id]);

  const loadBill = async () => {
    try {
      const res = await billAPI.detail(id);
      setBill(res.data);
      if (!res.data.comparison_result) {
        // If not compared yet, trigger comparison
        const cmpRes = await billAPI.compare(id, {});
        setBill(cmpRes.data.bill);
      }
    } catch (err) {
      setError('Failed to load bill results.');
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

  const formatRupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;
  if (!bill) return <div className="alert alert-danger">{error || 'Bill not found.'}</div>;

  const comparison = bill.comparison_result || {};
  const flags = bill.flags || [];

  const sufficiencyLabel = {
    'no_range': 'Not enough comparable bills yet. No ranges are shown.',
    'limited_data': 'Limited data - ranges are based on fewer than 10 bills.',
    'normal': 'Based on comparable bills',
  };

  return (
    <div>
      <h2 className="mb-2">Bill Comparison Results</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Price-only notice (FR-12) */}
      <div className="alert alert-info">
        <strong>Note:</strong> This comparison is about price only and is not medical or legal advice.
      </div>

      {/* Data sufficiency */}
      <div className="card">
        <div className="card-header">Comparison Summary</div>
        <p><strong>Peer bills used:</strong> {comparison.peer_count || 0}</p>
        <p><strong>Hospital tier:</strong> {bill.hospital_tier || 'Not specified'}</p>
        <p><strong>Room category:</strong> {bill.room_category || 'Not specified'}</p>
        {comparison.sufficiency && (
          <div className={`alert ${comparison.sufficiency === 'no_range' ? 'alert-warning' : comparison.sufficiency === 'limited_data' ? 'alert-warning' : 'alert-success'}`}>
            {sufficiencyLabel[comparison.sufficiency] || comparison.sufficiency}
          </div>
        )}
      </div>

      {/* Ranges (FR-08) */}
      {comparison.sufficiency && comparison.sufficiency !== 'no_range' && (
        <div className="card">
          <div className="card-header">Typical Ranges (25th–75th Percentile)</div>

          {/* Total range */}
          {comparison.total && comparison.total.percentiles && (
            <div className="range-bar">
              <span className="range-label">Total Bill</span>
              <span className="range-value">
                {formatRupees(comparison.total.percentiles[25])} – {formatRupees(comparison.total.percentiles[75])}
              </span>
              <span className="range-count">({comparison.total.count} bills)</span>
            </div>
          )}

          {/* Category ranges */}
          {Object.entries(comparison.categories || {}).map(([catKey, catData]) => (
            <div key={catKey} className="range-bar">
              <span className="range-label">{catData.label}</span>
              <span className="range-value">
                {catData.percentiles[25] !== undefined ? `${formatRupees(catData.percentiles[25])} – ${formatRupees(catData.percentiles[75])}` : '-'}
              </span>
              <span className="range-count">({catData.count} bills)</span>
            </div>
          ))}
        </div>
      )}

      {/* Flags (FR-10, FR-11) */}
      <div className="card">
        <div className="card-header">Items to Review ({flags.length})</div>
        {flags.length === 0 ? (
          <p className="text-muted">No unusual charges detected. Your bill looks typical for comparable hospitals.</p>
        ) : (
          flags.map((flag, i) => (
            <div key={i} className={`flag-item ${flag.rule_name === 'high_amount' ? 'high' : ''}`}>
              <div className="flag-title">
                {flag.rule_name === 'duplicate_item' && 'Duplicate Item'}
                {flag.rule_name === 'high_amount' && 'Higher Than Typical'}
                {flag.rule_name === 'unusual_item' && 'Unusual Item'}
                {flag.rule_name === 'sum_mismatch' && 'Sum Mismatch'}
                {flag.rule_name === 'package_inclusion' && 'Package Inclusion'}
              </div>
              <p>{flag.message}</p>
              {flag.questions && flag.questions.map((q, j) => (
                <p key={j} className="flag-question">→ {q}</p>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Consent (FR-13) */}
      {!consentResult ? (
        <div className="card">
          <div className="card-header">Contribute to the Benchmark (Optional)</div>
          <p className="text-muted mb-1">
            Help other families by contributing your bill to the benchmark. Your personal identifiers will be removed,
            and the bill will only be used in aggregate comparisons. You can delete it anytime with a reference code.
          </p>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={consent}
                onChange={(e) => setConsent(e.target.checked)} />
              I consent to contributing my anonymized bill to the benchmark.
            </label>
          </div>
          <button className="btn btn-primary" onClick={handleConsent} disabled={!consent || submitting}>
            {submitting ? 'Submitting...' : 'Contribute'}
          </button>
        </div>
      ) : (
        <div className="alert alert-success">
          <strong>{consentResult.message}</strong>
          {consentResult.reference_code && (
            <p className="mt-1"><strong>Your reference code:</strong> {consentResult.reference_code}</p>
          )}
          {consentResult.note && <p className="text-muted">{consentResult.note}</p>}
        </div>
      )}

      <button className="btn btn-secondary mt-2" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
    </div>
  );
}
