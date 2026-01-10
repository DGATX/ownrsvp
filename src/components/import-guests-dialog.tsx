'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Loader2, FileSpreadsheet, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ParsedGuest {
  email: string;
  name?: string;
  phone?: string;
  valid: boolean;
  error?: string;
}

interface ImportGuestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
}

export function ImportGuestsDialog({ open, onOpenChange, eventId }: ImportGuestsDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedGuests, setParsedGuests] = useState<ParsedGuest[]>([]);
  const [importResults, setImportResults] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const guests = parseCSV(text);
      setParsedGuests(guests);
      setImportResults(null);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string): ParsedGuest[] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];

    // Parse header to find column indices
    const headerLine = lines[0].toLowerCase();
    const headers = parseCSVLine(headerLine);
    
    const emailIdx = headers.findIndex((h) => h.includes('email'));
    const nameIdx = headers.findIndex((h) => h.includes('name') && !h.includes('email'));
    const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('cell'));

    if (emailIdx === -1) {
      return [{ email: '', valid: false, error: 'CSV must have an "email" column' }];
    }

    const guests: ParsedGuest[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const email = values[emailIdx]?.trim() || '';
      const name = nameIdx >= 0 ? values[nameIdx]?.trim() : undefined;
      const phone = phoneIdx >= 0 ? values[phoneIdx]?.trim() : undefined;

      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      guests.push({
        email,
        name: name || undefined,
        phone: phone || undefined,
        valid: isValidEmail,
        error: !isValidEmail ? 'Invalid email address' : undefined,
      });
    }

    return guests;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImport = async () => {
    const validGuests = parsedGuests.filter((g) => g.valid);
    if (validGuests.length === 0) {
      toast({
        title: 'No valid guests',
        description: 'Please check your CSV file and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/events/${eventId}/guests/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guests: validGuests.map((g) => ({
            email: g.email,
            name: g.name,
            phone: g.phone,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import');
      }

      setImportResults(data.results);

      toast({
        title: 'Import complete',
        description: `Imported ${data.results.imported} guests, skipped ${data.results.skipped} duplicates.`,
      });

      // Refresh page after successful import
      if (data.results.imported > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import guests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = 'name,email,phone\nJohn Doe,john@example.com,+1234567890\nJane Smith,jane@example.com,';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guest-import-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleClose = () => {
    setParsedGuests([]);
    setImportResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  };

  const validCount = parsedGuests.filter((g) => g.valid).length;
  const invalidCount = parsedGuests.filter((g) => !g.valid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import Guests from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with guest information. The file should have columns for email (required), name, and phone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="csv-file">CSV File</Label>
              <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="gap-2 text-xs">
                <Download className="w-3 h-3" />
                Download Template
              </Button>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Preview Table */}
          {parsedGuests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-4 h-4" />
                    {invalidCount} invalid
                  </span>
                )}
              </div>
              
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedGuests.slice(0, 50).map((guest, idx) => (
                      <TableRow key={idx} className={!guest.valid ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                        <TableCell>
                          {guest.valid ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <span title={guest.error}><AlertCircle className="w-4 h-4 text-red-600" /></span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{guest.name || '-'}</TableCell>
                        <TableCell className="text-sm">{guest.email || '-'}</TableCell>
                        <TableCell className="text-sm">{guest.phone || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedGuests.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  Showing first 50 of {parsedGuests.length} rows
                </p>
              )}
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="p-4 rounded-lg bg-muted space-y-2">
              <h4 className="font-medium">Import Results</h4>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  {importResults.imported} guests imported
                </li>
                {importResults.skipped > 0 && (
                  <li className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    {importResults.skipped} duplicates skipped
                  </li>
                )}
                {importResults.errors.length > 0 && (
                  <li className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-4 h-4" />
                    {importResults.errors.length} errors
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
            {importResults ? 'Close' : 'Cancel'}
          </Button>
          {!importResults && (
            <Button 
              onClick={handleImport} 
              disabled={isLoading || validCount === 0}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Import {validCount} Guests
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

