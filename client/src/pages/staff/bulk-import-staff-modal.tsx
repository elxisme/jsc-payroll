import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { parseExcelToJSON } from '@/lib/export-utils';
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

interface ImportStaffData {
  'First Name': string;
  'Last Name': string;
  'Middle Name'?: string;
  'Email': string;
  'Phone Number'?: string;
  'Department Code': string;
  'Position': string;
  'Grade Level': string;
  'Step': string;
  'Employment Date': string;
  'Bank Name'?: string;
  'Account Number'?: string;
  'Account Name'?: string;
}

export function BulkImportStaffModal({ open, onClose, onSuccess }: BulkImportStaffModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportStaffData[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
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
      validateImportData(data as ImportStaffData[]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to parse Excel file',
        variant: 'destructive',
      });
    }
  };

  const validateImportData = (data: ImportStaffData[]) => {
    const errors: string[] = [];
    const departmentCodes = departments?.map(d => d.code.toLowerCase()) || [];

    data.forEach((row, index) => {
      const rowNum = index + 1;
      
      if (!row['First Name']) errors.push(`Row ${rowNum}: First Name is required`);
      if (!row['Last Name']) errors.push(`Row ${rowNum}: Last Name is required`);
      if (!row['Email']) errors.push(`Row ${rowNum}: Email is required`);
      if (!row['Position']) errors.push(`Row ${rowNum}: Position is required`);
      if (!row['Grade Level']) errors.push(`Row ${rowNum}: Grade Level is required`);
      if (!row['Step']) errors.push(`Row ${rowNum}: Step is required`);
      if (!row['Employment Date']) errors.push(`Row ${rowNum}: Employment Date is required`);
      
      // Validate email format
      if (row['Email'] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row['Email'])) {
        errors.push(`Row ${rowNum}: Invalid email format`);
      }
      
      // Validate grade level
      const gradeLevel = parseInt(row['Grade Level']);
      if (isNaN(gradeLevel) || gradeLevel < 1 || gradeLevel > 17) {
        errors.push(`Row ${rowNum}: Grade Level must be between 1-17`);
      }
      
      // Validate step
      const step = parseInt(row['Step']);
      if (isNaN(step) || step < 1 || step > 15) {
        errors.push(`Row ${rowNum}: Step must be between 1-15`);
      }
      
      // Validate department code
      if (row['Department Code'] && !departmentCodes.includes(row['Department Code'].toLowerCase())) {
        errors.push(`Row ${rowNum}: Invalid department code "${row['Department Code']}"`);
      }
      
      // Validate employment date
      if (row['Employment Date'] && isNaN(Date.parse(row['Employment Date']))) {
        errors.push(`Row ${rowNum}: Invalid employment date format`);
      }
    });

    setValidationErrors(errors);
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
      'First Name,Last Name,Middle Name,Email,Phone Number,Department Code,Position,Grade Level,Step,Employment Date,Bank Name,Account Number,Account Name',
      'John,Doe,Middle,john.doe@jsc.gov.ng,08012345678,SC,Justice,15,5,2023-01-15,gtb,1234567890,John Doe',
      'Jane,Smith,,jane.smith@jsc.gov.ng,08087654321,CA,Registrar,12,8,2022-06-01,access,0987654321,Jane Smith',
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
                  <p className="font-medium">Validation Errors:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {validationErrors.slice(0, 10).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li>... and {validationErrors.length - 10} more errors</li>
                    )}
                  </ul>
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