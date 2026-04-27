// ─── Block Types ──────────────────────────────────────────────────────────────

export type BlockType =
  | "hero"
  | "features-grid"
  | "image-text"
  | "cta"
  | "testimonials"
  | "stats"
  | "faq"
  | "pricing"
  | "gallery"
  | "video"
  | "columns"
  | "section"
  | "spacer"
  | "container";

/** Block types that can contain other blocks */
export const CONTAINER_TYPES: BlockType[] = ["container", "columns"];

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
  /** Slotted children — for type === "columns" (slots[0] = col1, slots[1] = col2, ...) */
  slots?: SectionBlock[][];
}

// ─── Page Layout ──────────────────────────────────────────────────────────────

export interface PageLayout {
  sections: SectionBlock[];
  updatedAt: string;
}

// ─── Block Config Interfaces ──────────────────────────────────────────────────

export interface HeroConfig {
  headline: string;
  subheadline?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  backgroundImageUrl?: string;
  layout?: "center" | "left" | "split";
  theme?: "light" | "dark" | "accent";
  paddingTop?: "none" | "sm" | "md" | "lg" | "xl";
  paddingBottom?: "none" | "sm" | "md" | "lg" | "xl";
}

export interface FeatureItem {
  icon: string;
  title: string;
  body: string;
}

export interface FeaturesGridConfig {
  headline?: string;
  subheadline?: string;
  columns?: "2" | "3" | "4";
  theme?: "light" | "dark" | "accent";
  items: FeatureItem[];
}

export interface ImageTextConfig {
  imageUrl: string;
  imageAlt?: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  layout?: "image-left" | "image-right";
  theme?: "light" | "dark" | "accent";
}

export interface CtaConfig {
  headline: string;
  body?: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  theme?: "light" | "dark" | "accent";
}

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

export interface StatItem {
  value: string;
  label: string;
}

export interface StatsConfig {
  headline?: string;
  theme?: "light" | "dark" | "accent";
  items: StatItem[];
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

export interface GalleryImage {
  url: string;
  alt: string;
  caption?: string;
}

export interface GalleryConfig {
  headline?: string;
  columns?: "2" | "3" | "4";
  theme?: "light" | "dark" | "accent";
  images: GalleryImage[];
}

export interface VideoConfig {
  url: string;
  caption?: string;
  autoplay?: boolean;
  theme?: "light" | "dark" | "accent";
}

export interface ColumnsConfig {
  columns?: "2" | "3";
  theme?: "light" | "dark" | "accent";
  /** @deprecated Use slots[] instead */
  col1Content?: string;
  /** @deprecated Use slots[] instead */
  col2Content?: string;
  /** @deprecated Use slots[] instead */
  col3Content?: string;
}

export interface SectionConfig {
  background?: "transparent" | "white" | "light-gray" | "dark" | "accent";
  paddingTop?: "none" | "sm" | "md" | "lg" | "xl";
  paddingBottom?: "none" | "sm" | "md" | "lg" | "xl";
  theme?: "light" | "dark" | "accent";
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

export function getEmbedUrl(url: string): string {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}
