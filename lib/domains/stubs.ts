import type { Domain, Language } from "../schemas";

/**
 * Domains recognised but NOT implemented in depth in the MVP.
 * Replies are fixed text (no model-generated legal content) so nothing unverified is said.
 */
interface StubSpec {
  title: string;
  reply: Record<Language, string>;
  evidence: string[];
  evidence_hi: string[]; // same items in Hindi, for the language-aware case panel
  referrals: string[];
}

export const DOMAIN_STUBS: Partial<Record<Domain, StubSpec>> = {
  tenancy: {
    title: "Tenancy (deposit, rent, eviction) – not covered in depth yet",
    reply: {
      en: "This sounds like a landlord–tenant issue. NyayaAI currently covers only consumer disputes in depth. Tenancy law in India depends heavily on your state: each state has its own rent law, and the central Model Tenancy Act, 2021 applies only where a state has adopted it. I have not verified your state's law, so I won't tell you what it says. What usually helps: keep your rent agreement, deposit receipt or bank transfer proof, rent receipts, and all messages with the landlord. If you are being forced out, locked out or threatened, contact the police (112) and your District Legal Services Authority (free legal aid, NALSA helpline 15100) right away.",
      hi: "यह मकान-मालिक और किरायेदार का मामला लगता है। NyayaAI अभी केवल उपभोक्ता (consumer) मामलों को विस्तार से कवर करता है। किरायेदारी कानून हर राज्य में अलग है, और केंद्र का मॉडल टेनेंसी एक्ट, 2021 केवल वहीं लागू होता है जहाँ राज्य ने उसे अपनाया हो। मैंने आपके राज्य का कानून सत्यापित नहीं किया है, इसलिए मैं उसके बारे में दावा नहीं करूँगा। किराया अनुबंध, जमा राशि की रसीद/बैंक प्रमाण, किराया रसीदें और मकान-मालिक के साथ सारे संदेश संभालकर रखें। अगर आपको जबरन निकाला जा रहा है या धमकी दी जा रही है, तो तुरंत पुलिस (112) और ज़िला विधिक सेवा प्राधिकरण (मुफ़्त कानूनी सहायता, NALSA हेल्पलाइन 15100) से संपर्क करें।",
      hinglish: "Ye landlord–tenant ka issue lagta hai. NyayaAI abhi sirf consumer disputes ko detail mein cover karta hai. Tenancy law har state mein alag hai, aur central Model Tenancy Act, 2021 sirf wahan lagu hai jahan state ne use adopt kiya ho. Maine aapke state ka law verify nahi kiya hai, isliye main uske baare mein claim nahi karunga. Rent agreement, deposit ki receipt/bank proof, rent receipts aur landlord ke saare messages sambhal ke rakhiye. Agar aapko zabardasti nikala ja raha hai ya dhamki mil rahi hai, to turant police (112) aur District Legal Services Authority (free legal aid, NALSA helpline 15100) se contact kijiye.",
    },
    evidence: ["Rent agreement", "Deposit receipt / bank transfer proof", "Rent receipts", "Messages with landlord", "Move-out date and handover proof (photos of the flat, key return)"],
    evidence_hi: ["किराया अनुबंध", "जमा राशि की रसीद / बैंक ट्रांसफ़र का प्रमाण", "किराया रसीदें", "मकान-मालिक के साथ संदेश", "घर खाली करने की तारीख और सौंपने का प्रमाण (फ़्लैट की फ़ोटो, चाबी वापसी)"],
    referrals: ["District Legal Services Authority – NALSA helpline 15100", "Police – 112 (if locked out, threatened or forcibly evicted)"],
  },
  employment: {
    title: "Employment (unpaid salary) – not covered in depth yet",
    reply: {
      en: "This sounds like an employment / unpaid salary issue. NyayaAI does not yet give employment-law advice. Indian wage law has recently changed: the four Labour Codes, including the Code on Wages, 2019, have been brought into force, replacing older laws such as the Payment of Wages Act, 1936, and new Central and State rules apply. I have not verified those provisions, so I won't cite them. What usually helps: keep your appointment letter, salary slips, bank statements showing past salary credits, attendance records and emails about the unpaid salary. You can approach the Labour Department / labour authority in your area, and free legal aid is available through your District Legal Services Authority (NALSA helpline 15100).",
      hi: "यह रोज़गार / बकाया वेतन का मामला लगता है। NyayaAI अभी रोज़गार कानून पर सलाह नहीं देता। भारत में वेतन कानून हाल में बदले हैं: चारों लेबर कोड, जिनमें वेतन संहिता, 2019 (Code on Wages) शामिल है, लागू किए गए हैं और ये वेतन भुगतान अधिनियम, 1936 जैसे पुराने कानूनों की जगह लेते हैं; नए केंद्रीय और राज्य नियम भी लागू होते हैं। मैंने इन प्रावधानों को सत्यापित नहीं किया है, इसलिए मैं उनका हवाला नहीं दूँगा। नियुक्ति पत्र, सैलरी स्लिप, पिछले वेतन वाले बैंक स्टेटमेंट, हाज़िरी रिकॉर्ड और बकाया वेतन से जुड़े ईमेल संभालकर रखें। आप अपने क्षेत्र के श्रम विभाग से संपर्क कर सकते हैं, और ज़िला विधिक सेवा प्राधिकरण (NALSA हेल्पलाइन 15100) से मुफ़्त कानूनी सहायता मिल सकती है।",
      hinglish: "Ye employment / unpaid salary ka issue lagta hai. NyayaAI abhi employment law par advice nahi deta. India mein wage law recently badla hai: chaaron Labour Codes, jisme Code on Wages, 2019 bhi hai, lagu kiye gaye hain aur ye Payment of Wages Act, 1936 jaise purane laws ki jagah lete hain; naye Central aur State rules bhi lagu hain. Maine ye provisions verify nahi kiye hain, isliye main inka reference nahi dunga. Appointment letter, salary slips, purani salary ke bank statements, attendance records aur unpaid salary wale emails sambhal ke rakhiye. Aap apne area ke Labour Department se contact kar sakte ho, aur District Legal Services Authority (NALSA helpline 15100) se free legal aid mil sakti hai.",
    },
    evidence: ["Appointment / offer letter", "Salary slips", "Bank statements showing salary credits", "Attendance records", "Emails/messages about unpaid salary"],
    evidence_hi: ["नियुक्ति / ऑफ़र लेटर", "सैलरी स्लिप", "पिछले वेतन वाले बैंक स्टेटमेंट", "हाज़िरी रिकॉर्ड", "बकाया वेतन से जुड़े ईमेल / संदेश"],
    referrals: ["Labour Department / labour authority in your area", "District Legal Services Authority – NALSA helpline 15100"],
  },
  out_of_scope: {
    title: "Outside what NyayaAI covers",
    reply: {
      en: "This looks outside what NyayaAI covers. It only handles consumer disputes (refunds, defective products, poor service) in depth. For this issue please speak to a lawyer; free legal aid is available through your District Legal Services Authority (NALSA helpline 15100). If anyone is in danger, call 112.",
      hi: "यह मामला NyayaAI के दायरे से बाहर लगता है। यह केवल उपभोक्ता विवाद (रिफंड, खराब सामान, खराब सेवा) को विस्तार से देखता है। कृपया किसी वकील से बात करें; ज़िला विधिक सेवा प्राधिकरण (NALSA हेल्पलाइन 15100) से मुफ़्त कानूनी सहायता मिल सकती है। अगर किसी को खतरा है, तो 112 पर कॉल करें।",
      hinglish: "Ye issue NyayaAI ke scope se bahar lagta hai. Ye sirf consumer disputes (refund, kharab product, kharab service) detail mein dekhta hai. Please kisi lawyer se baat kijiye; District Legal Services Authority (NALSA helpline 15100) se free legal aid mil sakti hai. Agar kisi ko khatra hai, to 112 call kijiye.",
    },
    evidence: [],
    evidence_hi: [],
    referrals: ["District Legal Services Authority – NALSA helpline 15100", "Emergency – 112"],
  },
};
