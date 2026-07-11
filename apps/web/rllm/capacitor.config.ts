import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raqueeb.rllm',
  appName: 'rllm',
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    CapacitorSQLite: {
      androidBiometric: {
        biometricAuth: false,
        biometricSubTitle: 'Log in using your biometric',
        biometricTitle: 'Biometric login'
      },
      androidIsEncryption: false,
      electronIsEncryption: false,
      electronLinuxLocation: 'Databases',
      electronMacLocation: '/Volumes/Development/Databases',
      electronWindowsLocation: 'C:\\ProgramData\\CapacitorDatabases',
      iosBiometric: {
        biometricAuth: false,
        biometricTitle: 'Biometric login for capacitor sqlite'
      },
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      iosKeychainPrefix: 'rllm'
    },
    EdgeToEdge: {
      backgroundColor: '#111111',
      navigationBarColor: '#111111',
      statusBarColor: '#111111'
    },
    Keyboard: {
      resizeOnFullScreen: false
    },
    SystemBars: {
      insetsHandling: 'disable'
    }
  },
  server: {
    androidScheme: 'https',
    hostname: 'llm.raqueeb.com'
    // url: 'https://dev.homelab.lan'
  },
  webDir: 'dist'
};

export default config;
