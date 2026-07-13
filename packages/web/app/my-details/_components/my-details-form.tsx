"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AddressSchema, type AddressInput } from "@marketplace/core";
import type { AddressDetails } from "@marketplace/core";
import { saveAddress } from "@/lib/api";
import { AddressForm } from "@/app/checkout/_components";
import { Button } from "@/components/ui/button";

export function MyDetailsForm({
  savedAddress,
}: {
  savedAddress: AddressDetails | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressInput>({
    resolver: zodResolver(AddressSchema),
    defaultValues: savedAddress ?? undefined,
  });

  async function onSubmit(values: AddressInput) {
    setSubmitting(true);
    setFormError(null);
    setSaved(false);

    try {
      await saveAddress(values);
      setSaved(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      aria-label="My details form"
      noValidate
      className="max-w-2xl"
    >
      <h1 className="text-2xl">My Details</h1>

      <AddressForm register={register} errors={errors} />

      <div className="mt-8 flex items-center justify-between border-t-2 border-primary pt-4">
        <Button type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </div>

      {saved && (
        <p role="status" className="mt-4 text-sm text-secondary">
          Address saved
        </p>
      )}
      {formError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {formError}
        </p>
      )}
    </form>
  );
}
