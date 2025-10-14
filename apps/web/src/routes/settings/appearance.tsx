import { useColorMode } from '@kobalte/core/color-mode';
import { createFileRoute } from '@tanstack/solid-router';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

export const Route = createFileRoute('/settings/appearance')({
	component: SettingsAppearanceComponent
});

function SettingsAppearanceComponent() {
	const { colorMode, setColorMode } = useColorMode();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Appearance</CardTitle>
				<CardDescription>Customize the look and feel of the app.</CardDescription>
			</CardHeader>
			<CardContent class="max-sm:grid grid-cols-3 flex gap-2">
				<Button
					onClick={() => setColorMode('dark')}
					variant={colorMode() === 'dark' ? 'default' : 'secondary'}
				>
					<div class="icon-[heroicons--moon] text-lg" />
					<span>Dark</span>
				</Button>
				<Button
					onClick={() => setColorMode('light')}
					variant={colorMode() === 'light' ? 'default' : 'secondary'}
				>
					<div class="icon-[heroicons--sun] text-lg" />
					<span>Light</span>
				</Button>
				<Button onClick={() => setColorMode('system')} variant="outline">
					<div class="icon-[heroicons--computer-desktop] text-lg" />
					<span>Auto</span>
				</Button>
			</CardContent>
		</Card>
	);
}
