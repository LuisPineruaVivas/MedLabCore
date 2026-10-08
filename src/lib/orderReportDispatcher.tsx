import React from "react";
import { UnifiedTestReportPDF } from "@/lib/unifiedTestReportPDF";
import { UnifiedTestReportRivalta } from "@/lib/UnifiedTestReportRivalta";
import { UnifiedTestReportPalermo } from "@/lib/UnifiedTestReportPalermo";

import { TestReportPDF, type TestTemplateReportProps } from "@/lib/testReportGenerator";
import { TestReportRivaltaPDF } from "@/lib/testReportRivaltaGenerator";
import { TestReportPalermoPDF } from "@/lib/testReportPalermoGenerator";

export type { TestTemplateReportProps };

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
  palermo: UnifiedTestReportPalermo as unknown as React.ComponentType<UnifiedReportProps>,
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

export const TEST_TEMPLATE_REPORT_TEMPLATES: Record<string, React.ComponentType<TestTemplateReportProps>> = {
  default: TestReportPDF as unknown as React.ComponentType<TestTemplateReportProps>,
  rivalta: TestReportRivaltaPDF as unknown as React.ComponentType<TestTemplateReportProps>,
  palermo: TestReportPalermoPDF as unknown as React.ComponentType<TestTemplateReportProps>,
};

/**
 * Normalizes template key and returns the registered single-test preview PDF component.
 * Fallback to 'default' if key is not found or null.
 */
export function getTestTemplateReportComponent(
  templateKey?: string | null
): React.ComponentType<TestTemplateReportProps> {
  if (!templateKey) {
    return TEST_TEMPLATE_REPORT_TEMPLATES.default;
  }

  const normalized = templateKey.trim().toLowerCase();
  return TEST_TEMPLATE_REPORT_TEMPLATES[normalized] || TEST_TEMPLATE_REPORT_TEMPLATES.default;
}

