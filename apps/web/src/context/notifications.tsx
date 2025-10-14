import { type } from 'arktype';
import { nanoid } from 'nanoid';
import { createStore } from 'solid-js/store';

const notificationsSchema = type({
	id: 'string',
	content: 'string'
});
type TNotification = typeof notificationsSchema.infer;

const [notifications, setNotifications] = createStore<TNotification[]>([]);

const useNotifications = () => {
	function createNotification(
		content: string,
		opts: { id?: string; timeoutMs?: number } = {}
	): string {
		const { timeoutMs } = opts;
		if (opts.id) {
			const index = notifications.findIndex((n) => n.id === opts.id);
			if (index >= 0) {
				setNotifications(index, 'content', content);
			} else {
				setNotifications(notifications.length, { id: opts.id, content });
			}
			return opts.id;
		}
		const id = nanoid();
		if (timeoutMs !== undefined) {
			setTimeout(() => removeNotification(id), timeoutMs);
		}
		setNotifications(notifications.length, { id, content });
		return id;
	}
	function removeNotification(id: string): void {
		setNotifications((notifications) => notifications.filter((n) => n.id !== id));
	}
	function updateNotification(
		id: string,
		content: string,
		opts: { timeoutMs?: number } = {}
	): void {
		const { timeoutMs } = opts;
		if (timeoutMs !== undefined) {
			setTimeout(() => removeNotification(id), timeoutMs);
		}
		const index = notifications.findIndex((n) => n.id === id);
		if (index < 0) return;
		setNotifications(index, 'content', content);
	}
	return [notifications, { createNotification, removeNotification, updateNotification }] as const;
};

export { useNotifications };
