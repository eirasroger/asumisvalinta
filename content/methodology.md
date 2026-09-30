# Methodology

This page explains how the calculator compares three ways of living in a flat for a fixed number of years: renting, living in a right-of-occupancy flat (asumisoikeusasunto, ASO) and buying a flat in a housing company. It lists every formula, every data source and every simplification. The calculator gives estimates for comparison. It is not financial advice.

## The comparison in one paragraph

Each option starts with the same amount of money and spends the same amount each month. Whichever option has the highest housing cost in a month sets that month's budget. The other options put the difference aside, either in an investment portfolio or in a bank account, as the user chooses. At the end of the horizon everything is turned into cash: the flat is sold, the right-of-occupancy fee is refunded and the portfolio is sold, and taxes are paid. The option that ends with the most money is the cheapest way to live for that horizon under the chosen assumptions.

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
| g_M | Annual growth of the maintenance charge |
| F | Right-of-occupancy fee per m² |
| K₀ | Right-of-occupancy monthly charge (käyttövastike) per m² today |
| g_K | Annual growth of the right-of-occupancy charge |
| g_I | Annual growth of the building cost index |
| r | Annual return on money put aside |

All amounts are nominal euros. Growth rates are annual.

## Starting capital

The buyer pays the down payment and the transfer tax when the flat is bought:

- Debt-free price: V₀ = P₀ × A
- Down payment: D = d × V₀, where d is the down payment share
- Transfer tax: τ × V₀, where τ is the transfer tax rate on the debt-free price
- Buyer's upfront payment: U_buy = D + τ × V₀

The right-of-occupancy resident pays the fee: U_aso = F × A.

Every option starts with the same capital C₀ = max(U_buy, U_aso). Whatever an option does not pay up front goes into its portfolio in month 0. The renter's portfolio starts with the whole C₀.

## Monthly housing costs

Costs that grow do so once a year, at the start of each year:

- Rent: R₀ × (1 + g_R)^y × A
- Right of occupancy: K₀ × (1 + g_K)^y × A
- Buying: mortgage payment + housing company loan payment + M₀ × (1 + g_M)^y × A + renovation reserve / 12 × (1 + g_M)^y × A

The monthly budget is the highest of these costs in that month. Each option adds (budget minus its own cost) to its portfolio at the end of the month.

## Loans

The mortgage is the price paid for the shares minus the down payment: L = V₀ − S − D, where S is the flat's share of the housing company loan.

The monthly interest rate is the annual rate divided by 12. The interest rate follows a path: flat, rising or falling by a fixed step each year (a falling path stops at a floor of 0 %), or a custom rate for each year. The rate for a year applies to all its months. A fixed-rate loan keeps its rate for the fixed period and then follows the path.

Two repayment types are available:

- Annuity (annuiteettilaina): the payment repays the loan in its remaining term, B × i / (1 − (1 + i)^(−n)), where B is the balance, i the monthly rate and n the months left. The payment is recalculated whenever the rate changes, so the term stays the same.
- Equal principal (tasalyhenteinen laina): the same amount of principal every month, L / (term in months), plus interest on the balance.

The housing company loan share S is repaid as an annuity over its own term at the same interest rate path. Its payment is the financing charge (rahoitusvastike).

## Money put aside

The portfolio grows monthly at i_r = (1 + r)^(1/12) − 1:

portfolio(t + 1) = portfolio(t) × (1 + i_r) + contribution(t)

The user chooses r: the expected investment return when investing, or the bank account rate when parking the money.

## End of the horizon

**Buy.** The flat is worth V_T = V₀ × (1 + g_P)^(T / 12). Selling costs are s × V_T. The remaining mortgage and the remaining housing company loan share are repaid. Wealth is V_T − s × V_T − remaining loans + portfolio − tax.

**Right of occupancy.** The fee is refunded indexed with the building cost index and never below the fee paid: refund = F × A × max(1, (1 + g_I)^(T / 12)) (Act 393/2021, § 56). Wealth is refund + portfolio − tax.

