# Methodology

This page explains how the calculator compares three ways of living in a flat for a fixed number of years: renting, living in a right-of-occupancy flat (asumisoikeusasunto, ASO) and buying a flat in a housing company. It lists every formula, every data source and every simplification. The calculator gives estimates for comparison. It is not financial advice.

## The comparison in one paragraph

Each option starts with the same amount of money and spends the same amount each month. Whichever option has the highest housing cost in a month sets that month's budget. The other options save the difference, in a savings account or in index funds, as the user chooses. At the end of the horizon everything is turned into cash: the flat is sold, the right-of-occupancy fee is refunded, the savings are withdrawn and taxes are paid. The option that ends with the most money is the cheapest way to live for that horizon under the chosen assumptions.

## Notation

| Symbol | Meaning |
|---|---|
| A | Flat size in m² |
| T | Horizon in months (the user picks whole years) |
| t | Month, starting at 0 |
| y | Year of month t, y = floor(t / 12) |
| P₀ | Debt-free price per m² today |
| g_P | Annual price growth |
| R₀ | Rent per m² per month today |
| g_R | Annual rent growth |
| M₀ | Maintenance charge (hoitovastike) per m² per month today |
| C_y | Renovation charge (rahoitusvastike) per m² per month in year y, in today's euros |
| W | Repairs inside the flat per m² per year today |
| g_M | Annual growth of housing company charges |
| F | Right-of-occupancy fee per m² |
| K₀ | Right-of-occupancy monthly charge (käyttövastike) per m² today |
| g_K | Annual growth of the right-of-occupancy charge |
| g_I | Annual growth of the building cost index |
| r | Annual interest rate or expected return on savings |

All amounts are nominal euros. Growth rates are annual.

## Room groups

Finnish listings count rooms without the kitchen. A yksiö is a studio, a kaksio has one bedroom and a living room, and a kolmio or larger has two or more bedrooms. Statistics Finland publishes prices and rents for these three groups only, so the calculator offers studio, one bedroom and two or more bedrooms.

## Starting capital

The buyer pays the down payment and the transfer tax when the flat is bought:

- Debt-free price: V₀ = P₀ × A
- Down payment: D = d × V₀, where d is the down payment share
- Transfer tax: τ × V₀, where τ is the transfer tax rate on the debt-free price
- Buyer's upfront payment: U_buy = D + τ × V₀

The right-of-occupancy resident pays the fee: U_aso = F × A.

Every option starts with the same capital C₀ = max(U_buy, U_aso). Whatever an option does not pay up front goes into its savings in month 0. The renter saves the whole C₀.

## Monthly housing costs

Costs that grow do so once a year, at the start of each year:

- Rent: R₀ × (1 + g_R)^y × A
- Right of occupancy: K₀ × (1 + g_K)^y × A
- Buying: mortgage payment + housing company loan payment + (M₀ + C_y + W / 12) × (1 + g_M)^y × A − ASP interest subsidy

The monthly budget is the highest of these costs in that month. Each option saves (budget minus its own cost) at the end of the month.

### Renovation charges follow the age of the building

Housing companies charge owners for renovations such as pipes, facades and roofs. Statistics Finland publishes these capital charges per m² by construction period. A building that reaches age a in year y is charged what buildings of age a pay in the latest statistics year: a building from 1985 bought in 2026 pays the level of buildings from the early 1980s now, and the level of today's 1960s buildings twenty years later, when its pipes are due. Buildings from 2010 onwards mostly repay their construction loan through these charges, which the housing company loan share covers, so younger buildings pay the level of buildings from the 2000s. Without a construction year, the calculator uses the average of the periods before 2010.

The construction year also scales the maintenance charge: the regional charge is multiplied by the charge of the building's construction period relative to all buildings.

### Repairs inside the flat

Owners also pay for repairs inside their own flat, such as a kitchen, a bathroom or floors. The default W is the average of what owner-occupiers of flats in blocks of flats paid for contracted renovations per m² over the last five years. Renters and right-of-occupancy residents do not pay these.

### Costs left out

Costs that do not depend on the choice, such as electricity, water billed per resident and home contents insurance, are the same in all three options and are left out.

## Loans

The mortgage is the price paid for the shares minus the down payment: L = V₀ − S − D, where S is the flat's share of the housing company loan.

The monthly interest rate is the annual rate divided by 12. The interest rate follows a path: level, rising or falling by a fixed step each year (a falling path stops at a floor of 0 %). The rate for a year applies to all its months. A fixed-rate loan keeps its rate for the fixed period and then follows the path.

Two repayment types are available:

- Annuity (annuiteettilaina): the payment repays the loan in its remaining term, B × i / (1 − (1 + i)^(−n)), where B is the balance, i the monthly rate and n the months left. The payment is recalculated whenever the rate changes, so the term stays the same.
- Equal principal (tasalyhenteinen laina): the same amount of principal every month, L / (term in months), plus interest on the balance.

The housing company loan share S is repaid as an annuity over its own term at the same interest rate path.

### ASP loan

A first-time buyer who saved at least 10 % of the price in an ASP account can take an ASP loan. For the first ten loan years the state pays 70 % of the interest above 3.8 % on the ASP part of the loan. The ASP part is at most 230 000 € in Helsinki, Espoo, Vantaa, Kauniainen, Tampere, Turku and Oulu and 160 000 € elsewhere, for one person. Each month the subsidy is 0.7 × max(0, rate − 3.8 %) / 12 × balance × min(1, cap / L). The first-time buyer exemption from transfer tax ended on 1 January 2024, so a first home pays the same transfer tax as any other.

## Savings

