# 01-ecom-refund-en – E-commerce refund not received (English)

Model: gemini-3.5-flash · Corpus: {"entries":13,"citable":9,"last_verified":"2026-11-21"}

**USER:**

I ordered a Bluetooth speaker from an online store called ShopKart for Rs 3,499 on 2026-08-14. I returned it on 2026-08-20 because it stopped charging, and the pickup was done, but the refund still hasn't come.

**ASSISTANT:**

I understand that you have returned the defective Bluetooth speaker to ShopKart, but your refund of Rs 3,499 has not been processed yet.

1. Have you already complained to them? If yes – when, how (email, app chat, call), and what did they reply?

2. Did you buy this for personal or family use, or for a business?

**USER:**

I complained 4 times on their app chat. They keep saying 'refund initiated' but nothing comes. I just want my 3,499 back. I bought it for my own use. I live in Pune, Maharashtra. I have the invoice and the return pickup receipt.

**ASSISTANT:**

You appear to have a clear case as a consumer regarding an unreturned refund for a defective product. Since you have the invoice, pickup receipt, and chat records, you are in a good position to seek your refund of ₹3,499.

Here are your options:
1. Send a final formal email notice to ShopKart giving them 7 days to issue the refund, attaching all evidence.
2. Report the issue to the National Consumer Helpline (1915 or online).
3. File a formal complaint online via the e-daakhil portal or at the District Commission in Pune.

Next steps: Compile your invoice, return receipt, and chat screenshots, then send a final written grievance to ShopKart before filing a complaint.

Note: This is legal information, not legal advice. Consult a lawyer if you need professional representation.

---

Automated checks:

```json
{
  "id": "01-ecom-refund-en",
  "category": "consumer_core",
  "passed": true,
  "failures": [],
  "final_stage": "analysis",
  "domain": "consumer",
  "escalation": "none",
  "followups_asked": [
    "Have you already complained to them? If yes – when, how (email, app chat, call), and what did they reply?",
    "Did you buy this for personal or family use, or for a business?"
  ],
  "facts_recorded": {
    "product_or_service": "Bluetooth speaker (user_stated)",
    "trader_name": "ShopKart (user_stated)",
    "amount_paid": "3499 (user_stated)",
    "purchase_date": "2026-08-14 (user_stated)",
    "problem_description": "The Bluetooth speaker stopped charging, was returned and picked up, but the refund has not been issued. (user_stated)",
    "relief_wanted": "Refund of Rs 3,499 (user_stated)",
    "prior_complaint": "Complained 4 times via app chat. Trader responds 'refund initiated' but no money received. (user_stated)",
    "purchase_purpose": "personal (user_stated)",
    "user_state": "Pune, Maharashtra (user_stated)"
  },
  "missing_fields": [],
  "rules": [
    "within",
    "rule_not_verified"
  ],
  "citation": {
    "raw_verified_law_claims": 3,
    "source_matched": 2,
    "downgraded": 1,
    "raw_reply_reference_mentions": 0,
    "refs_removed": [],
    "guarantee_flags": [],
    "provisions_supplied": 9
  },
  "lawyer_recommended": false,
  "document_placeholders": {
    "missing": 8,
    "confirm": 0
  },
  "llm_calls": 3
}
```
