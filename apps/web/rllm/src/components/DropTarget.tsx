import {
  dropTargetForElements,
  type ElementDropTargetEventBasePayload,
  type ElementDropTargetGetFeedbackArgs
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { children, createEffect, onCleanup, type ParentProps } from 'solid-js';

export function DropTarget(
  props: ParentProps<{
    canDrop?: (args: ElementDropTargetGetFeedbackArgs) => boolean;
    onDrag?: (args: ElementDropTargetEventBasePayload) => void;
    onDragEnter?: (args: ElementDropTargetEventBasePayload) => void;
    onDragLeave?: (args: ElementDropTargetEventBasePayload) => void;
    onDrop?: (args: ElementDropTargetEventBasePayload) => void;
  }>
) {
  // oxlint-disable-next-line solid/reactivity
  const { canDrop, onDrag, onDragEnter, onDragLeave, onDrop } = props;
  const ref = children(() => props.children);

  createEffect(() => {
    const cleanup = dropTargetForElements({
      canDrop,
      element: ref() as HTMLElement,
      onDrag,
      onDragEnter,
      onDragLeave,
      onDrop
    });
    onCleanup(() => cleanup());
  });

  return <>{ref()}</>;
}
