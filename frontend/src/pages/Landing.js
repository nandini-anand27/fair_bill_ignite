import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import useDarkMode from '../hooks/useDarkMode';
import './Landing.css';

const FAQS = [
  {
    q: 'Is this free?',
    a: 'Yes, entirely. No sign-up fee, no subscription, no ads.',
  },
  {
    q: 'What bills can I check right now?',
    a: 'Normal-delivery bills from hospitals in Bengaluru. Other cities and procedures are next.',
  },
  {
    q: 'Where does the comparison data come from?',
    a: 'A dataset of real and synthetic bills from hospitals across Bengaluru — government, mid-private, and large-private. We are growing it as more families contribute.',
  },
  {
    q: 'Will you store my bill?',
    a: 'Only if you choose to contribute it. If you do, we strip your name, ID, and contact details before anything is saved. You can delete it any time with the reference code we give you.',
  },
  {
    q: 'Does this say whether my hospital overcharged me?',
    a: "No. We show you where your charges sit relative to what other families paid at similar hospitals. What you do with that is up to you.",
  },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);
  const [dark, setDark] = useDarkMode();

  return (
    <div className="landing">

      {/* ── Nav ── */}
      <header className="land-nav">
        <div className="land-nav-inner">
          <span className="land-logo">Fair Bill</span>
          <div className="land-nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#faq">Questions</a>
            <Link to="/login" className="land-nav-login">Sign in</Link>
            <Link to="/register" className="land-btn-plain">Get started</Link>
            <label className="dark-toggle-wrap" title={dark ? 'Light mode' : 'Dark mode'}>
              <button className="dark-toggle" onClick={() => setDark(d => !d)} aria-label="Toggle dark mode" />
            </label>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="land-hero">
        <div className="land-hero-inner">
          <div className="land-hero-left">
            <p className="land-kicker">For families in Bengaluru — free</p>
            <h1 className="land-h1">
              Your hospital bill,<br />explained.
            </h1>
            <p className="land-lead">
              Upload your normal-delivery bill. We read the line items, compare each charge
              against what other families paid at similar hospitals, and tell you plainly
              which ones look unusual — and what to ask.
            </p>
            <div className="land-hero-actions">
              <Link to="/register" className="land-btn-primary">Check my bill</Link>
              <Link to="/login" className="land-btn-ghost">I have an account</Link>
            </div>
            <p className="land-fine">
              No subscription. No medical advice. Price comparisons only.
            </p>
          </div>

          <div className="land-hero-right">
            <div className="land-bill-preview">
              <div className="land-bill-header">
                <span className="land-bill-hosp">Cloudnine Hospital, Bengaluru</span>
                <span className="land-bill-date">28 Nov 2026</span>
              </div>
              <div className="land-bill-row">
                <span>Room Rent — Deluxe (2 days)</span>
                <span>₹13,000</span>
              </div>
              <div className="land-bill-row">
                <span>Normal Delivery Package</span>
                <span>₹35,000</span>
              </div>
              <div className="land-bill-row land-bill-row-flag">
                <span>Doctor Consultation Fee</span>
                <span className="land-flag-amt">₹7,000</span>
              </div>
              <div className="land-bill-flag-note">
                Higher than 73% of comparable bills. Peer range: ₹2,000 – ₹5,500.
              </div>
              <div className="land-bill-row">
                <span>Nursing Charges (2 days)</span>
                <span>₹4,000</span>
              </div>
              <div className="land-bill-row land-bill-total">
                <span>Total</span>
                <span>₹73,700</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="land-how" id="how-it-works">
        <div className="land-how-inner">
          <h2 className="land-h2">How it works</h2>
          <div className="land-how-steps">
            <div className="land-how-step">
              <div className="land-how-num">1</div>
              <div>
                <h3>Upload your bill</h3>
                <p>Photo or PDF. Our scanner reads the line items — you correct anything it misses.</p>
              </div>
            </div>
            <div className="land-how-connector" />
            <div className="land-how-step">
              <div className="land-how-num">2</div>
              <div>
                <h3>We run the comparison</h3>
                <p>Each charge is matched against bills from hospitals of the same type, in the same city, with the same room category.</p>
              </div>
            </div>
            <div className="land-how-connector" />
            <div className="land-how-step">
              <div className="land-how-num">3</div>
              <div>
                <h3>You see what stands out</h3>
                <p>Charges that sit above the typical range get flagged. Each flag comes with a plain-language explanation and a suggested question you can ask the billing desk.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Honest section ── */}
      <section className="land-honest">
        <div className="land-honest-inner">
          <div className="land-honest-text">
            <h2 className="land-h2">What this is — and what it isn't</h2>
            <p>
              Fair Bill tells you where your charges sit relative to what other families paid.
              It does not tell you whether your hospital did anything wrong. Charges vary for
              legitimate reasons — room choice, complications, specific doctors. We show you
              the numbers. You decide what to do with them.
            </p>
            <p>
              The comparison data comes from a mix of real bills shared by families and
              synthetic reference data built from published Bengaluru hospital pricing. It
              is labelled clearly so you always know what you are comparing against.
            </p>
            <Link to="/register" className="land-btn-primary">Start for free</Link>
          </div>
          <div className="land-honest-aside">
            <div className="land-aside-item">
              <span className="land-aside-check">✓</span>
              <span>Shows price ranges per line item</span>
            </div>
            <div className="land-aside-item">
              <span className="land-aside-check">✓</span>
              <span>Flags unusual charges with suggested questions</span>
            </div>
            <div className="land-aside-item">
              <span className="land-aside-check">✓</span>
              <span>Removes your name and ID before storing anything</span>
            </div>
            <div className="land-aside-item">
              <span className="land-aside-check">✓</span>
              <span>Free, with no ads or subscriptions</span>
            </div>
            <div className="land-aside-item land-aside-item-no">
              <span className="land-aside-cross">✗</span>
              <span>Does not give medical or legal advice</span>
            </div>
            <div className="land-aside-item land-aside-item-no">
              <span className="land-aside-cross">✗</span>
              <span>Does not tell you a hospital acted wrongly</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="land-faq-wrap" id="faq">
        <div className="land-faq-inner">
          <h2 className="land-h2">Common questions</h2>
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
                {openFaq === i && <div className="land-faq-a">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="land-footer">
        <div className="land-footer-inner">
          <span className="land-logo">Fair Bill</span>
          <span className="land-footer-note">
            Price comparisons only — not medical or legal advice · Bengaluru, Karnataka
          </span>
          <div className="land-footer-links">
            <Link to="/register">Register</Link>
            <Link to="/login">Sign in</Link>
            <a href="#faq">FAQ</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
