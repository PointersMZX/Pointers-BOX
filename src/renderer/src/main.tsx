import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// ChakraProvider 由 App 内的主题外壳挂载（v2.3.0 四主题：紫金黑/自定义/纯黑/纯白，液态玻璃按主题可开关）
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
