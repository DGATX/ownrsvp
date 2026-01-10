import { NextResponse } from 'next/server';

/**
 * Health check endpoint for reverse proxy monitoring
 * This endpoint doesn't require authentication and returns a simple 200 OK
 * Can be used by nginx proxy manager, load balancers, etc. for health checks
 */
export async function GET() {
  try {
    // Optional: Add basic health checks here (database, etc.)
    // For now, just return OK if the server is running
    
    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'OwnRSVP',
      },
      { status: 200 }
    );
  } catch (error) {
    // Even if there's an error, we might want to return 200
    // or return 503 if the service is truly unhealthy
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

