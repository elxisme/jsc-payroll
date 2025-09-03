import * as XLSX from 'xlsx';

/**
 * A mapping of common Nigerian bank names to their 3-digit codes.
 */
const NIGERIAN_BANK_CODES = {
    'access': '044',
    'citibank': '023',
    'ecobank': '050',
    'fidelity': '070',
    'firstbank': '011',
    'fcmb': '214',
    'globus': '103',
    'gtb': '058',
    'heritage': '030',
    'jaiz': '301',
    'keystone': '082',
    'parallex': '104',
    'polaris': '076',
    'premium': '105',
    'providus': '101',
    'stanbic': '221',
    'standard chartered': '068',
    'sterling': '232',
    'suntrust': '100',
    'taj': '302',
    'titan': '102',
    'uba': '033',
    'union': '032',
    'unity': '215',
    'wema': '035',
    'zenith': '057',
};

export interface BankTransferData {
  staffId: string;
  staffName: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  amount: number;
  department: string;
  period: string;
}

// --- MODIFICATION 1: Added 'step' to the interface ---
export interface PayrollExportData {
  staffId: string;
  staffName: string;
  department: string;
  position: string;
  gradeLevel: number;
  step: number;
  basicSalary: number;
  allowances: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  period: string;
}

/**
 * Export bank transfer data to CSV format
 */
