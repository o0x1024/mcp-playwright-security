import fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Page } from 'playwright';
import { BrowserToolBase } from './base.js';
import { ToolContext, ToolResponse, createSuccessResponse, createErrorResponse } from '../common/types.js';

const defaultDownloadsPath = path.join(os.homedir(), 'Downloads');

// Element annotation result
export interface AnnotatedElement {
  index: number;
  type: string;
  tagName: string;
  text: string;
  selector: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  attributes: Record<string, string>;
}

// Colors for different element types
const ELEMENT_COLORS: Record<string, string> = {
  button: '#FF6B6B',      // Red
  link: '#4ECDC4',        // Teal
  input: '#45B7D1',       // Blue
  select: '#96CEB4',      // Green
  textarea: '#FFEAA7',    // Yellow
  checkbox: '#DDA0DD',    // Plum
  radio: '#98D8C8',       // Mint
  submit: '#F7DC6F',      // Gold
  file: '#BB8FCE',        // Purple
  form: '#85C1E9',        // Light Blue
  clickable: '#F8B500',   // Orange
  default: '#FF69B4'      // Hot Pink
};

/**
 * Auto-annotation init script - injected once via addInitScript
 * This sets up automatic annotation on page load and DOM changes
 */
export function getAutoAnnotationInitScript() {
  return `
    (function() {
      try {
        // Element type colors
        const colors = ${JSON.stringify(ELEMENT_COLORS)};
        
        // Store current annotations data
        window.__playwrightAnnotatedElements = window.__playwrightAnnotatedElements || [];
        
        // Annotation function
        function annotateElements() {
          try {
            if (!document.body) return [];
            
            // Remove existing annotations
            const existingAnnotations = document.querySelectorAll('.playwright-element-annotation');
            existingAnnotations.forEach(el => el.remove());
            
            // Find all interactive elements
            const selectors = [
              // Native HTML elements
              'a[href]',
              'button',
              'input:not([type="hidden"])',
              'select',
              'textarea',
              'label[for]',
              'summary',
              
              // ARIA roles
              '[role="button"]',
              '[role="link"]',
              '[role="checkbox"]',
              '[role="radio"]',
              '[role="menuitem"]',
              '[role="menuitemcheckbox"]',
              '[role="menuitemradio"]',
              '[role="tab"]',
              '[role="switch"]',
              '[role="option"]',
              '[role="treeitem"]',
              '[role="gridcell"]',
              '[role="row"][onclick]',
              '[role="listitem"]',
              
              // Event handlers
              '[onclick]',
              '[ng-click]',
              '[v-on\\\\3A click]',
              '[contenteditable="true"]',
              '[tabindex]:not([tabindex="-1"])',
              
              // Element UI / Element Plus
              '.el-button',
              '.el-link',
              '.el-checkbox',
              '.el-radio',
              '.el-switch',
              '.el-input__inner',
              '.el-select',
              '.el-dropdown',
              '.el-menu-item',
              '.el-submenu__title',
              '.el-tabs__item',
              '.el-pagination button',
              '.el-pagination li',
              '.el-table__row',
              '.el-tree-node__content',
              '.el-upload',
              '.el-date-editor',
              '.el-cascader',
              '.el-tag',
              '.el-breadcrumb__item',
              
              // Ant Design
              '.ant-btn',
              '.ant-input',
              '.ant-select',
              '.ant-checkbox',
              '.ant-radio',
              '.ant-switch',
              '.ant-menu-item',
              '.ant-tabs-tab',
              '.ant-pagination-item',
              '.ant-table-row',
              '.ant-tree-node-content-wrapper',
              '.ant-dropdown-trigger',
              '.ant-tag',
              
              // Bootstrap
              '.btn',
              '.nav-link',
              '.dropdown-item',
              '.page-link',
              '.list-group-item-action',
              
              // Common patterns
              '[class*="btn"]',
              '[class*="click"]',
              '[class*="link"]',
              '.icon-btn',
              '.action',
              '.clickable',
              '.pointer'
            ];
            
            // Get elements by selectors
            const selectorElements = document.querySelectorAll(selectors.join(','));
            const elementSet = new Set(selectorElements);
            
            // Also find elements with cursor:pointer style (common for clickable elements)
            document.querySelectorAll('*').forEach(el => {
              try {
                const style = window.getComputedStyle(el);
                if (style.cursor === 'pointer' && !elementSet.has(el)) {
                  // Skip if parent is already in the set
                  let parent = el.parentElement;
                  let parentInSet = false;
                  while (parent) {
                    if (elementSet.has(parent)) {
                      parentInSet = true;
                      break;
                    }
                    parent = parent.parentElement;
                  }
                  if (!parentInSet) {
                    elementSet.add(el);
                  }
                }
              } catch (e) {}
            });
            
            const elements = Array.from(elementSet);
            const results = [];
            let index = 0;
            
            elements.forEach((element) => {
              try {
                const rect = element.getBoundingClientRect();
                const style = window.getComputedStyle(element);
                
                // Skip hidden elements
                if (rect.width === 0 || rect.height === 0 || 
                    style.display === 'none' || 
                    style.visibility === 'hidden' ||
                    style.opacity === '0') {
                  return;
                }
                
                // Skip elements outside viewport
                if (rect.bottom < 0 || rect.top > window.innerHeight ||
                    rect.right < 0 || rect.left > window.innerWidth) {
                  return;
                }
                
                // Skip very small elements (likely icons inside buttons)
                if (rect.width < 10 || rect.height < 10) {
                  return;
                }
                
                // Determine element type
                const tagName = element.tagName.toLowerCase();
                let type = 'clickable';
                
                if (tagName === 'a') type = 'link';
                else if (tagName === 'button' || element.getAttribute('role') === 'button') type = 'button';
                else if (tagName === 'input') {
                  const inputType = element.getAttribute('type') || 'text';
                  if (inputType === 'submit' || inputType === 'button') type = 'submit';
                  else if (inputType === 'checkbox') type = 'checkbox';
                  else if (inputType === 'radio') type = 'radio';
                  else if (inputType === 'file') type = 'file';
                  else type = 'input';
                }
                else if (tagName === 'select') type = 'select';
                else if (tagName === 'textarea') type = 'textarea';
                else if (tagName === 'form') type = 'form';
                
                const color = colors[type] || colors.default;
                
                // Create annotation overlay
                const annotation = document.createElement('div');
                annotation.className = 'playwright-element-annotation';
                annotation.style.cssText = 
                  'position: fixed;' +
                  'left: ' + rect.left + 'px;' +
                  'top: ' + rect.top + 'px;' +
                  'width: ' + rect.width + 'px;' +
                  'height: ' + rect.height + 'px;' +
                  'border: 2px solid ' + color + ';' +
                  'background: ' + color + '20;' +
                  'pointer-events: none;' +
                  'z-index: 2147483646;' +
                  'box-sizing: border-box;';
                
                // Create label with index number
                const label = document.createElement('div');
                label.className = 'playwright-element-annotation';
                label.style.cssText = 
                  'position: fixed;' +
                  'left: ' + (rect.left - 2) + 'px;' +
                  'top: ' + (rect.top - 18) + 'px;' +
                  'background: ' + color + ';' +
                  'color: white;' +
                  'font-size: 11px;' +
                  'font-weight: bold;' +
                  'font-family: monospace;' +
                  'padding: 1px 4px;' +
                  'border-radius: 3px;' +
                  'z-index: 2147483647;' +
                  'pointer-events: none;' +
                  'white-space: nowrap;';
                label.textContent = index.toString();
                
                document.body.appendChild(annotation);
                document.body.appendChild(label);
                
                // Build selector
                let selector = '';
                if (element.id) {
                  selector = '#' + element.id;
                } else {
                  selector = tagName;
                  const classes = Array.from(element.classList).slice(0, 2).join('.');
                  if (classes) selector += '.' + classes;
                }
                
                // Get text content
                let text = '';
                if (tagName === 'input' || tagName === 'textarea') {
                  text = element.value || element.placeholder || '';
                } else {
                  text = element.innerText || element.textContent || '';
                }
                text = text.trim().substring(0, 100);
                
                // Collect attributes
                const attrs = {};
                ['href', 'type', 'name', 'placeholder', 'value', 'role', 'aria-label'].forEach(attr => {
                  if (element.hasAttribute(attr)) {
                    attrs[attr] = element.getAttribute(attr);
                  }
                });
                
                results.push({
                  index: index,
                  type: type,
                  tagName: tagName,
                  text: text,
                  selector: selector,
                  boundingBox: {
                    x: Math.round(rect.left),
                    y: Math.round(rect.top),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                  },
                  attributes: attrs
                });
                
                index++;
              } catch (e) {}
            });
            
            window.__playwrightAnnotatedElements = results;
            return results;
          } catch (e) {
            return [];
          }
        }
        
        // Debounce function
        let debounceTimer;
        function debouncedAnnotate() {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(annotateElements, 200);
        }
        
        // Setup function to initialize observers
        function setup() {
          if (!document.body) {
            setTimeout(setup, 100);
            return;
          }
          
          // Run annotation
          annotateElements();
          
          // Re-annotate on scroll
          window.addEventListener('scroll', debouncedAnnotate, { passive: true });
          
          // Re-annotate on resize
          window.addEventListener('resize', debouncedAnnotate);
          
          // Re-annotate on DOM mutations
          try {
            const observer = new MutationObserver(debouncedAnnotate);
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style', 'class', 'hidden', 'disabled']
            });
          } catch (e) {}
        }
        
        // Run setup
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', setup);
        } else {
          setup();
        }
        
        // Expose functions globally
        window.__playwrightAnnotate = annotateElements;
        window.__playwrightRemoveAnnotations = function() {
          const annotations = document.querySelectorAll('.playwright-element-annotation');
          annotations.forEach(el => el.remove());
        };
      } catch (e) {}
    })();
  `;
}

