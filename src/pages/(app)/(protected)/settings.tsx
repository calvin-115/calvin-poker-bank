/**
 * Example gated page. Reached at /settings — no auth logic lives here
 * because (protected)/_layout.tsx already wraps the subtree in <AuthGate>.
 */

import { useState } from 'react'
import { signOut, useUser } from 'deepspace'
import { Button, Switch } from '@/components/ui'
import { isSoundOn, playChipClack, setSoundOn } from '@/lib/sound'

export default function SettingsPage() {
  const { user } = useUser()
  const [sound, setSound] = useState(isSoundOn)

  function toggleSound(on: boolean) {
    setSoundOn(on)
    setSound(on)
    // Let them hear what they just turned on.
    if (on) playChipClack()
  }

  return (
    // No background on page wrappers — pages render into whatever the app's
    // (app)/_layout provides (a plain background, or a raised panel), so they
    // stay transparent and inherit it.
    <div className="min-h-full text-foreground">
      <div className="mx-auto grid max-w-2xl gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">Settings</h1>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl font-bold">Your account</h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{user?.email ?? '—'}</dd>
            </div>
          </dl>

          <Button variant="secondary" className="mt-6" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl font-bold">Table sounds</h2>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              <span className="block font-medium">Chip sounds</span>
              <span className="block text-muted-foreground">A soft chip clack when a buy-in lands. Only on this device.</span>
            </span>
            <Switch checked={sound} onCheckedChange={toggleSound} />
          </label>
        </section>
      </div>
    </div>
  )
}
