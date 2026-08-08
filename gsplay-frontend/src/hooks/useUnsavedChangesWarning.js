import { useEffect } from 'react'

const warning = 'You have unsaved guide changes. Leave without saving?'

export function useUnsavedChangesWarning(when) {
  useEffect(() => {
    if (!when) return undefined

    const beforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const beforeLinkNavigation = (event) => {
      const link = event.target.closest?.('a[href]')
      if (!link || link.target === '_blank' || event.defaultPrevented) return
      const destination = new URL(link.href, window.location.href)
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href ||
        window.confirm(warning)
      )
        return
      event.preventDefault()
    }

    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', beforeLinkNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', beforeLinkNavigation, true)
    }
  }, [when])
}
