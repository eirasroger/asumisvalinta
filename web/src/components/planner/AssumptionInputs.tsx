"use client";

import { useState } from "react";
import { InfoLabel, NumberField, Segmented, Sheet, Switch } from "@/components/ui";
import { useI18n } from "@/i18n/I18nProvider";
import type { PlannerStart } from "@/lib/api";
import { formatEuro, formatPercent } from "@/lib/format";
import { type Assumptions, DEFAULT_ASSUMPTIONS, fixedRate, fixedYears } from "@/lib/planner";

interface Props {
  start: PlannerStart;
  assumptions: Assumptions;
  onChange: (assumptions: Assumptions) => void;
  price: number;
}

export function AssumptionInputs({ start, assumptions, onChange, price }: Props) {
  const { t } = useI18n();
  const a = t.assumptions;
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
        <span className="text-[15px] font-semibold">{a.title}</span>
        <span className="ml-auto flex flex-wrap justify-end gap-1.5 text-[13px] text-ink-2">
          <Chip>
            {strategy === "invest"
              ? a.chipFunds(formatPercent(investmentReturn))
              : strategy === "park"
                ? a.chipSavings(formatPercent(savingsRate, 2))
                : a.chipNotInvested}
          </Chip>
          <Chip>{a.chipLoan(formatPercent(startRate, 2))}</Chip>
          <Chip>{a.chipDown(formatPercent(downPayment, 0))}</Chip>
        </span>
        <svg className="shrink-0 text-ink-3" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m4.5 3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <Sheet open={open} onOpenChange={setOpen} title={a.title}>
        <div className="space-y-8">
          <Group title={a.surplus}>
            <div className="grid gap-2">
              <Choice
                selected={strategy === "park"}
                onSelect={() => set("surplus_strategy")("park")}
                title={a.savings}
                detail={a.savingsDetail(taxRate)}
              >
                <NumberField label={a.savingsRate} className="w-28" value={savingsRate} onChange={set("parked_cash_return")} {...percent} digits={2} />
              </Choice>
              <Choice
                selected={strategy === "invest"}
                onSelect={() => set("surplus_strategy")("invest")}
                title={a.funds}
                detail={a.fundsDetail(taxRate)}
              >
                <NumberField label={a.fundsReturn} className="w-28" value={investmentReturn} onChange={set("investment_return")} {...percent} />
              </Choice>
              <Choice
                selected={strategy === "keep"}
                onSelect={() => set("surplus_strategy")("keep")}
                title={a.keep}
                detail={a.keepDetail}
              >
                <span />
              </Choice>
            </div>
          </Group>

          <Group title={a.mortgage}>
            <Setting label={a.downPayment} about={a.downPaymentAbout(formatEuro(price * downPayment))}>
              <NumberField label={a.downPayment} value={downPayment} onChange={set("down_payment_share")} suffix="%" scale={100} digits={1} min={0} max={1} />
            </Setting>
            <Setting label={a.interestRate} about={sources.mortgage_rate}>
              <NumberField label={a.interestRate} value={startRate} onChange={set("start_rate")} suffix="%" scale={100} digits={2} min={-0.05} max={0.3} />
            </Setting>
            <Setting label={a.rateType} about={a.rateTypeAbout}>
              <Segmented
                label={a.rateType}
                size="sm"
                value={rateType}
                onChange={set("rate_type")}
                options={[
                  { value: "variable", label: a.variable },
                  { value: "fixed", label: a.fixed },
                ]}
              />
            </Setting>
            {rateType === "fixed" && (
              <>
                <Setting label={a.fixedRate} about={a.fixedRateAbout}>
                  <NumberField
                    label={a.fixedRate}
                    value={fixedRate(assumptions, mortgage.fixed_rate, startRate)}
                    onChange={set("fixed_rate")}
                    suffix="%"
                    scale={100}
                    digits={2}
                    min={-0.05}
                    max={0.3}
                  />
                </Setting>
                <Setting label={a.fixedFor} about={a.fixedForAbout}>
                  <NumberField
                    label={a.fixedFor}
                    value={fixedYears(assumptions, mortgage)}
                    onChange={(value) => set("fixed_years")(Math.round(value))}
                    suffix={a.yearsSuffix}
                    min={1}
                    max={40}
                  />
                </Setting>
              </>
            )}
            <Setting label={a.outlook} about={a.outlookAbout}>
              <Segmented
                label={a.outlook}
                size="sm"
                value={rateKind}
                onChange={set("rate_kind")}
                options={[
                  { value: "flat", label: a.level },
                  { value: "rising", label: a.rising },
                  { value: "falling", label: a.falling },
                ]}
              />
            </Setting>
            {rateKind !== "flat" && (
              <Setting label={a.changePerYear} about={a.changePerYearAbout}>
                <NumberField
                  label={a.changePerYear}
                  value={assumptions.change_per_year ?? (mortgage.rate_path.change_per_year || 0.0025)}
                  onChange={set("change_per_year")}
                  suffix={a.pointsSuffix}
                  scale={100}
                  digits={2}
                  min={0}
                  max={0.05}
                />
              </Setting>
            )}
            <Setting label={a.term} about={a.termAbout}>
              <NumberField
                label={a.term}
                value={assumptions.term_years ?? mortgage.term_years}
                onChange={(value) => set("term_years")(Math.round(value))}
                suffix={a.yearsSuffix}
                min={1}
                max={40}
              />
            </Setting>
            <Setting label={a.repayment} about={a.repaymentAbout}>
              <Segmented
                label={a.repayment}
                size="sm"
                value={assumptions.repayment ?? mortgage.repayment}
                onChange={set("repayment")}
                options={[
                  { value: "annuity", label: a.annuity },
                  { value: "equal_principal", label: a.equalPrincipal },
                ]}
              />
            </Setting>
          </Group>

          <Group title={a.firstHome}>
            <Setting
              label={a.asp}
              about={a.aspAbout(
                formatPercent(policy.asp_min_savings_share, 0),
                formatPercent(policy.asp_interest_subsidy_share, 0),
                formatPercent(policy.asp_interest_subsidy_threshold_rate, 1),
                policy.asp_interest_subsidy_max_years,
                formatEuro(policy.asp_loan_max),
              )}
            >
              <Switch label={a.asp} checked={assumptions.asp_loan ?? false} onChange={set("asp_loan")} />
            </Setting>
          </Group>

          <Group title={a.growth}>
            <Setting label={a.prices} about={`${sources.price_growth}.`}>
              <NumberField label={a.priceGrowth} value={assumptions.price_growth ?? base.buy.price_growth} onChange={set("price_growth")} {...percent} />
            </Setting>
            <div className="py-2.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <InfoLabel label={a.rents}>
                  <p className="leading-relaxed">
                    {a.rentsAbout(sources.rent_growth, sources.rent_growth_market.toLowerCase())}
                  </p>
                </InfoLabel>
                <div className="flex justify-end [&>div:has(input)]:w-36 sm:[&>div:has(input)]:w-40">
                  <NumberField label={a.rentGrowth} value={rentGrowth} onChange={set("rent_growth")} {...percent} />
                </div>
              </div>
              <Segmented
                label={a.rentRule}
                size="sm"
                className="mt-2 w-full"
                value={rentRule}
                onChange={(rule) =>
                  set("rent_growth")(rule === "lease" ? start.rent_growth.lease_clause : start.rent_growth.market)
                }
                options={[
                  { value: "lease", label: a.leaseClause(formatPercent(start.rent_growth.lease_clause)) },
                  { value: "market", label: a.marketTrend(formatPercent(start.rent_growth.market)) },
                ]}
              />
            </div>
            <Setting label={a.companyCharges} about={`${sources.maintenance_charge_growth}.`}>
              <NumberField
                label={a.companyChargeGrowth}
                value={assumptions.charge_growth ?? base.buy.maintenance_charge_growth}
                onChange={set("charge_growth")}
                {...percent}
              />
            </Setting>
            <Setting label={a.asoCharges} about={`${sources.aso_charge_growth}.`}>
              <NumberField
                label={a.asoChargeGrowth}
                value={assumptions.aso_charge_growth ?? base.aso?.charge_growth ?? 0}
                onChange={set("aso_charge_growth")}
                {...percent}
              />
            </Setting>
            <Setting label={a.feeRefund} about={`${sources.building_cost_index_growth}.`}>
              <NumberField
                label={a.feeRefundGrowth}
                value={assumptions.fee_growth ?? base.aso?.building_cost_index_growth ?? 0}
                onChange={set("fee_growth")}
                {...percent}
              />
            </Setting>
          </Group>

          <Group title={a.selling}>
            <Setting label={a.sellingCosts} about={a.sellingCostsAbout}>
              <NumberField
                label={a.sellingCosts}
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
              {a.resetAll}
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
