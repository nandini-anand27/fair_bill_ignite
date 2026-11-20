import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useDarkMode from '../hooks/useDarkMode';
import './Landing.css';

/* ── Data ─────────────────────────────────────────── */

const STEPS = [
  {
    num: '01',
    icon: '📄',
    title: 'Upload your bill',
    desc: 'Take a photo or upload a PDF of your hospital bill. Our scanner reads the line items for you.',
  },
  {
    num: '02',
    icon: '✏️',
    title: 'Review & confirm',
    desc: 'Check the extracted items, correct anything that looks off, and confirm your totals.',
  },
  {
    num: '03',
    icon: '📊',
    title: 'See how it compares',
    desc: 'We match your bill against comparable hospitals in Bengaluru and show you typical price ranges per item.',
  },
  {
    num: '04',
    icon: '💬',
    title: 'Know what to ask',
    desc: 'Any charge that looks unusual comes with a plain-language explanation and a suggested question for the hospital.',
  },
];

const FAQS = [
  {
    q: 'Is this free to use?',
    a: 'Yes, completely free. There are no subscriptions, no hidden fees, and no ads.',
  },
  {
    q: 'What kind of bills does Fair Bill support right now?',
    a: 'We currently support normal-delivery bills from hospitals in Bengaluru. Support for other procedures and cities is coming soon.',
  },
  {
    q: 'Where does the comparison data come from?',
    a: 'From a reference dataset of similar bills collected from hospitals across Bengaluru, covering government, mid-private, and large-private tiers.',
  },
  {
    q: 'Is my bill data kept private?',
    a: 'Yes. Your bill is only used to generate your personal comparison. If you choose to contribute it to the benchmark, we remove all personal details before storing anything.',
  },
  {
    q: 'Does this tell me whether I was overcharged?',
    a: "Fair Bill only shows you price comparisons — it never makes judgements about whether a charge is right or wrong. What you do with the information is entirely up to you.",
  },
  {
    q: 'Can I delete my data?',
    a: 'Yes. If you contribute your bill, you receive a reference code. You can use that code at any time to permanently delete your data from our system.',
  },
];

const TRUST = [
  { icon: '🔒', label: 'Your data stays private' },
  { icon: '🏥', label: 'Built for Bengaluru families' },
  { icon: '📋', label: 'Price info only — no medical advice' },
  { icon: '🗑️', label: 'Delete your data anytime' },
];

