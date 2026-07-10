import { useColorMode } from '@kobalte/core/color-mode';
import { createFileRoute } from '@tanstack/solid-router';
import { Button } from 'ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'ui/card';

import { syncColorMode } from '~/utils/color-mode';

export const Route = createFileRoute('/settings/appearance')({
  component: SettingsAppearanceComponent
});

function SettingsAppearanceComponent() {
  const { colorMode, setColorMode } = useColorMode();

  function updateColorMode(value: 'dark' | 'light' | 'system') {
    setColorMode(value);
    if (import.meta.env.VITE_MODE === 'android') syncColorMode();
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel of the app.</CardDescription>
        </CardHeader>
        <CardContent class="max-sm:grid grid-cols-3 flex gap-2">
          <Button
            onClick={() => updateColorMode('dark')}
            variant={colorMode() === 'dark' ? 'default' : 'secondary'}
          >
            <div class="icon-[heroicons--moon] text-lg" />
            <span>Dark</span>
          </Button>
          <Button
            onClick={() => updateColorMode('light')}
            variant={colorMode() === 'light' ? 'default' : 'secondary'}
          >
            <div class="icon-[heroicons--sun] text-lg" />
            <span>Light</span>
          </Button>
          <Button onClick={() => updateColorMode('system')} variant="outline">
            <div class="icon-[heroicons--computer-desktop] text-lg" />
            <span>Auto</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
