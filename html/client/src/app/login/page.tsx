'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (response.ok) {
        // Redirect to dashboard on successful login
        router.push('/dashboard')
      } else {
        const data = await response.json()
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-5 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/image.jpg')" }}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-white/10">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6 tracking-tight">
          Login at Hodder Construction Ltd.
        </h2>
        
        {error && (
          <p className="text-red-600 font-bold mb-4 text-sm">
            {error}
          </p>
        )}
        
        <form onSubmit={handleSubmit} className="flex flex-col">
          <label htmlFor="username" className="mb-2 text-black font-bold text-left">
            Username:
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full p-3 mb-5 border border-black/10 rounded-lg text-gray-800 bg-white/90 text-base transition-all duration-300 focus:border-blue-500 focus:outline-none focus:shadow-lg focus:shadow-blue-300/30"
          />
          
          <label htmlFor="password" className="mb-2 text-black font-bold text-left">
            Password:
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-3 mb-5 border border-black/10 rounded-lg text-gray-800 bg-white/90 text-base transition-all duration-300 focus:border-blue-500 focus:outline-none focus:shadow-lg focus:shadow-blue-300/30"
          />
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full p-3 border-none rounded-lg bg-blue-600 text-white text-base font-semibold cursor-pointer transition-all duration-300 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}