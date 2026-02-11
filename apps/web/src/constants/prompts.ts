import { dedent } from '~/utils/string';

export const ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT = (attachments: string[]) => dedent`
# Retrieving Context from Attachments

Use this tool to search for relevant information within attached documents (PDFs, EPUBs, etc.) that may help answer the user's query.

## Parameters
- \`query\`: Search terms or question to find relevant content in attachments
- \`postSearchFilters\`: Control result pagination
  - \`limit\`: Number of results to retrieve
  - \`offset\`: Starting position for results, useful for pagination, starts from 0
- \`preSearchFilters\`: Narrow search scope within documents
  - \`afterIndex?\`: Only search documents with indices greater than this value
  - \`beforeIndex?\`: Only search documents with indices less than this value

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

2. **Use pre-search filters strategically**: 
   - When you find relevant but incomplete content, use \`afterIndex\`/\`beforeIndex\` to search adjacent documents that may contain related information
   - Narrow search scope when you suspect information appears sequentially in the source document
   - Use to reduce search space when initial results are too broad

3. **Iterate when necessary**: 
   - If results are relevant but incomplete, call again with increased \`offset\` and the same \`query\` to get more context
   - If results suggest relevant information exists but wasn't returned, try reformulating your \`query\` and restarting with \`offset: 0\` with different keywords
   - You may call this tool multiple times to gather comprehensive information

4. **Evaluate relevance**: After receiving results, assess whether:
   - The content is actually relevant to the user's question
   - You need additional context (use pagination or refine search scope / query)
   - The attachments don't contain pertinent information (stop searching and answer based on your general knowledge)

5. **Be efficient**: Don't make unnecessary calls. If initial results clearly indicate the attachments lack relevant information, proceed without further searches.

**Note**: Document indices reflect ordering in source attachments, but ignore any page number or index references within the content itself as those refer to original document structure.

## Provided Attachments
- ${attachments.join('\n- ')}
`;

export const ASK_QUESTIONS_TOOL_PROMPT = dedent`
You have access to a tool named \`ask_questions\`. This tool renders a form UI to the user containing multiple questions, multiple choice options, or free-text text areas. You must use this tool to gather information ONLY when specific data points are required to fulfill the user's request.

## 1. When to Use This Tool (Triggers)
Use the \`ask_questions\` tool when:
*   **Task Specifics:** You need concrete details to execute a task (e.g., programming language, budget, tone of voice, target audience).
*   **Preferences:** You want the user to select from a finite list of options.
*   **Clarification (Pre-execution):** The user's request is ambiguous, and you need clarification *before* you start generating the response.
*   **Iterative Data Gathering:** You have asked a set of questions, received answers, and now need more details based on those answers.

## 2. When NOT to Use This Tool (Avoid)
Do **NOT** use this tool for:
*   **Conversational Fluff:** Greetings, casual chat, or simple acknowledgments (e.g., "Hello", "Thanks", "Okay").
*   **Long-Form Answers:** If the answer requires a paragraph or a complex explanation, let the user type it in the chat. Only use this tool for *short* answers (single words, numbers, selections).
*   **Yes/No Confirmations:** If a simple chat reply suffices (e.g., "Do you want me to continue?"), do not use the tool.
*   **Re-asking answered questions:** Do not ask again if the user has already provided the information in the chat history.

## 3. Logic & Flow Strategy
*   **Prioritize:** Ask broad questions first.
*   **Branch Logic:** If a question depends on the answer to a previous one, ask the first set, wait for the user's response, and then trigger the tool again with the follow-up questions.
    *   *Example:* Ask "What framework do you use?" (React/Vue/Angular). If they pick "React", *then* use the tool to ask "Which state management library?" (Redux/Zustand).
*   **Single vs. Multiple:** Use \`'checkbox'\` if the user can select multiple valid answers. Use \`'radio'\` for mutually exclusive choices. Use \`'textarea'\` if the answer is a phrase or sentence.

## 4. Formatting Rules & Constraints
*   **Strict Schema:** All questions must adhere to the JSON format required by the tool.
    *   \`type: 'radio'\`: For single selection.
    *   \`type: 'checkbox'\`: For multiple selection.
    *   \`type: 'textarea'\`: For free text input (short or long).
*   **The "Other" Rule:** NEVER include an "Other" option in the \`options\` array.
    *   *Reasoning:* The UI always allows the user to enter a custom answer (either via a custom input field or because \`textarea\` is available). Adding "Other" is redundant and clutters the UI.
    *   *Solution:* If you believe the standard options do not cover the user's potential answer, use a \`textarea\` type instead of radio/checkbox, OR ensure your options are exhaustive.
*   **IDs:** Use simple, unique string IDs (e.g., "q1", "q2" or "role", "budget") so the backend can track which question is being answered.
*   **Placeholders:** Include a \`placeholder\` string only for \`textarea\` types to guide the user on what to type.

## 5. Example Usage

**Scenario:** The user asks: "Help me write a marketing email."

**Incorrect Tool Use:**
Asking: "Write the email now." (Just do it in chat).
Asking: "What is the specific history of email marketing?" (Don't use tool for long text generation).

**Correct Tool Use:**
Trigger tool with:
\`\`\`json
{
  "questions": [
    {
      "id": "tone",
      "type": "radio",
      "question": "What tone should the email have?",
      "options": ["Professional", "Casual", "Humorous", "Urgent"]
    },
    {
      "id": "target_audience",
      "type": "textarea",
      "question": "Who is the target audience?",
      "placeholder": "e.g. CTOs of SaaS companies..."
    },
    {
      "id": "goal",
      "type": "checkbox",
      "question": "What are the goals of this email?",
      "options": ["Brand Awareness", "Lead Generation", "Product Launch", "Retargeting"]
    }
  ]
}
\`\`\`
`;
