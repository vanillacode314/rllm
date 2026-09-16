import {
  draggable,
  type ElementEventBasePayload,
  type ElementGetFeedbackArgs
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import {
  children,
  createContext,
  createEffect,
  onCleanup,
  onMount,
  type ParentProps,
  useContext
} from 'solid-js';
import { createStore, type Store } from 'solid-js/store';

import { produce } from '~/utils/immer';

type DraggableState = {
  dragHandle?: HTMLElement;
};
const DraggableContext =
  createContext<[Store<DraggableState>, (fn: (state: DraggableState) => void) => void]>();

export function AttachDraggable<T extends Record<string, unknown>>(
  props: ParentProps<{
    canDrag?: (arg: ElementGetFeedbackArgs) => boolean;
    data: T;
    onDrag?: (arg: ElementEventBasePayload) => void;
    onDragStart?: (arg: ElementEventBasePayload) => void;
    onDrop?: (arg: ElementEventBasePayload) => void;
  }>
) {
  // oxlint-disable-next-line solid/reactivity
  const { canDrag, onDrag, onDragStart, onDrop } = props;
  const ref = children(() => props.children);
  const [state] = useDraggable();

  createEffect(() => {
    const element = ref() as HTMLElement | HTMLElement[];
    if (Array.isArray(element)) {
      throw new Error('Draggable only supports a single child');
    }
    const cleanup = draggable({
      canDrag,
      dragHandle: state.dragHandle,
      element,
      getInitialData: () => props.data,
      onDrag,
      onDragStart: (event) => {
        element.dataset.xOpacity = element.style.opacity;
        element.style.opacity = '0';
        onDragStart?.(event);
      },
      onDrop: (event) => {
        element.style.opacity = element.dataset.xOpacity ?? element.style.opacity;
        delete element.dataset.xOpacity;
        onDrop?.(event);
      }
    });
    onCleanup(() => cleanup());
  });

  return <>{ref()}</>;
}

export function Draggable<T extends Record<string, unknown>>(
  props: ParentProps<{
    canDrag?: (arg: ElementGetFeedbackArgs) => boolean;
    data: T;
    onDrag?: (arg: ElementEventBasePayload) => void;
    onDragStart?: (arg: ElementEventBasePayload) => void;
    onDrop?: (arg: ElementEventBasePayload) => void;
  }>
) {
  return (
    <DraggableProvider>
      <AttachDraggable {...props} />
    </DraggableProvider>
  );
}

export function DragHandle(props: ParentProps) {
  const ref = children(() => props.children);
  const [_, setState] = useDraggable();

  onMount(() => {
    const el = ref() as HTMLElement;
    setState((state) => {
      state.dragHandle = el;
    });
    onCleanup(() =>
      setState((state) => {
        if (state.dragHandle === el) {
          state.dragHandle = undefined;
        }
      })
    );
  });
  return <>{ref()}</>;
}

function DraggableProvider(props: ParentProps) {
  const [state, setState] = createStore<DraggableState>({});
  return (
    <DraggableContext.Provider value={[state, (fn) => setState((state) => produce(state, fn))]}>
      {props.children}
    </DraggableContext.Provider>
  );
}

function useDraggable() {
  const context = useContext(DraggableContext);
  if (!context) {
    throw new Error('useDraggableContext must be used within a DraggableContext.Provider');
  }
  return context;
}
