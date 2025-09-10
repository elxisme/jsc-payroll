import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { logSystemEvent } from '@/lib/audit-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Scale, Loader2, Calendar, User, TrendingUp } from 'lucide-react';
import { AddPromotionModal } from './AddPromotionModal';
import { EditPromotionModal } from './EditPromotionModal';

export default function PromotionsManagement() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch promotions
  const { data: promotions, isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          staff (
            id,
            first_name,
            last_name,
            staff_id
          ),
          approved_by_user:users!promotions_approved_by_fkey (
            email
          )
        `)
        .order('effective_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Delete promotion mutation
  const deletePromotionMutation = useMutation({
    mutationFn: async (promotionId: string) => {
      const { data: promotionData } = await supabase
        .from('promotions')
        .select('*')
        .eq('id', promotionId)
        .single();

      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promotionId);

      if (error) throw error;

      if (promotionData) {
        await logSystemEvent('promotion_deleted', 'promotions', promotionId, promotionData, null);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Promotion deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete promotion',
        variant: 'destructive',
      });
    },
  });

  const formatPromotionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="w-full sm:w-auto">
            <h1 className="text-responsive-xl font-bold text-gray-900 mb-2">Promotions Management</h1>
            <p className="text-gray-600">Manage staff grade level and step changes</p>
          </div>
          <div className="w-full sm:w-auto">
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto bg-nigeria-green hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Promotion
                </Button>
              </DialogTrigger>
              <AddPromotionModal
                onClose={() => setShowAddModal(false)}
                onSuccess={() => {
                  setShowAddModal(false);
                  queryClient.invalidateQueries({ queryKey: ['promotions'] });
                }}
              />
            </Dialog>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Promotion History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : promotions && promotions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Old Grade/Step</TableHead>
                  <TableHead>New Grade/Step</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {promotion.staff?.first_name} {promotion.staff?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {promotion.staff?.staff_id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        GL {promotion.old_grade_level} S {promotion.old_step}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        GL {promotion.new_grade_level} S {promotion.new_step}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(promotion.effective_date)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {formatPromotionType(promotion.promotion_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {promotion.approved_by_user?.email || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Dialog open={showEditModal && selectedPromotion?.id === promotion.id} onOpenChange={setShowEditModal}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPromotion(promotion);
                                  setShowEditModal(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit promotion</p>
                            </TooltipContent>
                          </Tooltip>
                          {selectedPromotion && selectedPromotion.id === promotion.id && (
                            <EditPromotionModal
                              promotion={selectedPromotion}
                              onClose={() => setShowEditModal(false)}
                              onSuccess={() => {
                                setShowEditModal(false);
                                queryClient.invalidateQueries({ queryKey: ['promotions'] });
                              }}
                            />
                          )}
                        </Dialog>

                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete promotion</p>
                            </TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Promotion</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this promotion record for {promotion.staff?.first_name} {promotion.staff?.last_name} (GL {promotion.old_grade_level} S {promotion.old_step} to GL {promotion.new_grade_level} S {promotion.new_step})? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deletePromotionMutation.mutate(promotion.id)}
                                disabled={deletePromotionMutation.isPending}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {deletePromotionMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  'Delete'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Scale className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No promotion records found</p>
              <p className="text-sm">Add a new promotion to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
