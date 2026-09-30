"use client";

import { useState } from "react";
import { InfoLabel, NumberField, Segmented, Sheet, Switch } from "@/components/ui";
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
  const policy = base.policy;
  const sources = start.sources;
  const set = <K extends keyof Assumptions>(key: K) => (value: Assumptions[K]) => onChange({ ...assumptions, [key]: value });
  const edited = Object.keys(assumptions).some((key) => key !== "include_aso");

  const downPayment = assumptions.down_payment_share ?? mortgage.down_payment_share;
  const rateType = assumptions.rate_type ?? mortgage.rate_type;
  const rateKind = assumptions.rate_kind ?? (mortgage.rate_path.kind === "custom" ? "flat" : mortgage.rate_path.kind);
  const startRate = assumptions.start_rate ?? mortgage.rate_path.start_rate;
  const strategy = assumptions.surplus_strategy ?? base.investment.surplus_strategy;
  const investmentReturn = assumptions.investment_return ?? base.investment.investment_return;
  const savingsRate = assumptions.parked_cash_return ?? base.investment.parked_cash_return;
  const taxRate = formatPercent(policy.capital_income_tax_rate, 0);
  const percent = { suffix: "%", scale: 100, digits: 1, min: -0.5, max: 0.5 };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper px-5 py-3.5 text-left transition-colors hover:border-line-strong"
      >
        <span className="text-[15px] font-semibold">Assumptions</span>
        <span className="ml-auto flex flex-wrap justify-end gap-1.5 text-[13px] text-ink-2">
          <Chip>{strategy === "invest" ? `Funds ${formatPercent(investmentReturn)}` : `Savings ${formatPercent(savingsRate, 2)}`}</Chip>
          <Chip>Loan {formatPercent(startRate, 2)}</Chip>
          <Chip>{formatPercent(downPayment, 0)} down</Chip>
        </span>
        <svg className="shrink-0 text-ink-3" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m4.5 3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <Sheet open={open} onOpenChange={setOpen} title="Assumptions">
        <div className="space-y-8">
          <Group title="Money you do not spend on housing">
            <p className="text-[13px] leading-relaxed text-ink-3">
              Each option starts with the same savings and the same monthly budget. Whatever an option does not spend
              on housing goes here.
            </p>
            <div className="mt-3 grid gap-2">
              <Choice
                selected={strategy === "park"}
                onSelect={() => set("surplus_strategy")("park")}
                title="Savings account"
                detail={`${taxRate} of the interest is withheld every year.`}
              >
                <NumberField label="Savings interest" className="w-28" value={savingsRate} onChange={set("parked_cash_return")} {...percent} digits={2} />
              </Choice>
              <Choice
                selected={strategy === "invest"}
                onSelect={() => set("surplus_strategy")("invest")}
                title="Index funds"
                detail={`${taxRate} tax on the gain when you sell at the end.`}
              >
                <NumberField label="Expected return" className="w-28" value={investmentReturn} onChange={set("investment_return")} {...percent} />
              </Choice>
            </div>
            <p className="mt-2 text-xs text-ink-3">Savings interest: {sources.savings_rate}.</p>
          </Group>

          <Group title="Mortgage">
            <Setting label="Down payment" about={`Your own money towards the price: ${formatEuro(price * downPayment)}. The rest is borrowed.`}>
              <NumberField label="Down payment" value={downPayment} onChange={set("down_payment_share")} suffix="%" scale={100} digits={1} min={0} max={1} />
            </Setting>
            <Setting label="Interest rate" about={`The rate today. Default: ${sources.mortgage_rate}.`}>
              <NumberField label="Interest rate" value={startRate} onChange={set("start_rate")} suffix="%" scale={100} digits={2} min={-0.05} max={0.3} />
            </Setting>
            <Setting label="Rate type" about="A variable rate changes with market rates. A fixed rate stays the same for the years you choose, then turns variable.">
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
                <Setting label="Fixed rate" about="The rate during the fixed period.">
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
                <Setting label="Fixed for" about="How long the fixed rate lasts.">
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
            <Setting label="Rate outlook" about="Whether the variable rate stays where it is, rises or falls each year.">
              <Segmented
                label="Rate outlook"
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
              <Setting label="Change per year" about="Percentage points added or taken off the rate each year.">
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
            <Setting label="Loan term" about="Years to repay the mortgage.">
              <NumberField
                label="Loan term"
                value={assumptions.term_years ?? mortgage.term_years}
                onChange={(value) => set("term_years")(Math.round(value))}
                suffix="years"
                min={1}
                max={40}
              />
            </Setting>
            <Setting label="Repayment" about="Annuity: the same payment every month. Equal principal: higher payments first, falling over time.">
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

          <Group title="First home">
            <Setting
              label="ASP loan"
              about={`For first-time buyers who saved ${formatPercent(policy.asp_min_savings_share, 0)} of the price in an ASP account. For ${policy.asp_interest_subsidy_max_years} years the state pays ${formatPercent(policy.asp_interest_subsidy_share, 0)} of the interest above ${formatPercent(policy.asp_interest_subsidy_threshold_rate, 1)} on up to ${formatEuro(policy.asp_loan_max)} of the loan. The first-home transfer tax exemption ended on 1 January 2024.`}
            >
              <Switch label="ASP loan" checked={assumptions.asp_loan ?? false} onChange={set("asp_loan")} />
            </Setting>
          </Group>

          <Group title="Growth per year">
            <Setting label="Flat prices" about={`Default: ${sources.price_growth.toLowerCase()} in this area.`}>
              <NumberField label="Flat price growth" value={assumptions.price_growth ?? base.buy.price_growth} onChange={set("price_growth")} {...percent} />
            </Setting>
            <Setting label="Rents" about={`Default: ${sources.rent_growth}.`}>
              <NumberField label="Rent growth" value={assumptions.rent_growth ?? base.rent.rent_growth} onChange={set("rent_growth")} {...percent} />
            </Setting>
            <Setting label="Charges" about="Maintenance, renovation and right-of-occupancy charges. Default: housing company charges over the last 10 years.">
              <NumberField
                label="Charge growth"
                value={assumptions.charge_growth ?? base.buy.maintenance_charge_growth}
                onChange={set("charge_growth")}
                {...percent}
              />
            </Setting>
          </Group>

          <Group title="Selling">
            <Setting label="Selling costs" about="Estate agent fee and other costs when you sell the flat at the end, as a share of the price.">
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[15px] font-semibold">{title}</h3>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Setting({ label, about, children }: { label: string; about: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5">
      <InfoLabel label={label}>
        <p className="leading-relaxed">{about}</p>
      </InfoLabel>
      <div className="flex min-w-40 justify-end">{children}</div>
    </div>
  );
}

function Choice({
  selected,
  onSelect,
  title,
  detail,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        selected ? "border-ink bg-paper" : "border-line bg-well/50"
      }`}
    >
      <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="flex flex-1 items-start gap-3 text-left">
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            selected ? "border-ink" : "border-line-strong"
          }`}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-ink" />}
        </span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-ink-3">{detail}</span>
        </span>
      </button>
      {children}
    </div>
  );
}
