import { PageHeader } from "@/components/ui/PageHeader";
import { useCurrentOrgContext } from "@/hooks/useCurrentOrgContext";
import { FinancePanel } from "@/features/erp/components/FinancePanel";

/** Home of the "Administración" section (lab admins): the lab's financial picture. */
export default function ErpHomePage() {
  const { orgId } = useCurrentOrgContext();
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Administración" description="Ingresos, egresos, saldos de las cuentas, por cobrar y por pagar del laboratorio." />
      <FinancePanel orgId={orgId} />
    </div>
  );
}
