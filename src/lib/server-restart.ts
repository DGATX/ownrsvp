import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface RestartMethod {
  type: 'pm2' | 'docker' | 'systemd' | 'graceful' | 'unsupported';
  command?: string;
  description: string;
}

export interface RestartResult {
  success: boolean;
  method: RestartMethod;
  message: string;
  error?: string;
  requiresManualRestart?: boolean;
}

/**
 * Detect if running in Docker
 */
export function isDocker(): boolean {
  try {
    const fs = require('fs');
    // Check for Docker indicators
    return (
      fs.existsSync('/.dockerenv') ||
      !!process.env.DOCKER_CONTAINER ||
      !!process.env.COMPOSE_PROJECT_NAME ||
      fs.existsSync('/proc/self/cgroup') && fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker')
    );
  } catch {
    return false;
  }
}

/**
 * Detect if running under PM2
 */
export function isPM2(): boolean {
  return !!process.env.pm_id || !!process.env.PM2_HOME;
}

/**
 * Detect if systemd is available
 */
export async function isSystemdAvailable(): Promise<boolean> {
  try {
    await execAsync('which systemctl');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get Docker container name or ID
 */
async function getDockerContainerName(): Promise<string | null> {
  try {
    // Try to get container name from hostname (common in Docker)
    const hostname = require('os').hostname();
    if (hostname) {
      return hostname;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get PM2 app name
 */
function getPM2AppName(): string | null {
  // PM2 sets process.env.name or we can try to detect from package.json
  if (process.env.pm_id && process.env.name) {
    return process.env.name;
  }
  
  try {
    const packageJson = require('../../package.json');
    return packageJson.name || 'ownrsvp';
  } catch {
    return 'ownrsvp';
  }
}

/**
 * Detect the best restart method for the current environment
 */
export async function detectRestartMethod(): Promise<RestartMethod> {
  // Check PM2 first (most common for Node.js production)
  if (isPM2()) {
    const appName = getPM2AppName();
    return {
      type: 'pm2',
      command: `pm2 restart ${appName}`,
      description: `PM2 process manager (app: ${appName})`,
    };
  }

  // Check Docker
  if (isDocker()) {
    // First, try to detect if we're in a docker-compose setup
    // Check for docker-compose service name from environment or hostname
    const composeServiceName = process.env.COMPOSE_PROJECT_NAME || process.env.DOCKER_SERVICE_NAME;
    const hostname = require('os').hostname();
    
    // Try docker compose restart first (most common for this app)
    try {
      // Check if docker compose is available and we're in a compose setup
      const composeCmd = process.platform === 'win32' ? 'docker-compose' : 'docker compose';
      const { stdout } = await execAsync(`${composeCmd} ps app 2>/dev/null || docker-compose ps app 2>/dev/null`, { timeout: 2000 });
      if (stdout && stdout.trim()) {
        return {
          type: 'docker',
          command: `${composeCmd} restart app`,
          description: 'Docker Compose service (app)',
        };
      }
    } catch {
      // Docker compose not available or not in compose setup, try container restart
    }
    
    // Try to restart by container name/ID
    const containerName = await getDockerContainerName();
    if (containerName) {
      // Check if we can access docker from inside the container
      // In Docker, we might need to use the host's docker socket
      try {
        // Try to see if we can execute docker commands
        await execAsync('which docker 2>/dev/null || echo ""', { timeout: 1000 });
        return {
          type: 'docker',
          command: `docker restart ${containerName}`,
          description: `Docker container (${containerName})`,
        };
      } catch {
        // Docker command not available from inside container
        // This is common - containers usually can't restart themselves
        // Fall through to graceful shutdown
      }
    }
  }

  // Check systemd
  if (await isSystemdAvailable()) {
    // Try to detect service name (common patterns)
    const possibleServiceNames = ['ownrsvp', 'rsvp-app', 'nextjs-app'];
    for (const serviceName of possibleServiceNames) {
      try {
        await execAsync(`systemctl is-active ${serviceName} 2>/dev/null`);
        return {
          type: 'systemd',
          command: `systemctl restart ${serviceName}`,
          description: `systemd service (${serviceName})`,
        };
      } catch {
        // Service doesn't exist, try next
      }
    }
  }

  // Fallback to graceful shutdown
  return {
    type: 'graceful',
    description: 'Graceful shutdown (manual restart required)',
  };
}

/**
 * Attempt to restart the server using the detected method
 */
export async function attemptRestart(): Promise<RestartResult> {
  const method = await detectRestartMethod();

  // Graceful shutdown - just exit the process
  if (method.type === 'graceful') {
    // Set a flag that the process should exit
    // In Next.js, we can't directly exit, but we can signal that a restart is needed
    const isDev = process.env.NODE_ENV === 'development';
    const restartCmd = isDev ? 'npm run dev' : 'npm start';
    
    return {
      success: true,
      method,
      message: `Server will shut down gracefully. Please restart manually using: ${restartCmd}`,
      requiresManualRestart: true,
    };
  }

  // Try to execute restart command
  if (method.command) {
    try {
      // For Docker Compose, we might be inside the container
      // In that case, we can't execute docker commands directly
      // But we can still signal for graceful shutdown
      if (method.type === 'docker' && isDocker()) {
        // If we're inside Docker and trying to restart via docker compose,
        // we likely can't execute the command from inside
        // Provide helpful message instead
        const isDev = process.env.NODE_ENV === 'development';
        const restartCmd = isDev ? 'npm run dev' : 'npm start';
        
        return {
          success: true,
          method,
          message: `Docker container detected. To restart, run from the host: ${method.command}\n\nOr restart the container manually using Docker/Docker Compose.`,
          requiresManualRestart: true,
        };
      }
      
      // For PM2, Docker (from host), and systemd, execute the command
      // Note: This requires proper permissions
      await execAsync(method.command, { timeout: 10000 });
      
      return {
        success: true,
        method,
        message: `Server restart initiated using ${method.description}. The server should restart shortly.`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's a permission error
      if (errorMessage.includes('permission denied') || errorMessage.includes('EACCES')) {
        return {
          success: false,
          method,
          message: `Restart command requires elevated permissions. Please restart manually using: ${method.command}`,
          error: 'Permission denied',
          requiresManualRestart: true,
        };
      }
      
      // Check if command not found (common in Docker containers)
      if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
        const isDev = process.env.NODE_ENV === 'development';
        const restartCmd = isDev ? 'npm run dev' : 'npm start';
        
        return {
          success: false,
          method,
          message: `Restart command not available in this environment. Please restart manually using: ${restartCmd} or ${method.command} (from host)`,
          error: 'Command not found',
          requiresManualRestart: true,
        };
      }

      return {
        success: false,
        method,
        message: `Failed to restart using ${method.description}. Please restart manually.`,
        error: errorMessage,
        requiresManualRestart: true,
      };
    }
  }

  return {
    success: false,
    method,
    message: 'Unable to determine restart method. Please restart manually.',
    requiresManualRestart: true,
  };
}

/**
 * Perform graceful shutdown
 */
export function gracefulShutdown(): void {
  // In development, we can't actually restart, but we can exit
  // The process manager (if any) will handle the restart
  console.log('Graceful shutdown initiated by admin...');
  
  // Give a moment for the response to be sent
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

