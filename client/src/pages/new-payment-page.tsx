import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatINR } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCardIcon } from "lucide-react";
import { toast } from "sonner";

export function NewPaymentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialCustomerId = searchParams.get("customerId") ?? "";
  const initialInvoiceId = searchParams.get("invoiceId") ?? "";

  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [allocationMode, setAllocationMode] = useState<"FIFO" | "MANUAL" | "UNALLOCATED">(
    initialInvoiceId ? "MANUAL" : "FIFO",
  );
  const [manualAllocations, setManualAllocations] = useState<Record<string, string>>({});

  const { data: customersData } = useQuery<{
    customers: Array<{ id: string; code: string; name: string }>;
  }>({
    queryKey: ["sales-customers"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/customers");
      return res.data;
    },
  });

  const { data: openInvoicesData } = useQuery<{
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      totalAmount: number;
      outstandingAmount: number;
    }>;
  }>({
    queryKey: ["customer-open-invoices", customerId],
    queryFn: async () => {
      const res = await apiClient.get(`/finance/invoices?customerId=${customerId}`);
      return {
        invoices: (res.data.invoices ?? []).filter(
          (i: { outstandingAmount: number }) => Number(i.outstandingAmount) > 0,
        ),
      };
    },
    enabled: Boolean(customerId),
  });

  const customers = customersData?.customers ?? [];
  const openInvoices = openInvoicesData?.invoices ?? [];
  const amountNum = Number(amount) || 0;

  const recordMutation = useMutation({
    mutationFn: async () => {
      let allocations: Array<{ salesInvoiceId: string; amount: number }> | undefined;
      if (allocationMode === "UNALLOCATED") {
        allocations = [];
      } else if (allocationMode === "MANUAL") {
        allocations = Object.entries(manualAllocations)
          .map(([salesInvoiceId, val]) => ({
            salesInvoiceId,
            amount: Number(val || 0),
          }))
          .filter((a) => a.amount > 0);
      }

      const res = await apiClient.post("/payments", {
        customerId,
        amount: amountNum,
        paymentMode,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations,
      });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["receivables-summary"] });
      queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      const id = resData?.payment?.id ?? resData?.id;
      toast.success("Payment recorded.");
      navigate(id ? `/payments/${id}` : "/payments");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to record payment."));
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-4xl">
      <RecordHeader
        backTo="/payments"
        backLabel="Back to Payments"
        reference="Record customer payment"
        subtitle="Record money received and allocate it to open invoices or keep as unallocated credit."
      />

      <div className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pay-customer">Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="pay-customer">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount received (₹)</Label>
            <Input
              id="pay-amount"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-mode">Payment mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger id="pay-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Reference / UTR / Cheque #</Label>
            <Input
              id="pay-ref"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Transaction reference"
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Label>Allocation method</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={allocationMode === "FIFO" ? "primary" : "outline"}
              size="sm"
              onClick={() => setAllocationMode("FIFO")}
            >
              Auto-allocate (oldest first)
            </Button>
            <Button
              type="button"
              variant={allocationMode === "MANUAL" ? "primary" : "outline"}
              size="sm"
              onClick={() => setAllocationMode("MANUAL")}
            >
              Manual per invoice
            </Button>
            <Button
              type="button"
              variant={allocationMode === "UNALLOCATED" ? "primary" : "outline"}
              size="sm"
              onClick={() => setAllocationMode("UNALLOCATED")}
            >
              Keep unallocated advance
            </Button>
          </div>
        </div>

        {allocationMode === "MANUAL" && customerId && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <div className="text-xs font-semibold">Open invoices</div>
            {openInvoices.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No open invoices for this customer.
              </p>
            ) : (
              openInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <Label htmlFor={`alloc-${inv.id}`}>
                    {inv.invoiceNumber} (Due: {formatINR(inv.outstandingAmount)})
                  </Label>
                  <Input
                    id={`alloc-${inv.id}`}
                    type="number"
                    min={0}
                    max={inv.outstandingAmount}
                    step="0.01"
                    value={
                      manualAllocations[inv.id] ??
                      (inv.id === initialInvoiceId ? amount : "")
                    }
                    onChange={(e) =>
                      setManualAllocations((prev) => ({
                        ...prev,
                        [inv.id]: e.target.value,
                      }))
                    }
                    className="w-32 text-right tabular-nums"
                    placeholder="0.00"
                  />
                </div>
              ))
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="pay-notes">Notes (optional)</Label>
          <Textarea
            id="pay-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => navigate("/payments")}
            disabled={recordMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => recordMutation.mutate()}
            disabled={!customerId || amountNum <= 0 || recordMutation.isPending}
            className="gap-1.5"
          >
            <CreditCardIcon className="size-4" aria-hidden="true" />
            {recordMutation.isPending ? "Recording..." : "Record payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
