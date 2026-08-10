import { dedent } from '~/utils/string';

export const ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT = (attachments: string[]) => dedent`
# Retrieving Context from Attachments

Use this tool to search for relevant information within attached documents (PDFs, EPUBs, etc.) that may help answer the user's query.

## Parameters
- \`ids\`: IDs of the attachments to search within (at least one). Use the IDs listed in "Provided Attachments" below to scope the search to specific attachments
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

2. **Scope the search with \`ids\`**: Search only the attachments most likely to contain the answer (e.g., based on their descriptions in "Provided Attachments"). Searching all attachments at once can return irrelevant results and is slower

3. **Use pre-search filters strategically**: 
   - When you find relevant but incomplete content, use \`afterIndex\`/\`beforeIndex\` to search adjacent documents that may contain related information
   - Narrow search scope when you suspect information appears sequentially in the source document
   - Use to reduce search space when initial results are too broad

4. **Iterate when necessary**: 
   - If results are relevant but incomplete, call again with increased \`offset\` and the same \`query\` to get more context
   - If results suggest relevant information exists but wasn't returned, try reformulating your \`query\` and restarting with \`offset: 0\` with different keywords
   - You may call this tool multiple times to gather comprehensive information

5. **Evaluate relevance**: After receiving results, assess whether:
   - The content is actually relevant to the user's question
   - You need additional context (use pagination or refine search scope / query)
   - The attachments don't contain pertinent information (stop searching and answer based on your general knowledge)

6. **Be efficient**: Don't make unnecessary calls. If initial results clearly indicate the attachments lack relevant information, proceed without further searches.

**Note**: Document indices reflect ordering in source attachments, but ignore any page number or index references within the content itself as those refer to original document structure.

## Referencing Sources in Your Response

When you use information from an attachment in your answer, wrap the relevant excerpt or claim in a \`mention-src\` tag with these attributes to tell the user where it came from:

- \`data-document-id\`: The ID of the attachment (as shown in "Provided Attachments")
- \`data-id\`: The ID of the specific excerpt or passage (returned by the search tool)
- \`data-type\`: Always \`'document'\`

Example:
<mention-src data-type="document" data-document-id="doc_123" dataId="excerpt_456">The extracted quote or paraphrased content.</mention-src>

Use this tag for direct quotes, specific data points, or any content that originates from the attachments. If you combine multiple sources, include multiple \`mention-src\` tags.

Do not wrap the text with brackets or do the citations out of the flow of the text like making all citations at the end, the tag handles correctly highliting the cited text already.

## Provided Attachments
Each attachment is listed as \`<id>: <description>\`. Pass the \`id\`(s) of the attachment(s) you want to search in the \`ids\` parameter.
- ${attachments.join('\n- ')}
`;

export const HANDOFF_TOOL_INSTRUCTIONS_PROMPT = dedent`
This tool creates a new chat with a pre-filled prompt, carrying forward relevant context from the current conversation. It is triggered when the user types "/handoff <goal>" — the LLM reads the goal from the conversation and uses this tool to start a fresh chat.

## Tool Name
\`handoff_to_new_chat\`

## Parameter
- \`prefilledPrompt\` (string, min 1 char): The prompt that will pre-populate the new chat's message box. Write it as a complete, self-contained instruction — as if the user is typing it fresh. Include any context from THIS conversation that is essential for the new chat to understand the goal.

## Strategy
1. Read the goal the user wrote \`/handoff <goal>\`. 
2. Interpret their intent.
3. If the goal is vague or ambiguous, clarify first by asking questions, then call this tool.
4. Once the tool resolves, tell the user if the handoff succeeded or failed, if it failed and a reason was provided explain the reason otherwise just end the chat.
`;

