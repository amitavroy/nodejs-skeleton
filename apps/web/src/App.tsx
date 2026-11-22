import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "./api";

/** Example screen: loading / error / empty states, a form, and a mutation. */
export function App() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const items = useQuery({ queryKey: ["items"], queryFn: api.listItems });

  const refresh = () => qc.invalidateQueries({ queryKey: ["items"] });
  const create = useMutation({
    mutationFn: api.createItem,
    onSuccess: () => {
      setName("");
      return refresh();
    },
  });
  const remove = useMutation({ mutationFn: api.deleteItem, onSuccess: refresh });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ name });
  };

  const fieldError =
    create.error instanceof ApiRequestError
      ? create.error.body.details?.find((d) => d.path === "name")?.message
      : undefined;

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">__APP_NAME__</h1>

      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New item"
          className="flex-1 rounded border border-neutral-300 px-3 py-2"
        />
        <button
          disabled={create.isPending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {fieldError && <p className="mt-1 text-sm text-red-600">{fieldError}</p>}

      <section className="mt-6">
        {items.isPending && <p className="text-neutral-500">Loading…</p>}
        {items.isError && <p className="text-red-600">Could not load items.</p>}
        {items.data?.data.length === 0 && <p className="text-neutral-500">No items yet.</p>}
        <ul className="divide-y">
          {items.data?.data.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2">
              <span>{item.name}</span>
              <button
                onClick={() => remove.mutate(item.id)}
                className="text-sm text-neutral-500 hover:text-red-600"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
