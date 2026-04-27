import type { BlockType } from "../types.js";

// ─── Field Schema ─────────────────────────────────────────────────────────────

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "select" | "toggle" | "number" | "json-array";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  /** For json-array: schema of each item's sub-fields */
  itemFields?: FieldDef[];
}

// ─── Block Definition ─────────────────────────────────────────────────────────

export interface BlockDef {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  category: "core" | "general";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultConfig: Record<string, any>;
  fields: FieldDef[];
}

// ─── Shared Fields ────────────────────────────────────────────────────────────

const THEME_FIELD: FieldDef = {
  key: "theme",
  label: "Theme",
  type: "select",
  options: [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "accent", label: "Accent" },
  ],
};

// ─── Block Definitions ────────────────────────────────────────────────────────

export const BLOCK_DEFINITIONS: BlockDef[] = [
  {
    type: "testimonials",
    label: "Testimonials",
    icon: "💬",
    description: "Customer testimonials and reviews",
    category: "general",
    defaultConfig: {
      layout: "grid",
      theme: "light",
      items: [],
    },
    fields: [
      { key: "headline", label: "Section Headline", type: "text", placeholder: "What Our Customers Say" },
      {
        key: "layout",
        label: "Layout",
        type: "select",
        options: [
          { value: "grid", label: "Grid" },
          { value: "carousel", label: "Carousel" },
        ],
      },
      {
        key: "items",
        label: "Testimonials",
        type: "json-array",
        itemFields: [
          { key: "quote", label: "Quote", type: "textarea", placeholder: "The testimonial text..." },
          { key: "author", label: "Author Name", type: "text", placeholder: "John Doe" },
          { key: "role", label: "Role / Title", type: "text", placeholder: "CEO" },
          { key: "company", label: "Company", type: "text", placeholder: "Acme Corp" },
          { key: "avatarUrl", label: "Avatar URL", type: "url", placeholder: "https://..." },
        ],
      },
      THEME_FIELD,
    ],
  },

  {
    type: "faq",
    label: "FAQ Section",
    icon: "❓",
    description: "Frequently asked questions with accordion",
    category: "general",
    defaultConfig: {
      theme: "light",
      items: [],
    },
    fields: [
      { key: "headline", label: "Section Headline", type: "text", placeholder: "Frequently Asked Questions" },
      { key: "subheadline", label: "Section Subheadline", type: "textarea", placeholder: "Supporting text..." },
      {
        key: "items",
        label: "Questions",
        type: "json-array",
        itemFields: [
          { key: "question", label: "Question", type: "text", placeholder: "What is...?" },
          { key: "answer", label: "Answer", type: "textarea", placeholder: "The answer is..." },
        ],
      },
      THEME_FIELD,
    ],
  },

  {
    type: "pricing",
    label: "Pricing Table",
    icon: "💰",
    description: "Pricing tiers with feature lists",
    category: "general",
    defaultConfig: {
      theme: "light",
      tiers: [],
    },
    fields: [
      { key: "headline", label: "Section Headline", type: "text", placeholder: "Simple Pricing" },
      { key: "subheadline", label: "Section Subheadline", type: "textarea", placeholder: "Supporting text..." },
      {
        key: "tiers",
        label: "Pricing Tiers",
        type: "json-array",
        itemFields: [
          { key: "name", label: "Tier Name", type: "text", placeholder: "Pro" },
          { key: "price", label: "Price", type: "text", placeholder: "$49" },
          { key: "period", label: "Period", type: "text", placeholder: "/month" },
          { key: "description", label: "Description", type: "textarea", placeholder: "For growing teams" },
          { key: "features", label: "Features (one per line)", type: "textarea", placeholder: "Feature 1\nFeature 2\nFeature 3" },
          { key: "ctaLabel", label: "CTA Label", type: "text", placeholder: "Get Started" },
          { key: "ctaUrl", label: "CTA URL", type: "url", placeholder: "https://..." },
          { key: "highlighted", label: "Highlighted (recommended)", type: "toggle" },
        ],
      },
      THEME_FIELD,
    ],
  },

  {
    type: "container",
    label: "Container",
    icon: "📦",
    description: "Wrapper block that can contain other blocks",
    category: "core",
    defaultConfig: {
      background: "white",
      paddingTop: "lg",
      paddingBottom: "lg",
      theme: "light",
    },
    fields: [
      {
        key: "background",
        label: "Background",
        type: "select",
        options: [
          { value: "transparent", label: "Transparent" },
          { value: "white", label: "White" },
          { value: "light-gray", label: "Light Gray" },
          { value: "dark", label: "Dark" },
          { value: "accent", label: "Accent Blue" },
        ],
      },
      {
        key: "paddingTop",
        label: "Padding Top",
        type: "select",
        options: [
          { value: "none", label: "None" },
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "xl", label: "Extra Large" },
        ],
      },
      {
        key: "paddingBottom",
        label: "Padding Bottom",
        type: "select",
        options: [
          { value: "none", label: "None" },
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "xl", label: "Extra Large" },
        ],
      },
      THEME_FIELD,
    ],
  },

  {
    type: "spacer",
    label: "Spacer",
    icon: "↕️",
    description: "Vertical spacing or divider line",
    category: "core",
    defaultConfig: {
      height: "md",
      showDivider: false,
    },
    fields: [
      {
        key: "height",
        label: "Height",
        type: "select",
        options: [
          { value: "sm", label: "Small (32px)" },
          { value: "md", label: "Medium (64px)" },
          { value: "lg", label: "Large (96px)" },
          { value: "xl", label: "Extra Large (128px)" },
        ],
      },
      { key: "showDivider", label: "Show Divider Line", type: "toggle" },
    ],
  },
];

export function getBlockDef(type: BlockType): BlockDef | undefined {
  return BLOCK_DEFINITIONS.find((d) => d.type === type);
}
