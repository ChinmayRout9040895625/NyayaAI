# 04-vague-insufficient – Vague story – insufficient information

Model: gemini-3.5-flash · Corpus: {"entries":13,"citable":9,"last_verified":"2026-11-21"}

**USER:**

company ne dhokha diya, ab kya karun?

**ASSISTANT:**

Aapki pareshani hum samajh sakte hain. Hum aapki poori madad karne ki koshish karenge.

1. Ye kis company, shop ya app se tha? Agar online marketplace tha, to seller ka naam pata hai?

2. Aapne exactly kya kharida tha ya kaunsi service ke liye pay kiya tha?

---

Automated checks:

```json
{
  "id": "04-vague-insufficient",
  "category": "insufficient_info",
  "passed": true,
  "failures": [],
  "final_stage": "followup",
  "domain": "unknown",
  "escalation": "none",
  "followups_asked": [
    "Ye kis company, shop ya app se tha? Agar online marketplace tha, to seller ka naam pata hai?",
    "Aapne exactly kya kharida tha ya kaunsi service ke liye pay kiya tha?"
  ],
  "facts_recorded": {
    "problem_description": "company ne dhokha diya (user_stated)"
  },
  "missing_fields": [
    "trader_name",
    "product_or_service",
    "amount_paid",
    "purchase_date",
    "prior_complaint",
    "relief_wanted",
    "purchase_purpose",
    "user_state"
  ],
  "rules": [],
  "citation": null,
  "lawyer_recommended": null,
  "document_placeholders": null,
  "llm_calls": 1
}
```
