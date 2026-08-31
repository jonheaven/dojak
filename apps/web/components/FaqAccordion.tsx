'use client';

import { useState } from 'react';

export function FaqAccordion({
  items
}: {
  items: ReadonlyArray<{ question: string; answer: string }>;
}) {
  const [open, setOpen] = useState(0);

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <article key={item.question} className="site-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen((prev) => (prev === index ? -1 : index))}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-semibold">{item.question}</span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D4A017]/50 bg-[#D4A017]/10 text-sm font-bold">
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen ? (
              <p className="border-t border-zinc-200 px-5 py-4 text-sm leading-6 text-zinc-600">{item.answer}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
