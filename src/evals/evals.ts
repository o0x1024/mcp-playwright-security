//evals.ts

import { EvalConfig } from 'mcp-evals';
import { openai } from "@ai-sdk/openai";
import { EvalFunction } from "mcp-evals";

const config: EvalConfig = {
    model: openai("gpt-4"),
    evals: []
};
  
export default config;
  
export const evals: EvalFunction[] = [];
