import { ALL_SLUGS } from "@/lib/api";
import MarketDetail from "@/components/MarketDetail";

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }));
}

export default async function MarketPage({
  params,
}: PageProps<"/markets/[slug]">) {
  // Built-in slugs are prerendered; user-added tickers resolve dynamically and
  // are validated by the backend (MarketDetail shows an error if not found).
  const { slug } = await params;
  return <MarketDetail slug={slug} />;
}
