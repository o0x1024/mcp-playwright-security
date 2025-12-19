import { BrowserToolBase } from './base.js';
import { ToolContext, ToolResponse, createSuccessResponse, createErrorResponse } from '../common/types.js';
import { resetBrowserState, isAutoAnnotationEnabled } from '../../toolHandler.js';
import { getAutoAnnotationInitScript } from './elementAnnotation.js';

/**
 * Tool for navigating to URLs
 */
export class NavigationTool extends BrowserToolBase {
  /**
   * Execute the navigation tool
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    // Check if browser is available
    if (!context.browser || !context.browser.isConnected()) {
      // If browser is not connected, we need to reset the state to force recreation
      resetBrowserState();
      return createErrorResponse(
        "Browser is not connected. The connection has been reset - please retry your navigation."
      );
    }

    // Check if page is available and not closed
    if (!context.page || context.page.isClosed()) {
      return createErrorResponse(
        "Page is not available or has been closed. Please retry your navigation."
      );
    }

    return this.safeExecute(context, async (page) => {
      try {
        if (args.headers) {
          await page.setExtraHTTPHeaders(args.headers);
        }

        // Add local storage support
        if (args.localStorage) {
          const origin = new URL(args.url).origin;
          await page.evaluate((data) => {
            const { origin, storage } = data;
            // Only set if we are on the same origin (navigating to it)
            // Note: Since we haven't navigated yet, we might need a different approach
            // or rely on page.goto happening first but that might trigger login redirect first.
            // A better way for initial navigation is to open the page, set storage, then reload if needed
            // But playwright context.addInitScript is better for this.
          }, { origin, storage: args.localStorage });

          // Using addInitScript to ensure storage is set before page loads scripts
          await page.addInitScript((storage) => {
            // Basic check to ensure we only applying to target domain if needed,
            // but here we apply to the page being opened.
            if (window.location.href !== 'about:blank') {
              for (const [key, value] of Object.entries(storage)) {
                localStorage.setItem(key, value as string);
              }
            }
          }, args.localStorage);
        }

        await page.goto(args.url, {
          timeout: args.timeout || 30000,
          waitUntil: args.waitUntil || "load"
        });

        // Execute auto-annotation after navigation if enabled
        if (isAutoAnnotationEnabled()) {
          await page.evaluate(getAutoAnnotationInitScript());
        }

        return createSuccessResponse(`Navigated to ${args.url}`);
      } catch (error) {
        const errorMessage = (error as Error).message;

        // Check for common disconnection errors
        if (
          errorMessage.includes("Target page, context or browser has been closed") ||
          errorMessage.includes("Target closed") ||
          errorMessage.includes("Browser has been disconnected")
        ) {
          // Reset browser state to force recreation on next attempt
          resetBrowserState();
          return createErrorResponse(
            `Browser connection issue: ${errorMessage}. Connection has been reset - please retry your navigation.`
          );
        }

        // For other errors, return the standard error
        throw error;
      }
    });
  }
}

/**
 * Tool for closing the browser
 */
export class CloseBrowserTool extends BrowserToolBase {
  /**
   * Execute the close browser tool
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    if (context.browser) {
      try {
        // Check if browser is still connected
        if (context.browser.isConnected()) {
          await context.browser.close().catch(error => {
            console.error("Error while closing browser:", error);
          });
        } else {
          console.error("Browser already disconnected, cleaning up state");
        }
      } catch (error) {
        console.error("Error during browser close operation:", error);
        // Continue with resetting state even if close fails
      } finally {
        // Always reset the global browser and page references
        resetBrowserState();
      }

      return createSuccessResponse("Browser closed successfully");
    }

    return createSuccessResponse("No browser instance to close");
  }
}

/**
 * Tool for navigating back in browser history
 */
export class GoBackTool extends BrowserToolBase {
  /**
   * Execute the go back tool
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    return this.safeExecute(context, async (page) => {
      await page.goBack();

      // Execute auto-annotation after navigation if enabled
      if (isAutoAnnotationEnabled()) {
        await page.evaluate(getAutoAnnotationInitScript());
      }

      return createSuccessResponse("Navigated back in browser history");
    });
  }
}

/**
 * Tool for navigating forward in browser history
 */
export class GoForwardTool extends BrowserToolBase {
  /**
   * Execute the go forward tool
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    return this.safeExecute(context, async (page) => {
      await page.goForward();

      // Execute auto-annotation after navigation if enabled
      if (isAutoAnnotationEnabled()) {
        await page.evaluate(getAutoAnnotationInitScript());
      }

      return createSuccessResponse("Navigated forward in browser history");
    });
  }
} 