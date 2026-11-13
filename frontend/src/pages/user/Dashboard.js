import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { billAPI } from '../../services/api';
import { BENGALURU_HOSPITALS, TIER_CONFIG, ROOM_LABELS } from '../../data/bengaluruHospitals';

// ── Bill card helpers ──────────────────────────────────────────────────────
const categoryIcons  = { general:'🏥', semi_private:'🛏️', private:'🌿', premium:'⭐', default:'📋' };
const tierLabels     = { government:'Government', mid_private:'Mid-Size Private', large_private:'Large Private' };
const statusConfig   = {
  pending:  { label:'Pending review', cls:'status-pending',  emoji:'⏳' },
  approved: { label:'Approved',       cls:'status-approved', emoji:'✅' },
  rejected: { label:'Rejected',       cls:'status-rejected', emoji:'❌' },
};
const fmtRs = p => p != null
  ? `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  : '—';
const fmtRaw = r => r != null ? `₹${r.toLocaleString('en-IN')}` : 'Free / NA';

// ── HospitalCard component ─────────────────────────────────────────────────
function HospitalCard({ hosp }) {
  const [expanded, setExpanded] = useState(false);
  const tierCfg = TIER_CONFIG[hosp.tier] || TIER_CONFIG.mid_private;

  return (
    <div className="hosp-card">
      {/* Header */}
      <div className="hosp-card-header">
        <div
          className="hosp-emoji-badge"
          style={{ background: tierCfg.bg }}
        >
          {hosp.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hosp-name">{hosp.name}</div>
          <span
            className="hosp-tier-badge"
            style={{ background: tierCfg.bg, color: tierCfg.color }}
          >
            {hosp.tier_label}
          </span>
          <div className="hosp-area">
            📍 {hosp.locations.slice(0, 2).join(', ')}
            {hosp.locations.length > 2 && ` +${hosp.locations.length - 2} more`}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="hosp-card-body">

        {/* Cost pills by room category */}
        <div>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '.5rem' }}>
            Normal Delivery — Estimated Cost
          </div>
          <div className="hosp-cost-row">
            {Object.entries(hosp.cost_range).map(([room, cost]) => (
              cost != null && (
                <div className="hosp-cost-pill" key={room}>
                  <span className="pill-room">{ROOM_LABELS[room]?.split(' ')[0] || room}</span>
                  <span className="pill-price">{fmtRaw(cost)}</span>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Top amenities (first 4, expandable) */}
        <ul className="hosp-amenities">
          {(expanded ? hosp.amenities : hosp.amenities.slice(0, 4)).map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>

        {hosp.amenities.length > 4 && (
          <button
            className="hosp-detail-toggle"
            onClick={() => setExpanded(e => !e)}
            type="button"
          >
            {expanded ? '▲ Show less' : `▼ Show all ${hosp.amenities.length} amenities`}
          </button>
        )}

        {/* Highlight tags */}
        {expanded && hosp.highlights.length > 0 && (
          <div className="hosp-highlights">
            {hosp.highlights.map((h, i) => (
              <span key={i} className="hosp-highlight-tag">✦ {h}</span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="hosp-card-footer">
        <div className="hosp-rating">
          ⭐ {hosp.google_rating} / 5
        </div>
        {hosp.packages && (
          <span className="hosp-package-badge">📦 Package available</span>
        )}
        <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          ~{hosp.typical_stay_days} days
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [bills, setBills]       = useState([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [tierFilter, setTierFilter]     = useState('all');
  const [roomFilter, setRoomFilter]     = useState('private');
  const [searchQuery, setSearchQuery]   = useState('');
  const [showAll, setShowAll]           = useState(false);

  useEffect(() => { loadBills(); }, []);

  const loadBills = async () => {
    try {
      const res = await billAPI.list();
      setBills(res.data);
    } catch (err) {
      console.error('Failed to load bills', err);
    } finally {
      setLoadingBills(false);
    }
  };

  const userStr   = localStorage.getItem('user');
  const user      = userStr ? JSON.parse(userStr) : null;
  const firstName = user?.username?.split(' ')[0] || 'there';

  // ── Filter hospitals ──
  const filteredHospitals = BENGALURU_HOSPITALS.filter(h => {
    const matchTier   = tierFilter === 'all' || h.tier === tierFilter;
    const matchSearch = !searchQuery ||
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.locations.some(l => l.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchTier && matchSearch;
  });

  const displayedHospitals = showAll ? filteredHospitals : filteredHospitals.slice(0, 6);

  // ── Render ──
  if (loadingBills) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div>

      {/* ── Greeting ── */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Hello, {firstName} 👋</h1>
        <p className="page-subtitle">
          Review your hospital bills and explore Bengaluru maternity hospitals.
        </p>
      </div>

      {/* ── Quick actions ── */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <Link to="/upload" className="btn btn-primary btn-lg">📤 Upload a Bill</Link>
        <Link to="/delete-bill" className="btn btn-outline">🗑️ Delete Contribution</Link>
      </div>

      {/* ── Info banner ── */}
      <div className="alert alert-info" style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
        <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
        <span>
          <strong>How it works:</strong> Upload your hospital bill → review line items → compare with peer hospitals →
          see which charges are higher or lower. This is about price only — not medical advice.
        </span>
      </div>

      {/* ══════════════════════════════════════
          SECTION 1: Your Bills
      ══════════════════════════════════════ */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '.75rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary)', fontSize: '1.4rem' }}>
            📋 Your Bills {bills.length > 0 && `(${bills.length})`}
          </h2>
          <Link to="/upload" className="btn btn-accent btn-sm">+ New Bill</Link>
        </div>

        {bills.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🏥</div>
            <h3>No bills uploaded yet</h3>
            <p>Upload your normal-delivery hospital bill to compare charges with peer hospitals.</p>
            <Link to="/upload" className="btn btn-primary btn-lg" style={{ marginTop: '.75rem' }}>
              📤 Upload Your First Bill
            </Link>
          </div>
        ) : (
          bills.map(bill => {
            const st        = statusConfig[bill.status] || statusConfig.pending;
            const icon      = categoryIcons[bill.room_category] || categoryIcons.default;
            const hasResult = bill.comparison_result !== null;
            const flagCount = (bill.flags || []).length;
            return (
              <div key={bill.id} className="bill-card">
                <div className="bill-card-icon">{icon}</div>
                <div className="bill-card-info">
                  <div className="bill-card-hospital">{bill.hospital_name || 'Hospital not specified'}</div>
                  <div className="bill-card-meta">
                    {bill.bill_date && <span>📅 {bill.bill_date} &nbsp;·&nbsp; </span>}
                    {bill.room_category && <span>🛏️ {bill.room_category.replace('_', '-')} &nbsp;·&nbsp; </span>}
                    {bill.hospital_tier && <span>{tierLabels[bill.hospital_tier] || bill.hospital_tier}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem', flexWrap: 'wrap' }}>
                    <span className={`status-badge ${st.cls}`}>{st.emoji} {st.label}</span>
                    {flagCount > 0 && (
                      <span className="status-badge" style={{ background: '#FEF3C7', color: '#92400E' }}>
                        🚩 {flagCount} item{flagCount > 1 ? 's' : ''} to review
                      </span>
                    )}
                    {hasResult && (
                      <span className="status-badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        📊 Compared
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.75rem' }}>
                  <div className="bill-card-amount">{fmtRs(bill.total_paise)}</div>
                  {hasResult
                    ? <Link to={`/results/${bill.id}`} className="btn btn-primary btn-sm">View Results →</Link>
                    : <Link to={`/review/${bill.id}`}  className="btn btn-accent btn-sm">Review →</Link>
                  }
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ══════════════════════════════════════
          SECTION 2: Bengaluru Maternity Hospitals
      ══════════════════════════════════════ */}
      <section>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--primary)', fontSize: '1.4rem', marginBottom: '.3rem' }}>
            🏥 Bengaluru Maternity Hospitals
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', marginBottom: '1rem' }}>
            {BENGALURU_HOSPITALS.length} hospitals · Estimated normal-delivery costs &amp; amenities.
            Costs are approximate — verify directly with the hospital.
          </p>

          {/* Cost disclaimer */}
          <div className="alert alert-warning" style={{ fontSize: '.82rem', padding: '.75rem 1rem' }}>
            ⚠️ <strong>Note:</strong> Cost ranges shown are approximate estimates for 2024–2026 normal deliveries.
            Actual bills vary by doctor, complications, and room type. Always confirm charges with the hospital directly.
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>

          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Search hospital or area…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '.55rem 1rem .55rem 2.75rem',
                border: '2px solid var(--gray-300)',
                borderRadius: 50,
                fontSize: '.9rem',
                fontFamily: 'var(--font-body)',
                background: 'var(--white)',
                outline: 'none',
                transition: 'border-color .2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e  => e.target.style.borderColor = 'var(--gray-300)'}
            />
          </div>

          {/* Tier filter */}
          <div className="hospital-directory-tabs" style={{ margin: 0 }}>
            {[
              { id: 'all',          label: 'All Hospitals' },
              { id: 'government',   label: '🏛️ Government' },
              { id: 'mid_private',  label: '🏥 Mid-Size' },
              { id: 'large_private',label: '⭐ Large Private' },
            ].map(f => (
              <button
                key={f.id}
                className={`hospital-filter-btn ${tierFilter === f.id ? 'active' : ''}`}
                onClick={() => { setTierFilter(f.id); setShowAll(false); }}
                type="button"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cost view toggle */}
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '1.25rem', fontSize: '.85rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Showing costs for:</span>
          {Object.entries(ROOM_LABELS).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRoomFilter(k)}
              style={{
                padding: '.3rem .8rem',
                borderRadius: 50,
                border: `2px solid ${roomFilter === k ? 'var(--primary)' : 'var(--gray-300)'}`,
                background: roomFilter === k ? 'var(--primary)' : 'var(--white)',
                color: roomFilter === k ? 'var(--white)' : 'var(--text-mid)',
                fontWeight: 700,
                fontSize: '.78rem',
                cursor: 'pointer',
                transition: 'all .2s',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Summary cost strip */}
        {tierFilter === 'all' && !searchQuery && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}>
            {[
              { tier: 'government',    label: 'Government',    emoji: '🏛️',
                range: `Free – ₹12,000`, note: 'Free for BPL' },
              { tier: 'mid_private',   label: 'Mid-Size Private', emoji: '🏥',
                range: `₹22,000 – ₹88,000`, note: 'Most families' },
              { tier: 'large_private', label: 'Large Private', emoji: '⭐',
                range: `₹55,000 – ₹2,00,000`, note: 'Premium experience' },
            ].map(s => (
              <div
                key={s.tier}
                onClick={() => setTierFilter(s.tier)}
                style={{
                  background: TIER_CONFIG[s.tier].bg,
                  border: `2px solid ${tierFilter === s.tier ? TIER_CONFIG[s.tier].color : 'transparent'}`,
                  borderRadius: 'var(--r-organic-sm)',
                  padding: '1rem 1.25rem',
                  cursor: 'pointer',
                  transition: 'all .2s',
                }}
              >
                <div style={{ fontSize: '1.4rem', marginBottom: '.3rem' }}>{s.emoji}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: TIER_CONFIG[s.tier].color, fontSize: '1rem' }}>
                  {s.label}
                </div>
                <div style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '.95rem', marginTop: '.2rem' }}>
                  {s.range}
                </div>
                <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>
                  {s.note}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hospital grid */}
        {filteredHospitals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🔍</div>
            <h3>No hospitals found</h3>
            <p>Try a different search or tier filter.</p>
          </div>
        ) : (
          <>
            <div className="hospital-grid">
              {displayedHospitals.map(h => <HospitalCard key={h.id} hosp={h} />)}
            </div>

            {filteredHospitals.length > 6 && (
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAll(s => !s)}
                >
                  {showAll
                    ? '▲ Show fewer hospitals'
                    : `▼ Show all ${filteredHospitals.length} hospitals`}
                </button>
              </div>
            )}
          </>
        )}

        {/* Footer note */}
        <p style={{ marginTop: '1.5rem', fontSize: '.78rem', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
          Hospital information is for general reference only. Costs, amenities, and services may have changed.
          Verify all details directly with the hospital before booking.
          Google ratings shown are approximate and subject to change.
        </p>
      </section>

    </div>
  );
}
