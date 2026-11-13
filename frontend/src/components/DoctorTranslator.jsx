import React, { useState } from 'react';

// Sample translation dictionary for common maternity/hospital terms in Bengaluru bills
const medicalTranslations = {
  "Oxytocin Infusion Drip": "Standard medication used to safely help induce labor or manage contractions.",
  "Fetal Monitoring (CTG)": "Continuous electronic tracking of baby's heart rate during labor.",
  "Epidural Administration": "Targeted pain-relief medication injected into the spine during labor.",
  "Phototherapy Charges": "Special blue-light treatment used if the newborn develops mild jaundice.",
  "Surgical Consumables": "Items like disposable gloves, gauze, syringes, and surgical drapes used during delivery.",
  "Neonatal Resuscitation Kit": "Standard emergency equipment kept on standby in the delivery room just in case."
};

export default function DoctorTranslator({ itemName }) {
  const [isOpen, setIsOpen] = useState(false);
  const plainEnglish = medicalTranslations[itemName] || "Standard hospital charge associated with your maternity care package.";

  return (
    <div style={{ margin: '6px 0' }}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)} 
        style={{
          background: 'var(--primary-light, #EBF2EC)',
          color: 'var(--primary, #1E3F20)',
          border: 'none',
          padding: '2px 10px',
          borderRadius: '12px',
          fontSize: '0.8rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        💡 {isOpen ? 'Hide translation' : 'What is this?'}
      </button>

      {isOpen && (
        <div style={{
          background: 'var(--white, #fff)',
          border: '1px solid var(--primary, #1E3F20)',
          borderRadius: '8px',
          padding: '8px 12px',
          marginTop: '6px',
          fontSize: '0.85rem',
          color: 'var(--gray-700, #444)'
        }}>
          <strong>Plain English:</strong> {plainEnglish}
        </div>
      )}
    </div>
  );
}