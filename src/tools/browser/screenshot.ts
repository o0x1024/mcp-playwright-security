import fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Page } from 'playwright';
import { BrowserToolBase } from './base.js';
import { ToolContext, ToolResponse, createSuccessResponse } from '../common/types.js';

const defaultDownloadsPath = path.join(os.homedir(), 'Downloads');

/**
 * Tool for taking screenshots of pages or elements
 */
export class ScreenshotTool extends BrowserToolBase {
  private screenshots = new Map<string, string>();

  /**
   * Execute the screenshot tool
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    return this.safeExecute(context, async (page) => {
      const screenshotOptions: any = {
        type: args.type || "png",
        fullPage: !!args.fullPage
      };

      if (args.selector) {
        const element = await page.$(args.selector);
        if (!element) {
          return {
            content: [{
              type: "text",
              text: `Element not found: ${args.selector}`,
            }],
            isError: true
          };
        }
        screenshotOptions.element = element;
      }

      const messages: string[] = [];

      // Only set path when savePng is explicitly true
      if (args.savePng === true) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${args.name || 'screenshot'}-${timestamp}.png`;
        const downloadsDir = args.downloadsDir || defaultDownloadsPath;

        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir, { recursive: true });
        }

        const outputPath = path.join(downloadsDir, filename);
        screenshotOptions.path = outputPath;
        messages.push(`Screenshot saved to: ${path.relative(process.cwd(), outputPath)}`);
      }

      const screenshot = await page.screenshot(screenshotOptions);
      const base64Screenshot = screenshot.toString('base64');

      // Handle base64 storage
      if (args.storeBase64 !== false) {
        this.screenshots.set(args.name || 'screenshot', base64Screenshot);
        this.server.notification({
          method: "notifications/resources/list_changed",
        });
        messages.push(`Screenshot stored in memory with name: '${args.name || 'screenshot'}'`);
      }

      // Build response content
      const content: any[] = messages.map(msg => ({
        type: "text" as const,
        text: msg
      }));

      // Only include base64 data when storeBase64 is true
      if (args.storeBase64 !== false) {
        content.push({
          type: "text" as const,
          text: JSON.stringify({ screenshot_base64: base64Screenshot, mimeType: "image/png" })
        });
        content.push({
          type: "image" as const,
          data: base64Screenshot,
          mimeType: "image/png"
        });
      }

      return {
        content,
        isError: false
      };
    });
  }

  /**
   * Get all stored screenshots
   */
  getScreenshots(): Map<string, string> {
    return this.screenshots;
  }
} 