/**
 * Navigation Config
 *
 * Add one entry per nav item. Routes are handled by generouted
 * (file-based routing in src/pages/), this just controls what
 * appears in the navigation bar.
 */

import { Settings, Shield, Spade, Trophy, type LucideIcon } from 'lucide-react'
import type { Role } from './constants'

export interface NavItem {
  path: string
  label: string
  /** Shown in the phone tab bar. */
  icon: LucideIcon
  roles?: Role[]
  devOnly?: boolean
}

export const nav: NavItem[] = [
  { path: '/games', label: 'Games', icon: Spade },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/admin', label: 'Admin', icon: Shield, roles: ['admin'] },
  // ── Features add nav items below this line ──
]
