import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/utils';
import { logger } from '@/lib/logger';

export default auth(async (req) => {
  try {
    const isLoggedIn = !!req.auth;
    const { pathname } = req.nextUrl;

    // Public routes
    const publicRoutes = ['/', '/login', '/register', '/events', '/rsvp', '/invite', '/design-preview'];
    const isPublicRoute = publicRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    // API routes that should be public
    const isPublicApi =
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/rsvp') ||
      pathname.startsWith('/api/events/public') ||
      pathname.startsWith('/api/design-preview');

    if (isPublicRoute || isPublicApi) {
      return NextResponse.next();
    }

    // Protected routes - redirect to login if not authenticated
    if (!isLoggedIn && pathname.startsWith('/dashboard')) {
      const loginUrl = new URL('/login', req.nextUrl.origin);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check if logged-in user has invalid email (for password reset functionality)
    if (isLoggedIn && req.auth?.user?.email) {
      const userEmail = req.auth.user.email;
      
      // Only validate if email is a string
      if (typeof userEmail === 'string') {
        // Allow access to profile page to update email
        if (pathname === '/dashboard/profile') {
          return NextResponse.next();
        }
        
        // Allow access to API routes for profile updates
        if (pathname.startsWith('/api/user/profile')) {
          return NextResponse.next();
        }
        
        // If email is invalid, redirect to profile page to update it
        if (!isValidEmail(userEmail)) {
          const profileUrl = new URL('/dashboard/profile', req.nextUrl.origin);
          profileUrl.searchParams.set('updateEmail', 'true');
          return NextResponse.redirect(profileUrl);
        }
      }
    }

    return NextResponse.next();
  } catch (error) {
    logger.error('Middleware error', error);
    // On error, allow the request to proceed to avoid breaking the app
    return NextResponse.next();
  }
});

export const config = {
  // Exclude static files, health check, and error pages
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|_error|api/health).*)'],
};

