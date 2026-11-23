/* oxlint-disable react/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type Language = "en" | "ta";

export interface Translations {
  [key: string]: {
    en: string;
    ta: string;
  };
}

export const dictionary: Translations = {
  // Navigation Sections & Groups
  "nav.overview": { en: "Overview", ta: "முகப்பு" },
  "nav.operations": { en: "Operations", ta: "செயல்பாடுகள்" },
  "nav.inventory": { en: "Inventory", ta: "சரக்கு மேலாண்மை" },
  "nav.reporting": { en: "Reporting", ta: "அறிக்கையிடல்" },
  "nav.customers": { en: "Customers", ta: "வாடிக்கையாளர்கள்" },
  "nav.settings": { en: "Settings", ta: "அமைப்புகள்" },

  // Navigation Items & Sub-items
  "nav.dashboard": { en: "Dashboard", ta: "முகப்பு" },
  "nav.orders": { en: "Orders", ta: "விற்பனை ஆணைகள்" },
  "nav.all_orders": { en: "All orders", ta: "அனைத்து ஆணைகள்" },
  "nav.new_order": { en: "New order", ta: "புதிய ஆணை" },
  "nav.production": { en: "Production", ta: "உற்பத்தி" },
  "nav.todays_runs": { en: "Today's runs", ta: "இன்றைய உற்பத்தி" },
  "nav.new_run": { en: "New run", ta: "புதிய உற்பத்தி" },
  "nav.run_history": { en: "Run history", ta: "உற்பத்தி வரலாறு" },
  "nav.stock": { en: "Stock", ta: "சரக்கு இருப்பு" },
  "nav.purchases": { en: "Purchases", ta: "கொள்முதல்" },
  "nav.suppliers": { en: "Suppliers", ta: "வழங்குநர்கள்" },
  "nav.invoices": { en: "Invoices", ta: "விலைப்பட்டியல்" },
  "nav.dispatch": { en: "Dispatch", ta: "விநியோகம்" },
  "nav.payments": { en: "Payments", ta: "பணப் பரிவர்த்தனை" },
  "nav.reports": { en: "Reports", ta: "அறிக்கைகள்" },
  "nav.sales": { en: "Sales", ta: "விற்பனை" },
  "nav.receivables": { en: "Receivables", ta: "நிலுவை விவரங்கள்" },
  "nav.gst": { en: "GST", ta: "ஜி.எஸ்.டி" },
  "nav.audit_log": { en: "Audit log", ta: "தணிக்கை பதிவு" },
  "nav.exports": { en: "Exports", ta: "ஏற்றுமதிகள்" },
  "nav.outbox": { en: "Device Outbox", ta: "சாதன பெட்டி" },
  "nav.home": { en: "Home", ta: "முகப்பு" },
  "nav.more": { en: "More", ta: "மேலும்" },

  // Shell and Status Badges
  "status.live": { en: "Live", ta: "இணைப்பில்" },
  "status.offline": { en: "Offline", ta: "இணைப்பற்ற நிலை" },
  "status.syncing": { en: "Syncing", ta: "ஒத்திசைக்கிறது" },
  "status.synced": { en: "Synced", ta: "ஒத்திசைக்கப்பட்டது" },
  "status.conflict": { en: "Conflict", ta: "முரண்பாடு" },
  "status.waiting_sync": {
    en: "Waiting to sync",
    ta: "ஒத்திசைக்க காத்திருக்கிறது",
  },
  "status.approved": { en: "Approved", ta: "ஒப்புதல் அளிக்கப்பட்டது" },
  "status.submitted": { en: "Submitted", ta: "சமர்ப்பிக்கப்பட்டது" },
  "status.rejected": { en: "Rejected", ta: "நிராகரிக்கப்பட்டது" },
  "status.dispatched": { en: "Dispatched", ta: "அனுப்பப்பட்டது" },
  "status.pending": { en: "Pending", ta: "நிலுவையில்" },
  "status.paid": { en: "Paid", ta: "செலுத்தப்பட்டது" },
  "status.partially_paid": { en: "Partially Paid", ta: "பகுதி செலுத்தப்பட்டது" },
  "status.overdue": { en: "Overdue", ta: "தவணை கடந்தது" },
  "status.posted": { en: "Posted", ta: "பதிவு செய்யப்பட்டது" },
  "status.draft": { en: "Draft", ta: "வரைவு" },
  "status.active": { en: "Active", ta: "செயலில் உள்ளது" },
  "status.inactive": { en: "Inactive", ta: "செயலிழக்கப்பட்டது" },
  "status.completed": { en: "Completed", ta: "நிறைவடைந்தது" },
  "status.in_progress": { en: "In Progress", ta: "செயல்பாட்டில்" },
  "status.balanced": { en: "Balanced", ta: "சமநிலையில் உள்ளது" },
  "status.discrepancy": { en: "Discrepancy", ta: "முரண்பாடு உள்ளது" },
  "status.sufficient": { en: "Sufficient", ta: "போதுமானது" },
  "status.shortage_flagged": { en: "Shortage flagged", ta: "பற்றாக்குறை உள்ளது" },
  "status.in_stock": { en: "In stock", ta: "இருப்பில் உள்ளது" },
  "status.low_stock": { en: "Low stock", ta: "குறைந்த இருப்பு" },
  "status.out_of_stock": { en: "Out of stock", ta: "இருப்பில்லை" },

  // Actions & Buttons
  "action.sync_now": { en: "Sync now", ta: "இப்போதே ஒத்திசை" },
  "action.refresh": { en: "Refresh", ta: "புதுப்பி" },
  "action.submit": { en: "Submit", ta: "சமர்ப்பி" },
  "action.approve": { en: "Approve", ta: "ஒப்புதல் அளி" },
  "action.reject": { en: "Reject", ta: "நிராகரி" },
  "action.retry": { en: "Retry", ta: "மீண்டும் முயற்சி செய்" },
  "action.discard": { en: "Discard", ta: "நீக்கு" },
  "action.cancel": { en: "Cancel", ta: "ரத்து செய்" },
  "action.sign_out": { en: "Sign out", ta: "வெளியேறு" },
  "action.save": { en: "Save", ta: "சேமி" },
  "action.edit": { en: "Edit", ta: "திருத்து" },
  "action.delete": { en: "Delete", ta: "நீக்கு" },
  "action.view": { en: "View", ta: "பார்" },
  "action.export": { en: "Export", ta: "ஏற்றுமதி செய்" },
  "action.download": { en: "Download", ta: "பதிவிறக்கு" },
  "action.filter": { en: "Filter", ta: "வடிகட்டு" },
  "action.search": { en: "Search", ta: "தேடு" },
  "action.close": { en: "Close", ta: "மூடு" },
  "action.back": { en: "Back", ta: "பின்செல்" },
  "action.confirm": { en: "Confirm", ta: "உறுதிப்படுத்து" },
  "action.invoice_order": { en: "Invoice Order", ta: "விலைப்பட்டியல் உருவாக்கு" },
  "action.generate_invoice": { en: "Generate Invoice", ta: "விலைப்பட்டியல் உருவாக்கு" },
  "action.record_payment": { en: "Record Payment", ta: "பணம் செலுத்துதலைப் பதிவு செய்" },
  "action.new_run": { en: "New Run", ta: "புதிய உற்பத்தி" },
  "action.start_run": { en: "Start Run", ta: "உற்பத்தியைத் தொடங்கு" },
  "action.receive_stock": { en: "Receive Stock", ta: "சரக்கு வரவு வை" },
  "action.add_supplier": { en: "Add Supplier", ta: "புதிய வழங்குநர்" },
  "action.add_customer": { en: "Add Customer", ta: "புதிய வாடிக்கையாளர்" },
  "action.all": { en: "All", ta: "அனைத்தும்" },

  // Operational Table Headers
  "term.order_number": { en: "Order number", ta: "ஆணை எண்" },
  "term.invoice_number": { en: "Invoice number", ta: "விலைப்பட்டியல் எண்" },
  "term.run_number": { en: "Run number", ta: "உற்பத்தி எண்" },
  "term.batch_number": { en: "Batch number", ta: "தொகுதி எண்" },
  "term.customer": { en: "Customer", ta: "வாடிக்கையாளர்" },
  "term.customer_name": { en: "Customer name", ta: "வாடிக்கையாளர் பெயர்" },
  "term.supplier": { en: "Supplier", ta: "வழங்குநர்" },
  "term.supplier_name": { en: "Supplier name", ta: "வழங்குநர் பெயர்" },
  "term.salesman": { en: "Salesman", ta: "விற்பனையாளர்" },
  "term.date": { en: "Date", ta: "தேதி" },
  "term.status": { en: "Status", ta: "நிலை" },
  "term.ordered": { en: "Ordered", ta: "கோரிய அளவு" },
  "term.taxable": { en: "Taxable", ta: "வரிக்குரிய மதிப்பு" },
  "term.taxable_amount": { en: "Taxable amount", ta: "வரிக்குரிய தொகை" },
  "term.gst": { en: "GST", ta: "ஜி.எஸ்.டி" },
  "term.tax": { en: "Tax", ta: "வரி" },
  "term.total": { en: "Total", ta: "மொத்தம்" },
  "term.total_amount": { en: "Total amount", ta: "மொத்தத் தொகை" },
  "term.shortage_status": { en: "Shortage status", ta: "பற்றாக்குறை நிலை" },
  "term.actions": { en: "Actions", ta: "நடவடிக்கைகள்" },
  "term.sku": { en: "SKU", ta: "சரக்கு குறியீடு" },
  "term.item_name": { en: "Item Name", ta: "பொருளின் பெயர்" },
  "term.item_description": { en: "Item description", ta: "பொருளின் விவரம்" },
  "term.category": { en: "Category", ta: "வகை" },
  "term.on_hand": { en: "On Hand", ta: "கையிருப்பு" },
  "term.avg_unit_cost": { en: "Avg Unit Cost", ta: "சராசரி அலகு அடக்கம்" },
  "term.total_value": { en: "Total Value", ta: "மொத்த மதிப்பு" },
  "term.ledger_status": { en: "Ledger Status", ta: "பேரேட்டு நிலை" },
  "term.product": { en: "Product", ta: "பொருள்" },
  "term.good_packets": { en: "Good packets", ta: "நல்ல பாக்கெட்டுகள்" },
  "term.damaged_packets": { en: "Damaged packets", ta: "சேதமடைந்த பாக்கெட்டுகள்" },
  "term.yield_variance": { en: "Yield variance", ta: "மகசூல் மாறுபாடு" },
  "term.materials_cost": { en: "Materials cost", ta: "மூலப்பொருள் அடக்கம்" },
  "term.total_cost": { en: "Total cost", ta: "மொத்த செலவு" },
  "term.cost_per_packet": { en: "Cost / packet", ta: "பாக்கெட் அடக்க விலை" },
  "term.place_of_supply": { en: "Place of supply", ta: "விநியோக இடம்" },
  "term.outstanding": { en: "Outstanding", ta: "நிலுவைத் தொகை" },
  "term.balance": { en: "Balance", ta: "மீதித் தொகை" },
  "term.hsn": { en: "HSN", ta: "எச்.எஸ்.என்" },
  "term.qty": { en: "Qty", ta: "அளவு" },
  "term.quantity": { en: "Quantity", ta: "அளவு" },
  "term.rate": { en: "Rate", ta: "விலை / வீதம்" },
  "term.unit_price": { en: "Unit price", ta: "அலகு விலை" },
  "term.payment_number": { en: "Payment number", ta: "பரிவர்த்தனை எண்" },
  "term.paid_amount": { en: "Paid amount", ta: "செலுத்திய தொகை" },
  "term.unallocated": { en: "Unallocated", ta: "ஒதுக்கப்படாத தொகை" },
  "term.payment_method": { en: "Payment method", ta: "செலுத்தும் முறை" },
  "term.reference": { en: "Reference", ta: "குறிப்பு எண்" },
  "term.reference_no": { en: "Reference #", ta: "குறிப்பு எண்" },
  "term.purchase_number": { en: "Purchase number", ta: "கொள்முதல் எண்" },
  "term.vehicle_number": { en: "Vehicle number", ta: "வாகன எண்" },
  "term.driver_name": { en: "Driver name", ta: "ஓட்டுநர் பெயர்" },
  "term.driver_phone": { en: "Driver phone", ta: "ஓட்டுநர் தொலைபேசி" },
  "term.transporter": { en: "Transporter", ta: "போக்குவரத்து நிறுவனம்" },
  "term.phone": { en: "Phone", ta: "தொலைபேசி எண்" },
  "term.city": { en: "City", ta: "நகரம்" },
  "term.state": { en: "State", ta: "மாநிலம்" },
  "term.gstin": { en: "GSTIN", ta: "ஜி.எஸ்.டி.ஐ.என்" },
  "term.fy": { en: "FY", ta: "நிதியாண்டு" },

  // Operational Mill Commodities & UOMs
  "term.murukku": { en: "Murukku 200 g", ta: "முறுக்கு 200 கி" },
  "term.flour": { en: "Flour", ta: "மாவு" },
  "term.raw_rice_flour": { en: "Raw Rice Flour", ta: "பச்சரிசி மாவு" },
  "term.oil": { en: "Oil", ta: "எண்ணெய்" },
  "term.refined_palm_oil": { en: "Refined Palm Oil", ta: "சுத்திகரிக்கப்பட்ட பாமாயில்" },
  "term.salt": { en: "Salt", ta: "உப்பு" },
  "term.salt_spices": { en: "Salt & Spices", ta: "உப்பு & மசாலா" },
  "term.packaging_pouch": { en: "Packaging pouch", ta: "பேக்கிங் கவர்" },
  "term.carton_box": { en: "Carton box", ta: "அட்டைப்பெட்டி" },
  "term.packet": { en: "Packet", ta: "பாக்கெட்" },
  "term.packets": { en: "Packets", ta: "பாக்கெட்டுகள்" },
  "term.carton": { en: "Carton", ta: "பெட்டி" },
  "term.cartons": { en: "Cartons", ta: "பெட்டிகள்" },
  "term.kg": { en: "kg", ta: "கிலோ" },
  "term.liter": { en: "L", ta: "லிட்டர்" },
  "term.pcs": { en: "Pcs", ta: "எண்ணிக்கை" },
  "term.physical_on_hand": { en: "Physical on hand", ta: "நேரடி கையிருப்பு" },
  "term.reserved": { en: "Reserved", ta: "முன்பதிவு" },
  "term.shortage": { en: "Shortage", ta: "பற்றாக்குறை" },
  "term.available": { en: "Available", ta: "இருப்பில் உள்ளது" },

  // KPIs & Metrics
  "kpi.total_revenue": { en: "Total revenue", ta: "மொத்த வருவாய்" },
  "kpi.receivables_outstanding": {
    en: "Receivables outstanding",
    ta: "நிலுவையில் உள்ள தொகை",
  },
  "kpi.stock_valuation": { en: "Stock valuation", ta: "சரக்கு மதிப்பு" },
  "kpi.production_output": { en: "Production output", ta: "உற்பத்தி வெளியீடு" },
  "kpi.collections": { en: "Collections", ta: "வசூலிப்பு" },
  "kpi.active_batches": { en: "Active batches", ta: "செயலில் உள்ள தொகுதிகள்" },
  "kpi.ledger_balanced": { en: "Ledger balanced", ta: "பேரேடு சமநிலையில் உள்ளது" },
  "kpi.discrepancy_flagged": {
    en: "Discrepancy flagged",
    ta: "முரண்பாடு கண்டறியப்பட்டது",
  },
  "kpi.pending_orders": { en: "Pending orders", ta: "நிலுவையில் உள்ள ஆணைகள்" },

  // Roles
  "role.owner": { en: "Owner", ta: "உரிமையாளர்" },
  "role.admin": { en: "Admin", ta: "நிர்வாகி" },
  "role.salesman": { en: "Salesman", ta: "விற்பனையாளர்" },
  "role.production": { en: "Production", ta: "உற்பத்தி மேலாளர்" },
  "role.accountant": { en: "Accountant", ta: "கணக்காளர்" },
  "role.auditor": { en: "Auditor", ta: "தணிக்கையாளர்" },

  // Common UI Strings & Empty States
  "common.loading": { en: "Loading...", ta: "ஏற்றுகிறது..." },
  "common.no_records": { en: "No records found", ta: "பதிவுகள் எதுவும் இல்லை" },
  "common.no_orders": { en: "No orders found", ta: "ஆணைகள் எதுவும் இல்லை" },
  "common.no_invoices": { en: "No invoices posted yet", ta: "விலைப்பட்டியல் எதுவும் பதிவாகவில்லை" },
  "common.no_runs": { en: "No production runs found", ta: "உற்பத்திப் பதிவுகள் எதுவும் இல்லை" },
  "common.recent_invoices": { en: "Recent Invoices", ta: "சமீபத்திய விலைப்பட்டியல்கள்" },
  "common.active_batches": {
    en: "Active Production Batches",
    ta: "செயல்பாட்டில் உள்ள உற்பத்தி தொகுதிகள்",
  },
  "shell.search_placeholder": {
    en: "Search pages and actions...",
    ta: "பக்கங்கள் மற்றும் செயல்களைத் தேடு...",
  },
  "shell.search_records": { en: "Search records", ta: "பதிவுகளைத் தேடு" },
};

// Build reverse lookup index for English phrases
const englishIndex = new Map<string, { en: string; ta: string }>();
for (const entry of Object.values(dictionary)) {
  englishIndex.set(entry.en.toLowerCase().trim(), entry);
}

/**
 * Pure translation function supporting key lookup, exact English phrase matching,
 * and graceful fallback.
 */
export function translate(
  key: string,
  fallback?: string,
  language: Language = "en",
): string {
  const direct = dictionary[key];
  if (direct) {
    return direct[language] || fallback || key;
  }
  const byEnglish = englishIndex.get(key.toLowerCase().trim());
  if (byEnglish) {
    return byEnglish[language] || fallback || key;
  }
  if (fallback) {
    const fallbackEntry = englishIndex.get(fallback.toLowerCase().trim());
    if (fallbackEntry) {
      return fallbackEntry[language] || fallback;
    }
  }
  return fallback || key;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mill_ledger_lang") as Language;
      if (saved === "en" || saved === "ta") return saved;
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("mill_ledger_lang", lang);
      document.documentElement.lang = lang;
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    return translate(key, fallback, language);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
