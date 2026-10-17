'use client';

import React, { useState } from 'react';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'What is Krix?',
    a: 'Krix is an open, tamper-evident audit layer for public supply chains and civic projects. It tracks official custody handovers while giving citizens, doctors, and inspectors an uncensorable platform to report ground reality.',
  },
  {
    q: 'Who can edit the official record?',
    a: 'Only the current legal custodian of a record can update its transit status, quantity received, and transit notes. Once custody is transferred to the next custodian (e.g., from warehouse to distributor, or distributor to rural clinic), the previous custodian permanently loses write permissions.',
  },
  {
    q: 'What does "readonly" mean for ground reality reports?',
    a: 'When an inspector or citizen submits a ground report, it is sealed with the Arkiv "readonly: true" flag. Once committed into a block, the cryptographic protocol prevents any wallet—including the creator, system administrators, and database engineers—from modifying or overriding its contents.',
  },
  {
    q: 'Can reports be deleted by government officials or ministers?',
    a: 'No. Traditional government portals use centralized SQL databases where a database administrator can delete rows or change audit entries. Krix runs on the Tiramisu rollup where entities cannot be arbitrarily deleted by administrators.',
  },
  {
    q: 'Who pays the gas fees?',
    a: 'Official record creation and custody updates are paid by the participating custodians in testnet $GLM tokens. Ground reality reports submitted by citizens are designed with minimal gas overhead, and report life can be extended permissionlessly by any community supporter.',
  },
  {
    q: 'What happens when a report expires, and what is Lifetime Extension?',
    a: 'On-chain storage uses rent-based lifespans to prevent state bloat. Krix entities default to 30 days of life, but are created with "permissionlessExtension: true". Anyone—a journalist, an NGO, or a resident—can click "Extend Life (+30d)" to renew the storage indefinitely.',
  },
  {
    q: 'Is my identity public when submitting a report?',
    a: 'Only your cryptographic wallet address is attached to the report. Krix strips EXIF GPS metadata from uploaded photo evidence by default to protect the personal safety of whistleblowers, while preserving visual verification.',
  },
  {
    q: 'What does the cover-up check actually prove?',
    a: 'The detection engine mathematically compares historical block revisions against independent citizen reports. It surfaces documented contradictions—such as an official changing a batch from DAMAGED to ALL_GOOD despite three independent defect reports. It provides objective, cryptographic evidence; it does not claim judicial guilt.',
  },
];

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      {FAQS.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              padding: '20px 0',
            }}
          >
            <button
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '17px',
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                padding: 0,
                gap: '16px',
              }}
            >
              <span>{faq.q}</span>
              <span
                style={{
                  fontSize: '20px',
                  color: 'var(--accent)',
                  transform: isOpen ? 'rotate(45deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  lineHeight: 1,
                }}
              >
                +
              </span>
            </button>

            {isOpen && (
              <div
                style={{
                  marginTop: '12px',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  color: 'var(--text-muted)',
                }}
              >
                {faq.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
