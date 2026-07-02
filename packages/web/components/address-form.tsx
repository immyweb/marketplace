import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { AddressInput } from "@marketplace/core";

interface Props {
  register: UseFormRegister<AddressInput>;
  errors: FieldErrors<AddressInput>;
}

const inputClassName =
  "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function AddressForm({ register, errors }: Props) {
  return (
    <fieldset className="mt-6">
      <legend className="text-lg font-medium">Delivery Address</legend>

      <div className="mt-4">
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
        <label htmlFor="street" className="text-sm font-medium">
          Street address
        </label>
        <input
          id="street"
          type="text"
          autoComplete="address-line1"
          aria-describedby={errors.street ? "street-error" : undefined}
          aria-invalid={!!errors.street}
          className={inputClassName}
          {...register("street")}
        />
        {errors.street && (
          <p
            id="street-error"
            role="alert"
            className="mt-1 text-sm text-destructive"
          >
            {errors.street.message}
          </p>
        )}
      </div>

      <div className="mt-4">
        <label htmlFor="city" className="text-sm font-medium">
          City
        </label>
        <input
          id="city"
          type="text"
          autoComplete="address-level2"
          aria-describedby={errors.city ? "city-error" : undefined}
          aria-invalid={!!errors.city}
          className={inputClassName}
          {...register("city")}
        />
        {errors.city && (
          <p
            id="city-error"
            role="alert"
            className="mt-1 text-sm text-destructive"
          >
            {errors.city.message}
          </p>
        )}
      </div>

      <div className="mt-4">
        <label htmlFor="postcode" className="text-sm font-medium">
          Postcode
        </label>
        <input
          id="postcode"
          type="text"
          autoComplete="postal-code"
          aria-describedby={errors.postcode ? "postcode-error" : undefined}
          aria-invalid={!!errors.postcode}
          className={inputClassName}
          {...register("postcode")}
        />
        {errors.postcode && (
          <p
            id="postcode-error"
            role="alert"
            className="mt-1 text-sm text-destructive"
          >
            {errors.postcode.message}
          </p>
        )}
      </div>
    </fieldset>
  );
}
