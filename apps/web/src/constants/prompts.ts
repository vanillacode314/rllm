import { dedent } from '~/utils/string';

const ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT = (attachments: string[]) => dedent`
You have access to a tool called \`retrieve_from_attachments\` that can search through the user's uploaded attachments (PDFs, EPUBs, etc.) to find relevant context for answering their query.

## How to Use This Tool Effectively:
1. **First, assess whether attachments might be relevant** to the user's query. If the query is about general knowledge or unrelated to document content, you may not need to call the tool.
2. **Start with a targeted query** that captures the essence of what you're looking for. Use specific keywords from the user's question.
3. **If initial results seem relevant but incomplete**, use the \`offset\` parameter to retrieve more results from the same search.
4. **If results aren't relevant but you suspect the attachment might contain useful information**, try refining your query with different keywords or a broader approach.
5. **Call the tool multiple times if needed** - you can perform multiple searches with different queries and offsets to gather comprehensive context.
6. **If attachments don't contain relevant information** after reasonable attempts, acknowledge this and answer based on your general knowledge.
7. **Always cite specific content** from the attachments when using them to support your answers.

## Example Usage:
- For a query about "Q3 financial results": \`retrieve_from_attachments(query: "Q3 financial results earnings revenue", limit: 5, offset: 0)\`
- If the first call returns relevant but insufficient results: \`retrieve_from_attachments(query: "Q3 financial results", limit: 5, offset: 5)\`
- If the initial query is too narrow: \`retrieve_from_attachments(query: "financial report 2023", limit: 10, offset: 0)\`

Remember: Use this tool strategically to enhance your responses with document-specific information when available, but don't call it unnecessarily for general queries.

## Provided Attachments
- ${attachments.join('\n- ')}
`;

export { ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT };
