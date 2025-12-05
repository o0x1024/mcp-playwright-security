import type { Browser, Page } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { BROWSER_TOOLS } from './tools.js';
import type { ToolContext } from './tools/common/types.js';
import { 
  ScreenshotTool,
  NavigationTool,
  CloseBrowserTool,
  ConsoleLogsTool,
  ExpectResponseTool,
  CustomUserAgentTool,
  AnnotateElementsTool,
  ClickByIndexTool,
  FillByIndexTool,
  getAutoAnnotationInitScript
} from './tools/browser/index.js';
import {
  ClickTool,
  IframeClickTool,
  SelectTool,
  HoverTool,
  EvaluateTool,
  IframeFillTool
} from './tools/browser/interaction.js';
import { 
  VisibleTextTool, 
  VisibleHtmlTool 
} from './tools/browser/visiblePage.js';
import { GoBackTool, GoForwardTool } from './tools/browser/navigation.js';
import { DragTool, PressKeyTool } from './tools/browser/interaction.js';

// Global state
let browser: Browser | undefined;
let page: Page | undefined;
let currentBrowserType: 'chromium' | 'firefox' | 'webkit' = 'chromium';
let autoAnnotationEnabled = true; // Enable auto-annotation by default

/**
 * Resets browser and page variables
 * Used when browser is closed
 */
export function resetBrowserState() {
  browser = undefined;
  page = undefined;
  currentBrowserType = 'chromium';
}
/**
 * Sets the provided page to the global page variable
 * @param newPage The Page object to set as the global page
 */
export function setGlobalPage(newPage: Page): void {
  page = newPage;
  page.bringToFront();// Bring the new tab to the front
  console.log("Global page has been updated.");
}
// Tool instances
let screenshotTool: ScreenshotTool;
let navigationTool: NavigationTool;
let closeBrowserTool: CloseBrowserTool;
let consoleLogsTool: ConsoleLogsTool;
let clickTool: ClickTool;
let iframeClickTool: IframeClickTool;
let iframeFillTool: IframeFillTool;
let selectTool: SelectTool;
let hoverTool: HoverTool;
let evaluateTool: EvaluateTool;
let expectResponseTool: ExpectResponseTool;
let customUserAgentTool: CustomUserAgentTool;
let visibleTextTool: VisibleTextTool;
let visibleHtmlTool: VisibleHtmlTool;

// Add these variables at the top with other tool declarations
let goBackTool: GoBackTool;
let goForwardTool: GoForwardTool;
let dragTool: DragTool;
let pressKeyTool: PressKeyTool;

// Element annotation tools
let annotateElementsTool: AnnotateElementsTool;
let clickByIndexTool: ClickByIndexTool;
let fillByIndexTool: FillByIndexTool;


interface BrowserSettings {
  viewport?: {
    width?: number;
    height?: number;
  };
  userAgent?: string;
  headless?: boolean;
  browserType?: 'chromium' | 'firefox' | 'webkit';
  proxy?: {
    server: string;
    username?: string;
    password?: string;
    bypass?: string;
  };
}

async function registerConsoleMessage(page) {
  page.on("console", (msg) => {
    if (consoleLogsTool) {
      const type = msg.type();
      const text = msg.text();

      // "Unhandled Rejection In Promise" we injected
      if (text.startsWith("[Playwright]")) {
        const payload = text.replace("[Playwright]", "");
        consoleLogsTool.registerConsoleMessage("exception", payload);
      } else {
        consoleLogsTool.registerConsoleMessage(type, text);
      }
    }
  });

  // Uncaught exception
  page.on("pageerror", (error) => {
    if (consoleLogsTool) {
      const message = error.message;
      const stack = error.stack || "";
      consoleLogsTool.registerConsoleMessage("exception", `${message}\n${stack}`);
    }
  });

  // Unhandled rejection in promise
  await page.addInitScript(() => {
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      const message = typeof reason === "object" && reason !== null
          ? reason.message || JSON.stringify(reason)
          : String(reason);

      const stack = reason?.stack || "";
      // Use console.error get "Unhandled Rejection In Promise"
      console.error(`[Playwright][Unhandled Rejection In Promise] ${message}\n${stack}`);
    });
  });
}

/**
 * Ensures a browser is launched and returns the page
 */