/**
 * JavaScript to inject into page for annotating elements (manual trigger)
 */
function getAnnotationScript() {
  return `
    (function() {
      // Remove existing annotations
      const existingAnnotations = document.querySelectorAll('.playwright-element-annotation');
      existingAnnotations.forEach(el => el.remove());
      
      // Element type colors
      const colors = ${JSON.stringify(ELEMENT_COLORS)};
      
      // Find all interactive elements
      const selectors = [
        // Native HTML elements
        'a[href]',
        'button',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        'label[for]',
        'summary',
        
        // ARIA roles
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="menuitem"]',
        '[role="menuitemcheckbox"]',
        '[role="menuitemradio"]',
        '[role="tab"]',
        '[role="switch"]',
        '[role="option"]',
        '[role="treeitem"]',
        '[role="gridcell"]',
        '[role="row"][onclick]',
        '[role="listitem"]',
        
        // Event handlers
        '[onclick]',
        '[ng-click]',
        '[v-on\\\\3A click]',
        '[contenteditable="true"]',
        '[tabindex]:not([tabindex="-1"])',
        
        // Element UI / Element Plus
        '.el-button',
        '.el-link',
        '.el-checkbox',
        '.el-radio',
        '.el-switch',
        '.el-input__inner',
        '.el-select',
        '.el-dropdown',
        '.el-menu-item',
        '.el-submenu__title',
        '.el-tabs__item',
        '.el-pagination button',
        '.el-pagination li',
        '.el-table__row',
        '.el-tree-node__content',
        '.el-upload',
        '.el-date-editor',
        '.el-cascader',
        '.el-tag',
        '.el-breadcrumb__item',
        
        // Ant Design
        '.ant-btn',
        '.ant-input',
        '.ant-select',
        '.ant-checkbox',
        '.ant-radio',
        '.ant-switch',
        '.ant-menu-item',
        '.ant-tabs-tab',
        '.ant-pagination-item',
        '.ant-table-row',
        '.ant-tree-node-content-wrapper',
        '.ant-dropdown-trigger',
        '.ant-tag',
        
        // Bootstrap
        '.btn',
        '.nav-link',
        '.dropdown-item',
        '.page-link',
        '.list-group-item-action',
        
        // Common patterns
        '[class*="btn"]',
        '[class*="click"]',
        '[class*="link"]',
        '.icon-btn',
        '.action',
        '.clickable',
        '.pointer'
      ];
      
      // Get elements by selectors
      const selectorElements = document.querySelectorAll(selectors.join(','));
      const elementSet = new Set(selectorElements);
      
      // Also find elements with cursor:pointer style
      document.querySelectorAll('*').forEach(el => {
        try {
          const style = window.getComputedStyle(el);
          if (style.cursor === 'pointer' && !elementSet.has(el)) {
            let parent = el.parentElement;
            let parentInSet = false;
            while (parent) {
              if (elementSet.has(parent)) {
                parentInSet = true;
                break;
              }
              parent = parent.parentElement;
            }
            if (!parentInSet) {
              elementSet.add(el);
            }
          }
        } catch (e) {}
      });
      
      const elements = Array.from(elementSet);
      const results = [];
      let index = 0;
      
      elements.forEach((element) => {
        // Skip hidden elements
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        if (rect.width === 0 || rect.height === 0 || 
            style.display === 'none' || 
            style.visibility === 'hidden' ||
            style.opacity === '0') {
          return;
        }
        
        // Skip elements outside viewport
        if (rect.bottom < 0 || rect.top > window.innerHeight ||
            rect.right < 0 || rect.left > window.innerWidth) {
          return;
        }
        
        // Skip very small elements
        if (rect.width < 10 || rect.height < 10) {
          return;
        }
        
        // Determine element type
        const tagName = element.tagName.toLowerCase();
        let type = 'clickable';
        
        if (tagName === 'a') type = 'link';
        else if (tagName === 'button' || element.getAttribute('role') === 'button') type = 'button';
        else if (tagName === 'input') {
          const inputType = element.getAttribute('type') || 'text';
          if (inputType === 'submit' || inputType === 'button') type = 'submit';
          else if (inputType === 'checkbox') type = 'checkbox';
          else if (inputType === 'radio') type = 'radio';
          else if (inputType === 'file') type = 'file';
          else type = 'input';
        }
        else if (tagName === 'select') type = 'select';
        else if (tagName === 'textarea') type = 'textarea';
        else if (tagName === 'form') type = 'form';
        
        const color = colors[type] || colors.default;
        
        // Create annotation overlay
        const annotation = document.createElement('div');
        annotation.className = 'playwright-element-annotation';
        annotation.style.cssText = \`
          position: fixed;
          left: \${rect.left}px;
          top: \${rect.top}px;
          width: \${rect.width}px;
          height: \${rect.height}px;
          border: 2px solid \${color};
          background: \${color}20;
          pointer-events: none;
          z-index: 2147483646;
          box-sizing: border-box;
        \`;
        
        // Create label with index number
        const label = document.createElement('div');
        label.className = 'playwright-element-annotation';
        label.style.cssText = \`
          position: fixed;
          left: \${rect.left - 2}px;
          top: \${rect.top - 18}px;
          background: \${color};
          color: white;
          font-size: 11px;
          font-weight: bold;
          font-family: monospace;
          padding: 1px 4px;
          border-radius: 3px;
          z-index: 2147483647;
          pointer-events: none;
          white-space: nowrap;
        \`;
        label.textContent = \`\${index}\`;
        
        document.body.appendChild(annotation);
        document.body.appendChild(label);
        
        // Build selector
        let selector = '';
        if (element.id) {
          selector = '#' + element.id;
        } else {
          selector = tagName;
          const classes = Array.from(element.classList).slice(0, 2).join('.');
          if (classes) selector += '.' + classes;
        }
        
        // Get text content
        let text = '';
        if (tagName === 'input' || tagName === 'textarea') {
          text = element.value || element.placeholder || '';
        } else {
          text = element.innerText || element.textContent || '';
        }
        text = text.trim().substring(0, 100);
        
        // Collect attributes
        const attrs = {};
        ['href', 'type', 'name', 'placeholder', 'value', 'role', 'aria-label'].forEach(attr => {
          if (element.hasAttribute(attr)) {
            attrs[attr] = element.getAttribute(attr);
          }
        });
        
        results.push({
          index: index,
          type: type,
          tagName: tagName,
          text: text,
          selector: selector,
          boundingBox: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          attributes: attrs
        });
        
        index++;
      });
      
      return results;
    })();
  `;
}

