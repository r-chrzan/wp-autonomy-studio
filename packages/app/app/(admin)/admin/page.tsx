import Link from "next/link";
import { Button } from "@wpas/ui/admin/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wpas/ui/admin/card";

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Backend pages are styled with shadcn/ui.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild>
            <Link href="/">Back to site</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/health">Health check</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