export async function ensureBrowser(browserSettings?: BrowserSettings) {
  try {
    // Check if browser exists but is disconnected
    if (browser && !browser.isConnected()) {
      console.error("Browser exists but is disconnected. Cleaning up...");
      try {
        await browser.close().catch(err => console.error("Error closing disconnected browser:", err));
      } catch (e) {
        // Ignore errors when closing disconnected browser
      }
      // Reset browser and page references
      resetBrowserState();
    }

    // Launch new browser if needed
    if (!browser) {
      const { viewport, userAgent, headless = false, browserType = 'chromium', proxy } = browserSettings ?? {};
      
      // If browser type is changing, force a new browser instance
      if (browser && currentBrowserType !== browserType) {
        try {
          await browser.close().catch(err => console.error("Error closing browser on type change:", err));
        } catch (e) {
          // Ignore errors
        }
        resetBrowserState();
      }
      
      console.error(`Launching new ${browserType} browser instance...`);
      
      // Use the appropriate browser engine
      let browserInstance;
      switch (browserType) {
        case 'firefox':
          browserInstance = firefox;
          break;
        case 'webkit':
          browserInstance = webkit;
          break;
        case 'chromium':
        default:
          browserInstance = chromium;
          break;
      }
      
      const executablePath = process.env.CHROME_EXECUTABLE_PATH;

      browser = await browserInstance.launch({
        headless,
        executablePath: executablePath,
        ...(proxy && { proxy })
      });
      
      currentBrowserType = browserType;

      // Add cleanup logic when browser is disconnected
      browser.on('disconnected', () => {
        console.error("Browser disconnected event triggered");
        browser = undefined;
        page = undefined;
      });

      const context = await browser.newContext({
        ...userAgent && { userAgent },
        viewport: {
          width: viewport?.width ?? 1280,
          height: viewport?.height ?? 720,
        },
        deviceScaleFactor: 1,
      });

      // Listen for new pages in this context
      context.on('page', async (newPage) => {
        console.error("New page opened in context");
        await registerConsoleMessage(newPage);
        if (autoAnnotationEnabled) {
          await setupAutoAnnotation(newPage);
          // Also execute immediately after page loads
          newPage.on('load', async () => {
            try {
              await newPage.evaluate(getAutoAnnotationInitScript());
            } catch (e) {
              // Ignore errors
            }
          });
        }
      });

      page = await context.newPage();

      // Register console message handler
      await registerConsoleMessage(page);
      
      // Setup auto-annotation
      if (autoAnnotationEnabled) {
        await setupAutoAnnotation(page);
      }
    }
    
    // Verify page is still valid
    if (!page || page.isClosed()) {
      console.error("Page is closed or invalid. Creating new page...");
      // Create a new page if the current one is invalid
      const context = browser.contexts()[0] || await browser.newContext();
      page = await context.newPage();
      
      // Re-register console message handler
      await registerConsoleMessage(page);
      
      // Setup auto-annotation
      if (autoAnnotationEnabled) {
        await setupAutoAnnotation(page);
      }
    }
    
    return page!;
  } catch (error) {
    console.error("Error ensuring browser:", error);
    // If something went wrong, clean up completely and retry once
    try {
      if (browser) {
        await browser.close().catch(() => {});
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
    
    resetBrowserState();
    
    // Try one more time from scratch
    const { viewport, userAgent, headless = false, browserType = 'chromium', proxy } = browserSettings ?? {};
    
    // Use the appropriate browser engine
    let browserInstance;
    switch (browserType) {
      case 'firefox':
        browserInstance = firefox;
        break;
      case 'webkit':
        browserInstance = webkit;
        break;
      case 'chromium':
      default:
        browserInstance = chromium;
        break;
    }
    
    browser = await browserInstance.launch({ 
      headless,
      ...(proxy && { proxy })
    });
    currentBrowserType = browserType;
    
    browser.on('disconnected', () => {
      console.error("Browser disconnected event triggered (retry)");
      browser = undefined;
      page = undefined;
    });

    const context = await browser.newContext({
      ...userAgent && { userAgent },
      viewport: {
        width: viewport?.width ?? 1280,
        height: viewport?.height ?? 720,
      },
      deviceScaleFactor: 1,
    });

    // Listen for new pages in this context
    context.on('page', async (newPage) => {
      console.error("New page opened in context (retry)");
      await registerConsoleMessage(newPage);
      if (autoAnnotationEnabled) {
        await setupAutoAnnotation(newPage);
        newPage.on('load', async () => {
          try {
            await newPage.evaluate(getAutoAnnotationInitScript());
          } catch (e) {
            // Ignore errors
          }
        });
      }
    });

    page = await context.newPage();
    
    await registerConsoleMessage(page);
    
    // Setup auto-annotation
    if (autoAnnotationEnabled) {
      await setupAutoAnnotation(page);
    }
    
    return page!;
  }
}

/**
 * Setup auto-annotation for a page
 */
async function setupAutoAnnotation(page: Page) {
  // Add init script for auto-annotation on every navigation
  await page.addInitScript(getAutoAnnotationInitScript());
}

/**
 * Enable or disable auto-annotation
 */
export function setAutoAnnotation(enabled: boolean) {
  autoAnnotationEnabled = enabled;
}

/**
 * Get auto-annotation status
 */
export function isAutoAnnotationEnabled(): boolean {
  return autoAnnotationEnabled;
}

/**
 * Initialize all tool instances
 */
function initializeTools(server: any) {
  // Browser tools
  if (!screenshotTool) screenshotTool = new ScreenshotTool(server);
  if (!navigationTool) navigationTool = new NavigationTool(server);
  if (!closeBrowserTool) closeBrowserTool = new CloseBrowserTool(server);
  if (!consoleLogsTool) consoleLogsTool = new ConsoleLogsTool(server);
  if (!clickTool) clickTool = new ClickTool(server);
  if (!iframeClickTool) iframeClickTool = new IframeClickTool(server);
  if (!iframeFillTool) iframeFillTool = new IframeFillTool(server);
  if (!selectTool) selectTool = new SelectTool(server);
  if (!hoverTool) hoverTool = new HoverTool(server);
  if (!evaluateTool) evaluateTool = new EvaluateTool(server);
  if (!expectResponseTool) expectResponseTool = new ExpectResponseTool(server);
  if (!customUserAgentTool) customUserAgentTool = new CustomUserAgentTool(server);
  if (!visibleTextTool) visibleTextTool = new VisibleTextTool(server);
  if (!visibleHtmlTool) visibleHtmlTool = new VisibleHtmlTool(server);

  // Initialize new tools
  if (!goBackTool) goBackTool = new GoBackTool(server);
  if (!goForwardTool) goForwardTool = new GoForwardTool(server);
  if (!dragTool) dragTool = new DragTool(server);
  if (!pressKeyTool) pressKeyTool = new PressKeyTool(server);
  
  // Element annotation tools
  if (!annotateElementsTool) annotateElementsTool = new AnnotateElementsTool(server);
  if (!clickByIndexTool) clickByIndexTool = new ClickByIndexTool(server);
  if (!fillByIndexTool) fillByIndexTool = new FillByIndexTool(server);
}

/**
 * Main handler for tool calls
 */
export async function handleToolCall(
  name: string,
  args: any,
  server: any
): Promise<CallToolResult> {
  // Initialize tools
  initializeTools(server);

  try {
    // Special case for browser close to ensure it always works
    if (name === "playwright_close") {
      if (browser) {
        try {
          if (browser.isConnected()) {
            await browser.close().catch(e => console.error("Error closing browser:", e));
          }
        } catch (error) {
          console.error("Error during browser close in handler:", error);
        } finally {
          resetBrowserState();
        }
        return {
          content: [{
            type: "text",
            text: "Browser closed successfully",
          }],
          isError: false,
        };
      }
      return {
        content: [{
          type: "text",
          text: "No browser instance to close",
        }],
        isError: false,
      };
    }

    // Check if we have a disconnected browser that needs cleanup
    if (browser && !browser.isConnected() && BROWSER_TOOLS.includes(name)) {
      console.error("Detected disconnected browser before tool execution, cleaning up...");
      try {
        await browser.close().catch(() => {}); // Ignore errors
      } catch (e) {
        // Ignore any errors during cleanup
      }
      resetBrowserState();
    }

  // Prepare context based on tool requirements
  const context: ToolContext = {
    server
  };
  
  // Set up browser if needed
  if (BROWSER_TOOLS.includes(name)) {
    const browserSettings = {
      viewport: {
        width: args.width,
        height: args.height
      },
      userAgent: name === "playwright_custom_user_agent" ? args.userAgent : undefined,
      headless: args.headless,
      browserType: args.browserType || 'chromium',
      proxy: args.proxy
    };
    
    try {
      context.page = await ensureBrowser(browserSettings);
      context.browser = browser;
    } catch (error) {
      console.error("Failed to ensure browser:", error);
      return {
        content: [{
          type: "text",
          text: `Failed to initialize browser: ${(error as Error).message}. Please try again.`,
        }],
        isError: true,
      };
    }
  }

    // Route to appropriate tool
    switch (name) {
      // Browser tools
      case "playwright_navigate":
        return await navigationTool.execute(args, context);
        
      case "playwright_screenshot":
        return await screenshotTool.execute(args, context);
        
      case "playwright_close":
        return await closeBrowserTool.execute(args, context);
        
      case "playwright_console_logs":
        return await consoleLogsTool.execute(args, context);
        
      case "playwright_click":
        return await clickTool.execute(args, context);
        
      case "playwright_iframe_click":
        return await iframeClickTool.execute(args, context);

      case "playwright_iframe_fill":
        return await iframeFillTool.execute(args, context);
        
      case "playwright_select":
        return await selectTool.execute(args, context);
        
      case "playwright_hover":
        return await hoverTool.execute(args, context);
        
      case "playwright_evaluate":
        return await evaluateTool.execute(args, context);

      case "playwright_expect_response":
        return await expectResponseTool.execute(args, context);

      case "playwright_custom_user_agent":
        return await customUserAgentTool.execute(args, context);
        
      case "playwright_get_visible_text":
        return await visibleTextTool.execute(args, context);
      
      case "playwright_get_visible_html":
        return await visibleHtmlTool.execute(args, context);
      
      // New tools
      case "playwright_go_back":
        return await goBackTool.execute(args, context);
      case "playwright_go_forward":
        return await goForwardTool.execute(args, context);
      case "playwright_drag":
        return await dragTool.execute(args, context);
      case "playwright_press_key":
        return await pressKeyTool.execute(args, context);
      
      // Element annotation tools
      case "playwright_annotate":
        return await annotateElementsTool.execute(args, context);
      case "playwright_click_by_index":
        return await clickByIndexTool.execute(args, context);
      case "playwright_fill_by_index":
        return await fillByIndexTool.execute(args, context);
      case "playwright_set_auto_annotation":
        setAutoAnnotation(args.enabled);
        return {
          content: [{
            type: "text",
            text: `Auto-annotation ${args.enabled ? 'enabled' : 'disabled'}`,
          }],
          isError: false,
        };
      case "playwright_get_annotated_elements":
        if (context.page) {
          try {
            const elements = await context.page.evaluate(() => {
              return (window as any).__playwrightAnnotatedElements || [];
            });
            // Compact format: only include fields necessary for LLM decision-making
            // Exclude boundingBox, selector, tagName to save tokens
            const compactElements = elements.map((el: any) => {
              const compact: any = {
                i: el.index,         // index (shortened key)
                t: el.type,          // type
              };
              // Only include text if non-empty
              if (el.text && el.text.trim()) {
                compact.x = el.text.trim().substring(0, 50); // text (shortened, max 50 chars)
              }
              // Only include href for links
              if (el.attributes?.href) {
                compact.h = el.attributes.href; // href (shortened key)
              }
              // Include placeholder for inputs
              if (el.attributes?.placeholder) {
                compact.p = el.attributes.placeholder; // placeholder
              }
              return compact;
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ annotated_elements: compactElements })
                }
              ],
              isError: false,
            };
          } catch (error) {
            return {
              content: [{
                type: "text",
                text: `Failed to get annotated elements: ${(error as Error).message}`,
              }],
              isError: true,
            };
          }
        }
        return {
          content: [{
            type: "text",
            text: "No page available",
          }],
          isError: true,
        };
      
      default:
        return {
          content: [{
            type: "text",
            text: `Unknown tool: ${name}`,
          }],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`Error handling tool ${name}:`, error);
    
    // Handle browser-specific errors at the top level
    if (BROWSER_TOOLS.includes(name)) {
      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes("Target page, context or browser has been closed") || 
        errorMessage.includes("Browser has been disconnected") ||
        errorMessage.includes("Target closed") ||
        errorMessage.includes("Protocol error") ||
        errorMessage.includes("Connection closed")
      ) {
        // Reset browser state if it's a connection issue
        resetBrowserState();
        return {
          content: [{
            type: "text",
            text: `Browser connection error: ${errorMessage}. Browser state has been reset, please try again.`,
          }],
          isError: true,
        };
      }
    }

    return {
      content: [{
        type: "text",
        text: error instanceof Error ? error.message : String(error),
      }],
      isError: true,
    };
  }
}

/**
 * Get console logs
 */
export function getConsoleLogs(): string[] {
  return consoleLogsTool?.getConsoleLogs() ?? [];
}

/**
 * Get screenshots
 */
export function getScreenshots(): Map<string, string> {
  return screenshotTool?.getScreenshots() ?? new Map();
}

export { registerConsoleMessage };
