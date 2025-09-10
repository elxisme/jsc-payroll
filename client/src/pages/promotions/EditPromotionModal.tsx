import React, { useEffect } from 'react';
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
import { useAuth } from '@/hooks/use-auth';

const editPromotionSchema = z.object({
  staffId: z.string().min(1, 'Staff member is required'),
  oldGradeLevel: z.number().int().min(1).max(17),
  oldStep: z.number().int().min(1).max(15),
  newGradeLevel: z.number().int().min(1).max(17),
  newStep: z.number().int().min(1).max(15),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  promotionType: z.enum(['regular', 'acting', 'temporary', 'demotion']),
  reason: z.string().optional(),
  approvedBy: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
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
  path: ["newGradeLevel"]
}).refine(data => {
  const effective = new Date(data.effectiveDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to start of day

  return effective >= today;
}, {
  message: "Effective date cannot be in the past.",
  path: ["effectiveDate"]
});

type EditPromotionFormData = z.infer<typeof editPromotionSchema>;

interface EditPromotionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  promotion: any;
}

export function EditPromotionModal({ onClose, onSuccess, promotion }: EditPromotionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();

  const form = useForm<EditPromotionFormData>({
    resolver: zodResolver(editPromotionSchema),
    defaultValues: {
      staffId: promotion?.staff_id || '',
      oldGradeLevel: promotion?.old_grade_level || 1,
      oldStep: promotion?.old_step || 1,
      newGradeLevel: promotion?.new_grade_level || 1,
      newStep: promotion?.new_step || 1,
      effectiveDate: promotion?.effective_date || new Date().toISOString().split('T')[0],
      promotionType: promotion?.promotion_type || 'regular',
      reason: promotion?.reason || '',
      approvedBy: promotion?.approved_by || null,
      approvedAt: promotion?.approved_at || null,
    },
  });

  // Reset form when promotion data changes
  useEffect(() => {
    if (promotion) {
      form.reset({
        staffId: promotion.staff_id || '',
        oldGradeLevel: promotion.old_grade_level || 1,
        oldStep: promotion.old_step || 1,
        newGradeLevel: promotion.new_grade_level || 1,
        newStep: promotion.new_step || 1,
        effectiveDate: promotion.effective_date || new Date().toISOString().split('T')[0],
        promotionType: promotion.promotion_type || 'regular',
        reason: promotion.reason || '',
        approvedBy: promotion.approved_by || null,
        approvedAt: promotion.approved_at || null,
      });
    }
  }, [promotion, form]);

  // Fetch active staff for selection (read-only in edit mode)
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

  // Update promotion mutation
  const updatePromotionMutation = useMutation({
    mutationFn: async (data: EditPromotionFormData) => {
      const oldValues = { ...promotion };
      const newValues = {
        staff_id: data.staffId,
        old_grade_level: data.oldGradeLevel,
        old_step: data.oldStep,
        new_grade_level: data.newGradeLevel,
        new_step: data.newStep,
        effective_date: data.effectiveDate,
        promotion_type: data.promotionType,
        reason: data.reason || null,
        approved_by: data.approvedBy,
        approved_at: data.approvedAt,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedPromotion, error } = await supabase
        .from('promotions')
        .update(newValues)
        .eq('id', promotion.id)
        .select()
        .single();

      if (error) throw error;

      await logSystemEvent('promotion_updated', 'promotions', promotion.id, oldValues, newValues);

      return updatedPromotion;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Promotion updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update promotion',
        variant: 'destructive',
      });
    },
  });

  // Approve promotion mutation
  const approvePromotionMutation = useMutation({
    mutationFn: async () => {
      const oldValues = { ...promotion };
      const newValues = {
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: updatedPromotion, error } = await supabase
        .from('promotions')
        .update(newValues)
        .eq('id', promotion.id)
        .select()
        .single();

      if (error) throw error;

      // Update staff's current grade/step if promotion is approved
      const { error: staffUpdateError } = await supabase
        .from('staff')
        .update({
          grade_level: promotion.new_grade_level,
          step: promotion.new_step,
          updated_at: new Date().toISOString(),
        })
        .eq('id', promotion.staff_id);

      if (staffUpdateError) {
        console.error('Failed to update staff grade/step:', staffUpdateError);
        // Optionally, revert promotion approval or log a critical error
      }

      await logSystemEvent('promotion_approved', 'promotions', promotion.id, oldValues, newValues);

      return updatedPromotion;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Promotion approved and staff record updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] }); // Invalidate staff query to reflect changes
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve promotion',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditPromotionFormData) => {
    updatePromotionMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const isApproved = promotion?.approved_by !== null;
  const canApprove = !isApproved && hasRole(['super_admin', 'account_admin']); // Only super_admin or account_admin can approve

  return (
    <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Edit Promotion</DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-1">
        {isApproved && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This promotion has already been approved. Edits may affect historical payroll data.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="staffId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Staff Member</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled>
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
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()} disabled={isApproved}>
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
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()} disabled={isApproved}>
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
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()} disabled={isApproved}>
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
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()} disabled={isApproved}>
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
                    <Input type="date" {...field} disabled={isApproved} />
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={isApproved}>
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
                    <Textarea placeholder="Reason for this promotion/demotion..." rows={3} {...field} disabled={isApproved} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isApproved && (
              <>
                <FormField
                  control={form.control}
                  name="approvedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Approved By</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="approvedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Approved At</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} disabled />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex justify-end space-x-2 pt-4 border-t bg-white sticky bottom-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {!isApproved && (
                <Button
                  type="submit"
                  disabled={updatePromotionMutation.isPending}
                  className="bg-nigeria-green hover:bg-green-700"
                >
                  {updatePromotionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Promotion'
                  )}
                </Button>
              )}
              {canApprove && (
                <Button
                  type="button"
                  onClick={() => approvePromotionMutation.mutate()}
                  disabled={approvePromotionMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {approvePromotionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    'Approve Promotion'
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </DialogContent>
  );
}
