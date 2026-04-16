import HeroSection from "./HeroSection.astro";
import FeaturesGrid from "./FeaturesGrid.astro";
import ImageText from "./ImageText.astro";
import CtaSection from "./CtaSection.astro";
import Testimonials from "./Testimonials.astro";
import StatsSection from "./StatsSection.astro";
import FaqSection from "./FaqSection.astro";
import PricingSection from "./PricingSection.astro";
import GallerySection from "./GallerySection.astro";
import VideoSection from "./VideoSection.astro";
import ColumnsSection from "./ColumnsSection.astro";
import SpacerSection from "./SpacerSection.astro";

export const blockComponents: Record<string, unknown> = {
  hero: HeroSection,
  "features-grid": FeaturesGrid,
  "image-text": ImageText,
  cta: CtaSection,
  testimonials: Testimonials,
  stats: StatsSection,
  faq: FaqSection,
  pricing: PricingSection,
  gallery: GallerySection,
  video: VideoSection,
  columns: ColumnsSection,
  spacer: SpacerSection,
};
