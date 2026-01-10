import type { HTTPClient } from '../comprehensive-test';

export class ConfigTests {
  static async run(
    httpClient: HTTPClient,
    admin: any,
    runTest: any,
    smtpConfig: any,
    smsConfig: any
  ) {
    // SMTP Configuration
    await runTest(
      'Get SMTP configuration',
      'Configuration',
      'SMTP',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const response = await httpClient.get('/api/admin/config/email');
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to get SMTP config: ${error.error || response.status}`);
        }
        
        const data = await response.json();
        if (data.configured === undefined) {
          throw new Error('SMTP config response missing configured flag');
        }
      },
      'SMTP configuration can be retrieved',
      'High'
    );

    await runTest(
      'SMTP configuration masks sensitive fields',
      'Configuration',
      'SMTP',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const response = await httpClient.get('/api/admin/config/email');
        
        if (response.status === 200) {
          const data = await response.json();
          if (data.config?.password && !data.config.password.includes('*')) {
            throw new Error('SMTP password should be masked');
          }
        }
      },
      'Sensitive SMTP fields are masked',
      'High'
    );

    // SMS Configuration
    await runTest(
      'Get SMS configuration',
      'Configuration',
      'SMS',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const response = await httpClient.get('/api/admin/config/sms');
        
        if (response.status !== 200) {
          const error = await response.json();
          throw new Error(`Failed to get SMS config: ${error.error || response.status}`);
        }
        
        const data = await response.json();
        if (data.configured === undefined) {
          throw new Error('SMS config response missing configured flag');
        }
      },
      'SMS configuration can be retrieved',
      'High'
    );

    await runTest(
      'SMS configuration masks sensitive fields',
      'Configuration',
      'SMS',
      async () => {
        // Ensure authenticated as admin
        await httpClient.loginAsUser(admin);
        
        const response = await httpClient.get('/api/admin/config/sms');
        
        if (response.status === 200) {
          const data = await response.json();
          if (data.config?.authToken && !data.config.authToken.includes('*')) {
            throw new Error('SMS auth token should be masked');
          }
        }
      },
      'Sensitive SMS fields are masked',
      'High'
    );
  }
}

