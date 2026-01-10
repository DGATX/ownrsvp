import type { HTTPClient } from '../comprehensive-test';

export class UIUXTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    user1: any,
    runTest: any
  ) {
    // Pages
    await runTest(
      'Landing page loads',
      'UI/UX',
      'Pages',
      async () => {
        const response = await httpClient.get('/');
        
        if (response.status === 404 || response.status === 500) {
          throw new Error(`Landing page failed: ${response.status}`);
        }
      },
      'Landing page is accessible',
      'High'
    );

    await runTest(
      'Login page loads',
      'UI/UX',
      'Pages',
      async () => {
        const response = await httpClient.get('/login');
        
        if (response.status === 404 || response.status === 500) {
          throw new Error(`Login page failed: ${response.status}`);
        }
      },
      'Login page is accessible',
      'High'
    );

    await runTest(
      'Register page loads',
      'UI/UX',
      'Pages',
      async () => {
        const response = await httpClient.get('/register');
        
        if (response.status === 404 || response.status === 500) {
          throw new Error(`Register page failed: ${response.status}`);
        }
      },
      'Register page is accessible',
      'High'
    );

    await runTest(
      'Public events page loads',
      'UI/UX',
      'Pages',
      async () => {
        const response = await httpClient.get('/events');
        
        if (response.status === 404 || response.status === 500) {
          throw new Error(`Events page failed: ${response.status}`);
        }
      },
      'Public events page is accessible',
      'Medium'
    );

    await runTest(
      'Health check endpoint works',
      'UI/UX',
      'Pages',
      async () => {
        const response = await httpClient.get('/api/health');
        
        if (response.status !== 200) {
          throw new Error(`Health check failed: ${response.status}`);
        }
      },
      'Health check endpoint responds',
      'Medium'
    );
  }
}

