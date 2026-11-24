import { PatientForm } from "../patient-form";

export const metadata = { title: "Новый пациент" };

export default function NewPatientPage() {
  return (
    <div className="animate-fade-in mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl">Новый пациент</h1>
      <PatientForm mode="create" />
    </div>
  );
}
