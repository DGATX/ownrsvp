import { themes, recommendedThemeId, getThemeById } from '@/lib/themes';
import { ThemePreviewCard } from '@/components/theme-preview-card';
import { Palette, Sparkles, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Theme Showcase | OwnRSVP',
  description: 'Explore 10 unique visual design concepts for your events',
};

export default function ThemesPage() {
  const recommendedTheme = getThemeById(recommendedThemeId);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Theme Showcase</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Explore 10 unique visual design concepts, each with its own personality and target audience.
          </p>
        </div>

        {/* Recommendation Banner */}
        {recommendedTheme && (
          <Card className="mb-8 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-800">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <CardTitle className="text-lg">Recommended Design</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-lg">{recommendedTheme.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {recommendedTheme.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recommendedTheme.specialEffects?.slice(0, 3).map((effect) => (
                    <Badge key={effect} variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      {effect}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="mb-8 bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="flex items-start gap-3 pt-4">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">
                Each design showcases different color palettes, typography, border styles, and visual effects.
                Preview cards display sample buttons, inputs, and cards styled in each theme&apos;s aesthetic.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Theme Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {themes.map((theme) => (
            <ThemePreviewCard key={theme.id} theme={theme} />
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Each theme includes custom color palettes, typography settings, border radius tokens, and shadow definitions.
          </p>
          <p className="mt-1">
            Implementation involves updating Tailwind config, global CSS variables, and component styles.
          </p>
        </div>
      </div>
    </div>
  );
}
