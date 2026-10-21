import type { Metadata } from "next";
import "./site.css";

export const metadata: Metadata = {
  title: "WP Autonomy Studio",
  description: "WP Autonomy Studio",
};

/** Root layout for frontend (public) pages. Styling: DaisyUI. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base-100 text-base-content antialiased">{children}</body>
    </html>
  );
}
