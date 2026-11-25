-- Trigger to enforce append-only immutability on audit_log
CREATE OR REPLACE FUNCTION enforce_audit_log_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('mill_ledger.bypass_immutability', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Audit log records are strictly immutable: % on audit_log is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON "audit_log";
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION enforce_audit_log_immutability();
