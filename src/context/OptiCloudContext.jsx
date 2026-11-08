import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { configInicial } from '../data/catalogoInstancias'
import { buildModel, isConfigValid } from '../lib/or/buildModel'
import { solveBranchAndBound } from '../lib/or/branchAndBound'
import { solveSimplex } from '../lib/or/simplex'

const STORAGE_KEY = 'opticloud-config'
const OptiCloudContext = createContext(null)

function loadConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return configInicial
    }

    const parsed = JSON.parse(raw)
    if (!isConfigValid(parsed)) {
      return configInicial
    }

    return parsed
  } catch {
    return configInicial
  }
}

function persistConfig(config) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function OptiCloudProvider({ children }) {
  const [config, setConfig] = useState(loadConfig)
  const [simplex, setSimplex] = useState(null)
  const [bnb, setBnb] = useState(null)

  const model = useMemo(() => buildModel(config), [config])
  const configValida = useMemo(() => isConfigValid(config), [config])

  const updateConfig = useCallback((nextConfig) => {
    setConfig((current) => {
      const resolved = typeof nextConfig === 'function' ? nextConfig(current) : nextConfig
      persistConfig(resolved)
      return resolved
    })
    setSimplex(null)
    setBnb(null)
  }, [])

  const resetConfig = useCallback(() => {
    persistConfig(configInicial)
    setConfig(configInicial)
    setSimplex(null)
    setBnb(null)
  }, [])

  const clearResults = useCallback(() => {
    setSimplex(null)
    setBnb(null)
  }, [])

  const runSimplex = useCallback(() => {
    if (!model) {
      return
    }

    setSimplex(solveSimplex(model))
  }, [model])

  const runBranchAndBound = useCallback(() => {
    if (!model) {
      return
    }

    setBnb(solveBranchAndBound(model, solveSimplex))
  }, [model])

  const value = useMemo(
    () => ({
      config,
      model,
      configValida,
      simplex,
      bnb,
      updateConfig,
      resetConfig,
      runSimplex,
      runBranchAndBound,
      clearResults,
    }),
    [
      config,
      model,
      configValida,
      simplex,
      bnb,
      updateConfig,
      resetConfig,
      runSimplex,
      runBranchAndBound,
      clearResults,
    ],
  )

  return <OptiCloudContext.Provider value={value}>{children}</OptiCloudContext.Provider>
}

export function useOptiCloud() {
  const context = useContext(OptiCloudContext)

  if (!context) {
    throw new Error('useOptiCloud debe usarse dentro de OptiCloudProvider')
  }

  return context
}
