/**
 * AUDIT-ONLY SCRIPT
 * Introspect nav-config.tsx getNavSections() output per role
 */
import React from "react";
(globalThis as any).React = React;

import { getNavSections, getAllLinks, type UserRole } from "../../client/src/components/shell/nav-config.js";

const roles: UserRole[] = ["ADMIN", "OWNER", "SALESMAN", "PRODUCTION", "ACCOUNTANT"];

for (const role of roles) {
  console.log(`\n========================================`);
  console.log(`ROLE: ${role}`);
  console.log(`========================================`);
  const sections = getNavSections(role);
  sections.forEach((sec, sIdx) => {
    console.log(`Section ${sIdx + 1}: ${sec.label || "(Unlabeled)"}`);
    sec.items.forEach((item) => {
      console.log(`  - Item: ${item.label} [${item.href || "nested"}] (roles: ${item.roles.join(",")})`);
      if (item.items) {
        item.items.forEach((child) => {
          console.log(`      * Child: ${child.label} -> ${child.href}`);
        });
      }
    });
  });
}
