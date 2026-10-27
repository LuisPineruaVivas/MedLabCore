import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewPatientDialog } from "../patients/NewPatientDialog";
import type { PatientFormData } from "../patients/schemas";
import { buildSelectedPatientSummary } from "./createOrderUtils";
import type { SelectedPatient } from "./useCreateOrderDialog";

/** Step 1: search and pick the patient, or register a new one. */
export function CreateOrderPatientPicker({
  selectedPatient,
  setSelectedPatient,
  patientSearch,
  setPatientSearch,
  patients,
  searchingPatients,
  showQuickRegister,
  setShowQuickRegister,
  onCreatePatient,
}: {
  selectedPatient: SelectedPatient | null;
  setSelectedPatient: (patient: SelectedPatient | null) => void;
  patientSearch: string;
  setPatientSearch: (value: string) => void;
  patients: Array<{ id: string; first_name: string; last_name: string; id_number: string }>;
  searchingPatients: boolean;
  showQuickRegister: boolean;
  setShowQuickRegister: (show: boolean) => void;
  onCreatePatient: (data: PatientFormData) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">1. Paciente</Label>

      {selectedPatient ? (
        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
          <div>
            <p className="text-sm font-medium">
              {selectedPatient.first_name} {selectedPatient.last_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {buildSelectedPatientSummary(selectedPatient)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedPatient(null);
              setPatientSearch("");
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar paciente por nombre o cedula..."
              value={patientSearch}
              onChange={(event) => {
                setPatientSearch(event.target.value);
                setShowQuickRegister(false);
              }}
            />
          </div>

          {patientSearch.length >= 2 && patients.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-40 overflow-y-auto">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedPatient(patient as SelectedPatient);
                    setPatientSearch("");
                  }}
                >
                  <p className="text-sm font-medium">
                    {patient.first_name} {patient.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">ID: {patient.id_number}</p>
                </button>
              ))}
            </div>
          )}

          {patientSearch.length >= 2 && patients.length === 0 && !searchingPatients && (
            <div className="text-center py-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                No se encontraron pacientes con estos datos
              </p>
              {!showQuickRegister && (
                <Button variant="outline" size="sm" onClick={() => setShowQuickRegister(true)}>
                  <UserPlus className="w-4 h-4 mr-1" />
                  Registrar paciente
                </Button>
              )}
            </div>
          )}

          {showQuickRegister && (
            <NewPatientDialog
              open={showQuickRegister}
              onOpenChange={setShowQuickRegister}
              onSubmit={(data) => onCreatePatient(data)}
            />
          )}
        </div>
      )}
    </div>
  );
}
