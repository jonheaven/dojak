import { compileSendMemo, SEND_MEMO_MAX_BYTES, type CompiledSendMemo } from '../../lib/tx/sendMemo';

export function SendMemoField(props: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Domain transfer: the chain line is `dns gift <words>`. */
  dnsGift?: boolean;
  label?: string;
  placeholder?: string;
  hint?: string;
}) {
  const compiled: CompiledSendMemo = compileSendMemo(props.value, { dnsGift: props.dnsGift });
  const label = props.label ?? 'Note (optional)';
  const placeholder = props.placeholder ?? 'enjoy these';
  const hint =
    props.hint ??
    (props.dnsGift
      ? 'On-chain gift line beside the names. It does not register another domain.'
      : 'On-chain note on this transaction. Your address is the sender, so it is proof it came from this wallet.');

  return (
    <label className="block text-sm text-[#E5E5E5]">
      <span className="mb-2 flex items-baseline justify-between gap-3">
        <span>{label}</span>
        <span className={`font-mono text-[10px] ${compiled.ok ? 'text-white/40' : 'text-red-300'}`}>
          {compiled.bytes}/{SEND_MEMO_MAX_BYTES}
        </span>
      </span>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={placeholder}
        className="wallet-input"
        disabled={props.disabled}
        maxLength={120}
        autoComplete="off"
        spellCheck
      />
      {compiled.ok ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
          {hint}
          {props.dnsGift && compiled.payload ? (
            <span className="mt-1 block font-mono text-[10px] text-white/55">{compiled.payload}</span>
          ) : null}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] leading-relaxed text-red-300">{compiled.error}</p>
      )}
    </label>
  );
}
