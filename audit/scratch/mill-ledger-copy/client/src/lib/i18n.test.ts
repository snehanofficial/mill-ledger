import { describe, it, expect } from "vitest";
import { dictionary } from "./i18n";

describe("i18n Translation Dictionary", () => {
  it("provides valid English and Tamil translations for key navigation routes", () => {
    expect(dictionary["nav.dashboard"]).toBeDefined();
    expect(dictionary["nav.dashboard"].en).toBe("Dashboard");
    expect(dictionary["nav.dashboard"].ta).toBe("முகப்பு");

    expect(dictionary["nav.orders"].en).toBe("Orders");
    expect(dictionary["nav.orders"].ta).toBe("விற்பனை ஆணைகள்");

    expect(dictionary["nav.stock"].en).toBe("Stock");
    expect(dictionary["nav.stock"].ta).toBe("சரக்கு இருப்பு");
  });

  it("contains operational status translations for offline and sync states", () => {
    expect(dictionary["status.live"].en).toBe("Live");
    expect(dictionary["status.offline"].en).toBe("Offline");
    expect(dictionary["status.syncing"].en).toBe("Syncing");
    expect(dictionary["status.synced"].en).toBe("Synced");
    expect(dictionary["status.conflict"].en).toBe("Conflict");

    expect(dictionary["status.live"].ta).toBe("இணைப்பில்");
    expect(dictionary["status.offline"].ta).toBe("இணைப்பற்ற நிலை");
  });

  it("provides Tamil translations for operational mill commodities and UOMs", () => {
    expect(dictionary["term.murukku"].ta).toBe("முறுக்கு 200 கி");
    expect(dictionary["term.flour"].ta).toBe("மாவு");
    expect(dictionary["term.oil"].ta).toBe("எண்ணெய்");
    expect(dictionary["term.kg"].ta).toBe("கிலோ");
  });
});
