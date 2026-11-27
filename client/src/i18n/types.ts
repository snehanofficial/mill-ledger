import "i18next";
import { DEFAULT_NS, resources } from "./resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NS;
    resources: (typeof resources)["en-IN"];
  }
}
