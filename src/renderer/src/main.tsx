import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// ChakraProvider 由 App 内的主题外壳挂载（支持运行时切换 液态玻璃/纯黑/纯白 主题）
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
