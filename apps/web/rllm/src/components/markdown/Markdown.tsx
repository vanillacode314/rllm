import type { Root } from 'hast';

import { Repeat } from '@solid-primitives/range';
import { createResizeObserver } from '@solid-primitives/resize-observer';
import { useQuery } from '@tanstack/solid-query';
import { html } from 'property-information';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {
  createMemo,
  createSignal,
  Index,
  type JSX,
  Match,
  type ParentProps,
  Show,
  splitProps,
  Suspense,
  Switch
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { Button } from 'ui/button';
import { cn } from 'ui/utils/tailwind';
import { unified } from 'unified';
import { VFile } from 'vfile';

import { useDocumentDialog } from '~/components/modals/auto-import/DocumentDialog';
import { hoverStateChange } from '~/directives/hover-state-change';
import { vectorDb } from '~/lib/vector-db/client';
import { transientDb } from '~/lib/vector-db/transient';
import { chatState } from '~/routes/(chat)/-state';
import { rehypePlugins, remarkPlugins } from '~/utils/markdown';
import { randomFloat } from '~/utils/math';
import { createLatestAsync } from '~/utils/signals';

import CopyButton from './CopyButton';
import { MarkdownRoot } from './Renderer';
void hoverStateChange;

function SourceComponent(
  props: ParentProps<
    { documentId: string; id: string; type: 'document' } | { href: string; type: 'url' }
  >
) {
  const documentDialog = useDocumentDialog();
  const documentQuery = useQuery(() => ({
    enabled: props.type === 'document',
    queryFn: async ({ queryKey: [, documentId, id] }) => {
      const document = chatState.attachments.find((attachment) => attachment.id === documentId)!;
      const text = document.transient
        ? await transientDb.getText(id, documentId)
        : await vectorDb.getText(id, documentId);
      return { ...document, text: text ?? 'Error: Not Found' };
    },
    queryKey: ['document', props.documentId, props.id] as const
  }));
  const [isHovering, setIsHovering] = createSignal<boolean>(false);

  return (
    <>
      <span class={cn('rounded-full px-1 mr-1 transition-colors', isHovering() && 'bg-primary/15')}>
        <span>{props.children}</span>
      </span>
      <Switch>
        <Match when={props.type === 'document'}>
          <Suspense
            fallback={
              <button class="bg-accent rounded-full inline-flex gap-1 items-center px-2 truncate text-xs font-mono max-w-36">
                <span class="icon-[svg-spinners--180-ring-with-bg]" />
                <span>Loading Citation</span>
              </button>
            }
          >
            <button
              class="bg-accent rounded-full px-2 truncate text-xs font-mono max-w-36"
              onClick={() => documentDialog.open({ document: documentQuery.data! })}
              title={documentQuery.data?.description}
              use:hoverStateChange={setIsHovering}
            >
              {documentQuery.data?.description}
            </button>
          </Suspense>
        </Match>
        <Match when={props.type === 'url'}>
          <a
            class="bg-accent rounded-full px-2 truncate text-xs font-mono max-w-36"
            href={props.href}
            rel="noreferrer"
            target="_blank"
            use:hoverStateChange={setIsHovering}
          >
            {props.href}
          </a>
        </Match>
      </Switch>
    </>
  );
}

const createProcessor = () =>
  unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypePlugins);

type TProps = JSX.HTMLAttributes<HTMLDivElement> & {
  content: string;
  contentId: string;
  inProgress?: boolean;
  queryKey?: string[];
  worker?: boolean;
};
function LineSkeleton() {
  const width = randomFloat({ max: 1, min: 0.5 });
  return (
    <div
      class="h-[1em] rounded-full bg-primary/10 animate-pulse"
      style={{ width: `${width * 100}%` }}
    />
  );
}

