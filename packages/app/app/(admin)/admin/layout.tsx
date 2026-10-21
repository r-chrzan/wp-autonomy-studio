import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: {
    default: "Admin · WP Autonomy Studio",
    template: "%s · Admin · WP Autonomy Studio",
  },
};

/** Root layout for backend (admin) pages. Styling: shadcn/ui. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
