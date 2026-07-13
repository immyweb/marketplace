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
  const [hasAddress, setHasAddress] = useState(savedAddress !== null);

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
      setHasAddress(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Account Record
          </p>
          <h1 className="mt-1 text-2xl">My Details</h1>
        </div>
        <div
          aria-hidden="true"
          className="-rotate-6 shrink-0 rounded-sm border-2 border-secondary px-3 py-1 font-mono text-xs font-bold tracking-widest text-secondary uppercase"
        >
          {hasAddress ? "On File" : "Not On File"}
        </div>
      </div>
      <p className="mt-3 max-w-md text-muted-foreground">
        {hasAddress
          ? "This is the address we'll use for your next order. Update it any time."
          : "Add a delivery address and we'll have it ready for your next order."}
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        aria-label="My details form"
        noValidate
        className="mt-6 border-t border-dashed border-border pt-6"
      >
        <AddressForm register={register} errors={errors} />

        <div className="mt-8 flex items-center justify-between border-t-2 border-primary pt-4">
          <Button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>

        {saved && (
          <p
            role="status"
            className="mt-4 font-mono text-xs tracking-widest text-secondary uppercase"
          >
            Address saved
          </p>
        )}
        {formError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {formError}
          </p>
        )}
      </form>
    </div>
  );
}
