import type { ZodType } from "zod";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateJSONOptions<T> {
  system: string;
  messages: LLMMessage[];
  schema: ZodType<T>;
  temperature?: number;
  /** Reasoning effort hint. Providers map it to their own setting and ignore it if unsupported. */
  effort?: "minimal" | "low" | "high";
}

export interface GenerateJSONResult<T> {
  data: T;
  raw: string; // raw model text, kept for evaluation transparency
  attempts: number;
}

/** Any model provider must implement only this. Swap providers by adding one file + one factory branch. */
export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generateJSON<T>(opts: GenerateJSONOptions<T>): Promise<GenerateJSONResult<T>>;
}

export class LLMNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMNotConfiguredError";
  }
}

export class LLMOutputError extends Error {
  constructor(
    message: string,
    public raw: string,
  ) {
    super(message);
    this.name = "LLMOutputError";
  }
}
