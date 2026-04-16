import type React from "react";
import type { BlockType, SectionBlock } from "../../types.js";
import { HeroPreview } from "./HeroPreview.js";
import { FeaturesGridPreview } from "./FeaturesGridPreview.js";
import { ImageTextPreview } from "./ImageTextPreview.js";
import { CtaPreview } from "./CtaPreview.js";
import { TestimonialsPreview } from "./TestimonialsPreview.js";
import { StatsPreview } from "./StatsPreview.js";
import { FaqPreview } from "./FaqPreview.js";
import { PricingPreview } from "./PricingPreview.js";
import { GalleryPreview } from "./GalleryPreview.js";
import { VideoPreview } from "./VideoPreview.js";
import { ColumnsPreview } from "./ColumnsPreview.js";
import { SectionPreview } from "./SectionPreview.js";
import { SpacerPreview } from "./SpacerPreview.js";

export interface PreviewProps {
  config: Record<string, any>;
  children?: SectionBlock[];
  slots?: SectionBlock[][];
}

export const PREVIEW_COMPONENTS: Record<BlockType, React.ComponentType<PreviewProps>> = {
  hero: HeroPreview as React.ComponentType<PreviewProps>,
  "features-grid": FeaturesGridPreview as React.ComponentType<PreviewProps>,
  "image-text": ImageTextPreview as React.ComponentType<PreviewProps>,
  cta: CtaPreview as React.ComponentType<PreviewProps>,
  testimonials: TestimonialsPreview as React.ComponentType<PreviewProps>,
  stats: StatsPreview as React.ComponentType<PreviewProps>,
  faq: FaqPreview as React.ComponentType<PreviewProps>,
  pricing: PricingPreview as React.ComponentType<PreviewProps>,
  gallery: GalleryPreview as React.ComponentType<PreviewProps>,
  video: VideoPreview as React.ComponentType<PreviewProps>,
  columns: ColumnsPreview as React.ComponentType<PreviewProps>,
  section: SectionPreview as React.ComponentType<PreviewProps>,
  spacer: SpacerPreview as React.ComponentType<PreviewProps>,
};
