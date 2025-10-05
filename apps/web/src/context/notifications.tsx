import { type } from 'arktype'
import { nanoid } from 'nanoid'
import { createContext, type JSXElement, useContext } from 'solid-js'
import { createStore, produce, type SetStoreFunction } from 'solid-js/store'

const notificationsSchema = type({
  id: 'string',
  content: 'string',
})
type TNotification = typeof notificationsSchema.infer
const NotificationsContext =
  createContext<[TNotification[], SetStoreFunction<TNotification[]>]>()

function NotificationsProvider(props: { children: JSXElement }) {
  const value = createStore<TNotification[]>([])
  return (
    <NotificationsContext.Provider value={value}>
      {props.children}
    </NotificationsContext.Provider>
  )
}

function useNotifications() {
  const store = useContext(NotificationsContext)
  if (!store)
    throw new Error(
      'useNotifications must be used within a NotificationsProvider',
    )
  const [notifications, setNotifications] = store
  return [
    notifications,
    {
      createNotification(content: string): string {
        const id = nanoid()
        setNotifications(notifications.length, { id, content })
        return id
      },
      removeNotification(id: string): void {
        const index = notifications.findIndex((n) => n.id === id)
        if (index < 0) return
        setNotifications(
          produce((notifications) => {
            notifications.splice(index, 1)
          }),
        )
      },
      updateNotification(id: string, content: string): void {
        const index = notifications.findIndex((n) => n.id === id)
        if (index < 0) return
        setNotifications(index, 'content', content)
      },
    },
  ] as const
}

export { NotificationsProvider, useNotifications }
