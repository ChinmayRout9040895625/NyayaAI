# 04-vague-insufficient – Vague story – insufficient information

Model: claude-opus-4-6 · Prompt: 2026-11-21.v4 · Corpus: {"entries":13,"citable":9,"last_verified":"2026-11-21"}

**USER:**

company ne dhokha diya, ab kya karun?

**ASSISTANT:**

Yeh sunkar bura laga ki aapko company ne dhokha diya. Aap thoda detail batayein toh main aapki madad kar sakta hoon.

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
    "problem_description": "Company ne dhokha diya (cheated by a company) (user_stated)"
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
