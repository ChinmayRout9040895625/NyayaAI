import type { Language } from "../schemas";

export interface FieldSpec {
  key: string;
  label: string;
  core: boolean; // required before analysis (unless user insists / turn cap)
  description: string; // for the extraction prompt
  question: Record<Language, string>;
}

/** Priority order = order of follow-up questions. */
export const CONSUMER_FIELDS: FieldSpec[] = [
  {
    key: "problem_description",
    label: "What went wrong",
    core: true,
    description: "What the defect, deficiency, non-delivery or refund problem is, in the user's words",
    question: {
      en: "Can you describe what exactly went wrong – was the product defective, not delivered, or was a refund or service not provided?",
      hi: "कृपया बताइए कि असल में क्या गड़बड़ हुई – सामान खराब निकला, डिलीवर नहीं हुआ, या रिफंड/सर्विस नहीं मिली?",
      hinglish: "Exactly kya problem hui – product kharab tha, deliver nahi hua, ya refund/service nahi mili?",
    },
  },
  {
    key: "trader_name",
    label: "Seller / company / platform",
    core: true,
    description: "Name of the seller, service provider, manufacturer or e-commerce platform",
    question: {
      en: "Which company, shop or app was this with? If it was a marketplace (like an online shopping app), do you know the seller's name too?",
      hi: "यह किस कंपनी, दुकान या ऐप से था? अगर ऑनलाइन मार्केटप्लेस था, तो क्या आपको विक्रेता (seller) का नाम पता है?",
      hinglish: "Ye kis company, shop ya app se tha? Agar online marketplace tha, to seller ka naam pata hai?",
    },
  },
  {
    key: "product_or_service",
    label: "Product or service",
    core: true,
    description: "What was bought or what service was hired",
    question: {
      en: "What exactly did you buy or which service did you pay for?",
      hi: "आपने ठीक-ठीक क्या खरीदा था या किस सेवा के लिए भुगतान किया था?",
      hinglish: "Aapne exactly kya kharida tha ya kaunsi service ke liye pay kiya tha?",
    },
  },
  {
    key: "amount_paid",
    label: "Amount paid (₹)",
    core: true,
    description: "Total consideration actually paid, in rupees (number only). NOT the compensation the user wants.",
    question: {
      en: "How much did you actually pay for it (in ₹)?",
      hi: "आपने इसके लिए असल में कितने रुपये चुकाए थे?",
      hinglish: "Aapne iske liye actually kitne rupaye pay kiye the?",
    },
  },
  {
    key: "purchase_date",
    label: "Date of purchase / service",
    core: true,
    description: "Date of purchase, order or service (ISO yyyy-mm-dd if known, else as stated)",
    question: {
      en: "On what date did you buy it or book the service? An approximate date is fine.",
      hi: "आपने यह किस तारीख को खरीदा या सेवा बुक की थी? अनुमानित तारीख भी चलेगी।",
      hinglish: "Aapne ye kis date ko kharida ya book kiya tha? Approx date bhi chalega.",
    },
  },
  {
    key: "prior_complaint",
    label: "Complaint already made & response",
    core: true,
    description: "Whether the user already complained to the trader, how (email/app/call), when, and what reply they got",
    question: {
      en: "Have you already complained to them? If yes – when, how (email, app chat, call), and what did they reply?",
      hi: "क्या आपने उनसे पहले शिकायत की है? अगर हाँ, तो कब, कैसे (ईमेल, ऐप चैट, कॉल) और उन्होंने क्या जवाब दिया?",
      hinglish: "Kya aapne unse pehle complaint ki hai? Kab, kaise (email, app chat, call), aur unhone kya reply diya?",
    },
  },
  {
    key: "relief_wanted",
    label: "What you want",
    core: false,
    description: "What outcome the user wants: refund, replacement, repair, compensation",
    question: {
      en: "What outcome do you want – a refund, replacement, repair, or compensation as well?",
      hi: "आप क्या चाहते हैं – रिफंड, बदलाव (replacement), मरम्मत, या साथ में मुआवज़ा भी?",
      hinglish: "Aap kya chahte ho – refund, replacement, repair, ya compensation bhi?",
    },
  },
  {
    key: "purchase_purpose",
    label: "Personal or business use",
    core: false,
    description: "'personal' or 'commercial' – whether bought for personal use or for a business/resale",
    question: {
      en: "Did you buy this for personal or family use, or for a business?",
      hi: "क्या आपने यह निजी/पारिवारिक उपयोग के लिए खरीदा था या किसी व्यवसाय के लिए?",
      hinglish: "Ye personal/family use ke liye liya tha ya business ke liye?",
    },
  },
  {
    key: "user_state",
    label: "Your state / city",
    core: false,
    description: "State and city where the user lives or works",
    question: {
      en: "Which city and state do you live in?",
      hi: "आप किस शहर और राज्य में रहते हैं?",
      hinglish: "Aap kis city aur state mein rehte ho?",
    },
  },
];

export const CONSUMER_FIELD_KEYS = CONSUMER_FIELDS.map((f) => f.key);

export interface EvidenceSpec {
  key: string;
  label: string;
  why: string;
}

export const CONSUMER_EVIDENCE: EvidenceSpec[] = [
  { key: "invoice", label: "Invoice / bill / receipt", why: "Proves you bought it, from whom, when and for how much – the basis of a consumer claim and of the amount paid." },
  { key: "order_confirmation", label: "Order ID / booking confirmation", why: "Links you to the transaction, especially for online purchases." },
  { key: "payment_proof", label: "Payment proof (bank/UPI/card statement)", why: "Shows the money actually left your account, which matters if the seller disputes the amount." },
  { key: "product_photos", label: "Photos / videos of the defect", why: "Shows the condition of the goods; take them before returning or repairing anything." },
  { key: "warranty_card", label: "Warranty / guarantee card", why: "Shows what the seller or manufacturer promised and for how long." },
  { key: "complaint_records", label: "Your complaints (emails, chats, ticket numbers)", why: "Shows you gave them a chance to fix it, and when – useful for the notice and for dates." },
  { key: "written_refusal", label: "Their reply / refusal in writing", why: "Shows their position; the date can matter for when the dispute arose." },
  { key: "delivery_proof", label: "Delivery / courier / service record", why: "Shows what was (or wasn't) delivered or done, and when." },
];

export const CONSUMER_EVIDENCE_KEYS = CONSUMER_EVIDENCE.map((e) => e.key);

/** Corpus ids always given to the analysis step for consumer cases, on top of keyword retrieval. */
export const CONSUMER_ANCHOR_PROVISIONS = [
  "CPA2019-S2-7",
  "CPA2019-S2-10",
  "CPA2019-S2-11",
  "CPA2019-S34-2",
  "CPA2019-S2-47-VIII",
  "CPA2019-S35-1",
  "CPA2019-S39-1",
  "CPA2019-S69",
];

/** General, non-legal-claim next steps used when no verified provision is available. */
export const CONSUMER_GENERAL_STEPS = [
  "Collect your invoice, payment proof, order details and all complaint messages in one place.",
  "Write to the seller/company once more in writing (email), stating what went wrong, what you want and a reasonable deadline.",
  "You can register a grievance with the National Consumer Helpline (call 1915 or consumerhelpline.gov.in), which tries to resolve complaints before litigation.",
  "If it is not resolved, a complaint can be filed online before the Consumer Commission through the government's e-filing portal; consider getting advice first.",
];
