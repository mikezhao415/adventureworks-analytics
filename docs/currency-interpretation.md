# Native USD presentation: reviewed AdventureWorks2022 interpretation

The project treats native AdventureWorks sales amounts as USD for dashboard
presentation. This interpretation was reviewed and approved on October 19, 2026,
after read-only SQL investigation of the existing AdventureWorks2022 source.
**No FX conversion is applied.** Existing financial calculations, precision,
source-to-mart reconciliation and exact decimal JSON values remain unchanged.

Dashboard wording:

> USD — native AdventureWorks sample amounts; no currency conversion applied.

## Basis and limits

Microsoft's [official OLTP schema](https://github.com/microsoft/sql-server-samples/blob/master/samples/databases/adventure-works/oltp-install-script/instawdb.sql)
links `SalesOrderHeader.CurrencyRateID` to `Sales.CurrencyRate.CurrencyRateID`.
Rate rows identify `FromCurrencyCode`, `ToCurrencyCode`, daily `AverageRate` and
`EndOfDayRate`. The observed referenced rates all originate in USD. Native prices
match across groups with different destination-rate metadata, including orders
with no associated rate. Together these support a common USD base, rather than
stored amounts already converted to the destination currencies.

**Microsoft's OLTP schema does not explicitly label every monetary column as USD
or define NULL CurrencyRateID as USD.** NULL literally means no associated rate
row. Treating NULL-rate orders as the same unconverted base amounts is a reviewed,
sample-specific interpretation supported by observed pricing, not an ISO currency
value stored in that NULL. Territory country is not a currency substitute.

The [DAX sample's USD statement](https://learn.microsoft.com/en-us/dax/dax-sample-model)
describes a modified DW-based Power BI sample and was not used as proof for this
OLTP database. SQL Server's [money type](https://learn.microsoft.com/en-us/sql/t-sql/data-types/money-and-smallmoney-transact-sql)
stores precision, not currency identity. This is a fictional historical sample,
not evidence of real-world FX accuracy or customer settlement currency.

## Observed SQL controls

The investigated source contained 31,465 orders, dated May 31, 2011–June 30, 2014;
all observed orders had shipped status 5. The rate FK was enabled/trusted.

| Referenced rate direction | Orders |
| --- | ---: |
| No associated rate (NULL) | 17,489 |
| USD → AUD | 6,675 |
| USD → CAD | 3,839 |
| USD → DEM | 76 |
| USD → EUR | 172 |
| USD → FRF | 59 |
| USD → GBP | 3,155 |
| **Total** | **31,465** |

All 13,976 non-NULL references resolved, using 2,514 distinct rate rows. Every
referenced rate date matched the order's calendar date. DEM/FRF are observed
sample metadata, not an assertion of realistic historical exchange rates.
NULL-rate orders occurred in all six territory countries, including non-US ones.

A controlled comparison grouped lines by product, order calendar day, online/
reseller channel and special offer. All **12,567 groups spanning multiple rate
labels, covering 99,641 lines, had exactly one native UnitPrice per group**.
Furthermore, 36,505 rated lines had an identical-price NULL-rate peer under those
same controls, despite non-unit FX rates. This supports unchanged native prices
across rate metadata. Lines without peers were not assumed to be mismatches.

The source arithmetic also matched the official schema:

- All 121,317 lines matched `UnitPrice * (1.0 - UnitPriceDiscount) * OrderQty`.
- Every order's header subtotal matched its summed lines rounded to four decimals.
- Every order's total due matched subtotal plus tax plus freight.

Preserve the decimal `1.0` in diagnostic SQL: integer `1` can invoke different
SQL Server money intermediate rounding. Header and line totals retain distinct
source scales and can differ globally because of per-order rounding.

## Reproduce the decisive checks

Use a read-only connection with SELECT on the existing header, detail and currency
rate tables. No administrator access, grants or source changes are part of these
queries. Credential setup remains local; do not print or commit credentials.

```sql
-- Distinguish rate metadata from the denomination of stored monetary columns.
SELECT r.FromCurrencyCode, r.ToCurrencyCode, COUNT_BIG(*) AS orders,
       SUM(CASE WHEN h.CurrencyRateID IS NOT NULL
                     AND r.CurrencyRateID IS NULL THEN 1 ELSE 0 END) AS missing_rates
FROM Sales.SalesOrderHeader h
LEFT JOIN Sales.CurrencyRate r ON r.CurrencyRateID = h.CurrencyRateID
GROUP BY r.FromCurrencyCode, r.ToCurrencyCode;

-- Comparable native prices, without converting or changing any values.
WITH comparisons AS (
    SELECT d.ProductID, CONVERT(date, h.OrderDate) AS order_day,
           h.OnlineOrderFlag, d.SpecialOfferID,
           COUNT(DISTINCT COALESCE(r.ToCurrencyCode, 'NO_RATE')) AS rate_groups,
           COUNT(DISTINCT d.UnitPrice) AS native_prices,
           COUNT_BIG(*) AS lines
    FROM Sales.SalesOrderDetail d
    JOIN Sales.SalesOrderHeader h ON h.SalesOrderID = d.SalesOrderID
    LEFT JOIN Sales.CurrencyRate r ON r.CurrencyRateID = h.CurrencyRateID
    GROUP BY d.ProductID, CONVERT(date, h.OrderDate),
             h.OnlineOrderFlag, d.SpecialOfferID
)
SELECT rate_groups, native_prices, COUNT_BIG(*) AS comparison_groups,
       SUM(lines) AS lines
FROM comparisons
WHERE rate_groups > 1
GROUP BY rate_groups, native_prices;
```

These are investigation findings and reproducible queries, not a newly implemented
CI currency gate. Raw query outputs, private local exports and credential files
are excluded from the repository. The detailed local investigation remains under
ignored `output/currency-investigation/`.

## Analytical and display consequences

Native cross-order sums and header AOV are retained under the reviewed common-USD
interpretation. AOV remains selected header subtotal divided by shipped orders,
rounded to four decimals; it is never an average of AOVs. Product/category header
allocation remains unsupported. Rate multiplication/division would change the
native price basis and is not authorized by this display decision.

Headline/ranking sales and AOV use `Intl.NumberFormat("en-US")` with USD currency
style and zero fraction digits. Exact scaled-integer aggregation happens first;
only the final presentation rounds. Exact decimal strings remain in the API,
expandable analytical tables, amount descriptions and customer details. Compact
chart ticks are approximate coordinates, with exact alternatives available.
The fictional demo uses the same USD presentation convention and stays labeled
fictional; it is not evidence of actual source business results.

The current nine-table extraction omits CurrencyRateID and the two currency
tables. dbt preserves native money but does not normalize FX or independently
validate currency semantics on future loads. This interpretation is bounded to
the inspected sample. A future source currency-profile gate and preserved currency
lineage would strengthen detection of source changes; neither is implemented by
this formatting refinement.
