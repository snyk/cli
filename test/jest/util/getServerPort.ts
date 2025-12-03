const portfinder = require('portfinder');

/**
 * @deprecated Use getAvailableServerPort instead
 *
 * @param process
 * @returns string
 */
export const getServerPort = (process: NodeJS.Process): string => {
  return process.env.PORT || process.env.SNYK_PORT || '12345';
};

export const getAvailableServerPort = async (
  process: NodeJS.Process,
): Promise<string> => {
  // New lower default port: '4000'
  console.debug('Finding available port for fake server...');
  const initialPort = process.env.PORT || process.env.SNYK_PORT || '4000';
  const startPort = parseInt(initialPort, 10);

  // Set the base port for portfinder to start searching from
  console.debug(
    `Setting base port for portfinder to start searching from: ${startPort}`,
  );
  try {
    const port = await portfinder.getPortPromise({
      port: startPort,
    });
    console.debug(
      `Found available port: ${port}`,
      typeof port,
      port.toString(),
    );
    return port.toString();
  } catch (err) {
    console.debug(`Error finding available port: ${err}`);
    throw new Error(
      `Failed to find an available port starting from ${startPort}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
};
