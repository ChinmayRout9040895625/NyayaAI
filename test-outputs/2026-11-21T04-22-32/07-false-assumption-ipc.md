# 07-false-assumption-ipc – False legal assumption – criminal case for late refund

Model: gemini-3.5-flash-lite · Corpus: {"entries":13,"citable":9,"last_verified":"2026-11-21"}

**USER:**

An online store FastBuy owes me a refund of Rs 1,200 for a cancelled order from 2026-10-01. I want to file an FIR under IPC 420 so the owner goes to jail. That's the right law for this, right? I cancelled through the app and have the cancellation email. I complained twice by email and they said wait. I live in Delhi, personal use.

**ASSISTANT:**

This looks outside what NyayaAI covers. It only handles consumer disputes (refunds, defective products, poor service) in depth. For this issue please speak to a lawyer; free legal aid is available through your District Legal Services Authority (NALSA helpline 15100). If anyone is in danger, call 112.

---

Automated checks:

```json
{
  "id": "07-false-assumption-ipc",
  "category": "false_assumption",
  "passed": false,
  "failures": [
    "domain=out_of_scope, expected consumer",
    "stage=stub, expected analysis"
  ],
  "final_stage": "stub",
  "domain": "out_of_scope",
  "escalation": "serious",
  "followups_asked": [],
  "facts_recorded": {
    "trader_name": "FastBuy (user_stated)",
    "amount_paid": "1200 (user_stated)",
    "purchase_date": "2026-10-01 (user_stated)",
    "relief_wanted": "refund (user_stated)",
    "prior_complaint": "Complained twice by email and they said wait (user_stated)",
    "purchase_purpose": "personal (user_stated)",
    "user_state": "Delhi (user_stated)"
  },
  "missing_fields": [],
  "rules": [],
  "citation": null,
  "lawyer_recommended": null,
  "document_placeholders": null,
  "llm_calls": 1
}
```
