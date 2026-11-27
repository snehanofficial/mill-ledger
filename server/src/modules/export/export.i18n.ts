import { normalizeLocale, type SupportedLocale } from "@mill-ledger/shared";

const EXPORT_DICTIONARY: Record<string, { "en-IN": string; "ta-IN": string }> =
  {
    // Document & Report Titles
    "TAX INVOICE": { "en-IN": "TAX INVOICE", "ta-IN": "வரி விலைப்பட்டியல்" },
    "Commercial Tax Invoice": {
      "en-IN": "Commercial Tax Invoice",
      "ta-IN": "வணிக வரி விலைப்பட்டியல்",
    },
    "System-generated GST Tax Invoice": {
      "en-IN": "System-generated GST Tax Invoice",
      "ta-IN": "கணினி உருவாக்கிய ஜி.எஸ்.டி வரி விலைப்பட்டியல்",
    },
    "Sales Register": { "en-IN": "Sales Register", "ta-IN": "விற்பனை பதிவேடு" },
    Products: { "en-IN": "Products", "ta-IN": "பொருட்கள்" },
    Customers: { "en-IN": "Customers", "ta-IN": "வாடிக்கையாளர்கள்" },
    Orders: { "en-IN": "Orders", "ta-IN": "விற்பனை ஆணைகள்" },
    Invoices: { "en-IN": "Invoices", "ta-IN": "விலைப்பட்டியல்கள்" },
    Payments: { "en-IN": "Payments", "ta-IN": "பணப் பரிவர்த்தனை" },
    Recipes: { "en-IN": "Recipes", "ta-IN": "செய்முறைகள்" },
    Suppliers: { "en-IN": "Suppliers", "ta-IN": "வழங்குநர்கள்" },

    // Common Export Column Headers & Labels
    "Invoice #": { "en-IN": "Invoice #", "ta-IN": "விலைப்பட்டியல் எண்" },
    "Invoice No": { "en-IN": "Invoice No", "ta-IN": "விலைப்பட்டியல் எண்" },
    "Order #": { "en-IN": "Order #", "ta-IN": "ஆணை எண்" },
    "Payment #": { "en-IN": "Payment #", "ta-IN": "பரிவர்த்தனை எண்" },
    Customer: { "en-IN": "Customer", "ta-IN": "வாடிக்கையாளர்" },
    "Customer Name": { "en-IN": "Customer Name", "ta-IN": "வாடிக்கையாளர் பெயர்" },
    Supplier: { "en-IN": "Supplier", "ta-IN": "வழங்குநர்" },
    "Supplier Name": { "en-IN": "Supplier Name", "ta-IN": "வழங்குநர் பெயர்" },
    Product: { "en-IN": "Product", "ta-IN": "பொருள்" },
    "Product Name": { "en-IN": "Product Name", "ta-IN": "பொருளின் பெயர்" },
    "Item Description": {
      "en-IN": "Item Description",
      "ta-IN": "பொருளின் விவரம்",
    },
    SKU: { "en-IN": "SKU", "ta-IN": "சரக்கு குறியீடு" },
    HSN: { "en-IN": "HSN", "ta-IN": "எச்.எஸ்.என்" },
    "HSN Code": { "en-IN": "HSN Code", "ta-IN": "எச்.எஸ்.என் குறியீடு" },
    Qty: { "en-IN": "Qty", "ta-IN": "அளவு" },
    Quantity: { "en-IN": "Quantity", "ta-IN": "அளவு" },
    Rate: { "en-IN": "Rate", "ta-IN": "விலை" },
    Taxable: { "en-IN": "Taxable", "ta-IN": "வரிக்குரிய மதிப்பு" },
    "Taxable Value": { "en-IN": "Taxable Value", "ta-IN": "வரிக்குரிய மதிப்பு" },
    Tax: { "en-IN": "Tax", "ta-IN": "வரி" },
    CGST: { "en-IN": "CGST", "ta-IN": "சி.ஜி.எஸ்.டி" },
    SGST: { "en-IN": "SGST", "ta-IN": "எஸ்.ஜி.எஸ்.டி" },
    IGST: { "en-IN": "IGST", "ta-IN": "ஐ.ஜி.எஸ்.டி" },
    Total: { "en-IN": "Total", "ta-IN": "மொத்தம்" },
    "Total Amount": { "en-IN": "Total Amount", "ta-IN": "மொத்தத் தொகை" },
    Outstanding: { "en-IN": "Outstanding", "ta-IN": "நிலுவைத் தொகை" },
    Status: { "en-IN": "Status", "ta-IN": "நிலை" },
    Date: { "en-IN": "Date", "ta-IN": "தேதி" },
    "Place of Supply": { "en-IN": "Place of Supply", "ta-IN": "விநியோக இடம்" },
    State: { "en-IN": "State", "ta-IN": "மாநிலம்" },
    Phone: { "en-IN": "Phone", "ta-IN": "தொலைபேசி" },
    Email: { "en-IN": "Email", "ta-IN": "மின்னஞ்சல்" },
    GSTIN: { "en-IN": "GSTIN", "ta-IN": "ஜி.எஸ்.டி.ஐ.என்" },
    Code: { "en-IN": "Code", "ta-IN": "குறியீடு" },
    Name: { "en-IN": "Name", "ta-IN": "பெயர்" },
    Category: { "en-IN": "Category", "ta-IN": "வகை" },
    Active: { "en-IN": "Active", "ta-IN": "செயலில்" },
    Yes: { "en-IN": "Yes", "ta-IN": "ஆம்" },
    No: { "en-IN": "No", "ta-IN": "இல்லை" },
    "BILLED TO": { "en-IN": "BILLED TO", "ta-IN": "விலைப்பட்டியல் பெறுநர்" },
    "INVOICE DETAILS": {
      "en-IN": "INVOICE DETAILS",
      "ta-IN": "விலைப்பட்டியல் விவரங்கள்",
    },
    "No records found for the selected criteria.": {
      "en-IN": "No records found for the selected criteria.",
      "ta-IN": "தேர்ந்தெடுக்கப்பட்ட விவரங்களுக்குப் பதிவுகள் எதுவும் இல்லை.",
    },
  };

export function translateExportLabel(
  label: string,
  locale?: string | null,
): string {
  const normalized: SupportedLocale = normalizeLocale(locale);
  const entry = EXPORT_DICTIONARY[label];
  if (entry) {
    return entry[normalized];
  }
  return label;
}
