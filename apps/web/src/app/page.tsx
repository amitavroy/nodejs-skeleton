import { ItemsPanel } from "./items-panel";

export default function Page() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">__APP_NAME__</h1>
      <ItemsPanel />
    </main>
  );
}
