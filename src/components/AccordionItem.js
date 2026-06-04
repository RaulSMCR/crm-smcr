'use client';

import { useState } from 'react';

export default function AccordionItem({ question, answer, id = 'item' }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerId = `faq-btn-${id}`;
  const panelId = `faq-panel-${id}`;

  return (
    <div className="border-b border-neutral-200 last:border-b-0">
      <button
        id={triggerId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left py-5 px-6 flex justify-between items-center gap-4 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300"
      >
        <span className="text-base font-semibold text-neutral-900 leading-snug">
          {question}
        </span>
        <svg
          aria-hidden="true"
          className={`shrink-0 w-5 h-5 text-brand-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: isOpen ? '600px' : '0' }}
      >
        <div className="px-6 pb-5 pt-1 flex flex-col gap-3">
          {answer.split('\n\n').map((paragraph, i) => (
            <p key={i} className="text-neutral-700 leading-relaxed text-sm">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
