import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Login from '@/pages/Login'
import InspectionList from '@/pages/InspectionList'
import InspectionDetail from '@/pages/InspectionDetail'
import PointCapture from '@/pages/PointCapture'
import Layout from '@/components/Layout'
import './index.css'

function App() {
  useRegisterSW({ immediate: true })

  return (
    <BrowserRouter basename="/campo-pwa">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/inspecoes" replace />} />
          <Route path="inspecoes" element={<InspectionList />} />
          <Route path="inspecoes/:id" element={<InspectionDetail />} />
          <Route path="inspecoes/:id/ponto/:nodeId" element={<PointCapture />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