Savings grow monthly: savings(t + 1) = savings(t) × (1 + i) + contribution(t).

- **Savings account.** Banks withhold 30 % of deposit interest when they pay it, and that tax is final. The balance therefore compounds at the rate after tax: i = (1 + r × 0.7)^(1/12) − 1. Nothing is due at the end.
- **Index funds.** The return compounds before tax: i = (1 + r)^(1/12) − 1. Tax is due on the gain when the units are sold at the end of the horizon.

## End of the horizon

**Buy.** The flat is worth V_T = V₀ × (1 + g_P)^(T / 12). Selling costs are s × V_T. The remaining mortgage and the remaining housing company loan share are repaid. Wealth is V_T − s × V_T − remaining loans + savings − tax.

**Right of occupancy.** The fee is refunded indexed with the building cost index and never below the fee paid: refund = F × A × max(1, (1 + g_I)^(T / 12)) (Act 393/2021, § 56). The law indexes the fee from the date it was first paid for the flat. Taking over an existing right costs the first fee indexed to today, so indexing from today and indexing from the first payment give the same refund. The refund follows construction costs, not flat prices. Wealth is refund + savings − tax.

**Rent.** Wealth is savings − tax.

## Taxes

- **Capital income tax.** Capital income is taxed at a flat 30 %. The 34 % rate on capital income above 30 000 € a year is left out.
- **Deposit interest.** Taxed at source every year, as above.
- **Fund units.** The taxable gain is the lower of (sale price − money put in) and (sale price × (1 − presumptive rate)). The presumptive acquisition cost is 20 % of the sale price, or 40 % after ten years.
- **Selling the flat.** The sale is tax-free when the flat was owned and lived in for at least two years. Otherwise the taxable gain is the lower of (sale price − purchase price − transfer tax − selling costs) and (sale price × (1 − presumptive rate)), with the same presumptive rates.
- **Right of occupancy.** Giving up the right is taxed like selling one's own home: the index increase is tax-free after two years.
- **Mortgage interest** is not deductible for owner-occupied homes since 2023.
- **Transfer tax** is 1.5 % of the debt-free price for contracts signed from 12 October 2023.

The rules come from the `policy_parameters` table, where each rule has a validity period, a source URL and a retrieval date. The calculator uses the rules valid on the purchase date.

## Break-even

The break-even horizon is the first whole year, up to 30, at the end of which buying leaves at least as much wealth as renting. When buying never catches up within 30 years, no break-even is reported.

## What if

The what-if table reruns the whole calculation with one assumption changed: interest rates one point higher, flat prices without growth, rents rising two points faster, charges rising two points faster, and savings earning two points less. It shows whether the best option changes.

## Where the defaults come from

| Input | Default |
|---|---|
| Price per m² | Latest published average for the postal code and room group, or the nearest larger area with published data (price sub-area, municipality, region, country) |
| Rent per m² | Latest free-market rent for new agreements in the rent sub-area, or the municipality, region or country |
| Price growth | Compound annual growth of the price index over the last 10 years for the nearest area with an index |
| Rent growth | Growth of market rents in the rent area over the last 10 years. The alternative is a common lease clause: inflation over the last 10 years (consumer price index), at least 2 % a year |
| Maintenance charge and its growth | Housing company finances for Greater Helsinki or the rest of Finland, latest year and 10-year growth, scaled by construction period |
| Renovation charges | Housing company capital charges by construction period, following the building's age |
| Repairs inside the flat | Owner-occupiers' contracted renovations per m², average of the last five years |
| Interest rate | Latest average rate on new variable-rate housing loans in Finland (ECB statistics), held level |
| Savings account rate | Latest average rate on new household deposits with a maturity of up to one year in Finland (ECB statistics) |
| Right-of-occupancy fee and charge | Sampled right-of-occupancy buildings: each building's charge divided by the market rent per m² where it stands, and its fee divided by the market price per m² there. The medians of these ratios, from buildings of a similar age when there are enough, are applied to the rent and price of the chosen area |
| Right-of-occupancy charge growth | Average yearly change of right-of-occupancy charges in the whole country, 2019 to 2025, from the market reviews of Varke |
| Building cost index growth | Growth of the building cost index over the last 10 years |
| Selling costs, investment return, loan term, down payment | Assumptions in the `assumptions` table, all editable |

## Simplifications

- The owner lives in the flat for the whole horizon, so the two-year rule for tax-free sale depends only on the horizon.
- Capital income is taxed at 30 % throughout.
- Losses on fund units are not offset against other income.
- The loan cap check compares the mortgage with the debt-free price.
- Rents, charges and fees are averages. A specific flat can differ, which is why every number can be replaced with the figure of a real listing.

## Data sources

- Statistics Finland: prices of dwellings in housing companies, rents of dwellings, finances of housing companies, renovation building, consumer price index, building cost index, Paavo postal code areas and the classification service. Licence CC BY 4.0. Source: Statistics Finland.
- European Central Bank: MFI interest rate statistics for Finland, housing loans and household deposits. Source: ECB statistics.
- Finnish Tax Administration (vero.fi): transfer tax, capital income tax, taxation of home sales, fund units and right-of-occupancy transfers.
- Ministry of Finance (vm.fi): tax at source on deposit interest.
- State Treasury (Valtiokonttori): the ASP scheme.
- Varke (Housing Finance and Development Centre of Finland): market reviews of right-of-occupancy dwellings, 2019 to 2025.
- Finlex: Act on right-of-occupancy dwellings 393/2021.
- Financial Supervisory Authority (FIN-FSA): maximum loan-to-collateral ratio.
- Asuntosäätiö: public listings of right-of-occupancy buildings, used as a sample for fees and charges.
