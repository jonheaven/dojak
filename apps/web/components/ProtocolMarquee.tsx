import { PROTOCOL_TAGS } from '../lib/site';

export function ProtocolMarquee() {
  const loop = [...PROTOCOL_TAGS, ...PROTOCOL_TAGS];
  return (
    <section className="overflow-hidden border-b border-zinc-200 bg-zinc-50" aria-label="Supported protocols">
      <div className="site-marquee flex whitespace-nowrap py-4">
        {loop.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="mx-3 inline-flex items-center rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-zinc-700"
          >
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
