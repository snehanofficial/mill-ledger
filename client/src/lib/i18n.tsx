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
  "dashboard.overview": { en: "Overview", ta: "முகப்பு" },
  "dashboard.desc": {
    en: "Executive operational overview and real time reconciled business metrics",
    ta: "ஆலை செயல்பாட்டு மேலோட்டம் மற்றும் நேரடி வணிக அளவீடுகள்",
  },
  "dashboard.total_revenue": { en: "Total revenue", ta: "மொத்த வருவாய்" },
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
  "shell.pause_motion": { en: "Pause animations", ta: "அசைவூட்டங்களை இடைநிறுத்து" },
  "shell.resume_motion": { en: "Resume animations", ta: "அசைவூட்டங்களைத் தொடங்கு" },

  // Operational Surface Phrases (F-080 Bilingual UI)
  "prod.execution": { en: "Production execution", ta: "உற்பத்தி செயல்முறை" },
  "prod.subtitle": {
    en: "BOM execution, consumption variances, yield calculations, and run costs",
    ta: "மூலப்பொருள் பயன்பாடு, மகசூல் மாறுபாடு மற்றும் உற்பத்தி செலவு விவரங்கள்",
  },
  "prod.record_batch": { en: "Record production batch", ta: "உற்பத்தி தொகுதி பதிவு" },
  "prod.murukku_batch": {
    en: "Murukku 200g standard batch (Benchmark: 200 expected packets)",
    ta: "முறுக்கு 200 கி நிலையான உற்பத்தி (இலக்கு: 200 பாக்கெட்டுகள்)",
  },
  "prod.bom_recipe": { en: "Bill of Materials (BOM) Recipe", ta: "மூலப்பொருள் செய்முறை (BOM)" },
  "prod.good_pkts_prod": { en: "Good packets produced", ta: "தயாரிக்கப்பட்ட நல்ல பாக்கெட்டுகள்" },
  "prod.damaged_pouches": { en: "Damaged pouches", ta: "சேதமடைந்த பவுச்சுகள்" },
  "prod.total_batches": { en: "Total batches", ta: "மொத்த உற்பத்திகள்" },
  "prod.pkts_produced": { en: "Packets produced", ta: "உற்பத்தி செய்த பாக்கெட்டுகள்" },
  "prod.total_run_cost": { en: "Total run cost", ta: "மொத்த உற்பத்தி செலவு" },
  "prod.ledger_integrity": { en: "Ledger integrity", ta: "பேரேட்டு நம்பகத்தன்மை" },
  "prod.verified": { en: "Verified", ta: "சரிபார்க்கப்பட்டது" },
  "prod.completed_runs": { en: "Completed production runs", ta: "நிறைவடைந்த உற்பத்தி பதிவுகள்" },
  "prod.search_batches": { en: "Search production batches...", ta: "உற்பத்தி தொகுதிகளைத் தேடு..." },
  "prod.oil_consumed": { en: "Oil consumed (L)", ta: "பயன்படுத்திய எண்ணெய் (லிட்டர்)" },
  "prod.cooking_oil": { en: "Cooking oil consumed (L)", ta: "பயன்படுத்திய சமையல் எண்ணெய் (லிட்டர்)" },
  "prod.cartons_consumed": { en: "Cartons consumed", ta: "பயன்படுத்திய பெட்டிகள்" },
  "prod.cartons_used": { en: "Cartons used (pieces)", ta: "பயன்படுத்திய பெட்டிகள் (எண்ணிக்கை)" },
  "prod.labor_cost": { en: "Direct labor cost", ta: "நேரடி கூலி செலவு" },
  "prod.labor_cost_inr": { en: "Direct labour cost (₹)", ta: "நேரடி கூலி செலவு (₹)" },
  "prod.utility_cost": { en: "Utility & electricity cost", ta: "மின்சாரம் & பராமரிப்பு செலவு" },
  "prod.gas_power_inr": { en: "Gas and power cost (₹)", ta: "எரிவாயு & மின்சார செலவு (₹)" },
  "prod.batch_notes": { en: "Batch notes", ta: "தொகுதி குறிப்புகள்" },
  "prod.direct_mat_colon": { en: "Direct materials:", ta: "நேரடி மூலப்பொருட்கள்:" },
  "prod.direct_lab_colon": { en: "Direct labour:", ta: "நேரடி கூலி:" },
  "prod.gas_power_colon": { en: "Gas and power:", ta: "எரிவாயு & மின்சாரம்:" },
  "prod.total_run_cost_colon": { en: "Total run cost:", ta: "மொத்த உற்பத்தி செலவு:" },
  "prod.cost_per_good_pkt": { en: "Cost per good packet:", ta: "பாக்கெட் அடக்க விலை:" },
  "prod.post_btn": { en: "Post & Update Stock Ledger", ta: "பதிவு செய்து சரக்கு இருப்பை புதுப்பி" },
  "prod.reverse_run": { en: "Reverse Production Run", ta: "உற்பத்தி பதிவை ரத்து செய்" },
  "prod.reversal_reason": { en: "Reason for reversal", ta: "ரத்து செய்வதற்கான காரணம்" },
  "prod.reverse_btn": { en: "Reverse Run", ta: "உற்பத்தியை ரத்து செய்" },
  "prod.reverse": { en: "Reverse", ta: "ரத்து செய்" },
  "prod.reversed": { en: "Reversed", ta: "ரத்து செய்யப்பட்டது" },
  "prod.notes": { en: "Notes", ta: "குறிப்புகள்" },

  // Outbox & Offline Sync
  "outbox.title": { en: "Device Outbox", ta: "சாதன வெளிப்பெட்டி" },
  "outbox.subtitle": {
    en: "Local IndexedDB command queue awaiting server acceptance. No stock reserved until synced.",
    ta: "சேவையக உறுதிப்படுத்தலுக்காக காத்திருக்கும் சாதன பதிவுகள். ஒத்திசைக்கும் வரை சரக்கு ஒதுக்கப்படாது.",
  },
  "outbox.connected": { en: "Connected", ta: "இணைக்கப்பட்டுள்ளது" },
  "outbox.refresh_catalog": { en: "Refresh catalog", ta: "பட்டியலை புதுப்பி" },
  "outbox.discard_title": { en: "Discard Offline Order", ta: "இணையற்ற ஆணையை நீக்கு" },
  "outbox.discard_desc": {
    en: "Warning: This uncommitted order exists only in your local device storage. Discarding will permanently erase it and it cannot be recovered.",
    ta: "எச்சரிக்கை: இந்த ஆணை உங்கள் சாதன நினைவகத்தில் மட்டுமே உள்ளது. நீக்கினால் இது நிரந்தரமாக அழிக்கப்படும், திரும்பப் பெற முடியாது.",
  },
  "outbox.discard_confirm": { en: "Yes, Discard Order", ta: "ஆம், ஆணையை நீக்கு" },
  "outbox.discard_cancel": { en: "Keep Order", ta: "ஆணையை வைத்திரு" },

  // Stock & Inventory
  "stock.refresh_balances": { en: "Refresh Balances", ta: "இருப்பை புதுப்பி" },
  "stock.total_items": { en: "Total Items", ta: "மொத்த பொருட்கள்" },
  "stock.raw_materials": { en: "Raw Materials", ta: "மூலப்பொருட்கள்" },
  "stock.packaging": { en: "Packaging", ta: "பேக்கிங் பொருட்கள்" },
  "stock.finished_goods": { en: "Finished Goods", ta: "முடிக்கப்பட்ட பொருட்கள்" },
  "stock.valued_total": { en: "Valued Stock Total", ta: "மொத்த இருப்பு மதிப்பு" },
  "stock.title": { en: "Inventory & stock ledger", ta: "சரக்கு மற்றும் இருப்புப் பேரேடு" },
  "stock.subtitle": {
    en: "Real-time stock on hand, reservations, weighted average cost, and movements",
    ta: "கையிருப்பு, முன்பதிவு, சராசரி அடக்க விலை மற்றும் நகர்வுகள்",
  },
  "stock.movement_history": { en: "Stock movement history", ta: "சரக்கு நகர்வு வரலாறு" },

  // Orders
  "orders.title": { en: "Orders", ta: "விற்பனை ஆணைகள்" },
  "orders.sales_title": { en: "Sales orders", ta: "விற்பனை ஆணைகள்" },
  "orders.subtitle": {
    en: "Salesman mobile orders, admin approval, shortages, and atomic stock reservations",
    ta: "விற்பனையாளர் ஆணைகள், நிர்வாக ஒப்புதல், பற்றாக்குறை மற்றும் சரக்கு முன்பதிவு",
  },
  "orders.new_order": { en: "New sales order", ta: "புதிய விற்பனை ஆணை" },
  "orders.create_order": { en: "Create order", ta: "ஆணை உருவாக்கு" },
  "orders.total_orders": { en: "Total orders", ta: "மொத்த ஆணைகள்" },
  "orders.approved_bookings": { en: "Approved bookings", ta: "ஒப்புதல் அளிக்கப்பட்டவை" },
  "orders.booked_value": { en: "Booked value", ta: "முன்பதிவு மதிப்பு" },
  "orders.pending_review": { en: "Pending review", ta: "பரிசீலனையில் உள்ளவை" },
  "orders.total_sales_value": { en: "Total sales value", ta: "மொத்த விற்பனை மதிப்பு" },
  "orders.select_customer": { en: "Select customer", ta: "வாடிக்கையாளரைத் தேர்ந்தெடு" },
  "orders.select_product": { en: "Select product", ta: "பொருளைத் தேர்ந்தெடு" },
  "orders.catalog_title": { en: "Order Catalog & Entry", ta: "பொருட்கள் பட்டியல் & புதிய ஆணை" },
  "orders.catalog_desc": {
    en: "Select customer, browse packaged product tiles, and adjust quantities using touch-friendly steppers.",
    ta: "வாடிக்கையாளரைத் தேர்ந்தெடுத்து, பாக்கெட் பொருட்களைப் பார்த்து, அளவுகளை உள்ளிடவும்.",
  },
  "orders.offline_mode": { en: "Offline Mode", ta: "இணைப்பற்ற நிலை" },
  "orders.live_stock_avail": { en: "Live Stock Available", ta: "நேரடி இருப்பு உள்ளது" },

  // Invoices
  "invoices.title": { en: "Sales invoices", ta: "விற்பனை விலைப்பட்டியல்கள்" },
  "invoices.header": { en: "Invoices", ta: "விலைப்பட்டியல்கள்" },
  "invoices.subtitle": {
    en: "GST compliant tax invoices, place of supply, and credit notes",
    ta: "ஜி.எஸ்.டி வரி விலைப்பட்டியல்கள், விநியோக இடம் மற்றும் வரவுக் குறிப்புகள்",
  },
  "invoices.desc": {
    en: "Tax calculation snapshots, FY series numbering, and immutable invoice ledger",
    ta: "வரி கணக்கீடு, நிதியாண்டு தொடர் எண் மற்றும் மாறா விலைப்பட்டியல் பேரேடு",
  },
  "invoices.ledger_header": { en: "Posted invoices ledger", ta: "விலைப்பட்டியல் பேரேடு" },
  "invoices.total_invoiced": { en: "Total Invoiced", ta: "மொத்த விலைப்பட்டியல் மதிப்பு" },
  "invoices.total_invoices": { en: "Total invoices", ta: "மொத்த விலைப்பட்டியல்கள்" },
  "invoices.total_billed": { en: "Total billed", ta: "மொத்த விலைப்பட்டியல் மதிப்பு" },
  "invoices.total_outstanding": { en: "Total outstanding", ta: "மொத்த நிலுவைத் தொகை" },
  "invoices.paid_invoices": { en: "Paid Invoices", ta: "செலுத்தப்பட்ட விலைப்பட்டியல்கள்" },
  "invoices.outstanding_receivables": { en: "Outstanding Receivables", ta: "வசூலிக்க வேண்டிய நிலுவை" },
  "invoices.gst_collected": { en: "GST Collected", ta: "வசூலிக்கப்பட்ட ஜி.எஸ்.டி" },

  // Purchases
  "purchases.title": { en: "Purchase receipts", ta: "கொள்முதல் வரவுகள்" },
  "purchases.procurement": { en: "Procurement & Mandi Intake", ta: "கொள்முதல் மற்றும் மண்டி வரவு" },
  "purchases.live_ledger": { en: "Live Ledger", ta: "நேரடி பேரேடு" },
  "purchases.subtitle": {
    en: "Raw material receipts, supplier invoicing, and weighted average cost updates",
    ta: "மூலப்பொருள் கொள்முதல் மற்றும் சராசரி விலை கணக்கீடு",
  },
  "purchases.desc": {
    en: "Mandi raw material receipts, supplier invoicing, and automated weighted-average cost updating.",
    ta: "மண்டி மூலப்பொருள் வரவு, வழங்குநர் விலைப்பட்டியல் மற்றும் தானியங்கி சராசரி அடக்க விலை கணக்கீடு.",
  },
  "purchases.record_btn": { en: "Record Purchase Receipt", ta: "கொள்முதல் ரசீது பதிவு" },
  "purchases.ledger_header": { en: "Purchase Receipts Ledger", ta: "கொள்முதல் ரசீது பேரேடு" },

  // Dispatches
  "dispatch.title": { en: "Dispatch & delivery", ta: "சரக்கு விநியோகம் மற்றும் போக்குவரத்து" },
  "dispatch.header": { en: "Dispatch", ta: "விநியோகம்" },
  "dispatch.subtitle": {
    en: "Physical stock movements, reservation release, and warehouse fulfillment records",
    ta: "நேரடி சரக்கு நகர்வு, முன்பதிவு விடுவிப்பு மற்றும் ஆலை விநியோகப் பதிவுகள்",
  },
  "dispatch.record_btn": { en: "Record dispatch", ta: "விநியோகத்தை பதிவு செய்" },
  "dispatch.total_dispatches": { en: "Total dispatches", ta: "மொத்த விநியோகங்கள்" },
  "dispatch.units_dispatched": { en: "Units dispatched", ta: "விநியோகிக்கப்பட்ட அலகுகள்" },
  "dispatch.active_reservations": { en: "Active stock reservations", ta: "செயலில் உள்ள முன்பதிவுகள்" },
  "dispatch.order_dispatches": {
    en: "Order dispatches, transporter details, vehicle tracking, and stock release",
    ta: "ஆணை விநியோகம், போக்குவரத்து விவரங்கள் மற்றும் சரக்கு ஒப்படைப்பு",
  },

  // Payments
  "payments.title": { en: "Payment receipts", ta: "பணப் பரிவர்த்தனை ரசீதுகள்" },
  "payments.header": { en: "Payments", ta: "பணப் பரிவர்த்தனை" },
  "payments.subtitle": {
    en: "Record customer payments, FIFO allocation, and bank reference tracking",
    ta: "வாடிக்கையாளர் வசூல், பற்று ஒதுக்கீடு மற்றும் வங்கி குறிப்பு எண்",
  },
  "payments.desc": {
    en: "Customer collections, invoice payment allocations, and receivables ledger",
    ta: "வாடிக்கையாளர் வசூல், விலைப்பட்டியல் ஒதுக்கீடு மற்றும் வரவு பேரேடு",
  },
  "payments.record_btn": { en: "Record payment", ta: "வசூலைப் பதிவு செய்" },
  "payments.total_collected": { en: "Total collected", ta: "மொத்த வசூலிப்பு" },
  "payments.net_outstanding": { en: "Net outstanding", ta: "நிகர நிலுவைத் தொகை" },
  "payments.unallocated_credit": { en: "Unallocated credit", ta: "ஒதுக்கப்படாத வரவு" },
  "payments.ledger_tab": { en: "Payments ledger", ta: "பணம் வசூல் பேரேடு" },
  "payments.receivables_tab": { en: "Customer receivables", ta: "வாடிக்கையாளர் நிலுவைகள்" },

  // Reports
  "reports.title": { en: "Operational & financial reports", ta: "செயல்பாடு மற்றும் நிதி அறிக்கைகள்" },
  "reports.subtitle": {
    en: "Statutory GST registers, stock valuation, production costing, and audit trail",
    ta: "ஜி.எஸ்.டி பதிவேடு, சரக்கு மதிப்பீடு மற்றும் தணிக்கைப் பதிவு",
  },
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

/**
 * LangPart: Inline language of parts wrapper (WCAG 2.2 SC 3.1.2 Level AA / F-060)
 * Wraps foreign words, phrases, or script switchers with explicit `lang` tag.
 */
export function LangPart({
  lang,
  children,
  className,
}: {
  lang: Language;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span lang={lang} className={className}>
      {children}
    </span>
  );
}
