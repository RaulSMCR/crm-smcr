// src/components/AccordionItem.js
'use client'; // This component is interactive, so it's a client component

import { useState } from 'react';

export default function AccordionItem({ question, answer }) {
  // 'isOpen' is the "memory" of this component. It's either true or false.
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b">
      <button
        onClick={() => setIsOpen(!isOpen)} // Clicking the button flips the state
        className="w-full text-left py-4 px-6 flex justify-between items-center focus:outline-none"
      >
        <span className="text-lg font-medium text-gray-800">{question}</span>
        {/* The icon changes based on whether it's open or closed */}
        <span>{isOpen ? '-' : '+'}</span>
      </button>
      {/* The answer is only shown if 'isOpen' is true */}
      {isOpen && (
        <div className="pb-4 px-6">
          <p className="text-gray-600">{answer}</p>
        </div>
      )}
    </div>
  );
}