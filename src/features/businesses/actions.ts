"use server";

import { revalidatePath } from "next/cache";
import { failure } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import type { DocumentType } from "@/types/domain";
import {
  addClosureWith,
  deleteClosureWith,
  deleteProductCategoryWith,
  deleteProductWith,
  recordDocumentWith,
  reorderProductCategoriesWith,
  requestFormalUpgradeWith,
  saveBankStepWith,
  saveHoursWith,
  saveLegalStepWith,
  saveProductCategoryWith,
  saveProductWith,
  saveStoreStepWith,
  setOpenOverrideWith,
  setProductActiveWith,
  setServicesWith,
  submitApplicationWith,
  updateBusinessSettingsWith,
  updateStockWith,
} from "./mutations";

/** Envoltorios del web sobre ./mutations (compartido con la app móvil). */

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function saveLegalStep(input: unknown) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  return saveLegalStepWith(supabase, user.id, input);
}

export async function saveStoreStep(input: unknown) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  return saveStoreStepWith(supabase, user.id, input);
}

export async function saveBankStep(input: unknown) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  return saveBankStepWith(supabase, user.id, input);
}

export async function recordDocument(input: { docType: DocumentType; filePath: string }) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  return recordDocumentWith(supabase, user.id, input);
}

export async function submitApplication(rate: number) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await submitApplicationWith(supabase, user.id, rate);
  if (result.ok) {
    revalidatePath("/vendedor", "layout");
  }
  return result;
}

export async function requestFormalUpgrade(input: unknown) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await requestFormalUpgradeWith(supabase, user.id, input);
  if (result.ok) {
    revalidatePath("/vendedor", "layout");
  }
  return result;
}

export async function updateBusinessSettings(input: unknown) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await updateBusinessSettingsWith(supabase, user.id, input);
  if (result.ok) {
    revalidatePath("/vendedor", "layout");
    revalidatePath(`/negocios/${result.data.slug}`);
  }
  return result;
}

export async function setServices(input: { acceptsDelivery: boolean; acceptsPickup: boolean }) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await setServicesWith(supabase, user.id, input);
  if (result.ok) {
    revalidatePath("/vendedor/delivery");
  }
  return result;
}

export async function saveHours(input: unknown) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await saveHoursWith(supabase, user.id, input);
  if (result.ok) {
    revalidatePath("/vendedor/horarios");
  }
  return result;
}

export async function setOpenOverride(value: boolean | null) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await setOpenOverrideWith(supabase, user.id, value);
  if (result.ok) {
    revalidatePath("/vendedor", "layout");
  }
  return result;
}

export async function addClosure(input: unknown) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await addClosureWith(supabase, user.id, input);
  if (result.ok) {
    revalidatePath("/vendedor/horarios");
  }
  return result;
}

export async function deleteClosure(id: string) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await deleteClosureWith(supabase, user.id, id);
  if (result.ok) {
    revalidatePath("/vendedor/horarios");
  }
  return result;
}

export async function saveProductCategory(input: unknown, id?: string) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await saveProductCategoryWith(supabase, user.id, input, id);
  if (result.ok) {
    revalidatePath("/vendedor/categorias");
  }
  return result;
}

export async function reorderProductCategories(ids: string[]) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await reorderProductCategoriesWith(supabase, user.id, ids);
  if (result.ok) {
    revalidatePath("/vendedor/categorias");
  }
  return result;
}

export async function deleteProductCategory(id: string) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await deleteProductCategoryWith(supabase, user.id, id);
  if (result.ok) {
    revalidatePath("/vendedor/categorias");
  }
  return result;
}

export async function saveProduct(input: unknown, id?: string) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await saveProductWith(supabase, user.id, input, id);
  if (result.ok) {
    revalidatePath("/vendedor/productos");
    if (id) revalidatePath(`/productos/${id}`);
  }
  return result;
}

export async function setProductActive(id: string, isActive: boolean) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await setProductActiveWith(supabase, user.id, id, isActive);
  if (result.ok) {
    revalidatePath("/vendedor/productos");
  }
  return result;
}

export async function updateStock(id: string, stock: number) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await updateStockWith(supabase, user.id, id, stock);
  if (result.ok) {
    revalidatePath("/vendedor/productos");
  }
  return result;
}

export async function deleteProduct(id: string) {
  const { supabase, user } = await session();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await deleteProductWith(supabase, user.id, id);
  if (result.ok) {
    revalidatePath("/vendedor/productos");
  }
  return result;
}
