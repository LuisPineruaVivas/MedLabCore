import React from "react";
import { UnifiedTestReportPDF } from "@/lib/unifiedTestReportPDF";
import { UnifiedTestReportRivalta } from "@/lib/UnifiedTestReportRivalta";

export interface UnifiedReportProps {
  orden: any;
  orderItems: any[];
  departmentOrder?: string[];
  patientData: {
    name: string;
    id: string;
    age: string | number;
    gender: string;
    date?: string;
  };
  labData?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    primary_color?: string;
    secondary_color?: string;
    ciudad?: string;
    rif?: string;
    lab_admin?: string;
    [key: string]: any;
  };
}

export const REPORT_TEMPLATES: Record<string, React.ComponentType<UnifiedReportProps>> = {
  default: UnifiedTestReportPDF as unknown as React.ComponentType<UnifiedReportProps>,
  rivalta: UnifiedTestReportRivalta as unknown as React.ComponentType<UnifiedReportProps>,
};

/**
 * Normalizes template key and returns the registered PDF component.
 * Fallback to 'default' if key is not found or null.
 */
export function getReportComponent(
  templateKey?: string | null
): React.ComponentType<UnifiedReportProps> {
  if (!templateKey) {
    return REPORT_TEMPLATES.default;
  }

  const normalized = templateKey.trim().toLowerCase();
  return REPORT_TEMPLATES[normalized] || REPORT_TEMPLATES.default;
}

export interface DynamicTestReportPDFProps extends UnifiedReportProps {
  reportTemplate?: string | null;
}

export const DynamicTestReportPDF: React.FC<DynamicTestReportPDFProps> = ({
  reportTemplate,
  ...restProps
}) => {
  const Component = getReportComponent(reportTemplate);
  return <Component {...restProps} />;
};