function Markdown(props: TProps) {
  const [local, others] = splitProps(props, [
    'content',
    'contentId',
    'queryKey',
    'worker',
    'class',
    'inProgress'
  ]);
  const processor = createProcessor();

  const [node, setNode] = createStore<Root>({ children: [], type: 'root' });
  const update = async (content: string) => {
    const file = new VFile();
    file.value = content;
    const tree = processor.runSync(processor.parse(file), file);
    setNode(reconcile(tree));
  };

  createLatestAsync(() => local.content, update);

  return (
    <Show fallback={<MarkdownSkeleton content={local.content} />} when={node}>
      <div class={local.class} {...others}>
        <MarkdownRoot
          context={{
            listDepth: 0,
            options: {
              components: {
                'mention-src': (
                  props: ParentProps<
                    | { 'data-document-id': string; 'data-id': string; 'data-type': 'document' }
                    | { 'data-href': string; 'data-type': 'url' }
                  >
                ) => {
                  const parsedProps = createMemo(() =>
                    props['data-type'] === 'url'
                      ? {
                          href: props['data-href'],
                          type: 'url' as const
                        }
                      : {
                          documentId: props['data-document-id'],
                          id: props['data-id'],
                          type: 'document' as const
                        }
                  );
                  return <SourceComponent {...parsedProps()}>{props.children}</SourceComponent>;
                },
                pre: (props: any) => <Pre pending={!!local.inProgress} {...props} />,
                table: (props: any) => {
                  return (
                    <div class="overflow-x-auto">
                      <table {...props} />
                    </div>
                  );
                }
              }
            },
            schema: html
          }}
          node={node}
        />
      </div>
    </Show>
  );
}

function MarkdownSkeleton(props: { content: string }) {
  const paragraphs = () => props.content.split('\n\n');
  return (
    <div class="flex flex-col gap-4">
      <Index each={paragraphs()}>
        {(paragraph) => {
          const numberOfLines = () => paragraph().match(/\n/g)?.length ?? 1;
          return (
            <div class="flex flex-col gap-1">
              <Repeat times={numberOfLines()}>
                <LineSkeleton />
              </Repeat>
            </div>
          );
        }}
      </Index>
    </div>
  );
}
function Pre(props: any) {
  const [local, others] = splitProps(props, ['pending', 'class', 'ref']);
  const [text, setText] = createSignal<string>('');
  const [expanded, setExpanded] = createSignal(false);
  const [canExpand, setCanExpand] = createSignal(false);

  return (
    <div class="relative isolate">
      <Show when={!local.pending}>
        <div class="absolute top-0 right-0 m-2 z-10 flex items-center gap-2">
          <CopyButton value={text()}>
            {(status) => (
              <Button
                as="div"
                class={cn(
                  'size-8 transition backdrop-blur-xs',
                  status() === 'idle'
                    ? 'bg-secondary/50 hover:bg-secondary text-secondary-foreground'
                    : '',
                  status() === 'success'
                    ? 'bg-success hover:bg-success/90 text-success-foreground'
                    : '',
                  status() === 'error' ? 'bg-error hover:bg-error/90 text-error-foreground' : ''
                )}
                size="icon"
                variant="secondary"
              >
                <Switch>
                  <Match when={status() === 'idle'}>
                    <div class="icon-[heroicons--clipboard-document]" />
                  </Match>
                  <Match when={status() === 'success'}>
                    <div class="icon-[heroicons--check]" />
                  </Match>
                  <Match when={status() === 'error'}>
                    <div class="icon-[heroicons--x-mark]" />
                  </Match>
                </Switch>
              </Button>
            )}
          </CopyButton>
          <Show when={canExpand()}>
            <Button
              class="size-8 transition backdrop-blur-xs bg-secondary/50 hover:bg-secondary text-secondary-foreground"
              onClick={() => setExpanded(!expanded())}
              size="icon"
              variant="secondary"
            >
              <span
                class={cn(
                  'icon-[heroicons--chevron-down] transition-transform',
                  expanded() ? 'rotate-180' : ''
                )}
              />
              <span class="sr-only">{expanded() ? 'Collapse' : 'Expand'}</span>
            </Button>
          </Show>
        </div>
      </Show>
      <pre
        class={cn(
          local.class,
          'border border-secondary relative overflow-auto bg-neutral-950 mt-0 whitespace-pre-wrap',
          expanded() || local.pending ? 'max-h-none' : 'max-h-72'
        )}
        ref={(el) => {
          setTimeout(() => setText(el.textContent));
          createResizeObserver(el, () =>
            setCanExpand(expanded() || el.scrollHeight > el.clientHeight)
          );
        }}
        {...others}
      />
    </div>
  );
}

export default Markdown;
