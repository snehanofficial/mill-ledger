export type Language = "en" | "ta";

export interface Translations {
  [key: string]: {
    en: string;
    ta: string;
  };
}

export const dictionary: Translations = {
  // Navigation
  "nav.dashboard": { en: "Dashboard", ta: "முகப்பு" },
  "nav.orders": { en: "Orders", ta: "விற்பனை ஆணைகள்" },
  "nav.production": { en: "Production", ta: "உற்பத்தி" },
  "nav.stock": { en: "Stock", ta: "சரக்கு இருப்பு" },
  "nav.invoices": { en: "Invoices", ta: "விலைப்பட்டியல்" },
  "nav.dispatch": { en: "Dispatch", ta: "விநியோகம்" },
  "nav.payments": { en: "Payments", ta: "பணப் பரிவர்த்தனை" },
  "nav.reports": { en: "Reports", ta: "அறிக்கைகள்" },
  "nav.settings": { en: "Settings", ta: "அமைப்புகள்" },
  "nav.new_order": { en: "New Order", ta: "புதிய ஆணை" },
  "nav.outbox": { en: "Device Outbox", ta: "சாதன பெட்டி" },
  "nav.home": { en: "Home", ta: "முகப்பு" },
  "nav.more": { en: "More", ta: "மேலும்" },

  // Shell and Status
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

  // Actions
  "action.sync_now": { en: "Sync now", ta: "இப்போதே ஒத்திசை" },
  "action.refresh": { en: "Refresh", ta: "புதுப்பி" },
  "action.submit": { en: "Submit", ta: "சமர்ப்பி" },
  "action.approve": { en: "Approve", ta: "ஒப்புதல் அளி" },
  "action.reject": { en: "Reject", ta: "நிராகரி" },
  "action.retry": { en: "Retry", ta: "மீண்டும் முயற்சி செய்" },
  "action.discard": { en: "Discard", ta: "நீக்கு" },
  "action.cancel": { en: "Cancel", ta: "ரத்து செய்" },
  "action.sign_out": { en: "Sign out", ta: "வெளியேறு" },

  // Operational Terms
  "term.murukku": { en: "Murukku 200 g", ta: "முறுக்கு 200 கி" },
  "term.flour": { en: "Flour", ta: "மாவு" },
  "term.oil": { en: "Oil", ta: "எண்ணெய்" },
  "term.salt": { en: "Salt", ta: "உப்பு" },
  "term.packet": { en: "Packet", ta: "பாக்கெட்" },
  "term.carton": { en: "Carton", ta: "அட்டைப்பெட்டி" },
  "term.kg": { en: "kg", ta: "கிலோ" },
  "term.customer": { en: "Customer", ta: "வாடிக்கையாளர்" },
  "term.salesman": { en: "Salesman", ta: "விற்பனையாளர்" },
  "term.quantity": { en: "Quantity", ta: "அளவு" },
  "term.taxable": { en: "Taxable", ta: "வரிக்குரிய மதிப்பு" },
  "term.total": { en: "Total", ta: "மொத்தம்" },
  "term.shortage": { en: "Shortage", ta: "பற்றாக்குறை" },
  "term.available": { en: "Available", ta: "இருப்பில் உள்ளது" },
  "term.on_hand": { en: "Physical on hand", ta: "கையிருப்பு" },
  "term.reserved": { en: "Reserved", ta: "முன்பதிவு" },
};