/**
 * JavaScript to remove annotations from page
 */
function getRemoveAnnotationScript() {
  return `
    (function() {
      const annotations = document.querySelectorAll('.playwright-element-annotation');
      annotations.forEach(el => el.remove());
    })();
  `;
}

/**
 * Tool for annotating interactive elements on a page
 */
export class AnnotateElementsTool extends BrowserToolBase {
  /**
   * Execute element annotation
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    return this.safeExecute(context, async (page) => {
      // Inject annotation script and get element data
      const elements = await page.evaluate(getAnnotationScript()) as AnnotatedElement[];
      
      // Build summary text
      const summary = elements.map(el => 
        `[${el.index}] ${el.type.toUpperCase()} (${el.boundingBox.x},${el.boundingBox.y}) - ${el.text || el.selector}`
      ).join('\n');
      
      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${elements.length} interactive elements:\n\n${summary}`
          },
          {
            type: "text" as const,
            text: JSON.stringify({ annotated_elements: elements })
          }
        ],
        isError: false
      };
    });
  }
}

/**
 * Tool for removing annotations from page
 */
export class RemoveAnnotationsTool extends BrowserToolBase {
  /**
   * Execute annotation removal
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    return this.safeExecute(context, async (page) => {
      await page.evaluate(getRemoveAnnotationScript());
      return createSuccessResponse("Annotations removed from page");
    });
  }
}

/**
 * Tool for clicking element by annotation index
 */
export class ClickByIndexTool extends BrowserToolBase {
  /**
   * Execute click by index
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    const { index } = args;
    
    if (typeof index !== 'number') {
      return createErrorResponse("index parameter is required and must be a number");
    }
    
    return this.safeExecute(context, async (page) => {
      // Try to get cached annotated elements first (from auto-annotation)
      let elements = await page.evaluate(() => {
        return (window as any).__playwrightAnnotatedElements || [];
      }) as AnnotatedElement[];
      
      // If no cached elements, run annotation script
      if (elements.length === 0) {
        elements = await page.evaluate(getAnnotationScript()) as AnnotatedElement[];
      }
      
      // Find element by index
      const element = elements.find(el => el.index === index);
      if (!element) {
        return createErrorResponse(`Element with index ${index} not found. Available indices: 0-${elements.length - 1}`);
      }
      
      // Click at center of element
      const centerX = element.boundingBox.x + element.boundingBox.width / 2;
      const centerY = element.boundingBox.y + element.boundingBox.height / 2;
      
      // Remove annotations before clicking
      await page.evaluate(getRemoveAnnotationScript());
      
      // Click
      await page.mouse.click(centerX, centerY);
      
      return createSuccessResponse(
        `Clicked element [${index}] (${element.type}) at (${Math.round(centerX)}, ${Math.round(centerY)})`
      );
    });
  }
}

// Export annotation script for use in other tools
export { getAnnotationScript, getRemoveAnnotationScript };

