import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './components/Landing'
import LiveDemo from './components/LiveDemo'
import VideoUpload from './components/VideoUpload'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/demo" element={<LiveDemo />} />
        <Route path="/upload" element={<VideoUpload />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
