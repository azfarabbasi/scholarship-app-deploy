import type { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/env";

export const SITE_NAME = "ScholarTrack";
/** Reuses the existing PWA icon as a placeholder social-share image — a dedicated 1200×630 OG image is a documented future improvement, not built this checkpoint. */
export const DEFAULT_OG_IMAGE = "/icon-512.png";

export interface BuildMetadataOptions {
  title: string;
  description: string;
  /** Site-relative path, e.g. "/opportunities" or "/opportunities/some-slug". */
  path: string;
  /** Defaults to "website"; use "article" for content/policy pages. */
  ogType?: "website" | "article";
}

/**
 * Every public page builds its Open Graph/Twitter metadata through this one
 * helper rather than relying on Next's metadata inheritance — nested
 * metadata fields like `openGraph` are replaced wholesale by a child
 * segment that defines them at all, not deep-merged, so partial per-page
 * overrides would silently drop the parent's image/site name. See
 * `docs/checkpoint-6/seo-and-content-strategy.md`.
 */
export interface BreadcrumbItem {
  name: string;
  path: string;
}

/** Builds a schema.org BreadcrumbList JSON-LD payload — pass the result to `<JsonLd data={...} />`. */
export function buildBreadcrumbList(items: BreadcrumbItem[]): object {
  const baseUrl = getAppBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.path}`,
    })),
  };
}

export function buildMetadata({ title, description, path, ogType = "website" }: BuildMetadataOptions): Metadata {
  const url = `${getAppBaseUrl()}${path}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: ogType,
      images: [{ url: DEFAULT_OG_IMAGE, width: 512, height: 512 }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}
