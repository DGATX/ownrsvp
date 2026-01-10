/**
 * Custom hook for confirmation dialogs
 * Reduces boilerplate for delete confirmations and other destructive actions
 */

import { useState, useCallback } from 'react';

interface UseConfirmationReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  confirm: () => void;
  isConfirming: boolean;
}

/**
 * Hook for managing confirmation dialog state
 *
 * @example
 * const deletion = useConfirmation(async () => {
 *   await fetch(`/api/events/${id}`, { method: 'DELETE' });
 *   router.refresh();
 * });
 *
 * // In component
 * <Button onClick={deletion.open}>Delete</Button>
 *
 * <AlertDialog open={deletion.isOpen} onOpenChange={deletion.close}>
 *   <AlertDialogContent>
 *     <AlertDialogDescription>Are you sure?</AlertDialogDescription>
 *     <AlertDialogAction onClick={deletion.confirm} disabled={deletion.isConfirming}>
 *       {deletion.isConfirming ? 'Deleting...' : 'Delete'}
 *     </AlertDialogAction>
 *   </AlertDialogContent>
 * </AlertDialog>
 */
export function useConfirmation(
  onConfirm: () => void | Promise<void>
): UseConfirmationReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const confirm = useCallback(async () => {
    try {
      setIsConfirming(true);
      await onConfirm();
      setIsOpen(false);
    } finally {
      setIsConfirming(false);
    }
  }, [onConfirm]);

  return {
    isOpen,
    open,
    close,
    confirm,
    isConfirming,
  };
}
