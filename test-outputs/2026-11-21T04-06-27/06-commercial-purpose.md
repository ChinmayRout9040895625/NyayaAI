# 06-commercial-purpose – Purchase for business use

Model: gemini-3.5-flash · Corpus: {"entries":13,"citable":9,"last_verified":"2026-11-21"}

**USER:**

I run a small printing shop in Indore, Madhya Pradesh. I bought a commercial printer from PrintPro Traders on 2026-07-01 for Rs 2,40,000 to use in the business. It keeps jamming and the dealer refuses to replace it. I complained by email twice and they said it's operator error. I want a replacement. I have the invoice and emails.

**ASSISTANT:**

You purchased a commercial printer for Rs 2,40,000 for your printing shop in Indore, but the dealer refuses to replace it, alleging operator error. Under the Consumer Protection Act, 2019, goods bought for a commercial purpose are excluded from consumer protection unless they are used exclusively for earning your livelihood by self-employment. 

Here are your main options:
1. Send a Formal Written Demand Notice: Issue a clear written notice to PrintPro Traders attaching your invoice and email trail, demanding replacement or repair within a reasonable deadline (for example, the number of days you state in your notice).
2. File a Consumer Complaint: If unresolved, you may consider filing a consumer complaint. However, you will need to establish that the printer was bought exclusively to earn your livelihood through self-employment.

Next steps:
- Gather all invoices, emails, and technical report evidence.
- Consult a legal professional to confirm whether your business setup satisfies the self-employment criteria.
- Confirm the current pecuniary jurisdiction limits of the District Commission before filing.

This information is for legal guidance only and does not constitute formal legal advice.

---

Automated checks:

```json
{
  "id": "06-commercial-purpose",
  "category": "consumer_edge",
  "passed": true,
  "failures": [],
  "final_stage": "analysis",
  "domain": "consumer",
  "escalation": "none",
  "followups_asked": [],
  "facts_recorded": {
    "trader_name": "PrintPro Traders (user_stated)",
    "purchase_date": "2026-07-01 (user_stated)",
    "amount_paid": "240000 (user_stated)",
    "product_or_service": "commercial printer (user_stated)",
    "purchase_purpose": "commercial (user_stated)",
    "problem_description": "Printer keeps jamming and the dealer refuses to replace it, claiming operator error (user_stated)",
    "prior_complaint": "Complained twice by email, trader claimed it's operator error and refused replacement (user_stated)",
    "relief_wanted": "replacement (user_stated)",
    "user_state": "Madhya Pradesh, Indore (user_stated)"
  },
  "missing_fields": [],
  "rules": [
    "within",
    "rule_not_verified",
    "commercial_flag"
  ],
  "citation": {
    "raw_verified_law_claims": 3,
    "source_matched": 3,
    "downgraded": 0,
    "raw_reply_reference_mentions": 0,
    "refs_removed": [],
    "guarantee_flags": [],
    "provisions_supplied": 9
  },
  "lawyer_recommended": true,
  "document_placeholders": {
    "missing": 8,
    "confirm": 0
  },
  "llm_calls": 2
}
```
