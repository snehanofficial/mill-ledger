# Benchmark Acceptance Oracle

## Supplied master data

Murukku 200 g; one batch expects 200 packets.

| BOM item    |              Planned per batch |                                    Valuation input |
| ----------- | -----------------------------: | -------------------------------------------------: |
| Flour       |                          40 kg | 100 kg at ₹42/kg opening; 60 kg at ₹45/kg purchase |
| Cooking oil |                           10 L |                                             ₹140/L |
| Spice mix   |                         1.2 kg |                                            ₹200/kg |
| 200 g pouch |                     200 pieces |                                        ₹2.50/piece |
| Carton      | 10 pieces at 20 packets/carton |                                          ₹15/piece |

Opening stock: flour 100 kg, oil 30 L, spice 5 kg, pouches 500, cartons 30, finished packets 50. Selling price is ₹50/packet before GST. Factory state is Tamil Nadu and exercise GST is 5%.

## Required transaction sequence

1. Purchase 60 kg flour at ₹45/kg.
2. Post production using 40 kg flour, 10.5 L oil, and 1.2 kg spice.
3. Record 188 good packets, 6 damaged pouches, and 9 cartons used.
4. Salesman A submits Retailer A order for 150 packets in Tamil Nadu.
5. Admin approves, posts CGST/SGST invoice, and dispatches.
6. Salesman B submits Distributor B order for 120 packets in Karnataka; show 32 shortage.
7. Allocate ₹4,000 payment to Retailer A.
8. Add ₹1,200 labour and ₹600 gas/power to the run.
9. Generate reports.

## Exact assertions

| Assertion                     |     Expected |
| ----------------------------- | -----------: |
| Flour closing                 |       120 kg |
| Oil closing                   |       19.5 L |
| Spice closing                 |       3.8 kg |
| Pouch closing                 |   306 pieces |
| Carton closing                |    21 pieces |
| Finished stock after run      |  238 packets |
| Finished stock after dispatch |   88 packets |
| Yield variance                | -6%, flagged |
| Oil variance                  | +5%, flagged |
| Taxable invoice               |       ₹7,500 |
| CGST                          |      ₹187.50 |
| SGST                          |      ₹187.50 |
| Invoice total                 |       ₹7,875 |
| Retailer A outstanding        |       ₹3,875 |
| Distributor B shortage        |   32 packets |

## Weighted-average costing

Opening flour value is ₹4,200 and purchase value is ₹2,700. Available flour is 160 kg at ₹43.125/kg. Flour consumed is ₹1,725.

| Cost                              |   Amount |
| --------------------------------- | -------: |
| Flour                             |   ₹1,725 |
| Oil                               |   ₹1,470 |
| Spice                             |     ₹240 |
| Pouches: 194 x ₹2.50              |     ₹485 |
| Cartons: 9 x ₹15                  |     ₹135 |
| Direct materials and packaging    |   ₹4,055 |
| Labour                            |   ₹1,200 |
| Gas/power                         |     ₹600 |
| Total run cost                    |   ₹5,855 |
| Cost per good packet: 5,855 / 188 | ≈ ₹31.14 |

The opening 50 finished packets have no supplied cost. The run cost applies to the newly produced packets and must not be presented as the blended cost of every packet in mixed stock.

## Preserved ambiguities

- Cartons: 9 cartons remain the supplied input. The UI shows a non-blocking warning that 9 cartons represent 180 of 188 packets.
- Damaged pouches: 188 good plus 6 damaged equals 194 pouch pieces consumed.
- Valuation: weighted average is proposed. A different method requires its formula and resulting values in project documentation.
- Distributor B: after dispatch, no 120-packet invoice/dispatch is permitted. Show shortage 32 and keep pending or partial only by explicit policy.
- Dates, GSTIN, HSN, addresses, due date, and payment terms: use clearly labelled dummy benchmark configuration.

## Executable fixture

The benchmark test must run through normal domain services against a clean database. It must verify every stock balance, ledger source, variance, invoice line/tax amount, outstanding balance, shortage, cost component, and final report total.
