import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { parseExcelToJSON } from '@/lib/export-utils';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, FileSpreadsheet, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BulkImportStaffModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Enhanced validation schema for staff import
const staffRowSchema = z.object({
  'First Name': z.string().min(1, 'First Name is required'),
  'Last Name': z.string().min(1, 'Last Name is required'),
  'Middle Name': z.string().optional(),
  'Email': z.string().email('Invalid email format'),
  'Phone Number': z.string().optional().refine(
    (val) => !val || /^\+?[\d\s\-\(\)]{10,15}$/.test(val),
    'Invalid phone number format (10-15 digits)'
  ),
  'Department Code': z.string().min(1, 'Department Code is required'),
  'Position': z.string().min(1, 'Position is required'),
  'Grade Level': z.preprocess(
    (val) => val === '' ? undefined : Number(val),
    z.number().int().min(1, 'Grade Level must be between 1-17').max(17, 'Grade Level must be between 1-17')
  ),
  'Step': z.preprocess(
    (val) => val === '' ? undefined : Number(val),
    z.number().int().min(1, 'Step must be between 1-15').max(15, 'Step must be between 1-15')
  ),
  'Employment Date': z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Employment Date must be in YYYY-MM-DD format'
  ),
  'Bank Name': z.enum([
    'access', 'zenith', 'gtb', 'firstbank', 'uba', 'fidelity', 'union',
    'stanbic', 'polaris', 'wema', 'sterling', 'unity', 'ecobank', 'keystone',
    'titan', 'globus', 'providus', 'suntrust', 'parallex', 'premium', 'taj', 'jaiz', ''
  ]).optional(),
  'Account Number': z.string().optional().refine(
    (val) => !val || /^\d{10}$/.test(val),
    'Account number must be exactly 10 digits'
  ),
  'Account Name': z.string().optional(),
});

