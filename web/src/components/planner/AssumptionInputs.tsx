"use client";

import { useState } from "react";
import { NumberField, Segmented, Sheet } from "@/components/ui";
import type { PlannerStart } from "@/lib/api";
import { formatEuro, formatPercent } from "@/lib/format";
import { type Assumptions, DEFAULT_ASSUMPTIONS } from "@/lib/planner";

interface Props {
  start: PlannerStart;
  assumptions: Assumptions;
  onChange: (assumptions: Assumptions) => void;
  price: number;
}

export function AssumptionInputs({ start, assumptions, onChange, price }: Props) {
  const [open, setOpen] = useState(false);
  const base = start.scenario;
  const mortgage = base.buy.mortgage;
  const set = <K extends keyof Assumptions>(key: K) => (value: Assumptions[K]) => onChange({ ...assumptions, [key]: value });
  const edited = Object.keys(assumptions).some((key) => key !== "include_aso");

  const downPayment = assumptions.down_payment_share ?? mortgage.down_payment_share;
  const rateType = assumptions.rate_type ?? mortgage.rate_type;
  const rateKind = assumptions.rate_kind ?? (mortgage.rate_path.kind === "custom" ? "flat" : mortgage.rate_path.kind);
  const startRate = assumptions.start_rate ?? mortgage.rate_path.start_rate;
  const strategy = assumptions.surplus_strategy ?? base.investment.surplus_strategy;
  const investmentReturn = assumptions.investment_return ?? base.investment.investment_return;
  const percent = { suffix: "%", scale: 100, digits: 1, min: -0.5, max: 0.5 };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper px-5 py-3.5 text-left transition-colors hover:border-line-strong"
      >
        <span className="text-[15px] font-semibold">Assumptions</span>
        <span className="num ml-auto flex flex-wrap justify-end gap-1.5 text-[13px] text-ink-2">
          <Chip>{formatPercent(startRate, 2)} rate</Chip>
          <Chip>{formatPercent(downPayment, 0)} down</Chip>
          <Chip>
            {strategy === "invest" ? `${formatPercent(investmentReturn)} return` : "Savings account"}
          </Chip>
        </span>
        <svg className="shrink-0 text-ink-3" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m4.5 3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <Sheet open={open} onOpenChange={setOpen} title="Assumptions">
        <div className="space-y-8">
          <Group title="Mortgage">
            <Setting label="Down payment" note={formatEuro(price * downPayment)}>
              <NumberField label="Down payment" value={downPayment} onChange={set("down_payment_share")} suffix="%" scale={100} digits={1} min={0} max={1} />
            </Setting>
            <Setting label="Rate type">
              <Segmented
                label="Rate type"
                size="sm"
                value={rateType}
                onChange={set("rate_type")}
                options={[
                  { value: "variable", label: "Variable" },
                  { value: "fixed", label: "Fixed" },
                ]}
              />
            </Setting>
            {rateType === "fixed" && (
              <>
                <Setting label="Fixed rate">
                  <NumberField
                    label="Fixed rate"
                    value={assumptions.fixed_rate ?? mortgage.fixed_rate ?? startRate}
                    onChange={set("fixed_rate")}
                    suffix="%"
                    scale={100}
                    digits={2}
                    min={-0.05}
                    max={0.3}
                  />
                </Setting>
                <Setting label="Fixed for">
                  <NumberField
                    label="Fixed for"
                    value={assumptions.fixed_years ?? mortgage.fixed_years ?? 5}
                    onChange={(value) => set("fixed_years")(Math.round(value))}
                    suffix="years"
                    min={1}
                    max={40}
                  />
                </Setting>
              </>
            )}
            <Setting label={rateType === "fixed" ? "Rate afterwards" : "Interest rate"} note={start.sources.mortgage_rate}>
              <NumberField label="Interest rate" value={startRate} onChange={set("start_rate")} suffix="%" scale={100} digits={2} min={-0.05} max={0.3} />
            </Setting>
            <Setting label="Rate path">
              <Segmented
                label="Rate path"
                size="sm"
                value={rateKind}
                onChange={set("rate_kind")}
                options={[
                  { value: "flat", label: "Level" },
                  { value: "rising", label: "Rising" },
                  { value: "falling", label: "Falling" },
                ]}
              />
            </Setting>
            {rateKind !== "flat" && (
              <Setting label="Change per year">
                <NumberField
                  label="Change per year"
                  value={assumptions.change_per_year ?? (mortgage.rate_path.change_per_year || 0.0025)}
                  onChange={set("change_per_year")}
                  suffix="pts"
                  scale={100}
                  digits={2}
                  min={0}
                  max={0.05}
                />
              </Setting>
            )}
            <Setting label="Loan term">
              <NumberField
                label="Loan term"
                value={assumptions.term_years ?? mortgage.term_years}
                onChange={(value) => set("term_years")(Math.round(value))}
                suffix="years"
                min={1}
                max={40}
              />
            </Setting>
            <Setting label="Repayment">
              <Segmented
                label="Repayment"
                size="sm"
                value={assumptions.repayment ?? mortgage.repayment}
                onChange={set("repayment")}
                options={[
                  { value: "annuity", label: "Annuity" },
                  { value: "equal_principal", label: "Equal principal" },
                ]}
              />
            </Setting>
          </Group>

          <Group title="Growth per year" note="Defaults are 10-year averages of official indices.">
            <Setting label="Flat prices">
              <NumberField label="Flat price growth" value={assumptions.price_growth ?? base.buy.price_growth} onChange={set("price_growth")} {...percent} />
            </Setting>
            <Setting label="Rents">
              <NumberField label="Rent growth" value={assumptions.rent_growth ?? base.rent.rent_growth} onChange={set("rent_growth")} {...percent} />
            </Setting>
            <Setting label="Charges">
              <NumberField
                label="Charge growth"
                value={assumptions.charge_growth ?? base.buy.maintenance_charge_growth}
                onChange={set("charge_growth")}
                {...percent}
              />
            </Setting>
          </Group>

          <Group title="Your savings" note="Every option starts with the same savings and monthly budget. What an option does not spend on housing is saved.">
            <Setting label="Savings go to">
              <Segmented
                label="Savings go to"
                size="sm"
                value={strategy}
                onChange={set("surplus_strategy")}
                options={[
                  { value: "invest", label: "Investments" },
                  { value: "park", label: "Savings account" },
                ]}
              />
            </Setting>
            <Setting label="Investment return">
              <NumberField label="Investment return" value={investmentReturn} onChange={set("investment_return")} {...percent} />
            </Setting>
            <Setting label="Savings interest">
              <NumberField
                label="Savings interest"
                value={assumptions.parked_cash_return ?? base.investment.parked_cash_return}
                onChange={set("parked_cash_return")}
                {...percent}
              />
            </Setting>
            <Setting label="Selling costs" note="Agent fee when you sell">
              <NumberField
                label="Selling costs"
                value={assumptions.selling_cost_rate ?? base.buy.selling_cost_rate}
                onChange={set("selling_cost_rate")}
                suffix="%"
                scale={100}
                digits={1}
                min={0}
                max={0.2}
              />
            </Setting>
          </Group>

          {edited && (
            <button
              type="button"
              className="h-9 w-full rounded-lg border border-line text-sm font-medium hover:bg-well"
              onClick={() => onChange({ ...DEFAULT_ASSUMPTIONS, include_aso: assumptions.include_aso })}
            >
              Reset assumptions
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-well px-2 py-0.5">{children}</span>;
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-[13px] text-ink-3">{note}</p>}
      <div className="mt-3 divide-y divide-line">{children}</div>
    </section>
  );
}

function Setting({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5">
      <div>
        <p className="text-sm text-ink-2">{label}</p>
        {note && <p className="text-xs text-ink-3">{note}</p>}
      </div>
      <div className="flex min-w-40 justify-end">{children}</div>
    </div>
  );
}
