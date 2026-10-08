import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { format } from "date-fns";
import type { OrderRow } from "@/features/orders/schemas";
import { getFieldResultMeta } from "@/features/tests/schemas";
import { getMicrobiologyFields, getGermSensitivity } from "@/features/microbiology/types";
import { enhanceSignatureImage } from "./enhanceSignatureImage";

interface WordReportProps {
  orden: OrderRow;
  orderItems: Array<Record<string, unknown>>;
  departmentOrder?: string[];
  patientData: {
    name: string;
    id: string;
    date?: string;
    age: string | number;
    gender: string;
  };
  labData?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string | null;
    primary_color?: string;
    report_footer_text?: string | null;
  };
}

interface ReportField {
  label?: string;
  type?: "number" | "text" | "select" | "range";
  value?: string | number | null;
  unit?: string | null;
  range?: string | null;
  reference_ranges?: Array<{
    id: string;
    gender: "masculino" | "femenino" | "ambos";
    age_min?: number | null;
    age_max?: number | null;
    min_value?: number | null;
    max_value?: number | null;
    description?: string;
    custom_display?: string | null;
    categories?: Array<{ label: string; min: number; max: number; color: string }>;
  }>;
}

interface ReportSection {
  name?: string;
  fields?: ReportField[];
}

interface ReportResults {
  category?: string;
  result_type?: string;
  sample_type?: string;
  gram_stain?: string;
  culture_mode?: string;
  culture_result?: string;
  isolated_germs?: string[];
  antibiogram?: Array<{
    antibiotic_id: string;
    antibiotic_name: string;
    sensitivity?: string | null;
    sensitivities?: Record<number, string | null>;
  }>;
  extra_fields?: Record<string, string>;
  sections?: ReportSection[];
  hide_table_header?: boolean;
}

interface ReportItem {
  category: string;
  name: string;
  method: string;
  isMicrobiology: boolean;
  results: ReportResults;
  schema: { microbiology_fields?: Array<{ id: string; key: string; label: string; fixed: boolean }> };
  sortOrder: number;
}

const CONTENT_WIDTH = 10640;
const COLUMN_WIDTHS = [3724, 2128, 1596, 3192];
const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    if (!value.trim()) return {};
    try {
      return asRecord(JSON.parse(value));
    } catch (error) {
      throw new Error("No se pudieron leer los resultados de un examen.", { cause: error });
    }
  }
  return asRecord(value);
}

function toReportItems(items: Array<Record<string, unknown>>): ReportItem[] {
  return items.map((item) => {
    const results = parseObject(item.results_data) as ReportResults;
    const testTemplate = asRecord(item.test_templates);
    const schemaValue = item.template_schema ?? testTemplate.schema;
    const schema = parseObject(schemaValue) as ReportItem["schema"];

    return {
      category: String(item.category ?? results.category ?? testTemplate.category ?? "Pruebas Especiales"),
      name: String(item.test_name ?? item.name ?? "Examen"),
      method: typeof item.method_name === "string" ? item.method_name.trim() : "",
      isMicrobiology: results.result_type === "MICROBIOLOGY" || testTemplate.result_type === "MICROBIOLOGY",
      results,
      schema,
      sortOrder: typeof item.resolved_sort_order === "number" ? item.resolved_sort_order : 0,
    };
  });
}

function parseAge(age: string | number): number | undefined {
  if (typeof age === "number") return Number.isFinite(age) ? age : undefined;
  const match = age.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mes(?:es)?|a(?:ñ|n)o(?:s)?)?/i);
  if (!match) return undefined;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return undefined;
  return match[2]?.toLowerCase().startsWith("mes") ? value / 12 : value;
}

function formatResult(value: unknown): string {
  if (typeof value !== "number" && typeof value !== "string") return "";
  const normalized = String(value).trim();
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(normalized)) return normalized;
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 20 })
    .format(Number(normalized.replace(",", ".")));
}

