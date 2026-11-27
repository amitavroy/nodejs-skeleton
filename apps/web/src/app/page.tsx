import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemsForm } from "./_components/items-form";
import { ItemsTable } from "./_components/items-table";

/** Thin page: composes its components from ./_components (a private folder, not a route). */
export default function Page() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">__APP_NAME__</h1>
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>Example resource: replace it with your own feature.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ItemsForm />
          <ItemsTable />
        </CardContent>
      </Card>
    </main>
  );
}
