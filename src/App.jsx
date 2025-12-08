import { CssBaseline } from '@mui/material'
import './App.css'
import HomePage from './ui/pages/HomePage'
import LeaguePage from './ui/pages/LeaguePage'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useInitializePlayerCache } from './hooks/useInitializePlayerCache'

function App() {
  useInitializePlayerCache();

  return (
    <BrowserRouter>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/league/:leagueId" element={<LeaguePage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
