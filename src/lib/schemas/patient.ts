import { z } from "zod";
import { Tri, shortText, longText } from "./common";
import { CYCLE, CustomField, PREGNANCY } from "./card";

export const PatientInput = z.object({
  full_name: shortText(160).min(2, "Укажите ФИО"),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
    .nullable()
    .or(z.literal("").transform(() => null))
    .default(null),
  phone: shortText(40).default(""),
  whatsapp: shortText(60).default(""),
  telegram: shortText(60).default(""),
  email: shortText(120).default(""),
  notes: longText(4000).default(""),
});
export type PatientInput = z.infer<typeof PatientInput>;

export const AnamnesisInput = z.object({
  allergies_state: Tri.default("unspecified"),
  allergies: shortText(400).default(""),
  chronic_state: Tri.default("unspecified"),
  chronic: shortText(400).default(""),
  thyroid_state: Tri.default("unspecified"),
  thyroid: shortText(400).default(""),
  hormone_tests: Tri.default("unspecified"),
  hormone_tests_note: shortText(300).default(""),
  cycle: z.enum(CYCLE).default("unspecified"),
  pregnancy: z.enum(PREGNANCY).default("unspecified"),
  lactation: Tri.default("unspecified"),
  sebum: z.number().min(1).max(5).nullable().default(null),
  skin_state: longText(3000).default(""),
  complaints: longText(3000).default(""),
  comments: longText(3000).default(""),
  custom_fields: z.array(CustomField).max(20).default([]),
});
export type AnamnesisInput = z.infer<typeof AnamnesisInput>;

export const ConsultationInput = z.object({
  consulted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  complaints: longText(3000).default(""),
  skin_state: longText(3000).default(""),
  notes: longText(6000).default(""),
});
export type ConsultationInput = z.infer<typeof ConsultationInput>;

export type PatientRow = PatientInput & { archived_at: string | null };
