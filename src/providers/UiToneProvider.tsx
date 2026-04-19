/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'

type Ctx = {
  setHeat: (on: boolean) => void
}

const Ctx = createContext<Ctx | null>(null)

function syncDom(pathname: string, depth: number) {
  const forceCalm =
    pathname.startsWith('/app/profile') || pathname.startsWith('/app/store')
  const heat = !forceCalm && depth > 0
  document.documentElement.setAttribute(
    'data-ui-tone',
    heat ? 'heat' : 'calm',
  )
}

export function UiToneProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const heatDepthRef = useRef(0)

  const setHeat = useCallback(
    (on: boolean) => {
      if (on) {
        heatDepthRef.current += 1
      } else {
        heatDepthRef.current = Math.max(0, heatDepthRef.current - 1)
      }
      syncDom(location.pathname, heatDepthRef.current)
    },
    [location.pathname],
  )

  useEffect(() => {
    syncDom(location.pathname, heatDepthRef.current)
  }, [location.pathname])

  return <Ctx.Provider value={{ setHeat }}>{children}</Ctx.Provider>
}

export function useUiTone() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUiTone outside UiToneProvider')
  return v
}
