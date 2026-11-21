# 02-defective-phone-hinglish – Defective phone, warranty refused (Hinglish)

Model: claude-opus-4-6 · Prompt: 2026-11-21.v4 · Corpus: {"entries":13,"citable":9,"last_verified":"2026-11-21"}

**USER:**

Bhai maine 2026-06-02 ko ek phone liya tha 18,999 ka, local shop 'Mobile World' se. 2 mahine mein display mein green line aa gayi. Service center bol raha hai warranty mein cover nahi hai, liquid damage hai, par phone kabhi geela hua hi nahi.

**ASSISTANT:**

Yeh toh sach mein frustrating hai bhai — naya phone liya aur bina galti ke warranty se mana kar diya. Aapki problem samajh aa gayi hai.

1. Kya aapne unse pehle complaint ki hai? Kab, kaise (email, app chat, call), aur unhone kya reply diya?

2. Aap kya chahte ho – refund, replacement, repair, ya compensation bhi?

**USER:**

Shop wale ne bola company se baat karo. Maine service center ko email kiya tha, unhone written mein mana kar diya. Mujhe replacement ya refund chahiye. Personal use ke liye liya tha, Lucknow mein rehta hoon. Bill aur warranty card dono hai.

---

Automated checks:

```json
{
  "id": "02-defective-phone-hinglish",
  "category": "consumer_core",
  "passed": false,
  "failures": [
    "1 turn(s) errored",
    "stage=followup, expected analysis"
  ],
  "final_stage": "followup",
  "domain": "consumer",
  "escalation": "none",
  "followups_asked": [
    "Kya aapne unse pehle complaint ki hai? Kab, kaise (email, app chat, call), aur unhone kya reply diya?",
    "Aap kya chahte ho – refund, replacement, repair, ya compensation bhi?"
  ],
  "facts_recorded": {
    "problem_description": "Phone display developed green line after 2 months; service center refusing warranty claiming liquid damage, but user says phone was never wet (inferred)",
    "trader_name": "Mobile World (user_stated)",
    "product_or_service": "Mobile phone (inferred)",
    "amount_paid": "18999 (user_stated)",
    "purchase_date": "2026-06-02 (user_stated)"
  },
  "missing_fields": [
    "prior_complaint",
    "relief_wanted",
    "purchase_purpose",
    "user_state"
  ],
  "rules": [],
  "citation": null,
  "lawyer_recommended": null,
  "document_placeholders": {
    "missing": 14,
    "confirm": 3
  },
  "llm_calls": 1
}
```
