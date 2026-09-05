import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'cc.pointers.box',
  appName: 'Pointers-BOX',
  webDir: 'out/renderer',
  backgroundColor: '#1a365d',
  android: {
    allowMixedContent: false
  },
  server: {
    androidScheme: 'https'
  }
}

export default config
