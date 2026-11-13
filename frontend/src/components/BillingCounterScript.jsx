/**
 * BillingCounterScript — generates a polite, WhatsApp-ready script
 * or printable checklist for the hospital billing counter, based on
 * flagged discrepancies in the user's bill.
 */
import React, { useState, useMemo } from 'react';

// ── Flag-to-script template builder ───────────────────────────────────────
function buildScript({ billInfo, flags, comparisonResult }) {
  const hospitalName = billInfo?.hospital_name || 'the hospital';
  const totalRupees  = billInfo?.total_rupees   || '';

  const lines = [];

  lines.push(`Hello, I am a patient (or family member of a patient) recently discharged from ${hospitalName}.`);
  lines.push(`I have been reviewing my hospital bill${totalRupees ? ` totalling ₹${totalRupees}` : ''} and I have a few polite questions about certain charges.`);
  lines.push('');
  lines.push('I would appreciate your help in clarifying the following points:');
  lines.push('');

  let questionNumber = 1;

  // Build from flags
  flags.forEach(flag => {
    if (flag.rule_name === 'duplicate_item') {
      lines.push(`${questionNumber}. DUPLICATE CHARGE — "${flag.item || 'an item'}" appears more than once on my bill. Could you please confirm whether both entries are correct, or if one of them is a duplicate that should be removed?`);
      questionNumber++;
    } else if (flag.rule_name === 'sum_mismatch') {
      const diff = flag.difference_paise ? (flag.difference_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '';
      lines.push(`${questionNumber}. SUM DOES NOT MATCH — The individual line items on my bill add up to a different total than the printed amount${diff ? ` (a difference of ₹${diff})` : ''}. Could you help me understand which items account for this difference?`);
      questionNumber++;
    } else if (flag.rule_name === 'high_amount') {
      const cat = (flag.category || flag.item || 'this charge').replace(/_/g, ' ');
      lines.push(`${questionNumber}. HIGHER THAN USUAL — The charge for "${cat}" on my bill appears to be higher than what I have seen quoted for comparable hospitals and similar cases. Could you help explain what specific services or facilities are included in this charge?`);
      questionNumber++;
    } else if (flag.rule_name === 'package_inclusion') {
      lines.push(`${questionNumber}. PACKAGE OVERLAP — "${flag.item || 'an item'}" appears to be listed as a separate charge, but I understood it to be included in the package. Could you confirm whether this was an additional service, or if it is covered by the package?`);
      questionNumber++;
    } else if (flag.rule_name === 'unusual_item') {
      lines.push(`${questionNumber}. UNFAMILIAR CHARGE — "${flag.item || 'an item'}" is not something I recognise from my treatment. Could you explain what this charge covers and when this service was provided?`);
      questionNumber++;
    }
  });

  // Add item-wise comparison concerns
  const higherItems = (comparisonResult?.item_comparisons || []).filter(
    ic => ic.has_comparison && ic.comparison_status === 'higher' && Math.abs(ic.percentage_difference) > 20
  );
  if (higherItems.length > 0 && questionNumber <= 8) {
    higherItems.slice(0, 2).forEach(ic => {
      const name   = ic.raw_description || ic.item_key || 'an item';
      const pct    = Math.abs(ic.percentage_difference).toFixed(0);
      const yours  = ic.uploaded_amount_paise ? `₹${(ic.uploaded_amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '';
      const avg    = ic.peer_average_paise    ? `₹${(ic.peer_average_paise / 100).toLocaleString('en-IN',   { minimumFractionDigits: 2 })}` : '';
      if (yours && avg) {
        lines.push(`${questionNumber}. PRICING QUERY — "${name}" is billed at ${yours}, which is about ${pct}% above the typical peer average of ${avg} for comparable cases. Could you explain what additional services or facilities are included?`);
        questionNumber++;
      }
    });
  }

  // If no flags at all
  if (questionNumber === 1) {
    lines.push('1. I would like to request a detailed, itemised copy of my final bill for my records.');
    lines.push('2. Could you confirm that all charges have been correctly applied and there are no duplicate entries?');
    questionNumber = 3;
  }

  lines.push('');
  lines.push('I am not suggesting any wrongdoing — I simply want to ensure I fully understand what I am paying for.');
  lines.push('');
  lines.push('Thank you very much for your time and assistance. I look forward to your clarification.');
  lines.push('');
  lines.push('— A patient/family using Fair Bill');

  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────
export default function BillingCounterScript({ bill, flags, comparisonResult, onClose }) {
  const [copied, setCopied] = useState(false);

  const billInfo = {
    hospital_name: bill?.hospital_name || '',
    total_rupees:  bill?.total_rupees  || (bill?.total_paise ? (bill.total_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''),
  };

  const script = useMemo(
    () => buildScript({ billInfo, flags: flags || [], comparisonResult: comparisonResult || {} }),
    [bill, flags, comparisonResult]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select all text in textarea
      const ta = document.getElementById('billing-script-text');
      if (ta) { ta.select(); document.execCommand('copy'); }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head>
        <title>Fair Bill – Billing Counter Checklist</title>
        <style>
          body { font-family: Georgia, serif; max-width: 680px; margin: 2rem auto; color: #2C3531; line-height: 1.8; }
          h1   { font-size: 1.4rem; color: #1E3F20; margin-bottom: .3rem; }
          p    { font-size: .78rem; color: #7A8A85; margin-bottom: 1.5rem; }
          pre  { white-space: pre-wrap; font-family: inherit; font-size: .95rem; }
          hr   { border: none; border-top: 2px solid #E6E0D4; margin: 1.5rem 0; }
        </style>
      </head><body>
        <h1>Fair Bill — Billing Counter Checklist</h1>
        <p>Generated by Fair Bill · This is about price only and is not medical or legal advice.</p>
        <hr/>
        <pre>${script}</pre>
        <hr/>
        <p><em>SYNTHETIC DEMO NOTE: Comparison data may include demonstration records. Verify figures against your actual bill.</em></p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const totalFlags = (flags || []).length;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="bcs-title">

        <div className="modal-header">
          <div>
            <h3 id="bcs-title">🏥 Prepare for the Billing Desk</h3>
            <p style={{ marginTop: '.25rem', fontSize: '.88rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {totalFlags > 0
                ? `Based on ${totalFlags} flagged item${totalFlags > 1 ? 's' : ''} in your bill — here is a polite, professional script.`
                : 'A polite general checklist for your billing desk visit.'}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">

          {/* Info banner */}
          <div className="alert alert-info" style={{ marginBottom: '1.25rem', fontSize: '.88rem' }}>
            📋 This script is designed to help you ask polite, specific questions at the hospital's billing counter.
            It does not claim or imply that the hospital has made an error.
          </div>

          {/* The generated script */}
          <textarea
            id="billing-script-text"
            className="script-box"
            readOnly
            value={script}
            style={{ resize: 'vertical', minHeight: '240px', display: 'block', width: '100%', cursor: 'text' }}
            aria-label="Generated billing counter script"
          />

          {/* Actions */}
          <div className="script-actions">
            <button
              className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
              onClick={handleCopy}
              type="button"
            >
              {copied ? '✓ Copied!' : '📋 Copy for WhatsApp'}
            </button>

            <button
              className="btn btn-outline"
              onClick={handlePrint}
              type="button"
            >
              🖨️ Print Checklist
            </button>

            <button
              className="btn btn-secondary"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>

          {/* Disclaimer */}
          <p style={{ marginTop: '1.25rem', fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            This comparison is about price only and is not medical or legal advice.
            Any comparison data may include synthetic demonstration records not drawn from verified market pricing.
          </p>
        </div>
      </div>
    </div>
  );
}
