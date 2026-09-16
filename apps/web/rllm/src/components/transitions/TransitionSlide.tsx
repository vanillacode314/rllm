import { createListTransition } from '@solid-primitives/transition-group';
import { animate } from 'motion';
import { children, type ParentProps } from 'solid-js';

export function TransitionSlide(props: ParentProps) {
  const resolvedChildren = children(() => props.children);

  const transition = createListTransition(() => resolvedChildren.toArray() as HTMLElement[], {
    onChange({ added, finishRemoved, removed, unchanged }) {
      function handleAdded(elements: HTMLElement[]) {
        for (const element of elements) {
          element.dataset.isTransitioning = 'true';
          overrideProperty(element, 'overflow', 'clip');

          queueMicrotask(async () => {
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
            try {
              await animate(
                element,
                {
                  borderBottomWidth: [0, borderBottomWidth],
                  borderTopWidth: [0, borderTopWidth],
                  height: [0, height],
                  marginBottom: [0, marginBottom],
                  marginTop: [0, marginTop],
                  paddingBottom: [0, paddingBottom],
                  paddingTop: [0, paddingTop]
                },
                { damping: 20, stiffness: 200, type: 'spring' }
              );
              restoreProperties(element, 'overflow');
              delete element.dataset.isTransitioning;
            } catch {
              restoreProperties(element, 'overflow');
              delete element.dataset.isTransitioning;
            }
          });
        }
      }

      async function handleRemoved(elements: HTMLElement[]) {
        const tasks = elements.map(async (element) => {
          if (!element.isConnected) return;
          element.dataset.isTransitioning = 'true';
          overrideProperty(element, 'overflow', 'clip');
          try {
            await animate(
              element,
              {
                borderBottomWidth: 0,
                borderTopWidth: 0,
                height: 0,
                marginBottom: 0,
                marginTop: 0,
                paddingBottom: 0,
                paddingTop: 0
              },
              { damping: 20, stiffness: 200, type: 'spring' }
            );
            restoreProperties(element, 'overflow');
            delete element.dataset.isTransitioning;
          } catch {
            restoreProperties(element, 'overflow');
            delete element.dataset.isTransitioning;
          }
        });

        await Promise.all(tasks);
      }

      function handleUnchanged(elements: HTMLElement[]) {
        for (const element of elements) {
          if (!element.isConnected) return;
          const { x: x1, y: y1 } = element.getBoundingClientRect();
          element.dataset.isTransitioning = 'true';

          queueMicrotask(async () => {
            if (!element.isConnected) {
              delete element.dataset.isTransitioning;
              return;
            }
            const { x: x2, y: y2 } = element.getBoundingClientRect();
            const dx = x1 - x2;
            const dy = y1 - y2;

            if (dx !== 0 || dy !== 0) {
              try {
                await animate(
                  element,
                  { x: [dx, 0], y: [dy, 0] },
                  { damping: 20, stiffness: 200, type: 'spring' }
                );
                delete element.dataset.isTransitioning;
              } catch {
                delete element.dataset.isTransitioning;
              }
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

function overrideProperty(element: HTMLElement, property: string, value: string) {
  saveProperties(element, property);
  element.style.setProperty(property, value);
}

function restoreProperties(element: HTMLElement, ...properties: string[]) {
  for (const property of properties) {
    element.style.setProperty(property, element.dataset[`x${property}`] || '');
    delete element.dataset[`x${property}`];
  }
}

function saveProperties(element: HTMLElement, ...properties: string[]) {
  for (const property of properties) {
    element.dataset[`x${property}`] = element.style.getPropertyValue(property);
  }
}
