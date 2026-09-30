import type { CapacitorConfig } from '@capacitor/cli'

// APPLICATION_ID_STATUS=PROVISIONAL_BEFORE_FIRST_PLAY_UPLOAD
// appId can still be changed until the first Google Play upload, and only by
// explicit operator decision. After the first upload it is permanent.
const config: CapacitorConfig = {
  appId: 'ar.com.eljaguar.app',
  appName: 'EL JAGUAR',
  webDir: 'dist',
}

export default config
