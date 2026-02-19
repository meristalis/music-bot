import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    // Вот эта магия разрешает Vite принимать запросы от туннеля
    allowedHosts: [
      '0f6c41875d9d235e-176-59-0-195.serveousercontent.com', // Твой текущий адрес
      '.loca.lt'                    // Разрешить любые поддомены localtunnel на будущее
    ]
  }
})