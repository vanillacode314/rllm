# PLAN: Date/Time System Prompt Toggle

## Goal
Add per-chat toggle to prepend current date/time to system prompt before sending to LLM. Default ON.

## Files to Touch

1. **Schema & Types**
   - `src/lib/chat/settings.ts`
     - Extend `chatSettingsSchema` with `includeDateTimeInSystemPrompt: z._default(z.boolean(), true)`
     - Field auto‑propagates to `TChatSettings`, `TChat`, `TChatPreset`

2. **Chat Settings UI**
   - `src/components/TheChatSettingsDrawer.tsx`
     - Add `<Switch>` component below system prompt textarea
     - Bind to `chatSettings().includeDateTimeInSystemPrompt`
     - Call `updateChatSettings()` on toggle

3. **Preset Management**
   - `src/components/modals/auto‑import/EditPresetModal.tsx`
     - Add Switch to preset form
     - Include field in `formSchema`
     - Update preset save/load

4. **Generation Logic**
   - `src/lib/chat/generation.ts`
     - Modify `system` passed to adapter
     - Conditionally prepend formatted date/time when `chat.settings.includeDateTimeInSystemPrompt` true
     - Format: `new Date().toLocaleString('en‑US', { dateStyle: 'full', timeStyle: 'long' })`

5. **Default Initialization**
   - `src/lib/chat/settings.ts` – `initChatSettings()` sets default `includeDateTimeInSystemPrompt: true`
   - `src/routes/chat/$.tsx` – loader uses default chat settings

## Module Shapes

- New field: `includeDateTimeInSystemPrompt: boolean` in `TChatSettings`
- Default: `true` (Zod `_default`)
- UI component: `<Switch>` with label “Include current date/time in system prompt”
- Date formatting: inline at generation time (no storage)

## API Names & Signatures

- Schema field: `includeDateTimeInSystemPrompt: z._default(z.boolean(), true)`
- Format function: `const formatCurrentDateTime = () => new Date().toLocaleString(...)`
- Generation prepend:
  ```ts
  const system = includeDateTime
    ? `Current date and time: ${formatCurrentDateTime()}\n\n${systemPrompt}`
    : systemPrompt;
  ```

## State & Data Flow

1. Toggle stored in chat settings (per‑chat) and presets
2. UI updates via `updateChatSettings()` → dispatches to logger → updates DB
3. Generation reads `chat.settings.includeDateTimeInSystemPrompt` at runtime
4. Date/time evaluated at generation moment (not at chat creation)

## Edge Cases & Constraints

- Empty system prompt: still prepends date/time line alone
- Existing chats: missing field → default `true` (Zod default handles)
- Preset migration: existing presets get default `true` when loaded
- Timezone: locale string includes timezone (full date, long time)
- Adapter compatibility: only OpenAI adapter currently; prepend happens before adapter call

## Implementation Order

1. **Schema update** (backwards compatible)
2. **Generation logic** (prepend function)
3. **Chat settings UI** (drawer)
4. **Preset UI** (edit modal)
5. **Optional display** (preset cards – low priority)

## Notes

- Global vs per‑chat: per‑chat setting only; no global userMetadata needed
- Date format: fixed locale ‘en‑US’; configurable later possible
- Separator: “Current date and time: {datetime}\n\n” before user’s system prompt
- No migration required – Zod defaults handle missing fields