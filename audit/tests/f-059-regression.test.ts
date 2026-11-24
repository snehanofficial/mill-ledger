import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-059: Dynamic Shortage Banners and Form Errors ARIA Live Regions (WCAG 2.2 SC 4.1.3 & SC 3.3.1)", () => {
  const alertComponentPath = path.resolve(__dirname, "../../client/src/components/ui/alert.tsx");
  const ordersPagePath = path.resolve(__dirname, "../../client/src/pages/orders-page.tsx");
  const newOrderPagePath = path.resolve(__dirname, "../../client/src/pages/new-order-page.tsx");
  const productionPagePath = path.resolve(__dirname, "../../client/src/pages/production-page.tsx");
  const paymentsPagePath = path.resolve(__dirname, "../../client/src/pages/payments-page.tsx");
  const dispatchPagePath = path.resolve(__dirname, "../../client/src/pages/dispatch-page.tsx");

  it("ensures Alert component defaults role and aria-live properly for assistive technologies", () => {
    const alertSource = fs.readFileSync(alertComponentPath, "utf8");

    expect(alertSource).toMatch(/role=\{props\.role\s*\|\|\s*\(variant === "danger" \|\| variant === "warning" \? "alert" : "status"\)\}/);
    expect(alertSource).toMatch(/aria-live=\{props\["aria-live"\]\s*\|\|\s*\(variant === "danger" \? "assertive" : "polite"\)\}/);
  });

  it("ensures order stock shortage banners have role='status' and aria-live='polite'", () => {
    const ordersSource = fs.readFileSync(ordersPagePath, "utf8");

    // Modal shortage warning
    expect(ordersSource).toMatch(/currentShortage > 0 &&\s*\(\s*<div[^>]*role="status"[^>]*aria-live="polite"/);
    // Approval shortage warning
    expect(ordersSource).toMatch(/selectedOrderForAction\.totalShortage > 0 \?\s*\(\s*<div[^>]*role="status"[^>]*aria-live="polite"/);
  });

  it("ensures catalog live stepper shortage banner has role='status' and aria-live='polite'", () => {
    const newOrderSource = fs.readFileSync(newOrderPagePath, "utf8");

    expect(newOrderSource).toMatch(/isShort &&\s*\(\s*<div[^>]*role="status"[^>]*aria-live="polite"/);
  });

  it("ensures batch carton shortage banner in production page has role='status' and aria-live='polite'", () => {
    const productionSource = fs.readFileSync(productionPagePath, "utf8");

    expect(productionSource).toMatch(/hasCartonShortage &&\s*\(\s*<div[^>]*role="status"[^>]*aria-live="polite"/);
  });

  it("ensures form validation error banners in payment and dispatch modals have role='alert' and aria-live='assertive'", () => {
    const paymentsSource = fs.readFileSync(paymentsPagePath, "utf8");
    const dispatchSource = fs.readFileSync(dispatchPagePath, "utf8");

    expect(paymentsSource).toMatch(/paymentError &&\s*\(\s*<div[^>]*role="alert"[^>]*aria-live="assertive"/);
    expect(dispatchSource).toMatch(/dispatchError &&\s*\(\s*<div[^>]*role="alert"[^>]*aria-live="assertive"/);
  });
});
