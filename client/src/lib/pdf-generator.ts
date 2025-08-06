import jsPDF from 'jspdf';
// 1. Correctly import the autoTable function from the plugin
import autoTable from 'jspdf-autotable';

// The 'declare module' is no longer necessary with this import style,
// but leaving it won't cause harm. For cleanliness, it could be removed.
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export interface PayslipData {
  id: string;
  period: string;
  basic_salary: string | number;
  allowances: any;
  deductions: any;
  gross_pay: string | number;
  total_deductions: string | number;
  net_pay: string | number;
  created_at: string;
}

export interface StaffData {
  staff_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  position: string;
  grade_level: number;
  step: number;
  departments?: {
    name: string;
    code: string;
  };
  bank_name?: string;
  account_number?: string;
  account_name?: string;
}

/**
 * Generate PDF payslip for a staff member
 */
export async function generatePayslipPDF(payslip: PayslipData, staff: StaffData): Promise<void> {
  const doc = new jsPDF();
  
  // Set up colors
  const primaryColor = [0, 135, 81]; // Nigerian green
  const secondaryColor = [30, 58, 138]; // Government navy
  const textColor = [55, 65, 81]; // Gray-700
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 30, 'F');
  
  // Logo area (placeholder)
  doc.setFillColor(255, 255, 255);
  doc.circle(20, 15, 8, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.text('JSC', 16, 18);
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('JUDICIAL SERVICE COMMITTEE', 40, 15);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('FEDERAL REPUBLIC OF NIGERIA', 40, 22);
  
  // Payslip title
  doc.setTextColor(...textColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', 105, 45, { align: 'center' });
  
  // Period
  const period = formatPeriod(payslip.period);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pay Period: ${period}`, 105, 52, { align: 'center' });
  
  // Staff Information
  const staffInfo = [
    ['Staff ID:', staff.staff_id],
    ['Name:', `${staff.first_name} ${staff.middle_name || ''} ${staff.last_name}`.trim()],
    ['Position:', staff.position],
    ['Department:', staff.departments?.name || 'Unassigned'],
    ['Grade Level:', `GL ${staff.grade_level} Step ${staff.step}`],
  ];
  
  let yPos = 65;
  doc.setFontSize(10);
  
  staffInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 60, yPos);
    yPos += 6;
  });
  
  // Bank Information (if available)
  if (staff.bank_name && staff.account_number) {
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Bank Details:', 20, yPos);
    yPos += 6;
    
    const bankInfo = [
      ['Bank:', staff.bank_name.toUpperCase()],
      ['Account No:', staff.account_number],
      ['Account Name:', staff.account_name || ''],
    ];
    
    bankInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 25, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 60, yPos);
      yPos += 6;
    });
  }
  
  // Earnings and Deductions Table
  yPos += 10;
  
  const tableData = [];
  
  // Add basic salary
  tableData.push(['Basic Salary', '', formatCurrency(payslip.basic_salary)]);
  
  // Add allowances
  if (payslip.allowances) {
    const allowances = typeof payslip.allowances === 'string' 
      ? JSON.parse(payslip.allowances) 
      : payslip.allowances;
    
    Object.entries(allowances).forEach(([key, value]) => {
      if (value && Number(value) > 0) {
        tableData.push([formatAllowanceName(key), '', formatCurrency(Number(value))]);
      }
    });
  }
  
  // Add gross pay
  tableData.push(['', 'GROSS PAY', formatCurrency(payslip.gross_pay)]);
  
  // Add deductions
  if (payslip.deductions) {
    const deductions = typeof payslip.deductions === 'string' 
      ? JSON.parse(payslip.deductions) 
      : payslip.deductions;
    
    Object.entries(deductions).forEach(([key, value]) => {
      if (value && Number(value) > 0) {
        tableData.push(['', formatDeductionName(key), `-${formatCurrency(Number(value))}`]);
      }
    });
  }
  
  // Add totals
  tableData.push(['', 'TOTAL DEDUCTIONS', `-${formatCurrency(payslip.total_deductions)}`]);
  tableData.push(['', 'NET PAY', formatCurrency(payslip.net_pay)]);
  
  // 2. FIX: Call autoTable as a function, passing the doc instance
  autoTable(doc, {
    startY: yPos,
    head: [['EARNINGS', 'DEDUCTIONS', 'AMOUNT (₦)']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 70 },
      2: { cellWidth: 50, halign: 'right' },
    },
    didParseCell: function(data: any) {
      // Style specific rows
      if (data.cell.text[0] === 'GROSS PAY' || 
          data.cell.text[0] === 'TOTAL DEDUCTIONS' || 
          data.cell.text[0] === 'NET PAY') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
      
      if (data.cell.text[0] === 'NET PAY') {
        data.cell.styles.fillColor = [220, 252, 231]; // Light green
        data.cell.styles.textColor = primaryColor;
      }
    },
  });
  
  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 100;
  
  // Generated date and time
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Gray-500
  const now = new Date();
  const generatedText = `Generated on: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;
  doc.text(generatedText, 20, finalY + 20);
  
  // Signature area
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text('_________________________', 20, finalY + 40);
  doc.text('Authorized Signature', 20, finalY + 47);
  
  doc.text('_________________________', 120, finalY + 40);
  doc.text('HR Manager', 120, finalY + 47);
  
  // Page number
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.text(`Page 1 of ${pageCount}`, 190, 285, { align: 'right' });
  
  // Download the PDF
  const fileName = `payslip_${staff.staff_id}_${payslip.period}.pdf`;
  doc.save(fileName);
}

/**
 * Generate bulk payslips PDF for multiple staff
 */
export async function generateBulkPayslipsPDF(
  payslips: PayslipData[],
  staffData: Record<string, StaffData>,
  period: string
): Promise<void> {
  const doc = new jsPDF();
  
  for (let i = 0; i < payslips.length; i++) {
    const payslip = payslips[i];
    const staff = staffData[payslip.id];
    
    if (!staff) continue;
    
    if (i > 0) {
      doc.addPage();
    }
    
    // Generate individual payslip content
    await generatePayslipContent(doc, payslip, staff);
  }
  
  const fileName = `bulk_payslips_${period}.pdf`;
  doc.save(fileName);
}

/**
 * Generate payroll summary report PDF
 */
export async function generatePayrollSummaryPDF(
  summaryData: any,
  period: string
): Promise<void> {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(0, 135, 81);
  doc.rect(0, 0, 210, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYROLL SUMMARY REPORT', 105, 18, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${formatPeriod(period)}`, 105, 25, { align: 'center' });
  
  // Summary statistics
  const summaryStats = [
    ['Total Staff:', summaryData.totalStaff?.toLocaleString() || '0'],
    ['Gross Amount:', formatCurrency(summaryData.grossAmount || 0)],
    ['Total Deductions:', formatCurrency(summaryData.totalDeductions || 0)],
    ['Net Amount:', formatCurrency(summaryData.netAmount || 0)],
  ];
  
  let yPos = 50;
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(12);
  
  summaryStats.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 30, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 100, yPos);
    yPos += 8;
  });
  
  // Department breakdown table if available
  if (summaryData.departments && summaryData.departments.length > 0) {
    yPos += 10;
    
    const departmentData = summaryData.departments.map((dept: any) => [
      dept.name,
      dept.staffCount?.toString() || '0',
      formatCurrency(dept.grossAmount || 0),
      formatCurrency(dept.netAmount || 0),
    ]);
    
    // 3. FIX: Call autoTable as a function, passing the doc instance
    autoTable(doc, {
      startY: yPos,
      head: [['Department', 'Staff Count', 'Gross Amount', 'Net Amount']],
      body: departmentData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 135, 81],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
    });
  }
  
  const fileName = `payroll_summary_${period}.pdf`;
  doc.save(fileName);
}

