'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Image as ImageIcon, X, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import imageCompression from 'browser-image-compression';

interface ImageUploadProps {
  value?: string | null;
  onChange: (base64: string | null) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  maxSizeMB?: number;
}

export function ImageUpload({
  value,
  onChange,
  disabled = false,
  label = 'Event Image',
  description = 'Upload a header image, flyer, or any image for your event',
  maxSizeMB,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setIsCompressing(true);
    setCompressionStatus('Compressing image...');

    try {
      const originalSize = file.size;
      const originalSizeMB = (originalSize / (1024 * 1024)).toFixed(2);

      // Compression options
      const options = {
        maxSizeMB: 5, // Target 5MB
        maxWidthOrHeight: 2000, // Max dimensions
        useWebWorker: true,
        // Preserve PNG if original is PNG (for transparency), otherwise use JPEG for better compression
        fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        initialQuality: 0.85, // Good balance between quality and size
      };

      // Compress the image
      const compressedFile = await imageCompression(file, options);
      const compressedSize = compressedFile.size;
      const compressedSizeMB = (compressedSize / (1024 * 1024)).toFixed(2);
      const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

      setCompressionStatus(
        `Compressed from ${originalSizeMB}MB to ${compressedSizeMB}MB (${reduction}% reduction)`
      );

      // Convert compressed image to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreview(base64String);
        onChange(base64String);
        setIsCompressing(false);
        // Clear status message after a short delay
        setTimeout(() => setCompressionStatus(null), 3000);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Image compression error:', error);
      setIsCompressing(false);
      setCompressionStatus('Compression failed, using original image');
      
      // Fallback to original file if compression fails
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreview(base64String);
        onChange(base64String);
        setTimeout(() => setCompressionStatus(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      {compressionStatus && (
        <div className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
          {isCompressing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {compressionStatus}
            </div>
          ) : (
            compressionStatus
          )}
        </div>
      )}

      {preview ? (
        <div className="relative group">
          <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-700">
            <img
              src={preview}
              alt="Event preview"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={disabled || isCompressing}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Remove Image
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'relative w-full h-64 rounded-lg border-2 border-dashed transition-colors cursor-pointer',
            isDragging
              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
              : 'border-gray-300 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-600',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => !disabled && !isCompressing && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4">
            <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, GIF (any size)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isCompressing}
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Compressing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Choose File
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

