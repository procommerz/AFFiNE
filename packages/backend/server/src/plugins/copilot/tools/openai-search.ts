import { tool } from 'ai';
import Exa from 'exa-js';
import { z } from 'zod';

import { Config } from '../../../base';
import { toolError } from './error';
import { Logger } from '@nestjs/common';

export const createOpenAiSearchTool = (config: Config) => {
  return tool({
    description: 'Search the web for information',
    inputSchema: z.object({
      query: z.string().describe('The query to search the web for.'),
      mode: z
        .enum(['MUST', 'AUTO'])
        .describe('The mode to search the web for.'),
    }),
    execute: async ({ query, mode }) => {
      try {
        const apiKey = config.copilot.providers.openai.apiKey;              
        
        const response = await fetch(`https://api.openai.com/v1/responses`, {
          method: 'POST',
          headers: {
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

        const resultsJson = body.output[body.output.length - 1].content[0].text;
        const results = JSON.parse(resultsJson);
        
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
        return toolError('OpenAi Search Failed', e.message);
      }
    },
  });
};
