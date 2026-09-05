import { Minus, Plus } from "lucide-react";

interface QuantityControlProps {
  disabled?: boolean;
  label: string;
  max: number;
  onChange: (quantity: number) => void;
  value: number;
}

export function QuantityControl({
  disabled = false,
  label,
  max,
  onChange,
  value,
}: QuantityControlProps) {
  const safeMax = Math.max(1, max);

  function updateQuantity(quantity: number): void {
    onChange(Math.max(1, Math.min(Math.floor(quantity), safeMax)));
  }

  return (
    <div
      aria-label={label}
      className="grid h-11 w-36 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] overflow-hidden rounded-md border border-zinc-300 bg-white"
      role="group"
    >
      <button
        aria-label="Decrease quantity"
        className="inline-flex items-center justify-center text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-brand-ring disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled || value <= 1}
        onClick={() => updateQuantity(value - 1)}
        title="Decrease quantity"
        type="button"
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <input
        aria-label="Quantity"
        className="min-w-0 border-x border-zinc-300 bg-white px-1 text-center text-sm font-semibold text-zinc-950 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:bg-zinc-50"
        disabled={disabled}
        inputMode="numeric"
        max={safeMax}
        min={1}
        onChange={(event) => {
          if (Number.isFinite(event.target.valueAsNumber)) {
            updateQuantity(event.target.valueAsNumber);
          }
        }}
        type="number"
        value={value}
      />
      <button
        aria-label="Increase quantity"
        className="inline-flex items-center justify-center text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-brand-ring disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled || value >= safeMax}
        onClick={() => updateQuantity(value + 1)}
        title="Increase quantity"
        type="button"
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
