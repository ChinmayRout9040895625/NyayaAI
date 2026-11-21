# 01-ecom-refund-en – E-commerce refund not received (English)

Model: gemini-3.5-flash · Corpus: {"entries":13,"citable":9,"last_verified":"2026-11-21"}

**USER:**

I ordered a Bluetooth speaker from an online store called ShopKart for Rs 3,499 on 2026-08-14. I returned it on 2026-08-20 because it stopped charging, and the pickup was done, but the refund still hasn't come.

**ASSISTANT:**

I understand that you have returned the defective Bluetooth speaker to ShopKart, but your refund of Rs 3,499 has not been processed yet. I am here to help you navigate this issue.

1. Have you already complained to them? If yes – when, how (email, app chat, call), and what did they reply?

2. Did you buy this for personal or family use, or for a business?

**USER:**

I complained 4 times on their app chat. They keep saying 'refund initiated' but nothing comes. I just want my 3,499 back. I bought it for my own use. I live in Pune, Maharashtra. I have the invoice and the return pickup receipt.

**ASSISTANT:**

You purchased a Bluetooth speaker for ₹3,499 for personal use, which makes you a consumer. Since ShopKart took the product back but failed to refund your money despite multiple chat follow-ups, their failure to issue a refund within 30 days of taking back defective goods constitutes an unfair trade practice.

Your options are:
1. Send a formal legal notice or email to ShopKart giving them a reasonable deadline (for example, the number of days you state in your notice) to process the ₹3,499 refund along with your evidence.
2. Submit a grievance on the National Consumer Helpline portal or file a formal complaint electronically through the e-Daakhil portal.

Immediate Next Steps:
- Keep safe copies of the invoice, return pickup receipt, and screenshots of all 4 chat conversations.
- Send a final written complaint to ShopKart's support email or grievance office.
- If they refuse to comply, file a consumer complaint with the District Commission in Pune, where you reside. About 3 months have passed since the cause of action, which is well within the two-year limitation period.

Please note: Specific monetary limits for the District Commission should be confirmed on the official e-filing portal. This is legal information, not legal advice. Consult a lawyer if you need formal advice.

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
    "trader_name": "ShopKart (user_stated)",
    "product_or_service": "Bluetooth speaker (user_stated)",
    "amount_paid": "3499 (user_stated)",
    "purchase_date": "2026-08-14 (user_stated)",
    "problem_description": "Returned product because it stopped charging and pickup was completed, but refund has not been issued. (user_stated)",
    "relief_wanted": "refund of 3,499 (user_stated)",
    "prior_complaint": "Complained 4 times via app chat; received replies stating 'refund initiated' but money was not credited. (user_stated)",
    "purchase_purpose": "personal (user_stated)",
    "user_state": "Pune, Maharashtra (user_stated)"
  },
  "missing_fields": [],
  "rules": [
    "within",
    "rule_not_verified"
  ],
  "citation": {
    "raw_verified_law_claims": 4,
    "source_matched": 4,
    "downgraded": 0,
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
