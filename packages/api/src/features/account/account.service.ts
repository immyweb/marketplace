import type { AddressDetails, AddressInput } from "@marketplace/core";
import { prisma } from "@/shared/db/prisma";

export async function getSavedAddress(
  userId: string,
): Promise<AddressDetails | null> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      addressName: true,
      addressStreet: true,
      addressCity: true,
      addressPostcode: true,
    },
  });

  if (!user.addressName) return null;

  return {
    name: user.addressName,
    street: user.addressStreet!,
    city: user.addressCity!,
    postcode: user.addressPostcode!,
  };
}

export async function saveAddress(
  userId: string,
  address: AddressInput,
): Promise<AddressDetails> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      addressName: address.name,
      addressStreet: address.street,
      addressCity: address.city,
      addressPostcode: address.postcode,
    },
  });

  return address;
}
