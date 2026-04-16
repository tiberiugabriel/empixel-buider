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
    type: "hero",
    label: "Hero Section",
    icon: "🦸",
    description: "Full-width hero with headline, subheadline, and CTA buttons",
    defaultConfig: {
      headline: "Your Headline Here",
      layout: "center",
      theme: "light",
    },
    fields: [
      { key: "headline", label: "Headline", type: "text", required: true, placeholder: "Your big headline..." },
      { key: "subheadline", label: "Subheadline", type: "textarea", placeholder: "Supporting text..." },
      { key: "ctaLabel", label: "Primary CTA Label", type: "text", placeholder: "Get Started" },
      { key: "ctaUrl", label: "Primary CTA URL", type: "url", placeholder: "https://..." },
      { key: "ctaSecondaryLabel", label: "Secondary CTA Label", type: "text", placeholder: "Learn More" },
      { key: "ctaSecondaryUrl", label: "Secondary CTA URL", type: "url", placeholder: "https://..." },
      { key: "backgroundImageUrl", label: "Background Image URL", type: "url", placeholder: "https://..." },
      {
        key: "layout",
        label: "Layout",
        type: "select",
        options: [
          { value: "center", label: "Centered" },
          { value: "left", label: "Left Aligned" },
          { value: "split", label: "Split (image + text)" },
        ],
      },
      THEME_FIELD,
    ],
  },

  {
    type: "features-grid",
    label: "Features Grid",
    icon: "✨",
    description: "Grid of feature cards with icon, title, and description",
    defaultConfig: {
      columns: "3",
      theme: "light",
      items: [],
    },
    fields: [
      { key: "headline", label: "Section Headline", type: "text", placeholder: "Why Choose Us" },
      { key: "subheadline", label: "Section Subheadline", type: "textarea", placeholder: "Supporting text..." },
      {
        key: "columns",
        label: "Columns",
        type: "select",
        options: [
          { value: "2", label: "2 Columns" },
          { value: "3", label: "3 Columns" },
          { value: "4", label: "4 Columns" },
        ],
      },
      {
        key: "items",
        label: "Features",
        type: "json-array",
        itemFields: [
          { key: "icon", label: "Icon (emoji or URL)", type: "text", placeholder: "⚡" },
          { key: "title", label: "Title", type: "text", placeholder: "Feature name" },
          { key: "body", label: "Description", type: "textarea", placeholder: "Short description..." },
        ],
      },
      THEME_FIELD,
    ],
  },

  {
    type: "image-text",
    label: "Image + Text",
    icon: "🖼️",
    description: "Side-by-side image and text content",
    defaultConfig: {
      layout: "image-left",
      theme: "light",
    },
    fields: [
      { key: "imageUrl", label: "Image URL", type: "url", required: true, placeholder: "https://..." },
      { key: "imageAlt", label: "Image Alt Text", type: "text", placeholder: "Descriptive alt text" },
      { key: "headline", label: "Headline", type: "text", required: true, placeholder: "Section headline" },
      { key: "body", label: "Body Text", type: "textarea", placeholder: "Paragraph text..." },
      { key: "ctaLabel", label: "CTA Label", type: "text", placeholder: "Learn More" },
      { key: "ctaUrl", label: "CTA URL", type: "url", placeholder: "https://..." },
      {
        key: "layout",
        label: "Image Position",
        type: "select",
        options: [
          { value: "image-left", label: "Image Left" },
          { value: "image-right", label: "Image Right" },
        ],
      },
      THEME_FIELD,
    ],
  },

  {
    type: "cta",
    label: "CTA Section",
    icon: "📣",
    description: "Centered call-to-action with headline and buttons",
    defaultConfig: {
      ctaLabel: "Get Started",
      ctaUrl: "#",
      theme: "accent",
    },
    fields: [
      { key: "headline", label: "Headline", type: "text", required: true, placeholder: "Ready to get started?" },
      { key: "body", label: "Body Text", type: "textarea", placeholder: "Supporting text..." },
      { key: "ctaLabel", label: "Primary CTA Label", type: "text", required: true, placeholder: "Get Started" },
      { key: "ctaUrl", label: "Primary CTA URL", type: "url", required: true, placeholder: "https://..." },
      { key: "ctaSecondaryLabel", label: "Secondary CTA Label", type: "text", placeholder: "Learn More" },
      { key: "ctaSecondaryUrl", label: "Secondary CTA URL", type: "url", placeholder: "https://..." },
      THEME_FIELD,
    ],
  },

  {
    type: "testimonials",
    label: "Testimonials",
    icon: "💬",
    description: "Customer testimonials and reviews",
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
    type: "stats",
    label: "Stats Section",
    icon: "📊",
    description: "Large numbers and metrics with labels",
    defaultConfig: {
      theme: "light",
      items: [],
    },
    fields: [
      { key: "headline", label: "Section Headline", type: "text", placeholder: "Our Numbers" },
      {
        key: "items",
        label: "Stats",
        type: "json-array",
        itemFields: [
          { key: "value", label: "Value", type: "text", placeholder: "10k+" },
          { key: "label", label: "Label", type: "text", placeholder: "Happy Customers" },
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
    type: "gallery",
    label: "Gallery",
    icon: "🖼️",
    description: "Image grid gallery",
    defaultConfig: {
      columns: "3",
      theme: "light",
      images: [],
    },
    fields: [
      { key: "headline", label: "Section Headline", type: "text", placeholder: "Our Gallery" },
      {
        key: "columns",
        label: "Columns",
        type: "select",
        options: [
          { value: "2", label: "2 Columns" },
          { value: "3", label: "3 Columns" },
          { value: "4", label: "4 Columns" },
        ],
      },
      {
        key: "images",
        label: "Images",
        type: "json-array",
        itemFields: [
          { key: "url", label: "Image URL", type: "url", placeholder: "https://..." },
          { key: "alt", label: "Alt Text", type: "text", placeholder: "Descriptive alt text" },
          { key: "caption", label: "Caption (optional)", type: "text", placeholder: "Image caption" },
        ],
      },
      THEME_FIELD,
    ],
  },

  {
    type: "video",
    label: "Video Section",
    icon: "▶️",
    description: "Embedded video (YouTube or Vimeo)",
    defaultConfig: {
      theme: "light",
    },
    fields: [
      { key: "url", label: "Video URL", type: "url", required: true, placeholder: "https://youtube.com/watch?v=..." },
      { key: "caption", label: "Caption", type: "text", placeholder: "Optional caption below video" },
      { key: "autoplay", label: "Autoplay (muted)", type: "toggle" },
      THEME_FIELD,
    ],
  },

  {
    type: "columns",
    label: "Columns",
    icon: "📐",
    description: "Multi-column text layout",
    defaultConfig: {
      columns: "2",
      theme: "light",
      col1Content: "",
      col2Content: "",
    },
    fields: [
      {
        key: "columns",
        label: "Number of Columns",
        type: "select",
        options: [
          { value: "2", label: "2 Columns" },
          { value: "3", label: "3 Columns" },
        ],
      },
      { key: "col1Content", label: "Column 1 Content", type: "textarea", placeholder: "Text for column 1..." },
      { key: "col2Content", label: "Column 2 Content", type: "textarea", placeholder: "Text for column 2..." },
      { key: "col3Content", label: "Column 3 Content (if 3 cols)", type: "textarea", placeholder: "Text for column 3..." },
      THEME_FIELD,
    ],
  },

  {
    type: "section",
    label: "Section Container",
    icon: "📦",
    description: "Wrapper block that can contain other blocks",
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