export async function exportToBankCSV(data: BankTransferData[], filename: string): Promise<void> {
  const csvContent = [
    // Header row
    'Staff ID,Staff Name,Account Number,Account Name,Bank Name,Bank Code,Amount,Department,Period',
    // Data rows
    ...data.map(row => [
      row.staffId,
      `"${row.staffName}"`,
      row.accountNumber,
      `"${row.accountName}"`,
      `"${row.bankName}"`,
      row.bankCode,
      row.amount.toFixed(2),
      `"${row.department}"`,
      row.period,
    ].join(','))
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv');
}

/**
 * Export bank transfer data to Excel format
 */
export async function exportToBankExcel(data: any[], filename: string): Promise<void> {
  // Create worksheet with custom headers
  const headers = [
    'Staff ID',
    'Staff Name',
    'Account Number',
    'Account Name',
    'Bank Name',
    'Bank Code',
    'Amount (NGN)',
    'Department',
    'Pay Period'
  ];

  // Format data for export
  const formattedData = data.map(row => ({
    'Staff ID': row.staffId || row['Staff ID'] || '',
    'Staff Name': row.staffName || row['Staff Name'] || '',
    'Account Number': row.accountNumber || row['Account Number'] || '',
    'Account Name': row.accountName || row['Account Name'] || '',
    'Bank Name': row.bankName || row['Bank Name'] || '',
    'Bank Code': row.bankCode || row['Bank Code'] || '',
    'Amount (NGN)': typeof row.amount === 'number' ? row.amount : (row['Amount (NGN)'] || 0),
    'Department': row.department || row['Department'] || '',
    'Pay Period': row.period || row['Pay Period'] || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData, { header: headers, skipHeader: true });
  const workbook = XLSX.utils.book_new();

  // Add report metadata at the top
  const reportInfo = [
    ['JSC PAYROLL MANAGEMENT SYSTEM'],
    ['Bank Transfer Schedule'],
    [`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`],
    [`Total Records: ${data.length}`],
    [`Total Amount: ₦${data.reduce((sum, row) => sum + (typeof row.amount === 'number' ? row.amount : (row['Amount (NGN)'] || 0)), 0).toLocaleString()}`],
    [''], // Empty row
    headers // Add the actual header row
  ];

  // Insert report info and headers at the beginning
  XLSX.utils.sheet_add_aoa(worksheet, reportInfo, { origin: 'A1' });

  // Adjust the data to start after the report info and headers
  XLSX.utils.sheet_add_json(worksheet, formattedData, { origin: `A${reportInfo.length + 1}`, skipHeader: true });

  // Set column widths
  const columnWidths = [
    { wch: 15 }, // Staff ID
    { wch: 25 }, // Staff Name
    { wch: 15 }, // Account Number
    { wch: 25 }, // Account Name
    { wch: 20 }, // Bank Name
    { wch: 10 }, // Bank Code
    { wch: 15 }, // Amount
    { wch: 20 }, // Department
    { wch: 15 }, // Period
  ];
  worksheet['!cols'] = columnWidths;

  // Style the header row
  const headerRowIndex = reportInfo.length - 1;
  for (let col = 0; col < headers.length; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
    if (!worksheet[cellAddress]) continue;
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "008751" } }, // Nigeria green
      alignment: { horizontal: "center" }
    };
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bank Transfers');
  XLSX.writeFile(workbook, filename);
}


/**
 * Export payroll data to Excel format
 */
export async function exportPayrollToExcel(data: PayrollExportData[], filename: string): Promise<void> {
  // Calculate totals for the report summary
  const totalStaff = data.length;
  const totalGrossPay = data.reduce((sum, row) => sum + row.grossPay, 0);
  const totalNetPay = data.reduce((sum, row) => sum + row.netPay, 0);
  const totalAllowances = data.reduce((sum, row) => sum + row.allowances, 0);
  const totalDeductions = data.reduce((sum, row) => sum + row.deductions, 0);

  // Define the main table headers
  const tableHeaders = [
    'Staff ID',
    'Staff Name',
    'Department',
    'Position',
    'Grade Level',
    'Basic Salary (NGN)',
    'Allowances (NGN)',
    'Gross Pay (NGN)',
    'Deductions (NGN)',
    'Net Pay (NGN)',
    'Pay Period'
  ];

  // --- MODIFICATION 2: Format 'Grade Level' as a combined string ---
  const formattedData = data.map(row => {
    return {
      'Staff ID': row.staffId,
      'Staff Name': row.staffName,
      'Department': row.department,
      'Position': row.position,
      'Grade Level': `${(row.gradeLevel || 0).toString().padStart(2, '0')}${(row.step || 0).toString().padStart(2, '0')}`,
      'Basic Salary (NGN)': row.basicSalary,
      'Allowances (NGN)': row.allowances,
      'Gross Pay (NGN)': row.grossPay,
      'Deductions (NGN)': row.deductions,
      'Net Pay (NGN)': row.netPay,
      'Pay Period': row.period,
    };
  });

  // Create empty worksheet
  const worksheet = XLSX.utils.aoa_to_sheet([]);
  const workbook = XLSX.utils.book_new();

  // Add report metadata at the top
  const reportMetadata = [
    ['JSC PAYROLL MANAGEMENT SYSTEM'],
    ['Payroll Summary Report'],
    [`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`],
    [`Total Staff: ${totalStaff}`],
    [`Total Gross Pay: ₦${totalGrossPay.toLocaleString()}`],
    [`Total Allowances: ₦${totalAllowances.toLocaleString()}`],
    [`Total Deductions: ₦${totalDeductions.toLocaleString()}`],
    [`Total Net Pay: ₦${totalNetPay.toLocaleString()}`],
    [''], // Empty row to separate metadata from table
  ];

  // Add report metadata to worksheet
  XLSX.utils.sheet_add_aoa(worksheet, reportMetadata, { origin: 'A1' });

  // Add table headers after the metadata
  const headerRowPosition = reportMetadata.length + 1;
  XLSX.utils.sheet_add_aoa(worksheet, [tableHeaders], { origin: `A${headerRowPosition}` });

  // Add the actual staff data after the headers
  XLSX.utils.sheet_add_json(worksheet, formattedData, { 
    origin: `A${headerRowPosition + 1}`, 
    skipHeader: true 
  });

  // Set column widths
  const columnWidths = [
    { wch: 15 }, // Staff ID
    { wch: 25 }, // Staff Name
    { wch: 20 }, // Department
    { wch: 20 }, // Position
    { wch: 20 }, // Grade Level (Increased width for the new format)
    { wch: 15 }, // Basic Salary
    { wch: 15 }, // Allowances
    { wch: 15 }, // Gross Pay
    { wch: 15 }, // Deductions
    { wch: 15 }, // Net Pay
    { wch: 15 }, // Period
  ];
  worksheet['!cols'] = columnWidths;

  // Style the table header row
  const headerRowIndex = headerRowPosition - 1;
  for (let col = 0; col < tableHeaders.length; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
    if (!worksheet[cellAddress]) continue;
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "008751" } }, // Nigeria green
      alignment: { horizontal: "center" }
    };
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll Data');
  XLSX.writeFile(workbook, filename);
}

/**
 * Export staff data to Excel format for bulk import template
 */
