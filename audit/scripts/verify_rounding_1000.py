import sys
import json
from decimal import Decimal, ROUND_HALF_UP

def calculate_invoice_app(lines, is_intra_state):
    """Exact float math from server/src/modules/finance/finance.service.ts"""
    taxable_amount = 0.0
    total_tax_amount = 0.0
    cgst_amount = 0.0
    sgst_amount = 0.0
    igst_amount = 0.0

    prepared_lines = []

    for line in lines:
        qty = float(line["qty"])
        price = float(line["unit_price"])
        tax_rate = float(line["tax_rate"])

        line_taxable = qty * price
        line_tax = (line_taxable * tax_rate) / 100.0
        line_total = line_taxable + line_tax

        line_cgst = 0.0
        line_sgst = 0.0
        line_igst = 0.0

        if is_intra_state:
            line_cgst = line_tax / 2.0
            line_sgst = line_tax / 2.0
            cgst_amount += line_cgst
            sgst_amount += line_sgst
        else:
            line_igst = line_tax
            igst_amount += line_igst

        taxable_amount += line_taxable
        total_tax_amount += line_tax

        prepared_lines.append({
            "line_taxable": line_taxable,
            "line_cgst": line_cgst,
            "line_sgst": line_sgst,
            "line_igst": line_igst,
            "line_tax": line_tax,
            "line_total": line_total
        })

    total_amount = taxable_amount + total_tax_amount

    return {
        "taxable_amount": f"{taxable_amount:.2f}",
        "cgst_amount": f"{cgst_amount:.2f}",
        "sgst_amount": f"{sgst_amount:.2f}",
        "igst_amount": f"{igst_amount:.2f}",
        "total_tax_amount": f"{total_tax_amount:.2f}",
        "total_amount": f"{total_amount:.2f}",
        "raw": {
            "taxable_amount": taxable_amount,
            "cgst_amount": cgst_amount,
            "sgst_amount": sgst_amount,
            "igst_amount": igst_amount,
            "total_tax_amount": total_tax_amount,
            "total_amount": total_amount,
        }
    }

def calculate_invoice_ref(lines, is_intra_state):
    """Standard Indian GST Reference Implementation: Decimal arithmetic, ROUND_HALF_UP paise"""
    TWO_PLACES = Decimal("0.01")
    
    ref_taxable = Decimal("0.00")
    ref_cgst = Decimal("0.00")
    ref_sgst = Decimal("0.00")
    ref_igst = Decimal("0.00")
    ref_total_tax = Decimal("0.00")
    ref_grand_total = Decimal("0.00")

    for line in lines:
        qty = Decimal(str(line["qty"]))
        price = Decimal(str(line["unit_price"])).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        tax_rate = Decimal(str(line["tax_rate"]))

        line_taxable = (qty * price).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        ref_taxable += line_taxable

        if is_intra_state:
            half_rate = tax_rate / Decimal("2")
            line_cgst = ((line_taxable * half_rate) / Decimal("100")).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
            line_sgst = ((line_taxable * half_rate) / Decimal("100")).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
            line_tax = line_cgst + line_sgst
            line_total = line_taxable + line_tax

            ref_cgst += line_cgst
            ref_sgst += line_sgst
            ref_total_tax += line_tax
            ref_grand_total += line_total
        else:
            line_igst = ((line_taxable * tax_rate) / Decimal("100")).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
            line_tax = line_igst
            line_total = line_taxable + line_tax

            ref_igst += line_igst
            ref_total_tax += line_tax
            ref_grand_total += line_total

    return {
        "taxable_amount": f"{ref_taxable:.2f}",
        "cgst_amount": f"{ref_cgst:.2f}",
        "sgst_amount": f"{ref_sgst:.2f}",
        "igst_amount": f"{ref_igst:.2f}",
        "total_tax_amount": f"{ref_total_tax:.2f}",
        "total_amount": f"{ref_grand_total:.2f}",
    }

def main():
    print("=== RUNNING 1000 RANDOMIZED INVOICE ROUNDING VERIFICATION (PYTHON DECIMAL REF) ===")
    import random
    random.seed(42)

    total_tests = 1000
    mismatches = 0
    sample_mismatches = []

    for i in range(total_tests):
        line_count = random.randint(1, 5)
        is_intra_state = random.choice([True, False])
        lines = []
        for _ in range(line_count):
            qty = random.randint(1, 50)
            unit_price = round(random.uniform(10.0, 200.0), 2)
            tax_rate = random.choice([5, 12, 18])
            lines.append({"qty": qty, "unit_price": unit_price, "tax_rate": tax_rate})

        app_res = calculate_invoice_app(lines, is_intra_state)
        ref_res = calculate_invoice_ref(lines, is_intra_state)

        has_mismatch = (
            app_res["taxable_amount"] != ref_res["taxable_amount"] or
            app_res["cgst_amount"] != ref_res["cgst_amount"] or
            app_res["sgst_amount"] != ref_res["sgst_amount"] or
            app_res["igst_amount"] != ref_res["igst_amount"] or
            app_res["total_tax_amount"] != ref_res["total_tax_amount"] or
            app_res["total_amount"] != ref_res["total_amount"]
        )

        if has_mismatch:
            mismatches += 1
            if len(sample_mismatches) < 5:
                sample_mismatches.append({
                    "test_idx": i,
                    "is_intra_state": is_intra_state,
                    "lines": lines,
                    "app": app_res,
                    "ref": ref_res,
                })

    print(f"Total Tests: {total_tests}")
    print(f"Mismatches: {mismatches} / {total_tests} ({(mismatches / total_tests) * 100:.1f}%)")
    print("\nFirst 5 Sample Mismatches:")
    print(json.dumps(sample_mismatches, indent=2))

if __name__ == "__main__":
    main()
