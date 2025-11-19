import { tool } from 'ai';
import Exa from 'exa-js';
import { z } from 'zod';

import { Config } from '../../../base';
import { toolError } from './error';
import { Logger } from '@nestjs/common';
import { createExaSearchTool } from './exa-search';
import { createOpenAiSearchTool } from './openai-search';

export const createWebSearchTool = (config: Config) => {
  return tool({
    description: 'Search the web for information, returns 10 results with URLS and short summaries',
    inputSchema: z.object({
      query: z.string().describe('The query to search the web for (some context notes can be provided too)'),
      mode: z
        .enum(['MUST', 'AUTO'])
        .describe('The mode to search the web for.'),
    }),
    execute: async ({ query, mode }) => {
      try {
        const webSearchModule = config.copilot.extras.webSearchModule;              

        if (webSearchModule == "gpt") {
          new Logger('WebSearchTool').log(`Performing GPT web search for query: ${query}`);
          return await performOpenAiSearch(config, query, mode);
        } else if (webSearchModule == "exa") {
          new Logger('WebSearchTool').log(`Performing EXA web search for query: ${query}`);
          return await performExaSearch(config, query, mode);
        } else {
          new Logger('WebSearchTool').error(`🔴 Web Search Module not supported: ${webSearchModule}`);
          return toolError('Web Search Failed', 'Module not supported');
        }        
      } catch (e: any) {
        new Logger('WebSearchTool').error(`🔴 OpenAI Search Failed: ${e.message}`);
        return toolError('OpenAi Search Failed', e.message);
      }
    },
  });
};

async function performOpenAiSearch(config: Config, query: string, mode: 'MUST' | 'AUTO') {
  try {
    const apiKey = config.copilot.providers.openai.apiKey;              

    new Logger('OpenAiSearchTool').log(`Performing GPT web search for query: ${query}. Key present: ${!!apiKey}`);

    if (!apiKey) {
      new Logger('OpenAiSearchTool').error('🔴 OpenAI API key is not set for web search');
      return toolError('OpenAi Search Failed', 'API key is not set');
    }
    
    const response = await fetch(`https://api.openai.com/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        "prompt": {
          "id": "pmpt_691cfd5b095c819585d25f8d5e2f4d1e06f236a40bab9627",
          "variables": {
            "query": query
          }
        }
      }),
    });

    const body = await response.json() as any;

    if (!body.output) {
      new Logger('OpenAiSearchTool').error(`🔴 OpenAI Search Failed: No output from API`);
      new Logger('OpenAiSearchTool').error(`🔴 OpenAI Failed Response: ${JSON.stringify(body)}`);
      return toolError('OpenAi Search Failed', 'No output from API');
    }

    const resultsJson = body.output[body.output.length - 1].content[0].text;
    const resultsWrapper = JSON.parse(resultsJson);
    const results = resultsWrapper.results;

    if (!results || results.length === undefined) {
      new Logger('OpenAiSearchTool').error(`🔴 OpenAI Invalid Response: ${JSON.stringify(body)}`);
      return toolError('OpenAi Search Failed', 'Invalid response from API');
    }
    
    new Logger('OpenAiSearchTool').log(`GPT web search results: ${results.length}`);

    // The result should have a shape like this:
    // {
    //   "results": [
    //     {
    //       "title": "string",
    //       "url": "string",
    //       "content": "string",
    //       "publishedDate": "string",
    //       "author": "string"
    //     }
    //   ]
    // }
            
    return results.map((data: any) => ({
      title: data.title,
      url: data.url,
      content: data.summary,
      favicon: "favicon.ico",
      publishedDate: data.publishedDate,
      author: data.author,
    }));
  } catch (e: any) {
    new Logger('OpenAiSearchTool').error(`🔴 OpenAI Search Failed: ${e.message}`);
    return toolError('OpenAi Search Failed', e.message);
  }
}

async function performExaSearch(config: Config, query: string, mode: 'MUST' | 'AUTO') {
  try {
    const { key } = config.copilot.exa;
    const exa = new Exa(key);
    const result = await exa.searchAndContents(query, {
      numResults: 10,
      summary: true,
      livecrawl: mode === 'MUST' ? 'always' : undefined,
    });
    return result.results.map(data => ({
      title: data.title,
      url: data.url,
      content: data.summary,
      favicon: data.favicon,
      publishedDate: data.publishedDate,
      author: data.author,
    }));
  } catch (e: any) {
    return toolError('Exa Search Failed', e.message);
  }
}