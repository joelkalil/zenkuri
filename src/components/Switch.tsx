interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/** Interruptor de ajustes: trilho com contorno, polegar chapado. */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 disabled:opacity-40 ${
        checked ? 'border-transparent bg-violet-500' : 'border-gray-600 bg-gray-850'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-150 ${checked ? 'translate-x-6 bg-zk-accent-ink' : 'translate-x-1 bg-gray-400'}`} />
    </button>
  );

  if (!label) return toggle;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-200">{label}</p>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      {toggle}
    </div>
  );
}
