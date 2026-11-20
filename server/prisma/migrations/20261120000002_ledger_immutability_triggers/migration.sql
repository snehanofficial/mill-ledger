-- Trigger to enforce append-only immutability on stock_movement
CREATE OR REPLACE FUNCTION enforce_stock_movement_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('mill_ledger.bypass_immutability', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Stock movements are immutable: % on stock_movement is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movement_immutable ON "stock_movement";
CREATE TRIGGER trg_stock_movement_immutable
BEFORE UPDATE OR DELETE ON "stock_movement"
FOR EACH ROW EXECUTE FUNCTION enforce_stock_movement_immutability();

-- Trigger to enforce immutability on posted sales_invoice
CREATE OR REPLACE FUNCTION enforce_sales_invoice_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('mill_ledger.bypass_immutability', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED_BY_CREDIT_NOTE') THEN
      RAISE EXCEPTION 'Posted sales invoices cannot be deleted (status: %)', OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED_BY_CREDIT_NOTE') THEN
      IF (OLD."totalAmount" IS DISTINCT FROM NEW."totalAmount") OR
         (OLD."taxableAmount" IS DISTINCT FROM NEW."taxableAmount") OR
         (OLD."cgstAmount" IS DISTINCT FROM NEW."cgstAmount") OR
         (OLD."sgstAmount" IS DISTINCT FROM NEW."sgstAmount") OR
         (OLD."igstAmount" IS DISTINCT FROM NEW."igstAmount") OR
         (OLD."totalTaxAmount" IS DISTINCT FROM NEW."totalTaxAmount") OR
         (OLD."invoiceNumber" IS DISTINCT FROM NEW."invoiceNumber") OR
         (OLD."financialYear" IS DISTINCT FROM NEW."financialYear") OR
         (OLD."customerId" IS DISTINCT FROM NEW."customerId") OR
         (OLD."organizationId" IS DISTINCT FROM NEW."organizationId") THEN
        RAISE EXCEPTION 'Posted sales invoice financial and identification fields are immutable';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_invoice_immutable ON "sales_invoice";
CREATE TRIGGER trg_sales_invoice_immutable
BEFORE UPDATE OR DELETE ON "sales_invoice"
FOR EACH ROW EXECUTE FUNCTION enforce_sales_invoice_immutability();

-- Trigger to enforce immutability on lines of posted sales_invoice
CREATE OR REPLACE FUNCTION enforce_sales_invoice_line_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF current_setting('mill_ledger.bypass_immutability', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT status INTO v_status FROM "sales_invoice" WHERE id = COALESCE(OLD."salesInvoiceId", NEW."salesInvoiceId");
  IF v_status IN ('POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED_BY_CREDIT_NOTE') THEN
    RAISE EXCEPTION 'Lines belonging to posted sales invoices are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_invoice_line_immutable ON "sales_invoice_line";
CREATE TRIGGER trg_sales_invoice_line_immutable
BEFORE UPDATE OR DELETE ON "sales_invoice_line"
FOR EACH ROW EXECUTE FUNCTION enforce_sales_invoice_line_immutability();
