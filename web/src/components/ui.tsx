"use client";

import NumberFlow from "@number-flow/react";
import { Dialog, Popover as RadixPopover, Slider as RadixSlider, Switch as RadixSwitch, ToggleGroup } from "radix-ui";
import { useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { formatNumber, parseNumber } from "@/lib/format";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      className={`inline-flex rounded-lg bg-well p-0.5 ${className}`}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={`min-w-0 flex-1 rounded-md px-2 py-1 leading-tight text-ink-2 transition-colors hover:text-ink data-[state=on]:bg-paper data-[state=on]:font-medium data-[state=on]:text-ink data-[state=on]:shadow-[0_1px_2px_rgba(26,37,48,0.12)] sm:px-3 sm:whitespace-nowrap ${
            size === "sm" ? "min-h-7 text-[13px]" : "min-h-8 text-sm"
          }`}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

interface NumberFieldProps {
  value: number | null;
  onChange: (value: number) => void;
  onClear?: () => void;
  label: string;
  prefix?: string;
  suffix?: string;
  scale?: number;
  digits?: number;
  min?: number;
  max?: number;
  grouping?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

/** Number input that shows grouped digits and accepts common typing styles. */
export function NumberField({
  value,
  onChange,
  onClear,
  label,
  prefix,
  suffix,
  scale = 1,
  digits = 0,
  min,
  max,
  grouping = true,
  placeholder,
  className = "w-full",
  inputClassName = "",
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const scaled = value === null ? null : Math.round(value * scale * 10 ** digits) / 10 ** digits;
  const shown = scaled === null ? "" : grouping ? formatNumber(scaled, digits) : String(scaled);

  function commit(text: string) {
    const parsed = parseNumber(text);
    if (parsed === null) {
      if (text.trim() === "") onClear?.();
      return;
    }
    let next = parsed / scale;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(next);
  }

  return (
    <div
      className={`flex h-9 items-center rounded-lg border border-line bg-paper transition-[border-color,box-shadow] hover:border-line-strong focus-within:border-buy focus-within:shadow-[0_0_0_3px_var(--focus)] ${className}`}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {prefix && <span className="pl-2.5 text-sm text-ink-3">{prefix}</span>}
      <input
        id={id}
        inputMode="decimal"
        placeholder={placeholder}
        value={draft ?? shown}
        onFocus={(event) => {
          setDraft(shown);
          event.target.select();
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          commit(event.target.value);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        className={`num h-full w-full min-w-0 bg-transparent px-2 text-right text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-ink-3 ${inputClassName}`}
      />
      {suffix && <span className="pr-2.5 text-sm whitespace-nowrap text-ink-3">{suffix}</span>}
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
}) {
  return (
    <RadixSlider.Root
      value={[value]}
      onValueChange={([next]) => onChange(next)}
      min={min}
      max={max}
      step={step}
      className="relative flex h-5 w-full touch-none items-center select-none"
    >
      <RadixSlider.Track className="relative h-1 grow rounded-full bg-line">
        <RadixSlider.Range className="absolute h-full rounded-full bg-ink" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        aria-label={label}
        className="relative block size-5 rounded-full border-2 border-ink bg-paper shadow-sm transition-transform after:absolute after:-inset-2.5 after:content-[''] hover:scale-110 sm:size-4"
      />
    </RadixSlider.Root>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
      className="relative h-5 w-9 shrink-0 rounded-full bg-line-strong transition-colors data-[state=checked]:bg-ink"
    >
      <RadixSwitch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-paper shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </RadixSwitch.Root>
  );
}

export function Popover({
  trigger,
  children,
  align = "end",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-80 max-w-[calc(100vw-24px)] rounded-xl border border-line bg-paper p-4 text-sm shadow-float outline-none"
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/20" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-paper shadow-float outline-none">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
            <Dialog.Title className="text-[17px] font-semibold tracking-tight">{title}</Dialog.Title>
            <Dialog.Close className="-mr-2 grid size-10 place-items-center rounded-md text-ink-3 hover:bg-well hover:text-ink" aria-label={t.common.close}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{ background: color, width: size, height: size }}
    />
  );
}

export function Money({ value, signed = false, className = "" }: { value: number; signed?: boolean; className?: string }) {
  return (
    <NumberFlow
      value={Math.round(value)}
      locales="en-IE"
      format={{ style: "currency", currency: "EUR", maximumFractionDigits: 0, signDisplay: signed ? "exceptZero" : "auto" }}
      className={`num ${className}`}
    />
  );
}

/** Popover that opens on hover with a mouse and on tap with touch. */
export function Hint({
  trigger,
  children,
  align = "start",
  width = 320,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 80);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 140);
  };
  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger
        asChild
        onPointerEnter={(event) => event.pointerType === "mouse" && show()}
        onPointerLeave={(event) => event.pointerType === "mouse" && hide()}
      >
        {trigger}
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          onPointerEnter={(event) => event.pointerType === "mouse" && show()}
          onPointerLeave={(event) => event.pointerType === "mouse" && hide()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          style={{ width, maxWidth: "calc(100vw - 24px)" }}
          className="z-50 rounded-xl border border-line bg-paper p-4 text-sm shadow-float outline-none"
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export function InfoLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Hint
      trigger={
        <button
          type="button"
          className="justify-self-start text-left text-sm text-ink-2 underline decoration-line-strong decoration-dotted underline-offset-4 hover:text-ink hover:decoration-ink-3"
        >
          {label}
        </button>
      }
    >
      {children}
    </Hint>
  );
}