export async function exportStaffTemplate(): Promise<void> {
  const templateData = [
    {
      'First Name': '',
      'Last Name': '',
      'Middle Name': '',
      'Email': '',
      'Phone Number': '',
      'Department Code': '',
      'Position': '',
      'Grade Level': '',
      'Step': '',
      'Employment Date': '',
      'Bank Name': '',
      'Account Number': '',
      'Account Name': '',
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();

  // Add instructions sheet
  const instructions = [
    ['JSC Staff Import Template'],
    [''],
    ['Instructions:'],
    ['1. Fill in all required fields for each staff member'],
    ['2. Use the format YYYY-MM-DD for Employment Date'],
    ['3. Department Code should match existing department codes'],
    ['4. Grade Level should be between 1-17'],
    ['5. Step should be between 1-15'],
    ['6. Bank Name should match one of the recognized banks.'],
    ['7. Save as .xlsx and upload through the system'],
    [''],
    ['Required Fields:'],
    ['- First Name, Last Name, Email, Position, Grade Level, Step, Employment Date'],
    [''],
    ['Optional Fields:'],
    ['- Middle Name, Phone Number, Bank Details'],
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);

  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff Data');

  XLSX.writeFile(workbook, 'staff_import_template.xlsx');
}

/**
 * Export salary structure to Excel
 */
export async function exportSalaryStructureToExcel(data: any[], filename: string): Promise<void> {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  // Set column widths
  const columnWidths = [
    { wch: 12 }, // Grade Level
    { wch: 8 },  // Step
    { wch: 15 }, // Basic Salary
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Salary Structure');
  XLSX.writeFile(workbook, filename);
}

/**
 * Parse CSV file to JSON
 */
export function parseCSVToJSON(csvContent: string): any[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }

  return data;
}

/**
 * Parse Excel file to JSON
 */
export function parseExcelToJSON(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Generate Nigerian bank transfer file format (specific to bank requirements)
 */
export async function generateNigerianBankFile(
  data: BankTransferData[],
  bankCode: string,
  filename: string
): Promise<void> {
  // This would generate bank-specific file formats
  // Different Nigerian banks may have different requirements

  let content = '';

  switch (bankCode.toLowerCase()) {
    case 'gtb':
    case '058':
      content = generateGTBFormat(data);
      break;
    case 'access':
    case '044':
      content = generateAccessBankFormat(data);
      break;
    case 'firstbank':
    case '011':
      content = generateFirstBankFormat(data);
      break;
    default:
      content = generateStandardFormat(data);
  }

  downloadFile(content, filename, 'text/plain');
}

// Helper functions
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function generateGTBFormat(data: BankTransferData[]): string {
  // GTB bulk payment format
  let content = 'HEADER,BULK PAYMENT,JSC PAYROLL,' + new Date().toISOString().split('T')[0] + '\n';

  data.forEach((row, index) => {
    content += `${index + 1},${row.accountNumber},${row.amount.toFixed(2)},${row.staffName},JSC SALARY,${row.period}\n`;
  });

  content += `TRAILER,${data.length},${data.reduce((sum, row) => sum + row.amount, 0).toFixed(2)}\n`;

  return content;
}

function generateAccessBankFormat(data: BankTransferData[]): string {
  // Access Bank bulk payment format
  let content = 'S/N,Account Number,Amount,Beneficiary Name,Payment Details,Reference\n';

  data.forEach((row, index) => {
    content += `${index + 1},"${row.accountNumber}",${row.amount.toFixed(2)},"${row.staffName}","Salary Payment","${row.staffId}-${row.period}"\n`;
  });

  return content;
}

function generateFirstBankFormat(data: BankTransferData[]): string {
  // First Bank bulk payment format
  let content = 'Record Type,Account Number,Amount,Narration,Beneficiary Name\n';

  data.forEach((row) => {
    content += `D,"${row.accountNumber}",${row.amount.toFixed(2)},"SALARY ${row.period}","${row.staffName}"\n`;
  });

  return content;
}

function generateStandardFormat(data: BankTransferData[]): string {
  // Standard format for other banks
  return data.map(row =>
    `${row.accountNumber},${row.amount.toFixed(2)},${row.staffName},SALARY ${row.period}`
  ).join('\n');
}

/**
 * Validate bank transfer data
 */
export function validateBankTransferData(data: BankTransferData[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  data.forEach((row, index) => {
    if (!row.staffId) errors.push(`Row ${index + 1}: Staff ID is required`);
    if (!row.staffName) errors.push(`Row ${index + 1}: Staff name is required`);
    if (!row.accountNumber) errors.push(`Row ${index + 1}: Account number is required`);
    if (!row.bankCode) errors.push(`Row ${index + 1}: Bank code is required`);
    if (!row.amount || row.amount <= 0) errors.push(`Row ${index + 1}: Invalid amount`);

    // Validate account number format (Nigerian banks typically use 10 digits)
    if (row.accountNumber && !/^\d{10}$/.test(row.accountNumber)) {
      errors.push(`Row ${index + 1}: Account number should be 10 digits`);
    }

    // Validate bank code format
    if (row.bankCode && !/^\d{3}$/.test(row.bankCode)) {
      errors.push(`Row ${index + 1}: Bank code should be 3 digits`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}