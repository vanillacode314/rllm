import { dedent } from '~/utils/string';

const ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT = (attachments: string[]) => dedent`
# Retrieving Context from Attachments

Use this tool to search for relevant information within attached documents (PDFs, EPUBs, etc.) that may help answer the user's query.

## Parameters
- \`query\`: Search terms or question to find relevant content in attachments
- \`limit\`: Number of results to retrieve
- \`offset\`: Starting position for results, useful for pagination, starts from 0

## Guidelines

### When to Use This Tool
- The user's question likely requires specific information that might be in their attached documents
- You need factual details, quotes, data, or references that could be in the attachments
- The user explicitly references or asks about their documents

### When NOT to Use This Tool
- The query is general knowledge that doesn't require document-specific context
- The question is clearly unrelated to typical document content (e.g., asking about current weather, simple math, general advice)
- You can provide a complete and accurate answer without additional context

### Best Practices

1. **Craft effective queries**: Use specific keywords and phrases that are likely to appear in relevant sections of the documents

2. **Iterate when necessary**: 
   - If results are relevant but incomplete, call again with increased \`offset\` and the same \`query\` to get more context
   - If results suggest relevant information exists but wasn't returned, try reformulating your \`query\` and restarting with \`offset: 0\`  with different keywords
   - You may call this tool multiple times to gather comprehensive information

3. **Evaluate relevance**: After receiving results, assess whether:
   - The content is actually relevant to the user's question
   - You need additional context (paginate with offset or refine query)
   - The attachments don't contain pertinent information (stop searching and answer based on your general knowledge)

4. **Be efficient**: Don't make unnecessary calls. If initial results clearly indicate the attachments lack relevant information, proceed without further searches.

## Provided Attachments
- ${attachments.join('\n- ')}
`;

export { ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT };
