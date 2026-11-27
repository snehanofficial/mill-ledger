import enCommon from "./locales/en-IN/common.json";
import enNavigation from "./locales/en-IN/navigation.json";
import enAuth from "./locales/en-IN/auth.json";
import enDashboard from "./locales/en-IN/dashboard.json";
import enOrders from "./locales/en-IN/orders.json";
import enProduction from "./locales/en-IN/production.json";
import enInventory from "./locales/en-IN/inventory.json";
import enPurchases from "./locales/en-IN/purchases.json";
import enCustomers from "./locales/en-IN/customers.json";
import enSuppliers from "./locales/en-IN/suppliers.json";
import enFinance from "./locales/en-IN/finance.json";
import enReports from "./locales/en-IN/reports.json";
import enSettings from "./locales/en-IN/settings.json";
import enValidation from "./locales/en-IN/validation.json";
import enErrors from "./locales/en-IN/errors.json";
import enPublic from "./locales/en-IN/public.json";

import taCommon from "./locales/ta-IN/common.json";
import taNavigation from "./locales/ta-IN/navigation.json";
import taAuth from "./locales/ta-IN/auth.json";
import taDashboard from "./locales/ta-IN/dashboard.json";
import taOrders from "./locales/ta-IN/orders.json";
import taProduction from "./locales/ta-IN/production.json";
import taInventory from "./locales/ta-IN/inventory.json";
import taPurchases from "./locales/ta-IN/purchases.json";
import taCustomers from "./locales/ta-IN/customers.json";
import taSuppliers from "./locales/ta-IN/suppliers.json";
import taFinance from "./locales/ta-IN/finance.json";
import taReports from "./locales/ta-IN/reports.json";
import taSettings from "./locales/ta-IN/settings.json";
import taValidation from "./locales/ta-IN/validation.json";
import taErrors from "./locales/ta-IN/errors.json";
import taPublic from "./locales/ta-IN/public.json";

export const DEFAULT_NS = "common" as const;

export const I18N_NAMESPACES = [
  "common",
  "navigation",
  "auth",
  "dashboard",
  "orders",
  "production",
  "inventory",
  "purchases",
  "customers",
  "suppliers",
  "finance",
  "reports",
  "settings",
  "validation",
  "errors",
  "public",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

export const resources = {
  "en-IN": {
    common: enCommon,
    navigation: enNavigation,
    auth: enAuth,
    dashboard: enDashboard,
    orders: enOrders,
    production: enProduction,
    inventory: enInventory,
    purchases: enPurchases,
    customers: enCustomers,
    suppliers: enSuppliers,
    finance: enFinance,
    reports: enReports,
    settings: enSettings,
    validation: enValidation,
    errors: enErrors,
    public: enPublic,
  },
  "ta-IN": {
    common: taCommon,
    navigation: taNavigation,
    auth: taAuth,
    dashboard: taDashboard,
    orders: taOrders,
    production: taProduction,
    inventory: taInventory,
    purchases: taPurchases,
    customers: taCustomers,
    suppliers: taSuppliers,
    finance: taFinance,
    reports: taReports,
    settings: taSettings,
    validation: taValidation,
    errors: taErrors,
    public: taPublic,
  },
} as const;
