import { create } from 'zustand'

interface NavigationState {
  activeTab: number
  mobileSheetOpen: boolean
  desktopPanelOpen: boolean
  fabTrigger: number
  quickActionOpen: boolean

  setActiveTab: (tab: number) => void
  setMobileSheetOpen: (open: boolean) => void
  setDesktopPanelOpen: (open: boolean) => void
  toggleDesktopPanel: (clickedTab: number) => void
  triggerFAB: () => void
  consumeFAB: () => void
  openQuickAction: () => void
  closeQuickAction: () => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeTab: 0,
  mobileSheetOpen: false,
  desktopPanelOpen: true,
  fabTrigger: 0,
  quickActionOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setMobileSheetOpen: (open) => set({ mobileSheetOpen: open }),
  setDesktopPanelOpen: (open) => set({ desktopPanelOpen: open }),
  toggleDesktopPanel: (clickedTab) => set((s) => {
    if (s.activeTab === clickedTab) return { desktopPanelOpen: !s.desktopPanelOpen }
    return { activeTab: clickedTab, desktopPanelOpen: true }
  }),
  triggerFAB: () => set((s) => ({ fabTrigger: s.fabTrigger + 1, activeTab: 1, mobileSheetOpen: true })),
  consumeFAB: () => set({ fabTrigger: 0 }),
  openQuickAction: () => set({ quickActionOpen: true }),
  closeQuickAction: () => set({ quickActionOpen: false }),
}))
