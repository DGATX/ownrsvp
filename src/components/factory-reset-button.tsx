'use client';
import { logger } from '@/lib/logger';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function FactoryResetButton() {
  const { toast } = useToast();
  const router = useRouter();
  const [isFirstDialogOpen, setIsFirstDialogOpen] = useState(false);
  const [isSecondDialogOpen, setIsSecondDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleFirstConfirm = () => {
    setIsFirstDialogOpen(false);
    setIsSecondDialogOpen(true);
  };

  const handleReset = async () => {
    if (confirmationText.toLowerCase() !== 'delete') {
      toast({
        title: 'Invalid confirmation',
        description: 'Please type "delete" to confirm.',
        variant: 'destructive',
      });
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/admin/factory-reset', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset to factory defaults');
      }

      toast({
        title: 'Factory Reset Complete',
        description: 'All data has been deleted. You will now create a new admin account.',
      });

      // Sign out and redirect to register page for fresh admin setup
      setTimeout(async () => {
        await signOut({ callbackUrl: `${window.location.origin}/register` });
      }, 2000);
    } catch (error) {
      logger.error('Factory reset error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset to factory defaults',
        variant: 'destructive',
      });
      setIsResetting(false);
      setIsSecondDialogOpen(false);
      setConfirmationText('');
    }
  };

  const isDeleteTyped = confirmationText.toLowerCase() === 'delete';

  return (
    <>
      <Button
        onClick={() => setIsFirstDialogOpen(true)}
        className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
      >
        <RotateCcw className="w-4 h-4" />
        Factory Reset
      </Button>

      {/* First Confirmation Dialog */}
      <Dialog open={isFirstDialogOpen} onOpenChange={setIsFirstDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Factory Reset - First Confirmation
            </DialogTitle>
            <DialogDescription>
              This action will permanently delete ALL data from the application.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-md">
              <p className="text-sm font-semibold text-destructive mb-2">
                The following will be deleted:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>All users (including all administrators)</li>
                <li>All events</li>
                <li>All guests and RSVPs</li>
                <li>All comments</li>
                <li>All email and SMS configuration</li>
                <li>All other application data</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-md">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                After reset:
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                You will be redirected to create a new admin account, just like a fresh installation.
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-md">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                Warning:
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                This action cannot be undone. All data will be permanently deleted.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsFirstDialogOpen(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleFirstConfirm}
              disabled={isResetting}
            >
              Continue to Final Confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Second Confirmation Dialog - Type "delete" */}
      <Dialog open={isSecondDialogOpen} onOpenChange={setIsSecondDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Factory Reset - Final Confirmation
            </DialogTitle>
            <DialogDescription>
              Type <strong>&quot;delete&quot;</strong> in the field below to confirm you want to reset to factory defaults.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirmation">Type &quot;delete&quot; to confirm:</Label>
              <Input
                id="confirmation"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="delete"
                disabled={isResetting}
                autoFocus
                className="font-mono"
              />
            </div>

            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md">
              <p className="text-xs text-destructive font-medium">
                This is your last chance to cancel. Once confirmed, all data will be permanently deleted.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsSecondDialogOpen(false);
                setConfirmationText('');
              }}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={!isDeleteTyped || isResetting}
              className="gap-2"
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Confirm Factory Reset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