function hexColor(color: string | undefined, isOutOfRange: boolean): string {
  if (!color || color === "black" || color === "None") return isOutOfRange ? "DC2626" : "000000";
  const namedColors: Record<string, string> = { green: "16A34A", yellow: "CA8A04", red: "DC2626" };
  const normalized = color.startsWith("#") ? color.slice(1) : namedColors[color.toLowerCase()] ?? color;
  return /^[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : "000000";
}

async function loadPng(source: string): Promise<Uint8Array> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`No se pudo cargar una imagen del informe (${response.status}).`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar una imagen para el documento Word.");
    context.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir una imagen del informe.")), "image/png");
    });
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

function paragraph(text: string, options: {
  bold?: boolean;
  color?: string;
  size?: number;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  after?: number;
} = {}): Paragraph {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { after: options.after ?? 0, line: 220 },
    children: [new TextRun({
      text,
      bold: options.bold,
      color: options.color,
      size: options.size ?? 20,
      font: "Arial",
    })],
  });
}

function tableCell(
  children: Paragraph[],
  options: { fill?: string; width?: number; columnSpan?: number; bold?: boolean } = {},
): TableCell {
  return new TableCell({
    children,
    width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
    columnSpan: options.columnSpan,
    shading: options.fill ? { type: ShadingType.CLEAR, fill: options.fill } : undefined,
    margins: { top: 15, bottom: 15, left: 100, right: 100 },
    verticalAlign: "center",
  });
}

function makeResultsTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: COLUMN_WIDTHS,
    rows,
    borders: TABLE_BORDERS,
  });
}

function standardRows(item: ReportItem, age: number | undefined, gender: string): TableRow[] {
  const fields = item.results.sections?.flatMap((section) => section.fields ?? []) ?? [];
  const multiField = fields.length > 1;
  const rows: TableRow[] = [];
  let methodRendered = false;

  for (const section of item.results.sections ?? []) {
    const populatedFields = (section.fields ?? []).filter((field) =>
      field.value !== undefined && field.value !== null && String(field.value).trim() !== "",
    );
    if (populatedFields.length === 0) continue;

    if (section.name) {
      rows.push(new TableRow({
        children: [tableCell([paragraph(section.name, { bold: true, color: "0F172A" })], { fill: "E2E8F0", columnSpan: 4 })],
      }));
    }

    for (const field of populatedFields) {
      const { rangeDisplay, isOutOfRange, matchedRange } = getFieldResultMeta(
        { ...field, type: field.type ?? "text" },
        gender,
        age,
      );
      const label = multiField ? field.label || item.name : item.name;
      const method = !methodRendered ? item.method : "";
      methodRendered = true;
      const resultColor = matchedRange?.categories?.find((category) => {
        const min = Math.min(category.min, category.max);
        const max = Math.max(category.min, category.max);
        const numeric = Number(String(field.value).replace(",", "."));
        return Number.isFinite(numeric) && numeric >= min && numeric <= max;
      })?.color;
      const result = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 50 },
        children: [new TextRun({
          text: field.value,
          font: "Arial",
          size: 20,
          color: hexColor(resultColor, isOutOfRange),
        })],
      });
      rows.push(new TableRow({
        children: [
          tableCell([
            paragraph(label),
            ...(method ? [paragraph(`Método: ${method}`, { size: 17 })] : []),
          ], { width: COLUMN_WIDTHS[0] }),
          tableCell([result], { width: COLUMN_WIDTHS[1] }),
          tableCell([paragraph(field.unit ?? "", { alignment: AlignmentType.CENTER })], { width: COLUMN_WIDTHS[2] }),
          tableCell([paragraph(rangeDisplay, { alignment: AlignmentType.CENTER })], { width: COLUMN_WIDTHS[3] }),
        ],
      }));
    }
  }

  return rows;
}

