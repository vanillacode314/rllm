import { createMemo, createSignal } from 'solid-js';

import { Button } from '~/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '~/components/ui/dialog';

export type TConfirmDialogOptions = {
	readonly cancelText?: string;
	readonly confirmText?: string;
	readonly description: string;
	readonly onCancel?: () => void;
	readonly onConfirm: () => Promise<void> | void;
	readonly title: string;
	readonly variant?: 'default' | 'destructive';
};

const [options, setOptions] = createSignal<null | TConfirmDialogOptions>(null);
const open = createMemo(() => options() !== null);

export function ConfirmDialog() {
	return (
		<Dialog
			onOpenChange={(value) => {
				if (!value) {
					setOptions(null);
				}
			}}
			open={open()}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{options()?.title}</DialogTitle>
					<DialogDescription>{options()?.description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						onClick={() => {
							options()?.onCancel?.();
							setOptions(null);
						}}
						variant="secondary"
					>
						{options()?.cancelText || 'Cancel'}
					</Button>
					<Button
						onClick={async () => {
							await options()?.onConfirm();
							setOptions(null);
						}}
						variant={options()?.variant || 'default'}
					>
						{options()?.confirmText || 'Confirm'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function useConfirmDialog() {
	return {
		confirm: async (opts: TConfirmDialogOptions) => {
			setOptions(opts);
		}
	};
}

export default ConfirmDialog;
