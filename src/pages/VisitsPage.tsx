import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Plus, FileText } from "lucide-react";

const mockVisits = [
  { id: "1", patient: "María García", tests: ["CBC", "Urinalysis"], status: "completada" as const, total: 45.00, date: "2026-02-26 09:15" },
  { id: "3", patient: "Ana Martínez", tests: ["Lipid Panel", "TSH"], status: "pendiente" as const, total: 65.00, date: "2026-02-26 11:00" },
  { id: "4", patient: "José Rodríguez", tests: ["CBC"], status: "completada" as const, total: 25.00, date: "2026-02-25 14:20" },
  { id: "5", patient: "Laura Hernández", tests: ["Liver Function Panel"], status: "pendiente" as const, total: 40.00, date: "2026-02-26 08:45" },
  { id: "6", patient: "Pedro Sánchez", tests: ["CBC", "Lipid Panel", "Glucose Test"], status: "cancelada" as const, total: 75.00, date: "2026-02-24 16:00" },
];

export default function VisitsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Visits"
        description="Manage laboratory orders and results"
        actions={
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Visit
          </Button>
        }
      />

      <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Patient</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Tests</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Total</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Date</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockVisits.map((visit) => (
                <tr key={visit.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium">{visit.patient}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {visit.tests.map((t) => (
                        <span key={t} className="text-[11px] bg-secondary px-2 py-0.5 rounded-md font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={visit.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold mono">${visit.total.toFixed(2)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-muted-foreground">{visit.date}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Report
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
