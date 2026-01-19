// OwnRSVP Theme Definitions
// 10 unique visual design concepts for the platform

export interface ThemeColors {
  background: string;
  backgroundSecondary?: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground?: string;
  accent: string;
  accentForeground?: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  destructive?: string;
}

export interface ThemeTypography {
  headingFont: string;
  headingFontUrl?: string;
  bodyFont: string;
  bodyFontUrl?: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  tagline: string;
  description: string;
  aesthetic: string;
  bestFor: string[];
  colors: ThemeColors;
  darkColors?: ThemeColors;
  typography: ThemeTypography;
  borderRadius: string;
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  specialEffects?: string[];
}

export const themes: ThemeConfig[] = [
  // Design 1: Midnight Luxe - Dark Elegance
  {
    id: 'midnight-luxe',
    name: 'Midnight Luxe',
    tagline: 'Dark Elegance',
    description: 'Sophisticated dark theme with gold/amber accents. Premium, upscale feel for formal events.',
    aesthetic: 'Elegant, luxurious, timeless sophistication',
    bestFor: ['Weddings', 'Galas', 'Corporate Events', 'Upscale Parties'],
    colors: {
      background: '#0D0D0D',
      backgroundSecondary: '#0A1628',
      foreground: '#FAF8F5',
      primary: '#D4A574',
      primaryForeground: '#0D0D0D',
      secondary: '#F7E7CE',
      secondaryForeground: '#0D0D0D',
      accent: '#8B4557',
      accentForeground: '#FAF8F5',
      card: 'rgba(26, 26, 46, 0.9)',
      cardForeground: '#FAF8F5',
      muted: '#1A1A2E',
      mutedForeground: '#A0A0B0',
      border: 'rgba(212, 165, 116, 0.3)',
    },
    typography: {
      headingFont: 'Playfair Display',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
      bodyFont: 'Inter',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
    },
    borderRadius: '0.75rem',
    shadows: {
      sm: '0 2px 8px rgba(212, 165, 116, 0.1)',
      md: '0 4px 16px rgba(212, 165, 116, 0.15)',
      lg: '0 8px 32px rgba(212, 165, 116, 0.2)',
    },
    specialEffects: ['Gold gradient borders', 'Soft glow CTAs', 'Shimmer hover states', 'Frosted glass modals'],
  },

  // Design 2: Confetti Pop - Bold & Playful
  {
    id: 'confetti-pop',
    name: 'Confetti Pop',
    tagline: 'Bold & Playful',
    description: 'Vibrant, energetic, fun. Celebration-focused with dynamic elements.',
    aesthetic: 'Energetic, joyful, party-ready',
    bestFor: ['Birthday Parties', "Kids' Events", 'Casual Celebrations', 'Fun Gatherings'],
    colors: {
      background: '#FFFBF5',
      foreground: '#1E1B4B',
      primary: '#7C3AED',
      primaryForeground: '#FFFFFF',
      secondary: '#EC4899',
      secondaryForeground: '#FFFFFF',
      accent: '#FCD34D',
      accentForeground: '#1E1B4B',
      card: '#FFFFFF',
      cardForeground: '#1E1B4B',
      muted: '#F5F3FF',
      mutedForeground: '#6B7280',
      border: '#E5E7EB',
    },
    typography: {
      headingFont: 'Space Grotesk',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap',
      bodyFont: 'DM Sans',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap',
    },
    borderRadius: '2rem',
    shadows: {
      sm: '4px 4px 0 #EC4899, -2px -2px 0 #7C3AED',
      md: '6px 6px 0 #EC4899, -3px -3px 0 #7C3AED',
      lg: '8px 8px 0 #EC4899, -4px -4px 0 #7C3AED',
    },
    specialEffects: ['Confetti animations', 'Multi-colored shadows', 'Bouncy hover effects', 'Gradient text'],
  },

  // Design 3: Zen Garden - Japanese Minimalism
  {
    id: 'zen-garden',
    name: 'Zen Garden',
    tagline: 'Japanese Minimalism',
    description: 'Serene, balanced, intentional. Inspired by wabi-sabi principles.',
    aesthetic: 'Peaceful, mindful, naturally beautiful',
    bestFor: ['Tea Ceremonies', 'Meditation Retreats', 'Art Exhibitions', 'Wellness Events'],
    colors: {
      background: '#F9F6F2',
      foreground: '#3D3D3D',
      primary: '#2D3748',
      primaryForeground: '#F9F6F2',
      secondary: '#C66A4A',
      secondaryForeground: '#FFFFFF',
      accent: '#87A96B',
      accentForeground: '#FFFFFF',
      card: '#F5F0EA',
      cardForeground: '#3D3D3D',
      muted: '#EDE8E0',
      mutedForeground: '#6B6B6B',
      border: '#D4CFC7',
    },
    typography: {
      headingFont: 'Cormorant Garamond',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap',
      bodyFont: 'Noto Sans',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600&display=swap',
    },
    borderRadius: '0.25rem',
    shadows: {
      sm: '0 1px 3px rgba(0, 0, 0, 0.05)',
      md: '0 2px 6px rgba(0, 0, 0, 0.08)',
      lg: '0 4px 12px rgba(0, 0, 0, 0.1)',
    },
    specialEffects: ['Asymmetrical layouts', 'Paper texture overlays', 'Ink-brush borders', 'Gentle fade transitions'],
  },

  // Design 4: Aurora Borealis - Gradient Paradise
  {
    id: 'aurora-borealis',
    name: 'Aurora Borealis',
    tagline: 'Gradient Paradise',
    description: 'Dreamy, modern, immersive. Dynamic color gradients create depth.',
    aesthetic: 'Magical, contemporary, visually striking',
    bestFor: ['Music Festivals', 'Tech Events', 'Launch Parties', 'Creative Gatherings'],
    colors: {
      background: '#0F0F23',
      backgroundSecondary: '#1A1A3E',
      foreground: '#FFFFFF',
      primary: '#06B6D4',
      primaryForeground: '#0F0F23',
      secondary: '#8B5CF6',
      secondaryForeground: '#FFFFFF',
      accent: '#EC4899',
      accentForeground: '#FFFFFF',
      card: 'rgba(255, 255, 255, 0.1)',
      cardForeground: '#FFFFFF',
      muted: 'rgba(255, 255, 255, 0.05)',
      mutedForeground: '#A0A0C0',
      border: 'rgba(139, 92, 246, 0.3)',
    },
    typography: {
      headingFont: 'Outfit',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
      bodyFont: 'Inter',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
    },
    borderRadius: '1rem',
    shadows: {
      sm: '0 0 20px rgba(6, 182, 212, 0.2)',
      md: '0 0 40px rgba(139, 92, 246, 0.3)',
      lg: '0 0 60px rgba(236, 72, 153, 0.25)',
    },
    specialEffects: ['Animated mesh gradients', 'Glassmorphism cards', 'Glowing hover states', 'Particle animations'],
  },

  // Design 5: Vintage Postcard - Retro Charm
  {
    id: 'vintage-postcard',
    name: 'Vintage Postcard',
    tagline: 'Retro Charm',
    description: 'Nostalgic, warm, handcrafted feel. Like receiving a handwritten invitation.',
    aesthetic: 'Nostalgic, romantic, charmingly imperfect',
    bestFor: ['Vintage Weddings', 'Garden Parties', 'Anniversary Celebrations', 'Reunion Events'],
    colors: {
      background: '#F5F0E1',
      foreground: '#5D4E37',
      primary: '#B23A48',
      primaryForeground: '#F5F0E1',
      secondary: '#C9A227',
      secondaryForeground: '#5D4E37',
      accent: '#355E3B',
      accentForeground: '#F5F0E1',
      card: '#FFFEF8',
      cardForeground: '#5D4E37',
      muted: '#EDE5D5',
      mutedForeground: '#7D6E57',
      border: '#D4C4A8',
    },
    typography: {
      headingFont: 'Playfair Display',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
      bodyFont: 'Lora',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&display=swap',
    },
    borderRadius: '0.375rem',
    shadows: {
      sm: '2px 2px 4px rgba(93, 78, 55, 0.1)',
      md: '3px 3px 8px rgba(93, 78, 55, 0.15)',
      lg: '4px 4px 16px rgba(93, 78, 55, 0.2)',
    },
    specialEffects: ['Postage stamp elements', 'Scalloped borders', 'Paper textures', 'Wax seal icons'],
  },

  // Design 6: Neon Brutalism - Bold & Raw
  {
    id: 'neon-brutalism',
    name: 'Neon Brutalism',
    tagline: 'Bold & Raw',
    description: 'Unapologetically bold, high contrast, attention-grabbing. Anti-minimalist.',
    aesthetic: 'Rebellious, energetic, unapologetically bold',
    bestFor: ['Art Shows', 'Startup Events', 'Music Events', 'Gen-Z Audiences'],
    colors: {
      background: '#FFFEF2',
      foreground: '#000000',
      primary: '#BFFF00',
      primaryForeground: '#000000',
      secondary: '#FF00FF',
      secondaryForeground: '#000000',
      accent: '#00FFFF',
      accentForeground: '#000000',
      card: '#FFFFFF',
      cardForeground: '#000000',
      muted: '#F0F0E8',
      mutedForeground: '#333333',
      border: '#000000',
    },
    typography: {
      headingFont: 'Anton',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Anton&display=swap',
      bodyFont: 'Space Mono',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap',
    },
    borderRadius: '0',
    shadows: {
      sm: '4px 4px 0 #000000',
      md: '6px 6px 0 #000000',
      lg: '8px 8px 0 #000000',
    },
    specialEffects: ['Hard drop shadows', 'Thick black borders', 'Overlapping elements', 'Marquee text'],
  },

  // Design 7: Botanical Bliss - Nature Inspired
  {
    id: 'botanical-bliss',
    name: 'Botanical Bliss',
    tagline: 'Nature Inspired',
    description: 'Fresh, organic, peaceful. Brings the outdoors in.',
    aesthetic: 'Natural, calming, organically beautiful',
    bestFor: ['Garden Parties', 'Outdoor Weddings', 'Baby Showers', 'Eco Events'],
    colors: {
      background: '#E8F0E8',
      foreground: '#1B4332',
      primary: '#1B4332',
      primaryForeground: '#FFFFFF',
      secondary: '#FADADD',
      secondaryForeground: '#1B4332',
      accent: '#E07A5F',
      accentForeground: '#FFFFFF',
      card: '#FFFFFF',
      cardForeground: '#1B4332',
      muted: '#D4E5D4',
      mutedForeground: '#2D5A3D',
      border: '#B8D4B8',
    },
    typography: {
      headingFont: 'Fraunces',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&display=swap',
      bodyFont: 'Nunito Sans',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600&display=swap',
    },
    borderRadius: '1.5rem',
    shadows: {
      sm: '0 2px 8px rgba(27, 67, 50, 0.08)',
      md: '0 4px 16px rgba(27, 67, 50, 0.12)',
      lg: '0 8px 32px rgba(27, 67, 50, 0.16)',
    },
    specialEffects: ['Botanical illustrations', 'Organic shapes', 'Watercolor accents', 'Leaf dividers'],
  },

  // Design 8: Cosmic Noir - Sci-Fi Elegance
  {
    id: 'cosmic-noir',
    name: 'Cosmic Noir',
    tagline: 'Sci-Fi Elegance',
    description: 'Futuristic, mysterious, cinematic. Space-age sophistication.',
    aesthetic: 'Futuristic, mysterious, cinematically cool',
    bestFor: ['Sci-Fi Events', 'Tech Launches', 'Gaming Events', 'Night Parties'],
    colors: {
      background: '#050505',
      backgroundSecondary: '#0D0221',
      foreground: '#FFFFFF',
      primary: '#00F5FF',
      primaryForeground: '#050505',
      secondary: '#BF00FF',
      secondaryForeground: '#FFFFFF',
      accent: '#C0C0C0',
      accentForeground: '#050505',
      card: 'rgba(13, 2, 33, 0.8)',
      cardForeground: '#FFFFFF',
      muted: '#1A0A2E',
      mutedForeground: '#8080A0',
      border: 'rgba(0, 245, 255, 0.3)',
    },
    typography: {
      headingFont: 'Orbitron',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&display=swap',
      bodyFont: 'IBM Plex Sans',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap',
    },
    borderRadius: '0.5rem',
    shadows: {
      sm: '0 0 15px rgba(0, 245, 255, 0.3)',
      md: '0 0 30px rgba(0, 245, 255, 0.4)',
      lg: '0 0 50px rgba(191, 0, 255, 0.3)',
    },
    specialEffects: ['Holographic highlights', 'Scan-line textures', 'Neon outlines', 'Orbital animations'],
  },

  // Design 9: Soft Sunrise - Gentle Pastels
  {
    id: 'soft-sunrise',
    name: 'Soft Sunrise',
    tagline: 'Gentle Pastels',
    description: 'Calm, welcoming, approachable. Soft and dreamy without being childish.',
    aesthetic: 'Warm, gentle, soothingly beautiful',
    bestFor: ['Baby Showers', 'Bridal Showers', 'Afternoon Teas', 'Wellness Events'],
    colors: {
      background: '#FFF9F5',
      backgroundSecondary: '#FFE5D9',
      foreground: '#4A3728',
      primary: '#FF8A80',
      primaryForeground: '#FFFFFF',
      secondary: '#B8A9C9',
      secondaryForeground: '#FFFFFF',
      accent: '#A2D2FF',
      accentForeground: '#4A3728',
      card: '#FFFFFF',
      cardForeground: '#4A3728',
      muted: '#FFF0E8',
      mutedForeground: '#7A6A5A',
      border: '#F0D8CC',
    },
    typography: {
      headingFont: 'Quicksand',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap',
      bodyFont: 'Poppins',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap',
    },
    borderRadius: '1.25rem',
    shadows: {
      sm: '0 2px 8px rgba(255, 138, 128, 0.15)',
      md: '0 4px 16px rgba(184, 169, 201, 0.2)',
      lg: '0 8px 32px rgba(162, 210, 255, 0.25)',
    },
    specialEffects: ['Soft blob shapes', 'Pastel gradients', 'Floating animations', 'Soft inner shadows'],
  },

  // Design 10: Metropolitan - Modern Sophistication
  {
    id: 'metropolitan',
    name: 'Metropolitan',
    tagline: 'Modern Sophistication',
    description: 'Urban, sleek, professional. Like a high-end architecture magazine.',
    aesthetic: 'Refined, confident, architecturally inspired',
    bestFor: ['Corporate Events', 'Gallery Openings', 'Professional Networking', 'Product Launches'],
    colors: {
      background: '#FFFFFF',
      foreground: '#1A1A1A',
      primary: '#1A1A1A',
      primaryForeground: '#FFFFFF',
      secondary: '#D65A31',
      secondaryForeground: '#FFFFFF',
      accent: '#1E40AF',
      accentForeground: '#FFFFFF',
      card: '#FFFFFF',
      cardForeground: '#1A1A1A',
      muted: '#F5F5F5',
      mutedForeground: '#666666',
      border: '#E5E5E5',
    },
    typography: {
      headingFont: 'Montserrat',
      headingFontUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap',
      bodyFont: 'Source Sans Pro',
      bodyFontUrl: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&display=swap',
    },
    borderRadius: '0.25rem',
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px rgba(0, 0, 0, 0.07)',
      lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    },
    specialEffects: ['Strong grid layouts', 'Dramatic whitespace', 'Thin accent lines', 'Micro-interactions'],
  },
];

// Helper function to get a theme by ID
export function getThemeById(id: string): ThemeConfig | undefined {
  return themes.find((theme) => theme.id === id);
}

// Helper to generate CSS variables from a theme
export function generateThemeCSSVariables(theme: ThemeConfig): Record<string, string> {
  return {
    '--theme-background': theme.colors.background,
    '--theme-foreground': theme.colors.foreground,
    '--theme-primary': theme.colors.primary,
    '--theme-primary-foreground': theme.colors.primaryForeground,
    '--theme-secondary': theme.colors.secondary,
    '--theme-accent': theme.colors.accent,
    '--theme-card': theme.colors.card,
    '--theme-card-foreground': theme.colors.cardForeground,
    '--theme-muted': theme.colors.muted,
    '--theme-muted-foreground': theme.colors.mutedForeground,
    '--theme-border': theme.colors.border,
    '--theme-radius': theme.borderRadius,
    '--theme-shadow-sm': theme.shadows.sm,
    '--theme-shadow-md': theme.shadows.md,
    '--theme-shadow-lg': theme.shadows.lg,
  };
}

// Recommended theme
export const recommendedThemeId = 'aurora-borealis';