export const ASK_QUESTIONS_TOOL_PROMPT = dedent`
This tool shows a modal dialog to collect structured answers from the user. It is ideal for gathering multiple precise pieces of information at once, but should be used judiciously to avoid breaking conversational flow.

## When to Use

- You need **structured input** (e.g., a choice from a list, a short confirmation, a few brief fields).
- The questions are **independent** and can be answered in any order.
- The user expects a form-like experience, or you need to enforce specific options.
- You want to reduce back-and-forth by batching questions.

## When NOT to Use

- The answer is likely **very long** (multiple sentences or paragraphs). Use the chat interface instead, as the modal textarea is small.
- The interaction is **conversational** and a modal would feel disruptive (e.g., a single simple yes/no that could be asked inline).
- You are asking for a **short, one-off** piece of data that doesn’t need the overhead of a modal.

## Parameters

The tool takes a single object with a \`questions\` array. Each question has these fields:

| Field         | Type           | Required | Description |
|---------------|----------------|----------|-------------|
| \`id\`          | string         | YES      | Unique key to identify the response. Use a descriptive name (e.g., \`"project_name"\`). |
| \`question\`    | string         | YES      | The text displayed to the user. Keep it concise. |
| \`type\`        | enum           | YES      | \`"radio"\` (single choice), \`"checkbox"\` (zero or more), or \`"textarea"\` (free text). |
| \`options\`     | string[]       | Only for \`radio\` and \`checkbox\` | The list of selectable items. Must have **at least 2**. **Do NOT include an "Other" option** — the modal automatically provides one. Any option named "other" (case-insensitive) will be removed. |
| \`placeholder\` | string         | NO       | Hint text shown inside \`textarea\` fields. Ignored for other types. |

## Strategy: Parallel vs. Serial Calls

- **Parallel (one call with many questions)**: Use this when questions are **independent**. The modal displays all at once, and the user can submit them together. This is efficient and reduces friction.
- **Serial (multiple calls with fewer questions)**: Use this when a later question **depends on a previous answer**. Make the first call, receive the response, consider the answer, and then construct the next call with tailored questions. This allows dynamic, context-aware forms. For example, ask if the user needs a feature; if yes, ask follow-up details in a second modal.

*Note*: Even when using serial calls, you can group a few related dependent questions together if they don’t require the user to see intermediary answers.

## Response

The tool returns **JSON** of structure:

On success:
\`\`\`json
{
  "success": true,
  "responses": [
    {
      "questionId": "question_id_1",
      "answer": "answer for textarea or radio"
    },
    {
      "questionId": "question_id_2",
      "answer": ["selected", "options", "for checkbox"]
    }
    ...
  ]
}
\`\`\`
- For \`radio\`, the value is a **string** (the chosen option).
- For \`checkbox\`, the value is an **array of strings** (all selected options, possibly empty).
- For \`textarea\`, the value is a **string**.

On cancellation:
\`\`\`json
{
  "success": false,
  "message": "Cancelled by user"
}
\`\`\`

If cancelled, politely ask if the user wants to try again, skip, or provide the information in another way. Do not treat it as a failure unless the information is critical and cannot be bypassed.

## Examples

### Example 1: Independent questions (parallel)
\`\`\`json
{
  "questions": [
    {
      "id": "account_type",
      "type": "radio",
      "question": "What type of account do you want?",
      "options": ["Personal", "Business", "Education"]
    },
    {
      "id": "interests",
      "type": "checkbox",
      "question": "Which topics interest you?",
      "options": ["Coding", "Design", "Marketing", "Finance"]
    },
    {
      "id": "bio",
      "type": "textarea",
      "question": "Short bio",
      "placeholder": "Tell us about yourself..."
    }
  ]
}
\`\`\`

### Example 2: Dependent questions (serial)
**Step 1**  
Ask the initial question:
\`\`\`json
{
  "questions": [
    {
      "id": "travel_mode",
      "type": "radio",
      "question": "How do you plan to travel?",
      "options": ["Flight", "Car", "Train"]
    }
  ]
}
\`\`\`
**Step 2**  
After receiving \`{ "travel_mode": "Car" }\`, ask relevant follow-ups:
\`\`\`json
{
  "questions": [
    {
      "id": "car_type",
      "type": "radio",
      "question": "What type of car do you prefer?",
      "options": ["Sedan", "SUV", "Electric"]
    },
    {
      "id": "car_extras",
      "type": "checkbox",
      "question": "Any extras?",
      "options": ["GPS", "Child seat", "Additional driver"]
    }
  ]
}
\`\`\`

## Rules & Tips

1. **Always include at least one question** (the array must not be empty).
2. **Never provide an "Other" option** – it is added automatically. Explicitly including it will cause it to be stripped, confusing you and the user.
3. **Use clear, descriptive \`id\`s** – they are your only handle to map responses back to meaning.
4. **For \`radio\` and \`checkbox\`, provide at least 2 options**, and ensure they are mutually exclusive (for radio) or non-overlapping (unless intentional).
6. **Do not ask for sensitive personal data** (passwords, credit card numbers) through this tool.
7. **If the user cancels, handle gracefully** – offer alternatives, don’t force the modal again immediately.
8. **Prefer parallel calls** when possible to minimize interruptions, but use serial when context-dependent follow-ups are needed.
`;

export const WEB_SEARCH_SYSTEM_PROMPT = dedent`
# Citing Web Search Sources in Your Response

When you use information retrieved from web search results in your answer, wrap the relevant excerpt or claim in a \`mention-src\` tag with these attributes to tell the user where it came from:

- \`data-type\`: Always \`'url'\`
- \`data-href\`: The full URL of the source page

Example:
<mention-src data-type="url" data-href="https://example.com/article">The quoted or paraphrased content.</mention-src>

Use this tag for direct quotes, specific data points, or any content that originates from web search results. If you combine multiple sources, include multiple \`mention-src\` tags.

Do not wrap the text with brackets or do the citations out of the flow of the text like making all citations at the end, the tag handles correctly highliting the cited text already.
`;

export const MATH_SYSTEM_PROMPT = dedent`
You may use math syntax in your output.

Rules:
- Inline math: use two or more \`$\` markers (single \`$...$\` is NOT supported and will not render as math).
- Block/display math: wrap in a fenced block with \`$$\` on its own lines.
- Same number of markers must close an inline sequence; closing fence may be >= opening fence for blocks.
- You may embed literal \`$\` inside math by using larger sequences.
- Single \`$\` is fine for non-math content, e.g. currency: "The total is $1,200.50" — it just won't be treated as math.

Examples:
Inline: $$x^2 + y^2 = z^2$$
Block:

$$
${String.raw`\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}`}
$$
`;
