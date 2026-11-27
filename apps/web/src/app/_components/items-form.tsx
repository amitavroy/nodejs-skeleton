"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiRequestError } from "@/api";

// Mirrors the API's createItem schema (apps/server). The API still validates: its 422 details are shown below.
const itemFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "At most 100 characters"),
});
type ItemFormValues = z.infer<typeof itemFormSchema>;

/** Create-item form: client validation with Zod, server 422 `details` mapped onto the matching field. */
export function ItemsForm() {
  const qc = useQueryClient();
  const form = useForm<ItemFormValues>({ resolver: zodResolver(itemFormSchema), defaultValues: { name: "" } });

  const create = useMutation({
    mutationFn: api.createItem,
    onSuccess: () => {
      form.reset();
      return qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.body.details?.length) {
        for (const d of error.body.details) {
          if (d.path === "name") form.setError("name", { message: d.message });
          else form.setError("root", { message: d.message });
        }
        return;
      }
      form.setError("root", { message: error.message || "Could not create the item." });
    },
  });

  return (
    <form onSubmit={form.handleSubmit((values) => create.mutate(values))} noValidate>
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="item-name">New item</FieldLabel>
            <div className="flex gap-2">
              <Input {...field} id="item-name" placeholder="Item name" aria-invalid={fieldState.invalid} />
              <Button type="submit" disabled={create.isPending}>
                Add
              </Button>
            </div>
            <FieldError errors={[fieldState.error, form.formState.errors.root]} />
          </Field>
        )}
      />
    </form>
  );
}