function microbiologyRows(item: ReportItem): TableRow[] {
  const data = item.results;
  const rows: TableRow[] = [
    new TableRow({
      children: [tableCell([paragraph("INFORME BACTERIOLÓGICO", { bold: true, alignment: AlignmentType.CENTER })], { fill: "F1F5F9", columnSpan: 4 })],
    }),
  ];
  const fields = getMicrobiologyFields(item.schema);
  const fixedKeys = new Set(["sample_type", "gram_stain", "culture_result"]);

  for (const field of fields) {
    const value = field.key === "sample_type"
      ? data.sample_type
      : field.key === "gram_stain"
        ? data.gram_stain
        : fixedKeys.has(field.key)
          ? undefined
          : data.extra_fields?.[field.key];
    if (value) {
      rows.push(new TableRow({
        children: [tableCell([paragraph(`${field.label}: ${value}`)], { columnSpan: 4 })],
      }));
    }
  }

  const cultureLabel = fields.find((field) => field.key === "culture_result")?.label ?? "Cultivo";
  const germs = data.isolated_germs?.map((germ) => germ.trim()).filter(Boolean) ?? [];
  if (germs.length > 0) {
    rows.push(new TableRow({
      children: [tableCell([paragraph(`${cultureLabel}: ${germs.map((germ, index) => `${index + 1}.- ${germ}`).join("; ")}`)], { columnSpan: 4 })],
    }));
    const antibiotics = data.antibiogram ?? [];
    const antibiogramRows = antibiotics
      .filter((entry) => germs.some((_, index) => Boolean(getGermSensitivity(entry, index))))
      .map((entry) => new TableRow({
        children: [tableCell([
          paragraph(`${entry.antibiotic_name}: ${germs.slice(0, 3).map((germ, index) =>
            `${germ} (${getGermSensitivity(entry, index) || "—"})`,
          ).join("; ")}`),
        ], { columnSpan: 4 })],
      }));
    if (antibiogramRows.length > 0) {
      rows.push(new TableRow({
        children: [tableCell([paragraph("ANTIBIOGRAMA", { bold: true, alignment: AlignmentType.CENTER })], { fill: "F1F5F9", columnSpan: 4 })],
      }));
      rows.push(...antibiogramRows);
    }
  } else if (data.culture_result) {
    rows.push(new TableRow({
      children: [tableCell([paragraph(`${cultureLabel}: ${data.culture_result}`)], { columnSpan: 4 })],
    }));
  }

  return rows;
}

