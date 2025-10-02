/**
 * Browser Utilities
 * Launch default browser with fallback to manual URL display
 */

import open from 'open';

export interface BrowserLaunchResult {
  success: boolean;
  error?: string;
  url: string;
}

/**
 * Attempts to launch the default browser with the given URL
 * Falls back gracefully to displaying URL if launch fails
 */
export async function launchBrowser(url: string): Promise<BrowserLaunchResult> {
  try {
    await open(url);
    return {
      success: true,
      url
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      url
    };
  }
}

/**
 * Formats URL as clickable terminal link
 * Most modern terminals (iTerm2, VS Code terminal, etc.) auto-detect URLs
 */
export function formatClickableUrl(url: string): string {
  return `\n\n  ${url}\n\n`;
}
