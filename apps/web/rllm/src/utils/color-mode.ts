export async function syncColorMode() {
  const mode = document.documentElement.getAttribute('data-kb-theme') ?? 'dark';
  const { EdgeToEdge } = await import('@capawesome/capacitor-android-edge-to-edge-support');
  const { SystemBars, SystemBarsStyle } = await import('@capacitor/core');
  await SystemBars.setStyle({
    style: mode === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light
  });
  await EdgeToEdge.setStatusBarColor({ color: mode === 'dark' ? '#111111' : '#f9f9f9' });
  await EdgeToEdge.setNavigationBarColor({ color: mode === 'dark' ? '#111111' : '#f9f9f9' });
}
