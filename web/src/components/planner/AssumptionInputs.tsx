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
  const rentGrowth = assumptions.rent_growth ?? base.rent.rent_growth;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.00005;
  const rentRule = near(rentGrowth, start.rent_growth.market)
    ? "market"
    : near(rentGrowth, start.rent_growth.lease_clause)
      ? "lease"
      : "custom";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-paper px-5 py-3.5 text-left transition-colors hover:border-line-strong"
      >
        <span className="text-[15px] font-semibold">Assumptions</span>
        <span className="ml-auto flex flex-wrap justify-end gap-1.5 text-[13px] text-ink-2">
          <Chip>
            {strategy === "invest"
              ? `Funds ${formatPercent(investmentReturn)}`
              : strategy === "park"
                ? `Savings ${formatPercent(savingsRate, 2)}`
                : "Not invested"}
          </Chip>
          <Chip>Loan {formatPercent(startRate, 2)}</Chip>
          <Chip>{formatPercent(downPayment, 0)} down</Chip>
        </span>
        <svg className="shrink-0 text-ink-3" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m4.5 3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <Sheet open={open} onOpenChange={setOpen} title="Assumptions">
        <div className="space-y-8">
          <Group title="Money not spent on housing">
            <div className="grid gap-2">
              <Choice
                selected={strategy === "park"}
                onSelect={() => set("surplus_strategy")("park")}
                title="Savings account"
                detail={`Interest before tax; ${taxRate} tax on interest each year`}
              >
                <NumberField label="Savings interest" className="w-28" value={savingsRate} onChange={set("parked_cash_return")} {...percent} digits={2} />
              </Choice>
              <Choice
                selected={strategy === "invest"}
                onSelect={() => set("surplus_strategy")("invest")}
                title="Index funds"
                detail={`Return before tax; ${taxRate} tax on gains when sold`}
              >
                <NumberField label="Expected return" className="w-28" value={investmentReturn} onChange={set("investment_return")} {...percent} />
              </Choice>
              <Choice
                selected={strategy === "keep"}
                onSelect={() => set("surplus_strategy")("keep")}
                title="Not invested"
                detail="Kept as cash, without interest"
              >
                <span />
              </Choice>
            </div>
          </Group>

          <Group title="Mortgage">
            <Setting label="Down payment" about={`${formatEuro(price * downPayment)} of your own money.`}>
              <NumberField label="Down payment" value={downPayment} onChange={set("down_payment_share")} suffix="%" scale={100} digits={1} min={0} max={1} />
            </Setting>
            <Setting label="Interest rate" about={sources.mortgage_rate}>
              <NumberField label="Interest rate" value={startRate} onChange={set("start_rate")} suffix="%" scale={100} digits={2} min={-0.05} max={0.3} />
            </Setting>
            <Setting label="Rate type" about="A fixed rate turns variable after the fixed period.">
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
                <Setting label="Fixed rate" about="Rate during the fixed period.">
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
                <Setting label="Fixed for" about="Length of the fixed period.">
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
            <Setting label="Rate outlook" about="How the variable rate moves each year.">
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
              <Setting label="Change per year" about="Percentage points a year.">
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
            <Setting label="Loan term" about="Years to repay.">
              <NumberField
                label="Loan term"
                value={assumptions.term_years ?? mortgage.term_years}
                onChange={(value) => set("term_years")(Math.round(value))}
                suffix="years"
                min={1}
                max={40}
              />
            </Setting>
            <Setting label="Repayment" about="Annuity keeps the payment level. Equal principal starts higher and falls.">
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
              about={`First home with ${formatPercent(policy.asp_min_savings_share, 0)} saved in an ASP account: the state pays ${formatPercent(policy.asp_interest_subsidy_share, 0)} of interest above ${formatPercent(policy.asp_interest_subsidy_threshold_rate, 1)} for ${policy.asp_interest_subsidy_max_years} years, on up to ${formatEuro(policy.asp_loan_max)}.`}
            >
              <Switch label="ASP loan" checked={assumptions.asp_loan ?? false} onChange={set("asp_loan")} />
            </Setting>
          </Group>

          <Group title="Growth per year">
            <Setting label="Flat prices" about={`${sources.price_growth} in this area.`}>
              <NumberField label="Flat price growth" value={assumptions.price_growth ?? base.buy.price_growth} onChange={set("price_growth")} {...percent} />
            </Setting>
            <div className="py-2.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <InfoLabel label="Rents">
                  <p className="leading-relaxed">
                    {sources.rent_growth}. Market trend: {sources.rent_growth_market.toLowerCase()}.
                  </p>
                </InfoLabel>
                <div className="flex justify-end [&>div:has(input)]:w-36 sm:[&>div:has(input)]:w-40">
                  <NumberField label="Rent growth" value={rentGrowth} onChange={set("rent_growth")} {...percent} />
                </div>
              </div>
              <Segmented
                label="Rent growth rule"
                size="sm"
                className="mt-2 w-full"
                value={rentRule}
                onChange={(rule) =>
                  set("rent_growth")(rule === "lease" ? start.rent_growth.lease_clause : start.rent_growth.market)
                }
                options={[
                  { value: "lease", label: `Lease clause ${formatPercent(start.rent_growth.lease_clause)}` },
                  { value: "market", label: `Market trend ${formatPercent(start.rent_growth.market)}` },
                ]}
              />
            </div>
            <Setting label="Housing company charges" about={`${sources.maintenance_charge_growth}.`}>
              <NumberField
                label="Housing company charge growth"
                value={assumptions.charge_growth ?? base.buy.maintenance_charge_growth}
                onChange={set("charge_growth")}
                {...percent}
              />
            </Setting>
            <Setting label="Right-of-occupancy charges" about={`${sources.aso_charge_growth}.`}>
              <NumberField
                label="Right-of-occupancy charge growth"
                value={assumptions.aso_charge_growth ?? base.aso?.charge_growth ?? 0}
                onChange={set("aso_charge_growth")}
                {...percent}
              />
            </Setting>
            <Setting label="Right-of-occupancy fee refund" about={`${sources.building_cost_index_growth}.`}>
              <NumberField
                label="Fee refund growth"
                value={assumptions.fee_growth ?? base.aso?.building_cost_index_growth ?? 0}
                onChange={set("fee_growth")}
                {...percent}
              />
            </Setting>
          </Group>

          <Group title="Selling">
            <Setting label="Selling costs" about="Agent fee when you sell.">
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
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
      <InfoLabel label={label}>
        <p className="leading-relaxed">{about}</p>
      </InfoLabel>
      <div className="flex justify-end [&>div:has(input)]:w-36 sm:[&>div:has(input)]:w-40">{children}</div>
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
