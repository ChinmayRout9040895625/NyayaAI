import { describe, it, expect } from "vitest";
import { triage } from "@/lib/pipeline/triage";

describe("triage", () => {
  it("flags threats and lock-outs as urgent", () => {
    expect(triage("The landlord changed the locks and his men threatened me").level).toBe("urgent");
    expect(triage("makan malik ne dhamki di").level).toBe("urgent");
  });
  it("flags criminal-law mentions as serious, not urgent", () => {
    expect(triage("I want to file FIR under IPC 420 for my late refund").level).toBe("serious");
  });
  it("does not treat Hinglish 'fir' (then) or a Rs 420 price as criminal", () => {
    expect(triage("maine order kiya, fir unhone refund nahi diya").level).toBe("none");
    expect(triage("the cable cost Rs 420").level).toBe("none");
  });
  it("plain consumer complaint -> none", () => {
    expect(triage("My refund of 2000 has not come for 3 weeks").level).toBe("none");
  });
});
