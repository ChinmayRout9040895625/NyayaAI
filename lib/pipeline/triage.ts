/** Deterministic safety triage. Runs before any model call; never depends on the LLM. */

export type TriageLevel = "none" | "serious" | "urgent";

export interface Helpline {
  name: string;
  number: string;
  url?: string;
}

export interface TriageResult {
  level: TriageLevel;
  reasons: string[];
  helplines: Helpline[];
}

const H = {
  emergency: { name: "Emergency (police / ambulance)", number: "112" },
  nalsa: { name: "Free legal aid – NALSA / District Legal Services Authority", number: "15100", url: "https://nalsa.gov.in" },
  women: { name: "Women helpline", number: "181" },
  telemanas: { name: "Tele-MANAS mental health support", number: "14416" },
} satisfies Record<string, Helpline>;

interface Rule {
  level: Exclude<TriageLevel, "none">;
  reason: string;
  re: RegExp | ((text: string) => boolean);
  helplines: Helpline[];
}

const RULES: Rule[] = [
  {
    level: "urgent",
    reason: "Possible risk of self-harm",
    re: /\b(suicide|kill myself|end my life|want to die|aatmahatya|marna chahta|marna chahti)\b|आत्महत्या/i,
    helplines: [H.telemanas, H.emergency],
  },
  {
    level: "urgent",
    reason: "Threats or violence mentioned",
    re: /\b(threat(en)?(ed|ing|s)?|dhamki|beat(en)?|assault(ed)?|attack(ed)?|hit me|weapon|knife|goons?|maar(a|ne|enge|pit)?)\b|धमकी|मारपीट|मारने/i,
    helplines: [H.emergency, H.nalsa],
  },
  {
    level: "urgent",
    reason: "Domestic violence mentioned",
    re: /\b(domestic violence|husband (beats|hits)|pati maar)/i,
    helplines: [H.women, H.emergency, H.nalsa],
  },
  {
    level: "urgent",
    reason: "Forced eviction / lock-out happening or imminent",
    re: /\b(locked (me|us) out|changed the locks?|lock badal|thr(own|ew|ow) (me|us|our)[\w ]{0,20} out|nikal (diya|denge|rahe|raha)|ghar (se )?(bahar|khali))\b|घर से निकाल|ताला बदल/i,
    helplines: [H.emergency, H.nalsa],
  },
  {
    level: "urgent",
    reason: "Court hearing, summons or legal deadline mentioned",
    re: /\b(hearing (is )?(tomorrow|today|this week|on)|court (date|summons|notice)|summons|warrant|kal (court|hearing)|peshi)\b|समन|पेशी/i,
    helplines: [H.nalsa],
  },
  {
    level: "serious",
    reason: "Police / criminal law mentioned – outside NyayaAI's scope",
    // "fir" in Hinglish usually means "then", so FIR needs capitals or a filing verb; "420" needs a legal prefix.
    re: (t) =>
      /\bFIR\b/.test(t) ||
      /\b(file|lodge|register|darj)\w* (an? )?fir\b|\bfir (darj|file|lodge|register)|\b(police (complaint|station|case)|arrest(ed)?|giraftar|jail|ipc|bns|cheating case)\b|\b(ipc|section|sec\.?|dhara)\s*420\b|गिरफ्तार|एफआईआर/i.test(t),
    helplines: [H.nalsa],
  },
];

export function triage(text: string): TriageResult {
  const reasons: string[] = [];
  const helplines: Helpline[] = [];
  let level: TriageLevel = "none";
  for (const r of RULES) {
    if (typeof r.re === "function" ? r.re(text) : r.re.test(text)) {
      reasons.push(r.reason);
      for (const h of r.helplines) if (!helplines.some((x) => x.number === h.number)) helplines.push(h);
      if (r.level === "urgent") level = "urgent";
      else if (level === "none") level = "serious";
    }
  }
  return { level, reasons, helplines };
}
