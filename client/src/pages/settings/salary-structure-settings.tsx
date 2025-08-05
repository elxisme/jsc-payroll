import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logSystemEvent } from '@/lib/audit-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Scale, Edit, Loader2, Download, Upload } from 'lucide-react';
import { exportSalaryStructureToExcel } from '@/lib/export-utils';

const editSalarySchema = z.object({
  basicSalary: z.number().min(1, 'Basic salary must be greater than 0'),
});

type EditSalaryFormData = z.infer<typeof editSalarySchema>;

interface SalaryStructureItem {
  id: string;
  grade_level: number;
  step: number;
  basic_salary: string;
}

export function SalaryStructureSettings() {
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<SalaryStructureItem | null>(null);
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditSalaryFormData>({
    resolver: zodResolver(editSalarySchema),
    defaultValues: {
      basicSalary: 0,
    },
  });

  // Fetch salary structure
  const { data: salaryStructure, isLoading } = useQuery({
    queryKey: ['salary-structure', gradeLevelFilter],
    queryFn: async () => {
      let query = supabase
        .from('salary_structure')
        .select('*')
        .order('grade_level')
        .order('step');

      if (gradeLevelFilter !== 'all') {
        query = query.eq('grade_level', parseInt(gradeLevelFilter));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Reset form when selected salary changes
  React.useEffect(() => {
    if (selectedSalary) {
      form.reset({
        basicSalary: parseFloat(selectedSalary.basic_salary),
      });
    }
  }, [selectedSalary, form]);

  // Update salary mutation
  const updateSalaryMutation = useMutation({
    mutationFn: async (data: EditSalaryFormData) => {
      if (!selectedSalary) throw new Error('No salary selected');

      const oldValues = {
        basic_salary: selectedSalary.basic_salary,
      };

      const newValues = {
        basic_salary: data.basicSalary.toString(),
        updated_at: new Date().toISOString(),
      };

      const { data: updatedSalary, error } = await supabase
        .from('salary_structure')
        .update(newValues)
        .eq('id', selectedSalary.id)
        .select()
        .single();

      if (error) throw error;

      // Log the update for audit trail
      await logSystemEvent(
        'salary_structure_updated',
        'salary_structure',
        selectedSalary.id,
        oldValues,
        newValues
      );

      return updatedSalary;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Salary structure updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['salary-structure'] });
      setShowEditModal(false);
      setSelectedSalary(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update salary structure',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditSalaryFormData) => {
    updateSalaryMutation.mutate(data);
  };

  const handleEdit = (salary: SalaryStructureItem) => {
    setSelectedSalary(salary);
    setShowEditModal(true);
  };

  const handleExportExcel = async () => {
    if (!salaryStructure?.length) {
      toast({
        title: 'Error',
        description: 'No salary structure data to export',
        variant: 'destructive',
      });
      return;
    }

    try {
      const exportData = salaryStructure.map(item => ({
        'Grade Level': item.grade_level,
        'Step': item.step,
        'Basic Salary (NGN)': parseFloat(item.basic_salary),
      }));

      await exportSalaryStructureToExcel(exportData, 'conjuss_salary_structure.xlsx');
      
      toast({
        title: 'Success',
        description: 'Salary structure exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export salary structure',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleClose = () => {
    form.reset();
    setShowEditModal(false);
    setSelectedSalary(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Scale className="h-5 w-5" />
              <span>CONJUSS Salary Structure</span>
            </CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={!salaryStructure?.length}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter Controls */}
          <div className="mb-6 flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Filter by Grade Level:</label>
            <select
              value={gradeLevelFilter}
              onChange={(e) => setGradeLevelFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-nigeria-green focus:border-nigeria-green"
            >
              <option value="all">All Grade Levels</option>
              {[...Array(17)].map((_, i) => (
                <option key={i + 1} value={(i + 1).toString()}>
                  Grade Level {i + 1}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="rounded bg-gray-200 h-8 w-16"></div>
                  <div className="rounded bg-gray-200 h-8 w-16"></div>
                  <div className="rounded bg-gray-200 h-8 w-32"></div>
                  <div className="rounded bg-gray-200 h-8 w-16"></div>
                </div>
              ))}
            </div>
          ) : salaryStructure && salaryStructure.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grade Level</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Basic Salary</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryStructure.map((salary) => (
                    <TableRow key={salary.id}>
                      <TableCell>
                        <Badge variant="outline">GL {salary.grade_level}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Step {salary.step}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(salary.basic_salary)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(salary)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Scale className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No salary structure data found</p>
              <p className="text-sm">Run the database schema to populate CONJUSS data</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Salary Modal */}
      <Dialog open={showEditModal} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Salary - GL {selectedSalary?.grade_level} Step {selectedSalary?.step}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="basicSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Basic Salary (NGN)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Current CONJUSS Guidelines:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Grade Levels 1-17 represent different job classifications</li>
                  <li>• Steps 1-15 represent progression within each grade</li>
                  <li>• Salary increases should follow government guidelines</li>
                  <li>• Changes affect all staff at this grade/step combination</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateSalaryMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {updateSalaryMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Salary'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}