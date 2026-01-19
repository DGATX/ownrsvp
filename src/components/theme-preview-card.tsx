'use client';

import { ThemeConfig, recommendedThemeId } from '@/lib/themes';
import { Badge } from '@/components/ui/badge';
import { Star, Sparkles } from 'lucide-react';

interface ThemePreviewCardProps {
  theme: ThemeConfig;
}

export function ThemePreviewCard({ theme }: ThemePreviewCardProps) {
  const isRecommended = theme.id === recommendedThemeId;

  // Determine if theme is dark based on background color
  const isDarkTheme = theme.colors.background.startsWith('#0') ||
                      theme.colors.background.startsWith('#1') ||
                      theme.colors.background.startsWith('rgba');

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Recommended Badge */}
      {isRecommended && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-amber-500 text-white border-0 gap-1">
            <Star className="w-3 h-3 fill-current" />
            Recommended
          </Badge>
        </div>
      )}

      {/* Theme Preview Area */}
      <div
        className="relative h-64 overflow-hidden"
        style={{
          background: theme.colors.backgroundSecondary
            ? `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.backgroundSecondary} 100%)`
            : theme.colors.background,
        }}
      >
        {/* Decorative Elements based on theme */}
        {theme.id === 'aurora-borealis' && (
          <div className="absolute inset-0 opacity-50">
            <div
              className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl"
              style={{ background: `radial-gradient(circle, ${theme.colors.primary}40 0%, transparent 70%)` }}
            />
            <div
              className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl"
              style={{ background: `radial-gradient(circle, ${theme.colors.accent}40 0%, transparent 70%)` }}
            />
          </div>
        )}

        {theme.id === 'midnight-luxe' && (
          <div className="absolute inset-0">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-20 blur-2xl"
              style={{ background: theme.colors.primary }}
            />
          </div>
        )}

        {theme.id === 'confetti-pop' && (
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-full opacity-60"
                style={{
                  background: [theme.colors.primary, theme.colors.secondary, theme.colors.accent][i % 3],
                  top: `${Math.random() * 80}%`,
                  left: `${Math.random() * 90}%`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>
        )}

        {/* Preview Components Container */}
        <div className="relative h-full p-4 flex flex-col justify-between">
          {/* Mini Card Preview */}
          <div
            className="rounded-lg p-3 max-w-[200px]"
            style={{
              background: theme.colors.card,
              color: theme.colors.cardForeground,
              borderRadius: theme.borderRadius,
              boxShadow: theme.shadows.md,
              border: theme.id === 'neon-brutalism' ? `3px solid ${theme.colors.border}` : `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              className="text-sm font-semibold mb-1"
              style={{ fontFamily: theme.typography.headingFont }}
            >
              Event Title
            </div>
            <div
              className="text-xs opacity-70"
              style={{ fontFamily: theme.typography.bodyFont }}
            >
              Saturday, Jan 25
            </div>
          </div>

          {/* Buttons Preview */}
          <div className="flex gap-2 items-end">
            {/* Primary Button */}
            <button
              className="px-4 py-2 text-sm font-medium transition-transform hover:scale-105"
              style={{
                background: theme.colors.primary,
                color: theme.colors.primaryForeground,
                borderRadius: theme.borderRadius,
                boxShadow: theme.id === 'neon-brutalism' ? theme.shadows.sm : 'none',
                border: theme.id === 'neon-brutalism' ? `2px solid ${theme.colors.border}` : 'none',
                fontFamily: theme.typography.bodyFont,
              }}
            >
              RSVP Now
            </button>

            {/* Secondary/Outline Button */}
            <button
              className="px-3 py-2 text-sm font-medium transition-transform hover:scale-105"
              style={{
                background: 'transparent',
                color: isDarkTheme ? theme.colors.foreground : theme.colors.primary,
                borderRadius: theme.borderRadius,
                border: `2px solid ${isDarkTheme ? theme.colors.foreground : theme.colors.primary}`,
                fontFamily: theme.typography.bodyFont,
              }}
            >
              Details
            </button>
          </div>

          {/* Input Preview */}
          <div className="mt-auto">
            <input
              type="text"
              placeholder="Enter your email..."
              readOnly
              className="w-full px-3 py-2 text-sm"
              style={{
                background: theme.colors.muted,
                color: theme.colors.mutedForeground,
                borderRadius: theme.borderRadius,
                border: `1px solid ${theme.colors.border}`,
                fontFamily: theme.typography.bodyFont,
              }}
            />
          </div>
        </div>
      </div>

      {/* Theme Info Section */}
      <div className="p-4 space-y-3">
        {/* Theme Name & Tagline */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{theme.name}</h3>
            {theme.id === 'aurora-borealis' && (
              <Sparkles className="w-4 h-4 text-violet-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{theme.tagline}</p>
        </div>

        {/* Color Palette Swatches */}
        <div className="flex gap-1.5">
          {[
            theme.colors.background,
            theme.colors.primary,
            theme.colors.secondary,
            theme.colors.accent,
            theme.colors.foreground,
          ].map((color, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full border border-border/50 shadow-sm"
              style={{ background: color }}
              title={color}
            />
          ))}
        </div>

        {/* Typography Preview */}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Fonts:</span> {theme.typography.headingFont} / {theme.typography.bodyFont}
        </div>

        {/* Best For Tags */}
        <div className="flex flex-wrap gap-1.5">
          {theme.bestFor.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {theme.bestFor.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{theme.bestFor.length - 3}
            </Badge>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {theme.description}
        </p>
      </div>
    </div>
  );
}
