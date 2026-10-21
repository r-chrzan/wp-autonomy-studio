import Link from "next/link";
import { Hero } from "@wpas/ui/site/hero";

export default function HomePage() {
  return (
    <main>
      <Hero
        title="WP Autonomy Studio"
        description="Frontend pages are styled with DaisyUI."
        actions={
          <Link href="/admin" className="btn btn-primary">
            Open admin
          </Link>
        }
      />
      <footer className="footer footer-center p-6 text-sm">
        <Link href="/api/health" className="link" prefetch={false}>
          Health check
        </Link>
      </footer>
    </main>
  );
}