**Rent.** Wealth is portfolio − tax.

## Taxes

- **Capital income tax.** Gains realised at the end of the horizon are taxed together as capital income of one year: 30 % up to 30 000 € and 34 % above.
- **Portfolio.** The taxable gain is the portfolio value minus the money put in. Taxing the portfolio can be switched off, for example for a tax-deferred account.
- **Selling the flat.** The sale is tax-free when the flat was owned and lived in for at least two years. Otherwise the taxable gain is the lower of (sale price − purchase price − transfer tax − selling costs) and (sale price × (1 − presumptive rate)), where the presumptive acquisition cost is 20 % of the sale price, or 40 % after ten years of ownership.
- **Right of occupancy.** Giving up the right is taxed like selling one's own home: the index increase is tax-free after two years under the agreement.
- **Mortgage interest** is not deductible for owner-occupied homes since 2023.
- **Transfer tax** is 1.5 % of the debt-free price for contracts signed from 12 October 2023. The first-time buyer exemption applies only to contracts signed before 1 January 2024.

The rules come from the `policy_parameters` table, where each rule has a validity period, a source URL and a retrieval date. The calculator uses the rules valid on the purchase date.

## Break-even

The break-even horizon is the first whole year, up to 30, at the end of which buying leaves at least as much wealth as renting. The calculator also reports the break-even year between buying and right of occupancy. When buying never catches up within 30 years, no break-even is reported.

## Where the defaults come from

| Input | Default |
|---|---|
| Price per m² | Latest published average for the postal code and room type, or the nearest larger area with published data (price sub-area, municipality, region, country) |
| Rent per m² | Latest free-market rent for new agreements in the rent sub-area, or the municipality, region or country |
| Price growth | Compound annual growth of the price index over the last 10 years for the nearest area with an index |
| Rent growth | Compound annual growth of free-market rents over the last 10 years, chained across the 2015-base and 2025-base rent series |
| Maintenance charge and its growth | Housing company finances for Greater Helsinki or the rest of Finland, latest year and 10-year growth |
| Interest rate | Latest average rate on new variable-rate housing loans in Finland (ECB statistics), held flat |
| Right-of-occupancy fee and charge | Median of the sampled right-of-occupancy buildings in the municipality, or in all sampled cities |
| Building cost index growth | Growth of the building cost index over the last 10 years |
| Selling costs, investment return, bank account return, loan term, down payment, renovation reserve | Assumptions in the `assumptions` table, all editable |

## Simplifications

- The owner lives in the flat for the whole horizon, so the two-year rule for tax-free sale depends only on the horizon.
- Taxes on bank interest and on investment income are paid once at the end, while in reality interest is taxed every year.
- Portfolio losses are not offset against other income.
- The right-of-occupancy fee is indexed from the move-in date. The law indexes from the date the first fee for the flat was paid, so the refund on an existing right can differ.
- The fee refund, the sale proceeds and the portfolio are all available at the end of the horizon. In reality the refund can take up to three months.
- The loan cap check compares the mortgage with the debt-free price.
- Rents, charges and fees are averages. A specific flat can differ.
- Major renovations such as pipe renovations are excluded unless the user enters a renovation reserve.

## Data sources

- Statistics Finland: prices of dwellings in housing companies, rents of dwellings, building cost index, finances of housing companies, Paavo postal code areas and the classification service. Licence CC BY 4.0. Source: Statistics Finland.
- European Central Bank: MFI interest rate statistics for Finland. Source: ECB statistics.
- Finnish Tax Administration (vero.fi): transfer tax, capital income tax, taxation of home sales and of right-of-occupancy transfers.
- Finlex: Act on right-of-occupancy dwellings 393/2021.
- Financial Supervisory Authority (FIN-FSA): maximum loan-to-collateral ratio.
- Asuntosäätiö: public listings of right-of-occupancy buildings, used as a sample for fees and charges.
