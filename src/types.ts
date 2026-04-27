// ─── Block Types ──────────────────────────────────────────────────────────────

export type BlockType =
  | "testimonials"
  | "faq"
  | "pricing"
  | "spacer"
  | "container";

/** Block types that can contain other blocks */
export const CONTAINER_TYPES: BlockType[] = ["container"];

export function isContainerType(type: BlockType): boolean {
  return CONTAINER_TYPES.includes(type);
}

// ─── Section Block (stored in layout) ─────────────────────────────────────────

export interface SectionBlock {
  id: string;
  type: BlockType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>;
  /** Children blocks — for type === "container" */
  children?: SectionBlock[];
  /** Slotted children — slots[0] = col1, slots[1] = col2, ... */
  slots?: SectionBlock[][];
}

// ─── Page Layout ──────────────────────────────────────────────────────────────

export interface PageLayout {
  sections: SectionBlock[];
  updatedAt: string;
}

// ─── Block Config Interfaces ──────────────────────────────────────────────────

export interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatarUrl?: string;
}

export interface TestimonialsConfig {
  headline?: string;
  layout?: "grid" | "carousel";
  theme?: "light" | "dark" | "accent";
  items: TestimonialItem[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqConfig {
  headline?: string;
  subheadline?: string;
  theme?: "light" | "dark" | "accent";
  items: FaqItem[];
}

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string;
  ctaLabel: string;
  ctaUrl: string;
  highlighted?: boolean;
}

export interface PricingConfig {
  headline?: string;
  subheadline?: string;
  theme?: "light" | "dark" | "accent";
  tiers: PricingTier[];
}

export interface SpacerConfig {
  height?: "sm" | "md" | "lg" | "xl";
  showDivider?: boolean;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

export function parseItems<T>(json: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(json)) return json as T[];
  if (typeof json === "string") {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

