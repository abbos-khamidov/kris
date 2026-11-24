import { CardData, emptyCardData, type Personal } from "@/lib/schemas/card";
import type { AnamnesisInput } from "@/lib/schemas/patient";
import type { Settings } from "@/lib/schemas/settings";
import { ageFromBirthDate, pluralYears } from "@/lib/format";

/** Page 2 is always derived from the patient + anamnesis; it is rebuilt, never copied from another card. */
export function personalFromPatient(
  patient: { full_name: string; birth_date: string | null },
  anamnesis: Partial<AnamnesisInput> | null,
  now = new Date(),
): Personal {
  const a = anamnesis ?? {};
  const age = ageFromBirthDate(patient.birth_date, now);
  return {
    fullName: patient.full_name,
    ageText: age != null ? `${age} ${pluralYears(age)}` : "",
    allergies: a.allergies ?? "",
    allergiesState: a.allergies_state ?? "unspecified",
    chronic: a.chronic ?? "",
    chronicState: a.chronic_state ?? "unspecified",
    thyroid: a.thyroid ?? "",
    thyroidState: a.thyroid_state ?? "unspecified",
    hormoneTests: a.hormone_tests ?? "unspecified",
    hormoneTestsNote: a.hormone_tests_note ?? "",
    cycle: a.cycle ?? "unspecified",
    pregnancy: a.pregnancy ?? "unspecified",
    lactation: a.lactation ?? "unspecified",
    sebum: a.sebum ?? null,
    sebumText: a.sebum != null ? String(a.sebum).replace(".", ",") : "",
    custom: (a.custom_fields ?? []).map((f) => ({ id: f.id, label: f.label, value: f.value })),
  };
}

/** Initial data of a blank card: design from the brand defaults, personal data from the patient. */
export function newCardData(
  patient: { full_name: string; birth_date: string | null },
  anamnesis: Partial<AnamnesisInput> | null,
  settings: Settings,
): CardData {
  const base = emptyCardData();
  return CardData.parse({
    ...base,
    design: {
      ...base.design,
      coverVariant: settings.pdf.coverVariant,
      coverTitleColor: settings.pdf.coverTitleColor,
      coverNameColor: settings.pdf.coverNameColor,
    },
    personal: personalFromPatient(patient, anamnesis),
    conclusion: { ...base.conclusion, buttonLabel: settings.pdf.buttonLabel },
  });
}

/**
 * New card based on an earlier one: recommendations and layout are reused, personal data is rebuilt
 * for the current patient. Face-scheme strokes are kept (they are layout, not personal data).
 * The specialist must review and approve the recommendations again — nothing is auto-approved.
 */
export function cloneCardData(
  previous: CardData,
  patient: { full_name: string; birth_date: string | null },
  anamnesis: Partial<AnamnesisInput> | null,
): CardData {
  const copy = structuredClone(previous);
  copy.personal = personalFromPatient(patient, anamnesis);
  // fresh ids so edits to the new card can never alias the old one
  return CardData.parse(copy);
}
