import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logSystemEvent } from '@/lib/audit-logger';
import {
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const addPromotionSchema = z.object({
  staffId: z.string().min(1, 'Staff member is required'),
  oldGradeLevel: z.number().int().min(1).max(17),
  oldStep: z.number().int().min(1).max(15),
  newGradeLevel: z.number().int().min(1).max(17),
  newStep: z.number().int().min(1).max(15),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  promotionType: z.enum(['regular', 'acting', 'temporary', 'demotion']),
  reason: z.string().optional(),
}).refine(data => {
  const oldGL = data.oldGradeLevel;
  const oldStep = data.oldStep;
  const newGL = data.newGradeLevel;
  const newStep = data.newStep;

  if (data.promotionType === 'demotion') {
    return newGL < oldGL || (newGL === oldGL && newStep < oldStep);
  } else { // regular, acting, temporary
    return newGL > oldGL || (newGL === oldGL && newStep > oldStep);
  }
}, {
  message: "New grade/step must be higher than old grade/step for promotion, or lower for demotion.",
  path: ["newGradeLevel"] // This error will be attached to newGradeLevel field
}).refine(data => {
  const effective = new Date(data.effectiveDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to start of day

  return effective >= today;
}, {
  message: "Effective date cannot be in the past.",
  path: ["effectiveDate"]
});

type AddPromotionFormData = z.infer<typeof addPromotionSchema>;

interface AddPromotionModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPromotionModal({ onClose, onSuccess }: AddPromotionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddPromotionFormData>({
    resolver: zodResolver(addPromotionSchema),
    defaultValues: {
      staffId: '',
      oldGradeLevel: 1,
      oldStep: 1,
      newGradeLevel: 1,
      newStep: 1,
      effectiveDate: new Date().toISOString().split('T')[0], // Default to current date
      promotionType: 'regular',
      reason: '',
    },
  });

  const selectedStaffId = form.watch('staffId');

  // Fetch active staff for selection
  const { data: staffMembers, isLoading: staffLoading } = useQuery({
    queryKey: ['active-staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name, staff_id, grade_level, step')
        .eq('status', 'active')
        .order('first_name');

      if (error) throw error;
      return data || [];
    },
  });

  // Effect to pre-fill old grade/step when staff is selected
  useEffect(() => {
    if (selectedStaffId && staffMembers) {
      const selectedStaff = staffMembers.find(s => s.id === selectedStaffId);
      if (selectedStaff) {
        form.setValue('oldGradeLevel', selectedStaff.grade_level);
        form.setValue('oldStep', selectedStaff.step);
        // Also set new to current values initially, user can change
        form.setValue('newGradeLevel', selectedStaff.grade_level);
        form.setValue('newStep', selectedStaff.step);
      }
    }
  }, [selectedStaffId, staffMembers, form]);

  // Create promotion mutation
  const createPromotionMutation = useMutation({
    mutationFn: async (data: AddPromotionFormData) => {
      const { data: promotion, error } = await supabase
        .from('promotions')
        .insert({
          staff_id: data.staffId,
          old_grade_level: data.oldGradeLevel,
          old_step: data.oldStep,
          new_grade_level: data.newGradeLevel,
          new_step: data.newStep,
          effective_date: data.effectiveDate,
          promotion_type: data.promotionType,
          reason: data.reason || null,
          // approved_by and approved_at are null initially, to be set by approval workflow
        })
        .select()
        .single();

      if (error) throw error;

      await logSystemEvent('promotion_created', 'promotions', promotion.id, null, data);

      return promotion;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Promotion added successfully. It is pending approval.',
      });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add promotion',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AddPromotionFormData) => {
    createPromotionMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Add New Promotion</DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-1">
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Promotions added here will be pending approval and will not affect payroll until approved.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="staffId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Staff Member</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={staffLoading ? "Loading staff..." : "Select staff member"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {staffMembers?.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {member.first_name} {member.last_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {member.staff_id} (GL {member.grade_level} S {member.step})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="oldGradeLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Old Grade Level</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...Array(17)].map((_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            GL {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="oldStep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Old Step</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...Array(15)].map((_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            Step {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="newGradeLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Grade Level</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...Array(17)].map((_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            GL {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newStep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Step</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...Array(15)].map((_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            Step {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="effectiveDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="promotionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Promotion Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="regular">Regular Promotion</SelectItem>
                      <SelectItem value="acting">Acting Appointment</SelectItem>
                      <SelectItem value="temporary">Temporary Promotion</SelectItem>
                      <SelectItem value="demotion">Demotion</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Reason for this promotion/demotion..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPromotionMutation.isPending}
                className="bg-nigeria-green hover:bg-green-700"
              >
                {createPromotionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Promotion'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </DialogContent>
  );
}
