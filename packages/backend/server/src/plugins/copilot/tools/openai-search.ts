import { tool } from 'ai';
import Exa from 'exa-js';
import { z } from 'zod';

import { Config } from '../../../base';
import { toolError } from './error';
import { Logger } from '@nestjs/common';

export const createOpenAiSearchTool = (config: Config) => {
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
    },
  });
};