/**
 * Generate staff analytics report PDF
 */
export async function generateStaffReportPDF(staffData: any[]): Promise<void> {
  const doc = new jsPDF();
  
  // Header
  const primaryColor = [0, 135, 81]; // Nigerian green
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 30, 'F');
  
  // Logo area (placeholder)
  doc.setFillColor(255, 255, 255);
  doc.circle(20, 15, 8, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.text('JSC', 16, 18);
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('STAFF ANALYTICS REPORT', 105, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Judicial Service Committee', 105, 22, { align: 'center' });
  
  // Report date
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 40, { align: 'center' });
  
  // Summary statistics
  const totalStaff = staffData.length;
  const activeStaff = staffData.filter(s => s.status === 'active').length;
  const departments = Array.from(new Set(staffData.map(s => s.departments?.name).filter(Boolean)));
  const avgGradeLevel = staffData.reduce((sum, s) => sum + s.grade_level, 0) / totalStaff;
  
  let yPos = 55;
  
  // Summary section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', 20, yPos);
  yPos += 10;
  
  const summaryData = [
    ['Total Staff:', totalStaff.toString()],
    ['Active Staff:', activeStaff.toString()],
    ['Departments:', departments.length.toString()],
    ['Average Grade Level:', avgGradeLevel.toFixed(1)],
  ];
  
  doc.setFontSize(10);
  summaryData.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 80, yPos);
    yPos += 6;
  });
  
  yPos += 10;
  
  // Staff breakdown by department
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DEPARTMENT BREAKDOWN', 20, yPos);
  yPos += 10;
  
  const departmentBreakdown = departments.map(dept => {
    const deptStaff = staffData.filter(s => s.departments?.name === dept);
    return [
      dept,
      deptStaff.length.toString(),
      deptStaff.filter(s => s.status === 'active').length.toString(),
      (deptStaff.reduce((sum, s) => sum + s.grade_level, 0) / deptStaff.length).toFixed(1),
    ];
  });
  
  // 4. FIX: Call autoTable as a function, passing the doc instance
  autoTable(doc, {
    startY: yPos,
    head: [['Department', 'Total Staff', 'Active Staff', 'Avg Grade Level']],
    body: departmentBreakdown,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
    },
  });
  
  // Add new page for detailed staff list
  doc.addPage();
  
  // Header for second page
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILED STAFF LIST', 105, 12, { align: 'center' });
  
  // Staff table
  const staffTableData = staffData.map(staff => [
    staff.staff_id,
    `${staff.first_name} ${staff.last_name}`,
    staff.departments?.name || 'Unassigned',
    staff.position,
    `GL${staff.grade_level} S${staff.step}`,
    formatStatus(staff.status),
  ]);
  
  // 5. FIX: Call autoTable as a function, passing the doc instance
  autoTable(doc, {
    startY: 30,
    head: [['Staff ID', 'Name', 'Department', 'Position', 'Grade/Step', 'Status']],
    body: staffTableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 40 },
      2: { cellWidth: 35 },
      3: { cellWidth: 35 },
      4: { cellWidth: 20 },
      5: { cellWidth: 25 },
    },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
  }
  
  const fileName = `staff_analytics_report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

// Helper functions
function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatAllowanceName(key: string): string {
  const names: Record<string, string> = {
    housing: 'Housing Allowance',
    transport: 'Transport Allowance',
    medical: 'Medical Allowance',
    leave: 'Leave Allowance',
    responsibility: 'Responsibility Allowance',
    hazard: 'Hazard Allowance',
    rural: 'Rural Posting Allowance',
    entertainment: 'Entertainment Allowance',
  };
  return names[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function formatDeductionName(key: string): string {
  const names: Record<string, string> = {
    paye: 'PAYE Tax',
    pension: 'Pension (8%)',
    nhf: 'NHF (2.5%)',
    insurance: 'Life Insurance',
    union: 'Union Dues',
    loans: 'Loan Repayment',
    cooperatives: 'Cooperative Deduction',
    loan_repayment: 'Loan Repayment',
    salary_advance: 'Salary Advance',
    fine: 'Fine/Penalty',
    cooperative: 'Cooperative Deduction',
  };
  return names[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

// Internal function to generate payslip content
async function generatePayslipContent(doc: jsPDF, payslip: PayslipData, staff: StaffData): Promise<void> {
  // Set up colors
  const primaryColor = [0, 135, 81]; // Nigerian green
  const secondaryColor = [30, 58, 138]; // Government navy
  const textColor = [55, 65, 81]; // Gray-700
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 30, 'F');
  
  // Logo area (placeholder)
  doc.setFillColor(255, 255, 255);
  doc.circle(20, 15, 8, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.text('JSC', 16, 18);
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('JUDICIAL SERVICE COMMITTEE', 40, 15);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('FEDERAL REPUBLIC OF NIGERIA', 40, 22);
  
  // Payslip title
  doc.setTextColor(...textColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', 105, 45, { align: 'center' });
  
  // Period
  const period = formatPeriod(payslip.period);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pay Period: ${period}`, 105, 52, { align: 'center' });
  
  // Staff Information
  const staffInfo = [
    ['Staff ID:', staff.staff_id],
    ['Name:', `${staff.first_name} ${staff.middle_name || ''} ${staff.last_name}`.trim()],
    ['Position:', staff.position],
    ['Department:', staff.departments?.name || 'Unassigned'],
    ['Grade Level:', `GL ${staff.grade_level} Step ${staff.step}`],
  ];
  
  let yPos = 65;
  doc.setFontSize(10);
  
  staffInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 60, yPos);
    yPos += 6;
  });
  
  // Bank Information (if available)
  if (staff.bank_name && staff.account_number) {
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Bank Details:', 20, yPos);
    yPos += 6;
    
    const bankInfo = [
      ['Bank:', staff.bank_name.toUpperCase()],
      ['Account No:', staff.account_number],
      ['Account Name:', staff.account_name || ''],
    ];
    
    bankInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 25, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 60, yPos);
      yPos += 6;
    });
  }
  
  // Earnings and Deductions Table
  yPos += 10;
  
  const tableData = [];
  
  // Add basic salary
  tableData.push(['Basic Salary', '', formatCurrency(payslip.basic_salary)]);
  
  // Add allowances
  if (payslip.allowances) {
    const allowances = typeof payslip.allowances === 'string' 
      ? JSON.parse(payslip.allowances) 
      : payslip.allowances;
    
    Object.entries(allowances).forEach(([key, value]) => {
      if (value && Number(value) > 0) {
        tableData.push([formatAllowanceName(key), '', formatCurrency(Number(value))]);
      }
    });
  }
  
  // Add gross pay
  tableData.push(['', 'GROSS PAY', formatCurrency(payslip.gross_pay)]);
  
  // Add deductions
  if (payslip.deductions) {
    const deductions = typeof payslip.deductions === 'string' 
      ? JSON.parse(payslip.deductions) 
      : payslip.deductions;
    
    Object.entries(deductions).forEach(([key, value]) => {
      if (value && Number(value) > 0) {
        tableData.push(['', formatDeductionName(key), `-${formatCurrency(Number(value))}`]);
      }
    });
  }
  
  // Add totals
  tableData.push(['', 'TOTAL DEDUCTIONS', `-${formatCurrency(payslip.total_deductions)}`]);
  tableData.push(['', 'NET PAY', formatCurrency(payslip.net_pay)]);
  
  // 6. FIX: Call autoTable as a function, passing the doc instance
  autoTable(doc, {
    startY: yPos,
    head: [['EARNINGS', 'DEDUCTIONS', 'AMOUNT (₦)']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 70 },
      2: { cellWidth: 50, halign: 'right' },
    },
    didParseCell: function(data: any) {
      // Style specific rows
      if (data.cell.text[0] === 'GROSS PAY' || 
          data.cell.text[0] === 'TOTAL DEDUCTIONS' || 
          data.cell.text[0] === 'NET PAY') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
      
      if (data.cell.text[0] === 'NET PAY') {
        data.cell.styles.fillColor = [220, 252, 231]; // Light green
        data.cell.styles.textColor = primaryColor;
      }
    },
  });
  
  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 100;
  
  // Generated date and time
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Gray-500
  const now = new Date();
  const generatedText = `Generated on: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;
  doc.text(generatedText, 20, finalY + 20);
  
  // Signature area
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  doc.text('_________________________', 20, finalY + 40);
  doc.text('Authorized Signature', 20, finalY + 47);
  
  doc.text('_________________________', 120, finalY + 40);
  doc.text('HR Manager', 120, finalY + 47);
  
  // Page number
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.text(`Page 1 of ${pageCount}`, 190, 285, { align: 'right' });
}

// This helper function was missing from your original code, but is used in generateStaffReportPDF
function formatStatus(status: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}