/* ── Component ────────────────────────────────────── */

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);
  const [dark, setDark] = useDarkMode();

  return (
    <div className="landing">

      {/* ── Top nav ── */}
      <header className="land-nav">
        <div className="land-nav-inner">
          <span className="land-logo">
            <span className="land-logo-icon">🏥</span>
            Fair Bill
          </span>
          <div className="land-nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
            <Link to="/login" className="land-nav-login">Sign in</Link>
            <Link to="/register" className="land-btn land-btn-sm">Get started</Link>
            <label className="dark-toggle-wrap" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
              <button className="dark-toggle" onClick={() => setDark(d => !d)} aria-label="Toggle dark mode" />
              <span>{dark ? '🌙' : '☀️'}</span>
            </label>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="land-hero">
        <div className="land-hero-blob land-blob-1" />
        <div className="land-hero-blob land-blob-2" />
        <div className="land-hero-inner">
          <div className="land-hero-text">
            <div className="land-eyebrow">Free for families in Bengaluru</div>
            <h1 className="land-h1">
              Understand your<br />
              <span className="land-h1-accent">hospital bill</span><br />
              before you pay it.
            </h1>
            <p className="land-lead">
              Upload your bill, see how each charge compares to similar hospitals,
              and know exactly what questions to ask — in plain language, no medical jargon.
            </p>
            <div className="land-hero-actions">
              <Link to="/register" className="land-btn land-btn-lg">
                Check my bill for free
              </Link>
              <a href="#how-it-works" className="land-link-arrow">
                See how it works <span>↓</span>
              </a>
            </div>
          </div>

          <div className="land-hero-card">
            <div className="land-mock-card">
              <div className="land-mock-header">
                <span className="land-mock-title">Room charges per day</span>
                <span className="land-mock-amount">₹4,200</span>
              </div>
              <div className="land-mock-bar-wrap">
                <div className="land-mock-bar">
                  <div className="land-mock-fill" style={{ width: '72%' }} />
                  <div className="land-mock-marker" style={{ left: '72%' }} />
                </div>
                <div className="land-mock-range">
                  <span>₹1,500</span>
                  <span className="land-mock-range-label">Typical range</span>
                  <span>₹8,000</span>
                </div>
              </div>
              <div className="land-mock-tag land-mock-ok">✓ Within typical range</div>

              <div className="land-mock-divider" />

              <div className="land-mock-header">
                <span className="land-mock-title">Doctor consultation fee</span>
                <span className="land-mock-amount land-mock-high">₹3,800</span>
              </div>
              <div className="land-mock-bar-wrap">
                <div className="land-mock-bar">
                  <div className="land-mock-fill land-mock-fill-high" style={{ width: '91%' }} />
                  <div className="land-mock-marker land-mock-marker-high" style={{ left: '91%' }} />
                </div>
                <div className="land-mock-range">
                  <span>₹300</span>
                  <span className="land-mock-range-label">Typical range</span>
                  <span>₹2,000</span>
                </div>
              </div>
              <div className="land-mock-tag land-mock-flag">⚠ Higher than typical — see suggested questions</div>
            </div>
            <div className="land-mock-shadow" />
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="land-trust">
        <div className="land-trust-inner">
          {TRUST.map(t => (
            <div key={t.label} className="land-trust-item">
              <span className="land-trust-icon">{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="land-section" id="how-it-works">
        <div className="land-section-inner">
          <div className="land-section-label">How it works</div>
          <h2 className="land-h2">Four steps from bill to clarity</h2>
          <p className="land-section-sub">
            No complicated forms. No medical expertise needed.
          </p>
          <div className="land-steps">
            {STEPS.map((s, i) => (
              <div key={i} className="land-step">
                <div className="land-step-num">{s.num}</div>
                <div className="land-step-icon">{s.icon}</div>
                <h3 className="land-step-title">{s.title}</h3>
                <p className="land-step-desc">{s.desc}</p>
                {i < STEPS.length - 1 && <div className="land-step-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For families callout ── */}
      <section className="land-callout">
        <div className="land-callout-inner">
          <div className="land-callout-blob" />
          <div className="land-callout-text">
            <h2 className="land-h2 land-h2-light">
              Built for the moment<br />after you get home from the hospital.
            </h2>
            <p className="land-callout-body">
              Hospital bills arrive when families are already exhausted. Fair Bill gives you
              a calm, clear way to understand what you were charged — so you can ask the right
              questions from a place of knowledge, not confusion.
            </p>
            <Link to="/register" className="land-btn land-btn-light">
              Get started — it's free
            </Link>
          </div>
          <div className="land-callout-stats">
            <div className="land-stat">
              <span className="land-stat-num">50+</span>
              <span className="land-stat-label">Reference bills in our dataset</span>
            </div>
            <div className="land-stat">
              <span className="land-stat-num">3</span>
              <span className="land-stat-label">Hospital tiers covered</span>
            </div>
            <div className="land-stat">
              <span className="land-stat-num">₹0</span>
              <span className="land-stat-label">Cost to you</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="land-section land-faq-section" id="faq">
        <div className="land-section-inner land-faq-inner">
          <div className="land-section-label">Questions</div>
          <h2 className="land-h2">Frequently asked</h2>
          <div className="land-faq-list">
            {FAQS.map((f, i) => (
              <div
                key={i}
                className={`land-faq-item ${openFaq === i ? 'land-faq-open' : ''}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="land-faq-q">
                  <span>{f.q}</span>
                  <span className="land-faq-chevron">{openFaq === i ? '−' : '+'}</span>
                </div>
                {openFaq === i && (
                  <div className="land-faq-a">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="land-cta">
        <div className="land-cta-inner">
          <h2 className="land-h2 land-h2-light">Ready to check your bill?</h2>
          <p className="land-cta-sub">Free, private, and takes less than five minutes.</p>
          <div className="land-cta-actions">
            <Link to="/register" className="land-btn land-btn-lg land-btn-light">
              Create a free account
            </Link>
            <Link to="/login" className="land-link-light">
              Already have an account? Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="land-footer">
        <div className="land-footer-inner">
          <span className="land-logo land-logo-sm">
            <span>🏥</span> Fair Bill
          </span>
          <span className="land-footer-note">
            Price comparisons only — not medical or legal advice.
          </span>
          <div className="land-footer-links">
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
            <a href="#faq">FAQ</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
