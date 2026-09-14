import { createListTransition } from '@solid-primitives/transition-group';
import { animate, type StyleKeyframesDefinition } from 'motion';
import { children, type ParentProps } from 'solid-js';

function overrideProperty(element: HTMLElement, property: string, value: string) {
  saveProperties(element, property);
  element.style.setProperty(property, value);
}

function saveProperties(element: HTMLElement, ...properties: string[]) {
  for (const property of properties) {
    element.dataset[`x${property}`] = element.style.getPropertyValue(property);
  }
}

function restoreProperties(element: HTMLElement, ...properties: string[]) {
  for (const property of properties) {
    element.style.setProperty(property, element.dataset[`x${property}`] || '');
    delete element.dataset[`x${property}`];
  }
}

export function TransitionSlide(props: ParentProps) {
  const resolvedChildren = children(() => props.children);

  const transition = createListTransition(() => resolvedChildren.toArray() as HTMLElement[], {
    onChange({ added, unchanged, removed, finishRemoved }) {
      function handleAdded(elements: HTMLElement[]) {
        for (const element of elements) {
          element.dataset.isTransitioning = 'true';
          overrideProperty(element, 'overflow', 'clip');

          queueMicrotask(() => {
            if (!element.isConnected) {
              restoreProperties(element, 'overflow');
              delete element.dataset.isTransitioning;
              return;
            }
            const style = getComputedStyle(element);
            const height = parseFloat(style.height);
            const paddingTop = parseFloat(style.paddingTop);
            const paddingBottom = parseFloat(style.paddingBottom);
            const marginTop = parseFloat(style.marginTop);
            const marginBottom = parseFloat(style.marginBottom);
            const borderTopWidth = parseFloat(style.borderTopWidth);
            const borderBottomWidth = parseFloat(style.borderBottomWidth);
            animate(
              element,
              {
                height: [0, height],
                marginTop: [0, marginTop],
                marginBottom: [0, marginBottom],
                paddingTop: [0, paddingTop],
                paddingBottom: [0, paddingBottom],
                borderTopWidth: [0, borderTopWidth],
                borderBottomWidth: [0, borderBottomWidth]
              },
              { type: 'spring', damping: 20, stiffness: 200 }
            ).then(() => {
              restoreProperties(element, 'overflow');
              delete element.dataset.isTransitioning;
            });
          });
        }
      }

      async function handleRemoved(elements: HTMLElement[]) {
        const tasks = elements.map((element) => {
          if (!element.isConnected) return;
          element.dataset.isTransitioning = 'true';
          overrideProperty(element, 'overflow', 'clip');
          return animate(
            element,
            {
              height: 0,
              marginTop: 0,
              marginBottom: 0,
              paddingTop: 0,
              paddingBottom: 0,
              borderTopWidth: 0,
              borderBottomWidth: 0
            },
            { type: 'spring', damping: 20, stiffness: 200 }
          ).then(() => {
            restoreProperties(element, 'overflow');
            delete element.dataset.isTransitioning;
          });
        });

        await Promise.all(tasks);
      }

      function handleUnchanged(elements: HTMLElement[]) {
        for (const element of elements) {
          if (!element.isConnected) return;
          const { x: x1, y: y1 } = element.getBoundingClientRect();
          element.dataset.isTransitioning = 'true';

          queueMicrotask(() => {
            if (!element.isConnected) {
              delete element.dataset.isTransitioning;
              return;
            }
            const { x: x2, y: y2 } = element.getBoundingClientRect();
            const dx = x1 - x2;
            const dy = y1 - y2;

            if (dx !== 0 || dy !== 0) {
              animate(
                element,
                { x: [dx, 0], y: [dy, 0] },
                { type: 'spring', damping: 20, stiffness: 200 }
              ).then(() => {
                delete element.dataset.isTransitioning;
              });
              return;
            }
            delete element.dataset.isTransitioning;
          });
        }
      }

      handleAdded(added);
      void handleRemoved(removed).finally(() => finishRemoved(removed));
      handleUnchanged(unchanged);
    }
  });

  return <>{transition()}</>;
}
