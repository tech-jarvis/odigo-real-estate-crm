"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CompanySegment } from "@/lib/types";

type Result = { error: string | null };

function n(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

function hasHtml(v: FormDataEntryValue | null): boolean {
  return /<[^>]*>/.test((v as string | null) ?? "");
}

function dbErr(code: string | undefined, message: string): string {
  if (code === "42501") return "Permission denied.";
  return message;
}

// ---------- Companies ----------

export async function createCompany(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  if (hasHtml(formData.get("name"))) return { error: "Company name cannot contain HTML." };
  if (hasHtml(formData.get("address"))) return { error: "Address cannot contain HTML." };
  if (hasHtml(formData.get("primary_contact"))) return { error: "Primary contact cannot contain HTML." };
  if (hasHtml(formData.get("notes"))) return { error: "Notes cannot contain HTML." };
  const name = n(formData.get("name"));
  if (!name) return { error: "Company name is required." };

  const { error } = await supabase.from("companies").insert({
    name,
    segment: (n(formData.get("segment")) ?? "residential") as CompanySegment,
    address: n(formData.get("address")),
    primary_contact: n(formData.get("primary_contact")),
    phone: n(formData.get("phone")),
    email: n(formData.get("email")),
    notes: n(formData.get("notes")),
  });
  if (error) return { error: dbErr(error.code, error.message) };

  revalidatePath("/companies");
  return { error: null };
}

export async function updateCompany(
  id: string,
  formData: FormData
): Promise<Result> {
  const supabase = await createClient();
  if (hasHtml(formData.get("name"))) return { error: "Company name cannot contain HTML." };
  if (hasHtml(formData.get("address"))) return { error: "Address cannot contain HTML." };
  if (hasHtml(formData.get("primary_contact"))) return { error: "Primary contact cannot contain HTML." };
  if (hasHtml(formData.get("notes"))) return { error: "Notes cannot contain HTML." };
  const { error } = await supabase
    .from("companies")
    .update({
      name: n(formData.get("name")) ?? undefined,
      segment: (n(formData.get("segment")) ?? "residential") as CompanySegment,
      address: n(formData.get("address")),
      primary_contact: n(formData.get("primary_contact")),
      phone: n(formData.get("phone")),
      email: n(formData.get("email")),
      notes: n(formData.get("notes")),
    })
    .eq("id", id);
  if (error) return { error: dbErr(error.code, error.message) };

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  return { error: null };
}

export async function deleteCompany(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return { error: dbErr(error.code, error.message) };
  revalidatePath("/companies");
  return { error: null };
}

// ---------- Contacts ----------

export async function createContact(
  companyId: string,
  formData: FormData
): Promise<Result> {
  const supabase = await createClient();
  if (hasHtml(formData.get("name"))) return { error: "Contact name cannot contain HTML." };
  if (hasHtml(formData.get("role"))) return { error: "Role cannot contain HTML." };
  const name = n(formData.get("name"));
  if (!name) return { error: "Contact name is required." };

  const { error } = await supabase.from("contacts").insert({
    company_id: companyId,
    name,
    role: n(formData.get("role")),
    phone: n(formData.get("phone")),
    email: n(formData.get("email")),
  });
  if (error) return { error: dbErr(error.code, error.message) };

  revalidatePath(`/companies/${companyId}`);
  return { error: null };
}

export async function updateContact(
  id: string,
  companyId: string,
  formData: FormData
): Promise<Result> {
  const supabase = await createClient();
  if (hasHtml(formData.get("name"))) return { error: "Contact name cannot contain HTML." };
  if (hasHtml(formData.get("role"))) return { error: "Role cannot contain HTML." };
  const { error } = await supabase
    .from("contacts")
    .update({
      name: n(formData.get("name")) ?? undefined,
      role: n(formData.get("role")),
      phone: n(formData.get("phone")),
      email: n(formData.get("email")),
    })
    .eq("id", id);
  if (error) return { error: dbErr(error.code, error.message) };
  revalidatePath(`/companies/${companyId}`);
  return { error: null };
}

export async function deleteContact(
  id: string,
  companyId: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { error: dbErr(error.code, error.message) };
  revalidatePath(`/companies/${companyId}`);
  return { error: null };
}