type ImportStaffData = z.infer<typeof staffRowSchema>;

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export function BulkImportStaffModal({ open, onClose, onSuccess }: BulkImportStaffModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportStaffData[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [duplicateEmails, setDuplicateEmails] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch departments for validation
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, code');
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast({
        title: 'Error',
        description: 'Please select an Excel file (.xlsx or .xls)',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    
    try {
      const data = await parseExcelToJSON(selectedFile);
      setImportData(data as ImportStaffData[]);
      await validateImportData(data as ImportStaffData[]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to parse Excel file',
        variant: 'destructive',
      });
    }
  };

  const validateImportData = async (data: ImportStaffData[]) => {
    const errors: ValidationError[] = [];
    const departmentCodes = departments?.map(d => d.code.toLowerCase()) || [];
    const emailsInFile = new Set<string>();
    const duplicatesInFile: string[] = [];

    // Check for existing emails in database
    const emails = data.map(row => row['Email']).filter(Boolean);
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('email')
      .in('email', emails);
    
    const existingEmails = new Set(existingStaff?.map(s => s.email.toLowerCase()) || []);
    data.forEach((row, index) => {
      const rowNum = index + 1;
      
      // Validate using Zod schema
      const result = staffRowSchema.safeParse(row);
      if (!result.success) {
        result.error.errors.forEach(error => {
          errors.push({
            row: rowNum,
            field: error.path[0] as string,
            message: error.message,
          });
        });
      }
      
      // Check for duplicate emails within the file
      const email = row['Email']?.toLowerCase();
      if (email) {
        if (emailsInFile.has(email)) {
          duplicatesInFile.push(email);
          errors.push({
            row: rowNum,
            field: 'Email',
            message: 'Duplicate email within import file',
          });
        } else {
          emailsInFile.add(email);
        }
        
        // Check if email already exists in database
        if (existingEmails.has(email)) {
          errors.push({
            row: rowNum,
            field: 'Email',
            message: 'Email already exists in database',
          });
        }
      }
      
      // Additional business logic validations
      if (row['Department Code'] && !departmentCodes.includes(row['Department Code'].toLowerCase())) {
        errors.push({
          row: rowNum,
          field: 'Department Code',
          message: `Department code "${row['Department Code']}" does not exist`,
        });
      }
      
      // Validate employment date is not in the future
      if (row['Employment Date']) {
        const empDate = new Date(row['Employment Date']);
        const today = new Date();
        if (empDate > today) {
          errors.push({
            row: rowNum,
            field: 'Employment Date',
            message: 'Employment date cannot be in the future',
          });
        }
      }
      
      // Validate bank details consistency
      const hasAnyBankInfo = row['Bank Name'] || row['Account Number'] || row['Account Name'];
      if (hasAnyBankInfo) {
        if (!row['Bank Name']) {
          errors.push({
            row: rowNum,
            field: 'Bank Name',
            message: 'Bank Name is required when bank details are provided',
          });
        }
        if (!row['Account Number']) {
          errors.push({
            row: rowNum,
            field: 'Account Number',
            message: 'Account Number is required when bank details are provided',
          });
        }
        if (!row['Account Name']) {
          errors.push({
            row: rowNum,
            field: 'Account Name',
            message: 'Account Name is required when bank details are provided',
          });
        }
      }
    });

    setValidationErrors(errors);
    setDuplicateEmails(duplicatesInFile);
  };

  // Generate staff ID
  const generateStaffId = async (index: number) => {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('staff')
      .select('id', { count: 'exact' });
    
    const nextNumber = (count || 0) + index + 1;
    return `JSC/${year}/${nextNumber.toString().padStart(5, '0')}`;
  };

  // Process import mutation
  const processImportMutation = useMutation({
    mutationFn: async () => {
      if (validationErrors.length > 0) {
        throw new Error('Please fix validation errors before importing');
      }

      const staffToInsert = [];
      
      for (let i = 0; i < importData.length; i++) {
        const row = importData[i];
        const department = departments?.find(d => 
          d.code.toLowerCase() === row['Department Code']?.toLowerCase()
        );
        
        const staffId = await generateStaffId(i);
        
        staffToInsert.push({
          staff_id: staffId,
          first_name: row['First Name'],
          last_name: row['Last Name'],
          middle_name: row['Middle Name'] || null,
          email: row['Email'],
          phone_number: row['Phone Number'] || null,
          department_id: department?.id || null,
          position: row['Position'],
          grade_level: parseInt(row['Grade Level']),
          step: parseInt(row['Step']),
          employment_date: new Date(row['Employment Date']).toISOString(),
          bank_name: row['Bank Name'] || null,
          account_number: row['Account Number'] || null,
          account_name: row['Account Name'] || null,
          status: 'active',
        });
      }

      const { data, error } = await supabase
        .from('staff')
        .insert(staffToInsert)
        .select();

      if (error) throw error;

      // Create notification for admins
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .in('role', ['super_admin', 'payroll_admin']);

      if (adminUsers?.length) {
        const notifications = adminUsers.map(admin => ({
          user_id: admin.id,
          title: 'Bulk Staff Import Completed',
          message: `${data.length} staff members have been successfully imported into the system.`,
          type: 'success',
        }));

        await supabase
          .from('notifications')
          .insert(notifications);
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Successfully imported ${data.length} staff members`,
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import staff data',
        variant: 'destructive',
      });
    },
  });

  const handleDownloadTemplate = () => {
    // Create a simple CSV template
    const template = [
      'First Name,Last Name,Middle Name,Email,Phone Number,Department Code,Position,Grade Level,Step,Employment Date,Bank Name,Account Number,Account Name,Pension PIN,Tax ID,Next of Kin',
      'John,Doe,Middle,john.doe@jsc.gov.ng,08012345678,SC,Justice,15,5,2023-01-15,gtb,1234567890,John Doe,PEN123456,TIN789012,"{""name"":""Jane Doe"",""relationship"":""Spouse"",""phone"":""08098765432""}"',
      'Jane,Smith,,jane.smith@jsc.gov.ng,08087654321,CA,Registrar,12,8,2022-06-01,access,0987654321,Jane Smith,PEN654321,TIN345678,"{""name"":""John Smith"",""relationship"":""Brother"",""phone"":""08076543210""}"',
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setFile(null);
    setImportData([]);
    setValidationErrors([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Staff</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="file-upload">Upload Excel File</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>
            
            <div className="flex items-center space-x-4">
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="flex-1"
              />
              {file && (
                <Badge variant="outline" className="flex items-center space-x-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>{file.name}</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Validation Errors ({validationErrors.length}):</p>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {validationErrors.slice(0, 15).map((error, index) => (
                        <li key={index}>
                          <strong>Row {error.row}</strong> - {error.field}: {error.message}
                        </li>
                      ))}
                      {validationErrors.length > 15 && (
                        <li className="text-gray-600">... and {validationErrors.length - 15} more errors</li>
                      )}
                    </ul>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    <p>💡 <strong>Tips:</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Ensure all required fields are filled</li>
                      <li>Use YYYY-MM-DD format for dates</li>
                      <li>Grade Level: 1-17, Step: 1-15</li>
                      <li>Account numbers must be exactly 10 digits</li>
                      <li>Department codes must match existing departments</li>
                      <li>Bank Name should match: access, zenith, gtb, firstbank, uba, fidelity, union, stanbic, polaris, wema, sterling, unity, ecobank, keystone, titan, globus, providus, suntrust, parallex, premium, taj, jaiz</li>
                      <li>Save as .xlsx and upload through the system</li>
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Duplicate Emails Warning */}
          {duplicateEmails.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Duplicate Emails Found:</p>
                  <ul className="list-disc list-inside text-sm">
                    {duplicateEmails.map((email, index) => (
                      <li key={index}>{email}</li>
                    ))}
                  </ul>
                  <p className="text-xs mt-2">Each email address must be unique.</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {importData.length > 0 && validationErrors.length === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Ready to import {importData.length} staff members. All validation checks passed.
              </AlertDescription>
            </Alert>
          )}

          {/* Data Preview */}
          {importData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium">Data Preview ({importData.length} records)</h4>
                <Button
                  onClick={() => processImportMutation.mutate()}
                  disabled={validationErrors.length > 0 || processImportMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {processImportMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Staff
                    </>
                  )}
                </Button>
              </div>

              <div className="border rounded-lg max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Grade Level</TableHead>
                      <TableHead>Employment Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.slice(0, 10).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {row['First Name']} {row['Middle Name'] || ''} {row['Last Name']}
                        </TableCell>
                        <TableCell>{row['Email']}</TableCell>
                        <TableCell>{row['Department Code']}</TableCell>
                        <TableCell>{row['Position']}</TableCell>
                        <TableCell>GL {row['Grade Level']} Step {row['Step']}</TableCell>
                        <TableCell>{row['Employment Date']}</TableCell>
                      </TableRow>
                    ))}
                    {importData.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500">
                          ... and {importData.length - 10} more records
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Instructions */}
          {importData.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8 text-gray-400" />
              </div>
              <p className="font-medium">Upload an Excel file to import staff data</p>
              <p className="text-sm mt-2">
                Download the template to see the required format and column headers
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}