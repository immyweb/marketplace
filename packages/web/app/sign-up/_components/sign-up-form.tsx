"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignUpSchema, type SignUpInput } from "@marketplace/core";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const inputClassName =
  "mt-1 block w-full rounded-sm border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({ resolver: zodResolver(SignUpSchema) });

  async function onSubmit(values: SignUpInput) {
    setSubmitting(true);
    setFormError(null);

    const { error } = await authClient.signUp.email(values);

    if (error) {
      setFormError(error.message ?? "Could not create your account");
      setSubmitting(false);
      return;
    }

    router.push(searchParams.get("redirect") ?? "/");
    router.refresh();
  }

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit)}
        aria-label="Sign up form"
        noValidate
      >
        <h2 className="text-lg">Sign Up</h2>

        <div className="mt-6">
          <label htmlFor="name" className="text-sm font-medium">
            Full name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            aria-describedby={errors.name ? "name-error" : undefined}
            aria-invalid={!!errors.name}
            className={inputClassName}
            {...register("name")}
          />
          {errors.name && (
            <p
              id="name-error"
              role="alert"
              className="mt-1 text-sm text-destructive"
            >
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-describedby={errors.email ? "email-error" : undefined}
            aria-invalid={!!errors.email}
            className={inputClassName}
            {...register("email")}
          />
          {errors.email && (
            <p
              id="email-error"
              role="alert"
              className="mt-1 text-sm text-destructive"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={!!errors.password}
            className={inputClassName}
            {...register("password")}
          />
          {errors.password && (
            <p
              id="password-error"
              role="alert"
              className="mt-1 text-sm text-destructive"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="mt-6"
        >
          {submitting ? "Creating account..." : "Sign Up"}
        </Button>

        {formError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {formError}
          </p>
        )}
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/sign-in${searchParams.get("redirect") ? `?redirect=${searchParams.get("redirect")}` : ""}`}
          className="text-secondary underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