export async function generateUnifiedTestReportWord(props: WordReportProps): Promise<Blob> {
  const { orden, patientData, labData } = props;
  const items = toReportItems(props.orderItems).sort((left, right) => {
    const leftCategoryIndex = props.departmentOrder?.indexOf(left.category) ?? -1;
    const rightCategoryIndex = props.departmentOrder?.indexOf(right.category) ?? -1;
    const leftIndex = leftCategoryIndex < 0 ? Number.MAX_SAFE_INTEGER : leftCategoryIndex;
    const rightIndex = rightCategoryIndex < 0 ? Number.MAX_SAFE_INTEGER : rightCategoryIndex;
    return leftIndex === rightIndex
      ? left.category.localeCompare(right.category) || left.sortOrder - right.sortOrder
      : leftIndex - rightIndex;
  });

  const requestedPrimaryColor = (labData?.primary_color ?? "#0e5b8a").replace("#", "");
  const primaryColor = /^[0-9A-Fa-f]{6}$/.test(requestedPrimaryColor)
    ? requestedPrimaryColor.toUpperCase()
    : "0E5B8A";
  const logo = labData?.logo ? await loadPng(labData.logo) : undefined;
  const children: Array<Paragraph | Table> = [];
  const labInfo = [
    paragraph(labData?.name ?? "LABORATORIO CLÍNICO", { bold: true, color: primaryColor, size: 24 }),
    paragraph(labData?.address ?? ""),
    paragraph(labData?.phone ? `Tel: ${labData.phone}` : ""),
    paragraph(labData?.email ? `Email: ${labData.email}` : ""),
  ];
  const labHeaderCells = [tableCell(labInfo, { width: Math.round(CONTENT_WIDTH * 0.62) })];
  if (logo) {
    labHeaderCells.push(tableCell([
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new ImageRun({ data: logo, transformation: { width: 185, height: 85 } })],
      }),
    ], { width: Math.round(CONTENT_WIDTH * 0.38) }));
  }
  children.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: labHeaderCells.map((cell) => cell.options.width?.size ?? Math.round(CONTENT_WIDTH / labHeaderCells.length)),
    rows: [new TableRow({ children: labHeaderCells })],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  }));
  children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
  children.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [Math.round(CONTENT_WIDTH * 0.6), Math.round(CONTENT_WIDTH * 0.4)],
    rows: [
      new TableRow({
        children: [
          tableCell([paragraph(`Paciente: ${patientData.name}`)], { width: CONTENT_WIDTH, columnSpan: 2 }),
        ],
      }),
      new TableRow({
        children: [
          tableCell([paragraph(`CI: ${patientData.id}`)], { width: Math.round(CONTENT_WIDTH * 0.6) }),
          tableCell([paragraph(`Fecha de muestra: ${format(new Date(orden.created_at), "dd/MM/yyyy")}`)], { width: Math.round(CONTENT_WIDTH * 0.4) }),
        ],
      }),
      new TableRow({
        children: [
          tableCell([paragraph(`Edad/Sexo: ${patientData.age} / ${patientData.gender}`)], { width: Math.round(CONTENT_WIDTH * 0.6) }),
          tableCell([paragraph(`No. Orden: ${orden.order_seq.toString().padStart(4, "0")}`)], { width: Math.round(CONTENT_WIDTH * 0.4) }),
        ],
      }),
    ],
    borders: TABLE_BORDERS,
  }));

  const age = parseAge(patientData.age);
  const groupedItems = new Map<string, ReportItem[]>();
  for (const item of items) {
    groupedItems.set(item.category, [...(groupedItems.get(item.category) ?? []), item]);
  }

  for (const [category, categoryItems] of groupedItems) {
    const hasStandardTests = categoryItems.some((item) => !item.isMicrobiology);
    const reportRows = categoryItems.flatMap((item) => (
      item.isMicrobiology
        ? microbiologyRows(item)
        : standardRows(item, age, patientData.gender)
    ));
    if (reportRows.length === 0) continue;

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 140, after: 0 },
      shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
      border: {
        top: { style: BorderStyle.SINGLE, size: 8, color: primaryColor },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: primaryColor },
        left: { style: BorderStyle.SINGLE, size: 8, color: primaryColor },
        right: { style: BorderStyle.SINGLE, size: 8, color: primaryColor },
      },
      children: [new TextRun({ text: category.toUpperCase(), bold: true, color: primaryColor, size: 20, font: "Arial" })],
    }));

    const tableRows = [
      ...(hasStandardTests ? [new TableRow({
        tableHeader: true,
        children: ["EXAMEN", "RESULTADO", "UNIDADES", "VALORES DE REF."].map((label, index) =>
          tableCell([paragraph(label, { bold: true, alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })], { fill: "F1F5F9", width: COLUMN_WIDTHS[index] }),
        ),
      })] : []),
      ...reportRows,
    ];
    children.push(makeResultsTable(tableRows));
  }

  if (orden.status === "completada" && (orden.firma_url || orden.sello_url)) {
    const signatureCells: TableCell[] = [];
    if (orden.firma_url) {
      const signature = new Uint8Array(await (await enhanceSignatureImage(orden.firma_url)).arrayBuffer());
      signatureCells.push(tableCell([
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: signature, transformation: { width: 150, height: 60 } })],
        }),
      ]));
    }
    if (orden.sello_url) {
      const stamp = new Uint8Array(await (await enhanceSignatureImage(orden.sello_url)).arrayBuffer());
      signatureCells.push(tableCell([
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: stamp, transformation: { width: 150, height: 60 } })],
        }),
      ]));
    }
    children.push(new Paragraph({ spacing: { before: 250 }, children: [] }));
    children.push(new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: signatureCells.map(() => Math.floor(CONTENT_WIDTH / signatureCells.length)),
      rows: [new TableRow({ children: signatureCells })],
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
    }));
    for (const line of (orden.signature_footer_text ?? "").split("\n").filter(Boolean)) {
      children.push(paragraph(line, { alignment: AlignmentType.CENTER, size: 17, color: "1E293B" }));
    }
  }

  if (labData?.report_footer_text?.trim()) {
    children.push(paragraph(labData.report_footer_text.trim(), {
      alignment: AlignmentType.CENTER,
      size: 16,
      color: "64748B",
      after: 0,
    }));
  }

  const document = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 800, right: 800, bottom: 800, left: 800 },
        },
      },
      children,
    }],
  });
  return Packer.toBlob(document);
}
