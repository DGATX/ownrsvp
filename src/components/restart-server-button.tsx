'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface RestartMethod {
  type: 'pm2' | 'docker' | 'systemd' | 'graceful' | 'unsupported';
  description?: string;
  command?: string;
}

export function RestartServerButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartMethod, setRestartMethod] = useState<RestartMethod | null>(null);
  const [isLoadingMethod, setIsLoadingMethod] = useState(true);

  useEffect(() => {
    loadRestartMethod();
  }, []);

  async function loadRestartMethod() {
    setIsLoadingMethod(true);
    try {
      const response = await fetch('/api/admin/restart');
      if (response.ok) {
        const data = await response.json();
        setRestartMethod(data.method);
      }
    } catch (error) {
      logger.error('Failed to load restart method:', error);
    } finally {
      setIsLoadingMethod(false);
    }
  }

  async function handleRestart() {
    setIsRestarting(true);
    try {
      const response = await fetch('/api/admin/restart', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        if (data.success) {
          if (data.requiresManualRestart) {
            toast({
              title: 'Server Shutting Down',
              description: data.message || 'Please restart the server manually.',
              variant: 'default',
            });
            
            // Show a more detailed message in a dialog
            setTimeout(() => {
              alert(
                'Server is shutting down.\n\n' +
                'Please restart manually:\n' +
                '• Development: npm run dev\n' +
                '• Production: npm start\n\n' +
                'Or use your process manager (PM2, Docker, etc.)'
              );
            }, 500);
          } else {
            toast({
              title: 'Restart Initiated',
              description: data.message || 'Server restart has been initiated. The page will refresh shortly.',
            });

            // Wait a bit then try to refresh
            setTimeout(() => {
              router.refresh();
            }, 3000);
          }
        } else {
          toast({
            title: 'Restart Failed',
            description: data.message || 'Failed to restart server. Please restart manually.',
            variant: 'destructive',
          });
        }
      } else {
        throw new Error(data.error || 'Failed to restart server');
      }
    } catch (error) {
      logger.error('Restart error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to restart server. Please restart manually.',
        variant: 'destructive',
      });
    } finally {
      setIsRestarting(false);
      setIsOpen(false);
    }
  }

  const getMethodDescription = () => {
    if (!restartMethod) return 'Unknown';
    
    switch (restartMethod.type) {
      case 'pm2':
        return 'PM2 Process Manager';
      case 'docker':
        return 'Docker Container';
      case 'systemd':
        return 'systemd Service';
      case 'graceful':
        return 'Graceful Shutdown (Manual Restart Required)';
      default:
        return 'Manual Restart Required';
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setIsOpen(true)}
        disabled={isLoadingMethod}
        className="gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Restart Server
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Restart Server
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restart the server? This action will temporarily interrupt service.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <div className="text-sm">
              <p className="font-medium mb-1">Restart Method:</p>
              <p className="text-muted-foreground">
                {isLoadingMethod ? 'Detecting...' : getMethodDescription()}
              </p>
            </div>

            {restartMethod?.type === 'graceful' && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-md text-sm">
                <p className="text-amber-800 dark:text-amber-200 font-medium mb-1">
                  Note:
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  Automatic restart is not available in this environment. The server will shut down gracefully, and you&apos;ll need to restart it manually.
                </p>
              </div>
            )}

        {restartMethod?.command && (
          <div className="bg-muted p-3 rounded-md text-sm font-mono text-xs">
            <p className="text-muted-foreground mb-1">Command:</p>
            <p>{restartMethod.command}</p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => setIsOpen(false)}
          disabled={isRestarting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleRestart}
          disabled={isRestarting}
          className="gap-2"
        >
          {isRestarting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Restarting...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Confirm Restart
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
    </>
  );
}

